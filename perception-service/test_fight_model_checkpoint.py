"""Smoke test for the new metadata-rich fight checkpoint format."""
from pathlib import Path
import tempfile

import numpy as np
import torch

from fight_model.infer import FightSequenceClassifier
from fight_model.model import PoseFightLSTM
from temporal.fight_features import FEATURE_DIM

with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / "checkpoint.pt"
    model = PoseFightLSTM(input_dim=FEATURE_DIM, hidden_dim=16, num_layers=1)
    torch.save({
        "state_dict": model.state_dict(),
        "model_config": model.config(),
        "max_frames": 32,
        "threshold": 0.5,
        "validation_metrics": {"f1": 0.0},
    }, path)
    classifier = FightSequenceClassifier(str(path), device="cpu")
    sequence = np.zeros((16, FEATURE_DIM), dtype=np.float32)
    score = classifier.score(sequence)
    assert 0.0 <= score <= 1.0
    assert classifier.input_dim == FEATURE_DIM
    assert classifier.max_frames == 32
    print(f"PASS checkpoint loaded; feature_dim={FEATURE_DIM}, score={score:.4f}")
