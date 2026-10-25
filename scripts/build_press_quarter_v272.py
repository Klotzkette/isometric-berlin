"""Step 10: source-bound Springer/taz recognition and southern street fronts."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_citywest_cinemas_v166 import footprints, polygons_of
from native_facade_clearance_v272 import NativeFacadeClearance
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DEST = ROOT / "src/app/src/data/pressQuarterV272Source.json"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
OWNERS = {
  "DEBE02YY4000042k": ("Axel-Springer Goldturm", "391_5818", "32698103", "gold"),
  "DEBE02YY400005Wf": ("Axel-Springer Silberflügel", "391_5818", "32698103", "silver"),
  "DEBE02YY40000CBT": ("Ehemaliges taz-Haus", "390_5818", "mpTI46QR", "old-taz"),
  "DEBE00YY29Q000SR": ("taz-Neubau Friedrichstraße 21", "390_5818", "6yqbDi2y", "taz"),
}
GOLD_PARTS = {"DEBE3DZjmMEK2SZD", "DEBE3DUspil8YjZO"}


def digest(value: Any) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def make_payload() -> dict:
  """Keep complete selected source parts with exact prior prism receipts."""
  parents, parts, surfaces, archives = [], [], [], []
  for tile in sorted({v[1] for v in OWNERS.values()}):
    path = GEO / f"raw/lod2/LoD2_{tile}.zip"
    with zipfile.ZipFile(path) as z:
      tree = ET.fromstring(z.read(z.namelist()[0]))
    archives.append(
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
      }
    )
    for parent in tree.findall(".//b:Building", NS):
      pid = parent.get("{" + NS["g"] + "}id")
      if pid not in OWNERS:
        continue
      name, _, legacy, kind = OWNERS[pid]
      datum = min(
        float(v)
        for e in parent.findall(".//b:GroundSurface//g:posList", NS)
        for v in e.text.split()[2::3]
      )
      parent_surfaces = []
      for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
        sid = part.get("{" + NS["g"] + "}id")
        if kind == "gold" and sid not in GOLD_PARTS:
          continue
        ss = []
        for boundary in part.findall("b:boundedBy", NS):
          for surface in boundary:
            for polygon in surface.findall(".//g:Polygon", NS):
              rings = []
              for e in polygon.findall(".//g:posList", NS):
                a = list(map(float, e.text.split()))
                ring = [
                  [
                    round(a[i] - 389500, 3),
                    round(a[i + 2] - datum + 5.2, 3),
                    round(5820000 - a[i + 1], 3),
                  ]
                  for i in range(0, len(a), 3)
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              role = surface.tag.split("}")[-1]
              color = (
                0x8B8A7B
                if role == "RoofSurface"
                else {
                  "gold": 0xBBA16D,
                  "silver": 0xB5C2C0,
                  "old-taz": 0xD8C4A0,
                  "taz": 0x667D7F,
                }[kind]
              )
              if role == "RoofSurface":
                normal = normal_of(rings[0])
                light = (
                  0.85 + 0.17 * abs(normal[1]) + 0.08 * normal[0] - 0.05 * normal[2]
                )
                channels = [
                  min(255, round(((color >> shift) & 255) * light))
                  for shift in [16, 8, 0]
                ]
                color = (channels[0] << 16) + (channels[1] << 8) + channels[2]
              ss.append(
                {
                  "partId": sid,
                  "parentId": pid,
                  "kind": role,
                  "rings": rings,
                  "sourcePolygonId": polygon.get("{" + NS["g"] + "}id"),
                  "color": color,
                  "triangles": triangles_for(rings)
                  if role in ["WallSurface", "RoofSurface"]
                  else [],
                }
              )
        foot = footprints(ss)
        pts = [p for s in ss for r in s["rings"] for p in r]
        parts.append(
          {
            "id": sid,
            "parentId": pid,
            "building": name,
            "groundY": min(p[1] for p in pts),
            "topY": max(p[1] for p in pts),
            "polygons": [
              {
                "ring": [[round(x, 3), round(z, 3)] for x, z in p.exterior.coords[:-1]],
                "holes": [
                  [[round(x, 3), round(z, 3)] for x, z in r.coords[:-1]]
                  for r in p.interiors
                ],
              }
              for p in polygons_of(foot)
            ],
          }
        )
        surfaces.extend(ss)
        parent_surfaces.extend(ss)
      parents.append(
        {
          "id": pid,
          "name": name,
          "kind": kind,
          "tile": tile,
          "groundNHN": datum,
          "groundY": 5.2,
          "legacyId": legacy,
          "sourceGeometrySha256": digest(parent_surfaces),
        }
      )
  current_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  current = json.loads(current_path.read_text())
  selected = {v[2] for v in OWNERS.values()} | {
    part["id"][-8:]
    for part in parts
    if part["parentId"] in ["DEBE02YY40000CBT", "DEBE00YY29Q000SR"]
  }
  legacy = [r for r in current["buildings"] if r["id"] in selected]
  conflicts = [
    {"legacyId": r["id"], "legacySha256": digest(r), "retainedSource": r}
    for r in legacy
  ]
  assert len(parents) == 4 and len(parts) == 13 and len(legacy) == 7
  return {
    "schemaVersion": 1,
    "parents": parents,
    "parts": parts,
    "surfaces": surfaces,
    "sourceArchives": archives,
    "legacyPrisms": legacy,
    "legacyFile": str(current_path.relative_to(ROOT)),
    "legacyFileSha256": hashlib.sha256(current_path.read_bytes()).hexdigest(),
    "sourceConflicts": conflicts,
    "licences": {"survey": "dl-de/zero-2-0", "osm": "ODbL-1.0"},
    "sourcePolicy": "Complete selected measured tower and taz parts; gold tower is two high parts of a wider unchanged campus parent. Seven exact coarse prisms yield. Original archives remain complete. Facade glazing, metal lattice, lettering, sculpture and colors are reference-estimated fittings; no photo pixels.",
  }


def recognition(p: dict, blocks: list) -> tuple[list, list, list, list]:
  """Surface-clipped fittings; artwork and lettering are authored interpretations."""
  import geopandas as gpd
  from build_west_venues_v260 import face_axes
  from shapely.geometry import Point, box
  from shapely.ops import unary_union

  rows, native, ribs, labels = [], [], [], []
  clearance = NativeFacadeClearance(blocks)
  kinds = {v["id"]: v["kind"] for v in p["parents"]}
  feet = {
    v["id"]: footprints([s for s in p["surfaces"] if s["parentId"] == v["id"]])
    for v in p["parents"]
  }

  def put(f, u, y, w, h, color, role, out=0.22, depth=0.12):
    if (
      not f["poly"]
      .buffer(0.015)
      .covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    ):
      return
    a = f["a"] + f["d"] * u + f["n"] * out
    rows.append(
      [
        float(a[0]),
        y,
        float(a[1]),
        w,
        h,
        depth,
        math.atan2(-f["d"][1], f["d"][0]),
        color,
        role,
        f["surfaceId"],
      ]
    )
    count = max(1, math.ceil(w / 0.65))
    for i in range(count):
      rw = max(0.1, abs(float(f["d"][0])) * w / count + abs(float(f["n"][0])) * depth)
      rd = max(0.1, abs(float(f["d"][1])) * w / count + abs(float(f["n"][1])) * depth)
      c = clearance.position(f, u + (i + 0.5) * w / count - w / 2, y, rw, h, rd, out)
      if f.get("streetPrism", False):
        c = a + f["d"] * ((i + 0.5) * w / count - w / 2) + f["n"] * 0.85
      native.append(
        [float(c[0]), y, float(c[1]), rw, h, rd, 0, color, role, f["surfaceId"]]
      )

  def segment(f, u, y, v, yy, width, tone, role, out=0.45):
    a = f["a"] + f["d"] * u + f["n"] * out
    b = f["a"] + f["d"] * v + f["n"] * out
    if f["poly"].buffer(0.01).covers(Point(u, y)) and f["poly"].buffer(0.01).covers(
      Point(v, yy)
    ):
      native.extend(clearance.segment(f, u, y, v, yy, width, tone, role, out))
      ribs.append(
        [
          [float(a[0]), y, float(a[1])],
          [float(b[0]), yy, float(b[1])],
          width,
          tone,
          role,
        ]
      )

  faces = []
  for s in p["surfaces"]:
    if s["kind"] != "WallSurface":
      continue
    f = face_axes(s, feet[s["parentId"]])
    if f is None or f["length"] < 2 or f["hi"] - f["lo"] < 3:
      continue
    kind = kinds[s["parentId"]]
    f["kind"] = kind
    faces.append(f)
    length, lo, hi = f["length"], f["lo"], f["hi"]
    if kind in ["gold", "silver"]:
      # Dense regular curtain wall; source retains both different tower plans.
      floor = 3.75
      n = max(1, round(length / 1.55))
      spacing = length / n
      for y in np.arange(8.3, hi - 1, floor):
        for j in range(n):
          u = (j + 0.5) * spacing
          put(
            f,
            u,
            float(y),
            spacing * 0.79,
            2.35,
            0x536A72 if kind == "gold" else 0x729298,
            kind + "-window",
          )
          put(
            f,
            u + spacing * 0.45,
            float(y),
            0.10,
            3.65,
            0xE3BD6E if kind == "gold" else 0xD6DCD5,
            kind + "-mullion",
            0.36,
          )
        put(
          f,
          length / 2,
          float(y - 1.4),
          length - 0.08,
          0.38,
          0xC4A15D if kind == "gold" else 0xBAC6C5,
          kind + "-floor-band",
          0.33,
        )
    elif kind == "taz":
      for y in np.arange(7.2, hi - 1, 3.65):
        n = max(1, round(length / 1.4))
        for j in range(n):
          u = (j + 0.5) * length / n
          put(f, u, float(y), length / n * 0.93, 2.95, 0x55787F, "taz-glass")
        put(
          f,
          length / 2,
          float(y - 1.55),
          length - 0.08,
          0.22,
          0xB6C4BE,
          "taz-floor-edge",
          0.30,
        )
      # Fine nonstructural diamond screen on the actual visible facade planes.
      for y in np.arange(lo + 0.6, hi, 3.65):
        for u in np.arange(0.4, length, 3.3):
          for sign in [-1, 1]:
            segment(
              f,
              float(u),
              float(y),
              float(u + sign * 1.65),
              float(y + 1.825),
              0.095,
              0xC6D2CC,
              "taz-diamond-steel-screen",
              0.52,
            )
            segment(
              f,
              float(u),
              float(y + 3.65),
              float(u + sign * 1.65),
              float(y + 1.825),
              0.095,
              0xC6D2CC,
              "taz-diamond-steel-screen",
              0.52,
            )
    else:
      for y in np.arange(lo + 2.1, hi - 1, 3.75):
        for u in np.arange(1.8, length - 1, 3.2):
          put(f, float(u), float(y), 1.42, 2.15, 0x506F75, "old-taz-window")
          put(f, float(u), float(y - 1.12), 1.7, 0.15, 0xEEE3C9, "old-taz-sill", 0.32)
      for y in np.arange(lo + 4, hi, 3.75):
        put(
          f, length / 2, float(y), length - 0.2, 0.17, 0xB59E7E, "old-taz-cornice", 0.33
        )

  def label(text, f, cap, y, tone):
    labels.append(
      {
        "text": text,
        "a": f["a"].tolist(),
        "nativeA": clearance.position(
          f,
          f["length"] / 2,
          y + cap / 2,
          len(text) * cap,
          cap,
          0.15,
          0.82,
          span_u=len(text) * cap / 2,
          half_normal=0.15,
        ).tolist(),
        "d": f["d"].tolist(),
        "n": f["n"].tolist(),
        "length": f["length"],
        "cap": cap,
        "y": y,
        "tone": tone,
      }
    )

  gold = max(
    (f for f in faces if f["kind"] == "gold" and f["n"][0] > 0.7),
    key=lambda f: f["length"],
  )
  label("AXEL SPRINGER", gold, 1.5, min(gold["hi"] - 3, 80), 0xEEE5CE)
  taz = max(
    (f for f in faces if f["kind"] == "taz" and f["n"][0] < -0.7),
    key=lambda f: f["length"] * (f["hi"] - f["lo"]),
  )
  label("TAZ", taz, 1.5, 8.5, 0xF3EFE0)
  old = max(
    (f for f in faces if f["kind"] == "old-taz" and f["n"][0] > 0.7),
    key=lambda f: f["length"] * (f["hi"] - f["lo"]),
  )
  # Peter Lenk relief on the former house's east wall, at retained OSM art point.
  # Symbolic profiles, not a claimed facsimile or photo texture.
  old["poly"] = box(-20, 5.2, old["length"] + 20, 33)
  center = float((np.array([1344.494, 1394.729]) - old["a"]) @ old["d"])
  pink = 0xD39585
  dark = 0x594C49
  path = [
    (center - 1.8, 7.5),
    (center - 2.3, 12),
    (center - 2.0, 18),
    (center - 0.8, 23),
    (center + 0.9, 25),
    (center + 2.3, 24),
    (center + 2.6, 22),
  ]
  for a, b in zip(path, path[1:]):
    segment(old, *a, *b, 0.72, pink, "lenk-vertical-satirical-relief", 0.62)
  for j in range(12):
    a = j * math.tau / 12
    b = (j + 1) * math.tau / 12
    segment(
      old,
      center + 2.3 + 0.48 * math.cos(a),
      23 + 0.62 * math.sin(a),
      center + 2.3 + 0.48 * math.cos(b),
      23 + 0.62 * math.sin(b),
      0.25,
      pink,
      "lenk-portrait-profile",
      0.72,
    )
  # Small flautist and elevated putto are distinct relief motifs.
  for u, y in [(center - 1.2, 9.2), (center + 0.3, 28.3)]:
    put(old, u, y, 0.68, 1.2, 0xC69D8A, "lenk-secondary-figure", 0.65, 0.4)
    segment(
      old, u - 0.1, y + 0.5, u + 0.8, y + 0.2, 0.14, dark, "lenk-figure-arm", 0.94
    )
    put(old, u, y + 0.91, 0.4, 0.43, pink, "lenk-figure-head", 0.7, 0.38)
  label("FRIEDE SEI MIT DIR", old, 0.48, 6.3, 0xC9443D)

  # Ordinary southern Friedrichstraße/Kochstraße fronts: source-only planes,
  # exact retained roads; the already delivered curbs/markings are not duplicated.
  roads = gpd.read_file(GEO / "osm.gpkg", layer="roads")
  roads = roads[
    roads["name"].isin(["Friedrichstraße", "Kochstraße", "Rudi-Dutschke-Straße"])
  ]
  from shapely.affinity import affine_transform

  road = unary_union(
    [affine_transform(g, [1, 0, 0, -1, -389500, 5820000]) for g in roads.geometry]
  )
  all_prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  selected = []
  for b in all_prisms:
    if b["id"] in {v["id"] for v in p["legacyPrisms"]}:
      continue
    ring = [[x / 10, z / 10] for x, z in b["ring"]]
    poly = Polygon(ring)
    c = poly.centroid
    if (
      not (850 < c.x < 1660 and 1120 < c.y < 1870)
      or poly.distance(road) > 24
      or b["h_dm"] < 80
    ):
      continue
    if b["h_dm"] > 480:
      continue
    selected.append(b)
    for a, bp in zip(ring, ring[1:] + ring[:1]):
      a = np.array(a)
      d = np.array(bp) - a
      length = float(np.linalg.norm(d))
      if length < 4:
        continue
      d /= length
      n = np.array([d[1], -d[0]])
      if poly.covers(Point(a + d * length / 2 + n * 0.1)):
        n = -n
      mid = a + d * length / 2
      near = road.interpolate(road.project(Point(mid)))
      toward = np.array([near.x, near.y]) - mid
      if np.linalg.norm(toward) > 32 or toward @ n < 2:
        continue
      lo = b["y0_dm"] / 10
      hi = lo + b["h_dm"] / 10
      f = {
        "a": a,
        "d": d,
        "n": n,
        "length": length,
        "poly": box(0, lo, length, hi - 0.5),
        "surfaceId": b["id"],
        "streetPrism": True,
      }
      for u in np.arange(2, length - 1, 3.4):
        put(f, float(u), lo + 1.8, 2.5, 2.8, 0x536D70, "koch-friedrich-shopfront")
        put(
          f,
          float(u),
          lo + 3.33,
          2.6,
          0.28,
          [0x7F957D, 0xA7876E, 0x9B7770, 0x909784][int(u) % 4],
          "koch-friedrich-shop-fascia",
          0.28,
        )
      for y in np.arange(lo + 6, hi - 1.5, 3.5):
        for u in np.arange(2, length - 1, 3.4):
          put(f, float(u), float(y), 1.38, 2.05, 0x607C80, "koch-friedrich-window")
          put(
            f,
            float(u),
            float(y - 1.09),
            1.62,
            0.14,
            0xD7D2BE,
            "koch-friedrich-sill",
            0.32,
          )
  p["streetPrisms"] = selected
  p["streetRoadIds"] = roads["id"].tolist()
  p["artwork"] = {
    "osmKey": "node/7599829392",
    "name": "Friede sei mit Dir",
    "artist": "Peter Lenk",
    "anchor": [1344.494, 1394.729],
    "oldGenericOwnerReplaced": True,
    "interpretation": "Compact sculptural interpretation at former taz house; not the new taz building.",
  }
  return rows, native, ribs, labels


def main() -> None:
  """Write compact immutable construction data and independent source evidence."""
  from build_west_venues_v260 import native_shell

  p = make_payload()
  blocks = native_shell(p)
  rows, native, ribs, labels = recognition(p, blocks)
  p.update(
    facadeBoxes=rows,
    nativeDetails=native,
    ribSegments=ribs,
    labels=labels,
    nativeBlocks=blocks,
  )
  raw = json.dumps(p, separators=(",", ":")).encode()
  (GEO / "press-quarter-v272-source.json.gz").write_bytes(gzip.compress(raw, mtime=0))

  def packed(rows, dtype):
    return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()

  triangles = [t for s in p["surfaces"] for t in s["triangles"]]
  colors = [s["color"] for s in p["surfaces"] for _ in s["triangles"]]
  from collections import Counter

  counts = {
    "parents": len(p["parents"]),
    "parts": len(p["parts"]),
    "surfaces": len(p["surfaces"]),
    "triangles": len(triangles),
    "facadeBoxes": len(rows),
    "nativeShellBlocks": len(blocks),
    "nativeDetailBoxes": len(native),
    "streetBuildings": len(p["streetPrisms"]),
    "ribs": len(ribs),
  }
  runtime = {
    "schema": 1,
    "sourcePartIds": [q["id"] for q in p["parts"]],
    "sourcePositions": packed(triangles, "<f4"),
    "sourceColors": packed(colors, "<u4"),
    "facadeBoxes": packed([r[:8] for r in rows], "<f4"),
    "nativeBoxes": packed([r[:8] for r in blocks + native], "<f4"),
    "ribSegments": ribs,
    "labels": labels,
    "counts": counts,
    "roles": dict(Counter(r[8] for r in rows)),
  }
  DEST.with_name("pressQuarterV272.json").write_text(
    json.dumps(runtime, separators=(",", ":")) + "\n"
  )
  roofs = {}
  for x, y, z, *_ in blocks:
    roofs[(x, z)] = max(roofs.get((x, z), -100), y + 1)
  nav = {k: p[k] for k in ["parents", "parts", "legacyPrisms"]}
  nav.update(
    roofTriangles=[
      t for s in p["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
    ],
    nativeRoofCells=[[x, z, y] for (x, z), y in roofs.items()],
  )
  DEST.with_name("pressQuarterV272Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(counts)


if __name__ == "__main__":
  main()
