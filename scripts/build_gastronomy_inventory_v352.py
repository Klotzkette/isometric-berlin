"""Reconcile primary public restaurant identities with exact mapped Berlin records.

Identity/current-directory facts do not establish a surveyed shopfront. All input
identities retain an explicit outcome; unavailable/indoor/historical sites receive
no invented exterior. Source photographs are audit references, never runtime assets.
"""

from collections import Counter
from pathlib import Path

from shapely.geometry import Point, shape

from scripts.build_mcdonalds_inventory_v351 import (
  PROJECTION,
  boundary,
  read,
  sha,
  write,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "gastronomy-v352-source.json.gz"
OSM = GEO / "gastronomy-v352-osm.json.gz"
INVENTORY = GEO / "gastronomy-v352-inventory.json.gz"


def build():
  source = read(SOURCE)
  mapped = read(OSM)
  byid = {r["id"]: r for r in mapped["records"]}
  berlin = boundary()
  records = []
  used = set()
  for s in source["records"]:
    row = dict(s)
    m = byid.get(s.get("mappedId"))
    row["officialId"] = s["id"]
    row["postcode"] = ""
    row["street"] = s["address"]
    row["mappedTags"] = {}
    if m:
      used.add(m["id"])
      g = shape(m["geometry"])
      p = g.centroid
      if not berlin.covers(p):
        row["preOutcome"] = "mapped-point-outside-berlin-state"
      row.update(
        easting=p.x,
        northing=p.y,
        mappedTags=m["tags"],
        mappedGeometryType=g.geom_type,
        geometry=m["geometry"],
      )
      row["postcode"] = m["tags"].get("addr:postcode", "")
      row["evidence"] = {
        "level": m["tags"].get("level"),
        "identity": "manually-reconciled-operator-address-and-same-brand-mapped-site",
        "photoReference": s.get("photo"),
      }
      if "directoryPoint" in s:
        q = Point(*PROJECTION(*s["directoryPoint"]))
        row["directoryPointOffsetMetres"] = round(q.distance(p), 3)
        if q.distance(p) > 200:
          row["preOutcome"] = "directory-coordinate-conflict-manual-review-required"
    else:
      row["preOutcome"] = row.get("preOutcome") or "mapped-source-location-unresolved"
    records.append(row)
  # Retain unmatched chain observations; a map tag is not proof of operation.
  for m in mapped["records"]:
    n = m["tags"].get("name", "").casefold()
    cat = (
      "burger-king"
      if "burger king" in n
      else "starbucks"
      if "starbucks" in n
      else "einstein-kaffee"
      if "einstein" in n
      else None
    )
    if not cat or m["id"] in used or not berlin.covers(shape(m["geometry"]).centroid):
      continue
    p = shape(m["geometry"]).centroid
    records.append(
      dict(
        id="mapped-only/" + m["id"],
        category=cat,
        name=m["tags"]["name"],
        officialId=None,
        mappedId=m["id"],
        mappedTags=m["tags"],
        geometry=m["geometry"],
        easting=p.x,
        northing=p.y,
        street=m["tags"].get("addr:street", ""),
        postcode=m["tags"].get("addr:postcode", ""),
        preOutcome="mapped-only-current-operator-identity-unconfirmed",
      )
    )
  assert len({r["id"] for r in records}) == len(records)
  out = dict(
    schemaVersion=1,
    checked=source["checked"],
    sourceFiles={str(p.relative_to(ROOT)): sha(p.read_bytes()) for p in [SOURCE, OSM]},
    sourceScope=source["sources"],
    records=sorted(records, key=lambda r: r["id"]),
    counts={
      "primaryAndExplicitHistoricalRecords": len(source["records"]),
      "mappedOnlyRecords": len(records) - len(source["records"]),
      "total": len(records),
      "categories": dict(Counter(r["category"] for r in records)),
      "preliminaryOutcomes": dict(
        Counter(
          r.get("preOutcome") or "candidate-for-independent-wall-proof" for r in records
        )
      ),
    },
  )
  write(INVENTORY, out)
  print(out["counts"])


if __name__ == "__main__":
  build()
