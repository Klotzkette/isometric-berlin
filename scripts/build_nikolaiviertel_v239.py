"""Step 10: bounded Nikolaiviertel recognition over unchanged measured owners.

No existing shell, roof, window, navigation record or packet is replaced. The
two missing church spires use the mapped total height and an explicit estimated
profile; every other fitting follows a retained wall/roof or mapped entrance.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_region_outlines_v200 import world, xml_elements
from build_small_tiergarten_v237 import oriented
from build_steglitz_v182 import native_blocks
from build_west_streets_v163 import partition_detail
from shapely.geometry import LineString, Point, Polygon, box, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "nikolaiviertel-v239-source.json.gz"
EVIDENCE = GEO / "nikolaiviertel-v239-evidence.json"
ADDITION = GEO / "nikolaiviertel-v239-manifest-addition.json"
RAW = GEO / "raw/nikolaiviertel-v239/map.osm"
CATALOGUE = GEO / "alt-mitte-v169/source-391_5819-00.json.gz"
CHURCH = "DEBE01YYK00001VX"
EPHRAIM = "DEBE01YYK00004FS"
KNOBLAUCH = "DEBE01YYK00003ze"
COURT = "DEBE01YYK00009Rh"
NUT = "DEBE01YYK00009i8"
STONE = (208, 199, 176)
BRICK = (155, 99, 77)
COPPER = (111, 141, 133)
IRON = (83, 99, 98)
GOLD = (176, 145, 77)
REFS = [
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011266",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011267",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011270",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011272",
  "https://www.rao-berlin.de/projekt/denkmalrestauration-der-nikolaikirche-berlin/",
  "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/berlin-mitte-codes/artikel.1135546.php",
  "https://www.berlin.museum/museum/nikolaikirche",
  "https://www.berlin.museum/museum/ephraim-palais",
  "https://www.knoblauchhaus.de/",
]
POLICY = (
  "Additive detail on complete existing active LoD2 families inside mapped "
  "Nikolaiviertel way/312391532. Every prior shell, measured roof, window, source "
  "packet, navigation record and retained/conflicting owner remains unchanged. "
  "No broad new window grid, district fill or complete replacement. Source wall "
  "and roof courses are measured; fitting sizes/colours, doorway surrounds, "
  "balcony rails and twin-spire sectional proportions are display estimates. "
  "Nikolaikirche spires use OSM way/23813200 total height 84.4m, not a surveyed "
  "spire profile. No photograph, texture, invented interior or residency increase."
)


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def footprint(record: dict) -> Any:
  return unary_union(
    [Polygon(p["ring"], p["holes"]) for p in record["footprintPolygons"]]
  )


def extract() -> dict:
  """Freeze exact v169 records and current bounded OSM evidence."""
  es = xml_elements(RAW)

  def geometry(e: dict) -> Any:
    if e["type"] == "node":
      return Point(world(e["lon"], e["lat"]))
    ps = [world(es["node", n]["lon"], es["node", n]["lat"]) for n in e["nodes"]]
    return Polygon(ps) if len(ps) > 3 and ps[0] == ps[-1] else LineString(ps)

  district = geometry(es["way", 312391532])
  selected, retained = [], []
  for b in read(CATALOGUE)["buildings"]:
    g = footprint(b)
    if g.area < 50 or district.intersection(g).area / g.area < 0.98:
      continue
    if b["category"] not in {"outer", "core"}:
      retained.append(dict(id=b["id"], category=b["category"]))
      continue
    selected.append(b)
  entrances = []
  for (typ, ident), e in es.items():
    if typ != "node" or not e["tags"].get("entrance"):
      continue
    p = geometry(e)
    if not district.covers(p):
      continue
    distances = sorted((footprint(b).boundary.distance(p), b["id"]) for b in selected)
    if distances and distances[0][0] < 1.25:
      entrances.append(
        dict(
          id=f"node/{ident}",
          owner=distances[0][1],
          tags=e["tags"],
          position=list(p.coords)[0],
        )
      )
  source = dict(
    schemaVersion=1,
    retrieved="2026-10-19",
    policy=POLICY,
    references=REFS,
    licenses=["Geoportal Berlin dl-de/zero-2-0", "OpenStreetMap contributors ODbL-1.0"],
    sourceCatalogue=str(CATALOGUE.relative_to(ROOT)),
    sourceCatalogueSha256=sha(CATALOGUE),
    district=dict(
      id="way/312391532", geometry=mapping(district), tags=es["way", 312391532]["tags"]
    ),
    osm=dict(
      url="https://api.openstreetmap.org/api/0.6/map?bbox=13.4048,52.5148,13.4108,52.5190",
      sha256=sha(RAW),
    ),
    churchOsm=dict(
      id="way/23813200",
      tags=es["way", 23813200]["tags"],
      geometry=mapping(geometry(es["way", 23813200])),
    ),
    buildings=selected,
    retainedUnmodified=retained,
    entrances=entrances,
    preservation={
      str(p.relative_to(ROOT)): sha(p)
      for p in [
        OUT / "4_0.drawn.json.gz",
        OUT / "4_0.minecraft.json.gz",
        ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json",
        ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json",
      ]
    },
  )
  write(SOURCE, source)
  return source


def axes(building: dict, neighbours: list[dict]) -> list[dict]:
  """Exterior planes only, retaining the original heights and roof outlines."""
  result = []
  for p in building["parts"]:
    g = footprint(p)
    for s in p["surfaces"]:
      if s["kind"] != "WallSurface":
        continue
      ring = s["rings"][0]
      a, c = max(
        ((a, c) for a in ring for c in ring),
        key=lambda ac: math.hypot(ac[0][0] - ac[1][0], ac[0][2] - ac[1][2]),
      )
      av, cv = np.array(a)[[0, 2]], np.array(c)[[0, 2]]
      length = float(np.linalg.norm(cv - av))
      if length < 1:
        continue
      d = (cv - av) / length
      n = np.array([-d[1], d[0]])
      if g.covers(Point((av + cv) / 2 + n * 0.15)):
        n = -n
      mid = Point((av + cv) / 2 + n * 0.2)
      occluders = [
        q["topY"] for q in neighbours if q["id"] != p["id"] and footprint(q).covers(mid)
      ]
      low, high = (
        max(min(v[1] for v in ring), max(occluders, default=-100)),
        max(v[1] for v in ring),
      )
      plane = Polygon([((np.array(v)[[0, 2]] - av).dot(d), v[1]) for v in ring]).buffer(
        0
      )
      if high - low < 0.3 or plane.is_empty:
        continue
      result.append(
        dict(
          a=av,
          d=d,
          n=n,
          length=length,
          low=low,
          high=high,
          plane=plane,
          part=p["id"],
          surface=s["sourcePolygonId"],
          ring=ring,
        )
      )
  return result


def fitting(
  detail: Detail,
  f: dict,
  u: float,
  y: float,
  w: float,
  h: float,
  depth: float,
  colour: tuple,
  role: str,
  native: bool,
  offset: float = 0.18,
) -> bool:
  """Small source-plane members, no panel replacing a complete old facade."""
  if y - h / 2 < f["low"] + 0.015 or not f["plane"].buffer(0.002).covers(
    box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
  ):
    return False
  p = f["a"] + f["d"] * u + f["n"] * (1.6 if native else offset)
  if native:
    # The independent native reading uses complete 0.75m stair-step members.
    # Both native device profiles share these same full spans and small fittings.
    count = max(1, math.ceil(w / 0.75))
    for index in range(count):
      c = p + f["d"] * ((index + 0.5) * w / count - w / 2)
      detail.box(
        [c[0], y, c[1]],
        [
          abs(f["d"][0]) * w / count + abs(f["n"][0]) * depth,
          h,
          abs(f["d"][1]) * w / count + abs(f["n"][1]) * depth,
        ],
        colour,
        role,
      )
  else:
    oriented(
      detail,
      [p[0], y, p[1]],
      [w, h, depth],
      math.atan2(f["d"][1], f["d"][0]),
      colour,
      role,
      False,
    )
  return True


def line_member(
  detail: Detail, a: list, b: list, width: float, colour: tuple, role: str, native: bool
) -> None:
  """Thin actual source edge, independently assembled in native short blocks."""
  a, b = np.array(a), np.array(b)
  delta = b - a
  length = float(np.linalg.norm(delta))
  if length < 0.1:
    return
  count = max(1, math.ceil(length / 0.75)) if native else 1
  for i in range(count):
    c = a + delta * (i + 0.5) / count
    if native:
      size = np.maximum(np.abs(delta) / count, width)
      detail.box(c.tolist(), size.tolist(), colour, role)
    else:
      along = delta / length
      side = np.cross(along, [0, 1, 0])
      if np.linalg.norm(side) < 0.01:
        side = np.array([1.0, 0, 0])
      side = side / np.linalg.norm(side) * width / 2
      up = np.cross(along, side)
      aa, bb = a + delta * i / count, a + delta * (i + 1) / count
      vertices = [
        q + s * side + t * up
        for q in [aa, bb]
        for s, t in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
      ]
      for ids in [
        (0, 3, 2, 1),
        (4, 5, 6, 7),
        (0, 1, 5, 4),
        (1, 2, 6, 5),
        (2, 3, 7, 6),
        (3, 0, 4, 7),
      ]:
        detail.polygon([vertices[j].tolist() for j in ids], colour, role)


def church_spires(detail: Detail, church: dict, native: bool) -> list[dict]:
  """Twin octagonal copper helmets on the measured western tower footprint."""
  tower = next(p for p in church["parts"] if p["id"] == "DEBE3DJ5QoacFhgE")
  g = footprint(tower)
  rectangle = np.array(g.minimum_rotated_rectangle.exterior.coords[:-1])
  edges = [rectangle[(i + 1) % 4] - rectangle[i] for i in range(4)]
  axis = max(edges, key=np.linalg.norm)
  length = float(np.linalg.norm(axis))
  axis /= length
  center = np.array(g.centroid.coords[0])
  top = church["groundY"] + float(church["osmContext"]["tags"]["height"])
  base = tower["topY"] - 0.15
  spires = Detail()
  audit = []
  for sign in [-1, 1]:
    c = center + axis * sign * length * 0.25
    profiles = [(base, 4.0), (base + 1.15, 4.1), (base + 5.0, 3.65), (top - 1.1, 0.16)]
    spires.lathe(c[0], c[1], profiles, COPPER, "twin-copper-spire", segments=8)
    # Small copper ribs and the terminal mast remain original procedural members.
    for a in np.arange(8) * math.pi / 4:
      line_member(
        spires,
        [c[0] + 3.7 * math.cos(a), base + 5, c[1] + 3.7 * math.sin(a)],
        [c[0] + 0.16 * math.cos(a), top - 1.1, c[1] + 0.16 * math.sin(a)],
        0.075,
        (137, 158, 143),
        "spire-seam",
        False,
      )
    spires.box([c[0], top - 0.55, c[1]], [0.13, 1.1, 0.13], GOLD, "spire-finial")
    audit.append(
      dict(
        center=c.tolist(),
        baseY=base,
        topY=top,
        radiusEstimate=4.1,
        towerPart=tower["id"],
      )
    )
  if native:
    surfaces = [
      dict(color=(rgb[0] << 16) + (rgb[1] << 8) + rgb[2], triangles=[tri])
      for tri, rgb, _ in spires.triangles
    ]
    for row in native_blocks(dict(surfaces=surfaces, boxes=[], rods=[])):
      color = row[6]
      detail.box(
        row[:3],
        row[3:6],
        ((color >> 16) & 255, (color >> 8) & 255, color & 255),
        "independent-twin-spire-skin",
      )
  else:
    detail.triangles.extend(spires.triangles)
  return audit


def architectural_details(source: dict, native: bool) -> tuple[Detail, dict]:
  detail = Detail()
  counts = {}
  audit = []
  neighbours = [p for b in source["buildings"] for p in b["parts"]]
  for b in source["buildings"]:
    start = len(detail.triangles)
    fs = axes(b, neighbours)
    paired_chords = {
      f["surface"]
      for f in sorted(
        [
          f
          for f in fs
          if b["id"] == EPHRAIM
          and f["low"] < 4
          and f["high"] > 22
          and f["n"][0] > 0.25
          and f["a"][0] > 2418
          and 1 < f["length"] < 2.4
        ],
        key=lambda f: float((f["a"] + f["d"] * f["length"] / 2)[1]),
      )[::3]
    }
    colour = BRICK if b["id"] in {CHURCH, COURT} else STONE
    for f in fs:
      # Full-level eave and cornice profiles sit on the original outside walls.
      if f["length"] > 2.8:
        horizontal = [
          (a, c)
          for a, c in zip(f["ring"], f["ring"][1:] + f["ring"][:1])
          if abs(a[1] - c[1]) < 0.025 and a[1] > f["low"] + 1 and math.dist(a, c) > 2.5
        ]
        if horizontal:
          a, c = max(horizontal, key=lambda ac: ac[0][1])
          y = a[1] - 0.15
          fitting(
            detail,
            f,
            f["length"] / 2,
            y,
            f["length"] - 0.15,
            0.19,
            0.27,
            colour,
            "measured-eave-cornice",
            native,
          )
          if b["id"] not in {CHURCH, COURT}:
            fitting(
              detail,
              f,
              0.22,
              (f["low"] + y) / 2,
              0.085,
              y - f["low"] - 0.1,
              0.1,
              IRON,
              "source-wall-downpipe",
              native,
            )
      if b["id"] == CHURCH:
        # Keep prior glazing visible; buttress caps and string courses clarify
        # the actual subdivided stone westwork and brick hall without a new grid.
        if f["part"] == "DEBE3DJ5QoacFhgE":
          for y in [13.3, 23.6, 33.7, 40.8]:
            fitting(
              detail,
              f,
              f["length"] / 2,
              y,
              f["length"] - 0.08,
              0.22,
              0.3,
              STONE,
              "westwork-string-course",
              native,
            )
        elif f["length"] < 2.4 and f["high"] > 12:
          fitting(
            detail,
            f,
            f["length"] / 2,
            f["high"] - 0.22,
            f["length"] - 0.06,
            0.2,
            0.27,
            BRICK,
            "mapped-buttress-cap",
            native,
          )
        continue
      if b["id"] == EPHRAIM and f["low"] < 4 and f["high"] > 22:
        # The short measured east-facing chord sequence is the rounded corner.
        east = f["n"][0] > 0.25 and f["a"][0] > 2418
        if east and f["length"] > 1.0:
          if f["surface"] in paired_chords:
            for du in [-0.19, 0.19]:
              fitting(
                detail,
                f,
                f["length"] / 2 + du,
                13.6,
                0.13,
                17.3,
                0.24,
                STONE,
                "rococo-paired-pilaster",
                native,
              )
          for y in [9.0, 14.6, 20.2, 22.7]:
            fitting(
              detail,
              f,
              f["length"] / 2,
              y,
              f["length"] - 0.06,
              0.16,
              0.3,
              STONE,
              "rounded-palais-belt",
              native,
            )
          # Balcony rail lies only along the real curved facade, never across
          # the street or a court. Individual balusters leave the field open.
          if 386 < f["a"][1] < 396:
            for y in [9.25, 14.85, 20.45]:
              fitting(
                detail,
                f,
                f["length"] / 2,
                y,
                f["length"] - 0.08,
                0.055,
                0.06,
                GOLD,
                "palais-gilt-rail",
                native,
                0.48,
              )
              fitting(
                detail,
                f,
                f["length"] / 2,
                y - 0.43,
                0.055,
                0.86,
                0.055,
                GOLD,
                "palais-gilt-baluster",
                native,
                0.48,
              )
      # Existing v169 aperture pitch/levels receive lintel/sill shadow only.
      # The original glass, mullions, count and source planes remain visible.
      if b["id"] in {KNOBLAUCH, NUT, COURT, EPHRAIM} and f["length"] > 3:
        pitch = f["length"] / max(1, round(f["length"] / 3.4))
        for y in np.arange(
          max(b["groundY"] + 2.25, f["low"] + 1.2), f["high"] - 0.8, 3.25
        ):
          for u in np.arange(pitch / 2, f["length"], pitch):
            fitting(
              detail,
              f,
              u,
              y + 1.1,
              1.7,
              0.11,
              0.24,
              colour,
              "retained-aperture-lintel",
              native,
            )
            if b["id"] == KNOBLAUCH:
              fitting(
                detail,
                f,
                u,
                y - 1.04,
                1.7,
                0.09,
                0.26,
                (164, 151, 128),
                "knoblauch-sill-shadow",
                native,
              )
      # Every house keeps its actual roof silhouette; only genuine roof-sheet
      # edge courses are annotated below, with no dormer or gable invention.
    roof_edges = set()
    for p in b["parts"]:
      for s in p["surfaces"]:
        if s["kind"] != "RoofSurface":
          continue
        for ring in s["rings"]:
          for a, c in zip(ring, ring[1:] + ring[:1]):
            key = tuple(sorted((tuple(a), tuple(c))))
            if key in roof_edges or math.dist(a, c) < 2.4:
              continue
            roof_edges.add(key)
            # Restrained roof-edge accents retain source xyz, all original roofs.
            aa = [a[0], a[1] + 0.045, a[2]]
            cc = [c[0], c[1] + 0.045, c[2]]
            line_member(detail, aa, cc, 0.07, IRON, "measured-roof-edge", native)
    for e in [e for e in source["entrances"] if e["owner"] == b["id"]]:
      p = np.array(e["position"])
      if not fs:
        continue
      f = min(
        fs,
        key=lambda f: LineString([f["a"], f["a"] + f["d"] * f["length"]]).distance(
          Point(p)
        ),
      )
      u = float(np.clip((p - f["a"]).dot(f["d"]), 0, f["length"]))
      for du in [-0.78, 0.78]:
        fitting(
          detail,
          f,
          u + du,
          b["groundY"] + 1.35,
          0.1,
          2.6,
          0.2,
          colour,
          "mapped-door-surround",
          native,
        )
      fitting(
        detail,
        f,
        u,
        b["groundY"] + 2.7,
        1.65,
        0.12,
        0.2,
        colour,
        "mapped-door-lintel",
        native,
      )
      if not native:
        audit.append(
          dict(
            id=e["id"],
            owner=b["id"],
            wall=f["surface"],
            sourcePosition=e["position"],
            wallDistance=float(
              LineString([f["a"], f["a"] + f["d"] * f["length"]]).distance(Point(p))
            ),
          )
        )
    counts[b["id"]] = len(detail.triangles) - start
  church = next(b for b in source["buildings"] if b["id"] == CHURCH)
  spires = church_spires(detail, church, native)
  return detail, dict(ownerTriangles=counts, entrances=audit, spires=spires)


def build() -> dict:
  source = read(SOURCE) if SOURCE.exists() else extract()
  for path, digest in source["preservation"].items():
    assert sha(ROOT / path) == digest, (path, "prior source changed")
  models = {}
  audits = {}
  for mode in ["drawn", "minecraft"]:
    detail, audits[mode] = architectural_details(source, mode == "minecraft")
    audits[mode]["roles"] = dict(Counter(role for _, _, role in detail.triangles))
    if mode == "minecraft":
      audits[mode]["construction"] = (
        "Independent orthogonal 0.75m members and 1m spire surface skin; full spans, identical mobile/desktop"
      )
    models[mode] = partition_detail(detail)
  descriptors = []
  receipts = {}
  for ix, iz in sorted(set(models["drawn"]) | set(models["minecraft"])):
    bounds = [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512]
    ident = f"nikolai239-{ix}_{iz}"
    desc = dict(id=ident, bounds=bounds)
    for mode in ["drawn", "minecraft"]:
      d = models[mode].get((ix, iz), Detail())
      mesh = packed_detail(d, box(*bounds))
      assert mesh
      mesh["kind"] = "nikolaiviertel-v239"
      payload = dict(
        schemaVersion=1,
        id=ident,
        origin=[ix * 512, -10, iz * 512],
        meshes=[mesh],
        nav=dict(groundY=3, ground=[], water=[], buildings=[]),
      )
      path = OUT / f"{ident}.{mode}.json.gz"
      write(path, payload)
      decoded = len(gzip.decompress(path.read_bytes()))
      desc[mode] = dict(
        url=path.name,
        encoding="gzip",
        bytes=path.stat().st_size,
        decodedBytes=decoded,
        sha256=sha(path),
      )
      nv = len(base64.b64decode(mesh["positions"])) // 6
      ni = len(base64.b64decode(mesh["indices"])) // 4
      receipts[f"{mode}:{ident}"] = dict(
        vertices=nv,
        indices=ni,
        gpuBytes=nv * 12 + ni * (2 if nv < 65536 else 4),
        roles=dict(Counter(role for _, _, role in d.triangles)),
      )
      assert decoded < 12 * 1024**2 and nv < 400000 and ni < 2400000
    descriptors.append(desc)
  write(
    ADDITION,
    dict(
      schemaVersion=1,
      chunks=descriptors,
      footprint=[],
      source=dict(sourceSha256=sha(SOURCE), additiveOnly=True),
    ),
  )
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    sourceSha256=sha(SOURCE),
    additionSha256=sha(ADDITION),
    buildings=len(source["buildings"]),
    parts=sum(len(b["parts"]) for b in source["buildings"]),
    packets=receipts,
    audits=audits,
    unchanged=source["preservation"],
    retainedUnmodified=source["retainedUnmodified"],
  )
  write(EVIDENCE, evidence)
  return dict(
    buildings=evidence["buildings"],
    parts=evidence["parts"],
    packets=len(descriptors),
    gpuBytes={
      mode: sum(r["gpuBytes"] for k, r in receipts.items() if k.startswith(mode + ":"))
      for mode in models
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract()
  print(json.dumps(build(), indent=2))
