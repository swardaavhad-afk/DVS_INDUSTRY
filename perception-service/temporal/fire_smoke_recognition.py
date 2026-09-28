"""Dedicated fire/smoke YOLO inference with temporal persistence."""
from __future__ import annotations

from collections import deque
from typing import Deque, Dict, List

import numpy as np
from ultralytics import YOLO

from temporal.rule_engine import EventCandidate


class FireSmokeDetector:
    """Evaluates fire/smoke at a controlled stride and applies N-of-M persistence.

    Fire and smoke are deformable regions, so ByteTrack is intentionally not
    used. The module emits one camera-level `fire_smoke` event family.
    """

    def __init__(self, camera_id: str, cfg: dict):
        self.camera_id = camera_id
        self.cfg = cfg
        self.model = YOLO(cfg["checkpoint"])
        self.imgsz = int(cfg.get("imgsz", 640))
        self.evaluation_stride = max(1, int(cfg.get("evaluation_stride_frames", 2)))
        self.window = max(1, int(cfg.get("persistence_window", 5)))
        self.required = max(1, int(cfg.get("required_hits", 3)))
        if self.required > self.window:
            raise ValueError("fire/smoke required_hits cannot exceed persistence_window")
        self.thresholds = {
            "fire": float(cfg.get("fire_threshold", 0.50)),
            "smoke": float(cfg.get("smoke_threshold", 0.50)),
        }
        self.hits: Dict[str, Deque[bool]] = {
            name: deque(maxlen=self.window) for name in self.thresholds
        }
        self.scores: Dict[str, Deque[float]] = {
            name: deque(maxlen=self.window) for name in self.thresholds
        }
        self.cycles = 0
        self._stats = {
            "cycles": 0, "evaluations": 0,
            "fire_positive_windows": 0, "smoke_positive_windows": 0,
            "probable_candidates": 0, "confirmed_candidates": 0,
            "max_fire_score": 0.0, "max_smoke_score": 0.0,
        }
        print(
            f"[{camera_id}] fire/smoke model loaded: {cfg['checkpoint']} "
            f"fire={self.thresholds['fire']:.2f} smoke={self.thresholds['smoke']:.2f} "
            f"persistence={self.required}/{self.window} stride={self.evaluation_stride}"
        )

    def evaluate(self, frame: np.ndarray) -> List[EventCandidate]:
        self.cycles += 1
        self._stats["cycles"] += 1
        if (self.cycles - 1) % self.evaluation_stride != 0:
            return []

        result = self.model.predict(
            source=frame, conf=0.01, imgsz=self.imgsz,
            device=self.cfg.get("device", 0), verbose=False,
        )[0]
        best = {"fire": 0.0, "smoke": 0.0}
        if result.boxes is not None:
            for cls_id, confidence in zip(result.boxes.cls.tolist(), result.boxes.conf.tolist()):
                name = self.model.names[int(cls_id)]
                if name in best:
                    best[name] = max(best[name], float(confidence))

        self._stats["evaluations"] += 1
        for name in ("fire", "smoke"):
            score = best[name]
            positive = score >= self.thresholds[name]
            self.scores[name].append(score)
            self.hits[name].append(positive)
            if positive:
                self._stats[f"{name}_positive_windows"] += 1
            self._stats[f"max_{name}_score"] = max(self._stats[f"max_{name}_score"], score)

        persistent = {
            name: len(self.hits[name]) >= self.required and sum(self.hits[name]) >= self.required
            for name in ("fire", "smoke")
        }
        active_classes = [name for name in ("fire", "smoke") if persistent[name]]
        if not active_classes:
            return []

        # One persistent class is a cautious operator-facing alert. Fire and
        # smoke together are corroborating signals but still require review.
        requested_tier = "CONFIRMED" if len(active_classes) == 2 else "PROBABLE"
        self._stats["confirmed_candidates" if requested_tier == "CONFIRMED" else "probable_candidates"] += 1
        recent_max = {
            name: round(max(self.scores[name], default=0.0), 3)
            for name in ("fire", "smoke")
        }
        confidence = max(recent_max[name] for name in active_classes)
        return [EventCandidate(
            event_type="fire_smoke",
            track_ids=[],
            camera_id=self.camera_id,
            detail={
                "requested_tier": requested_tier,
                "detected_classes": active_classes,
                "fire_score": recent_max["fire"],
                "smoke_score": recent_max["smoke"],
                "fire_hits": int(sum(self.hits["fire"])),
                "smoke_hits": int(sum(self.hits["smoke"])),
                "persistence_window": self.window,
                "required_hits": self.required,
                "model": "fire_smoke_yolov8n_v1",
            },
            raw_confidence=confidence,
        )]

    def diagnostics(self) -> dict:
        return dict(
            self._stats,
            fire_hits=int(sum(self.hits["fire"])),
            smoke_hits=int(sum(self.hits["smoke"])),
            persistence_window=self.window,
            required_hits=self.required,
            fire_threshold=self.thresholds["fire"],
            smoke_threshold=self.thresholds["smoke"],
        )
