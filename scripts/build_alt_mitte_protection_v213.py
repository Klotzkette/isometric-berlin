"""Step 10: collect exact later authored owners, never district-wide owners.

The v186 exclusions already protect the earlier bounded accents. Each additional
file below is a dedicated authored building/site product, not a city catalogue.
This is an offline guard for the v213 appearance compiler, not runtime geometry.
"""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "geo_data/regierungsviertel/alt-mitte-appearance-v213-protected.json"
FILES = (
  "geo_data/regierungsviertel/schools-v185-evidence.json",
  "geo_data/regierungsviertel/public-places-v185-evidence.json",
  "geo_data/regierungsviertel/scheunen-facades-v183-evidence.json",
  "src/app/src/data/northV185.json",
  "src/app/src/data/bndHeadquartersV174Navigation.json",
  "src/app/src/data/zionskircheV174Evidence.json",
  "src/app/src/data/berlinWallMemorialV174Navigation.json",
  "src/app/src/data/zionskirchplatzV175Evidence.json",
  "src/app/src/data/cityRecognitionV182.json",
  "src/app/src/data/alexanderStationsV183Source.json",
  "src/app/src/data/volksbuehneV189.json",
  "src/app/src/data/alexanderplatzV189.json",
  "src/app/src/data/suhrkampPfefferbergV189.json",
  "src/app/src/data/zionskirchplatzV193.json",
  "src/app/src/data/lindenCorridorV197.json",
  "src/app/src/data/centralSitesV200.json",
  "src/app/src/data/librariesV202.json",
  "src/app/src/data/bendlerblockV202Evidence.json",
  "src/app/src/data/schoolsPlacesV205.json",
  "src/app/src/data/chariteBettenhausV207.json",
  "src/app/src/data/ministrySpreeV207.json",
  "src/app/src/data/embassiesV208.json",
  "src/app/src/data/northCorridorV208.json",
  "src/app/src/data/labourQuartierV208.json",
  "src/app/src/data/kiezFacadesV209.json",
)
TRANSFERRED = {
  "DEBE00YY1TF0003o",
  "DEBE01YYK00001Xy",
  "DEBE01YYK00002iS",
  "DEBE01YYK00003SW",
  "DEBE01YYK00001QK",
}
IDENTITY = re.compile(
  r"(?:DEBE[A-Za-z0-9]+|OSM-(?:way|relation)-\d+|(?:way|relation)/\d+)\Z"
)


def named_ids(value: Any) -> set[str]:
  """Read only unmistakable source IDs in bounded authored products."""
  if isinstance(value, str):
    return {value} if IDENTITY.fullmatch(value) else set()
  if isinstance(value, dict):
    return set().union(*(named_ids(v) for v in value.values()))
  if isinstance(value, list):
    return set().union(*(named_ids(v) for v in value))
  return set()


def aliases(identities: set[str]) -> set[str]:
  """Keep established last-eight LoD2 and signed legacy OSM aliases."""
  result = set(identities)
  for identity in identities:
    if identity.startswith("DEBE"):
      result.add(identity[-8:])
    elif match := re.fullmatch(
      r"(?:OSM-(way|relation)-|(way|relation)/)(\d+)", identity
    ):
      kind, number = match[1] or match[2], match[3]
      result.update({f"OSM-{kind}-{number}", f"{kind}/{number}"})
      result.add(number if kind == "way" else f"-{number}")
  return result


def build() -> dict[str, Any]:
  """Freeze exact input receipts and the small, reproducible protection union."""
  identities = set(TRANSFERRED)
  evidence = []
  for filename in FILES:
    raw = (ROOT / filename).read_bytes()
    payload = json.loads(raw)
    found = named_ids(payload)
    # This dedicated facade uses exact eight-character retained core prism IDs.
    # They are positive ownership declarations, not arbitrary short strings.
    if filename.endswith("chariteBettenhausV207.json"):
      found.update(payload["sourceIds"])
    identities.update(found)
    evidence.append(
      {
        "file": filename,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "ids": sorted(found),
      }
    )
  return {
    "schemaVersion": 1,
    "policy": "Preserve later dedicated/authored appearances and the prior v186 bounded accents. These are exact owner IDs, never all-source or district navigation inventories. Match source family, parts, outer owners and legacy prisms; aliases do not establish spatial ownership.",
    "ids": sorted(aliases(identities)),
    "exactV186Transferred": sorted(TRANSFERRED),
    "evidence": evidence,
  }


if __name__ == "__main__":
  result = build()
  OUTPUT.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  print(
    f"Protected {len(result['ids'])} exact identities/aliases from {len(result['evidence'])} bounded authored products."
  )
