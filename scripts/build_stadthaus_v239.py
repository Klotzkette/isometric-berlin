"""Step 10: source-bound Altes Stadthaus tower and west-front recognition.

The measured parent and all five courts stay. Only the old hollow authored tower
rows yield. Widths, subdivisions and the western roof rise are display estimates.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_small_tiergarten_v237 import oriented
from build_steglitz_v182 import native_blocks
from shapely import constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, box, mapping

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "stadthaus-v239-source.json.gz"
EVIDENCE = GEO / "stadthaus-v239-evidence.json"
ADDITION = GEO / "stadthaus-v239-manifest-addition.json"
RECEIPT = ROOT / "src/app/src/data/stadthausV239Replacement.json"
OLD = ROOT / "src/app/src/data/cityRecognitionV182.json"
PARENT = "DEBE01YYK00005yc"
CENTER = (2676.0, 317.5)
BASE = 3.0
STONE = (199, 187, 164)
TRIM = (221, 211, 190)
SHADE = (150, 144, 129)
ROOF = (112, 111, 102)
METAL = (110, 127, 115)
GLASS = (65, 79, 80)
REFERENCES = [
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011265",
  "https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/altes-stadthaus-640948.php",
  "https://www.berlin.de/sehenswuerdigkeiten/3561541-3558930-altes-und-neues-stadthaus.html",
]
VISUAL_REFERENCES = [
  dict(
    title=f"Berlin - Altes Stadthaus{suffix}.jpg",
    page=f"https://commons.wikimedia.org/wiki/File:Berlin_-_Altes_Stadthaus{suffix.replace(' ', '_')}.jpg",
    author="Fred Romero",
    date="2016-08-17",
    license="CC BY 2.0",
    licenseUrl="https://creativecommons.org/licenses/by/2.0/",
    use="External visual reference for original procedural architecture; no pixels bundled.",
  )
  for suffix in ["", " (2)"]
]
POLICY = (
  "Keep the measured DEBE01YYK00005yc envelope and all five courts, every v182 "
  "source roof edge and window. Replace only the exact old authored hollow tower "
  "with one cubic base, two solid colonnaded drums, dome and Fortuna. "
  "The 80m total height and western-only reconstructed mansard are published facts; "
  "local radii, floor subdivisions, eight-column rhythm, roof rise, figures and "
  "facade fittings are non-surveyed display estimates. No photo textures, "
  "district fill, mobile quality reduction or residency-budget change."
)


def read(path: Path) -> Any:
  """Read a retained bounded source or packet."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, data: Any) -> None:
  """Write deterministic UTF-8 JSON, optionally gzip compressed."""
  raw = (
    json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  """Return the immutable file receipt."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract() -> dict[str, Any]:
  """Retain the exact official parent, including original source roof and holes."""
  archive = GEO / "raw/lod2/LoD2_392_5819.zip"
  p = part_profile(extract_parent(archive, PARENT))
  old = read(OLD)
  feature = next(f for f in old["features"] if f["parentId"] == PARENT)
  # The v182 normalization uses the minimum of ALL source points (32.491 NHN),
  # whereas part_profile uses the common 30m city datum. Preserve that offset.
  offset = feature["groundY"] - (feature["groundNHN"] - 30)
  for surface in p["surfaces"]:
    for ring in surface["rings"]:
      for q in ring:
        q[1] = round(q[1] + offset, 3)
  p["ground_y_m"] = round(p["ground_y_m"] + offset, 3)
  p["top_y_m"] = round(p["top_y_m"] + offset, 3)
  osm = next(
    f
    for f in read(GEO / "city-recognition-v182-osm.json")["features"]
    if f["name"] == "Altes Stadthaus"
  )
  result = dict(
    schemaVersion=1,
    name="Altes Stadthaus",
    parent=PARENT,
    archiveUrl="https://gdi.berlin.de/data/a_lod2/atom/LoD2_392_5819.zip",
    archiveSha256=sha(archive),
    part=p,
    osm=osm,
    oldFeature=feature,
    groundY=BASE,
    towerCenter=list(CENTER),
    towerHeightM=80,
    policy=POLICY,
    references=REFERENCES,
    visualReferences=VISUAL_REFERENCES,
    licenses=[
      "Geoportal Berlin: dl-de/zero-2-0",
      "OpenStreetMap contributors: ODbL-1.0",
    ],
    retrieved="2026-10-19",
  )
  write(SOURCE, result)
  return result


def old_tower_receipt(old: dict[str, Any]) -> dict[str, Any]:
  """Address the original appended tower rows, never a coordinate-area cull."""
  first_box = max(f["firstBox"] + f["boxCount"] for f in old["features"])
  first_line = max(f["firstSegment"] + f["segmentCount"] for f in old["features"])
  boxes = [dict(index=i, row=old["boxes"][i]) for i in range(first_box, first_box + 34)]
  segments = [
    dict(index=i, row=old["segments"][i]) for i in range(first_line, first_line + 410)
  ]
  # Freeze independently recognizable tower rows; an upstream layout change fails.
  assert boxes[0]["row"] == [2683.0, 42.0, 317.5, 0.5, 12, 0.5, 0, 0xC4B59B]
  assert boxes[-1]["row"] == [2676.0, 82.7, 317.5, 0.5, 0.6, 0.5, 0, 0x627A68]
  assert segments[0]["row"][:3] == [2685.0, 30.0, 317.5]
  assert segments[-1]["row"] == [2676.0, 81.4, 317.5, 2677.2, 82.7, 317.5, 0x627A68]
  return dict(
    schemaVersion=1,
    source="src/app/src/data/cityRecognitionV182.json",
    sourceSha256=sha(OLD),
    sourceRows={k: len(old[k]) for k in ["boxes", "segments"]},
    boxes=boxes,
    segments=segments,
    requiredPacket="stadthaus239-5_0",
    policy="Only original-index AND exact-value matches yield; measured facade/roof rows and other landmarks remain.",
  )


def cylinder(
  detail: Detail,
  x: float,
  z: float,
  y0: float,
  y1: float,
  r: float,
  color: tuple[int, ...],
  role: str,
  segments: int = 24,
) -> None:
  """Build closed capped stone or metal volumes above the retained roof."""
  detail.lathe(x, z, [(y0, 0), (y0, r), (y1, r), (y1, 0)], color, role, segments)


def tower() -> Detail:
  """A single solid tower with two contrasting colonnaded drums, not wire cages."""
  d = Detail()
  x, z = CENTER
  angle = -0.049
  oriented(d, [x, 35.6, z], [21.2, 10.2, 21.2], angle, STONE, "cubic-tower-base", False)
  for y, size, h in [(30.8, 22.0, 0.6), (39.6, 22.0, 0.7), (40.3, 23, 0.55)]:
    oriented(d, [x, y, z], [size, h, size], angle, TRIM, "square-cornice", False)
  for level, y0, y1, core, orbit in [(1, 41, 55, 7.45, 9.15), (2, 58.1, 71, 5.8, 7.25)]:
    cylinder(d, x, z, y0, y1, core, STONE, f"drum-{level}")
    for i in range(8):
      a = math.tau * i / 8 + math.pi / 8 + angle
      cx, cz = x + orbit * math.cos(a), z + orbit * math.sin(a)
      cylinder(
        d, cx, cz, y0, y1, 0.66 if level == 1 else 0.54, TRIM, f"column-{level}-{i}", 12
      )
      for yy in [y0 + 0.25, y1 - 0.3]:
        cylinder(
          d,
          cx,
          cz,
          yy - 0.25,
          yy + 0.25,
          0.93 if level == 1 else 0.76,
          STONE,
          "column-capital",
          12,
        )
      # Window bays sit between columns on the solid central drum.
      a += math.pi / 8
      for yy in [y0 + 3.3, y1 - 3.0]:
        wx, wz = x + (core + 0.05) * math.cos(a), z + (core + 0.05) * math.sin(a)
        oriented(
          d,
          [wx, yy, wz],
          [1.7, 3.0, 0.12],
          a + math.pi / 2,
          GLASS,
          "tower-window",
          False,
        )
        for dy in [-1.63, 1.63]:
          oriented(
            d,
            [wx, yy + dy, wz],
            [2.1, 0.25, 0.23],
            a + math.pi / 2,
            TRIM,
            "tower-window-lintel",
            False,
          )
        oriented(
          d,
          [wx, yy, wz],
          [0.13, 3, 0.20],
          a + math.pi / 2,
          TRIM,
          "tower-window-mullion",
          False,
        )
    # Broad continuous entablatures close the unreal floating rings of v182.
    for yy, rr, h in [
      (y0 - 0.4, orbit + 0.6, 0.8),
      (y1 + 0.25, orbit + 1.1, 0.5),
      (y1 + 1.0, orbit + 1.4, 0.6),
      (y1 + 1.7, orbit + 0.8, 0.8),
    ]:
      cylinder(
        d,
        x,
        z,
        yy - h / 2,
        yy + h / 2,
        rr,
        TRIM if yy > y1 else SHADE,
        "drum-entablature",
      )
  # Eight restrained ornamental silhouettes on the lower entablature.
  for i in range(8):
    a = i * math.tau / 8 + angle
    xx, zz = x + 9.4 * math.cos(a), z + 9.4 * math.sin(a)
    cylinder(d, xx, zz, 56.8, 57.25, 0.55, TRIM, "statue-plinth", 8)
    cylinder(d, xx, zz, 57.25, 58.35, 0.30, STONE, "tower-figure-estimate", 8)
    cylinder(d, xx, zz, 58.35, 58.75, 0.24, TRIM, "tower-figure-estimate", 8)
  # Hemispherical domed cap, with closed central axis and restrained copper ribs.
  profile = [(73.0, 0), (73.0, 7.5)]
  profile += [
    (73 + 7.2 * math.sin(i * math.pi / 20), 7.5 * math.cos(i * math.pi / 20))
    for i in range(1, 11)
  ]
  d.lathe(x, z, profile, METAL, "closed-cupola", 40)
  # Fortuna is a small abstract upright figure, explicitly not a sculptural scan.
  cylinder(d, x, z, 80.2, 80.65, 0.40, SHADE, "fortuna-plinth", 12)
  cylinder(d, x, z, 80.6, 82.35, 0.25, METAL, "fortuna-body", 10)
  cylinder(d, x, z, 82.35, 83.0, 0.24, METAL, "fortuna-head", 10)
  d.box([x + 0.62, 82.2, z], [1.1, 0.16, 0.16], METAL, "fortuna-arm")
  d.box([x - 0.55, 82.55, z], [0.16, 0.8, 0.16], METAL, "fortuna-arm")
  return d


def west_roof(source: dict[str, Any], d: Detail) -> dict[str, Any]:
  """Add only the documented western mansard, clipped to all measured courts."""
  p = source["part"]
  footprint = Polygon(p["ring"], p["holes"])
  west = footprint.intersection(box(2650, 250, 2689, 390))
  base = p["top_y_m"] + 0.04

  # Conservative recognition envelope: measured plan remains the hard boundary.
  # A steep lower slope and shallow cap distinguish the rebuilt mansard from a hip.
  def height(x: float, z: float) -> float:
    dist = footprint.boundary.distance(Point(x, z))
    return base + min(dist * 1.6, 4.0 + max(0, dist - 2.5) * 0.30, 5.5)

  for x in range(2656, 2689, 2):
    for z in range(258, 387, 2):
      clipped = west.intersection(box(x, z, x + 2, z + 2))
      if clipped.is_empty:
        continue
      for tri in constrained_delaunay_triangles(clipped).geoms:
        ps = list(tri.exterior.coords)[:3]
        d.triangles.append(
          (
            [[xx, height(xx, zz), zz] for xx, zz in ps],
            ROOF,
            "western-mansard-estimate",
          )
        )
  # Six giant engaged columns and a shallow triangular pediment over Jüdenstraße.
  angle = math.pi / 2 - 0.049
  frontx, frontz = 2664.5, 317.5
  for u in [-11.2, -6.7, -2.2, 2.2, 6.7, 11.2]:
    x, z = frontx + math.cos(angle) * u, frontz + math.sin(angle) * u
    cylinder(d, x, z, 12.1, 27.8, 0.60, TRIM, "west-engaged-column", 12)
    cylinder(d, x, z, 27.6, 28.2, 0.84, STONE, "west-column-capital", 12)
  for y, w, h in [(28.35, 25.2, 0.65), (29.05, 26.0, 0.55)]:
    oriented(d, [frontx, y, frontz], [w, h, 1.2], angle, TRIM, "pediment-base", False)
  u = np.array([math.cos(angle), 0, math.sin(angle)])
  n = np.array([-math.sin(angle), 0, math.cos(angle)])
  center = np.array([frontx, 29.4, frontz])
  front = [
    center - u * 12.7 + n * 0.7,
    center + u * 12.7 + n * 0.7,
    center + np.array([0, 6.1, 0]) + n * 0.7,
  ]
  back = [q - n * 1.1 for q in front]
  d.polygon([q.tolist() for q in front], STONE, "west-triangular-pediment")
  d.polygon([q.tolist() for q in back[::-1]], STONE, "west-triangular-pediment")
  for i in range(3):
    d.polygon(
      [
        front[i].tolist(),
        back[i].tolist(),
        back[(i + 1) % 3].tolist(),
        front[(i + 1) % 3].tolist(),
      ],
      TRIM,
      "pediment-edge",
    )
  return dict(
    footprint=mapping(west),
    baseY=base,
    maxRiseEstimate=5.5,
    courtsPreserved=len(p["holes"]),
  )


def facade_frames(
  source: dict[str, Any], old: dict[str, Any], drawn: Detail, native: Detail
) -> int:
  """Frame existing source-clipped windows; keep their exact positions and count."""
  f = source["oldFeature"]
  outer = LineString(source["part"]["ring"] + [source["part"]["ring"][0]])
  count = 0
  for r in old["boxes"][f["firstBox"] : f["firstBox"] + f["boxCount"]]:
    x, y, z, w, h, _, yaw, _ = r
    if x > 2689 or outer.distance(Point(x, z)) > 0.4:
      continue
    count += 1
    a = -yaw
    for detail, isnative in [(drawn, False), (native, True)]:
      for dy in [-h / 2 - 0.12, h / 2 + 0.12]:
        oriented(
          detail,
          [x, y + dy, z],
          [w + 0.42, 0.24, 0.22],
          a,
          TRIM,
          "retained-window-surround",
          isnative,
        )
      for dx in [-w / 2 - 0.1, w / 2 + 0.1]:
        oriented(
          detail,
          [x + math.cos(a) * dx, y, z + math.sin(a) * dx],
          [0.2, h, 0.19],
          a,
          STONE,
          "retained-window-surround",
          isnative,
        )
  return count


def native_skin(detail: Detail) -> Detail:
  """Independent orthogonal surface construction without smooth native duplicates."""
  groups: dict[tuple[int, ...], list[Any]] = {}
  for tri, color, _ in detail.triangles:
    groups.setdefault(color, []).append(tri)
  native = Detail()
  surfaces = [
    dict(color=(c[0] << 16) + (c[1] << 8) + c[2], triangles=ts)
    for c, ts in groups.items()
  ]
  for r in native_blocks(dict(surfaces=surfaces, boxes=[], rods=[])):
    color = ((int(r[6]) >> 16) & 255, (int(r[6]) >> 8) & 255, int(r[6]) & 255)
    native.box(r[:3], r[3:6], color, "native-stadthaus-surface")
  return native


def build() -> None:
  """Publish one bounded companion and exact retirement receipts, shared files untouched."""
  source = read(SOURCE) if SOURCE.exists() else extract()
  old = read(OLD)
  receipt = old_tower_receipt(old)
  drawn = tower()
  roof = west_roof(source, drawn)
  native = native_skin(drawn)
  frames = facade_frames(source, old, drawn, native)
  ident, bounds = "stadthaus239-5_0", [2560, 0, 3072, 512]
  descriptor = dict(id=ident, bounds=bounds)
  counts = {}
  for mode, detail in [("drawn", drawn), ("minecraft", native)]:
    mesh = packed_detail(detail, box(*bounds))
    mesh["kind"] = "stadthaus-v239"
    payload = dict(
      schemaVersion=1,
      id=ident,
      origin=[2560, -10, 0],
      meshes=[mesh],
      nav=dict(groundY=3, ground=[], water=[], buildings=[]),
    )
    path = OUT / f"{ident}.{mode}.json.gz"
    write(path, payload)
    descriptor[mode] = dict(
      url=path.name,
      encoding="gzip",
      bytes=path.stat().st_size,
      decodedBytes=len(gzip.decompress(path.read_bytes())),
      sha256=sha(path),
    )
    nv = len(base64.b64decode(mesh["positions"])) // 6
    ni = len(base64.b64decode(mesh["indices"])) // 4
    counts[mode] = dict(
      vertices=nv,
      triangles=ni // 3,
      gpuBytes=nv * 12 + ni * (2 if nv <= 65535 else 4),
      roles=dict(Counter(r[2] for r in detail.triangles)),
    )
  receipt["sourceEvidenceSha256"] = sha(SOURCE)
  write(RECEIPT, receipt)
  write(
    ADDITION,
    dict(
      schemaVersion=1,
      version="1.0.139",
      chunks=[descriptor],
      source=dict(
        policy=POLICY,
        sourceSha256=sha(SOURCE),
        replacementSha256=sha(RECEIPT),
        visualReferences=VISUAL_REFERENCES,
      ),
    ),
  )
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      sourceSha256=sha(SOURCE),
      receiptSha256=sha(RECEIPT),
      additionSha256=sha(ADDITION),
      sourceParent=PARENT,
      sourceSheets=len(source["part"]["surfaces"]),
      preservedCourts=5,
      preservedV182Facade=dict(
        segments=source["oldFeature"]["segmentCount"],
        boxes=source["oldFeature"]["boxCount"],
      ),
      oldTowerRetirement=dict(
        boxes=len(receipt["boxes"]), segments=len(receipt["segments"])
      ),
      tower=dict(
        center=list(CENTER),
        groundY=BASE,
        topY=83,
        colonnadedStoreys=2,
        columnsPerStorey=8,
        publishedHeightM=80,
      ),
      roof=roof,
      framedExistingWindows=frames,
      counts=counts,
      visualReferences=VISUAL_REFERENCES,
      unchangedFiles={
        str(p.relative_to(ROOT)): sha(p)
        for p in [
          OLD,
          GEO / "city-recognition-v182-osm.json",
          GEO / "city-recognition-v182-evidence.json",
        ]
      },
    ),
  )
  print(
    json.dumps(
      dict(
        packets=descriptor,
        counts={
          k: {a: b for a, b in v.items() if a != "roles"} for k, v in counts.items()
        },
        frames=frames,
      ),
      indent=2,
    )
  )


if __name__ == "__main__":
  build()
