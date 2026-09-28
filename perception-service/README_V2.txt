Fight model v2 - runtime-aligned training

Extract into the project root and replace files. The v1 model and old feature
folder are not overwritten.

The extractor runs labelled videos through YOLO, ByteTrack, TemporalBuffer,
motion gating, pose matching, and the same scene sequence used live. Use
--limit-per-class for a smoke test before the full extraction. Training selects
a validation threshold meeting the requested precision floor when possible.

Follow the command sequence supplied in chat.
