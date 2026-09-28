"""
Evidence extraction (design doc section 8 / Phase 3).

Keeps a short rolling buffer of *raw, full-resolution* frames per camera
(not the downscaled frames used for inference -- see design doc section 8
on why evidence should be saved at native resolution even though detection
runs on a smaller working resolution).

On a confirmed/probable event:
  - `capture_before_clip()` immediately writes out whatever's already in
    the rolling buffer as the "before" evidence clip.
  - `start_post_capture()` registers a pending window that keeps collecting
    new frames until `after_seconds` have elapsed, then `flush_ready_post_clips()`
    (called every cycle from main.py) writes it out as the "after" clip.
  - `save_keyframes()` grabs a handful of representative stills.

This intentionally does NOT try to be a general-purpose video pipeline --
it's a small, dependency-free ring buffer + cv2.VideoWriter, sized for a
final-year-project demo, not a production media pipeline.
"""
from __future__ import annotations

import os
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Deque, List, Optional, Tuple

import cv2
import numpy as np


@dataclass
class PendingPostCapture:
    incident_id: str
    camera_id: str
    deadline: float
    frames: List[Tuple[float, np.ndarray]] = field(default_factory=list)


class EvidenceBuffer:
    def __init__(
        self,
        output_dir: str,
        raw_buffer_window_seconds: float = 15.0,
        before_seconds: float = 5.0,
        after_seconds: float = 5.0,
        keyframe_count: int = 3,
        clip_fps: float = 5.0,
    ):
        self.output_dir = output_dir
        self.raw_buffer_window_seconds = raw_buffer_window_seconds
        self.before_seconds = before_seconds
        self.after_seconds = after_seconds
        self.keyframe_count = keyframe_count
        self.clip_fps = clip_fps

        self._frames: Deque[Tuple[float, np.ndarray]] = deque()
        self._pending_post: List[PendingPostCapture] = []

    # ---- feeding the buffer --------------------------------------------
    def add_frame(self, frame: np.ndarray, timestamp: Optional[float] = None):
        ts = timestamp if timestamp is not None else time.time()
        self._frames.append((ts, frame.copy()))

        cutoff = ts - self.raw_buffer_window_seconds
        while self._frames and self._frames[0][0] < cutoff:
            self._frames.popleft()

        # feed any in-flight "after" captures too
        for pending in self._pending_post:
            if ts <= pending.deadline:
                pending.frames.append((ts, frame.copy()))

    # ---- "before" clip + keyframes, available immediately on confirm ----
    def capture_before_clip(self, incident_id: str, camera_id: str) -> Optional[str]:
        cutoff = time.time() - self.before_seconds
        clip_frames = [f for t, f in self._frames if t >= cutoff]
        return self._write_clip(clip_frames, camera_id, incident_id, suffix="before")

    def save_keyframes(self, incident_id: str, camera_id: str) -> List[str]:
        if not self._frames:
            return []
        recent = list(self._frames)[-max(self.keyframe_count * 4, 1):]
        step = max(len(recent) // self.keyframe_count, 1)
        chosen = recent[::step][: self.keyframe_count]

        paths = []
        cam_dir = os.path.join(self.output_dir, camera_id)
        os.makedirs(cam_dir, exist_ok=True)
        for i, (_, frame) in enumerate(chosen):
            path = os.path.join(cam_dir, f"{incident_id}_frame{i}.jpg")
            cv2.imwrite(path, frame)
            paths.append(path)
        return paths

    # ---- "after" clip, filled in over the next few seconds --------------
    def start_post_capture(self, incident_id: str, camera_id: str):
        self._pending_post.append(PendingPostCapture(
            incident_id=incident_id,
            camera_id=camera_id,
            deadline=time.time() + self.after_seconds,
        ))

    def flush_ready_post_clips(self) -> dict:
        """Call once per processing cycle. Returns {incident_id: clip_path}
        for any post-captures whose window has completed this cycle."""
        now = time.time()
        ready = [p for p in self._pending_post if now >= p.deadline]
        results = {}
        for p in ready:
            path = self._write_clip([f for _, f in p.frames], p.camera_id, p.incident_id, suffix="after")
            results[p.incident_id] = path
            self._pending_post.remove(p)
        return results

    # ---- internals --------------------------------------------------------
    def _write_clip(self, frames: List[np.ndarray], camera_id: str, incident_id: str, suffix: str) -> Optional[str]:
        if not frames:
            return None
        h, w = frames[0].shape[:2]
        cam_dir = os.path.join(self.output_dir, camera_id)
        os.makedirs(cam_dir, exist_ok=True)
        path = os.path.join(cam_dir, f"{incident_id}_{suffix}.mp4")

        fourcc = cv2.VideoWriter_fourcc(*"mp4v")
        writer = cv2.VideoWriter(path, fourcc, self.clip_fps, (w, h))
        for frame in frames:
            writer.write(frame)
        writer.release()
        return path
