"""Step 10: retain bounded metric sources for the 23 former district town halls.

No existing city packet or landmark is rewritten. The companion profile contains
only measured wall edges for additive recognition; original wall/roof sheets stay
in the replayable source record rather than being copied into the client bundle.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from typing import Any

import pyogrio
from pyproj import Transformer
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_bebelplatz_building_source import part_profile

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  building_footprint,
  leaf_building_parts,
)

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
RAW = GEO / "raw/lod2"
OSM = GEO / "townhall-osm-v227.json"
SOURCE = GEO / "townhall-source-v227.json"
PROFILE = DATA / "townhallV227Profile.json"
TO_METRES = Transformer.from_crs(4326, 25833, always_xy=True).transform
NAMES = {
  "mitte": "Rathaus Mitte",
  "tiergarten": "Rathaus Tiergarten",
  "wedding": "Rathaus Wedding",
  "friedrichshain": "Rathaus Friedrichshain",
  "kreuzberg": "Rathaus Kreuzberg",
  "pankow": "Rathaus Pankow",
  "prenzlauer-berg": "Bezirksamt Prenzlauer Berg / Fröbelstraße",
  "weissensee": "Rathaus Weißensee",
  "charlottenburg": "Rathaus Charlottenburg",
  "wilmersdorf": "Rathaus Wilmersdorf",
  "spandau": "Rathaus Spandau",
  "steglitz": "Rathaus Steglitz",
  "zehlendorf": "Rathaus Zehlendorf",
  "schoeneberg": "Rathaus Schöneberg",
  "tempelhof": "Rathaus Tempelhof",
  "neukoelln": "Rathaus Neukölln",
  "treptow": "Rathaus Treptow",
  "koepenick": "Rathaus Köpenick",
  "marzahn": "Rathaus Marzahn",
  "hellersdorf": "Rathaus Hellersdorf",
  "lichtenberg": "Rathaus Lichtenberg",
  "hohenschoenhausen": "Bezirksamt Hohenschönhausen / Große-Leege-Straße",
  "reinickendorf": "Rathaus Reinickendorf",
}


def read(path: Path) -> Any:
  """Read a small retained JSON or one bounded city packet."""
  return json.loads(
    gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
  )


def write(path: Path, value: Any) -> None:
  """Keep deterministic readable identifiers and compact source numbers."""
  path.write_text(
    json.dumps(value, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n"
  )


def digest(path: Path) -> str:
  """Hash one source file without an additional full byte copy."""
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def world_geometry(geometry: Any) -> Any:
  """Use the unchanged local east/south metric coordinate frame."""
  return transform(lambda x, y, z=None: (x - 389500, 5820000 - y), geometry)


def selected_footprints() -> dict[str, Any]:
  """Select buildings inside campus boundaries rather than treating a campus as a box."""
  return {
    s["key"]: unary_union(
      [
        transform(TO_METRES, shape(r["geometry"]))
        for r in s["osm"]
        if any(
          r["tags"].get(k) not in (None, "no") for k in ("building", "building:part")
        )
      ]
    )
    for s in read(OSM)["sites"]
  }


def fallback_parts(
  geometry: Any, ground: float, height: float, owner: str
) -> list[dict[str, Any]]:
  """Retain an actual source footprint; its flat envelope is explicitly not a roof survey."""
  result = []
  if geometry.is_empty:
    return result
  polygons = [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)
  for index, polygon in enumerate(polygons):
    rings = [
      list(polygon.exterior.coords)[:-1],
      *[list(r.coords)[:-1] for r in polygon.interiors],
    ]
    rings = [[[round(x, 3), round(z, 3)] for x, z in r] for r in rings]
    surfaces = [
      {
        "kind": "RoofSurface",
        "rings": [[[x, ground + height, z] for x, z in r] for r in rings],
      }
    ]
    for ring in rings:
      for a, b in zip(ring, [*ring[1:], ring[0]]):
        surfaces.append(
          {
            "kind": "WallSurface",
            "rings": [
              [
                [a[0], ground, a[1]],
                [b[0], ground, b[1]],
                [b[0], ground + height, b[1]],
                [a[0], ground + height, a[1]],
              ]
            ],
          }
        )
    result.append(
      {
        "id": owner + f"-outline-{index}",
        "height_m": height,
        "ground_y_m": ground,
        "top_y_m": ground + height,
        "ring": rings[0],
        "holes": rings[1:],
        "surfaces": surfaces,
      }
    )
  return result


def missing_source_fallback(site: dict[str, Any], footprint: Any) -> None:
  """Prefer retained official parent footprints, then exact OSM rings and tagged heights."""
  found = {}
  for path in sorted((GEO / "raw").rglob("official-outlines.gpkg")):
    frame = pyogrio.read_dataframe(path, layer="buildings", bbox=footprint.bounds)
    for row in frame.to_dict("records"):
      g = row["geometry"]
      if g.intersection(footprint).area / max(g.area, 1) > 0.55:
        found[row["sourceId"]] = (row, path)
  existing_ids = {p["id"] for p in site["parents"]}
  for pid, (row, path) in sorted(found.items()):
    if pid in existing_ids:
      continue
    site["parents"].append(
      {
        "id": pid,
        "geometrySource": "retained-official-parent-outline",
        "sourcePath": str(path.relative_to(ROOT)),
        "heightSource": row["heightSource"],
        "parts": fallback_parts(
          world_geometry(row["geometry"]), row["sourceGroundY"], row["height"], pid
        ),
        "limitation": "Original kilometre archive unavailable (official service HTTP 503). Retained measured parent footprint and vertical envelope; roof subdivisions not recovered.",
      }
    )
  if found:
    return
  for osm in site["osm"]:
    tags = osm["tags"]
    if not any(tags.get(k) not in (None, "no") for k in ("building", "building:part")):
      continue
    geometry = transform(TO_METRES, shape(osm["geometry"])).intersection(footprint)
    if geometry.is_empty or geometry.area < 0.1:
      continue
    height_source = (
      "tagged storeys with estimated 3.2 m per storey and 1.5 m roof allowance"
    )
    try:
      height = float(str(tags.get("height", "")).replace(" m", ""))
      height_source = "OSM explicit height"
    except ValueError:
      try:
        height = float(tags.get("building:levels", 4)) * 3.2 + 1.5
      except ValueError:
        height = 14.3
      if "building:levels" not in tags:
        height_source = "unsurveyed civic-building display height 14.3 m"
    pid = "OSM-" + osm["id"].replace("/", "-")
    site["parents"].append(
      {
        "id": pid,
        "geometrySource": "osm-tagged-footprint-envelope",
        "heightSource": height_source,
        "tags": tags,
        "parts": fallback_parts(
          world_geometry(geometry),
          0,
          height,
          pid,
        ),
        "limitation": "Official LoD2 archive unavailable (HTTP 503). Exact mapped footprint retained; elevation and unsurveyed storey/roof proportions are display estimates.",
      }
    )


def extract_sources() -> dict[str, Any]:
  """Keep complete leaf sheets only for positively intersecting named hall footprints."""
  footprints = selected_footprints()
  assert set(footprints) == set(NAMES)
  assert all(not g.is_empty for g in footprints.values())
  tile_names = {
    f"LoD2_{x}_{y}.zip"
    for g in footprints.values()
    for x in range(math.floor(g.bounds[0] / 1000), math.floor(g.bounds[2] / 1000) + 1)
    for y in range(math.floor(g.bounds[1] / 1000), math.floor(g.bounds[3] / 1000) + 1)
  }
  sites = {
    s["key"]: {**s, "name": NAMES[s["key"]], "parents": []} for s in read(OSM)["sites"]
  }
  archives = []
  local_archives = {p.name: p for p in (GEO / "raw").rglob("LoD2_*.zip")}
  unavailable = []
  for name in sorted(tile_names):
    archive = local_archives.get(name)
    if archive is None:
      unavailable.append(name)
      continue
    tx, ty = map(int, name.removeprefix("LoD2_").removesuffix(".zip").split("_"))
    tile = box(tx * 1000, ty * 1000, (tx + 1) * 1000, (ty + 1) * 1000)
    candidates = {k: g for k, g in footprints.items() if g.intersects(tile)}
    receipt = {
      "file": name,
      "url": f"https://gdi.berlin.de/data/a_lod2/atom/{name}",
      "sha256": digest(archive),
    }
    archives.append(receipt)
    with zipfile.ZipFile(archive) as zipped:
      for member in zipped.namelist():
        if not member.lower().endswith((".gml", ".xml", ".citygml")):
          continue
        with zipped.open(member) as stream:
          for _, parent in ET.iterparse(stream, events=("end",)):
            if parent.tag != f"{{{NS['bldg']}}}Building":
              continue
            footprint = building_footprint(parent)
            if footprint is not None:
              matches = [
                (footprint.intersection(g).area / max(footprint.area, 1), key)
                for key, g in candidates.items()
                if g.intersects(footprint)
              ]
              if matches and max(matches)[0] > 0.55:
                overlap, key = max(matches)
                parts = [
                  part_profile(p) for p in leaf_building_parts(parent) or [parent]
                ]
                sites[key]["parents"].append(
                  {
                    "id": parent.get(GML_ID),
                    "geometrySource": "complete-official-lod2-leaf-sheets",
                    "tile": name,
                    "osmOverlapFraction": round(overlap, 6),
                    "parts": parts,
                  }
                )
            parent.clear()
    print(name, [(k, len(sites[k]["parents"])) for k in candidates], flush=True)
  for key, s in sites.items():
    full_world = world_geometry(footprints[key])
    covered_world = unary_union(
      [Polygon(p["ring"], p["holes"]) for owner in s["parents"] for p in owner["parts"]]
    )
    coverage = covered_world.intersection(full_world).area / full_world.area
    s["completeSheetFootprintCoverage"] = round(coverage, 6)
    if coverage < 0.90:
      remainder = full_world.difference(covered_world)
      remainder_projected = transform(
        lambda x, z, y=None: (x + 389500, 5820000 - z), remainder
      )
      missing_source_fallback(s, remainder_projected)
    if not s["parents"]:
      raise ValueError(f"No metric owner or mapped footprint at {key}")
    s["worldFootprint"] = mapping(world_geometry(footprints[key]))
    s["bounds"] = list(world_geometry(footprints[key]).bounds)
  return {
    "schemaVersion": 1,
    "step": 10,
    "originEpsg25833M": [389500, 5820000, 30],
    "license": "dl-de/zero-2-0; ODbL-1.0",
    "osmSourceSha256": digest(OSM),
    "archives": archives,
    "unavailableArchives": unavailable,
    "sites": [sites[k] for k in NAMES],
    "policy": "Exact measured sheets and OSM identities retained. Profiles are additive facade references, not authorization to delete generic owners. No district fill or residency-budget change.",
  }


def source_wall_edges(part: dict[str, Any], offset: float) -> list[dict[str, Any]]:
  """Extract horizontal spans with a conservative full-height rectangular wall interior."""
  polygon = Polygon(part["ring"], part.get("holes", []))
  edges = []
  seen = set()
  for surface in part["surfaces"]:
    if surface["kind"] != "WallSurface":
      continue
    ring = surface["rings"][0]
    a, b = max(
      ((a, b) for a in ring for b in ring),
      key=lambda p: math.hypot(p[1][0] - p[0][0], p[1][2] - p[0][2]),
    )
    dx, dz = b[0] - a[0], b[2] - a[2]
    length = math.hypot(dx, dz)
    if length < 2:
      continue
    ux, uz = dx / length, dz / length
    # Reject slanted wall planes: every XZ vertex must lie on the same vertical plane.
    if any(abs((p[0] - a[0]) * uz - (p[2] - a[2]) * ux) > 0.02 for p in ring):
      continue
    uvs = [[(p[0] - a[0]) * ux + (p[2] - a[2]) * uz, p[1] + offset] for p in ring]
    wall = Polygon(uvs)
    if not wall.is_valid or wall.area < 2:
      continue
    low = max(
      min(y for u, y in uvs if abs(u) < 0.02),
      min(y for u, y in uvs if abs(u - length) < 0.02),
    )
    high = min(
      max(y for u, y in uvs if abs(u) < 0.02),
      max(y for u, y in uvs if abs(u - length) < 0.02),
    )
    if high - low < 1 or not wall.buffer(0.015).covers(
      box(0.01, low + 0.01, length - 0.01, high - 0.01)
    ):
      continue
    nx, nz = -uz, ux
    mx, mz = (a[0] + b[0]) / 2, (a[2] + b[2]) / 2
    if polygon.covers(Point(mx + nx * 0.15, mz + nz * 0.15)):
      nx, nz = -nx, -nz
    key = tuple(
      sorted([(round(a[0], 3), round(a[2], 3)), (round(b[0], 3), round(b[2], 3))])
    ) + (round(low, 3), round(high, 3))
    if key in seen:
      continue
    seen.add(key)
    edges.append(
      {
        "a": [a[0], a[2]],
        "b": [b[0], b[2]],
        "base": round(low, 3),
        "eave": round(high, 3),
        "normal": [round(nx, 6), round(nz, 6)],
      }
    )
  return edges


def existing_ownership(source: dict[str, Any]) -> dict[str, dict[str, Any]]:
  """Audit actual committed navigation ownership without modifying any city packet."""
  out = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  manifest = read(out / "manifest.json")
  ids = {p["id"] for s in source["sites"] for p in s["parents"]}
  owners = {pid: {"family": "missing", "ids": [pid], "packets": []} for pid in ids}
  aliases = {}
  for site in source["sites"]:
    if site["key"] == "pankow":
      aliases["OSM-way-326471591"] = site["parents"][0]["id"]
    if site["key"] == "wilmersdorf":
      aliases["DEBE04YY50003OEl"] = "OSM-relation-5689205"
  for chunk in manifest["chunks"]:
    if chunk.get("detailCompanionOf") or not any(
      box(*chunk["bounds"]).intersects(box(*s["bounds"])) for s in source["sites"]
    ):
      continue
    payload = read(out / chunk["drawn"]["url"])
    for b in payload["nav"]["buildings"]:
      pid = aliases.get(b["sourceId"], b["sourceId"])
      if pid in ids:
        o = owners[pid]
        o["ids"] = [b["sourceId"]]
        o.update(
          {
            "family": "surrounding-city",
            "groundY": payload["nav"]["groundY"],
            "height": b.get("height"),
            "sourceGroundY": b.get("sourceGroundY"),
          }
        )
        o["packets"].append(chunk["id"])
  core_ids = {"tiergarten": "11048538", "wedding": "n-198259", "kreuzberg": "n-915481"}
  for site in source["sites"]:
    if site["key"] in core_ids:
      for parent in site["parents"]:
        # Modern Wedding extensions are distinct mapped owners, not this core prism.
        core_id = core_ids[site["key"]]
        if site["key"] == "wedding" and parent["id"] == "DEBE01YYK00040vj":
          core_id = "n-957286"
        owners[parent["id"]].update(
          {"family": "core-preserved", "ids": [core_id], "groundY": 5.2}
        )
  steglitz = read(DATA / "steglitzV182Evidence.json")
  for o in steglitz["owners"]:
    if o["id"] in owners:
      owners[o["id"]].update(
        {
          "family": "steglitzV182",
          "rigidYOffset": o["rigidYOffset"],
          "groundY": steglitz["groundY"],
        }
      )
  east = read(DATA / "eastLandmarksV187Navigation.json")
  for p in east.get("parts", east.get("buildings", [])):
    pid = p.get("owner")
    if pid in owners:
      owners[pid].update({"family": "eastLandmarksV187", "groundY": 3.0})
  # Mitte already has complete prior measured part sheets. Keep their original
  # authored parent datum, rather than inferring a different one from leaf walls.
  previous = read(DATA / "townhallV227Previous.json")
  for feature in previous["features"]:
    if feature["name"] == "Rathaus Mitte" and feature["parentId"] in owners:
      owners[feature["parentId"]]["rigidYOffset"] = round(
        feature["groundY"] - (feature["groundNHN"] - 30), 3
      )
  return owners


def build_profile(source: dict[str, Any]) -> dict[str, Any]:
  """Give the client only metric facade spans; full sheets remain offline evidence."""
  ownership = existing_ownership(source)
  sites = []
  for site in source["sites"]:
    parts = []
    families = set()
    for parent in site["parents"]:
      owner = ownership[parent["id"]]
      families.add(owner["family"])
      datum = min(p["ground_y_m"] for p in parent["parts"])
      offset = owner.get("rigidYOffset", owner.get("groundY", 3.0) - datum)
      parent["existingOwnership"] = {**owner, "rigidYOffset": round(offset, 3)}
      for p in parent["parts"]:
        edges = source_wall_edges(p, offset)
        top = round(p["top_y_m"] + offset, 3)
        # Existing unsurveyed OSM displays have their own retained roof height.
        # Recognition must stay on that visible wall instead of floating above it.
        if (
          parent["geometrySource"] != "complete-official-lod2-leaf-sheets"
          and owner["family"] == "surrounding-city"
        ):
          top = owner["groundY"] + owner["height"]
          for edge in edges:
            edge["eave"] = round(min(edge["eave"], top), 3)
          parent["existingOwnership"]["facadeTopAlignedToRetainedBody"] = top
        parts.append(
          {
            "id": p["id"],
            "parentId": parent["id"],
            "geometrySource": parent.get(
              "geometrySource", "complete-official-lod2-leaf-sheets"
            ),
            "ground_y_m": round(p["ground_y_m"] + offset, 3),
            "top_y_m": round(top, 3),
            "ring": p["ring"],
            "holes": p["holes"],
            "wallEdges": edges,
          }
        )
    centre = shape(site["worldFootprint"]).centroid
    sites.append(
      {
        "key": site["key"],
        "name": site["name"],
        "anchor": [round(centre.x, 3), 3.0, round(centre.y, 3)],
        "bounds": site["bounds"],
        "parts": parts,
        "existingOwnership": {
          "family": ";".join(sorted(families)),
          "ids": [p["id"] for p in site["parents"]],
        },
        "sourceDisposition": "Additive facade reference; existing body ownership retained",
      }
    )
  return {
    "schemaVersion": 1,
    "sites": sites,
    "policy": "Measured conservative wall spans; unsurveyed opening rhythm and ornament remain display estimates. Full source retained offline. All prior city owners preserved.",
  }


def main() -> int:
  """Rebuild from retained source by default; refresh only explicitly."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--extract",
    action="store_true",
    help="Extract named official owners from retained/downloaded bounded tiles",
  )
  args = parser.parse_args()
  source = extract_sources() if args.extract else read(SOURCE)
  profile = build_profile(source)
  write(SOURCE, source)
  write(PROFILE, profile)
  print(
    f"{len(profile['sites'])} halls; source {SOURCE.stat().st_size:,} bytes; profile {PROFILE.stat().st_size:,} bytes"
  )
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
