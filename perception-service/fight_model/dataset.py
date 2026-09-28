from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset


REQUIRED_COLUMNS = {"path", "label", "split", "group_id"}
VALID_SPLITS = {"train", "val", "test"}


@dataclass(frozen=True)
class Record:
    path: Path
    label: int
    split: str
    group_id: str
    camera_id: str


def load_manifest(path: str | Path) -> list[Record]:
    manifest = Path(path).resolve()
    with manifest.open(newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        missing = REQUIRED_COLUMNS - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"manifest missing columns: {sorted(missing)}")
        rows = []
        for line_no, row in enumerate(reader, start=2):
            split = row["split"].strip().lower()
            if split not in VALID_SPLITS:
                raise ValueError(f"line {line_no}: invalid split {split!r}")
            label = int(row["label"])
            if label not in (0, 1):
                raise ValueError(f"line {line_no}: label must be 0 or 1")
            sample_path = Path(row["path"])
            if not sample_path.is_absolute():
                sample_path = (manifest.parent / sample_path).resolve()
            rows.append(Record(sample_path, label, split, row["group_id"].strip(),
                               row.get("camera_id", "").strip()))
    _validate_no_group_leakage(rows)
    return rows


def _validate_no_group_leakage(rows: list[Record]) -> None:
    split_by_group: dict[str, str] = {}
    for row in rows:
        previous = split_by_group.setdefault(row.group_id, row.split)
        if previous != row.split:
            raise ValueError(
                f"data leakage: group {row.group_id!r} appears in {previous!r} and {row.split!r}"
            )


class PoseSequenceDataset(Dataset):
    def __init__(self, records: list[Record], split: str, max_frames: int = 32):
        self.records = [r for r in records if r.split == split]
        if not self.records:
            raise ValueError(f"no samples for split {split!r}")
        self.max_frames = max_frames
        self.input_dim = self._load_array(self.records[0].path).shape[1]

    @staticmethod
    def _load_array(path: Path) -> np.ndarray:
        array = np.load(path, allow_pickle=False)
        if array.ndim != 2 or array.shape[0] < 2 or array.shape[1] < 2:
            raise ValueError(f"{path}: expected [time, features], got {array.shape}")
        if not np.isfinite(array).all():
            raise ValueError(f"{path}: contains NaN or infinity")
        return array.astype(np.float32, copy=False)

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, index: int):
        row = self.records[index]
        x = self._load_array(row.path)
        if x.shape[1] != self.input_dim:
            raise ValueError(f"{row.path}: feature dimension changed")
        if len(x) > self.max_frames:
            # Uniform sampling preserves the whole action instead of only its beginning.
            indices = np.linspace(0, len(x) - 1, self.max_frames).round().astype(int)
            x = x[indices]
        return torch.from_numpy(x), torch.tensor(row.label, dtype=torch.float32), row


def collate_sequences(batch):
    sequences, labels, records = zip(*batch)
    lengths = torch.tensor([len(x) for x in sequences], dtype=torch.long)
    padded = torch.nn.utils.rnn.pad_sequence(sequences, batch_first=True)
    return padded, torch.stack(labels), lengths, records
