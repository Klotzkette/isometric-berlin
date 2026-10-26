"""Finite Zoo West evidence and restaurant shells; no city/source rewrites."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_tiergarten_werkhof_v275 import roof_at

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/zooWestV276Evidence.json.gz"
DEST = ROOT / "src/app/src/data/zooWestV276.json"
# Raw source Y = NHN - 30, before the retained zoo ground translation.
# These thin reconstruction ranges are estimates supported by the point evidence,
# not a claim to a complete surveyed replacement roof.
CORRECTIONS = {
  "DEBE3Dvqp4td5FVH": (7.80, 9.20, "bDOM-supported roof approximation"),
  "DEBE3DYGt4szGakz": (7.65, 8.50, "partly occluded transition roof estimate"),
  "DEBE3DI70n23Xdak": (7.65, 8.15, "bDOM-supported roof approximation"),
  "DEBE3DqgzekHK7XE": (7.50, 7.50, "bDOM-supported roof approximation"),
  "DEBE01YYK0003Ucs": (6.50, 6.91, "bDOM-supported open canopy approximation"),
}


def corrected(part: dict[str, Any]) -> dict[str, Any]:
  """Keep every XZ, ring and face; correct only five named vertical profiles."""
  p = copy.deepcopy(part)
  roofs = [
    v[1]
    for s in p["surfaces"]
    if s["kind"] == "RoofSurface"
    for r in s["rings"]
    for v in r
  ]
  low, high, base = min(roofs), max(roofs), p["ground_y_m"]
  change = CORRECTIONS.get(p["id"])
  delta = 5.2 - base
  for s in p["surfaces"]:
    for r in s["rings"]:
      for v in r:
        y = v[1]
        if change:
          eave, ridge, _ = change
          y = (
            base + (y - base) / (low - base) * (eave - base)
            if y <= low
            else eave + (y - low) / max(1e-9, high - low) * (ridge - eave)
          )
        v[1] = round(y + delta, 6)
  p["ground_y_m"] = 5.2
  p["top_y_m"] = round((change[1] if change else p["top_y_m"]) + delta, 6)
  p["height_m"] = p["top_y_m"] - 5.2
  p["correction"] = change
  return p


def build() -> dict[str, Any]:
  """Retain source shells and derive independent one-metre native roofs."""
  evidence = json.loads(gzip.decompress(SOURCE.read_bytes()))
  source = json.loads(
    (ROOT / "src/app/src/data/zooGroundsV165Source.json").read_bytes()
  )
  features = {r["id"]: r for r in evidence["osm"]}
  originals = [
    p
    for owner in evidence["parents"]
    if owner["id"] != "DEBE01YYK0002RFN"
    for p in owner["parts"]
  ]
  cooked = [corrected(p) for p in originals]
  ring = features["25396899"]["coordinates"][:-1]
  base, top = 5.2, 9.76  # bDOM 39.70 - DGM1 35.14; display ground stays 5.2.
  surfaces = [
    {
      "kind": "WallSurface",
      "rings": [
        [[a[0], base, a[1]], [b[0], base, b[1]], [b[0], top, b[1]], [a[0], top, a[1]]]
      ],
    }
    for a, b in zip(ring, ring[1:] + ring[:1], strict=True)
  ]
  surfaces.append({"kind": "RoofSurface", "rings": [[[x, top, z] for x, z in ring]]})
  cooked.append(
    dict(
      id="25396899",
      ring=ring,
      holes=[],
      ground_y_m=base,
      top_y_m=top,
      height_m=top - base,
      surfaces=surfaces,
      correction=[4.56, "OSM footprint with bDOM/DGM supported flat roof estimate"],
    )
  )
  all_footprints = unary_union([Polygon(p["ring"], p["holes"]) for p in cooked])
  surfaces_out, native_rows, parts, fittings = [], [], [], []
  for p in cooked:
    canopy = p["id"] == "DEBE01YYK0003Ucs" or p["id"] in [
      q["id"]
      for o in evidence["parents"]
      if o["id"] == "DEBE01YYK0003V9i"
      for q in o["parts"]
    ]
    poly = Polygon(p["ring"], p["holes"])
    roofs = []
    wall = 0xB5A281 if p["id"] != "25396899" else 0xDBD6C4
    roof = 0x555850 if p["id"] != "25396899" else 0x8B8D7B
    for s in p["surfaces"]:
      triangles = triangles_for(s["rings"])
      if s["kind"] == "RoofSurface":
        roofs.extend(triangles)
      if canopy and s["kind"] != "RoofSurface":
        continue
      surfaces_out.append(
        dict(color=roof if s["kind"] == "RoofSurface" else wall, triangles=triangles)
      )
    cells = []
    x0, z0, x1, z1 = poly.bounds
    for x in range(math.floor(x0), math.ceil(x1)):
      for z in range(math.floor(z0), math.ceil(z1)):
        overlap = poly.intersection(box(x, z, x + 1, z + 1))
        if overlap.area < 0.035:
          continue
        pt = overlap.representative_point()
        y = roof_at(roofs, pt.x, pt.y)
        assert y is not None
        y = math.ceil((y - 1e-8) * 4) / 4
        cells.append([x, z, y])
        if not canopy:
          native_rows.append(
            [x + 0.5, (5.2 + y - 0.2) / 2, z + 0.5, 1, y - 0.2 - 5.2, 1, 0, wall]
          )
        native_rows.append([x + 0.5, y - 0.1, z + 0.5, 1, 0.2, 1, 0, roof])
    # Source-perimeter posts preserve clearance below mapped open canopies.
    posts = []
    if canopy:
      for i, (x, z) in enumerate(p["ring"]):
        if i % 2:
          continue
        y = roof_at(roofs, x, z)
        if y is not None:
          posts.append(
            [x, (5.2 + y - 0.2) / 2, z, 0.13, y - 0.2 - 5.2, 0.13, 0, 0x6F604A]
          )
    for i, (a, b) in enumerate(
      zip(p["ring"], p["ring"][1:] + p["ring"][:1], strict=True)
    ):
      length = math.dist(a, b)
      if length < 3 or canopy:
        continue
      dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
      nx, nz = dz, -dx
      mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      if poly.contains(Point(mid[0] + nx * 0.3, mid[1] + nz * 0.3)):
        nx, nz = -nx, -nz
      # A complete public outside facet, never an interior joint.
      outer = LineString(
        [(a[0] + nx * 0.3, a[1] + nz * 0.3), (b[0] + nx * 0.3, b[1] + nz * 0.3)]
      )
      if outer.intersection(all_footprints).length > 0.1:
        continue
      for u in [1.1 + j * 2.2 for j in range(max(0, int((length - 1) / 2.2)))]:
        x, z = a[0] + u * dx, a[1] + u * dz
        y = roof_at(roofs, x, z)
        if y is None or y < 8.2:
          continue
        fittings.append(
          dict(
            owner=p["id"][-8:],
            a=[x, z],
            t=[dx, dz],
            n=[nx, nz],
            width=min(1.5, length - 1),
            top=min(8.1, y - 0.4),
            base=5.7,
            color=0x873C35 if p["id"] != "25396899" else 0x576151,
          )
        )
    native_shape = unary_union([box(x, z, x + 1, z + 1) for x, z, _ in cells])
    assert native_shape.geom_type == "Polygon"
    parts.append(
      dict(
        sourceId=p["id"][-8:],
        ring=p["ring"],
        holes=p["holes"],
        minY=5.2,
        maxY=p["top_y_m"],
        roofTriangles=roofs,
        nativeCells=cells,
        nativeRing=list(native_shape.exterior.coords)[:-1],
        nativeHoles=[list(h.coords)[:-1] for h in native_shape.interiors],
        openCanopy=canopy,
        posts=posts,
        correction=p["correction"],
      )
    )
  wolf = next(h for h in source["habitats"] if h["id"] == "48164524")
  safe = Polygon(wolf["ring"]).buffer(-2)
  retained_features = {
    f["id"]: f
    for f in json.loads(
      (
        ROOT / "geo_data/regierungsviertel/raw/zoo-v165/selected-features.json"
      ).read_bytes()
    )
    if f["type"] == "way"
  }
  exclusions = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in source["parts"]]
    + [Polygon(retained_features[w["id"]]["coordinates"]) for w in source["waters"]]
    + [
      LineString(retained_features[p["id"]]["coordinates"]).buffer(p["width"] / 2 + 0.8)
      for p in source["paths"]
    ]
  )
  safe = safe.difference(exclusions)
  wolves = [[-2275, 949, 0], [-2265, 949, math.pi], [-2280, 953, 0.4]]
  for x, z, _ in wolves:
    assert safe.covers(Point(x, z).buffer(1.4))
  shrubs = []
  for x in range(-2295, -2245, 6):
    for z in range(936, 964, 6):
      if (
        (x + z) % 4
        and safe.covers(Point(x, z).buffer(1.5))
        and min(math.hypot(x - a, z - b) for a, b, _ in wolves) > 4
      ):
        shrubs.append([x, z])
  return dict(
    schemaVersion=1,
    groundY=5.2,
    sourceSha256=hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    parts=parts,
    surfaces=surfaces_out,
    nativeRows=native_rows,
    fittings=fittings,
    wolves=wolves,
    wolfRing=wolf["ring"],
    wolfSpecies="Canis lupus lupus",
    shrubs=shrubs,
    retainedUnresolved=["K0002RFN"],
  )


if __name__ == "__main__":
  result = build()
  DEST.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    json.dumps(
      dict(
        parts=len(result["parts"]),
        triangles=sum(len(s["triangles"]) for s in result["surfaces"]),
        native=len(result["nativeRows"]),
        fittings=len(result["fittings"]),
        shrubs=len(result["shrubs"]),
        bytes=DEST.stat().st_size,
      )
    )
  )
