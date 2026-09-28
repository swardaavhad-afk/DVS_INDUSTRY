"""
Training script for the pose-sequence LSTM fight/violence classifier.

This is a skeleton, not a trained model -- no weights ship with this
project. Per the design doc's honesty framing: public "fight" datasets
(RWF-2000, Hockey Fight, etc.) don't match arbitrary CCTV camera angles
closely enough to be trustworthy without fine-tuning on your own footage.
Expect to:
  1. Record staged clips on your actual demo camera (fights, and just as
     importantly, *near-miss negatives* -- running, playing, hugging).
  2. Extract pose sequences for each clip using detection/pose_estimator.py
     + temporal/fight_features.py (a helper to do this in bulk is below).
  3. Label each clip's *sequence of feature vectors* as fight / not-fight.
  4. Run this script to train PoseSequenceLSTM.
  5. Point config/thresholds.yaml's fight_detection.model_checkpoint at the
     resulting .pt file and set mode: "model".

Expected data layout:
    data/fight_clips/
        fight/
            clip_0001.npy      # shape (T, FEATURE_DIM), from build_pair_sequence_from_video()
            clip_0002.npy
            ...
        not_fight/
            clip_0001.npy
            ...
"""
from __future__ import annotations

import argparse
import glob
import os

import numpy as np

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, Dataset
except ImportError:  # torch is only required for actually training/running the LSTM
    torch = None


class PoseSequenceLSTM(nn.Module if torch else object):
    """Many-to-one LSTM over per-frame pose-pair feature vectors.
    Input:  (batch, T, FEATURE_DIM)
    Output: (batch,) -- fight probability in [0, 1]
    """

    def __init__(self, input_size: int, hidden_size: int = 64, num_layers: int = 1, dropout: float = 0.3):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        _, (h_n, _) = self.lstm(x)
        last_hidden = h_n[-1]  # (batch, hidden_size)
        return self.classifier(last_hidden).squeeze(-1)


class ClipSequenceDataset(Dataset if torch else object):
    """Loads pre-extracted (T, FEATURE_DIM) .npy sequences from the
    data/fight_clips/{fight,not_fight}/ layout described above."""

    def __init__(self, data_dir: str, seq_len: int = 10):
        self.seq_len = seq_len
        self.samples = []  # list of (path, label)
        for path in glob.glob(os.path.join(data_dir, "fight", "*.npy")):
            self.samples.append((path, 1))
        for path in glob.glob(os.path.join(data_dir, "not_fight", "*.npy")):
            self.samples.append((path, 0))
        if not self.samples:
            raise FileNotFoundError(
                f"No .npy clips found under {data_dir}/fight or {data_dir}/not_fight. "
                f"See this file's module docstring for the expected data layout."
            )

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        path, label = self.samples[idx]
        seq = np.load(path)
        # pad/truncate to a fixed length so batches can be stacked
        if len(seq) < self.seq_len:
            pad = np.zeros((self.seq_len - len(seq), seq.shape[1]), dtype=seq.dtype)
            seq = np.concatenate([seq, pad], axis=0)
        else:
            seq = seq[: self.seq_len]
        return torch.tensor(seq, dtype=torch.float32), torch.tensor(label, dtype=torch.float32)


def train(data_dir: str, output_path: str, epochs: int, batch_size: int, lr: float, seq_len: int):
    if torch is None:
        raise RuntimeError("PyTorch is required to train this model: pip install torch --break-system-packages")

    from temporal.fight_features import FEATURE_DIM

    dataset = ClipSequenceDataset(data_dir, seq_len=seq_len)
    val_size = max(1, int(0.15 * len(dataset)))
    train_size = len(dataset) - val_size
    train_set, val_set = torch.utils.data.random_split(dataset, [train_size, val_size])

    train_loader = DataLoader(train_set, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=batch_size)

    model = PoseSequenceLSTM(input_size=FEATURE_DIM)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.BCELoss()

    best_val_loss = float("inf")
    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for x, y in train_loader:
            optimizer.zero_grad()
            pred = model(x)
            loss = criterion(pred, y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * x.size(0)
        train_loss /= len(train_set)

        model.eval()
        val_loss, correct = 0.0, 0
        with torch.no_grad():
            for x, y in val_loader:
                pred = model(x)
                loss = criterion(pred, y)
                val_loss += loss.item() * x.size(0)
                correct += ((pred > 0.5).float() == y).sum().item()
        val_loss /= len(val_set)
        val_acc = correct / len(val_set)

        print(f"epoch {epoch+1}/{epochs}  train_loss={train_loss:.4f}  val_loss={val_loss:.4f}  val_acc={val_acc:.3f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), output_path)
            print(f"  saved new best checkpoint -> {output_path}")

    print(f"training complete. best val_loss={best_val_loss:.4f}, checkpoint at {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train the pose-sequence LSTM fight classifier")
    parser.add_argument("--data-dir", default="data/fight_clips")
    parser.add_argument("--output", default="models/fight_lstm.pt")
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--seq-len", type=int, default=10)
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    train(args.data_dir, args.output, args.epochs, args.batch_size, args.lr, args.seq_len)
