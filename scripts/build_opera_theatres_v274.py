"""Five named theatres: complete measured west-city bodies and bounded fittings."""

from __future__ import annotations

import base64
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_breitscheid_towers_v161 import triangles_for
from scripts.build_theatres_v272 import digest, native_shell, write
from scripts.native_facade_clearance_v272 import NativeFacadeClearance

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SCHILLER = "DEBE04YY500004Vq"
DEUTSCHE = "DEBE04YY500002EM"
PRISMS = ("49449348", "67502908", "74917641", "49449351", "49449350", "23471381")
REFS = [
  "https://www.staatsoper-berlin.de/en/staatsoper/schiller-theater/baugeschichte/",
  "https://www.komische-oper-berlin.de/planen/spielorte/schillertheater/",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096099,T",
  "https://www.dhl-architekten.de/projekt/deutsche-oper-denkmalgerechte-sanierung/",
  "https://buero-pms.de/projekt/komische-oper-berlin/",
  "https://www.berlin.de/sen/kultur/infrastruktur/komische-oper/",
  "https://www.grips-theater.de/de/service/anreise",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050387",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095952",
  "https://www.staatsoper-berlin.de/de/staatsoper/unter-den-linden/sanierung/",
]
PRESERVE = [
  "src/app/src/gripsHansaplatzSource.json",
  "src/app/src/GripsHansaplatz.ts",
  "src/app/src/GripsDetailsV272.ts",
  "src/app/src/unterDenLindenSource.json",
  "src/app/src/UnterDenLindenDetails.ts",
  "src/app/src/MinecraftUnterDenLindenDetails.ts",
  "src/app/src/data/staatsoperV240.json",
]


def extract():
  """Read every original leaf, wall and roof for the nine already selected parents."""
  prior = json.loads((DATA / "cityRecognitionV182.json").read_bytes())
  wanted = {
    f["parentId"]: f
    for f in prior["features"]
    if f["name"] in ("Schillertheater", "Deutsche Oper Berlin")
  }
  assert len(wanted) == 9, [(f["name"], f["parentId"]) for f in prior["features"]]
  archive = GEO / "raw/lod2/LoD2_385_5819.zip"
  parents, parts, surfaces = [], [], []
  with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
      if not name.lower().endswith((".gml", ".xml", ".citygml")):
        continue
      with z.open(name) as stream:
        for _, e in ET.iterparse(stream, events=("end",)):
          if e.tag != f"{{{NS['bldg']}}}Building":
            continue
          pid = e.get(GML_ID)
          if pid in wanted:
            meta = wanted[pid]
            source_parts = [part_profile(p) for p in leaf_building_parts(e) or [e]]
            offset = 30 - meta["groundNHN"] + meta["groundY"]
            # Same family datum used by v182, not independent per-leaf flattening.
            for p in source_parts:
              parts.append(
                dict(
                  id=p["id"],
                  parentId=pid,
                  groundY=round(p["ground_y_m"] + offset, 3),
                  topY=round(p["top_y_m"] + offset, 3),
                  polygons=[dict(ring=p["ring"], holes=p["holes"])],
                )
              )
              for s in p["surfaces"]:
                rings = [
                  [[x, round(y + offset, 3), z] for x, y, z in r] for r in s["rings"]
                ]
                surfaces.append(
                  dict(
                    parentId=pid,
                    partId=p["id"],
                    kind=s["kind"],
                    rings=rings,
                    color=0x687471
                    if s["kind"] == "RoofSurface"
                    else (0xC7C0AC if meta["name"] == "Schillertheater" else 0x9D9F97),
                    triangles=triangles_for(rings),
                  )
                )
            parents.append(
              dict(**meta, sourceParts=source_parts, sourceSha256=digest(source_parts))
            )
          e.clear()
  assert {p["parentId"] for p in parents} == set(wanted)
  oldpath = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  old = {p["id"]: p for p in json.loads(oldpath.read_bytes())["buildings"]}
  return dict(
    parents=parents,
    parts=parts,
    surfaces=surfaces,
    legacyPrisms=[old[p] for p in PRISMS],
    sourceArchive=dict(
      url=f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
      sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),
    ),
    legacyFileSha256=hashlib.sha256(oldpath.read_bytes()).hexdigest(),
  )


def frame(a, b, normal=None):
  a, b = np.asarray(a, float), np.asarray(b, float)
  length = float(np.linalg.norm(b - a))
  d = (b - a) / length
  return dict(
    a=a,
    d=d,
    n=np.asarray(normal, float) if normal is not None else np.array([-d[1], d[0]]),
    length=length,
  )


def wall_frames(source):
  feet = {}
  for p in source["parents"]:
    feet[p["parentId"]] = unary_union(
      [Polygon(q["ring"], q["holes"]).buffer(0) for q in p["sourceParts"]]
    )
  result = []
  for s in source["surfaces"]:
    if s["kind"] != "WallSurface":
      continue
    ring = s["rings"][0]
    a, b = max(
      ((a, b) for a in ring for b in ring),
      key=lambda ab: math.hypot(ab[0][0] - ab[1][0], ab[0][2] - ab[1][2]),
    )
    if math.hypot(a[0] - b[0], a[2] - b[2]) < 0.1:
      continue
    f = frame([a[0], a[2]], [b[0], b[2]])
    if feet[s["parentId"]].covers(
      Point(f["a"] + f["d"] * f["length"] / 2 + f["n"] * 0.1)
    ):
      f["n"] *= -1
    f.update(
      parent=s["parentId"],
      low=min(v[1] for v in ring),
      high=max(v[1] for v in ring),
      center=np.mean([[a[0], a[2]], [b[0], b[2]]], axis=0),
    )
    result.append(f)
  return result


def recognition(source, blocks):
  """Fine divisions are visual estimates; the supporting wall planes are measured."""
  drawn, native, labels, anchors = [], [], [], []
  clearance = NativeFacadeClearance(blocks)

  def put(f, u, y, w, h, color, role, out=0.12, depth=0.10, existing=False):
    a = f["a"] + f["d"] * u + f["n"] * out
    drawn.append(
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
      ]
    )
    count = max(1, math.ceil(w / 0.8))
    for i in range(count):
      rw = max(0.10, abs(f["d"][0]) * w / count + abs(f["n"][0]) * depth)
      rd = max(0.10, abs(f["d"][1]) * w / count + abs(f["n"][1]) * depth)
      uu = u + (i + 0.5) * w / count - w / 2
      c = (
        (f["a"] + f["d"] * uu + f["n"] * (out + 1.45))
        if existing
        else clearance.position(f, uu, y, rw, h, rd, out)
      )
      native.append(
        [float(c[0]), y, float(c[1]), float(rw), h, float(rd), 0, color, role]
      )

  def label(f, text, y, height, color):
    u = f["length"] / 2
    a = f["a"] + f["d"] * u + f["n"] * 0.4
    c = clearance.position(
      f,
      u,
      y + height / 2,
      len(text) * height,
      height,
      0.15,
      0.3,
      span_u=len(text) * height / 2,
      half_normal=0.15,
    )
    labels.append(
      dict(
        text=text,
        a=a.tolist(),
        nativeA=c.tolist(),
        d=f["d"].tolist(),
        n=f["n"].tolist(),
        y=y,
        height=height,
        color=color,
      )
    )

  ff = wall_frames(source)
  # The foyer is genuinely faceted/convex in the measured source, never a flat slab.
  curved = [
    f
    for f in ff
    if f["parent"] == SCHILLER
    and -3641 < f["center"][0] < -3620
    and 695 < f["center"][1] < 706
    and f["low"] < 6
    and f["high"] > 20
    and f["length"] < 2
  ]
  assert len(curved) >= 15
  for f in curved:
    w = f["length"]
    put(
      f,
      w / 2,
      13.3,
      w - 0.04,
      13.3,
      0x466D71,
      "schiller-curved-foyer-glass",
      depth=0.08,
    )
    for u in [0.02, w - 0.02]:
      put(f, u, 13.3, 0.10, 13.65, 0xD6D1BB, "schiller-curved-vertical-frame", out=0.22)
    for y in [6.6, 10.8, 15.3, 20.15]:
      put(f, w / 2, y, w, 0.13, 0xC8C3AD, "schiller-curved-transom", out=0.24)
    # A restrained colour rhythm acknowledges the art glazing without inventing a copy.
    put(
      f,
      w / 2,
      17.4,
      w * 0.25,
      2.0,
      0xA99470,
      "schiller-panorama-colour-accent",
      out=0.20,
      depth=0.05,
    )
  for f in [
    f
    for f in ff
    if f["parent"] == SCHILLER
    and f["length"] > 40
    and 21 < f["low"] < 22
    and f["high"] < 25
  ]:
    put(
      f,
      f["length"] / 2,
      24.1,
      f["length"],
      0.24,
      0xE0D9C7,
      "schiller-front-cornice",
      out=0.18,
    )
    label(f, "SCHILLERTHEATER", 22.1, 1.15, 0x5B625F)
  # Bornemann's blank Bismarckstraße concrete wall; glazing belongs to the east foyer.
  front = next(
    f
    for f in ff
    if f["parent"] == DEUTSCHE
    and f["length"] > 65
    and 673 < f["center"][1] < 680
    and f["high"] < 24
  )
  east = next(
    f
    for f in ff
    if f["parent"] == DEUTSCHE
    and 35 < f["length"] < 38
    and -4269 < f["center"][0] < -4264
    and f["high"] < 24
  )
  for u in np.arange(1.6, front["length"], 3.2):
    put(
      front,
      float(u),
      14,
      0.065,
      15,
      0x737E7A,
      "deutsche-oper-concrete-panel-joint",
      depth=0.03,
    )
  for y in [6.4, 12.9, 19.3]:
    put(
      front,
      front["length"] / 2,
      y,
      front["length"],
      0.075,
      0x737E7A,
      "deutsche-oper-concrete-course",
      depth=0.03,
    )
  put(
    front,
    front["length"] / 2,
    6.5,
    front["length"],
    0.38,
    0x616866,
    "deutsche-oper-entrance-soffit-edge",
    out=0.25,
    depth=0.5,
  )
  put(
    east,
    east["length"] / 2,
    12.6,
    east["length"] - 0.4,
    17.7,
    0x426467,
    "deutsche-oper-east-foyer-glass",
    depth=0.08,
  )
  for u in np.linspace(0.25, east["length"] - 0.25, 19):
    put(
      east, float(u), 12.6, 0.12, 18, 0xAAAFA6, "deutsche-oper-foyer-mullion", out=0.25
    )
  for y in [3.7, 8.2, 12.8, 17.4, 21.5]:
    put(
      east,
      east["length"] / 2,
      y,
      east["length"],
      0.17,
      0xAAAFA6,
      "deutsche-oper-foyer-transom",
      out=0.25,
    )
  label(front, "DEUTSCHE OPER BERLIN", 7.5, 1.15, 0xD7D9CF)
  anchors.extend(
    [
      dict(site="Schillertheater", role="curved foyer", facets=len(curved)),
      dict(
        site="Deutsche Oper",
        role="street blind wall and east glazed foyer",
        frontA=front["a"].tolist(),
        frontD=front["d"].tolist(),
        frontN=front["n"].tolist(),
      ),
    ]
  )

  # Behrenstraße, not the temporary Schiller venue. Existing copper folds remain.
  f = frame([1030.764, 390.426], [1043.543, 389.563])
  for u in [0, f["length"]]:
    put(
      f,
      u,
      14.9,
      0.24,
      10.4,
      0x64796A,
      "komische-copper-portal-return",
      out=0.36,
      depth=0.52,
      existing=True,
    )
  for i in range(3):
    u = (i + 0.5) * f["length"] / 3
    for du in [-1.57, 1.57]:
      put(
        f,
        u + du,
        6.93,
        0.09,
        3.5,
        0xB9B7A6,
        "komische-bronze-door-jamb",
        out=0.34,
        depth=0.25,
        existing=True,
      )
    put(
      f,
      u,
      8.72,
      3.24,
      0.13,
      0xB9B7A6,
      "komische-door-head-return",
      out=0.34,
      depth=0.3,
      existing=True,
    )
    for du in [-0.18, 0.18]:
      put(
        f,
        u + du,
        6.92,
        0.055,
        0.85,
        0xDBC999,
        "komische-paired-door-pull",
        out=0.5,
        depth=0.09,
        existing=True,
      )
  # Staatsoper: additions on the already measured six-column portico.
  evidence = json.loads((GEO / "staatsoper-v240-evidence.json").read_bytes())
  faces = [
    q
    for q in evidence["facades"]
    if q["part"] == "DEBE3DGPCT541Z3R" and q["normal"][1] < -0.9
  ]
  f0 = max(faces, key=lambda q: q["length"])
  f = frame(f0["a"], np.array(f0["a"]) + np.array(f0["d"]) * f0["length"], f0["normal"])
  for u in np.linspace(f["length"] / 2 - 7.5, f["length"] / 2 + 7.5, 6):
    for y, w, h in [(10.73, 1.42, 0.18), (10.94, 1.18, 0.13), (24.28, 1.10, 0.14)]:
      put(
        f,
        float(u),
        y,
        w,
        h,
        0xD9D4BD,
        "staatsoper-portico-base-capital-moulding",
        out=3.15,
        depth=w,
        existing=True,
      )
  for u in np.linspace(f["length"] / 2 - 9, f["length"] / 2 + 9, 34):
    put(
      f,
      float(u),
      26.36,
      0.23,
      0.26,
      0xD5D0BC,
      "staatsoper-entablature-dentil",
      out=3.55,
      depth=0.24,
      existing=True,
    )
  # GRIPS: the exact existing stair axes in each representation, not a new stair.
  f = frame([-2057.769, -6.982], [-2059.847, -26.914])
  f["n"] *= -1  # GRIPS side=+1 is the right-hand normal.
  center = f["a"] + f["d"] * 1.85 + f["n"] * 1.53
  for i in range(28):
    angle = i / 28 * math.pi * 2.4
    d = np.array([math.cos(angle), math.sin(angle)])
    n = np.array([-d[1], d[0]])
    c = center + d * 0.64 + n * 0.15
    y = 5.28 + i * 0.145 + 0.06
    drawn.append(
      [
        float(c[0]),
        y,
        float(c[1]),
        1.17,
        0.045,
        0.045,
        -angle,
        0xD4BC8D,
        "grips-spiral-tread-nosing",
      ]
    )
    for j in range(4):
      nc = c + f["n"] * 1.17 + d * ((j + 0.5) / 4 - 0.5) * 1.17
      native.append(
        [
          float(nc[0]),
          y,
          float(nc[1]),
          max(0.05, abs(d[0]) * 1.17 / 4),
          0.045,
          max(0.05, abs(d[1]) * 1.17 / 4),
          0,
          0xD4BC8D,
          "grips-spiral-tread-nosing",
        ]
      )
  for u in np.linspace(0, f["length"], 13):
    for rows, shift in [(drawn, 0), (native, 1.17)]:
      c = f["a"] + f["d"] * (u + 0.06) + f["n"] * (0.18 + shift)
      rows.append(
        [
          float(c[0]),
          9.32,
          float(c[1]),
          0.045 if shift else 0.06,
          8.25,
          0.14,
          0 if shift else math.atan2(-f["d"][1], f["d"][0]),
          0xB3BBB4,
          "grips-folded-metal-panel-return",
        ]
      )
  return drawn, native, labels, anchors


def main():
  source = extract()
  blocks = native_shell(source)
  details, native, labels, anchors = recognition(source, blocks)
  source.update(
    facadeBoxes=details,
    nativeDetails=native,
    labels=labels,
    nativeBlocks=blocks,
    recognitionAnchors=anchors,
  )
  write(GEO / "opera-theatres-v274-source.json.gz", source)

  def packed(rows, dtype):
    return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()

  tris = [t for s in source["surfaces"] for t in s["triangles"]]
  counts = dict(
    parents=len(source["parents"]),
    parts=len(source["parts"]),
    surfaces=len(source["surfaces"]),
    triangles=len(tris),
    facadeBoxes=len(details),
    nativeShellBlocks=len(blocks),
    nativeDetailBoxes=len(native),
    labels=len(labels),
  )
  runtime = dict(
    schema=1,
    sourcePartIds=[p["id"] for p in source["parts"]],
    sourcePositions=packed(tris, "<f4"),
    sourceColors=packed(
      [s["color"] for s in source["surfaces"] for _ in s["triangles"]], "<u4"
    ),
    facadeBoxes=packed([r[:8] for r in details], "<f4"),
    nativeBoxes=packed([r[:8] for r in blocks + native], "<f4"),
    ribSegments=[],
    labels=labels,
    counts=counts,
  )
  write(DATA / "operaTheatresV274.json", runtime)
  roofs = {}
  for x, y, z, *_ in blocks:
    roofs[x, z] = max(roofs.get((x, z), -100), y + 1)
  parents = [
    {k: v for k, v in q.items() if k != "sourceParts"} for q in source["parents"]
  ]
  write(
    DATA / "operaTheatresV274Navigation.json",
    dict(
      parents=[dict(id=p["parentId"], **p) for p in parents],
      parts=source["parts"],
      legacyPrisms=source["legacyPrisms"],
      roofTriangles=[
        t
        for s in source["surfaces"]
        if s["kind"] == "RoofSurface"
        for t in s["triangles"]
      ],
      nativeRoofCells=[[x, z, y] for (x, z), y in roofs.items()],
    ),
  )
  write(
    GEO / "opera-theatres-v274-evidence.json",
    dict(
      counts=counts,
      parents=parents,
      recognitionAnchors=anchors,
      sourceArchive=source["sourceArchive"],
      references=REFS,
      preservedFiles={
        p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in PRESERVE
      },
      policy="Complete nine measured parents replace only six receipted coarse Schiller prisms and two exact packet parents. Historic GRIPS, Staatsoper and Komische source bodies and authored details remain unchanged. Supporting wall geometry is measured; window divisions, small fittings, palette and letter heights are display estimates. Full static mobile parity. Independent orthogonal native surface cells; no textures, animations, dynamic lights, new stops or budgets.",
    ),
  )
  print(counts)


if __name__ == "__main__":
  main()
