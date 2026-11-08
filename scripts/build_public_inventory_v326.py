"""Step 10: account for every requested public-site and transport source.

This audit never rewrites earlier source packets. Official school locations,
OSM site/transport identities and existing rendered building owners remain
separate records; a point near a building is not proof of its architecture.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/public-fidelity-v326"
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True)
STATE_SOURCE = GEO / "raw/berlin-boundaries-v200/landesgrenze.geojson"
BASELINE_MANIFEST = GEO / "public-fidelity-v326-published206-manifest.json.gz"
BASELINE_MANIFEST_RAW_SHA256 = (
  "a0e6feb92ff3624360b207472c27b0d5006d389688ba1c78415af32746ba2d0e"
)
BASELINE_MANIFEST_GZIP_SHA256 = (
  "ceee82f26890dee86056dafc42c05b3b2eac8a68634b7eee151b41a2d7f72df8"
)


def published_manifest_raw() -> bytes:
  """Exact immutable published206 input; never read back our own new entries."""
  encoded = BASELINE_MANIFEST.read_bytes()
  if hashlib.sha256(encoded).hexdigest() != BASELINE_MANIFEST_GZIP_SHA256:
    raise ValueError("Changed immutable published206 manifest gzip")
  raw = gzip.decompress(encoded)
  if hashlib.sha256(raw).hexdigest() != BASELINE_MANIFEST_RAW_SHA256:
    raise ValueError("Changed immutable published206 manifest bytes")
  return raw


def published_manifest() -> dict[str, Any]:
  """Keep complete original descriptor metadata, order and source properties."""
  return json.loads(published_manifest_raw())


def read(path: Path) -> Any:
  """Read one complete retained JSON source."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def digest(path: Path) -> str:
  """Bind the full immutable input bytes."""
  h = hashlib.sha256()
  with path.open("rb") as stream:
    while block := stream.read(4 * 1024 * 1024):
      h.update(block)
  return h.hexdigest()


def tags(properties: dict[str, Any]) -> dict[str, str]:
  """Keep promoted OSM attributes and the complete hstore remainder."""
  return {
    **dict(
      re.findall(
        r'"([^"\\]+)"=>"((?:[^"\\]|\\.)*)"', properties.get("other_tags") or ""
      )
    ),
    **{k: v for k, v in properties.items() if isinstance(v, str) and k != "other_tags"},
  }


def world_geometry(value: Any, projected: bool = False) -> Any:
  """Use the existing source coordinate frame without moving source vertices."""
  g = shape(value)
  if not projected:
    g = transform(PROJECT.transform, g)
  return transform(lambda x, y, z=None: (x - 389500, 5820000 - y), g)


def osm_identity(properties: dict[str, Any], polygon: bool) -> str:
  """Preserve node/way/relation namespaces, including relation campuses."""
  if not polygon:
    return "node/" + str(properties["osm_id"])
  if properties.get("osm_way_id"):
    return "way/" + str(properties["osm_way_id"])
  return "relation/" + str(properties["osm_id"])


def sites() -> list[dict[str, Any]]:
  """Retain official main sites and every mapped relevant building/site."""
  result = []
  for f in read(RAW / "schulen-current.geojson")["features"]:
    p = f["properties"]
    g = world_geometry(f["geometry"], True)
    result.append(
      {
        "id": "school/" + p["bsn"],
        "category": "school",
        "name": p["schulname"],
        "source": "Geoportal Berlin Schulen",
        "schoolYear": p["schuljahr"],
        "schoolType": p["schulart"],
        "operatorType": p["traeger"],
        "address": f"{p['strasse']} {p['hausnr']}, {p['plz']} Berlin",
        "geometry": mapping(g),
        "role": "official main-site point, not a building footprint",
      }
    )
  for f in read(RAW / "institutions.geojson.gz")["features"]:
    p, t = f["properties"], tags(f["properties"])
    if t.get("amenity") == "courthouse":
      category = "court"
    elif t.get("tourism") == "museum" or t.get("building") == "museum":
      category = "museum"
    elif t.get("amenity") == "school" or t.get("building") == "school":
      category = "school"
    else:
      continue
    g = world_geometry(f["geometry"])
    result.append(
      {
        "id": category + ":" + osm_identity(p, True),
        "sourceIdentity": osm_identity(p, True),
        "category": category,
        "name": t.get("name", ""),
        "source": "OpenStreetMap retained 2026-09-29",
        "tags": t,
        "geometry": mapping(g),
        "role": "mapped building"
        if t.get("building") not in (None, "no")
        else "mapped site, never a solid building",
      }
    )
  for f in read(RAW / "institution_points.geojson.gz")["features"]:
    p, t = f["properties"], tags(f["properties"])
    category = "court" if t.get("amenity") == "courthouse" else "museum"
    result.append(
      {
        "id": category + ":" + osm_identity(p, False),
        "sourceIdentity": osm_identity(p, False),
        "category": category,
        "name": t.get("name", ""),
        "source": "OpenStreetMap retained 2026-09-29",
        "tags": t,
        "geometry": mapping(world_geometry(f["geometry"])),
        "role": "mapped institution point, never proof of a complete building",
      }
    )
  for name, polygon in [("memorial_points", False), ("memorial_areas", True)]:
    for f in read(RAW / (name + ".geojson.gz"))["features"]:
      p, t = f["properties"], tags(f["properties"])
      result.append(
        {
          "id": "monument:" + osm_identity(p, polygon),
          "sourceIdentity": osm_identity(p, polygon),
          "category": "monument",
          "name": t.get("name", ""),
          "source": "OpenStreetMap retained 2026-09-29",
          "tags": t,
          "geometry": mapping(world_geometry(f["geometry"])),
          "role": "mapped public memorial/monument, subtype retained",
        }
      )
  state = unary_union(
    [world_geometry(f["geometry"], True) for f in read(STATE_SOURCE)["features"]]
  )
  # The retained Geofabrik extract includes neighbouring Brandenburg. The
  # requested Berlin inventory must not silently include Potsdam's schools.
  result = [
    s for s in result if state.covers(shape(s["geometry"]).representative_point())
  ]
  ids = [s["id"] for s in result]
  if len(ids) != len(set(ids)):
    # A main-school code and its mapped campus are distinct; an OSM identity
    # occurring twice in the same source inventory is an extraction error.
    raise ValueError("Duplicate exact public-site identity")
  return result


def render_buildings() -> tuple[list[Any], list[dict[str, Any]]]:
  """Index actual packet navigation envelopes and their exact source paths."""
  geometries, records = [], []
  manifest = published_manifest()
  for ordinal, entry in enumerate(manifest["chunks"]):
    file = entry["drawn"]["url"]
    if not file:
      # Older metadata carries mode paths under files; no guessed packet is
      # counted as present when the literal manifest has no delivered path.
      file = (entry.get("files", {}).get("drawn") or {}).get("url")
    if not file:
      raise ValueError("Unrecognised actual packet descriptor " + str(entry)[:250])
    packet = read(PACKETS / file)
    ox, _, oz = packet["origin"]
    for row in packet["nav"]["buildings"]:
      g = Polygon(
        [(ox + x, oz + z) for x, z in row["ring"]],
        [[(ox + x, oz + z) for x, z in ring] for ring in row["holes"]],
      )
      if not g.is_valid:
        g = g.buffer(0)
      if g.is_empty:
        continue
      geometries.append(g)
      records.append(
        {"packet": entry["id"], "file": file, "sourceId": row["sourceId"], "row": row}
      )
    if ordinal % 250 == 0:
      print(
        "Indexed",
        ordinal,
        "packets,",
        len(records),
        "source building leaves",
        flush=True,
      )
  return geometries, records


def audit(output: Path) -> dict[str, Any]:
  """Record actual coverage; do not confuse candidate matches with proof."""
  inventory = sites()
  geometries, buildings = render_buildings()
  tree = STRtree(geometries)
  counts = defaultdict(Counter)
  owner_index = defaultdict(list)
  for item in inventory:
    g = shape(item["geometry"])
    candidates = tree.query(g.buffer(25 if g.geom_type == "Point" else 0.05))
    matches = []
    for n in candidates:
      b = buildings[int(n)]
      body = geometries[int(n)]
      overlap = g.intersection(body).area if g.area else 0
      distance = g.distance(body)
      if g.area and overlap < min(0.5, g.area * 0.01):
        continue
      matches.append(
        {
          "packet": b["packet"],
          "sourceId": b["sourceId"],
          "distanceM": round(distance, 3),
          "overlapM2": round(overlap, 3),
        }
      )
      owner_index[b["sourceId"]].append(item["id"])
    item["candidateRenderedOwners"] = matches
    item["coverageStatus"] = (
      "candidate-envelope-present"
      if matches
      else "no-packet-nav-candidate-not-a-rendering-verdict"
    )
    item["accuracyStatus"] = (
      "requires architectural/source-sheet review; proximity alone is not admission"
    )
    counts[item["category"]][item["coverageStatus"]] += 1
  payload = {
    "schemaVersion": 1,
    "version": "v326",
    "purpose": "Complete mapped inventory and packet-navigation candidacy only; Core/resident/named coverage requires separate audit",
    "inputs": {
      str(p.relative_to(ROOT)): digest(p)
      for p in [
        RAW / "schulen-current.geojson",
        RAW / "institutions.geojson.gz",
        RAW / "institution_points.geojson.gz",
        STATE_SOURCE,
        RAW / "memorial_points.geojson.gz",
        RAW / "memorial_areas.geojson.gz",
        BASELINE_MANIFEST,
      ]
    },
    "categories": {k: dict(v) for k, v in sorted(counts.items())},
    "actualPacketBuildingLeaves": len(buildings),
    "sites": inventory,
    "renderedOwnerSiteIndex": {k: sorted(set(v)) for k, v in owner_index.items()},
  }
  raw = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  output.write_bytes(gzip.compress(raw, mtime=0))
  return {
    "sites": len(inventory),
    "counts": payload["categories"],
    "bytes": len(raw),
    "gzipBytes": output.stat().st_size,
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--out", type=Path, default=RAW / "public-inventory-audit.json.gz"
  )
  args = parser.parse_args()
  print(json.dumps(audit(args.out), indent=2))
