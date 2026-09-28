"""Regression test: file input must produce many sampled frames, not only EOF's last frame."""
from pathlib import Path
import tempfile

import cv2
import numpy as np

from ingestion.stream_reader import StreamReader

with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp) / "input.avi"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 30.0, (64, 48))
    assert writer.isOpened()
    for index in range(30):
        writer.write(np.full((48, 64, 3), index * 5, dtype=np.uint8))
    writer.release()

    reader = StreamReader(str(path), "TEST", target_fps=10).start()
    samples = []
    while True:
        sample = reader.get_latest()
        if sample is None:
            if reader.is_end_of_stream():
                break
            continue
        samples.append(sample)
    reader.stop()

    assert 9 <= len(samples) <= 11, len(samples)
    assert all(b.frame_index > a.frame_index for a, b in zip(samples, samples[1:]))
    assert all(b.timestamp > a.timestamp for a, b in zip(samples, samples[1:]))
    print(f"PASS processed {len(samples)} samples from 30-frame file")
