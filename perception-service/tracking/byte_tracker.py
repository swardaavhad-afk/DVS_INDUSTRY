"""
Wraps supervision's ByteTrack implementation. Takes per-frame detections
and returns the same detections annotated with stable `tracker_id`s.
"""
from __future__ import annotations

import supervision as sv


class ByteTracker:
    def __init__(
        self,
        track_activation_threshold: float = 0.25,
        lost_track_buffer: int = 30,
        minimum_matching_threshold: float = 0.8,
        frame_rate: int = 5,
    ):
        self.tracker = sv.ByteTrack(
            track_activation_threshold=track_activation_threshold,
            lost_track_buffer=lost_track_buffer,
            minimum_matching_threshold=minimum_matching_threshold,
            frame_rate=frame_rate,
        )

    def update(self, detections: sv.Detections) -> sv.Detections:
        return self.tracker.update_with_detections(detections)

    def reset(self):
        self.tracker.reset()
