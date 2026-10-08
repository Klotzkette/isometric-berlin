"""Step 10: bounded measured Grunewald relief, preserving source XZ geometry.

Only prepare private replacement packets; publication is an explicit separate
integration operation. Immutable v1.0.89 packets are the reproducible baseline.
"""

from __future__ import annotations

import argparse
import base64
import concurrent.futures
import gzip
import hashlib
import json
import math
import subprocess
import zipfile
from functools import lru_cache
from pathlib import Path

import geopandas as gpd
import numpy as np
import requests
from build_surrounding_outlines import navigation_polygons, source_identity, world
from build_weinberg_dgm_samples import BASE_URL, tile_code
from shapely import STRtree, make_valid
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/grunewald-v190"
DATA = ROOT / "src/app/src/data/grunewaldTerrainV190.json"
EVIDENCE = GEO / "grunewald-terrain-v190.json"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
BASE = "v1.0.89"
STEP = 32
FADE = 128
LAKES = ("Krumme Lanke", "Schlachtensee", "Grunewaldsee", "Hundekehlesee", "Teufelssee")


def encode(value: object) -> bytes:
  return (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()


def read_receipt() -> dict:
  receipt = json.loads((GEO / "grunewald-v190-packet-audit.json").read_bytes())
  if "details" in receipt:
    raw = (GEO / receipt["details"]["url"]).read_bytes()
    if hashlib.sha256(raw).hexdigest() != receipt["details"]["sha256"]:
      raise ValueError("Grunewald audit detail hash mismatch")
    receipt.update(json.loads(gzip.decompress(raw)))
  return receipt


def write_receipt(receipt: dict) -> None:
  receipt = dict(receipt)
  details = {key: receipt.pop(key) for key in ("packets", "parentOffsets")}
  raw = encode(details)
  compressed = gzip.compress(raw, compresslevel=9, mtime=0)
  if len(compressed) > 5 * 1024 * 1024:
    raise ValueError("Detailed audit exceeds derived artifact budget")
  path = GEO / "grunewald-v190-packet-details.json.gz"
  path.write_bytes(compressed)
  receipt["details"] = {
    "url": path.name,
    "bytes": len(compressed),
    "decodedBytes": len(raw),
    "sha256": hashlib.sha256(compressed).hexdigest(),
  }
  (GEO / "grunewald-v190-packet-audit.json").write_bytes(encode(receipt))


def without_hero_ink(lines: dict, origin: list, heroes) -> tuple[dict, list]:
  """Only discard the obsolete elevated ink of the exact substituted owners."""
  positions = np.frombuffer(base64.b64decode(lines["positions"]), dtype="<u2").reshape(
    -1, 2, 3
  )
  points = positions.astype(float) / 100 + np.asarray(origin)
  keep, removed = [], []
  for i, segment in enumerate(points):
    replaced = np.min(segment[:, 1]) > 3.2 and all(
      heroes.covers(Point(x, z)) for x, _, z in segment
    )
    (removed if replaced else keep).append(i)
  if not removed:
    return lines, removed
  result = {**lines, "positions": base64.b64encode(positions[keep].tobytes()).decode()}
  if lines.get("colors"):
    colors = np.frombuffer(base64.b64decode(lines["colors"]), dtype="u1").reshape(
      -1, 2, 3
    )
    result["colors"] = base64.b64encode(colors[keep].tobytes()).decode()
  return result, removed


def original(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def smooth(t: float) -> float:
  t = min(1.0, max(0.0, t))
  return t * t * (3 - 2 * t)


def sample_grid(profile: dict, x: float, z: float) -> float:
  west, north, east, south = profile["support"]
  if x <= west or x >= east or z <= north or z >= south:
    return 0.0
  u, v = (x - west) / profile["stepM"], (z - north) / profile["stepM"]
  ix, iz = math.floor(u), math.floor(v)
  a, b = u - ix, v - iz
  nw, ne = profile["offsets"][iz][ix : ix + 2]
  sw, se = profile["offsets"][iz + 1][ix : ix + 2]
  return (
    nw * (1 - a) + ne * (a - b) + se * b
    if a >= b
    else nw * (1 - b) + sw * (b - a) + se * a
  )


@lru_cache(maxsize=1)
def field() -> dict:
  return json.loads(DATA.read_bytes())


def offset_at(x: float, z: float, native: bool = False) -> float:
  if native:
    x, z = math.floor(x / 8) * 8 + 4, math.floor(z / 8) * 8 + 4
  profiles = field()["profiles"]
  base = sample_grid(profiles[0], x, z)
  for profile in profiles[1:]:
    west, north, east, south = profile["support"]
    if west < x < east and north < z < south:
      # Local sampling fades continuously into the same wider field.
      return sample_grid(profile, x, z)
  return base


def bank_pieces(points: np.ndarray, water: float, native: bool) -> list[np.ndarray]:
  """Retain exact bank XZ courses; match each native top to its 8 m terrace."""
  import build_weinberg_terrain_packets_v176 as terrain

  if not native:
    result = points.copy()
    result[:, 1] = [
      water if y < 0 else max(water, y + offset_at(x, z)) for x, y, z in result
    ]
    return [result]
  low, high = float(points[:, 1].min()), float(points[:, 1].max())
  result = []
  minx, minz = points[:, [0, 2]].min(axis=0)
  maxx, maxz = points[:, [0, 2]].max(axis=0)
  for iz in range(
    math.floor(minz / 8), max(math.floor(minz / 8) + 1, math.ceil(maxz / 8))
  ):
    for ix in range(
      math.floor(minx / 8), max(math.floor(minx / 8) + 1, math.ceil(maxx / 8))
    ):
      ring = points.tolist()
      for axis, edge, lower in [
        (0, ix * 8, True),
        (0, ix * 8 + 8, False),
        (2, iz * 8, True),
        (2, iz * 8 + 8, False),
      ]:
        ring = terrain._clip_axis(ring, axis, edge, lower)
      top = max(water, high + offset_at(ix * 8 + 4, iz * 8 + 4, True))
      for triangle in terrain._fan(ring):
        triangle[:, 1] = water + (triangle[:, 1] - low) / (high - low) * (top - water)
        if (
          np.linalg.norm(np.cross(triangle[1] - triangle[0], triangle[2] - triangle[0]))
          > 1e-8
        ):
          result.append(triangle)
  return result


def build_samples() -> None:
  """Retain bounded nearest-cell official measurements, not guessed hills."""
  RAW.mkdir(parents=True, exist_ok=True)
  frame = gpd.read_file(
    GEO / "raw/outskirts-v187/candidate.gpkg",
    layer="multipolygons",
    where="osm_id IN ('3410','7868401') OR name IN ('Krumme Lanke','Schlachtensee','Grunewaldsee','Hundekehlesee','Teufelssee')",
  ).to_crs(25833)
  forest_row = frame[frame.osm_id == "3410"].iloc[0]
  forest = world(unary_union([Polygon(p.exterior) for p in forest_row.geometry.geoms]))
  lakes = []
  for _, row in frame.iterrows():
    if row["name"] in LAKES and ('"water"=>"lake"' in str(row.other_tags)):
      lakes.append(
        {
          "name": row["name"],
          "sourceId": source_identity(row),
          "geometry": mapping(world(row.geometry)),
        }
      )
  museum = world(frame[frame.osm_id == "7868401"].iloc[0].geometry).buffer(30)
  area = unary_union([forest, museum, *[shape(lake["geometry"]) for lake in lakes]])
  support = [
    math.floor(area.bounds[0] / STEP) * STEP - FADE - STEP,
    math.floor(area.bounds[1] / STEP) * STEP - FADE - STEP,
    math.ceil(area.bounds[2] / STEP) * STEP + FADE + STEP,
    math.ceil(area.bounds[3] / STEP) * STEP + FADE + STEP,
  ]
  # The 128 m apron is still inside the finite already authorized outskirts.
  specs = [("Grunewald", support, STEP), ("Karlsberg", [-12288, 3904, -11648, 4576], 8)]
  codes = set()
  for _, (x0, z0, x1, z1), step in specs:
    for x in range(x0, x1 + 1, step):
      for z in range(z0, z1 + 1, step):
        codes.add(tile_code(389500 + x, 5820000 - z))

  def download(code: str) -> tuple[str, Path]:
    paths = list((GEO / "raw/dgm").glob(f"*/DGM1_{code}.zip"))
    path = paths[0] if paths else RAW / f"DGM1_{code}.zip"
    if not path.exists():
      response = requests.get(BASE_URL + path.name, timeout=120)
      response.raise_for_status()
      path.write_bytes(response.content)
    return code, path

  tiles, sources = {}, []
  with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    for code, path in pool.map(download, sorted(codes)):
      member = f"dgm1_33_{code}_2_be.xyz"
      with zipfile.ZipFile(path) as archive:
        with archive.open(member) as stream:
          values = np.loadtxt(stream, usecols=2, dtype=np.float32)
      if len(values) == 4_000_000:
        tiles[code] = values.reshape(2000, 2000)
      else:
        # Boundary tiles contain only Berlin cells. Empty outside-land cells
        # are never invented as an elevation survey.
        with zipfile.ZipFile(path) as archive:
          with archive.open(member) as stream:
            xyz = np.loadtxt(stream)
        e, n = [int(v) * 1000 for v in code.split("_")]
        grid = np.full((2000, 2000), np.nan, dtype=np.float32)
        grid[
          np.floor(xyz[:, 1] - n).astype(int), np.floor(xyz[:, 0] - e).astype(int)
        ] = xyz[:, 2]
        tiles[code] = grid
      sources.append(
        {
          "url": BASE_URL + path.name,
          "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
          "member": member,
        }
      )
      print("DGM", code, flush=True)

  def nhn(x: float, z: float) -> float:
    east, north = 389500 + x, 5820000 - z
    code = tile_code(east, north)
    a, b = [int(v) * 1000 for v in code.split("_")]
    return round(float(tiles[code][math.floor(north - b), math.floor(east - a)]), 2)

  lake_shapes = []
  for lake in lakes:
    g = shape(lake["geometry"])
    # The flat observed water surface uses the median original DGM cells inside
    # the mapped water. Shore lines themselves retain every original vertex.
    vals = [
      nhn(x, z)
      for x in np.arange(g.bounds[0], g.bounds[2], 32)
      for z in np.arange(g.bounds[1], g.bounds[3], 32)
      if g.contains(Point(x, z))
    ]
    lake["waterY"] = round(float(np.median(vals)) - 30, 2)
    lake["samples"] = len(vals)
    lake_shapes.append((g, lake["waterY"]))
  profiles = []
  for name, s, step in specs:
    values = []
    for z in range(s[1], s[3] + 1, step):
      row = []
      for x in range(s[0], s[2] + 1, step):
        p = Point(x, z)
        weight = 1.0 if area.covers(p) else smooth(1 - area.distance(p) / FADE)
        h = nhn(x, z) - 33
        for g, y in lake_shapes:
          if g.covers(p):
            h = y + 0.12 - 3
            break
        if not math.isfinite(h):
          if weight > 0.000001:
            raise ValueError(f"Missing active DGM cell at{x},{z}")
          h = 0
        value = h * weight
        if profiles:
          edge = min(x - s[0], s[2] - x, z - s[1], s[3] - z)
          w = smooth(edge / 64)
          value = sample_grid(profiles[0], x, z) * (1 - w) + value * w
        row.append(round(value, 3))
      values.append(row)
    profiles.append({"name": name, "support": s, "stepM": step, "offsets": values})
  DATA.write_bytes(
    encode(
      {
        "schemaVersion": 1,
        "datumNHN": 30,
        "baseline": 3,
        "nativeStepM": 8,
        "profiles": profiles,
      }
    )
  )
  landmarks = [("Grunewaldturm", -11966.52, 4245.25), ("Brücke-Museum", -6700, 5626)]
  field.cache_clear()
  EVIDENCE.write_bytes(
    encode(
      {
        "schemaVersion": 1,
        "source": "Geoportal Berlin ATKIS DGM1",
        "license": "dl-de/zero-2-0",
        "retrieved": "2026-10-08",
        "sources": sources,
        "forestSource": "OSM-relation-3410",
        "forestGeometry": mapping(forest),
        "lakes": lakes,
        "display": "Measured NHN minus30,32m general grid and8m Karlsberg refinement;128m smooth apron outside mapped forest/lakes. Existing XZ source courses retained. Native8m stairs; no previous terrain resolution reduced.",
        "landmarks": [
          {
            "name": n,
            "x": x,
            "z": z,
            "nhn": nhn(x, z),
            "displayY": round(3 + offset_at(x, z), 3),
          }
          for n, x, z in landmarks
        ],
      }
    )
  )
  print(
    "samples",
    DATA.stat().st_size,
    [(p["name"], max(map(max, p["offsets"]))) for p in profiles],
    flush=True,
  )


def prepare_packets(limit: int = 0, only: set[str] | None = None) -> None:
  """Move every existing layer together; stage, never mutate public assets."""
  import build_weinberg_terrain_packets_v176 as terrain

  baseline = json.loads(original(PUBLIC / "manifest.json"))
  support = box(*field()["profiles"][0]["support"])
  output = RAW / "packets"
  output.mkdir(exist_ok=True)
  selected = [d for d in baseline["chunks"] if support.intersects(box(*d["bounds"]))]

  def source_packet(d: dict, mode: str) -> tuple[bytes, dict]:
    path = PUBLIC / d[mode]["url"]
    raw = path.read_bytes()
    if hashlib.sha256(raw).hexdigest() != d[mode]["sha256"]:
      raw = original(path)
    return raw, json.loads(gzip.decompress(raw))

  # Parent anchors are reconstructed across complete neighboring packet pieces,
  # preventing seams where a building crosses a packet boundary.
  parent_parts = {}
  decoded = {}
  for d in selected:
    raw, p = source_packet(d, "drawn")
    decoded[d["id"]] = p
    ox, _, oz = p["origin"]
    for b in p["nav"]["buildings"]:
      key = b.get("partId", b["sourceId"])
      g = Polygon(
        [(x + ox, z + oz) for x, z in b["ring"]],
        [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
      )
      parent_parts.setdefault(key, []).append(make_valid(g))
  offsets = {}
  for key, parts in parent_parts.items():
    p = unary_union(parts).representative_point()
    offsets[key] = round(offset_at(p.x, p.y), 2)
  ex = json.loads((GEO / "grunewald-landmarks-v190-exclusions.geojson").read_bytes())
  hero_ids = {i for f in ex["features"] for i in f["properties"]["sourceIds"]}
  # Existing fallback owners are complete and explicitly replaced, never a
  # rectangle around nearby unrelated architecture.
  hero_shapes = [
    unary_union(parts).buffer(0.08)
    for key, parts in parent_parts.items()
    if key in hero_ids
  ]
  heroes = unary_union(hero_shapes)
  hero_nav = json.loads(
    (ROOT / "src/app/src/data/grunewaldLandmarksV190Navigation.json").read_bytes()
  )["buildings"]
  lake_evidence = json.loads(EVIDENCE.read_bytes())
  lake_evidence = lake_evidence["lakes"] + lake_evidence.get("additionalWater", [])
  lakes = [
    (shape(lake["geometry"]).buffer(0.12), lake["waterY"]) for lake in lake_evidence
  ]
  terrain.SUPPORT = field()["profiles"][0]["support"]
  terrain.STEP = STEP
  terrain.NATIVE_STEP = 8
  terrain.sample_offset = lambda x, z: offset_at(x, z)
  terrain.sample_native_offset = lambda x, z: offset_at(x, z, True)
  old_drape = terrain.drape_triangle

  def drape(points: np.ndarray, *, minecraft: bool = False) -> list:
    # 8m local field is aligned with the32m parent and requires exact local cuts.
    b = box(
      *[
        float(v)
        for v in [
          points[:, 0].min(),
          points[:, 2].min(),
          points[:, 0].max(),
          points[:, 2].max(),
        ]
      ]
    )
    near = b.intersects(box(*field()["profiles"][1]["support"]))
    terrain.STEP = 8 if near else STEP
    try:
      return old_drape(points, minecraft=minecraft)
    finally:
      terrain.STEP = STEP

  terrain.drape_triangle = drape

  def water_at(points: np.ndarray) -> float | None:
    p = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
    for g, y in lakes:
      if g.covers(p):
        return y
    return None

  def arrays(mesh: dict, origin: list) -> tuple:
    p = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
      -1, 3
    ).astype(float) / 100 + np.asarray(origin)
    i = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
    c = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
    return p, i, c

  audit = []
  descriptors = []
  for d in [d for d in selected if only is None or d["id"] in only][: limit or None]:
    has_change = False
    new_d = json.loads(json.dumps(d))
    packet_audit = []
    for mode in ("drawn", "minecraft"):
      raw, p = source_packet(d, mode)
      origin = p["origin"]
      ox, _, oz = origin
      building_shapes = []
      values = []
      for b in p["nav"]["buildings"]:
        polygon = Polygon(
          [(x + ox, z + oz) for x, z in b["ring"]],
          [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
        )
        building_shapes.append(polygon.buffer(0.1))
        values.append(offsets.get(b.get("partId", b["sourceId"]), 0))
      tree = STRtree(building_shapes)

      class Owners:
        def lookup(self, points: np.ndarray) -> float | None:
          centre = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
          for index in tree.query(centre):
            if building_shapes[index].covers(centre):
              return values[index]
          return None

      owner = Owners()
      # Native fallback blocks legitimately extend to their own voxel-cell
      # edges; replacing only the drawn polygon leaves old exterior slabs.
      active_heroes = (
        heroes
        if mode == "drawn"
        else unary_union(
          [
            Polygon(
              [(x + ox, z + oz) for x, z in b["ring"]],
              [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
            ).buffer(0.08)
            for b in p["nav"]["buildings"]
            if b["sourceId"] in hero_ids
          ]
        )
      )
      records = []
      for mi, mesh in enumerate(p["meshes"]):
        positions, indices, colors = arrays(mesh, origin)
        exact = {}
        removed = 0
        if mesh["kind"] == "outskirts-v187-forest":
          if len(indices) % 18:
            raise ValueError("Forest triangle grouping changed")
          for start in range(0, len(indices), 18):
            # The first eight triangles are exactly the retained trunk walls.
            trunk = positions[indices[start : start + 8].ravel()]
            x = (trunk[:, 0].min() + trunk[:, 0].max()) / 2
            z = (trunk[:, 2].min() + trunk[:, 2].max()) / 2
            dy = round(offset_at(x, z, mode == "minecraft"), 2)
            for tri in indices[start : start + 18]:
              exact[
                terrain.triangle_key(np.rint(positions[tri] * 100).astype(np.int64))
              ] = dy
        elif not active_heroes.is_empty and active_heroes.intersects(box(*d["bounds"])):
          keep = []
          for tri in indices:
            pts = positions[tri]
            is_ground = terrain.is_ground_triangle(mesh["kind"], pts, colors[tri])
            replaced = (
              not is_ground
              and np.min(pts[:, 1]) >= 2.999
              and all(active_heroes.covers(Point(x, z)) for x, _, z in pts)
            )
            if replaced:
              removed += 1
            else:
              keep.append(tri)
          if removed:
            mesh = {**mesh, "indices": terrain.array64(np.asarray(keep, dtype="<u4"))}
        changed, receipt = terrain.elevate_mesh(
          mesh,
          origin,
          exact,
          owner.lookup,
          minecraft=mode == "minecraft",
          water_at=water_at,
          bank_transform=bank_pieces,
        )
        receipt["replacedHeroTriangles"] = removed
        p["meshes"][mi] = changed
        records.append(receipt)
      if p.get("lines", {}).get("positions"):
        p["lines"], removed_ink = without_hero_ink(p["lines"], origin, active_heroes)
        # Use8m cuts for ink so it agrees through the locally refined hill.
        terrain.STEP = 8
        p["lines"], line_receipt = terrain.elevate_lines(p["lines"], origin, owner, {})
        terrain.STEP = STEP
        line_receipt["replacedHeroSegments"] = removed_ink
      else:
        line_receipt = {}
      p["nav"]["buildings"] = [
        b for b in p["nav"]["buildings"] if b["sourceId"] not in hero_ids
      ]
      for b in p["nav"]["buildings"]:
        dy = offsets.get(b.get("partId", b["sourceId"]), 0)
        if dy:
          b["groundOffset"] = round(b.get("groundOffset", 0) + dy, 2)
      ground = unary_union(
        [
          Polygon(
            [(x + ox, z + oz) for x, z in b["ring"]],
            [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
          )
          for b in p["nav"]["ground"]
        ]
      )
      for b in hero_nav:
        g = (
          Polygon(b["ring"], b["holes"])
          .intersection(box(*d["bounds"]))
          .intersection(ground)
        )
        if g.is_empty:
          continue
        for nav_poly in navigation_polygons(g, ox, oz):
          p["nav"]["buildings"].append(
            {
              **nav_poly,
              "sourceId": b["sourceId"],
              "partId": b["id"],
              "height": b["topY"] - 3,
              "minHeight": b["groundY"] - 3,
              "heightSource": b["heightSource"],
            }
          )
      if not terrain.fits(p):
        raise ValueError(f"Unchanged packet budget exceeded:{d['id']}:{mode}")
      data = encode(p)
      # Do not reserialize unrelated zero-offset packets merely in the support bbox.
      relevant = any(
        r.get("translatedSourceTriangles", 0)
        or r.get("drapedSourceTriangles", 0)
        or r.get("bankTriangles", 0)
        or r.get("replacedHeroTriangles", 0)
        for r in records
      )
      if not relevant:
        continue
      compressed = gzip.compress(data, mtime=0, compresslevel=9)
      path = output / d[mode]["url"]
      path.parent.mkdir(parents=True, exist_ok=True)
      path.write_bytes(compressed)
      new_d[mode].update(
        bytes=len(compressed),
        decodedBytes=len(data),
        sha256=hashlib.sha256(compressed).hexdigest(),
      )
      packet_audit.append(
        {
          "mode": mode,
          "baseSha256": hashlib.sha256(raw).hexdigest(),
          "sha256": new_d[mode]["sha256"],
          "meshes": records,
          "lines": line_receipt,
        }
      )
      has_change = True
    if has_change:
      descriptors.append(new_d)
      audit.append({"id": d["id"], "representations": packet_audit})
      # Copy the other representation if only one needed an altitude change.
      for mode in ("drawn", "minecraft"):
        dest = output / d[mode]["url"]
        if not dest.exists():
          dest.parent.mkdir(parents=True, exist_ok=True)
          dest.write_bytes(source_packet(d, mode)[0])
      print(d["id"], len(audit), flush=True)
  receipt = {
    "schemaVersion": 1,
    "baseRelease": BASE,
    "baseManifestSha256": hashlib.sha256(
      original(PUBLIC / "manifest.json")
    ).hexdigest(),
    "terrainSha256": hashlib.sha256(DATA.read_bytes()).hexdigest(),
    "replacementDescriptors": descriptors,
    "packets": audit,
    "parentOffsets": offsets,
    "policy": "All old XZ source courses, triangles, colors and identities retained; source ground triangles split at DGM planes; buildings/trees rigidly translated; exact documented hero fallback owners substituted by complete source models.",
  }
  if only is not None:
    previous = read_receipt()
    retained = [d for d in previous["replacementDescriptors"] if d["id"] not in only]
    receipt["replacementDescriptors"] = retained + descriptors
    receipt["packets"] = [d for d in previous["packets"] if d["id"] not in only] + audit
    receipt["extraDescriptors"] = [
      d
      for d in previous.get("extraDescriptors", [])
      if d["detailCompanionOf"] not in only
    ]
    receipt["splitPackets"] = [
      d for d in previous.get("splitPackets", []) if d["id"] not in only
    ]
  write_receipt(receipt)
  print("prepared", len(descriptors), "packets", flush=True)


def repair_prepared_hero_ink() -> None:
  """Upgrade already staged packets without re-running the complete DGM drape."""
  receipt = read_receipt()
  if receipt.get("extraDescriptors"):
    raise ValueError("Repair owner ink before splitting packets")
  descriptors = {d["id"]: d for d in receipt["replacementDescriptors"]}
  ex = json.loads((GEO / "grunewald-landmarks-v190-exclusions.geojson").read_bytes())
  ids = {i for f in ex["features"] for i in f["properties"]["sourceIds"]}
  for record in receipt["packets"]:
    descriptor = descriptors[record["id"]]
    for mode in record["representations"]:
      if not sum(m["replacedHeroTriangles"] for m in mode["meshes"]):
        continue
      if "replacedHeroSegments" in mode["lines"]:
        continue
      asset = descriptor[mode["mode"]]
      before = json.loads(gzip.decompress(original(PUBLIC / asset["url"])))
      ox, _, oz = before["origin"]
      heroes = unary_union(
        [
          Polygon(
            [(x + ox, z + oz) for x, z in b["ring"]],
            [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
          )
          for b in before["nav"]["buildings"]
          if b["sourceId"] in ids
        ]
      ).buffer(0.08)
      if not before.get("lines", {}).get("positions"):
        continue
      _, removed = without_hero_ink(before["lines"], before["origin"], heroes)
      line_audit = mode["lines"]
      line_audit["replacedHeroSegments"] = removed
      if not removed:
        continue
      path = RAW / "packets" / asset["url"]
      packet = json.loads(gzip.decompress(path.read_bytes()))
      lines = packet["lines"]
      positions = np.frombuffer(
        base64.b64decode(lines["positions"]), dtype="<u2"
      ).reshape(-1, 2, 3)
      kept, runs, source_index, output_index, translated = [], [], 0, 0, 0
      removed_set = set(removed)
      for start, count, kind, dy, result_count in line_audit["placementRuns"]:
        for i in range(start, start + count):
          if i not in removed_set:
            kept.extend(range(output_index, output_index + result_count))
            tail = [kind, dy, result_count]
            if runs and runs[-1][2:] == tail:
              runs[-1][1] += 1
            else:
              runs.append([source_index, 1, *tail])
            source_index += 1
            translated += int(kind == "terrain" or dy != 0)
          output_index += result_count
      assert output_index == len(positions)
      lines["positions"] = base64.b64encode(positions[kept].tobytes()).decode()
      if lines.get("colors"):
        colors = np.frombuffer(base64.b64decode(lines["colors"]), dtype="u1").reshape(
          -1, 2, 3
        )
        lines["colors"] = base64.b64encode(colors[kept].tobytes()).decode()
      line_audit.update(
        sourceSegments=source_index,
        resultSegments=len(kept),
        translatedSegments=translated,
        placementRuns=runs,
      )
      data = encode(packet)
      zipped = gzip.compress(data, compresslevel=9, mtime=0)
      path.write_bytes(zipped)
      asset.update(
        bytes=len(zipped),
        decodedBytes=len(data),
        sha256=hashlib.sha256(zipped).hexdigest(),
      )
      mode["sha256"] = asset["sha256"]
      print(
        "replaced obsolete hero ink",
        record["id"],
        mode["mode"],
        len(removed),
        flush=True,
      )
  write_receipt(receipt)


def split_prepared(only: set[str] | None = None) -> None:
  """Retain historical file ceilings using complete ordered triangle pieces."""
  from alt_mitte_v169_packets import empty_packet
  from split_alt_mitte_v169_core import split_mesh

  receipt = read_receipt()
  if receipt.get("extraDescriptors") and only is None:
    raise ValueError("Already split; reproduce --packets first")
  output = RAW / "packets"

  def packed(p: dict) -> tuple[bytes, bytes]:
    data = encode(p)
    return data, gzip.compress(data, mtime=0, compresslevel=9)

  def fits(p: dict) -> bool:
    data, zipped = packed(p)
    return len(data) < 2_600_000 and len(zipped) < 650_000

  def write(p: dict, url: str) -> dict:
    data, zipped = packed(p)
    path = output / url
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(zipped)
    return {
      "url": url,
      "bytes": len(zipped),
      "encoding": "gzip",
      "decodedBytes": len(data),
      "sha256": hashlib.sha256(zipped).hexdigest(),
    }

  extra = [
    d
    for d in receipt.get("extraDescriptors", [])
    if only is not None and d["detailCompanionOf"] not in only
  ]
  split_audit = [
    d
    for d in receipt.get("splitPackets", [])
    if only is not None and d["id"] not in only
  ]
  for descriptor in [
    d for d in receipt["replacementDescriptors"] if only is None or d["id"] in only
  ]:
    families = {}
    details = []
    for mode in ("drawn", "minecraft"):
      packet = json.loads(
        gzip.decompress((output / descriptor[mode]["url"]).read_bytes())
      )
      if fits(packet):
        families[mode] = [packet]
        continue
      pieces = []
      counts = []
      for mesh in packet["meshes"]:
        splits = split_mesh(mesh, 45_000)
        pieces.extend(splits)
        counts.append(len(splits))
      current = {**packet, "meshes": []}
      results = []
      if not fits(current):
        raise ValueError("Navigation/ink packet exceeds unchanged limits")
      for mesh in pieces:
        candidate = {**current, "meshes": [*current["meshes"], mesh]}
        if fits(candidate):
          current = candidate
        else:
          results.append(current)
          current = empty_packet(
            f"{descriptor['id']}-grunewald-v190-{len(results)}",
            descriptor["bounds"],
            packet["origin"][1],
          )
          current["meshes"] = [mesh]
          if not fits(current):
            raise ValueError("Lossless mesh piece exceeds historical limits")
      results.append(current)
      families[mode] = results
      details.append(
        {
          "mode": mode,
          "meshPieceCounts": counts,
          "packetMeshes": [len(p["meshes"]) for p in results],
          "unsplitSha256": descriptor[mode]["sha256"],
        }
      )
    if not details:
      continue
    for mode in ("drawn", "minecraft"):
      descriptor[mode] = write(families[mode][0], descriptor[mode]["url"])
    for index in range(1, max(len(families[m]) for m in families)):
      identity = f"{descriptor['id']}-grunewald-v190-{index}"
      companion = {
        "id": identity,
        "detailCompanionOf": descriptor["id"],
        "bounds": descriptor["bounds"],
      }
      for mode in ("drawn", "minecraft"):
        p = (
          families[mode][index]
          if index < len(families[mode])
          else empty_packet(
            identity, descriptor["bounds"], families[mode][0]["origin"][1]
          )
        )
        companion[mode] = write(p, f"grunewald-v190/{identity}.{mode}.json.gz")
      extra.append(companion)
    split_audit.append({"id": descriptor["id"], "representations": details})
  receipt["extraDescriptors"] = extra
  receipt["splitPackets"] = split_audit
  write_receipt(receipt)
  print(
    "lossless companions", len(extra), "split primaries", len(split_audit), flush=True
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--samples", action="store_true")
  parser.add_argument("--packets", action="store_true")
  parser.add_argument("--limit", type=int, default=0)
  parser.add_argument("--split", action="store_true")
  parser.add_argument("--repair-hero-ink", action="store_true")
  parser.add_argument("--recover-staging", action="store_true")
  args = parser.parse_args()
  if args.samples:
    build_samples()
  if args.packets:
    prepare_packets(args.limit)
  if args.recover_staging:
    receipt = read_receipt()
    changed = {
      d["id"]
      for d in receipt["replacementDescriptors"]
      if any(
        hashlib.sha256((RAW / "packets" / d[mode]["url"]).read_bytes()).hexdigest()
        != d[mode]["sha256"]
        for mode in ("drawn", "minecraft")
      )
    }
    print("restore interrupted staging", len(changed), flush=True)
    if changed:
      prepare_packets(only=changed)
  if args.repair_hero_ink:
    repair_prepared_hero_ink()
  if args.split:
    split_prepared()
