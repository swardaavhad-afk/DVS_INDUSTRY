"""
Turns raw pose keypoints into the per-frame feature vector the fight
classifier (heuristic or learned) consumes, plus the IoU matching needed
to associate a PoseEstimator detection back to an existing ByteTrack id.
"""
from __future__ import annotations

from typing import List, Optional, Tuple

import numpy as np

from detection.pose_estimator import PersonPose

FEATURE_DIM = 2 * 17 * 2 + 2  # two people x 17 keypoints x (x,y) + [center distance, combined speed]


def _iou(box_a: Tuple[float, float, float, float], box_b: Tuple[float, float, float, float]) -> float:
    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def match_pose_to_bbox(poses: List[PersonPose], bbox: Tuple[float, float, float, float]) -> Optional[PersonPose]:
    """Find the pose detection whose bbox best overlaps a given tracked
    person's bbox (associates a track_id, which the pose model doesn't
    know about, back to the pose model's own detection)."""
    best, best_iou = None, 0.0
    for pose in poses:
        score = _iou(pose.bbox, bbox)
        if score > best_iou:
            best, best_iou = pose, score
    return best if best_iou > 0.1 else None


def normalize_keypoints(pose: PersonPose) -> np.ndarray:
    """Keypoints relative to the person's own bbox, scaled to [0,1], so the
    feature is (mostly) invariant to the person's distance from the camera
    and position in frame -- what matters for "fight" is limb configuration
    and motion, not absolute pixel location."""
    x1, y1, x2, y2 = pose.bbox
    w, h = max(x2 - x1, 1e-6), max(y2 - y1, 1e-6)
    rel = pose.keypoints[:, :2].copy()
    rel[:, 0] = (rel[:, 0] - x1) / w
    rel[:, 1] = (rel[:, 1] - y1) / h
    return rel.flatten()  # (34,)


def pair_feature_vector(pose_a: PersonPose, pose_b: PersonPose) -> np.ndarray:
    feat_a = normalize_keypoints(pose_a)  # (34,)
    feat_b = normalize_keypoints(pose_b)  # (34,)

    ax = (pose_a.bbox[0] + pose_a.bbox[2]) / 2
    ay = (pose_a.bbox[1] + pose_a.bbox[3]) / 2
    bx = (pose_b.bbox[0] + pose_b.bbox[2]) / 2
    by = (pose_b.bbox[1] + pose_b.bbox[3]) / 2
    center_distance = float(np.hypot(ax - bx, ay - by))

    return np.concatenate([feat_a, feat_b, [center_distance, 0.0]])  # last slot filled in by caller with speed if available
