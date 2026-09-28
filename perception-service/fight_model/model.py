from __future__ import annotations

import torch
from torch import nn


class PoseFightLSTM(nn.Module):
    """Compact sequence classifier for pairwise pose features."""

    def __init__(self, input_dim: int, hidden_dim: int = 96, num_layers: int = 2,
                 dropout: float = 0.25, bidirectional: bool = False):
        super().__init__()
        self.input_dim = input_dim
        self.hidden_dim = hidden_dim
        self.num_layers = num_layers
        self.bidirectional = bidirectional
        self.normalizer = nn.LayerNorm(input_dim)
        self.lstm = nn.LSTM(
            input_dim, hidden_dim, num_layers=num_layers, batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=bidirectional,
        )
        out_dim = hidden_dim * (2 if bidirectional else 1)
        self.head = nn.Sequential(
            nn.LayerNorm(out_dim), nn.Dropout(dropout), nn.Linear(out_dim, 1)
        )

    def forward(self, x: torch.Tensor, lengths: torch.Tensor) -> torch.Tensor:
        x = self.normalizer(x)
        packed = nn.utils.rnn.pack_padded_sequence(
            x, lengths.cpu(), batch_first=True, enforce_sorted=False
        )
        _, (h_n, _) = self.lstm(packed)
        if self.bidirectional:
            representation = torch.cat((h_n[-2], h_n[-1]), dim=1)
        else:
            representation = h_n[-1]
        return self.head(representation).squeeze(1)

    def config(self) -> dict:
        return {
            "input_dim": self.input_dim,
            "hidden_dim": self.hidden_dim,
            "num_layers": self.num_layers,
            "bidirectional": self.bidirectional,
        }
