"""Step 10: complete measured station blocks and five source-bound radome corrections."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
import trimesh
from build_airports_v194 import native_surfaces
from build_bebelplatz_building_source import extract_parent, part_profile, world_ring
from build_breitscheid_towers_v161 import triangles_for
from build_surrounding_outlines import source_identity, tags_for, world
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "teufelsberg-station-v195-source.json.gz"
PARENTS = ["DEBE04YY5000" + s for s in ["3LxK", "3R0E", "39hM", "3C8V", "3EXf", "3TaW"]]
OLD_WAYS = [
  76127530,
  119731062,
  132725795,
  132726415,
  132726416,
  132725799,
  132725804,
  165636821,
  132725788,
  135767667,
  132725808,
  92007059,
  132725787,
  132725793,
  132725792,
  132725791,
  132726413,
  76127891,
  165637940,
  165637941,
  269298187,
  269298197,
  1443745217,
]
RADOMES = {
  "DEBE3DmU6tU10EOy": ("central", 129.2),
  "DEBE3Do1612aobdn": ("southwest-roof", 101.763),
  "DEBE3DG1NfRpQ1id": ("northeast-roof", 101.763),
  "DEBE3Dzgko2S0Kvv": ("search", 97.7),
  "DEBE04YY50003LxK": ("jambalaya", 93.3),
}


def encode(value: object) -> bytes:
  return (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()


def extract() -> dict:
  """Keep complete licensed source geometry, including superseded coarse profiles."""
  archive = GEO / "raw/teufelsberg-v195/LoD2_380_5817.zip"
  records = []
  for owner in PARENTS:
    b = extract_parent(archive, owner)
    parts = []
    for element in leaf_building_parts(b) or [b]:
      part = part_profile(element)
      part["surfaces"] = [
        {
          "id": p.get(GML_ID),
          "kind": kind,
          "rings": [world_ring(r) for r in p.findall(".//gml:posList", NS)],
        }
        for kind in ["GroundSurface", "WallSurface", "RoofSurface", "ClosureSurface"]
        for p in element.findall(f".//bldg:{kind}//gml:Polygon", NS)
      ]
      parts.append(part)
    records.append({"id": owner, "parts": parts})
  old = gpd.read_file(
    GEO / "raw/outskirts-v187/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(-9050, 2070, -8850, 2300),
  )
  osm = gpd.read_file(
    GEO / "raw/outskirts-v187/candidate.gpkg",
    layer="multipolygons",
    where="osm_way_id IN (" + ",".join(f"'{v}'" for v in OLD_WAYS) + ")",
  ).to_crs(25833)
  selected = old[old.sourceId.isin(["OSM-way-" + str(v) for v in OLD_WAYS])]
  assert len(selected) == len(OLD_WAYS) == 23
  footprint = unary_union(
    [Polygon(p["ring"], p["holes"]) for b in records for p in b["parts"]]
  )
  return {
    "schemaVersion": 1,
    "datum": "EPSG:25833 x=easting-389500, z=5820000-northing, y=NHN-30; no additional terrain shift",
    "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + archive.name,
    "sourceSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
    "license": "dl-de/zero-2-0",
    "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmSha256": "9d193d9003e35f9a00c2a52553452946aab4d46467f1465364455e36e6a568a9",
    "parents": records,
    "osmFeatures": [
      {
        "id": source_identity(r),
        "tags": tags_for(r),
        "geometry": mapping(world(r.geometry)),
      }
      for _, r in osm.iterrows()
    ],
    "replacedOwners": [
      {
        "id": r.sourceId,
        "geometry": mapping(r.geometry),
        "height": r.height,
        "minHeight": r.minHeight,
        "heightSource": r.heightSource,
        "officialOverlapFraction": r.geometry.intersection(footprint).area
        / r.geometry.area,
      }
      for _, r in selected.iterrows()
    ],
    "retainedNearOwners": [
      "OSM-way-" + str(v) for v in [132729016, 269298201, 165781444, 837371912]
    ],
    "radomeCorrections": list(RADOMES),
    "conflict": "Five official cylindrical/sloping-cap envelopes lack the actual spherical radomes and open central frame. Original sheets remain complete here. Corrected forms keep each source part centre, footprint radius and exact maximum height. Other building sheets remain unchanged.",
    "facts": [
      "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/usa/charlottenburg-wilmersdorf/abhoerstation-teufelsberg-1415079.php",
      "https://www.teufelsberg-berlin.de/geschichte/geschichtlicher-ueberblick/",
    ],
  }


def clip_y(ring: list, minimum: float) -> list:
  """Clip a procedural face to its horizontal support ring."""
  result = []
  for a, b in zip(ring, ring[1:] + ring[:1]):
    ina, inb = a[1] >= minimum, b[1] >= minimum
    if ina:
      result.append(a)
    if ina != inb:
      t = (minimum - a[1]) / (b[1] - a[1])
      result.append([a[k] + (b[k] - a[k]) * t for k in range(3)])
  return result


def build() -> dict:
  src = json.loads(gzip.decompress(SOURCE.read_bytes()))
  surfaces = []
  lines = []
  boxes = []
  native_boxes = []
  navigation = []
  domes = []

  def emit(
    rings: list,
    color: int,
    role: str,
    owner: str = "",
    part: str = "",
    source_id: str = "",
  ) -> None:
    ts = triangles_for(rings)
    if ts:
      surfaces.append(
        {
          "triangles": ts,
          "color": color,
          "role": role,
          "owner": owner,
          "part": part,
          "sourcePolygon": source_id,
        }
      )

  def box3(
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    d: float,
    color: int,
    yaw: float = 0,
  ) -> None:
    boxes.append([x, y, z, w, h, d, yaw, color])
    # Independent native rectangular members; short axis-aligned steps follow yaw.
    n = max(1, math.ceil(w / 1.5))
    for i in range(n):
      u = (i + 0.5) * w / n - w / 2
      native_boxes.append(
        [
          x + math.cos(yaw) * u,
          y,
          z - math.sin(yaw) * u,
          abs(math.cos(yaw)) * w / n + abs(math.sin(yaw)) * d,
          h,
          abs(math.sin(yaw)) * w / n + abs(math.cos(yaw)) * d,
          color,
        ]
      )

  def circle(cx: float, cz: float, r: float, y: float, n: int = 48) -> list:
    return [
      [
        cx + r * math.cos(i * 2 * math.pi / n),
        y,
        cz + r * math.sin(i * 2 * math.pi / n),
      ]
      for i in range(n)
    ]

  def cylinder(
    cx: float,
    cz: float,
    r: float,
    low: float,
    high: float,
    color: int,
    role: str,
    owner: str,
  ) -> None:
    bottom = circle(cx, cz, r, low)
    top = circle(cx, cz, r, high)
    emit([top], color, role, owner)
    for i in range(len(top)):
      emit(
        [[bottom[i], bottom[(i + 1) % len(top)], top[(i + 1) % len(top)], top[i]]],
        color,
        role,
        owner,
      )
    navigation.append(
      {
        "id": owner + "/" + role,
        "rings": [[[p[0], p[2]] for p in bottom]],
        "minY": low,
        "maxY": high,
      }
    )

  def ring_frame(cx: float, cz: float, r: float, y: float, color: int) -> None:
    for a, b in zip(
      circle(cx, cz, r, y), circle(cx, cz, r, y)[1:] + circle(cx, cz, r, y)[:1]
    ):
      dx, dz = b[0] - a[0], b[2] - a[2]
      box3(
        (a[0] + b[0]) / 2,
        y,
        (a[2] + b[2]) / 2,
        math.hypot(dx, dz),
        0.22,
        0.28,
        color,
        -math.atan2(dz, dx),
      )

  for owner in src["parents"]:
    for part in owner["parts"]:
      if part["id"] in RADOMES:
        continue
      navigation.append(
        {
          "id": part["id"],
          "rings": [part["ring"], *part["holes"]],
          "minY": part["ground_y_m"],
          "maxY": part["top_y_m"],
        }
      )
      for s in part["surfaces"]:
        if s["kind"] == "GroundSurface":
          continue
        emit(
          s["rings"],
          0x999E98 if s["kind"] == "RoofSurface" else 0xA6ACA7,
          "measured-source",
          owner["id"],
          part["id"],
          s["id"],
        )

  for owner in src["parents"]:
    for part in owner["parts"]:
      if part["id"] not in RADOMES:
        continue
      key, base = RADOMES[part["id"]]
      polygon = Polygon(part["ring"], part["holes"])
      cx, cz = polygon.centroid.coords[0]
      # Circumscribed source cylinders are only a metric envelope. The bounded
      # cap is centred inside it; exact surveyed maxY remains the upper limit.
      r = (
        min(
          polygon.bounds[2] - polygon.bounds[0], polygon.bounds[3] - polygon.bounds[1]
        )
        / 2
      )
      top = part["top_y_m"]
      cy = top - r
      if key == "central":
        cylinder(
          cx,
          cz,
          r * 0.945,
          part["ground_y_m"],
          101.763,
          0x7E898A,
          "lower-tower",
          part["id"],
        )
        cylinder(cx, cz, 2.25, 101.763, base, 0x566365, "stair-core", part["id"])
        for y in np.linspace(101.763, base, 6):
          ring_frame(cx, cz, r * 0.945, float(y), 0xCCD0C6)
        for i in range(32):
          angle = i * 2 * math.pi / 32
          box3(
            cx + r * 0.945 * math.cos(angle),
            (101.763 + base) / 2,
            cz + r * 0.945 * math.sin(angle),
            0.15,
            base - 101.763,
            0.15,
            0xD3D5CB,
          )
        # Irregular remnant sheets below the dome are display weathering, not
        # traced street art or an assertion of individual current tears.
        for i in range(32):
          a, b = i * 2 * math.pi / 32, (i + 1) * 2 * math.pi / 32
          lo = base - (0.45 + (i * 7 % 9) * 0.20)
          emit(
            [
              [
                [cx + r * 0.944 * math.cos(a), base, cz + r * 0.944 * math.sin(a)],
                [cx + r * 0.944 * math.cos(b), base, cz + r * 0.944 * math.sin(b)],
                [cx + r * 0.944 * math.cos(b), lo, cz + r * 0.944 * math.sin(b)],
              ]
            ],
            0xCFD0C6,
            "remnant-sheet",
            part["id"],
          )
      else:
        cylinder(
          cx,
          cz,
          r * 0.93,
          part["ground_y_m"],
          base,
          0x99A4A2,
          "radome-support",
          part["id"],
        )
        ring_frame(cx, cz, r * 0.935, base, 0xCBCFC5)
        if key in ["search", "jambalaya"]:
          for y in np.arange(part["ground_y_m"] + 3.5, base - 1, 3.5):
            ring_frame(cx, cz, r * 0.936, float(y), 0xD1D4C9)
      domes.append(
        {
          "part": part["id"],
          "name": key,
          "centre": [cx, cy, cz],
          "radius": r,
          "baseY": base,
          "topY": top,
        }
      )
      sphere = trimesh.creation.icosphere(subdivisions=2, radius=1)
      verts = sphere.vertices
      faces = sphere.faces
      # The high central cap has hexagonal/pentagonal cells; the lower radomes
      # have the triangular panel rhythm shown by the inspected photographs.
      panels = []
      if key == "central":
        centres = np.asarray([np.mean(verts[f], axis=0) for f in faces])
        centres /= np.linalg.norm(centres, axis=1)[:, None]
        for i, v in enumerate(verts):
          q = centres[np.any(faces == i, axis=1)]
          axis = np.cross(v, [0, 1, 0] if abs(v[1]) < 0.9 else [1, 0, 0])
          axis /= np.linalg.norm(axis)
          other = np.cross(v, axis)
          q = q[np.argsort(np.arctan2(q @ other, q @ axis))]
          panels.append(q)
      else:
        panels = [verts[f] for f in faces]
      for i, panel in enumerate(panels):
        pts = clip_y(
          [[cx + r * p[0], cy + r * p[1], cz + r * p[2]] for p in panel], base
        )
        if len(pts) < 3:
          continue
        # An n-gon cell follows the sphere through a projected centre, giving a
        # curved cap without a cylindrical LoD2 double beneath the surface.
        mid = np.mean(pts, axis=0)
        v = mid - np.array([cx, cy, cz])
        v *= r / np.linalg.norm(v)
        mid = (v + np.array([cx, cy, cz])).tolist()
        color = [0xD8DAD0, 0xD4D7CE, 0xDCE0D5][i % 3]
        for a, b in zip(pts, pts[1:] + pts[:1]):
          surfaces.append(
            {
              "triangles": [[mid, a, b]],
              "color": color,
              "role": "radome-cap",
              "part": part["id"],
            }
          )
          lines.append([a, b, 0x6F7A78])
      # Tiny exact-apex vertex prevents tessellation orientation losing source height.
      surfaces.append(
        {
          "triangles": [
            [[cx, top, cz], [cx + 0.06, top - 0.01, cz], [cx, top - 0.01, cz + 0.06]]
          ],
          "color": 0xD8DAD0,
          "role": "radome-cap",
          "part": part["id"],
        }
      )

  # Native source bodies are an exterior 2 m lattice; radomes use independent
  # one-metre sphere shells, and skeletal members use final orthogonal boxes.
  native = (
    native_surfaces(
      [s for s in surfaces if s["role"] not in ["radome-cap", "remnant-sheet"]], []
    )
    + native_boxes
  )
  for dome in domes:
    cx, cy, cz = dome["centre"]
    r = dome["radius"]
    for iy in range(math.floor(dome["baseY"]), math.ceil(dome["topY"])):
      y = min(iy + 1, dome["topY"])
      bottom = max(iy, dome["baseY"])
      for iz in range(math.floor(cz - r), math.ceil(cz + r)):
        xs = []
        for ix in range(math.floor(cx - r), math.ceil(cx + r)):
          dist = math.sqrt(
            (ix + 0.5 - cx) ** 2 + ((bottom + y) / 2 - cy) ** 2 + (iz + 0.5 - cz) ** 2
          )
          if r - 0.9 <= dist <= r + 0.35:
            xs.append(ix)
        if not xs:
          continue
        start = end = xs[0]
        for x in xs[1:] + [None]:
          if x is not None and x == end + 1:
            end = x
            continue
          native.append(
            [
              (start + end + 1) / 2,
              (bottom + y) / 2,
              iz + 0.5,
              end - start + 1,
              y - bottom,
              1,
              0xD8DAD0,
            ]
          )
          start = end = x

  payload = {
    "surfaces": surfaces,
    "lines": lines,
    "boxes": boxes,
    "blocks": native,
    "navigation": navigation,
    "radomes": domes,
  }
  DATA.joinpath("teufelsbergStationV195.json").write_bytes(encode(payload))
  evidence = {
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "parents": PARENTS,
    "sourceParts": sum(len(p["parts"]) for p in src["parents"]),
    "sourcePolygons": sum(
      len(p["surfaces"]) for b in src["parents"] for p in b["parts"]
    ),
    "radomeCorrections": domes,
    "replacedOwners": [r["id"] for r in src["replacedOwners"]],
    "counts": {
      "triangles": sum(len(s["triangles"]) for s in surfaces),
      "lines": len(lines),
      "boxes": len(boxes),
      "nativeBlocks": len(native),
    },
    "displayEstimates": "Panel topology, spherical cap curvature, intermediate platform/cap base heights, core and member sections, material shades and remnant cladding are bounded display estimates. Source centres, maximum heights and all other measured sheets remain authoritative.",
  }
  GEO.joinpath("teufelsberg-station-v195-evidence.json").write_text(
    json.dumps(evidence, indent=2) + "\n"
  )
  return evidence


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract or not SOURCE.exists():
    SOURCE.write_bytes(gzip.compress(encode(extract()), mtime=0))
  print(json.dumps(build()["counts"]))
