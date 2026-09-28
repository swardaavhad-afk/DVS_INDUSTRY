"""
Thin wrapper around an Ultralytics YOLO model. Filters to a configured
class subset and confidence threshold, and returns results as a
`supervision.Detections` object so the tracker (also `supervision`-based)
can consume them directly.
"""
from __future__ import annotations

from typing import List

import numpy as np
import supervision as sv
from ultralytics import YOLO


class YoloDetector:
    def __init__(self, model_path: str, confidence_threshold: float, classes_of_interest: List[str]):
        self.model = YOLO(model_path)
        self.confidence_threshold = confidence_threshold
        # ultralytics models expose a class-id -> name mapping on .names
        self.names = self.model.names
        self.class_ids_of_interest = {
            cid for cid, name in self.names.items() if name in set(classes_of_interest)
        } if classes_of_interest else set(self.names.keys())

    def detect(self, frame: np.ndarray) -> sv.Detections:
        results = self.model(frame, verbose=False)[0]
        detections = sv.Detections.from_ultralytics(results)

        if len(detections) == 0:
            return detections

        keep = (
            (detections.confidence >= self.confidence_threshold)
            & np.isin(detections.class_id, list(self.class_ids_of_interest))
        )
        return detections[keep]

    def class_name(self, class_id: int) -> str:
        return self.names.get(int(class_id), "unknown")
