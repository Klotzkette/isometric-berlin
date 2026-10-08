"""Exact v193 owner substitution and water-only cascade datum correction."""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter

import geopandas as gpd
import numpy as np
from build_karl_marx_allee_v161 import mesh_signature
from build_park_relief_v182 import sample
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  ROOT,
  chunk_payload,
  load_projected_polygon,
  world,
)
from integrate_city_refinements_v166 import (
  enc,
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely.geometry import Point, box, shape

GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = ROOT / "src/app/src/data/viktoriaparkV194.json"
RECEIPT = GEO / "viktoriapark-v194-packet-audit.json"
STAGE = GEO / "raw/viktoriapark-v194/packets"
OWNER = "DEBE02YY400001Vu"
BASE = "v1.0.93"
WATER = np.array([36, 76, 86], dtype="u1")
PROFILE = json.loads((ROOT / "src/app/src/data/parkReliefV182.json").read_bytes())[
  "profiles"
][0]
SOURCE_DATA = json.loads(SOURCE.read_bytes())
BASINS = []
for f in SOURCE_DATA["features"]:
  if f["id"] in ("way/31791743", "relation/544767", "way/171168191"):
    poly = shape(f["geometry"])
    p = poly.representative_point()
    # Existing measured DGM is the only local vertical survey. Still water
    # uses one datum per original closed pond, not one datum for the cascade.
    level = round(3 + sample(PROFILE, p.x, p.y) + 0.08, 2)
    BASINS.append((poly, level, f["id"]))


def original(path):
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def water_level(x, z, native=False):
  """Ponds stay level; the watercourses follow the already rendered DGM."""
  p = Point(x, z)
  for poly, level, _ in BASINS:
    if poly.buffer(0.035).covers(p):
      return level
  # Native terraces sample precisely the same global four-metre cells as
  # parkReliefAt(..., true), never create a smooth second native hillside.
  if native:
    x, z = (math.floor(x / 4) + 0.5) * 4, (math.floor(z / 4) + 0.5) * 4
  level = 3 + sample(PROFILE, x, z) + 0.08
  # Meet each pond continuously along its original outline. The six-metre
  # transition is water only; no terrain, bank, road or path vertex changes.
  near = sorted((poly.distance(p), y) for poly, y, _ in BASINS)
  if near and near[0][0] < 6:
    distance, pond_y = near[0]
    t = distance / 6
    level = pond_y * (1 - t) + level * t
  return round(level, 2)


def decoded(mesh):
  return (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
    np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3),
  )


def signature_digest(counter: Counter) -> str:
  h = hashlib.sha256()
  for key, count in sorted(counter.items()):
    h.update(key)
    h.update(str(count).encode())
    h.update(b"\n")
  return h.hexdigest()


def water_signature(packet, xz=False):
  result = Counter()
  for mesh in packet["meshes"]:
    pos, col, ix = decoded(mesh)
    for ids in ix[np.all(col[ix] == WATER, axis=(1, 2))]:
      rows = np.column_stack([pos[ids][:, [0, 2]] if xz else pos[ids], col[ids]])
      result[b"".join(sorted(row.tobytes() for row in rows))] += 1
  return result


def coarse_owner_signatures(descriptor, native):
  rows = gpd.read_file(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    where=f"sourceId='{OWNER}'",
  ).to_dict("records")
  assert len(rows) == 1
  tile = box(*descriptor["bounds"])
  scope = world(
    load_projected_polygon(GEO / "bounds.geojson").difference(
      load_projected_polygon(GEO / "bounds-v158.geojson")
    )
  ).intersection(tile)
  full = chunk_payload("1_6", tile, scope, rows, {}, minecraft=native)
  empty = chunk_payload("1_6", tile, scope, [], {}, minecraft=native)
  for payload in (full, empty):
    for mesh in payload["meshes"]:
      pos, col, ix = decoded(mesh)
      pos = pos.copy()
      pos[:, 1] += 3347
      mesh["positions"] = enc(pos)
    if payload.get("lines"):
      pos = (
        np.frombuffer(base64.b64decode(payload["lines"]["positions"]), "<u2")
        .reshape(-1, 3)
        .copy()
      )
      pos[:, 1] += 3347
      payload["lines"]["positions"] = enc(pos)
  ink = (
    (line_signature(full["lines"]) - line_signature(empty["lines"]))
    if not native
    else Counter()
  )
  return mesh_signature(full) - mesh_signature(empty), ink


def patch_water(packet, native):
  changed = 0
  for index, mesh in enumerate(packet["meshes"]):
    pos, col, ix = decoded(mesh)
    # Split by triangles to permit distinct native terrace heights while
    # retaining every source triangle, XZ coordinate and original colour.
    new_p = []
    new_c = []
    new_i = []
    lookup = {}
    for ids in ix:
      water = bool(np.all(col[ids] == WATER))
      vertices = pos[ids].copy()
      if water:
        points = vertices.astype(float) / 100 + packet["origin"]
        centre = points.mean(axis=0)
        terrace = water_level(centre[0], centre[2], True) if native else None
        for j, p in enumerate(points):
          # Native vertical bank bottoms retain their original -1.15 datum.
          if native and p[1] < 0:
            continue
          y = terrace if native else water_level(p[0], p[2])
          vertices[j, 1] = round((y - packet["origin"][1]) * 100)
        changed += bool(np.any(vertices != pos[ids]))
      out = []
      for vertex, color in zip(vertices, col[ids], strict=True):
        key = tuple(vertex) + tuple(color)
        if key not in lookup:
          lookup[key] = len(new_p)
          new_p.append(vertex)
          new_c.append(color)
        out.append(lookup[key])
      new_i.append(out)
    packet["meshes"][index] = {
      **mesh,
      "positions": enc(np.asarray(new_p, dtype="<u2")),
      "colors": enc(np.asarray(new_c, dtype="u1")),
      "indices": enc(np.asarray(new_i, dtype="<u4")),
    }
  return changed


def integrate(apply=False):
  baseline_manifest = json.loads(original(DEFAULT_OUTPUT / "manifest.json"))
  descriptor = next(d for d in baseline_manifest["chunks"] if d["id"] == "1_6")
  patch = copy.deepcopy(descriptor)
  receipt = {
    "schemaVersion": 1,
    "baseRelease": BASE,
    "id": "1_6",
    "owner": OWNER,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "terrainSha256": SOURCE_DATA["sources"]["terrainSha256"],
    "policy": "Only the exact lifted coarse monument owner is replaced by its full source shell. Only water Y changes; all source water XZ triangles, colours, other triangles, every navigation ring, trees and terrain survive.",
    "basins": [{"id": oid, "displayY": y} for _, y, oid in BASINS],
    "modes": {},
  }
  STAGE.mkdir(parents=True, exist_ok=True)
  for mode in ("drawn", "minecraft"):
    path = DEFAULT_OUTPUT / descriptor[mode]["url"]
    base = original(path)
    before = json.loads(gzip.decompress(base))
    after = copy.deepcopy(before)
    remove, ink = coarse_owner_signatures(descriptor, mode == "minecraft")
    assert not remove - mesh_signature(before)
    after["meshes"] = subtract_meshes(after["meshes"], remove.copy())
    if ink:
      after["lines"] = subtract_lines(after["lines"], ink.copy())
    old_water = water_signature(before)
    kept = mesh_signature(before) - remove - old_water
    changed = patch_water(after, mode == "minecraft")
    new_water = water_signature(after)
    assert mesh_signature(after) - new_water == kept
    assert water_signature(before, True) == water_signature(after, True)
    assert before["nav"] == after["nav"]
    if "lines" in before:
      assert line_signature(after["lines"]) == line_signature(before["lines"]) - ink
    raw = (json.dumps(after, separators=(",", ":")) + "\n").encode()
    packed = gzip.compress(raw, mtime=0)
    assert len(packed) <= max(650000, descriptor[mode]["bytes"]) and len(raw) <= max(
      2600000, descriptor[mode]["decodedBytes"]
    ), (mode, len(packed), len(raw))
    (STAGE / path.name).write_bytes(packed)
    patch[mode] = {
      **descriptor[mode],
      "bytes": len(packed),
      "decodedBytes": len(raw),
      "sha256": hashlib.sha256(packed).hexdigest(),
    }
    receipt["modes"][mode] = {
      "oldSha256": hashlib.sha256(base).hexdigest(),
      "newSha256": patch[mode]["sha256"],
      "removedOwnerTriangles": sum(remove.values()),
      "removedOwnerInkSegments": sum(ink.values()),
      "waterTriangles": sum(old_water.values()),
      "changedWaterTriangles": changed,
      "preservedTriangles": sum(kept.values()),
      "preservedTrianglesSha256": signature_digest(kept),
      "sourceWaterXzSha256": signature_digest(water_signature(before, True)),
      "allNavigationUnchanged": True,
      "oldDescriptor": descriptor[mode],
      "newDescriptor": patch[mode],
    }
  RECEIPT.write_text(json.dumps(receipt, indent=2) + "\n")
  if apply:
    # Read the latest concurrent manifest; never restore its old other entries.
    current = json.loads((DEFAULT_OUTPUT / "manifest.json").read_bytes())
    old = next(d for d in current["chunks"] if d["id"] == "1_6")
    for mode in ("drawn", "minecraft"):
      assert old[mode]["sha256"] in (
        receipt["modes"][mode]["oldSha256"],
        receipt["modes"][mode]["newSha256"],
      )
      (DEFAULT_OUTPUT / patch[mode]["url"]).write_bytes(
        (STAGE / patch[mode]["url"]).read_bytes()
      )
    current["chunks"] = [patch if d["id"] == "1_6" else d for d in current["chunks"]]
    (DEFAULT_OUTPUT / "manifest.json").write_text(
      json.dumps(current, separators=(",", ":")) + "\n"
    )
  return receipt


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--apply", action="store_true")
  args = parser.parse_args()
  print(json.dumps(integrate(args.apply)["modes"], indent=2))
