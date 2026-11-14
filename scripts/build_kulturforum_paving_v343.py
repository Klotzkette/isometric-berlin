"""Add bounded Philharmonie-West paving joints to existing source surfaces.

No pavement blanket is generated. Each groove is carried by one exact existing
triangle, so its height follows that triangle instead of a second terrain fit.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import rotate
from shapely.geometry import LineString, Polygon, box, mapping

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
FOCUS = box(-280, 954, -175, 1085)
WIDTH = 0.014  # Visual joint-width fit; supplied slab formats are measured.
ANGLE = 18.0  # Orientation from official DOP2025, not a paving survey.
ORIGIN = (-220.0, 980.0)
INPUTS = [
  DATA / "restoredRoadSurfaces.ndjson.txt",
  DATA / "districtStreets.json",
  ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json",
  ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json",
]


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def triangles():
  source = json.loads(INPUTS[1].read_text())
  for row in source["surfaces"]:
    if row["kind"] not in ("paving", "asphalt"):
      continue
    p = np.frombuffer(base64.b64decode(row["positions_cm_b64"]), "<i4").reshape(-1, 2) / 100
    ii = np.frombuffer(base64.b64decode(row["indices_b64"]), "<u4").reshape(-1, 3)
    for ordinal, tri in enumerate(p[ii]):
      if FOCUS.intersects(Polygon(tri)):
        yield f"district-{row['kind']}", row["kind"], ordinal, tri.tolist()
  for line in INPUTS[0].open():
    row = json.loads(line)
    if row.get("kind") not in ("paving", "asphalt"):
      continue
    p = np.frombuffer(base64.b64decode(row["xz"]), "<f4").reshape(-1, 2)
    if p[:, 0].min() > -175 or p[:, 0].max() < -280 or p[:, 1].min() > 1085 or p[:, 1].max() < 954:
      continue
    ii = np.frombuffer(base64.b64decode(row["indices"]), "<u4").reshape(-1, 3)
    for ordinal, tri in enumerate(p[ii]):
      if FOCUS.intersects(Polygon(tri)):
        yield row["id"], row["kind"], ordinal, tri.astype(float).tolist()


def lines(geom):
  if isinstance(geom, LineString):
    return [geom] if geom.length > 0.035 else []
  return [line for child in getattr(geom, "geoms", []) for line in lines(child)]


def grid(area, angle):
  local = rotate(area, -angle, origin=ORIGIN)
  x0, z0, x1, z1 = local.bounds
  out = []
  # Full 75 x 35 cm rectangles in staggered rows. 35 cm squares and edge mitres
  # are documented supplier formats, but their local distribution is unknown.
  for row in range(math.floor((z0 - ORIGIN[1]) / .35), math.ceil((z1 - ORIGIN[1]) / .35) + 1):
    z = ORIGIN[1] + row * .35
    out.append(LineString([(x0 - 1, z), (x1 + 1, z)]))
    for col in range(math.floor((x0 - ORIGIN[0]) / .75) - 1, math.ceil((x1 - ORIGIN[0]) / .75) + 1):
      x = ORIGIN[0] + col * .75 + (row % 2) * .375
      out.append(LineString([(x, z), (x, z + .35)]))
  return shapely.union_all([rotate(line, angle, origin=ORIGIN) for line in out])


def build():
  before = {str(p.relative_to(ROOT)): sha(p) for p in INPUTS}
  rows = list(triangles())
  roads = shapely.union_all([Polygon(t) for _, kind, _, t in rows if kind == "asphalt"])
  solids = []
  for row in json.loads(INPUTS[2].read_text())["buildings"]:
    poly = Polygon(np.asarray(row["ring"]) / 10, [np.asarray(h) / 10 for h in row.get("holes", [])])
    if FOCUS.intersects(poly):
      solids.append(shapely.make_valid(poly))
  # Full authored T4 field and Serra context, beyond their visible steel/glass.
  memorials = shapely.union_all([box(-198.4, 897.2, -132.4, 948.2), box(-211, 918, -190, 946)])
  excluded = shapely.union_all([roads.buffer(.12), memorials.buffer(.5), *solids])
  selected = []
  for owner, kind, ordinal, tri in rows:
    if kind != "paving":
      continue
    part = Polygon(tri).intersection(FOCUS).difference(excluded)
    if part.area > .01:
      selected.append((owner, ordinal, tri, part))
  paving = shapely.union_all([p for *_, p in selected])
  supports, segments, receipts = [], [], []
  drawn_grid = grid(paving, ANGLE)
  for owner, ordinal, tri, area in selected:
    support = len(supports)
    # Inset half-width ensures each complete strip remains on its own surface.
    seams = lines(drawn_grid.intersection(area.buffer(-WIDTH - .008)))
    if not seams:
      continue
    supports.append([round(v, 7) for p in tri for v in p])
    receipts.append({"owner": owner, "triangle": ordinal, "support": support})
    for line in seams:
      coords = list(line.coords)
      for a, b in zip(coords, coords[1:]):
        if math.dist(a, b) > .035:
          segments.append([*[round(v, 4) for v in a + b], support])
  # Cardinal native model is authored independently, with the same real slab
  # formats; it never reuses rotated smooth strips or covers a complete tile.
  native, native_supports = [], []
  native_grid = grid(paving, 0)
  ground = json.loads(INPUTS[3].read_text())
  cell, origin = ground['cell_m'], ground['grid']
  brick = ground['classes'].index('plazaBrick')
  for zi, row in enumerate(ground['ground_rows']):
    z = (origin['min_z_idx'] + zi) * cell
    if z + cell < FOCUS.bounds[1] or z > FOCUS.bounds[3]:
      continue
    for xi, run, kind in row:
      if kind != brick:
        continue
      x = (origin['min_x_idx'] + xi) * cell
      slab = box(x,z,x + run*cell,z+cell)
      if not slab.intersects(paving):
        continue
      support = len(native_supports)
      seams = lines(native_grid.intersection(paving.intersection(slab).buffer(-WIDTH - .008)))
      if not seams:
        continue
      native_supports.append([x,z,x+run*cell,z+cell])
      for line in seams:
        a, b = list(line.coords)[0], list(line.coords)[-1]
        if abs(a[0] - b[0]) > 1e-5 and abs(a[1] - b[1]) > 1e-5:
          raise ValueError("Native paving must be cardinal")
        native.append([*[round(v, 4) for v in a + b], support])
  def packed(rows):
    # Centimetre coordinates fit signed 16-bit local offsets; avoid a large
    # parsed JS array and keep the measured tile module below a third MB.
    result = np.asarray(rows).copy()
    result[:, :4:2] -= ORIGIN[0]
    result[:, 1:4:2] -= ORIGIN[1]
    result[:, :4] = np.rint(result[:, :4] * 100)
    assert np.abs(result).max() < 32767
    return base64.b64encode(result.astype('<i2').tobytes()).decode()
  data = dict(schemaVersion=1, scope=[-280,954,-175,1085], jointWidthM=WIDTH,
              pavingLiftM=.1, separationM=.007, slabM=[.75,.35], origin=ORIGIN,
              supports=base64.b64encode(np.asarray(supports,dtype='<f4').tobytes()).decode(),
              segments=packed(segments), native=packed(native), nativeSupports=native_supports,
              counts=dict(supports=len(supports),drawn=len(segments),native=len(native)))
  encoded = (json.dumps(data,separators=(",", ":")) + "\n").encode()
  (DATA / "kulturforumPavingV343.json").write_bytes(encoded)
  evidence = dict(schemaVersion=1, baseline="cceedb466463c5ba2f3eb37a81b01513740544b1",
    sources=before, retainedSourceTriangles=receipts,
    pavingAreaM2=round(paving.area,6), scopeWorldM=[-280,954,-175,1085],
    exclusions=mapping(excluded.intersection(FOCUS)), paving=mapping(paving),
    drawnSegments=len(segments), nativeSegments=len(native), payloadBytes=len(encoded),
    replacementPolicy="No old surface retired, no new surface or collision blanket; only narrow inlaid joint accents on proved existing paving.",
    dimensions="75 by 35 cm and 35 by 35 cm supplied slab formats are documented. Joint width, laying phase/angle and alternating bond are explicit visual estimates; no claim of individual surveyed slabs.",
    nativeSupportPolicy="Each native joint stays within one retained plazaBrick ground run. At runtime its exact XZ rectangle must match an actual ground instance; its rendered top is read from that matrix. An absent or altered run omits only its unsupported accents. No smooth terrain sampling or +0.10m hover.",
    references=[
      "https://www.godelmann.de/de/referenzen/kulturforum-am-scharounplatz",
      "https://gruen-berlin.de/pressemitteilung/freianlagen-des-kulturforums-eroeffnet",
      "https://gruen-berlin.de/projekte/urbane-freiraeume/freiraum-kulturforum/daten-fakten",
      "https://www.berliner-philharmoniker.de/ihr-besuch/anfahrt/",
      "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr"],
    sourceDate="2026-11-14", imageryPolicy="Reference only; no image bytes in source or viewer.",
    oldSurveyConflict="Straßenbefahrung2014 predates 2019 narrowing/forecourt redesign and is not applied as present paving geometry.")
  (GEO / "kulturforum-paving-v343-evidence.json.gz").write_bytes(gzip.compress((json.dumps(evidence,separators=(",", ":"))+"\n").encode(),mtime=0))
  assert before == {str(p.relative_to(ROOT)): sha(p) for p in INPUTS}
  print(json.dumps({k:evidence[k] for k in ["pavingAreaM2","drawnSegments","nativeSegments","payloadBytes"]}))


if __name__ == "__main__":
  build()
