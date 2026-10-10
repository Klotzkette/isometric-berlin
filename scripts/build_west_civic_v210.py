"""Step 10: bounded Westend / DRV recognition, preserving all source owners.

Only the exact obsolete v182 authored rbb wires and ten-cube artwork yield to
source-checked successors. No packet, source owner or earlier facade is deleted.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from statistics import median
from typing import Any

import numpy as np
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_steglitz_v182 import native_blocks
from build_west_civic_place_v210 import build_place
from pyproj import Transformer
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.geometry.polygon import orient
from shapely.ops import transform, unary_union

from isometric_berlin.data.fetch_lod2 import NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DEST = ROOT / "src/app/src/data"
SOURCE = GEO / "west-civic-v210-source.json"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
OWNERS = {
  "rbb": ("DEBE04YY500004sB", "382_5818", "rbb Fernsehzentrum"),
  "radio": ("DEBE04YY500004eY", "382_5818", "Haus des Rundfunks"),
  "drv": (
    "DEBE04YY500039oj",
    "385_5816",
    "Deutsche Rentenversicherung Bund, Ruhrstraße 2",
  ),
}


def write(path: Path, value: Any) -> None:
  """Compact, deterministic derived data only."""
  path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def digest(path: Path) -> str:
  """Immutable input identity."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def world(geometry: Any) -> Any:
  """CRS84 to viewer metres."""
  return transform(
    lambda x, y: (np.array(x) - 389500, 5820000 - np.array(y)),
    transform(PROJECT, geometry),
  )


def source() -> dict:
  """Read committed evidence; raw references are never required at runtime."""
  if SOURCE.exists():
    return json.loads(SOURCE.read_text())
  records = []
  for key, (pid, tile, name) in OWNERS.items():
    path = GEO / f"raw/lod2/LoD2_{tile}.zip"
    parent = extract_parent(path, pid)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    records.append(
      dict(
        key=key,
        name=name,
        parentId=pid,
        parts=parts,
        sourceUrl=f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        sourceSha256=digest(path),
        datumNhn=min(
          float(v)
          for p in parent.findall(".//gml:posList", NS)
          for v in (p.text or "").split()[2::3]
        ),
        displayGroundY=3,
      )
    )
  original_osm = json.loads((GEO / "city-recognition-v182-osm.json").read_text())
  drv = json.loads(Path("/tmp/v210-drv-source.json").read_text())["osm"]
  original = json.loads((DEST / "cityRecognitionV182.json").read_text())
  refs = []
  for name in ["obelisk", "rbb", "rbb2", "radio", "drv", "drv2"]:
    info = json.loads(Path(f"/tmp/v210-{name}-meta.json").read_text())
    md = info["extmetadata"]
    refs.append(
      dict(
        key=name,
        pageUrl=info["descriptionurl"],
        author=md["Artist"]["value"],
        license=md["LicenseShortName"]["value"],
        licenseUrl=md["LicenseUrl"]["value"],
        referenceUrl=info["url"],
        referenceThumbSha256=digest(Path(f"/tmp/v210-{name}.jpg")),
        use="External visual reference only; no pixels or textures bundled. Procedural interpretation of form, material and aperture rhythm.",
      )
    )
  result = dict(
    schemaVersion=1,
    sourceOwners=records,
    osm=dict(
      features=[
        f
        for f in original_osm["features"]
        if f["name"] in ["rbb Fernsehzentrum", "Haus des Rundfunks"]
      ],
      drv=drv,
      blueObelisk=dict(osmId="node/558903414", lon=13.2721555, lat=52.5093574),
      source="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      license="ODbL-1.0",
    ),
    bdom=dict(
      source="https://gdi.berlin.de/services/wms/bdom",
      layer="b_bdom",
      license="dl-de/zero-2-0",
      retrieved="2026-10-10",
      method="One-pixel 1m EPSG:25833 GetFeatureInfo; elevation NHN metres; bounded inspection samples, not a complete roof survey.",
      samples=json.loads(Path("/tmp/v210-rbb-bdom.json").read_text()),
    ),
    dop=dict(
      source="https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
      layer="dop_2025",
      bbox=[382760, 5818910, 383120, 5819160],
      crs="EPSG:25833",
      sha256=digest(Path("/tmp/v210-rbb-dop.jpg")),
      role="Plan divisions interpreted from official spring2025 orthophoto; no pixels bundled.",
    ),
    visualReferences=refs,
    factualReferences=[
      "https://www.deutsche-rentenversicherung.de/Bund/DE/Service/Footer/Impressum?__site=bund",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011534",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/gebaeude-und-anlagen/verwaltungs-und-gerichtsgebaeude/artikel.158749.php",
      "https://www.rbb-online.de/unternehmen/der_rbb/struktur/standorte/berlin.html",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/brunnen/artikel.118254.php",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/plaetze/artikel.157064.php",
    ],
    priorV182Sha256=digest(DEST / "cityRecognitionV182.json"),
    priorArtwork=original["blueObelisk"],
    policy="Keep every prior source owner, roof, street, courtyard and facade. Only listed authored v182 estimate rows yield to corrected successors. No generic owner replacement, no broad runtime location filter, no new resident budget.",
  )
  write(SOURCE, result)
  return result


def box(
  group: dict,
  x: float,
  y: float,
  z: float,
  w: float,
  h: float,
  d: float,
  yaw: float,
  color: int,
  role: str,
) -> None:
  """Shallow repeated recognition details, final instance count offline."""
  group["boxes"].append([round(v, 3) for v in [x, y, z, w, h, d, yaw]] + [color])
  group["roles"].append(role)


def plate(
  group: dict,
  a: list,
  b: list,
  y: float,
  h: float,
  depth: float,
  offset: float,
  color: int,
  role: str,
) -> None:
  """One facade element aligned with an explicitly selected source edge."""
  dx, dz = b[0] - a[0], b[1] - a[1]
  length = math.hypot(dx, dz)
  box(
    group,
    (a[0] + b[0]) / 2 + dz / length * offset,
    y,
    (a[1] + b[1]) / 2 - dx / length * offset,
    length,
    h,
    depth,
    -math.atan2(dz, dx),
    color,
    role,
  )


def surface(group: dict, rings: list, color: int) -> None:
  """Triangulate exact polygon rings, retaining holes."""
  group["surfaces"].append(dict(color=color, triangles=triangles_for(rings)))


def volume(
  group: dict,
  polygon: Polygon,
  low: float,
  high: float,
  color: int,
  role: str,
  nav: list,
) -> None:
  """Only independently evidenced upper additions become new solid navigation."""
  for ring in [polygon.exterior, *polygon.interiors]:
    for a, b in zip(ring.coords, list(ring.coords)[1:]):
      surface(
        group,
        [
          [[a[0], low, a[1]], [b[0], low, b[1]], [b[0], high, b[1]], [a[0], high, a[1]]]
        ],
        color,
      )
  surface(
    group,
    [
      [[x, high, z] for x, z in ring.coords]
      for ring in [polygon.exterior, *polygon.interiors]
    ],
    0x949C9F,
  )
  nav.append(
    dict(
      id=role,
      ring=list(polygon.exterior.coords),
      holes=[list(r.coords) for r in polygon.interiors],
      lowY=low,
      highY=high,
    )
  )


def group(name: str) -> dict:
  return dict(name=name, boxes=[], roles=[], surfaces=[], rods=[])


def box_navigation(nav: list, row: list, identifier: str) -> None:
  """Exact displayed rotated solid, never a compound-building envelope."""
  x, y, z, w, h, d, yaw, _ = row
  c, s = math.cos(yaw), math.sin(yaw)
  ring = [
    [x + xx * c + zz * s, z - xx * s + zz * c]
    for xx, zz in [
      (-w / 2, -d / 2),
      (w / 2, -d / 2),
      (w / 2, d / 2),
      (-w / 2, d / 2),
      (-w / 2, -d / 2),
    ]
  ]
  nav.append(dict(id=identifier, ring=ring, holes=[], lowY=y - h / 2, highY=y + h / 2))


def rbb(source: dict, nav: list) -> tuple[dict, list]:
  """Raised volumes missing from generalized official owner, bDOM height evidence."""
  g = group("rbb television centre: silver horizontal slabs and broadcast crown")
  record = next(b for b in source["sourceOwners"] if b["key"] == "rbb")
  parent = unary_union([Polygon(p["ring"], p["holes"]) for p in record["parts"]])
  samples = {(x, y): h for x, y, h in source["bdom"]["samples"]}
  # Continue the tall source-bound footprint down to its own retained ground;
  # using the highest unrelated low roof as a blanket floor left floating gaps.
  low = round(
    min(p["ground_y_m"] for p in record["parts"]) + 33 - record["datumNhn"], 3
  )
  definitions = [
    (
      "seven-storey north bar",
      [(382897.8, 5819089), (382911.8, 5819090), (382915, 5819049), (382901, 5819048)],
      [(382906, 5819048), (382906, 5819068), (382912, 5819048)],
      7,
    ),
    (
      "north high slab",
      [
        (382909, 5819049),
        (382922.5, 5819050),
        (382926.2, 5819015.5),
        (382912.6, 5819014.5),
      ],
      [(382912, 5819038), (382918, 5819038), (382918, 5819028)],
      13,
    ),
    (
      "south high slab",
      [
        (382895.5, 5818990),
        (382907.8, 5818981.5),
        (382924, 5819005.5),
        (382911.8, 5819014),
      ],
      [(382900, 5818990), (382908, 5818990), (382908, 5818998), (382916, 5818998)],
      14,
    ),
    (
      "pentagonal circulation tower",
      [
        (382911.8, 5819014),
        (382919, 5819021),
        (382930, 5819015),
        (382931, 5819005),
        (382920, 5818999),
      ],
      [(382918, 5819018)],
      0,
    ),
  ]
  evidence = []
  for role, coords, probes, floors in definitions:
    polygon = orient(
      Polygon([(x - 389500, 5820000 - y) for x, y in coords]).intersection(parent),
      sign=1,
    )
    assert polygon.geom_type == "Polygon" and polygon.area > 80, role
    nhn = median(samples[p] for p in probes)
    high = round(nhn - record["datumNhn"] + 3, 3)
    volume(g, polygon, low, high, 0xC1C7C9, role, nav)
    pts = list(polygon.exterior.coords)
    # Shallow silver spandrels, dark glazing strips, and vertical joint marks.
    # Operator identifies 7/13/14 storeys; small divisions remain estimates.
    for a, b in zip(pts, pts[1:]):
      length = math.dist(a, b)
      if length < 4:
        continue
      if floors:
        floor_height = (high - 3.5) / floors
        for k in range(floors):
          y = 4.3 + (k + 0.45) * floor_height
          if y < low + 0.7:
            continue
          plate(g, a, b, y, 1.30, 0.12, 0.12, 0x56646C, "horizontal glazing")
          plate(g, a, b, y - 0.82, 0.22, 0.18, 0.16, 0xE0E2DF, "silver floor rail")
          for j in range(1, max(2, round(length / 3.7))):
            t = j / max(2, round(length / 3.7))
            x = a[0] + (b[0] - a[0]) * t
            z = a[1] + (b[1] - a[1]) * t
            box(
              g,
              x,
              y,
              z,
              0.09,
              1.26,
              0.12,
              -math.atan2(b[1] - a[1], b[0] - a[0]),
              0xB2B8B6,
              "glazing mullion",
            )
      else:
        # Small vertically aligned core apertures, not a curtain wall.
        for y in np.arange(low + 2, high - 2, 4.0):
          aa = np.array(a) * 0.55 + np.array(b) * 0.45
          bb = np.array(a) * 0.45 + np.array(b) * 0.55
          plate(
            g,
            list(aa),
            list(bb),
            float(y),
            1.1,
            0.14,
            0.15,
            0x53616C,
            "circulation slit",
          )
      plate(g, a, b, high + 0.12, 0.26, 0.25, 0.05, 0xE0E2DF, "roof rim")
    evidence.append(
      dict(
        name=role,
        footprint=mapping(polygon),
        lowY=low,
        topY=high,
        roofNhn=nhn,
        samples=[[*p, samples[p]] for p in probes],
        heightMethod="Median retained official bDOM roof samples; source datum "
        + str(record["datumNhn"])
        + "mNHN.",
        planStatus="DOP-interpreted roof partition clipped to complete retained source footprint; not surveyed edges.",
      )
    )
  # The photograph shows the raised transmitter lounge, paired silver rims and
  # dark set-back neck. 2025 bDOM samples delimit this high crown independently.
  cx, cz = 382923 - 389500, 5820000 - 5819009
  high = next(
    v["topY"] for v in evidence if v["name"] == "pentagonal circulation tower"
  )
  neck_top = 128.16 - record["datumNhn"] + 3
  crown_top = 134.81 - record["datumNhn"] + 3
  yaw = 0.47
  for y, w, h, d, col, role in [
    ((high + neck_top) / 2, 5.4, neck_top - high, 5.4, 0x6C777D, "broadcast neck"),
    (neck_top + 0.2, 12.5, 0.8, 10.6, 0xD9DCDA, "lower transmitter rim"),
    (
      (neck_top + crown_top) / 2,
      11.0,
      crown_top - neck_top - 1,
      9.6,
      0x597482,
      "transmitter lounge glazing",
    ),
    (crown_top - 0.2, 12.5, 0.8, 10.6, 0xE0E3DF, "upper transmitter rim"),
    (crown_top + 4.1, 0.32, 8.1, 0.32, 0x929B9E, "antenna mast"),
  ]:
    box(g, cx, y, cz, w, h, d, yaw, col, role)
    box_navigation(nav, g["boxes"][-1], role)
  for dx, dz, h in [(-4, 2, 2.3), (4, -2, 3.6), (-3, -3, 4.5)]:
    box(
      g, cx + dx, crown_top + h / 2, cz + dz, 0.15, h, 0.15, 0, 0xA5AFB2, "antenna rod"
    )
    box_navigation(nav, g["boxes"][-1], f"antenna rod {dx},{dz}")
  return g, evidence


def facade(source: dict, key: str) -> tuple[dict, list]:
  """Finer measured street planes; source shells/courts/roof shapes stay untouched."""
  record = next(b for b in source["sourceOwners"] if b["key"] == key)
  g = group(record["name"] + ": street facade refinement")
  parent = unary_union([Polygon(p["ring"], p["holes"]) for p in record["parts"]])
  scope = world(shape(source["osm"]["drv"]["geometry"])) if key == "drv" else parent
  faces = []
  for part in record["parts"]:
    for sheet in part["surfaces"]:
      if sheet["kind"] != "WallSurface":
        continue
      raw = sheet["rings"][0]
      a, b = max(
        ((a, b) for a in raw for b in raw),
        key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
      )
      aa = np.array([a[0], a[2]])
      bb = np.array([b[0], b[2]])
      delta = bb - aa
      length = np.linalg.norm(delta)
      if length < (1.2 if key == "radio" else 11):
        continue
      axis = delta / length
      n = np.array([axis[1], -axis[0]])
      mid = (aa + bb) / 2
      if parent.contains(Point(mid + n * 0.4)):
        aa, bb = bb, aa
        axis = -axis
        n = -n
      # Only source walls immediately bounding the requested street-front body.
      if key == "drv":
        if scope.buffer(0.75).intersection(LineString([aa, bb])).length / length < 0.8:
          continue
        if not (n[1] > 0.55 or n[0] > 0.65):
          continue
        # The headquarters relation includes inner court wings: only its outer
        # street-facing hull gets this photo-based facade and entrance pass.
        if scope.convex_hull.boundary.distance(Point(mid)) > 2.0:
          continue
      else:
        if not (n[0] < 0.1 and n[1] < -0.1):
          continue
        if parent.convex_hull.boundary.distance(Point(mid)) > 2.0:
          continue
      low = min(p[1] for p in raw) - record["datumNhn"] + 33
      high = max(p[1] for p in raw) - record["datumNhn"] + 33
      if high - low < 8:
        continue
      low = max(3.5, low)
      color = 0xB9B99E if key == "drv" else 0x61564C
      plate(
        g,
        aa.tolist(),
        bb.tolist(),
        (low + high) / 2,
        high - low,
        0.09,
        0.09,
        color,
        "retained source wall colour skin",
      )
      floors = 5 if key == "drv" else 4
      # Front facades in free photos: tall pale multi-pane apertures vs Poelzig's
      # narrow brick piers. Counts below are explicitly estimated, wall-clipped.
      spacing = 3.65 if key == "drv" else 3.2
      columns = max(1, round(length / spacing))
      pitch = length / columns
      for k in range(floors):
        y = low + (k + 0.5) * (high - low) / floors
        height = min(2.30, (high - low) / floors * 0.61)
        for j in range(columns):
          u = (j + 0.5) * pitch
          center = aa + axis * u + n * 0.22
          width = min(1.8, pitch * 0.6)
          yaw = -math.atan2(axis[1], axis[0])
          box(
            g,
            *[center[0], y, center[1]],
            width + 0.20,
            height + 0.20,
            0.12,
            yaw,
            0xC9CFC5 if key == "radio" else 0xE4E2CE,
            "window surround",
          )
          center += n * 0.085
          box(
            g,
            center[0],
            y,
            center[1],
            width,
            height,
            0.14,
            yaw,
            0x53636A,
            "window glazing",
          )
          box(
            g,
            center[0],
            y,
            center[1],
            0.08,
            height,
            0.18,
            yaw,
            0xD9DDD3,
            "window mullion",
          )
          box(
            g,
            center[0],
            y - 0.16,
            center[1],
            width,
            0.075,
            0.18,
            yaw,
            0xD9DDD3,
            "window transom",
          )
      for y in [low + 3.6, low + 7.2, high - 0.35] if key == "drv" else [high - 0.25]:
        plate(
          g,
          aa.tolist(),
          bb.tolist(),
          y,
          0.22,
          0.34,
          0.28,
          0xC6C4AA if key == "drv" else 0x857261,
          "source-aligned cornice",
        )
      if key == "radio":
        for j in range(1, columns):
          c = aa + axis * (j * pitch) + n * 0.24
          box(
            g,
            c[0],
            (low + high) / 2,
            c[1],
            0.22,
            high - low,
            0.30,
            -math.atan2(axis[1], axis[0]),
            0x4D443E,
            "Poelzig brick pier",
          )
      faces.append(
        dict(
          a=aa.tolist(),
          b=bb.tolist(),
          normal=n.tolist(),
          lowY=low,
          highY=high,
          columns=columns,
          floors=floors,
          partId=part["id"],
        )
      )
  # The large Ruhrstraße portico is centred on the exact southern source edge,
  # verified by the 2018/2023 free street photographs, not applied to all walls.
  if key == "drv" and faces:
    southern = [f for f in faces if f["normal"][1] > 0.55]
    street_mid = np.mean([p for f in southern for p in [f["a"], f["b"]]], axis=0)
    f = min(
      southern,
      key=lambda f: np.linalg.norm((np.array(f["a"]) + f["b"]) / 2 - street_mid),
    )
    a, b = np.array(f["a"]), np.array(f["b"])
    axis = (b - a) / np.linalg.norm(b - a)
    n = np.array(f["normal"])
    centre = (a + b) / 2
    for u in [-6.5, -3.3, 3.3, 6.5]:
      c = centre + axis * u + n * 0.75
      box(
        g,
        c[0],
        7.2,
        c[1],
        0.8,
        7.8,
        1.1,
        -math.atan2(axis[1], axis[0]),
        0xC3BEA3,
        "Ruhrstraße portal pier",
      )
      for y in [3.45, 10.8]:
        box(
          g,
          c[0],
          y,
          c[1],
          1.02,
          0.40,
          1.32,
          -math.atan2(axis[1], axis[0]),
          0xD8D3B7,
          "portal capital base",
        )
    plate(
      g,
      list(centre - axis * 7.4),
      list(centre + axis * 7.4),
      11.45,
      0.6,
      1.65,
      0.9,
      0xCFCAB0,
      "entrance entablature",
    )
    for u in [-4.9, 0, 4.9]:
      c = centre + axis * u + n * 0.3
      box(
        g,
        c[0],
        5.1,
        c[1],
        2.1,
        3.9,
        0.18,
        -math.atan2(axis[1], axis[0]),
        0x45514E,
        "portal glazed door",
      )
  return g, faces


def obelisk(source: dict, nav: list) -> dict:
  """Published seven glass cuboids / 15m silhouette, stainless base and basin."""
  g = group("Blauer Obelisk / Glasnost — Hella Santarossa, seven glass cuboids")
  a = source["osm"]["blueObelisk"]
  east, north = PROJECT(a["lon"], a["lat"])
  x, z = east - 389500, 5820000 - north
  base = 3.18
  box(g, x, base + 0.14, z, 8.1, 0.28, 8.1, 0, 0xAFA99A, "basin stone platform")
  box(g, x, base + 0.32, z, 7.6, 0.08, 7.6, 0, 0x567D91, "shallow basin water")
  for sign in [-1, 1]:
    box(g, x + sign * 3.95, base + 0.47, z, 0.24, 0.55, 8.1, 0, 0xBFC0B0, "basin rim")
    box(g, x, base + 0.47, z + sign * 3.95, 8.1, 0.55, 0.24, 0, 0xBFC0B0, "basin rim")
  box(g, x, base + 1.05, z, 3.8, 1.6, 3.8, 0, 0xBFC7C4, "stainless-steel plinth")
  height_sum = 13.15
  widths = [3.25, 2.70, 2.22, 1.82, 1.46, 1.10, 0.72]
  weights = [2.75, 2.42, 2.15, 1.90, 1.65, 1.42, 1.12]
  heights = [w / sum(weights) * height_sum for w in weights]
  y = base + 1.85
  for i, (w, h) in enumerate(zip(widths, heights)):
    center = y + h / 2
    # Opaque colour facets read as blue antique glass without transparency
    # sorting/fill-rate or a duplicate water-pass cost on mobile.
    box(
      g,
      x,
      center,
      z,
      w,
      h - 0.04,
      w,
      0,
      [0x1F43A2, 0x244FB6, 0x283998][i % 3],
      "blue glass cuboid",
    )
    for sign in [-1, 1]:
      box(
        g,
        x + sign * w / 2,
        center,
        z,
        0.045,
        h - 0.05,
        w,
        0,
        0x3C69B1,
        "glass edge reflection",
      )
      box(
        g,
        x,
        center,
        z + sign * w / 2,
        w,
        h - 0.05,
        0.025,
        0,
        0x3459A8 if sign == 1 else 0x203B8A,
        "blue face reflection",
      )
    box(g, x, y + h, z, w + 0.12, 0.07, w + 0.12, 0, 0xB3C0C2, "stainless tier cap")
    y += h
  for j, (row, role) in enumerate(zip(g["boxes"], g["roles"])):
    if role in [
      "stainless-steel plinth",
      "blue glass cuboid",
      "stainless tier cap",
      "basin rim",
    ]:
      box_navigation(nav, row, f"blue-obelisk {role} {j}")
  return g


def receipt(source: dict) -> dict:
  """Exact authored-row equality, never a scene radius or source-owner deletion."""
  old = json.loads((DEST / "cityRecognitionV182.json").read_text())
  assert digest(DEST / "cityRecognitionV182.json") == source["priorV182Sha256"]
  a = source["osm"]["blueObelisk"]
  e, n = PROJECT(a["lon"], a["lat"])
  x, z = round(e - 389500, 3), round(5820000 - n, 3)
  boxes = []
  for i in range(10):
    row = [
      x,
      3.15 + (i + 0.5) * 1.5,
      z,
      2.75 - i * 0.22,
      1.48,
      2.75 - i * 0.22,
      0,
      [0x226BBE, 0x3187D0, 0x2864A5][i % 3],
    ]
    indexes = [j for j, r in enumerate(old["boxes"]) if r == row]
    assert len(indexes) == 1
    boxes.append(
      dict(
        index=indexes[0],
        row=row,
        reason="Ten-cube display estimate corrected to officially documented seven glass cuboids.",
      )
    )
  target = []
  for cx, cz, w, d, height in [
    (-6594.8, 956.0, 14.0, 61.0, 55.5),
    (-6580.5, 1006.3, 14.5, 30.5, 58.8),
  ]:
    for y in [23, *np.arange(26.5, height, 3.3), height]:
      pts = [
        (cx - w / 2, 3 + y, cz - d / 2),
        (cx + w / 2, 3 + y, cz - d / 2),
        (cx + w / 2, 3 + y, cz + d / 2),
        (cx - w / 2, 3 + y, cz + d / 2),
      ]
      target.extend([[*aa, *bb, 0x819099] for aa, bb in zip(pts, [*pts[1:], pts[0]])])
    for dx in [-w / 2, w / 2]:
      for dz in [-d / 2, d / 2]:
        target.append([cx + dx, 26, cz + dz, cx + dx, 3 + height, cz + dz, 0xA3A8A3])
  segments = []
  for r in target:
    row = [round(float(v), 3) for v in r[:6]] + [r[6]]
    indexes = [j for j, v in enumerate(old["segments"]) if v == row]
    assert len(indexes) == 1
    segments.append(
      dict(
        index=indexes[0],
        row=row,
        reason="Old unmeasured rectangular tower wires replaced by DOP/bDOM-bound masses and floor detail.",
      )
    )
  # Four old basin-outline lines are retained: their little frame is legitimate
  # earlier detail, now inside the more legible stone/water basin.
  return dict(
    source="cityRecognitionV182.json",
    sourceSha256=source["priorV182Sha256"],
    sourceRows=dict(boxes=len(old["boxes"]), segments=len(old["segments"])),
    boxes=boxes,
    segments=segments,
    ownerTransfers=[],
    policy="Only exact equal authored estimate rows may yield after successor is attached. All other entries and complete packet/source owners retained.",
  )


def main() -> None:
  """Build the small scene supplement and evidence; never rewrite shared files."""
  s = source()
  nav = []
  rg, volumes = rbb(s, nav)
  radio, radiofaces = facade(s, "radio")
  drv, drvfaces = facade(s, "drv")
  place, place_evidence = build_place()
  groups = [obelisk(s, nav), rg, radio, drv, place]
  for i, g in enumerate(groups):
    g["required"] = i < 2
    g.setdefault("nativeSurfaceQuads", [])
    g["native"] = native_blocks(
      dict(surfaces=[] if g["nativeSurfaceQuads"] else g["surfaces"], boxes=[], rods=[])
    )
    # Box sources are genuine volumes: sampling only their central plane loses
    # the basin and broadcast crown. Short axis-aligned steps retain thickness
    # and glass/frame detail without broad rotated bounding-box artifacts.
    for row, role in zip(g["boxes"], g["roles"]):
      x, y, z, w, h, d, yaw, col = row
      c, ss = math.cos(yaw), math.sin(yaw)
      if i == 1 and role in [
        "horizontal glazing",
        "silver floor rail",
        "glazing mullion",
        "circulation slit",
      ]:
        # The independently voxelized wall occupies its full boundary cell;
        # native window strips must sit on that cell's exterior, not inside it.
        x -= ss * 0.88
        z -= c * 0.88
      if abs(ss) < 1e-8:
        g["native"].append([x, y, z, w, h, d, col])
        continue
      nx, nz = max(1, math.ceil(w / 0.85)), max(1, math.ceil(d / 0.85))
      dx, dz = w / nx, d / nz
      for ix in range(nx):
        for iz in range(nz):
          xx, zz = -w / 2 + (ix + 0.5) * dx, -d / 2 + (iz + 0.5) * dz
          g["native"].append(
            [
              round(x + c * xx + ss * zz, 3),
              y,
              round(z - ss * xx + c * zz, 3),
              round(abs(c) * dx + abs(ss) * dz, 3),
              h,
              round(abs(ss) * dx + abs(c) * dz, 3),
              col,
            ]
          )
    g["triangleCount"] = sum(len(p["triangles"]) for p in g["surfaces"])
  write(
    DEST / "westCivicV210.json",
    dict(
      schemaVersion=1,
      groups=groups,
      sourceOwnerIds=[p[0] for p in OWNERS.values()],
      estimateStatus="Only LoD2 planes/positions and bDOM sample heights are measured. Aperture rhythm, material colours, roof subdivisions, antenna and artwork section widths are procedural visual-reference estimates.",
    ),
  )
  write(DEST / "westCivicV210Navigation.json", dict(volumes=nav))
  write(GEO / "west-civic-place-v210-evidence.json", place_evidence)
  rec = receipt(s)
  write(DEST / "westCivicV210Previous.json", rec)
  write(
    GEO / "west-civic-v210-evidence.json",
    dict(
      volumes=volumes,
      radioFaces=radiofaces,
      drvFaces=drvfaces,
      sourceSha256=digest(SOURCE),
      priorReceipt=rec,
      identity="DRV Bund official address Ruhrstraße2; not the separate Hohenzollerndamm tower, nor DRV Berlin-Brandenburg on Spandauer Damm. Blauer Obelisk is the blue glass fountain, not the separate eternal-flame memorial.",
      budgets=[
        dict(
          name=g["name"],
          triangles=g["triangleCount"],
          boxes=len(g["boxes"]),
          native=len(g["native"]),
        )
        for g in groups
      ],
      preserved="All source owners, roofs, city packets, prior civic facades, Funkturm and unrelated details remain unchanged. No downloaded photo is bundled.",
    ),
  )
  write(
    GEO / "west-civic-v210-credits.json",
    dict(
      visualReferences=s["visualReferences"],
      sourceNotice="OpenStreetMap contributors (ODbL-1.0); Berlin LoD2 and DOP/bDOM 2025 (Geoportal Berlin, dl-de/zero-2-0).",
      artworkCredit="Hella Santarossa, Blauer Obelisk / Glasnost,1995. Procedural seven-tier interpretation; no text/photographic pixels copied.",
    ),
  )
  print(
    json.dumps(
      dict(
        groups=len(groups),
        boxes=sum(len(g["boxes"]) for g in groups),
        native=sum(len(g["native"]) for g in groups),
        triangles=sum(g["triangleCount"] for g in groups),
        bytes=(DEST / "westCivicV210.json").stat().st_size,
        correctedBoxes=len(rec["boxes"]),
        correctedSegments=len(rec["segments"]),
      )
    )
  )


if __name__ == "__main__":
  main()
