"""Incident report persistence, backend forwarding, and LLM enrichment."""

from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.request
import uuid
from datetime import datetime, timezone
from typing import Optional

from reporting.dashboard_client import DashboardClient, DashboardClientError
from reporting.description_generator import (
    generate_description,
    recommended_action,
)
from schemas.incident_schema import IncidentRecord


class IncidentReporter:
    """Builds, validates, persists, and enriches incident reports."""

    DASHBOARD_INCIDENT_TYPES = {
        "FIRE",
        "FIRE_SMOKE",
        "SMOKE",
        "CROWD",
        "FIGHT",
        "FALL",
        "INTRUSION",
        "LOITERING",
        "THEFT",
        "INJURY",
        "PROPERTY_DAMAGE",
        "UNAUTHORIZED_ACCESS",
        "EQUIPMENT_FAILURE",
        "CHEMICAL_SPILL",
        "NEAR_MISS",
        "OTHER",
    }
    DASHBOARD_EVENT_TYPE_MAP = {
        "fire": "FIRE",
        "fire_smoke": "FIRE_SMOKE",
        "smoke": "SMOKE",
        "fight": "FIGHT",
        "intrusion": "INTRUSION",
        "fall": "FALL",
        "crowd": "CROWD",
        "loitering": "LOITERING",
    }

    def __init__(
        self,
        output_path: str,
        camera_locations: dict,
        backend_url: Optional[str] = None,
    ):
        self.output_path = output_path
        self.camera_locations = camera_locations
        self.backend_url = backend_url.rstrip("/") if backend_url else None
        self.dashboard_backend_url = os.getenv("DASHBOARD_BACKEND_URL")
        self.dashboard_backend_url = (
            self.dashboard_backend_url.rstrip("/")
            if self.dashboard_backend_url
            else None
        )
        self.dashboard_api_token = os.getenv("DASHBOARD_API_TOKEN")
        self.dashboard_client = DashboardClient()

        os.makedirs(
            os.path.dirname(output_path) or ".",
            exist_ok=True,
        )

    def build_and_save(
        self,
        confirmed_event,
        severity: str,
        clip_before: Optional[str] = None,
        keyframes: Optional[list] = None,
    ) -> dict:
        """Build, validate, save, and automatically enrich an incident."""

        location = self.camera_locations.get(
            confirmed_event.camera_id,
            confirmed_event.camera_id,
        )

        detail = dict(confirmed_event.candidate.detail or {})
        track_ids = confirmed_event.candidate.track_ids or []

        report = {
            "incident_id": (
                f"INC-{datetime.now(timezone.utc):%Y%m%d}-"
                f"{uuid.uuid4().hex[:6].upper()}"
            ),
            "camera_id": confirmed_event.camera_id,
            "location": location,
            "event_type": confirmed_event.event_type,
            "confidence_tier": confirmed_event.tier,
            "confidence_score": round(confirmed_event.confidence, 2),
            "severity": severity,
            "detected_at": datetime.now(timezone.utc).isoformat(),
            "duration_s": confirmed_event.duration_s,
            "description": generate_description(
                confirmed_event.event_type,
                location,
                detail,
            ),
            "detected_objects": [
                {
                    "track_id": track_id,
                    "role": "primary" if index == 0 else "secondary",
                }
                for index, track_id in enumerate(track_ids)
            ],
            "zone_id": confirmed_event.candidate.zone_id,
            "detail": detail,
            "evidence": {
                "clip_before": clip_before,
                "clip_after": None,
                "keyframes": keyframes or [],
            },
            "recommended_action": recommended_action(
                confirmed_event.event_type,
            ),
            "review_status": "pending",
        }

        report = IncidentRecord.model_validate(report).model_dump(
            mode="json",
        )

        # Save first. LLM failure must not discard the incident.
        self.save(report)

        # Enrich confirmed incidents only. Never use latest_record() here.
        production_llm_events = {"fight", "crowd", "fire", "smoke"}
        event_type = str(report["event_type"]).lower()
        tier = str(report["confidence_tier"]).upper()

        if tier == "CONFIRMED":
            self._create_dashboard_incident(report)

            if event_type in production_llm_events:
                self._trigger_llm_enrichment(report["incident_id"])
            else:
                print(
                    "[reporter] Skipping LLM enrichment for "
                    f"{tier} {event_type} incident "
                    f"{report['incident_id']}"
                )
        else:
            print(
                "[reporter] Skipping LLM enrichment for "
                f"{tier} {event_type} incident "
                f"{report['incident_id']}"
            )

        return report

    def _create_dashboard_incident(self, report: dict) -> None:
        """Create the dashboard incident before LLM enrichment starts."""

        event_type = str(report["event_type"]).lower()
        dashboard_type = self.DASHBOARD_EVENT_TYPE_MAP.get(event_type, "OTHER")
        if dashboard_type not in self.DASHBOARD_INCIDENT_TYPES:
            dashboard_type = "OTHER"

        payload = {
            "incident_id": report["incident_id"],
            "title": report["event_type"],
            "description": report["description"],
            "type": dashboard_type,
            "severity": report["severity"],
            "confidenceScore": report["confidence_score"],
            "location": report["location"],
            "occurredAt": report["detected_at"],
            "reportedByName": "Perception Service",
        }
        try:
            self.dashboard_client.request(
                "/api/v1/security/incidents",
                payload,
                "POST",
            )
        except DashboardClientError as exc:
            print(
                "[reporter] dashboard incident creation failed: "
                f"{exc}"
            )

    def _trigger_llm_enrichment(self, incident_id: str) -> None:
        """Run the existing exact-ID LLM enrichment module."""

        try:
            project_root = os.path.dirname(
                os.path.dirname(os.path.abspath(__file__)),
            )

            result = subprocess.run(
                [
                    sys.executable,
                    "-X",
                    "utf8",
                    "-m",
                    "llm.enrich_incident",
                    "--incident-id",
                    incident_id,
                ],
                cwd=project_root,
                capture_output=True,
                text=True,
                encoding="utf-8",
                errors="replace",
                timeout=90,
                check=False,
            )

            if result.returncode != 0:
                print(
                    "[reporter] LLM enrichment failed for "
                    f"{incident_id}: {result.stderr.strip()}"
                )
                return

            output = result.stdout.strip()
            if output:
                print(
                    "[reporter] LLM enrichment completed for "
                    f"{incident_id}: {output}"
                )
            else:
                print(
                    "[reporter] LLM enrichment completed for "
                    f"{incident_id}"
                )

        except subprocess.TimeoutExpired:
            print(
                "[reporter] LLM enrichment timed out for "
                f"{incident_id}; incident remains saved"
            )

        except Exception as exc:
            print(
                "[reporter] LLM enrichment error for "
                f"{incident_id}: {exc}; incident remains saved"
            )

    def save(self, report: dict) -> None:
        """Append the incident locally and optionally POST it to the backend."""

        with open(
            self.output_path,
            "a",
            encoding="utf-8",
        ) as file:
            file.write(
                json.dumps(
                    report,
                    ensure_ascii=False,
                )
                + "\n"
            )

        if self.backend_url:
            self._send_json(
                "/api/incidents",
                report,
                "POST",
            )

    def _send_json(
        self,
        path: str,
        payload: dict,
        method: str,
    ):
        """Send a JSON request to the configured backend."""

        body = json.dumps(
            payload,
            ensure_ascii=False,
        ).encode("utf-8")

        request = urllib.request.Request(
            url=f"{self.backend_url}{path}",
            data=body,
            headers={
                "Content-Type": "application/json",
            },
            method=method,
        )

        try:
            with urllib.request.urlopen(
                request,
                timeout=3,
            ) as response:
                return response.read()

        except Exception as exc:
            print(f"[reporter] backend {method} failed: {exc}")
            return None

    def update_evidence(
        self,
        incident_id: str,
        updates: dict,
    ) -> None:
        """Append an evidence update for an existing incident."""

        update_path = os.path.join(
            os.path.dirname(self.output_path) or ".",
            "evidence_updates.jsonl",
        )

        record = {
            "incident_id": incident_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            **updates,
        }

        with open(
            update_path,
            "a",
            encoding="utf-8",
        ) as file:
            file.write(
                json.dumps(
                    record,
                    ensure_ascii=False,
                )
                + "\n"
            )

    def update_incident(
        self,
        incident_id: str,
        updates: dict,
    ) -> None:
        """Append a lifecycle update for an existing incident."""

        update_path = os.path.join(
            os.path.dirname(self.output_path) or ".",
            "incident_updates.jsonl",
        )

        record = {
            "incident_id": incident_id,
            "updated_at": datetime.now(timezone.utc).isoformat(),
            **updates,
        }

        with open(
            update_path,
            "a",
            encoding="utf-8",
        ) as file:
            file.write(
                json.dumps(
                    record,
                    ensure_ascii=False,
                )
                + "\n"
            )
