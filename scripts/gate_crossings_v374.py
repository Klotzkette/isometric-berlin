"""Reconcile the intentional crossing voids in Berlin's 2014/15 street survey."""

import gzip
import json
from pathlib import Path

import shapely
from build_exterior_street_margins_v373 import polygon_only, polygon_parts, world
from shapely.geometry import Point, Polygon, box, shape

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/gate-crossings-v374-sources.json.gz"
DOMAIN = box(292, 220, 560, 379)
# Each witnessed way crosses one bounded void left between actual measured
# road polygons and their kerbs. The 2025 and 2026 orthophotos both show the
# continuous asphalt or island paving through that void. The selected OSM
# midpoint identifies the face, and never sets its width or outer edges.
CROSSINGS = [
  ("376992756", 371.4, 325.5, "asphalt"),
  ("72283641", 340, 315.7, "asphalt"),
  ("538530050", 366.7, 285, "asphalt"),
  ("1155911776", 338.8, 300, "asphalt"),
  ("1155911774", 356.1, 327.1, "asphalt"),
  ("1155911770", 352.2, 286.1, "asphalt"),
  ("1155911777", 339.34, 307.7, "footway"),
  ("1155911771", 358.6, 285.7, "footway"),
  ("1155911775", 362.86, 326.12, "footway"),
]
PLANTING = ("1046134092", "1046134093", "1162788792", "1222343015")
OSM_WITNESSES = ("1151994155", "1161090358", "518072909", "518072904")
CURRENT_DOP = (
  "https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&VERSION=1.3.0"
  "&REQUEST=GetMap&LAYERS=truedop_2026&STYLES=&CRS=EPSG:25833"
  "&BBOX=389792,5819620,390060,5819780&WIDTH=1072&HEIGHT=640&FORMAT=image/png"
)
PREVIOUS_DOP = CURRENT_DOP.replace("truedop_2026", "dop_2025_fruehjahr")


def capture_crossings(folder, osm_path):
  import pyogrio

  selected = {way for way, _, _, _ in CROSSINGS} | set(OSM_WITNESSES) | set(PLANTING)
  rows = []
  for layer in ("roads", "parks"):
    frame = pyogrio.read_dataframe(
      osm_path, layer=layer, bbox=(389790, 5819618, 390070, 5819782)
    )
    for _, r in frame.iterrows():
      if r.id in selected:
        material = r.get("surface") if layer == "roads" else r.get("landuse")
        rows.append([r.id, material, r.geometry.wkb_hex])
  if {r[0] for r in rows} != selected:
    raise ValueError("Missing retained OSM crossing or verge")
  fc = json.loads((folder / "tatsaechlichenutzungflaechen.json").read_text())
  if fc["numberMatched"] != len(fc["features"]):
    raise ValueError("Incomplete local ALKIS land coverage")
  cadastral = []
  for row in fc["features"]:
    data = row["properties"]
    if data["bezeich"] in ("AX_Platz", "AX_Strassenverkehr"):
      cadastral.append(
        [row["id"], data["uuid"], data["bezeich"], shape(row["geometry"]).wkb_hex]
      )
  source = {
    "crs": "EPSG:25833",
    "osmSource": "geo_data/regierungsviertel/osm.gpkg",
    "osm": sorted(rows),
    "cadastre": sorted(cadastral),
    "cadastreUrl": (folder / "tatsaechlichenutzungflaechen.url").read_text(),
    "orthophotos": [CURRENT_DOP, PREVIOUS_DOP],
  }
  SOURCE.write_bytes(
    gzip.compress(json.dumps(source, separators=(",", ":")).encode(), mtime=0)
  )


def surveyed_complements(claimed):
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  osm = {way: (mat, world(shapely.from_wkb(wkb))) for way, mat, wkb in source["osm"]}
  cad = {fid: world(shapely.from_wkb(wkb)) for fid, _, _, wkb in source["cadastre"]}
  remain = polygon_only(DOMAIN.difference(claimed, grid_size=0.01))
  parts = list(polygon_parts(remain))
  additions = []
  for way, x, z, style in CROSSINGS:
    hits = [p for p in parts if p.covers(Point(x, z))]
    if len(hits) != 1:
      raise ValueError(f"Missing enclosed survey gap on OSM way {way}")
    gap = hits[0]
    mat, axis = osm[way]
    if (
      mat != ("asphalt" if style == "asphalt" else "paving_stones")
      or not 5 < gap.area < 95
      or axis.intersection(gap).length < 0.9
      or gap.touches(DOMAIN.boundary)
    ):
      raise ValueError(f"Crossing footprint no longer agrees with OSM way {way}")
    additions.append((style, gap))
  # Two planted facade beds and two small planted traffic verges are explicit
  # OSM polygons, also visible in both dated orthoimages. Retain their actual
  # shape rather than the stepped grass of the coarse city.
  planted = [osm[k][1] for k in PLANTING]
  # Further narrow planting along the northern facade is visible in the
  # spring 2025 image; its two trees are also retained in the vegetation
  # dataset. Vertices were digitised at 25 cm/pixel in both dated captures.
  planted += [
    Polygon([(409.9, 223.8), (412.1, 223.3), (415.0, 236.9), (412.6, 237.4)]),
    Polygon([(413.25, 240.1), (415.6, 239.7), (417.65, 251.2), (415.0, 251.7)]),
    Polygon([(415.2, 252.6), (417.8, 252.15), (418.5, 256.1), (415.9, 256.7)]),
  ]
  planting = shapely.union_all(planted, grid_size=0.01).intersection(
    remain, grid_size=0.01
  )
  additions.append(("plantedVerge", planting))
  # The public Pariser Platz parcel has a continuous visible stone floor up
  # to its frontages in both aerials; remove all original buildings, existing
  # material owners, fountains, planted areas, stairs and tree pits first.
  square = cad["tatsaechlichenutzungflaechen.97501"]
  east_walk = osm["1151994155"][1]
  if east_walk.intersection(square).length < 35:
    raise ValueError("Missing eastern pavement witness")
  paved = remain.intersection(square, grid_size=0.01)
  # At the two west-facing frontages the 2025 aerial shows individual
  # paving, planters and entrance courts. Trace only the visible approach
  # envelope; the true LoD2 room wall and survey edges clip its inside.
  north_facade = Polygon(
    [(408.5, 220), (416, 220), (421.9, 246), (424.5, 268.8), (412, 273), (408.5, 251)]
  )
  south_facade = Polygon([(420.4, 330), (429.7, 329), (431.8, 361.4), (423.3, 362.3)])
  # The northern property also has an individually traced paved side entrance
  # (OSM 518072904/518072909). This does not extend into its enclosed court.
  east_entry = Polygon([(425.5, 220), (438.6, 220), (442.2, 242.2), (435.4, 242.7)])
  apron = shapely.union_all([north_facade, south_facade, east_entry]).intersection(
    remain, grid_size=0.01
  )
  paving = polygon_only(shapely.union_all([paved, apron], grid_size=0.01)).difference(
    polygon_only(planting), grid_size=0.01
  )
  additions.append(("footway", paving))
  return additions
