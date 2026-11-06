"""Complete Oranien family and finite independently evidenced Senate roof fixes.

Only new V321 derivatives are written. Original sheets, offsets and source bytes
remain retained; no published source owner or package is rewritten here.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Point, Polygon, box, shape
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from scripts.build_alt_mitte_v169 import triangulate
from scripts.build_karl_marx_allee_v161 import Detail
from scripts.build_scheunenviertel_v168 import merge_native_faces

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
EVIDENCE = GEO / "berlin-senate-buildings-v321-evidence.json.gz"


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def write(path: Path, value: dict) -> None:
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def packed(detail: Detail, key: str, native: bool) -> dict:
  """Float32 source positions retain millimetre evidence, never centimetre cut."""
  pos = []
  colors = []
  indices = []
  table = {}
  for triangle, rgb, _ in detail.triangles:
    srgb = np.array(rgb) / 255
    linear = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
    color = tuple(np.rint(linear * 65535).astype(int))
    for point in triangle:
      xyz = tuple(np.float32(point))
      word = (*np.array(xyz, dtype="<f4").view("<u4").tolist(), *color)
      if word not in table:
        table[word] = len(pos)
        pos.append(xyz)
        colors.append(color)
      indices.append(table[word])
  assert pos and len(indices) % 3 == 0
  return dict(
    key=key,
    native=native,
    field=key.split("-")[0],
    positionType="f32",
    colorType="u16linear",
    origin=[0, 0, 0],
    positions=base64.b64encode(np.array(pos, dtype="<f4").tobytes()).decode(),
    colors=base64.b64encode(np.array(colors, dtype="<u2").tobytes()).decode(),
    indices=base64.b64encode(np.array(indices, dtype="<u4").tobytes()).decode(),
    vertices=len(pos),
    triangles=len(indices) // 3,
  )


def polygons(g: BaseGeometry) -> list[Polygon]:
  return (
    [g]
    if g.geom_type == "Polygon"
    else [p for p in g.geoms if p.geom_type == "Polygon"]
  )


def volume(detail: Detail, poly: Polygon, low: float, high: float, rgb: tuple) -> list:
  roofs = []
  for p in polygons(poly):
    for ring in [p.exterior, *p.interiors]:
      coords = list(ring.coords)
      for a, b in zip(coords, coords[1:]):
        detail.polygon(
          [
            [a[0], low, a[1]],
            [b[0], low, b[1]],
            [b[0], high, b[1]],
            [a[0], high, a[1]],
          ],
          rgb,
          "interpreted measured-height wall",
        )
    rings = [
      [[x, high, z] for x, z in list(r.coords)[:-1]] for r in [p.exterior, *p.interiors]
    ]
    for t in triangulate(rings):
      detail.polygon(t, (140, 148, 147), "evidenced roof")
      roofs.append(t)
  return roofs


def native_columns(volumes: list) -> tuple[Detail, list]:
  """Independent2m cardinal interpretation; source court cells remain open."""
  cells = {}
  for item in volumes:
    poly, low, high, rgb = item[:4]
    roofs = item[4] if len(item) > 4 else []
    xmin, zmin, xmax, zmax = poly.bounds
    for x in range(math.floor(xmin / 2), math.ceil(xmax / 2)):
      for z in range(math.floor(zmin / 2), math.ceil(zmax / 2)):
        cell = box(x * 2, z * 2, x * 2 + 2, z * 2 + 2)
        # Full-cell admission retains every measured court as open air.
        if not poly.buffer(1e-7).covers(cell):
          continue
        actual_high = high
        if roofs:
          samples = []
          sx, sz = x * 2 + 1, z * 2 + 1
          for a, b, c in roofs:
            den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2])
            if abs(den) < 1e-9:
              continue
            u = ((b[2] - c[2]) * (sx - c[0]) + (c[0] - b[0]) * (sz - c[2])) / den
            v = ((c[2] - a[2]) * (sx - c[0]) + (a[0] - c[0]) * (sz - c[2])) / den
            if u >= -1e-7 and v >= -1e-7 and u + v <= 1 + 1e-7:
              samples.append(u * a[1] + v * b[1] + (1 - u - v) * c[1])
          if samples:
            actual_high = math.ceil(max(samples) * 8) / 8
        key = (x, z)
        entry = cells.get(key)
        if entry:
          cells[key] = (min(low, entry[0]), max(actual_high, entry[1]), rgb)
        else:
          cells[key] = (low, actual_high, rgb)
  detail = Detail()
  nav = []
  for (ix, iz), (lo, hi, rgb) in cells.items():
    x, z = ix * 2, iz * 2
    detail.polygon(
      [[x, hi, z], [x + 2, hi, z], [x + 2, hi, z + 2], [x, hi, z + 2]],
      (140, 148, 147),
      "native roof",
    )
    for dx, dz, a, b in [
      (-1, 0, [x, z], [x, z + 2]),
      (1, 0, [x + 2, z + 2], [x + 2, z]),
      (0, -1, [x + 2, z], [x, z]),
      (0, 1, [x, z + 2], [x + 2, z + 2]),
    ]:
      other = cells.get((ix + dx, iz + dz))
      bottom = max(lo, other[1]) if other else lo
      if bottom < hi - 0.001:
        detail.polygon(
          [
            [a[0], bottom, a[1]],
            [b[0], bottom, b[1]],
            [b[0], hi, b[1]],
            [a[0], hi, a[1]],
          ],
          rgb,
          "native source wall",
        )
    nav.append(
      dict(
        ring=[[x, z], [x + 2, z], [x + 2, z + 2], [x, z + 2]],
        holes=[],
        bottom=lo,
        top=hi,
        roof=[],
      )
    )
  return merge_native_faces(detail), nav


def actual_datum() -> dict:
  manifest = read(GEO / "alt-mitte-v169/source-manifest.json")
  for row in manifest["chunks"]:
    for b in read(GEO / "alt-mitte-v169" / row["file"])["buildings"]:
      if b["id"] == "DEBE01YYK000053C":
        leaf = next(p for p in b["parts"] if p["id"] == "DEBE3DpqmgdGgX5d")
        return dict(
          offset=leaf["topY"] - 8.775,
          actualGround=leaf["groundY"],
          actualTop=leaf["topY"],
          sourceFile=row["file"],
          sourceSha256=row["sha256"],
          verticalTransform=b["verticalTransform"],
        )
  raise ValueError("Missing actual education family datum")


def native_windows(detail: Detail, cells: list, footprint: Polygon) -> int:
  """Cardinal panes use the independent delivered cells, not rotated drawn fits."""
  grid = {(int(p["ring"][0][0] / 2), int(p["ring"][0][1] / 2)): p for p in cells}
  count = 0
  holes = [Polygon(h) for p in polygons(footprint) for h in p.interiors]
  for (ix, iz), p in grid.items():
    x, z = ix * 2 + 1, iz * 2 + 1
    for dx, dz in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
      neighbor = grid.get((ix + dx, iz + dz))
      if neighbor or (iz if dx else ix) % 2:
        continue
      probe = Point(x + dx * 3, z + dz * 3)
      if footprint.buffer(0.01).covers(probe) or any(h.covers(probe) for h in holes):
        continue
      cx, cz = x + dx * 1.08, z + dz * 1.08
      tangent = np.array([-dz, dx]) * 0.62
      y = p["bottom"] + 2.4
      while y + 0.9 < p["top"] - 0.4:
        a, b = np.array([cx, cz]) - tangent, np.array([cx, cz]) + tangent
        detail.polygon(
          [
            [a[0], y - 0.9, a[1]],
            [b[0], y - 0.9, b[1]],
            [b[0], y + 0.9, b[1]],
            [a[0], y + 0.9, a[1]],
          ],
          (73, 96, 104),
          "independent cardinal glazing estimate",
        )
        count += 1
        y += 3.7
  return count


def build(source_directory: Path | None = None) -> dict:
  retained = read(EVIDENCE) if EVIDENCE.exists() else None
  if source_directory is None:
    if not retained:
      raise ValueError("Supply --source-directory for the first finite source capture")
    roof = retained["roofProfile"]
    family = retained["sourceFamily"]
    urban_source = retained["urbanOriginalSource"]
  else:
    families = read(source_directory / "official-families.json.gz")
    roof = read(source_directory / "finite-roof-corrections-v321.json")
    family = next(
      f for f in families["health-social"] if f["owner"] == "DEBE02YY40000Czf"
    )
    urban_source = read(source_directory / "DEBE04YY50003Ibe.json.gz")[0]
  original = read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  old = next(p for p in original["buildings"] if p["id"] == "n-400426")
  parts = family["parts"]
  assert len(parts) == 8
  shift = old["y0_dm"] / 10 - min(p["ground_y_m"] for p in parts)
  model = Detail()
  nav = []
  volumes = []
  union = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  court_boundaries = [h for p in polygons(union) for h in p.interiors]
  for part in parts:
    poly = Polygon(part["ring"], part["holes"])
    lo = part["ground_y_m"] + shift
    hi = part["top_y_m"] + shift
    roofs = []
    for s in part["surfaces"]:
      shifted = [[[x, y + shift, z] for x, y, z in r] for r in s["rings"]]
      rgb = (142, 70, 53) if s["kind"] == "WallSurface" else (141, 149, 147)
      if s["kind"] == "WallSurface":
        wall_center = np.mean(np.array(s["rings"][0])[:, [0, 2]], axis=0)
        if any(h.distance(Point(*wall_center)) < 0.01 for h in court_boundaries):
          rgb = (209, 202, 184)
      for triangle in triangulate(shifted):
        model.polygon(triangle, rgb, "source " + s["kind"])
      if s["kind"] == "RoofSurface":
        roofs.extend(triangulate(shifted))
    nav.append(
      dict(
        site="oranien",
        id=part["id"],
        ring=part["ring"],
        holes=part["holes"],
        bottom=lo,
        top=hi,
        roof=roofs,
      )
    )
    volumes.append((poly, lo, hi, (142, 70, 53), roofs))
  # Only the actual outer street-facing source walls receive a restrained seven-
  # storey reading. The complete source shell and all roof/court sheets survive.
  windows = 0
  for part in parts:
    for s in part["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      r = np.array(s["rings"][0])
      low = float(r[:, 1].min() + shift)
      high = float(r[:, 1].max() + shift)
      xz = np.unique(r[:, [0, 2]], axis=0)
      if len(xz) != 2:
        continue
      a, b = xz
      direction = b - a
      width = float(np.linalg.norm(direction))
      if width < 8 or high - low < 12:
        continue
      direction /= width
      normal = np.array([-direction[1], direction[0]])
      mid = (a + b) / 2
      # Orient toward the unbuilt complement, and exclude actual source courts.
      if union.buffer(0.001).covers(Point(mid + normal * 0.2)):
        normal = -normal
      probe = Point(mid + normal * 0.3)
      if union.buffer(0.001).covers(probe):
        continue
      if any(Polygon(h).buffer(0.1).covers(probe) for p in parts for h in p["holes"]):
        continue
      floors = min(7, max(2, round((high - low) / 3.8)))
      bays = max(1, math.floor(width / 3.6))
      for level in range(floors):
        y = low + 2.2 + level * (high - low - 3.6) / max(1, floors - 1)
        if y + 1.15 >= high - 0.4:
          continue
        for bay in range(bays):
          center = a + direction * width * (bay + 0.5) / bays + normal * 0.09
          half = min(1.0, width / bays * 0.25)
          q = [center - direction * half, center + direction * half]
          model.polygon(
            [
              [q[0][0], y - 1, q[0][1]],
              [q[1][0], y - 1, q[1][1]],
              [q[1][0], y + 1, q[1][1]],
              [q[0][0], y + 1, q[0][1]],
            ],
            (68, 88, 95),
            "estimated window glazing",
          )
          windows += 1
  native, native_nav = native_columns(volumes)
  native_window_count = native_windows(native, native_nav, union)
  models = [
    packed(model, "oranien-complete-source", False),
    packed(native, "oranien-cardinal-source", True),
  ]
  datum = actual_datum()
  assert abs(datum["offset"] + 2.775) < 1e-9
  # Ground-to-ground alignment must not carry the old wrong roof height upward.
  packet = read(ROOT / "src/app/public/mesh/surrounding-berlin-v159/-8_5.drawn.json.gz")
  owners = [
    n for n in packet["nav"]["buildings"] if n.get("sourceId") == "DEBE04YY50003Ibe"
  ]
  assert len(owners) == 1
  observed_top = packet["nav"]["groundY"] + owners[0]["height"]
  tower = shape(roof["urban"]["originalFootprint"])
  delivered_points = []
  for part in packet["meshes"]:
    if part["kind"] != "city":
      continue
    words = np.frombuffer(base64.b64decode(part["positions"]), dtype="<u2").reshape(
      -1, 3
    )
    points = words / 100 + packet["origin"]
    delivered_points.extend(
      p.tolist() for p in points if tower.covers(Point(p[0], p[2]))
    )
  assert delivered_points
  actual_floor = min(p[1] for p in delivered_points)
  assert actual_floor == 3.0 and max(p[1] for p in delivered_points) == observed_top
  urban_shift = actual_floor - urban_source["ground_y_m"]
  roof_nav = []
  roof_native = []
  for site, delta in [("education", datum["offset"]), ("urban", urban_shift)]:
    detail = Detail()
    vol = []
    for zone in roof[site]["zones"]:
      poly = shape(zone["geometry"])
      low = observed_top if site == "urban" else zone["bottomYM"] + delta
      high = zone["topYM"] + delta
      triangles = volume(
        detail,
        poly,
        low,
        high,
        (195, 184, 157) if site == "education" else (195, 190, 177),
      )
      for p in polygons(poly):
        roof_nav.append(
          dict(
            site=site,
            id=zone["id"],
            ring=list(p.exterior.coords)[:-1],
            holes=[list(h.coords)[:-1] for h in p.interiors],
            bottom=low,
            top=high,
            roof=triangles,
          )
        )
      vol.append(
        (poly, low, high, (195, 184, 157) if site == "education" else (195, 190, 177))
      )
    detail_native, solid_native = native_columns(vol)
    roof_native.extend([dict(site=site, **p) for p in solid_native])
    models.extend(
      [
        packed(detail, site + "-bounded-roof", False),
        packed(detail_native, site + "-cardinal-roof", True),
      ]
    )
  result = dict(
    schemaVersion=1,
    models=models,
    navigation=dict(drawn=nav + roof_nav, native=native_nav + roof_native),
    oldBodies=[old],
  )
  proof = dict(
    schemaVersion=1,
    sourceFamily=family,
    originalBody=old,
    oranienDatumOffset=shift,
    educationDatum=datum,
    urbanDatum=dict(
      actualPacket="-8_5.drawn",
      owner="DEBE04YY50003Ibe",
      actualTop=observed_top,
      actualFloor=actual_floor,
      sourceGround=urban_source["ground_y_m"],
      actualBuildingVertices=delivered_points,
      actualPacketSha256=hashlib.sha256(
        (
          ROOT / "src/app/public/mesh/surrounding-berlin-v159/-8_5.drawn.json.gz"
        ).read_bytes()
      ).hexdigest(),
      sourceTop=roof["urban"]["sourceRoofYM"],
      offset=urban_shift,
    ),
    urbanOriginalSource=urban_source,
    roofProfile=roof,
    windowEstimateCount=windows,
    nativeWindowEstimateCount=native_window_count,
    policy="Complete original8leaf sheets retained; F32geometry keeps all source positions with rigid existing owner datum. Window rhythm/material tones estimated from primary architectural description; independent native2m columns retain fully clear source courts. No source record overwritten.",
  )
  write(DATA / "berlinSenateBuildingsV321.json", result)
  write(GEO / "berlin-senate-buildings-v321-evidence.json.gz", proof)
  raw = (DATA / "berlinSenateBuildingsV321.json").read_bytes()
  print(
    "models",
    len(models),
    "raw",
    len(raw),
    "gzip",
    len(gzip.compress(raw)),
    [(m["key"], m["triangles"]) for m in models],
  )
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--source-directory", type=Path)
  build(parser.parse_args().source_directory)
