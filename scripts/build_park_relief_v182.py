"""Step 10: bounded official DGM relief, retaining every previous city surface."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import subprocess
import zipfile
from pathlib import Path

import geopandas as gpd
import numpy as np
import requests
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/parkReliefV182.json"
RAW = ROOT / "geo_data/regierungsviertel/raw/dgm/parks-v182"
SOURCE = ROOT / "geo_data/regierungsviertel/park-relief-v182.json"
BASE = "v1.0.81"
NAMES = ("Viktoriapark", "Volkspark Humboldthain", "Volkspark Friedrichshain")
STEP = 10
BOUNDARY_FADE = 80


def encode(value: object) -> bytes:
  return (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def original(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"],
    cwd=ROOT,
    stderr=subprocess.DEVNULL,
  )


def smooth(t: float) -> float:
  t = max(0.0, min(1.0, t))
  return t * t * (3 - 2 * t)


def sample(profile: dict, x: float, z: float, field: str = "offsets") -> float:
  x0, z0, x1, z1 = profile["support"]
  if x <= x0 or x >= x1 or z <= z0 or z >= z1:
    return 0.0
  u, v = (x - x0) / STEP, (z - z0) / STEP
  ix, iz = math.floor(u), math.floor(v)
  a, b = u - ix, v - iz
  values = profile[field]
  nw, ne = values[iz][ix : ix + 2]
  sw, se = values[iz + 1][ix : ix + 2]
  return (
    nw * (1 - a) + ne * (a - b) + se * b
    if a >= b
    else nw * (1 - b) + sw * (b - a) + se * a
  )


def build_profiles() -> dict:
  """Sample authoritative bare earth; fade only at mapped park boundaries."""
  from build_weinberg_dgm_samples import BASE_URL, sample_height, tile_code

  RAW.mkdir(parents=True, exist_ok=True)
  parks = gpd.read_file(
    ROOT / "geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    where="name IN ("
    + ",".join("'" + name.replace("'", "''") + "'" for name in NAMES)
    + ")",
  ).to_crs(25833)
  specs, codes = [], set()
  for name in NAMES:
    row = parks[parks.name == name].iloc[0]
    # A mapped monument/building hole is not a cliff or a hole in the hill.
    # Ground ownership keeps these holes; only the elevation field spans them.
    geometry = unary_union([Polygon(part.exterior) for part in row.geometry.geoms])
    from shapely.affinity import affine_transform

    world = affine_transform(geometry, [1, 0, 0, -1, -389500, 5820000])
    support = [
      math.floor(world.bounds[0] / STEP) * STEP - STEP - BOUNDARY_FADE,
      math.floor(world.bounds[1] / STEP) * STEP - STEP - BOUNDARY_FADE,
      math.ceil(world.bounds[2] / STEP) * STEP + STEP + BOUNDARY_FADE,
      math.ceil(world.bounds[3] / STEP) * STEP + STEP + BOUNDARY_FADE,
    ]
    specs.append((name, world, support))
    for x in np.arange(support[0], support[2] + 1, STEP):
      for z in np.arange(support[1], support[3] + 1, STEP):
        codes.add(tile_code(389500 + x, 5820000 - z))
  tiles, sources = {}, []
  for code in sorted(codes):
    path = ROOT / f"geo_data/regierungsviertel/raw/dgm/weinberg-v176/DGM1_{code}.zip"
    if not path.exists():
      path = RAW / f"DGM1_{code}.zip"
      if not path.exists():
        response = requests.get(BASE_URL + path.name, timeout=120)
        response.raise_for_status()
        path.write_bytes(response.content)
    with zipfile.ZipFile(path) as archive:
      member = f"dgm1_33_{code}_2_be.xyz"
      with archive.open(member) as stream:
        heights = np.loadtxt(stream, usecols=2)
    if heights.size != 4_000_000:
      raise ValueError("Unexpected official DGM tile dimensions")
    tiles[code] = heights.reshape(2000, 2000)
    sources.append(
      {
        "url": BASE_URL + path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "member": member,
      }
    )
    print("DGM", code, flush=True)
  profiles, evidence = [], []
  for name, park, (x0, z0, x1, z1) in specs:
    heights, offsets, weights = [], [], []
    for z in range(z0, z1 + 1, STEP):
      hr, offset, wr = [], [], []
      for x in range(x0, x1 + 1, STEP):
        nhn = sample_height(tiles, x, z)[0]
        point = Point(x, z)
        weight = (
          1.0
          if park.covers(point)
          else smooth(1 - park.distance(point) / BOUNDARY_FADE)
        )
        hr.append(nhn)
        wr.append(round(weight, 6))
        offset.append(round((nhn - 33) * weight, 4))
      heights.append(hr)
      offsets.append(offset)
      weights.append(wr)
    profiles.append(
      {
        "name": name,
        "support": [x0, z0, x1, z1],
        "stepM": STEP,
        "offsets": offsets,
        "weights": weights,
      }
    )
    evidence.append(
      {
        "name": name,
        "support": [x0, z0, x1, z1],
        "heightsNHN": heights,
        "peakSampleNHN": max(map(max, heights)),
        "boundaryFadeM": BOUNDARY_FADE,
        "boundaryFadeDirection": "outside",
      }
    )
  payload = {
    "schemaVersion": 1,
    "datumNHN": 30,
    "flatBaseline": 3,
    "profiles": profiles,
  }
  DATA.write_bytes(encode(payload))
  SOURCE.write_bytes(
    encode(
      {
        "source": "Geoportal Berlin ATKIS DGM1",
        "license": "dl-de/zero-2-0",
        "sources": sources,
        "sourceResolutionM": 1,
        "sampleSpacingM": 10,
        "retrieved": "2026-10-07",
        "display": "Measured NHN minus30 throughout each mapped park, blended over80m outside its boundary into the existing scene. Monument/building holes do not flatten the height field. Not a whole-city elevation survey.",
        "parks": evidence,
      }
    )
  )
  return payload


def patch_core(profiles: list[dict]) -> list[dict]:
  """Change only park samples; the previous complete fields stay in Git."""
  audit = []
  for filename in ("ground-context.json", "minecraft-voxels.json"):
    path = ROOT / "src/app/public/mesh/regierungsviertel" / filename
    raw = original(path)
    payload = json.loads(raw)
    heights = payload["ground_height"]
    grid = payload["grid"]
    cell = payload["cell_m"]
    changes = []
    for row in range(heights["rows"]):
      z = (grid["min_z_idx"] + (row + 0.5) * heights["stride_cells"]) * cell
      for col in range(heights["cols"]):
        x = (grid["min_x_idx"] + (col + 0.5) * heights["stride_cells"]) * cell
        for p in profiles:
          weight = sample(p, x, z, "weights")
          if not weight:
            continue
          idx = row * heights["cols"] + col
          old = heights["y_dm"][idx]
          new = round(old + 10 * (sample(p, x, z) + (3 - old / 10) * weight))
          if old != new:
            heights["y_dm"][idx] = new
            changes.append([idx, old, new])
    path.write_bytes(encode(payload))
    audit.append(
      {
        "file": str(path.relative_to(ROOT)),
        "baseSha256": hashlib.sha256(raw).hexdigest(),
        "changedSamples": changes,
      }
    )
  return audit


def patch_core_objects(profiles: list[dict], audit_path: Path | None = None) -> dict:
  """Keep trees, paths and whole building parents attached to the new ground."""
  from shapely import STRtree

  folder = ROOT / "src/app/public/mesh/regierungsviertel"
  old_ground = json.loads(original(folder / "ground-context.json"))
  new_ground = json.loads((folder / "ground-context.json").read_bytes())

  def ground_at(payload: dict, x: float, z: float, native: bool = False) -> float:
    field, grid, cell = payload["ground_height"], payload["grid"], payload["cell_m"]
    u = (x / cell - grid["min_x_idx"]) / field["stride_cells"]
    v = (z / cell - grid["min_z_idx"]) / field["stride_cells"]

    def value(col: int, row: int) -> float:
      col = max(0, min(field["cols"] - 1, col))
      row = max(0, min(field["rows"] - 1, row))
      return field["y_dm"][row * field["cols"] + col] / 10

    if native:
      return value(math.floor(u), math.floor(v))
    u -= 0.5
    v -= 0.5
    ix = math.floor(u)
    iz = math.floor(v)
    a = u - ix
    b = v - iz
    return (value(ix, iz) * (1 - a) + value(ix + 1, iz) * a) * (1 - b) + (
      value(ix, iz + 1) * (1 - a) + value(ix + 1, iz + 1) * a
    ) * b

  def offset(x: float, z: float, old: float = 5.245, native: bool = False) -> float:
    return ground_at(new_ground, x, z, native) - ground_at(old_ground, x, z, native)

  prisms = json.loads(original(folder / "lod2-prisms.json"))
  changes = []
  polygons = []
  shifts = []
  for b in prisms["buildings"]:
    polygon = Polygon([(x / 10, z / 10) for x, z in b["ring"]])
    if polygon.is_empty:
      continue
    centre = polygon.representative_point()
    old = b["y0_dm"]
    dy = round(offset(centre.x, centre.y, old / 10) * 10)
    if not dy:
      continue
    old_height = b["h_dm"]
    if b["id"] == "26763667":
      # OSM supplies the surviving north-half footprint, but no measured height.
      # The previous nine metres were a generic fallback. The DGM top and the
      # operator's roughly42m full structure establish this display envelope.
      b["y0_dm"], b["h_dm"] = 134, 420
      dy = b["y0_dm"] - old
    else:
      b["y0_dm"] += dy
    changes.append([b["id"], old, old_height, b["y0_dm"], b["h_dm"]])
    polygons.append(polygon)
    # Native columns keep complete four-metre block courses. A corrected
    # drawn envelope is quantized once at both its old and new heights.
    native_height_delta = 40 * (math.ceil(b["h_dm"] / 40) - math.ceil(old_height / 40))
    shifts.append((dy, native_height_delta))
  (folder / "lod2-prisms.json").write_bytes(encode(prisms))
  tree = STRtree(polygons)
  voxels = json.loads((folder / "minecraft-voxels.json").read_bytes())
  original_voxels = json.loads(original(folder / "minecraft-voxels.json"))
  cell = voxels["cell_m"]
  grid = voxels["grid"]
  voxel_count = 0
  tree_count = 0
  for iz, row in enumerate(original_voxels["building_rows"]):
    out = []
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    for x0, count, y0, y1, kind in row:
      for ix in range(x0, x0 + count):
        x = (grid["min_x_idx"] + ix + 0.5) * cell
        point = Point(x, z)
        dy = dh = 0
        for index in tree.query(point):
          if polygons[index].covers(point):
            dy, dh = shifts[index]
            break
        record = [ix, 1, y0 + dy, y1 + dy + dh, kind]
        if out and out[-1][0] + out[-1][1] == ix and out[-1][2:] == record[2:]:
          out[-1][1] += 1
        else:
          out.append(record)
        voxel_count += bool(dy or dh)
    voxels["building_rows"][iz] = out
  voxels["tree_rows"] = original_voxels["tree_rows"]
  for iz, row in enumerate(voxels["tree_rows"]):
    z = (grid["min_z_idx"] + iz + 0.5) * cell
    for value in row:
      x = (grid["min_x_idx"] + value[0] + 0.5) * cell
      dy = round(offset(x, z, value[1] / 10, native=True) * 10)
      value[1] += dy
      tree_count += bool(dy)
  (folder / "minecraft-voxels.json").write_bytes(encode(voxels))
  props = json.loads(original(folder / "park-details.json"))
  prop_count = 0

  def place(value: object, coordinates: bool = False) -> None:
    nonlocal prop_count
    if isinstance(value, dict):
      for key, item in value.items():
        place(item, key in {"position", "points", "outline", "rings", "ring", "anchor"})
    elif isinstance(value, list):
      if (
        coordinates
        and len(value) == 3
        and all(isinstance(n, (int, float)) for n in value)
      ):
        dy = offset(value[0], value[2])
        if dy:
          value[1] = round(value[1] + dy, 3)
          prop_count += 1
      else:
        for item in value:
          place(item, coordinates)

  place(props)
  (folder / "park-details.json").write_bytes(encode(props))
  report = {
    "baseline": BASE,
    "buildingChanges": changes,
    "shiftedBuildingColumns": voxel_count,
    "shiftedVoxelTrees": tree_count,
    "placedParkCoordinates": prop_count,
    "bunkerConflict": "OSM way26763667 previously used a generic9m height at flat5.2m. The surviving north-half outline now has a42m display envelope from y13.4 to55.4, consistent with operator dimensions and the official DGM top. These are not surveyed building dimensions; the previous source is retained in v1.0.81 and the receipt above.",
  }
  (
    audit_path or ROOT / "geo_data/regierungsviertel/park-relief-v182-object-audit.json"
  ).write_bytes(encode(report))
  return report


def patch_outer(profiles: list[dict]) -> list[dict]:
  """Use the existing exact terrain splitter, retaining triangle receipts."""
  import build_weinberg_terrain_packets_v176 as terrain
  from shapely import STRtree, make_valid

  folder = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  manifest_path = folder / "manifest.json"
  manifest = json.loads(manifest_path.read_bytes())
  audit = []
  # Only base descriptors are changed. Later city-fill packets have no park
  # overlap because these three parks already belong to the retained city.
  for profile in profiles:
    support = box(*profile["support"])
    water_parts = []
    parent_parts = {}
    nearby_packets = {}
    for descriptor in manifest["chunks"]:
      if not support.buffer(512).intersects(box(*descriptor["bounds"])):
        continue
      try:
        source_packet = json.loads(
          gzip.decompress(original(folder / descriptor["drawn"]["url"]))
        )
      except subprocess.CalledProcessError:
        continue
      nearby_packets[descriptor["drawn"]["url"]] = source_packet
      ox, _, oz = source_packet["origin"]
      for building in source_packet["nav"]["buildings"]:
        key = building.get("partId", building["sourceId"])
        parent_parts.setdefault(key, []).append(
          Polygon(
            [(x + ox, z + oz) for x, z in building["ring"]],
            [[(x + ox, z + oz) for x, z in ring] for ring in building["holes"]],
          )
        )
      for pond in source_packet["nav"]["water"]:
        water_parts.append(
          Polygon(
            [(x + ox, z + oz) for x, z in pond["ring"]],
            [[(x + ox, z + oz) for x, z in ring] for ring in pond["holes"]],
          )
        )
    # One altitude per complete source owner, including its adjacent chunk
    # pieces. Otherwise a single house acquires a step at the packet seam.
    parent_offsets = {}
    for key, parts in parent_parts.items():
      centre = unary_union([make_valid(part) for part in parts]).representative_point()
      parent_offsets[key] = round(sample(profile, centre.x, centre.y), 2)
    whole_water = unary_union(water_parts)
    ponds = (
      [whole_water] if whole_water.geom_type == "Polygon" else list(whole_water.geoms)
    )
    pond_levels = []
    for pond in ponds:
      centre = pond.representative_point()
      if sample(profile, centre.x, centre.y, "weights") > 0:
        pond_levels.append(
          (pond.buffer(0.06), round(2.88 + sample(profile, centre.x, centre.y), 2))
        )

    def water_at(points: np.ndarray) -> float | None:
      point = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
      for pond, level in pond_levels:
        if pond.covers(point):
          return level
      return None

    terrain.SUPPORT = profile["support"]
    terrain.STEP = STEP
    terrain.sample_offset = lambda x, z, p=profile: sample(p, x, z)
    for descriptor in manifest["chunks"]:
      base_packet = nearby_packets.get(descriptor["drawn"]["url"])
      if base_packet is None:
        continue
      if not support.intersects(box(*descriptor["bounds"])) and not any(
        parent_offsets.get(b.get("partId", b["sourceId"]), 0)
        for b in base_packet["nav"]["buildings"]
      ):
        continue
      for mode in ("drawn", "minecraft"):
        asset = descriptor[mode]
        path = folder / asset["url"]
        try:
          raw = original(path)
        except subprocess.CalledProcessError:
          continue
        packet = json.loads(gzip.decompress(raw))
        origin = packet["origin"]
        polygons = []
        values = []
        for b in packet["nav"]["buildings"]:
          polygon = Polygon([[x + origin[0], z + origin[2]] for x, z in b["ring"]])
          offset = parent_offsets.get(b.get("partId", b["sourceId"]), 0)
          polygons.append(polygon.buffer(0.04))
          values.append(offset)
          if offset:
            b["groundOffset"] = offset
        tree = STRtree(polygons)

        class Owners:
          def lookup(self, points: np.ndarray) -> float | None:
            p = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
            for index in tree.query(p):
              if polygons[index].covers(p):
                return values[index]
            return None

        owners = Owners()
        counts = []
        for i, mesh in enumerate(packet["meshes"]):
          packet["meshes"][i], receipt = terrain.elevate_mesh(
            mesh,
            origin,
            {},
            owners.lookup,
            minecraft=mode == "minecraft",
            water_at=water_at,
          )
          counts.append(receipt)
        if packet.get("lines", {}).get("positions"):
          packet["lines"], line_audit = terrain.elevate_lines(
            packet["lines"], origin, owners, {}
          )
        else:
          line_audit = {}
        # Chunk budgets remain unchanged; fail before publishing oversized data.
        if not terrain.fits(packet):
          raise ValueError(f"Terrain packet budget exceeded: {path.name}")
        encoded = encode(packet)
        compressed = gzip.compress(encoded, mtime=0, compresslevel=9)
        path.write_bytes(compressed)
        asset.update(
          bytes=len(compressed),
          decodedBytes=len(encoded),
          sha256=hashlib.sha256(compressed).hexdigest(),
        )
        audit.append(
          {
            "file": str(path.relative_to(ROOT)),
            "park": profile["name"],
            "baseSha256": hashlib.sha256(raw).hexdigest(),
            "meshes": counts,
            "lines": line_audit,
          }
        )
        print(path.name, len(raw), len(compressed), flush=True)
  manifest_path.write_bytes(encode(manifest))
  return audit


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--samples", action="store_true")
  parser.add_argument("--packets", action="store_true")
  parser.add_argument("--objects", action="store_true")
  args = parser.parse_args()
  payload = build_profiles() if args.samples else json.loads(DATA.read_bytes())
  if args.packets:
    report = {
      "baseline": BASE,
      "core": patch_core(payload["profiles"]),
      "outer": patch_outer(payload["profiles"]),
    }
    (ROOT / "geo_data/regierungsviertel/park-relief-v182-audit.json").write_bytes(
      encode(report)
    )
  if args.objects:
    print(json.dumps(patch_core_objects(payload["profiles"])))


if __name__ == "__main__":
  main()
