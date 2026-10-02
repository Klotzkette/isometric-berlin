"""Bounded source preservation and independently decoded v167 corridor packets."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pytest
from shapely.geometry import Point, Polygon, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from build_oranien_corridors_v167 import (  # noqa: E402
  EXPLICIT_RESERVED,
  KIND,
  SOURCE,
  footprint,
  scoped_bounds,
  station_detail,
)

DATA = json.loads(SOURCE.read_text())
CANDIDATE = Path("/tmp/v167-corridor-packets")


def digest(value: object) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def triangle_keys(meshes: list[dict]) -> Counter:
  result = Counter()
  for mesh in meshes:
    p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    rows = np.concatenate((p, c.astype("<u2")), axis=1)
    result.update(
      b"".join(sorted(bytes(row) for row in rows[index])) for index in indices
    )
  return result


def test_scope_identity_and_prior_frontages_remain_exact() -> None:
  bounds, _ = scoped_bounds()
  assert {r["name"] for r in DATA["roads"]} == {
    "Oranienstraße",
    "Oranienburger Straße",
    "Mariannenstraße",
    "Mariannenplatz",
    "Skalitzer Straße",
  }
  for road in DATA["roads"]:
    geometry = shape(road["geometry"])
    assert bounds.buffer(0.001).covers(geometry)
    if road["name"] == "Mariannenstraße":
      assert geometry.bounds[3] <= 2160
    if road["name"] == "Skalitzer Straße":
      assert geometry.bounds[0] >= 3660 and geometry.bounds[2] <= 3890
  old = json.loads(
    (ROOT / "geo_data/regierungsviertel/mitte-streets-v166.json").read_text()
  )
  old_core = {p["id"]: p for p in old["corePrisms"]}
  assert len(DATA["retainedDetailedCorePrisms"]) > 100
  for record in DATA["retainedDetailedCorePrisms"]:
    assert record == old_core[record["id"]]
    assert record["id"] not in EXPLICIT_RESERVED
  owners = {b["id"] for b in DATA["buildings"]}
  assert not owners.intersection(DATA["excludedDetailedOwners"])
  assert not owners.intersection(b["id"] for b in old["buildings"])
  assert {"DEBE02YY400000xk", "DEBE02YY4000000T"} <= owners
  jenseits = next(p for p in DATA["pois"] if p["id"] == "node/2464442845")
  assert jenseits["tags"]["check_date"] == "2025-01-20"
  assert shape(jenseits["geometry"]).distance(Point(3453.3227, 2113.9976)) < 0.001
  assert DATA["extraMovedOuterSourceIds"] == ["OSM-way-311559051"]


def test_complete_lod2_source_parts_and_sheets_match_original_archives() -> None:
  ns = {
    "b": "http://www.opengis.net/citygml/building/1.0",
    "g": "http://www.opengis.net/gml",
  }
  remaining = {b["id"]: b for b in DATA["buildings"]}
  assert len(remaining) > 250
  for archive in DATA["sourceArchives"]:
    path = (
      ROOT / "geo_data/regierungsviertel/raw/lod2" / archive["url"].rsplit("/", 1)[1]
    )
    if not path.exists():
      pytest.skip("Optional ignored official archives are unavailable")
    assert hashlib.sha256(path.read_bytes()).hexdigest() == archive["sha256"]
    with zipfile.ZipFile(path) as raw:
      tree = ET.fromstring(raw.read(raw.namelist()[0]))
    for parent in tree.findall(".//b:Building", ns):
      identity = parent.get("{" + ns["g"] + "}id")
      if identity not in remaining:
        continue
      stored = remaining.pop(identity)
      ground = min(
        float(v)
        for e in parent.findall(".//b:GroundSurface//g:posList", ns)
        for v in e.text.split()[2::3]
      )
      assert ground == stored["groundNHN"]
      parts = []
      for part in parent.findall(".//b:BuildingPart", ns) or [parent]:
        surfaces = []
        for boundary in part.findall("b:boundedBy", ns):
          for surface in boundary:
            for polygon in surface.findall(".//g:Polygon", ns):
              rings = []
              for e in polygon.findall(".//g:posList", ns):
                values = list(map(float, e.text.split()))
                ring = [
                  [
                    round(x - 389500, 3),
                    round(y - ground + 3, 3),
                    round(5820000 - z, 3),
                  ]
                  for x, z, y in zip(values[::3], values[1::3], values[2::3])
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              if rings:
                surfaces.append({"kind": surface.tag.split("}")[-1], "rings": rings})
        parts.append({"id": part.get("{" + ns["g"] + "}id"), "surfaces": surfaces})
      assert stored["parts"] == parts, identity
  assert not remaining


def test_station_has_open_ground_and_retains_full_mapped_roof_and_platforms() -> None:
  station = DATA["station"]
  detail, navigation = station_detail(station)
  assert station["roof"]["tags"]["bridge"] == "yes"
  assert station["coarseEnvelope"]["height"] == 6
  assert station["coarseEnvelope"]["minHeight"] == 0
  canopy = next(n for n in navigation if n["partId"] == "display:elevated-canopy")
  assert canopy["geometry"].equals(shape(station["roof"]["geometry"]))
  assert canopy["minHeight"] > 8
  columns = [n for n in navigation if n["minHeight"] == 0]
  assert columns and sum(n["geometry"].area for n in columns) < 5
  platforms = [n for n in navigation if n["partId"].startswith("display:platform-")]
  assert len(platforms) == 2 and all(n["minHeight"] > 5 for n in platforms)
  roof_faces = [
    t
    for t, _, role in detail.triangles
    if role == "estimated elevated canopy on OSM roof"
  ]
  cover = unary_union([Polygon([(p[0], p[2]) for p in t]) for t in roof_faces])
  assert cover.symmetric_difference(canopy["geometry"]).area < 1e-6
  assert max(p[1] for t in roof_faces for p in t) == pytest.approx(16.2)


def test_candidates_preserve_every_prior_mesh_nav_and_all_source_parts() -> None:
  audit_path = (
    ROOT / "geo_data/regierungsviertel/oranien-corridors-v167-preservation.json"
  )
  if not audit_path.exists() or not CANDIDATE.is_dir():
    pytest.skip("Authoring candidates are intentionally not bundled")
  preservation = json.loads(audit_path.read_text())
  owned = {b["id"] for b in DATA["buildings"]} | set(DATA["extraMovedOuterSourceIds"])
  found = defaultdict(set)
  for identity, modes in preservation.items():
    for mode, before in modes.items():
      raw = gzip.decompress((CANDIDATE / f"{identity}.{mode}.json.gz").read_bytes())
      packet = json.loads(raw)
      assert len(raw) < 12 * 1024 * 1024
      assert (
        digest([m for m in packet["meshes"] if m["kind"] != KIND]) == before["meshes"]
      )
      assert (
        digest(
          {
            **packet["nav"],
            "buildings": [
              b for b in packet["nav"]["buildings"] if b["sourceId"] not in owned
            ],
          }
        )
        == before["unownedNavigation"]
      )
      for nav in packet["nav"]["buildings"]:
        if nav["sourceId"] in owned:
          assert nav.get("partId"), nav["sourceId"]
          found[mode].add((nav["sourceId"], nav["partId"]))
      if mode == "minecraft":
        for mesh in packet["meshes"]:
          if mesh["kind"] != KIND:
            continue
          points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
            -1, 3
          )
          indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(
            -1, 3
          )
          triangles = points[indices]
          assert np.all(
            np.any(np.max(triangles, axis=1) == np.min(triangles, axis=1), axis=1)
          )
  for building in DATA["buildings"]:
    assert footprint(building).area > 0
    for part in building["parts"]:
      if any(s["kind"] == "GroundSurface" for s in part["surfaces"]):
        for mode in ("drawn", "minecraft"):
          assert (building["id"], part["id"]) in found[mode]


def test_tacheles_removal_is_only_existing_exact_facade_contribution() -> None:
  path = CANDIDATE / "tacheles-v166-facade-removal.json"
  if not path.exists():
    pytest.skip("Authoring removal contribution unavailable")
  removal = json.loads(path.read_text())
  assert removal["corePrismIds"] == ["19283679", "24054915", "40754304"]
  total = 0
  for chunk in removal["chunks"]:
    for mode, mesh in chunk["modes"].items():
      if mesh is None:
        continue
      raw = subprocess.check_output(
        [
          "git",
          "show",
          f"v1.0.66:src/app/public/mesh/surrounding-berlin-v159/{chunk['id']}.{mode}.json.gz",
        ],
        cwd=ROOT,
      )
      original = json.loads(gzip.decompress(raw))
      retained = triangle_keys(
        [m for m in original["meshes"] if m["kind"] == removal["sourceMeshKind"]]
      )
      exact = triangle_keys([mesh])
      assert not exact - retained
      total += sum(exact.values())
  assert total > 0
