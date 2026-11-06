"""Finite public Senate fronts on exact already delivered source walls.

Only V321 derivatives are written. All original packet/body/roof/nav/line bytes
stay unchanged. AKP3 retains its existing glass and adds only visible joinery.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from scripts import build_alt_mitte_v169 as old_mitte
from scripts.build_cluster_facades_v320 import (
  FrontMesh,
  arrays,
  door_bounds,
  fnv,
  normalized_style,
  part_fingerprint,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
KIND = "berlin-senate-v321"
BASELINE = "4123bd3464d68d26d5119ee451e88db3fe53dcc6"
SITES = {
  "nordstern": {
    "owner": "DEBE07YY900008bT",
    "label": "Senatsverwaltung für Justiz und Verbraucherschutz / Nordsternhaus",
    "address": "Salzburger Straße 21–25,10825 Berlin",
    "references": [
      "https://www.berlin.de/sen/justv/ueber-uns/nordsternhaus/",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066376",
    ],
    "style": {
      "floorPitchM": 4.8,
      "bayPitchM": 3.5,
      "windowWidthRatio": 0.47,
      "windowHeightRatio": 0.64,
      "frameRgb": [203, 194, 171],
      "plinthRgb": [172, 164, 146],
      "glassRgb": [82, 104, 112],
      "glassTopRgb": [106, 124, 131],
      "frameWidthM": 0.11,
      "eaveBands": 2,
    },
  },
  "olex": {
    "owner": "DEBE07YY9000020I",
    "label": "Senatsverwaltung für Wirtschaft,Energie und Betriebe / OLEX-Haus",
    "address": "Martin-Luther-Straße105,10825 Berlin",
    "references": [
      "https://www.berlin.de/sen/web/",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09066431",
      "https://www.dhl-architekten.de/projekt/olex-haus-fenstersanierung/",
    ],
    "style": {
      "floorPitchM": 4.5,
      "bayPitchM": 3.5,
      "windowWidthRatio": 0.43,
      "windowHeightRatio": 0.62,
      "frameRgb": [214, 207, 185],
      "plinthRgb": [170, 164, 146],
      "glassRgb": [74, 98, 107],
      "glassTopRgb": [101, 121, 131],
      "frameWidthM": 0.13,
      "eaveBands": 2,
    },
  },
  "koellnpark": {
    "owner": "DEBE01YYK000066i",
    "label": "Senatsverwaltung für Mobilität,Verkehr,Klimaschutz und Umwelt",
    "address": "Am Köllnischen Park3,10179 Berlin",
    "references": [
      "https://www.berlin.de/sen/uvk/ueber-uns/impressum/",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035352",
    ],
  },
}


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: dict) -> None:
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def source_triangles(packet: dict, kind: str) -> Counter:
  """Bind every complete triangle to actual encoded coordinate words."""
  found = Counter()
  for part in packet["meshes"]:
    if part["kind"] != kind:
      continue
    p, _, ix = arrays(part)
    found.update(tuple(sorted(tuple(map(int, p[i])) for i in t)) for t in ix)
  return found


def rectangle_proof(
  packet: dict,
  a: list,
  b: list,
  low: float,
  high: float,
  triangles: Counter | None = None,
) -> list:
  """Require the two original wall triangles; a nav polygon alone is insufficient."""
  origin = np.asarray(packet["origin"])
  points = np.rint(
    (
      np.array(
        [[a[0], low, a[1]], [b[0], low, b[1]], [b[0], high, b[1]], [a[0], high, a[1]]]
      )
      - origin
    )
    * 100
  ).astype(int)
  if triangles is None:
    triangles = source_triangles(packet, "city")
  for pair in [((0, 1, 2), (0, 2, 3)), ((0, 1, 3), (1, 2, 3))]:
    wanted = [tuple(sorted(tuple(map(int, points[i])) for i in t)) for t in pair]
    if all(triangles[t] == 1 for t in wanted):
      return [list(map(list, t)) for t in wanted]
  return []


def owner_polygon(packet: dict, owner: str) -> Polygon:
  ox, _, oz = packet["origin"]
  return unary_union(
    [
      Polygon(
        [(x + ox, z + oz) for x, z in b["ring"]],
        [[(x + ox, z + oz) for x, z in r] for r in b["holes"]],
      )
      for b in packet["nav"]["buildings"]
      if b.get("sourceId") == owner
    ]
  )


def filled_exterior(polygon: Polygon) -> Polygon:
  """Court air is not a public street approach."""
  return unary_union(
    [Polygon(p.exterior) for p in getattr(polygon, "geoms", [polygon])]
  )


def source_fronts(packet: dict, site: dict, full: Polygon, native: bool) -> list:
  """Use exterior actual source edges; exclude tile cuts, court and party fronts."""
  owner = site["owner"]
  origin = np.asarray(packet["origin"])
  own = owner_polygon(packet, owner)
  public_outline = filled_exterior(full)
  faces = []
  triangles = source_triangles(packet, "city")
  occupied = unary_union(
    [
      owner_polygon(packet, x["sourceId"])
      for x in packet["nav"]["buildings"]
      if x.get("sourceId") != owner
    ]
  )
  for building in packet["nav"]["buildings"]:
    if building.get("sourceId") != owner:
      continue
    low = (
      packet["nav"]["groundY"] + building.get("groundOffset", 0) + building["minHeight"]
    )
    high = (
      packet["nav"]["groundY"] + building.get("groundOffset", 0) + building["height"]
    )
    ring = np.asarray(building["ring"]) + origin[[0, 2]]
    for a, b in zip(ring, np.roll(ring, -1, axis=0)):
      width = float(np.linalg.norm(b - a))
      if width < (1.5 if native else 5) or high - low < 15:
        continue
      d = (b - a) / width
      if native and a[0] != b[0] and a[1] != b[1]:
        continue
      normal = np.array([-d[1], d[0]])
      centre = (a + b) / 2
      if own.covers(Point(*(centre + normal * 0.3))):
        normal = -normal
      # Finite public elevations: Salzburger/head face at Nordstern, and the
      # explicitly described ornamented park front at OLEX. Other source fronts
      # stay exactly as delivered; this is not an all-campus facade survey.
      if owner == SITES["nordstern"]["owner"] and not (
        normal[0] > 0.65 and (native or normal[1] < -0.4)
      ):
        continue
      if owner == SITES["olex"]["owner"] and normal[0] > -0.95:
        continue
      # A2m raster stair must not create a complete extra window axis for every
      # tiny wall. The independent native rhythm uses4m column spacing instead
      # of multiplying the5.3m drawn axes into twice as many windows.
      if native and width < 3 and math.floor(float(centre[1]) / 2) % 2:
        continue
      # Full owner outline is assembled over all its source chunks. It excludes
      # artificial tile boundaries even when the clipped nav calls them exterior.
      if any(
        public_outline.covers(Point(*(a + (b - a) * t + normal * 3)))
        for t in [0.1, 0.5, 0.9]
      ):
        continue
      if any(
        occupied.covers(Point(*(a + (b - a) * t + normal * 1.2)))
        for t in [0.1, 0.5, 0.9]
      ):
        continue
      proof = rectangle_proof(packet, a.tolist(), b.tolist(), low, high, triangles)
      if not proof:
        continue
      # The mansard is already part of the retained envelope; no extra office
      # windows are inferred in that roof zone.
      fitting_high = min(
        high - 1.0, low + (23 if site["owner"] == SITES["nordstern"]["owner"] else 22)
      )
      faces.append(
        dict(
          owner=owner,
          a=a.tolist(),
          b=b.tolist(),
          normal=normal.tolist(),
          low=low,
          high=fitting_high,
          sourceLow=low,
          sourceHigh=high,
          sourceRectangleWords=proof,
        )
      )
  return faces


def trim_prism(
  mesh: FrontMesh,
  face: dict,
  u0: float,
  y0: float,
  u1: float,
  y1: float,
  back: float,
  front: float,
  rgb: list,
) -> None:
  """Five visible faces; source-facing back is intentionally absent."""
  mesh.rectangle(face, u0, y0, u1, y1, front, rgb)
  mesh.returns(face, u0, y0, u1, y1, back, front, rgb)


def add_regular_front(
  mesh: FrontMesh, face: dict, site: dict, native: bool, doors: list
) -> dict:
  style = normalized_style(site["style"])
  width = math.dist(face["a"], face["b"])
  low, high = face["low"], face["high"]
  floors = 5
  bays = max(1, round((width - 0.8) / (4.2 if native else style["bayPitchM"])))
  pitch = (high - low - 1.1) / floors
  bay = width / bays
  window_width = min(2.2, bay * style["windowWidthRatio"])
  window_height = min(2.8, pitch * style["windowHeightRatio"])
  bounds = door_bounds(face, doors, native)
  skipped = 0
  for row in range(floors):
    y = low + 0.55 + (row + 0.5) * pitch
    for col in range(bays):
      u = (col + 0.5) * bay
      w = window_width / 2
      h = window_height / 2
      frame = style["frameWidthM"]
      if any(
        box(u - w - frame, y - h - frame, u + w + frame, y + h + frame).intersects(
          box(*door)
        )
        for door in bounds
      ):
        skipped += 1
        continue
      # A thin continuous stone surround behind the inset glazing has exactly
      # the same visible four borders without hidden return-face infill.
      mesh.rectangle(
        face,
        u - w - frame,
        y - h - frame,
        u + w + frame,
        y + h + frame,
        0.10,
        style["frameRgb"],
      )
      mesh.rectangle(
        face,
        u - w,
        y - h,
        u + w,
        y + h,
        0.15,
        style["glassRgb"],
        None if native else style["glassTopRgb"],
      )
      mesh.rectangle(face, u - 0.035, y - h, u + 0.035, y + h, 0.18, style["frameRgb"])
      transom = y - h + window_height * 0.72
      mesh.rectangle(
        face, u - w, transom - 0.035, u + w, transom + 0.035, 0.18, style["frameRgb"]
      )
      mesh.rectangle(
        face,
        u - w - 0.11,
        y - h - 0.13,
        u + w + 0.11,
        y - h - 0.04,
        0.22,
        style["plinthRgb"],
      )
      mesh.local_quad(
        face,
        [
          (u - w - 0.11, y - h - 0.04, 0.10),
          (u + w + 0.11, y - h - 0.04, 0.10),
          (u + w + 0.11, y - h - 0.04, 0.22),
          (u - w - 0.11, y - h - 0.04, 0.22),
        ],
        style["plinthRgb"],
      )
  for i in [0, 1]:
    mesh.rectangle(
      face,
      0.12,
      high - 0.20 - i * 0.16,
      width - 0.12,
      high - 0.11 - i * 0.16,
      0.19,
      style["frameRgb"],
    )
  report = {
    "windows": floors * bays - skipped,
    "floors": floors,
    "bays": bays,
    "newWindowGrid": True,
    "roofWindowInference": False,
    "mappedEntranceCellsOmitted": skipped,
  }
  if site["owner"] == SITES["nordstern"]["owner"]:
    # The LDA specifically identifies continuous inter-storey travertine bands.
    width = math.dist(face["a"], face["b"])
    pitch = (face["high"] - face["low"] - 0.7) / report["floors"]
    for i in range(1, report["floors"]):
      y = face["low"] + 0.35 + i * pitch
      trim_prism(
        mesh, face, 0.12, y - 0.09, width - 0.12, y + 0.09, 0.07, 0.24, [194, 184, 160]
      )
    report["horizontalStoneBands"] = report["floors"] - 1
  return report


def actual_koelln_windows(packet: dict, record: dict, all_records: list) -> list:
  """Replay old glazing geometry only, never add another window grid."""
  original = source_triangles(packet, "alt-mitte-v169")
  occupied = unary_union([old_mitte.footprint(b) for b in all_records])
  building = filled_exterior(old_mitte.footprint(record))
  origin = np.asarray(packet["origin"])
  windows = []
  for part in record["parts"]:
    for si, surface in enumerate(part["surfaces"]):
      if surface["kind"] != "WallSurface":
        continue
      detail = old_mitte.facade(
        surface["rings"], part["groundY"], part["topY"], occupied
      )
      glass = [t for t in detail.triangles if t[2] == "window glazing"]
      for i in range(0, len(glass), 2):
        ts = glass[i : i + 2]
        if len(ts) != 2:
          raise ValueError("Incomplete original glazing pair")
        wanted = [
          tuple(
            sorted(
              tuple(map(int, p))
              for p in np.rint((np.array(t[0]) - origin) * 100).astype(int)
            )
          )
          for t in ts
        ]
        if not all(original[t] == 1 for t in wanted):
          continue
        points = np.unique(np.array([v for t in ts for v in t[0]]), axis=0)
        if len(points) != 4:
          raise ValueError("Original glass is not one complete rectangle")
        normal3 = old_mitte.normal_of(surface["rings"][0])
        normal = np.array([normal3[0], normal3[2]])
        centre = points.mean(0)
        if normal[0] > -0.95:
          continue
        # Only public outer fronts, no newly ornamented court windows.
        if building.covers(Point(*(centre[[0, 2]] + normal * 2))):
          continue
        low, high = float(points[:, 1].min()), float(points[:, 1].max())
        ends = sorted(set(tuple(v[[0, 2]]) for v in points))
        a, b = map(np.array, ends)
        windows.append(
          dict(
            owner=record["id"],
            sourcePart=part["id"],
            sourceSurface=si,
            a=a.tolist(),
            b=b.tolist(),
            normal=normal.tolist(),
            low=low,
            high=high,
            retainedGlazingWords=[list(map(list, t)) for t in wanted],
          )
        )
  return windows


def native_koelln_windows(packet: dict, shape: Polygon) -> list:
  """Actual old cardinal glass-paint rectangles determine native joinery."""
  shape = filled_exterior(shape)
  origin = np.asarray(packet["origin"])
  groups = defaultdict(list)
  for part in packet["meshes"]:
    if part["kind"] != "alt-mitte-v169":
      continue
    p, c, ix = arrays(part)
    for t in ix:
      if not np.all(c[t] == [22, 38, 44]):
        continue
      points = p[t] / 100 + origin
      centre = points.mean(0)
      if shape.boundary.distance(Point(*centre[[0, 2]])) > 1.6:
        continue
      for axis in [0, 2]:
        if np.ptp(points[:, axis]) > 0.000001:
          continue
        along = 2 - axis
        poly = Polygon(points[:, [along, 1]])
        if poly.area:
          groups[(axis, round(float(points[0, axis]), 2))].append(poly)
  result = []
  for (axis, constant), polys in groups.items():
    union = unary_union(polys)
    for p in getattr(union, "geoms", [union]):
      if p.geom_type != "Polygon":
        continue
      x0, y0, x1, y1 = p.bounds
      if x1 - x0 < 0.5 or y1 - y0 < 1 or abs(p.area - (x1 - x0) * (y1 - y0)) > 1e-5:
        continue
      a, b = (
        ([constant, x0], [constant, x1])
        if axis == 0
        else ([x0, constant], [x1, constant])
      )
      normal = np.array([1.0, 0.0]) if axis == 0 else np.array([0.0, 1.0])
      centre = (np.array(a) + b) / 2
      if shape.covers(Point(*(centre + normal * 0.3))):
        normal = -normal
      if normal[0] > -0.95:
        continue
      if shape.covers(Point(*(centre + normal * 2))):
        continue
      result.append(
        dict(
          owner=SITES["koellnpark"]["owner"],
          a=a,
          b=b,
          normal=normal.tolist(),
          low=y0,
          high=y1,
          retainedNativeGlassUnionArea=p.area,
        )
      )
  return result


def add_koelln_joinery(mesh: FrontMesh, windows: list, native: bool) -> int:
  for face in windows:
    width = math.dist(face["a"], face["b"])
    y = face["low"] + (face["high"] - face["low"]) * 0.72
    # Old drawn glass/frame/sill depths are .085/.11/.125m. This new member's
    # whole prism starts .045m in front of its retained glazing plane; its front
    # is .115m farther out, i.e. beyond every old member. Native is independently
    # cardinal and bound to the actual existing glass-painted source faces.
    back, front = (0.045, 0.115) if not native else (0.06, 0.17)
    trim_prism(
      mesh, face, 0.05, y - 0.035, width - 0.05, y + 0.035, back, front, [201, 195, 174]
    )
  return len(windows)


def compile_packets() -> tuple[dict, dict]:
  manifest = read(PUBLIC / "manifest.json")
  target_owners = {s["owner"] for s in SITES.values()}
  packets = {}
  inputs = {}
  owner_polys = defaultdict(list)
  for d in manifest["chunks"]:
    # Finite exact primary descriptor neighbourhoods, no whole-city rebuild.
    if d["id"] not in {"-5_6", "-5_7", "-4_6", "-4_7", "5_1"}:
      continue
    for mode in ["drawn", "minecraft"]:
      path = PUBLIC / d[mode]["url"]
      raw = path.read_bytes()
      packet = json.loads(gzip.decompress(raw))
      if not any(
        b.get("sourceId") in target_owners for b in packet["nav"]["buildings"]
      ):
        continue
      key = f"{mode}:{d['id']}"
      packets[key] = packet
      inputs[key] = {
        "url": d[mode]["url"],
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
      }
      if mode == "drawn":
        for owner in target_owners:
          p = owner_polygon(packet, owner)
          if not p.is_empty:
            owner_polys[owner].append(p)
  full = {k: unary_union(v) for k, v in owner_polys.items()}
  records = []
  for tile in ["392_5819", "392_5818", "391_5819", "393_5819"]:
    path = GEO / f"alt-mitte-v169/source-{tile}-00.json.gz"
    if path.exists():
      records.extend(read(path)["buildings"])
  koelln = next(b for b in records if b["id"] == SITES["koellnpark"]["owner"])
  doors = read(GEO / "house-doors-v233-evidence.json.gz")["doors"]
  plans = {}
  reports = []
  counts = Counter()
  for key, packet in sorted(packets.items()):
    native = key.startswith("minecraft:")
    mesh = FrontMesh(packet["origin"])
    owners = []
    site_reports = []
    for name, site in SITES.items():
      if not any(
        b.get("sourceId") == site["owner"] for b in packet["nav"]["buildings"]
      ):
        continue
      if name == "koellnpark":
        windows = (
          native_koelln_windows(packet, old_mitte.footprint(koelln))
          if native
          else actual_koelln_windows(packet, koelln, records)
        )
        count = add_koelln_joinery(mesh, windows, native)
        if not count:
          raise ValueError(f"Missing retained AKP glazing in{key}")
        report = {
          "site": name,
          "retainedWindowCentres": windows,
          "newTransoms": count,
          "newWindowGrids": 0,
          "oldGlazingRetired": 0,
        }
      else:
        faces = source_fronts(packet, site, full[site["owner"]], native)
        fitted = [
          dict(face=face, report=add_regular_front(mesh, face, site, native, doors))
          for face in faces
        ]
        if not fitted:
          continue
        report = {"site": name, "sourceFaces": fitted}
      owners.append(site["owner"])
      site_reports.append(report)
    if not mesh.indices:
      continue
    mesh.compact()
    part = mesh.payload()["meshes"][0]
    part["kind"] = KIND
    lines = packet.get("lines")
    line_guard = fnv(lines["positions"], lines.get("colors", "")) if lines else None
    plans[key] = {
      "origin": packet["origin"],
      "navGuard": 0,
      "preparedNavGuard": 0,
      "lineGuard": line_guard,
      "preparedLineGuard": line_guard,
      "records": [
        {"mesh": i, "kind": p["kind"], "fingerprint": part_fingerprint(p)}
        for i, p in enumerate(packet["meshes"])
      ],
      "append": part,
      "appendFingerprint": part_fingerprint(part),
      "retire": [],
      "owners": owners,
    }
    reports.append(
      {
        "key": key,
        "sites": site_reports,
        "vertices": len(mesh.positions),
        "triangles": len(mesh.indices) // 3,
      }
    )
    counts["nativeTriangles" if native else "drawnTriangles"] += len(mesh.indices) // 3
    if sum(len(arrays(p)[0]) for p in packet["meshes"]) + len(mesh.positions) > 400000:
      raise ValueError("Existing vertex cap")
    if (
      sum(len(arrays(p)[2]) * 3 for p in packet["meshes"]) + len(mesh.indices) > 2400000
    ):
      raise ValueError("Existing index cap")
  for name, site in SITES.items():
    for mode in ["drawn", "minecraft"]:
      if not any(
        key.startswith(mode + ":") and site["owner"] in p["owners"]
        for key, p in plans.items()
      ):
        raise ValueError(f"Incomplete actual site family{name}/{mode}")
  runtime = {"schemaVersion": 1, "keys": sorted(plans), "packets": plans}
  proof = {
    "schemaVersion": 1,
    "baseline": BASELINE,
    "policy": "Public exterior estimates on exact delivered walls/glazing. Source bodies,roof,courts,nav,line and every original packet byte retained; no retirement.",
    "references": SITES,
    "sourceInputs": inputs,
    "reports": reports,
    "counts": dict(counts),
    "sourceBodiesRetired": 0,
    "sourceFittingsRetired": 0,
    "sourceBytesWritten": 0,
    "sites": 3,
    "requiredPreparedGuardFinalization": True,
  }
  return runtime, proof


def main() -> None:
  runtime, proof = compile_packets()
  write(DATA / "berlinSenateV321.json", runtime)
  write(GEO / "berlin-senate-v321-evidence.json.gz", proof)
  print(
    json.dumps(
      {
        "keys": runtime["keys"],
        "counts": proof["counts"],
        "rawBytes": (DATA / "berlinSenateV321.json").stat().st_size,
        "gzipBytes": len(
          gzip.compress((DATA / "berlinSenateV321.json").read_bytes(), mtime=0)
        ),
      }
    )
  )


if __name__ == "__main__":
  main()
