"""Current Foundation memorial map, distinct from its historical 1989 border.

Directory pins establish memorial identities, not surveyed physical footprints.
Only the local dated OSM snapshot supplies independent mapped geometry. Sources
and unresolved records stay in the audit; no demolished border is reconstructed.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
from collections import Counter
from datetime import datetime, timezone

import pyogrio
import requests
from shapely.geometry import Point, mapping
from shapely.ops import transform
from shapely.strtree import STRtree

from scripts.build_mcdonalds_inventory_v351 import (
  GEO,
  PBF,
  PROJECTION,
  ROOT,
  read,
  tags,
  write,
)

SOURCE = GEO / "wall-places-v352-source.json.gz"
OSM = GEO / "wall-places-v352-osm.json.gz"
MAP = "https://karte.stiftung-berliner-mauer.de/"
DIRECTORY = (
  "https://www.stiftung-berliner-mauer.de/de/stiftung/karte-der-erinnerungsorte"
)


def fetch():
  r = requests.get(MAP, timeout=40)
  r.raise_for_status()
  rows = json.JSONDecoder().raw_decode(r.text.split("const points=", 1)[1])[0]
  records = []
  for row in rows:
    lat, lng = float(row["coordinates"]["lat"]), float(row["coordinates"]["lng"])
    x, y = PROJECTION(lng, lat)
    records.append(
      dict(
        id="foundation:" + str(row["drupal_id"]),
        title=html.unescape(row["title"]),
        category=row["category"],
        point=[round(x - 389500, 3), round(5820000 - y, 3)],
        lonLat=[lng, lat],
        url="https://www.stiftung-berliner-mauer.de/de/node/" + str(row["drupal_id"]),
      )
    )
  assert len({r["id"] for r in records}) == len(records) and len(records) > 150
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      retrievedAt=datetime.now(timezone.utc).isoformat(),
      directory=DIRECTORY,
      map=MAP,
      sourceSha256=hashlib.sha256(r.content).hexdigest(),
      completePublishedMap=True,
      categories=dict(Counter(r["category"] for r in records)),
      records=records,
      limitations="Map includes historical crossings, art, exhibitions and victims alongside physical memorials, including neighbouring Brandenburg. Pins are not surveyed footprints or entrances. The map's 1989 wall lines are historical and are deliberately not imported as current physical walls.",
      use="Public location and identity facts. Source photographs remain reference-only.",
    ),
  )
  print("Foundation points", len(records))


def osm():
  rows = []
  points = STRtree([Point(r["point"]) for r in read(SOURCE)["records"]])
  for layer in ("points", "lines", "multipolygons"):
    query = "other_tags LIKE '%memorial%' OR other_tags LIKE '%berlin_wall%' OR name LIKE '%Mauer%' OR name LIKE '%Grenz%' OR name LIKE '%Wall%' OR name LIKE '%Gedenk%'"
    frame = pyogrio.read_dataframe(PBF, layer=layer, where=query)
    for _, r in frame.iterrows():
      if r.geometry is None or r.geometry.is_empty:
        continue
      meta = tags(r.get("other_tags"))
      for key in ("name", "historic", "barrier", "building", "man_made"):
        if isinstance(r.get(key), str):
          meta[key] = r[key]
      keep = {
        k: v
        for k, v in meta.items()
        if k
        in (
          "name",
          "official_name",
          "historic",
          "barrier",
          "building",
          "man_made",
          "memorial",
          "memorial:type",
          "memorial:conflict",
          "memorial:topic",
          "material",
          "height",
          "width",
          "length",
          "ruins",
          "disused",
          "demolished",
          "access",
          "website",
          "wikidata",
          "wikipedia",
          "description",
          "subject",
          "start_date",
          "end_date",
          "information",
          "tourism",
          "artwork_type",
          "artist_name",
        )
      }
      g = transform(
        lambda x, y, z=None: (x - 389500, 5820000 - y),
        transform(PROJECTION, r.geometry),
      )
      memorial = meta.get("historic") in ("memorial", "monument") or bool(
        meta.get("memorial")
      )
      wall = meta.get("barrier") == "wall" and any(
        "berlin" in str(v).lower()
        and ("mauer" in str(v).lower() or "wall" in str(v).lower())
        for v in meta.values()
      )
      if not wall and not (memorial and len(points.query(g.buffer(100)))):
        continue
      identity = (
        "node/" + str(r.osm_id)
        if layer == "points"
        else "way/" + str(r.osm_id)
        if layer == "lines"
        else "way/" + str(r.osm_way_id)
        if isinstance(r.osm_way_id, str)
        else "relation/" + str(r.osm_id)
      )
      rows.append(dict(id=identity, tags=keep, geometry=mapping(g)))
  assert len({r["id"] for r in rows}) == len(rows)
  write(
    OSM,
    dict(
      schemaVersion=1,
      source=dict(
        path=str(PBF.relative_to(ROOT)),
        sha256=hashlib.sha256(PBF.read_bytes()).hexdigest(),
        url="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
        license="ODbL-1.0",
      ),
      records=rows,
    ),
  )
  print("Mapped candidate features", len(rows))


if __name__ == "__main__":
  p = argparse.ArgumentParser()
  p.add_argument("--fetch", action="store_true")
  p.add_argument("--osm", action="store_true")
  a = p.parse_args()
  if a.fetch:
    fetch()
  if a.osm:
    osm()
