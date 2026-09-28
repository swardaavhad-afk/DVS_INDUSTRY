from __future__ import annotations

import argparse
import json
import random
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.utils.data import DataLoader

try:  # package import
    from .dataset import PoseSequenceDataset, collate_sequences, load_manifest
    from .model import PoseFightLSTM
except ImportError:  # direct script execution
    from dataset import PoseSequenceDataset, collate_sequences, load_manifest
    from model import PoseFightLSTM


def metrics(labels: np.ndarray, scores: np.ndarray, threshold: float) -> dict:
    pred = scores >= threshold
    truth = labels == 1
    tp = int(np.sum(pred & truth)); fp = int(np.sum(pred & ~truth))
    fn = int(np.sum(~pred & truth)); tn = int(np.sum(~pred & ~truth))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"threshold": threshold, "precision": precision, "recall": recall,
            "f1": f1, "tp": tp, "fp": fp, "fn": fn, "tn": tn}


def choose_threshold(labels: np.ndarray, scores: np.ndarray,
                     min_precision: float = 0.0) -> dict:
    candidates = [metrics(labels, scores, float(t)) for t in np.linspace(0.1, 0.9, 81)]
    feasible = [m for m in candidates if m["precision"] >= min_precision and (m["tp"] + m["fp"]) > 0]
    if feasible:
        # Alert systems need controlled false alarms. Among thresholds meeting
        # the precision floor, preserve as much recall as possible.
        selected = max(feasible, key=lambda m: (m["recall"], m["f1"], m["precision"], m["threshold"]))
        return {**selected, "threshold_objective": f"precision>={min_precision:.2f}"}
    selected = max(candidates, key=lambda m: (m["f1"], m["precision"]))
    return {**selected, "threshold_objective": "fallback_max_f1"}


def evaluate(model, loader, device):
    model.eval(); all_labels = []; all_scores = []
    with torch.inference_mode():
        for x, y, lengths, _ in loader:
            logits = model(x.to(device), lengths.to(device))
            all_scores.extend(torch.sigmoid(logits).cpu().numpy().tolist())
            all_labels.extend(y.numpy().tolist())
    return np.asarray(all_labels, dtype=int), np.asarray(all_scores, dtype=float)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--output", default="models/fight_lstm.pt")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--max-frames", type=int, default=32)
    parser.add_argument("--hidden-dim", type=int, default=96)
    parser.add_argument("--num-layers", type=int, default=2)
    parser.add_argument("--dropout", type=float, default=0.25)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--patience", type=int, default=7)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--min-validation-precision", type=float, default=0.85,
                        help="select a threshold meeting this precision floor when possible")
    args = parser.parse_args()

    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    records = load_manifest(args.manifest)
    train_ds = PoseSequenceDataset(records, "train", args.max_frames)
    val_ds = PoseSequenceDataset(records, "val", args.max_frames)
    test_ds = PoseSequenceDataset(records, "test", args.max_frames)
    for ds in (val_ds, test_ds):
        if ds.input_dim != train_ds.input_dim:
            raise ValueError("feature dimensions differ across splits")

    train_loader = DataLoader(train_ds, args.batch_size, shuffle=True,
                              collate_fn=collate_sequences)
    val_loader = DataLoader(val_ds, args.batch_size, shuffle=False,
                            collate_fn=collate_sequences)
    test_loader = DataLoader(test_ds, args.batch_size, shuffle=False,
                             collate_fn=collate_sequences)

    model = PoseFightLSTM(train_ds.input_dim, args.hidden_dim, args.num_layers,
                          args.dropout).to(device)
    positives = sum(r.label for r in train_ds.records)
    negatives = len(train_ds.records) - positives
    pos_weight = torch.tensor([negatives / max(positives, 1)], device=device)
    loss_fn = nn.BCEWithLogitsLoss(pos_weight=pos_weight)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    output = Path(args.output); output.parent.mkdir(parents=True, exist_ok=True)
    best_f1 = -1.0; stale = 0
    history = []
    for epoch in range(1, args.epochs + 1):
        model.train(); losses = []
        for x, y, lengths, _ in train_loader:
            optimizer.zero_grad(set_to_none=True)
            logits = model(x.to(device), lengths.to(device))
            loss = loss_fn(logits, y.to(device)); loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 5.0)
            optimizer.step(); losses.append(float(loss.item()))
        labels, scores = evaluate(model, val_loader, device)
        selected = choose_threshold(labels, scores, args.min_validation_precision)
        row = {"epoch": epoch, "train_loss": float(np.mean(losses)), **selected}
        history.append(row); print(json.dumps(row))
        if selected["f1"] > best_f1:
            best_f1 = selected["f1"]; stale = 0
            torch.save({"state_dict": model.state_dict(), "model_config": model.config(),
                        "max_frames": args.max_frames, "threshold": selected["threshold"],
                        "validation_metrics": selected, "manifest": str(Path(args.manifest).resolve())}, output)
        else:
            stale += 1
            if stale >= args.patience: break

    checkpoint = torch.load(output, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["state_dict"])
    test_labels, test_scores = evaluate(model, test_loader, device)
    test_metrics = metrics(test_labels, test_scores, checkpoint["threshold"])
    report = {"device": str(device), "best_validation": checkpoint["validation_metrics"],
              "test": test_metrics, "history": history}
    report_path = output.with_suffix(".metrics.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"checkpoint": str(output), "metrics": str(report_path), **test_metrics}, indent=2))


if __name__ == "__main__":
    main()
