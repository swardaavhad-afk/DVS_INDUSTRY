"""
Sanity test for evidence/clip_extractor.py, independent of YOLO/camera
hardware. Feeds synthetic frames in and checks that before-clips,
keyframes, and after-clips actually get written with non-zero size.
Run: python test_evidence.py
"""
import os
import shutil
import time

import numpy as np
import yaml

from evidence.clip_extractor import EvidenceBuffer

with open("config/thresholds.yaml") as f:
    thresholds_cfg = yaml.safe_load(f)

evidence_cfg = dict(thresholds_cfg["evidence"])
evidence_cfg["output_dir"] = "output/test_evidence"
evidence_cfg["before_seconds"] = 1.0
evidence_cfg["after_seconds"] = 1.0

shutil.rmtree(evidence_cfg["output_dir"], ignore_errors=True)

buf = EvidenceBuffer(
    output_dir=evidence_cfg["output_dir"],
    raw_buffer_window_seconds=evidence_cfg["raw_buffer_window_seconds"],
    before_seconds=evidence_cfg["before_seconds"],
    after_seconds=evidence_cfg["after_seconds"],
    keyframe_count=evidence_cfg["keyframe_count"],
    clip_fps=evidence_cfg["clip_fps"],
)

print("=== Feeding 2s of synthetic frames into the rolling buffer ===")
for i in range(10):
    frame = np.full((120, 160, 3), fill_value=(i * 20) % 255, dtype=np.uint8)
    buf.add_frame(frame)
    time.sleep(0.2)

incident_id = "TEST-INC-001"
camera_id = "CAM-TEST"

print("\n=== Capturing 'before' clip + keyframes on simulated confirm ===")
before_path = buf.capture_before_clip(incident_id, camera_id)
keyframes = buf.save_keyframes(incident_id, camera_id)
print(f"  before clip: {before_path}")
print(f"  keyframes: {keyframes}")

assert before_path and os.path.exists(before_path) and os.path.getsize(before_path) > 0, "before clip missing/empty"
assert len(keyframes) > 0 and all(os.path.exists(p) and os.path.getsize(p) > 0 for p in keyframes), "keyframes missing/empty"
print("  PASS: before clip and keyframes written with non-zero size")

print("\n=== Starting post-capture and feeding more frames until the window closes ===")
buf.start_post_capture(incident_id, camera_id)
for i in range(8):
    frame = np.full((120, 160, 3), fill_value=(200 - i * 10) % 255, dtype=np.uint8)
    buf.add_frame(frame)
    time.sleep(0.2)

ready = buf.flush_ready_post_clips()
print(f"  ready after-clips: {ready}")
assert incident_id in ready and ready[incident_id] and os.path.exists(ready[incident_id]), "after clip not produced"
assert os.path.getsize(ready[incident_id]) > 0, "after clip is empty"
print("  PASS: after clip written with non-zero size")

print("\nAll evidence extraction tests passed.")
