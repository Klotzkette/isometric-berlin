"""Step 10: compile source-bound appearance into immutable-packet selectors.

No source geometry, published packet, facade opening or navigation is regenerated.
The output only selects unambiguously owned existing colour-buffer vertices.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "alt-mitte-v169"
APP = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OUTPUT = APP / "altMitteAppearanceV213.json"
EVIDENCE = GEO / "alt-mitte-appearance-v213-evidence.json.gz"
PROTECTED = GEO / "alt-mitte-appearance-v213-protected.json"
KIND = "alt-mitte-v169"
TOLERANCE = 0.018  # Original millimetres -> delivered centimetres, not a new survey.
RGB = tuple[int, int, int]
NAMED: dict[str, RGB] = {
  "white": (238, 236, 226),
  "grey": (158, 160, 157),
  "gray": (158, 160, 157),
  "red": (159, 85, 66),
  "brown": (137, 111, 86),
  "beige": (216, 204, 180),
  "yellow": (222, 207, 157),
  "black": (66, 70, 72),
  "green": (111, 150, 137),
  "tan": (210, 180, 140),
  "silver": (192, 192, 192),
  "blue": (90, 120, 160),
}
WALL_MATERIAL: dict[str, RGB] = {
  "brick": (166, 119, 93),
  "sandstone": (215, 203, 171),
  "concrete": (186, 186, 176),
  "glass": (133, 163, 169),
  "plaster": (216, 210, 192),
  "stone": (200, 194, 179),
  "metal": (156, 163, 162),
}
ROOF_MATERIAL: dict[str, RGB] = {
  "copper": (113, 154, 139),
  "roof_tiles": (166, 112, 85),
  "slate": (102, 113, 118),
  "metal": (156, 163, 162),
  "tar_paper": (103, 108, 108),
  "tar": (103, 108, 108),
  "concrete": (170, 172, 165),
  "glass": (133, 163, 169),
  "grass": (127, 147, 104),
  "metal sheet": (156, 163, 162),
}


def read(path: Path) -> Any:
  """Read one existing bounded input."""
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def digest(path: Path) -> str:
  """Record the exact source/packet bytes without modifying them."""
  with path.open("rb") as stream:
    return hashlib.file_digest(stream, "sha256").hexdigest()


def fingerprint(part: dict) -> int:
  """Match the established runtime FNV over three immutable encoded streams."""
  value = 2166136261
  for key in ("positions", "colors", "indices"):
    for byte in part[key].encode("ascii"):
      value = ((value ^ byte) * 16777619) & 0xFFFFFFFF
  return value


def colour(value: Any, *, legacy: bool = False) -> RGB | None:
  """Resolve only single explicit colour names or unambiguous hexadecimal."""
  if not isinstance(value, str):
    return None
  text = value.strip().lower()
  if text in NAMED and (not legacy or text not in {"tan", "silver", "blue"}):
    return NAMED[text]
  if text.startswith("#") and len(text) in (4, 7):
    try:
      code = text[1:]
      if len(code) == 3:
        code = "".join(c * 2 for c in code)
      return tuple(int(code[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
      pass
  return None


def old_materials(tags: dict) -> tuple[RGB, RGB]:
  """Reproduce v169's narrow material reader, solely to identify old vertices."""
  walls = {k: v for k, v in WALL_MATERIAL.items() if k != "metal"}
  roofs = {k: ROOF_MATERIAL[k] for k in ("copper", "roof_tiles", "slate", "metal")}
  return (
    colour(tags.get("building:colour"), legacy=True)
    or walls.get(tags.get("building:material"))
    or (210, 204, 186),
    colour(tags.get("roof:colour"), legacy=True)
    or roofs.get(tags.get("roof:material"))
    or (153, 155, 148),
  )


def linear(rgb: RGB, shade: float = 1.0, *, round_srgb: bool = False) -> RGB:
  """Encode the same linear bytes as the existing packet colour stream."""
  c = np.asarray(rgb, dtype=float) / 255
  c = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
  c *= shade
  if round_srgb:
    srgb = np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)
    srgb = np.rint(srgb * 255) / 255
    c = np.where(srgb <= 0.04045, srgb / 12.92, ((srgb + 0.055) / 1.055) ** 2.4)
  return tuple(int(v) for v in np.rint(np.clip(c, 0, 1) * 255))


def legacy_shade(normal: np.ndarray) -> float:
  """The original five directional factors, used for immutable colour matching."""
  if normal[1] > 0.55:
    return 1.0
  if normal[1] < -0.55:
    return 0.89
  if abs(normal[0]) >= abs(normal[2]):
    return 0.95 if normal[0] > 0 else 0.89
  return 0.92 if normal[2] > 0 else 0.98


def source_light(normal: np.ndarray) -> float:
  """Static illustration light follows actual source planes, not invented bays."""
  light = np.array([-0.40, 0.78, 0.48])
  light /= np.linalg.norm(light)
  return 0.77 + 0.24 * max(0.0, float(np.dot(normal, light)))


def reciprocal_match(source: Any, mapped: Any) -> tuple[bool, float, float]:
  """Require at least 95% actual coverage on both independently mapped objects."""
  if source.is_empty or mapped.is_empty or min(source.area, mapped.area) <= 0:
    return False, 0.0, 0.0
  overlap = source.intersection(mapped).area
  left, right = overlap / source.area, overlap / mapped.area
  return left >= 0.95 and right >= 0.95, left, right


def reliable_levels(tags: dict) -> int | None:
  """A single integer tag is evidence of storeys, never of window positions."""
  value = str(tags.get("building:levels", ""))
  if value.isdigit() and 1 <= int(value) <= 60:
    return int(value)
  return None


def aliases(record: dict) -> set[str]:
  """Keep parent, leaf and old prism identities distinct but protect each alias."""
  ids = {
    record["id"],
    *record.get("legacyPrismIds", []),
    *record.get("outerOwnerIds", []),
  }
  ids.update(p["id"] for p in record.get("parts", []))
  ids.update(x[-8:] for x in tuple(ids) if x.startswith("DEBE"))
  return ids


def appearance() -> tuple[dict[str, dict], set[str]]:
  """Resolve old joins exactly; explicit authored colour/glass overrides win."""
  data = read(SOURCE / "appearance-baseline.json.gz")
  result, ranks = {}, {}
  protected = set(data["heroPrismTones"]) | set(data["heroPrismRoofTones"])
  protected.update(data["glassPrismIds"])
  protected.update(data["glassSourceIds"])
  for identities in data["specialIdSets"].values():
    protected.update(identities)
  for row in data["records"]:
    for binding in row["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          result[part["partId"]] = row
          ranks[part["partId"]] = rank
  return result, protected


@dataclass
class Surface:
  """A source polygon and its proof of ownership/material, never new geometry."""

  owner: str
  part: str
  role: str
  normal: np.ndarray
  origin: np.ndarray
  axes: tuple[int, int]
  polygon: Any
  bounds_xz: Any
  before: RGB
  after: RGB
  allowed: bool = True

  def matches(self, triangle: np.ndarray, rgb: RGB) -> bool:
    """Check all points against the plane and complete polygon, including holes."""
    if rgb != self.before:
      return False
    if np.max(np.abs((triangle - self.origin) @ self.normal)) > TOLERANCE:
      return False
    projected = Polygon(triangle[:, self.axes])
    return projected.area > 1e-9 and self.polygon.covers(projected)


@dataclass
class NativePart:
  """Conservative native identity: exact original colour plus bounded envelope."""

  owner: str
  part: str
  footprint: Any
  low: float
  high: float
  roles: tuple[tuple[str, RGB, RGB], ...]
  allowed: bool = True

  def candidates(self, triangle: np.ndarray, rgb: RGB) -> list[tuple[str, RGB]]:
    """Two-metre surface blocks must stay within their source-derived envelope."""
    if (
      triangle[:, 1].min() < self.low - 2.01 or triangle[:, 1].max() > self.high + 2.01
    ):
      return []
    projected = Polygon(triangle[:, [0, 2]])
    if projected.area <= 1e-10:
      projected = LineString(triangle[:, [0, 2]])
    if not self.footprint.covers(projected):
      return []
    return [(role, after) for role, before, after in self.roles if before == rgb]


def make_surface(
  owner: str, part: str, surface: dict, old: RGB, new: RGB, offset: float = 0.0
) -> Surface | None:
  """Prepare a retained polygon's true plane and holes for centimetre matching."""
  rings = [np.asarray(r, dtype=float) + [0, offset, 0] for r in surface["rings"]]
  points = rings[0]
  normal = np.cross(points, np.roll(points, -1, axis=0)).sum(axis=0)
  length = np.linalg.norm(normal)
  if length < 1e-9:
    return None
  normal /= length
  axes = tuple(i for i in range(3) if i != int(np.argmax(np.abs(normal))))
  polygon = shapely.make_valid(
    Polygon(points[:, axes], [r[:, axes] for r in rings[1:]])
  )
  if polygon.is_empty:
    return None
  return Surface(
    owner,
    part,
    surface["kind"],
    normal,
    points[0],
    axes,
    polygon.buffer(TOLERANCE),
    box(
      points[:, 0].min(), points[:, 2].min(), points[:, 0].max(), points[:, 2].max()
    ).buffer(TOLERANCE),
    linear(old, legacy_shade(normal), round_srgb=True),
    linear(new, 0.98 if surface["kind"] == "RoofSurface" else source_light(normal)),
  )


def source_records() -> list[dict]:
  """Read one frozen chunk at a time and verify its archival hash."""
  result = []
  for item in read(SOURCE / "source-manifest.json")["chunks"]:
    path = SOURCE / item["file"]
    assert digest(path) == item["sha256"]
    result.extend(read(path)["buildings"])
  return result


def osm_footprints(records: list[dict]) -> dict[str, Any]:
  """Read exact candidate geometries only for retained overlap-context IDs."""
  import geopandas as gpd

  ids = {r.get("osmContext", {}).get("id") for r in records}
  ids.discard(None)
  frame = gpd.read_file(
    GEO / "raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    bbox=(13.30, 52.48, 13.45, 52.57),
  ).to_crs(25833)
  result = {}
  for row in frame.itertuples():
    identity = (
      "OSM-way-" + str(row.osm_way_id)
      if isinstance(row.osm_way_id, str) and row.osm_way_id
      else "OSM-relation-" + str(row.osm_id)
    )
    if identity in ids:
      result[identity] = shapely.make_valid(
        affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
      )
  return result


def compile_sources(
  records: list[dict],
  mapped: dict[str, Any],
  protected: set[str],
  inherited: dict[str, dict],
) -> tuple[list[Surface], list[NativePart], list, Counter]:
  """Compile exact source-plane selectors and separately qualified native owners."""
  surfaces, native, evidence = [], [], []
  counts = Counter()
  offsets = read(APP / "weinbergBuildingOffsetsV176.json")["offsets"]
  for row in records:
    counts["catalogueRecords"] += 1
    if row["category"] not in {"core", "outer"} or row["sourceType"] != "official-lod2":
      counts["retainedOrResidualUnchanged"] += 1
      continue
    allowed = not bool(aliases(row) & protected)
    if not allowed:
      counts["protectedMeasuredOwners"] += 1
    original_tags = row.get("osmTags", {})
    if original_tags.get("building:material") == "glass":
      counts["mappedGlassUnchanged"] += 1
      allowed = False
    footprint = unary_union(
      [
        shapely.make_valid(Polygon(p["ring"], p.get("holes", [])))
        for p in row["footprintPolygons"]
      ]
    )
    context = row.get("osmContext", {}).get("id")
    match = (
      reciprocal_match(footprint, mapped[context])
      if context in mapped
      else (False, 0.0, 0.0)
    )
    tags = original_tags if match[0] else {}
    wall = colour(tags.get("building:colour")) or WALL_MATERIAL.get(
      tags.get("building:material")
    )
    roof = colour(tags.get("roof:colour")) or ROOF_MATERIAL.get(
      tags.get("roof:material")
    )
    counts["eligibleMeasuredOwners"] += int(allowed)
    counts["reciprocalContextOwners"] += int(allowed and match[0])
    counts["mappedWallOwners"] += int(allowed and wall is not None)
    counts["mappedRoofOwners"] += int(allowed and roof is not None)
    counts["mappedStoreyOwners"] += int(allowed and reliable_levels(tags) is not None)
    owner_row = {
      "id": row["id"],
      "eligible": allowed,
      "category": row["category"],
      "contextId": context,
      "contextCoverage": [round(match[1], 6), round(match[2], 6)],
      "acceptedContext": match[0],
      "wallEvidence": "mapped colour/material" if wall else "retained generic paint",
      "roofEvidence": "mapped colour/material"
      if roof
      else "neutral graphic roof separation; not surveyed material",
      "storeys": reliable_levels(tags),
      "parts": len(row["parts"]),
    }
    evidence.append(owner_row)
    defaults = old_materials(original_tags)
    offset = float(offsets.get(row["id"], 0))
    for part in row["parts"]:
      prior = inherited.get(part["id"])
      old_wall = tuple(prior["facade"]["srgb8"]) if prior else defaults[0]
      old_roof = tuple(prior["roof"]["srgb8"]) if prior else defaults[1]
      # A recorded but weakly joined material is not overwritten by a new guess.
      new_wall = wall or old_wall
      has_old_roof_evidence = bool(
        colour(original_tags.get("roof:colour"), legacy=True)
        or original_tags.get("roof:material")
      )
      new_roof = roof or (old_roof if has_old_roof_evidence else (153, 155, 148))
      for sheet in part["surfaces"]:
        if sheet["kind"] not in {"WallSurface", "RoofSurface"}:
          continue
        is_roof = sheet["kind"] == "RoofSurface"
        face = make_surface(
          row["id"],
          part["id"],
          sheet,
          old_roof if is_roof else old_wall,
          new_roof if is_roof else new_wall,
          offset,
        )
        if face:
          face.allowed = allowed
          surfaces.append(face)
      part_footprint = unary_union(
        [
          shapely.make_valid(Polygon(p["ring"], p.get("holes", [])))
          for p in part["footprintPolygons"]
        ]
      )
      native.append(
        NativePart(
          row["id"],
          part["id"],
          part_footprint.buffer(2.84),
          part["groundY"] + offset,
          part["topY"] + offset,
          (
            ("WallSurface", linear(old_wall), linear(new_wall)),
            ("RoofSurface", linear(old_roof), linear(new_roof)),
          ),
          allowed,
        )
      )
  counts["sourceSurfaceSelectors"] = len(surfaces)
  counts["nativePartSelectors"] = len(native)
  return surfaces, native, evidence, counts


def unanimous_vertex_colours(
  indices: np.ndarray, assignments: list[RGB | None], original: np.ndarray
) -> dict[int, RGB]:
  """Never repaint a shared vertex unless every incident triangle agrees."""
  values: dict[int, RGB | None] = {}
  for triangle, desired in zip(indices, assignments, strict=True):
    for value in triangle:
      vertex = int(value)
      if vertex not in values:
        values[vertex] = desired
      elif values[vertex] != desired:
        values[vertex] = None
  # Keep entire connected faces unchanged when a shared ridge/corner is unsafe.
  eligible = np.array([values.get(i) is not None for i in range(len(original))])
  while True:
    rejected = indices[~np.all(eligible[indices], axis=1)].ravel()
    before = int(eligible.sum())
    eligible[rejected] = False
    if int(eligible.sum()) == before:
      break
  return {
    v: rgb
    for v, rgb in values.items()
    if eligible[v] and rgb is not None and rgb != tuple(original[v])
  }


def compile_mesh(
  part: dict,
  origin: list,
  surfaces: list[Surface],
  native: list[NativePart],
  is_native: bool,
  tree: STRtree,
  candidates: list,
  counts: Counter,
  owners: set[str],
) -> dict[int, RGB]:
  """Read immutable triangles and prove ownership before assigning existing colours."""
  positions = (
    np.frombuffer(base64.b64decode(part["positions"]), dtype="<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + origin
  )
  colours = np.frombuffer(base64.b64decode(part["colors"]), dtype="u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(part["indices"]), dtype="<u4").reshape(-1, 3)
  assignments: list[RGB | None] = []
  provenance: list[tuple[str, str] | None] = []
  accepted = (
    {rgb for row in native for _, rgb, _ in row.roles}
    if is_native
    else {r.before for r in surfaces}
  )
  for index in indices:
    rgb = tuple(int(v) for v in colours[index[0]])
    if rgb not in accepted or not np.all(colours[index] == rgb):
      assignments.append(None)
      provenance.append(None)
      continue
    triangle = positions[index]
    center = np.mean(triangle[:, [0, 2]], axis=0)
    matches: set[tuple[str, str, RGB, bool]] = set()
    for candidate in tree.query(Point(center)):
      record = candidates[int(candidate)]
      if is_native:
        for role, after in record.candidates(triangle, rgb):
          matches.add((record.owner, role, after, record.allowed))
      elif record.matches(triangle, rgb):
        matches.add((record.owner, record.role, record.after, record.allowed))
    if len(matches) == 1:
      owner, role, after, allowed = next(iter(matches))
      assignments.append(after if allowed else None)
      provenance.append((owner, role) if allowed else None)
      counts[role + "MatchedTriangles"] += 1
    else:
      assignments.append(None)
      provenance.append(None)
      counts["ambiguousTriangles" if matches else "unmatchedTriangles"] += 1
  selected = unanimous_vertex_colours(indices, assignments, colours)
  final_vertices: dict[str, set[int]] = defaultdict(set)
  for triangle, identity in zip(indices, provenance, strict=True):
    changed = {int(v) for v in triangle if int(v) in selected}
    if identity and changed:
      owner, role = identity
      owners.add(owner)
      counts[role + "ChangedTriangles"] += 1
      final_vertices[role].update(changed)
  for role, values in final_vertices.items():
    counts[role + "ChangedVertices"] += len(values)
  counts["selectedVertices"] += len(selected)
  counts["examinedTriangles"] += len(indices)
  return selected


def runs_for(
  values: dict[int, RGB], palette: list[int], lookup: dict[int, int]
) -> list[int]:
  """Compress consecutive equal-colour vertex assignments without added buffers."""
  result: list[int] = []
  for vertex, rgb in sorted(values.items()):
    packed = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2]
    if packed not in lookup:
      lookup[packed] = len(palette)
      palette.append(packed)
    colour_index = lookup[packed]
    if result and result[-3] + result[-2] == vertex and result[-1] == colour_index:
      result[-2] += 1
    else:
      result.extend((vertex, 1, colour_index))
  return result


def packet_paths(
  bounds: tuple[float, ...] | None = None,
) -> list[tuple[str, str, Path]]:
  """Enumerate current resident and streamed files without historical regeneration."""
  result = []
  for mode, label in (("drawn", "Drawn"), ("minecraft", "Native")):
    for item in read(APP / f"altMitte{label}V169Source.json")["chunkFiles"]:
      result.append((mode, "alt-mitte-v169-" + item["id"], APP / item["file"]))
  for item in read(PUBLIC / "manifest.json")["chunks"]:
    x0, z0, x1, z1 = item["bounds"]
    if bounds and (
      x1 < bounds[0] or x0 > bounds[2] or z1 < bounds[1] or z0 > bounds[3]
    ):
      continue
    for mode in ("drawn", "minecraft"):
      result.append((mode, item["id"], PUBLIC / item[mode]["url"]))
  return result


def build(limit: int | None = None, *, write: bool = True) -> dict:
  """Compile sequentially, retaining only the bounded final sidecar and evidence."""
  records = source_records()
  inherited, protected = appearance()
  protected.update(read(PROTECTED)["ids"])
  surfaces, native, owners_evidence, source_counts = compile_sources(
    records, osm_footprints(records), protected, inherited
  )
  del records, inherited
  drawn_tree = STRtree([r.bounds_xz for r in surfaces])
  native_tree = STRtree([r.footprint for r in native])
  source_bounds = tuple(
    float(v) for v in shapely.total_bounds([r.footprint for r in native])
  )
  output = {"schemaVersion": 1, "palette": [], "packets": {}}
  palette_lookup: dict[int, int] = {}
  counts: dict[str, Counter] = defaultdict(Counter)
  changed_owners: dict[str, set] = defaultdict(set)
  receipts = []
  processed = 0
  for mode, identity, path in packet_paths(source_bounds):
    packet = read(path)
    if not any(p["kind"] == KIND for p in packet["meshes"]):
      continue
    if limit is not None and processed >= limit:
      break
    processed += 1
    entries = []
    selected_count = 0
    for ordinal, part in enumerate(packet["meshes"]):
      if part["kind"] != KIND:
        continue
      is_native = mode == "minecraft"
      values = compile_mesh(
        part,
        packet["origin"],
        surfaces,
        native,
        is_native,
        native_tree if is_native else drawn_tree,
        native if is_native else surfaces,
        counts[mode],
        changed_owners[mode],
      )
      if values:
        selected_count += len(values)
        entries.append(
          {
            "mesh": ordinal,
            "fingerprint": fingerprint(part),
            "runs": base64.b64encode(
              np.asarray(
                runs_for(values, output["palette"], palette_lookup), dtype="<u4"
              ).tobytes()
            ).decode("ascii"),
          }
        )
    if entries:
      output["packets"][mode + ":" + identity] = entries
    receipts.append(
      {
        "file": str(path.relative_to(ROOT)),
        "sha256": digest(path),
        "mode": mode,
        "selectedVertices": selected_count,
      }
    )
    if processed % 10 == 0:
      print(
        json.dumps(
          {
            "packets": processed,
            "mode": mode,
            "selectedVertices": counts[mode]["selectedVertices"],
          }
        ),
        flush=True,
      )
  raw = (json.dumps(output, separators=(",", ":")) + "\n").encode()
  evidence = {
    "schemaVersion": 1,
    "sourceManifestSha256": digest(SOURCE / "source-manifest.json"),
    "protectionSha256": digest(PROTECTED),
    "packetFilesChanged": 0,
    "sourceCounts": dict(source_counts),
    "fullSourcePacketSelectionBounds": source_bounds,
    "modeCounts": {k: dict(v) for k, v in counts.items()},
    "ownersReceivingSelectors": {k: sorted(v) for k, v in changed_owners.items()},
    "runtimeBytes": len(raw),
    "runtimeGzipBytes": len(gzip.compress(raw, mtime=0)),
    "paletteEntries": len(output["palette"]),
    "packetReceipts": receipts,
    "owners": owners_evidence,
    "limits": [
      "No surveyed windows, openings, cornices or current paint survey is inferred.",
      "Storey tags are evidence only; existing opening positions remain unchanged.",
      "Neutral roof separation and source-plane lighting are graphic choices, not measured materials.",
      "Native source association additionally permits the original two-metre surface-block envelope; ambiguous shared roles remain unchanged.",
      "Shared vertices touching an unselected or conflicting triangle remain unchanged.",
    ],
  }
  if write:
    assert limit is None, "A sample cannot replace the complete published sidecar"
    OUTPUT.write_bytes(raw)
    EVIDENCE.write_bytes(
      gzip.compress(json.dumps(evidence, separators=(",", ":")).encode(), mtime=0)
    )
  return {
    k: v
    for k, v in evidence.items()
    if k not in {"owners", "packetReceipts", "ownersReceivingSelectors"}
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--sample", type=int)
  args = parser.parse_args()
  print(json.dumps(build(args.sample, write=args.sample is None), indent=2))
