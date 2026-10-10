"""Step 10: additive, streamed Moabit and named Prenzlauer frontage accents.

The v188 wall/occlusion/native-corridor checks are reused. Existing packets are
immutable inputs; this script emits a manifest patch for explicit integration.
"""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pyogrio
import shapely
from build_district_facades_v188 import (
  FacadeMesh,
  digest,
  district_shapes,
  exposed_front,
  mesh_wall_triangles,
  read_json,
  source_wall_exists,
  world,
  write_json,
)
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
CONTEXT = GEO / "kiez-facades-v209-context.json.gz"
EVIDENCE = GEO / "kiez-facades-v209-evidence.json.gz"
PREFIX = "kiez209-"
POLICY = (
  "All eligible ordinary source frontages throughout the exact Moabit Ortsteil, "
  "plus finite named Weinbergsweg/Kastanienallee, Kollwitzkiez and Helmholtzplatz "
  "street corridors. Existing v188 panes remain; add sills and fine crossbars. "
  "Previously blank generic street walls gain estimated windows and base/eave "
  "courses. No owner quota, courtyard windows, shop names or measured aperture "
  "claim. Authored owners and recorded material/colour remain protected. Core "
  "facade axes receive a separate bounded ink-only refinement. No new geography, "
  "navigation ownership, replacement, residency limit or mobile quality tier."
)
CORRIDORS = {
  "Weinbergsweg / Kastanienallee": {"Weinbergsweg", "Kastanienallee"},
  "Kollwitzkiez": {
    "Kollwitzstraße",
    "Knaackstraße",
    "Wörther Straße",
    "Husemannstraße",
    "Sredzkistraße",
    "Rykestraße",
    "Diedenhofer Straße",
  },
  "Helmholtzplatz": {
    "Raumerstraße",
    "Lychener Straße",
    "Lettestraße",
    "Schliemannstraße",
    "Dunckerstraße",
  },
}
# Explicit limits cut the named streets at the requested neighbourhood rather
# than following the same street name into unrelated northern blocks.
PB_LIMIT = box(2100, -3000, 3800, -1000)
HELM_LIMIT = box(3100, -2900, 3550, -2430)
KOLL_LIMIT = box(2850, -2450, 3700, -1610)


def extract_context() -> dict:
  """Freeze bounded retained OSM roads/protection and exact ALKIS Moabit."""
  prior = read_json(GEO / "district-facades-v188-context.json.gz")
  moabit = district_shapes()["Moabit"]
  roads = [r for r in prior["roads"] if shape(r["geometry"]).intersects(moabit)]
  for r in roads:
    r["scope"] = "Moabit"
  source = GEO / "raw/north-city-v190/candidate.gpkg"
  lines = pyogrio.read_dataframe(
    source, layer="lines", bbox=(13.395, 52.525, 13.432, 52.549)
  ).to_crs(25833)
  for row in lines.itertuples():
    group = next((k for k, names in CORRIDORS.items() if row.name in names), None)
    if group is None or row.highway not in {
      "tertiary",
      "residential",
      "unclassified",
      "living_street",
      "pedestrian",
    }:
      continue
    limit = (
      HELM_LIMIT
      if group == "Helmholtzplatz"
      else KOLL_LIMIT
      if group == "Kollwitzkiez"
      else PB_LIMIT
    )
    geometry = world(row.geometry).intersection(limit)
    if not geometry.is_empty:
      roads.append(
        {
          "id": str(row.osm_id),
          "name": row.name,
          "scope": group,
          "geometry": mapping(geometry),
        }
      )
  region = shapely.union_all(
    [moabit]
    + [shape(r["geometry"]).buffer(45) for r in roads if r["scope"] != "Moabit"]
  )
  protected = [
    r for r in prior["protectedBuildings"] if shape(r["geometry"]).intersects(moabit)
  ]
  areas = pyogrio.read_dataframe(
    source, layer="multipolygons", bbox=(13.395, 52.525, 13.432, 52.549)
  ).to_crs(25833)
  for row in areas.itertuples():
    if not isinstance(row.building, str):
      continue
    tags = row.other_tags if isinstance(row.other_tags, str) else ""
    reasons = []
    if row.building not in {
      "yes",
      "apartments",
      "residential",
      "house",
      "detached",
      "terrace",
    }:
      reasons.append("specific-building-use")
    if any(isinstance(getattr(row, k), str) for k in ["name", "amenity", "tourism"]):
      reasons.append("named-or-public-building")
    if any(
      f'"{k}"=>' in tags
      for k in [
        "building:colour",
        "building:material",
        "facade:colour",
        "facade:material",
      ]
    ):
      reasons.append("recorded-facade-material-or-colour")
    geometry = world(row.geometry)
    if reasons and geometry.intersects(region):
      protected.append(
        {
          "id": str(row.osm_id or row.osm_way_id),
          "reasons": reasons,
          "geometry": mapping(geometry),
        }
      )
  authored = set(prior["authoredIds"])
  for path in (ROOT / "src/app/src/data").glob("*.json"):
    if path.name not in {"buildingAttributeSource.json", "kiezFacadesV209.json"}:
      authored.update(re.findall(r"\bDEBE[A-Za-z0-9]+", path.read_text()))
  context = {
    "schemaVersion": 1,
    "policy": POLICY,
    "osmSource": prior["osmSource"],
    "osmLicense": "ODbL-1.0",
    "inputSha256": {
      str(source.relative_to(ROOT)): digest(source),
      "geo_data/regierungsviertel/district-facades-v188-context.json.gz": digest(
        GEO / "district-facades-v188-context.json.gz"
      ),
    },
    "roads": roads,
    "protectedBuildings": protected,
    "authoredIds": sorted(authored),
    "moabit": mapping(moabit),
    "selectionRegion": mapping(region),
  }
  write_json(CONTEXT, context)
  return context


def accent_grid(
  mesh: FacadeMesh, face: dict, native: bool, occupied: STRtree | None = None
) -> int:
  """Complement the retained pane recipe; never paint over prior detail."""
  old = face["previousV188"]
  count = 0
  a, b = np.array(face["a"]), np.array(face["b"])
  width = float(np.linalg.norm(b - a))
  direction, normal = (b - a) / width, np.array(face["normal"])
  low, high = face["low"], face["high"]
  rows = max(1, int((high - low - 1.5) / (4 if native else 3.6)))
  cols = max(1, int((width - 1.5) / (4 if native else 3.8)))
  omitted = set(face.get("omittedWindowColumns", []))
  if occupied is not None and not native:
    for col in range(cols):
      u = (col + 0.5) * width / cols
      left, right = a + direction * (u - 0.78), a + direction * (u + 0.78)
      approach = Polygon(
        [
          left + normal * 0.025,
          right + normal * 0.025,
          right + normal * 3,
          left + normal * 3,
        ]
      )
      if len(occupied.query(approach, predicate="intersects")):
        omitted.add(col)
    face["omittedWindowColumns"] = sorted(omitted)
  for row in range(rows):
    y = low + 1.5 + (row + 0.5) * (high - low - 2.4) / rows
    for col in range(cols):
      if col in omitted:
        continue
      u = (col + 0.5) * width / cols
      if not old:
        mesh.pane(
          a,
          direction,
          normal,
          u,
          y,
          1.15 if native else 1.32,
          1.4 if native else 1.8,
          0.045 if native else 0.075,
          (93, 119, 124) if native else (122, 148, 151),
          None if native else (78, 105, 114),
        )
      mesh.pane(
        a,
        direction,
        normal,
        u,
        y - (0.78 if native else 0.96),
        1.22 if native else 1.54,
        0.11,
        0.11,
        (197, 190, 170),
        (232, 224, 205),
      )
      # Separate orthogonal native panes retain their simpler block rhythm.
      if not native:
        mesh.pane(a, direction, normal, u, y + 0.24, 1.30, 0.065, 0.11, (183, 193, 187))
      count += 1
  if not native and not old:
    mesh.pane(
      a,
      direction,
      normal,
      width / 2,
      high - 0.35,
      width - 0.6,
      0.14,
      0.105,
      (169, 170, 155),
      (230, 222, 204),
    )
    mesh.pane(
      a,
      direction,
      normal,
      width / 2,
      low + 0.75,
      width - 0.6,
      0.14,
      0.105,
      (169, 170, 155),
    )
  return count


def build() -> dict:
  """Add bounded companion files; return a patch, never rewrite old packets."""
  context = read_json(CONTEXT) if CONTEXT.exists() else extract_context()
  manifest = read_json(OUT / "manifest.json")
  previous = [c for c in manifest["chunks"] if not c["id"].startswith(PREFIX)]
  region, moabit = shape(context["selectionRegion"]), shape(context["moabit"])
  streets = [shape(r["geometry"]) for r in context["roads"]]
  road_tree = STRtree(streets)
  protected = STRtree([shape(r["geometry"]) for r in context["protectedBuildings"]])
  authored = set(context["authoredIds"])
  old_faces = {
    f["owner"]: f
    for f in read_json(GEO / "district-facades-v188-evidence.json.gz")["faces"]
  }
  primary = [
    c
    for c in previous
    if not c.get("detailCompanionOf") and region.intersects(box(*c["bounds"]))
  ]
  inventory, packets = [], {}
  for desc in primary:
    packet = read_json(OUT / desc["drawn"]["url"])
    packets[desc["id"]] = packet
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      geometry = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if geometry.is_valid and not geometry.is_empty:
        inventory.append((desc["id"], b, geometry))
  occupied = STRtree([b[2] for b in inventory])
  by_chunk = defaultdict(list)
  for desc_id, b, geometry in inventory:
    by_chunk[desc_id].append((b, geometry))
  counts, candidates = Counter(), defaultdict(list)
  for desc in primary:
    packet = packets[desc["id"]]
    ox, oy, oz = packet["origin"]
    triangles = mesh_wall_triangles(packet)
    for building, geometry in by_chunk[desc["id"]]:
      owner = building["sourceId"]
      if not region.covers(geometry.representative_point()):
        continue
      counts["scannedOwners"] += 1
      if (
        not owner.startswith("DEBE")
        or owner in authored
        or len(protected.query(geometry, predicate="intersects"))
      ):
        counts["protectedOwners"] += 1
        continue
      low = (
        packet["nav"]["groundY"]
        + building["minHeight"]
        + building.get("groundOffset", 0)
      )
      high = (
        packet["nav"]["groundY"] + building["height"] + building.get("groundOffset", 0)
      )
      if not 7 <= high - low <= 36 or building["minHeight"] > 0.1:
        continue
      ring = building["ring"]
      for a, b in zip(ring, ring[1:] + ring[:1]):
        if not source_wall_exists(triangles, a, b, low - oy, high - oy):
          continue
        wa, wb = np.array(a) + [ox, oz], np.array(b) + [ox, oz]
        selection = exposed_front(wa, wb, geometry, streets, road_tree, occupied)
        if selection is None:
          continue
        width, _, normal, ri = selection
        road = context["roads"][ri]
        if road["scope"] == "Moabit" and not moabit.covers(
          geometry.representative_point()
        ):
          continue
        if not box(*desc["bounds"]).covers(
          LineString([wa + normal * 0.12, wb + normal * 0.12])
        ):
          continue
        face = {
          "owner": owner,
          "district": road["scope"],
          "chunk": desc["id"],
          "a": wa.tolist(),
          "b": wb.tolist(),
          "low": low,
          "high": high,
          "normal": normal.tolist(),
          "streetId": road["id"],
          "streetName": road["name"],
          "previousV188": owner in old_faces,
        }
        if owner in old_faces:
          prior = old_faces[owner]
          # Align the new sill/crossbar to the already delivered frontage.
          if (
            max(np.linalg.norm(wa - prior["a"]), np.linalg.norm(wb - prior["b"])) > 0.03
          ):
            continue
          face["omittedWindowColumns"] = prior.get("omittedWindowColumns", [])
        candidates[owner].append((width, face))
  selected = [
    max(faces, key=lambda f: (f[0], f[1]["chunk"]))[1]
    for _, faces in sorted(candidates.items())
  ]
  faces_by_chunk = defaultdict(list)
  for face in selected:
    faces_by_chunk[face["chunk"]].append(face)
  companions = []
  for desc in primary:
    faces = faces_by_chunk[desc["id"]]
    if not faces:
      continue
    drawn = FacadeMesh(packets[desc["id"]]["origin"])
    for face in faces:
      face["windowCount"] = accent_grid(drawn, face, False, occupied)
      counts["fronts_" + face["district"]] += 1
      counts["windows"] += face["windowCount"]
      counts["retainedV188Fronts"] += int(face["previousV188"])
    source = read_json(OUT / desc["minecraft"]["url"])
    native, triangles = FacadeMesh(source["origin"]), mesh_wall_triangles(source)
    ox, oy, oz = source["origin"]
    owners = defaultdict(list)
    for b in source["nav"]["buildings"]:
      owners[b["sourceId"]].append(b)
    for face in faces:
      corridor = LineString([face["a"], face["b"]]).buffer(1.6, cap_style=2)
      face["nativeSpans"], face["nativeWindowCount"] = [], 0
      for b in owners[face["owner"]]:
        low = source["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
        high = source["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
        ring = b["ring"]
        polygon = translate(Polygon(ring, b["holes"]), ox, oz)
        for a, end in zip(ring, ring[1:] + ring[:1]):
          if a[0] != end[0] and a[1] != end[1]:
            continue
          if not source_wall_exists(triangles, a, end, low - oy, high - oy):
            continue
          clipped = LineString(
            [np.array(a) + [ox, oz], np.array(end) + [ox, oz]]
          ).intersection(corridor)
          if clipped.geom_type != "LineString" or clipped.is_empty:
            continue
          wa, wb = np.array(clipped.coords[0]), np.array(clipped.coords[-1])
          span = float(np.linalg.norm(wb - wa))
          if span < 3:
            continue
          direction = (wb - wa) / span
          normal = np.array([-direction[1], direction[0]])
          if np.dot(normal, face["normal"]) < 0:
            normal = -normal
          if np.dot(normal, face["normal"]) < 0.65 or not box(*desc["bounds"]).covers(
            LineString([wa + normal * 0.12, wb + normal * 0.12])
          ):
            continue
          if any(
            polygon.covers(Point(*(wa + (wb - wa) * t + normal * 0.2)))
            for t in [0.05, 0.25, 0.5, 0.75, 0.95]
          ):
            continue
          native_face = {
            **face,
            "a": wa.tolist(),
            "b": wb.tolist(),
            "normal": normal.tolist(),
            "low": low,
            "high": high,
            "omittedWindowColumns": [],
          }
          number = accent_grid(native, native_face, True)
          face["nativeWindowCount"] += number
          face["nativeSpans"].append(
            {k: native_face[k] for k in ["a", "b", "normal", "low", "high"]}
          )
          counts["nativeWindows"] += number
    companion = {
      "id": PREFIX + desc["id"],
      "detailCompanionOf": desc["id"],
      "bounds": desc["bounds"],
    }
    for family, mesh in [("drawn", drawn), ("minecraft", native)]:
      payload = mesh.payload()
      for part in payload["meshes"]:
        part["kind"] = "kiez-facades-v209"
      url = companion["id"] + f".{family}.json.gz"
      write_json(OUT / url, {"id": companion["id"], **payload})
      asset = OUT / url
      companion[family] = {
        "url": url,
        "bytes": asset.stat().st_size,
        "decodedBytes": len(__import__("gzip").decompress(asset.read_bytes())),
        "encoding": "gzip",
        "sha256": digest(asset),
      }
      counts[family + "Vertices"] += len(mesh.positions)
      counts[family + "GeometryBytes"] += len(mesh.positions) * 12 + len(
        mesh.indices
      ) * (2 if len(mesh.positions) <= 65535 else 4)
      counts[family + "TransferBytes"] += asset.stat().st_size
    companions.append(companion)
  assert len(previous) + len(companions) <= 2048
  evidence = {
    "schemaVersion": 1,
    "policy": POLICY,
    "contextSha256": digest(CONTEXT),
    "counts": dict(counts),
    "faces": selected,
    "companions": companions,
    "oldDescriptors": previous,
    "oldManifestFieldSha256": {
      k: __import__("hashlib")
      .sha256(json.dumps(v, sort_keys=True, separators=(",", ":")).encode())
      .hexdigest()
      for k, v in manifest.items()
      if k not in {"chunks", "kiezFacadesV209"}
    },
  }
  write_json(EVIDENCE, evidence)
  write_json(OUT / "kiez-facades-v209-evidence.json.gz", evidence)
  write_json(
    GEO / "kiez-facades-v209-manifest-patch.json",
    {
      "chunks": companions,
      "kiezFacadesV209": {
        "policy": POLICY,
        "chunks": len(companions),
        "counts": dict(counts),
        "evidence": "kiez-facades-v209-evidence.json.gz",
      },
    },
  )
  print(json.dumps({"companions": len(companions), **counts}, indent=2))
  return evidence


if __name__ == "__main__":
  build()
