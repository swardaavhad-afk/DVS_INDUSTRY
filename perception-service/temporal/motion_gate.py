"""
Cheap gate evaluated every cycle on data we already have (YOLO+tracking
output) to decide whether it's worth invoking the expensive pose
estimation + fight classifier this cycle. This is the real-time-performance
trick from the design doc: never run the heavy model continuously, only
when something already looks "interesting" (two people close together AND
moving abnormally fast/erratically).

Being a *gate*, this is deliberately permissive -- it's fine (expected,
even) for it to fire on things that turn out not to be fights, like two
people jogging past each other. Its job is only to filter out the vast
majority of frames where nothing worth checking is happening; the actual
fight/no-fight decision happens downstream in action_recognition.py after
persistence is required.
"""
from __future__ import annotations

import math
from itertools import combinations
from typing import List, Tuple

from temporal.temporal_buffer import TemporalBuffer, TrackHistory


def _distance(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


def _speed(history: TrackHistory) -> float:
    v = history.velocity()
    if v is None:
        return 0.0
    return math.hypot(*v)


class MotionOfInterestGate:
    def __init__(self, proximity_px: float = 120.0, velocity_threshold_px_s: float = 150.0):
        self.proximity_px = proximity_px
        self.velocity_threshold_px_s = velocity_threshold_px_s

    def find_candidate_pairs(self, buffer: TemporalBuffer) -> List[Tuple[int, int]]:
        persons = buffer.tracks_by_class("person")
        pairs = []
        for a, b in combinations(persons, 2):
            if len(a.states) == 0 or len(b.states) == 0:
                continue
            dist = _distance(a.states[-1].center, b.states[-1].center)
            if dist > self.proximity_px:
                continue
            combined_speed = _speed(a) + _speed(b)
            if combined_speed < self.velocity_threshold_px_s:
                continue
            pairs.append((a.track_id, b.track_id))
        return pairs
