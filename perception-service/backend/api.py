import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI, HTTPException

app = FastAPI(title="Industrial Safety Incident API")
DB_PATH = Path(__file__).resolve().parent / "incidents.json"

def load_data(): return json.loads(DB_PATH.read_text(encoding="utf-8")) if DB_PATH.exists() else {}
def save_data(data): DB_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")
def health(): return {"status": "ok"}
def list_incidents(): return {"incidents": list(load_data().values())}
def require_id(payload): return payload.get("incident_id") or (_ for _ in ()).throw(HTTPException(status_code=400, detail="incident_id is required"))
def save_new(items, incident_id, payload): return (payload.setdefault("received_at", datetime.now(timezone.utc).isoformat()), items.__setitem__(incident_id, payload), save_data(items), {"stored": True, "duplicate": False, "incident_id": incident_id})[-1]
def create_incident(payload: dict[str, Any] = Body(...)): return {"stored": False, "duplicate": True, "incident_id": incident_id} if (incident_id := require_id(payload)) in (items := load_data()) else save_new(items, incident_id, payload)
def update_existing(items, incident_id, updates): return (items[incident_id].setdefault("evidence", {}).update(updates), save_data(items), {"updated": True, "incident_id": incident_id})[-1]
def update_evidence(incident_id: str, updates: dict[str, Any] = Body(...)): return update_existing(items, incident_id, updates) if incident_id in (items := load_data()) else (_ for _ in ()).throw(HTTPException(status_code=404, detail="Incident not found"))


def update_analysis(incident_id: str, updates: dict[str, Any] = Body(...)):
    items = load_data()
    if incident_id not in items:
        raise HTTPException(status_code=404, detail="Incident not found")

    analysis = updates.get("llm_analysis", updates)
    items[incident_id]["llm_analysis"] = analysis
    save_data(items)

    return {
        "updated": True,
        "incident_id": incident_id,
        "llm_analysis": analysis,
    }

app.add_api_route("/health", health, methods=["GET"])
app.add_api_route("/api/incidents", list_incidents, methods=["GET"])
app.add_api_route("/api/incidents", create_incident, methods=["POST"])
app.add_api_route("/api/incidents/{incident_id}/evidence", update_evidence, methods=["PATCH"])
app.add_api_route("/api/incidents/{incident_id}/analysis", update_analysis, methods=["PATCH"])
