"""Step 10: retain exact museum/Ruska source owners for v265 facade corrections."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("src/app/public/mesh/regierungsviertel/lod2-prisms.json")
DEST = ROOT / "src/app/src/data/chariteCampusV265.json"
MUSEUM = "WCl6Bw6x z6MeXghE kE14CQ1A JPKNLMoR GvVmBh7X 8iaMbUbh L1huVZLC 6tNuQDav NhasaEcN gwXjAt32 KfoCv8uc S8FCLrDr nbLoon0z ipiWvMxH wPdkkr3q a1867w53 g4TL0DRA KOCFirSU ypVJ6uiG FYv2Tjwz".split()
RUSKA = "nPSZAX1V bzFr0aOE mEGhfy5X XJYVhYs0 qMBTtfSO M09vcMVr".split()
ALTHOFF = "f4N7OZJI t76KCSEh KztaII44 50yMshCk YxDLPnmj a8CyAsQj".split()


def build() -> dict:
  """Copy complete original parts; never replace or repair source rings."""
  raw = (ROOT / SOURCE).read_bytes()
  ids = set(MUSEUM + RUSKA + ALTHOFF)
  parts = [p for p in json.loads(raw)["buildings"] if p["id"] in ids]
  assert len(parts) == 32
  return {
    "source": str(SOURCE),
    "sourceSha256": hashlib.sha256(raw).hexdigest(),
    "parts": parts,
    "museumFront": {"id": "gwXjAt32", "edges": [14, 16], "bays": [4, 3]},
    "museumVitrineHeightM": 6,
    "dimensionPolicy": "Complete retained LoD2 plans/heights/holes/roofs unchanged. "
    "Facade subdivision, bronze canopy depth, colours and small fittings are "
    "photo-based display estimates; museum vitrine height is architect-published.",
  }


if __name__ == "__main__":
  DEST.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
