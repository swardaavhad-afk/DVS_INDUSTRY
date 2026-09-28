from __future__ import annotations

import csv
import random
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np
import torch
from torch.utils.data import Dataset

KINETICS_MEAN = np.asarray([0.43216, 0.394666, 0.37645], dtype=np.float32)
KINETICS_STD = np.asarray([0.22803, 0.22145, 0.216989], dtype=np.float32)


@dataclass(frozen=True)
class VideoRecord:
    path: str
    label: int
    split: str
    group_id: str


def load_manifest(path: str | Path) -> list[VideoRecord]:
    with Path(path).open(newline="", encoding="utf-8") as handle:
        return [VideoRecord(row["path"], int(row["label"]), row["split"], row["group_id"])
                for row in csv.DictReader(handle)]


def preprocess_frames(frames: list[np.ndarray], size: int = 112,
                      training: bool = False, input_bgr: bool = False) -> torch.Tensor:
    """Apply the same spatial transform/normalization to decoded or live frames."""
    resized = []
    for frame in frames:
        if input_bgr:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w = frame.shape[:2]
        scale = 128.0 / max(min(h, w), 1)
        resized.append(cv2.resize(frame, (max(128, round(w * scale)),
                                          max(128, round(h * scale)))))
    stack = np.stack(resized)
    h, w = stack.shape[1:3]
    if training:
        top = random.randint(0, max(h - size, 0))
        left = random.randint(0, max(w - size, 0))
        if random.random() < 0.5:
            stack = stack[:, :, ::-1, :]
    else:
        top, left = max((h - size) // 2, 0), max((w - size) // 2, 0)
    stack = stack[:, top:top + size, left:left + size, :].copy()
    stack = stack.astype(np.float32) / 255.0
    stack = (stack - KINETICS_MEAN) / KINETICS_STD
    return torch.from_numpy(stack).permute(3, 0, 1, 2).contiguous()


def decode_clip(path: str, clip_frames: int, temporal_stride: int, size: int,
                training: bool) -> torch.Tensor:
    cap = cv2.VideoCapture(path)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    span = max(1, (clip_frames - 1) * temporal_stride + 1)
    start = (random.randint(0, total - span) if training else (total - span) // 2) if total > span else 0
    cap.set(cv2.CAP_PROP_POS_FRAMES, start)
    wanted = {i * temporal_stride: i for i in range(clip_frames)}
    collected: list[np.ndarray | None] = [None] * clip_frames
    last = None
    try:
        for offset in range(span):
            ok, frame = cap.read()
            if not ok:
                break
            if offset in wanted:
                frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                collected[wanted[offset]] = frame
                last = frame
    finally:
        cap.release()
    if last is None:
        last = np.zeros((128, 128, 3), dtype=np.uint8)
    for i, frame in enumerate(collected):
        if frame is None:
            collected[i] = last.copy()
    return preprocess_frames(collected, size=size, training=training, input_bgr=False)


class RgbFightDataset(Dataset):
    def __init__(self, records: list[VideoRecord], split: str, clip_frames: int = 16,
                 temporal_stride: int = 2, size: int = 112):
        self.records = [r for r in records if r.split == split]
        if not self.records:
            raise ValueError(f"no records for split {split}")
        self.training = split == "train"
        self.clip_frames = clip_frames
        self.temporal_stride = temporal_stride
        self.size = size

    def __len__(self):
        return len(self.records)

    def __getitem__(self, index):
        record = self.records[index]
        clip = decode_clip(record.path, self.clip_frames, self.temporal_stride,
                           self.size, self.training)
        return clip, torch.tensor(float(record.label)), record.group_id
