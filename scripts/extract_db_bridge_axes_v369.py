"""Clip the May 2026 open DB InfraGO bridge axes to Berlin, in viewer metres."""

import argparse
import csv
import gzip
import hashlib
import io
import json
from pathlib import Path
from zipfile import ZipFile

from pyproj import Transformer
from shapely import from_wkt
from shapely.geometry import shape
from shapely.ops import transform
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
URL = (
  "https://mobilithek.info//mdp-api/files/aux/922109165921083392/Infrastrukturdaten.zip"
)
SOURCE_CRS = "WKT WGS84 (EPSG 4326)"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)


def line_parts(geometry):
  if geometry.geom_type == "LineString":
    yield geometry
  elif geometry.geom_type in {"MultiLineString", "GeometryCollection"}:
    for part in geometry.geoms:
      yield from line_parts(part)


def bridge_axes(archive, state):
  # Berlin and Brandenburg share rail crossings on the boundary. Spatially
  # clip both states instead of discarding an axis by its district label.
  boundary = prep(state)
  with ZipFile(archive) as source, source.open("M1 Eisenbahnbrücken.csv") as stream:
    for row in csv.DictReader(
      io.TextIOWrapper(stream, encoding="utf-8-sig"), delimiter=";"
    ):
      if "Berlin" not in row["Bundesland"] and "Brandenburg" not in row["Bundesland"]:
        continue
      geometry = transform(PROJECT.transform, from_wkt(row[SOURCE_CRS]))
      if not boundary.intersects(geometry):
        continue
      courses = []
      for part in line_parts(geometry.intersection(state)):
        if part.length > 0.01:
          courses.append(
            [[round(x - 389500, 2), round(5820000 - y, 2)] for x, y in part.coords]
          )
      if courses:
        yield {
          "route": row["Streckennummer"],
          "direction": row["Richtung"],
          "fromKm": row["km_von_l"],
          "toKm": row["km_bis_l"],
          "name": row["Bezeichnung"],
          "crossing": row["Kreuzungsart"],
          "courses": courses,
        }


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("archive", type=Path)
  parser.add_argument(
    "--boundary",
    type=Path,
    default=GEO / "raw/berlin-boundaries-v200/landesgrenze.geojson",
  )
  parser.add_argument(
    "--output", type=Path, default=GEO / "db-bridge-axes-v369.json.gz"
  )
  args = parser.parse_args()
  state = shape(json.loads(args.boundary.read_bytes())["features"][0]["geometry"])
  records = list(bridge_axes(args.archive, state))
  data = {
    "source": "DB InfraGO AG / Deutsche Bahn AG, May 2026",
    "url": URL,
    "license": "https://creativecommons.org/licenses/by/4.0/",
    "archiveSha256": hashlib.sha256(args.archive.read_bytes()).hexdigest(),
    "boundarySha256": hashlib.sha256(args.boundary.read_bytes()).hexdigest(),
    "geometry": "Route axes clipped to Berlin, EPSG:25833 translated into viewer metres. The register does not report deck width, elevation, structure or material.",
    "records": records,
  }
  args.output.write_bytes(
    gzip.compress(
      json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0
    )
  )
  print(f"{len(records)} clipped DB bridge records")


if __name__ == "__main__":
  main()
