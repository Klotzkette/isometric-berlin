"""Independently verify finite new memorial records against retained originals."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import geopandas as gpd
from pyproj import Transformer
from shapely.geometry import Point, mapping
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform


def world(x, y, z=None):
  """Use the exact retained local frame, with no estimate or rounded anchor."""
  east, north = PROJECT(x, y)
  return east - 389500, 5820000 - north


def sha(path):
  """Stream the existing archive rather than retaining another full copy."""
  with Path(path).open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def load(path):
  return json.loads(Path(path).read_text())


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--capture-dir", type=Path)
  args = parser.parse_args()
  boulevard = load(GEO / "boulevard-v322-source.json")
  allied = load(GEO / "allied-memorials-v322-source.json")
  pbf = ROOT / boulevard["source"]["path"]
  actual_sha = sha(pbf)
  assert actual_sha == boulevard["source"]["sha256"] == allied["source"]["sha256"]
  points = gpd.read_file(
    pbf, layer="points", bbox=(13.20, 52.49, 13.34, 52.57), engine="pyogrio"
  )
  selected = [
    *boulevard["sites"],
    allied["sites"]["french"],
    allied["sites"]["british"]["cross"],
  ]
  for expected in selected:
    identity = expected["id"].split("/")[1]
    matches = points[points.osm_id == identity]
    assert len(matches) == 1, identity
    actual = matches.iloc[0]
    assert list(actual.geometry.coords[0]) == expected["crs84"], identity
    assert list(world(*actual.geometry.coords[0])) == expected["point"], identity
    assert actual.other_tags == expected["tags"], identity
  polygons = gpd.read_file(
    pbf, layer="multipolygons", bbox=(13.219, 52.506, 13.224, 52.509), engine="pyogrio"
  )
  cemetery = polygons[polygons.osm_way_id == "5077552"]
  stone = polygons[polygons.osm_way_id == "802156616"]
  assert len(cemetery) == len(stone) == 1
  cemetery = transform(world, cemetery.iloc[0].geometry)
  stone = transform(world, stone.iloc[0].geometry)
  expected = allied["sites"]["british"]
  assert json.loads(json.dumps(mapping(cemetery))) == expected["cemetery"]
  assert cemetery.contains(stone) and cemetery.contains(
    Point(*expected["cross"]["point"])
  )
  actual_rings = [
    [list(p) for p in ring.coords]
    for ring in [stone.geoms[0].exterior, *stone.geoms[0].interiors]
  ]
  assert actual_rings == expected["stone"]["rings"]
  maison = load(DATA / "maisonDeFranceV322.json")
  mesh = ROOT / "src/app/public/mesh/regierungsviertel"
  for filename, expected_sha in maison["sourceFiles"].items():
    assert sha(mesh / filename) == expected_sha
  prisms = load(mesh / "lod2-prisms.json")
  actual = [b for b in prisms["buildings"] if b["id"] == "48757378"]
  assert actual == [maison["sourcePrism"]]
  native = load(mesh / "minecraft-voxels.json")
  assert native["cell_m"] == maison["native"]["cell_m"]
  assert native["grid"] == maison["native"]["grid"]
  for x, z, *values in maison["native"]["columns"]:
    rows = native["building_rows"][z - native["grid"]["min_z_idx"]]
    matches = [
      row
      for row in rows
      if native["grid"]["min_x_idx"] + row[0]
      <= x
      < native["grid"]["min_x_idx"] + row[0] + row[1]
    ]
    assert len(matches) == 1 and matches[0][2:] == values
  if args.capture_dir:
    a, b = [load(args.capture_dir / f"{engine}.json") for engine in ("bun", "node")]
    assert a["sources"] == b["sources"] and a["records"] == b["records"]
    for filename, expected_sha in a["sources"].items():
      assert sha(ROOT / filename) == expected_sha, filename
  print(
    json.dumps(
      {
        "pointSources": len(selected),
        "cemeteryAndStoneExact": True,
        "maisonOwnerExact": "48757378",
        "nativeSupportColumns": len(maison["native"]["columns"]),
        "dualEngineCaptureExact": bool(args.capture_dir),
        "originalSourcesUntouched": True,
      }
    )
  )


if __name__ == "__main__":
  main()
