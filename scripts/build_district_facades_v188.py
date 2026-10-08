"""Step 10: modest street-facing window estimates on retained generic walls.

Every existing packet is an immutable input. Independent companion packets use
the ordinary bounded city queue, with no new resident budget or runtime builder.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import pyogrio
import shapely
from shapely.affinity import affine_transform, translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
BOUNDARIES = GEO / "district-facades-v188-boundaries.geojson"
CONTEXT = GEO / "district-facades-v188-context.json.gz"
EVIDENCE = GEO / "district-facades-v188-evidence.json.gz"
PREFIX = "district188-"
POLICY = (
  "One exposed named-street-facing, existing generic wall per official owner. "
  "All original packets, geometry, navigation and authored detail remain intact. "
  "Windows and thin base/eave accents are procedural display estimates, "
  "not measured facade subdivisions. No doors, shops or signs are inferred. "
  "Only already covered portions of the seven selected Ortsteile are eligible; "
  "this does not complete Wedding or extend any city boundary."
)


def digest(path: Path) -> str:
  """Return an input integrity fingerprint."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, data: Any) -> None:
  """Write deterministic compact data, optionally gzip wrapped."""
  raw = (json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def read_json(path: Path) -> Any:
  """Read local compact evidence or an existing city packet."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def world(geometry: Any) -> Any:
  """Keep official coordinates at their retained viewer origin."""
  return affine_transform(geometry, [1, 0, 0, -1, -389500, 5820000])


def district_shapes() -> dict[str, Any]:
  """Official district boundaries select, but never generate, source geometry."""
  return {
    f["properties"]["nam"]: world(shape(f["geometry"]))
    for f in read_json(BOUNDARIES)["features"]
  }


def extract_context() -> None:
  """Freeze named mapped roads and conservative protected OSM building areas."""
  source = GEO / "raw/outer-v159/candidate.gpkg"
  district_union = shapely.union_all(list(district_shapes().values()))
  streets = pyogrio.read_dataframe(source, layer="lines")
  streets = streets.to_crs(25833)
  road_rows = []
  for row in streets.itertuples():
    if row.highway not in {
      "primary",
      "secondary",
      "tertiary",
      "residential",
      "unclassified",
      "living_street",
      "pedestrian",
    } or not isinstance(row.name, str):
      continue
    tags = row.other_tags if isinstance(row.other_tags, str) else ""
    if '"tunnel"=>"yes"' in tags or '"bridge"=>"yes"' in tags:
      continue
    geometry = world(row.geometry).intersection(district_union)
    if not geometry.is_empty:
      road_rows.append(
        {"id": str(row.osm_id), "name": row.name, "geometry": mapping(geometry)}
      )
  buildings = pyogrio.read_dataframe(source, layer="multipolygons").to_crs(25833)
  protected = []
  for row in buildings.itertuples():
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
    if (
      isinstance(row.name, str)
      or isinstance(row.amenity, str)
      or isinstance(row.tourism, str)
    ):
      reasons.append("named-or-public-building")
    if any(
      f'"{key}"=>' in tags
      for key in (
        "building:colour",
        "building:material",
        "facade:colour",
        "facade:material",
      )
    ):
      reasons.append("recorded-facade-material-or-colour")
    if not reasons:
      continue
    geometry = world(row.geometry)
    if geometry.intersects(district_union):
      protected.append(
        {
          "id": str(row.osm_id or row.osm_way_id),
          "reasons": reasons,
          "geometry": mapping(geometry),
        }
      )
  # Authored source IDs, including named legacy shell files, always win. Broad
  # generic attribute inventories are intentionally not interpreted as heroes.
  files = sorted((ROOT / "src/app/src/data").glob("*.json"))
  files += sorted((ROOT / "src/app/src").glob("*Source.json"))
  files += sorted((ROOT / "src/app/src").glob("*Prisms.json"))
  files = [p for p in files if p.name not in {"buildingAttributeSource.json"}]
  ids: set[str] = set()
  for path in files:
    ids.update(re.findall(r"\bDEBE[A-Za-z0-9]+", path.read_text()))
  for path in (ROOT / "src/app/src").glob("*.ts"):
    ids.update(re.findall(r"\bDEBE[A-Za-z0-9]+", path.read_text()))
  write_json(
    CONTEXT,
    {
      "policy": POLICY,
      "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "osmLicense": "ODbL-1.0",
      "sourceSha256": digest(source),
      "boundarySha256": digest(BOUNDARIES),
      "roads": road_rows,
      "protectedBuildings": protected,
      "authoredIds": sorted(ids),
    },
  )


def mesh_wall_triangles(packet: dict) -> set[tuple]:
  """Match actual generic wall triangles, never a clipped navigation seam."""
  result = set()
  wall = tuple(
    np.rint(
      np.where(
        np.array([211, 208, 195]) / 255 <= 0.04045,
        np.array([211, 208, 195]) / 255 / 12.92,
        ((np.array([211, 208, 195]) / 255 + 0.055) / 1.055) ** 2.4,
      )
      * 255
    ).astype(int)
  )
  for part in packet["meshes"]:
    if part["kind"] != "city":
      continue
    positions = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
    colours = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    matching = np.all(colours == wall, axis=1)
    for triangle in indices[np.all(matching[indices], axis=1)]:
      result.add(tuple(sorted(tuple(map(int, v)) for v in positions[triangle])))
  return result


def source_wall_exists(
  triangles: set[tuple], a: list, b: list, low: float, high: float
) -> bool:
  """Require both original triangles of the exact quantized vertical wall."""
  points = [
    tuple(round(v * 100) for v in p)
    for p in [
      (a[0], low, a[1]),
      (b[0], low, b[1]),
      (b[0], high, b[1]),
      (a[0], high, a[1]),
    ]
  ]
  return (
    tuple(sorted([points[0], points[1], points[2]])) in triangles
    and tuple(sorted([points[0], points[2], points[3]])) in triangles
  ) or (
    tuple(sorted([points[0], points[1], points[3]])) in triangles
    and tuple(sorted([points[1], points[2], points[3]])) in triangles
  )


def exposed_front(
  a: np.ndarray,
  b: np.ndarray,
  polygon: Any,
  streets: list,
  road_tree: STRtree,
  occupied: STRtree,
) -> tuple | None:
  """Reject party/court walls and occluded or oblique street approaches."""
  delta = b - a
  width = float(np.linalg.norm(delta))
  if not 7 <= width <= 90:
    return None
  direction = delta / width
  normal = np.array([-direction[1], direction[0]])
  center = (a + b) / 2
  if polygon.covers(Point(*(center + normal * 0.3))):
    normal = -normal
  point = Point(*center)
  ri = int(road_tree.nearest(point))
  near = nearest_points(point, streets[ri])[1]
  toward = np.array([near.x, near.y]) - center
  distance = float(np.linalg.norm(toward))
  if not 3 <= distance <= 30 or float(np.dot(toward, normal)) / distance < 0.80:
    return None
  for t in [0.05, 0.25, 0.5, 0.75, 0.95]:
    p = a + delta * t
    path = LineString([p + normal * 0.3, p + normal * min(distance, 6)])
    if len(occupied.query(path, predicate="intersects")):
      return None
  sightline = LineString([center + normal * 0.3, [near.x, near.y]])
  if len(occupied.query(sightline, predicate="intersects")):
    return None
  return width, direction, normal, ri


def linear(colour: tuple[int, int, int]) -> list[int]:
  """Convert illustrative sRGB swatches into the existing packed linear bytes."""
  return [
    round(
      (c / 255 / 12.92 if c / 255 <= 0.04045 else ((c / 255 + 0.055) / 1.055) ** 2.4)
      * 255
    )
    for c in colour
  ]


class FacadeMesh:
  """Small offline indexed facade planes; no hidden surfaces or filled mass."""

  def __init__(self, origin: list) -> None:
    self.origin = np.array(origin)
    self.positions: list = []
    self.colours: list = []
    self.indices: list = []

  def quad(self, points: list, bottom: tuple, top: tuple | None = None) -> None:
    """Write one exact rectangle with a restrained existing-style light gradient."""
    start = len(self.positions)
    for i, point in enumerate(points):
      p = np.rint((np.array(point) - self.origin) * 100).astype(int).tolist()
      if min(p) < 0 or max(p) > 65535:
        raise ValueError("Facade escaped its bounded primary tile")
      self.positions.append(p)
      self.colours.append(linear(top if top and i >= 2 else bottom))
    self.indices.extend([start, start + 1, start + 2, start, start + 2, start + 3])

  def pane(
    self,
    a: np.ndarray,
    direction: np.ndarray,
    normal: np.ndarray,
    u: float,
    y: float,
    width: float,
    height: float,
    depth: float,
    bottom: tuple,
    top: tuple | None = None,
  ) -> None:
    """Keep facade dimensions local to the measured source wall."""
    left = a + direction * (u - width / 2) + normal * depth
    right = a + direction * (u + width / 2) + normal * depth
    self.quad(
      [
        [left[0], y - height / 2, left[1]],
        [right[0], y - height / 2, right[1]],
        [right[0], y + height / 2, right[1]],
        [left[0], y + height / 2, left[1]],
      ],
      bottom,
      top,
    )

  def payload(self) -> dict:
    """Use the established bounded packet schema without runtime extension."""

    def encode(values: list, dtype: str) -> str:
      return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()

    parts = []
    if self.indices:
      parts.append(
        {
          "kind": "district-facades-v188",
          "positionType": "u16cm",
          "positions": encode(self.positions, "<u2"),
          "colors": encode(self.colours, "u1"),
          "indices": encode(self.indices, "<u4"),
        }
      )
    return {
      "schemaVersion": 1,
      "origin": self.origin.tolist(),
      "meshes": parts,
      "nav": {"groundY": 3, "ground": [], "water": [], "buildings": []},
    }


def window_grid(
  mesh: FacadeMesh, face: dict, native: bool = False, occupied: STRtree | None = None
) -> int:
  """One shallow blue-grey rectangle per window plus two thin edge accents."""
  a, b = np.array(face["a"]), np.array(face["b"])
  width = float(np.linalg.norm(b - a))
  d = (b - a) / width
  n = np.array(face["normal"])
  low, high = face["low"], face["high"]
  rows = max(1, int((high - low - 1.5) / (4 if native else 3.6)))
  cols = max(1, int((width - 1.5) / (4 if native else 3.8)))
  blocked_columns = set()
  if occupied is not None and not native:
    for col in range(cols):
      u = (col + 0.5) * width / cols
      left, right = a + d * (u - 0.67), a + d * (u + 0.67)
      approach = Polygon(
        [left + n * 0.025, right + n * 0.025, right + n * 3, left + n * 3]
      )
      if len(occupied.query(approach, predicate="intersects")):
        blocked_columns.add(col)
    face["omittedWindowColumns"] = sorted(blocked_columns)
  count = 0
  for row in range(rows):
    y = low + 1.5 + (row + 0.5) * (high - low - 2.4) / rows
    for col in range(cols):
      if col in blocked_columns:
        continue
      u = (col + 0.5) * width / cols
      if native:
        mesh.pane(a, d, n, u, y, 1.15, 1.4, 0.045, (93, 119, 124))
      else:
        mesh.pane(a, d, n, u, y, 1.32, 1.8, 0.075, (122, 148, 151), (78, 105, 114))
      count += 1
  if not native:
    mesh.pane(
      a,
      d,
      n,
      width / 2,
      high - 0.35,
      width - 0.6,
      0.14,
      0.105,
      (169, 170, 155),
      (230, 222, 204),
    )
    mesh.pane(a, d, n, width / 2, low + 0.75, width - 0.6, 0.14, 0.105, (169, 170, 155))
  return count


def build() -> dict:
  """Select actual eligible walls, then add independent streamed companions."""
  if not CONTEXT.exists():
    extract_context()
  context = read_json(CONTEXT)
  districts = district_shapes()
  streets = [shape(r["geometry"]) for r in context["roads"]]
  road_tree = STRtree(streets)
  protected = STRtree([shape(r["geometry"]) for r in context["protectedBuildings"]])
  authored = set(context["authoredIds"])
  manifest = read_json(OUT / "manifest.json")
  manifest["chunks"] = [c for c in manifest["chunks"] if not c["id"].startswith(PREFIX)]
  old_descriptors = list(manifest["chunks"])
  old_field_hashes = {
    key: hashlib.sha256(
      json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    for key, value in manifest.items()
    if key not in {"chunks", "districtFacadesV188"}
  }
  primary = [
    c
    for c in manifest["chunks"]
    if not c.get("detailCompanionOf")
    and any(g.intersects(box(*c["bounds"])) for g in districts.values())
  ]
  inventory = []
  for desc in primary:
    packet = read_json(OUT / desc["drawn"]["url"])
    if not any(p["kind"] == "city" for p in packet["meshes"]):
      continue
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      geometry = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if geometry.is_valid and not geometry.is_empty:
        inventory.append((desc["id"], b, geometry))
  occupied = STRtree([b[2] for b in inventory])
  by_chunk = defaultdict(list)
  for desc_id, b, geometry in inventory:
    by_chunk[desc_id].append((b, geometry))
  counts = Counter()
  candidates = defaultdict(list)
  old_assets = []
  for desc in primary:
    old_assets.extend(
      {"url": desc[family]["url"], "sha256": desc[family]["sha256"]}
      for family in ["drawn", "minecraft"]
    )
    packet = read_json(OUT / desc["drawn"]["url"])
    ox, oy, oz = packet["origin"]
    triangles = mesh_wall_triangles(packet)
    for building, geometry in by_chunk[desc["id"]]:
      owner = building["sourceId"]
      if not owner.startswith("DEBE") or owner in authored:
        counts["protectedAuthoredOrNonOfficial"] += 1
        continue
      if len(protected.query(geometry, predicate="intersects")):
        counts["protectedMappedUseMaterialOrColour"] += 1
        continue
      district = next(
        (
          name
          for name, area in districts.items()
          if area.covers(geometry.representative_point())
        ),
        None,
      )
      if district is None:
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
        counts["outsideModestResidentialHeight"] += 1
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
        # All small offsets must remain in the same existing tile.
        corners = [wa + normal * 0.11, wb + normal * 0.11]
        if not box(*desc["bounds"]).covers(LineString(corners)):
          continue
        face = {
          "owner": owner,
          "district": district,
          "chunk": desc["id"],
          "a": wa.tolist(),
          "b": wb.tolist(),
          "low": low,
          "high": high,
          "normal": normal.tolist(),
          "streetId": context["roads"][ri]["id"],
          "streetName": context["roads"][ri]["name"],
        }
        candidates[owner].append((width, face))
  selected = [
    max(faces, key=lambda f: (f[0], f[1]["chunk"]))[1]
    for _, faces in sorted(candidates.items())
  ]
  by_chunk_faces = defaultdict(list)
  for face in selected:
    by_chunk_faces[face["chunk"]].append(face)
  companions = []
  for desc in primary:
    faces = by_chunk_faces[desc["id"]]
    if not faces:
      continue
    source = read_json(OUT / desc["drawn"]["url"])
    drawn = FacadeMesh(source["origin"])
    for face in faces:
      face["windowCount"] = window_grid(drawn, face, occupied=occupied)
      counts["windows"] += face["windowCount"]
      counts["fronts_" + face["district"]] += 1
    native_source = read_json(OUT / desc["minecraft"]["url"])
    native = FacadeMesh(native_source["origin"])
    native_triangles = mesh_wall_triangles(native_source)
    native_owners = defaultdict(list)
    for b in native_source["nav"]["buildings"]:
      native_owners[b["sourceId"]].append(b)
    ox, oy, oz = native_source["origin"]
    for face in faces:
      # Native marks sit on existing axis-aligned block faces only. Reuse no
      # smooth diagonal pane in the Minecraft family.
      corridor = LineString([face["a"], face["b"]]).buffer(1.6, cap_style=2)
      face["nativeWindowCount"] = 0
      face["nativeSpans"] = []
      for b in native_owners[face["owner"]]:
        low = (
          native_source["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
        )
        high = native_source["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
        ring = b["ring"]
        native_polygon = translate(Polygon(ring, b["holes"]), ox, oz)
        for a, end in zip(ring, ring[1:] + ring[:1]):
          if a[0] != end[0] and a[1] != end[1]:
            continue
          if not source_wall_exists(native_triangles, a, end, low - oy, high - oy):
            continue
          wa, wb = np.array(a) + [ox, oz], np.array(end) + [ox, oz]
          # Minimum segment distance can accept a very long unrelated wall
          # when only one endpoint is near the selected frontage. Restrict the
          # whole emitted native span to its finite source-frontage corridor.
          clipped = LineString([wa, wb]).intersection(corridor)
          if clipped.geom_type != "LineString" or clipped.is_empty:
            continue
          wa, wb = np.array(clipped.coords[0]), np.array(clipped.coords[-1])
          span = np.linalg.norm(wb - wa)
          if span < 3:
            continue
          d = (wb - wa) / span
          n = np.array([-d[1], d[0]])
          if np.dot(n, face["normal"]) < 0:
            n = -n
          if np.dot(n, face["normal"]) < 0.65 or not box(*desc["bounds"]).covers(
            LineString([wa + n * 0.05, wb + n * 0.05])
          ):
            continue
          if any(
            native_polygon.covers(Point(*(wa + (wb - wa) * t + n * 0.2)))
            for t in [0.05, 0.25, 0.5, 0.75, 0.95]
          ):
            continue
          native_face = {
            **face,
            "a": wa.tolist(),
            "b": wb.tolist(),
            "normal": n.tolist(),
            "low": low,
            "high": high,
          }
          native_count = window_grid(native, native_face, True)
          face["nativeWindowCount"] += native_count
          face["nativeSpans"].append(
            {
              "a": wa.tolist(),
              "b": wb.tolist(),
              "low": low,
              "high": high,
              "normal": n.tolist(),
              "windowCount": native_count,
            }
          )
          counts["nativeWindows"] += native_count
    companion = {
      "id": PREFIX + desc["id"],
      "detailCompanionOf": desc["id"],
      "bounds": desc["bounds"],
    }
    for family, mesh in [("drawn", drawn), ("minecraft", native)]:
      url = companion["id"] + f".{family}.json.gz"
      write_json(OUT / url, {"id": companion["id"], **mesh.payload()})
      companion[family] = {
        "url": url,
        "bytes": (OUT / url).stat().st_size,
        "decodedBytes": len(gzip.decompress((OUT / url).read_bytes())),
        "encoding": "gzip",
        "sha256": digest(OUT / url),
      }
      counts[family + "Vertices"] += len(mesh.positions)
      counts[family + "GeometryBytes"] += len(mesh.positions) * 12 + len(
        mesh.indices
      ) * (2 if len(mesh.positions) <= 65535 else 4)
      counts[family + "TransferBytes"] += companion[family]["bytes"]
    companions.append(companion)
  manifest["chunks"].extend(companions)
  manifest["districtFacadesV188"] = {
    "policy": POLICY,
    "chunks": len(companions),
    "counts": dict(counts),
    "evidence": "district-facades-v188-evidence.json.gz",
  }
  assert len(manifest["chunks"]) <= 2048
  assert (
    counts["drawnTransferBytes"] + counts["minecraftTransferBytes"] < 6 * 1024 * 1024
  )
  write_json(OUT / "manifest.json", manifest)
  evidence = {
    "schemaVersion": 1,
    "policy": POLICY,
    "counts": dict(counts),
    "contextSha256": digest(CONTEXT),
    "boundariesSha256": digest(BOUNDARIES),
    "oldAssets": old_assets,
    "oldDescriptors": old_descriptors,
    "oldManifestFieldSha256": old_field_hashes,
    "faces": selected,
    "companions": companions,
  }
  write_json(EVIDENCE, evidence)
  write_json(OUT / "district-facades-v188-evidence.json.gz", evidence)
  print(json.dumps({"companions": len(companions), **counts}, indent=2))
  return evidence


if __name__ == "__main__":
  build()
