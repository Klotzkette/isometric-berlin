"""Complete university envelopes and individually fitted architectural cues.

Every official leaf stays in the retained source. All window grids, cladding
sections and small joinery are explicitly reference-guided display estimates.
Only the named-source transaction may retire an earlier owner.
"""

from __future__ import annotations

import base64
import gzip
import json
import math
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_federal_ministries_v321 import (
  packed,
  plane_faces,
  shifted_source,
  source_shell,
)
from build_karl_marx_allee_v161 import Detail
from build_surrounding_outlines import load_projected_polygon, world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
STYLES = {
  "hu-grimm-hegel": ("folded-campus", 0xD4CBAF, 0x53636A, 3.0, 3.5, 0.68),
  "fu-henry-ford": ("white-modern", 0xD9D7C8, 0x627D83, 2.8, 3.8, 0.78),
  "tu-mathematik": ("concrete-ribbon", 0xB7B9AE, 0x52656F, 2.9, 3.4, 0.72),
  "tu-architektur": ("exposed-frame", 0xBBBCB3, 0x50636B, 3.0, 3.4, 0.78),
  "tu-udk-bibliothek": ("ochre-library", 0xBCAD89, 0x455B68, 2.8, 3.75, 0.46),
  "fu-holzlaube": ("grey-cedar", 0x98978C, 0x536C70, 2.9, 3.35, 0.68),
  "hwr-schoeneberg": ("urban-stone", 0xD0C4AC, 0x5D7177, 3.2, 3.7, 0.55),
  "bht-wedding": ("engineering-campus", 0xC2C3B6, 0x526B75, 3.3, 3.5, 0.68),
  "hu-adlershof": ("science-campus", 0xC7C6B7, 0x526F79, 3.2, 3.5, 0.72),
  "htw-treskowallee": ("historic-school", 0xC4AB89, 0x53656C, 3.1, 3.7, 0.46),
  "ash-main": ("red-ochre-campus", 0xB26951, 0x557179, 2.8, 3.45, 0.59),
  "ash-extension": ("pale-new-campus", 0xC8C5B5, 0x586B74, 3.0, 3.45, 0.62),
  "ehb": ("garden-campus", 0xD0C7B0, 0x5A7275, 3.2, 3.5, 0.57),
  "khsb": ("historic-campus", 0xC7B395, 0x5C6C72, 3.1, 3.7, 0.48),
  "hwr-lichtenberg": ("ribbon-campus", 0xC3BFAE, 0x4C7079, 2.75, 3.4, 0.70),
  "htw-wilhelminenhof": ("industrial-brick", 0xB78460, 0x52696D, 3.4, 3.7, 0.63),
  "udk-hardenberg": ("historic-academy", 0xD0BC94, 0x4F6268, 3.15, 4.2, 0.52),
  "weissensee": ("bauhaus-campus", 0xCCC3AA, 0x4D6870, 2.8, 3.45, 0.64),
}
BHT_PARENTS = {
  "DEBE01YYK0003tI7",
  "DEBE01YYK000448O",
  "DEBE01YYK0003tqP",
  "DEBE01YYK0003xxH",
}


def ash_extension(site):
  """Current mapped outline plus the architect's public plan and official 39m.

  Only the overall tower height is published metrically. The two lower roof
  planes, the internal zoning line and entrance undercut are display estimates.
  These records deliberately carry no invented official LoD2 leaf identity.
  """
  outline = shape(site["mapped"][0]["geometry"])
  # These two exact original mapped vertices bound the curved tower's neck.
  tower = outline.intersection(box(15940, -1832, 15985.4, -1790))
  lower = outline.difference(tower)
  # Preserve the complete mapped footprint; the union is checked independently.
  zones = [(tower, 0.0, 39.0, "tower-39m"), (lower, 0.0, 18.8, "five-storey-wing")]
  parts = []
  for geometry, bottom, top, key in zones:
    for index, poly in enumerate(
      [geometry] if geometry.geom_type == "Polygon" else geometry.geoms
    ):
      rings = [
        list(poly.exterior.coords)[:-1],
        *[list(r.coords)[:-1] for r in poly.interiors],
      ]
      surfaces = [
        {
          "kind": "RoofSurface",
          "rings": [[[x, top, z] for x, z in ring] for ring in rings],
        }
      ]
      for ring in rings:
        for a, b in zip(ring, ring[1:] + ring[:1]):
          surfaces.append(
            {
              "kind": "WallSurface",
              "rings": [
                [
                  [a[0], bottom, a[1]],
                  [b[0], bottom, b[1]],
                  [b[0], top, b[1]],
                  [a[0], top, a[1]],
                ]
              ],
            }
          )
      parts.append(
        {
          "id": f"ash-current-mapped-{key}-{index}",
          "ring": rings[0],
          "holes": rings[1:],
          "ground_y_m": bottom,
          "top_y_m": top,
          "surfaces": surfaces,
          "sourcePolicy": "published current footprint and 39m tower; lower roof/zoning display estimates",
        }
      )
  if (
    unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
    .symmetric_difference(outline)
    .area
    > 1e-7
  ):
    raise ValueError("Current ASH mapped footprint was not retained completely")
  return [{"id": "osm/1227439417+official-2026-height", "parts": parts}]


def read(path):
  raw = Path(path).read_bytes()
  return json.loads(gzip.decompress(raw) if str(path).endswith(".gz") else raw)


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  Path(path).write_bytes(
    gzip.compress(raw, mtime=0) if str(path).endswith(".gz") else raw
  )


def independent_cells(detail, base=3.0):
  """Sample complete source surfaces on the independent two-metre lattice."""
  cells = {}
  for triangle, color, _ in detail.triangles:
    a, b, c = np.asarray(triangle, dtype=float)
    steps = max(
      1,
      math.ceil(
        max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b)) / 0.95
      ),
    )
    ii, jj = np.triu_indices(steps + 1)
    samples = (
      a + (ii / steps)[:, None] * (b - a) + ((jj - ii) / steps)[:, None] * (c - a)
    )
    tone = int(color[0]) << 16 | int(color[1]) << 8 | int(color[2])
    for row in np.unique(
      np.floor((samples - np.array([0, base, 0])) / 2).astype(int), axis=0
    ):
      cells[tuple(map(int, row))] = tone
  return cells


def native_runs(cells, key, base=3.0):
  """Losslessly merge adjacent equal-colour cells without any raster change."""

  def runs(values):
    values.sort()
    start = end = values[0]
    result = []
    for value in [*values[1:], None]:
      if value is not None and value == end + 1:
        end = value
        continue
      result.append((start, end))
      start = end = value
    return result

  lines = defaultdict(list)
  for (x, y, z), tone in cells.items():
    lines[(y, z, tone)].append(x)
  slabs = defaultdict(list)
  for (y, z, tone), xs in sorted(lines.items()):
    for x0, x1 in runs(xs):
      slabs[(x0, x1, y, tone)].append(z)
  stacks = defaultdict(list)
  for (x0, x1, y, tone), zs in sorted(slabs.items()):
    for z0, z1 in runs(zs):
      stacks[(x0, x1, z0, z1, tone)].append(y)
  rows = []
  for (x0, x1, z0, z1, tone), ys in sorted(stacks.items()):
    for y0, y1 in runs(ys):
      rows.append(
        [
          (x0 + x1 + 1),
          base + (y0 + y1 + 1),
          (z0 + z1 + 1),
          (x1 - x0 + 1) * 2,
          (y1 - y0 + 1) * 2,
          (z1 - z0 + 1) * 2,
          tone,
        ]
      )
  origin = np.floor(np.asarray(rows)[:, :3].min(axis=0))
  values = np.asarray([r[:6] for r in rows])
  values[:, :3] -= origin
  values = np.rint(values * 100).astype(int)
  if values.min() < 0 or values.max() > 65535:
    raise ValueError("Finite native rows exceed exact centimetre extent")
  palette = sorted({r[6] for r in rows})

  def encode(values, kind):
    return base64.b64encode(np.asarray(values, dtype=kind).tobytes()).decode()

  return {
    "key": key,
    "native": True,
    "origin": origin.tolist(),
    "count": len(rows),
    "columns": [encode(values[:, i], "<u2") for i in range(6)],
    "tones": encode([palette.index(r[6]) for r in rows], "u1"),
    "palette": palette,
  }, rows


def native_fronts(cells, base=3.0):
  """Fit independent cardinal fronts only to actual exposed native cell faces."""
  planes = defaultdict(list)
  for x, y, z in sorted(cells):
    for axis, sign in [(0, -1), (0, 1), (2, -1), (2, 1)]:
      neighbour = (x + sign, y, z) if axis == 0 else (x, y, z + sign)
      if neighbour in cells:
        continue
      plane = ((x if axis == 0 else z) + (1 if sign > 0 else 0)) * 2
      along = (z if axis == 0 else x) * 2
      planes[(axis, plane, sign)].append(
        box(along, base + y * 2, along + 2, base + (y + 1) * 2)
      )
  result = []
  for (axis, plane, sign), squares in sorted(planes.items()):
    union = unary_union(squares)
    polygons = [union] if union.geom_type == "Polygon" else list(union.geoms)
    for polygon in polygons:
      lo, bottom, hi, top = polygon.bounds
      if hi - lo < 4 or top - bottom < 6 or polygon.area < 24:
        continue
      result.append(
        {
          "owner": "native-source-plane",
          "a": [plane, 0] if axis == 0 else [0, plane],
          "d": [0, 1] if axis == 0 else [1, 0],
          "n": [sign, 0] if axis == 0 else [0, sign],
          "range": [lo + 0.15, hi - 0.15, bottom + 0.15, top - 0.15],
          "polygon": [list(p) for p in polygon.exterior.coords[:-1]],
          "holes": [[list(p) for p in h.coords[:-1]] for h in polygon.interiors],
          "voids": [],
        }
      )
  return result


def assemble():
  source = read(GEO / "universities-v322-source.json.gz")
  preserved = {
    b["id"] for b in read(GEO / "adlershof-kuehn-v261-source.json.gz")["buildings"]
  }
  models, sites, navigation, audit = [], [], [], []
  # This retained union already includes every v230 geographic predecessor.
  # Later finite named additions are included explicitly, never inferred from
  # broad packet bounding rectangles.
  scope_names = [
    "bounds-marzahn-v230-retained.geojson",
    "bounds-marzahn-v230.geojson",
    "bounds-named-v306.geojson",
    "bounds-stralau-v299.geojson",
    "bounds-playgrounds-v255.geojson",
  ]
  old_scope = unary_union(
    [world(load_projected_polygon(GEO / name)) for name in scope_names]
  )
  complements = []
  retained = {}
  for chunk in read(GEO / "alt-mitte-v169/source-manifest.json")["chunks"]:
    for record in read(GEO / "alt-mitte-v169" / chunk["file"])["buildings"]:
      retained[record["id"]] = record
  for key, site in source["sites"].items():
    families = [
      f
      for f in site["families"]
      if not (key == "hu-adlershof" and f["id"] in preserved)
      and not (key == "bht-wedding" and f["id"] not in BHT_PARENTS)
      and not (key == "hu-grimm-hegel" and f["id"] == "DEBE01YYK00007Xu")
    ]
    if key == "ash-extension":
      families = ash_extension(site)
    if not families:
      # ASH's current extension has a measured OSM footprint but is absent from
      # this LoD2 edition. Do not silently fabricate an official building here.
      audit.append(
        {"site": key, "status": "retained-mapped-extension-needs-current-height-proof"}
      )
      continue
    parts = [p for family in families for p in family["parts"]]
    style, wall, glass, pitch, storey, ratio = STYLES[key]
    target = (
      5.2 if key.startswith("tu-") or key in {"bht-wedding", "hu-grimm-hegel"} else 3.0
    )
    # The adjoining FU mat already has this shared rigid datum. Preserve it
    # rather than dropping the new northern library down to a different floor.
    datums = []
    shifted = []
    for family in families:
      delta = target - min(p["ground_y_m"] for p in family["parts"])
      if family["id"] in retained:
        delta = retained[family["id"]]["verticalTransform"]["offsetY"] + 30
      if key == "fu-holzlaube":
        delta = 3.55 - 18.488
      datums.append(
        {
          "parent": family["id"],
          "rigidYOffsetM": delta,
          "method": "unchanged Alt-Mitte source datum"
          if family["id"] in retained
          else "shared FU mat datum"
          if key == "fu-holzlaube"
          else "family minimum aligned to existing local ground; not a terrain survey",
        }
      )
      shifted.extend(
        {**shifted_source(p, delta), "parentId": family["id"]} for p in family["parts"]
      )
    detail = source_shell(shifted, wall)
    # The four engineering houses are not one neutral campus block. Preserve
    # Beuth's brick reading beside Grashof's pale technical grid.
    if key == "bht-wedding":
      detail.triangles = []
      for parent in families:
        tone = 0xA2674D if parent["id"] == "DEBE01YYK0003xxH" else wall
        detail.triangles.extend(
          source_shell(
            [p for p in shifted if p["parentId"] == parent["id"]], tone
          ).triangles
        )
    drawn = packed(detail, key + "-complete-source", False, precise=True)
    models.append(drawn)
    native_base = 5.2 if key.startswith("tu-") or key == "bht-wedding" else 3.0
    cells = independent_cells(detail, native_base)
    native, native_rows = native_runs(cells, key + "-independent-native", native_base)
    models.append(native)
    faces = plane_faces(shifted, {}, max_faces=48)
    # Bodies are complete; fitting selection is finite and does not imply that
    # unselected rear walls or small annexes were omitted from the model.
    sites.append(
      {
        "key": key,
        "style": style,
        "palette": [wall, glass, 0x9DA6A2],
        "pitch": pitch,
        "storey": storey,
        "ratio": ratio,
        "parents": [f["id"] for f in families],
        "partIds": [p["id"] for p in shifted],
        "faces": faces,
        "nativeFaces": native_fronts(cells, native_base),
      }
    )
    for p in shifted:
      roofs = [
        triangle
        for s in p["surfaces"]
        if s["kind"] == "RoofSurface"
        for triangle in __import__("build_alt_mitte_v169").triangulate(s["rings"])
      ]
      navigation.append(
        {
          "site": key,
          "id": p["id"],
          "ring": p["ring"],
          "holes": p["holes"],
          "groundY": p["ground_y_m"],
          "topY": p["top_y_m"],
          "roofTriangles": roofs,
        }
      )
    union = unary_union([Polygon(p["ring"], p["holes"]) for p in shifted])
    audit.append(
      {
        "site": key,
        "parents": len(families),
        "parts": len(parts),
        "drawnTriangles": drawn["triangles"],
        "nativeRuns": len(native_rows),
        "nativeCells": len(cells),
        "selectedFittingFaces": len(faces),
        "sourceAreaM2": union.area,
        "datums": datums,
      }
    )
    campus = unary_union([shape(m["geometry"]) for m in site["mapped"]])
    complement = campus.difference(old_scope)
    if complement.area > 0.01:
      ground = Detail()
      ground_parts = (
        [complement] if complement.geom_type == "Polygon" else list(complement.geoms)
      )
      for gi, poly in enumerate(ground_parts):
        if poly.geom_type != "Polygon" or poly.area <= 0.000001:
          continue
        rings = [
          list(poly.exterior.coords)[:-1],
          *[list(r.coords)[:-1] for r in poly.interiors],
        ]
        surface = {
          "kind": "RoofSurface",
          "rings": [[[x, 3.0, z] for x, z in ring] for ring in rings],
        }
        triangles = __import__("build_alt_mitte_v169").triangulate(surface["rings"])
        ground.triangles.extend(
          (t, (154, 163, 140), "exact new named-campus ground complement")
          for t in triangles
        )
        navigation.append(
          {
            "site": key,
            "id": key + "-new-ground-" + str(gi),
            "ring": rings[0],
            "holes": rings[1:],
            "groundY": 3.0,
            "topY": 3.0,
            "roofTriangles": triangles,
          }
        )
      models.append(packed(ground, key + "-new-ground", False, precise=True))
      # Independent native floors contain only complete cardinal cells inside
      # the exact new complement; no cell expands the authorised campus.
      x0, z0, x1, z1 = complement.bounds
      ground_cells = {
        (x, 0, z): 0x9AA38C
        for x in range(math.floor(x0 / 2), math.ceil(x1 / 2))
        for z in range(math.floor(z0 / 2), math.ceil(z1 / 2))
        if complement.covers(box(x * 2, z * 2, x * 2 + 2, z * 2 + 2))
      }
      if ground_cells:
        q, ground_rows = native_runs(ground_cells, key + "-new-ground-native", 1.0)
        # The exact two-metre cell's top is 3m and matches the drawn floor.
        models.append(q)
      complements.append(
        {
          "site": key,
          "mappedCampusAreaM2": campus.area,
          "oldScopeOverlapM2": campus.intersection(old_scope).area,
          "newOnlyAreaM2": complement.area,
          "geometry": shapely.geometry.mapping(complement),
          "nativeWholeCells": len(ground_cells),
        }
      )
    print(key, audit[-1], flush=True)
  write(
    GEO / "universities-v322-scope-complement.json.gz",
    {
      "schemaVersion": 1,
      "retainedScopeFiles": scope_names,
      "sites": complements,
      "policy": "Exact named mapped campus minus all retained earlier scope. No new surrounding district; all previous scope remains unchanged.",
    },
  )
  return {
    "schemaVersion": 1,
    "sites": sites,
    "models": models,
    "navigation": navigation,
  }, audit


if __name__ == "__main__":
  result, audit = assemble()
  write(DATA / "universitiesArchitectureV322.json", result)
  write(
    GEO / "universities-v322-model-audit.json", {"schemaVersion": 1, "sites": audit}
  )
  raw = (DATA / "universitiesArchitectureV322.json").read_bytes()
  print("runtime", len(raw), "gzip", len(gzip.compress(raw, mtime=0)))
