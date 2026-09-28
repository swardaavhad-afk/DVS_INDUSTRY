"""
Sanity tests for fight detection, independent of a real camera / real
people in frame (YOLO-Pose won't detect keypoints in synthetic shapes, so
these tests stub the pose estimator where needed and exercise the gate /
feature / scoring logic directly, mirroring test_rules_logic.py and
test_evidence.py).
Run: python test_fight_detection.py
"""
import time

import numpy as np
import yaml

from detection.pose_estimator import PersonPose
from temporal.action_recognition import FightDetector
from temporal.fight_features import FEATURE_DIM, normalize_keypoints, pair_feature_vector
from temporal.motion_gate import MotionOfInterestGate
from temporal.temporal_buffer import TemporalBuffer

with open("config/thresholds.yaml") as f:
    thresholds_cfg = yaml.safe_load(f)


def make_pose(cx, cy, size=60, jitter=0.0, seed=0):
    rng = np.random.default_rng(seed)
    bbox = (cx - size / 2, cy - size, cx + size / 2, cy)
    # rough humanoid keypoint layout scattered around the bbox, plus optional jitter
    base = np.array([
        [cx, cy - size], [cx - 3, cy - size + 3], [cx + 3, cy - size + 3],       # nose, eyes
        [cx - 6, cy - size + 6], [cx + 6, cy - size + 6],                        # ears
        [cx - 15, cy - size * 0.7], [cx + 15, cy - size * 0.7],                  # shoulders
        [cx - 20, cy - size * 0.5], [cx + 20, cy - size * 0.5],                  # elbows
        [cx - 22, cy - size * 0.3], [cx + 22, cy - size * 0.3],                  # wrists
        [cx - 10, cy - size * 0.4], [cx + 10, cy - size * 0.4],                  # hips
        [cx - 12, cy - size * 0.2], [cx + 12, cy - size * 0.2],                  # knees
        [cx - 12, cy], [cx + 12, cy],                                            # ankles
    ], dtype=np.float64)
    base += rng.normal(0, jitter, size=base.shape)
    conf = np.ones((17, 1))
    keypoints = np.concatenate([base, conf], axis=1)
    return PersonPose(bbox=bbox, keypoints=keypoints, confidence=0.9)


print("=== TEST 1: Motion-of-interest gate ===")
gate = MotionOfInterestGate(proximity_px=120, velocity_threshold_px_s=150)

buf_far = TemporalBuffer()
buf_far.update(1, "person", (0, 0, 40, 100), 0.9)
buf_far.update(2, "person", (500, 0, 540, 100), 0.9)
pairs_far = gate.find_candidate_pairs(buf_far)
print(f"  far apart, no motion history -> pairs: {pairs_far}")
assert pairs_far == [], "gate should not fire for two people far apart with no velocity"

buf_close = TemporalBuffer()
for i in range(3):
    buf_close.update(1, "person", (100 + i * 40, 0, 140 + i * 40, 100), 0.9)  # fast-moving
    buf_close.update(2, "person", (150 + i * 40, 0, 190 + i * 40, 100), 0.9)  # close + fast-moving
    time.sleep(0.05)
pairs_close = gate.find_candidate_pairs(buf_close)
print(f"  close + fast-moving -> pairs: {pairs_close}")
assert len(pairs_close) == 1, "gate should fire for two close, fast-moving people"
print("  PASS")

print("\n=== TEST 2: Feature vector shape ===")
pose_a = make_pose(100, 200, jitter=0.0, seed=1)
pose_b = make_pose(130, 205, jitter=0.0, seed=2)
feat = pair_feature_vector(pose_a, pose_b)
print(f"  feature vector shape: {feat.shape}, expected dim: {FEATURE_DIM}")
assert feat.shape == (FEATURE_DIM,), "feature vector dimension mismatch"
print("  PASS")

print("\n=== TEST 3: Heuristic score -- jerky/close sequence should score higher than smooth/far ===")
detector = FightDetector("CAM-TEST", thresholds_cfg["fight_detection"])

# "calm" sequence: two people standing far apart, keypoints barely moving
calm_seq = []
for i in range(10):
    pa = make_pose(50, 200, jitter=0.5, seed=100 + i)
    pb = make_pose(400, 200, jitter=0.5, seed=200 + i)
    f = pair_feature_vector(pa, pb)
    f[-1] = 5.0  # low combined speed
    calm_seq.append(f)
calm_score = detector._score_heuristic(np.stack(calm_seq))

# "fight-like" sequence: two people close together, keypoints jittering a lot frame-to-frame
fight_seq = []
for i in range(10):
    pa = make_pose(100, 200, jitter=8.0, seed=300 + i)
    pb = make_pose(120, 200, jitter=8.0, seed=400 + i)
    f = pair_feature_vector(pa, pb)
    f[-1] = 300.0  # high combined speed
    fight_seq.append(f)
fight_score = detector._score_heuristic(np.stack(fight_seq))

print(f"  calm_score={calm_score:.3f}  fight_score={fight_score:.3f}")
assert fight_score > calm_score, "fight-like sequence should score higher than calm sequence"
print("  PASS")

print("\n=== TEST 4: Full evaluate() with a stubbed pose estimator (integration wiring check) ===")


class StubPoseEstimator:
    """Returns poses at the exact bboxes of whatever's in the buffer, so
    match_pose_to_bbox always succeeds without needing real YOLO-Pose
    detections on a synthetic frame."""
    def __init__(self, poses):
        self._poses = poses

    def estimate(self, frame):
        return self._poses


buf = TemporalBuffer()
confirmed_any = False
fake_frame = np.zeros((480, 640, 3), dtype=np.uint8)

for i in range(8):
    bbox_a = (100 + i, 100, 140 + i, 300)
    bbox_b = (150 + i, 100, 190 + i, 300)
    buf.update(11, "person", bbox_a, 0.9)
    buf.update(12, "person", bbox_b, 0.9)

    pose_a = PersonPose(bbox=bbox_a, keypoints=make_pose(120 + i, 300, jitter=10).keypoints, confidence=0.9)
    pose_b = PersonPose(bbox=bbox_b, keypoints=make_pose(170 + i, 300, jitter=10).keypoints, confidence=0.9)
    detector._pose_estimator = StubPoseEstimator([pose_a, pose_b])  # bypass real YOLO-Pose model

    candidates = detector.evaluate(buf, fake_frame)
    if candidates:
        confirmed_any = True
        print(f"  cycle {i}: fight candidate(s): {[(c.track_ids, c.raw_confidence) for c in candidates]}")
    time.sleep(0.05)

print(f"  any fight candidates raised: {confirmed_any}")
print("  PASS (wiring exercised end-to-end without crashing; candidate output depends on heuristic tuning)")

print("\nAll fight detection tests completed.")
