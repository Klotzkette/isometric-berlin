"""Bake the surveyed Simsonweg and its cadastral park branches at the Reichstag."""

import argparse
import base64
import gzip
import json
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely as sh
from build_exterior_street_margins_v373 import MESH, dm_polygon, polygon_only, world
from build_gate_forecourts_v374 import encode, faces, merged
from shapely.geometry import Polygon, box, shape
from simson_woods_v375 import load as read_wood_source
from simson_woods_v375 import retained_lawns, wood_cover

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
ARCHIVE = GEO / "simson-paths-v375-source.json.gz"
GEOMETRY = DATA / "simsonPathsV375.json"
CUTS = DATA / "simsonCutsV375.json"
MATERIALS = ["mosaic", "gravel", "soil", "sett", "lawn"]
# Complete survey faces through the fork at Scheidemannstraße and the
# southern fan. The previous square already owns some of their southern ends.
FOOTWAYS = {
  386377,
  386624,
  387003,
  387143,
  387683,
  387685,
  387687,
  387937,
  387944,
  402194,
  402272,
  663371,
  663450,
  671385,
  672681,
  672989,
}
# The land register provides the exterior, including the full branching
# width. OSM supplies the finish only where the municipal material stops.
CADASTRE = {
  "2LBy": None,
  "2NyU": ("885108459", "sett"),
  "2R3q": ("25777564", "sett"),
  "3bIa": ("328043767", "gravel"),
  "3bMv": ("341985592", "gravel"),
  "3bO0": ("328043767", "gravel"),
  "3bX3": ("40444500", "gravel"),
}
# Limit the westbound arm at its real fork with the northbound branch.
# The drawn and surrounding-city owners outside this local release continue.
DOMAIN = box(120, 107, 390, 297).union(box(163.95, 297, 180, 304))
ORTHO = (
  "https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&VERSION=1.3.0"
  "&REQUEST=GetMap&LAYERS=truedop_2026&STYLES=&CRS=EPSG:25833"
  "&BBOX=389620,5819678,389912,5819922&WIDTH=1168&HEIGHT=976&FORMAT=image/png"
)


def capture(path, captured):
  import pyogrio

  source = {
    "crs": "EPSG:25833",
    "truedop": ORTHO,
    "queries": {},
    "features": [],
    "osm": [],
  }
  for layer in (
    "cl_gehweg",
    "bn_baumscheibe",
    "bauwerkeflaechen",
    "tatsaechlichenutzungflaechen",
  ):
    response = json.loads((path / f"{layer}.json").read_bytes())
    assert response["numberMatched"] == len(response["features"])
    source["queries"][layer] = [
      (path / f"{layer}.url").read_text(),
      response["numberMatched"],
    ]
    for f in response["features"]:
      fid, props = f["id"], f["properties"]
      if layer == "cl_gehweg" and int(fid.split(".")[-1]) not in FOOTWAYS:
        continue
      if layer == "bauwerkeflaechen" and props["bezeich"] != "AX_WegPfadSteig":
        continue
      if (
        layer == "tatsaechlichenutzungflaechen" and props["uuid"] != "DEBE01AL1Wt0000E"
      ):
        continue
      source["features"].append(
        [fid, props.get("material"), shape(f["geometry"]).wkb_hex]
      )
  ids = {
    "8329726",
    "8329727",
    "591200197",
    "1189808194",
    "720167983",
    "582452971",
    *(entry[0] for entry in CADASTRE.values() if entry),
  }
  for layer in ("roads", "parks", "water"):
    frame = pyogrio.read_dataframe(
      GEO / "osm.gpkg", layer=layer, bbox=(389610, 5819680, 389915, 5819960)
    )
    for _, row in frame.iterrows():
      if row.id in ids:
        source["osm"].append(
          [
            row.id,
            row.get("surface") if layer == "roads" else None,
            row.geometry.wkb_hex,
          ]
        )
  assert {row[0] for row in source["osm"]} == ids
  observations = json.loads(captured.read_bytes())
  # Keep local baseline input only. Actual face indices, coordinates and
  # heights are required to preserve the original three.js triangulation.
  source["baseline"] = observations
  ARCHIVE.write_bytes(
    gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
  )


def gate_ownership():
  data = json.loads((DATA / "gateForecourtsV374.json").read_bytes())

  def words(key):
    return np.frombuffer(gzip.decompress(base64.b64decode(data[key])), "<u2")

  verts = words("vertices").reshape(-1, 3)
  xy = verts[:, :2].astype("float64") / 100 + [292, 220]
  ids = words("indices").reshape(-1, 3)
  ids = ids[(xy[ids, 0].min(axis=1) < 391) & (xy[ids, 1].min(axis=1) < 298)]
  polys = sh.polygons(xy[ids])
  return merged(polys[sh.area(polys) > 0.00001])


def surfaces(source):
  def fields(layer):
    return [
      (i.rsplit(".", 1)[1], m, world(sh.from_wkb(hex_)))
      for i, m, hex_ in source["features"]
      if i.startswith(layer + ".")
    ]

  walk = fields("cl_gehweg")
  cad = dict((i[-4:], g) for i, _, g in fields("bauwerkeflaechen"))
  osm = {i: (mat, world(sh.from_wkb(hex_))) for i, mat, hex_ in source["osm"]}
  plants = fields("bn_baumscheibe")
  protected = [osm[i][1] for i in ("8329726", "8329727", "591200197")]
  protected += [cad["3bTH"]]
  for b in json.loads((MESH / "lod2-prisms.json").read_bytes())["buildings"]:
    p = b["ring"]
    if (
      p
      and max(x for x, z in p) >= 1200
      and min(x for x, z in p) < 3900
      and max(z for x, z in p) > 1070
      and min(z for x, z in p) < 3040
    ):
      protected.append(dm_polygon(b))
  gate = gate_ownership()
  blocked = merged([*protected, gate])
  styles = {}
  claimed = blocked

  def assign(kind, geoms):
    nonlocal claimed
    piece = polygon_only(
      merged(geoms).intersection(DOMAIN).difference(claimed, grid_size=0.01)
    )
    if not piece.is_empty:
      styles[kind] = merged([piece, styles.get(kind, Polygon())])
      claimed = merged([claimed, piece])

  for mat, kind in [("04", "mosaic"), ("13", "gravel")]:
    assign(kind, [g for _, m, g in walk if m == mat])
  for key, entry in CADASTRE.items():
    if not entry:
      continue
    way, kind = entry
    assert osm[way][1].intersection(cad[key]).length > 20
    g = cad[key]
    if key == "3bMv":
      # End the correction at the real crossing of these two mapped axes.
      crossing = osm[way][1].intersection(osm["40444500"][1])
      if crossing.is_empty:
        raise ValueError("Mapped west junction missing")
      g = g.intersection(box(crossing.centroid.x, 107, 390, 297))
    if key == "3bX3":
      # This continuous cadastral area contains two real material courses.
      line = osm["582452971"][1]
      assert line.intersection(g).length > 30
      # A transverse section at the shared OSM node separates the courses.
      end = point_at_join(line, osm[way][1])
      coords = np.array(line.coords)
      if end.distance(sh.Point(coords[-1])) > end.distance(sh.Point(coords[0])):
        coords = coords[::-1]
      vector = coords[-1] - coords[-2]
      vector /= np.linalg.norm(vector)
      normal = np.array([-vector[1], vector[0]])
      c = np.array(end.coords[0])
      half = Polygon(
        [
          c + normal * 100,
          c - normal * 100,
          c - normal * 100 - vector * 120,
          c + normal * 100 - vector * 120,
        ]
      )
      assign("sett", [g.intersection(half)])
      g = g.difference(half)
    assign(kind, [g])
  # Old raster plaza cells can protrude a stair step beyond both the measured
  # walkway and the actual cadastral way. Restore only those proven excesses
  # in the documented park, keeping every other mapped path and enclosure.
  path = merged(list(styles.values()))
  candidate = merged([g for _, _, g in fields("tatsaechlichenutzungflaechen")])
  path_sources = merged([*(g for _, _, g in walk), *cad.values(), osm["1189808194"][1]])
  ground = json.loads((MESH / "ground-context.json").read_bytes())
  cells = []
  g = ground["grid"]
  for row in range(107 // 4 - g["min_z_idx"], 305 // 4 - g["min_z_idx"] + 1):
    z = (row + g["min_z_idx"]) * 4
    for start, n, k in ground["ground_rows"][row]:
      if ground["classes"][k] != "plazaBrick":
        continue
      x = (start + g["min_x_idx"]) * 4
      if x + 4 * n < 120 or x > 390:
        continue
      cells.append(box(x, z, x + 4 * n, z + 4))
  excess = (
    merged(cells)
    .intersection(path.buffer(4))
    .intersection(candidate)
    .difference(path_sources)
  )
  assign("lawn", [excess])
  wells = polygon_only(
    merged([g for _, _, g in plants if g.distance(path) < 0.03])
    .intersection(DOMAIN)
    .difference(blocked, grid_size=0.01)
  )
  styles = {
    k: polygon_only(g.difference(wells, grid_size=0.01)) for k, g in styles.items()
  }
  styles["soil"] = polygon_only(wells)
  return styles, blocked


def point_at_join(a, b):
  hit = a.intersection(b)
  if hit.geom_type != "Point":
    raise ValueError("Missing material change node")
  return hit


def bake(source):
  styles, _ = surfaces(source)
  cover = merged(list(styles.values()))
  verts = []
  idx = []
  lookup = {}
  for kind, g in styles.items():
    mat = MATERIALS.index(kind)
    for x in range(120, 392, 8):
      for z in range(104, 304, 8):
        cell = box(x, z, x + 8, z + 8)
        if not cell.intersects(g):
          continue
        for tri in faces(g.intersection(cell, grid_size=0.01)):
          for xx, zz in tri:
            key = (xx, zz, mat)
            if key not in lookup:
              lookup[key] = len(verts)
              verts.append([xx, zz, mat])
            idx.append(lookup[key])
  assert len(verts) < 65535
  geometry = {
    "styles": MATERIALS,
    "vertices": encode(verts, "<u2"),
    "indices": encode(idx, "<u2"),
    "areas": {k: round(p.area, 2) for k, p in styles.items()},
  }
  # All of these cuts must use the same original index space. Join the
  # measured walk and the positive woodland for the arriving park faces;
  # preserve the pre-existing paths inside the park by working on their
  # separate source surface and by respecting the prior city-wide lawn cut.
  woods = read_wood_source()
  woodland = wood_cover(woods, source, cover, gate_ownership())
  park_coverage = merged([cover, woodland])
  remainder, prior_retired = retained_lawns(park_coverage)
  receipts = {
    (group, name, face): (indices, coords)
    for group, name, face, indices, coords in source["baseline"]["tris"]
    if group != "rasterComplement"
  }
  for group, name, face, indices, coords in [*woods["tris"], *remainder]:
    if group == "rasterComplement" and max(coords[1::3]) < 3:
      continue
    receipts[group, name, face] = (indices, coords)
  batches = defaultdict(lambda: defaultdict(lambda: [[], []]))
  allow_degenerate = defaultdict(list)
  signatures = {}
  for (group, name, face), (orig, coords) in sorted(receipts.items()):
    if group == "district" and name != "District mapped paved walkways":
      continue
    p = np.asarray(coords).reshape(3, 3)[:, [0, 2]]
    tri = Polygon(p)
    cut = (
      park_coverage
      if group.startswith("parks-")
      else woodland
      if group == "rasterComplement"
      else cover
    )
    if tri.intersection(cut).area < 0.00005:
      continue
    batchid = (
      group.removeprefix("restored-")
      if group.startswith("restored-")
      else "woodRaster"
      if group == "rasterComplement"
      else "surface-" + group
      if group != "district"
      else group
    )
    if name == "smooth parkland lawns" and face in prior_retired.get(group, set()):
      allow_degenerate[batchid].append(face)
    records, fragments = batches[batchid][name]
    signature = signatures.get((batchid, name), 2166136261)
    # Raster complements from different legacy cuts can have the same tile
    # name. Attest to their actual projected Float32 vertices as well as IDs.
    for vertex, (xx, zz) in zip(orig, p):
      words = np.asarray([xx or 0, zz or 0], dtype="<f4").view("<u4")
      for word in [vertex, *words]:
        signature = ((signature ^ int(word)) * 16777619) & 0xFFFFFFFF
    signatures[batchid, name] = signature
    outside = list(faces(tri.difference(cut)))
    for t in outside:
      fragments.extend(
        np.ravel(t if not tri.exterior.is_ccw else list(reversed(t))).tolist()
      )
    records.extend([face, *orig, len(outside)])
  cuts = {
    k: {
      n: {
        "records": encode(rr, "<u4"),
        "fragments": encode(f, "<i4"),
        "xzGuard": signatures[k, n],
      }
      for n, (rr, f) in group.items()
    }
    for k, group in batches.items()
  }
  for key, ids in allow_degenerate.items():
    cuts[key]["smooth parkland lawns"]["preCut"] = sorted(ids)
  return geometry, cuts


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture", type=Path)
  parser.add_argument("--baseline", type=Path)
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  if args.capture:
    capture(args.capture, args.baseline)
  geometry, cuts = bake(json.loads(gzip.decompress(ARCHIVE.read_bytes())))
  for path, obj in [(GEOMETRY, geometry), (CUTS, cuts)]:
    text = json.dumps(obj, separators=(",", ":")) + "\n"
    if args.check:
      assert path.read_text() == text, str(path)
    else:
      path.write_text(text)
    print(path.name, len(text))
  print(geometry["areas"])
