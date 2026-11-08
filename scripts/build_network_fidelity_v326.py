"""Complete Berlin route ledger, followed by bounded source-supported additions.

Original courses, previous authored networks and regional A10 remain immutable.
An OSM layer number is a topological ordering, never a measured metre height.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import re
from collections import Counter
from typing import Any

import geopandas as gpd
import numpy as np
import shapely
from pyproj import Transformer
from shapely import make_valid
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import substring, transform, unary_union
from shapely.strtree import STRtree

from isometric_berlin.generation.road_geometry import parse_osm_measure_m
from scripts.build_north_east_public_sites_v326 import (
  DATA,
  GEO,
  ROOT,
  baseline_manifest,
  load_projected_polygon,
  read,
  sha,
  world,
  write,
)
from scripts.build_surrounding_outlines import (
  PackedMesh,
  line_parts,
  linear_rgb_bytes,
  polygons_from_geometry,
)

RAW = GEO / "raw/public-fidelity-v326/major_routes.geojson.gz"
BOUNDARY = GEO / "raw/berlin-boundaries-v200/landesgrenze.geojson"
SOURCE = GEO / "network-fidelity-v326-source.json.gz"
EVIDENCE = GEO / "network-fidelity-v326-evidence.json.gz"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
KIND = "network-fidelity-v326"
PROTECTED = {
  "main-streets-v254-source.json.gz": ("named",),
  "boulevard-transport-v210-source.json": ("features",),
  "alt-mitte-transport-v206-source.json": ("features",),
  "city-streets-v249-source.json.gz": ("features",),
  "spree-bridges-v242-source.json": ("bridges",),
  "europacity-rail-v313-source.json.gz": ("ways",),
  "rail-stations-v190-evidence.json": ("features",),
  "rail-bridge-approach-v307-source.json.gz": ("pbfRoads",),
  "steglitz-motorway-v226-source.json": ("features",),
  "citywest-transport-v281-source.json": ("features",),
  "motorway-v205-lanes-source.json": ("ways",),
}


def tags(properties: dict[str, Any]) -> dict[str, str]:
  """Keep original OSM values; do not infer an affirmative physical dimension."""
  result = dict(
    re.findall(r'"([^"\\]+)"=>"([^"\\]*)"', str(properties.get("other_tags", "")))
  )
  result.update(
    {k: v for k, v in properties.items() if k != "other_tags" and isinstance(v, str)}
  )
  return result


def way_id(value: Any) -> str | None:
  """Only an exact positive OSM way ID is an owner identity."""
  if not isinstance(value, (str, int)):
    return None
  text = str(value).removeprefix("OSM-way-").removeprefix("way/")
  return "way/" + text if text.isdigit() and int(text) > 0 else None


def protected_ids() -> tuple[dict[str, list[str]], list[dict[str, Any]]]:
  """Finite actual old source IDs: retain complete earlier named detail."""
  result: dict[str, list[str]] = {}
  inputs = []

  def visit(value: Any, origin: str) -> None:
    if isinstance(value, dict):
      identity = next(
        (
          way_id(value[k])
          for k in ("key", "id", "sourceId")
          if k in value and way_id(value[k])
        ),
        None,
      )
      if identity:
        result.setdefault(identity, []).append(origin)
      for key, child in value.items():
        if key.startswith("way/"):
          result.setdefault(key, []).append(origin)
        if isinstance(child, (dict, list)):
          visit(child, origin)
    elif isinstance(value, list):
      for child in value:
        visit(child, origin)

  for name, keys in PROTECTED.items():
    path = GEO / name
    source = read(path)
    inputs.append({"path": str(path.relative_to(ROOT)), "sha256": sha(path)})
    for key in keys:
      visit(source[key], name)
  p = DATA / "tramRailsV281.json"
  inputs.append({"path": str(p.relative_to(ROOT)), "sha256": sha(p)})
  visit(read(p)["tracks"], p.name)
  return {k: sorted(set(v)) for k, v in result.items()}, inputs


def at_grade(t: dict[str, str]) -> bool:
  """A tunnel/elevated/deck record needs its own real measured support."""
  try:
    layer = float(t.get("layer", "0"))
  except ValueError:
    return False
  return (
    layer == 0
    and t.get("bridge", "no") in {"no", "false", "0"}
    and t.get("tunnel", "no") in {"no", "false", "0"}
    and t.get("location") not in {"underground", "elevated"}
  )


def audit() -> dict[str, Any]:
  """Account every source record and exact Berlin/outside course complement."""
  protected, inputs = protected_ids()
  boundary = world(make_valid(load_projected_polygon(BOUNDARY)))
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform
  records, totals = [], Counter()
  raw = read(RAW)
  ids = set()
  for feature in raw["features"]:
    t = tags(feature["properties"])
    key = way_id(t.get("osm_id"))
    if not key or key in ids:
      raise ValueError("Missing or duplicate original route identity")
    ids.add(key)
    original = world(transform(project, shape(feature["geometry"])))
    selected = unary_union(list(line_parts(original.intersection(boundary))))
    remainder = original.difference(boundary)
    if abs(selected.length + remainder.length - original.length) > 1e-5:
      raise ValueError("Incomplete source-course complement " + key)
    railway = t.get("railway")
    group = "rail/" + railway if railway else "road/" + t.get("highway", "bridge")
    if selected.length < 0.01:
      disposition = "outside-Berlin-retained"
    elif key in protected:
      disposition = "authored-source-retained"
    elif railway in {
      "construction",
      "proposed",
      "abandoned",
      "razed",
      "disused",
    } or t.get("highway") in {"construction", "proposed"}:
      disposition = "inactive-or-proposed-retained"
    elif not at_grade(t):
      disposition = "separate-height-support-required"
    elif railway == "subway":
      disposition = "underground-station-scope-retained"
    else:
      disposition = "actual-packet-support-audit-required"
    totals[disposition] += 1
    records.append(
      {
        "key": key,
        "sourceFeatureId": feature.get("id"),
        "tags": t,
        "group": group,
        "disposition": disposition,
        "originalLengthM": original.length,
        "berlinLengthM": selected.length,
        "outsideLengthM": remainder.length,
        "geometry": mapping(selected),
        "authoredSources": protected.get(key, []),
      }
    )
  source = {
    "schemaVersion": 1,
    "source": {
      "path": str(RAW.relative_to(ROOT)),
      "sha256": sha(RAW),
      "records": len(records),
      "date": "2026-09-29",
      "license": "ODbL-1.0",
      "originalGeographicCoursesRetained": True,
    },
    "boundary": {"path": str(BOUNDARY.relative_to(ROOT)), "sha256": sha(BOUNDARY)},
    "preservedInputs": inputs,
    "records": records,
    "policy": "No layer-to-height conversion. No replacement of source road/rail courses, native bed, authored bridges/stations or regional A10.",
  }
  write(SOURCE, source)
  report = {
    "schemaVersion": 1,
    "sourceSha256": sha(SOURCE),
    "records": len(records),
    "dispositions": dict(totals),
    "insideBerlinRecords": sum(r["berlinLengthM"] > 0.01 for r in records),
    "sourceMetres": sum(r["originalLengthM"] for r in records),
    "berlinMetres": sum(r["berlinLengthM"] for r in records),
    "outsideMetres": sum(r["outsideLengthM"] for r in records),
    "groups": dict(Counter(r["group"] for r in records if r["berlinLengthM"] > 0.01)),
    "preservedInputs": inputs,
    "missingPhysicalHeightsNotInvented": True,
    "liveCapsChanged": False,
  }
  write(EVIDENCE, report)
  return report


def mapped_edges() -> None:
  """Positive mapped kerbs/railings only, retaining the full original course."""
  source = read(SOURCE)
  path = GEO / "raw/outer-v159/candidate.gpkg"
  frame = gpd.read_file(
    path,
    layer="lines",
    where="barrier IN ('kerb','guard_rail','railing') OR (barrier='fence' AND other_tags LIKE '%\"fence_type\"=>\"railing\"%')",
  ).to_crs(25833)
  boundary = world(make_valid(load_projected_polygon(BOUNDARY)))
  edges = []
  for row in frame.to_dict("records"):
    t = tags(row)
    original = world(row["geometry"])
    g = unary_union(list(line_parts(original.intersection(boundary))))
    if g.length < 0.1:
      continue
    edges.append(
      {
        "key": way_id(t["osm_id"]),
        "tags": t,
        "geometry": mapping(g),
        "originalGeometry": mapping(original),
        "originalLengthM": original.length,
        "berlinLengthM": g.length,
        "outsideLengthM": original.difference(boundary).length,
      }
    )
  source["mappedEdgeSource"] = {
    "path": str(path.relative_to(ROOT)),
    "sha256": sha(path),
    "records": len(edges),
  }
  source["mappedEdges"] = edges
  write(SOURCE, source)
  if EVIDENCE.exists():
    report = read(EVIDENCE)
    report["sourceSha256"] = sha(SOURCE)
    report["mappedEdgeSource"] = source["mappedEdgeSource"]
    report["protectionPolicy"] = (
      "A protected prior source context is not a per-way photographic fidelity claim."
    )
    write(EVIDENCE, report)


def fingerprint(text: str) -> int:
  """Same ASCII packed-attribute FNV as the existing runtime packet guard."""
  result = 2166136261
  for c in text:
    result = ((result ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return result


def support_layers(packet: dict[str, Any]) -> tuple[dict[float, Any], Any, Any]:
  """Actual complete unretired flat source faces; no road-width-only support."""
  levels: dict[float, list[Any]] = {}
  road = []
  rail = []
  road_rgb = linear_rgb_bytes(np.array([[109, 112, 109]], dtype=np.uint8))[0]
  rail_rgb = linear_rgb_bytes(np.array([[112, 100, 87]], dtype=np.uint8))[0]
  for mesh_index, part in enumerate(packet["meshes"]):
    if part["kind"] != "city" or part["positionType"] != "u16cm":
      continue
    xyz = (
      np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3) / 100
      + packet["origin"]
    )
    ix = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    rgb = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    tri = xyz[ix]
    flat = (
      (np.ptp(tri[:, :, 1], axis=1) < 0.001)
      & (tri[:, 0, 1] >= 3)
      & (tri[:, 0, 1] <= 3.151)
    )
    unavailable = packet.get("unavailableFloorTriangles", {}).get(str(mesh_index), [])
    if unavailable:
      flat[np.asarray(unavailable, dtype=int)] = False
    for at in np.flatnonzero(flat):
      p = Polygon(tri[at][:, [0, 2]])
      if p.area < 1e-8:
        continue
      y = round(float(tri[at, 0, 1]), 2)
      levels.setdefault(y, []).append(p)
      if y == 3.09 and np.all(rgb[ix[at]] == road_rgb):
        road.append(p)
      if y == 3.15 and np.all(rgb[ix[at]] == rail_rgb):
        rail.append(p)
  return (
    {y: unary_union(p) for y, p in levels.items()},
    unary_union(road),
    unary_union(rail),
  )


def cardinal_pixels(desired: Any, support: Any, step: float = 0.25) -> Any:
  """An independent cardinal grid, every whole cell supported by actual floor."""
  if desired.is_empty:
    return Polygon()
  shapely.prepare(support)
  cells = []
  for polygon in polygons_from_geometry(desired):
    x0, z0, x1, z1 = polygon.bounds
    for z in np.arange(math.floor(z0 / step) * step + step / 2, z1, step):
      # Sparse row intervals preserve the exact centre/full-corner tests.
      for interval in line_parts(
        polygon.intersection(LineString([(x0 - 1, z), (x1 + 1, z)]))
      ):
        left, _, right, _ = interval.bounds
        xs = np.arange(
          math.ceil((left - step / 2) / step) * step + step / 2, right + 1e-9, step
        )
        selected = shapely.intersects_xy(polygon, xs, np.full(len(xs), z))
        candidates = shapely.box(
          xs - step / 2, z - step / 2, xs + step / 2, z + step / 2
        )
        selected &= shapely.covers(support, candidates)
        padded = np.concatenate(([False], selected, [False]))
        ends = np.flatnonzero(padded[1:] != padded[:-1])
        for a, b in zip(ends[::2], ends[1::2]):
          cells.append(
            box(xs[a] - step / 2, z - step / 2, xs[b - 1] + step / 2, z + step / 2)
          )
  return unary_union(cells)


def bounded_shape(desired: Any, support: Any, native: bool) -> Any:
  """Check the actual serialized centiprecision shape, not just its centre."""
  if desired.is_empty or support.is_empty:
    return Polygon()
  if native:
    return cardinal_pixels(desired.intersection(support), support)
  proposed = shapely.set_precision(desired.intersection(support.buffer(-0.01)), 0.01)
  return unary_union([p for p in polygons_from_geometry(proposed) if support.covers(p)])


def emit(
  mesh: PackedMesh, geometry: Any, low: float, high: float, color: tuple[int, int, int]
) -> None:
  """Complete shallow volume and correct outward winding; no new texture."""
  if geometry.is_empty:
    return
  mesh.surface(geometry, high, color)
  if high <= low:
    return
  start = len(mesh.indices)
  mesh.surface(geometry, low, color)
  for at in range(start, len(mesh.indices), 3):
    mesh.indices[at + 1], mesh.indices[at + 2] = (
      mesh.indices[at + 2],
      mesh.indices[at + 1],
    )
  boundary = shapely.orient_polygons(geometry, exterior_cw=True).boundary
  for line in line_parts(boundary):
    for a, b in zip(line.coords, list(line.coords)[1:]):
      p, q, r, s = (
        (a[0], low, a[1]),
        (b[0], low, b[1]),
        (b[0], high, b[1]),
        (a[0], high, a[1]),
      )
      mesh.triangle([p, q, r], color)
      mesh.triangle([p, r, s], color)


def exclusions() -> tuple[Any, Any, list[dict[str, Any]]]:
  """Measured stations/contacts and earlier actual markings remain intact."""
  protected_rail = []
  protected_ground = []
  inputs = []

  def keep(path: Any) -> Any:
    inputs.append({"path": str(path.relative_to(ROOT)), "sha256": sha(path)})
    return read(path)

  rail = keep(ROOT / "src/app/public/mesh/regierungsviertel/rail-lines.json")
  for key in ["embankment_tracks", "viaduct_tracks"]:
    protected_rail.extend(
      LineString([(x / 10, z / 10) for x, z in p]).buffer(1.25)
      for p in rail[key]
      if len(p) >= 2
    )
  stations = keep(DATA / "railStationsV190.json")
  protected_rail.extend(
    Polygon(p["rings"][0], p["rings"][1:]).buffer(2) for p in stations["platforms"]
  )
  for name in [
    "weinbergTerrainV176",
    "parkTerrainV229Profile",
    "railBridgeApproachV307Profile",
  ]:
    d = keep(DATA / (name + ".json"))
    protected_ground.append(box(*(d.get("bounds") or d["support"])))
  for p in keep(DATA / "railSseTerrainV307.json")["profiles"]:
    protected_ground.append(
      shape(p["domain"]) if isinstance(p.get("domain"), dict) else box(*p["bounds"])
    )
  for path in [
    GEO / "main-streets-v254-evidence.json.gz",
    GEO / "city-streets-v249-evidence.json.gz",
  ]:
    d = keep(path)
    for record in d["emitted"]:
      if "geometry" in record:
        protected_ground.append(shape(record["geometry"]).buffer(0.3))
      else:
        protected_ground.extend(
          shape(r["geometry"]).buffer(0.3) for r in record["records"]
        )
  protected_ground.append(shape(keep(DATA / "wallGalleryV298.json")["hill"]["mask"]))
  protected_ground.extend(
    Polygon(e["stair"]["ring"]).buffer(0.3)
    for e in keep(DATA / "ubahnAccessV326.json")["entries"]
    if e.get("stair")
  )
  return unary_union(protected_rail), unary_union(protected_ground), inputs


class PlanWriter:
  """Only one bounded Git-sized shard is retained in the offline heap."""

  def __init__(self, measure: bool, stage_name: str = "network-stage") -> None:
    self.measure = measure
    self.stage_name = stage_name
    self.current = {}
    self.current_bytes = 0
    self.files = []
    self.count = 0
    self.raw_bytes = 0
    self.packet_gzip_bytes = 0
    self.seen = set()

  def add(self, key: str, plan: dict[str, Any]) -> None:
    if key in self.seen:
      raise ValueError("Duplicate exact source key")
    raw = json.dumps(
      plan, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    ).encode()
    if self.current and (
      len(self.current) >= 32 or self.current_bytes + len(raw) > 63 * 1024 * 1024
    ):
      self.flush()
    if len(raw) > 63 * 1024 * 1024:
      raise ValueError("Individual source exceeds bounded shard storage")
    self.packet_gzip_bytes += len(gzip.compress(raw, mtime=0))
    self.current[key] = plan
    self.current_bytes += len(raw)
    self.count += 1
    self.seen.add(key)

  def flush(self) -> None:
    if not self.current:
      return
    name = f"networkFidelityV326Packets{len(self.files)}.json"
    raw = (
      json.dumps(
        {"schemaVersion": 1, "keys": list(self.current), "packets": self.current},
        ensure_ascii=False,
        separators=(",", ":"),
        allow_nan=False,
      )
      + "\n"
    ).encode()
    if len(raw) > 64 * 1024 * 1024:
      raise ValueError("Shard exceeds bounded 64 MiB storage")
    carrier = None
    if not self.measure:
      (DATA / name).write_bytes(raw)
    else:
      staging = GEO / ("raw/public-fidelity-v326/" + self.stage_name)
      staging.mkdir(parents=True, exist_ok=True)
      carrier = staging / (name + ".gz")
      carrier.write_bytes(gzip.compress(raw, mtime=0))
    self.files.append(
      {
        "file": name,
        "keys": list(self.current),
        "rawBytes": len(raw),
        "rawSha256": hashlib.sha256(raw).hexdigest(),
        **(
          {
            "carrier": str(carrier.relative_to(ROOT)),
            "carrierSha256": sha(carrier),
            "carrierBytes": carrier.stat().st_size,
          }
          if carrier
          else {}
        ),
      }
    )
    self.raw_bytes += len(raw)
    self.current = {}
    self.current_bytes = 0


class ReceiptWriter:
  """Stream the full support proof instead of retaining every city's polygon."""

  def __init__(self, path: Any) -> None:
    self.path = path
    self.pending = path.with_suffix(path.suffix + ".pending")
    self.file = self.pending.open("wb")
    self.gz = gzip.GzipFile(fileobj=self.file, mode="wb", mtime=0)
    self.gz.write(b'{"packets":[')
    self.count = 0

  def append(self, row: dict[str, Any]) -> None:
    if self.count:
      self.gz.write(b",")
    self.gz.write(
      json.dumps(
        row, ensure_ascii=False, separators=(",", ":"), allow_nan=False
      ).encode()
    )
    self.count += 1

  def finish(self, metadata: dict[str, Any]) -> None:
    self.gz.write(b"],")
    self.gz.write(
      json.dumps(
        metadata, ensure_ascii=False, separators=(",", ":"), allow_nan=False
      ).encode()[1:]
    )
    self.gz.write(b"\n")
    self.gz.close()
    self.file.close()
    self.pending.replace(self.path)


def compile_packets(limit: int = 0, measure_only: bool = False) -> dict[str, Any]:
  """Serial per-packet construction; no whole-world meshes or resident cache."""
  print(json.dumps({"phase": "source-index"}), flush=True)
  source = read(SOURCE)
  protected, _ = protected_ids()
  routes = [
    r
    for r in source["records"]
    if r["disposition"] == "actual-packet-support-audit-required"
  ]
  edges = [
    r
    for r in source.get("mappedEdges", [])
    if at_grade(r["tags"]) and r["key"] not in protected
  ]
  items = routes + edges
  geometries = [shape(r["geometry"]) for r in items]
  tree = STRtree(geometries)
  old_rail, old_ground, old_inputs = exclusions()
  boundary = world(make_valid(load_projected_polygon(BOUNDARY)))
  bridge = unary_union(
    [
      shape(r["geometry"]).buffer(12)
      for r in source["records"]
      if r["berlinLengthM"] > 0.01
      and r["tags"].get("bridge", "no") not in {"no", "false", "0"}
    ]
  )
  endpoints = Counter(
    tuple(p)
    for r in routes
    if r["tags"].get("highway")
    for line in line_parts(shape(r["geometry"]))
    for p in line.coords
  )
  junctions = unary_union(
    [Point(*p).buffer(10) for p, n in endpoints.items() if n >= 3]
  )
  manifest = baseline_manifest()
  preflight_path = GEO / "raw/public-fidelity-v326/network-packet-support.json"
  preflight = read(preflight_path) if preflight_path.exists() else {}
  plans = PlanWriter(measure_only)
  receipts = ReceiptWriter(
    GEO
    / (
      "network-fidelity-v326-fittings-measured.json.gz"
      if measure_only
      else "network-fidelity-v326-fittings-evidence.json.gz"
    )
  )
  source_audit = {}
  skips = Counter()
  processed = 0
  for entry in manifest["chunks"]:
    if entry.get("detailCompanionOf"):
      continue
    tile = box(*entry["bounds"])
    selected = tree.query(tile, predicate="intersects")
    if not len(selected):
      continue
    if limit and processed >= limit:
      break
    processed += 1
    if limit or processed % 25 == 0:
      print(
        json.dumps(
          {
            "phase": "packet",
            "number": processed,
            "id": entry["id"],
            "plans": plans.count,
          }
        ),
        flush=True,
      )
    for family in ["drawn", "minecraft"]:
      native = family == "minecraft"
      path = PUBLIC / entry[family]["url"]
      packet = read(path)
      proof = preflight.get(family + ":" + entry["id"])
      if (
        not limit
        and not proof
        and packet["origin"][1] == -10
        and packet["nav"]["groundY"] == 3
        and any(p["kind"] == "city" for p in packet["meshes"])
      ):
        raise ValueError(
          "Missing actual current floor preflight " + family + ":" + entry["id"]
        )
      if proof:
        if proof["sourceSha256"] != sha(path):
          raise ValueError("Changed current source support " + entry["id"])
        packet["unavailableFloorTriangles"] = proof["unavailable"]
      if packet["origin"][1] != -10 or packet["nav"]["groundY"] != 3:
        skips["nonordinary-datum"] += 1
        continue
      levels, road, rail = support_layers(packet)
      if not levels:
        continue
      ox, _, oz = packet["origin"]
      blockers = unary_union(
        [
          translate(Polygon(p["ring"], p.get("holes", [])), ox, oz).buffer(0.2)
          for p in packet["nav"]["buildings"]
        ]
      )
      allowed = tile.intersection(boundary)
      blocked = blockers.union(old_ground.intersection(tile)).union(
        bridge.intersection(tile)
      )
      floors = {
        y: g.intersection(allowed).difference(blocked) for y, g in levels.items()
      }
      road = road.intersection(allowed).difference(blocked)
      rail = (
        rail.intersection(allowed)
        .difference(blocked)
        .difference(old_rail.intersection(tile))
      )
      mesh = PackedMesh(ox, oz)
      owners = set()
      details = []

      def publish(
        record: dict[str, Any],
        desired: Any,
        support: Any,
        low: float,
        high: float,
        color: tuple[int, int, int],
        role: str,
        support_y: float | None = None,
      ) -> None:
        geometry = bounded_shape(desired, support, native)
        if geometry.is_empty:
          return
        emit(mesh, geometry, low, high, color)
        owners.add(record["key"])
        row = {
          "source": record["key"],
          "role": role,
          "geometry": mapping(geometry),
          "low": low,
          "high": high,
          "color": color,
          "supportY": round(low - 0.03, 2) if support_y is None else support_y,
        }
        details.append(row)
        key = record["key"]
        a = source_audit.setdefault(
          key, {"drawnAreaM2": 0.0, "nativeAreaM2": 0.0, "roles": set()}
        )
        a[("native" if native else "drawn") + "AreaM2"] += geometry.area
        a["roles"].add(role)

      for at in selected:
        record = items[at]
        t = record["tags"]
        if t.get("barrier") == "fence" and t.get("fence_type") == "railing":
          t = {**t, "barrier": "railing"}
        course = geometries[at]
        local = course.intersection(tile)
        if local.length < 0.1:
          continue
        railway = t.get("railway")
        if railway in {"rail", "light_rail", "tram", "narrow_gauge"}:
          gauge = t.get("gauge", "")
          if (
            not re.fullmatch(r"\d+(\.\d+)?", gauge)
            or not 0.5 <= float(gauge) / 1000 <= 2
          ):
            skips["missing-or-complex-gauge"] += 1
            continue
          if t.get("tracks", "1") != "1":
            skips["aggregated-multitrack-without-individual-axes"] += 1
            continue
          head = 0.25 if native else 0.07
          offset = (float(gauge) / 1000 + head) / 2
          desired = unary_union(
            [
              line.offset_curve(side * offset, join_style=2, mitre_limit=2).buffer(
                head / 2, cap_style=2, join_style=2
              )
              for line in line_parts(course)
              for side in [-1, 1]
            ]
          )
          publish(
            record, desired, rail, 3.18, 3.25, (158, 164, 159), "source-gauge-railheads"
          )
        elif (
          t.get("highway")
          in {
            "primary",
            "secondary",
            "trunk",
            "motorway",
            "primary_link",
            "secondary_link",
            "trunk_link",
            "motorway_link",
          }
          and t.get("lane_markings") == "yes"
        ):
          try:
            lanes = int(t.get("lanes", "0"))
          except ValueError:
            continue
          if not 2 <= lanes <= 8:
            continue
          try:
            width = float(t["width"].split()[0]) if "width" in t else lanes * 3.25
          except ValueError:
            continue
          if not 4 <= width <= 40:
            continue
          desired = []
          for line in line_parts(course):
            for lane in range(1, lanes):
              offset = (lane / lanes - 0.5) * width
              for shifted in line_parts(
                line.offset_curve(offset, join_style=2, mitre_limit=2)
              ):
                for distance in np.arange(0, shifted.length, 9):
                  dash = substring(
                    shifted, float(distance), min(float(distance) + 3, shifted.length)
                  )
                  if dash.length > 0.2:
                    desired.append(
                      dash.buffer(0.125 if native else 0.06, cap_style=2, join_style=2)
                    )
          publish(
            record,
            unary_union(desired).difference(junctions),
            road,
            3.12,
            3.15,
            (235, 232, 217),
            "mapped-lane-count-display-dashes",
          )
        elif t.get("barrier") in {"kerb", "guard_rail", "railing"}:
          if t["barrier"] == "kerb":
            if t.get("kerb") in {"flush", "lowered", "no", "rolled"}:
              continue
            if (
              t.get("kerb") not in {"raised", "regular"}
              and "kerb:height" not in t
              and "height" not in t
            ):
              continue
            key = "kerb:height" if "kerb:height" in t else "height"
            default = 0.12
          else:
            key = "height"
            default = 0.75 if t["barrier"] == "guard_rail" else 1.1
          h = parse_osm_measure_m(t[key]) if key in t else default
          if h is None:
            continue
          if not 0.02 <= h <= 2:
            continue
          desired = local.buffer(0.125 if native else 0.06, cap_style=2, join_style=2)
          for y, floor in floors.items():
            if t["barrier"] == "kerb":
              publish(
                record,
                desired,
                floor,
                round(y + 0.03, 2),
                round(y + h, 2),
                (182, 184, 167),
                "mapped-raised-kerb",
                y,
              )
              continue
            bands = (
              [(max(0.12, h - 0.22), h)]
              if t["barrier"] == "guard_rail"
              else [
                (max(0.12, h * 0.5 - 0.03), h * 0.5 + 0.03),
                (max(0.12, h - 0.06), h),
              ]
            )
            for low, high in bands:
              if high > low:
                publish(
                  record,
                  desired,
                  floor,
                  round(y + low, 2),
                  round(y + high, 2),
                  (158, 166, 159),
                  "mapped-" + t["barrier"] + "-horizontal-member",
                  y,
                )
            posts = []
            spacing = 4 if t["barrier"] == "guard_rail" else 2
            half = 0.125 if native else 0.06
            for line in line_parts(course):
              for distance in np.arange(0, line.length, spacing):
                point = line.interpolate(float(distance))
                if tile.covers(point):
                  posts.append(
                    box(point.x - half, point.y - half, point.x + half, point.y + half)
                  )
            publish(
              record,
              unary_union(posts),
              floor,
              round(y + 0.03, 2),
              round(y + h, 2),
              (151, 157, 152),
              "mapped-" + t["barrier"] + "-posts",
              y,
            )
      append = mesh.payload(KIND)
      if not append:
        continue
      count = sum(
        len(base64.b64decode(p["positions"])) // 6 for p in packet["meshes"]
      ) + len(mesh.vertices)
      index_count = sum(
        len(base64.b64decode(p["indices"])) // 4 for p in packet["meshes"]
      ) + len(mesh.indices)
      if (
        count > 400000
        or index_count > 2400000
        or len(owners) > 512
        or len(packet["meshes"]) >= 16
      ):
        if not measure_only:
          raise ValueError(
            "Source-preserving separate companion required; never truncate details: "
            + entry["id"]
            + ":"
            + family
          )
        skips["separate-companion-required"] += 1
      key = family + ":" + entry["id"]
      records = [
        {
          "mesh": j,
          "kind": p["kind"],
          "fingerprint": fingerprint(p["positions"] + p["colors"] + p["indices"]),
        }
        for j, p in enumerate(packet["meshes"])
      ]
      plan = {
        "origin": packet["origin"],
        "records": records,
        "preparedRecords": [],
        "navGuard": 0,
        "lineGuard": None,
        "preparedNavGuard": 0,
        "preparedLineGuard": None,
        "append": append,
        "appendFingerprint": fingerprint(
          append["positions"] + append["colors"] + append["indices"]
        ),
        "retire": [],
        "retireLines": [],
        "retireNav": [],
        "appendNav": [],
        "owners": sorted(owners),
      }
      if proof:
        for field in [
          "records",
          "preparedRecords",
          "navGuard",
          "lineGuard",
          "preparedNavGuard",
          "preparedLineGuard",
        ]:
          plan[field] = proof[field]
      plans.add(key, plan)
      receipts.append(
        {
          "key": key,
          "sourcePath": str(path.relative_to(ROOT)),
          "sourceSha256": sha(path),
          "vertices": len(mesh.vertices),
          "indices": len(mesh.indices),
          "details": details,
        }
      )
    if processed % 100 == 0:
      print(json.dumps({"processed": processed, "plans": plans.count}), flush=True)
  plans.flush()
  if not measure_only:
    write(
      DATA / "networkFidelityV326Index.json",
      {"schemaVersion": 1, "kind": KIND, "sources": plans.files},
    )
  source_audit = {
    k: {**v, "roles": sorted(v["roles"])} for k, v in source_audit.items()
  }
  report = {
    "schemaVersion": 1,
    "sourceSha256": sha(SOURCE),
    "existingInputs": old_inputs,
    "processedDescriptors": processed,
    "plans": plans.count,
    "shards": len(plans.files),
    "sourceRawBytes": plans.raw_bytes,
    "independentPacketGzipBytes": plans.packet_gzip_bytes,
    "base85EncodedBytesUpper": math.ceil(plans.packet_gzip_bytes / 4) * 5
    + plans.count * 256,
    "shardFiles": plans.files,
    "skips": dict(skips),
    "positiveOwners": source_audit,
    "originalSourcesUnchanged": True,
    "liveCapsChanged": False,
    "estimates": [
      "Dash lengths/spacing/headwidth/metal cross sections and absent mapped heights are display estimates.",
      "Native independently uses full quarter-metre cells contained in actual delivered source floors.",
      "No layer number becomes metres; unproved decks and underground track remain unchanged.",
    ],
  }
  receipts.finish(report)
  if measure_only:
    write(GEO / "network-fidelity-v326-measured-index.json", report)
  return {
    k: v
    for k, v in report.items()
    if k not in {"positiveOwners", "packets", "existingInputs"}
  }


def packet_receipts(path: Any) -> Any:
  """Read one complete proof row at a time without a whole-catalogue heap."""
  decoder = json.JSONDecoder()
  with gzip.open(path, "rt", encoding="utf8") as stream:
    if stream.read(12) != '{"packets":[':
      raise ValueError("Unknown complete proof stream")
    buffer = ""
    count = 0
    while True:
      buffer = buffer.lstrip(", \r\n\t")
      if buffer.startswith("]"):
        try:
          metadata = json.loads('{"packets":[' + buffer + stream.read())
        except (EOFError, json.JSONDecodeError) as error:
          raise ValueError("Truncated or invalid complete proof trailer") from error
        if "plans" in metadata and metadata["plans"] != count:
          raise ValueError("Incomplete declared proof row count")
        return
      try:
        row, end = decoder.raw_decode(buffer)
      except json.JSONDecodeError:
        chunk = stream.read(65536)
        if not chunk:
          raise ValueError("Truncated packet proof") from None
        buffer += chunk
        continue
      yield row
      count += 1
      buffer = buffer[end:]


def refine_measured() -> dict[str, Any]:
  """Exact replay; remove only proved old duplicate curbs and junction paint."""
  metadata = read(GEO / "network-fidelity-v326-measured-index.json")
  if metadata["sourceSha256"] != sha(SOURCE):
    raise ValueError("Changed measured original source")
  raw_source = read(SOURCE)
  retained = read(GEO / "house-curbs-v233-evidence.json.gz")
  retained_ids = {row["key"] for row in retained["courses"]}
  endpoints = Counter(
    tuple(p)
    for r in raw_source["records"]
    if r["berlinLengthM"] > 0.01
    and r["tags"].get("highway")
    and at_grade(r["tags"])
    and r["tags"].get("highway") not in {"construction", "proposed"}
    for line in line_parts(shape(r["geometry"]))
    for p in line.coords
  )
  junctions = unary_union(
    [Point(*p).buffer(10) for p, n in endpoints.items() if n >= 3]
  )
  shapely.prepare(junctions)
  entries = {key: entry for entry in metadata["shardFiles"] for key in entry["keys"]}
  loaded = None
  current = {}
  writer = PlanWriter(True, "network-stage-refined")
  evidence = ReceiptWriter(GEO / "network-fidelity-v326-fittings-evidence.json.gz")
  counts = Counter()
  owners = {}
  exceptions = []
  samples = {}
  for row in packet_receipts(GEO / "network-fidelity-v326-fittings-measured.json.gz"):
    key = row["key"]
    entry = entries[key]
    if loaded != entry["carrier"]:
      carrier = ROOT / entry["carrier"]
      if sha(carrier) != entry["carrierSha256"]:
        raise ValueError("Changed measured carrier")
      raw = gzip.decompress(carrier.read_bytes())
      if hashlib.sha256(raw).hexdigest() != entry["rawSha256"]:
        raise ValueError("Changed measured JSON")
      current = json.loads(raw)["packets"]
      loaded = entry["carrier"]
    plan = current[key]
    native = key.startswith("minecraft:")
    details = []
    changed = False
    for detail in row["details"]:
      if detail["source"] in retained_ids and detail["role"].startswith(
        "mapped-raised-kerb"
      ):
        changed = True
        counts["alreadyAuthoredKerbMembersRetained"] += 1
        continue
      g = shape(detail["geometry"])
      if detail["role"] == "mapped-lane-count-display-dashes" and g.intersects(
        junctions
      ):
        clipped = bounded_shape(
          g.difference(junctions), g.difference(junctions), native
        )
        if not clipped.equals(g):
          changed = True
        if clipped.is_empty:
          continue
        detail = {**detail, "geometry": mapping(clipped)}
      details.append(detail)
    if changed:
      old = PackedMesh(plan["origin"][0], plan["origin"][2])
      for detail in row["details"]:
        emit(
          old,
          shape(detail["geometry"]),
          detail["low"],
          detail["high"],
          tuple(detail["color"]),
        )
      if old.payload(KIND) != plan["append"]:
        raise ValueError("Full original replay word mismatch " + key)
      counts["replayedOriginalPlansWordExact"] += 1
      mesh = PackedMesh(plan["origin"][0], plan["origin"][2])
      for detail in details:
        emit(
          mesh,
          shape(detail["geometry"]),
          detail["low"],
          detail["high"],
          tuple(detail["color"]),
        )
      append = mesh.payload(KIND)
      if not append:
        counts["whollyAlreadyAuthoredOrJunctionOnly"] += 1
        continue
      plan = {
        **plan,
        "append": append,
        "appendFingerprint": fingerprint(
          append["positions"] + append["colors"] + append["indices"]
        ),
        "owners": sorted({d["source"] for d in details}),
      }
      row = {
        **row,
        "details": details,
        "vertices": len(mesh.vertices),
        "indices": len(mesh.indices),
      }
    else:
      counts["unaffectedPlansValueExact"] += 1
    base = read(ROOT / row["sourcePath"])
    total_vertices = (
      sum(len(base64.b64decode(p["positions"])) // 6 for p in base["meshes"])
      + row["vertices"]
    )
    total_indices = (
      sum(len(base64.b64decode(p["indices"])) // 4 for p in base["meshes"])
      + row["indices"]
    )
    if (
      total_vertices > 400000
      or total_indices > 2400000
      or len(base["meshes"]) >= 16
      or len(plan["owners"]) > 512
    ):
      exceptions.append(
        {
          "key": key,
          "vertices": total_vertices,
          "indices": total_indices,
          "baseParts": len(base["meshes"]),
          "owners": len(plan["owners"]),
        }
      )
    writer.add(key, plan)
    evidence.append(row)
    for d in details:
      owners.setdefault(d["source"], set()).add(d["role"])
      samples.setdefault(("native:" if native else "drawn:") + d["role"], key)
    if writer.count % 100 == 0:
      print(
        json.dumps(
          {"refined": writer.count, "changed": counts["replayedOriginalPlansWordExact"]}
        ),
        flush=True,
      )
  writer.flush()
  report = {
    **{
      k: v
      for k, v in metadata.items()
      if k
      not in {
        "shardFiles",
        "positiveOwners",
        "plans",
        "shards",
        "sourceRawBytes",
        "independentPacketGzipBytes",
        "base85EncodedBytesUpper",
      }
    },
    "refinementInputs": [
      {
        "path": "geo_data/regierungsviertel/house-curbs-v233-evidence.json.gz",
        "sha256": sha(GEO / "house-curbs-v233-evidence.json.gz"),
      }
    ],
    "refinementCounts": dict(counts),
    "budgetExceptions": exceptions,
    "samples": samples,
    "positiveOwners": {k: sorted(v) for k, v in owners.items()},
    "plans": writer.count,
    "shards": len(writer.files),
    "sourceRawBytes": writer.raw_bytes,
    "independentPacketGzipBytes": writer.packet_gzip_bytes,
    "base85EncodedBytesUpper": math.ceil(writer.packet_gzip_bytes / 4) * 5
    + writer.count * 256,
    "shardFiles": writer.files,
  }
  evidence.finish(report)
  write(GEO / "network-fidelity-v326-refined-index.json", report)
  return {
    k: v
    for k, v in report.items()
    if k not in {"positiveOwners", "shardFiles", "existingInputs", "samples"}
  }


def main() -> None:
  """An inventory pass has no browser, city construction or product mutations."""
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--audit", action="store_true")
  parser.add_argument("--edges", action="store_true")
  parser.add_argument("--build", action="store_true")
  parser.add_argument("--limit", type=int, default=0)
  parser.add_argument("--candidates", action="store_true")
  parser.add_argument("--measure-only", action="store_true")
  parser.add_argument("--promote-measured", action="store_true")
  parser.add_argument("--refine-measured", action="store_true")
  args = parser.parse_args()
  if args.refine_measured:
    print(json.dumps(refine_measured()), flush=True)
  if args.audit:
    print(json.dumps(audit(), ensure_ascii=False))
  if args.edges:
    mapped_edges()
  if args.candidates:
    source = read(SOURCE)
    items = [
      shape(r["geometry"])
      for r in source["records"]
      if r["disposition"] == "actual-packet-support-audit-required"
    ] + [
      shape(r["geometry"]) for r in source.get("mappedEdges", []) if at_grade(r["tags"])
    ]
    tree = STRtree(items)
    keys = [
      mode + ":" + d["id"]
      for d in baseline_manifest()["chunks"]
      if not d.get("detailCompanionOf")
      and len(tree.query(box(*d["bounds"]), predicate="intersects"))
      for mode in ["drawn", "minecraft"]
    ]
    write(GEO / "raw/public-fidelity-v326/network-candidate-keys.json", keys)
    print(json.dumps({"candidateKeys": len(keys)}), flush=True)
  if args.build:
    print(json.dumps(compile_packets(args.limit, args.measure_only)), flush=True)
  if args.promote_measured:
    report = read(GEO / "network-fidelity-v326-refined-index.json")
    if report["sourceSha256"] != sha(SOURCE) or report.get("budgetExceptions"):
      raise ValueError("Changed measured source or unresolved live-budget companion")
    for entry in report["shardFiles"]:
      carrier = ROOT / entry["carrier"]
      if sha(carrier) != entry["carrierSha256"]:
        raise ValueError("Changed exact measured carrier")
      raw = gzip.decompress(carrier.read_bytes())
      if (
        len(raw) != entry["rawBytes"]
        or hashlib.sha256(raw).hexdigest() != entry["rawSha256"]
      ):
        raise ValueError("Changed exact measured words")
      path = DATA / entry["file"]
      pending = path.with_suffix(path.suffix + ".pending")
      pending.write_bytes(raw)
      pending.replace(path)
    write(
      DATA / "networkFidelityV326Index.json",
      {
        "schemaVersion": 1,
        "kind": KIND,
        "samples": report["samples"],
        "sources": [
          {k: e[k] for k in ["file", "keys", "rawBytes", "rawSha256"]}
          for e in report["shardFiles"]
        ],
      },
    )
    print(
      json.dumps({"promoted": report["plans"], "rawBytes": report["sourceRawBytes"]})
    )


if __name__ == "__main__":
  main()
