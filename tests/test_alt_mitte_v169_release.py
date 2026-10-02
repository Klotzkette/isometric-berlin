"""Historical v169 ownership plus live source-sheet and navigation coverage.

The v169 flat-ground replacement accounting is frozen at v175, before the
explicitly requested v176 terrain placement. The live leaf/palette proof below
checks every actual current source sheet at its rigid source-parent elevation.
The v176 packet tests separately audit the complete terrain transformation
against v175, including retained older details and terrain XZ coverage.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
import pytest
import shapely
from shapely.geometry import Polygon
from shapely.ops import unary_union
from test_city_refinements_v166 import (
  belongs_to_source,
  canonical,
  line_signature,
  number_of_triangles,
  source_prisms_by_top,
  triangle_keys,
)

# The independent legacy decoder above installs the scripts import path.
# isort: split
from alt_mitte_v169_packets import pack_detail  # noqa: E402
from build_alt_mitte_v169 import triangulate  # noqa: E402
from build_karl_marx_allee_v161 import Detail  # noqa: E402
from build_surrounding_outlines import load_projected_polygon, world  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DATA = ROOT / "src/app/src/data"
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169"
KIND = "alt-mitte-v169"
BASE = "v1.0.68"


def read(path):
  return json.loads(path.read_bytes())


def old_bytes(path):
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def source_records(manifest):
  for chunk in manifest["chunks"]:
    blob = (SOURCE / chunk["file"]).read_bytes()
    assert hashlib.sha256(blob).hexdigest() == chunk["sha256"]
    yield from json.loads(gzip.decompress(blob))["buildings"]


def source_proof_parts(record):
  """Measured leaves, or an explicitly declared OSM residual envelope only."""
  if record["parts"] or not record.get("needsResidualShell"):
    return record["parts"]
  assert record["sourceType"] == "osm-context" and not record["legacyPrisms"]
  low, high = record["groundY"], record["groundY"] + record["residualShellHeightM"]
  surfaces = []
  for footprint in record["footprintPolygons"]:
    polygon = shapely.orient_polygons(
      Polygon(footprint["ring"], footprint["holes"]), exterior_cw=True
    )
    for ring in [polygon.exterior, *polygon.interiors]:
      for (ax, az), (bx, bz) in zip(ring.coords, list(ring.coords)[1:]):
        a, b, c, d = [ax, low, az], [bx, low, bz], [bx, high, bz], [ax, high, az]
        surfaces.extend(
          {"kind": "WallSurface", "rings": [triangle]}
          for triangle in ([a, b, c], [a, c, d])
        )
    surfaces.append(
      {
        "kind": "RoofSurface",
        "rings": [
          [[x, high, z] for x, z in ring.coords[:-1]]
          for ring in [polygon.exterior, *polygon.interiors]
        ],
      }
    )
  return [
    {
      "id": record["id"],
      "footprintPolygons": record["footprintPolygons"],
      "groundY": low,
      "topY": high,
      "surfaces": surfaces,
    }
  ]


def packet(descriptor, mode, *, historical=False):
  spec = descriptor[mode]
  blob = (
    subprocess.check_output(
      ["git", "show", f"v1.0.75:{(PACKETS / spec['url']).relative_to(ROOT)}"], cwd=ROOT
    )
    if historical
    else (PACKETS / spec["url"]).read_bytes()
  )
  raw = gzip.decompress(blob)
  assert len(blob) == spec["bytes"] <= 5 * 1024 * 1024
  assert len(raw) == spec["decodedBytes"] <= 12 * 1024 * 1024
  assert hashlib.sha256(blob).hexdigest() == spec["sha256"]
  value = json.loads(raw)
  assert value["id"] == descriptor["id"]
  validate_packet_limits(value)
  return value


def validate_packet_limits(value):
  assert len(value["meshes"]) <= 16
  vertices = indices = 0
  for mesh in value["meshes"]:
    points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
    faces = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    assert len(points) == len(colors)
    assert faces.size == 0 or int(faces.max()) < len(points)
    vertices += len(points)
    indices += faces.size
  assert vertices <= 400_000 and indices <= 2_400_000
  if value.get("lines"):
    positions = base64.b64decode(value["lines"]["positions"])
    assert len(positions) % 12 == 0 and len(positions) // 6 <= 400_000
    if "colors" in value["lines"]:
      colors = base64.b64decode(value["lines"]["colors"])
      assert len(colors) == len(positions) // 2


def core_packets(metadata, mode):
  """Read the actual split modules one at a time, retaining their coordinate frame."""
  assert metadata["mode"] == mode and metadata["chunkFiles"]
  assert metadata["drawnChunks"] == metadata["minecraftChunks"] == []
  assert len({e["id"] for e in metadata["chunkFiles"]}) == len(metadata["chunkFiles"])
  assert len({e["file"] for e in metadata["chunkFiles"]}) == len(metadata["chunkFiles"])
  for entry in metadata["chunkFiles"]:
    path = DATA / entry["file"]
    assert path.stat().st_size < 3 * 1024 * 1024
    value = read(path)
    assert value["id"] == entry["id"]
    assert len(value["origin"]) == 3 and all(math.isfinite(v) for v in value["origin"])
    validate_packet_limits(value)
    yield value


def navigation_records():
  """Reassemble whole records in manifest order, including explicitly empty fields."""
  metadata = read(DATA / "altMitteV169Navigation.json")
  assert metadata["schemaVersion"] == 1
  assert len(set(metadata["fields"])) == len(metadata["fields"])
  assert len({e["file"] for e in metadata["chunkFiles"]}) == len(metadata["chunkFiles"])
  result = {field: [] for field in metadata["fields"]}
  for entry in metadata["chunkFiles"]:
    assert entry["field"] in result
    path = DATA / entry["file"]
    assert path.stat().st_size < 2 * 1024 * 1024
    records = read(path)
    assert isinstance(records, list)
    result[entry["field"]].extend(records)
  return result


@pytest.fixture(scope="module")
def release():
  manifest = read(PACKETS / "manifest.json")
  assert "altMitteV169" in manifest["source"], "v169 has not been published locally"
  previous = json.loads(old_bytes(PACKETS / "manifest.json"))
  audit = read(SOURCE / "render-audit.json")
  source = read(SOURCE / "source-manifest.json")
  return manifest, previous, audit, source


def test_v169_historical_replacement_preserved_all_prior_ownership(release):
  manifest, previous, audit, source = release
  terrain_release = (
    ROOT / "geo_data/regierungsviertel/weinberg-v176/packet-audit.json"
  ).exists()
  if terrain_release:
    manifest = json.loads(
      subprocess.check_output(
        ["git", "show", f"v1.0.75:{(PACKETS / 'manifest.json').relative_to(ROOT)}"],
        cwd=ROOT,
      )
    )

  def checked_packet(descriptor, mode):
    return packet(descriptor, mode, historical=terrain_release)

  old = {d["id"]: d for d in previous["chunks"]}
  current = {d["id"]: d for d in manifest["chunks"]}
  changes = {c["id"]: c for c in audit["chunks"]}
  owners, new_part_owners, residual_height_sources = set(), set(), {}
  for record in source_records(source):
    if record["category"] == "retained":
      continue
    if record["sourceType"] == "official-lod2":
      owners.update(record["outerOwnerIds"])
    new_part_owners.update((record["id"], p["id"]) for p in source_proof_parts(record))
    if record.get("needsResidualShell"):
      residual_height_sources[record["id"]] = record["sourceAttributes"][
        "height_source"
      ]
  assert len(current) == len(manifest["chunks"])
  assert len(old) == 274 and old.keys() <= current.keys()
  assert owners == set(manifest["source"]["altMitteV169"]["exactMovedOuterSourceIds"])
  assert set(changes) <= current.keys()
  for identity, descriptor in current.items():
    primary = descriptor.get("detailCompanionOf")
    is_new_companion = identity not in old and primary in changes
    if identity not in changes and not is_new_companion:
      assert descriptor == old[identity]
      for mode in ("drawn", "minecraft"):
        asset_path = PACKETS / descriptor[mode]["url"]
        blob = (
          subprocess.check_output(
            ["git", "show", f"v1.0.75:{asset_path.relative_to(ROOT)}"], cwd=ROOT
          )
          if terrain_release
          else asset_path.read_bytes()
        )
        assert blob == old_bytes(PACKETS / old[identity][mode]["url"])
      continue
    if is_new_companion:
      assert descriptor["bounds"] == current[primary]["bounds"]
      for mode in ("drawn", "minecraft"):
        after = checked_packet(descriptor, mode)
        assert all(m["kind"] == KIND for m in after["meshes"])
        assert all(
          after["nav"][k] == []
          for k in ("ground", "water", "roads", "bridges", "buildings")
        )
      continue
    entry = changes[identity]
    for mode in ("drawn", "minecraft"):
      after = checked_packet(descriptor, mode)
      before = (
        json.loads(gzip.decompress(old_bytes(PACKETS / old[identity][mode]["url"])))
        if identity in old
        else {
          "meshes": [],
          "nav": {
            "ground": [],
            "water": [],
            "roads": [],
            "bridges": [],
            "buildings": [],
            "groundY": 3,
          },
        }
      )
      if identity in old:
        assert after["origin"] == before["origin"], "Retained geometry frame changed"
      companions = [
        checked_packet(d, mode)
        for name, d in current.items()
        if name not in old and d.get("detailCompanionOf") == identity
      ]
      all_new = [after, *companions]
      old_city = triangle_keys([m for m in before["meshes"] if m["kind"] == "city"])
      new_city = triangle_keys([m for m in after["meshes"] if m["kind"] == "city"])
      assert not new_city - old_city
      removed = old_city - new_city
      assert sum(removed.values()) == entry["modes"][mode]["removedCoarseTriangles"]
      columns = source_prisms_by_top(before["nav"]["buildings"], owners)
      assert all(belongs_to_source(t, columns) for t in removed), (
        identity,
        mode,
        "unowned face removed",
      )
      assert Counter(
        canonical(m) for m in before["meshes"] if m["kind"] != "city"
      ) == Counter(
        canonical(m) for m in after["meshes"] if m["kind"] not in {"city", KIND}
      )
      added = [m for p in all_new for m in p["meshes"] if m["kind"] == KIND]
      assert number_of_triangles(added) == entry["modes"][mode]["addedStreamTriangles"]
      if before.get("lines"):
        removed_lines = line_signature(before["lines"])
        for p in all_new:
          if p.get("lines", {}).get("colors") and p["origin"] == after["origin"]:
            removed_lines.subtract(line_signature(p["lines"]))
        assert all(
          belongs_to_source(t, columns, lines=True)
          for t, n in removed_lines.items()
          if n > 0
        ), (identity, "unowned ink removed")
      for field in ("ground", "water", "roads", "bridges", "groundY"):
        assert after["nav"][field] == before["nav"][field]
      old_unowned = Counter(
        canonical(n) for n in before["nav"]["buildings"] if n["sourceId"] not in owners
      )
      new_unowned = Counter(
        canonical(n) for n in after["nav"]["buildings"] if n["sourceId"] not in owners
      )
      assert not old_unowned - new_unowned, (identity, mode, "unowned nav row lost")
      # Previously absent complete parents can add nav without removing an owner.
      # Every addition still requires an explicit selected source leaf identity.
      for encoded in new_unowned - old_unowned:
        row = json.loads(encoded)
        assert (row["sourceId"], row.get("partId")) in new_part_owners
        if row["sourceId"] in residual_height_sources:
          assert "OSM" in row["heightSource"]
          assert residual_height_sources[row["sourceId"]] in row["heightSource"]
        else:
          assert row["heightSource"] == "complete Berlin LoD2 leaf envelope"
      assert all(
        "partId" in n for n in after["nav"]["buildings"] if n["sourceId"] in owners
      )
  assert audit["unownedTriangleLoss"] == audit["unownedNavigationLoss"] == 0


def position_keys(meshes, origin, include_colors=False, y_offset=0):
  """Only the new source proof ignores palette; baseline proof includes colours."""
  result = Counter()
  for mesh in meshes:
    points = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
      .reshape(-1, 3)
      .astype("<i4")
    )
    points += np.rint(np.asarray(origin) * 100).astype("<i4")
    points[:, 1] += round(y_offset * 100)
    if include_colors:
      colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
      points = np.column_stack((points, colors.astype("<i4")))
    faces = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    result.update(b"".join(sorted(p.tobytes() for p in points[tri])) for tri in faces)
  return result


def inherited_palette():
  snapshot = json.loads(
    gzip.decompress((SOURCE / "appearance-baseline.json.gz").read_bytes())
  )
  chosen = {}
  for previous in snapshot["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        key = part["partId"]
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if key not in chosen or rank > chosen[key][0]:
          chosen[key] = rank, previous
  return {key: row for key, (_, row) in chosen.items()}


def frozen_drawn_shade(points, rgb):
  """Frozen v168 isoFaceShade constants, independently applied to source colour."""
  a, b, c = np.asarray(points)
  n = np.cross(b - a, c - a)
  magnitude = np.linalg.norm(n)
  if magnitude > 1e-12:
    n /= magnitude
  if n[1] > 0.55:
    factor = 1.0
  elif n[1] < -0.55:
    factor = 0.89
  elif abs(n[0]) >= abs(n[2]):
    factor = 0.95 if n[0] > 0 else 0.89
  else:
    factor = 0.92 if n[2] > 0 else 0.98
  output = []
  for channel in rgb:
    c = channel / 255
    linear = (c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4) * factor
    srgb = (
      linear * 12.92 if linear <= 0.0031308 else 1.055 * linear ** (1 / 2.4) - 0.055
    )
    output.append(round(srgb * 255))
  return tuple(output)


def test_every_new_source_leaf_has_published_sheets_and_complete_navigation(release):
  manifest, _, audit, source = release
  core_drawn = read(DATA / "altMitteDrawnV169Source.json")
  core_native = read(DATA / "altMitteNativeV169Source.json")
  navigation = navigation_records()
  assert core_drawn["minecraftChunks"] == [] and core_native["drawnChunks"] == []
  expected_core = {
    o["id"]
    for o in source["owners"]
    if o["category"] == "core" and o["sourceType"] == "official-lod2"
  }
  assert (
    expected_core
    == set(core_drawn["sourceParents"])
    == set(core_native["sourceParents"])
  )
  expected_shells = {"core": defaultdict(Counter), "outer": defaultdict(Counter)}
  expected_palette = {"core": defaultdict(Counter), "outer": defaultdict(Counter)}
  palette = inherited_palette()
  core_origin_y = {}
  for value in core_packets(core_drawn, "drawn"):
    ox, oy, oz = value["origin"]
    identity = f"{round(ox / 512)}_{round(oz / 512)}"
    assert identity not in core_origin_y or core_origin_y[identity] == oy
    core_origin_y[identity] = oy
  terrain_offsets = read(DATA / "weinbergBuildingOffsetsV176.json")["offsets"]
  expected_nav = {}
  expected_prisms = {}
  refined = set()
  release_bounds = world(
    load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds.geojson")
  )
  shapely.prepare(release_bounds)
  for record in source_records(source):
    if record["category"] == "retained":
      continue
    refined.add(record["id"])
    parts = source_proof_parts(record)
    if not parts:
      continue
    target = "core" if record["category"] == "core" else "outer"
    if target == "core":
      expected_prisms.update((canonical(p), p) for p in record["legacyPrisms"])
    for part in parts:
      expected_nav[record["id"], part["id"]] = (target, part)
      for surface in part["surfaces"]:
        if surface["kind"] not in {"WallSurface", "RoofSurface", "ClosureSurface"}:
          continue
        sheets = Detail()
        coloured = Detail()
        for tri in triangulate(surface["rings"]):
          sheets.polygon(tri, (128, 128, 128), "independent source sheet")
          if part["id"] in palette:
            previous = palette[part["id"]]
            rgb = previous["roof" if surface["kind"] == "RoofSurface" else "facade"][
              "srgb8"
            ]
            coloured.polygon(
              tri, frozen_drawn_shade(tri, rgb), "inherited source colour"
            )
        coordinates = [p for ring in surface["rings"] for p in ring]
        x0, x1 = min(p[0] for p in coordinates), max(p[0] for p in coordinates)
        z0, z1 = min(p[2] for p in coordinates), max(p[2] for p in coordinates)
        assert release_bounds.buffer(0.002).covers(
          shapely.MultiPoint([(p[0], p[2]) for p in coordinates])
        )
        for ix in range(math.floor(x0 / 512), math.floor(x1 / 512) + 1):
          for iz in range(math.floor(z0 / 512), math.floor(z1 / 512) + 1):
            identity = f"{ix}_{iz}"
            origin_y = core_origin_y.get(identity, -10) if target == "core" else -10
            origin = (ix * 512, origin_y, iz * 512)
            expected_shells[target][f"{ix}_{iz}"].update(
              position_keys(
                pack_detail(
                  sheets,
                  (ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512),
                  origin_y=origin_y,
                ),
                origin,
                y_offset=terrain_offsets.get(record["id"], 0),
              )
            )
            if coloured.triangles:
              expected_palette[target][f"{ix}_{iz}"].update(
                position_keys(
                  pack_detail(
                    coloured,
                    (ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512),
                    origin_y=origin_y,
                  ),
                  origin,
                  include_colors=True,
                  y_offset=terrain_offsets.get(record["id"], 0),
                )
              )
  assert refined == {b["id"] for b in audit["buildings"]}
  assert {canonical(p) for p in navigation["legacyPrisms"]} == set(expected_prisms)
  # K0000Aqm has two distinct old components; an ID-only mask loses one.
  assert sum(p["id"] == "K0000Aqm" for p in navigation["legacyPrisms"]) == 2
  available = {"core": defaultdict(Counter), "outer": defaultdict(Counter)}
  available_palette = {"core": defaultdict(Counter), "outer": defaultdict(Counter)}

  def collect_sheets(target, identity, meshes, origin):
    # Facade ornaments need no second global copy: retain only source-sheet keys.
    available[target][identity].update(
      {
        key: count
        for key, count in position_keys(meshes, origin).items()
        if key in expected_shells[target][identity]
      }
    )
    available_palette[target][identity].update(
      {
        key: count
        for key, count in position_keys(meshes, origin, include_colors=True).items()
        if key in expected_palette[target][identity]
      }
    )

  actual_nav = {
    "core": defaultdict(list),
    "drawn": defaultdict(list),
    "minecraft": defaultdict(list),
  }
  for n in navigation["parts"]:
    actual_nav["core"][n["sourceId"], n["id"]].append(
      (Polygon(n["ring"], n["holes"]), n["groundY"], n["topY"])
    )
  for mode, payload in (("drawn", core_drawn), ("minecraft", core_native)):
    resident_counts = Counter()
    for value in core_packets(payload, mode):
      assert all(
        value["nav"][k] == []
        for k in ("ground", "water", "roads", "bridges", "buildings")
      )
      ox, _, oz = value["origin"]
      identity = f"{round(ox / 512)}_{round(oz / 512)}"
      resident_counts[identity] += number_of_triangles(value["meshes"])
      if mode == "drawn":
        collect_sheets(
          "core",
          identity,
          value["meshes"],
          value["origin"],
        )
    assert +resident_counts == Counter(
      {
        entry["id"]: entry["modes"][mode]["residentTriangles"]
        for entry in audit["chunks"]
        if entry["modes"][mode]["residentTriangles"]
      }
    )
  affected = {c["id"] for c in audit["chunks"]}
  for descriptor in manifest["chunks"]:
    if (
      descriptor["id"] not in affected
      and descriptor.get("detailCompanionOf") not in affected
    ):
      continue
    for mode in ("drawn", "minecraft"):
      value = packet(descriptor, mode)
      ox, _, oz = value["origin"]
      identity = descriptor.get("detailCompanionOf", descriptor["id"])
      if mode == "drawn":
        collect_sheets(
          "outer",
          identity,
          [m for m in value["meshes"] if m["kind"] == KIND],
          value["origin"],
        )
      for n in value["nav"]["buildings"]:
        key = n["sourceId"], n.get("partId")
        if key not in expected_nav:
          continue
        p = Polygon(
          [(x + ox, z + oz) for x, z in n["ring"]],
          [[(x + ox, z + oz) for x, z in h] for h in n["holes"]],
        )
        actual_nav[mode][key].append(
          (
            shapely.make_valid(p),
            3 + n["minHeight"] + n.get("groundOffset", 0),
            3 + n["height"] + n.get("groundOffset", 0),
          )
        )
  missing_sheets = []
  for target, cells in expected_shells.items():
    for identity, expected in cells.items():
      missing = expected - available[target][identity]
      if missing:
        missing_sheets.append(
          (
            target,
            identity,
            "source wall/roof/closure sheet missing",
            sum(missing.values()),
            [
              np.frombuffer(key, "<i4").reshape(3, 3).tolist()
              for key in list(missing)[:8]
            ],
          )
        )
  assert any(expected_palette["core"].values()), "No inherited core appearance checked"
  for target, cells in expected_palette.items():
    for identity, expected in cells.items():
      missing = expected - available_palette[target][identity]
      if missing:
        missing_sheets.append(
          (
            target,
            identity,
            "inherited source wall/roof colour missing",
            sum(missing.values()),
          )
        )
  assert not missing_sheets, missing_sheets
  for key, (target, part) in expected_nav.items():
    expected = unary_union(
      [
        shapely.make_valid(Polygon(p["ring"], p["holes"]))
        for p in part["footprintPolygons"]
      ]
    )
    for family in ("core",) if target == "core" else ("drawn", "minecraft"):
      rows = actual_nav[family][key]
      assert rows, (family, key, "missing source leaf")
      assert (
        unary_union([r[0] for r in rows]).symmetric_difference(expected).area
        <= expected.length * 0.02 + 0.01
      )
      source_ground = min(
        (
          point[1]
          for surface in part["surfaces"]
          if surface["kind"] == "GroundSurface"
          for ring in surface["rings"]
          for point in ring
        ),
        default=part["groundY"],
      )
      assert all(
        abs(lo - source_ground - terrain_offsets.get(key[0], 0)) < 0.011
        and abs(hi - part["topY"] - terrain_offsets.get(key[0], 0)) < 0.011
        for _, lo, hi in rows
      )


def test_previous_authored_source_and_navigation_assets_remain_byte_exact():
  names = subprocess.check_output(
    ["git", "ls-tree", "-r", "--name-only", BASE, "src/app/src/data"],
    cwd=ROOT,
    text=True,
  ).splitlines()
  for name in names:
    path = ROOT / name
    if path.suffix == ".json" and ("Source" in path.name or "Navigation" in path.name):
      assert path.read_bytes() == old_bytes(path), name


def test_existing_transparent_families_are_retained_instead_of_opaque_replacement(
  release,
):
  _, _, _, source = release
  snapshot = json.loads(
    gzip.decompress((SOURCE / "appearance-baseline.json.gz").read_bytes())
  )
  glass_owners = {
    binding["sourceId"]
    for previous in snapshot["records"]
    if previous["glass"] and previous["renderable"]
    for binding in previous["bindings"]
  }
  owners = {record["id"]: record for record in source["owners"]}
  assert glass_owners and glass_owners <= owners.keys()
  assert all(owners[identity]["category"] == "retained" for identity in glass_owners)


def test_appearance_evidence_uses_immutable_v168_prisms_and_complete_spatial_keys():
  path = SOURCE / "appearance-baseline.json.gz"
  blob = path.read_bytes()
  assert len(blob) <= 5 * 1024 * 1024 and blob[4:8] == bytes(4)
  snapshot = json.loads(gzip.decompress(blob))
  assert snapshot["baseRelease"] == BASE
  assert (
    snapshot["baseCommit"]
    == subprocess.check_output(
      ["git", "rev-parse", BASE + "^{commit}"], cwd=ROOT, text=True
    ).strip()
  )
  for proof in [
    snapshot["provenance"]["world"],
    snapshot["provenance"]["prisms"],
    *snapshot["provenance"]["importedDependencies"],
  ]:
    raw = old_bytes(ROOT / proof["file"])
    assert hashlib.sha256(raw).hexdigest() == proof["sha256"]
    assert (
      hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
      == proof["gitBlob"]
    )
  old_prisms = json.loads(old_bytes(ROOT / snapshot["provenance"]["prisms"]["file"]))[
    "buildings"
  ]
  records = snapshot["records"]
  assert len(records) == snapshot["counts"]["prisms"]
  assert len({r["prismKey"] for r in records}) == len(records)
  for row in records:
    assert row["prism"] == old_prisms[row["prismIndex"]]
    assert (
      hashlib.sha256(canonical(row["prism"]).encode()).hexdigest() == row["prismKey"]
    )
    for role in ("facade", "roof"):
      assert len(row[role]["srgb"]) == len(row[role]["srgb8"]) == 3
      assert all(math.isfinite(v) for v in row[role]["linear"])
      assert [
        math.floor(max(0, min(1, v)) * 255 + 0.5) for v in row[role]["srgb"]
      ] == row[role]["srgb8"]
  assert {r["prism"]["id"] for r in records if r["glass"]} == set(
    snapshot["glassPrismIds"]
  )
  assert sum(r["glass"] for r in records) == snapshot["counts"]["glassPrisms"]
  assert (
    len({tuple(r["facade"]["srgb8"]) for r in records})
    == snapshot["counts"]["uniqueFacadeSRGB8"]
  )
  assert (
    len({tuple(r["roof"]["srgb8"]) for r in records})
    == snapshot["counts"]["uniqueRoofSRGB8"]
  )
