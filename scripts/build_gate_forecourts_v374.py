"""Bake the two surveyed Brandenburg Gate forecourts and the retained district-road edges."""

import argparse
import base64
import gzip
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from build_exterior_street_margins_v373 import (
  MESH,
  dm_polygon,
  polygon_only,
  polygon_parts,
  world,
)
from shapely.geometry import LineString, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "geo_data/regierungsviertel/gate-forecourts-v374-survey.json.gz"
DATA = ROOT / "src/app/src/data"
OUTPUT = DATA / "gateForecourtsV374.json"
GARDENS = DATA / "gateGardenFurnitureV374.json"
# The rectangle limits work to both squares and their approach. Inside, only
# explicit area owners count; the unmeasured park and building yards stay out.
DOMAIN = box(292, 220, 560, 379)
LAYERS = (
  "cm_fahrbahn",
  "cl_gehweg",
  "ci_oeffentlicher_platz",
  "ch_radweg",
  "cf_trennstreifen",
  "ce_gruenflaeche",
  "by_gehwegueberfahrt",
  "bd_bordstein",
  "bn_baumscheibe",
  "bv_springbrunnen_zierbrunnen",
  "bm_zugangsbauwerk",
  "cc_treppe",
)
SOURCE = "https://gdi.berlin.de/services/wfs/strassenbefahrung"
ORTHO = (
  "https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&VERSION=1.3.0"
  "&REQUEST=GetMap&LAYERS=truedop_2026&STYLES=&CRS=EPSG:25833"
  "&BBOX=389792,5819620,390060,5819780&WIDTH=1072&HEIGHT=640&FORMAT=image/png"
)
EXCLUDED = {"bv_springbrunnen_zierbrunnen", "bm_zugangsbauwerk", "cc_treppe"}
STYLES = (
  "asphalt",
  "footway",
  "stoneRoad",
  "mosaic",
  "median",
  "plaza",
  "cycle",
  "grass",
  "earth",
  "kerb",
  "flushKerb",
  "gardenStone",
  "flowerSoil",
)
MATERIAL = {
  "01": "footway",
  "02": "asphalt",
  "03": "mosaic",
  "04": "mosaic",
  "05": "mosaic",
  "06": "footway",
  "07": "footway",
  "08": "footway",
}


def capture(folder):
  features, queries = [], {}
  for layer in LAYERS:
    response = json.loads((folder / f"{layer}.json").read_text())
    assert response["numberMatched"] == len(response["features"])
    queries[layer] = [(folder / f"{layer}.url").read_text(), response["numberMatched"]]
    for f in response["features"]:
      geom = shape(f["geometry"])
      if world(geom).intersects(DOMAIN):
        props = f["properties"]
        features.append(
          [f["id"], props.get("material"), props.get("bor"), geom.wkb_hex]
        )
  source = {
    "crs": "EPSG:25833",
    "survey": "Straßenbefahrung Berlin 2014/15",
    "queries": queries,
    "orthophoto": ORTHO,
    "osm": ["way/38345682", "way/24240315", "way/13982277", "way/13982278"],
    "features": sorted(features),
  }
  ARCHIVE.parent.mkdir(exist_ok=True, parents=True)
  ARCHIVE.write_bytes(
    gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
  )


def read(path):
  return json.loads(path.read_bytes())


def merged(parts):
  return polygon_only(shapely.union_all(parts, grid_size=0.01))


def encode(values, dtype):
  return base64.b64encode(
    gzip.compress(np.asarray(values, dtype=dtype).tobytes(), mtime=0)
  ).decode()


def faces(poly):
  for part in polygon_parts(poly):
    for tri in shapely.constrained_delaunay_triangles(part).geoms:
      p = np.rint(np.array(tri.exterior.coords)[:3] * 100).astype(int)
      (a, b, c) = p.tolist()
      cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
      if cross:
        yield [a, b, c] if cross < 0 else [c, b, a]


def build():
  features = json.loads(gzip.decompress(ARCHIVE.read_bytes()))["features"]
  groups = defaultdict(list)
  kerbs = []
  blocked = []
  beds = []
  for fid, mat, bor, wkb in features:
    layer = fid.split(".")[0]
    g = shapely.set_precision(
      shapely.make_valid(world(shapely.from_wkb(wkb))).intersection(DOMAIN), 0.01
    )
    if layer in EXCLUDED:
      blocked.append(g)
      continue
    if layer == "bd_bordstein":
      # BOR=1 is the raised class; surveyed low/flush crossings retain a
      # narrow visible stone line without a raised transverse road barrier.
      kerbs.append((int(bor) == 1, g))
      continue
    if layer == "ce_gruenflaeche":
      if fid not in {"ce_gruenflaeche.21433", "ce_gruenflaeche.41614"}:
        continue
      style, priority = "grass", 1
      beds.append(g)
    elif layer == "bn_baumscheibe":
      style, priority = "earth", 0
    elif layer == "cf_trennstreifen":
      style, priority = (
        ("median" if fid == "cf_trennstreifen.18607" else MATERIAL.get(mat)),
        2,
      )
    elif layer == "cm_fahrbahn":
      style, priority = ("stoneRoad" if mat == "06" else MATERIAL.get(mat)), 6
    elif layer == "ci_oeffentlicher_platz":
      style, priority = ("plaza" if mat == "06" else MATERIAL.get(mat)), 3
    elif layer == "ch_radweg":
      style, priority = ("cycle" if mat == "04" else MATERIAL.get(mat)), 3
    else:
      style, priority = MATERIAL.get(mat), 4
    if style is not None:
      groups[priority, style].append(g)
  for rec in read(MESH / "lod2-prisms.json")["buildings"]:
    b = rec["ring"]
    if (
      b
      and max(x for x, z in b) >= 2920
      and min(x for x, z in b) <= 5600
      and max(z for x, z in b) >= 2200
      and min(z for x, z in b) <= 3790
    ):
      blocked.append(dm_polygon(rec))
  claimed = merged(blocked)
  styles = {}
  for (_, style), geoms in sorted(groups.items()):
    region = polygon_only(merged(geoms).difference(claimed, grid_size=0.01))
    if region.is_empty:
      continue
    styles[style] = merged([region, styles.get(style, Polygon())])
    claimed = merged([claimed, region])
  footprint = merged(list(styles.values()))
  # Each source alignment must touch a measured surface. The 16 cm head is
  # a display width. Stop on all non-surface owners, including pavilion walls.
  for raised, kind in [(True, "kerb"), (False, "flushKerb")]:
    strips = [
      g.buffer(0.08, cap_style="flat", join_style="round", quad_segs=2)
      for is_raised, g in kerbs
      if is_raised == raised
    ]
    styles[kind] = polygon_only(merged(strips).intersection(footprint, grid_size=0.01))
  # The historical summer planting strips follow the municipal outer boundary.
  # Retain the source fountain holes. Widths are presentation dimensions.
  garden_shells = [Polygon(p.exterior) for g in beds for p in polygon_parts(g)]
  styles["gardenStone"] = merged([p.difference(p.buffer(-0.22)) for p in garden_shells])
  styles["flowerSoil"] = merged(
    [p.buffer(-0.22).difference(p.buffer(-0.94)) for p in garden_shells]
  )
  # Insert DGM break lines at eight metre intervals so each face follows
  # local relief even on the long continuous stone and grass fields.
  vertexMap = {}
  verts = []
  indices = []
  areas = {}
  for style, region in styles.items():
    areas[style] = round(region.area, 2)
    material = STYLES.index(style)
    for x in range(288, 560, 8):
      for z in range(216, 384, 8):
        cell = box(x, z, x + 8, z + 8)
        if not region.intersects(cell):
          continue
        for tri in faces(region.intersection(cell, grid_size=0.01)):
          for xx, zz in tri:
            key = (xx, zz, material)
            if key not in vertexMap:
              vertexMap[key] = len(verts)
              verts.append([xx - 29200, zz - 22000, material])
            indices.append(vertexMap[key])
  # Downstands use each unsplit surveyed kerb perimeter. Adjacent DGM cut
  # cells share top indices, so there is no wall along an artificial grid seam.
  # Each long straight segment is subdivided for the same terrain-height rule.
  for kind in ("kerb", "flushKerb"):
    for part in polygon_parts(styles[kind]):
      for ring in [part.exterior, *part.interiors]:
        coords = list(shapely.segmentize(ring, 3).coords)
        for a, b in zip(coords, coords[1:]):
          corners = []
          for q, level in [
            (a, STYLES.index(kind)),
            (a, len(STYLES)),
            (b, STYLES.index(kind)),
            (b, len(STYLES)),
          ]:
            xx, zz = [round(k * 100) for k in q]
            key = (xx, zz, level)
            if key not in vertexMap:
              vertexMap[key] = len(verts)
              verts.append([xx - 29200, zz - 22000, level])
            corners.append(vertexMap[key])
          at, ab, bt, bb = corners
          indices.extend([at, ab, bt, bt, ab, bb])
  assert max(indices) < 65535
  # District asphalt/sidewalk/grass surfaces and inferred kerbs predate this
  # municipal mosaic. Keep crossing faces outside it without changing their
  # original grade, using the original triangle index for barycentric heights.
  old = read(DATA / "districtStreets.json")
  replacements = {}
  for source in old["surfaces"]:
    coords = (
      np.frombuffer(base64.b64decode(source["positions_cm_b64"]), "<i4").reshape(-1, 2)
      / 100
    )
    idx = np.frombuffer(base64.b64decode(source["indices_b64"]), "<u4").reshape(-1, 3)
    pts = coords[idx]
    hits = (
      (pts[:, :, 0].max(axis=1) >= 292)
      & (pts[:, :, 0].min(axis=1) <= 560)
      & (pts[:, :, 1].max(axis=1) >= 220)
      & (pts[:, :, 1].min(axis=1) <= 379)
    )
    removed = []
    fragments = []
    for i in np.flatnonzero(hits):
      tri = Polygon(pts[i])
      overlap = tri.intersection(footprint)
      if overlap.area < 0.00005:
        continue
      removed.append(int(i))
      for t in faces(tri.difference(footprint)):
        fragments.append([*idx[i], *[q for pt in t for q in pt]])
    replacements[source["kind"]] = {
      "removed": encode(removed, "<u4"),
      "fragments": encode(fragments, "<i4"),
    }
  line_replacements = []
  for i, line in enumerate(old["curbs_m"]):
    g = LineString(line)
    if not g.intersects(footprint):
      continue
    diff = g.difference(footprint)
    parts = [diff] if diff.geom_type == "LineString" else list(diff.geoms)
    line_replacements.append(
      [
        i,
        [
          [[round(xx, 4), round(zz, 4)] for xx, zz in part.coords]
          for part in parts
          if part.geom_type == "LineString" and part.length > 0.01
        ],
      ]
    )
  # Existing source lane dashes retain their station and phase inside the
  # measured asphalt. Store only the portion that needs its new face height.
  lane_marks = []
  asphalt = styles["asphalt"]
  for i, mark in enumerate(old["markings_m"]):
    pts = np.array(mark["points"])
    lanes = round(mark.get("lanes") or 2)
    if lanes < 2 or not LineString(pts).intersects(asphalt):
      continue
    ds = np.diff(pts, axis=0)
    ls = np.linalg.norm(ds, axis=1)
    directions = ds / np.where(ls > 0, ls, 1)[:, None]
    norms = np.stack([-directions[:, 1], directions[:, 0]], axis=1)
    for lane in range(1, lanes):
      offset = mark["width_m"] * (lane / lanes - 0.5)
      joined = np.vstack([[0, 0], norms]) + np.vstack([norms, [0, 0]])
      lengths = np.linalg.norm(joined, axis=1)
      joined /= np.where(lengths > 0, lengths, 1)[:, None]
      factors = np.maximum(0.5, np.sum(joined * np.vstack([norms, norms[-1]]), axis=1))
      points = pts + (offset / factors)[:, None] * joined
      carried = 0.0
      for a, b in zip(points, points[1:]):
        length = np.linalg.norm(b - a)
        if length < 0.01:
          continue
        at = -carried
        while at < length:
          start = max(0, at)
          end = min(length, at + 4)
          at += 10
          if end <= start:
            continue
          piece = LineString(
            [a + (b - a) * (start / length), a + (b - a) * (end / length)]
          ).intersection(asphalt)
          lines = (
            [piece] if piece.geom_type == "LineString" else getattr(piece, "geoms", [])
          )
          for line in lines:
            if line.geom_type != "LineString" or line.length < 0.01:
              continue
            xy = np.asarray(line.coords)
            lane_marks.append(
              [i, *np.rint(xy[[0, -1]].flatten() * 100).astype(int).tolist()]
            )
        carried = (carried + length) % 10
  ground = read(MESH / "ground-context.json")
  heights = ground["ground_height"]
  # Include the complete local bilinear support, plus one sample ring.
  cols = heights["cols"]
  grid = ground["grid"]
  ink = []
  classes = {
    (row, col): kind
    for row in range(220 // 4 - grid["min_z_idx"] - 1, 379 // 4 - grid["min_z_idx"] + 2)
    for start, n, kind in ground["ground_rows"][row]
    for col in range(
      max(start, 292 // 4 - grid["min_x_idx"] - 1),
      min(start + n, 560 // 4 - grid["min_x_idx"] + 2),
    )
  }
  for (row, col), kind in classes.items():
    x = (col + grid["min_x_idx"]) * 4
    z = (row + grid["min_z_idx"]) * 4
    for d, adj, line in [
      (0, (row, col + 1), [(x + 4, z), (x + 4, z + 4)]),
      (1, (row + 1, col), [(x, z + 4), (x + 4, z + 4)]),
    ]:
      if adj in classes and kind != classes[adj] and footprint.covers(LineString(line)):
        ink.append(2 * (row * grid["cols"] + col) + d)
  sample_m = ground["cell_m"] * heights["stride_cells"]
  gx = int((292 - grid["min_x_idx"] * ground["cell_m"]) / sample_m) - 2
  gz = int((220 - grid["min_z_idx"] * ground["cell_m"]) / sample_m) - 2
  nx = int(268 / sample_m) + 5
  nz = int(159 / sample_m) + 5
  guard = 2166136261
  for z in range(gz, gz + nz):
    for x in range(gx, gx + nx):
      guard = ((guard ^ heights["y_dm"][z * cols + x]) * 16777619) & 0xFFFFFFFF

  def point_y(p):
    x, z = p
    sx = (x / ground["cell_m"] - grid["min_x_idx"]) / heights["stride_cells"] - 0.5
    sz = (z / ground["cell_m"] - grid["min_z_idx"]) / heights["stride_cells"] - 0.5
    ix, iz = int(sx), int(sz)
    samples = np.asarray(heights["y_dm"][(iz * cols + ix) : (iz * cols + ix + 2)]) / 10
    nextrow = (
      np.asarray(heights["y_dm"][((iz + 1) * cols + ix) : ((iz + 1) * cols + ix + 2)])
      / 10
    )
    y = np.interp(sx - ix, [0, 1], samples) * (1 - (sz - iz)) + np.interp(
      sx - ix, [0, 1], nextrow
    ) * (sz - iz)
    return [round(x, 3), round(float(y), 3), round(z, 3)]

  layout = []
  for p in sorted(garden_shells, key=lambda g: -g.centroid.y):
    boundary = p.exterior
    flowers = p.buffer(-0.58).exterior
    layout.append(
      {
        "rail": [
          point_y(xy) for xy in shapely.segmentize(boundary.simplify(0.025), 5).coords
        ],
        "posts": [
          point_y(boundary.interpolate(n / 48, normalized=True).coords[0])
          for n in range(48)
        ],
        "flowers": [
          point_y(flowers.interpolate(n / 70, normalized=True).coords[0])
          for n in range(70)
        ],
      }
    )
  return {
    "styles": STYLES,
    "gardenLayout": layout,
    "rasterInk": sorted(ink),
    "laneMarks": lane_marks,
    "groundGuard": [gx, gz, nx, nz, guard],
    "vertices": encode(verts, "<u2"),
    "indices": encode(indices, "<u2"),
    "district": replacements,
    "kerbReplacements": line_replacements,
    "surveyAreaM2": round(footprint.area, 2),
    "areas": areas,
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", type=Path)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  if args.capture:
    capture(args.capture)
  data = build()
  flowers = json.dumps(data.pop("gardenLayout"), separators=(",", ":")) + "\n"
  if args.check:
    assert GARDENS.read_text() == flowers
  else:
    GARDENS.write_text(flowers)
  text = json.dumps(data, separators=(",", ":")) + "\n"
  if args.check:
    assert OUTPUT.read_text() == text
  else:
    OUTPUT.write_text(text)
  print(data["surveyAreaM2"], data["areas"], len(text))
