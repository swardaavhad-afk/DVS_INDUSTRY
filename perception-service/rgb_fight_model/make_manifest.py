from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".m4v"}


def assign(paths: list[Path], seed: int):
    items = sorted(paths)
    random.Random(seed).shuffle(items)
    n = len(items)
    n_test = max(1, round(n * 0.15))
    n_val = max(1, round(n * 0.15))
    return {
        p: ("test" if i < n_test else "val" if i < n_test + n_val else "train")
        for i, p in enumerate(items)
    }


def main():
    parser = argparse.ArgumentParser(description="Create video-level RGB fight manifest")
    parser.add_argument("--input", required=True, help="folder containing fight/ and not_fight/")
    parser.add_argument("--output", default="data/rgb_fight_manifest.csv")
    parser.add_argument("--seed", type=int, default=126)
    args = parser.parse_args()

    root = Path(args.input).resolve()
    rows = []
    for folder, label in (("fight", 1), ("not_fight", 0)):
        class_dir = root / folder
        paths = [p for p in class_dir.rglob("*") if p.suffix.lower() in VIDEO_EXTENSIONS]
        if not paths:
            raise FileNotFoundError(f"no videos found in {class_dir}")
        splits = assign(paths, args.seed + label)
        for path in sorted(paths):
            rows.append({
                "path": str(path),
                "label": label,
                "split": splits[path],
                "group_id": path.relative_to(root).as_posix(),
            })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["path", "label", "split", "group_id"])
        writer.writeheader()
        writer.writerows(rows)
    counts = {(s, y): sum(r["split"] == s and r["label"] == y for r in rows)
              for s in ("train", "val", "test") for y in (0, 1)}
    print({"manifest": str(output.resolve()), "videos": len(rows), "counts": counts})


if __name__ == "__main__":
    main()
