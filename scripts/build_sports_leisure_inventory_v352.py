"""Current official sports/leisure identities and finite mapped geometry.

Operator points establish identity only. Surface/building geometry remains OSM;
source photographs are references only, never redistributed or traced.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import pyogrio
import requests
from shapely.geometry import mapping
from shapely.ops import transform

from scripts.build_mcdonalds_inventory_v351 import (
  PBF,
  PROJECTION,
  boundary,
  tags,
  write,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "sports-leisure-v352-source.json.gz"
OSM = GEO / "sports-leisure-v352-osm.json.gz"
BASE = "https://www.berlinerbaeder.de"
DIRECTORY = BASE + "/baeder/"


def sha(b):
  return hashlib.sha256(b).hexdigest()


def clean(v):
  return html.unescape(re.sub("<[^>]*>", " ", v)).strip()


def fetch():
  response = requests.get(DIRECTORY, timeout=40)
  response.raise_for_status()
  raw = response.content
  s = response.text
  rows = []
  for identity, body in re.findall(
    r"bathmapMarkerTemplate\[(\d+)\] = \{(.*?)\};", s, re.S
  ):
    fields = dict(re.findall(r"(\w+): '([^']*)'", body))
    x, z = PROJECTION(float(fields["lon"]), float(fields["lat"]))
    rows.append(
      dict(
        id="bbb:" + identity,
        name=html.unescape(fields["title"]),
        url=BASE + fields["url"],
        point=[round(x - 389500, 3), round(5820000 - z, 3)],
      )
    )
  count = int(re.search(r'class="result">(\d+) Ergebnisse', s)[1])
  assert len(rows) == count and len({r["id"] for r in rows}) == count

  def detail(row):
    r = requests.get(row["url"], timeout=40)
    r.raise_for_status()
    h = r.text
    photos = sorted(
      set(
        BASE + u
        for u in re.findall(r'<img[^>]+src="(/fileadmin/[^"<>]+)', h)
        if re.search(r"\.(jpe?g|png|webp)$", u, re.I)
      )
    )
    # Factual facility classes and physical features, not entire page prose.
    types = sorted(
      set(
        clean(v)
        for v in re.findall(r'<span data-facilitytype="[^"]+">(.*?)</span>', h, re.S)
      )
    )
    address = re.search(
      r'class="facility_body_contact_address label"><span>Standort</span><div>(.*?)</div>',
      h,
      re.S,
    )
    return dict(
      row,
      pageSha256=sha(r.content),
      types=types,
      address=re.sub(r"\s+", " ", clean(address[1].split("+49")[0]))
      if address
      else None,
      referencePhotos=photos[:20],
    )

  with ThreadPoolExecutor(max_workers=3) as pool:
    rows = list(pool.map(detail, rows))
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      retrievedAt=datetime.now(timezone.utc).isoformat(),
      directory=DIRECTORY,
      directorySha256=sha(raw),
      directoryResultCount=count,
      completeMapEntries=True,
      records=rows,
      limitations="67 official directory entries include combined-bath hall/outdoor sections and leased baths. Points prove identities, never exact entrances. Seasonally closed pools stay represented as physical sites.",
      iceReference="https://www.berlin.de/sen/inneres/sportmetropole-berlin/veroeffentlichungen/sportstaettenstatistik-2025.pdf",
      leisureReferences=[
        "https://www.jumphouse.de/berlin/",
        "https://myjump.de/berlin-mitte/kontakt-anfahrt/",
        "https://beachmitte.de/mountmitte/",
        "https://waldhochseilgarten-jungfernheide.de/kontakt-anfahrt/",
      ],
      use="Public identity/location facts. External photos reference-only, no image pixels redistributed.",
    ),
  )
  print("BBB official entries", len(rows))


def osm():
  berlin = boundary()
  rows = []
  where = "leisure IN ('swimming_pool','swimming_area','sports_centre','stadium','ice_rink','pitch') OR name LIKE '%JUMP%' OR name LIKE '%Jump%' OR name LIKE '%MountMitte%' OR name LIKE '%Kletter%' OR other_tags LIKE '%trampoline%' OR other_tags LIKE '%high_ropes%'"
  for layer in ("points", "multipolygons"):
    # points do not expose leisure as a dedicated column in the OSM driver.
    query = (
      where
      if layer == "multipolygons"
      else "other_tags LIKE '%swimming%' OR other_tags LIKE '%stadium%' OR other_tags LIKE '%ice_rink%' OR name LIKE '%JUMP%' OR name LIKE '%Jump%' OR name LIKE '%MountMitte%' OR name LIKE '%Kletter%' OR other_tags LIKE '%high_ropes%'"
    )
    frame = pyogrio.read_dataframe(PBF, layer=layer, where=query)
    for _, r in frame.iterrows():
      if r.geometry is None or r.geometry.is_empty:
        continue
      meta = tags(r.other_tags)
      for k in ("name", "leisure", "building", "amenity", "landuse", "sport"):
        if k in r and isinstance(r[k], str):
          meta[k] = r[k]
      geometry = transform(PROJECTION, r.geometry)
      if not berlin.intersects(geometry):
        continue
      keep = {
        k: v
        for k, v in meta.items()
        if k
        in (
          "name",
          "operator",
          "brand",
          "leisure",
          "sport",
          "building",
          "height",
          "building:levels",
          "roof:shape",
          "roof:material",
          "roof:colour",
          "building:material",
          "building:colour",
          "swimming_pool",
          "indoor",
          "location",
          "covered",
          "lanes",
          "length",
          "width",
          "surface",
          "access",
          "website",
          "contact:website",
          "disused:leisure",
          "construction",
          "old_name",
        )
        or k.startswith("addr:")
      }
      identity = (
        "node/" + str(r.osm_id)
        if layer == "points"
        else "way/" + str(r.osm_way_id)
        if isinstance(r.osm_way_id, str)
        else "relation/" + str(r.osm_id)
      )
      rows.append(
        dict(
          id=identity,
          tags=keep,
          geometry=mapping(
            transform(lambda x, y, z=None: (x - 389500, 5820000 - y), geometry)
          ),
        )
      )
  write(
    OSM,
    dict(
      schemaVersion=1,
      source=dict(
        path=str(PBF.relative_to(ROOT)),
        sha256=sha(PBF.read_bytes()),
        url="https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf",
        license="ODbL-1.0",
      ),
      records=rows,
    ),
  )
  print("OSM sporting objects", len(rows))


if __name__ == "__main__":
  p = argparse.ArgumentParser()
  p.add_argument("--fetch", action="store_true")
  p.add_argument("--osm", action="store_true")
  a = p.parse_args()
  if a.fetch:
    fetch()
  if a.osm:
    osm()
