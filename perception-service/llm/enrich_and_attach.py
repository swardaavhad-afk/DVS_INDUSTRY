import json
import os
import urllib.request
from pathlib import Path

from llm.summarizer import latest_record, summarize_incident

record = latest_record()
analysis = summarize_incident(record)

output = {
    "incident_id": record.incident_id,
    "camera_id": record.camera_id,
    "camera_location": record.location,
    "llm_analysis": analysis.model_dump(mode="json"),
}

summary_path = Path("output/llm_summaries.jsonl")
summary_path.parent.mkdir(parents=True, exist_ok=True)

existing = (
    summary_path.read_text(encoding="utf-8")
    if summary_path.exists()
    else ""
)

summary_path.write_text(
    existing + json.dumps(output, ensure_ascii=False) + "\n",
    encoding="utf-8",
)

backend_url = os.getenv(
    "BACKEND_URL",
    "http://127.0.0.1:8000",
)

url = (
    f"{backend_url.rstrip('/')}"
    f"/api/incidents/{record.incident_id}/analysis"
)

body = json.dumps({
    "llm_analysis": output["llm_analysis"]
}).encode("utf-8")

request = urllib.request.Request(
    url,
    data=body,
    method="PATCH",
    headers={
        "Content-Type": "application/json",
        "Accept": "application/json",
    },
)

opener = urllib.request.build_opener(
    urllib.request.ProxyHandler({})
)

response = opener.open(request, timeout=15)
backend_result = json.loads(
    response.read().decode("utf-8")
)
response.close()

print(json.dumps({
    "summary_saved": True,
    "backend_result": backend_result,
}, ensure_ascii=False, indent=2))
