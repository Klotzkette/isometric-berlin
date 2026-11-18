"""Build the photo-checked Lustgarten courts, Schloßplatz markings and café paths."""

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
MESH = ROOT / "src/app/public/mesh/regierungsviertel"


def records(geom, kind):
  if geom.is_empty:
    return []
  if geom.geom_type == kind:
    return [geom]
  return [g for part in getattr(geom, "geoms", []) for g in records(part, kind)]


def write(name, payload):
  (DATA / name).write_text(json.dumps(payload, separators=(",", ":")) + "\n")


def digest(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def encode_faces(geom):
  points, index, faces = [], {}, []
  for poly in records(geom, "Polygon"):
    for tri in shapely.constrained_delaunay_triangles(poly).geoms:
      ids = []
      for x, z in list(tri.exterior.coords)[:3]:
        point = (round(x * 100), round(z * 100))
        if point not in index:
          index[point] = len(points)
          points.append(point)
        ids.append(index[point])
      if len(set(ids)) == 3:
        faces.extend(ids)
  return dict(points=points, indices=faces)


def native_rectangles(shape, cell, excluded=None):
  """Independent cardinal samples. Merge identical consecutive spans in z."""
  x0, z0, x1, z1 = shape.bounds
  xs = np.arange(math.floor(x0 / cell), math.ceil(x1 / cell))
  zs = np.arange(math.floor(z0 / cell), math.ceil(z1 / cell))
  mask = shapely.contains_xy(
    shape, (xs[None, :] + 0.5) * cell, (zs[:, None] + 0.5) * cell
  )
  if excluded is not None:
    # Whole cells stay off source lawns, water or buildings at their edges.
    occupied = shapely.intersects(
      excluded,
      shapely.box(
        xs[None, :] * cell,
        zs[:, None] * cell,
        (xs[None, :] + 1) * cell,
        (zs[:, None] + 1) * cell,
      ),
    )
    mask &= ~occupied
  active, result = {}, []
  for z, row in zip(zs.tolist(), mask, strict=True):
    edges = np.diff(np.r_[0, row.astype(np.int8), 0])
    spans = [
      (int(xs[i]), int(j - i))
      for i, j in zip(
        np.flatnonzero(edges == 1), np.flatnonzero(edges == -1), strict=True
      )
    ]
    for key in set(active) - set(spans):
      x, w = key
      result.append([x, active.pop(key), w, z])
    for span in spans:
      active.setdefault(span, z)
  for (x, w), start in active.items():
    result.append([x, start, w, int(zs[-1]) + 1])
  return [[x, start, w, end - start] for x, start, w, end in result]


def build():
  reference = GEO / "mitte-garden-routes-v362-source.json.gz"
  source = json.loads(gzip.decompress(reference.read_bytes()))
  ways = source["osm"]["ways"]

  def way(way_id):
    return Polygon(ways[str(way_id)]["geometry"])

  garden = json.loads((DATA / "cafeNeuerSeeV164Source.json").read_text())
  core = json.loads((MESH / "surface-polygons.json").read_text())
  roads = json.loads((DATA / "schlossEastStreets.json").read_text())
  blocks = json.loads((DATA / "schlossEastBlockStreets.json").read_text())
  counts = {}

  # Seven individual lawn panels have the same visible corners and roundouts
  # in the orthophoto. Also protect the coarser surviving legacy lawn outlines.
  lawns = unary_union([way(i) for i in range(437501695, 437501702)])
  park = way(16000014)

  def old_shape(p):
    return Polygon(np.asarray(p["ring"]) / 10, [np.asarray(h) / 10 for h in p["holes"]])

  old_lawns = [
    old_shape(p)
    for p in core["parks"]
    if p.get("kind") == "lawn"
    and 350 < p["area_m2"] < 1500
    and all(1780 < x / 10 < 2010 and -20 < z / 10 < 160 for x, z in p["ring"])
  ]
  assert len(old_lawns) == 7
  fountain = way(276658430)
  bowl = Point(1880.092031, 19.330824).buffer(4.8)
  protected = unary_union([lawns, *old_lawns, fountain.buffer(0.45), bowl])
  corners = source["innerLustgartenPavementPixelBoundary"]
  area = Polygon([(1780 + x / 4, -20 + z / 4) for x, z in corners]).intersection(park)
  pavement = area.difference(protected)
  assert pavement.intersection(protected).area < 1e-6
  counts["lustgarten"] = {
    "pavedM2": round(pavement.area, 2),
    "protectedMappedLawns": len(old_lawns),
  }

  # The proof window around the two paint owners lies on asphalt in the DOP.
  # Never draw a fake end line at the western cutoff of the longer owner.
  restricted, paint = [], []
  for m in source["roadMarkings"]:
    original = way(m["osmWay"])
    crop = box(m["minimumWorldX"], 0, 2100, 250)
    restricted.append(original.intersection(crop))
    edge = original.difference(original.buffer(-m["edgeWidthEstimateM"]))
    bars = [
      LineString(line).buffer(m["stripeWidthEstimateM"] / 2, cap_style="flat")
      for line in m["photoStripeCentreLines"]
    ]
    paint.append(unary_union([edge, *bars]).intersection(original).intersection(crop))
  restricted = unary_union(restricted)
  paint = unary_union(paint)
  assert (
    len(records(restricted, "Polygon")) == 2
    and paint.difference(restricted).area < 1e-6
  )
  road_only = restricted.buffer(1.5)
  cuts = []
  for i, row in enumerate(roads["curbs_m"]):
    line = LineString(row)
    if not line.intersects(restricted.buffer(0.12)):
      continue
    remain = sorted(
      records(line.difference(road_only), "LineString"),
      key=lambda g: line.project(Point(g.coords[0])),
    )
    assert (
      abs(
        line.length
        - sum(v.length for v in remain)
        - line.intersection(road_only).length
      )
      < 1e-4
    )
    cuts.append(
      dict(
        index=i,
        original=row,
        outside=[
          [[round(x, 3), round(z, 3)] for x, z in item.coords] for item in remain
        ],
      )
    )

  native_cuts = []
  walks = []
  for i, row in enumerate(blocks["runs"]):
    x, z, length, kind = row
    if box(x, z, x + length, z + 1).intersects(area) and kind in (1, 2):
      walks.append(box(x, z, x + length, z + 1))
    if kind != 2 or not box(x, z, x + length, z + 1).intersects(restricted):
      continue
    out = []
    for col in range(x, x + length):
      cell = box(col, z, col + 1, z + 1)
      new_kind = (
        0 if cell.intersection(restricted).area > 0 and road_only.covers(cell) else kind
      )
      if out and out[-1][3] == new_kind:
        out[-1][2] += 1
      else:
        out.append([col, z, 1, new_kind])
    if out != [row]:
      native_cuts.append(dict(index=i, original=row, outside=out))
  old_walk = unary_union(walks)
  assert len(cuts) == 3 and native_cuts
  counts["schlossplatz"] = dict(
    asphaltM2=round(restricted.area, 2),
    paintM2=round(paint.area, 2),
    observedBars=sum(len(m["photoStripeCentreLines"]) for m in source["roadMarkings"]),
    formerCurbLines=len(cuts),
    loweredNativeCells=sum(
      run[2] for c in native_cuts for run in c["outside"] if run[3] == 0
    ),
  )

  # Drawn removes complete four-metre asphalt cells and replaces them with
  # surveyed non-cardinal roads. The outer fragments of those cells have no
  # remaining ground. Use the continuous paved verge in the checked photograph;
  # the underlying fragment is also restored up to the original cell boundary.
  photo = source["sources"]["streetEdges"]["map"]
  x0, z0, x1, _ = photo["world"]
  m_per_pixel = (x1 - x0) / photo["size"][0]
  corridor = unary_union(
    [
      Polygon([(x0 + x * m_per_pixel, z0 + z * m_per_pixel) for x, z in ring])
      for ring in source["roadEdgeCheckPixels"]
    ]
  )
  asphalt = next(s for s in roads["surfaces"] if s["kind"] == "asphalt")
  points = (
    np.frombuffer(base64.b64decode(asphalt["positions_cm_b64"]), "<i4").reshape(-1, 2)
    / 100
  )
  triangles = np.frombuffer(base64.b64decode(asphalt["indices_b64"]), "<u4").reshape(
    -1, 3
  )
  asphalt = unary_union(
    [Polygon(p) for p in points[triangles] if corridor.intersects(Polygon(p))]
  ).intersection(corridor)
  ground = json.loads((MESH / "ground-context.json").read_text())
  cell = ground["cell_m"]
  grid = ground["grid"]
  original_cells = []
  for dz, row in enumerate(ground["ground_rows"]):
    z = (grid["min_z_idx"] + dz) * cell
    if z + cell < corridor.bounds[1] or z > corridor.bounds[3]:
      continue
    for dx, length, material in row:
      if ground["classes"][material] != "asphalt":
        continue
      x = (grid["min_x_idx"] + dx) * cell
      run = box(x, z, x + length * cell, z + cell)
      if run.intersects(corridor):
        original_cells.append(run)
  # The garden-side edges and the Dom pavement are paved for at least three
  # metres in the inspected photo. Keep the approach to the bridge out of scope.
  median = LineString(
    [
      (x0 + x * m_per_pixel, z0 + z * m_per_pixel)
      for x, z in source["roadEdgeKeepClearMedianPixels"]
    ]
  ).buffer(5.0)
  local_edges = asphalt.boundary.difference(corridor.boundary.buffer(0.02))
  verge_zone = (
    local_edges.buffer(3.2, cap_style="flat").intersection(corridor).difference(median)
  )
  raster_gaps = unary_union(original_cells).intersection(verge_zone).difference(asphalt)
  # Tuck the lower verge under the 18 cm raised asphalt lip. Coplanar
  # outlines alone would still expose the background at an oblique angle.
  verge = verge_zone.difference(asphalt.buffer(-0.65)).difference(protected)
  assert verge.covers(Point(1920.91, -16.807)) and verge.covers(Point(1930.131, -1.619))
  assert raster_gaps.difference(verge).area < 0.01
  counts["roadEdges"] = dict(
    photoVerifiedVergeM2=round(verge.area, 2),
    omittedAsphaltFragmentsM2=round(raster_gaps.area, 2),
  )
  results = []
  for name, drawn, native, cell, dy, ny, excluded in [
    ("pavedVerge", verge, Polygon(), 0.5, 0.065, 0, None),
    ("paving", pavement, pavement.difference(old_walk), 0.5, 0.114, 0.10, protected),
    (
      "raisedPaving",
      Polygon(),
      pavement.intersection(old_walk),
      0.5,
      0.114,
      0.327,
      protected,
    ),
    ("asphalt", restricted, restricted, 0.25, 0.244, 0.185, None),
    ("paint", paint, paint, 0.125, 0.249, 0.192, None),
  ]:
    native_data = [] if native.is_empty else native_rectangles(native, cell, excluded)
    results.append(
      dict(
        name=name,
        **encode_faces(drawn),
        runs=native_data,
        cell=cell,
        drawnLift=dy,
        nativeLift=ny,
      )
    )
  write(
    "mitteGardenRoutesV362.json",
    dict(surfaces=results, drawnCurbCuts=cuts, nativeCurbCuts=native_cuts),
  )

  # The Café already reserves these corridors while authoring its garden floor.
  # Only display the three confirmed compacted approaches on that floor datum.
  garden_ring = Polygon(
    next(f["world_xz_m"] for f in garden["features"] if f["id"] == "118616321")
  )
  water = old_shape(garden["water"])
  structures = unary_union([Polygon(p["ring"], p["holes"]) for p in garden["parts"]])
  other_floors = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in garden["gardenFloorPolygons"]]
  )
  protected = unary_union([water, structures, other_floors])
  lines = []
  for p in garden["protectedPaths"]:
    evidence = ways[p["osmWay"]]
    assert (
      evidence["tags"]["surface"] == "compacted" and p["line"] == evidence["geometry"]
    )
    strip = (
      LineString(p["line"])
      .buffer(p["widthM"] / 2)
      .intersection(garden_ring)
      .difference(protected)
    )
    assert strip.area > 0.5
    lines.append(strip)
  walks = unary_union(lines)
  assert walks.intersection(protected).area < 1e-6
  grid = 0.5
  # The 1-m native floor was previously centre-sampled. Keep all its rectangles.
  prior_native = unary_union(
    [
      box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
      for x, _, z, w, _, d, _ in garden["gardenNativeRuns"]
    ]
  )
  nw = walks.difference(prior_native)
  runs = native_rectangles(nw, grid, unary_union([water, structures]))
  write("cafeGardenRoutesV362.json", dict(**encode_faces(walks), runs=runs, cell=grid))
  counts["cafe"] = dict(
    mappedPathIds=[p["osmWay"] for p in garden["protectedPaths"]],
    confirmedCompactedM2=round(walks.area, 2),
    independentNativeM2=sum(w * h * grid**2 for _, _, w, h in runs),
  )
  inputs = [
    reference,
    DATA / "schlossEastStreets.json",
    DATA / "schlossEastBlockStreets.json",
    DATA / "cafeNeuerSeeV164Source.json",
    MESH / "surface-polygons.json",
    MESH / "ground-context.json",
  ]
  result = {"counts": counts, "inputsSha256": {p.name: digest(p) for p in inputs}}
  (GEO / "mitte-garden-routes-v362-receipt.json").write_text(
    json.dumps(result, indent=2) + "\n"
  )
  print(json.dumps(counts))


if __name__ == "__main__":
  build()
