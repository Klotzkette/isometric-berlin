"""Refresh derived hashes only after proving every prior geometry field exact."""

from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
from pathlib import Path

from scripts.build_alexander_public_realm import build_source as alexander_source
from scripts.build_drawn_water_boundary import build_payload as water_boundary
from scripts.build_hbf_north_approach import terrain_complement
from scripts.build_james_simon_terrain import build_payload as james_boundary
from scripts.build_schloss_east_navigation import build as east_navigation

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
CORE = ROOT / "src/app/public/mesh/regierungsviertel"


def encode(value: object) -> bytes:
  return (json.dumps(value, separators=(",", ":")) + "\n").encode()


def digest(value: object) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def sha(value: bytes) -> str:
  return hashlib.sha256(value).hexdigest()


def main() -> None:
  ground_bytes = (CORE / "ground-context.json").read_bytes()
  ground = json.loads(ground_bytes)
  pending: list[tuple[Path, bytes]] = []
  audit = []

  def verified(path: Path, result: dict, metadata: set[str]) -> bytes:
    before = json.loads(path.read_bytes())
    retained = {k: v for k, v in before.items() if k not in metadata}
    assert retained == {k: v for k, v in result.items() if k not in metadata}, path
    assert before.keys() == result.keys(), path
    content = encode(result)
    pending.append((path, content))
    audit.append(
      {
        "file": str(path.relative_to(ROOT)),
        "metadataKeys": sorted(metadata),
        "unchangedGeometrySha256": digest(retained),
        "metadataBefore": {k: before[k] for k in sorted(metadata)},
        "metadataAfter": {k: result[k] for k in sorted(metadata)},
      }
    )
    return content

  with tempfile.TemporaryDirectory(prefix="v182-water-provenance-") as folder:
    source_path = Path(folder) / "water.json"
    subprocess.run(
      ["bun", "scripts/prepare-water-boundary-source.ts", str(source_path)],
      cwd=ROOT / "src/app",
      check=True,
    )
    water = water_boundary(
      ground, json.loads(source_path.read_bytes()), sha(ground_bytes)
    )
  water_bytes = verified(DATA / "drawnWaterBoundary.json", water, {"ground_sha256"})
  james_bytes = (ROOT / "src/app/src/jamesSimonSource.json").read_bytes()
  verified(
    DATA / "jamesSimonTerrainBoundary.json",
    james_boundary(
      ground,
      json.loads(james_bytes),
      water,
      sha(james_bytes),
      sha(ground_bytes),
      sha(water_bytes),
    ),
    {"ground_sha256", "water_boundary_sha256"},
  )
  rail_bytes = (DATA / "hbfNorthApproachSources.json").read_bytes()
  verified(
    DATA / "hbfNorthRailTerrainBoundary.json",
    terrain_complement(
      ground,
      json.loads(rail_bytes),
      sha(ground_bytes),
      sha(rail_bytes),
    ),
    {"ground_sha256"},
  )
  verified(
    DATA / "schlossEastNavigation.json", east_navigation(ROOT), {"source_sha256"}
  )
  verified(
    ROOT / "src/app/src/alexanderPublicRealmSource.json",
    alexander_source(ROOT),
    {"existing_tree_sha256", "native_tree_sha256"},
  )
  gendarmenmarkt_path = ROOT / "src/app/src/gendarmenmarktPerimeterSource.json"
  gendarmenmarkt = json.loads(gendarmenmarkt_path.read_bytes())
  prisms_bytes = (CORE / "lod2-prisms.json").read_bytes()
  prisms = {p["id"]: p for p in json.loads(prisms_bytes)["buildings"]}
  for building in gendarmenmarkt["buildings"]:
    for previous in building["previousDisplayPrisms"]:
      assert previous == prisms[previous["id"]]
  gendarmenmarkt["previousPrismSha256"] = sha(prisms_bytes)
  verified(gendarmenmarkt_path, gendarmenmarkt, {"previousPrismSha256"})

  # The historical flat-height assertions still apply outside the specifically
  # measured park placement. Keep reversible local receipts instead of widening
  # their height bands or allowing arbitrary geometry changes.
  placement = []
  for filename, field in [
    ("ground-context.json", "ground_height"),
    ("minecraft-voxels.json", "tree_rows"),
    ("park-details.json", None),
  ]:
    path = CORE / filename
    original = subprocess.check_output(
      ["git", "show", f"v1.0.81:{path.relative_to(ROOT)}"],
      cwd=ROOT,
    )
    previous, current = json.loads(original), json.loads(path.read_bytes())
    if field:
      previous, current = previous[field], current[field]
    changes = []

    def compare(
      a: object, b: object, location: list, coordinates: bool = False
    ) -> None:
      if a == b:
        return
      if isinstance(a, dict):
        assert isinstance(b, dict) and a.keys() == b.keys()
        for key in a:
          compare(
            a[key],
            b[key],
            [*location, key],
            key
            in {
              "position",
              "points",
              "outline",
              "rings",
              "ring",
              "anchor",
            },
          )
      elif isinstance(a, list):
        assert isinstance(b, list) and len(a) == len(b)
        is_point = (
          coordinates and len(a) == 3 and all(isinstance(n, (int, float)) for n in a)
        )
        for index, (old, new) in enumerate(zip(a, b, strict=True)):
          if old == new:
            continue
          permitted = (
            (field == "ground_height" and location == ["y_dm"])
            or (field == "tree_rows" and len(location) == 2 and index == 1)
            or (field is None and is_point and index == 1)
          )
          if permitted:
            assert isinstance(old, (int, float)) and isinstance(new, (int, float))
            changes.append([[*location, index], old, new])
          else:
            compare(old, new, [*location, index], coordinates)
      else:
        raise AssertionError(f"Non-altitude change: {filename} {location}")

    compare(previous, current, [])
    placement.append(
      {
        "file": str(path.relative_to(ROOT)),
        "field": field,
        "baseline": "v1.0.81",
        "sourceFileSha256": sha(original),
        "beforeJsonSha256": digest(previous),
        "afterJsonSha256": digest(current),
        "changes": changes,
      }
    )

  for path, content in pending:
    path.write_bytes(content)
  (ROOT / "geo_data/regierungsviertel/derived-provenance-v182.json").write_bytes(
    encode(
      {
        "scope": "Only dependency hashes refreshed; all geometry values remain identical.",
        "tables": audit,
        "altitudeReceipts": placement,
      }
    )
  )
  print(
    f"Verified {len(audit)} unchanged geometry payloads; refreshed dependency hashes."
  )
  print({entry["file"]: len(entry["changes"]) for entry in placement})


if __name__ == "__main__":
  main()
