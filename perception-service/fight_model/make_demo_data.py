from __future__ import annotations

import argparse
import csv
from pathlib import Path

import numpy as np


def main():
    parser = argparse.ArgumentParser(description="Create synthetic data only for wiring tests")
    parser.add_argument("--output", default="demo_data")
    parser.add_argument("--feature-dim", type=int, default=70)
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()
    rng = np.random.default_rng(args.seed)
    root = Path(args.output); root.mkdir(parents=True, exist_ok=True)
    rows = []
    # Groups never cross splits. Synthetic data must never be reported as accuracy evidence.
    for split, groups in (("train", 12), ("val", 4), ("test", 4)):
        for group in range(groups):
            label = group % 2
            for clip in range(4):
                length = int(rng.integers(16, 41))
                x = rng.normal(0, 0.35, (length, args.feature_dim)).astype(np.float32)
                if label:
                    x[:, :8] += np.sin(np.linspace(0, 8 * np.pi, length))[:, None] * 1.5
                    x[:, -1] += 2.0
                path = root / f"{split}_g{group}_c{clip}.npy"
                np.save(path, x)
                rows.append({"path": path.name, "label": label, "split": split,
                             "group_id": f"{split}-group-{group}", "camera_id": f"demo-{split}"})
    manifest = root / "manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader(); writer.writerows(rows)
    print(manifest)


if __name__ == "__main__":
    main()
