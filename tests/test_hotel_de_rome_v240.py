"""Hotel-only source and exact obsolete-decoration correction receipts."""

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from hotel_de_rome_v240_receipt import prior_hotel_display  # noqa: E402

E = json.loads(
  (ROOT / "geo_data/regierungsviertel/hotel-de-rome-v240-evidence.json").read_text()
)


def test_source_files_remain_exact_and_previous_recipe_is_recoverable() -> None:
  for path, digest in E["preservedFiles"].items():
    assert hashlib.sha256((ROOT / path).read_bytes()).hexdigest() == digest
  path = "src/app/src/BebelplatzFacades.ts"
  old = prior_hotel_display(path, (ROOT / path).read_bytes())
  assert hashlib.sha256(old).hexdigest() == E["oldFacadeSha256"]
  assert "11.7," in E["oldFunction"] and "24.25," in E["oldFunction"]


def test_complete_measured_hotel_remains_authoritative() -> None:
  s = json.loads((ROOT / "src/app/src/bebelplatzBuildingSource.json").read_text())
  hotel = s["profiles"]["hotelDeRome"]
  assert hotel["parent_id"] == E["sourceParent"]
  assert len(hotel["parts"]) == E["sourceParts"] == 10
  assert sum(len(p["surfaces"]) for p in hotel["parts"]) == E["sourceSurfaces"] == 103
  assert max(p["top_y_m"] for p in hotel["parts"]) == 34.166
  assert all(p["ground_y_m"] == 3.821 for p in hotel["parts"])
  assert E["visualReferences"][0]["license"] == "CC-BY-SA-4.0"
