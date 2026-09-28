# Fight Detection Model — PoseSequenceLSTM

This package upgrades the existing fight heuristic into a trainable temporal classifier. It **does not replace** YOLO, ByteTrack, the motion gate, event confirmation, or evidence capture.

## Input contract

Each sample is a NumPy `.npy` array shaped `[T, F]`. In this project, `temporal.fight_features.FEATURE_DIM` is **70**:

- `T`: temporal frames (recommended 16–32 sampled at 8–12 FPS)
- `F`: the exact output dimension of the existing `pair_feature_vector`
- values must be finite `float32`

Create `manifest.csv`:

```csv
path,label,split,group_id,camera_id
features/fight_001.npy,1,train,source-video-001,CAM-01
features/hug_001.npy,0,train,source-video-002,CAM-01
features/fight_101.npy,1,val,source-video-101,CAM-02
features/run_201.npy,0,test,source-video-201,CAM-03
```

`group_id` is mandatory. All windows from one source video/session/actor group must share one group ID. The loader rejects a group appearing in multiple splits.

## Install

```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r fight_model/requirements-model.txt
```

## Wiring-only smoke test

Synthetic data checks the training pipeline, not fight accuracy:

```bash
python fight_model/make_demo_data.py --output fight_model/demo_data
python fight_model/train.py \
  --manifest fight_model/demo_data/manifest.csv \
  --output models/fight_lstm_demo.pt \
  --epochs 5
```

## Real feature extraction and training

Place labelled videos under `data/fight_videos/fight/` and `data/fight_videos/not_fight/`. Then run:

```bash
python -m fight_model.extract_features --input data/fight_videos --output data/fight_features --camera-id CAM-01
python fight_model/train.py --manifest data/fight_features/manifest.csv --output models/fight_lstm.pt --epochs 40
```

The extractor resizes frames to the same 640×480 processing resolution, runs YOLOv8-Pose, preserves pair ordering, creates 70-dimensional features, and keeps every window from one video in the same split. Review `skipped.csv`; videos without enough paired poses are not silently treated as negatives.

Include hard negatives: running, hugging, dancing, playing, pushing, crowds, normal conversation, tool use and camera shake. Split different camera/actor sessions before making final claims; the automatic split is a safe starting point, not a substitute for deliberate test-set design.

The checkpoint stores the feature dimension, architecture, chosen validation threshold and validation metrics. Test metrics are written separately.

## Runtime integration

```python
from fight_model.infer import FightSequenceClassifier

classifier = FightSequenceClassifier("models/fight_lstm.pt")
is_fight, score = classifier.predict(sequence)
```

Do not create an incident from this boolean alone. Feed the score into the existing event-confirmation state machine and require persistence over multiple windows.

## Required evaluation

Report precision, recall, F1, confusion matrix, false alarms per camera-hour and detection latency on unseen real CCTV. Never report metrics from the synthetic demo dataset as model accuracy.
