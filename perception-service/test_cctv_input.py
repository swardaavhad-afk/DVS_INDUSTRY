import io
import os
import unittest
from contextlib import redirect_stdout
from unittest.mock import patch

from ingestion.stream_reader import StreamReader
from main import resolve_camera_runtime


class FakeCapture:
    def __init__(self, opened=True, reads=None):
        self.opened = opened
        self.reads = iter(reads or [])
        self.released = False
        self.settings = []

    def isOpened(self):
        return self.opened

    def set(self, prop, value):
        self.settings.append((prop, value))
        return True

    def read(self):
        try:
            return next(self.reads)
        except StopIteration:
            return False, None

    def release(self):
        self.released = True


class CctvInputTests(unittest.TestCase):
    camera_config = {"id": "CAM-01", "location": "Configured Room", "source": "test.mp4"}

    @patch.dict(
        os.environ,
        {
            "CCTV_RTSP_URL": "rtsp://user:secret@example.test:554/private/stream",
            "CAMERA_ID": "CAM-RTSP",
            "CAMERA_LOCATION": "North Gate",
        },
        clear=True,
    )
    def test_cctv_environment_selects_rtsp_and_metadata(self):
        camera_id, source, location, options = resolve_camera_runtime(
            "CAM-01", "local.mp4", self.camera_config
        )

        self.assertEqual(camera_id, "CAM-RTSP")
        self.assertEqual(source, "rtsp://user:secret@example.test:554/private/stream")
        self.assertEqual(location, "North Gate")
        self.assertEqual(options["source_kind"], "RTSP")

    @patch.dict(os.environ, {}, clear=True)
    def test_missing_cctv_environment_preserves_existing_source(self):
        camera_id, source, location, options = resolve_camera_runtime(
            "CAM-01", None, self.camera_config
        )

        self.assertEqual(camera_id, "CAM-01")
        self.assertEqual(source, "test.mp4")
        self.assertEqual(location, "Configured Room")
        self.assertEqual(options["source_kind"], "local")

    @patch.dict(
        os.environ,
        {
            "CAMERA_ID": "CAM-ENV",
            "CAMERA_LOCATION": "CCTV Room",
        },
        clear=True,
    )
    def test_camera_metadata_is_runtime_report_metadata(self):
        camera_id, _, location, _ = resolve_camera_runtime(
            "CAM-01", "local.mp4", self.camera_config
        )
        camera_locations = {camera_id: location}

        self.assertEqual(camera_locations, {"CAM-ENV": "CCTV Room"})

    def test_rtsp_credentials_are_absent_from_open_failure_and_logs(self):
        source = "rtsp://user:secret@example.test:554/private/stream"
        reader = StreamReader(source, "CAM-01", target_fps=10)
        output = io.StringIO()

        with patch("ingestion.stream_reader.cv2.VideoCapture", return_value=FakeCapture(False)):
            with redirect_stdout(output):
                with self.assertRaisesRegex(ConnectionError, "rtsp host example.test") as context:
                    reader._open_capture()

        text = f"{context.exception} {output.getvalue()}"
        self.assertNotIn("secret", text)
        self.assertNotIn("/private/stream", text)

    def test_read_failure_reconnects_and_recovers(self):
        captures = [
            FakeCapture(reads=[(False, None)]),
            FakeCapture(reads=[(True, "frame")]),
        ]
        reader = StreamReader(
            "rtsp://example.test/stream",
            "CAM-01",
            reconnect_delay_s=0.01,
            reconnect_max_delay_s=0.02,
        )

        def open_capture():
            return captures.pop(0)

        def wait(_delay):
            if len(captures) == 0:
                reader._running = False
            return False

        reader._running = True
        with patch.object(reader, "_open_capture", side_effect=open_capture):
            with patch.object(reader._stop_event, "wait", side_effect=wait):
                reader._run_live()

        self.assertTrue(captures == [])
        self.assertEqual(reader._frame_index, 1)

    def test_reconnect_delay_is_capped_and_shutdown_interrupts_wait(self):
        reader = StreamReader(
            "rtsp://example.test/stream",
            "CAM-01",
            reconnect_delay_s=0.1,
            reconnect_max_delay_s=0.25,
            reconnect_attempts=0,
        )
        delays = []

        def wait(delay):
            delays.append(delay)
            return len(delays) == 3

        reader._running = True
        with patch.object(reader, "_open_capture", side_effect=ConnectionError):
            with patch.object(reader._stop_event, "wait", side_effect=wait):
                reader._run_live()

        self.assertEqual(delays, [0.1, 0.2, 0.25])
        self.assertFalse(reader._running)


if __name__ == "__main__":
    unittest.main()