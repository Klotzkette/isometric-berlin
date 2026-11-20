"""Working extent in Berlin viewer metres, with a metric 500 m band outside the S41."""

import gzip
import json
from functools import cache
from pathlib import Path

from pyproj import Transformer
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import transform, unary_union

DATA = Path(__file__).resolve().parents[1] / "geo_data/regierungsviertel"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform


def world(projected):
  return affine_transform(projected, [1, 0, 0, -1, -389500, 5820000])


@cache
def regions():
  track_data = json.loads((DATA / "outer-thin-outlines-v179.json").read_bytes())
  track = next(row for row in track_data["lines"] if row["name"] == "Ringbahn S41")
  points = track["coordinates"]
  if points[0] != points[-1]:
    raise ValueError("Open Ringbahn route")
  ring = world(transform(PROJECT, Polygon(points)))
  if not ring.is_valid:
    raise ValueError("Invalid Ringbahn interior")
  boundaries = json.loads((DATA / "house-districts-v233.geojson").read_bytes())
  districts = {
    row["properties"]["nam"]: world(shape(row["geometry"]))
    for row in boundaries["features"]
    if row["properties"]["nam"] in ("Steglitz", "Wannsee")
  }
  sites = json.loads(
    gzip.decompress((DATA / "ring-paving-sites-v368.geojson.gz").read_bytes())
  )
  areas = {
    r["properties"]["name"]: world(transform(PROJECT, shape(r["geometry"])))
    for r in sites["features"]
  }
  # The neighbourhood north of the S-Bahn station follows Schönhauser Allee
  # and its continuation on Berliner Straße up to the Pankow village green.
  northern_axis = LineString(
    [
      (13.4143, 52.5494),
      (13.4111, 52.5546),
      (13.4131, 52.5575),
      (13.4119, 52.5678),
      (13.4111, 52.5708),
    ]
  )
  tower = json.loads((DATA / "funkturm-v199-evidence.json").read_bytes())["anchor"]
  return {
    "ring": ring,
    "outer500": ring.buffer(500).difference(ring),
    "steglitz": districts["Steglitz"],
    "wannsee": districts["Wannsee"],
    "schwanenwerder": areas["Schwanenwerder"],
    "pfaueninsel": areas["Pfaueninsel"],
    "tempelhofer_feld": areas["Tempelhofer Feld"].buffer(500),
    "schoenhauser_nord": world(transform(PROJECT, northern_axis)).buffer(1000),
    "funkturm": Point(tower[0], tower[2]).buffer(1100),
    "olympiastadion": world(transform(PROJECT, Point(13.2396, 52.5147))).buffer(1400),
  }


@cache
def scope():
  return unary_union(list(regions().values()))


def extract_sites(pbf, output):
  """Reproduce the three finite boundaries from a Geofabrik Berlin extract."""
  import pyogrio
  from shapely.geometry import mapping

  ids = {
    "Tempelhofer Feld": "relation/7317281",
    "Schwanenwerder": "relation/16653908",
    "Pfaueninsel": "way/25179280",
  }
  rows = pyogrio.read_dataframe(
    pbf,
    layer="multipolygons",
    where="osm_id IN ('7317281','16653908') OR osm_way_id = '25179280'",
    columns=["name", "osm_id", "osm_way_id"],
  )
  features = []
  for name, owner in ids.items():
    (record,) = rows.loc[rows["name"] == name].to_dict("records")
    column = "osm_way_id" if owner.startswith("way/") else "osm_id"
    assert str(record[column]) == owner.split("/")[1]
    features.append(
      {
        "type": "Feature",
        "properties": {"name": name, "sourceId": owner},
        "geometry": mapping(record["geometry"]),
      }
    )
  result = {
    "type": "FeatureCollection",
    "source": "OpenStreetMap contributors, Geofabrik Berlin extract retained November 2026, WGS84",
    "features": features,
  }
  output.write_bytes(
    gzip.compress(json.dumps(result, separators=(",", ":")).encode(), mtime=0)
  )


if __name__ == "__main__":
  import argparse

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("pbf", type=Path)
  parser.add_argument(
    "--output", type=Path, default=DATA / "ring-paving-sites-v368.geojson.gz"
  )
  args = parser.parse_args()
  extract_sites(args.pbf, args.output)
