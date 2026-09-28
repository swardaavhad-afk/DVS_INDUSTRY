from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from decimal import Decimal
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from schemas.incident_schema import IncidentRecord


class IncidentAnalysis(BaseModel):
    """Dashboard-safe LLM output: identity plus one concise summary only."""

    incident_id: str
    camera_id: str
    camera_location: str
    summary: str = Field(min_length=1, max_length=700)


SYSTEM_PROMPT = """You write short incident summaries for an administrator dashboard.
Use only the supplied structured incident facts.
Return JSON with exactly one field: {"summary": "..."}.
The summary must be one concise paragraph of one or two sentences.
Do not provide recommended actions, risk assessment, timelines, bullet lists, reasoning, technical details, or extra fields.
Do not calculate, change, round, infer, or invent event types, counts, thresholds, confidence, severity, timestamps, camera IDs, locations, zones, or PPE items.
Use the supplied canonical summary as the factual source. You may improve its wording only if every fact and value remains unchanged.
"""


def _present(value: Any) -> bool:
    return value is not None and str(value).strip() != ""


def _detail_value(detail: dict[str, Any], *keys: str) -> Any:
    for key in keys:
        value = detail.get(key)
        if _present(value):
            return value
    return None


def _confidence_percent(value: float | int) -> str:
    """Format the pipeline score as a percentage without asking the LLM to calculate it."""

    number = Decimal(str(value))
    percent = number * Decimal("100") if number <= 1 else number
    text = format(percent.normalize(), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return f"{text}%"


def _place(record: IncidentRecord) -> str:
    location = str(record.location).strip() if _present(record.location) else ""
    camera = str(record.camera_id).strip() if _present(record.camera_id) else ""
    if location and camera:
        return f"{location} ({camera})"
    return location or camera or "the monitored area"


def _closing_sentence(record: IncidentRecord) -> str:
    confidence = _confidence_percent(record.confidence_score)
    severity = str(record.severity).lower()
    tier = str(record.confidence_tier).strip().lower()
    if tier:
        return (
            f"The incident was {tier} with {confidence} confidence and "
            f"classified as {severity} severity."
        )
    return f"Detection confidence was {confidence}, with {severity} severity."


def canonical_summary(record: IncidentRecord) -> str:
    """Create a factual fallback using only values produced by the pipeline."""

    detail = dict(record.detail or {})
    event_type = str(record.event_type).strip().lower().replace("-", "_")
    place = _place(record)
    closing = _closing_sentence(record)

    if event_type == "crowd":
        count = _detail_value(detail, "observed_count", "count", "person_count")
        if count is None and record.detected_objects:
            count = len(record.detected_objects)
        threshold = _detail_value(
            detail,
            "threshold",
            "configured_threshold",
            "person_count_threshold",
        )

        if count is not None and threshold is not None:
            opening = (
                f"A crowd of {count} people was detected in {place}, exceeding "
                f"the configured threshold of {threshold} people."
            )
        elif count is not None:
            opening = f"A crowd of {count} people was detected in {place}."
        else:
            opening = f"A crowd was detected in {place}."
        return f"{opening} {closing}"

    if event_type == "intrusion":
        zone = record.zone_id or _detail_value(detail, "zone_id", "zone")
        zone_text = f" restricted zone {zone}" if _present(zone) else " a restricted zone"
        opening = f"Unauthorized entry into{zone_text} was detected in {place}."
        return f"{opening} {closing}"

    if event_type == "loitering":
        dwell = _detail_value(detail, "dwell_seconds", "duration_seconds", "dwell_s")
        threshold = _detail_value(
            detail,
            "dwell_threshold_seconds",
            "dwell_threshold",
            "configured_dwell_seconds",
        )
        if dwell is not None and threshold is not None:
            opening = (
                f"A person remained in the monitored area at {place} for {dwell} seconds, "
                f"exceeding the configured dwell threshold of {threshold} seconds."
            )
        elif dwell is not None:
            opening = (
                f"A person remained in the monitored area at {place} beyond the configured "
                f"dwell threshold, with a recorded dwell time of {dwell} seconds."
            )
        else:
            opening = (
                f"A person remained in the monitored area at {place} beyond the configured "
                "dwell threshold."
            )
        return f"{opening} {closing}"

    if event_type == "fall":
        return f"A person was detected falling in {place}. {closing}"

    if event_type == "fight":
        return f"A potential physical altercation was detected in {place}. {closing}"

    if event_type in {"fire_smoke", "fire", "smoke"}:
        condition = _detail_value(
            detail,
            "condition",
            "detected_condition",
            "class_name",
            "label",
            "type",
        )
        if not _present(condition):
            condition = "fire or smoke" if event_type == "fire_smoke" else event_type
        return f"{str(condition).replace('_', ' ').capitalize()} was detected in {place}. {closing}"

    if event_type in {"ppe", "ppe_violation", "ppe violation"}:
        violation = _detail_value(
            detail,
            "violation",
            "missing_ppe",
            "missing_item",
            "ppe_item",
            "item",
        )
        if isinstance(violation, list):
            violation = ", ".join(str(item) for item in violation)
        if _present(violation):
            opening = f"A PPE violation involving {violation} was detected in {place}."
        else:
            opening = f"A PPE violation was detected in {place}."
        return f"{opening} {closing}"

    event_label = str(record.event_type).replace("_", " ").strip()
    measured_detail = _detail_value(
        detail,
        "observed_value",
        "count",
        "duration_seconds",
        "dwell_seconds",
    )
    if measured_detail is not None:
        opening = (
            f"{event_label.capitalize()} was detected in {place}, with a recorded value of "
            f"{measured_detail}."
        )
    else:
        opening = f"{event_label.capitalize()} was detected in {place}."
    return f"{opening} {closing}"


def build_payload(record: IncidentRecord) -> dict:
    detail = dict(record.detail or {})
    facts = {
        "incident_id": record.incident_id,
        "camera_id": record.camera_id,
        "camera_location": record.location,
        "event_type": record.event_type,
        "timestamp": record.detected_at.isoformat(),
        "confidence_tier": record.confidence_tier,
        "confidence_score": record.confidence_score,
        "confidence_percent": _confidence_percent(record.confidence_score),
        "severity": record.severity,
        "zone_id": record.zone_id,
        "detail": detail,
        "detected_object_count": len(record.detected_objects),
        "canonical_summary": canonical_summary(record),
    }

    return {
        "model": os.getenv("LLM_MODEL", "gpt-4o-mini"),
        "response_format": {"type": "json_object"},
        "max_completion_tokens": 250,
        "reasoning_effort": "low",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    "Write the dashboard summary JSON from these immutable facts. "
                    "Do not echo anything except the JSON object.\n"
                    + json.dumps(facts, ensure_ascii=False, indent=2)
                ),
            },
        ],
    }


def _extract_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _normalize_summary(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    text = re.sub(r"\s+", " ", value).strip()
    text = re.sub(r"^[\-*•]+\s*", "", text)
    if not text:
        return ""

    sentences = re.split(r"(?<=[.!?])\s+", text)
    text = " ".join(sentence for sentence in sentences[:2] if sentence).strip()
    return text


def _summary_preserves_required_facts(summary: str, record: IncidentRecord) -> bool:
    """Reject model text that drops or changes essential pipeline facts."""

    lowered = summary.lower()
    required_tokens = [
        _confidence_percent(record.confidence_score).lower(),
        str(record.severity).lower(),
    ]

    if _present(record.location):
        required_tokens.append(str(record.location).lower())

    detail = dict(record.detail or {})
    event_type = str(record.event_type).lower().replace("-", "_")
    if event_type == "crowd":
        count = _detail_value(detail, "observed_count", "count", "person_count")
        threshold = _detail_value(
            detail,
            "threshold",
            "configured_threshold",
            "person_count_threshold",
        )
        if count is not None:
            required_tokens.append(str(count).lower())
        if threshold is not None:
            required_tokens.append(str(threshold).lower())

    return all(token in lowered for token in required_tokens)


def summarize_incident(record: IncidentRecord) -> IncidentAnalysis:
    fallback = canonical_summary(record)
    api_key = os.getenv("LLM_API_KEY")
    if not api_key:
        raise RuntimeError("LLM_API_KEY is not configured.")

    base_url = os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    payload = json.dumps(build_payload(record), ensure_ascii=False).encode("utf-8")

    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "industrial-safety-ai/1.0",
            "Authorization": f"Bearer {api_key}",
        },
    )

    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(request, timeout=60) as response:
        result = json.loads(response.read().decode("utf-8"))

    content = result["choices"][0]["message"].get("content") or ""
    try:
        raw = json.loads(_extract_json(content))
    except (json.JSONDecodeError, TypeError):
        raw = {}

    proposed = _normalize_summary(raw.get("summary") if isinstance(raw, dict) else None)
    summary = (
        proposed
        if proposed and _summary_preserves_required_facts(proposed, record)
        else fallback
    )

    return IncidentAnalysis(
        incident_id=record.incident_id,
        camera_id=record.camera_id,
        camera_location=record.location,
        summary=summary,
    )


def summary_output(record: IncidentRecord, analysis: IncidentAnalysis) -> dict:
    return {
        "incident_id": record.incident_id,
        "camera_id": record.camera_id,
        "camera_location": record.location,
        "llm_analysis": analysis.model_dump(mode="json"),
    }


def upsert_summary(output: dict, path: Path | None = None) -> None:
    """Atomically keep one summary row per incident ID."""

    target = path or Path("output/llm_summaries.jsonl")
    target.parent.mkdir(parents=True, exist_ok=True)

    rows: list[dict] = []
    if target.exists():
        for line in target.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("incident_id") != output.get("incident_id"):
                rows.append(row)

    rows.append(output)
    temporary = target.with_suffix(target.suffix + ".tmp")
    temporary.write_text(
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
        encoding="utf-8",
    )
    temporary.replace(target)


def latest_record() -> IncidentRecord:
    path = Path("output/incidents.jsonl")
    records = [
        line
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not records:
        raise RuntimeError("No incident records found.")
    return IncidentRecord.model_validate_json(records[-1])


if __name__ == "__main__":
    incident = latest_record()
    if "--dry-run" in sys.argv:
        print(json.dumps(build_payload(incident), ensure_ascii=False, indent=2))
    else:
        print(summarize_incident(incident).model_dump_json(indent=2))
