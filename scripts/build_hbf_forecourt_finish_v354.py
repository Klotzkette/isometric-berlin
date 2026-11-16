"""Finite current-source paving mask; no terrain or navigation is generated."""

from __future__ import annotations

import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v354/hbf"
)
SOURCE = ROOT / "geo_data/regierungsviertel/hbf-forecourt-finish-v354-source.json.gz"
DATA = ROOT / "src/app/src/data/hbfForecourtFinishV354.json"
OWNERS = ["DEBE01YYK0003sLP", "DEBE01YYK0003sQ2", "DEBE01YYK0003sOJ"]


def wire(value):
  return json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode()


def control(value):
  def normalized(q):
    if isinstance(q, float) and q.is_integer():
      return int(q)
    if isinstance(q, list):
      return [normalized(v) for v in q]
    if isinstance(q, dict):
      return {k: normalized(v) for k, v in q.items()}
    return q

  result = 2166136261
  for c in wire(normalized(value)).decode():
    result = ((result ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return result


def polygon_rows(geometry):
  return [
    dict(
      ring=[list(p) for p in q.exterior.coords],
      holes=[[list(p) for p in h.coords] for h in q.interiors],
    )
    for q in shapely.get_parts(geometry)
    if isinstance(q, Polygon) and q.area > 0.001
  ]


def build():
  ground_path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  surfaces_path = ROOT / "src/app/public/mesh/regierungsviertel/surface-polygons.json"
  if SOURCE.exists():
    source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  else:
    official = json.loads((TASK / "alkis-use.geojson").read_bytes())
    vegetation = json.loads((TASK / "alkis-vegetation.geojson").read_bytes())
    current = json.loads((TASK / "current-area-map.geojson").read_bytes())
    selected = [f for f in official["features"] if f["properties"]["uuid"] in OWNERS]
    assert len(selected) == 3
    osm = [
      f
      for f in current["features"]
      if str(f["properties"].get("osm_id")) in ["10726692", "20783801"]
    ]
    assert len(osm) == 2
    # Current complete cadastral polygons, retained source map and all existing
    # local green surfaces stay in the receipt, including holes and exclusions.
    core = json.loads(surfaces_path.read_bytes())
    scope = box(-210, -960, -35, -410)
    green = []
    for p in core["parks"]:
      q = Polygon(np.asarray(p["ring"]) / 10, [np.asarray(h) / 10 for h in p["holes"]])
      if q.intersects(scope):
        green.append(p)
    source = {
      "schemaVersion": 1,
      "checked": "2026-11-16",
      "officialOwners": selected,
      "officialVegetation": vegetation["features"],
      "mappedPaving": osm,
      "retainedGreen": green,
      "references": [
        "https://gdi.berlin.de/services/wfs/alkis",
        "https://www.voessing.de/de/projekte/washingtonplatz-am-hauptbahnhof-berlin--endausbau~pr612",
        "https://www.berlin.de/sen/stadt/presse/pressemeldungen/pressemitteilung.1637393.php",
        "https://www.berlin.de/sen/bauen/baukultur/berliner-plaetzeprogramm/europaplatz-sued-1567894.php",
      ],
      "inputSha256": {
        str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in [ground_path, surfaces_path]
      },
      "mapSource": "geo_data/regierungsviertel/raw/city-v346/berlin-2026-11-13.osm.pbf",
      "policy": "Existing mapped forecourt paint only. No completed future Europaplatz design, new tree, entrance, height, terrace or paving-joint survey is inferred.",
    }
    SOURCE.write_bytes(gzip.compress(wire(source), mtime=0))
  from pyproj import Transformer
  from shapely.ops import transform

  project = Transformer.from_crs(4326, 25833, always_xy=True).transform

  def world(q):
    return affine_transform(q, [1, 0, 0, -1, -389500, 5820000])

  official = {
    f["properties"]["uuid"]: world(shape(f["geometry"]))
    for f in source["officialOwners"]
  }
  osm = {
    str(f["properties"]["osm_id"]): world(transform(project, shape(f["geometry"])))
    for f in source["mappedPaving"]
  }
  # Washington's place name includes the genuine western grove; its mapped
  # pedestrian ring and holes distinguish the paved hardscape from that grove.
  paved = unary_union(
    [
      official[OWNERS[0]].intersection(osm["10726692"]),
      official[OWNERS[1]],
      official[OWNERS[2]],
      osm["20783801"],
    ]
  )
  green = [world(shape(f["geometry"])) for f in source["officialVegetation"]]
  green += [
    Polygon(np.asarray(p["ring"]) / 10, [np.asarray(h) / 10 for h in p["holes"]])
    for p in source["retainedGreen"]
  ]
  protected = unary_union([shapely.make_valid(q) for q in green])
  eligible = shapely.make_valid(paved.difference(protected))
  assert eligible.intersection(protected).area < 1e-7
  # Native paints only wholly supported original 4m cells; no smooth boundary
  # is applied to a block, and no cell crossing a real planted hole is admitted.
  cells = []
  x0, z0, x1, z1 = eligible.bounds
  for z in range(int(np.floor(z0 / 4)), int(np.ceil(z1 / 4))):
    for x in range(int(np.floor(x0 / 4)), int(np.ceil(x1 / 4))):
      q = box(x * 4, z * 4, x * 4 + 4, z * 4 + 4)
      if eligible.covers(q):
        cells.append(q)
  native = unary_union(cells).simplify(0)
  assert native.difference(eligible).area < 1e-7
  # Shader branches touch only these small local extents; each edge remains
  # full precision, not a rectangular approximation to the source owner.
  data = {
    "schemaVersion": 1,
    "drawn": polygon_rows(eligible),
    "native": polygon_rows(native),
    "bounds": list(eligible.bounds),
    "nativeCellM": 4,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
  }
  DATA.write_bytes(wire(data))
  ground = json.loads(ground_path.read_bytes())
  wrong_area = 0
  for j, row in enumerate(ground["ground_rows"]):
    z = (j + ground["grid"]["min_z_idx"]) * 4
    if z + 4 < z0 or z > z1:
      continue
    for start, count, cls in row:
      if ground["classes"][cls] not in ["grass", "plazaBrick"]:
        continue
      x = (start + ground["grid"]["min_x_idx"]) * 4
      wrong_area += eligible.intersection(box(x, z, x + count * 4, z + 4)).area
  report = {
    "sourceSha256": data["sourceSha256"],
    "dataControl": control(data),
    "drawnAreaM2": eligible.area,
    "nativeAreaM2": native.area,
    "oldGrassOrBrickWithinPavingM2": wrong_area,
    "nativeCells": len(cells),
    "drawnPoints": sum(
      len(p["ring"]) + sum(map(len, p["holes"])) for p in data["drawn"]
    ),
    "nativePoints": sum(
      len(p["ring"]) + sum(map(len, p["holes"])) for p in data["native"]
    ),
    "addedGeometryBytes": 0,
    "originalGeometryAndNavigationUnchanged": True,
  }
  (TASK / "finish-receipt.json").write_bytes(wire(report))
  print(json.dumps(report))


if __name__ == "__main__":
  build()
