from __future__ import annotations

"""Extract fight sequences through the same YOLO->ByteTrack->gate->pose path as runtime."""

import argparse
import csv
import random
import sys
from collections import deque
from itertools import combinations
from pathlib import Path

import cv2
import numpy as np
import yaml

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from detection.pose_estimator import PersonPose, PoseEstimator
from detection.yolo_detector import YoloDetector
from temporal.fight_features import FEATURE_DIM, match_pose_to_bbox, pair_feature_vector
from temporal.motion_gate import MotionOfInterestGate
from temporal.temporal_buffer import TemporalBuffer
from tracking.byte_tracker import ByteTracker

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}


def pose_center(pose: PersonPose) -> np.ndarray:
    x1, y1, x2, y2 = pose.bbox
    return np.asarray(((x1 + x2) / 2.0, (y1 + y2) / 2.0), dtype=np.float32)


def choose_pose_pair(poses: list[PersonPose]):
    best, best_cost = None, float("inf")
    for a, b in combinations(poses, 2):
        ah = max(a.bbox[3] - a.bbox[1], 1.0)
        bh = max(b.bbox[3] - b.bbox[1], 1.0)
        distance = np.linalg.norm(pose_center(a) - pose_center(b))
        cost = float(distance / ((ah + bh) / 2.0) - 0.25 * (a.confidence + b.confidence))
        if cost < best_cost:
            best, best_cost = (a, b), cost
    return best


def preserve_order(a: PersonPose, b: PersonPose, previous):
    ca, cb = pose_center(a), pose_center(b)
    if previous is None:
        return (a, b) if ca[0] <= cb[0] else (b, a)
    pa, pb = previous
    direct = np.linalg.norm(ca - pa) + np.linalg.norm(cb - pb)
    swapped = np.linalg.norm(cb - pa) + np.linalg.norm(ca - pb)
    return (a, b) if direct <= swapped else (b, a)


def select_track_pair(buffer: TemporalBuffer, pairs, active_pair):
    if active_pair in pairs:
        return active_pair

    def cost(pair):
        a, b = buffer.get(pair[0]), buffer.get(pair[1])
        if a is None or b is None or not a.states or not b.states:
            return float("inf")
        sa, sb = a.states[-1], b.states[-1]
        distance = np.hypot(sa.center[0] - sb.center[0], sa.center[1] - sb.center[1])
        return float(distance / max((sa.height + sb.height) / 2.0, 1.0))

    return tuple(min(pairs, key=cost))


def windows(sequence: np.ndarray, size: int, stride: int, min_frames: int):
    if len(sequence) < min_frames:
        return
    if len(sequence) <= size:
        yield sequence
        return
    starts = list(range(0, len(sequence) - size + 1, stride))
    final_start = len(sequence) - size
    if not starts or starts[-1] != final_start:
        starts.append(final_start)
    for start in starts:
        yield sequence[start:start + size]


def assign_splits(paths: list[Path], seed: int) -> dict[Path, str]:
    shuffled = sorted(paths)
    random.Random(seed).shuffle(shuffled)
    n = len(shuffled)
    if n < 3:
        return {p: "train" for p in shuffled}
    n_test = max(1, round(0.15 * n))
    n_val = max(1, round(0.15 * n))
    while n - n_test - n_val < 1:
        if n_test >= n_val and n_test > 1:
            n_test -= 1
        elif n_val > 1:
            n_val -= 1
        else:
            break
    return {
        path: ("test" if i < n_test else "val" if i < n_test + n_val else "train")
        for i, path in enumerate(shuffled)
    }


def extract_video(video_path: Path, detector, pose_estimator, cfg, target_fps, width, height):
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return None, {"reason": "cannot_open"}
    source_fps = float(cap.get(cv2.CAP_PROP_FPS))
    if not np.isfinite(source_fps) or source_fps <= 0:
        source_fps = target_fps
    sample_every = max(1, int(round(source_fps / target_fps)))

    tracker = ByteTracker(
        track_activation_threshold=cfg["tracking"]["track_activation_threshold"],
        lost_track_buffer=cfg["tracking"]["lost_track_buffer"],
        minimum_matching_threshold=cfg["tracking"]["minimum_matching_threshold"],
        frame_rate=int(target_fps),
    )
    buffer = TemporalBuffer(window_seconds=cfg["temporal_buffer"]["window_seconds"])
    fight_cfg = cfg["fight_detection"]
    gate = MotionOfInterestGate(
        proximity_px=fight_cfg["gate"]["proximity_px"],
        velocity_threshold_px_s=fight_cfg["gate"]["velocity_threshold_px_s"],
    )
    hold = float(fight_cfg.get("gate_hold_seconds", 1.5))
    stale = float(fight_cfg.get("pair_stale_after_s", 5.0))
    active_pair = None
    gate_until = -1.0
    previous_centers = None
    previous_time = None
    features = []
    stats = {"sampled": 0, "gate_open": 0, "pose_pair": 0}
    frame_index = 0
    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                break
            if frame_index % sample_every:
                frame_index += 1
                continue
            timestamp = frame_index / source_fps
            frame_index += 1
            stats["sampled"] += 1
            resized = cv2.resize(frame, (width, height))
            detections = detector.detect(resized)
            tracked = tracker.update(detections)
            for i in range(len(tracked)):
                track_id = int(tracked.tracker_id[i]) if tracked.tracker_id is not None else -1
                if track_id < 0:
                    continue
                class_id = int(tracked.class_id[i])
                confidence = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0
                buffer.update(track_id, detector.class_name(class_id), tracked.xyxy[i], confidence,
                              timestamp=timestamp)
            buffer.evict_stale(now=timestamp)

            pairs = gate.find_candidate_pairs(buffer)
            if pairs:
                active_pair = select_track_pair(buffer, pairs, active_pair)
                gate_until = timestamp + hold
            elif timestamp > gate_until:
                if previous_time is not None and timestamp - previous_time > stale:
                    previous_centers = None
                    previous_time = None
                continue
            if active_pair is None:
                continue
            hist_a, hist_b = buffer.get(active_pair[0]), buffer.get(active_pair[1])
            if hist_a is None or hist_b is None or not hist_a.states or not hist_b.states:
                continue
            stats["gate_open"] += 1
            poses = pose_estimator.estimate(resized)
            if len(poses) < 2:
                continue
            a = match_pose_to_bbox(poses, hist_a.states[-1].bbox)
            b = match_pose_to_bbox(poses, hist_b.states[-1].bbox)
            if a is None or b is None or a is b:
                fallback = choose_pose_pair(poses)
                if fallback is None:
                    continue
                a, b = fallback
            a, b = preserve_order(a, b, previous_centers)
            ca, cb = pose_center(a), pose_center(b)
            speed = 0.0
            if previous_centers is not None and previous_time is not None:
                dt = max(timestamp - previous_time, 1e-6)
                speed = float((np.linalg.norm(ca - previous_centers[0]) +
                               np.linalg.norm(cb - previous_centers[1])) / dt)
            feature = pair_feature_vector(a, b).astype(np.float32, copy=False)
            if feature.shape != (FEATURE_DIM,):
                raise ValueError(f"expected {FEATURE_DIM} features, got {feature.shape}")
            feature[-1] = speed
            features.append(feature)
            previous_centers = (ca, cb)
            previous_time = timestamp
            stats["pose_pair"] += 1
    finally:
        cap.release()
    return (np.stack(features) if features else None), stats


def main():
    parser = argparse.ArgumentParser(description="Extract runtime-aligned fight features")
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="data/fight_features_v2")
    parser.add_argument("--config", default="config/thresholds.yaml")
    parser.add_argument("--target-fps", type=float, default=None)
    parser.add_argument("--window-frames", type=int, default=32)
    parser.add_argument("--stride", type=int, default=16)
    parser.add_argument("--min-frames", type=int, default=12)
    parser.add_argument("--seed", type=int, default=84)
    parser.add_argument("--camera-id", default="RUNTIME-DATASET")
    parser.add_argument("--limit-per-class", type=int, default=0,
                        help="0 means all; use a small value for a smoke test")
    args = parser.parse_args()

    cfg = yaml.safe_load(Path(args.config).read_text(encoding="utf-8"))
    perception = cfg["perception"]
    target_fps = args.target_fps or float(perception["detection_fps"])
    width, height = int(perception["process_width"]), int(perception["process_height"])
    input_root, output_root = Path(args.input).resolve(), Path(args.output).resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    by_class = {1: [], 0: []}
    for folder, label in (("fight", 1), ("not_fight", 0)):
        paths = [p for p in (input_root / folder).rglob("*") if p.suffix.lower() in VIDEO_EXTENSIONS]
        by_class[label] = sorted(paths)[:args.limit_per_class or None]
    if not by_class[1] or not by_class[0]:
        raise FileNotFoundError("input must contain fight/ and not_fight/ videos")
    split_map = {}
    for label, paths in by_class.items():
        split_map.update(assign_splits(paths, args.seed + label))

    detector = YoloDetector(
        perception["model_path"], perception["confidence_threshold"], ["person"]
    )
    pose_estimator = PoseEstimator(cfg["fight_detection"].get("pose_model_path", "yolov8n-pose.pt"))
    rows, skipped = [], []
    for label, paths in by_class.items():
        for number, video in enumerate(paths, 1):
            print(f"[{number}/{len(paths)} label={label}] {video}", flush=True)
            sequence, stats = extract_video(video, detector, pose_estimator, cfg,
                                            target_fps, width, height)
            if sequence is None or len(sequence) < args.min_frames:
                skipped.append({"video": str(video), "label": label,
                                "feature_frames": 0 if sequence is None else len(sequence), **stats})
                print(f"SKIP {stats}", flush=True)
                continue
            relative = video.relative_to(input_root)
            group_id = relative.as_posix()
            safe_stem = "__".join(relative.with_suffix("").parts)
            for index, clip in enumerate(windows(sequence, args.window_frames,
                                                  args.stride, args.min_frames)):
                out_path = output_root / f"{safe_stem}__w{index:04d}.npy"
                np.save(out_path, clip.astype(np.float32, copy=False))
                rows.append({"path": out_path.name, "label": label,
                             "split": split_map[video], "group_id": group_id,
                             "camera_id": args.camera_id})

    with (output_root / "manifest.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["path", "label", "split", "group_id", "camera_id"])
        writer.writeheader(); writer.writerows(rows)
    with (output_root / "skipped.csv").open("w", newline="", encoding="utf-8") as handle:
        fields = ["video", "label", "feature_frames", "sampled", "gate_open", "pose_pair"]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(skipped)
    counts = {split: sum(r["split"] == split for r in rows) for split in ("train", "val", "test")}
    print({"manifest": str(output_root / "manifest.csv"), "feature_dim": FEATURE_DIM,
           "samples": len(rows), "splits": counts, "skipped_videos": len(skipped)})


if __name__ == "__main__":
    main()
