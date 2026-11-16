"""Rebuild the selected Berlin Döner locations against the frozen OSM extract."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

import osmium
from pyproj import Transformer
from shapely import wkb
from shapely.geometry import Point, mapping, shape
from shapely.ops import unary_union

GEO = Path(__file__).resolve().parents[1] / "geo_data/regierungsviertel"
SOURCE = GEO / "doener-v356-source.json.gz"
CURATION = GEO / "doener-v356-curation.json"
BOUNDARY = GEO / "berlin-boundaries-v200-source.json.gz"
GEOBERLIN = "https://download.geofabrik.de/europe/germany/berlin.html"
PBF_SHA256 = "aaa9292be3770db6dcf24165698c2dc821bba4b6f4911c81fe88936ec2375325"
KEEP = (
  "name",
  "amenity",
  "cuisine",
  "building",
  "entrance",
  "addr:street",
  "addr:housenumber",
  "addr:postcode",
  "check_date",
)


def osm_url(ref):
  return f"https://www.openstreetmap.org/{ref}"


def tags(element):
  return {key: element.tags[key] for key in KEEP if key in element.tags}


def extract(pbf, node_ids, area_refs):
  points, areas = {}, {}
  factory = osmium.geom.WKBFactory()
  objects = (
    osmium.FileProcessor(str(pbf))
    .with_locations()
    .with_areas()
    .with_filter(osmium.filter.KeyFilter("amenity", "building", "name", "entrance"))
  )
  for obj in objects:
    if obj.is_node() and obj.id in node_ids:
      assert obj.location.valid(), obj.id
      points[f"node/{obj.id}"] = ([obj.location.lon, obj.location.lat], tags(obj))
    elif obj.is_area():
      ref = f"{'way' if obj.from_way() else 'relation'}/{obj.orig_id()}"
      if ref in area_refs:
        geom = wkb.loads(factory.create_multipolygon(obj), hex=True)
        assert geom.is_valid and not geom.is_empty, ref
        areas[ref] = (geom, tags(obj))
  return points, areas


def build(pbf, output, curation):
  with pbf.open("rb") as f:
    sha = hashlib.file_digest(f, "sha256").hexdigest()
  if sha != PBF_SHA256:
    raise ValueError("Use the specified frozen Geofabrik Berlin snapshot")
  with osmium.io.Reader(str(pbf)) as reader:
    header = reader.header()
    timestamp = header.get("osmosis_replication_timestamp")
    sequence = header.get("osmosis_replication_sequence_number")
  selection = json.loads(curation.read_text())
  rows = selection["rows"]
  refs = [
    ref
    for (_, _, _, _, poi_ref, host_ref, details) in rows
    for ref in [poi_ref, host_ref, *details.get("otherOsmRefs", [])]
    if ref
  ]
  pts, areas = extract(
    pbf,
    {int(ref[5:]) for ref in refs if ref.startswith("node/")},
    {ref for ref in refs if not ref.startswith("node/")},
  )
  for ref in set(refs):
    if ref not in pts and ref not in areas:
      raise ValueError(f"Missing selected OSM item {ref}")
  berlin = unary_union(
    [
      shape(f["geometry"])
      for f in json.loads(gzip.decompress(BOUNDARY.read_bytes()))["state"]["features"]
    ]
  )
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform

  sites = []
  for ident, name, address, source, poi, host, details in sorted(rows):
    if poi.startswith("node/"):
      coords, evidence = pts[poi]
    else:
      geom, evidence = areas[poi]
      position = geom.representative_point()
      coords = [round(position.x, 8), round(position.y, 8)]
    assert evidence.get("name"), poi
    assert berlin.covers(Point(*project(*coords))), poi
    status = (
      "existing-owner"
      if details.get("existingOwner")
      else "exact-mapped-building"
      if host
      else "directory-only"
    )
    rec = dict(
      id=ident,
      kind="doner",
      name=name,
      address=address,
      lon=coords[0],
      lat=coords[1],
      sourceUrl=selection["sources"][source],
      osmRef=poi,
      osmUrl=osm_url(poi),
      osmTags=evidence,
      geometryStatus=status,
      **details,
    )
    if host:
      geom, host_tags = areas[host]
      assert host_tags.get("building") not in (None, "no", "roof"), (ident, host)
      assert geom.covers(Point(*coords)), (ident, host)
      rec.update(
        buildingGeometry=mapping(geom),
        buildingOsmRef=host,
        buildingSourceUrl=osm_url(host),
        buildingOsmTags=host_tags,
      )
    if details.get("otherOsmRefs"):
      rec["otherOsmEvidence"] = [
        dict(osmRef=ref, osmTags=pts[ref][1], lon=pts[ref][0][0], lat=pts[ref][0][1])
        for ref in details["otherOsmRefs"]
      ]
    sites.append(rec)
  assert len({r["id"] for r in sites}) == len(sites)
  assert len({r["osmRef"] for r in sites}) == len(sites)
  payload = dict(
    schemaVersion=1,
    verifiedOn="2026-11-16",
    source=GEOBERLIN,
    snapshot=timestamp,
    replicationSequence=sequence,
    pbfSha256=sha,
    osmLicence="https://www.openstreetmap.org/copyright",
    inclusionPolicy="Representative Berliner Dönerläden: official Berlin visitor references, individually verified operator branches and explicitly selected independent sites; selection, not a ranking or exhaustive register.",
    sites=sites,
    excluded=[dict(name=n, reason=r, sourceUrl=u) for n, r, u in selection["excluded"]],
  )
  raw = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  result = gzip.compress(raw, compresslevel=9, mtime=0)
  # CPython/zlib versions disagree on the platform byte for mtime=0.
  result = result[:9] + b"\xff" + result[10:]
  output.write_bytes(result)
  print(
    len(sites),
    dict(Counter(r["geometryStatus"] for r in sites)),
    len(result),
    hashlib.sha256(result).hexdigest(),
  )


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("pbf", type=Path)
  parser.add_argument("--output", type=Path, default=SOURCE)
  parser.add_argument("--curation", type=Path, default=CURATION)
  args = parser.parse_args()
  build(args.pbf, args.output, args.curation)


if __name__ == "__main__":
  main()
