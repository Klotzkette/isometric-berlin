"""Retain finite Britz site polygons and complete official building families."""

from __future__ import annotations

import gzip
import hashlib
import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

import pyogrio
import shapely
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import GML_ID, NS, leaf_building_parts
from scripts.build_bebelplatz_building_source import part_profile
from scripts.build_surrounding_outlines import tags_for, world

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
OUT = GEO / "britz-sites-v342-source.json.gz"
SITE_IDS = {
  "schlossGutshof": ["way/48732513", "way/27120497"],
  "dorfkirche": ["way/350962318", "way/27119678"],
  "hufeisen": ["way/675774622"],
}
TAGS = (
  "name",
  "building",
  "building:levels",
  "building:colour",
  "height",
  "addr:street",
  "addr:housenumber",
  "historic",
  "landuse",
  "leisure",
  "natural",
  "water",
  "waterway",
  "highway",
  "surface",
  "width",
  "barrier",
  "man_made",
  "leaf_type",
  "diameter_crown",
  "bridge",
)


def sha(path: Path) -> str:
  """Hash unchanged source bytes."""
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def read(path: Path) -> dict | list:
  """Read retained JSON or deterministic gzip JSON."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: dict | list) -> None:
  """Save a compact, reproducible derived source rather than raw archives."""
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def capture() -> None:
  """Select named mapped domains, then keep each selected LoD2 family complete."""
  cache = GEO / "raw/britz-v342/captured-candidates.json.gz"
  if not cache.exists():
    records = []
    for layer in ("multipolygons", "lines", "points"):
      frame = pyogrio.read_dataframe(
        PBF, layer=layer, bbox=(13.43, 52.442, 13.452, 52.452)
      ).to_crs(25833)
      for _, row in frame.iterrows():
        tags = tags_for(row)
        geometry = world(row.geometry)
        if tags.get("boundary") or geometry.length > 5000:
          continue
        if layer == "multipolygons":
          key = row.get("osm_way_id")
          identity = "way/" + key if isinstance(key, str) else "relation/" + row.osm_id
        else:
          identity = ("node/" if layer == "points" else "way/") + row.osm_id
        records.append(
          {"id": identity, "layer": layer, "tags": tags, "geometry": mapping(geometry)}
        )
    write(cache, records)
  records = read(cache)
  by_id = {r["id"]: r for r in records}
  sites = {
    key: unary_union([shape(by_id[i]["geometry"]) for i in ids])
    for key, ids in SITE_IDS.items()
  }
  domain = unary_union(list(sites.values()))
  # Actual mapped approaches which touch a named plot: retain only the segment
  # up to its first 8m outside it, never a guessed link across private property.
  approaches = []
  for r in records:
    if r["layer"] != "lines" or r["tags"].get("highway") not in (
      "footway",
      "path",
      "pedestrian",
      "steps",
      "service",
    ):
      continue
    g = shape(r["geometry"])
    if g.intersects(domain) and not r["tags"].get("bridge"):
      approaches.append(g.intersection(domain.buffer(8)).buffer(1.4))
  domain = shapely.make_valid(domain.union(unary_union(approaches)))
  families, archives = {}, []
  for code in ("393_5811", "393_5812", "394_5811", "394_5812"):
    archive = GEO / f"raw/public-fidelity-v326/LoD2_{code}.zip"
    archives.append(
      {
        "url": f"https://gdi.berlin.de/data/a_lod2/atom/{archive.name}",
        "sha256": sha(archive),
      }
    )
    with zipfile.ZipFile(archive) as bundle:
      for member in bundle.namelist():
        if not member.endswith((".gml", ".xml", ".citygml")):
          continue
        with bundle.open(member) as source:
          for _, element in ET.iterparse(source, events=("end",)):
            if element.tag != f"{{{NS['bldg']}}}Building":
              continue
            identity = element.get(GML_ID)
            try:
              parts = [
                part_profile(p) for p in leaf_building_parts(element) or [element]
              ]
            except ValueError:
              element.clear()
              continue
            footprint = unary_union([Polygon(p["ring"], p["holes"]) for p in parts])
            if (
              not footprint.is_empty
              and domain.intersection(footprint).area > footprint.area * 0.5
            ):
              site = max(sites, key=lambda key: sites[key].intersection(footprint).area)
              families[identity] = {
                "id": identity,
                "site": site,
                "footprint": mapping(footprint),
                "parts": parts,
              }
              # Complete families, including tiny original wings outside a plot.
              domain = domain.union(footprint)
            element.clear()
  selected = []
  for r in records:
    if r["layer"] == "points" and r["tags"].get("natural") != "tree":
      continue
    g = shape(r["geometry"])
    if not g.intersects(domain) or g.length > 5000:
      continue
    selected.append({**r, "tags": {k: v for k, v in r["tags"].items() if k in TAGS}})
  source = {
    "schemaVersion": 1,
    "scope": mapping(domain),
    "sites": {
      k: {"ids": SITE_IDS[k], "geometry": mapping(v)} for k, v in sites.items()
    },
    "osm": {
      "source": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "sha256": sha(PBF),
      "license": "ODbL-1.0",
      "records": selected,
    },
    "lod2": {
      "license": "dl-de/zero-2-0",
      "archives": archives,
      "families": [families[k] for k in sorted(families)],
    },
    "ground": {
      "displayY": 3,
      "source": "retained surrounding packet datum",
      "limitation": "Flat 3m display ground; no measured terrain relief is asserted.",
    },
  }
  write(OUT, source)
  print(
    json.dumps(
      {
        "families": len(families),
        "leaves": sum(len(f["parts"]) for f in families.values()),
        "osm": len(selected),
        "areaM2": domain.area,
        "bytes": OUT.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  capture()
