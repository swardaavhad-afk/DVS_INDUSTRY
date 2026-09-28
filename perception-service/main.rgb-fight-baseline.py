"""
Perception pipeline entry point.

Wires together: StreamReader -> YoloDetector -> ByteTracker -> TemporalBuffer
-> RuleEngine -> EventConfirmation -> SeverityRules -> IncidentReporter.

Run with a webcam:
    python main.py --camera CAM-01

Run against a video file (useful for testing without real camera hardware
or a live RTSP feed -- just point cameras.yaml's `source` at a file path,
or override with --source):
    python main.py --camera CAM-01 --source /path/to/test_video.mp4 --no-display

The processing loop deliberately runs at a fixed `detection_fps` (from
thresholds.yaml) rather than every captured frame, per the design doc's
real-time performance guidance (section 9/19).
"""
from __future__ import annotations

import argparse
import time

import cv2
import supervision as sv
import yaml

from confirmation.event_confirmation import EventConfirmation
from detection.yolo_detector import YoloDetector
from evidence.clip_extractor import EvidenceBuffer
from ingestion.stream_reader import StreamReader
from reporting.incident_report import IncidentReporter
from severity.severity_rules import compute_severity
from temporal.action_recognition import FightDetector
from temporal.rgb_action_recognition import RgbFightDetector
from temporal.rule_engine import RuleEngine
from temporal.temporal_buffer import TemporalBuffer
from tracking.byte_tracker import ByteTracker

TIER_COLOR = {
    "CONFIRMED": (0, 0, 255),      # red (BGR)
    "PROBABLE": (0, 165, 255),     # orange
    "LOW_CONFIDENCE": (0, 255, 255),  # yellow
}


def load_config(config_dir: str = "config"):
    with open(f"{config_dir}/cameras.yaml") as f:
        cameras_cfg = yaml.safe_load(f)
    with open(f"{config_dir}/thresholds.yaml") as f:
        thresholds_cfg = yaml.safe_load(f)
    return cameras_cfg, thresholds_cfg


def find_camera_config(cameras_cfg: dict, camera_id: str) -> dict:
    for cam in cameras_cfg["cameras"]:
        if cam["id"] == camera_id:
            return cam
    raise ValueError(f"camera_id '{camera_id}' not found in cameras.yaml")


def run(camera_id: str, source_override: str | None, display: bool, max_seconds: float | None):
    cameras_cfg, thresholds_cfg = load_config()
    cam_cfg = find_camera_config(cameras_cfg, camera_id)
    source = source_override or cam_cfg["source"]

    perception_cfg = thresholds_cfg["perception"]
    tracking_cfg = thresholds_cfg["tracking"]

    print(f"[{camera_id}] starting pipeline. source={source}")

    reader = StreamReader(
        source=source,
        camera_id=camera_id,
        target_fps=perception_cfg["detection_fps"],
    ).start()
    detector = YoloDetector(
        model_path=perception_cfg["model_path"],
        confidence_threshold=perception_cfg["confidence_threshold"],
        classes_of_interest=perception_cfg["classes_of_interest"],
    )
    tracker = ByteTracker(
        track_activation_threshold=tracking_cfg["track_activation_threshold"],
        lost_track_buffer=tracking_cfg["lost_track_buffer"],
        minimum_matching_threshold=tracking_cfg["minimum_matching_threshold"],
        frame_rate=perception_cfg["detection_fps"],
    )
    buffer = TemporalBuffer(window_seconds=thresholds_cfg["temporal_buffer"]["window_seconds"])
    rule_engine = RuleEngine(cam_cfg, thresholds_cfg)
    fight_cfg = thresholds_cfg["fight_detection"]
    fight_detector = (
        RgbFightDetector(camera_id, fight_cfg)
        if fight_cfg.get("mode") == "rgb"
        else FightDetector(camera_id, fight_cfg)
    )
    confirmation = EventConfirmation(thresholds_cfg["confirmation"])
    reporter = IncidentReporter(
        output_path="output/incidents.jsonl",
        camera_locations={cam_cfg["id"]: cam_cfg["location"]},
    )
    evidence_cfg = thresholds_cfg["evidence"]
    evidence_buffer = EvidenceBuffer(
        output_dir=evidence_cfg["output_dir"],
        raw_buffer_window_seconds=evidence_cfg["raw_buffer_window_seconds"],
        before_seconds=evidence_cfg["before_seconds"],
        after_seconds=evidence_cfg["after_seconds"],
        keyframe_count=evidence_cfg["keyframe_count"],
        clip_fps=evidence_cfg["clip_fps"],
    )

    box_annotator = sv.BoxAnnotator()
    label_annotator = sv.LabelAnnotator()

    process_interval = 1.0 / perception_cfg["detection_fps"]
    last_process_time = 0.0
    proc_w, proc_h = perception_cfg["process_width"], perception_cfg["process_height"]

    start_time = time.time()
    frames_processed = 0
    last_seen_frame_index = -1

    try:
        while True:
            if max_seconds and (time.time() - start_time) > max_seconds:
                print(f"[{camera_id}] max_seconds reached, stopping")
                break

            now = time.time()
            if now - last_process_time < process_interval:
                time.sleep(0.01)
                continue
            last_process_time = now

            sample = reader.get_latest()
            if sample is None:
                if reader.is_end_of_stream():
                    print(f"[{camera_id}] no frames and stream ended -- stopping")
                    break
                time.sleep(0.05)
                continue

            if reader.is_end_of_stream() and sample.frame_index == last_seen_frame_index:
                # stream ended and we've already processed the last frame it produced
                # (relevant for file sources, which don't keep producing new frames
                # the way a live RTSP source would after a reconnect)
                print(f"[{camera_id}] stream ended and no new frames arriving -- stopping")
                break
            last_seen_frame_index = sample.frame_index

            frame = cv2.resize(sample.frame, (proc_w, proc_h))
            # feed the evidence buffer with the *original* full-resolution frame,
            # not the downscaled one used for inference (design doc section 8)
            evidence_buffer.add_frame(sample.frame, timestamp=sample.timestamp)

            detections = detector.detect(frame)
            tracked = tracker.update(detections)

            for i in range(len(tracked)):
                bbox = tracked.xyxy[i]
                track_id = int(tracked.tracker_id[i]) if tracked.tracker_id is not None else -1
                class_id = int(tracked.class_id[i])
                confidence = float(tracked.confidence[i]) if tracked.confidence is not None else 0.0
                class_name = detector.class_name(class_id)
                if track_id >= 0:
                    buffer.update(track_id, class_name, bbox, confidence)

            buffer.evict_stale()

            candidates = rule_engine.evaluate(buffer)
            # fight detection is the expensive, gated path -- only actually runs
            # pose estimation when the motion-of-interest gate finds a pair worth
            # checking (see temporal/motion_gate.py and action_recognition.py)
            candidates += fight_detector.evaluate(buffer, frame)
            confirmed_events = confirmation.update(candidates)

            for event in confirmed_events:
                severity = compute_severity(event.event_type, event, thresholds_cfg["severity"])
                # A probable fight is an operator-facing signal, not a separate
                # persisted incident. Persist only after the stricter confirmed
                # policy is met, preventing probable+confirmed duplicate reports.
                if event.event_type == "fight" and event.tier == "PROBABLE":
                    print(
                        f"[{camera_id}] PROBABLE fight candidate "
                        f"severity={severity} conf={event.confidence:.2f} -- awaiting confirmation"
                    )
                    continue
                if event.tier in ("CONFIRMED", "PROBABLE"):
                    # incident_id isn't known until build_and_save assigns one, but
                    # the evidence extraction needs to happen right away (before the
                    # rolling buffer ages the relevant frames out) -- so build the
                    # report first with a placeholder, then capture evidence against
                    # its real incident_id, then attach the paths.
                    report = reporter.build_and_save(event, severity)
                    incident_id = report["incident_id"]

                    clip_before = evidence_buffer.capture_before_clip(incident_id, event.camera_id)
                    keyframes = evidence_buffer.save_keyframes(incident_id, event.camera_id)
                    evidence_buffer.start_post_capture(incident_id, event.camera_id)
                    if clip_before or keyframes:
                        reporter.update_evidence(incident_id, {"clip_before": clip_before, "keyframes": keyframes})

                    print(
                        f"[{camera_id}] {event.tier} {event.event_type} "
                        f"severity={severity} conf={event.confidence:.2f} "
                        f"-> {incident_id} (before-clip: {'yes' if clip_before else 'no'})"
                    )
                else:
                    print(f"[{camera_id}] low-confidence signal: {event.event_type} track={event.candidate.track_ids}")

            # flush any "after" clips whose post-capture window has completed
            ready_after_clips = evidence_buffer.flush_ready_post_clips()
            for incident_id, clip_after_path in ready_after_clips.items():
                reporter.update_evidence(incident_id, {"clip_after": clip_after_path})
                print(f"[{camera_id}] after-clip ready for {incident_id}")

            frames_processed += 1

            if display:
                annotated = box_annotator.annotate(scene=frame.copy(), detections=tracked)
                labels = [
                    f"#{tid} {detector.class_name(cid)} {conf:.2f}"
                    for tid, cid, conf in zip(
                        tracked.tracker_id if tracked.tracker_id is not None else [],
                        tracked.class_id,
                        tracked.confidence if tracked.confidence is not None else [0] * len(tracked),
                    )
                ]
                annotated = label_annotator.annotate(scene=annotated, detections=tracked, labels=labels)
                try:
                    cv2.imshow(f"CCTV Perception - {camera_id}", annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break
                except cv2.error:
                    print(
                        f"[{camera_id}] cv2.imshow failed -- your OpenCV build has no GUI support "
                        f"(common with opencv-python-headless). Continuing without a display window. "
                        f"Fix: pip uninstall opencv-python-headless -y && pip install opencv-python, "
                        f"or just run with --no-display to skip this message."
                    )
                    display = False

    finally:
        reader.stop()
        if display:
            try:
                cv2.destroyAllWindows()
            except cv2.error:
                pass  # no GUI backend to tear down -- already handled above
        elapsed = time.time() - start_time
        print(f"[{camera_id}] fight diagnostics: {fight_detector.diagnostics()}")
        print(f"[{camera_id}] stopped. processed {frames_processed} cycles in {elapsed:.1f}s "
              f"(~{frames_processed / max(elapsed, 1e-6):.2f} eval/s)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CCTV perception pipeline")
    parser.add_argument("--camera", default="CAM-01", help="camera id from config/cameras.yaml")
    parser.add_argument("--source", default=None, help="override source (webcam index, RTSP URL, or file path)")
    parser.add_argument("--no-display", action="store_true", help="disable cv2.imshow (needed on headless machines)")
    parser.add_argument("--max-seconds", type=float, default=None, help="stop after N seconds (useful for testing)")
    args = parser.parse_args()

    run(
        camera_id=args.camera,
        source_override=args.source,
        display=not args.no_display,
        max_seconds=args.max_seconds,
    )
