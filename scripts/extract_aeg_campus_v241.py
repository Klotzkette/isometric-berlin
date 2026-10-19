"""Reproduce the bounded AEG selection from already retained OSM and LoD2 files."""

from __future__ import annotations

import gzip
import json

import build_townhall_source_v227 as metric
import pyogrio
from build_district_courts_v229 import retained_part
from build_surrounding_outlines import tags_for
from shapely.geometry import mapping

SELECTION = {
  "phorms": {"178621265", "178621263", "178621266"},
  "enter": {"286645907"},
  "dw": {"45234467", "26410650"},
}


def extract():
  """Keep every original surface of the matched official building parents."""
  osm = metric.GEO / "aeg-campus-v241-osm.json"
  frame = pyogrio.read_dataframe(
    metric.GEO / "raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    bbox=(13.383, 52.538, 13.391, 52.543),
  )
  sites = []
  for key, ids in SELECTION.items():
    records = []
    for row in frame.to_dict("records"):
      tags = tags_for(row)
      if tags.get("osm_way_id") in ids:
        records.append(
          {
            "id": "way/" + tags["osm_way_id"],
            "tags": tags,
            "geometry": mapping(row["geometry"]),
          }
        )
    sites.append({"key": key, "osm": records})
  metric.write(
    osm,
    {
      "sites": sites,
      "source": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    },
  )
  metric.OSM = osm
  metric.NAMES = {
    "phorms": "AEG-Apparatewerk / Phorms Campus Mitte",
    "enter": "ENTER / Merantix AI Campus",
    "dw": "Deutsche Welle / Mediaport / Kleinmotorenfabrik",
  }
  metric.part_profile = retained_part
  source = metric.extract_sources()
  payload = (
    json.dumps(source, ensure_ascii=False, separators=(",", ":")) + "\n"
  ).encode()
  (metric.GEO / "aeg-campus-v241-source.json.gz").write_bytes(
    gzip.compress(payload, mtime=0)
  )


if __name__ == "__main__":
  extract()
