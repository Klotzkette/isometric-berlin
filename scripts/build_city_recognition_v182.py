"""Small additive recognition skins on measured civic/theatre envelopes.

No existing source mesh is replaced. LoD2 edges remain measured; the thin
window/cornice subdivisions are explicitly non-surveyed display estimates.
"""

from __future__ import annotations

import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, building_footprint

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
RAW = DATA / "raw/v182-recognition"
DEST = ROOT / "src/app/src/data/cityRecognitionV182.json"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform

# IDs are selected from the dated retained extract, not fuzzy runtime names.
TARGETS = {
  "Staatsoper Unter den Linden": ("opera-mitte", ["way/15976892"]),
  "Rathaus Tiergarten": ("multipolygons", ["way/311048538"]),
  "Rathaus Mitte": ("multipolygons", ["way/24271931"]),
  "Altes Stadthaus": ("multipolygons", ["relation/23745"]),
  "Schillertheater": ("multipolygons", ["way/367502474"]),
  "Deutsche Oper Berlin": ("oper", ["relation/13408555"]),
  "rbb Fernsehzentrum": ("rbb", ["relation/3215"]),
  "Haus des Rundfunks": ("rbb", ["relation/3216"]),
  "Estrel Hotel": (
    "estrel",
    [
      f"way/{n}"
      for n in [47037005, 365566557, 365566565, 365568381, 365569349, 365569350]
    ],
  ),
}


def identity(f: dict[str, Any]) -> str:
  """Preserve the native way/relation identity."""
  p = f["properties"]
  return f"way/{p['osm_way_id']}" if p.get("osm_way_id") else f"relation/{p['osm_id']}"


def target_geometries() -> dict[str, Any]:
  """Read retained OSM selection caches; never select administrative boundaries."""
  clipped = DATA / "city-recognition-v182-osm.json"
  if clipped.exists():
    return {
      f["name"]: transform(PROJECT, shape(f["geometry"]))
      for f in json.loads(clipped.read_text())["features"]
    }
  result = {}
  evidence = []
  for name, (filename, ids) in TARGETS.items():
    fs = json.loads((RAW / f"{filename}.json").read_text())["features"]
    selected = [f for f in fs if identity(f) in ids]
    assert {identity(f) for f in selected} == set(ids), name
    result[name] = unary_union(
      [transform(PROJECT, shape(f["geometry"])) for f in selected]
    )
    evidence.append(
      {
        "name": name,
        "osmIds": ids,
        "geometry": mapping(unary_union([shape(f["geometry"]) for f in selected])),
      }
    )
  clipped.write_text(
    json.dumps(
      {
        "source": "Geofabrik Berlin retained 2026-09-29 extract",
        "license": "ODbL-1.0",
        "features": evidence,
      },
      separators=(",", ":"),
    )
    + "\n"
  )
  return result


def extract() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
  """Keep exact official surface rings and heights beside OSM identities."""
  targets = target_geometries()
  scope = unary_union(list(targets.values()))
  existing = {
    p["id"]: p
    for p in json.loads(
      (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
    )["buildings"]
  }
  core_data = json.loads(
    (ROOT / "src/app/src/data/surroundingCityScope.json").read_text()
  )["core"]
  core = Polygon(core_data["ring"], core_data["holes"])
  records, tiles = [], []
  for archive in sorted((DATA / "raw/lod2").glob("LoD2_*.zip")):
    tx, ty = map(int, archive.stem.removeprefix("LoD2_").split("_"))
    if not box(tx * 1000, ty * 1000, (tx + 1) * 1000, (ty + 1) * 1000).intersects(
      scope
    ):
      continue
    tiles.append(
      {
        "file": archive.name,
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
      }
    )
    with zipfile.ZipFile(archive) as zipped:
      for member in zipped.namelist():
        if not member.endswith((".gml", ".xml")):
          continue
        with zipped.open(member) as stream:
          for _, parent in ET.iterparse(stream, events=("end",)):
            if parent.tag != f"{{{NS['bldg']}}}Building":
              continue
            footprint = building_footprint(parent)
            candidates = (
              []
              if footprint is None
              else [
                (footprint.intersection(g).area / max(footprint.area, 1), name)
                for name, g in targets.items()
                if footprint.intersects(g)
              ]
            )
            if not candidates or max(candidates)[0] < 0.45:
              parent.clear()
              continue
            _, name = max(candidates)
            pid = parent.get(GML_ID)
            heights = [
              float(v)
              for pos in parent.findall(".//gml:posList", NS)
              for v in (pos.text or "").split()[2::3]
            ]
            datum = min(heights)
            source_ids = [
              p.get(GML_ID)
              for p in parent.iter()
              if p.tag.endswith(("BuildingPart", "Building"))
            ]
            matches = [existing[s[-8:]] for s in source_ids if s and s[-8:] in existing]
            matches.extend(
              existing[s.rsplit("/", 1)[1][-8:]]
              for s in TARGETS[name][1]
              if s.rsplit("/", 1)[1][-8:] in existing
            )
            # Original core source is already normalized; outer envelopes are y=3.
            centre = footprint.representative_point()
            fallback_ground = (
              5.2 if core.covers(Point(centre.x - 389500, 5820000 - centre.y)) else 3.0
            )
            ground = (
              min(p["y0_dm"] / 10 for p in matches) if matches else fallback_ground
            )
            surfaces = []
            for surface in parent.iter():
              kind = surface.tag.split("}")[-1]
              if kind not in {"WallSurface", "RoofSurface"}:
                continue
              for poly in surface.findall(".//gml:Polygon", NS):
                rings = []
                for pos in poly.findall(".//gml:posList", NS):
                  values = list(map(float, (pos.text or "").split()))
                  ring = [
                    [
                      round(values[i] - 389500, 3),
                      round(values[i + 2] - datum + ground, 3),
                      round(5820000 - values[i + 1], 3),
                    ]
                    for i in range(0, len(values), 3)
                  ]
                  if ring and ring[0] == ring[-1]:
                    ring.pop()
                  if len(ring) >= 3:
                    rings.append(ring)
                if rings:
                  surfaces.append({"kind": kind, "rings": rings})
            records.append(
              {
                "name": name,
                "parentId": pid,
                "partIds": source_ids,
                "tile": archive.name,
                "groundY": ground,
                "groundNHN": datum,
                "heightM": max(heights) - datum,
                "osmIds": TARGETS[name][1],
                "surfaces": surfaces,
              }
            )
            parent.clear()
  assert set(TARGETS) <= {r["name"] for r in records}, (
    set(TARGETS) - {r["name"] for r in records},
    [(r["name"], r["parentId"]) for r in records],
  )
  return records, tiles


def build(records: list[dict[str, Any]]) -> dict[str, Any]:
  """Bake thin source edges and clipped facade cues, keeping all old geometry."""
  segments: list[list[float]] = []
  boxes: list[list[float]] = []
  seen: set[tuple[Any, ...]] = set()
  names = []

  def line(a: Any, b: Any, color: int = 0x62696A) -> None:
    aa, bb = tuple(round(float(v), 3) for v in a), tuple(round(float(v), 3) for v in b)
    key = (*sorted([aa, bb]), color)
    if aa != bb and key not in seen:
      seen.add(key)
      segments.append([*aa, *bb, color])

  for record in records:
    first_line, first_box = len(segments), len(boxes)
    name, ground = record["name"], record["groundY"]
    for surface in record["surfaces"]:
      for ring in surface["rings"]:
        for a, b in zip(ring, [*ring[1:], ring[0]]):
          line(a, b)
      if surface["kind"] != "WallSurface":
        continue
      ring = np.array(surface["rings"][0])
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
      )
      d = np.array([b[0] - a[0], 0, b[2] - a[2]], dtype=float)
      length = float(np.linalg.norm(d))
      if length < 5:
        continue
      d /= length
      # Correct normal from official ring orientation; point is offset only 9 cm.
      n = np.zeros(3)
      for i in range(1, len(ring) - 1):
        n += np.cross(ring[i] - ring[0], ring[i + 1] - ring[0])
      norm = float(np.linalg.norm(n))
      if norm < 0.01 or abs(n[1] / norm) > 0.03:
        continue
      n /= norm
      poly = Polygon(
        [
          [(float(np.dot(np.array(p) - a, d)), p[1]) for p in r]
          for r in surface["rings"]
        ][0],
        [
          [(float(np.dot(np.array(p) - a, d)), p[1]) for p in r]
          for r in surface["rings"][1:]
        ],
      )
      if not poly.is_valid:
        poly = poly.buffer(0)
      if poly.is_empty:
        continue
      lo, bottom, hi, top = poly.bounds
      if top - bottom < 3.5:
        continue
      # Deutsche Oper's Bismarckstraße wall is intentionally blind stone.
      if name == "Deutsche Oper Berlin" and n[2] > 0.6 and np.mean(ring[:, 2]) > 663:
        continue
      if (
        name == "Staatsoper Unter den Linden"
        and n[2] < -0.6
        and np.mean(ring[:, 2]) < 246
      ):
        # The north portico must never become a regular office-window grid.
        continue
      # Theatre glazing only in the low foyer, never windows in the stage tower.
      if name in {"Schillertheater", "Deutsche Oper Berlin"} and bottom > ground + 10:
        continue
      pitch = (
        3.6 if name in {"Rathaus Mitte", "rbb Fernsehzentrum", "Estrel Hotel"} else 4.2
      )
      ymax = min(
        top - 1.2, ground + (12 if "theater" in name.lower() or "Oper" in name else 60)
      )
      if name == "Staatsoper Unter den Linden":
        ymax = min(ymax, ground + 18)
      color = 0x3F657B if name == "Rathaus Mitte" else 0x506575
      for y in np.arange(max(bottom + 1.8, ground + 2.2), ymax, pitch):
        for u in np.arange(lo + 2, hi - 1, 4):
          width = (
            2.35
            if name in {"Rathaus Mitte", "rbb Fernsehzentrum", "Estrel Hotel"}
            else 1.35
          )
          height = 1.65 if pitch < 4 else 2.0
          if not poly.buffer(-0.03).covers(
            box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
          ):
            continue
          p = a + d * u + n * 0.09
          boxes.append(
            [
              round(p[0], 3),
              round(float(y), 3),
              round(p[2], 3),
              width,
              height,
              0.08,
              round(-math.atan2(d[2], d[0]), 6),
              color,
            ]
          )
          for dy in [-height / 2, height / 2]:
            line(
              p + d * (-width / 2) + np.array([0, y + dy - p[1], 0]),
              p + d * (width / 2) + np.array([0, y + dy - p[1], 0]),
              0xBDC5BF,
            )
      # Horizontal floor registers make the source skyscrapers legible far away.
      if name in {"Rathaus Mitte", "rbb Fernsehzentrum", "Estrel Hotel"}:
        for y in np.arange(ground + pitch, top, pitch):
          clipped = poly.intersection(LineString([(lo, y), (hi, y)]))
          for part in (
            [clipped]
            if clipped.geom_type == "LineString"
            else getattr(clipped, "geoms", [])
          ):
            if part.geom_type == "LineString":
              pts = [
                a + d * u + n * 0.14 + np.array([0, yy - a[1], 0])
                for u, yy in part.coords
              ]
              for aa, bb in zip(pts, pts[1:]):
                line(aa, bb, 0xB0BABF)
    names.append(
      {k: v for k, v in record.items() if k != "surfaces"}
      | {
        "firstSegment": first_line,
        "segmentCount": len(segments) - first_line,
        "firstBox": first_box,
        "boxCount": len(boxes) - first_box,
      }
    )

  # The generalized source omits the Stadthaus tower. Its 80m overall height
  # is published by Berlin; the local drum divisions and DOP-aligned centre
  # below are explicitly a bounded outline interpretation, not surveyed parts.
  x, z, base = 2676.0, 317.5, 3.0
  rings = [
    (27, 9),
    (31, 9),
    (33, 7),
    (45, 7),
    (48, 8),
    (50, 6.2),
    (62, 6.2),
    (64, 7.0),
    (67, 6.3),
  ]
  for y, radius in rings:
    pts = [
      (
        x + math.cos(a * math.tau / 24) * radius,
        base + y,
        z + math.sin(a * math.tau / 24) * radius,
      )
      for a in range(24)
    ]
    for aa, bb in zip(pts, [*pts[1:], pts[0]]):
      line(aa, bb, 0xB3A58D)
  for lo, hi, radius in [(33, 45, 7), (50, 62, 6.2)]:
    for i in range(16):
      a = i * math.tau / 16
      xx, zz = x + math.cos(a) * radius, z + math.sin(a) * radius
      boxes.append([xx, base + (lo + hi) / 2, zz, 0.5, hi - lo, 0.5, 0, 0xC4B59B])
  for i in range(24):
    a = i * math.tau / 24
    previous = None
    for step in range(9):
      phi = step * math.pi / 16
      p = (
        x + math.cos(a) * math.cos(phi) * 6.3,
        base + 67 + math.sin(phi) * 9.0,
        z + math.sin(a) * math.cos(phi) * 6.3,
      )
      if previous:
        line(previous, p, 0x596F69)
      previous = p
  # A restrained Fortuna silhouette; no unsupported facial/inscription detail.
  boxes.extend(
    [
      [x, base + 78.0, z, 0.65, 3.3, 0.55, 0, 0x627A68],
      [x, base + 79.7, z, 0.5, 0.6, 0.5, 0, 0x627A68],
    ]
  )
  line((x - 1.4, base + 78.8, z), (x, base + 78.4, z), 0x627A68)
  line((x, base + 78.4, z), (x + 1.2, base + 79.7, z), 0x627A68)

  # Two raised rbb slabs are evident in the official orthophoto/operator
  # account but missing from the generalized 22.5m source envelope. Keep that
  # source untouched and supply thin plan/height-estimate recognition lines.
  for cx, cz, width, depth, height in [
    (-6594.8, 956.0, 14.0, 61.0, 55.5),
    (-6580.5, 1006.3, 14.5, 30.5, 58.8),
  ]:
    for y in [23, *np.arange(26.5, height, 3.3), height]:
      pts = [
        (cx - width / 2, 3 + y, cz - depth / 2),
        (cx + width / 2, 3 + y, cz - depth / 2),
        (cx + width / 2, 3 + y, cz + depth / 2),
        (cx - width / 2, 3 + y, cz + depth / 2),
      ]
      for aa, bb in zip(pts, [*pts[1:], pts[0]]):
        line(aa, bb, 0x819099)
    for dx in [-width / 2, width / 2]:
      for dz in [-depth / 2, depth / 2]:
        line((cx + dx, 26, cz + dz), (cx + dx, 3 + height, cz + dz), 0xA3A8A3)

  # The blue artwork is stacked glass cubes, not an opaque needle. Published
  # height and exact OSM anchor; cube count, taper and basin width are estimates.
  x, north = PROJECT(13.2721555, 52.5093574)
  x, z = x - 389500, 5820000 - north
  for i in range(10):
    side = 2.75 - i * 0.22
    boxes.append(
      [
        round(x, 3),
        3.15 + (i + 0.5) * 1.5,
        round(z, 3),
        side,
        1.48,
        side,
        0,
        [0x226BBE, 0x3187D0, 0x2864A5][i % 3],
      ]
    )
  for sign in [-1, 1]:
    line((x - 3.2, 3.18, z + sign * 3.2), (x + 3.2, 3.18, z + sign * 3.2), 0x438BBE)
    line((x + sign * 3.2, 3.18, z - 3.2), (x + sign * 3.2, 3.18, z + 3.2), 0x438BBE)

  # Retained v179 anchor and profile; finer secondary steel cross-members and
  # restaurant glazing supplement (never replace) the original 147 m hairline.
  source = json.loads((DATA / "outer-thin-outlines-v179.json").read_text())
  mast = next(a for a in source["anchors"] if a["name"] == "Funkturm")
  east, north = PROJECT(mast["lon"], mast["lat"])
  x, z = east - 389500, 5820000 - north
  corners = [(-1, -1), (-1, 1), (1, 1), (1, -1)]

  def half(y: float) -> float:
    sections = [(0, 10), (25, 7), (55, 4), (85, 3), (126, 2.5), (138, 0.7), (147, 0.15)]
    for (lo, a), (hi, b) in zip(sections, sections[1:]):
      if lo <= y <= hi:
        return a + (b - a) * (y - lo) / (hi - lo)
    raise ValueError(y)

  for y in range(5, 126, 5):
    w0, w1 = half(y), half(y + 5)
    for (aa, bb), (cc, dd) in zip(corners, [*corners[1:], corners[0]]):
      line(
        (x + aa * w0, 3.55 + y, z + bb * w0),
        (x + cc * w0, 3.55 + y, z + dd * w0),
        0x78756A,
      )
      line(
        (x + aa * w0, 3.55 + y, z + bb * w0),
        (x + cc * w1, 8.55 + y, z + dd * w1),
        0x8D8473,
      )
  for y, width, h in [(55, 15, 3), (126, 10, 2)]:
    for side in [-1, 1]:
      boxes.append(
        [
          round(x, 3),
          3.55 + y + h / 2,
          round(z + side * width / 2, 3),
          width,
          h,
          0.12,
          0,
          0x708E98,
        ]
      )
      boxes.append(
        [
          round(x + side * width / 2, 3),
          3.55 + y + h / 2,
          round(z, 3),
          0.12,
          h,
          width,
          0,
          0x708E98,
        ]
      )
  return {
    "schemaVersion": 1,
    "features": names,
    "segments": segments,
    "boxes": boxes,
    "blueObelisk": {
      "osmId": "node/558903414",
      "heightM": 15,
      "displayEstimate": "Ten glass-coloured stacked cubes and 6.4m basin outline; count/taper/basin are not surveyed",
    },
    "sourceConflicts": [
      {
        "name": "Altes Stadthaus",
        "sourceParentHeightM": 27.53,
        "publishedTowerHeightM": 80,
        "displayCentre": [2676, 317.5],
        "policy": "Source body retained; official DOP locates the omitted western tower. Drum/dome/figure subdivisions are estimated thin recognition outlines.",
      },
      {
        "name": "rbb Fernsehzentrum",
        "sourceParentHeightM": 22.5,
        "displayTowerHeightsM": [55.5, 58.8],
        "policy": "Source body retained. Operator describes two raised slabs with 13/14 storeys; DOP gives alignment. Height and local plan divisions are display estimates, not measured LoD2.",
      },
    ],
    "policy": "Additive source edges and shallow window skins only; complete earlier city is retained. No photo, texture, new solid shell or hidden mass.",
  }


def main() -> None:
  """Generate the bounded runtime overlay and reproducible source manifest."""
  records, tiles = extract()
  payload = build(records)
  DEST.write_text(json.dumps(payload, separators=(",", ":")) + "\n")
  (DATA / "city-recognition-v182-evidence.json").write_text(
    json.dumps(
      {
        "tiles": tiles,
        "targets": TARGETS,
        "features": payload["features"],
        "policy": payload["policy"],
        "facadeStatus": "Procedural, non-surveyed window/band rhythm clipped to exact official source wall polygons. No unsupported inscriptions or logos.",
        "sourceConflicts": payload["sourceConflicts"],
      },
      indent=2,
    )
    + "\n"
  )
  print(
    json.dumps(
      {
        "features": len(records),
        "segments": len(payload["segments"]),
        "boxes": len(payload["boxes"]),
        "bytes": DEST.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  main()
