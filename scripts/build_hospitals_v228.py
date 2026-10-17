"""Bounded hospital recognition and previously absent OSM building-part shells.

No existing source mesh, source surface or navigation owner is removed. In
particular Benjamin Franklin's retained low podium stays intact: only the
independently mapped upper parts missing from the old multipolygon import are
added above it. Hospital storey heights are estimates, never a LoD2 survey.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pyogrio
from shapely.geometry import Polygon, mapping, shape
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_breitscheid_towers_v161 import triangles_for
from build_steglitz_v182 import native_blocks
from build_surrounding_outlines import tags_for
from build_townhall_source_v227 import (
  DATA,
  GEO,
  ROOT,
  TO_METRES,
  digest,
  fallback_parts,
  read,
  source_wall_edges,
  world_geometry,
  write,
)

OSM = GEO / "hospitals-osm-v228.json"
SOURCE = GEO / "hospitals-source-v228.json"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
META = {
  "charite-mitte": (
    "Charité Campus Mitte – Zentrale Notaufnahme",
    "modern",
    0xCFD5D1,
    0x647170,
  ),
  "benjamin-franklin": (
    "Charité Campus Benjamin Franklin",
    "screen",
    0xC6C4B6,
    0x7D8780,
  ),
  "friedrichshain": (
    "Vivantes Klinikum im Friedrichshain",
    "brick",
    0xA88166,
    0x746D66,
  ),
  "drk-mitte": (
    "DRK Kliniken Berlin Mitte – Drontheimer Straße",
    "modern",
    0xD8CBB6,
    0x818987,
  ),
  "juedisches": ("Jüdisches Krankenhaus Berlin", "stone", 0xD2C1A6, 0x7A746E),
  "prenzlauer-berg": (
    "Ehemaliges Klinikum Prenzlauer Berg – Fröbelstraße 15",
    "brick",
    0xB58B68,
    0x82766A,
  ),
}


def metric(record):
  """Unchanged scene coordinates, with source holes retained."""
  g = shape(record["geometry"])
  if g.geom_type == "LineString":
    assert g.is_ring, record["id"]
    g = Polygon(g.coords)
  return world_geometry(transform(TO_METRES, g))


def extract_parts():
  """Replay missing Simple-3D building parts from GDAL's *lines* layer."""
  data = read(OSM)
  for site in data["sites"]:
    if site["key"] not in {"benjamin-franklin", "drk-mitte", "juedisches"}:
      continue
    campus = shape(site["campus"]["geometry"])
    frame = pyogrio.read_dataframe(PBF, layer="lines", bbox=campus.bounds)
    parts = []
    for row in frame.to_dict("records"):
      tags = tags_for(row)
      g = row["geometry"]
      if tags.get("building:part") in (None, "no") or not g.is_ring:
        continue
      polygon = Polygon(g.coords)
      if polygon.intersection(campus).area / max(polygon.area, 1e-20) < 0.98:
        continue
      parts.append({"id": "way/" + row["osm_id"], "tags": tags, "geometry": mapping(g)})
    site["buildingParts"] = parts
  write(OSM, data)


def body_profile(owner, geometry, low, high, provenance, tags=None, required=False):
  """Display-aligned walls attach to an actual retained or newly delivered body."""
  return [
    {
      **part,
      "owner": owner,
      "provenance": provenance,
      "tags": tags or {},
      "required": required,
      "wallEdges": source_wall_edges(part, 0),
    }
    for part in fallback_parts(geometry, low, high - low, owner)
  ]


def existing_parts(site):
  """Read complete existing source outlines; never create an owner by its bbox."""
  key = site["key"]
  selected = site["buildings"]
  if key == "charite-mitte":
    selected = [r for r in selected if r["id"] == "way/413988641"]
  footprint = unary_union([metric(b) for b in selected])
  parts, provenance = [], []
  if key == "charite-mitte":
    # The Bettenhochhaus and historical authored campus are deliberately outside
    # this selection. These six exact old prism owners cover the separate ZNA.
    allowed = {"fTIktpn9", "lnJPRqrv", "xyl6wGjY", "32tVlJUu", "0hYL1BJs", "1Mr0004q"}
    path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
    for row in read(path)["buildings"]:
      if row["id"] not in allowed:
        continue
      geometry = Polygon(
        [(x / 10, z / 10) for x, z in row["ring"]],
        [[(x / 10, z / 10) for x, z in h] for h in row["holes"]],
      )
      assert geometry.intersection(footprint).area / geometry.area > 0.8
      # Conservative lower facade only: exact LoD2 sheets and roof articulation
      # are retained by the existing v169 renderer; we do not replace them.
      low = row["y0_dm"] / 10
      high = min(low + row["h_dm"] / 10, low + 17)
      parts.extend(
        body_profile(
          row["id"],
          geometry,
          low,
          high,
          "retained-core-source-owner; conservative lower facade",
        )
      )
      provenance.append(
        {"id": row["id"], "path": str(path.relative_to(ROOT)), "original": row}
      )
    return parts, provenance
  for path in sorted((GEO / "raw").rglob("resolved-outlines.gpkg")):
    for row in pyogrio.read_dataframe(
      path, layer="buildings", bbox=footprint.bounds
    ).to_dict("records"):
      geometry = row["geometry"]
      if geometry.area < (600 if key == "friedrichshain" else 100):
        continue
      if geometry.intersection(footprint).area / geometry.area < 0.8:
        continue
      if key == "benjamin-franklin" and row["sourceId"] != "OSM-relation-5943188":
        continue
      parts.extend(
        body_profile(
          row["sourceId"],
          geometry,
          3 + row["minHeight"],
          3 + row["height"],
          "retained-surrounding-city-source-envelope",
        )
      )
      provenance.append(
        {
          "id": row["sourceId"],
          "path": str(path.relative_to(ROOT)),
          "geometry": mapping(geometry),
          "height": row["height"],
          "minHeight": row["minHeight"],
        }
      )
  return parts, provenance


def estimated_height(tags):
  """Tagged metres first; tagged storeys second; missing information stays explicit."""
  if tags.get("height"):
    try:
      return float(tags["height"].replace("m", "").strip()), "osm:height"
    except ValueError:
      pass
  if tags.get("building:levels"):
    return float(tags["building:levels"]) * 3, "osm:building:levels × estimated 3m"
  return 9.0, "unsurveyed 9m context height; no roof survey"


def add_missing(site, existing):
  """Add actual mapped parts; never replace all of a campus with one volume."""
  key = site["key"]
  required = []
  if key == "benjamin-franklin":
    old = unary_union([Polygon(p["ring"], p["holes"]) for p in existing])
    for record in site.get("buildingParts", []):
      geometry = metric(record)
      # Restrict to the main named building; neighbouring staff residences stay.
      if geometry.intersection(old.buffer(0.3)).area / geometry.area < 0.9:
        continue
      top, height_source = estimated_height(record["tags"])
      low = max(6, float(record["tags"].get("building:min_level", 0)) * 3)
      if top <= low:
        continue
      # Upper addition sits on the preserved 6m podium at display ground y=3.
      required.extend(
        body_profile(
          record["id"],
          geometry,
          3 + low,
          3 + top,
          height_source + "; upper addition above preserved 6m podium",
          record["tags"],
          True,
        )
      )
  elif key in {"drk-mitte", "juedisches"}:
    assert not existing, "Previously absent owner now exists; review before adding"
    children = site.get("buildingParts", [])
    child_union = unary_union([metric(r) for r in children])
    # OSM outline parents carry no independent solid where mapped parts supply
    # the actual envelope. Retain their full original outline in the source,
    # render only its uncovered remainder; otherwise lower wings get buried.
    records = [(r, metric(r).difference(child_union)) for r in site["buildings"]]
    records.extend((r, metric(r)) for r in children)
    for record, geometry in records:
      if geometry.is_empty or geometry.area < 0.1:
        continue
      height, height_source = estimated_height(record["tags"])
      low = float(
        record["tags"].get(
          "min_height", float(record["tags"].get("building:min_level", 0)) * 3
        )
      )
      if height <= low:
        continue
      required.extend(
        body_profile(
          record["id"],
          geometry,
          3 + low,
          3 + height,
          height_source,
          record["tags"],
          True,
        )
      )
  return required


def create_source():
  """Retain each selected source and the exact old owner used as facade support."""
  sites = []
  for site in read(OSM)["sites"]:
    key = site["key"]
    parts, old = existing_parts(site)
    required = add_missing(site, parts)
    assert parts or required, key
    parts.extend(required)
    name, family, wall, roof = META[key]
    bounds = unary_union([Polygon(p["ring"], p["holes"]) for p in parts]).bounds
    sites.append(
      {
        "key": key,
        "name": name,
        "family": family,
        "wall": wall,
        "roof": roof,
        "bounds": list(bounds),
        "parts": parts,
        "retainedOwners": old,
      }
    )
  result = {
    "schemaVersion": 1,
    "osmSha256": digest(OSM),
    "sites": sites,
    "removedOwners": [],
    "unavailableArchives": [
      "LoD2_386_5811.zip: official HTTP503, one bounded retry",
      "LoD2_390_5824.zip: official HTTP503",
    ],
    "heightPolicy": "Original visible source envelopes retained. New OSM metres/levels are tagged but storey conversion and untagged 9m contextual heights are estimates, not survey. No inferred tower, roof ridge or campus-wide replacement.",
  }
  write(SOURCE, result)
  return result


def compile_data(source):
  """Compact per-site profiles, source-surface native blocks and matching walking support."""
  profiles, drawn, native, nav = [], [], [], []
  for site in source["sites"]:
    key = site["key"]
    profiles.append(
      {k: site[k] for k in ("key", "name", "family", "wall", "roof", "bounds")}
      | {
        "parts": [
          {
            k: p[k]
            for k in (
              "id",
              "owner",
              "ring",
              "holes",
              "ground_y_m",
              "top_y_m",
              "wallEdges",
            )
          }
          for p in site["parts"]
        ]
      }
    )
    required = [p for p in site["parts"] if p["required"]]
    if not required:
      continue
    surfaces, roof_triangles, owners, pads = [], [], [], []
    for part in required:
      owners.append(
        {
          "id": part["id"],
          "owner": part["owner"],
          "ring": part["ring"],
          "holes": part["holes"],
          "low": part["ground_y_m"],
          "high": part["top_y_m"],
        }
      )
      for surface in part["surfaces"]:
        triangles = triangles_for(surface["rings"])
        surfaces.append(
          {
            "color": site["roof"] if surface["kind"] == "RoofSurface" else site["wall"],
            "triangles": triangles,
          }
        )
        if surface["kind"] == "RoofSurface":
          roof_triangles.extend(triangles)
    if key in {"drk-mitte", "juedisches"}:
      geometry = unary_union([Polygon(p["ring"], p["holes"]) for p in required]).buffer(
        2, join_style="mitre"
      )
      for pad in fallback_parts(geometry, -2, 5, key + "-display-apron"):
        pads.append({"ring": pad["ring"], "holes": pad["holes"], "low": -2, "high": 3})
        surfaces.extend(
          {"color": 0xB3AE9F, "triangles": triangles_for(s["rings"])}
          for s in pad["surfaces"]
        )
    print(key, len(required), "missing mapped parts; native skin", flush=True)
    blocks = native_blocks({"surfaces": surfaces, "boxes": [], "rods": []})
    shared = {
      "key": key,
      "name": site["name"],
      "owners": sorted({p["owner"] for p in required}),
    }
    drawn.append(shared | {"surfaces": surfaces})
    native.append(shared | {"blocks": blocks})
    bounds = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in [*owners, *pads]]
    ).bounds
    nav.append(
      {
        "key": key,
        "bounds": list(bounds),
        "owners": owners,
        "roofTriangles": roof_triangles,
        "pads": pads,
      }
    )
  for name, sites in [
    ("Profile", profiles),
    ("Envelopes", drawn),
    ("Native", native),
    ("Navigation", nav),
  ]:
    write(DATA / f"hospitalV228{name}.json", {"sites": sites})
  write(
    GEO / "hospitals-v228-evidence.json",
    {
      "sourceSha256": digest(SOURCE),
      "sites": [
        {
          "key": s["key"],
          "existingOwners": len(s["retainedOwners"]),
          "requiredParts": sum(p["required"] for p in s["parts"]),
          "wallEdges": sum(len(p["wallEdges"]) for p in s["parts"]),
        }
        for s in source["sites"]
      ],
      "removedOwners": [],
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract-parts", action="store_true")
  args = parser.parse_args()
  if args.extract_parts:
    extract_parts()
  compile_data(create_source())
