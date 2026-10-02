"""Extract complete Alt-Mitte source families without publishing runtime geometry.

All ownership is read from immutable v1.0.68 evidence. Surface coordinates retain
the source millimetre precision; one vertical translation applies to each family.
Historical-boundary straddlers remain complete, never cut at the district line.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from build_surrounding_outlines import (
  load_projected_polygon,
  source_identity,
  tags_for,
  world,
)
from pyproj import Transformer
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from isometric_berlin.data.fetch_lod2 import (
  GML_ID,
  NS,
  generic_attributes,
  leaf_building_parts,
  polygons_from_geometry,
  text_at,
)
from isometric_berlin.generation.build_minecraft_voxels import GroundSampler

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "geo_data/regierungsviertel"
OUTPUT = DATA / "alt-mitte-v169"
BOUNDARY = DATA / "alt-mitte-v169-boundary.geojson"
BASE = "v1.0.68"
MAX_GZIP = 5 * 1024 * 1024
WEAK_KEYS = {
  "preservedBuildingParents",
  "excluded_from_refinement",
  "excluded_source_parts",
  "excludedDetailedOwners",
  "neighbours",
  "retainedBoundaryParents",
}


def encode(value: Any) -> bytes:
  return json.dumps(
    value, separators=(",", ":"), ensure_ascii=False, allow_nan=False
  ).encode()


def base_bytes(path: str) -> bytes:
  return subprocess.check_output(["git", "show", f"{BASE}:{path}"], cwd=ROOT)


def sha_file(path: Path) -> str:
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def ownership_registry() -> tuple[dict[str, set[str]], dict[str, set[str]]]:
  """Reference/exclusion lists are evidence, not proof of rendered ownership."""
  owners: dict[str, set[str]] = defaultdict(set)
  references: dict[str, set[str]] = defaultdict(set)
  snapshot = json.loads((OUTPUT / "ownership-baseline.json").read_text())
  assert snapshot["baseRelease"] == BASE
  for identity in snapshot["runtimePrismSuppressedIds"]:
    owners[identity].add("runtime PRISM_SUPPRESSED_IDS")
  appearance = json.loads(
    gzip.decompress((OUTPUT / "appearance-baseline.json.gz").read_bytes())
  )
  assert appearance["baseRelease"] == BASE
  assert appearance["baseCommit"] == snapshot["baseCommit"]
  for name, identities in appearance["specialIdSets"].items():
    for identity in identities:
      owners[identity].add("immutable v168 evaluated " + name)
  for name in ("heroPrismTones", "heroPrismRoofTones", "heroWindowFormats"):
    for identity in appearance[name]:
      owners[identity].add("immutable v168 evaluated " + name)
  for identity in appearance["glassPrismIds"]:
    owners[identity].add("immutable v168 transparent glass shell and existing glazing")
  known_prism_ids = {
    p["id"]
    for p in json.loads(
      base_bytes("src/app/public/mesh/regierungsviertel/lod2-prisms.json")
    )["buildings"]
  }

  def add(identity: str, label: str, weak: bool) -> None:
    destination = references if weak else owners
    destination[identity].add(label)
    if identity.startswith("DEBE"):
      destination[identity[-8:]].add(label)

  def visit(value: Any, label: str, key: str = "", weak: bool = False) -> None:
    weak = weak or key in WEAK_KEYS
    if isinstance(value, dict):
      for child_key, child in value.items():
        visit(child, label, child_key, weak)
    elif isinstance(value, list):
      for child in value:
        visit(child, label, key, weak)
    elif isinstance(value, str):
      if value.startswith(("DEBE", "OSM-way-", "OSM-relation-")) or (
        key in {"id", "prismId", "prismIds", "legacyPrismIds", "replacesPrismIds"}
        and len(value) == 8
      ):
        add(value.strip(), label, weak)

  paths = subprocess.check_output(
    ["git", "ls-tree", "-r", "--name-only", BASE, "src/app/src"], cwd=ROOT, text=True
  ).splitlines()
  for name in paths:
    path = Path(name)
    if path.suffix == ".json":
      if path.name == "buildingAttributeSource.json":
        continue
      visit(json.loads(base_bytes(name)), name)
    elif path.suffix in {".ts", ".tsx"}:
      code = base_bytes(name).decode()
      for identity in re.findall(r"DEBE[A-Za-z0-9]+", code):
        add(identity, name, False)
      # Exact identity literals and unquoted object keys capture all HERO tone,
      # glass/window/trim and profile overrides without importing changing code.
      literals = set(re.findall(r"[\"']([A-Za-z0-9_-]{8})[\"']", code))
      literals.update(re.findall(r"\b([A-Za-z0-9_-]{8})\s*:", code))
      for identity in literals & known_prism_ids:
        add(identity, name, False)
  manifest = json.loads(
    base_bytes("src/app/public/mesh/surrounding-berlin-v159/manifest.json")
  )
  visit(manifest.get("source", {}), "v168 surrounding manifest")
  # Explicitly read just actual records, never the old broad exclusion registry.
  for filename in (
    "karl-marx-allee-v161",
    "west-streets-v163",
    "rosenthaler-platz-v163",
    "tauentzien-v165",
    "mitte-streets-v166",
    "oranien-corridors-v167",
    "scheunenviertel-v168",
  ):
    name = f"geo_data/regierungsviertel/{filename}.json"
    data = json.loads(base_bytes(name))
    for key in (
      "buildings",
      "corePrisms",
      "retainedDetailedBuildings",
      "retainedDetailedCorePrisms",
    ):
      visit(data.get(key, []), name)
  return owners, references


def rings_of(polygon: ET.Element) -> list[list[list[float]]]:
  rings = []
  boundaries = polygon.findall("gml:exterior", NS) + polygon.findall("gml:interior", NS)
  for boundary in boundaries:
    element = boundary.find(".//gml:posList", NS)
    if element is None:
      raise ValueError("Source polygon has a ring without posList")
    values = [float(v) for v in (element.text or "").split()]
    assert int(element.get("srsDimension", "3")) == 3 and len(values) % 3 == 0
    ring = [values[i : i + 3] for i in range(0, len(values), 3)]
    if len(ring) > 1 and ring[0] == ring[-1]:
      ring.pop()
    assert len(ring) >= 3
    rings.append(ring)
  return rings


def raw_surfaces(part: ET.Element) -> list[dict]:
  result = []
  for boundary in part.findall("bldg:boundedBy", NS):
    for surface in boundary:
      for polygon in surface.findall(".//gml:Polygon", NS):
        rings = rings_of(polygon)
        if rings:
          result.append(
            {
              "kind": surface.tag.split("}")[-1],
              "sourcePolygonId": polygon.get(GML_ID),
              "rings": rings,
            }
          )
  return result


def footprint(surfaces: list[dict]) -> Any:
  polys = []
  for surface in surfaces:
    if surface["kind"] != "GroundSurface":
      continue
    rings = [[(p[0], p[1]) for p in ring] for ring in surface["rings"]]
    polys.extend(
      polygons_from_geometry(shapely.make_valid(Polygon(rings[0], rings[1:])))
    )
  return unary_union(polys)


def footprint_rows(geometry: Any) -> list[dict]:
  return [
    {
      "ring": [[round(x, 3), round(z, 3)] for x, z in list(p.exterior.coords)[:-1]],
      "holes": [
        [[round(x, 3), round(z, 3)] for x, z in list(r.coords)[:-1]]
        for r in p.interiors
      ],
    }
    for p in polygons_from_geometry(geometry)
  ]


def prism_footprint(record: dict) -> Polygon:
  return Polygon(
    [(x / 10, z / 10) for x, z in record["ring"]],
    [[(x / 10, z / 10) for x, z in ring] for ring in record["holes"]],
  )


def clean(value: Any) -> Any:
  if value is None or isinstance(value, float) and math.isnan(value):
    return None
  return value


def resolve_unbound_core(
  manifest: dict, prisms: list[dict], core: Any, owners: dict, sampler: GroundSampler
) -> None:
  """Replace an OSM owner only with proven complete source-union coverage.

  The graph is keyed by complete legacy IDs (including disconnected prism pieces),
  not nearest centroids. Replacement groups are atomic in the global core shell.
  """
  core_world = world(core)
  candidates = {}
  exact_bound = set()
  official_geometries = {}
  unbound_residuals = {}
  for chunk in manifest["chunks"]:
    for record in json.loads(gzip.decompress((OUTPUT / chunk["file"]).read_bytes()))[
      "buildings"
    ]:
      if record["sourceType"] == "osm-context" and not record["legacyPrisms"]:
        unbound_residuals[record["id"]] = unary_union(
          [Polygon(p["ring"], p["holes"]) for p in record["footprintPolygons"]]
        )
      if record["sourceType"] != "official-lod2":
        continue
      geometry = unary_union(
        [Polygon(p["ring"], p["holes"]) for p in record["footprintPolygons"]]
      )
      official_geometries[record["id"]] = geometry
      exact_bound.update(record["legacyPrismIds"])
      if record["category"] == "retained" or record["legacyPrisms"]:
        continue
      if geometry.intersection(core_world).area > 0.01:
        candidates[record["id"]] = {
          "geometry": geometry,
          "groundNHN": record["groundNHN"],
        }
  legacy_by_id = defaultdict(list)
  for prism in prisms:
    legacy_by_id[prism["id"]].append(prism)
  legacy_ids = list(legacy_by_id)
  legacy_shapes = [
    unary_union([shapely.make_valid(prism_footprint(p)) for p in legacy_by_id[key]])
    for key in legacy_ids
  ]
  legacy_tree = shapely.STRtree(legacy_shapes)
  edges = {}
  reverse = defaultdict(set)
  for identity, candidate in candidates.items():
    geometry = candidate["geometry"]
    matches = set()
    for index in legacy_tree.query(geometry, predicate="intersects"):
      other = legacy_shapes[index]
      overlap = geometry.intersection(other).area
      if overlap > max(0.2, min(geometry.area, other.area) * 0.02):
        matches.add(legacy_ids[index])
        reverse[legacy_ids[index]].add(identity)
    edges[identity] = matches
  pending = set(candidates)
  updates = {}
  groups = []
  replaced_by = defaultdict(set)
  while pending:
    members = {min(pending)}
    old_ids = set()
    frontier = set(members)
    while frontier:
      new_ids = {key for identity in frontier for key in edges[identity]} - old_ids
      old_ids.update(new_ids)
      frontier = {identity for key in new_ids for identity in reverse[key]} - members
      members.update(frontier)
    pending.difference_update(members)
    official = unary_union([candidates[identity]["geometry"] for identity in members])
    original = unary_union([legacy_shapes[legacy_ids.index(key)] for key in old_ids])
    tolerance = 0.25
    official_cover = (
      1
      - official.difference(original.buffer(tolerance)).area / max(official.area, 1e-9)
      if old_ids
      else 0
    )
    legacy_cover = (
      1
      - original.difference(official.buffer(tolerance)).area / max(original.area, 1e-9)
      if old_ids
      else 0
    )
    reserved = sorted(key for key in old_ids if owners.get(key) or key in exact_bound)
    eligible = (
      bool(old_ids) and min(official_cover, legacy_cover) >= 0.99 and not reserved
    )
    status = (
      "replace-complete-legacy-group"
      if eligible
      else "new-core-source-without-old-mass"
      if not old_ids
      else "retain-old-mass-source-conflict"
    )
    group_id = (
      "core-binding-" + hashlib.sha256(encode(sorted(members))).hexdigest()[:16]
    )
    audit = {
      "id": group_id,
      "sourceFamilyIds": sorted(members),
      "legacyPrismIds": sorted(old_ids),
      "status": status,
      "quantizationToleranceM": tolerance,
      "minimumMutualCoverage": 0.99,
      "officialCoveredFraction": round(official_cover, 9),
      "legacyCoveredFraction": round(legacy_cover, 9),
      "officialAreaM2": round(official.area, 3),
      "legacyAreaM2": round(original.area, 3),
      "reservedLegacyIds": reserved,
      "officialUncoveredAreaM2": round(
        official.difference(original.buffer(tolerance)).area, 3
      )
      if old_ids
      else round(official.area, 3),
      "legacyUncoveredAreaM2": round(
        original.difference(official.buffer(tolerance)).area, 3
      ),
    }
    groups.append(audit)
    for identity in members:
      own_prisms = (
        [p for key in sorted(edges[identity]) for p in legacy_by_id[key]]
        if eligible
        else []
      )
      geometry = candidates[identity]["geometry"]
      if own_prisms:
        anchor = max(
          own_prisms, key=lambda p: geometry.intersection(prism_footprint(p)).area
        )
        ground_y = anchor["y0_dm"] / 10
        method = "complete source/legacy footprint-union match; largest-overlap exact original prism y0"
      else:
        center = geometry.intersection(core_world).centroid
        ground_y = round(
          float(sampler.sample(np.array([center.x]), np.array([center.y]))[0]), 1
        )
        method = "original v168 terrain sampler at clipped core source centroid; no exact legacy datum"
      updates[identity] = {
        "category": "core" if eligible or not old_ids else "retained",
        "legacyPrisms": own_prisms,
        "legacyPrismIds": sorted({p["id"] for p in own_prisms}),
        "groundY": ground_y,
        "datumMethod": method,
        "ownershipBinding": audit,
        "unmatchedCore": not bool(own_prisms),
      }
      if eligible:
        for key in edges[identity]:
          replaced_by[key].add(identity)
  visible_ids = [
    identity
    for identity in official_geometries
    if updates.get(identity, {}).get("category") != "retained"
  ]
  visible_shapes = [official_geometries[identity] for identity in visible_ids]
  visible_tree = shapely.STRtree(visible_shapes)
  residual_updates = {}
  for identity, geometry in unbound_residuals.items():
    intersections = [
      (visible_ids[i], geometry.intersection(visible_shapes[i]))
      for i in visible_tree.query(geometry, predicate="intersects")
    ]
    intersections = [
      (key, overlap) for key, overlap in intersections if overlap.area > 0
    ]
    covered = unary_union([g for _, g in intersections])
    missing = geometry.difference(covered).area
    center = geometry.centroid
    ground_y = round(
      float(sampler.sample(np.array([center.x]), np.array([center.y]))[0]), 1
    )
    residual_updates[identity] = {
      "footprintAreaM2": geometry.area,
      "uncoveredAreaM2": missing,
      "coveredFraction": 1 - missing / geometry.area,
      "minimumCoverageFraction": 0.99,
      "sourceCoverage": [
        {"sourceId": key, "overlapAreaM2": g.area} for key, g in intersections
      ],
      "status": "covered-by-rendered-official-source"
      if 1 - missing / geometry.area >= 0.99
      else "new-exact-residual-shell-required",
      "groundY": ground_y,
    }
  old_chunks = manifest["chunks"]
  manifest["chunks"] = []
  manifest["owners"] = []
  totals = Counter()
  for chunk in old_chunks:
    records = json.loads(gzip.decompress((OUTPUT / chunk["file"]).read_bytes()))[
      "buildings"
    ]
    for record in records:
      update = updates.get(record["id"])
      if update:
        shift = update["groundY"] - record["groundY"]
        record.update(
          {key: value for key, value in update.items() if key != "datumMethod"}
        )
        record["verticalTransform"].update(
          {
            "offsetY": round(record["groundY"] - record["groundNHN"], 6),
            "method": update["datumMethod"],
          }
        )
        for part in record["parts"]:
          part["groundY"] = round(part["groundY"] + shift, 3)
          part["topY"] = round(part["topY"] + shift, 3)
          for surface in part["surfaces"]:
            for ring in surface["rings"]:
              for point in ring:
                point[1] = round(point[1] + shift, 3)
        if update["category"] == "retained":
          record["ownershipReasons"].append(
            "source conflict: existing complete legacy mass retained; no duplicate official shell"
          )
          record["retentionReasonType"] = "source-conflict"
      replacements = sorted(
        {
          family
          for key in record["legacyPrismIds"]
          for family in replaced_by.get(key, set())
        }
      )
      if record["sourceType"] == "osm-context" and replacements:
        record["category"] = "retained"
        record["replacedByOfficialSourceFamilies"] = replacements
        record["retentionReasonType"] = "source-transferred"
        record["ownershipReasons"].append(
          "complete legacy footprint now owned by listed measured official families; omit additional fallback facade"
        )
      if record["id"] in residual_updates:
        residual = residual_updates[record["id"]]
        record["residualSourceAudit"] = residual
        record["groundY"] = residual["groundY"]
        record["verticalTransform"]["method"] = (
          "original v168 terrain sampler at exact residual footprint centroid; no legacy prism exists"
        )
        if residual["status"] == "covered-by-rendered-official-source":
          record["category"] = "retained"
          record["retentionReasonType"] = "source-fused"
          record["ownershipReasons"].append(
            "tiny OSM residual has at least99% exact footprint coverage by listed official source; marginal source disagreement retained as evidence, no duplicate mass"
          )
        else:
          record["needsResidualShell"] = True
          record["residualShellHeightM"] = record["sourceAttributes"][
            "measured_height_m"
          ]
      manifest["owners"].append(
        {
          key: record[key]
          for key in (
            "id",
            "category",
            "sourceType",
            "tile",
            "legacyPrismIds",
            "outerOwnerIds",
            "boundaryStraddler",
            "unmatchedCore",
          )
        }
      )
      if record["sourceType"] == "official-lod2":
        totals[record["category"] + "Families"] += 1
        totals[record["category"] + "Parts"] += len(record["parts"])
        totals[record["category"] + "Surfaces"] += sum(
          len(p["surfaces"]) for p in record["parts"]
        )
        totals["officialFamilies"] += 1
        totals["officialParts"] += len(record["parts"])
        totals["boundaryStraddlers"] += int(record["boundaryStraddler"])
      else:
        totals[record["sourceType"] + ":" + record["category"]] += 1
    write_chunk(records, chunk["tile"], manifest)
  manifest["counts"] = dict(totals)
  manifest["audit"]["coreFootprintBindingGroups"] = groups
  manifest["audit"]["coreFootprintBindingGroupCounts"] = dict(
    Counter(g["status"] for g in groups)
  )
  manifest["audit"]["geometricallyReplacedLegacyIds"] = sorted(replaced_by)
  manifest["audit"]["osmWithoutLegacyPrisms"] = [
    {"id": identity, **value} for identity, value in residual_updates.items()
  ]


def write_chunk(
  records: list[dict], tile: str, manifest: dict, number: int = 0
) -> None:
  raw = encode({"schemaVersion": 1, "buildings": records})
  compressed = gzip.compress(raw, compresslevel=9, mtime=0)
  if len(compressed) >= MAX_GZIP:
    assert len(records) > 1, (
      f"One family exceeds bounded source gzip: {records[0]['id']}"
    )
    midpoint = len(records) // 2
    write_chunk(records[:midpoint], tile, manifest, number * 2 + 1)
    write_chunk(records[midpoint:], tile, manifest, number * 2 + 2)
    return
  filename = f"source-{tile}-{number:02d}.json.gz"
  (OUTPUT / filename).write_bytes(compressed)
  manifest["chunks"].append(
    {
      "file": filename,
      "tile": tile,
      "buildings": len(records),
      "parts": sum(len(r["parts"]) for r in records),
      "categories": dict(Counter(r["category"] for r in records)),
      "bytes": len(compressed),
      "decodedBytes": len(raw),
      "sha256": hashlib.sha256(compressed).hexdigest(),
    }
  )


def extract() -> dict:
  OUTPUT.mkdir(parents=True, exist_ok=True)
  boundary_data = json.loads(BOUNDARY.read_text())
  scope = shape(boundary_data["features"][0]["geometry"])
  scope_world = world(scope)
  release = load_projected_polygon(DATA / "bounds.geojson")
  core = load_projected_polygon(DATA / "bounds-v158.geojson")
  owners, references = ownership_registry()
  park_samples = json.loads(
    base_bytes("src/app/public/mesh/regierungsviertel/park-details.json")
  )
  points = np.array(
    [r["position"] for key in ("trees", "street_lights") for r in park_samples[key]]
  )
  ground_sampler = GroundSampler(points[:, [0, 2]], points[:, 1])
  geographic = Transformer.from_crs(25833, 4326, always_xy=True)
  gx0, gy0 = geographic.transform(scope.bounds[0] - 100, scope.bounds[1] - 100)
  gx1, gy1 = geographic.transform(scope.bounds[2] + 100, scope.bounds[3] + 100)
  mapped = gpd.read_file(
    DATA / "raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    bbox=(gx0, gy0, gx1, gy1),
  ).to_crs(25833)
  mapped = mapped[
    [bool(tags_for(r).get("building")) for _, r in mapped.iterrows()]
  ].reset_index(drop=True)
  mapped_by_id = {source_identity(r): tags_for(r) for _, r in mapped.iterrows()}

  def osm_context(geometry: Any) -> dict:
    candidates = [
      (geometry.intersection(mapped.iloc[int(i)].geometry).area, int(i))
      for i in mapped.sindex.query(geometry, predicate="intersects")
    ]
    if not candidates:
      return {}
    overlap, index = max(candidates)
    if overlap < 1 or overlap / max(geometry.area, 1) < 0.1:
      return {}
    row = mapped.iloc[index]
    return {
      "id": source_identity(row),
      "tags": tags_for(row),
      "overlapAreaM2": round(overlap, 3),
      "relationship": "overlap context only; not source ownership or a geometry replacement",
    }

  prisms = json.loads(
    base_bytes("src/app/public/mesh/regierungsviertel/lod2-prisms.json")
  )["buildings"]
  by_prism: dict[str, list[dict]] = defaultdict(list)
  for prism in prisms:
    by_prism[prism["id"]].append(prism)
  outer = gpd.read_file(
    DATA / "raw/outer-v159/resolved-outlines.gpkg", layer="buildings"
  )
  outer_by_id = {row.sourceId: row for row in outer.itertuples()}
  official_core = gpd.read_file(DATA / "buildings.gpkg")
  core_leaf_ids = set(official_core.building_id)
  # Original per-leaf records are evidence for exact ID joins, not nearest geometry.
  core_parents = {
    str(clean(r.parent_building_id) or r.building_id)
    for r in official_core.itertuples()
  }
  manifest = {
    "schemaVersion": 1,
    "baseRelease": BASE,
    "baseCommit": json.loads((OUTPUT / "ownership-baseline.json").read_text())[
      "baseCommit"
    ],
    "appearanceBaseline": {
      "file": "appearance-baseline.json.gz",
      "sha256": sha_file(OUTPUT / "appearance-baseline.json.gz"),
    },
    "boundary": {
      "file": str(BOUNDARY.relative_to(ROOT)),
      "sha256": sha_file(BOUNDARY),
      "source": boundary_data.get("source", {}),
      "areaM2": round(scope.area, 3),
    },
    "frame": "x=easting-389500; z=5820000-northing; y=NHN-groundNHN+groundY",
    "licences": {"official": "dl-de/zero-2-0", "osm": "ODbL-1.0"},
    "selection": "Every complete official parent family whose ground footprint intersects the historical district by positive area; no road-distance/height filter. Whole families retained across district line. Existing authored ownership remains untouched.",
    "chunks": [],
    "transportEvidenceChunks": [],
    "sourceArchives": [],
    "owners": [],
    "audit": {
      "touchOnlyParents": [],
      "missingGroundParents": [],
      "duplicateParents": [],
      "missingTiles": [],
      "unmatchedCoreFamilies": [],
      "referenceOnlyFamilies": [],
    },
  }
  seen: set[str] = set()
  classified_prisms: set[str] = set()
  totals = Counter()
  minx, miny, maxx, maxy = scope.bounds
  # Include one adjacent tile: tile membership can follow a family's source anchor
  # while an overhanging wing crosses into the district on the other side.
  tile_paths = []
  for e in range(math.floor(minx / 1000) - 1, math.floor(maxx / 1000) + 2):
    for n in range(math.floor(miny / 1000) - 1, math.floor(maxy / 1000) + 2):
      tile_box = box(e * 1000, n * 1000, (e + 1) * 1000, (n + 1) * 1000)
      if not tile_box.intersects(scope.buffer(150)):
        continue
      path = DATA / f"raw/lod2/LoD2_{e}_{n}.zip"
      if not path.exists():
        manifest["audit"]["missingTiles"].append(path.name)
      else:
        tile_paths.append(path)
  assert not manifest["audit"]["missingTiles"], manifest["audit"]["missingTiles"]
  for path in tile_paths:
    tile = path.stem.removeprefix("LoD2_")
    records = []
    transport_evidence = []
    with zipfile.ZipFile(path) as archive:
      with archive.open(archive.namelist()[0]) as stream:
        for _, parent in ET.iterparse(stream, events=("end",)):
          if parent.tag != f"{{{NS['bldg']}}}Building":
            continue
          identity = parent.get(GML_ID)
          leaves = leaf_building_parts(parent) or [parent]
          source_parts = [(leaf, raw_surfaces(leaf)) for leaf in leaves]
          geometry = unary_union([footprint(s) for _, s in source_parts])
          if geometry.is_empty:
            # Official bridge objects use only WallSurface, including horizontal
            # decks. They are archived separately and never invented as buildings.
            positions = [
              p
              for _, surfaces in source_parts
              for s in surfaces
              for ring in s["rings"]
              for p in ring
            ]
            source_box = (
              box(
                min(p[0] for p in positions),
                min(p[1] for p in positions),
                max(p[0] for p in positions),
                max(p[1] for p in positions),
              )
              if positions
              else None
            )
            touches_scope = source_box is not None and source_box.intersects(scope)
            manifest["audit"]["missingGroundParents"].append(
              {
                "id": identity,
                "tile": tile,
                "name": text_at(parent, "gml:name"),
                "function": text_at(parent, "bldg:function"),
                "boundsIntersectScope": touches_scope,
                "classification": "non-building transport evidence; prior transport remains untouched",
              }
            )
            if touches_scope:
              transport_evidence.append(
                {
                  "id": identity,
                  "name": text_at(parent, "gml:name"),
                  "function": text_at(parent, "bldg:function"),
                  "coordinateFrame": "EPSG:25833 easting/northing/NHN; original source rings",
                  "parts": [
                    {"id": leaf.get(GML_ID), "surfaces": surfaces}
                    for leaf, surfaces in source_parts
                  ],
                }
              )
            parent.clear()
            continue
          intersection = geometry.intersection(scope).area
          if intersection <= 0.01:
            if geometry.intersects(scope):
              manifest["audit"]["touchOnlyParents"].append(identity)
            parent.clear()
            continue
          if identity in seen:
            manifest["audit"]["duplicateParents"].append(identity)
            parent.clear()
            continue
          seen.add(identity)
          ids = {identity, *(leaf.get(GML_ID) for leaf, _ in source_parts)}
          keys = ids | {i[-8:] for i in ids}
          legacy = [p for key in sorted(keys) for p in by_prism.get(key, [])]
          # Prefix collisions are not accepted as a geometrical owner match.
          family_world = world(geometry)
          legacy = [
            p
            for p in legacy
            if shapely.make_valid(prism_footprint(p)).intersection(family_world).area
            > 0.01
          ]
          legacy = list({encode(p): p for p in legacy}.values())
          reasons = sorted({reason for key in keys for reason in owners.get(key, [])})
          center_world = family_world.centroid
          functions = {
            text_at(leaf, "bldg:function") or text_at(parent, "bldg:function")
            for leaf, _ in source_parts
          }
          # The source's small 51009_1750 memorial components are the actual
          # Holocaust stelae, not ordinary houses. Preserve the authored field.
          if (
            "51009_1750" in functions
            and geometry.area < 10
            and math.hypot(
              center_world.x - 462.88128157681786, center_world.y - 557.3677023872733
            )
            < 200
          ):
            reasons.append(
              "existing authored Holocaust stele field; source monument function51009_1750 and exact small source footprint"
            )
          weak_reasons = sorted(
            {reason for key in keys for reason in references.get(key, [])}
          )
          ground = min(
            p[2]
            for _, surfaces in source_parts
            for s in surfaces
            if s["kind"] == "GroundSurface"
            for ring in s["rings"]
            for p in ring
          )
          datum_candidates = []
          for leaf, surfaces in source_parts:
            own_ground = [
              p[2]
              for s in surfaces
              if s["kind"] == "GroundSurface"
              for ring in s["rings"]
              for p in ring
            ]
            for p in legacy:
              if p["id"] in {leaf.get(GML_ID)[-8:], identity[-8:]} and own_ground:
                datum_candidates.append(
                  (min(own_ground), -prism_footprint(p).area, p["y0_dm"] / 10, p["id"])
                )
          datum_candidates.sort()
          ground_y = (
            datum_candidates[0][2] - (datum_candidates[0][0] - ground)
            if datum_candidates
            else 3.0
          )
          category = (
            "retained"
            if reasons
            else "core"
            if legacy or identity in core_parents
            else "outer"
          )
          unmatched_core = category == "core" and not legacy
          if unmatched_core:
            manifest["audit"]["unmatchedCoreFamilies"].append(identity)
            sampled_at = world(geometry.intersection(core)).centroid
            ground_y = round(
              float(
                ground_sampler.sample(
                  np.array([sampled_at.x]), np.array([sampled_at.y])
                )[0]
              ),
              1,
            )
          if weak_reasons and not reasons:
            manifest["audit"]["referenceOnlyFamilies"].append(
              {"id": identity, "references": weak_reasons}
            )
          outer_ids = sorted(ids & outer_by_id.keys())
          parts = []
          for leaf, surfaces in source_parts:
            f = footprint(surfaces)
            ys = [p[2] for s in surfaces for ring in s["rings"] for p in ring]
            part = {
              "id": leaf.get(GML_ID),
              "parentId": identity,
              "sourceAttributes": {
                **generic_attributes(parent),
                **generic_attributes(leaf),
                "function": text_at(leaf, "bldg:function")
                or text_at(parent, "bldg:function"),
                "roofType": text_at(leaf, "bldg:roofType")
                or text_at(parent, "bldg:roofType"),
                "measuredHeight": text_at(leaf, "bldg:measuredHeight"),
              },
              "groundY": round(min(ys) - ground + ground_y, 3) if ys else ground_y,
              "topY": round(max(ys) - ground + ground_y, 3) if ys else ground_y,
              "footprintPolygons": footprint_rows(world(f)),
              "surfaces": [],
            }
            for s in surfaces:
              part["surfaces"].append(
                {
                  **s,
                  "rings": [
                    [
                      [
                        round(p[0] - 389500, 3),
                        round(p[2] - ground + ground_y, 3),
                        round(5820000 - p[1], 3),
                      ]
                      for p in ring
                    ]
                    for ring in s["rings"]
                  ],
                }
              )
            parts.append(part)
          context = osm_context(geometry)
          record = {
            "id": identity,
            "category": category,
            "sourceType": "official-lod2",
            "tile": tile,
            "name": text_at(parent, "gml:name"),
            "groundNHN": ground,
            "groundY": round(ground_y, 6),
            "verticalTransform": {
              "offsetY": round(ground_y - ground, 6),
              "method": "lowest matched source leaf / exact legacy y0"
              if datum_candidates
              else "original v168 terrain sampler at clipped core source centroid; legacy prism absent below original area cutoff"
              if unmatched_core
              else "existing outer ground y=3",
              "legacyDatumCandidates": [
                {"sourceGroundNHN": a, "legacyY0": y, "prismId": pid}
                for a, _, y, pid in datum_candidates
              ],
            },
            "parts": parts,
            "footprintPolygons": footprint_rows(family_world),
            "legacyPrisms": legacy,
            "legacyPrismIds": sorted({p["id"] for p in legacy}),
            "outerOwnerIds": outer_ids,
            "ownershipReasons": reasons,
            "referenceOnlyReasons": weak_reasons,
            "osmTags": context.get("tags", {}),
            "osmContext": context,
            "sourceAttributes": generic_attributes(parent),
            "boundaryStraddler": geometry.difference(scope).area > 0.01,
            "boundaryIntersectionAreaM2": round(intersection, 3),
            "sourceFootprintAreaM2": round(geometry.area, 3),
            "outsideReleaseAreaM2": round(geometry.difference(release).area, 3),
            "coreIntersectionAreaM2": round(geometry.intersection(core).area, 3),
            "unmatchedCore": unmatched_core,
          }
          records.append(record)
          classified_prisms.update(record["legacyPrismIds"])
          manifest["owners"].append(
            {
              k: record[k]
              for k in (
                "id",
                "category",
                "sourceType",
                "tile",
                "legacyPrismIds",
                "outerOwnerIds",
                "boundaryStraddler",
                "unmatchedCore",
              )
            }
          )
          totals[category + "Families"] += 1
          totals[category + "Parts"] += len(parts)
          totals[category + "Surfaces"] += sum(len(p["surfaces"]) for p in parts)
          totals["officialFamilies"] += 1
          totals["officialParts"] += len(parts)
          totals["boundaryStraddlers"] += int(record["boundaryStraddler"])
          parent.clear()
    if records:
      write_chunk(records, tile, manifest)
      manifest["sourceArchives"].append(
        {
          "file": str(path.relative_to(ROOT)),
          "url": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
          "sha256": sha_file(path),
        }
      )
    if transport_evidence:
      filename = f"transport-evidence-{tile}.json.gz"
      raw = encode({"schemaVersion": 1, "transportEvidence": transport_evidence})
      compressed = gzip.compress(raw, compresslevel=9, mtime=0)
      assert len(compressed) < MAX_GZIP
      (OUTPUT / filename).write_bytes(compressed)
      manifest["transportEvidenceChunks"].append(
        {
          "file": filename,
          "objects": len(transport_evidence),
          "bytes": len(compressed),
          "sha256": hashlib.sha256(compressed).hexdigest(),
        }
      )
    print(
      json.dumps({"tile": tile, "selectedFamilies": len(records), "totals": totals}),
      flush=True,
    )
  # Exact original OSM residuals remain independent; no nearest-parent assignment.
  residuals: dict[str, list[dict]] = defaultdict(list)
  osm = gpd.read_file(DATA / "osm_context_buildings.gpkg")
  for row in osm[osm.geometry.intersects(scope)].itertuples():
    if row.geometry.intersection(scope).area <= 0.01:
      continue
    identity = row.building_id
    legacy = by_prism.get(identity[-8:], [])
    legacy = [
      p
      for p in legacy
      if prism_footprint(p).intersection(world(row.geometry)).area > 0.01
    ]
    reasons = sorted(owners.get(identity, set()) | owners.get(identity[-8:], set()))
    center = row.geometry.representative_point()
    tile = f"{math.floor(center.x / 1000)}_{math.floor(center.y / 1000)}-osm"
    record = {
      "id": identity,
      "category": "retained" if reasons else "coreFallback",
      "sourceType": "osm-context",
      "tile": tile,
      "parts": [],
      "legacyPrisms": legacy,
      "legacyPrismIds": sorted({p["id"] for p in legacy}),
      "outerOwnerIds": [],
      "groundNHN": None,
      "groundY": min((p["y0_dm"] / 10 for p in legacy), default=3.0),
      "verticalTransform": {
        "method": "original legacy prism y0 retained; no official NHN datum"
      },
      "footprintPolygons": footprint_rows(world(row.geometry)),
      "osmTags": mapped_by_id.get(identity, {}),
      "sourceAttributes": {
        key: clean(getattr(row, key))
        for key in (
          "building_name",
          "function",
          "roof_type",
          "measured_height_m",
          "height_source",
          "provenance",
          "source_url",
        )
      },
      "ownershipReasons": reasons,
      "boundaryStraddler": row.geometry.difference(scope).area > 0.01,
      "unmatchedCore": not bool(legacy),
      "legacyMatchStatus": "exact source ID and footprint"
      if legacy
      else "original residual below prism generation area cutoff; no coarse mass to suppress",
    }
    residuals[tile].append(record)
    classified_prisms.update(record["legacyPrismIds"])
    manifest["owners"].append(
      {
        k: record[k]
        for k in (
          "id",
          "category",
          "sourceType",
          "tile",
          "legacyPrismIds",
          "outerOwnerIds",
          "boundaryStraddler",
          "unmatchedCore",
        )
      }
    )
    totals["osmCoreResiduals"] += 1
    totals["osmCore" + record["category"].title()] += 1
  # Outer OSM records are already resolved/clipped and own exact sourceId envelopes.
  for row in outer[
    outer.sourceId.str.startswith("OSM") & outer.geometry.intersects(scope_world)
  ].itertuples():
    if row.geometry.intersection(scope_world).area <= 0.01:
      continue
    reasons = sorted(
      owners.get(row.sourceId, set()) | owners.get(row.sourceId[-8:], set())
    )
    center = row.geometry.representative_point()
    tile = f"{math.floor((center.x + 389500) / 1000)}_{math.floor((5820000 - center.y) / 1000)}-osm-outer"
    record = {
      "id": row.sourceId,
      "category": "retained" if reasons else "outer",
      "sourceType": "osm-outer",
      "tile": tile,
      "parts": [],
      "legacyPrisms": [],
      "legacyPrismIds": [],
      "outerOwnerIds": [row.sourceId],
      "groundNHN": None,
      "groundY": 3.0,
      "verticalTransform": {"method": "existing outer ground y=3"},
      "footprintPolygons": footprint_rows(row.geometry),
      "osmTags": mapped_by_id.get(row.sourceId, {}),
      "sourceAttributes": {
        "height": row.height,
        "minHeight": row.minHeight,
        "heightSource": row.heightSource,
      },
      "ownershipReasons": reasons,
      "boundaryStraddler": row.geometry.difference(scope_world).area > 0.01,
      "unmatchedCore": False,
    }
    residuals[tile].append(record)
    manifest["owners"].append(
      {
        k: record[k]
        for k in (
          "id",
          "category",
          "sourceType",
          "tile",
          "legacyPrismIds",
          "outerOwnerIds",
          "boundaryStraddler",
          "unmatchedCore",
        )
      }
    )
    totals["osmOuterResiduals"] += 1
  for tile, records in sorted(residuals.items()):
    write_chunk(records, tile, manifest)
  resolve_unbound_core(manifest, prisms, core, owners, ground_sampler)
  selected_existing_ids = {
    r.building_id
    for r in official_core[official_core.geometry.intersects(scope)].itertuples()
    if r.geometry.intersection(scope).area > 0.01
  }
  extracted_leaf_ids = set()
  for chunk in manifest["chunks"]:
    for record in json.loads(gzip.decompress((OUTPUT / chunk["file"]).read_bytes()))[
      "buildings"
    ]:
      extracted_leaf_ids.update(part["id"] for part in record["parts"])
  manifest["audit"]["existingOfficialCoreLeafIdsMissingFromSource"] = sorted(
    selected_existing_ids - extracted_leaf_ids
  )
  manifest["audit"]["unclassifiedExistingCorePrisms"] = [
    p
    for p in prisms
    if p["id"] not in classified_prisms
    and shapely.make_valid(prism_footprint(p)).intersection(scope_world).area > 0.01
  ]
  source_by_short = defaultdict(list)
  for row in official_core.itertuples():
    source_by_short[row.building_id[-8:]].append(row)
  boundary_legacy = []
  unexplained = []
  for prism in manifest["audit"]["unclassifiedExistingCorePrisms"]:
    matches = source_by_short.get(prism["id"], [])
    if matches and all(r.geometry.intersection(scope).area <= 0.01 for r in matches):
      boundary_legacy.append(
        {
          "legacyPrism": prism,
          "sourceIds": [r.building_id for r in matches],
          "sourceIntersectionAreasM2": [
            round(r.geometry.intersection(scope).area, 6) for r in matches
          ],
          "reason": "Only old simplified/decimetre prism crosses district boundary; actual official footprint outside or numerical boundary touch. Retain existing source owner unchanged.",
        }
      )
    else:
      unexplained.append(prism)
  manifest["audit"]["retainedBoundaryApproximationPrisms"] = boundary_legacy
  manifest["audit"]["unclassifiedExistingCorePrisms"] = unexplained
  manifest["audit"]["outerFamiliesWithoutOldOuterOwner"] = [
    o["id"]
    for o in manifest["owners"]
    if o["category"] == "outer"
    and o["sourceType"] == "official-lod2"
    and not o["outerOwnerIds"]
  ]
  manifest["audit"]["coreFamiliesWithOuterOwners"] = [
    o["id"]
    for o in manifest["owners"]
    if o["category"] == "core" and o["outerOwnerIds"]
  ]
  manifest["audit"]["existingCoreLeafCount"] = len(core_leaf_ids)
  manifest["audit"]["unmatchedCoreFamilies"] = [
    o["id"]
    for o in manifest["owners"]
    if o["category"] == "core" and o["unmatchedCore"]
  ]
  (OUTPUT / "source-manifest.json").write_bytes(encode(manifest))
  print(
    json.dumps(
      {
        "counts": manifest["counts"],
        "audit": {
          key: len(value) if isinstance(value, list) else value
          for key, value in manifest["audit"].items()
        },
        "sourceBytes": sum(c["bytes"] for c in manifest["chunks"]),
      }
    ),
    flush=True,
  )
  return manifest


if __name__ == "__main__":
  argparse.ArgumentParser(description=__doc__).parse_args()
  extract()
