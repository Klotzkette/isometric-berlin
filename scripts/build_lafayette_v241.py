"""Step 10: finite Quartier 207 glass curtain-wall fittings on retained source sheets."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import Counter, defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_concert_halls_v160 import normal_of
from build_karl_marx_allee_v161 import Detail
from shapely.geometry import Point, Polygon, box
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
CATALOGUE = GEO / "alt-mitte-v169/source-390_5819-00.json.gz"
SOURCE = GEO / "lafayette-v241-source.json.gz"
EVIDENCE = GEO / "lafayette-v241-evidence.json"
RUNTIME = ROOT / "src/app/src/data/quartier207V241.json"
MAIN = "DEBE01YYK00008UX"
AUXILIARY = {"DEBE00YY1280004" + c for c in "ofVRdiabZhTX"}
BOUNDS = [1200, 485, 1282, 580]
FLOORS = [5.2, 9.4, 13.85, 18.3, 22.75, 27.2, 31.674]
GLASS = [
  (62, 85, 88),
  (75, 104, 108),
  (88, 116, 122),
  (102, 132, 139),
  (112, 143, 150),
  (126, 154, 160),
]
METAL = (181, 188, 181)
MULLION = (122, 147, 150)
POLICY = (
  "Only source-bound glass curtain-wall recognition at Jean Nouvel's Quartier 207, "
  "OSM way/25945410 and measured main parent DEBE01YYK00008UX. Every source sheet, "
  "roof, auxiliary owner and navigation record remains in its existing runtime family. "
  "Exact old generic drawn apertures may yield only to the audited required replacement. "
  "Native source cells remain; fittings independently follow their exterior grid. "
  "Panel divisions, hues, thin framing and native clearance are display estimates, "
  "not a facade survey. No future Lumina reconstruction, tenant branding, textures, "
  "new city coverage, mobile detail reduction or residency-limit increase."
)


def read(path: Path) -> Any:
  """Read a bounded retained JSON source."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  """Write deterministic small source and runtime records."""
  raw = (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  """Return an immutable source receipt."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract() -> dict:
  """Keep all thirteen exact owners, including their existing vertical transforms."""
  records = [b for b in read(CATALOGUE)["buildings"] if b["id"] in AUXILIARY | {MAIN}]
  assert {b["id"] for b in records} == AUXILIARY | {MAIN}
  assert (
    next(b for b in records if b["id"] == MAIN)["osmTags"]["osm_way_id"] == "25945410"
  )
  source = dict(
    schemaVersion=1,
    policy=POLICY,
    buildings=records,
    preservedInputs={str(CATALOGUE.relative_to(ROOT)): sha(CATALOGUE)},
    primaryReferences=[
      "https://www.jeannouvel.com/projets/galeries-lafayette/",
      "https://www.bmg.com/news/bmg-to-relocate-global-headquarters-to-iconic-lumina-building-in-berlin",
    ],
    visualReferences=[
      dict(
        url="https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Friedrichstrasse_76-78,_Galeries_Lafayette.jpg",
        author="Jörg Zägel",
        date="2010-06-17",
        license="CC-BY-SA-3.0",
        licenseUrl="https://creativecommons.org/licenses/by-sa/3.0/",
        purpose="Reference-only glazing, horizontal joints, corner and roof articulation; no image bundled",
      )
    ],
    currentUse="Department store closed in 2024. BMG's January 2026 announcement identifies ongoing Lumina renovation and a planned early-2027 move; this model does not claim current retail or completed future construction.",
  )
  write(SOURCE, source)
  return source


def pieces(geometry: Any) -> list:
  """Keep every polygon component after clipping a fitting to its source plane."""
  if geometry.is_empty:
    return []
  if geometry.geom_type == "Polygon":
    return [geometry]
  return [p for g in getattr(geometry, "geoms", []) for p in pieces(g)]


def surface_plane(surface: dict) -> tuple:
  """Use the original three-dimensional source plane and all interior rings."""
  rings = [np.array(r, dtype=float) for r in surface["rings"]]
  n = np.array(normal_of(rings[0].tolist()), dtype=float)
  dominant = int(np.argmax(np.abs(n)))
  axes = [i for i in range(3) if i != dominant]
  polygon = shapely.make_valid(
    Polygon(rings[0][:, axes], [r[:, axes] for r in rings[1:]])
  )
  return rings[0][0], n, dominant, axes, polygon


def attach(
  detail: Detail, surface: dict, native: bool, audits: list, index: int
) -> None:
  """Attach clipped opaque glass cues: existing source remains underneath."""
  origin, normal, dominant, axes, polygon = surface_plane(surface)
  roof = surface["kind"] == "RoofSurface"
  if not roof and dominant == 1:
    return
  # All three street fronts and their rounded connection; east is the party side.
  if not roof and normal[0] > 0.55 and (not native or origin[0] > 1270):
    return
  if polygon.area < 0.05:
    return
  lo0, lo1, hi0, hi1 = polygon.bounds
  if not roof and axes[1] != 1:
    # X-normal walls project to [Y,Z]; use [horizontal,Y] consistently.
    axes.reverse()
    polygon = shapely.make_valid(
      Polygon(
        np.array(surface["rings"][0])[:, axes],
        [np.array(r)[:, axes] for r in surface["rings"][1:]],
      )
    )
    lo0, lo1, hi0, hi1 = polygon.bounds
  start_count = len(detail.triangles)

  def lift(u: float, v: float, offset: float) -> np.ndarray:
    p = np.zeros(3)
    p[axes] = [u, v]
    p[dominant] = (
      origin[dominant]
      - sum(normal[a] * (p[a] - origin[a]) for a in axes) / normal[dominant]
    )
    return p + normal * (max(0.03, offset - 0.20) if native and not roof else offset)

  def emit(shape: Any, color: tuple, role: str, offset: float = 0.20) -> None:
    for p in pieces(shape.intersection(polygon)):
      if p.area < 0.0001:
        continue
      for t in shapely.constrained_delaunay_triangles(p).geoms:
        detail.polygon(
          [lift(u, v, offset).tolist() for u, v in list(t.exterior.coords)[:-1]],
          color,
          role,
        )

  if roof:
    # Sparse ribs make retained glazed roof planes legible; do not invent domes.
    emit(polygon, (147, 169, 174), "roof glazing on retained plane", 0.035)
    step = 2.4 if not native else 2.0
    for u in np.arange(math.ceil(lo0 / step) * step, hi0, step):
      emit(box(u - 0.035, lo1, u + 0.035, hi1), METAL, "roof glazing rib", 0.075)
    for v in np.arange(math.ceil(lo1 / 4.8) * 4.8, hi1, 4.8):
      emit(box(lo0, v - 0.025, hi0, v + 0.025), MULLION, "roof cross seam", 0.065)

  else:
    pitch = 1.5 if not native else 1.0
    starts = np.arange(math.floor(lo0 / pitch) * pitch, hi0, pitch)
    heights = sorted(
      set(
        [lo1, hi1] + [y for y in FLOORS if lo1 < y < hi1] + [35.8]
        if lo1 < 35.8 < hi1
        else [lo1, hi1] + [y for y in FLOORS if lo1 < y < hi1]
      )
    )
    for bay, u in enumerate(starts):
      for bottom, top in zip(heights, heights[1:]):
        mid = (bottom + top) / 2
        level = max(0, min(5, int(np.searchsorted(FLOORS, mid) - 1)))
        tint = (144, 168, 174) if mid > 31.674 else GLASS[level]
        delta = round(4 * math.sin(u * 0.31))
        tone = tuple(max(0, min(255, c + delta)) for c in tint)
        emit(box(u, bottom, u + pitch, top), tone, "continuous curtain glazing", 0.23)
        # A slim reflection band gives glass depth while keeping texture-free batches.
        if top - bottom > 1.0:
          emit(
            box(
              u + 0.06,
              bottom + (top - bottom) * 0.72,
              u + pitch - 0.06,
              bottom + (top - bottom) * 0.86,
            ),
            tuple(min(255, c + 10) for c in tone),
            "restrained glass reflection",
            0.255,
          )
      if hi0 - lo0 > 1.5:
        emit(box(u - 0.028, lo1, u + 0.028, hi1), MULLION, "vertical glass joint", 0.28)
    for y in FLOORS[1:] + [35.8]:
      if not lo1 <= y <= hi1:
        continue
      emit(box(lo0, y - 0.10, hi0, y + 0.10), METAL, "horizontal floor rail", 0.34)
      emit(
        box(lo0, y - 0.34, hi0, y - 0.28),
        (102, 123, 123),
        "paired horizontal shadow rail",
        0.32,
      )
      emit(
        box(lo0, y + 0.25, hi0, y + 0.30), METAL, "paired horizontal silver rail", 0.33
      )
    # Lower continuous shopfront head; no speculative tenant name or retail display.
    if lo1 < 9.4 < hi1:
      emit(box(lo0, 9.22, hi0, 9.39), (187, 189, 173), "street canopy fascia", 0.65)
  audits.append(
    dict(
      surface=index,
      kind=surface["kind"],
      sourcePolygonId=surface.get("sourcePolygonId"),
      triangles=len(detail.triangles) - start_count,
    )
  )


@lru_cache(maxsize=1)
def native_envelope() -> list[dict]:
  """Replay exact existing native cells and join coplanar exposed faces.

  The outward distance gradient of the measured footprint excludes hollow
  inner faces while keeping the orthogonal staircase returns. The
  fittings sit on these exact existing planes, not an inflated smooth envelope.
  """
  from lafayette_v241_receipts import (
    core,
    merge_native_faces,
    native_detail,
    retained,
  )

  buildings, occupied, _ = retained()
  main = next(b for b in buildings if b["id"] == MAIN)
  shell, fronts, _, _ = core.model(main, occupied)
  complete = Detail()
  complete.triangles = shell.triangles + fronts.triangles
  native = merge_native_faces(native_detail(complete))
  assert len(native.triangles) == 3424
  footprint = Polygon(main["footprintPolygons"][0]["ring"])
  planes = defaultdict(list)
  for triangle, _, _ in native.triangles:
    points = np.array(triangle)
    normal = np.cross(points[1] - points[0], points[2] - points[0])
    normal /= np.linalg.norm(normal)
    dominant = int(np.argmax(np.abs(normal)))
    sign = int(np.sign(normal[dominant]))
    if dominant == 1:
      if sign < 0 or points[0, 1] < 30:
        continue
    else:
      center = points.mean(axis=0)[[0, 2]]
      point = Point(center)
      nearest = np.array(nearest_points(footprint.boundary, point)[0].coords[0])
      gradient = center - nearest
      if footprint.contains(point):
        gradient *= -1
      if np.dot(gradient, normal[[0, 2]]) <= 0:
        continue
    axes = [i for i in range(3) if i != dominant]
    planes[(dominant, sign, float(points[0, dominant]))].append(
      Polygon(points[:, axes])
    )
  surfaces = []
  for (dominant, sign, coordinate), triangles in sorted(planes.items()):
    axes = [i for i in range(3) if i != dominant]
    for polygon in pieces(unary_union(triangles)):
      rings = []
      for ring in [polygon.exterior, *polygon.interiors]:
        points = []
        for u, v in list(ring.coords)[:-1]:
          p = [0.0, 0.0, 0.0]
          p[dominant] = coordinate
          p[axes[0]], p[axes[1]] = u, v
          points.append(p)
        rings.append(points)
      if normal_of(rings[0])[dominant] * sign < 0:
        rings = [list(reversed(r)) for r in rings]
      surfaces.append(
        dict(
          kind="RoofSurface" if dominant == 1 else "WallSurface",
          rings=rings,
          sourcePolygonId=f"retained-native-{dominant}-{sign}-{coordinate:g}",
        )
      )
  return surfaces


def details(source: dict, native: bool = False) -> tuple[Detail, list]:
  """The two complete input profiles share measured anchors, never slanted native faces."""
  main = next(b for b in source["buildings"] if b["id"] == MAIN)
  detail, audits = Detail(), []
  surfaces = native_envelope() if native else main["parts"][0]["surfaces"]
  for index, surface in enumerate(surfaces):
    if surface["kind"] in {"WallSurface", "RoofSurface"}:
      attach(detail, surface, native, audits, index)
  return detail, audits


def build() -> dict:
  """Publish one compact required payload with no source-shell replacement."""
  source = read(SOURCE) if SOURCE.exists() else extract()
  for path, digest in source["preservedInputs"].items():
    assert sha(ROOT / path) == digest, path
  runtime, counts = {}, {}
  for mode in ["drawn", "minecraft"]:
    detail, audits = details(source, mode == "minecraft")
    packet = empty_packet("quartier207-v241-" + mode, BOUNDS)
    packet["meshes"] = pack_detail(detail, BOUNDS, origin_y=-10)
    for mesh in packet["meshes"]:
      mesh["kind"] = "quartier207-v241"
    runtime[mode] = packet
    counts[mode] = dict(
      triangles=len(detail.triangles),
      roles=dict(Counter(t[2] for t in detail.triangles)),
      surfaces=audits,
      vertices=sum(
        len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"]
      ),
      indices=sum(len(base64.b64decode(m["indices"])) // 4 for m in packet["meshes"]),
    )
  write(RUNTIME, runtime)
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      sourceSha256=sha(SOURCE),
      runtimeSha256=sha(RUNTIME),
      runtimeJsonBytes=RUNTIME.stat().st_size,
      runtimeGzipBytes=len(gzip.compress(RUNTIME.read_bytes(), mtime=0)),
      bounds=BOUNDS,
      sourceParents=[b["id"] for b in source["buildings"]],
      sourceSheets={
        b["id"]: sum(len(p["surfaces"]) for p in b["parts"])
        for b in source["buildings"]
      },
      counts=counts,
      sourceGeometryTransferred=False,
      sourceGeometryRemoved=False,
    ),
  )
  return {
    mode: {k: v for k, v in c.items() if k != "surfaces"} for mode, c in counts.items()
  }


if __name__ == "__main__":
  print(build())
