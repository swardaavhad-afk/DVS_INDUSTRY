from __future__ import annotations

from torch import nn
from torchvision.models.video import R3D_18_Weights, r3d_18


def build_r3d18(pretrained: bool = True) -> nn.Module:
    weights = R3D_18_Weights.DEFAULT if pretrained else None
    model = r3d_18(weights=weights)
    model.fc = nn.Linear(model.fc.in_features, 1)
    return model


def set_backbone_trainable(model: nn.Module, trainable: bool):
    for parameter in model.parameters():
        parameter.requires_grad = trainable
    for parameter in model.fc.parameters():
        parameter.requires_grad = True
