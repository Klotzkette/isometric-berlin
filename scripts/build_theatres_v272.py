"""Step 10: complete named HAU sources and bounded theatre recognition."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.native_facade_clearance_v272 import NativeFacadeClearance

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OWNERS = {
  "hau1": ("DEBE02YY4000027E", "81194038", "HAU1", "Stresemannstraße 29"),
  "hau2": ("DEBE02YY4000019p", "65780505", "HAU2", "Hallesches Ufer 34"),
  "hau3": ("DEBE02YY400007Do", "59291480", "HAU3 rear theatre", "Tempelhofer Ufer 10"),
  "hau3entry": (
    "DEBE02YY40000CoB",
    "75846696",
    "HAU3 street access",
    "Tempelhofer Ufer 10",
  ),
}
WALL = {"hau1": 0xA79F8D, "hau2": 0x343B3D, "hau3": 0xC5B49B, "hau3entry": 0xDED7C8}
POLICY = "Complete official source parts replace only the five exact receipted OSM fallback prisms after required loading. Source xz and relative measured heights are unchanged, translated to the existing 5.2m street datum. All original sheets and coarse owners remain as evidence. Fine facade divisions, colours and small recognition fittings are explicit display estimates. HAU3 is the third-floor rear venue, with a separate mapped street access. GRIPS remains an additive refinement. Full mobile detail, independent orthogonal native surface construction; no texture, animation, light, new tour stop or budget change."


def digest(v: Any) -> str:
  """Fingerprint a structured immutable receipt."""
  return hashlib.sha256(
    json.dumps(v, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def write(path: Path, value: Any) -> None:
  """Write compact deterministic source data."""
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def extract() -> dict:
  """Keep every original surface and exact named prior display owner."""
  archive = GEO / "raw/lod2/LoD2_390_5817.zip"
  prior_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prior = {p["id"]: p for p in json.loads(prior_path.read_text())["buildings"]}
  parents = []
  parts = []
  surfaces = []
  conflicts = []
  for key, (pid, legacy, name, address) in OWNERS.items():
    parent = extract_parent(archive, pid)
    source_parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    datum = min(p["ground_y_m"] for p in source_parts)
    offset = 5.2 - datum
    old = prior[legacy]
    for p in source_parts:
      surfaces.extend(
        dict(
          parentId=pid,
          partId=p["id"],
          kind=s["kind"],
          rings=[[[x, round(y + offset, 3), z] for x, y, z in r] for r in s["rings"]],
          color=0x646D68 if s["kind"] == "RoofSurface" else WALL[key],
        )
        for s in p["surfaces"]
      )
      parts.append(
        dict(
          id=p["id"],
          parentId=pid,
          groundY=round(p["ground_y_m"] + offset, 3),
          topY=round(p["top_y_m"] + offset, 3),
          polygons=[dict(ring=p["ring"], holes=p["holes"])],
        )
      )
    foot = unary_union([Polygon(p["ring"], p["holes"]) for p in source_parts])
    oldfoot = Polygon(
      [[x / 10, z / 10] for x, z in old["ring"]],
      [[[x / 10, z / 10] for x, z in h] for h in old["holes"]],
    )
    parents.append(
      dict(
        id=pid,
        key=key,
        name=name,
        address=address,
        legacyId=legacy,
        groundY=5.2,
        groundNHN=datum + 30,
        sourceParts=source_parts,
        sourceSha256=digest(source_parts),
      )
    )
    conflicts.append(
      dict(
        parentId=pid,
        legacyId=legacy,
        legacySha256=digest(old),
        oldArea=oldfoot.area,
        sourceArea=foot.area,
        overlapM2=foot.intersection(oldfoot).area,
        legacyOnlyAreaM2=oldfoot.difference(foot).area,
        sourceOnlyAreaM2=foot.difference(oldfoot).area,
        oldHeight=old["h_dm"] / 10,
        newHeight=max(p["top_y_m"] for p in source_parts) - datum,
      )
    )
  low = prior["81646698"]
  lowfoot = Polygon([[x / 10, z / 10] for x, z in low["ring"]])
  rear = unary_union(
    [
      Polygon(q["ring"], q["holes"])
      for q in next(p for p in parents if p["key"] == "hau3")["sourceParts"]
    ]
  )
  conflicts.append(
    dict(
      parentId=OWNERS["hau3"][0],
      legacyId=low["id"],
      legacySha256=digest(low),
      oldArea=lowfoot.area,
      sourceArea=rear.area,
      overlapM2=lowfoot.intersection(rear).area,
      legacyOnlyAreaM2=lowfoot.difference(rear).area,
      sourceOnlyAreaM2=rear.difference(lowfoot).area,
      oldHeight=low["h_dm"] / 10,
      newHeight=4.713,
    )
  )
  for s in surfaces:
    s["triangles"] = triangles_for(s["rings"])
  return dict(
    schemaVersion=1,
    parents=parents,
    parts=parts,
    surfaces=surfaces,
    legacyPrisms=[*[prior[v[1]] for v in OWNERS.values()], prior["81646698"]],
    sourceConflicts=conflicts,
    sourceArchive=dict(
      url=f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
      sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
    ),
    legacyFile=str(prior_path.relative_to(ROOT)),
    legacyFileSha256=hashlib.sha256(prior_path.read_bytes()).hexdigest(),
    policy=POLICY,
  )


def frames(source: dict) -> list:
  """Derive exposed wall frames from exact source sheets."""
  feet = {
    p["id"]: unary_union([Polygon(q["ring"], q["holes"]) for q in p["sourceParts"]])
    for p in source["parents"]
  }
  keys = {p["id"]: p["key"] for p in source["parents"]}
  result = []
  for i, s in enumerate(source["surfaces"]):
    if s["kind"] != "WallSurface":
      continue
    ring = s["rings"][0]
    a, b = max(
      ((a, b) for a in ring for b in ring),
      key=lambda ab: math.hypot(ab[0][0] - ab[1][0], ab[0][2] - ab[1][2]),
    )
    a = np.array([a[0], a[2]])
    b = np.array([b[0], b[2]])
    length = float(np.linalg.norm(b - a))
    if length < 0.2:
      continue
    d = (b - a) / length
    n = np.array([-d[1], d[0]])
    if feet[s["parentId"]].covers(Point((a + b) / 2 + n * 0.1)):
      n = -n
    if feet[s["parentId"]].covers(Point((a + b) / 2 + n * 0.1)):
      continue
    poly = Polygon(
      [[float(np.dot(np.array([v[0], v[2]]) - a, d)), v[1]] for v in ring]
    ).buffer(0)
    if poly.area < 0.1:
      continue
    result.append(
      dict(
        key=keys[s["parentId"]],
        a=a,
        d=d,
        n=n,
        length=length,
        poly=poly,
        low=min(v[1] for v in ring),
        high=max(v[1] for v in ring),
        sheet=i,
      )
    )
  return result


def recognition(source: dict, blocks: list) -> tuple[list, list, list, list]:
  """Source-bound static venue fittings; photographs are reference-only."""
  details, native, ribs, labels = [], [], [], []
  clearance = NativeFacadeClearance(blocks)
  ff = frames(source)
  by = {f["sheet"]: f for f in ff}

  def put(f, u, y, w, h, color, role, out=0.14, depth=0.10, clip=True):
    if (
      w <= 0
      or h <= 0
      or (
        clip
        and not f["poly"]
        .buffer(0.02)
        .covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
      )
    ):
      return
    a = f["a"] + f["d"] * u + f["n"] * out
    details.append(
      [
        round(float(a[0]), 3),
        round(float(y), 3),
        round(float(a[1]), 3),
        round(float(w), 3),
        round(float(h), 3),
        depth,
        round(math.atan2(-f["d"][1], f["d"][0]), 7),
        color,
        role,
      ]
    )
    count = max(1, math.ceil(w / 0.8))
    for i in range(count):
      rw = max(0.10, abs(float(f["d"][0])) * w / count + abs(float(f["n"][0])) * depth)
      rd = max(0.10, abs(float(f["d"][1])) * w / count + abs(float(f["n"][1])) * depth)
      c = clearance.position(f, u + (i + 0.5) * w / count - w / 2, y, rw, h, rd, out)
      native.append(
        [
          round(float(c[0]), 3),
          round(float(y), 3),
          round(float(c[1]), 3),
          round(rw, 3),
          round(float(h), 3),
          round(rd, 3),
          0,
          color,
          role,
        ]
      )

  def beam(f, u, y, v, z, width, color, role, out=0.35):
    a = f["a"] + f["d"] * u + f["n"] * out
    b = f["a"] + f["d"] * v + f["n"] * out
    native.extend(clearance.segment(f, u, y, v, z, width, color, role, out))
    ribs.append(
      [
        [round(float(a[0]), 3), round(y, 3), round(float(a[1]), 3)],
        [round(float(b[0]), 3), round(z, 3), round(float(b[1]), 3)],
        width,
        color,
        role,
      ]
    )

  def label(f, text, u, y, height, color, out=0.30):
    a = f["a"] + f["d"] * u + f["n"] * out
    labels.append(
      dict(
        text=text,
        a=a.tolist(),
        nativeA=clearance.position(
          f,
          u,
          y + height / 2,
          len(text) * height,
          height,
          0.15,
          out,
          span_u=len(text) * height / 2,
          half_normal=0.15,
        ).tolist(),
        d=f["d"].tolist(),
        n=f["n"].tolist(),
        y=y,
        height=height,
        color=color,
      )
    )

  # HAU1: limestone courses, three portals, convex foyer, balustrade and gable.
  f = by[162]
  mid = f["length"] / 2
  for y in np.arange(6, 25.4, 0.62):
    put(
      f,
      mid,
      float(y),
      f["length"] - 0.05,
      0.045,
      0x817D71,
      "hau1-limestone-course",
      0.16,
    )
  for u in [4.5, mid, 15.8]:
    put(f, u, 7.35, 2.55, 4.0, 0x26302E, "hau1-three-door-portals", 0.20)
    for k in [-0.84, 0, 0.84]:
      put(f, u + k, 7.35, 0.055, 4, 0x929889, "hau1-door-grille", 0.31)
    for yy in [6.8, 8.8]:
      put(f, u, yy, 2.55, 0.07, 0x929889, "hau1-door-transom", 0.32)
  put(f, mid, 10.05, 17.2, 0.92, 0x1E2528, "hau1-long-black-sign", 0.22)
  # The source wall runs right-to-left as seen from the street. Fehrmann's
  # operator photo has HAU at the left end and the numeral at the right end.
  label(f, "HAU", 16.9, 9.82, 0.56, 0xF2F0DE, 0.31)
  label(f, "1", 3.7, 9.82, 0.62, 0xF2F0DE, 0.31)
  for i, tone in enumerate([0xB9DA82, 0xE5C169, 0xAC8CAE, 0x67A8AF]):
    put(f, mid, 9.69 + i * 0.055, 12, 0.045, tone, "hau1-sign-colour-rule", 0.31)
  for u in [mid - 2.45, mid, mid + 2.45]:
    out = 0.6 if u != mid else 0.95
    put(f, u, 17.8, 2.22, 10.8, 0x617A7D, "hau1-convex-tall-foyer-window", out, 0.10)
    for side in [-1.16, 1.16]:
      put(
        f,
        u + side,
        17.8,
        0.15,
        11.2,
        0xCDC6B3,
        "hau1-foyer-stone-rib",
        out + 0.12,
        0.20,
      )
    for yy in [12.5, 15.5, 18.6, 21.6, 23.2]:
      put(f, u, yy, 2.3, 0.09, 0xC8C3B1, "hau1-foyer-transom", out + 0.12)
  for u in [1.7, f["length"] - 1.7]:
    for yy in [15.5, 21.3]:
      put(f, u, yy, 0.92, 3.8, 0x526969, "hau1-narrow-side-window", 0.20)
  for yy in [10.7, 11.7, 24.1, 25.5]:
    put(f, mid, yy, 18.6, 0.22, 0xC8BFA9, "hau1-stone-entablature", 0.40, 0.35)
  for u in np.arange(1.3, 19, 0.55):
    put(f, float(u), 11.15, 0.11, 0.88, 0xC8BFA9, "hau1-stone-balustrade", 0.40, 0.22)
  # Reference-estimated shallow gable remains below the measured roof summit.
  for yy in np.arange(25.85, 29.1, 0.22):
    width = 11.4 * math.sqrt(max(0, 1 - ((yy - 25.7) / 3.45) ** 2))
    put(
      f,
      mid,
      float(yy),
      width,
      0.24,
      0xB9B09B,
      "hau1-curved-pediment",
      0.20,
      0.30,
      False,
    )
  for j in range(24):
    t = math.pi * j / 24
    q = math.pi * (j + 1) / 24
    beam(
      f,
      mid + math.cos(t) * 5.7,
      25.7 + math.sin(t) * 3.45,
      mid + math.cos(q) * 5.7,
      25.7 + math.sin(q) * 3.45,
      0.20,
      0xD1C6AE,
      "hau1-pediment-rim",
    )
  for q in ff:
    if (
      q["key"] != "hau1"
      or q["sheet"] == 162
      or q["high"] - q["low"] < 10
      or q["length"] < 5
    ):
      continue
    for yy in [8.2, 12.9, 17.6, 22.3]:
      for u in np.arange(2, q["length"] - 1, 4.2):
        put(q, float(u), yy, 1.18, 2.6, 0x5E7375, "hau1-secondary-window")
        put(
          q, float(u), yy - 1.4, 1.5, 0.16, 0xC3BAA6, "hau1-secondary-sill", 0.22, 0.2
        )
  # HAU2: canal-side glazing bands, level entrance and three gold line panels.
  for q in ff:
    if q["key"] != "hau2" or q["length"] < 4 or q["high"] - q["low"] < 6:
      continue
    for yy in [7.25, 12.25, 17.35]:
      count = max(1, int(q["length"] / 2.2))
      for j in range(count):
        u = (j + 0.5) * q["length"] / count
        put(
          q, u, yy, q["length"] / count * 0.90, 3.1, 0x536E77, "hau2-glazed-window-band"
        )
        put(q, u, yy, 0.07, 3.1, 0xA7B4AE, "hau2-metal-window-mullion", 0.23)
      put(
        q,
        q["length"] / 2,
        yy + 1.7,
        q["length"] - 0.08,
        0.27,
        0x222C31,
        "hau2-horizontal-floor-band",
        0.23,
        0.20,
      )
  f = by[189]
  mid = f["length"] / 2
  put(f, mid, 7.0, 4.2, 3.5, 0x20363D, "hau2-level-entrance", 0.30)
  label(f, "HAU2", mid, 10.3, 0.78, 0xE2E7DD, 0.30)
  label(f, "WAU", mid + 8, 6.3, 0.65, 0xE0DDCA, 0.30)
  for yy in [8.0, 12.9, 17.7]:
    for du in [-2, 2]:
      put(f, 3 + du, yy, 0.12, 3.65, 0xE1BD6F, "hau2-three-gold-light-frames", 0.34)
    for dy in [-1.82, 1.82]:
      put(f, 3, yy + dy, 4.1, 0.12, 0xE1BD6F, "hau2-three-gold-light-frames", 0.34)
  # HAU3 rear third-floor venue and its separate surveyed street-access house.
  for q in ff:
    if (
      q["key"] not in ["hau3", "hau3entry"]
      or q["length"] < 3
      or q["high"] - q["low"] < 5
    ):
      continue
    for yy in [7.6, 11.9, 16.2, 20.5, 24.7]:
      for u in np.arange(1.7, q["length"] - 0.8, 3.1):
        put(q, float(u), yy, 1.3, 2.2, 0x6B858A, "hau3-courtyard-and-street-windows")
        put(q, float(u), yy, 0.065, 2.2, 0xECE5D3, "hau3-white-window-mullions", 0.23)
        put(
          q,
          float(u),
          yy - 1.17,
          1.5,
          0.13,
          0xBEB5A2,
          "hau3-stone-window-sill",
          0.24,
          0.22,
        )
  f = by[246]
  u = float(np.dot(np.array([943.963872786, 2328.001838418]) - f["a"], f["d"]))
  put(f, u, 7.0, 2.54, 3.6, 0x242A29, "hau3-mapped-street-passage", 0.22)
  put(f, u, 8.75, 2.54, 0.12, 0xF0EDDE, "hau3-portal-transom", 0.35)
  for i in range(12):
    yy = 8.85 + (i + 0.5) * 0.08
    w = 2.54 * math.sqrt(max(0, 1 - ((yy - 8.85) / 1.02) ** 2))
    put(f, u, yy, w, 0.09, 0xE1E7D9, "hau3-arched-fanlight", 0.25)
  for j in range(16):
    a = math.pi * j / 16
    b = math.pi * (j + 1) / 16
    beam(
      f,
      u + math.cos(a) * 1.27,
      8.85 + math.sin(a) * 1.02,
      u + math.cos(b) * 1.27,
      8.85 + math.sin(b) * 1.02,
      0.10,
      0xF7F0DF,
      "hau3-arched-portal-frame",
      0.36,
    )
  label(f, "HAU3", u, 9.0, 0.44, 0x315881, 0.38)
  source["recognitionAnchors"] = {
    key: {
      k: (v.tolist() if isinstance(v, np.ndarray) else v)
      for k, v in by[sheet].items()
      if k in ["a", "d", "n", "length", "sheet"]
    }
    for key, sheet in [
      ("hau1", 162),
      ("hau2", 189),
      ("hau3Rear", 208),
      ("hau3Portal", 246),
    ]
  }
  source["recognitionAnchors"]["hau3MappedEntrance"] = {
    "osmNode": "3848188241",
    "xz": [943.963872786, 2328.001838418],
    "venueFloor": 3,
  }
  return details, native, ribs, labels


def native_shell(source: dict) -> list:
  """Independent two-metre surface cells, with no hidden solid infill."""
  cells = {}
  for surface in source["surfaces"]:
    for triangle in surface["triangles"]:
      a, b, c = map(np.array, triangle)
      steps = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / 1.15
        ),
      )
      for i in range(steps + 1):
        for j in range(steps + 1 - i):
          v = a + (b - a) * i / steps + (c - a) * j / steps
          cell = tuple(math.floor(float(n) / 2) for n in v)
          cells[cell] = [
            cell[0] * 2 + 1,
            cell[1] * 2 + 1,
            cell[2] * 2 + 1,
            2,
            2,
            2,
            0,
            surface["color"],
            "measured-surface-block",
          ]
  return list(cells.values())


def main() -> None:
  """Write source evidence, packed runtime and the smaller navigation profile."""
  p = extract()
  blocks = native_shell(p)
  details, native, ribs, labels = recognition(p, blocks)
  p.update(
    facadeBoxes=details,
    nativeDetails=native,
    ribSegments=ribs,
    labels=labels,
    nativeBlocks=blocks,
  )
  write(GEO / "theatres-v272-source.json.gz", p)

  def packed(rows, dtype):
    return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()

  triangles = [t for s in p["surfaces"] for t in s["triangles"]]
  runtime = dict(
    schema=1,
    sourcePartIds=[q["id"] for q in p["parts"]],
    sourcePositions=packed(triangles, "<f4"),
    sourceColors=packed(
      [s["color"] for s in p["surfaces"] for _ in s["triangles"]], "<u4"
    ),
    facadeBoxes=packed([r[:8] for r in details], "<f4"),
    nativeBoxes=packed([r[:8] for r in blocks + native], "<f4"),
    ribSegments=ribs,
    labels=labels,
    recognitionAnchors=p["recognitionAnchors"],
    counts=dict(
      parents=4,
      parts=len(p["parts"]),
      surfaces=len(p["surfaces"]),
      triangles=len(triangles),
      facadeBoxes=len(details),
      nativeShellBlocks=len(blocks),
      nativeDetailBoxes=len(native),
      labels=len(labels),
    ),
  )
  write(DATA / "theatresV272.json", runtime)
  roofs = {}
  for x, y, z, *_ in blocks:
    roofs[x, z] = max(roofs.get((x, z), -100), y + 1)
  parents = [{k: v for k, v in q.items() if k != "sourceParts"} for q in p["parents"]]
  nav = dict(
    parents=parents,
    parts=p["parts"],
    legacyPrisms=p["legacyPrisms"],
    roofTriangles=[
      t for s in p["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
    ],
    nativeRoofCells=[[x, z, y] for (x, z), y in roofs.items()],
  )
  write(DATA / "theatresV272Navigation.json", nav)
  evidence = {
    k: p[k]
    for k in [
      "sourceArchive",
      "sourceConflicts",
      "legacyFile",
      "legacyFileSha256",
      "policy",
      "recognitionAnchors",
    ]
  }
  evidence.update(
    parents=parents,
    counts=runtime["counts"],
    referenceUrls=[
      "https://www.hebbel-am-ufer.de/service/anfahrt-besuch",
      "https://www.hebbel-am-ufer.de/service/barrierefreiheit/",
      "https://www.hebbel-am-ufer.de/ueber-uns/technik",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031244",
      "https://www.grips-theater.de/de/service/anreise",
    ],
  )
  write(GEO / "theatres-v272-evidence.json", evidence)
  print(runtime["counts"])


if __name__ == "__main__":
  main()
