"""Step 10: bounded museum identities, retained evidence and exact proxy receipts.

The official old campus family is a flat extruded multi-building survey. It is
retained verbatim as evidence, never misrepresented as separately surveyed roofs.
The three replacement plans retain their complete existing OSM rings and holes.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import pyogrio
from build_bebelplatz_building_source import extract_parent, world_ring
from build_surrounding_outlines import tags_for, world
from shapely.geometry import LineString, Polygon, box, mapping
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import NS

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/src/data"
BASE = ROOT / "src/app/public/mesh/regierungsviertel"
IDS = ["26477645", "93119087", "15698848"]
REFERENCES = [
  dict(
    url="https://technikmuseum.berlin/museum/ueber-uns/gebaeude-und-gelaende",
    author="Stiftung Deutsches Technikmuseum Berlin; exterior photograph Ériver Hijano; park photograph C. Kirchner",
    claim="Existing four-storey new museum by Ulrich Wolff / Helge Pitz; suspended Douglas C-47B; former Anhalter railway works, two railway exhibition halls, old entrance and separate Spectrum. Planned new reception is not built here.",
  ),
  dict(
    url="https://technikmuseum.berlin/programm/dauerausstellungen/windenergie",
    author="Stiftung Deutsches Technikmuseum Berlin; photographs Ériver Hijano / C. Kirchner",
    claim="The upright Vestas V90 blade is 44 m long; two distinct working windmills survive in the museum park.",
  ),
  dict(
    url="https://technikmuseum.berlin/programm/dauerausstellungen/eisenbahn",
    author="Stiftung Deutsches Technikmuseum Berlin; photographs Ériver Hijano",
    claim="Two historic roundhouses and their outdoor turntables, glazed inner circulation, 40 original railway vehicles and the surviving Fürstenportal. Six generic static locomotive interpretations are not asserted to identify six current display bays or inventory numbers.",
  ),
]


def read(path: Path) -> dict:
  """Read one bounded retained input."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: dict) -> None:
  """Write a small deterministic construction or provenance record."""
  raw = (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def digest(path: Path) -> str:
  """Hash without retaining a second archive copy."""
  with path.open("rb") as f:
    return hashlib.file_digest(f, "sha256").hexdigest()


def polygon(prism: dict) -> Polygon:
  """Exact centimetre/decimetre legacy presentation plan."""
  return Polygon(
    [(x / 10, z / 10) for x, z in prism["ring"]],
    [[(x / 10, z / 10) for x, z in h] for h in prism.get("holes", [])],
  )


def contains_dm(ring, x, z):
  """Integer-dm grid-centre containment shared by drawn source and native roof."""
  inside = False
  for a, b in zip(ring, ring[-1:] + ring[:-1], strict=True):
    if (a[1] > z) != (b[1] > z) and x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[
      0
    ]:
      inside = not inside
  return inside


def build() -> tuple[dict, dict]:
  """Keep source provenance, every legacy vertex and unambiguous native receipts."""
  prisms = read(BASE / "lod2-prisms.json")["buildings"]
  previous = [next(p for p in prisms if p["id"] == identifier) for identifier in IDS]
  selected = unary_union([polygon(p) for p in previous])
  near = [
    p for p in prisms if polygon(p).envelope.intersects(selected.envelope.buffer(6))
  ]
  neighbours = [p for p in near if p["id"] not in IDS]
  occupied = unary_union([polygon(p) for p in neighbours])
  voxel = read(BASE / "minecraft-voxels.json")
  cell, grid = voxel["cell_m"], voxel["grid"]
  columns, shared = [], []
  for zi, runs in enumerate(voxel["building_rows"]):
    iz = grid["min_z_idx"] + zi
    if not selected.bounds[1] - cell <= iz * cell <= selected.bounds[3]:
      continue
    for offset, count, low, high, kind in runs:
      for ix in range(grid["min_x_idx"] + offset, grid["min_x_idx"] + offset + count):
        sq = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
        if not selected.intersection(sq).area > 0.001:
          continue
        row = [ix, iz, low, high, kind]
        (shared if occupied.intersection(sq).area > 0.001 else columns).append(row)
  archive = GEO / "raw/lod2/LoD2_389_5817.zip"
  official = []
  for identifier in ["DEBE02YY400000WL", "DEBE02YY400001Wk"]:
    parent = extract_parent(archive, identifier)
    surfaces = [
      dict(
        kind=s.tag.split("}")[-1],
        rings=[world_ring(r) for r in p.findall(".//gml:posList", NS)],
      )
      for boundary in parent.findall("bldg:boundedBy", NS)
      for s in boundary
      for p in s.findall(".//gml:Polygon", NS)
    ]
    official.append(dict(id=identifier, surfaces=surfaces))
  candidate = GEO / "raw/outer-v159/candidate.gpkg"
  features = []
  wanted = {
    "31622818",
    "167983108",
    "255072469",
    "16109012",
    "16109013",
    "56247632",
    "102814719",
    "379688332",
    "26491213",
    "47347244",
    "102813182",
    "26491214",
    "369749664",
    "369749665",
    "115966504",
    "27068812",
    "39093460",
  }
  for layer in ["multipolygons", "lines"]:
    frame = pyogrio.read_dataframe(
      candidate, layer=layer, bbox=(13.373, 52.494, 13.383, 52.500)
    ).to_crs(25833)
    for row in frame.to_dict("records"):
      tags = tags_for(row)
      identifier = tags.get("osm_way_id") or tags.get("osm_id")
      g = world(row["geometry"])
      if identifier in wanted or (
        layer == "lines"
        and tags.get("railway") in {"rail", "disused", "preserved"}
        and box(180, 2300, 450, 2650).covers(g)
      ):
        features.append(dict(id="way/" + identifier, tags=tags, geometry=mapping(g)))
  by_id = {p["id"]: p for p in features}
  turns = []
  for identifier in ["16109012", "16109013"]:
    r = by_id["way/" + identifier]
    line = LineString(r["geometry"]["coordinates"])
    g = Polygon(line)
    turns.append(
      dict(
        id=r["id"], centre=list(g.centroid.coords[0]), ring=list(g.exterior.coords)[:-1]
      )
    )
  auxiliary_ids = [
    "on-29177",
    "26491108",
    "26491213",
    "47347244",
    "02813182",
    "26491214",
    "69749664",
    "69749665",
    "15966504",
    "27068812",
    "39093460",
    "79688332",
    "56247632",
    "02814719",
  ]
  auxiliary = [p for p in prisms if p["id"] in auxiliary_ids]
  payload = dict(
    schema=1,
    cellM=cell,
    previousPrisms=previous,
    neighbours=neighbours,
    columns=columns,
    retainedSharedColumns=shared,
    sites=[
      dict(
        key="newMuseum",
        name="Neubau",
        prism=IDS[0],
        ring=[[x / 10, z / 10] for x, z in previous[0]["ring"]],
        holes=[],
        groundY=5.2,
        eaveY=25.879,
        roofY=25.879,
      ),
      dict(
        key="roundhouse1",
        name="Lokschuppen I",
        prism=IDS[1],
        ring=[[x / 10, z / 10] for x, z in previous[1]["ring"]],
        holes=[],
        groundY=5.2,
        eaveY=11.2,
        roofY=14.0,
        centre=turns[0]["centre"],
      ),
      dict(
        key="roundhouse2",
        name="Lokschuppen II",
        prism=IDS[2],
        ring=[[x / 10, z / 10] for x, z in previous[2]["ring"]],
        holes=[],
        groundY=5.2,
        eaveY=11.2,
        roofY=14.914,
        centre=turns[1]["centre"],
      ),
    ],
    auxiliaryPrisms=auxiliary,
    turntables=turns,
    aircraft=by_id["way/167983108"],
    rotor=by_id["way/255072469"],
    tracks=[
      p
      for p in features
      if p["tags"].get("railway") in {"rail", "disused", "preserved"}
    ],
    estimates="Complete retained OSM plans. New museum top25.879 uses the official flat-campus maximum in the unchanged NHN-30 frame, not an independently surveyed storey profile. Main ground and both shed eaves retain the existing viewer datum. First shed ridge, facade subdivisions, glass fields, suspended aircraft altitude, fittings and six anonymous museum locomotives are display estimates. Second shed source top14.914 retained. Rotor44m is published by the operator.",
    references=REFERENCES,
  )
  # Native walls, roof support and collision share the very same 1.2 m cells.
  # Union only existing source-plan samples; retain every original drawn ring.
  for site in payload["sites"]:
    native_cell = 1.2
    source_plan = Polygon(site["ring"], site["holes"])
    xmin, zmin, xmax, zmax = source_plan.bounds
    cells = [
      box(
        ix * native_cell,
        iz * native_cell,
        (ix + 1) * native_cell,
        (iz + 1) * native_cell,
      )
      for ix in range(math.floor(xmin / native_cell), math.ceil(xmax / native_cell))
      for iz in range(math.floor(zmin / native_cell), math.ceil(zmax / native_cell))
      if contains_dm(
        next(p["ring"] for p in previous if p["id"] == site["prism"]),
        ix * 12 + 6,
        iz * 12 + 6,
      )
    ]
    native_plan = unary_union(cells).simplify(0)
    if not isinstance(native_plan, Polygon):
      raise ValueError("Museum native source plan disconnected")
    site["nativeRing"] = [
      [round(x, 6), round(z, 6)] for x, z in list(native_plan.exterior.coords)[:-1]
    ]
    site["nativeHoles"] = [
      [[round(x, 6), round(z, 6)] for x, z in list(h.coords)[:-1]]
      for h in native_plan.interiors
    ]
    site["nativeCells"] = len(cells)
  evidence = dict(
    schema="technikmuseum-v272/1",
    previousPrisms=previous,
    neighbours=neighbours,
    columns=columns,
    retainedSharedColumns=shared,
    official=official,
    features=features,
    sources=[
      dict(path=str(p.relative_to(ROOT)), sha256=digest(p))
      for p in [
        BASE / "lod2-prisms.json",
        BASE / "minecraft-voxels.json",
        archive,
        candidate,
      ]
    ],
    references=REFERENCES,
    conflicts=[
      "Official DEBE02YY400000WL merges the main museum, historic entrance and first roundhouse into one flat-height extrusion. It is retained as evidence but not used to raise unrelated low sheds or close source courtyard holes.",
      "Current future reception project is excluded.",
      "No current locomotive exhibit bay inventory was surveyed; six compact anonymous steam-locomotive display models are illustrative and can be seen through glazed inner-front surfaces. No roof is hidden.",
    ],
    policy="Only three exact unchanged OSM fallback prisms and their exclusive native tuples transfer after required complete model construction. Every original source sheet and footprint is retained here; unrelated geometry, shared columns and prior details remain.",
  )
  return payload, evidence


if __name__ == "__main__":
  payload, evidence = build()
  write(OUT / "technikmuseumV272.json", payload)
  write(GEO / "technikmuseum-v272-evidence.json.gz", evidence)
  print(
    {
      "sites": len(payload["sites"]),
      "columns": len(payload["columns"]),
      "shared": len(payload["retainedSharedColumns"]),
      "tracks": len(payload["tracks"]),
      "bytes": (OUT / "technikmuseumV272.json").stat().st_size,
    }
  )
