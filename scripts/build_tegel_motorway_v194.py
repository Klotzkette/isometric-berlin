"""Step 10: source-bound A111 outlines through Tegel, retaining earlier streets."""

from __future__ import annotations

import json
from pathlib import Path

import build_surrounding_outlines as e
import geopandas as gpd
from build_city_coverage_v183 import bounds_payload
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
OLD_SCOPES = (
  "bounds.geojson",
  "bounds-ring-v182.geojson",
  "bounds-city-v183.geojson",
  "bounds-outskirts-v187.geojson",
  "bounds-north-v190.geojson",
)


def build() -> dict:
  """Keep every source bend and separate mapped tunnels from surface roads."""
  pbf = DATA / "raw/outer-v159/berlin-260929.osm.pbf"
  frame = gpd.read_file(
    pbf, layer="lines", bbox=(13.15, 52.525, 13.35, 52.66), engine="pyogrio"
  ).to_crs(25833)
  previous = unary_union([e.load_projected_polygon(DATA / n) for n in OLD_SCOPES])
  selected = []
  for _, row in frame.iterrows():
    tags = e.tags_for(row)
    if tags.get("ref") != "A 111" or tags.get("highway") != "motorway":
      continue
    selected.append((row, tags))
  source = []
  positions: dict[str, list[float]] = {"surface": [], "tunnel": []}
  scopes = []
  for row, tags in sorted(selected, key=lambda item: int(item[0].osm_id)):
    original = e.world(row.geometry)
    visible = e.world(row.geometry.difference(previous))
    tunnel = tags.get("tunnel") == "yes"
    channel = "tunnel" if tunnel else "surface"
    buffer = positions[channel]
    first = len(buffer) // 3
    lanes = int(tags.get("lanes", "2"))
    width = lanes * 3.5 + 2.5  # Drawing estimate; no road-width survey claimed.
    for line in e.line_parts(visible):
      traces = (
        [line]
        if tunnel
        else [
          line,
          *e.line_parts(
            line.offset_curve(width / 2, join_style="mitre", mitre_limit=2)
          ),
          *e.line_parts(
            line.offset_curve(-width / 2, join_style="mitre", mitre_limit=2)
          ),
        ]
      )
      for trace in traces:
        for a, b in zip(trace.coords, list(trace.coords)[1:]):
          buffer.extend([a[0], 3.57, a[1], b[0], 3.57, b[1]])
    source.append(
      {
        "osmId": f"OSM-way-{row.osm_id}",
        "coordinates": list(original.coords),
        "tags": {
          k: tags[k]
          for k in ("ref", "lanes", "bridge", "tunnel", "tunnel:name", "layer")
          if k in tags
        },
        "displayChannel": channel,
        "firstVertex": first,
        "vertexCount": len(buffer) // 3 - first,
        "displayWidthM": width,
        "uncoveredLengthM": visible.length,
      }
    )
    scopes.append(row.geometry.buffer(width / 2 + 10))
  scope = unary_union(scopes)
  payload = {
    "revision": "1.0.94",
    "source": "OpenStreetMap / Geofabrik Berlin 2026-09-29 / ODbL-1.0",
    "scope": "A111 main carriageways in the Berlin extract, Dreieck Charlottenburg through Tegel to the northern Berlin boundary; not A10 or a Brandenburg expansion",
    "retainedScopes": OLD_SCOPES,
    "policy": "All mapped source vertices retained. Render only parts outside prior city coverage. Surface centre/edge lines and dashed tunnel projections at a cartographic datum; widths inferred from tagged lane counts, not surveyed grades or engineering dimensions.",
    "bounds": list(e.world(scope).bounds),
    "positions": positions,
    "sourceRecords": source,
  }
  e.write_json(DATA / "tegel-motorway-v194.json", payload)
  e.write_json(
    ROOT / "src/app/src/data/tegelMotorwayV194.json",
    {
      "bounds": payload["bounds"],
      "positions": positions,
    },
  )
  e.write_json(
    DATA / "bounds-tegel-motorway-v194.geojson",
    bounds_payload(
      scope,
      {
        "revision": "1.0.94",
        "source": payload["source"],
        "scope": payload["scope"],
        "areaM2": scope.area,
      },
    ),
  )
  return {
    "sourceWays": len(source),
    "tunnelWays": sum(s["displayChannel"] == "tunnel" for s in source),
    "vertices": {k: len(v) // 3 for k, v in positions.items()},
    "bounds": payload["bounds"],
  }


if __name__ == "__main__":
  print(json.dumps(build()))
