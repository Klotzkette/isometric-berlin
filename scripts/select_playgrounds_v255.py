"""Freeze the official top twenty playground records without inventing a rank.

The source is the complete GRIS Spielplaetze WFS response in EPSG:25833.
Supply its cached GeoJSON explicitly; this script never fetches live data.
Gross cadastral area includes ancillary grounds and differs from net play area.
"""

import argparse
import json
from pathlib import Path


def select_largest(source: dict, count: int = 20) -> list[dict]:
  features = source["features"]
  if len(features) != source["numberMatched"]:
    raise ValueError("Incomplete WFS inventory; a partial list cannot establish rank")
  identities = [feature["properties"]["pitid"] for feature in features]
  if len(set(identities)) != len(identities):
    raise ValueError("Duplicate GRIS site identities need explicit aggregation")
  if any(f["properties"]["objartname"] != "Spielplatz" for f in features):
    raise ValueError("Only the playground inventory may be ranked")
  ranked = sorted(
    features,
    key=lambda f: (
      -float(f["properties"].get("katasterfl") or 0),
      f["properties"]["pitid"],
    ),
  )
  return [
    {
      **feature,
      "properties": {
        **feature["properties"],
        "rank": index,
        "name": feature["properties"]["namenr"],
      },
    }
    for index, feature in enumerate(ranked[:count], 1)
  ]


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("source", type=Path)
  parser.add_argument(
    "--output",
    type=Path,
    default=Path("geo_data/regierungsviertel/playgrounds-v255-official.geojson"),
  )
  args = parser.parse_args()
  source = json.loads(args.source.read_text())
  result = {
    "type": "FeatureCollection",
    "crs": source["crs"],
    "sourceUrl": "https://gdi.berlin.de/services/wfs/gruenanlagen",
    "license": "dl-de-zero-2.0",
    "retrieved": "2026-10-20",
    "ranking": (
      "20 unique GRIS playground records by descending katasterfl (gross cadastral "
      "m²), not net playable area; entire Berlin inventory of 1886 records, "
      "no duplicate pitid"
    ),
    "features": select_largest(source),
  }
  args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
  main()
