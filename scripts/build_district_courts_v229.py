"""Step 10: current Berlin district-court buildings, additive source-bound recognition.

Offline replay from retained OSM and official LoD2 archives. Existing owners,
roofs, historic v166/v183 art and all courtyard holes remain untouched. Facade
ornament dimensions are illustrative, never represented as survey measurements.
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import numpy as np
import pyogrio
from pyproj import Transformer
from shapely.geometry import MultiPoint, Polygon, mapping, shape
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_townhall_source_v227 as metric_source
from build_bebelplatz_building_source import (
  part_profile as original_part_profile,
)
from build_bebelplatz_building_source import (
  world_ring,
)
from build_breitscheid_towers_v161 import triangles_for
from build_school_culture_v228 import label
from build_schools_places_v205 import Face, group
from build_steglitz_v182 import native_blocks
from build_townhall_source_v227 import (
  DATA,
  GEO,
  ROOT,
  digest,
  fallback_parts,
  read,
  source_wall_edges,
  write,
)

from isometric_berlin.data.fetch_lod2 import GML_ID, NS

OSM = GEO / "district-courts-osm-v229.json"
SOURCE = GEO / "district-courts-source-v229.json"
EVIDENCE = GEO / "district-courts-v229-evidence.json"
PROFILE = DATA / "districtCourtsV229.json"


def retained_part(part):
  """Some official elevated parts have no ground sheet; retain their actual roofs."""
  try:
    return original_part_profile(part)
  except ValueError:
    surfaces = []
    for kind in ("WallSurface", "RoofSurface"):
      for polygon in part.findall(f".//bldg:{kind}//gml:Polygon", NS):
        surfaces.append(
          {
            "kind": kind,
            "rings": [world_ring(p) for p in polygon.findall(".//gml:posList", NS)],
          }
        )
    pts = [p for s in surfaces for r in s["rings"] for p in r]
    polys = []
    for s in surfaces:
      if s["kind"] != "RoofSurface":
        continue
      g = Polygon(
        [(p[0], p[2]) for p in s["rings"][0]],
        [[(p[0], p[2]) for p in r] for r in s["rings"][1:]],
      ).buffer(0)
      if g.area > 0.01:
        polys.append(g)
    g = unary_union(polys)
    if g.is_empty:
      g = MultiPoint([(p[0], p[2]) for p in pts]).convex_hull
    if g.geom_type != "Polygon":
      g = g.convex_hull
    if g.geom_type != "Polygon":
      # A vertical decorative sheet has no solid footprint, so retain its
      # original surface with an empty ground ring (never fabricate a box).
      return dict(
        id=part.get(GML_ID),
        height_m=0,
        ground_y_m=min(p[1] for p in pts),
        top_y_m=max(p[1] for p in pts),
        ring=[],
        holes=[],
        surfaces=surfaces,
        footprintDerivation="Zero-area vertical source sheet",
      )
    low = min(p[1] for p in pts)
    high = max(p[1] for p in pts)
    return dict(
      id=part.get(GML_ID),
      height_m=high - low,
      ground_y_m=low,
      top_y_m=high,
      ring=list(g.exterior.coords)[:-1],
      holes=[list(r.coords)[:-1] for r in g.interiors],
      surfaces=surfaces,
      footprintDerivation="Projection of retained roof sheets; no ground sheet exists in this elevated source leaf",
    )


def extract_source():
  """Reuse the exact cached metric reader with an explicitly separate selection."""
  metric_source.OSM = OSM
  metric_source.part_profile = retained_part
  metric_source.NAMES = {s["key"]: s["name"] for s in read(OSM)["sites"]}
  source = metric_source.extract_sources()
  source["policy"] = (
    "Only the 11 current Amtsgerichte and their named current service buildings; plus the explicitly requested Tegeler Weg northern annex. Preserve every previous owner and surface. No former courthouse reuse and no broad district fill."
  )
  for site in source["sites"]:
    if site["key"] in {"charlottenburg", "tegeler-neubau"}:
      for parent in site["parents"]:
        parent["existingOwnership"] = {
          "family": "surrounding-city",
          "ids": [parent["id"]],
        }
  write(SOURCE, source)
  return source


def polygon_of(row):
  return Polygon(row["ring"], row.get("holes", []))


def displayed_parts(site, core, paths):
  """Bind recognition to actually delivered owners, with original rows retained."""
  footprint = shape(site["worldFootprint"])
  found = {}
  for row, g in core:
    if (
      not footprint.intersects(g)
      or g.intersection(footprint).area / max(g.area, 1) < 0.65
    ):
      continue
    lo = row["y0_dm"] / 10
    hi = lo + row["h_dm"] / 10
    found[row["id"]] = (
      g,
      lo,
      hi,
      {"kind": "core-prism", "id": row["id"], "original": row},
    )
  for path in paths:
    for row in pyogrio.read_dataframe(
      path, layer="buildings", bbox=footprint.bounds
    ).to_dict("records"):
      g = row["geometry"]
      if g.area < 20 or g.intersection(footprint).area / g.area < 0.65:
        continue
      # The central detailed source takes precedence over peripheral packets.
      if any(g.intersection(v[0]).area / g.area > 0.8 for v in found.values()):
        continue
      found[row["sourceId"]] = (
        g,
        3 + row["minHeight"],
        3 + row["height"],
        {
          "kind": "retained-surrounding-outline",
          "id": row["sourceId"],
          "path": str(path.relative_to(ROOT)),
          "ringGeometry": mapping(g),
          "height": row["height"],
          "minHeight": row["minHeight"],
        },
      )
  # Independently authored complete models have a documented ground and shell.
  if site["key"] in {"mitte", "tiergarten-moabit"}:
    ground = 3 if site["key"] == "mitte" else 5.2
    return (
      [
        {
          "owner": "protected-v183-" + site["key"],
          "ground_y_m": ground,
          "top_y_m": ground + 20,
          "ring": list(p.exterior.coords)[:-1],
          "holes": [list(h.coords)[:-1] for h in p.interiors],
          "surfaces": fallback_parts(p, ground, 20, site["key"])[0]["surfaces"],
          "required": False,
        }
        for p in ([footprint] if footprint.geom_type == "Polygon" else footprint.geoms)
      ],
      [{"kind": "protected-complete-v166-v183", "groundY": ground}],
      [],
    )
  parts = []
  for owner, (g, lo, hi, receipt) in found.items():
    parts.extend(
      {**p, "owner": owner, "required": False}
      for p in fallback_parts(g, lo, hi - lo, owner)
    )
  required = []
  # Add a complete source owner only when almost entirely absent, never a cover
  # box over an existing lower body. Small boundary mismatches are not missing.
  transfer = site["key"] in {"charlottenburg", "tegeler-neubau", "wedding"}
  if transfer and site["key"] != "wedding":
    approved = set(
      read(DATA / "districtCourtsV229Ownership.json")["replacementParents"]
    )
    assert all(p["id"] in approved for p in site["parents"]), "Unproven packet transfer"
  if transfer:
    assert parts, "Old replacement owner must still be independently present"
    parts = []
  if not parts:
    for parent in site["parents"]:
      low = min(p["ground_y_m"] for p in parent["parts"])
      offset = (5.2 if site["key"] == "wedding" else 3) - low
      for raw in parent["parts"]:
        p = {**raw, "owner": parent["id"], "required": True}
        p["ground_y_m"] += offset
        p["top_y_m"] += offset
        p["surfaces"] = [
          {
            "kind": s["kind"],
            "rings": [[[x, y + offset, z] for x, y, z in r] for r in s["rings"]],
          }
          for s in raw["surfaces"]
        ]
        required.append(p)
    parts.extend(required)
  return parts, [v[3] for v in found.values()], required


def face_for(g, edge):
  a, b = edge["a"], edge["b"]
  lo, hi = edge["base"], edge["eave"]
  return Face(
    g,
    [[[a[0], lo, a[1]], [b[0], lo, b[1]], [b[0], hi, b[1]], [a[0], hi, a[1]]]],
    [edge["normal"][0], 0, edge["normal"][1]],
  )


def choose_front(faces, site):
  n = np.array([site["front"][0], 0, site["front"][1]])
  candidates = [
    f for f in faces if f.length > 6 and f.top - f.base > 5 and np.dot(f.n, n) > 0.4
  ]
  if not candidates:
    candidates = [f for f in faces if f.length > 6 and f.top - f.base > 5]
  return (
    max(candidates, key=lambda f: f.length)
    if candidates
    else max(faces, key=lambda f: f.length)
  )


def new_windows(f, site):
  """One grid only on a newly required complete shell; no earlier panes remain."""
  h = f.top - f.base
  w = f.length
  if w < 3.4 or h < 4.5:
    return
  modern = site["family"] == "modern"
  pitch = 3.15 if modern else 3.65
  bays = max(1, math.floor((w - 1.6) / pitch))
  floors = max(1, math.floor((h - 1.3) / (3.35 if modern else 4.05)))
  for j in range(floors):
    y = f.base + 2.0 + j * (3.35 if modern else 4.05)
    for i in range(bays):
      u = f.left + (i + 0.5) * w / bays
      # Warm sandstone reveals and desaturated blue-green glass.
      f.member(u, y, 1.55, 2.0, 0xD9CDB7, 0.12, 0.32)
      f.member(u, y, 1.23, 1.71, 0x697F80, 0.10, 0.61)
      f.member(u, y, 0.07, 1.71, 0xD4C9B4, 0.11, 0.7)
      f.member(u, y + 0.10, 1.23, 0.07, 0xD4C9B4, 0.11, 0.7)
      if site["family"] == "gothic" and j == 0:
        for sign in [-1, 1]:
          f.stroke((u + sign * 0.76, y + 1.1), (u, y + 1.6), 0xD2C4AC, 0.13)
      elif site["family"] == "baroque" and j == 0:
        f.arch(u, y + 1.1, 1.55, 0.38, 0xD2C4AC)


def ornament(g, faces, site):
  """Material/portal/eave articulation only; do not add a competing window grid."""
  family = site["family"]
  stone = int(site["color"])
  front = choose_front(faces, site)
  protected = family == "protected"
  for f in faces:
    w = f.right - f.left
    h = f.top - f.base
    u = (f.left + f.right) / 2
    if w < 3 or h < 4:
      continue
    if protected or site["key"] in {
      "tiergarten-bereitschaft",
      "tiergarten-kirch",
      "charlottenburg-register",
    }:
      continue
    # Retained actual footprint and height: narrow plinth and eave ledges.
    for y, thick, out in [(f.base + 0.45, 0.32, 0.4), (f.top - 0.5, 0.2, 0.38)]:
      f.member(u, y, max(0.2, w - 0.3), thick, stone, 0.12, out)
    if family not in {"modern", "plain"}:
      # Corner dressings remain on corners, never on the pane rhythm.
      for x in [f.left + 0.45, f.right - 0.45]:
        f.member(x, f.base + min(h * 0.5, 6), 0.28, min(h - 1, 11), stone, 0.12, 0.4)
        for y in np.arange(f.base + 0.75, min(f.top - 0.6, f.base + 4), 0.55):
          f.member(x, float(y), 0.55, 0.18, stone, 0.14, 0.42)
    if family == "modern" and w > 10:
      # A single modest lintel line, not speculative colourful glazing.
      f.member(u, min(f.top - 0.7, f.base + 3.45), w - 0.7, 0.16, 0x6C7776, 0.1, 0.41)
  u = (front.left + front.right) / 2
  y = front.base
  height = front.top - y
  # A service within a shared police/administrative complex gets only its
  # bounded entrance plaque, never a courthouse treatment over the whole block.
  shared = site["key"] in {
    "tiergarten-bereitschaft",
    "tiergarten-kirch",
    "charlottenburg-register",
  }
  if shared:
    for dx in [-1.35, 1.35]:
      front.member(u + dx, y + 1.8, 0.45, 0.7, 0x64736E, 0.07, 0.46)
    label(
      front,
      "AMTSGERICHT" if site["key"] != "charlottenburg-register" else "HANDELSREGISTER",
      u,
      y + 3.3,
      0.27,
      0x63594C,
    )
    return
  span = min(5.6, front.length * 0.28)
  if height > 6 and span > 2:
    for sign in [-1, 1]:
      front.member(u + sign * span / 2, y + 2.35, 0.35, 4.2, stone, 0.24, 0.46)
      front.member(u + sign * span / 2, y + 0.35, 0.6, 0.45, stone, 0.26, 0.46)
      front.member(u + sign * span / 2, y + 4.35, 0.7, 0.3, stone, 0.26, 0.46)
    if family == "gothic":
      for sign in [-1, 1]:
        front.stroke((u + sign * span / 2, y + 4.4), (u, y + 6.1), stone, 0.23)
      # Small paired carved shield silhouettes, not a new tower.
      for dx in [-span * 0.72, span * 0.72]:
        for a, b in [
          ((u + dx - 0.32, y + 3.9), (u + dx - 0.32, y + 3.25)),
          ((u + dx - 0.32, y + 3.25), (u + dx, y + 2.95)),
          ((u + dx, y + 2.95), (u + dx + 0.32, y + 3.25)),
          ((u + dx + 0.32, y + 3.25), (u + dx + 0.32, y + 3.9)),
        ]:
          front.stroke(a, b, stone, 0.15)
    elif family in {"baroque", "renaissance", "stone", "protected"}:
      front.arch(u, y + 4.45, span, 0.7 if family == "baroque" else span * 0.24, stone)
      front.member(u, y + 5.25, span + 0.7, 0.2, stone, 0.22, 0.46)
      if family == "baroque":
        # Curved portal volutes are shallow wall reliefs.
        for sign in [-1, 1]:
          front.arch(u + sign * (span / 2 + 0.35), y + 4.8, 0.6, 0.4, stone)
    else:
      front.member(u, y + 4.5, span + 0.4, 0.24, stone, 0.28, 0.48)
    title = {
      "wedding-mahn": "MAHNGERICHT",
      "lichtenberg-archiv": "GRUNDBUCHARCHIV",
      "koepenick-grundbuch": "GRUNDBUCH",
      "pankow-familie": "FAMILIENGERICHT",
      "kreuzberg-familie": "FAMILIENGERICHT",
      "tegeler-neubau": "LANDGERICHT",
    }.get(site["key"], "AMTSGERICHT")
    label(front, title, u, min(y + 6.55, front.top - 0.6), 0.32, 0x615449)
  g["entrance"] = {
    "center": front.point(u, y, 1),
    "normal": front.n.tolist(),
    "approximate": True,
    "note": "Source-bound main-facing portal cue; exact door opening is not surveyed.",
  }


def compile_data(source):
  corepath = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  core = [
    (
      r,
      Polygon(
        [(x / 10, z / 10) for x, z in r["ring"]],
        [[(x / 10, z / 10) for x, z in h] for h in r["holes"]],
      ),
    )
    for r in read(corepath)["buildings"]
  ]
  paths = sorted((GEO / "raw").rglob("resolved-outlines.gpkg"))
  groups = []
  audits = []
  drawn = []
  native = []
  navigation = []
  for s in source["sites"]:
    parts, receipts, required = displayed_parts(s, core, paths)
    g = {
      **group(s["name"], ",".join(sorted({p["owner"] for p in parts}))),
      "key": s["key"],
      "sheets": [],
      "bounds": s["bounds"],
      "court": s["court"],
    }
    faces = []
    for p in parts:
      for edge in source_wall_edges(p, 0):
        if math.dist(edge["a"], edge["b"]) >= 2 and edge["eave"] - edge["base"] > 3:
          faces.append(face_for(g, edge))
    assert faces, s["key"]
    if required:
      for f in faces:
        new_windows(f, s)
    ornament(g, faces, s)
    # Compact audited fields go only to the offline evidence, not resident JSON.
    audits.append(
      {
        "key": s["key"],
        "name": s["name"],
        "court": s["court"],
        "address": s["address"],
        "officialUrl": s["officialUrl"],
        "osmIds": [r["id"] for r in s["osm"]],
        "bounds": s["bounds"],
        "family": s["family"],
        "retainedOwners": receipts,
        "requiredOwners": sorted({p["owner"] for p in required}),
        "faces": g.pop("faces"),
        "boxes": g["boxes"],
        "entrance": g.pop("entrance", None),
        "limitation": "Facade member, portal, lettering and untagged material proportions are bounded estimates; no claim of a measured facade survey.",
      }
    )
    groups.append(g)
    if required:
      surfaces = []
      roof = []
      owners = []
      for p in required:
        owners.append(
          {
            "id": p["id"],
            "owner": p["owner"],
            "ring": p["ring"],
            "holes": p["holes"],
            "low": p["ground_y_m"],
            "high": p["top_y_m"],
          }
        )
        for sheet in p["surfaces"]:
          t = triangles_for(sheet["rings"])
          surfaces.append(
            {
              "color": 0x7F7970 if sheet["kind"] == "RoofSurface" else int(s["color"]),
              "triangles": t,
            }
          )
          if sheet["kind"] == "RoofSurface":
            roof.extend(t)
      footprint = unary_union([polygon_of(p) for p in required])
      pads = []
      for p in (
        fallback_parts(
          footprint.buffer(1, join_style="mitre"), -2, 5, s["key"] + "-apron"
        )
        if not receipts
        else []
      ):
        pads.append({"ring": p["ring"], "holes": p["holes"], "low": -2, "high": 3})
        surfaces.extend(
          {"color": 0xB8B1A4, "triangles": triangles_for(t["rings"])}
          for t in p["surfaces"]
        )
      blocks = native_blocks({"surfaces": surfaces, "boxes": [], "rods": []})
      common = {
        "key": s["key"],
        "name": s["name"],
        "owners": sorted({p["owner"] for p in required}),
      }
      drawn.append(common | {"surfaces": surfaces})
      native.append(common | {"blocks": blocks})
      navigation.append(
        {
          "key": s["key"],
          "bounds": list(footprint.buffer(1).bounds),
          "owners": owners,
          "roofTriangles": roof,
          "pads": pads,
        }
      )
    print(
      s["key"],
      len(parts),
      "parts",
      len(g["boxes"]),
      "fittings",
      len(required),
      "new",
      flush=True,
    )
  # Stable millimetre coordinates; full original source precision stays offline.
  for g in groups:
    for field in ["boxes", "rods", "nativeRows"]:
      g[field] = [
        [round(v, 4) if isinstance(v, float) else v for v in row] for row in g[field]
      ]
  cameras = []
  for s in source["sites"]:
    x0, z0, x1, z1 = s["bounds"]
    x, z = (x0 + x1) / 2, (z0 + z1) / 2
    cameras.append(
      dict(
        key=s["key"],
        name=s["name"],
        center=[round(x, 2), round(z, 2)],
        spanM=round(max(x1 - x0, z1 - z0), 2),
        eye=[round(x + 100, 2), 130, round(z + 130, 2)],
        target=[round(x, 2), 14, round(z, 2)],
        officialUrl=s["officialUrl"],
      )
    )
  write(GEO / "district-courts-v229-cameras.json", {"sites": cameras})
  to_lonlat = Transformer.from_crs(25833, 4326, always_xy=True).transform
  features = []
  for s in navigation:
    if s["key"] not in {"koepenick", "koepenick-grundbuch", "lichtenberg"}:
      continue
    footprint = unary_union([polygon_of(p) for p in s["owners"]]).buffer(
      1, join_style="mitre"
    )
    projected = transform(lambda x, z, y=None: (x + 389500, 5820000 - z), footprint)
    features.append(
      {
        "type": "Feature",
        "properties": {
          "key": s["key"],
          "scope": "Exact newly represented courthouse and one-metre foundation apron",
        },
        "geometry": mapping(transform(to_lonlat, projected)),
      }
    )
  write(
    GEO / "bounds-district-courts-v229.geojson",
    {"type": "FeatureCollection", "features": features},
  )
  write(PROFILE, {"schemaVersion": 1, "sites": groups})
  for kind, sites in [
    ("Envelopes", drawn),
    ("Native", native),
    ("Navigation", navigation),
  ]:
    write(DATA / f"districtCourtsV229{kind}.json", {"sites": sites})
  write(
    EVIDENCE,
    {
      "schemaVersion": 1,
      "step": 10,
      "sourceSha256": digest(SOURCE),
      "osmSha256": digest(OSM),
      "originalCoreSha256": digest(corepath),
      "courtCount": 11,
      "removedOwners": [],
      "sites": audits,
      "unavailableArchives": source["unavailableArchives"],
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract-source", action="store_true")
  args = parser.parse_args()
  compile_data(
    extract_source() if args.extract_source or not SOURCE.exists() else read(SOURCE)
  )
