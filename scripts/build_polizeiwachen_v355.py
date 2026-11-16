"""Compile the Berlin police station inventory from public location evidence.

Run with a local Geofabrik Berlin PBF. The WFS and exact address lookups are
read only. The optional directory/photo receipts are compact local evidence.
No contact information, photos or raw source distributions are shipped.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from pyproj import Transformer

ROOT = Path(__file__).resolve().parents[1]
GDI = "https://gdi.berlin.de/services/wfs/"
LAND = "https://www.berlin.de/polizei/dienststellen/landespolizeidirektion/"
FEDERAL = "https://bundespolizei.de/die-bundespolizei/dienststellensuche/"
WSP = LAND + "direktion-einsatz-verkehr/wasserschutzpolizei/artikel.431859.php"
WSP_ADDRESSES = "https://gdi.berlin.de/services/wfs/adressen_berlin"
WSP_DIRECTORY = "https://www.berlin.de/polizei/_assets/dienststellen/anlagen-dir-e/info_12_innenstadt.pdf"
OSM = "https://www.openstreetmap.org/"
OSM_BUILDINGS = {
  "W_17": "way/201855153",
  "W_28": "way/85248050",
  "W_41": "way/145796794",
  "W_52": "way/40955402",
  "W_54": "way/152197361",
}
OSM_ENTRANCES = {
  "W_17": ("node/2118738642", "main"),
  "W_28": ("node/988558147", "yes"),
  "W_41": ("node/3844571007", "main"),
  "W_52": ("node/9383604379", "yes"),
  "W_54": ("node/5435201911", "main"),
}
OSM_RAIL_STOREFRONTS = {
  "bundespolizei-ostbf": "node/1288824514",
  "bundespolizei-lichtenberg": "node/509897018",
  "bundespolizei-zoo": "node/11568947841",
  "bundespolizei-friedrichstr": "way/336068064",
  "bundespolizei-suedkreuz": "way/381240717",
}
REQUIRED_OSM = {
  "way/547670250",
  "node/10671508605",
  *OSM_BUILDINGS.values(),
  *OSM_RAIL_STOREFRONTS.values(),
  *(key for key, _ in OSM_ENTRANCES.values()),
}
FUSIONS = {
  17: ("17/18", "regionalabschnitt-17-18"),
  18: ("17/18", "regionalabschnitt-17-18"),
  27: ("27/28", "abschnitt-27"),
  28: ("27/28", "abschnitt-27"),
  52: ("52/53", "abschnitt-53"),
  53: ("52/53", "abschnitt-53"),
}

# Explicit street and number keys come from each linked public directory.
# An address point is not substituted for an independently located entrance.
SUPPLEMENT = [
  (
    "polizei-berlin-hq",
    "Polizeipräsidium Berlin",
    "headquarters",
    "Platz der Luftbrücke",
    6,
    "",
    "12101",
    "https://www.berlin.de/polizei/dienststellen/polizeipraesidium/",
  ),
  (
    "wsp-west",
    "Wasserschutzpolizei West",
    "water-police",
    "Mertensstraße",
    140,
    "",
    "13587",
    WSP,
  ),
  (
    "wsp-mitte",
    "Wasserschutzpolizei Mitte",
    "water-police",
    "Neues Ufer",
    1,
    "",
    "10553",
    WSP,
  ),
  (
    "wsp-ost",
    "Wasserschutzpolizei Ost",
    "water-police",
    "Baumschulenstraße",
    1,
    "",
    "12437",
    WSP,
  ),
  (
    "bundespolizei-hbf",
    "Bundespolizei Berlin Hauptbahnhof",
    "railway-revier",
    "Europaplatz",
    1,
    "",
    "10557",
    FEDERAL + "bundespolizeiinspektion-berlin-hauptbahnhof",
  ),
  (
    "bundespolizei-ostbf",
    "Bundespolizei Berlin Ostbahnhof",
    "railway-revier",
    "Koppenstraße",
    3,
    "",
    "10243",
    "https://www.bahnhof.de/berlin-ostbahnhof/bundespolizei",
  ),
  (
    "bundespolizei-inspektion-ostbf",
    "Bundespolizeiinspektion Berlin-Ostbahnhof",
    "federal-inspection",
    "Lange Straße",
    30,
    "",
    "10243",
    FEDERAL + "bundespolizeiinspektion-berlin-ostbahnhof",
  ),
  (
    "bundespolizei-lichtenberg",
    "Bundespolizeirevier Berlin-Lichtenberg",
    "railway-revier",
    "Weitlingstraße",
    22,
    "",
    "10317",
    FEDERAL + "bundespolizeirevier-berlin-lichtenberg",
  ),
  (
    "bundespolizei-zoo",
    "Bundespolizeirevier Zoologischer Garten",
    "railway-revier",
    "Hardenbergplatz",
    15,
    "",
    "10623",
    FEDERAL + "bundespolizeirevier-berlin-bahnhof-zoologischer-garten",
  ),
  (
    "bundespolizei-suedkreuz",
    "Bundespolizeirevier Berlin-Südkreuz",
    "railway-revier",
    "General-Pape-Straße",
    1,
    "",
    "12101",
    FEDERAL + "bundespolizeirevier-berlin-suedkreuz",
  ),
  (
    "bundespolizei-spandau",
    "Bundespolizeirevier Berlin-Spandau",
    "railway-revier",
    "Seegefelder Straße",
    1,
    "",
    "13597",
    FEDERAL + "bundespolizeirevier-berlin-spandau",
  ),
  (
    "bundespolizei-friedrichstr",
    "Bundespolizeirevier Berlin-Friedrichstraße",
    "railway-revier",
    "Georgenstraße",
    23,
    "",
    "10117",
    FEDERAL + "bundespolizeirevier-berlin-friedrichstrasse",
  ),
  (
    "bundespolizei-direktion",
    "Bundespolizeidirektion Berlin",
    "headquarters",
    "Schnellerstraße",
    139,
    "A",
    "12439",
    "https://bundespolizei.de/die-bundespolizei/organisation/bundespolizeidirektion-berlin",
  ),
]


def wfs_url(layer: str, feature: str, **extra: str) -> str:
  params = {
    "service": "WFS",
    "version": "2.0.0",
    "request": "GetFeature",
    "typeNames": feature,
    "srsName": "urn:ogc:def:crs:OGC:1.3:CRS84",
    "outputFormat": "application/json",
    **extra,
  }
  return GDI + layer + "?" + urlencode(params)


def collect_osm(path: Path) -> dict:
  import osmium

  class Police(osmium.SimpleHandler):
    def __init__(self):
      super().__init__()
      self.features = {}

    def node(self, node):
      if f"node/{node.id}" in REQUIRED_OSM:
        self.features[f"node/{node.id}"] = {
          "coord": [node.location.lon, node.location.lat],
          "tags": dict(node.tags),
        }

    def way(self, way):
      if f"way/{way.id}" not in REQUIRED_OSM:
        return
      try:
        ring = [[node.location.lon, node.location.lat] for node in way.nodes]
      except osmium.InvalidLocationError:
        return
      self.features[f"way/{way.id}"] = {
        "ring": ring,
        "nodes": [node.ref for node in way.nodes],
        "tags": dict(way.tags),
      }

  handler = Police()
  handler.apply_file(str(path), locations=True, idx="flex_mem")
  return handler.features


def build(scratch: Path, osm: dict, asof: str, osm_asof: str) -> dict:
  urls = {}
  sha = {}

  def json_source(file: str, url: str) -> dict:
    target = scratch / file
    if not target.is_file():
      with urlopen(url, timeout=20) as response:
        content = response.read(2_000_000)
      json.loads(content)
      target.write_bytes(content)
    raw = target.read_bytes()
    urls[file] = url
    # Geoserver timeStamp is request-specific; pin the source records.
    data = json.loads(raw)
    canonical = json.dumps(
      data["features"], ensure_ascii=False, sort_keys=True, separators=(",", ":")
    )
    sha[file] = hashlib.sha256(canonical.encode()).hexdigest()
    return data

  official = json_source("wachen.json", wfs_url("polizei", "polizei:a_polizei_wachen"))
  assert official["numberMatched"] == len(official["features"])
  sites = []
  issues = []
  for point in official["features"]:
    p = point["properties"]
    num = int(p["gisid"].split("_")[1])
    d = num // 10
    group, slug = FUSIONS.get(num, (None, f"abschnitt-{num}"))
    name = (
      f"Polizeiabschnitt {num}"
      if group is None
      else f"Polizei-Wachstelle {num} · Regionalabschnitt {group}"
    )
    lon, lat = point["geometry"]["coordinates"]
    address_num = p["hausnummer"]
    if num == 53:
      address_num = "219/220"
    sites.append(
      {
        "id": p["gisid"],
        "kind": "police",
        "name": name,
        "lon": lon,
        "lat": lat,
        "address": f"{p['strasse']} {address_num}, {p['postleitzahl']} Berlin",
        "sourceUrl": f"{LAND}direktion-{d}/{slug}/",
        "directoryUnit": group or str(num),
        "subtype": "section-station",
        "coordinateSource": point["id"],
        "anchorType": "official-station-point",
      }
    )
  for id_, name, subtype, road, number, suffix, plz, website in SUPPLEMENT:
    condition = f"str_name='{road}' AND hnr={number} AND plz='{plz}'"
    if suffix:
      condition += f" AND hnr_zusatz ILIKE '{suffix}'"
    data = json_source(
      f"address-{id_}.json",
      wfs_url(
        "adressen_berlin", "adressen_berlin:adressen_berlin", cql_filter=condition
      ),
    )
    address = f"{road} {number}{suffix}, {plz} Berlin"
    matches = [
      feature
      for feature in data["features"]
      if (feature["properties"].get("hnr_zusatz") or "").casefold() == suffix.casefold()
    ]
    if len(matches) != 1:
      issues.append(
        {
          "id": id_,
          "name": name,
          "address": address,
          "sourceUrl": website,
          "reason": "Exact official house-coordinate lookup did not return one unique feature.",
        }
      )
      continue
    f = matches[0]
    p = f["properties"]
    assert p["str_name"] == road and p["hnr"] == number and p["plz"] == plz
    lon, lat = f["geometry"]["coordinates"]
    sites.append(
      {
        "id": id_,
        "kind": "police",
        "name": name,
        "lon": lon,
        "lat": lat,
        "address": address,
        "sourceUrl": website,
        "subtype": subtype,
        "coordinateSource": f["id"],
        "anchorType": "official-house-coordinate",
        **({"sharedBuilding": True} if subtype == "railway-revier" else {}),
      }
    )

  from shapely.geometry import Polygon

  kiosk = osm["way/547670250"]
  kotti = osm["node/10671508605"]
  assert kiosk["tags"]["amenity"] == "police" and kotti["tags"]["amenity"] == "police"
  centroid = Polygon(kiosk["ring"]).centroid
  sites.extend(
    (
      {
        "id": "alexwache",
        "kind": "police",
        "name": "Alexwache · Nebenwache Alexanderplatz",
        "lon": round(centroid.x, 8),
        "lat": round(centroid.y, 8),
        "address": "Alexanderplatz 1, 10178 Berlin",
        "sourceUrl": LAND + "direktion-5/abschnitt-57-nebenwache-am-alexanderplatz/",
        "coordinateSource": OSM + "way/547670250",
        "anchorType": "mapped-police-building",
        "subtype": "district-substation",
        "buildingGeometry": {"type": "Polygon", "coordinates": [kiosk["ring"]]},
        "existingOwner": "OSM-way-547670250",
      },
      {
        "id": "kotti-wache",
        "kind": "police",
        "name": "Nebenwache am Kottbusser Tor",
        "lon": kotti["coord"][0],
        "lat": kotti["coord"][1],
        "address": "Adalbertstraße 3, 10999 Berlin",
        "sourceUrl": LAND + "direktion-5/abschnitt-53-nebenwache-am-kottbusser-tor/",
        "coordinateSource": OSM + "node/10671508605",
        "anchorType": "mapped-police-tenant",
        "subtype": "district-substation",
        "sharedBuilding": True,
        "storey": 1,
        "existingOwner": "DEBE02YY40001ISn",
      },
    )
  )
  cues = ROOT / "geo_data/regierungsviertel/polizeiwachen-v355-facades.json"
  evidence = json.loads(cues.read_text())
  projector = Transformer.from_crs("EPSG:4326", "EPSG:25833", always_xy=True)
  for s in sites:
    site = s["id"]
    if building_key := OSM_BUILDINGS.get(site):
      mapped = osm[building_key]
      polygon = Polygon(mapped["ring"])
      assert mapped["tags"].get("building") and polygon.is_valid
      s["buildingGeometry"] = {"type": "Polygon", "coordinates": [mapped["ring"]]}
      s["buildingSourceUrl"] = OSM + building_key
      door_key, kind = OSM_ENTRANCES[site]
      door = osm[door_key]
      assert (
        int(door_key.split("/")[1]) in mapped["nodes"]
        and door["tags"].get("entrance") == kind
      )
      s["entrance"] = {
        "lon": door["coord"][0],
        "lat": door["coord"][1],
        "sourceUrl": OSM + door_key,
        "type": kind,
      }
    if storefront_key := OSM_RAIL_STOREFRONTS.get(site):
      storefront = osm[storefront_key]
      assert (
        storefront["tags"].get("amenity") == "police"
        and storefront["tags"].get("operator") == "Bundespolizei"
      )
      loc = storefront.get("coord")
      if not loc:
        c = Polygon(storefront["ring"]).centroid
        loc = c.x, c.y
      s.update(
        lon=round(loc[0], 8),
        lat=round(loc[1], 8),
        coordinateSource=OSM + storefront_key,
        anchorType="mapped-police-tenant",
      )
      if level := storefront["tags"].get("level"):
        s["storey"] = int(level)
    east, north = projector.transform(s["lon"], s["lat"])
    s["worldXZ"] = [round(east - 389500, 3), round(5820000 - north, 3)]
    if s["id"] in evidence:
      s.update(evidence[s["id"]])
  assert len({s["id"] for s in sites}) == len(sites)
  return {
    "schemaVersion": 1,
    "checked": asof,
    "sites": sorted(sites, key=lambda site: site["id"]),
    "unresolved": issues,
    "sourceUrls": urls,
    "sourceFeatureSha256": sha,
    "directorySources": [
      LAND,
      WSP,
      WSP_DIRECTORY,
      FEDERAL,
      "https://www.bahnhof.de/berlin-ostbahnhof/bundespolizei",
    ],
    "osmSnapshot": osm_asof,
    "credits": [
      "Geoportal Berlin and Polizei Berlin · Datenlizenz Deutschland – Zero – Version 2.0",
      "© OpenStreetMap contributors · ODbL 1.0",
    ],
  }


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("scratch", type=Path)
  parser.add_argument("--osm-pbf", type=Path)
  parser.add_argument("--osm-snapshot", required=True)
  parser.add_argument("--checked", required=True)
  parser.add_argument(
    "--output",
    type=Path,
    default=ROOT / "geo_data/regierungsviertel/polizeiwachen-v355-source.json.gz",
  )
  args = parser.parse_args()
  args.scratch.mkdir(parents=True, exist_ok=True)
  evidence = args.scratch / "required-osm.json"
  if args.osm_pbf:
    mapped = collect_osm(args.osm_pbf)
    required = {k: mapped[k] for k in sorted(REQUIRED_OSM)}
    evidence.write_text(json.dumps(required, ensure_ascii=False, separators=(",", ":")))
  else:
    required = json.loads(evidence.read_text())
  result = build(args.scratch, required, args.checked, args.osm_snapshot)
  raw = json.dumps(
    result, ensure_ascii=False, sort_keys=True, separators=(",", ":")
  ).encode()
  args.output.write_bytes(gzip.compress(raw, compresslevel=9, mtime=0))
  print(
    len(result["sites"]),
    "sites;",
    len(result["unresolved"]),
    "unresolved;",
    args.output,
  )


if __name__ == "__main__":
  main()
