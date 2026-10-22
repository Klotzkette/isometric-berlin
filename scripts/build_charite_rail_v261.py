"""Step 10: immutable ten-part snapshot for the railway-facing Charité facades."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
DEST = ROOT / "src/app/src/data/chariteRailV261.json"
OWNERS = {
  "DEBE01YYK00003IB": "nPSZAX1V bzFr0aOE mEGhfy5X XJYVhYs0 qMBTtfSO M09vcMVr".split(),
  "DEBE01YYK0000AME": "dPDkAuVZ 027C3yPV GoKoY7cu uxomCV1F".split(),
}


def build():
  """Preserve source order, complete rings, holes, heights and roof codes."""
  raw = (ROOT / SOURCE).read_bytes()
  parents = {part: owner for owner, ids in OWNERS.items() for part in ids}
  parts = [
    {**p, "parent": parents[p["id"]]}
    for p in json.loads(raw)["buildings"]
    if p["id"] in parents
  ]
  assert len(parts) == 10
  return {
    "source": SOURCE,
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "parts": parts,
    "status": "Exact retained source plans/heights; small photo-guided facade "
    "subdivisions are display estimates.",
  }


if __name__ == "__main__":
  DEST.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
