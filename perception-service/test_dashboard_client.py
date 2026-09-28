import json
import os
import unittest
from types import SimpleNamespace
from unittest.mock import patch
from urllib.error import HTTPError

from llm.enrich_incident import attach_to_backend
from reporting.dashboard_client import DashboardClient, DashboardClientError


class FakeHeaders:
    def __init__(self, values=None):
        self.values = values or []

    def get_all(self, name, default=None):
        if name.lower() == "set-cookie":
            return self.values
        return default


class FakeResponse:
    def __init__(self, body, cookies=None):
        self.body = json.dumps(body).encode("utf-8")
        self.headers = FakeHeaders(cookies)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return self.body


def unauthorized(url):
    return HTTPError(url, 401, "unauthorized", {}, None)


class DashboardClientTests(unittest.TestCase):
    def response_sequence(self, *responses):
        iterator = iter(responses)

        def next_response(request, timeout):
            response = next(iterator)
            if isinstance(response, HTTPError):
                raise response
            return response

        return next_response

    @patch.dict(
        os.environ,
        {
            "DASHBOARD_BACKEND_URL": "https://dashboard.test",
            "DASHBOARD_API_TOKEN": "override-token",
        },
        clear=True,
    )
    @patch("reporting.dashboard_client.urllib.request.urlopen")
    def test_token_override_authenticates_without_login(self, urlopen):
        urlopen.return_value = FakeResponse({"success": True, "data": {}})

        DashboardClient().request(
            "/api/v1/security/incidents",
            {"incident_id": "INC-1"},
            "POST",
        )

        request = urlopen.call_args.args[0]
        timeout = urlopen.call_args.kwargs["timeout"]
        self.assertEqual(request.method, "POST")
        self.assertEqual(request.get_header("Authorization"), "Bearer override-token")
        self.assertEqual(timeout, 15.0)
        self.assertEqual(urlopen.call_count, 1)

    @patch.dict(
        os.environ,
        {
            "DASHBOARD_BACKEND_URL": "https://dashboard.test",
            "DASHBOARD_SERVICE_EMAIL": "perception@example.test",
            "DASHBOARD_SERVICE_PASSWORD": "ServicePass!123",
        },
        clear=True,
    )
    @patch("reporting.dashboard_client.urllib.request.urlopen")
    def test_login_contract_and_authenticated_incident_create(self, urlopen):
        urlopen.side_effect = self.response_sequence(
            FakeResponse(
                {"success": True, "data": {"accessToken": "access-1"}},
                ["dvs_rt=refresh-1; Path=/api/v1/auth; HttpOnly"],
            ),
            FakeResponse({"success": True, "data": {"id": 1}}),
        )

        DashboardClient().request(
            "/api/v1/security/incidents",
            {"incident_id": "INC-1"},
            "POST",
        )

        login_request = urlopen.call_args_list[0].args[0]
        self.assertEqual(login_request.full_url, "https://dashboard.test/api/v1/auth/login")
        self.assertEqual(login_request.method, "POST")
        self.assertEqual(
            json.loads(login_request.data.decode("utf-8")),
            {"email": "perception@example.test", "password": "ServicePass!123"},
        )
        api_request = urlopen.call_args_list[1].args[0]
        self.assertEqual(api_request.get_header("Authorization"), "Bearer access-1")

    @patch.dict(
        os.environ,
        {
            "DASHBOARD_BACKEND_URL": "https://dashboard.test",
            "DASHBOARD_SERVICE_EMAIL": "perception@example.test",
            "DASHBOARD_SERVICE_PASSWORD": "ServicePass!123",
        },
        clear=True,
    )
    @patch("reporting.dashboard_client.urllib.request.urlopen")
    def test_refreshes_once_then_retries_after_401(self, urlopen):
        urlopen.side_effect = self.response_sequence(
            FakeResponse(
                {"success": True, "data": {"accessToken": "access-1"}},
                ["dvs_rt=refresh-1; Path=/api/v1/auth; HttpOnly"],
            ),
            unauthorized("https://dashboard.test/api/v1/security/incidents"),
            FakeResponse(
                {"success": True, "data": {"accessToken": "access-2"}},
                ["dvs_rt=refresh-2; Path=/api/v1/auth; HttpOnly"],
            ),
            FakeResponse({"success": True, "data": {"id": 1}}),
        )

        DashboardClient().request("/api/v1/security/incidents", {}, "POST")

        self.assertEqual(urlopen.call_count, 4)
        self.assertEqual(
            urlopen.call_args_list[3].args[0].get_header("Authorization"),
            "Bearer access-2",
        )

    @patch.dict(
        os.environ,
        {
            "DASHBOARD_BACKEND_URL": "https://dashboard.test",
            "DASHBOARD_SERVICE_EMAIL": "perception@example.test",
            "DASHBOARD_SERVICE_PASSWORD": "ServicePass!123",
        },
        clear=True,
    )
    @patch("reporting.dashboard_client.urllib.request.urlopen")
    def test_second_401_does_not_retry_again(self, urlopen):
        urlopen.side_effect = self.response_sequence(
            FakeResponse(
                {"success": True, "data": {"accessToken": "access-1"}},
                [],
            ),
            unauthorized("https://dashboard.test/api/v1/security/incidents"),
            FakeResponse(
                {"success": True, "data": {"accessToken": "access-2"}},
                [],
            ),
            unauthorized("https://dashboard.test/api/v1/security/incidents"),
        )

        with self.assertRaisesRegex(DashboardClientError, "after one retry"):
            DashboardClient().request("/api/v1/security/incidents", {}, "POST")

        self.assertEqual(urlopen.call_count, 4)

    @patch.dict(
        os.environ,
        {
            "DASHBOARD_BACKEND_URL": "https://dashboard.test",
            "DASHBOARD_SERVICE_EMAIL": "perception@example.test",
            "DASHBOARD_SERVICE_PASSWORD": "ServicePass!123",
        },
        clear=True,
    )
    @patch("reporting.dashboard_client.urllib.request.urlopen")
    def test_summary_patch_is_authenticated(self, urlopen):
        urlopen.side_effect = self.response_sequence(
            FakeResponse(
                {"success": True, "data": {"accessToken": "access-1"}},
                ["dvs_rt=refresh-1; Path=/api/v1/auth; HttpOnly"],
            ),
            FakeResponse({"success": True, "data": {"aiSummary": "done"}}),
        )

        result = attach_to_backend(
            SimpleNamespace(incident_id="INC-1"),
            "summary text",
        )

        self.assertEqual(result["data"]["aiSummary"], "done")
        patch_request = urlopen.call_args_list[1].args[0]
        self.assertEqual(
            patch_request.full_url,
            "https://dashboard.test/api/v1/security/incidents/ai-summary",
        )
        self.assertEqual(patch_request.method, "PATCH")
        self.assertEqual(patch_request.get_header("Authorization"), "Bearer access-1")

    @patch.dict(
        os.environ,
        {
            "DASHBOARD_BACKEND_URL": "https://dashboard.test",
            "DASHBOARD_SERVICE_PASSWORD": "ServicePass!123",
        },
        clear=True,
    )
    def test_missing_service_credentials_are_sanitized(self):
        with self.assertRaisesRegex(DashboardClientError, "SERVICE_EMAIL") as context:
            DashboardClient().request("/api/v1/security/incidents", {}, "POST")

        self.assertNotIn("ServicePass!123", str(context.exception))

    @patch.dict(
        os.environ,
        {
            "DASHBOARD_BACKEND_URL": "https://dashboard.test",
            "DASHBOARD_SERVICE_EMAIL": "perception@example.test",
            "DASHBOARD_SERVICE_PASSWORD": "ServicePass!123",
        },
        clear=True,
    )
    @patch("reporting.dashboard_client.urllib.request.urlopen")
    def test_parent_and_enrichment_clients_login_independently(self, urlopen):
        urlopen.side_effect = self.response_sequence(
            FakeResponse({"success": True, "data": {"accessToken": "parent-access"}}, []),
            FakeResponse({"success": True, "data": {}}),
            FakeResponse({"success": True, "data": {"accessToken": "child-access"}}, []),
            FakeResponse({"success": True, "data": {}}),
        )

        DashboardClient().request("/api/v1/security/incidents", {}, "POST")
        DashboardClient().request("/api/v1/security/incidents/ai-summary", {}, "PATCH")

        self.assertEqual(urlopen.call_count, 4)
        self.assertEqual(
            urlopen.call_args_list[0].args[0].full_url,
            "https://dashboard.test/api/v1/auth/login",
        )
        self.assertEqual(
            urlopen.call_args_list[2].args[0].full_url,
            "https://dashboard.test/api/v1/auth/login",
        )


if __name__ == "__main__":
    unittest.main()
