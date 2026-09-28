from __future__ import annotations

from collections import deque
from pathlib import Path

import numpy as np
import torch

try:  # package import
    from .model import PoseFightLSTM
except ImportError:  # direct script execution
    from model import PoseFightLSTM


class FightSequenceClassifier:
    """Runtime adapter for the existing FightDetector feature sequence."""

    def __init__(self, checkpoint_path: str, device: str | None = None):
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
        self.model = PoseFightLSTM(**checkpoint["model_config"]).to(self.device)
        self.model.load_state_dict(checkpoint["state_dict"])
        self.model.eval()
        self.threshold = float(checkpoint["threshold"])
        self.max_frames = int(checkpoint["max_frames"])
        self.input_dim = int(checkpoint["model_config"]["input_dim"])

    def score(self, sequence: np.ndarray) -> float:
        sequence = np.asarray(sequence, dtype=np.float32)
        if sequence.ndim != 2 or sequence.shape[1] != self.input_dim:
            raise ValueError(f"expected [time, {self.input_dim}], got {sequence.shape}")
        if not np.isfinite(sequence).all():
            raise ValueError("sequence contains NaN or infinity")
        if len(sequence) > self.max_frames:
            idx = np.linspace(0, len(sequence) - 1, self.max_frames).round().astype(int)
            sequence = sequence[idx]
        x = torch.from_numpy(sequence).unsqueeze(0).to(self.device)
        lengths = torch.tensor([len(sequence)], device=self.device)
        with torch.inference_mode():
            return float(torch.sigmoid(self.model(x, lengths)).item())

    def predict(self, sequence: np.ndarray) -> tuple[bool, float]:
        score = self.score(sequence)
        return score >= self.threshold, score


class PairSequenceStore:
    """Bounded per-track-pair history; call evict() when tracks disappear."""

    def __init__(self, max_frames: int = 32):
        self.max_frames = max_frames
        self._sequences: dict[tuple[int, int], deque[np.ndarray]] = {}

    def add(self, track_a: int, track_b: int, feature: np.ndarray) -> np.ndarray:
        key = tuple(sorted((int(track_a), int(track_b))))
        sequence = self._sequences.setdefault(key, deque(maxlen=self.max_frames))
        sequence.append(np.asarray(feature, dtype=np.float32))
        return np.stack(sequence)

    def evict(self, active_track_ids: set[int]) -> None:
        for pair in list(self._sequences):
            if pair[0] not in active_track_ids or pair[1] not in active_track_ids:
                del self._sequences[pair]
