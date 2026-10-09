"""Step 10: stage exact ICC proxy replacement without touching other city owners."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
from pathlib import Path

import geopandas as gpd
from build_karl_marx_allee_v161 import mesh_signature
from build_surrounding_outlines import chunk_payload, load_projected_polygon, world
from integrate_airports_v194 import signature_sha
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely.geometry import Polygon, box, mapping

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "icc-v199-source.json.gz"
NAV = ROOT / "src/app/src/data/iccV199Navigation.json"
STAGE = GEO / "raw/icc-v199/packets"
RECEIPT = GEO / "icc-v199-packet-audit.json"
CHECKPOINT = GEO / "icc-v199-packet-checkpoint.json.gz"
TARGETS = (
  ("ring182--13_2", "ring-v182", "DEBE04YY500001II"),
  ("outer187--13_3", "outskirts-v187", "DEBE04YY500004dG"),
)


def encode(value: object) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def verify_replacement() -> dict:
  """Fail closed unless complete measured source and every part's nav are present."""
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  expected = {"DEBE04YY500001II": 44, "DEBE04YY500004dG": 1, "DEBE04YY500006BE": 4}
  assert {p["id"]: len(p["parts"]) for p in source["owners"]} == expected
  navigation = json.loads(NAV.read_bytes())["buildings"]
  bridge_part = "DEBE3DnZRDDQCO1P"
  assert len(navigation) == 50
  assert len({p["id"] for p in navigation}) == 50
  assert {p["owner"] for p in navigation} == set(expected)
  for owner in source["owners"]:
    part_ids = {p["id"] for p in owner["parts"]}
    extension = {bridge_part + ":skyway"} if bridge_part in part_ids else set()
    assert part_ids | extension == {
      p["id"] for p in navigation if p["owner"] == owner["id"]
    }
    assert all(p["surfaces"] for p in owner["parts"])
    dy = 3.55 - min(p["ground_y_m"] for p in owner["parts"])
    for part in owner["parts"]:
      row = next(p for p in navigation if p["id"] == part["id"])
      source_shape = Polygon(part["ring"], part["holes"])
      nav_shape = Polygon(row["ring"], row["holes"])
      assert row["groundY"] == round(part["ground_y_m"] + dy, 3)
      assert row["topY"] == round(part["top_y_m"] + dy, 3)
      if part["id"] == bridge_part:
        skyway = next(p for p in navigation if p["id"] == bridge_part + ":skyway")
        assert (skyway["groundY"], skyway["topY"]) == (8.5, 19.895)
        bridge = Polygon(skyway["ring"], skyway["holes"])
        start = part["ring"].index([-6254.006, 1465.44])
        end = part["ring"].index([-6244.204, 1442.095])
        exact_arm = Polygon(part["ring"][start : end + 1])
        assert bridge.symmetric_difference(exact_arm).area < 1e-7
        assert bridge.intersection(nav_shape).area < 1e-7
        nav_shape = nav_shape.union(bridge)
      assert nav_shape.symmetric_difference(source_shape).area < 1e-7
  return source


def stage() -> dict:
  """Prepare four audited packets; Root merges their descriptors after integration."""
  source = verify_replacement()
  manifest = json.loads((PUBLIC / "manifest.json").read_bytes())
  scopes = {
    "ring-v182": world(
      load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(
        load_projected_polygon(GEO / "bounds.geojson")
      )
    ),
    "outskirts-v187": world(
      load_projected_polygon(GEO / "bounds-outskirts-v187.geojson").difference(
        load_projected_polygon(GEO / "bounds-retained-v186.geojson")
      )
    ),
  }
  checkpoints, replacements, reports, sources = [], [], [], []
  baseline = {}
  if CHECKPOINT.exists():
    baseline = {
      (r["id"], r["mode"]): r
      for r in json.loads(gzip.decompress(CHECKPOINT.read_bytes()))
    }
  STAGE.mkdir(parents=True, exist_ok=True)
  for identity, family, owner in TARGETS:
    descriptor = copy.deepcopy(
      next(c for c in manifest["chunks"] if c["id"] == identity)
    )
    assert not any(c.get("detailCompanionOf") == identity for c in manifest["chunks"])
    records = gpd.read_file(
      GEO / f"raw/{family}/resolved-outlines.gpkg",
      layer="buildings",
      where=f"sourceId = '{owner}'",
    ).to_dict("records")
    assert len(records) == 1
    sources.extend(
      {
        "family": family,
        **{k: v for k, v in r.items() if k != "geometry"},
        "geometry": mapping(r["geometry"]),
      }
      for r in records
    )
    tile = box(*descriptor["bounds"])
    report = {"id": identity, "owner": owner, "modes": {}}
    for mode in ("drawn", "minecraft"):
      prior = baseline.get((identity, mode))
      old_descriptor = prior["descriptor"] if prior else descriptor[mode]
      raw = (
        base64.b64decode(prior["gzipBase64"])
        if prior
        else (PUBLIC / old_descriptor["url"]).read_bytes()
      )
      assert hashlib.sha256(raw).hexdigest() == old_descriptor["sha256"]
      before = json.loads(gzip.decompress(raw))
      checkpoints.append(
        {
          "id": identity,
          "mode": mode,
          "descriptor": old_descriptor,
          "gzipBase64": base64.b64encode(raw).decode(),
        }
      )
      args = (identity, tile, scopes[family].intersection(tile))
      selected = chunk_payload(*args, records, {}, minecraft=mode == "minecraft")
      empty = chunk_payload(*args, [], {}, minecraft=mode == "minecraft")
      remove = mesh_signature(selected) - mesh_signature(empty)
      previous = mesh_signature(before)
      assert remove and not remove - previous, (identity, mode, "owner mismatch")
      after = copy.deepcopy(before)
      after["meshes"] = subtract_meshes(after["meshes"], remove.copy())
      ink = (
        line_signature(selected.get("lines", {}))
        - line_signature(empty.get("lines", {}))
        if mode == "drawn"
        else None
      )
      if ink:
        assert not ink - line_signature(before["lines"])
        after["lines"] = subtract_lines(after["lines"], ink.copy())
      removed_nav = [b for b in before["nav"]["buildings"] if b["sourceId"] == owner]
      after["nav"]["buildings"] = [
        b for b in before["nav"]["buildings"] if b["sourceId"] != owner
      ]
      assert removed_nav
      if mode == "drawn":
        replacement_count = len({b["sourceId"] for b in after["nav"]["buildings"]})
      assert {k: v for k, v in after["nav"].items() if k != "buildings"} == {
        k: v for k, v in before["nav"].items() if k != "buildings"
      }
      assert mesh_signature(after) == previous - remove
      if mode == "drawn":
        assert line_signature(after["lines"]) == line_signature(before["lines"]) - ink
      plain = encode(after)
      packed = gzip.compress(plain, mtime=0, compresslevel=9)
      (STAGE / old_descriptor["url"]).write_bytes(packed)
      descriptor[mode] = {
        **old_descriptor,
        "bytes": len(packed),
        "decodedBytes": len(plain),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      report["modes"][mode] = {
        "oldDescriptor": old_descriptor,
        "newDescriptor": descriptor[mode],
        "removedTriangles": sum(remove.values()),
        "removedTriangleSha256": signature_sha(remove),
        "preservedTriangles": sum((previous - remove).values()),
        "preservedTriangleSha256": signature_sha(previous - remove),
        "removedInkSegments": sum(ink.values()) if ink else 0,
        "removedNav": removed_nav,
      }
    descriptor["buildingCount"] = replacement_count
    replacements.append(descriptor)
    reports.append(report)
  checkpoint_plain = encode(checkpoints)
  checkpoint = gzip.compress(checkpoint_plain, mtime=0, compresslevel=9)
  CHECKPOINT.write_bytes(checkpoint)
  result = {
    "version": "1.0.99",
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "ownerIds": [x[2] for x in TARGETS],
    "completeReplacementOwners": [o["id"] for o in source["owners"]],
    "sourceRecords": sources,
    "checkpoint": {
      "url": CHECKPOINT.name,
      "sha256": hashlib.sha256(checkpoint).hexdigest(),
      "bytes": len(checkpoint),
      "decodedBytes": len(checkpoint_plain),
    },
    "stagePath": str(STAGE.relative_to(ROOT)),
    "descriptors": replacements,
    "chunks": reports,
    "unrelatedGeometryPreserved": True,
    "policy": "Only independently replayed exact ICC parent proxies and their roof ink are subtracted. Source inventories, all other triangle/colour multisets, ground/water/road/bridge nav and outer cartographic hairlines remain unchanged. ICCV199 draws all 49 retained leaf parts; iccV199Navigation supplies complete part navigation. Staged packets require Root descriptor merge; this script writes no public packet or manifest.",
  }
  RECEIPT.write_text(json.dumps(result, indent=2) + "\n")
  return result


if __name__ == "__main__":
  report = stage()
  print(
    [
      (
        c["id"],
        {mode: c["modes"][mode]["removedTriangles"] for mode in ("drawn", "minecraft")},
      )
      for c in report["chunks"]
    ]
  )
