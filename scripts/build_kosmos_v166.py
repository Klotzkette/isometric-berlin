"""Complete surveyed KOSMOS event venue; estimated image-free facade cues.

The uncertain user phrase 'Kino der Kosmonauten' is not asserted as a name.
Only separate packet candidates are written; shared packets stay untouched.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
from build_breitscheid_towers_v161 import triangles_for
from build_citywest_cinemas_v166 import NS, RAW, ROOT, footprints, polygons_of
from build_surrounding_outlines import tags_for, world
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union

DEST = ROOT / "src/app/src/data/kosmosV166Source.json"
PARENTS = {
  "DEBE02YY200002kP": "KOSMOS rear cinema extensions",
  "DEBE02YY200004oA": "KOSMOS historic foyer and egg-shaped auditorium",
  "DEBE02YY20001he2": "KOSMOS inner connector",
}
TILE = "394_5819"
DATUM = 37.785
FRONT_A = np.array([5296.569, 341.813])
FRONT_B = np.array([5339.595, 349.864])
D = (FRONT_B - FRONT_A) / np.linalg.norm(FRONT_B - FRONT_A)
N = np.array([-D[1], D[0]])


def make_payload() -> dict:
  archive = ROOT / f"geo_data/regierungsviertel/raw/lod2/LoD2_{TILE}.zip"
  with zipfile.ZipFile(archive) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  parents, parts, surfaces, details = [], [], [], []
  for parent in tree.findall(".//b:Building", NS):
    pid = parent.get("{" + NS["g"] + "}id")
    if pid not in PARENTS:
      continue
    parents.append(
      {
        "id": pid,
        "name": PARENTS[pid],
        "tile": TILE,
        "groundNHN": DATUM,
        "groundY": 3,
        "outer": True,
      }
    )
    for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
      sid = part.get("{" + NS["g"] + "}id")
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
                  round(a[i + 2] - DATUM + 3, 3),
                  round(5820000 - a[i + 1], 3),
                ]
                for i in range(0, len(a), 3)
              ]
              if ring[0] == ring[-1]:
                ring.pop()
              rings.append(ring)
            kind = surface.tag.split("}")[-1]
            ss.append(
              {
                "partId": sid,
                "kind": kind,
                "sourcePolygonId": polygon.get("{" + NS["g"] + "}id"),
                "rings": rings,
                "triangles": triangles_for(rings)
                if kind in ["RoofSurface", "WallSurface"]
                else [],
                "color": 0x8A887C
                if kind == "RoofSurface"
                else 0xABA895
                if sid == "DEBE3DQ3Gs77JAGM"
                else 0xD6D3C3,
              }
            )
      surfaces.extend(ss)
      foot = footprints(ss)
      points = [p for s in ss for r in s["rings"] for p in r]
      parts.append(
        {
          "id": sid,
          "parentId": pid,
          "building": PARENTS[pid],
          "groundY": min(p[1] for p in points),
          "topY": max(p[1] for p in points),
          "heightM": float(part.findtext("b:measuredHeight", "0", NS)),
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
          "footprintAreaM2": round(foot.area, 6),
        }
      )
  assert len(parents) == 3 and len(parts) == 8 and len(surfaces) == 265

  def front(
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    role: int,
    depth: float = 0.12,
    out: float = 0.11,
  ) -> None:
    p = FRONT_A + D * u + N * out
    details.append(
      [
        round(p[0], 3),
        y,
        round(p[1], 3),
        w,
        h,
        depth,
        round(math.atan2(-D[1], D[0]), 6),
        color,
        role,
      ]
    )

  # Source plane joints also bound the three observed facade fields exactly.
  low = 3.107
  glass_start, glass_end = 8.951, 34.905
  pitch = (glass_end - glass_start) / 10
  for i in range(10):
    u = glass_start + (i + 0.5) * pitch
    front(u, 6.37, pitch - 0.11, 6.10, 0x344844, 1)
    front(glass_start + i * pitch, 6.4, 0.10, 6.3, 0xADB5AC, 2, 0.18, 0.21)
    front(u, 6.4, 0.045, 6.3, 0x959F98, 2, 0.16, 0.22)
    front(u, 6.0, pitch, 0.085, 0xB5BEB4, 2, 0.18, 0.22)
  front(glass_end, 6.4, 0.1, 6.3, 0xADB5AC, 2, 0.18, 0.21)
  front(
    (glass_start + glass_end) / 2,
    9.73,
    glass_end - glass_start + 0.2,
    0.33,
    0x333B37,
    2,
    0.34,
    0.25,
  )
  # Central entrance doors and small vertical pull handles.
  for i in range(6):
    u = 18.85 + i * 1.05
    front(u, 4.48, 0.96, 2.65, 0x7B8A80, 3, 0.12, 0.27)
    front(u + 0.33, 4.40, 0.045, 0.66, 0xD1D0BB, 3, 0.18, 0.37)
  # Pale ceramic/silicate glaze: procedural distribution, never photo sampling.
  palette = [0xE1DECB, 0xCDBF9B, 0xA39B7F, 0xD4D6C8, 0x8B948B]
  for left, right in [
    (0.15, glass_start - 0.1),
    (glass_end + 0.1, float(np.linalg.norm(FRONT_B - FRONT_A)) - 0.15),
  ]:
    for row in range(29):
      for col in range(11):
        u = left + 0.36 + col * 0.77 + (row % 2) * 0.32
        if u + 0.31 > right:
          continue
        color = palette[(row * 31 + col * 17) % len(palette)]
        front(u, low + 0.17 + row * 0.224, 0.64, 0.105, color, 4, 0.055, 0.10)
  # Every source auditorium facet receives restrained horizontal masonry joints.
  for s in surfaces:
    if s["partId"] != "DEBE3DQ3Gs77JAGM" or s["kind"] != "WallSurface":
      continue
    ring = s["rings"][0]
    a, b = max(
      ((a, b) for a in ring for b in ring),
      key=lambda ab: math.hypot(ab[0][0] - ab[1][0], ab[0][2] - ab[1][2]),
    )
    dx, dz = b[0] - a[0], b[2] - a[2]
    length = math.hypot(dx, dz)
    if length < 0.1:
      continue
    # The source walls are vertical quadrilaterals; only the visible upper drum.
    ymax = min(max(v[1] for v in ring), 15.545)
    for y in np.arange(max(10.08, min(v[1] for v in ring) + 0.1), ymax - 0.15, 0.54):
      details.append(
        [
          round((a[0] + b[0]) / 2, 3),
          round(float(y), 3),
          round((a[2] + b[2]) / 2, 3),
          round(length, 3),
          0.035,
          0.035,
          round(math.atan2(-dz, dx), 6),
          0x8F8C7A,
          5,
        ]
      )
  blocks = {}
  for s in surfaces:
    for tri in s["triangles"]:
      a, b, c = map(np.array, tri)
      steps = max(
        1,
        math.ceil(
          max(np.linalg.norm(b - a), np.linalg.norm(c - a), np.linalg.norm(c - b))
          / 1.15
        ),
      )
      for i in range(steps + 1):
        for j in range(steps + 1 - i):
          p = a + (b - a) * i / steps + (c - a) * j / steps
          cell = tuple(math.floor(float(v) / 2) for v in p)
          blocks[cell] = [cell[0] * 2 + 1, cell[1] * 2 + 1, cell[2] * 2 + 1, s["color"]]
  # Colour source-native front cells by their actual center inside the window.
  for x, y, z, w, h, depth, yaw, color, role in details:
    if role != 1:
      continue
    for r in blocks.values():
      u = (r[0] - x) * math.cos(yaw) - (r[2] - z) * math.sin(yaw)
      distance = (r[0] - x) * math.sin(yaw) + (r[2] - z) * math.cos(yaw)
      if abs(u) < w / 2 and abs(r[1] - y) < h / 2 and abs(distance) < 1.5:
        r[3] = color
  osm = gpd.read_file(
    RAW / "candidate.gpkg", layer="multipolygons", where="osm_way_id = '606479961'"
  ).to_crs(25833)
  feet = unary_union(
    [Polygon(p["ring"], p["holes"]) for part in parts for p in part["polygons"]]
  )
  osm_foot = world(osm.iloc[0].geometry)
  with (RAW / "berlin-260929.osm.pbf").open("rb") as stream:
    osm_hash = hashlib.file_digest(stream, "sha256").hexdigest()
  return {
    "schemaVersion": 1,
    "parents": parents,
    "parts": parts,
    "surfaces": surfaces,
    "facadeBoxes": details,
    "nativeBlocks": list(blocks.values()),
    "legacyPrisms": [],
    "sourceArchives": [
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{TILE}.zip",
        "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      }
    ],
    "osmEvidence": [
      {
        "id": "OSM-way-606479961",
        "tags": tags_for(osm.iloc[0]),
        "geometry": mapping(osm_foot),
      }
    ],
    "osmSourceUrl": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmSourceSha256": osm_hash,
    "licences": {"buildings": "dl-de/zero-2-0", "map": "ODbL-1.0"},
    "sourceConflicts": {
      "officialFootprintAreaM2": round(feet.area, 6),
      "osmFootprintAreaM2": round(osm_foot.area, 6),
      "osmOnlyAreaM2": round(osm_foot.difference(feet).area, 6),
      "officialOnlyAreaM2": round(feet.difference(osm_foot).area, 6),
    },
    "sourcePolicy": "KOSMOS is the mapped current event venue, formerly Kino Kosmos. The user phrase Kino der Kosmonauten remains an uncertain match. All three official parents, eight parts and 265 original boundary polygons retained. One common source datum preserves inter-parent relative elevations. Facade pattern, members and lettering are procedural display estimates; no photo pixels bundled.",
  }


def candidate_packets(output: Path) -> dict:
  """Subtract only the exact owned coarse triangles, preserving later refinements."""
  import shapely
  from build_karl_marx_allee_v161 import mesh_signature
  from build_surrounding_outlines import (
    DEFAULT_OUTPUT,
    chunk_payload,
    load_projected_polygon,
    polygonal,
  )
  from shapely.geometry import box

  output.mkdir(parents=True, exist_ok=True)
  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
  bounds = world(
    load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  core = world(
    load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds-v158.geojson")
  )
  buildings = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings").to_dict(
    "records"
  )
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  own = unary_union([b["geometry"] for b in buildings if b["sourceId"] in PARENTS])
  patches, audit = [], []
  for d in manifest["chunks"]:
    tile = box(*d["bounds"])
    if not tile.intersects(own):
      continue
    selected = [b for b in buildings if b["geometry"].intersects(tile)]
    local = {
      k: polygonal(shapely.make_valid(shapely.clip_by_rect(g, *tile.bounds)))
      for k, g in surfaces.items()
    }
    result = {"id": d["id"], "bounds": d["bounds"]}
    entry = {"id": d["id"], "ownedSourceIds": sorted(PARENTS), "modes": {}}
    for mode in ["drawn", "minecraft"]:
      original = json.loads(
        gzip.decompress((DEFAULT_OUTPUT / d[mode]["url"]).read_bytes())
      )
      baseline = chunk_payload(
        d["id"],
        tile,
        bounds.difference(core).intersection(tile),
        selected,
        local,
        minecraft=mode == "minecraft",
      )
      retained = chunk_payload(
        d["id"],
        tile,
        bounds.difference(core).intersection(tile),
        selected,
        local,
        minecraft=mode == "minecraft",
        replaced_source_ids=frozenset(PARENTS),
      )
      remove = mesh_signature(baseline) - mesh_signature(retained)
      original_signature = mesh_signature(original)
      assert not remove - original_signature, (
        "Owned baseline no longer present; review existing ownership"
      )
      pending = remove.copy()
      for mesh in original["meshes"]:
        pos = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
          -1, 3
        )
        col = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
        vertices = np.column_stack([pos, col])
        indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
          -1, 3
        )
        kept = []
        for ids in indices:
          key = b"".join(sorted(row.tobytes() for row in vertices[ids]))
          if pending[key]:
            pending[key] -= 1
          else:
            kept.extend(ids)
        mesh["indices"] = base64.b64encode(
          np.array(kept, dtype="<u4").tobytes()
        ).decode("ascii")
      assert not +pending
      assert mesh_signature(original) == original_signature - remove
      nav = original["nav"]["buildings"]
      original["nav"]["buildings"] = [b for b in nav if b["sourceId"] not in PARENTS]
      raw = (
        json.dumps(original, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      packed = gzip.compress(raw, mtime=0)
      (output / d[mode]["url"]).write_bytes(packed)
      result[mode] = {
        "url": d[mode]["url"],
        "encoding": "gzip",
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      entry["modes"][mode] = {
        "oldSha256": d[mode]["sha256"],
        "newSha256": result[mode]["sha256"],
        "removedOwnedTriangles": sum(remove.values()),
        "retainedUnownedTriangles": sum(mesh_signature(original).values()),
        "retainedUnownedNavigation": len(original["nav"]["buildings"]),
      }
    patches.append(result)
    audit.append(entry)
  patch = {
    "chunks": patches,
    "source": {
      "kosmosV166": {
        "sourceIds": sorted(PARENTS),
        "policy": "Complete surveyed source moved to KosmosV166; every unowned triangle and navigation record retained.",
      }
    },
    "audit": audit,
  }
  (output / "kosmos-manifest-patch.json").write_text(json.dumps(patch, indent=2) + "\n")
  return patch


def main() -> None:
  p = make_payload()
  DEST.write_text(json.dumps(p, separators=(",", ":")) + "\n")
  roofs = {}
  for x, y, z, _ in p["nativeBlocks"]:
    roofs[(x, z)] = max(roofs.get((x, z), -100), y + 1)
  nav = {k: p[k] for k in ["parents", "parts", "legacyPrisms"]}
  nav.update(
    {
      "roofTriangles": [
        t for s in p["surfaces"] if s["kind"] == "RoofSurface" for t in s["triangles"]
      ],
      "nativeRoofCells": [[x, z, y] for (x, z), y in roofs.items()],
    }
  )
  DEST.with_name("kosmosV166Navigation.json").write_text(
    json.dumps(nav, separators=(",", ":")) + "\n"
  )
  print(
    {
      k: len(p[k])
      for k in ["parents", "parts", "surfaces", "facadeBoxes", "nativeBlocks"]
    }
  )


if __name__ == "__main__":
  main()
