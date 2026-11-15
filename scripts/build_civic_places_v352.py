"""Finite V352 industrial architecture, from complete official building families.

Only the three named, previously absent parents are admitted. Every original
wall/roof polygon survives a disclosed vertical translation to the viewer datum.
Photographic window/stone/clinker relief is an estimate clipped to actual walls;
no texture, fictional tenant, interior or future development is introduced.
"""

from __future__ import annotations

import argparse
import copy
import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

import numpy as np
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_breitscheid_towers_v161 import triangles_for
from build_fuel_packets_v351 import Mesh, rgb
from build_karl_marx_allee_v161 import Detail
from build_rixdorf_v304 import native_model, navigation

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "civic-places-v352-source.json.gz"
EVIDENCE = GEO / "civic-places-v352-evidence.json.gz"
PREDECESSORS = GEO / "civic-places-v352-predecessors.json.gz"
ALLOWED = {
  "DEBE05YYQ00001kM": ("siemens-schaltwerk", "Siemens Schaltwerk-Hochhaus"),
  "DEBE07YY90000174": (
    "gillette-north",
    "Gillette historic factory: northern administration and hall",
  ),
  "DEBE07YY900007Wm": ("gillette-east", "Gillette historic factory: eastern wing"),
}


def read(p):
  b = Path(p).read_bytes()
  return json.loads(gzip.decompress(b) if str(p).endswith(".gz") else b)


def sha(b):
  return hashlib.sha256(b).hexdigest()


def numeric(value):
  if isinstance(value, np.generic):
    return value.item()
  raise TypeError(type(value).__name__)


def encode(v):
  return (
    json.dumps(
      v, ensure_ascii=False, separators=(",", ":"), allow_nan=False, default=numeric
    )
    + "\n"
  ).encode()


def write(p, v):
  b = encode(v)
  Path(p).write_bytes(gzip.compress(b, mtime=0) if str(p).endswith(".gz") else b)


def pieces(g):
  return (
    [g]
    if isinstance(g, Polygon)
    else [
      p for p in getattr(g, "geoms", []) if isinstance(p, Polygon) and p.area > 1e-8
    ]
  )


def footprint(parent):
  return unary_union([Polygon(p["ring"], p["holes"]) for p in parent["parts"]])


def navpoly(p, origin):
  return translate(Polygon(p["ring"], p.get("holes", [])), origin[0], origin[2])


def facade(detail, surface, kind, family, ground, *, disjoint=True):
  """Source-clipped photographic frame rhythm, never a new building envelope."""
  ring = surface["rings"][0]
  pairs = [(a, b) for a, b in zip(ring, ring[1:] + ring[:1]) if abs(a[1] - b[1]) < 0.02]
  if not pairs:
    return 0
  a, b = max(pairs, key=lambda ab: math.dist(ab[0], ab[1]))
  a = np.array(a)[[0, 2]]
  b = np.array(b)[[0, 2]]
  length = np.linalg.norm(b - a)
  if length < 3:
    return 0
  d = (b - a) / length
  n = np.array([-d[1], d[0]])
  mid = (a + b) / 2
  positive = family.covers(Point(*(mid + n * 0.12)))
  negative = family.covers(Point(*(mid - n * 0.12)))
  if positive and negative:
    return 0
  if positive:
    n = -n
  rings = [
    [[float((np.array(q)[[0, 2]] - a).dot(d)), q[1]] for q in r]
    for r in surface["rings"]
  ]
  plane = Polygon(rings[0], rings[1:]).buffer(0)
  if plane.is_empty:
    return 0
  lo, hi = plane.bounds[1], plane.bounds[3]
  count = 0
  layers = []

  def emit(polygon, color, role, depth):
    for piece in pieces(polygon):
      rings = []
      for ring in [piece.exterior, *piece.interiors]:
        points = [
          [
            float(a[0] + d[0] * x + n[0] * depth),
            float(yy),
            float(a[1] + d[1] * x + n[1] * depth),
          ]
          for x, yy in list(ring.coords)[:-1]
        ]
        normal = np.sum(np.cross(points, np.roll(points, -1, axis=0)), axis=0)
        if normal[0] * n[0] + normal[2] * n[1] < 0:
          points.reverse()
        rings.append(points)
      for tri in triangles_for(rings):
        detail.triangles.append((tri, color, role))

  def rect(u, y, w, h, color, role, depth=0.085):
    nonlocal count
    q = box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    # Require a complete rectangle, including a narrow border, on this source sheet.
    if not plane.buffer(-0.025).covers(q):
      return False
    if disjoint:
      layers.append((q, color, role))
      count += 1
      return True
    points = [
      [
        float(a[0] + d[0] * x + n[0] * depth),
        float(yy),
        float(a[1] + d[1] * x + n[1] * depth),
      ]
      for x, yy in list(q.exterior.coords)[:-1]
    ]
    # Native surface sampling offsets in the triangle normal direction. Preserve
    # the outward wall side even when the source sheet's base runs backwards.
    normal = np.cross(
      np.subtract(points[1], points[0]), np.subtract(points[2], points[0])
    )
    if normal[0] * n[0] + normal[2] * n[1] < 0:
      points.reverse()
    for tri in triangles_for([points]):
      detail.triangles.append((tri, color, role))
    count += 1
    return True

  frame = (218, 219, 205)
  glass = (67, 88, 90)
  # Siemens photographs show narrow white multipane industrial frames; Gillette
  # has wider pale-stone-framed windows and a continuous attic glazing band.
  pitch = 4.1 if kind == "siemens" else 3.55
  width = 2.65 if kind == "siemens" else 1.55
  columns = max(1, round(length / pitch))
  levels = [
    ground + 2.25 + i * (4.05 if kind == "siemens" else 4.1)
    for i in range(12 if kind == "siemens" else 5)
  ]
  for y in levels:
    if not lo + 0.9 < y < hi - 1:
      continue
    for col in range(columns):
      u = (col + 0.5) * length / columns
      w = min(width, length / columns * 0.72)
      h = 2.05 if kind == "siemens" else 2.15
      if rect(u, y, w + 0.2, h + 0.2, frame, "estimated window reveal", 0.065):
        rect(u, y, w, h, glass, "estimated window glazing", 0.085)
        for dx in (-w / 3, 0, w / 3) if kind == "siemens" else (0,):
          rect(u + dx, y, 0.055, h, frame, "estimated window mullion", 0.115)
        for dy in (-h / 6, h / 6) if kind == "siemens" else (0.1,):
          rect(u, y + dy, w, 0.055, frame, "estimated window transom", 0.115)
  # Restrained source-bound cornices distinguish the historic masonry from glass.
  rect(
    length / 2,
    hi - 0.3,
    max(0.1, length - 0.2),
    0.18,
    (156, 143, 122) if kind == "siemens" else (188, 179, 158),
    "estimated eave course",
    0.12,
  )
  if kind == "gillette" and n[1] < -0.5 and 4 < length < 35:
    # The projecting central entry has tall pale stone piers. Its exact sheet
    # determines their extent; no doorway, stairs or gate are inferred.
    for u in np.arange(1.2, length - 1, 3.2):
      rect(
        float(u),
        (lo + hi) / 2,
        0.22,
        max(0.2, hi - lo - 0.8),
        (203, 197, 181),
        "estimated stone pier",
        0.13,
      )
  if disjoint:
    # One visible facade plane. Subtract the complete later colour regions
    # instead of placing full panes over full backing rectangles 2 cm apart.
    # That spacing fights in the finite browser depth buffer at city distances.
    covered = Polygon()
    for polygon, color, role in reversed(layers):
      visible = polygon.difference(covered)
      if not visible.is_empty:
        emit(visible, color, role, 0.18)
      covered = covered.union(polygon)
  return count


def audit_ground(candidate, mode, manifest, production, earlier_ground):
  grounds = []
  inputs = []
  inspected = 0
  for desc in manifest["chunks"]:
    if desc["id"].startswith("civic352-") or not box(*desc["bounds"]).intersects(
      candidate
    ):
      continue
    path = PUBLIC / desc[mode]["url"]
    raw = path.read_bytes()
    packet = read(path)
    previous = production[(desc["id"], mode)]
    if previous["rawSha256"] != sha(raw) or previous["origin"] != packet["origin"]:
      raise ValueError("Stale production predecessor capture")
    inputs.append(
      {
        "id": desc["id"],
        "path": str(path.relative_to(ROOT)),
        "sha256": sha(raw),
        "productionWordSha256": previous["productionWordSha256"],
      }
    )
    for b in previous["navigation"]["buildings"]:
      inspected += 1
      overlap = navpoly(b, previous["origin"]).intersection(candidate).area
      if overlap > 0.05:
        raise ValueError(f"Existing {mode} body overlaps {b['sourceId']}: {overlap}")
    grounds.extend(
      navpoly(g, previous["origin"]) for g in previous["navigation"]["ground"]
    )
  old = unary_union(grounds)
  sibling_inputs = [
    row for row in earlier_ground if row["geometry"].intersection(candidate).area > 1e-8
  ]
  siblings = unary_union([row["geometry"] for row in sibling_inputs])
  complement = candidate.difference(old.union(siblings))
  return complement, dict(
    inputs=inputs,
    oldBuildingsInspected=inspected,
    oldGroundArea=old.intersection(candidate).area,
    earlierNewGroundArea=siblings.intersection(candidate).area,
    earlierNewGroundInputs=[
      {k: v for k, v in row.items() if k != "geometry"} for row in sibling_inputs
    ],
    newGroundArea=complement.area,
    sourceDomain=mapping(candidate),
    newGround=mapping(complement),
    oldGeometryChanged=False,
  )


def build(task):
  source = read(SOURCE)
  assert set(p["parent"] for p in source["parents"]) == set(ALLOWED)
  assert source["baseline"] == "69810478"
  manifest = read(PUBLIC / "manifest.json")
  descriptors = []
  reports = []
  production = {(r["id"], r["mode"]): r for r in read(PREDECESSORS)["records"]}
  earlier_ground = {"drawn": [], "minecraft": []}
  groups = [
    (
      "gillette-factory",
      "Gillette historic factory, complete north and east families",
      [p for p in source["parents"] if p["parent"].startswith("DEBE07")],
    ),
    (
      "siemens-schaltwerk",
      "Siemens Schaltwerk-Hochhaus",
      [p for p in source["parents"] if p["parent"] == "DEBE05YYQ00001kM"],
    ),
  ]
  for key, label, originals in groups:
    parents = copy.deepcopy(originals)
    kind = "siemens" if key.startswith("siemens") else "gillette"
    # Same datum as the retained surrounding building exporter; exact relative
    # source roof heights and all original sheets are preserved by one translation.
    translations = {}
    for p in parents:
      delta = 3 - min(part["ground_y_m"] for part in p["parts"])
      translations[p["parent"]] = delta
      p["id"] = p["parent"]
      for part in p["parts"]:
        part["ground_y_m"] += delta
        part["top_y_m"] += delta
        for s in part["surfaces"]:
          for ring in s["rings"]:
            for q in ring:
              q[1] += delta
    parent = {"parts": [part for p in parents for part in p["parts"]]}
    family = footprint(parent)
    detail = Detail()
    surfaces = []
    material = (146, 119, 88) if kind == "siemens" else (133, 91, 72)
    for part in parent["parts"]:
      for s in part["surfaces"]:
        surfaces.append(s)
        for tri in triangles_for(s["rings"]):
          detail.triangles.append(
            (
              tri,
              (106, 109, 102) if s["kind"] == "RoofSurface" else material,
              "source " + s["kind"],
            )
          )
    source_triangles = len(detail.triangles)
    native_detail = Detail()
    native_detail.triangles = detail.triangles.copy()
    fittings = sum(
      facade(detail, s, kind, family, 3) for s in surfaces if s["kind"] == "WallSurface"
    )
    native_fittings = sum(
      facade(native_detail, s, kind, family, 3, disjoint=False)
      for s in surfaces
      if s["kind"] == "WallSurface"
    )
    assert native_fittings == fittings
    print(key, "source", source_triangles, "fittings", fittings, flush=True)
    native, caps = native_model(native_detail)
    # These are independent cardinal roof cells actually present in the Native mesh.
    native_domain = unary_union([box(*c[:4]) for c in caps])
    all_vertices = [
      v for model in [detail, native] for t, _, _ in model.triangles for v in t
    ]
    a = np.asarray(all_vertices)
    bounds = [
      float(math.floor(a[:, 0].min()) - 1),
      float(math.floor(a[:, 2].min()) - 1),
      float(math.ceil(a[:, 0].max()) + 1),
      float(math.ceil(a[:, 2].max()) + 1),
    ]
    tile = box(*bounds)
    origin = [bounds[0], -10, bounds[1]]
    host = "civic352-" + key
    desc = {"id": host, "bounds": bounds}
    modes = {}
    source_collapsed = []
    for triangle, _, role in detail.triangles[:source_triangles]:
      quantized = np.rint((np.asarray(triangle) - origin) * 100).astype(int)
      if len({tuple(p) for p in quantized}) < 3:
        source_collapsed.append(
          float(
            np.linalg.norm(
              np.cross(
                np.subtract(triangle[1], triangle[0]),
                np.subtract(triangle[2], triangle[0]),
              )
            )
            / 2
          )
        )
    for mode, model, domain in [
      ("drawn", detail, family),
      ("minecraft", native, native_domain),
    ]:
      complement, audit = audit_ground(
        domain, mode, manifest, production, earlier_ground[mode]
      )
      mesh = Mesh(origin)
      for tri, color, _ in model.triangles:
        mesh.triangle(tri, [rgb(color)] * 3)
      mesh.surface(complement, 3, rgb((144, 142, 130)))
      packed = mesh.payload()
      packed["kind"] = "civic-places-v352"
      nav = [
        body
        for p in parents
        for body in navigation(
          p, {"nativeRoofCaps": caps}, tile, origin, mode == "minecraft"
        )
      ]
      if not nav:
        raise ValueError("Empty independent building navigation")
      ground = [
        {
          "ring": [
            [round(x - origin[0], 2), round(z - origin[2], 2)]
            for x, z in list(p.exterior.coords)[:-1]
          ],
          "holes": [
            [
              [round(x - origin[0], 2), round(z - origin[2], 2)]
              for x, z in list(r.coords)[:-1]
            ]
            for r in p.interiors
          ],
        }
        for p in pieces(complement)
      ]
      packet = {
        "schemaVersion": 1,
        "origin": origin,
        "meshes": [packed],
        "nav": {"groundY": 3, "ground": ground, "water": [], "buildings": nav},
      }
      file = host + "." + mode + ".json.gz"
      write(PUBLIC / file, packet)
      raw = encode(packet)
      desc[mode] = {
        "url": file,
        "encoding": "gzip",
        "bytes": (PUBLIC / file).stat().st_size,
        "decodedBytes": len(raw),
        "sha256": sha((PUBLIC / file).read_bytes()),
      }
      earlier_ground[mode].append(
        {
          "id": host,
          "url": file,
          "sha256": desc[mode]["sha256"],
          "geometry": complement,
        }
      )
      modes[mode] = {
        "triangles": len(mesh.indices) // 3,
        "vertices": len(mesh.vertices),
        "groundAudit": audit,
        "navigationBodies": len(nav),
        "sourceRoofCaps": len(caps) if mode == "minecraft" else 0,
      }
    reports.append(
      {
        "id": key,
        "label": label,
        "parents": [p["parent"] for p in parents],
        "parts": len(parent["parts"]),
        "completeSourceSheets": len(surfaces),
        "completeSourceTriangles": source_triangles,
        "centimetreDegeneracy": {
          "count": len(source_collapsed),
          "areaSquareMetres": sum(source_collapsed),
          "maxTriangleArea": max(source_collapsed, default=0),
        },
        "sourceVerticalTranslations": translations,
        "fittingRectangles": fittings,
        "modes": modes,
      }
    )
    descriptors.append(desc)
    print(
      key, "bytes", sum(desc[m]["bytes"] for m in ["drawn", "minecraft"]), flush=True
    )
  write(task / "civic-manifest-delta.json", descriptors)
  write(
    EVIDENCE,
    {
      "schemaVersion": 1,
      "sourceSha256": sha(SOURCE.read_bytes()),
      "predecessorSha256": sha(PREDECESSORS.read_bytes()),
      "policy": __doc__,
      "sites": reports,
      "descriptors": descriptors,
      "bytes": sum(d[m]["bytes"] for d in descriptors for m in ["drawn", "minecraft"]),
      "oldSourceFilesChanged": 0,
      "runtimeBudgetChanged": False,
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--task-dir", type=Path, required=True)
  args = parser.parse_args()
  args.task_dir.mkdir(parents=True, exist_ok=True)
  build(args.task_dir)
