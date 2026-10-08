"""Step 10: full southwest LoD2 owners and bounded recognition surface members.

All pre-v187 source models remain untouched. New owner exclusions are exact
LoD2 footprints; facade subdivisions are explicitly unsurveyed interpretation.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_steglitz_v182 import native_blocks, world
from extract_outer_connectors_v180 import identity
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "southwest-landmarks-v187-source.json.gz"
GROUND = 3.55


def digest(path: Path) -> str:
  """Fingerprint a retained permitted source."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def wall_details(rings: list, style: str, windows: bool = True) -> list[list]:
  """Clip modest bands/windows to actual wall sheets, including court holes."""
  n = normal_of(rings[0])
  if not np.isfinite(n).all() or abs(n[1]) > 0.02:
    return []
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda p: math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]),
  )
  a = np.array(a)
  d = np.array([b[0] - a[0], 0, b[2] - a[2]])
  length = float(np.linalg.norm(d))
  if length < 3:
    return []
  d /= length
  planar = [[(float(np.dot(np.array(p) - a, d)), p[1]) for p in ring] for ring in rings]
  wall = Polygon(planar[0], planar[1:]).buffer(0)
  if wall.is_empty:
    return []
  left, low, right, high = wall.bounds
  if high - low < 2:
    return []
  result = []
  yaw = math.atan2(-d[2], d[0])
  cap = {
    "bronze": 0xA78D6A,
    "silver": 0xD4D6CA,
    "farm": 0xC8BA98,
    "station": 0xD8CEAE,
    "brick": 0xAD8065,
    "stone": 0xD7C8AF,
  }[style]

  def put(u: float, y: float, w: float, h: float, depth: float, color: int) -> None:
    if not wall.buffer(0.00001).covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      return
    p = a + d * u + n * (0.09 + depth / 2)
    result.append(
      [*[round(v, 3) for v in [p[0], y, p[2], w, h, depth]], round(yaw, 6), color]
    )

  # Small eave/base bands leave the complete source wall and roof intact.
  for y in [low + 0.23, high - 0.24]:
    cut = wall.intersection(LineString([(left, y), (right, y)]))
    for piece in [cut] if cut.geom_type == "LineString" else getattr(cut, "geoms", []):
      if piece.geom_type == "LineString" and piece.length > 2:
        start, end = piece.bounds[0] + 0.12, piece.bounds[2] - 0.12
        put((start + end) / 2, y, end - start, 0.12, 0.15, cap)
  if windows:
    levels = min(
      2 if style == "bronze" else 3 if style == "silver" else 5,
      max(1, round((high - low) / 3.7)),
    )
    if style in {"bronze", "silver"}:
      # The campus reads through horizontal window ribbons and sparse frame
      # divisions. Only the new display interpretation is bounded here; every
      # measured sheet and every court remains present at full resolution.
      for level in range(levels):
        y = low + (level + 0.56) * (high - low) / levels
        h = min(1.55, (high - low) / levels * 0.55)
        cut = wall.intersection(LineString([(left, y), (right, y)]))
        for piece in (
          [cut] if cut.geom_type == "LineString" else getattr(cut, "geoms", [])
        ):
          if piece.geom_type != "LineString" or piece.length < 2:
            continue
          start, end = piece.bounds[0] + 0.22, piece.bounds[2] - 0.22
          put((start + end) / 2, y, end - start, h, 0.055, 0x718785)
          put((start + end) / 2, y - h / 2 - 0.06, end - start, 0.10, 0.13, cap)
          for u in np.arange(start + 3, end, 6):
            put(float(u), y, 0.07, h, 0.14, cap)
    else:
      bays = max(1, round(length / 3.8))
      for level in range(levels):
        y = low + (level + 0.56) * (high - low) / levels
        for bay in range(bays):
          u = left + (bay + 0.5) * (right - left) / bays
          w = min(1.45, (right - left) / bays * 0.68)
          h = min(1.7, (high - low) / levels * 0.6)
          put(u, y, w, h, 0.055, 0x6D8483 if (level + bay) % 3 else 0x849794)
          put(u, y - h / 2 - 0.06, w + 0.12, 0.10, 0.13, cap)
  return result


def build() -> tuple[dict[str, Any], dict[str, Any]]:
  """Triangulate every measured source polygon and preserve owner identity."""
  src = json.loads(gzip.decompress(SOURCE.read_bytes()))
  osm = {
    identity(f): transform(world, shape(f["geometry"])) for f in src["osmFeatures"]
  }
  bronze = osm["relation/32590"]
  fu_base = min(
    p["ground_y_m"]
    for f in src["profiles"]
    if f["tile"] == "383_5812"
    for p in f["parts"]
  )
  sites = []
  owners = []
  for key, name in [
    ("fu", "FU Rost- und Silberlaube"),
    ("dahlem", "Domäne Dahlem"),
    ("mexiko", "Bahnhof Mexikoplatz"),
  ]:
    tiles = {"fu": "383_5812", "dahlem": "383_5813", "mexiko": "379_5811"}
    site = {
      "key": key,
      "name": name,
      "surfaces": [],
      "boxes": [],
      "rods": [],
      "owners": [],
    }
    for profile in src["profiles"]:
      if profile["tile"] != tiles[key]:
        continue
      base = fu_base if key == "fu" else min(p["ground_y_m"] for p in profile["parts"])
      offset = GROUND - base
      owner = profile["id"]
      site["owners"].append(owner)
      owners.append(
        {
          "id": owner,
          "name": profile["name"],
          "parts": len(profile["parts"]),
          "osmOwner": profile["osmOwner"],
          "sourceTile": profile["tile"],
          "sourceSha256": profile["sourceSha256"],
          "rigidYOffset": round(offset, 3),
        }
      )
      for part in profile["parts"]:
        for s in part["surfaces"]:
          rings = [
            [[p[0], round(p[1] + offset, 3), p[2]] for p in r] for r in s["rings"]
          ]
          if key == "fu":
            point = Point(
              np.mean([p[0] for p in rings[0]]), np.mean([p[2] for p in rings[0]])
            )
            style = "bronze" if bronze.distance(point) < 2 else "silver"
            color = 0x95755F if style == "bronze" else 0xBDC5BC
            roof = 0xA8B2AC
            # Philological library roof stays the measured faceted curved shell.
            if osm["way/379437309"].distance(point) < 1:
              color = 0xC5CFCC
              roof = 0xBEC9C5
          elif key == "dahlem":
            style = "farm"
            color = 0xE1CDA8 if profile["osmOwner"] == "way/30432417" else 0xC0AA85
            roof = 0x8D5844
          else:
            style = "station"
            color = 0xCABC91
            roof = 0x52766B
          triangles = triangles_for(rings)
          site["surfaces"].append(
            {
              "owner": owner,
              "part": part["id"],
              "kind": s["kind"],
              "color": roof if s["kind"] == "RoofSurface" else color,
              "triangles": triangles,
            }
          )
          if s["kind"] == "WallSurface":
            site["boxes"].extend(wall_details(rings, style))
    if key == "mexiko":
      # OSM records an onion roof and the heritage inventory identifies the
      # Jugendstil cupola. The very generalized LoD2 roof remains underneath.
      # Centring follows its main ridge; the local curved profile is an
      # explicitly unsurveyed recognition fit, not a new roof survey.
      cx, cz = -9650.436, 8846.795
      profile = [
        (13.5, 5.1),
        (15.0, 6.3),
        (16.7, 6.0),
        (18.9, 3.9),
        (19.9, 1.15),
        (20.1, 0.63),
        (20.9, 0.42),
      ]
      triangles = []
      for (y0, r0), (y1, r1) in zip(profile, profile[1:]):
        for j in range(32):
          aa, bb = math.tau * j / 32, math.tau * (j + 1) / 32
          ring = [
            [cx + math.cos(aa) * r0, y0, cz + math.sin(aa) * r0],
            [cx + math.cos(bb) * r0, y0, cz + math.sin(bb) * r0],
            [cx + math.cos(bb) * r1, y1, cz + math.sin(bb) * r1],
            [cx + math.cos(aa) * r1, y1, cz + math.sin(aa) * r1],
          ]
          triangles.extend([[ring[0], ring[1], ring[2]], [ring[0], ring[2], ring[3]]])
      for j in range(32):
        aa, bb = math.tau * j / 32, math.tau * (j + 1) / 32
        triangles.append(
          [
            [cx, 21.25, cz],
            [cx + math.cos(aa) * 0.42, 20.9, cz + math.sin(aa) * 0.42],
            [cx + math.cos(bb) * 0.42, 20.9, cz + math.sin(bb) * 0.42],
          ]
        )
      site["surfaces"].append(
        {
          "owner": "DEBE06YYA00003aT",
          "part": "DEBE06YYA00003aT",
          "kind": "RecognitionSurface",
          "color": 0x55776A,
          "triangles": triangles,
        }
      )
    sites.append(site)
  # Existing Steglitz centre: slim source-bound edges only, never another shell.
  old = json.loads((DATA / "steglitzV182Source.json").read_text())
  centre = {
    "key": "steglitz",
    "name": "Steglitz centre: restrained source eaves",
    "surfaces": [],
    "boxes": [],
    "rods": [],
    "owners": [],
  }
  for owner, style in [
    ("DEBE06YYB0000N1G", "brick"),
    ("DEBE06YYB0000Ele", "stone"),
    ("DEBE06YYB00001xV", "stone"),
  ]:
    selected = []
    for s in old["surfaces"]:
      if s["owner"] != owner:
        continue
      tris = s["triangles"]
      if not tris:
        continue
      n = normal_of(tris[0])
      if abs(n[1]) > 0.02:
        continue
      # Each original source sheet is triangulated; band clipping to each
      # triangle cannot cross an original roof slope, opening or recess.
      for tri in tris:
        selected.extend(wall_details([tri], style, False))
    # Restrained additions: up to twelve longest valid, nonidentical profiles.
    unique = {tuple(row): row for row in selected}
    centre["boxes"].extend(
      sorted(unique.values(), key=lambda r: r[3], reverse=True)[:12]
    )
    centre["owners"].append(owner)
  sites.append(centre)
  evidence = {
    "version": "1.0.87",
    "sourceSha256": digest(SOURCE),
    "owners": owners,
    "existingSteglitzSha256": digest(DATA / "steglitzV182Source.json"),
    "policy": "Complete original LoD2 walls/roofs, millimetre coordinates; rigid ground datum only. Facade bays, local colours and edge profiles are display interpretation, not measured individual windows. Native geometry is independent exterior-only unit-cell skin. No texture or image pixels.",
    "references": src["references"],
  }
  return {"sites": sites}, evidence


def build_navigation() -> dict[str, Any]:
  """Keep exact part rings/holes and the same rigid vertical datum as rendering."""
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  fu_base = min(
    p["ground_y_m"]
    for owner in source["profiles"]
    if owner["tile"] == "383_5812"
    for p in owner["parts"]
  )
  buildings = []
  for owner in source["profiles"]:
    base = (
      fu_base
      if owner["tile"] == "383_5812"
      else min(p["ground_y_m"] for p in owner["parts"])
    )
    offset = GROUND - base
    for part in owner["parts"]:
      buildings.append(
        {
          "id": part["id"],
          "owner": owner["id"],
          "sourceId": owner["id"],
          "ring": part["ring"],
          "holes": part["holes"],
          "groundY": round(part["ground_y_m"] + offset, 3),
          "topY": round(part["top_y_m"] + offset, 3),
          "heightSource": "Complete Berlin LoD2 part vertical envelope; same rigid datum as drawn geometry",
        }
      )
  return {"buildings": buildings}


def main() -> None:
  """Write compact drawn/native files without modifying previous source assets."""
  runtime, evidence = build()
  native = []
  for site in runtime["sites"]:
    blocks = native_blocks(site)
    native.append(
      {
        "key": site["key"],
        "name": site["name"],
        "owners": site["owners"],
        "boxes": blocks,
      }
    )
    evidence.setdefault("budgets", []).append(
      {
        "key": site["key"],
        "triangles": sum(len(s["triangles"]) for s in site["surfaces"]),
        "boxes": len(site["boxes"]),
        "nativeRuns": len(blocks),
      }
    )
  for path, value in [
    (DATA / "southWestLandmarksV187.json", runtime),
    (DATA / "southWestLandmarksV187Native.json", {"sites": native}),
    (DATA / "southWestLandmarksV187Navigation.json", build_navigation()),
    (GEO / "southwest-landmarks-v187-evidence.json", evidence),
  ]:
    path.write_text(json.dumps(value, separators=(",", ":")) + "\n")
    print(path.name, path.stat().st_size)


if __name__ == "__main__":
  main()
