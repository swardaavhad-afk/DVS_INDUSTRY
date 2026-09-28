from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader

try:
    from .dataset import RgbFightDataset, load_manifest
    from .model import build_r3d18, set_backbone_trainable
except ImportError:
    from dataset import RgbFightDataset, load_manifest
    from model import build_r3d18, set_backbone_trainable


def metrics(labels, scores, threshold):
    pred, truth = scores >= threshold, labels == 1
    tp = int(np.sum(pred & truth)); fp = int(np.sum(pred & ~truth))
    fn = int(np.sum(~pred & truth)); tn = int(np.sum(~pred & ~truth))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"threshold": float(threshold), "precision": precision, "recall": recall,
            "f1": f1, "tp": tp, "fp": fp, "fn": fn, "tn": tn}


def choose_threshold(labels, scores, min_precision):
    candidates = [metrics(labels, scores, t) for t in np.linspace(0.1, 0.9, 81)]
    feasible = [m for m in candidates if m["precision"] >= min_precision and m["tp"] + m["fp"]]
    if feasible:
        return max(feasible, key=lambda m: (m["recall"], m["f1"], m["precision"], m["threshold"]))
    return max(candidates, key=lambda m: (m["f1"], m["precision"]))


def evaluate(model, loader, device):
    model.eval(); labels = []; scores = []
    with torch.inference_mode():
        for clips, targets, _ in loader:
            logits = model(clips.to(device, non_blocking=True)).flatten()
            scores.extend(torch.sigmoid(logits).cpu().numpy().tolist())
            labels.extend(targets.numpy().astype(int).tolist())
    return np.asarray(labels), np.asarray(scores)


def main():
    parser = argparse.ArgumentParser(description="Fine-tune R3D-18 for fight detection")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", default="models/fight_r3d18_v1.pt")
    parser.add_argument("--epochs", type=int, default=15)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--lr", type=float, default=1e-4)
    parser.add_argument("--patience", type=int, default=5)
    parser.add_argument("--freeze-backbone-epochs", type=int, default=2)
    parser.add_argument("--clip-frames", type=int, default=16)
    parser.add_argument("--temporal-stride", type=int, default=2)
    parser.add_argument("--image-size", type=int, default=112)
    parser.add_argument("--min-validation-precision", type=float, default=0.85)
    parser.add_argument("--no-pretrained", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    records = load_manifest(args.manifest)
    train_ds = RgbFightDataset(records, "train", args.clip_frames, args.temporal_stride, args.image_size)
    val_ds = RgbFightDataset(records, "val", args.clip_frames, args.temporal_stride, args.image_size)
    test_ds = RgbFightDataset(records, "test", args.clip_frames, args.temporal_stride, args.image_size)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=args.workers, pin_memory=device.type == "cuda")
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False,
                            num_workers=args.workers, pin_memory=device.type == "cuda")
    test_loader = DataLoader(test_ds, batch_size=args.batch_size, shuffle=False,
                             num_workers=args.workers, pin_memory=device.type == "cuda")

    model = build_r3d18(pretrained=not args.no_pretrained).to(device)
    set_backbone_trainable(model, args.freeze_backbone_epochs == 0)
    positives = sum(r.label for r in train_ds.records)
    negatives = len(train_ds.records) - positives
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([negatives / max(positives, 1)], device=device))
    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                                  lr=args.lr, weight_decay=1e-4)
    amp = device.type == "cuda"
    scaler = torch.cuda.amp.GradScaler(enabled=amp)
    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True)
    best_f1, stale, history = -1.0, 0, []

    for epoch in range(1, args.epochs + 1):
        if epoch == args.freeze_backbone_epochs + 1 and args.freeze_backbone_epochs > 0:
            set_backbone_trainable(model, True)
            optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr * 0.25, weight_decay=1e-4)
        model.train(); losses = []
        for clips, targets, _ in train_loader:
            clips = clips.to(device, non_blocking=True)
            targets = targets.to(device, non_blocking=True)
            optimizer.zero_grad(set_to_none=True)
            with torch.cuda.amp.autocast(enabled=amp):
                logits = model(clips).flatten()
                loss = loss_fn(logits, targets)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            scaler.step(optimizer); scaler.update()
            losses.append(float(loss.item()))

        labels, scores = evaluate(model, val_loader, device)
        selected = choose_threshold(labels, scores, args.min_validation_precision)
        row = {"epoch": epoch, "train_loss": float(np.mean(losses)), **selected}
        history.append(row); print(json.dumps(row), flush=True)
        if selected["f1"] > best_f1:
            best_f1, stale = selected["f1"], 0
            torch.save({"state_dict": model.state_dict(), "threshold": selected["threshold"],
                        "validation_metrics": selected, "clip_frames": args.clip_frames,
                        "temporal_stride": args.temporal_stride, "image_size": args.image_size,
                        "manifest": str(Path(args.manifest).resolve())}, output)
        else:
            stale += 1
            if stale >= args.patience:
                print("early stopping", flush=True)
                break

    checkpoint = torch.load(output, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["state_dict"])
    test_labels, test_scores = evaluate(model, test_loader, device)
    test_result = metrics(test_labels, test_scores, checkpoint["threshold"])
    report = {"device": str(device), "best_validation": checkpoint["validation_metrics"],
              "test": test_result, "history": history}
    report_path = output.with_suffix(".metrics.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"checkpoint": str(output), "metrics": str(report_path), **test_result}, indent=2))


if __name__ == "__main__":
    main()
