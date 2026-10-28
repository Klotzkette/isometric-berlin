"""Step 10: complete penguin shell and bounded Brehm-house recognition.

Offline only; old sources, navigation and packet files are never rewritten.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

# Older retained generators use sibling imports. Match their direct-CLI layout
# when this module is imported by pytest as well, without requiring PYTHONPATH.
sys.path.insert(0, str(Path(__file__).resolve().parent))

from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_steglitz_v182 import native_blocks
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
BASE = ROOT / "src/app/public/mesh/regierungsviertel"
RUNTIME = DATA / "zooHousesV282.json"
RECEIPT = DATA / "zooHousesV282Ownership.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/zoo-houses-v282-evidence.json.gz"
SOURCE = ROOT / "geo_data/regierungsviertel/raw/lod2/LoD2_387_5818.zip"
PARENTS = ["DEBE01YYK0002KuU", "DEBE01YYK0003Uyx"]
PRISMS = ["ne1cFFjo", "PKel9P5i", "nTRvf4vG", "K0003Uyx"]
# The original source includes a basement at -1.641. Its exposed lower roof /
# public approach datum is 3.690 above NHN30. A common rigid translation keeps
# the whole complex connected; never raise every basement to the park surface.
EXPOSED_SOURCE_Y = 3.690
OFFSET = 5.2 - EXPOSED_SOURCE_Y
AVIARY_PARENT = "DEBE01YYK0003Uqa"


def digest(path: Path) -> str:
  """Hash the immutable retained input."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def old_polygon(part: dict) -> Polygon:
  """Decode the exact previous decimetre prism footprint."""
  return Polygon(
    [[x / 10, z / 10] for x, z in part["ring"]],
    [[[x / 10, z / 10] for x, z in ring] for ring in part["holes"]],
  )


def ownership() -> dict:
  """Exclusive native tuples only; shared neighbours remain untouched."""
  prisms = json.loads((BASE / "lod2-prisms.json").read_bytes())["buildings"]
  previous = [next(p for p in prisms if p["id"] == ident) for ident in PRISMS]
  area = unary_union([old_polygon(p) for p in previous])
  voxel = json.loads((BASE / "minecraft-voxels.json").read_bytes())
  cell, grid = voxel["cell_m"], voxel["grid"]
  assert cell == 4 and voxel["schema_version"] == 2
  nearby = area.envelope.buffer(cell * 2)
  neighbours = [
    p for p in prisms if p["id"] not in PRISMS and old_polygon(p).intersects(nearby)
  ]
  occupied = unary_union([old_polygon(p) for p in neighbours])
  columns, shared = [], []
  x0, z0, x1, z1 = area.bounds
  for zi, runs in enumerate(voxel["building_rows"]):
    iz = grid["min_z_idx"] + zi
    if not z0 - cell <= iz * cell <= z1:
      continue
    for offset, count, low, high, kind in runs:
      for ix in range(grid["min_x_idx"] + offset, grid["min_x_idx"] + offset + count):
        if not x0 - cell <= ix * cell <= x1:
          continue
        square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
        if area.intersection(square).area <= 0.001:
          continue
        (shared if occupied.intersection(square).area > 0.001 else columns).append(
          [ix, iz, low, high, kind]
        )
  assert columns
  return dict(
    schemaVersion=1,
    cellM=cell,
    bounds=list(area.bounds),
    previousPrisms=previous,
    neighbours=neighbours,
    columns=columns,
    retainedSharedColumns=shared,
  )


def chicken_aviary() -> tuple[dict, dict]:
  """Add one complete absent rear aviary; retain all existing opaque owners."""
  original = part_profile(extract_parent(SOURCE, AVIARY_PARENT))
  area = Polygon(original["ring"], original["holes"])
  offset = 5.2 - original["ground_y_m"]
  prisms = json.loads((BASE / "lod2-prisms.json").read_bytes())["buildings"]
  assert not any(p["id"] == AVIARY_PARENT[-8:] for p in prisms)
  nearby = [p for p in prisms if old_polygon(p).intersects(area.buffer(1))]
  previous = json.loads((DATA / "zooGroundsV165Source.json").read_bytes())
  assert not any(
    Polygon(p["ring"], p["holes"]).intersects(area) for p in previous["parts"]
  )
  voxel = json.loads((BASE / "minecraft-voxels.json").read_bytes())
  cell, grid = voxel["cell_m"], voxel["grid"]
  assert cell == 4 and voxel["schema_version"] == 2
  columns = []
  xmin, zmin, xmax, zmax = area.bounds
  for row, runs in enumerate(voxel["building_rows"]):
    iz = grid["min_z_idx"] + row
    if not zmin - cell <= iz * cell <= zmax:
      continue
    for start, count, low, high, kind in runs:
      for ix in range(grid["min_x_idx"] + start, grid["min_x_idx"] + start + count):
        if not xmin - cell <= ix * cell <= xmax:
          continue
        if (
          area.intersection(
            box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
          ).area
          > 0.001
        ):
          columns.append([ix, iz, low, high, kind])
  surfaces, roofs = [], []
  for surface in original["surfaces"]:
    rings = [
      [[x, round(y + offset, 3), z] for x, y, z in ring] for ring in surface["rings"]
    ]
    surfaces.append(dict(kind=surface["kind"], rings=rings))
    if surface["kind"] == "RoofSurface":
      roofs.extend(triangles_for(rings))
  runtime = dict(
    sourceId="lod2/" + AVIARY_PARENT,
    ring=original["ring"],
    holes=original["holes"],
    minY=5.2,
    maxY=round(original["top_y_m"] + offset, 3),
    surfaces=surfaces,
    roofTriangles=roofs,
    retainedPrisms=nearby,
    retainedNativeColumns=columns,
    nativeCellM=cell,
  )
  evidence = dict(
    original=original,
    sourcePath=str(SOURCE.relative_to(ROOT)),
    sha256=digest(SOURCE),
    displayOffsetY=offset,
    retiredOwners=[],
    interpretation="One low measured polygon in the rear aviary band identified by Berlin's monument inventory. Full planes and slopes retained; wire material, lattice spacing and one generic domestic chicken are illustrative, not a breed-per-cage census.",
    references=[
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050439",
      "https://www.zoo-berlin.de/fileadmin/zoo-berlin/downloads/Investor_Relations/Geschaeftsberichte/Geschaeftsbericht_2025_digital.pdf",
    ],
  )
  return runtime, evidence


def entry(ring: list, point: list, ident: str, label: str) -> dict:
  """Project a real entrance node onto the retained measured facade."""
  shape = Polygon(ring)
  choices = []
  for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    if length < 1.5:
      continue
    t = max(0, min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / length**2))
    x, z = a[0] + dx * t, a[1] + dz * t
    choices.append(
      (math.hypot(x - point[0], z - point[1]), x, z, dx / length, dz / length)
    )
  distance, x, z, tx, tz = min(choices)
  assert distance < 3, (ident, distance)
  nx, nz = tz, -tx
  if shape.contains(Point(x + nx * 0.1, z + nz * 0.1)):
    nx, nz = -nx, -nz
  return dict(
    sourceId=ident,
    sourcePoint=point,
    anchor=[round(x, 3), round(z, 3)],
    tangent=[tx, tz],
    normal=[nx, nz],
    label=label,
    offsetDistance=distance,
  )


def build() -> tuple[dict, dict, dict]:
  """Keep every source wall, roof, XZ coordinate and rigid relative elevation."""
  parents, parts, surfaces, rows = [], [], [], []
  for identity in PARENTS:
    element = extract_parent(SOURCE, identity)
    originals = [part_profile(p) for p in leaf_building_parts(element) or [element]]
    parents.append(
      dict(
        id=identity,
        sourcePath=str(SOURCE.relative_to(ROOT)),
        sha256=digest(SOURCE),
        parts=originals,
      )
    )
    for original in originals:
      shell = []
      roof_triangles = []
      for s in original["surfaces"]:
        rings = [
          [[p[0], round(p[1] + OFFSET, 3), p[2]] for p in ring] for ring in s["rings"]
        ]
        triangles = triangles_for(rings)
        color = 0x8B968F if s["kind"] == "RoofSurface" else 0xB5B3A6
        shell.append(
          dict(owner=original["id"], kind=s["kind"], color=color, triangles=triangles)
        )
        if s["kind"] == "RoofSurface":
          roof_triangles.extend(triangles)
      native = native_blocks(dict(surfaces=shell, boxes=[], rods=[]))
      cells = {}
      for x, y, z, w, h, d, _ in native:
        for ix in range(round(x - w / 2), round(x + w / 2)):
          for iz in range(round(z - d / 2), round(z + d / 2)):
            cells[ix, iz] = max(cells.get((ix, iz), -math.inf), y + h / 2)
      bounds = [
        min(x for x, _ in cells),
        min(z for _, z in cells),
        max(x for x, _ in cells) + 1,
        max(z for _, z in cells) + 1,
      ]
      parts.append(
        dict(
          id=original["id"],
          sourceId=original["id"][-8:],
          ring=original["ring"],
          holes=original["holes"],
          minY=round(original["ground_y_m"] + OFFSET, 3),
          maxY=round(original["top_y_m"] + OFFSET, 3),
          roofTriangles=roof_triangles,
          nativeBounds=bounds,
          nativeCells=[[x, z, y] for (x, z), y in sorted(cells.items())],
        )
      )
      surfaces.extend(shell)
      rows.extend(native)
  assert len(parts) == 4
  zoo_outline = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
  assert zoo_outline.geom_type == "Polygon"
  zoo_entries = [
    entry(
      min(parts, key=lambda part: Polygon(part["ring"]).boundary.distance(Point(p)))[
        "ring"
      ],
      p,
      ident,
      "PINGUINWELT",
    )
    for ident, p in [
      ("node/9579925636", [-2146.001, 1050.159]),
      ("node/9579925640", [-2151.055, 1070.039]),
    ]
  ]
  old_east = ROOT / "geo_data/regierungsviertel/east-landmarks-v187-evidence.json"
  east = json.loads(old_east.read_bytes())
  brehm = next(p for p in east["sourceProfiles"] if p["id"] == "DEBE11YYI0000Nxm")[
    "parts"
  ][0]
  owner = next(p for p in east["owners"] if p["id"] == brehm["id"])
  brehm_entries = [
    entry(brehm["ring"], p, ident, "REGENWALDHAUS")
    for ident, p in [
      ("node/288982607", [11006.879, 2422.480]),
      ("node/305930714", [11054.210, 2362.576]),
      ("node/427014252", [10968.514, 2356.497]),
    ]
  ]
  runtime = dict(
    schemaVersion=1,
    penguin=dict(
      parts=parts, surfaces=surfaces, nativeRows=rows, groundY=5.2, entries=zoo_entries
    ),
    brehm=dict(
      sourceId=brehm["id"],
      ring=brehm["ring"],
      topY=round(brehm["top_y_m"] + owner["rigidYOffset"], 3),
      groundY=3,
      packetId="outer187-21_4",
      entries=brehm_entries,
    ),
  )
  runtime["aviary"], aviary_evidence = chicken_aviary()
  receipt = ownership()
  assert {p["sourceId"] for p in parts} == set(PRISMS)
  preserved = [
    BASE / "lod2-prisms.json",
    BASE / "minecraft-voxels.json",
    old_east,
    DATA / "zooGroundsV165Source.json",
    DATA / "zooGroundsV165Navigation.json",
    DATA / "eastLandmarksV187.json",
    DATA / "eastLandmarksV187Native.json",
    DATA / "eastLandmarksV187Navigation.json",
  ]
  evidence = dict(
    schemaVersion=1,
    parents=parents,
    displayOffsetY=OFFSET,
    exposedSourceY=EXPOSED_SOURCE_Y,
    basementSourceY=-1.641,
    datumPolicy="Retain every source sheet; align the exposed source rim to the existing park datum, not the basement. This common display alignment is corroborated by the architect's approximately 7m interior apex, but is not a new terrain survey.",
    preservedInputs={str(p.relative_to(ROOT)): digest(p) for p in preserved},
    references=[
      "https://skp-berlin.com/zooberlin/",
      "https://www.zoo-berlin.de/de/zoo-erleben/tiere-erlebniswelten/robben-pinguine",
      "https://www.haas-architekten.de/projekte/glashaeuser/alfred-brehm-haus-im-tierpark-berlin",
      "https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/regenwaldhaus",
    ],
    brehm=dict(
      sourceId=brehm["id"],
      unchangedSourceHeight=owner["height"],
      limitation="Flat retained roof is preserved; a reliable current upper tropical-hall roof profile remains unresolved. No invented new hall.",
    ),
    aviary=aviary_evidence,
  )
  return runtime, receipt, evidence


def encode(payload: dict) -> bytes:
  """Stable small JSON."""
  return (
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  ).encode()


def main() -> None:
  """Build only the finite new companions, or verify their exact bytes."""
  parser = argparse.ArgumentParser()
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  runtime, receipt, evidence = build()
  for path, payload in [(RUNTIME, runtime), (RECEIPT, receipt), (EVIDENCE, evidence)]:
    content = encode(payload)
    if args.check:
      old = (
        gzip.decompress(path.read_bytes())
        if path.suffix == ".gz"
        else path.read_bytes()
      )
      assert old == content, path
    else:
      path.write_bytes(
        gzip.compress(content, mtime=0) if path.suffix == ".gz" else content
      )
  print(
    json.dumps(
      dict(
        parts=len(runtime["penguin"]["parts"]),
        surfaces=len(runtime["penguin"]["surfaces"]),
        nativeRows=len(runtime["penguin"]["nativeRows"]),
        exclusiveColumns=len(receipt["columns"]),
        sharedColumns=len(receipt["retainedSharedColumns"]),
        runtimeBytes=len(encode(runtime)),
        receiptBytes=len(encode(receipt)),
      )
    )
  )


if __name__ == "__main__":
  main()
