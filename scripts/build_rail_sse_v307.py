"""Step10 finite Ring, Gesundbrunnen and Europasportpark source extraction.

Source records are retained completely. Four-metre measured refinements remain
inside named sites; the old city datum is feathered only at their inner edge.
The shared terrain compiler performs exact source-plane/paint complements.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import sys
import zipfile
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_bebelplatz_building_source import extract_parent, part_profile
from build_rail_stations_v190 import ident, tags, world
from terrain_fields_v307 import TerrainFieldV307

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/rail-sse-v307"
SOURCE = GEO / "rail-sse-v307-source.json.gz"
TERRAIN = DATA / "railSseTerrainV307.json"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
PARENTS = {
  "velodrom": ("394_5821", ["DEBE00YY135000ig", "DEBE03AL4Og00032"]),
  "sse": ("394_5820", ["DEBE03AL4Og00026"]),
  "landsbergerAllee": ("395_5821", ["DEBE03YY6000005h"]),
  "landsbergerNorth": ("395_5820", ["DEBE03YY6000005S"]),
  "gesundbrunnen": (
    "390_5823",
    [
      "DEBE00YYNf00003i",
      "DEBE01YYK00040Vy",
      "DEBE01YYK0003wh2",
      "DEBE01YYK00044G5",
      "DEBE01YYK0003yiL",
      "DEBE01YYK00047Bb",
      "DEBE01YYK0003yFz",
    ],
  ),
}
REFERENCES = [
  {
    "url": "https://sbahn.berlin/fahren/s41/",
    "credit": "S-Bahn Berlin GmbH",
    "checked": "2026-11-02",
    "use": "All27 station identities and order,37kmclosedRing; no current timetable copied.",
  },
  {
    "url": "https://sbahn.berlin/fahren/bahnhofsuebersicht/wedding/",
    "credit": "S-Bahn Berlin GmbH",
    "checked": "2026-11-02",
    "use": "Current station identity; modern concrete platform is separate from retained historic brick viaduct.",
  },
  {
    "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030317",
    "credit": "Landesdenkmalamt Berlin",
    "checked": "2026-11-02",
    "use": "Yellow-brick1889/90 viaduct and demolished1890station distinguished from modern station.",
  },
  {
    "url": "https://www.bahnhof.de/berlin-gesundbrunnen",
    "credit": "DB InfraGO AG",
    "checked": "2026-11-02",
    "use": "Badstraße1–3 identity and published station plan; five complete platforms retained.",
  },
  {
    "url": "https://www.berlinerbaeder.de/baeder/detail/schwimm-und-sprunghalle-im-europasportpark-sse/",
    "credit": "Berliner Bäder-Betriebe",
    "checked": "2026-11-02",
    "use": "Paul-Heyse-Straße26,1999opening,Perraultdesign,and direct underpass fromLandsbergerAlleeplatform.",
  },
  {
    "url": "https://perraultarchitecture.com/en/projects/velodrome-and-olympic-swimming-pool-berlin/",
    "credit": "Dominique Perrault Architecture",
    "checked": "2026-11-02searchindex;originHTTP403",
    "use": "Two facilities embedded in terrain: circular velodrome and rectangular pool within an orchard. No plan/photo pixels copied.",
  },
  {
    "url": "https://www.gkd-group.com/de-de/architektur/projekte/olympic-velodrome-and-swimming-pool-berlin/",
    "credit": "GKD Group; Gaëlle Lauriot-Prévost / Dominique Perrault Architecte / ADAGP",
    "checked": "2026-11-02",
    "use": "Architectural metal-fabric roof reference only; remote images were not downloadable and no pixels are included.",
  },
]


def sha_v307(path: Path) -> str:
  """Fingerprint an ordinary complete local source."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def read_v307(path: Path) -> Any:
  """Read complete retained JSON or deterministic gzip JSON."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write_v307(path: Path, value: Any) -> None:
  """Write only this version's bounded deterministic derivatives."""
  raw = (
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  ).encode()
  temporary = path.with_name(path.name + ".tmp-v307")
  temporary.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)
  temporary.replace(path)


def extract_v307() -> dict[str, Any]:
  """Retain named official families, mapped sites and exact prior inventory."""
  RAW.mkdir(parents=True, exist_ok=True)
  cache = RAW / "sites.geojson"
  if not cache.exists():
    frame = pyogrio.read_dataframe(
      PBF,
      layer="multipolygons",
      where="osm_id='14524667' OR osm_way_id IN ('7997184','7997192','1013578299')",
    )
    cache.write_text(frame.to_json(drop_id=True))
  sites = []
  for f in read_v307(cache)["features"]:
    sites.append(
      {
        "id": ident(f),
        "tags": tags(f),
        "geometry": mapping(world(shape(f["geometry"]))),
      }
    )
  expected = {"relation/14524667", "way/7997184", "way/7997192", "way/1013578299"}
  if {s["id"] for s in sites} != expected:
    raise ValueError("The complete four named OSM site identities are required")
  parents = []
  archives = {}
  for site, (tile, identities) in PARENTS.items():
    path = GEO / "raw/lod2" / f"LoD2_{tile}.zip"
    archives[tile] = {
      "url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
      "sha256": sha_v307(path),
    }
    for identity in identities:
      parent = extract_parent(path, identity)
      parts = [part_profile(q) for q in leaf_building_parts(parent) or [parent]]
      parents.append({"site": site, "id": identity, "tile": tile, "parts": parts})
  rail = read_v307(DATA / "railStationsV190.json")
  corridor = unary_union(
    [
      Polygon(p["rings"][0], p["rings"][1:])
      for p in rail["platforms"]
      if p["station"] == "Gesundbrunnen"
    ]
  ).convex_hull.buffer(8)
  frame = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg", layer="buildings"
  )
  retained_ids = {p["id"] for p in parents}
  for row in frame.itertuples():
    if (
      row.sourceId in retained_ids
      or not row.sourceId.startswith("DEBE")
      or not (10 <= row.sourceGroundY < 14)
      or not corridor.covers(row.geometry.representative_point())
    ):
      continue
    anchor = row.geometry.representative_point()
    tile = f"{int((anchor.x + 389500) // 1000)}_{int((5820000 - anchor.y) // 1000)}"
    archive = GEO / "raw/lod2" / f"LoD2_{tile}.zip"
    if not archive.exists():
      raise ValueError(
        f"Missing complete source archive for station access family {row.sourceId}"
      )
    parent = extract_parent(archive, row.sourceId)
    parts = [part_profile(q) for q in leaf_building_parts(parent) or [parent]]
    parents.append(
      {"site": "gesundbrunnenAccess", "id": row.sourceId, "tile": tile, "parts": parts}
    )
    retained_ids.add(row.sourceId)
    archives[tile] = {
      "url": f"https://gdi.berlin.de/data/a_lod2/atom/LoD2_{tile}.zip",
      "sha256": sha_v307(archive),
    }
  foreign = frame[
    ~frame.sourceId.isin(retained_ids | {"OSM-way-7997192", "OSM-way-1228255547"})
  ]
  foreign_mask = unary_union(
    [
      g.buffer(16)
      for g in foreign.geometry
      if any(
        g.intersects(q)
        for q in [
          corridor.buffer(110),
          next(
            shape(v["geometry"]) for v in sites if v["id"] == "way/1013578299"
          ).buffer(50),
        ]
      )
    ]
  )
  ring = sorted(
    (s for s in rail["stations"] if "ringOrder" in s), key=lambda s: s["ringOrder"]
  )
  if len(ring) != 27 or [s["ringOrder"] for s in ring] != list(range(27)):
    raise ValueError("The immutable complete27-stopRing is required")
  return {
    "schemaVersion": 1,
    "origin": [389500, 5820000, 30],
    "license": "dl-de/zero-2-0;ODbL-1.0",
    "pbf": {
      "url": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "sha256": sha_v307(PBF),
    },
    "sites": sites,
    "parents": parents,
    "foreignBuildingContactExclusion": mapping(foreign_mask),
    "archives": archives,
    "references": REFERENCES,
    "ringInventory": ring,
    "ringSourceSha256": sha_v307(DATA / "railStationsV190.json"),
    "policy": "Every retained ring node/platform/roof/route, original source sheet and court hole remains. DGM heights are NHNminus30, not arbitrary negative layers. Only documented named site proxies may yield after complete replacement; small architectural and terrain seam subdivisions are explicit display estimates. No photo pixels, textures, new coverage or tour stop.",
  }


def grid_sample_v307(profile: dict[str, Any], x: float, z: float) -> float:
  """The exact NW/SE piecewise planar four-metre offset field."""
  w, n, e, b = profile["bounds"]
  if x < w or x >= e or z < n or z >= b:
    return 0
  u, v = (x - w) / 4, (z - n) / 4
  i, j = math.floor(u), math.floor(v)
  a, b = u - i, v - j
  rows = profile["offsets"]
  nw, ne, sw, se = rows[j][i], rows[j][i + 1], rows[j + 1][i], rows[j + 1][i + 1]
  return (
    nw * (1 - a) + ne * (a - b) + se * b
    if a >= b
    else nw * (1 - b) + sw * (b - a) + se * a
  )


_DOMAIN_CACHE_V307: dict[int, tuple[dict[str, Any], Any]] = {}


def sample_offset_v307(
  profile: dict[str, Any], x: float, z: float, native: bool = False
) -> float:
  """Match each complete field's drawn planes or independent native cells."""
  if native:
    x, z = math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2
  cached = _DOMAIN_CACHE_V307.get(id(profile))
  if cached is None:
    cached = (profile, shape(profile["domain"]))
    _DOMAIN_CACHE_V307[id(profile)] = cached
  domain = cached[1]
  if not domain.covers(Point(x, z)):
    return 0
  delta = grid_sample_v307(profile, x, z)
  return math.ceil((3 + delta) * 8) / 8 - 3 if native and delta else delta


def baseline_height_v307(_x: float, _z: float, _native: bool = False) -> float:
  """Original untouched flat source grade in the two named307domains."""
  return 3


def terrain_fields_v307(data: dict[str, Any] | None = None) -> list[TerrainFieldV307]:
  """Provide common offline field objects without hidden source mutation."""
  value = data or read_v307(TERRAIN)
  return [
    TerrainFieldV307(
      p["key"],
      shape(p["domain"]),
      tuple(p["bounds"]),
      p["step"],
      lambda x, z, native=False, p=p: sample_offset_v307(p, x, z, native),
      baseline_height_v307,
    )
    for p in value["profiles"]
  ]


def build_terrain_v307(source: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
  """Sample the measured named contact surfaces with exact source boundaries."""
  sites = {s["id"]: shape(s["geometry"]) for s in source["sites"]}
  rail = read_v307(DATA / "railStationsV190.json")
  station = unary_union(
    [
      Polygon(p["rings"][0], p["rings"][1:])
      for p in rail["platforms"]
      if p["station"] == "Gesundbrunnen"
    ]
  )
  domains = {
    "gesundbrunnen": station.convex_hull.buffer(110, quad_segs=8).difference(
      sites["relation/14524667"]
    ),
    "europasportpark": sites["way/1013578299"].union(
      unary_union(
        [
          Polygon(p["rings"][0], p["rings"][1:])
          for p in rail["platforms"]
          if p["station"] == "Landsberger Allee"
        ]
      ).convex_hull.buffer(30, quad_segs=8)
    ),
  }
  exclusion = shape(source["foreignBuildingContactExclusion"])
  platform_contact = unary_union(
    [
      Polygon(p["rings"][0], p["rings"][1:]).buffer(2)
      for p in rail["platforms"]
      if p["station"] in ("Gesundbrunnen", "Landsberger Allee")
    ]
  )
  domains = {
    key: domain.difference(exclusion.difference(platform_contact))
    for key, domain in domains.items()
  }
  paths = {
    "gesundbrunnen": (GEO / "raw/dgm/weinberg-v176/DGM1_390_5822.zip", 390000, 5822000),
    "europasportpark": (GEO / "raw/dgm/parks-v182/DGM1_394_5820.zip", 394000, 5820000),
  }
  profiles, evidence = [], []
  for key, domain in domains.items():
    path, east, north = paths[key]
    with zipfile.ZipFile(path) as archive:
      with archive.open(archive.namelist()[0]) as stream:
        heights = (
          np.loadtxt(stream, usecols=2, dtype=np.float32).reshape(2000, 2000) - 30
        )
    bounds = [
      math.floor(q / 4) * 4 if i < 2 else math.ceil(q / 4) * 4
      for i, q in enumerate(domain.bounds)
    ]
    w, n, e, b = bounds
    rows, samples = [], []
    for z in range(n, b + 1, 4):
      row = []
      for x in range(w, e + 1, 4):
        point = Point(x, z)
        distance = domain.boundary.distance(point) if domain.covers(point) else 0
        t = min(1, distance / 24)
        weight = t * t * (3 - 2 * t)
        iy, ix = math.floor(5820000 - z - north), math.floor(x + 389500 - east)
        if not (0 <= iy < 2000 and 0 <= ix < 2000):
          raise ValueError(
            "The complete contact surface escaped its finite DGM1 archive"
          )
        measured = round(float(heights[iy, ix]), 2)
        row.append(round((measured - 3) * weight, 6))
        if weight:
          samples.append([x, z, measured, round(weight, 9)])
      rows.append(row)
    profiles.append(
      {
        "key": key,
        "bounds": bounds,
        "step": 4,
        "nativeStep": 4,
        "nativeQuantizationM": 0.125,
        "domain": mapping(domain),
        "offsets": rows,
        "innerSeamM": 24,
        "oldGroundY": 3,
        "sourceSha256": sha_v307(path),
      }
    )
    evidence.append(
      {
        "key": key,
        "path": str(path.relative_to(ROOT)),
        "sha256": sha_v307(path),
        "url": f"https://gdi.berlin.de/data/dgm1/atom/{path.name}",
        "gridCellCentreConvention": "nearest1mcell at x+.5m,north+.5m; complete selected values retained",
        "samples": samples,
        "domain": mapping(domain),
        "datum": "NHNminus30m",
        "policy": "Inside named contact area;24m inner smooth transition to unchanged original3m source grade. Park14524667 is explicitly excluded from rail field. No inferred negative-layer arithmetic.",
      }
    )
  return {"schemaVersion": 1, "profiles": profiles}, {
    "schemaVersion": 1,
    "fields": evidence,
  }


def main() -> None:
  """Build only bounded version307 derivatives; never change old source files."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  source = extract_v307() if args.extract or not SOURCE.exists() else read_v307(SOURCE)
  terrain, evidence = build_terrain_v307(source)
  source["terrainEvidence"] = evidence
  write_v307(SOURCE, source)
  write_v307(TERRAIN, terrain)
  print(
    {
      "fields": len(terrain["profiles"]),
      "runtimeBytes": TERRAIN.stat().st_size,
      "runtimeGzipBytes": len(gzip.compress(TERRAIN.read_bytes(), mtime=0)),
      "sourceBytes": SOURCE.stat().st_size,
    }
  )


if __name__ == "__main__":
  main()
