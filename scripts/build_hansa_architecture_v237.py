"""Source-bound Hansaviertel facades and the measured four-wing library.

The historical core stays intact except the explicitly receipted library proxy.
All additions use ordinary streamed packets, with separately compiled native faces.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts
from scripts import build_district_facades_v188 as base
from scripts.build_bebelplatz_building_source import extract_parent, part_profile
from scripts.build_concert_halls_v160 import normal_of, triangulate
from scripts.build_karl_marx_allee_v161 import Detail, packed_detail
from scripts.build_west_streets_v163 import partition_detail

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "hansa-architecture-v237-source.json.gz"
EVIDENCE = GEO / "hansa-architecture-v237-evidence.json"
ADDITION = GEO / "hansa-v237-manifest-addition.json"
PROFILE = ROOT / "src/app/src/data/hansaLibraryV237.json"
LIBRARY = "DEBE01YYK0002RWG"
ASSOCIATION = "https://hansaviertel.berlin/bauwerke/"
# Coordinates/parents are joined to retained cadastral footprints and OSM addresses.
# Bay spacings are restrained display fits; only named source traits are asserted.
TARGETS = [
  (
    "2RWG",
    "Hansabibliothek",
    "library",
    1,
    "altonaer-strasse-15-stadtteilbibliothek-w-duettmann/",
  ),
  (
    "2KkI",
    "Schwedenhaus · Jaenecke/Samuelson",
    "sweden",
    9,
    "altonaer-strasse-3-9-schwedenhaus/",
  ),
  ("2MDh", "Niemeyer-Haus", "niemeyer", 7, "altonaer-strasse-4-14-oscar-niemeyer/"),
  ("2SxC", "Eiermann-Haus", "eiermann", 9, "bartningallee-2-4-egon-eiermann/"),
  ("2TGh", "Aalto-Haus", "aalto", 8, "klopstockstrasse-30-32-alvar-aalto/"),
  ("2PCF", "Vago-Haus", "vago", 9, "klopstockstrasse-14-18-pierre-vago/"),
  ("2NFz", "Hassenpflug-Haus · Bartningallee 7", "tower", 16, ""),
  ("2MkA", "Van den Broek/Bakema · Bartningallee 9", "tower", 14, ""),
  (
    "2L36",
    "Schwippert-Haus · Bartningallee 16",
    "schwippert",
    16,
    "bartningallee-16-hans-schwippert/",
  ),
  ("2Lju", "Baldessari-Haus · Bartningallee 5", "tower", 17, ""),
  ("2RT2", "Giraffe-Hochhaus", "tower", 17, ""),
  ("2UIx", "Eternit-Haus · Paul Baumgarten", "low", 3, ""),
  ("2PvN", "Kay Fisker · Bartningallee 10", "low", 4, ""),
  ("2L71", "Otto Heinrich Senn · Bartningallee 12", "low", 4, ""),
  ("2MrA", "Franz Schuster · Hanseatenweg 6", "low", 3, ""),
  ("2SQQ", "Max Taut · Hanseatenweg 1–3", "low", 4, ""),
]
GLASS = (111, 142, 151)
FRAME = (218, 219, 205)
SHADOW = (106, 119, 119)
BRICK = (168, 139, 109)
STONE = (205, 204, 190)
POLICY = (
  "All original official LoD2 sheets and existing core prisms are retained. "
  "Only the four named library prisms and the explicitly saved old authored "
  "rectangular library walls/glass are retired; the garden, water, Gropius and "
  "all other previous geometry remain. Other houses gain only exterior facade "
  "details against their actual retained walls. Window subdivision, glazing tone, "
  "rail dimensions and spacing are architectural recognition estimates, not "
  "surveyed openings. Documented north/south balcony colours, blank slab ends, "
  "library brick infill and inward glazing are distinguished. No global group, "
  "texture, additional ground, navigation barrier or residency limit increase."
)


def extract() -> dict[str, Any]:
  """Freeze complete original sheets plus exact prior presentation receipts."""
  gpkg = GEO / "buildings.gpkg"
  frame = gpd.read_file(gpkg, bbox=(387000, 5819400, 388100, 5820400))
  original_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prisms = {p["id"]: p for p in base.read_json(original_path)["buildings"]}
  buildings, archive_hashes = [], {}
  for suffix, name, style, floors, slug in TARGETS:
    identity = "DEBE01YYK000" + suffix
    rows = frame[
      (frame.parent_building_id == identity) | (frame.building_id == identity)
    ]
    assert len(rows), identity
    archive = ROOT / str(rows.iloc[0].source_zip)
    if str(archive) not in archive_hashes:
      archive_hashes[str(archive)] = base.digest(archive)
    parent = extract_parent(archive, identity)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    previous = [prisms[p["id"][-8:]] for p in parts if p["id"][-8:] in prisms]
    assert previous and (identity != LIBRARY or len(previous) == len(parts)), identity
    buildings.append(
      dict(
        id=identity,
        name=name,
        style=style,
        floors=floors,
        sourceUrl="https://gdi.berlin.de/data/a_lod2/atom/" + archive.name,
        archive=str(archive.relative_to(ROOT)),
        archiveSha256=archive_hashes[str(archive)],
        referenceUrl=ASSOCIATION + slug,
        parts=parts,
        previousPrisms=previous,
        displayShift=round(5.2 - min(p["ground_y_m"] for p in parts), 3),
      )
    )
  historical = subprocess.check_output(
    ["git", "show", "v1.0.136:src/app/src/CityRecognitionRefinements.ts"], cwd=ROOT
  ).decode()
  begin = historical.index(
    "  const courtyard = 18;", historical.index("function addHansaviertelDetails")
  )
  end = historical.index("  localBox(\n    waterBuilder,", begin)
  result = dict(
    schemaVersion=1,
    coordinateSystem="x=easting−389500; y=NHN−30; z=5820000−northing",
    license="Geoportal Berlin dl-de/zero-2-0",
    sourceCreated="2026-03-01",
    buildings=buildings,
    previousCoreSha256=base.digest(original_path),
    libraryProxyReceipt=dict(
      baseline="v1.0.136",
      path="src/app/src/CityRecognitionRefinements.ts",
      wholeFileSha256=hashlib.sha256(historical.encode()).hexdigest(),
      retiredBlock=historical[begin:end],
      retained="Old garden and water, Gropius and every other authored object",
    ),
    primaryReferences=[
      "https://www.berlin.de/stadtbibliothek-mitte/bibliotheken/hansabibliothek/architektur-geschichte/",
      "https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/hansabuecherei-im-hansaviertel-641033.php",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050387,T",
      *sorted({b["referenceUrl"] for b in buildings}),
    ],
    policy=POLICY,
  )
  voxel_path = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
  voxels = base.read_json(voxel_path)
  cell, grid = voxels["cell_m"], voxels["grid"]
  columns = []
  for iz, runs in enumerate(voxels["building_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    if not -180 < z < 450:
      continue
    for start, count, lo, hi, *_ in runs:
      for ix in range(start, start + count):
        x = (grid["min_x_idx"] + ix + 0.5) * cell
        if -2260 < x < -1550:
          columns.append([x, z, lo / 10, hi / 10])
  result["nativeCoreColumns"] = columns
  result["nativeCoreSha256"] = base.digest(voxel_path)
  result["nativeCellM"] = cell
  base.write_json(SOURCE, result)
  return result


def facade_axes(part: dict, prism: dict) -> list[dict]:
  """Select only original exterior wall sheets, aligned to the retained prism."""
  footprint = Polygon(part["ring"], part["holes"])
  result = []
  for surface in part["surfaces"]:
    if surface["kind"] != "WallSurface":
      continue
    ring = surface["rings"][0]
    n = normal_of(ring)
    if not np.isfinite(n).all() or abs(n[1]) > 0.03:
      continue
    a, b = max(
      ((a, b) for a in ring for b in ring),
      key=lambda p: math.hypot(p[0][0] - p[1][0], p[0][2] - p[1][2]),
    )
    length = math.hypot(b[0] - a[0], b[2] - a[2])
    if length < 2.6:
      continue
    dx, dz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
    nx, nz = dz, -dx
    mid = Point((a[0] + b[0]) / 2 + nx * 0.2, (a[2] + b[2]) / 2 + nz * 0.2)
    if footprint.contains(mid):
      nx, nz = -nx, -nz
    result.append(
      dict(
        a=[a[0], a[2]],
        d=[dx, dz],
        n=[nx, nz],
        length=length,
        base=prism["y0_dm"] / 10,
        top=(prism["y0_dm"] + prism["h_dm"]) / 10,
      )
    )
  return result


def pane(
  detail: Detail,
  axis: dict,
  u: float,
  y: float,
  w: float,
  h: float,
  colour: tuple,
  role: str,
  native: bool,
  out: float = 0.16,
) -> None:
  """Draw an exact source-aligned plate or independently stepped native plate."""
  if w <= 0.02 or h <= 0.02:
    return
  ax, az = axis["a"]
  dx, dz = axis["d"]
  nx, nz = axis["n"]
  u0, u1, y0, y1 = u - w / 2, u + w / 2, y - h / 2, y + h / 2
  if not native:
    detail.polygon(
      [
        [ax + dx * q + nx * out, v, az + dz * q + nz * out]
        for q, v in [(u0, y0), (u1, y0), (u1, y1), (u0, y1)]
      ],
      colour,
      role,
    )
    return
  if "nativeColumns" in axis:
    columns = axis["nativeColumns"]
    normal_axis = 0 if abs(nx) >= abs(nz) else 1
    sign = 1 if axis["n"][normal_axis] > 0 else -1
    slices = max(1, math.ceil(w / 1.8))
    for index in range(slices):
      q = u0 + (index + 0.5) * w / slices
      keep = (
        (columns[:, 2] <= y0)
        & (columns[:, 3] >= y1)
        & (np.abs(axis["nativeAlong"] - q) <= w / slices / 2 + 2.2)
        & (np.abs(axis["nativeReach"]) <= 4.4)
      )
      hits = columns[keep, normal_axis] + sign * 2
      if not len(hits):
        continue
      face = (max(hits) if sign > 0 else min(hits)) + sign * (out + 0.03)
      tangent = az + dz * q if normal_axis == 0 else ax + dx * q
      half = max(0.04, w / slices * abs(axis["d"][1 - normal_axis]) / 2)
      points = (
        [
          [face, y0, tangent - half],
          [face, y0, tangent + half],
          [face, y1, tangent + half],
          [face, y1, tangent - half],
        ]
        if normal_axis == 0
        else [
          [tangent - half, y0, face],
          [tangent + half, y0, face],
          [tangent + half, y1, face],
          [tangent - half, y1, face],
        ]
      )
      detail.polygon(points, colour, role)
    return
  # Each native library face is axis aligned, on its own measured small shell.
  dominant_x = abs(nx) >= abs(nz)
  tangent_a, tangent_d = (az, dz) if dominant_x else (ax, dx)
  lo, hi = sorted([tangent_a + tangent_d * u0, tangent_a + tangent_d * u1])
  cuts = [lo] + list(np.arange(math.ceil(lo / 0.5) * 0.5, hi, 0.5)) + [hi]
  y0, y1 = round(y0 / 0.05) * 0.05, round(y1 / 0.05) * 0.05
  for start, end in zip(cuts, cuts[1:]):
    if end - start < 0.01:
      continue
    q = ((start + end) / 2 - tangent_a) / tangent_d
    p = ax + dx * q + nx * out if dominant_x else az + dz * q + nz * out
    normal = nx if dominant_x else nz
    p = (math.ceil(p / 0.05) if normal > 0 else math.floor(p / 0.05)) * 0.05
    points = (
      [[p, y0, start], [p, y0, end], [p, y1, end], [p, y1, start]]
      if dominant_x
      else [[start, y0, p], [end, y0, p], [end, y1, p], [start, y1, p]]
    )
    detail.polygon(points, colour, role)


def window(
  detail: Detail,
  a: dict,
  u: float,
  y: float,
  w: float,
  h: float,
  native: bool,
  role: str,
) -> None:
  pane(detail, a, u, y, w + 0.14, h + 0.14, SHADOW, role + ": reveal", native, 0.15)
  pane(detail, a, u, y, w, h, GLASS, role + ": glass", native, 0.19)
  for x in [u - w / 2, u, u + w / 2]:
    pane(detail, a, x, y, 0.065, h, FRAME, role + ": mullion", native, 0.23)
  for v in [y - h / 2, y + h / 2]:
    pane(detail, a, u, v, w + 0.1, 0.07, FRAME, role + ": frame", native, 0.23)


def facade(
  detail: Detail, building: dict, part: dict, prism: dict, native: bool
) -> None:
  style, identity = building["style"], building["id"]
  axes = facade_axes(part, prism)
  maximum = max((a["length"] for a in axes), default=0)
  parent_height = (
    max((p["y0_dm"] + p["h_dm"]) / 10 for p in building["previousPrisms"]) - 5.2
  )
  pitch = parent_height / building["floors"]
  footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in building["parts"]])
  native_columns = np.asarray(building.get("nativeColumns", []))
  for a in axes:
    length, base_y, top = a["length"], a["base"], a["top"]
    if top - base_y < 2.5:
      continue
    # End walls on these slabs are documented as blank; don't invent windows.
    if style in {"sweden", "niemeyer", "eiermann", "vago"} and length < maximum * 0.38:
      continue
    # Parts can meet inside a parent: source envelope seams are not facades.
    probe = Point(
      a["a"][0] + a["d"][0] * length / 2 + a["n"][0] * 0.4,
      a["a"][1] + a["d"][1] * length / 2 + a["n"][1] * 0.4,
    )
    if footprint.contains(probe):
      continue
    if native and style != "library":
      if not len(native_columns):
        continue
      a["nativeColumns"] = native_columns
      relative = native_columns[:, :2] - np.asarray(a["a"])
      a["nativeAlong"] = relative @ np.asarray(a["d"])
      a["nativeReach"] = relative @ np.asarray(a["n"])
    role = identity + ":" + part["id"][-8:]
    if style == "library":
      # Courtyard-facing walls are glass; external walls keep recessed brick.
      centre = np.mean(np.asarray(part["ring"]), axis=0)
      court = Point(-1953.5, 155.6)
      inward = np.dot(np.asarray([court.x, court.y]) - centre, np.asarray(a["n"])) > 0
      pane(
        detail,
        a,
        length / 2,
        base_y + 1.85,
        length - 0.35,
        3.05,
        GLASS if inward else BRICK,
        role + ": library infill",
        native,
        0.11,
      )
      bays = max(1, round(length / 2.75))
      for i in range(bays + 1):
        pane(
          detail,
          a,
          0.16 + i * (length - 0.32) / bays,
          base_y + 1.9,
          0.12,
          3.7,
          STONE,
          role + ": concrete frame",
          native,
          0.2,
        )
      for y in [base_y + 0.25, top - 0.22]:
        pane(
          detail,
          a,
          length / 2,
          y,
          length,
          0.18,
          STONE,
          role + ": concrete edge",
          native,
          0.2,
        )
      if not inward and a["n"][1] < -0.7 and length > 12:
        window(
          detail,
          a,
          length * 0.55,
          base_y + 1.3,
          2.4,
          2.4,
          native,
          role + ": entrance display fit",
        )
      continue
    count = max(
      1,
      round(
        length / (4.2 if style in {"sweden", "niemeyer", "vago", "eiermann"} else 3.15)
      ),
    )
    width = length / count
    for level in range(building["floors"]):
      y = 5.2 + (level + 0.55) * pitch
      if y - pitch * 0.3 < base_y + 0.45 or y + pitch * 0.3 > top - 0.45:
        continue
      for i in range(count):
        u = (i + 0.5) * width
        window(
          detail, a, u, y, min(width - 0.45, 2.5), min(pitch * 0.57, 1.9), native, role
        )
        if (
          style in {"sweden", "niemeyer", "eiermann", "vago", "schwippert"}
          and level > 0
        ):
          colour = STONE
          if style == "sweden":
            colour = (111, 145, 166) if a["n"][1] > 0 else (170, 100, 89)
          if style == "vago":
            colour = [
              (218, 214, 200),
              (153, 164, 163),
              (114, 151, 167),
              (206, 184, 107),
            ][(i + level) % 4]
          pane(
            detail,
            a,
            u,
            y - pitch * 0.38,
            width - 0.15,
            0.58,
            colour,
            role + ": balcony/spandrel display fit",
            native,
            0.26,
          )
          pane(
            detail,
            a,
            u,
            y - pitch * 0.38 + 0.34,
            width - 0.15,
            0.055,
            FRAME,
            role + ": fine balcony rail",
            native,
            0.29,
          )
      if style in {"eiermann", "sweden", "niemeyer", "vago"}:
        pane(
          detail,
          a,
          length / 2,
          y - pitch * 0.5,
          length - 0.16,
          0.13,
          STONE,
          role + ": floor edge",
          native,
          0.29,
        )
    # Source-aligned roof edge and a shallow raised plinth improve depth.
    pane(
      detail,
      a,
      length / 2,
      top - 0.18,
      length - 0.1,
      0.13,
      STONE,
      role + ": roof edge",
      native,
      0.18,
    )
    pane(
      detail,
      a,
      length / 2,
      base_y + 0.24,
      length - 0.1,
      0.3,
      STONE,
      role + ": plinth",
      native,
      0.16,
    )


def stepped_polygon(g: Any, step: float = 0.25) -> Any:
  """Centre-sampled horizontal source footprint, merged into open native runs."""
  lo, zo, hi, zi = g.bounds
  xs = np.arange(math.floor(lo / step) * step + step / 2, hi, step)
  result = []
  for z in np.arange(math.floor(zo / step) * step + step / 2, zi, step):
    mask = shapely.contains_xy(g, xs, np.full(len(xs), z))
    edges = np.flatnonzero(np.diff(np.r_[False, mask, False]))
    for a, b in zip(edges[::2], edges[1::2]):
      result.append(
        box(xs[a] - step / 2, z - step / 2, xs[b - 1] + step / 2, z + step / 2)
      )
  return unary_union(result).simplify(0)


def library_shell(detail: Detail, b: dict, native: bool) -> None:
  for p in b["parts"]:
    role = "library measured shell:" + p["id"]
    if native:
      footprint = stepped_polygon(Polygon(p["ring"], p["holes"]))
      y0, y1 = p["ground_y_m"] + b["displayShift"], p["top_y_m"] + b["displayShift"]
      for poly in getattr(footprint, "geoms", [footprint]):
        for r in [poly.exterior, *poly.interiors]:
          coords = list(r.coords)
          for a, c in zip(coords, coords[1:]):
            detail.polygon(
              [[a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], y1, c[1]], [a[0], y1, a[1]]],
              STONE,
              role,
            )
        for t in shapely.constrained_delaunay_triangles(poly).geoms:
          detail.polygon(
            [[x, y1, z] for x, z in list(t.exterior.coords)[:3]], (117, 126, 122), role
          )
    else:
      for surface in p["surfaces"]:
        rings = [
          [[x, y + b["displayShift"], z] for x, y, z in r] for r in surface["rings"]
        ]
        for t in triangulate(rings):
          detail.polygon(
            t, STONE if surface["kind"] == "WallSurface" else (117, 126, 122), role
          )


def build() -> dict:
  source = base.read_json(SOURCE)
  current = base.read_json(
    ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  )
  prisms = {p["id"]: p for p in current["buildings"]}
  for b in source["buildings"]:
    assert all(prisms[p["id"]] == p for p in b["previousPrisms"])
  library = next(b for b in source["buildings"] if b["id"] == LIBRARY)
  base.write_json(
    PROFILE,
    dict(
      schemaVersion=1,
      prismIds=[p["id"] for p in library["previousPrisms"]],
      previousPrisms=library["previousPrisms"],
      parts=[
        dict(
          id=p["id"],
          ring=p["ring"],
          holes=p["holes"],
          groundY=p["ground_y_m"] + library["displayShift"],
          topY=p["top_y_m"] + library["displayShift"],
          height_m=p["height_m"],
          ground_y_m=p["ground_y_m"] + library["displayShift"],
          top_y_m=p["top_y_m"] + library["displayShift"],
          surfaces=[
            dict(
              kind=s["kind"],
              rings=[
                [[x, y + library["displayShift"], z] for x, y, z in r]
                for r in s["rings"]
              ],
            )
            for s in p["surfaces"]
            if s["kind"] == "RoofSurface"
          ],
        )
        for p in library["parts"]
      ],
      sourceSha256=base.digest(SOURCE),
    ),
  )
  details = {}
  for b in source["buildings"]:
    envelope = unary_union([Polygon(p["ring"], p["holes"]) for p in b["parts"]]).buffer(
      3
    )
    b["nativeColumns"] = [
      c for c in source["nativeCoreColumns"] if envelope.covers(Point(c[0], c[1]))
    ]
  for family in ("drawn", "minecraft"):
    detail = Detail()
    for b in source["buildings"]:
      previous = {p["id"]: p for p in b["previousPrisms"]}
      if b["id"] == LIBRARY:
        library_shell(detail, b, family == "minecraft")
      for p in b["parts"]:
        if p["id"][-8:] in previous:
          facade(detail, b, p, previous[p["id"][-8:]], family == "minecraft")
    details[family] = partition_detail(detail)
  cells = sorted(set(details["drawn"]) | set(details["minecraft"]))
  descriptors = []
  receipts = {}
  for ix, iz in cells:
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    identity = f"hansa237-{ix}_{iz}"
    descriptor = dict(id=identity, bounds=list(tile.bounds))
    for family in ("drawn", "minecraft"):
      detail = details[family].get((ix, iz), Detail())
      mesh = packed_detail(detail, tile)
      assert mesh
      mesh["kind"] = "hansa-architecture-v237"
      payload = dict(
        schemaVersion=1,
        id=identity,
        origin=[ix * 512, -10, iz * 512],
        meshes=[mesh],
        nav=dict(ground=[], roads=[], water=[], bridges=[], buildings=[], groundY=5.2),
      )
      raw = (json.dumps(payload, separators=(",", ":")) + "\n").encode()
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      url = f"{identity}.{family}.json.gz"
      (OUT / url).write_bytes(packed)
      descriptor[family] = dict(
        url=url,
        encoding="gzip",
        bytes=len(packed),
        decodedBytes=len(raw),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
      vertices = len(base64.b64decode(mesh["positions"])) // 6
      indices = len(base64.b64decode(mesh["indices"])) // 4
      assert vertices < 400000 and indices < 2400000 and len(raw) < 12 * 1024**2
      receipts[family + ":" + identity] = dict(
        vertices=vertices,
        indices=indices,
        geometryBytes=vertices * 12 + indices * (2 if vertices < 65536 else 4),
        roles=dict(Counter(r for _, _, r in detail.triangles)),
      )
    descriptors.append(descriptor)
  evidence = dict(
    schemaVersion=1,
    sourceSha256=base.digest(SOURCE),
    buildings=len(source["buildings"]),
    sourceParts=sum(len(b["parts"]) for b in source["buildings"]),
    libraryPrismIds=[p["id"] for p in library["previousPrisms"]],
    unchangedCoreSha256=base.digest(
      ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
    ),
    packets=receipts,
    libraryCourtyard=dict(
      point=[-1953.5, 155.6],
      insideShell=any(
        Polygon(p["ring"], p["holes"]).contains(Point(-1953.5, 155.6))
        for p in library["parts"]
      ),
    ),
    policy=POLICY,
  )
  base.write_json(EVIDENCE, evidence)
  base.write_json(
    ADDITION,
    dict(
      schemaVersion=1,
      chunks=descriptors,
      footprint=[],
      source=dict(
        source=str(SOURCE.relative_to(ROOT)),
        sourceSha256=base.digest(SOURCE),
        evidence=str(EVIDENCE.relative_to(ROOT)),
        additiveOnly=True,
        libraryExactProxyCorrection=True,
      ),
    ),
  )
  return dict(
    buildings=evidence["buildings"],
    parts=evidence["sourceParts"],
    chunks=len(cells),
    geometryBytes={
      f: sum(p["geometryBytes"] for k, p in receipts.items() if k.startswith(f + ":"))
      for f in details
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    extract()
  print(json.dumps(build()))
