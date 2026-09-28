import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from schemas.incident_schema import IncidentRecord

path = ROOT / "output" / "incidents.jsonl"

if not path.exists():
    raise SystemExit(f"File not found: {path}")

validated = 0
errors = 0

for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
    if not line.strip():
        continue
    try:
        IncidentRecord.model_validate_json(line)
        validated += 1
    except Exception as exc:
        errors += 1
        print(f"Line {line_number}: {exc}")

print(f"validated={validated}")
print(f"errors={errors}")
raise SystemExit(1 if errors else 0)
