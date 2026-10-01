"""Step 10: bounded City West street fronts, prepared in existing stream packets.

No browser-side facade construction and no change to the retained core shells.
The exact outside-core LoD2 parent list replaces only its coarse old envelopes.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from build_concert_halls_v160 import normal_of, triangulate
from build_karl_marx_allee_v161 import (
  Detail,
  mesh_signature,
  native_detail,
  packed_detail,
)
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  GROUND_Y,
  POSITION_ORIGIN_Y,
  ROOT,
  chunk_payload,
  line_parts,
  load_projected_polygon,
  native_polygon,
  navigation_polygons,
  polygonal,
  tags_for,
  world,
  write_json,
)
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union

from isometric_berlin.generation.road_geometry import road_width_m

RAW = ROOT / "geo_data/regierungsviertel/raw/outer-v159"
SOURCE = ROOT / "geo_data/regierungsviertel/west-streets-v163.json"
AUDIT = ROOT / "geo_data/regierungsviertel/west-streets-v163-audit.json"
NAMES = ("Kurfürstendamm", "Uhlandstraße", "Fasanenstraße", "Meinekestraße")
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
GLASS = (62, 82, 87)
FRAME = (191, 195, 185)
STONE = (218, 211, 193)
PAVING = (181, 176, 163)
KERB = (212, 207, 191)


def read_bounds() -> tuple[Any, Any]:
  """Current requested bounds and unchanged pre-extension detailed city."""
  return tuple(
    world(load_projected_polygon(ROOT / f"geo_data/regierungsviertel/{name}"))
    for name in ("bounds.geojson", "bounds-v158.geojson")
  )


def extract_source(names: tuple[str, ...] = NAMES) -> dict[str, Any]:
  """Capture permitted source identities and actual rings; no inferred wings."""
  bounds, core = read_bounds()
  names_sql = ",".join(f"'{name}'" for name in names)
  lines = gpd.read_file(
    RAW / "candidate.gpkg", layer="lines", where=f"name IN ({names_sql})"
  ).to_crs(25833)
  roads = []
  for _, row in lines.iterrows():
    tags = tags_for(row)
    if tags.get("tunnel", "no") != "no" or tags.get("highway") in {None, "steps"}:
      continue
    geometry = world(row.geometry).intersection(bounds)
    if geometry.is_empty:
      continue
    width = road_width_m(tags)
    if width is None:
      continue
    roads.append(
      {
        "id": f"OSM-way-{row['osm_id']}",
        "name": row["name"],
        "highway": tags.get("highway"),
        "width": width,
        "tags": tags,
        "geometry": mapping(geometry),
      }
    )
  vehicle_roads = unary_union(
    [
      shape(r["geometry"])
      for r in roads
      if r["highway"] not in {"footway", "cycleway", "path", "pedestrian"}
    ]
  )
  street_zone = vehicle_roads.buffer(43)
  outer = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings")
  selected = outer[
    outer.sourceId.str.startswith("DEBE") & outer.geometry.intersects(street_zone)
  ]
  boundary_parents = sorted(
    selected[
      (selected.geometry.distance(bounds.boundary) < 3.2)
      | (selected.geometry.distance(core.boundary) < 3.2)
    ].sourceId
  )
  selected = selected[
    (selected.geometry.distance(bounds.boundary) >= 3.2)
    & (selected.geometry.distance(core.boundary) >= 3.2)
  ]
  identities = set(selected.sourceId)
  buildings, archives = [], []
  for archive_path in sorted(
    (ROOT / "geo_data/regierungsviertel/raw/lod2").glob("LoD2_*.zip")
  ):
    _, e, n = archive_path.stem.split("_")
    tile = box(
      int(e) * 1000 - 389500,
      5820000 - (int(n) + 1) * 1000,
      (int(e) + 1) * 1000 - 389500,
      5820000 - int(n) * 1000,
    )
    if not tile.intersects(street_zone.buffer(700)):
      continue
    with zipfile.ZipFile(archive_path) as archive:
      tree = ET.fromstring(archive.read(archive.namelist()[0]))
    used = False
    for parent in tree.findall(".//b:Building", NS):
      identity = parent.get(f"{{{NS['g']}}}id")
      if identity not in identities:
        continue
      used = True
      ground = min(
        float(v)
        for element in parent.findall(".//b:GroundSurface//g:posList", NS)
        for v in element.text.split()[2::3]
      )
      parts = []
      for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
        surfaces = []
        for boundary in part.findall("b:boundedBy", NS):
          for surface in boundary:
            for polygon in surface.findall(".//g:Polygon", NS):
              rings = []
              for element in polygon.findall(".//g:posList", NS):
                values = [float(v) for v in element.text.split()]
                ring = [
                  [
                    round(values[i] - 389500, 3),
                    round(values[i + 2] - ground + GROUND_Y, 3),
                    round(5820000 - values[i + 1], 3),
                  ]
                  for i in range(0, len(values), 3)
                ]
                if ring[0] == ring[-1]:
                  ring.pop()
                rings.append(ring)
              if rings:
                surfaces.append({"kind": surface.tag.split("}")[-1], "rings": rings})
        parts.append({"id": part.get(f"{{{NS['g']}}}id"), "surfaces": surfaces})
      buildings.append({"id": identity, "groundNHN": ground, "parts": parts})
    if used:
      archives.append(
        {
          "url": f"https://gdi.berlin.de/data/a_lod2/atom/{archive_path.name}",
          "sha256": hashlib.sha256(archive_path.read_bytes()).hexdigest(),
        }
      )
  assert {b["id"] for b in buildings} == identities, identities - {
    b["id"] for b in buildings
  }

  # Reuse the exact already-delivered core planes and height; an asynchronous
  # overlay must never suppress them or substitute a guessed taller building.
  prisms = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  hero_text = (ROOT / "src/app/src/CityWestDetails.ts").read_text()
  hero_ids = {s[-8:] for s in re.findall(r'"OSM-way-(\d+)"', hero_text)}
  core_fronts = []
  for record in prisms["buildings"]:
    geometry = Polygon(
      [(x / 10, z / 10) for x, z in record["ring"]],
      [[(x / 10, z / 10) for x, z in ring] for ring in record["holes"]],
    )
    if record["id"] in hero_ids or not geometry.intersects(street_zone):
      continue
    if not core.covers(geometry.representative_point()):
      continue
    core_fronts.append(record)
  return {
    "schemaVersion": 1,
    "licences": {
      "sourceBuildings": "dl-de/zero-2-0",
      "streetsAndCorePrisms": "ODbL-1.0 / retained source provenance",
    },
    "frame": "x=easting-389500; z=5820000-northing; outer parents translated to existing y=3, core source y0 retained",
    "selection": "Complete named in-bounds driving corridors plus mapped named pedestrian ways; outer LoD2 parents and core prisms intersecting their 43 m frontage search corridor. This selects source buildings, not new district coverage.",
    "sourceArchives": archives,
    "retainedBoundaryParents": boundary_parents,
    "roads": roads,
    "buildings": buildings,
    "corePrisms": core_fronts,
    "references": [
      "https://www.berlin.de/sehenswuerdigkeiten/3561166-3558930-kurfuerstendamm.html",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/strassen/artikel.180243.php",
      "https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/villen/artikel.196549.php",
      "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/frankreich/charlottenburg-wilmersdorf/maison-de-france-647620.php",
    ],
    "displayEstimates": "Facade bay/floor spacing, pale stone surrounds, neutral plaster and glass, untagged pavement width and curb dimensions are restrained procedural indications, not a per-building or per-window survey. Exact source roofs, courts and heights are preserved. Core overlays use the existing displayed prism planes without altering or concealing the buildings. No photograph, sampled color or texture is used.",
  }


def facade(
  detail: Detail, rings: list[list[list[float]]], roads: Any, ground: float, top: float
) -> None:
  """Street-facing panes fit completely inside their existing source wall."""
  n = normal_of(rings[0])
  if abs(n[1]) > 0.05:
    return
  center = np.mean(np.array(rings[0]), axis=0)
  nearest = nearest_points(Point(center[0], center[2]), roads)[1]
  distance = math.hypot(nearest.x - center[0], nearest.y - center[2])
  if (
    distance > 48
    or (nearest.x - center[0]) * n[0] + (nearest.y - center[2]) * n[2] < 0.1
  ):
    return
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda pair: math.hypot(pair[1][0] - pair[0][0], pair[1][2] - pair[0][2]),
  )
  dx, dz = b[0] - a[0], b[2] - a[2]
  length = math.hypot(dx, dz)
  if length < 2.4:
    return
  dx, dz = dx / length, dz / length
  planar = [
    [((p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]) for p in ring] for ring in rings
  ]
  poly = Polygon(planar[0], planar[1:])
  if not poly.is_valid:
    poly = shapely.make_valid(poly)
  inset = poly.buffer(-0.04)
  u0, y0, u1, y1 = poly.bounds

  def pane(
    u: float,
    y: float,
    width: float,
    height: float,
    color: tuple[int, ...],
    out: float,
    role: str,
  ) -> None:
    rectangle = box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
    if not inset.covers(rectangle):
      return
    detail.polygon(
      [
        [a[0] + dx * v + n[0] * out, h, a[2] + dz * v + n[2] * out]
        for v, h in list(rectangle.exterior.coords)[:-1]
      ],
      color,
      role,
    )

  bays = max(1, round(length / 3.4))
  pitch = length / bays
  for y in np.arange(ground + 5.95, min(top, y1) - 0.9, 3.25):
    for i in range(bays):
      u = u0 + (i + 0.5) * pitch
      pane(u, y, 1.52, 2.03, STONE, 0.055, "window surround")
      pane(u, y, 1.25, 1.79, GLASS, 0.08, "window glazing")
      pane(u, y, 0.075, 1.78, FRAME, 0.105, "window mullion")
      pane(u, y - 0.91, 1.63, 0.11, STONE, 0.125, "stone window sill")
  for i in range(bays):
    u = u0 + (i + 0.5) * pitch
    pane(u, ground + 1.9, min(2.45, pitch - 0.3), 2.9, STONE, 0.05, "shopfront reveal")
    pane(
      u, ground + 1.9, min(2.2, pitch - 0.55), 2.62, GLASS, 0.08, "shopfront glazing"
    )
    pane(u, ground + 1.9, 0.1, 2.62, FRAME, 0.11, "shopfront frame")
  for y in (ground + 3.65, min(top, y1) - 0.38):
    pane((u0 + u1) / 2, y, length - 0.15, 0.19, STONE, 0.1, "continuous cornice")


def outer_detail(
  building: dict[str, Any], roads: Any
) -> tuple[Detail, list[dict[str, Any]]]:
  """Restore every actual LoD2 part, including pitched roofs and open courts."""
  detail, navigation = Detail(), []
  for part in building["parts"]:
    grounds = [
      Polygon(
        [(p[0], p[2]) for p in s["rings"][0]],
        [[(p[0], p[2]) for p in r] for r in s["rings"][1:]],
      )
      for s in part["surfaces"]
      if s["kind"] == "GroundSurface"
    ]
    points = [p for s in part["surfaces"] for ring in s["rings"] for p in ring]
    if not points:
      continue
    top = max(p[1] for p in points)
    if grounds:
      navigation.append(
        {
          "sourceId": building["id"],
          "partId": part["id"],
          "geometry": unary_union(grounds),
          "height": top - GROUND_Y,
          "minHeight": max(0, min(p[1] for p in points) - GROUND_Y),
          "heightSource": "Berlin LoD2 part vertical envelope",
        }
      )
    for surface in part["surfaces"]:
      if surface["kind"] not in {"WallSurface", "RoofSurface"}:
        continue
      color = (160, 159, 151) if surface["kind"] == "RoofSurface" else (211, 208, 197)
      for triangle in triangulate(surface["rings"]):
        detail.polygon(triangle, color, "source " + surface["kind"])
      if surface["kind"] == "WallSurface":
        facade(detail, surface["rings"], roads, GROUND_Y, top)
  return detail, navigation


def core_detail(record: dict[str, Any], roads: Any) -> Detail:
  """Add thin exterior detail to the exact retained core prism, never a shell."""
  detail = Detail()
  polygon = shapely.orient_polygons(
    Polygon([(x / 10, z / 10) for x, z in record["ring"]]), exterior_cw=True
  )
  low, top = record["y0_dm"] / 10, (record["y0_dm"] + record["h_dm"]) / 10
  for (ax, az), (bx, bz) in zip(
    polygon.exterior.coords, list(polygon.exterior.coords)[1:]
  ):
    facade(
      detail,
      [[(ax, low, az), (bx, low, bz), (bx, top, bz), (ax, top, az)]],
      roads,
      low,
      top,
    )
  return detail


def surface_detail(
  geometry: Any, y: float, color: tuple[int, ...], role: str
) -> Detail:
  """All constrained surface triangles, including holes."""
  detail = Detail()
  for polygon in getattr(polygonal(shapely.make_valid(geometry)), "geoms", [geometry]):
    if polygon.is_empty or polygon.geom_type != "Polygon":
      continue
    for triangle in shapely.constrained_delaunay_triangles(polygon).geoms:
      detail.polygon(
        [[x, y, z] for x, z in list(triangle.exterior.coords)[:3]], color, role
      )
  return detail


def street_detail(
  source: dict[str, Any],
  surfaces: dict[str, Any],
  buildings: list[dict[str, Any]],
  native: bool,
) -> tuple[Detail, dict[str, float]]:
  """Pavements follow existing asphalt boundaries, retaining open junctions."""
  bounds, core = read_bounds()
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  zone = roads.buffer(24).intersection(bounds)
  footprints = unary_union(
    [b["geometry"] for b in buildings if b["geometry"].intersects(zone)]
    + [
      Polygon([(x / 10, z / 10) for x, z in p["ring"]])
      for p in json.loads(
        (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
      )["buildings"]
      if Polygon([(x / 10, z / 10) for x, z in p["ring"]]).intersects(zone)
    ]
  )
  core_surfaces = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json").read_text()
  )
  core_roads = unary_union(
    [
      shapely.make_valid(
        Polygon(
          [(x / 10, z / 10) for x, z in p["ring"]],
          [[(x / 10, z / 10) for x, z in r] for r in p.get("holes", [])],
        )
      )
      for p in core_surfaces["roads"]
    ]
  )
  result, totals = Detail(), Counter()
  for scope, asphalt, ground in (
    (bounds.difference(core), surfaces["road"], GROUND_Y),
    (core, core_roads, 5.2),
  ):
    local_zone = zone.intersection(scope)
    if local_zone.is_empty:
      continue
    asphalt = polygonal(asphalt.intersection(local_zone.buffer(6)))
    if native:
      asphalt = native_polygon(asphalt)
    sidewalk = (
      asphalt.buffer(3.3, join_style="round", quad_segs=4)
      .difference(asphalt)
      .intersection(local_zone)
    )
    sidewalk = sidewalk.difference(footprints.buffer(0.08)).difference(
      surfaces.get("water", Polygon())
    )
    if native:
      sidewalk = native_polygon(sidewalk).difference(asphalt).intersection(local_zone)
    result.triangles.extend(
      surface_detail(
        sidewalk, ground + 0.22, PAVING, "source-aligned sidewalk"
      ).triangles
    )
    # Do not close tile/scope cuts or cross streets with invented transverse kerbs.
    edge = asphalt.boundary.intersection(local_zone.buffer(-0.25)).difference(
      footprints.buffer(0.1)
    )
    kerbs = edge.buffer(0.11, cap_style="flat", join_style="round", quad_segs=3)
    if native:
      kerbs = (
        native_polygon(kerbs.buffer(0.45))
        .difference(asphalt.buffer(-0.2))
        .intersection(local_zone)
      )
    result.triangles.extend(
      surface_detail(kerbs, ground + 0.28, KERB, "source-aligned curb").triangles
    )
    for line in line_parts(edge):
      for (ax, az), (bx, bz) in zip(line.coords, list(line.coords)[1:]):
        result.polygon(
          [
            [ax, ground + 0.09, az],
            [bx, ground + 0.09, bz],
            [bx, ground + 0.28, bz],
            [ax, ground + 0.28, az],
          ],
          KERB,
          "curb rise",
        )
    totals["sidewalkAreaM2"] += sidewalk.area
    totals["curbLengthM"] += edge.length
  return result, dict(totals)


def partition_detail(detail: Detail) -> dict[tuple[int, int], Detail]:
  """Reference each triangle in its intersected cells, in original face order."""
  output: dict[tuple[int, int], Detail] = {}
  for record in detail.triangles:
    triangle = record[0]
    for ix in range(
      math.floor((min(p[0] for p in triangle) - 1e-8) / 512),
      math.floor(max(p[0] for p in triangle) / 512) + 1,
    ):
      for iz in range(
        math.floor((min(p[2] for p in triangle) - 1e-8) / 512),
        math.floor(max(p[2] for p in triangle) / 512) + 1,
      ):
        key = (ix, iz)
        if key not in output:
          output[key] = Detail()
        output[key].triangles.append(record)
  return output


def publish(
  output: Path,
  source_path: Path = SOURCE,
  *,
  mesh_kind: str = "city-west-street-fronts-v163",
  source_key: str = "westStreetsV163",
  version: str = "1.0.63",
  patch_name: str = "west-streets-manifest-patch.json",
  audit_path: Path = AUDIT,
  names: tuple[str, ...] = NAMES,
) -> dict[str, Any]:
  """Write isolated packets and a descriptor patch; shared manifest is read-only."""
  output.mkdir(parents=True, exist_ok=True)
  source = json.loads(source_path.read_text())
  roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
  identities = frozenset(b["id"] for b in source["buildings"])
  buildings = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings").to_dict(
    "records"
  )
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  bounds, core = read_bounds()
  scope = bounds.difference(core)
  details, navigation, roles = {"drawn": Detail(), "minecraft": Detail()}, [], Counter()
  for building in source["buildings"]:
    detail, nav = outer_detail(building, roads)
    details["drawn"].triangles.extend(detail.triangles)
    details["minecraft"].triangles.extend(native_detail(detail).triangles)
    navigation.extend(nav)
    roles.update(role for _, _, role in detail.triangles)
  for record in source["corePrisms"]:
    detail = core_detail(record, roads)
    details["drawn"].triangles.extend(detail.triangles)
    # Native facade details are independent orthogonal surface cells only.
    details["minecraft"].triangles.extend(native_detail(detail).triangles)
    roles.update(role for _, _, role in detail.triangles)
  street_audit = {}
  for mode in details:
    street, metrics = street_detail(source, surfaces, buildings, mode == "minecraft")
    details[mode].triangles.extend(street.triangles)
    street_audit[mode] = metrics
  print(
    "Prepared",
    len(identities),
    "LoD2 parents,",
    len(source["corePrisms"]),
    "core facades,",
    {m: len(d.triangles) for m, d in details.items()},
    flush=True,
  )

  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
  descriptors = {d["id"]: d for d in manifest["chunks"]}
  # Same numeric tile IDs: append to an existing cell rather than introduce
  # overlapping nav owners; purely core cells get empty navigation.
  partitioned = {mode: partition_detail(detail) for mode, detail in details.items()}
  # Keep the original publication footprint; shared boundary faces are also
  # referenced by each existing neighbouring tile, matching packed_detail.
  tiles = set()
  for detail in details.values():
    for triangle, _, _ in detail.triangles:
      for ix in range(
        math.floor(min(p[0] for p in triangle) / 512),
        math.floor(max(p[0] for p in triangle) / 512) + 1,
      ):
        for iz in range(
          math.floor(min(p[2] for p in triangle) / 512),
          math.floor(max(p[2] for p in triangle) / 512) + 1,
        ):
          tiles.add((ix, iz))
  tree = shapely.STRtree([b["geometry"] for b in buildings])
  audit, patch = [], []
  for ix, iz in sorted(tiles):
    identity = f"{ix}_{iz}"
    tile = box(ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
    old_descriptor = descriptors.get(identity)
    selected = [buildings[int(i)] for i in tree.query(tile, predicate="intersects")]
    owned = identities.intersection(b["sourceId"] for b in selected)
    descriptor = {"id": identity, "bounds": list(tile.bounds)}
    entry = {"id": identity, "ownedSourceIds": sorted(owned), "modes": {}}
    local = {
      kind: polygonal(shapely.make_valid(shapely.clip_by_rect(g, *tile.bounds)))
      for kind, g in surfaces.items()
    }
    for mode in details:
      original = (
        json.loads(
          gzip.decompress((DEFAULT_OUTPUT / old_descriptor[mode]["url"]).read_bytes())
        )
        if old_descriptor
        else None
      )
      if owned:
        baseline = chunk_payload(
          identity,
          tile,
          scope.intersection(tile),
          selected,
          local,
          minecraft=mode == "minecraft",
        )
        assert original is not None and mesh_signature(original) == mesh_signature(
          baseline
        ), f"Uncoordinated packet ownership {identity}"
        payload = chunk_payload(
          identity,
          tile,
          scope.intersection(tile),
          selected,
          local,
          minecraft=mode == "minecraft",
          replaced_source_ids=identities,
        )
      elif original:
        payload = original
      else:
        payload = {
          "schemaVersion": 1,
          "id": identity,
          "origin": [ix * 512, POSITION_ORIGIN_Y, iz * 512],
          "meshes": [],
          "nav": {
            "ground": [],
            "water": [],
            "buildings": [],
            "roads": [],
            "bridges": [],
            "groundY": GROUND_Y,
          },
        }
      # Additive later passes own only their distinct mesh kind. Rebuilding that
      # pass is idempotent and preserves every earlier source packet layer.
      if source_key != "westStreetsV163":
        payload["meshes"] = [m for m in payload["meshes"] if m["kind"] != mesh_kind]
      retained = mesh_signature(payload)
      mesh = packed_detail(partitioned[mode].get((ix, iz), Detail()), tile)
      if mesh:
        mesh["kind"] = mesh_kind
        payload["meshes"].append(mesh)
      for nav in navigation:
        if nav["sourceId"] not in owned:
          continue
        for polygon in navigation_polygons(
          nav["geometry"].intersection(tile), *tile.bounds[:2]
        ):
          payload["nav"]["buildings"].append(
            {
              **polygon,
              **{k: v for k, v in nav.items() if k != "geometry"},
              "height": math.ceil(nav["height"] / 2) * 2 + 2
              if mode == "minecraft"
              else nav["height"],
            }
          )
      assert not retained - mesh_signature(payload)
      if original:
        for key in ("ground", "water", "roads", "bridges"):
          # Retain source-navigation ordering/precision byte-for-byte even where
          # world-space polygon overlay returns an equivalent ring rotation.
          payload["nav"][key] = original["nav"][key]
        assert [
          b for b in payload["nav"]["buildings"] if b["sourceId"] not in identities
        ] == [
          b for b in original["nav"]["buildings"] if b["sourceId"] not in identities
        ]
      for m in payload["meshes"]:
        assert len(base64.b64decode(m["positions"])) // 6 <= 400000
        assert len(base64.b64decode(m["indices"])) // 4 <= 2400000
      raw = (
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
      ).encode()
      assert len(raw) <= 12 * 1024 * 1024, (identity, mode, len(raw))
      packed = gzip.compress(raw, compresslevel=9, mtime=0)
      url = (
        old_descriptor[mode]["url"] if old_descriptor else f"{identity}.{mode}.json.gz"
      )
      (output / url).parent.mkdir(parents=True, exist_ok=True)
      (output / url).write_bytes(packed)
      descriptor[mode] = {
        "url": url,
        "encoding": "gzip",
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": hashlib.sha256(packed).hexdigest(),
      }
      entry["modes"][mode] = {
        "retainedUnownedTriangles": sum(retained.values()),
        "addedTriangles": len(base64.b64decode(mesh["indices"])) // 12 if mesh else 0,
        "bytes": len(packed),
        "decodedBytes": len(raw),
      }
    patch.append(descriptor)
    audit.append(entry)
    print(
      identity,
      descriptor["drawn"]["bytes"],
      descriptor["minecraft"]["bytes"],
      flush=True,
    )
  policy = {
    "version": version,
    "sourceIds": sorted(identities),
    "sourceEvidence": str(source_path.relative_to(ROOT)),
    "policy": source["displayEstimates"],
    "streets": list(names),
    "corePrisms": len(source["corePrisms"]),
  }
  write_json(
    output / patch_name,
    {"chunks": patch, "source": {source_key: policy}},
  )
  result = {
    "sourceParents": len(identities),
    "sourceParts": sum(len(b["parts"]) for b in source["buildings"]),
    "corePrisms": len(source["corePrisms"]),
    "streetMetrics": street_audit,
    "roles": dict(roles),
    "chunks": audit,
    "sourceSha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
  }
  write_json(audit_path, result)
  return result


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, default=Path("/tmp/west-streets-v163"))
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source or not SOURCE.exists():
    write_json(SOURCE, extract_source())
  print(json.dumps(publish(args.out)))


if __name__ == "__main__":
  main()
