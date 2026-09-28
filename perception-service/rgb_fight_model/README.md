# RGB Fight Classifier (R3D-18)

Transfer-learning baseline using torchvision's Kinetics-pretrained R3D-18.
Input clips use 16 RGB frames at 112x112. All train/validation/test splits are
made at video level.

## 1. Manifest

```powershell
py -3.12 -m rgb_fight_model.make_manifest --input data\fight_videos --output data\rgb_fight_manifest.csv
```

## 2. Training smoke test

Use one epoch and a small manifest only if you want to verify memory first.
The normal training command is:

```powershell
py -3.12 -u -m rgb_fight_model.train --manifest data\rgb_fight_manifest.csv --output models\fight_r3d18_v1.pt --epochs 15 --batch-size 2 --workers 2 --freeze-backbone-epochs 2 --min-validation-precision 0.85
```

The first run downloads pretrained R3D-18 weights. If CUDA runs out of memory,
set `--batch-size 1`. Do not use `--no-pretrained` unless downloading weights
is impossible.

## 3. Single-video inference

```powershell
py -3.12 -m rgb_fight_model.infer data\fight_videos\fight\fi029.mp4 --checkpoint models\fight_r3d18_v1.pt
```

## 4. Video-level test evaluation

```powershell
py -3.12 -u -m rgb_fight_model.evaluate --manifest data\rgb_fight_manifest.csv --checkpoint models\fight_r3d18_v1.pt --split test --output output\rgb_fight_test_scores.csv
```

Keep the pose-LSTM baseline unchanged until RGB evaluation is complete. Live
integration should happen only after the RGB model passes video-level testing.
