"""Reconcile a pinned Berlin OSM extract with public shopping centre pages.

Run from the repository with ``uv run --with osmium --with beautifulsoup4
python -m scripts.build_retail_inventory_v355 WORKSPACE``. Raw results stay in
WORKSPACE; only the bounded reconciled source belongs in the repository.
"""

from __future__ import annotations

import argparse
import json
import re
import unicodedata
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path
from urllib.parse import urljoin

import osmium
import pyogrio
from bs4 import BeautifulSoup
from pyproj import Transformer
from requests import RequestException
from shapely import wkb
from shapely.geometry import Point, mapping, shape
from shapely.ops import transform
from shapely.strtree import STRtree

from scripts.build_mcdonalds_inventory_v351 import (
  BOUNDARY,
  GEO,
  PROJECTION,
  ROOT,
  boundary,
  download,
  read,
  sha,
  write,
)
from scripts.build_mcdonalds_inventory_v351 import (
  tags as ogr_tags,
)

PORTAL = "https://www.berlin.de/special/shopping/einkaufscenter/"
PBF_URL = "https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf"
SOURCE = GEO / "retail-v355-source.json.gz"
APPEARANCE = GEO / "retail-v355-appearance.json"
CATEGORIES = {"mall": "mall", "car": "car-dealer"}
KEEP_TAGS = (
  "shop",
  "name",
  "official_name",
  "alt_name",
  "operator",
  "brand",
  "building",
  "addr:street",
  "addr:housenumber",
  "addr:postcode",
  "addr:place",
  "entrance",
  "level",
  "layer",
  "indoor",
  "building:material",
  "building:colour",
  "building:levels",
  "roof:shape",
  "roof:colour",
  "access",
  "service",
  "sales",
  "car:sales",
  "disused",
  "vacant",
  "repair",
  "second_hand",
)
BACK = Transformer.from_crs(25833, 4326, always_xy=True).transform


def tags(element):
  return {k: element.tags[k] for k in KEEP_TAGS if k in element.tags}


def osm_id(kind, id):
  return f"{kind}/{id}"


def osm_url(ident):
  return f"https://www.openstreetmap.org/{ident}"


class Extract(osmium.SimpleHandler):
  def __init__(self):
    super().__init__()
    self.factory = osmium.geom.WKBFactory()
    self.retail = {}
    self.entrances = []
    self.badAreas = []

  def node(self, node):
    name = node.tags.get("shop")
    if not node.location.valid():
      return
    p = Point(node.location.lon, node.location.lat)
    ident = osm_id("node", node.id)
    if name in CATEGORIES:
      self.retail[ident] = dict(id=ident, tags=tags(node), geometry=mapping(p))
    if node.tags.get("entrance") in ("main", "yes", "shop", "public", "entrance"):
      self.entrances.append(dict(id=ident, tags=tags(node), geometry=mapping(p)))

  def area(self, area):
    if area.tags.get("shop") not in CATEGORIES:
      return
    ident = osm_id("way" if area.from_way() else "relation", area.orig_id())
    try:
      geom = wkb.loads(self.factory.create_multipolygon(area), hex=True)
    except (ValueError, RuntimeError):
      self.badAreas.append(
        dict(id=ident, reason="unassembled-mapped-area", tags=tags(area))
      )
      return
    self.retail[ident] = dict(id=ident, tags=tags(area), geometry=mapping(geom))


def source_osm(workspace):
  cache = workspace / "retail-osm.json.gz"
  if cache.exists():
    return read(cache)
  pbf = workspace / "berlin-latest.osm.pbf"
  with osmium.io.Reader(str(pbf)) as reader:
    header = reader.header()
    timestamp = header.get("osmosis_replication_timestamp")
    sequence = header.get("osmosis_replication_sequence_number")
  handler = Extract()
  handler.apply_file(str(pbf), locations=True)
  berlin = boundary()
  rows = []
  excluded = []
  for row in handler.retail.values():
    geom = shape(row["geometry"])
    geographic_point = (
      geom if geom.geom_type == "Point" else geom.representative_point()
    )
    if not berlin.covers(Point(*PROJECTION(geographic_point.x, geographic_point.y))):
      excluded.append(row["id"])
      continue
    rows.append(row)
  relevant_entrances = []
  venue_poses = [transform(PROJECTION, shape(r["geometry"])).buffer(45) for r in rows]
  tree = STRtree(venue_poses)
  for entrance in handler.entrances:
    p = transform(PROJECTION, shape(entrance["geometry"]))
    if tree.query(p, predicate="intersects").size:
      relevant_entrances.append(entrance)
  data = dict(
    source=PBF_URL,
    snapshot=timestamp,
    replicationSequence=sequence,
    pbfSha256=sha(pbf.read_bytes()),
    records=rows,
    entrances=relevant_entrances,
    badAreas=handler.badAreas,
    outsideBerlin=sorted(excluded),
  )
  write(cache, data)
  return data


def parse_portal_page(item):
  name, url, page = item
  soup = BeautifulSoup(page, "html.parser")
  marker = soup.select_one("[data-marker-long][data-marker-lat]")
  coords = None
  if marker:
    try:
      coords = [float(marker["data-marker-long"]), float(marker["data-marker-lat"])]
    except ValueError:
      pass
  address = ""
  for script in soup.select('script[type="application/ld+json"]'):
    try:
      obj = json.loads(script.get_text())
    except ValueError:
      continue
    if isinstance(obj, dict) and isinstance(obj.get("address"), dict):
      addr = obj["address"]
      address = ", ".join(
        str(x) for x in (addr.get("streetAddress"), addr.get("postalCode")) if x
      )
      break
  return dict(name=name, sourceUrl=url, coords=coords, address=address)


def source_portal(workspace):
  cache = workspace / "retail-portal.json"
  if cache.exists():
    snapshot = read(cache)
    if "checkedAt" in snapshot and not any(
      "fetchIssue" in r for r in snapshot["records"]
    ):
      return snapshot
  index = workspace / "berlin-malls.html"
  if not index.exists():
    index.write_bytes(download(PORTAL))
  page = index.read_bytes()
  soup = BeautifulSoup(page, "html.parser")
  links = {
    urljoin(PORTAL, a["href"]): a.get_text(" ", strip=True)
    for a in soup.select("article h3.title a[href]")
    if "-1724954-" in a["href"]
  }
  if not 25 <= len(links) <= 100:
    raise ValueError(f"Unexpected shopping directory structure: {len(links)}")

  def one(item):
    url, name = item
    snapshot = workspace / f"portal-{re.search(r'/(\d+)-1724954-', url)[1]}.html"
    try:
      if not snapshot.exists():
        snapshot.write_bytes(download(url))
      return parse_portal_page((name, url, snapshot.read_bytes()))
    except RequestException as error:
      return dict(
        name=name,
        sourceUrl=url,
        coords=None,
        address="",
        fetchIssue=type(error).__name__,
      )

  with ThreadPoolExecutor(max_workers=2) as pool:
    data = list(pool.map(one, links.items()))
  value = {
    "records": data,
    "indexSha256": sha(page),
    "checkedAt": date.today().isoformat(),
  }
  write(cache, value)
  return value


def normal(value):
  value = unicodedata.normalize("NFKD", value.casefold().replace("ß", "ss"))
  return "".join(c for c in value if c.isascii() and c.isalnum())


def label(row):
  return next(
    (
      row["tags"].get(k)
      for k in ("name", "official_name", "brand", "operator")
      if row["tags"].get(k)
    ),
    "",
  )


def tagged_address(row):
  t = row["tags"]
  street = t.get("addr:street") or t.get("addr:place")
  return ", ".join(
    x
    for x in (
      " ".join(x for x in (street, t.get("addr:housenumber")) if x),
      t.get("addr:postcode"),
    )
    if x
  )


def retired(row):
  t = row["tags"]
  return (
    t.get("disused") == "yes"
    or t.get("vacant") == "yes"
    or t.get("car:sales") == "no"
    or t.get("sales") == "no"
  )


def entrance_refs(rows, entrance_rows):
  shapes = [
    shape(a["geometry"]) for a in rows if shape(a["geometry"]).geom_type != "Point"
  ]
  if not shapes:
    return []
  refs = []
  for entrance in entrance_rows:
    t = entrance["tags"]
    if (
      t.get("access") in ("private", "no")
      or t.get("indoor") == "yes"
      or t.get("level") not in (None, "0", "G")
    ):
      continue
    pt = shape(entrance["geometry"])
    if all(s.boundary.distance(pt) > 0.00000025 for s in shapes):
      continue
    refs.append(
      dict(lon=pt.x, lat=pt.y, kind=t["entrance"], sourceUrl=osm_url(entrance["id"]))
    )
  return sorted(refs, key=lambda r: (r["kind"] != "main", r["sourceUrl"]))


# Names below have specific alternative spellings or building components in the
# municipal directory and current OSM snapshot. Proximity still gates merges.
MALL_ALIASES = {
  "ringcenter1": "ringcenter",
  "ringcenter2": "ringcenter",
  "ringcenter3": "ringcenter",
  "ringcenterberlinii": "ringcenter",
  "cittipoint": "cittipoint",
  "citypointcenter": "cittipoint",
  "spreecenterhellersdorf": "spreecenter",
  "eastgateberlin": "eastgate",
  "lindencenterberlin": "lindencenter",
  "einkaufszentrumderclou": "derclou",
  "tierparkcenterberlin": "tierparkcenter",
  "parkcenteramtreptowerpark": "parkcentertreptow",
  "parkcenter": "parkcentertreptow",
  "einkaufszentrumadlershofertor": "adlershofertor",
  "talcentermarzahn": "talcenter",
  "marktplatzcenterhellersdorf": "marktplatzcenter",
}
NON_MALL = {
  "bahnhoflichtenberg": "railway-station-with-retail",
  "marzahnerpromenade": "shopping-street-or-unconfirmed-component",
  "fussgangerzonemarzahnerpromenade": "shopping-street",
  "ackerhalle": "market-hall",
  "marheinekemarkthalle": "market-hall",
  "markthalletempelhof": "market-hall",
  "furst": "mixed-use-redevelopment-project-not-an-open-mall",
  "zoom": "office-and-retail-site-outside-mall-scope",
}
# Active operator pages tied to this mapped identity/address. These checks
# establish operation and address, not the surveyed nature of a facade.
VERIFIED_RETAIL = {
  "way/268407747": (
    "BMW Niederlassung Kaiserdamm",
    "Kaiserdamm 90, 14057",
    "https://www.bmw.de/de/partner/berlin-00081.html",
  ),
  "way/704099996": (
    "Mercedes-Benz Welt am Salzufer",
    "Salzufer 1, 10587",
    "https://www.mercedes-benz-berlin.de/",
  ),
  "way/89721010": (
    "Porsche Zentrum Berlin",
    "Franklinstraße 23, 10587",
    "https://berlin.porsche.de/de",
  ),
  "way/194952966": (
    "Boulevard Berlin",
    "Schloßstraße 10, 12163",
    "https://www.boulevardberlin.de/oeffnungszeiten-anfahrt",
  ),
  "way/258898047": ("ALEXA", "Grunerstraße 20, 10179", "https://www.alexacentre.com/"),
}


def mall_key(name):
  key = normal(name.split(" (", 1)[0])
  return MALL_ALIASES.get(key, key)


def dealer_identity(row):
  t = row["tags"]
  return {
    normal(t.get(k, ""))
    for k in ("name", "brand", "official_name", "alt_name", "operator")
  } - {""}


def retail_groups(rows):
  geoms = [transform(PROJECTION, shape(r["geometry"])) for r in rows]
  roots = list(range(len(rows)))

  def root(i):
    while roots[i] != i:
      i = roots[i]
    return i

  for i, (a, ga) in enumerate(zip(rows, geoms, strict=True)):
    for j in range(i):
      b, gb = rows[j], geoms[j]
      if a["tags"]["shop"] != b["tags"]["shop"]:
        continue
      if a["tags"]["shop"] == "mall":
        same_named_centre = mall_key(label(a)) == mall_key(label(b))
        threshold = (
          85 if same_named_centre and mall_key(label(a)) == "ringcenter" else 35
        )
        same = same_named_centre and ga.distance(gb) <= threshold
      else:
        aa, bb = normal(tagged_address(a)), normal(tagged_address(b))
        same_full_address = bool(
          aa
          and aa == bb
          and a["tags"].get("addr:housenumber")
          and b["tags"].get("addr:housenumber")
        )
        same_identity = bool(dealer_identity(a) & dealer_identity(b))
        # Exact nested/contained components or the same full address, with
        # shared named/brand identity. Adjacent competitors remain separate.
        same = same_identity and (
          ga.intersects(gb) or (same_full_address and ga.distance(gb) <= 75)
        )
      if same:
        roots[root(i)] = root(j)
  groups = {}
  for i, row in enumerate(rows):
    groups.setdefault(root(i), []).append(row)
  return list(groups.values())


def choose_primary(group):
  return sorted(
    group,
    key=lambda r: (
      r["id"] not in VERIFIED_RETAIL,
      shape(r["geometry"]).geom_type == "Point",
      not r["tags"].get("building"),
      not tagged_address(r),
      -shape(r["geometry"]).area,
      r["id"],
    ),
  )[0]


def match_portal(group, portal_rows):
  if group[0]["tags"]["shop"] != "mall":
    return None
  labels = {mall_key(label(r)) for r in group}
  hits = [r for r in portal_rows if mall_key(r["name"]) in labels]
  matches = []
  for match in hits:
    if match["coords"]:
      p = Point(*PROJECTION(*match["coords"]))
      distance = min(
        transform(PROJECTION, shape(r["geometry"])).distance(p) for r in group
      )
      if distance > 180:
        continue
    else:
      distance = 180
    matches.append((distance, match))
  return min(matches, key=lambda a: a[0])[1] if matches else None


def combine_retail(osm, portal):
  berlin = boundary()
  unresolved = [dict(row) for row in osm["badAreas"]]
  candidates = []
  for row in osm["records"]:
    n = label(row)
    reason = (
      "no-source-name-or-brand"
      if not n
      else "not-source-tagged-for-current-car-sales-or-open-retail"
      if retired(row)
      else NON_MALL.get(mall_key(n))
      if row["tags"]["shop"] == "mall"
      else None
    )
    if reason:
      unresolved.append(
        dict(
          id=row["id"],
          name=n,
          kind=CATEGORIES[row["tags"]["shop"]],
          reason=reason,
          sourceUrl=osm_url(row["id"]),
          geometry=row["geometry"],
          tags=row["tags"],
        )
      )
    else:
      candidates.append(row)

  matched_portal = set()
  sites = []
  for group in retail_groups(candidates):
    r = choose_primary(group)
    match = match_portal(group, portal["records"])
    point = shape(r["geometry"]).representative_point()
    operator = VERIFIED_RETAIL.get(r["id"])
    if match:
      matched_portal.add(match["sourceUrl"])
    n = operator[0] if operator else label(r)
    address = (
      operator[1]
      if operator
      else tagged_address(r) or (match["address"] if match else "")
    )
    src = (
      operator[2] if operator else (match["sourceUrl"] if match else osm_url(r["id"]))
    )
    site = dict(
      id="osm/" + r["id"],
      kind=CATEGORIES[r["tags"]["shop"]],
      name=n,
      lon=point.x,
      lat=point.y,
      address=address,
      sourceUrl=src,
      geometry=r["geometry"],
      mappedId=r["id"],
      mappedTags=r["tags"],
      venueSources=[
        dict(
          id=row["id"],
          url=osm_url(row["id"]),
          geometry=row["geometry"],
          tags=row["tags"],
        )
        for row in sorted(group, key=lambda q: q["id"])
      ],
      identityEvidence="operator-and-OSM"
      if operator
      else "Berlin.de-directory-and-OSM"
      if match
      else "OSM-mapped-use-only",
    )
    refs = entrance_refs(group, osm["entrances"])
    if refs:
      site["mappedEntrances"] = refs
      primary = [ref for ref in refs if ref["kind"] == "main"]
      if len(primary) == 1:
        site["entrance"] = primary[0]
      elif len(refs) == 1:
        site["entrance"] = refs[0]
    if match:
      site["directory"] = match
      if mall_key(match["name"]) == "ringcenter":
        site["name"] = match["name"]
    sites.append(site)
  # Municipal points belong to specific addresses, but are not equivalent to
  # surveyed building-outline or entrance geometry.
  for row in portal["records"]:
    if row["sourceUrl"] in matched_portal:
      continue
    reason = NON_MALL.get(mall_key(row["name"]))
    if (
      not reason
      and row["coords"]
      and row["address"]
      and berlin.covers(Point(*PROJECTION(*row["coords"])))
    ):
      idx = re.search(r"/(\d+)-1724954-", row["sourceUrl"])[1]
      sites.append(
        dict(
          id="berlin-directory/" + idx,
          kind="mall",
          name=row["name"],
          lon=row["coords"][0],
          lat=row["coords"][1],
          address=row["address"],
          sourceUrl=row["sourceUrl"],
          identityEvidence="Berlin.de-directory-point",
        )
      )
    else:
      unresolved.append(
        dict(
          row, kind="mall", reason=reason or "directory-address-or-geometry-unresolved"
        )
      )
  # A shared tagged node at a joint between two venues does not identify
  # the frontage of either one. Keep the node as an observation, not an anchor.
  ambiguous_entrances = Counter(
    ref["sourceUrl"] for site in sites for ref in site.get("mappedEntrances", [])
  )
  for site in sites:
    if "entrance" in site and ambiguous_entrances[site["entrance"]["sourceUrl"]] > 1:
      del site["entrance"]
  appearance = read(APPEARANCE) if APPEARANCE.exists() else {}
  for site in sites:
    if site["id"] in appearance:
      site["facadeReference"] = appearance[site["id"]]
  counts = dict(
    sites=dict(Counter(r["kind"] for r in sites)),
    identity=dict(Counter(r["identityEvidence"] for r in sites)),
    mappedExteriorEntrance=sum("entrance" in r for r in sites),
    unresolved=dict(Counter(r["reason"] for r in unresolved)),
  )
  return dict(
    schemaVersion=1,
    checkedAt=portal["checkedAt"],
    counts=counts,
    sources=[
      dict(url=PORTAL, sha256=portal["indexSha256"], credit="Berlin.de directory"),
      dict(
        url=PBF_URL,
        sha256=osm["pbfSha256"],
        snapshot=osm["snapshot"],
        credit="© OpenStreetMap contributors, ODbL. Geofabrik extract",
      ),
      dict(
        path=str(BOUNDARY.relative_to(ROOT)),
        sha256=sha(BOUNDARY.read_bytes()),
        credit="Berlin official state boundary, Geoportal Berlin",
      ),
    ],
    outsideBerlin=osm["outsideBerlin"],
    directory=portal["records"],
    sites=sorted(sites, key=lambda r: (r["kind"], r["id"])),
    unresolved=unresolved,
  )


def attach_mapped_buildings(inventory, pbf):
  """Bind only an explicit shop-building tag or one exact mapped containment.

  Business areas can include rows of used cars or an entire multi-occupancy
  campus. Their polygon is a distinct observation, never a building outline.
  """
  sites = inventory["sites"]
  missing = []
  for site in sites:
    primary = next(
      (
        row for row in site.get("venueSources", []) if row["id"] == site.get("mappedId")
      ),
      None,
    )
    if (
      primary
      and primary["tags"].get("building") not in (None, "no", "roof", "construction")
      and primary["geometry"]["type"] != "Point"
    ):
      site["buildingGeometry"] = primary["geometry"]
      site["osmBuildingId"] = primary["id"]
      site["buildingEvidence"] = "exact-venue-element-tagged-building"
    else:
      missing.append(site)
  if not missing:
    return
  points = [Point(site["lon"], site["lat"]) for site in missing]
  # Pass the exact point envelope, then perform a vectorized containment test.
  # A wider nearest-building heuristic would conflate neighboring dealers.
  bounds = (
    min(p.x for p in points),
    min(p.y for p in points),
    max(p.x for p in points),
    max(p.y for p in points),
  )
  buildings = pyogrio.read_dataframe(
    pbf,
    layer="multipolygons",
    bbox=bounds,
    columns=["osm_id", "osm_way_id", "building", "other_tags"],
    where="building IS NOT NULL AND building NOT IN ('no','roof','construction')",
  )
  shapes = buildings.geometry.to_numpy()
  tree = STRtree(shapes)
  for site, point in zip(missing, points, strict=True):
    hits = tree.query(point, predicate="within")
    # An OSM-only area representative point does not identify a tenant's
    # building. Only a POS point or official address point can justify this
    # join, and only when there is one candidate footprint.
    if len(hits) != 1 or site.get("geometry", {}).get("type") not in (None, "Point"):
      continue
    row = buildings.iloc[hits[0]]
    if not row.geometry.is_valid:
      continue
    ident = f"way/{row.osm_way_id}" if row.osm_way_id else f"relation/{row.osm_id}"
    if not re.fullmatch(r"(way|relation)/[0-9]+", ident):
      continue
    site["buildingGeometry"] = mapping(row.geometry)
    site["osmBuildingId"] = ident
    site["buildingEvidence"] = "unique-exact-poi-containment"
    t = ogr_tags(row.other_tags)
    if not site["address"] and t.get("addr:street") and t.get("addr:housenumber"):
      site["buildingAddressObservation"] = tagged_address({"tags": t})


def build(workspace, osm, portal):
  inventory = combine_retail(osm, portal)
  attach_mapped_buildings(inventory, workspace / "berlin-latest.osm.pbf")
  inventory["counts"]["buildingEvidence"] = dict(
    Counter(
      site.get("buildingEvidence", "no-exact-building") for site in inventory["sites"]
    )
  )
  write(SOURCE, inventory)
  print(inventory["counts"])


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("workspace", type=Path)
  parser.add_argument("--extract-only", action="store_true")
  args = parser.parse_args()
  osm = source_osm(args.workspace)
  portal = source_portal(args.workspace)
  print(
    "OSM",
    osm["snapshot"],
    Counter(r["tags"]["shop"] for r in osm["records"]),
    "entrances",
    len(osm["entrances"]),
  )
  print(
    "Berlin.de",
    len(portal["records"]),
    "locations",
    sum(bool(r["coords"]) for r in portal["records"]),
  )
  if not args.extract_only:
    build(args.workspace, osm, portal)


if __name__ == "__main__":
  main()
