from __future__ import annotations

import argparse
from pathlib import Path

import torch

try:
    from .dataset import decode_clip, preprocess_frames
    from .model import build_r3d18
except ImportError:
    from dataset import decode_clip, preprocess_frames
    from model import build_r3d18


class RgbFightClassifier:
    def __init__(self, checkpoint_path: str, device: str | None = None):
        self.device = torch.device(device or ("cuda" if torch.cuda.is_available() else "cpu"))
        checkpoint = torch.load(checkpoint_path, map_location=self.device, weights_only=False)
        self.clip_frames = int(checkpoint.get("clip_frames", 16))
        self.temporal_stride = int(checkpoint.get("temporal_stride", 2))
        self.image_size = int(checkpoint.get("image_size", 112))
        self.threshold = float(checkpoint.get("threshold", 0.5))
        self.model = build_r3d18(pretrained=False).to(self.device)
        self.model.load_state_dict(checkpoint["state_dict"])
        self.model.eval()

    def score_clip(self, frames, input_bgr: bool = True) -> float:
        clip = preprocess_frames(list(frames), self.image_size, training=False,
                                 input_bgr=input_bgr).unsqueeze(0).to(self.device)
        with torch.inference_mode():
            return float(torch.sigmoid(self.model(clip).flatten()[0]).item())

    def score_video(self, video_path: str) -> float:
        clip = decode_clip(video_path, self.clip_frames, self.temporal_stride,
                           self.image_size, training=False).unsqueeze(0).to(self.device)
        with torch.inference_mode():
            return float(torch.sigmoid(self.model(clip).flatten()[0]).item())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video")
    parser.add_argument("--checkpoint", default="models/fight_r3d18_v1.pt")
    args = parser.parse_args()
    classifier = RgbFightClassifier(args.checkpoint)
    score = classifier.score_video(args.video)
    print({"video": str(Path(args.video)), "score": score,
           "threshold": classifier.threshold, "fight": score >= classifier.threshold})


if __name__ == "__main__":
    main()
