from __future__ import annotations

import argparse
import csv
import random
import sys
from itertools import combinations
from pathlib import Path

import cv2
import numpy as np

# Support both `python -m fight_model.extract_features` and direct execution.
ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from detection.pose_estimator import PersonPose, PoseEstimator
from temporal.fight_features import FEATURE_DIM, pair_feature_vector

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}


def center(pose: PersonPose) -> np.ndarray:
    x1, y1, x2, y2 = pose.bbox
    return np.asarray(((x1 + x2) / 2.0, (y1 + y2) / 2.0), dtype=np.float32)


def height(pose: PersonPose) -> float:
    return max(float(pose.bbox[3] - pose.bbox[1]), 1.0)


def choose_interaction_pair(poses: list[PersonPose]) -> tuple[PersonPose, PersonPose] | None:
    """Prefer a close, confident pair; distance is normalized by body size."""
    if len(poses) < 2:
        return None
    best_pair = None
    best_cost = float("inf")
    for a, b in combinations(poses, 2):
        normalized_distance = float(np.linalg.norm(center(a) - center(b))) / ((height(a) + height(b)) / 2.0)
        confidence_bonus = 0.25 * (float(a.confidence) + float(b.confidence))
        cost = normalized_distance - confidence_bonus
        if cost < best_cost:
            best_cost, best_pair = cost, (a, b)
    return best_pair


def preserve_pair_order(pair: tuple[PersonPose, PersonPose], previous: tuple[np.ndarray, np.ndarray] | None):
    a, b = pair
    if previous is None:
        # Deterministic first-frame ordering.
        return (a, b) if center(a)[0] <= center(b)[0] else (b, a)
    pa, pb = previous
    direct = np.linalg.norm(center(a) - pa) + np.linalg.norm(center(b) - pb)
    swapped = np.linalg.norm(center(b) - pa) + np.linalg.norm(center(a) - pb)
    return (a, b) if direct <= swapped else (b, a)


def extract_sequence(video_path: Path, estimator: PoseEstimator, target_fps: float,
                     width: int, height_px: int) -> np.ndarray | None:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        print(f"SKIP cannot open: {video_path}")
        return None
    source_fps = float(cap.get(cv2.CAP_PROP_FPS))
    if not np.isfinite(source_fps) or source_fps <= 0:
        source_fps = target_fps
    sample_every = max(1, int(round(source_fps / target_fps)))
    previous_centers = None
    previous_time = None
    features: list[np.ndarray] = []
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
            resized = cv2.resize(frame, (width, height_px))
            pair = choose_interaction_pair(estimator.estimate(resized))
            if pair is None:
                previous_centers = None
                previous_time = None
                continue
            a, b = preserve_pair_order(pair, previous_centers)
            ca, cb = center(a), center(b)
            speed = 0.0
            if previous_centers is not None and previous_time is not None:
                dt = max(timestamp - previous_time, 1e-6)
                speed = float((np.linalg.norm(ca - previous_centers[0]) +
                               np.linalg.norm(cb - previous_centers[1])) / dt)
            feature = pair_feature_vector(a, b).astype(np.float32, copy=False)
            if feature.shape != (FEATURE_DIM,):
                raise ValueError(f"feature mismatch: expected {FEATURE_DIM}, got {feature.shape}")
            feature[-1] = speed
            features.append(feature)
            previous_centers = (ca, cb)
            previous_time = timestamp
    finally:
        cap.release()
    return np.stack(features) if features else None


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
    n_test = max(1, round(0.15 * n)); n_val = max(1, round(0.15 * n))
    while n - n_test - n_val < 1:
        if n_test >= n_val and n_test > 1: n_test -= 1
        elif n_val > 1: n_val -= 1
        else: break
    result = {}
    for i, path in enumerate(shuffled):
        result[path] = "test" if i < n_test else "val" if i < n_test + n_val else "train"
    return result


def main():
    parser = argparse.ArgumentParser(description="Extract pose-pair sequences from labelled videos")
    parser.add_argument("--input", required=True, help="folder containing fight/ and not_fight/")
    parser.add_argument("--output", default="data/fight_features")
    parser.add_argument("--pose-model", default="yolov8n-pose.pt")
    parser.add_argument("--target-fps", type=float, default=10.0)
    parser.add_argument("--width", type=int, default=640)
    parser.add_argument("--height", type=int, default=480)
    parser.add_argument("--window-frames", type=int, default=32)
    parser.add_argument("--stride", type=int, default=16)
    parser.add_argument("--min-frames", type=int, default=16)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--camera-id", default="dataset")
    args = parser.parse_args()
    if args.min_frames > args.window_frames:
        raise ValueError("min-frames cannot exceed window-frames")

    input_root = Path(args.input).resolve(); output_root = Path(args.output).resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    by_class: dict[int, list[Path]] = {1: [], 0: []}
    for folder, label in (("fight", 1), ("not_fight", 0)):
        class_dir = input_root / folder
        if class_dir.exists():
            by_class[label] = [p for p in class_dir.rglob("*") if p.suffix.lower() in VIDEO_EXTENSIONS]
    if not by_class[1] or not by_class[0]:
        raise FileNotFoundError("input must contain video files in both fight/ and not_fight/")

    split_map = {}
    for label, paths in by_class.items():
        split_map.update(assign_splits(paths, args.seed + label))

    estimator = PoseEstimator(args.pose_model)
    rows = []; skipped = []
    for label, paths in by_class.items():
        for video in sorted(paths):
            print(f"extracting {video}")
            sequence = extract_sequence(video, estimator, args.target_fps, args.width, args.height)
            if sequence is None or len(sequence) < args.min_frames:
                skipped.append((str(video), 0 if sequence is None else len(sequence)))
                print(f"SKIP insufficient paired poses: {video}")
                continue
            relative = video.relative_to(input_root)
            group_id = relative.as_posix()
            safe_stem = "__".join(relative.with_suffix("").parts)
            for index, clip in enumerate(windows(sequence, args.window_frames, args.stride, args.min_frames)):
                out_path = output_root / f"{safe_stem}__w{index:04d}.npy"
                np.save(out_path, clip.astype(np.float32, copy=False))
                rows.append({"path": out_path.name, "label": label, "split": split_map[video],
                             "group_id": group_id, "camera_id": args.camera_id})

    manifest = output_root / "manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["path", "label", "split", "group_id", "camera_id"])
        writer.writeheader(); writer.writerows(rows)
    report = output_root / "skipped.csv"
    with report.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle); writer.writerow(["video", "paired_pose_frames"]); writer.writerows(skipped)
    counts = {split: sum(r["split"] == split for r in rows) for split in ("train", "val", "test")}
    print({"manifest": str(manifest), "feature_dim": FEATURE_DIM, "samples": len(rows),
           "splits": counts, "skipped_videos": len(skipped)})


if __name__ == "__main__":
    main()
