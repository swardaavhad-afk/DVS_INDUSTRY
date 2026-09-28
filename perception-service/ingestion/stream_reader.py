"""Low-latency live capture plus deterministic video-file playback.

Live streams use a background thread and a one-slot latest-frame buffer so
inference never accumulates latency. Video files are read synchronously and
sampled to the requested processing FPS; otherwise a background reader would
race to EOF and leave the processing loop with only the final frame.
"""
from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlsplit

import cv2
import numpy as np


@dataclass
class FrameSample:
    frame: np.ndarray
    timestamp: float
    frame_index: int


class StreamReader:
    def __init__(self, source: str, camera_id: str, reconnect_delay_s: float = 2.0,
                 target_fps: float = 10.0, connect_timeout_s: float = 10.0,
                 read_timeout_s: float = 10.0, reconnect_max_delay_s: float = 30.0,
                 reconnect_attempts: int = 0):
        self.source = str(source)
        self.camera_id = camera_id
        self.reconnect_delay_s = max(float(reconnect_delay_s), 0.1)
        self.connect_timeout_s = max(float(connect_timeout_s), 0.1)
        self.read_timeout_s = max(float(read_timeout_s), 0.1)
        self.reconnect_max_delay_s = max(float(reconnect_max_delay_s), self.reconnect_delay_s)
        self.reconnect_attempts = max(int(reconnect_attempts), 0)
        self.target_fps = max(float(target_fps), 0.1)
        self._cap: Optional[cv2.VideoCapture] = None
        self._lock = threading.Lock()
        self._latest: Optional[FrameSample] = None
        self._frame_index = 0
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._end_of_stream = False
        self._source_fps = self.target_fps
        self._sample_stride = 1
        self._file_start_timestamp = 0.0
        self._stop_event = threading.Event()
        self._reconnect_count = 0

    def _is_file_source(self) -> bool:
        return not self.source.isdigit() and not self.source.lower().startswith(
            ("rtsp://", "http://", "https://")
        )

    def _open_capture(self) -> cv2.VideoCapture:
        src = int(self.source) if self.source.isdigit() else self.source
        cap = cv2.VideoCapture(src)
        if self._is_rtsp_source():
            # OpenCV/FFmpeg honors these properties when supported by the build.
            if hasattr(cv2, "CAP_PROP_OPEN_TIMEOUT_MSEC"):
                cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, int(self.connect_timeout_s * 1000))
            if hasattr(cv2, "CAP_PROP_READ_TIMEOUT_MSEC"):
                cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, int(self.read_timeout_s * 1000))
        if not cap.isOpened():
            cap.release()
            raise ConnectionError(
                f"[{self.camera_id}] could not open {_source_label(self.source)}"
            )
        return cap

    def _is_rtsp_source(self) -> bool:
        return self.source.lower().startswith("rtsp://")

    def start(self) -> "StreamReader":
        if self._running:
            return self
        self._running = True
        self._stop_event.clear()
        self._end_of_stream = False
        if self._is_file_source():
            self._cap = self._open_capture()
            source_fps = float(self._cap.get(cv2.CAP_PROP_FPS))
            if np.isfinite(source_fps) and source_fps > 0:
                self._source_fps = source_fps
            self._sample_stride = max(1, int(round(self._source_fps / self.target_fps)))
            self._file_start_timestamp = time.time()
            return self
        self._thread = threading.Thread(
            target=self._run_live, daemon=True, name=f"reader-{self.camera_id}"
        )
        self._thread.start()
        return self

    def stop(self):
        self._running = False
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=2.0)
        if self._cap is not None:
            self._cap.release()
            self._cap = None

    def is_end_of_stream(self) -> bool:
        return self._end_of_stream

    def _run_live(self):
        delay = self.reconnect_delay_s
        while self._running:
            try:
                self._cap = self._open_capture()
            except ConnectionError:
                self._reconnect_count += 1
                if self.reconnect_attempts and self._reconnect_count > self.reconnect_attempts:
                    print(f"[{self.camera_id}] capture stopped after {self.reconnect_attempts} retries")
                    self._running = False
                    break
                print(
                    f"[{self.camera_id}] {_source_label(self.source)} unavailable; "
                    f"retry {self._reconnect_count} in {delay:.1f}s"
                )
                if self._stop_event.wait(delay):
                    self._running = False
                    break
                delay = min(delay * 2, self.reconnect_max_delay_s)
                continue
            if self._reconnect_count:
                print(f"[{self.camera_id}] capture connection restored")
            self._reconnect_count = 0
            delay = self.reconnect_delay_s
            while self._running:
                ok, frame = self._cap.read()
                if not ok:
                    print(f"[{self.camera_id}] capture read failed -- reconnecting")
                    break
                self._frame_index += 1
                sample = FrameSample(frame, time.time(), self._frame_index)
                with self._lock:
                    self._latest = sample
            self._cap.release()
            self._cap = None
            if self._running:
                if self._stop_event.wait(delay):
                    self._running = False
                    break
                delay = min(delay * 2, self.reconnect_max_delay_s)

    def _get_next_file_sample(self) -> Optional[FrameSample]:
        if not self._running or self._cap is None:
            return None
        selected_frame = None
        for _ in range(self._sample_stride):
            ok, frame = self._cap.read()
            if not ok:
                self._end_of_stream = True
                self._running = False
                self._cap.release()
                self._cap = None
                if selected_frame is None:
                    print(f"[{self.camera_id}] video file ended")
                    return None
                break
            self._frame_index += 1
            selected_frame = frame
        timestamp = self._file_start_timestamp + self._frame_index / self._source_fps
        sample = FrameSample(selected_frame, timestamp, self._frame_index)
        self._latest = sample
        return sample

    def get_latest(self) -> Optional[FrameSample]:
        if self._is_file_source():
            return self._get_next_file_sample()
        with self._lock:
            return self._latest


def _source_label(source: str) -> str:
    """Return a credential/path-free label for capture diagnostics."""

    if not source.lower().startswith(("rtsp://", "http://", "https://")):
        return "capture source"
    parsed = urlsplit(source)
    return f"{parsed.scheme} host {parsed.hostname or 'unknown'}"
