"""Gated live RGB fight detection using the trained R3D-18 classifier."""
from __future__ import annotations

import time
from collections import deque

from rgb_fight_model.infer import RgbFightClassifier
from temporal.motion_gate import MotionOfInterestGate
from temporal.rule_engine import EventCandidate
from temporal.temporal_buffer import TemporalBuffer


class RgbFightDetector:
    def __init__(self, camera_id: str, cfg: dict):
        self.camera_id = camera_id
        self.enabled = bool(cfg.get("enabled", True))
        rgb_cfg = cfg["rgb"]
        self.classifier = RgbFightClassifier(rgb_cfg["checkpoint"])
        self.clip_frames = int(rgb_cfg.get("clip_frames", self.classifier.clip_frames))
        self.evaluation_stride = int(rgb_cfg.get("evaluation_stride_frames", 4))
        self.probable_threshold = float(rgb_cfg.get("probable_threshold", 0.88))
        self.confirmed_threshold = float(rgb_cfg.get("confirmed_threshold", 0.92))
        self.persistence_window = int(rgb_cfg.get("persistence_window", 3))
        self.required_confirmed = int(rgb_cfg.get("required_confirmed", 2))
        self.confirmed_history = deque(maxlen=self.persistence_window)
        self.gate_hold_seconds = float(cfg.get("gate_hold_seconds", 1.5))
        self.gate = MotionOfInterestGate(
            proximity_px=cfg["gate"]["proximity_px"],
            velocity_threshold_px_s=cfg["gate"]["velocity_threshold_px_s"],
        )
        self.frames = deque(maxlen=self.clip_frames)
        self.gate_active_until = 0.0
        self.last_track_ids = []
        self.cycles = 0
        self.last_evaluated_cycle = -10**9
        self._stats = {"cycles": 0, "gate_open": 0, "scored": 0,
                       "review_signals": 0, "high_score_windows": 0,
                       "confirmed_candidates": 0, "max_score": 0.0}
        print(
            f"[{camera_id}] RGB fight model loaded: {rgb_cfg['checkpoint']} "
            f"probable={self.probable_threshold:.2f} confirmed={self.confirmed_threshold:.2f}"
        )

    def evaluate(self, buffer: TemporalBuffer, frame):
        self.cycles += 1
        self._stats["cycles"] += 1
        if not self.enabled:
            return []
        # Buffer every processed frame. When the cheap gate opens, the clip
        # therefore includes the lead-in immediately before the interaction.
        self.frames.append(frame.copy())
        now = time.time()
        pairs = self.gate.find_candidate_pairs(buffer)
        if pairs:
            self.gate_active_until = now + self.gate_hold_seconds
            self.last_track_ids = list(pairs[0])
        if not pairs and now > self.gate_active_until:
            return []
        self._stats["gate_open"] += 1
        if len(self.frames) < self.clip_frames:
            return []
        if self.cycles - self.last_evaluated_cycle < self.evaluation_stride:
            return []
        self.last_evaluated_cycle = self.cycles
        score = self.classifier.score_clip(self.frames, input_bgr=True)
        self._stats["scored"] += 1
        self._stats["max_score"] = max(self._stats["max_score"], score)
        high_score = score >= self.confirmed_threshold
        self.confirmed_history.append(high_score)
        if score < self.probable_threshold:
            return []
        if not high_score:
            self._stats["review_signals"] += 1
            print(
                f"[{self.camera_id}] RGB probable-review fight score={score:.2f} "
                f"track={self.last_track_ids}"
            )
            return []
        self._stats["high_score_windows"] += 1
        confirmed_hits = sum(self.confirmed_history)
        if confirmed_hits < self.required_confirmed:
            print(
                f"[{self.camera_id}] RGB high fight score={score:.2f} -- "
                f"awaiting persistence ({confirmed_hits}/{self.required_confirmed})"
            )
            return []
        self._stats["confirmed_candidates"] += 1
        return [EventCandidate(
            event_type="fight",
            track_ids=self.last_track_ids,
            camera_id=self.camera_id,
            detail={"mode": "rgb_r3d18", "score": round(score, 3),
                    "clip_frames": self.clip_frames},
            raw_confidence=score,
        )]

    def diagnostics(self):
        return dict(self._stats, buffered_frames=len(self.frames),
                    persistence_hits=sum(self.confirmed_history),
                    persistence_window=self.persistence_window,
                    probable_threshold=self.probable_threshold,
                    confirmed_threshold=self.confirmed_threshold)
