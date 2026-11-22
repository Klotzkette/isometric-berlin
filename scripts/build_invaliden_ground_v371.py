"""Bake the Invalidenstraße / Charité / Hannoversche Straße surface mosaic."""

import base64
import gzip
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import LineString, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "invaliden-ground-v371-source.geojson.gz"
PARK = GEO / "invalidenpark-v371-survey.json"
CORE = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
OUTPUT = ROOT / "src/app/src/data/invalidenGroundV371.json"
BOUNDS = (112, -1440, 1120, -688)
DOMAIN = box(*BOUNDS)
EMPTY = Polygon()

# Source priorities: the DOP traces and individually mapped platforms can
# correct the older street survey. Surveyed edges take precedence over
# widths inferred from OSM centrelines in the adjoining private grounds.
STYLES = [
  "urban",
  "earth",
  "lawn",
  "planting",
  "sand",
  "gravel",
  "asphalt",
  "setts",
  "mosaic",
  "pavers",
  "slabs",
  "trackbed",
  "platform",
  "kerb",
]
LEGEND = {
  "01": "pavers",
  "02": "asphalt",
  "03": "setts",
  "04": "mosaic",
  "05": "setts",
  "06": "pavers",
  "07": "pavers",
  "08": "slabs",
  "13": "gravel",
  "14": "gravel",
  "15": "lawn",
}
OSM_SURFACE = {
  "asphalt": "asphalt",
  "concrete": "pavers",
  "paving_stones": "pavers",
  "concrete:plates": "slabs",
  "paved": "pavers",
  "sett": "setts",
  "cobblestone": "setts",
  "grass_paver": "pavers",
  "fine_gravel": "gravel",
  "gravel": "gravel",
  "compacted": "gravel",
  "sand": "sand",
  "grass": "lawn",
  "ground": "earth",
  "dirt": "earth",
}
WIDTHS = {  # Display widths in metres only where neither an outline nor width exists.
  "secondary": 8,
  "tertiary": 7,
  "residential": 5.8,
  "service": 3.8,
  "cycleway": 2.2,
  "footway": 1.85,
  "pedestrian": 3.5,
  "steps": 1.8,
  "path": 1.4,
}


def polygons(g):
  if g.is_empty:
    return
  if g.geom_type == "Polygon":
    yield g
  else:
    for child in getattr(g, "geoms", []):
      yield from polygons(child)


def united(geoms):
  # Snap all intersections to the same 2 cm lattice as the packed vertices.
  parts = [p for g in geoms for p in polygons(g)]
  return shapely.union_all(parts, grid_size=0.02) if parts else EMPTY


def resident_rings(owners):
  for owner in owners:
    outer = np.asarray(owner["ring"]) / 10
    if (
      np.max(outer[:, 0]) < BOUNDS[0]
      or np.min(outer[:, 0]) > BOUNDS[2]
      or np.max(outer[:, 1]) < BOUNDS[1]
      or np.min(outer[:, 1]) > BOUNDS[3]
    ):
      continue
    p = shapely.make_valid(
      Polygon(outer, [np.asarray(h) / 10 for h in owner.get("holes", [])])
    )
    yield owner, p.intersection(DOMAIN)


def classify_osm(tags, geom):
  highway = tags.get("area:highway", tags.get("highway"))
  surface = OSM_SURFACE.get(tags.get("surface"))
  if "building" in tags or tags.get("bridge", "no") != "no":
    return
  if geom.geom_type in ("LineString", "MultiLineString"):
    if highway not in WIDTHS:
      return
    try:
      width = float(tags.get("width", WIDTHS[highway]))
    except ValueError:
      width = WIDTHS[highway]
    paved = highway in ("secondary", "tertiary", "service", "residential")
    style = surface or (
      "asphalt" if paved else "gravel" if highway == "path" else "pavers"
    )
    return (
      (28 if paved else 29),
      style,
      geom.buffer(max(0.6, min(20.0, width)) / 2, quad_segs=4),
    )
  if tags.get("railway") == "platform" or highway == "platform":
    return 94, "platform", geom
  if highway in ("footway", "pedestrian", "cycleway", "service", "traffic_island"):
    return 79, surface or ("asphalt" if highway == "service" else "pavers"), geom
  leisure, natural, landuse = (tags.get(k) for k in ("leisure", "natural", "landuse"))
  if natural == "water" or tags.get("amenity") == "fountain":
    return 0, "water", geom
  if (
    tags.get("amenity") in ("parking", "parking_space") or leisure == "outdoor_seating"
  ):
    return 34, surface or "pavers", geom
  if leisure == "playground":
    return 24, surface or "gravel", geom
  if natural in ("wood", "scrub") or leisure == "garden":
    return 19, "planting", geom
  if landuse in ("grass", "meadow") or natural == "grassland":
    return 18, "lawn", geom
  if leisure == "park" or landuse in ("cemetery", "recreation_ground"):
    return 10, "lawn", geom
  if landuse in ("brownfield", "construction"):
    return 9, "earth", geom
  if surface:
    return 32, surface, geom


def classify_survey(owner, tags, geom):
  material = LEGEND.get(str(tags.get("material")), "pavers")
  if owner == "bd_bordstein":
    # Survey line is the alignment; 15 cm raised kerb head is a display estimate.
    return (
      90,
      "kerb",
      geom.buffer(0.075, cap_style="flat", join_style="round", quad_segs=3),
    )
  if owner == "bn_baumscheibe":
    return 85, "earth", geom
  if owner == "ce_gruenflaeche":
    return 80, "lawn", geom
  if owner == "bz_gleiskoerper_strab":
    return 76, "trackbed", geom
  if owner == "cm_fahrbahn":
    return 70, material, geom
  return 74, material, geom


def cadastral_road_faces(roads, edge_lines, streets):
  """Separate sidewalks from carriageways inside the public road parcels.

  Kataster edges join across several blocks or end at an intersection.
  Cross-sections normal to a mapped driving route close those openings.
  Only a face traversed lengthwise by a motor carriageway gets asphalt.
  """
  gates = []
  witnesses = []
  for geom in streets:
    for line in shapely.get_parts(geom):
      if line.geom_type != "LineString" or line.length < 2:
        continue
      witnesses.append(line)
      # Subdivide long reaches; do not create spokes from a junction node.
      count = max(1, int(np.ceil(line.length / 48)))
      for k in range(count):
        along = (k + 0.5) * line.length / count
        a = line.interpolate(max(0, along - 1.0))
        b = line.interpolate(min(line.length, along + 1.0))
        d = a.distance(b)
        if d <= 0:
          continue
        centre = line.interpolate(along)
        dx, dz = (b.y - a.y) * 28 / d, (a.x - b.x) * 28 / d
        gates.append(
          LineString([(centre.x - dx, centre.y - dz), (centre.x + dx, centre.y + dz)])
        )
  tree = shapely.STRtree(witnesses)
  lines = shapely.union_all([roads.boundary, *edge_lines, *gates], grid_size=0.02)
  faces = shapely.get_parts(shapely.polygonize(shapely.get_parts(lines)))
  result = []
  for face in faces:
    if face.area < 0.1 or not roads.covers(face.representative_point()):
      continue
    # Mid-block driveway crossings must not turn the whole footway into
    # carriageway. Witnesses here are public road centre lines, not driveways.
    hits = tree.query(face, predicate="intersects")
    if sum(face.intersection(witnesses[i]).length for i in hits) > min(
      1.75, 0.16 * face.length
    ):
      result.append(face)
  return united(result)


def compose():
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  assert tuple(source["bounds"]) == BOUNDS
  core = json.loads(CORE.read_bytes())
  park = Polygon(json.loads(PARK.read_bytes())["boundary"])
  # Keep the exact previously drawn water shoreline, including the sculpture basin.
  water = united([p for _, p in resident_rings(core["water"])])
  underground_stairs = []
  for vintage in (261, 281):
    stairs = json.loads(
      (OUTPUT.parent / f"ubahnEntrancesV{vintage}.json").read_bytes()
    )["stairs"]
    for stair in stairs:
      opening = LineString([stair["top"], stair["bottom"]]).buffer(
        stair["width"] / 2, cap_style="flat"
      )
      if DOMAIN.intersects(opening):
        underground_stairs.append(opening)
  canvas = shapely.difference(
    DOMAIN, united([park, water, *underground_stairs]), grid_size=0.02
  )
  layers = defaultdict(list)
  for owner, p in resident_rings(core["parks"]):
    layers[5, "planting" if owner["kind"] == "garden" else "lawn"].append(p)
  buildings, parcels, cadastral_edges, street_centres = [], [], [], []
  for f in source["features"]:
    owner, tags, geom = f["id"], f["properties"], shape(f["geometry"])
    if owner.startswith("alkis:"):
      if tags.get("kind") == "Fahrbahnbegrenzungslinie":
        cadastral_edges.append(geom)
      elif tags["class"] == "AX_Strassenverkehr":
        parcels.append(geom)
      else:
        # Site paths have their own exact footprint in the current
        # cadastre, independent of buffered OSM centreline estimates.
        layers[63, "pavers"].append(geom)
      continue
    if (
      owner.startswith("osm:")
      and tags.get("highway") in ("residential", "tertiary", "secondary")
      and tags.get("bridge", "no") == "no"
    ):
      street_centres.append(geom)
    if "building" in tags:
      buildings.append(geom)
      continue
    if owner.startswith("truedop:"):
      value = (98, OSM_SURFACE[tags["surface"]], geom)
    elif owner.startswith("osm:"):
      value = classify_osm(tags, geom)
    else:
      value = classify_survey(owner.split(".")[0], tags, geom)
    if value:
      priority, style, p = value
      if style != "water":
        layers[priority, style].append(p)
  public_streets = united(parcels)
  layers[25, "pavers"].append(public_streets)
  layers[35, "asphalt"].append(
    cadastral_road_faces(public_streets, cadastral_edges, street_centres)
  )
  kerblines = shapely.intersection(shapely.union_all(cadastral_edges), public_streets)
  layers[64, "kerb"].append(kerblines.buffer(0.075, cap_style="flat", quad_segs=3))
  layers[0, "urban"].append(DOMAIN)
  building_union = united(buildings)
  available = canvas
  by_style = defaultdict(list)
  for (priority, style), geoms in sorted(layers.items(), reverse=True):
    owner = united(geoms)
    if priority in (28, 29):
      # Only ground-level mapped paths outside actual footprints. A facade
      # does not grow an extra stripe from an estimated walkway radius.
      owner = united([shapely.difference(owner, building_union, grid_size=0.02)])
    covered = shapely.intersection(available, owner, grid_size=0.02)
    by_style[style].extend(polygons(covered))
    available = united([shapely.difference(available, owner, grid_size=0.02)])
  assert available.area < 0.1
  return canvas, {k: united(v) for k, v in by_style.items()}


def encode(data):
  values = np.asarray(data, dtype="<u2")
  deltas = values.copy()
  deltas[1:] -= values[:-1]
  # Keep each 16-bit channel and its two byte planes together for compression.
  words = np.ascontiguousarray(deltas.T).ravel().view(np.uint8)
  planes = words.reshape((-1, 2)).T.tobytes()
  return base64.b64encode(gzip.compress(planes, compresslevel=9, mtime=0)).decode()


def build(output=OUTPUT):
  canvas, owners = compose()
  groups = []
  total_area = 0
  for style in STYLES:
    geom = owners.get(style, EMPTY)
    if geom.is_empty:
      continue
    # Bound triangle spans to one measured terrain interval. Splitting both
    # sides on the same lattice keeps the pavement, kerb and grass welded.
    # Height samples sit at x,z = 8 mod 16 in the resident terrain.
    fragments = list(polygons(geom))
    tree = shapely.STRtree(fragments)
    points, lookup, faces = [], {}, []
    for x in range((BOUNDS[0] - 8) // 16 * 16 + 8, BOUNDS[2], 16):
      for z in range((BOUNDS[1] - 8) // 16 * 16 + 8, BOUNDS[3], 16):
        cell = box(x, z, x + 16, z + 16)
        for i in tree.query(cell):
          piece = shapely.intersection(fragments[i], cell, grid_size=0.02)
          for p in polygons(piece):
            for tri in shapely.constrained_delaunay_triangles(p).geoms:
              corners = list(
                shapely.orient_polygons(tri, exterior_cw=True).exterior.coords
              )[:3]
              for px, pz in corners:
                pt = (round((px - BOUNDS[0]) * 50), round((pz - BOUNDS[1]) * 50))
                if pt not in lookup:
                  lookup[pt] = len(points)
                  points.append(pt)
                faces.append(lookup[pt])
    assert len(points) < 65536 and all(0 <= i <= 65535 for p in points for i in p)
    total_area += geom.area
    groups.append(
      {
        "material": style,
        "vertices": len(points),
        "indexCount": len(faces),
        "xz": encode(points),
        "indices": encode(faces),
      }
    )
  assert (
    abs(total_area - canvas.area) < 8
  )  # 2 cm edge quantisation across independent owners.
  out = {"bounds": BOUNDS, "unitsPerMetre": 50, "groups": groups}
  output.write_text(json.dumps(out, separators=(",", ":")) + "\n")
  print(
    f"{total_area:,.1f} m², {len(groups)} materials, {output.stat().st_size:,} bytes"
  )


if __name__ == "__main__":
  build()
