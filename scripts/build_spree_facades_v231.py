"""Source-bound public street facades; never change retained packets or bodies."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
import numpy as np
from alt_mitte_v169_packets import pack_detail
from build_alt_mitte_appearance_v213 import fingerprint, linear
from build_alt_mitte_v169 import APPEARANCE, facade, footprint, isometric_shading, model
from build_concert_halls_v160 import normal_of
from build_karl_marx_allee_v161 import Detail, mesh_signature, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from shapely.affinity import affine_transform
from shapely.geometry import Point
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "geo_data/regierungsviertel/alt-mitte-v169"
DATA = ROOT / "src/app/src/data"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
CUSTOM = {
  "bastian": (
    "DEBE01YYK00004xe",
    [230, 222, 204],
    [
      ("DEBE3DTkMKeX7A6E", 0, "bastian-front"),
      ("DEBE3DxDv26ftXw2", 12, "bastian-east"),
      ("DEBE3DxDv26ftXw2", 10, "bastian-attic"),
      ("DEBE3DMMT4E0uldC", 5, "bastian-return"),
    ],
  ),
  "magnus": (
    "DEBE01YYK00002tK",
    [231, 200, 139],
    [
      ("DEBE3DPiF2Isllcm", 7, "magnus-wing"),
      ("DEBE3DUEc72OEygj", 6, "magnus-center"),
      ("DEBE3DTlq8KxWBni", 10, "magnus-wing"),
      ("DEBE3DiL8xtoIbdH", 3, "magnus-extension"),
    ],
  ),
  "simon": (
    "DEBE01YYK0000FRf",
    [150, 81, 68],
    [("DEBE3DS04YzH9aIk", 9, "simon-front")],
  ),
}
ORDINARY = [
  "DEBE01YYK0000B8z",
  "DEBE01YYK0000Efi",
  "DEBE01YYK0000EST",
  "DEBE01YYK0000ADc",
  "DEBE01YYK00006OF",
  "DEBE01YYK0000DqK",
  "DEBE01YYK00002WR",
  "DEBE01YYK00009Dk",
  "DEBE01YYK0000E5J",
  "DEBE01YYK00007jl",
  "DEBE01YYK0000EPr",
  "DEBE01YYK0000AIh",
]
NAMES = {
  "Am Kupfergraben",
  "Burgstraße",
  "Monbijouplatz",
  "Georgenstraße",
  "Anna-Louisa-Karsch-Straße",
}


def read(path):
  return json.loads(
    gzip.decompress(path.read_bytes()) if path.suffix == ".gz" else path.read_bytes()
  )


def digest(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def decode(mesh):
  p = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  idx = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  v = np.column_stack((p, c))
  sig = [b"".join(sorted(q.tobytes() for q in t)) for t in v[idx]]
  return p, c, idx, sig


def build():
  files = [
    SRC / f
    for f in [
      "source-390_5820-00.json.gz",
      "source-391_5820-00.json.gz",
      "source-391_5819-00.json.gz",
    ]
  ]
  rows = [r for f in files for r in read(f)["buildings"]]
  by_id = {r["id"]: r for r in rows}
  baseline_file = SRC / "appearance-baseline.json.gz"
  baseline = read(baseline_file)
  APPEARANCE.clear()
  ranks = {}
  for previous in baseline["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  selected = [by_id[x] for x in ORDINARY] + [by_id[v[0]] for v in CUSTOM.values()]
  region = unary_union([footprint(r) for r in selected]).buffer(5)
  occupied = unary_union(
    [footprint(r) for r in rows if footprint(r).intersects(region)]
  )
  roads_file = ROOT / "geo_data/regierungsviertel/osm.gpkg"
  roads_df = gpd.read_file(roads_file, layer="roads")
  roads = [
    (
      str(r["name"]),
      str(r["id"]),
      affine_transform(r.geometry, [1, 0, 0, -1, -389500, 5820000]),
    )
    for _, r in roads_df[roads_df.name.isin(NAMES)].iterrows()
  ]
  sites, old = [], Detail()
  native_models = {}
  drawn_models = {}
  for site, (owner, color, selectors) in CUSTOM.items():
    row = by_id[owner]
    walls = []
    for part_id, index, role in selectors:
      part = next(p for p in row["parts"] if p["id"] == part_id)
      s = part["surfaces"][index]
      wall = anchor(s, part, occupied, False)
      assert wall, (site, part_id, index)
      wall.update(part=part_id, surface=index, role=role)
      walls.append(wall)
      old.triangles.extend(
        facade(s["rings"], part["groundY"], part["topY"], occupied).triangles
      )
    sites.append(dict(id=site, owner=owner, color=color, walls=walls))
    shell, front, _, _ = model(row, occupied)
    full = Detail()
    full.triangles = shell.triangles + front.triangles
    native_models[site] = merge_native_faces(native_detail(full))
    drawn_models[site] = isometric_shading(shell)
  for owner in ORDINARY:
    row = by_id[owner]
    candidates = []
    for part in row["parts"]:
      for index, s in enumerate(part["surfaces"]):
        if s["kind"] != "WallSurface":
          continue
        wall = anchor(s, part, occupied)
        if not wall or wall["base"] > part["groundY"] + 0.1:
          continue
        a, b = wall["a"], wall["b"]
        mid = Point((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        road = min(roads, key=lambda r: r[2].distance(mid))
        if road[2].distance(mid) > 18:
          continue
        nearest = road[2].interpolate(road[2].project(mid))
        if (nearest.x - mid.x) * wall["normal"][0] + (nearest.y - mid.y) * wall[
          "normal"
        ][1] < 1:
          continue
        panes = facade(s["rings"], part["groundY"], part["topY"], occupied)
        glass = [t for t, _, role in panes.triangles if role == "window glazing"]
        if not glass:
          continue
        # Exact previous window centres; no competing opening grid.
        centers = []
        for i in range(0, len(glass), 2):
          pts = np.array(glass[i] + glass[i + 1])
          q = (pts.min(axis=0) + pts.max(axis=0)) / 2
          u = (q[0] - a[0]) * wall["tangent"][0] + (q[2] - a[1]) * wall["tangent"][1]
          centers.append([round(float(u), 4), round(float(q[1]), 4)])
        wall.update(
          part=part["id"],
          surface=index,
          role="existing-rhythm",
          panes=centers,
          road=road[0],
          roadId=road[1],
        )
        candidates.append(wall)
    candidates.sort(key=lambda w: -w["length"])
    assert candidates, owner
    sites.append(
      dict(id=owner, owner=owner, color=[206, 200, 183], walls=candidates[:2])
    )
  profile = dict(
    schemaVersion=1,
    sites=sites,
    policy="Measured wall endpoints/eaves and retained public-road alignment. Named openings and fine ornament are documented display estimates; ordinary front openings retain their original exact v169 centres. No occupant data.",
  )
  # Exact source/colour triangle receipts for the nine replaced drawn wall recipes.
  expected_by_tile = {}
  for ix in range(2, 4):
    for iz in range(-1, 1):
      tile = f"{ix}_{iz}"
      bounds = (ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512)
      expected = mesh_signature({"meshes": pack_detail(isometric_shading(old), bounds)})
      if expected:
        expected_by_tile[tile] = expected
  records = []
  evidence = {f.relative_to(ROOT).as_posix(): digest(f) for f in files}
  evidence[baseline_file.relative_to(ROOT).as_posix()] = digest(baseline_file)
  drawn_count = 0
  for tile, expected in expected_by_tile.items():
    remaining = expected.copy()
    for path in sorted(PUBLIC.glob(tile + "*.drawn.json.gz")):
      packet = read(path)
      if (
        packet["origin"][0] != int(tile.split("_")[0]) * 512
        or packet["origin"][2] != int(tile.split("_")[1]) * 512
      ):
        continue
      for mesh in packet["meshes"]:
        if mesh["kind"] != "alt-mitte-v169":
          continue
        _, _, _, signatures = decode(mesh)
        indices = []
        for i, sig in enumerate(signatures):
          if remaining[sig] > 0:
            indices.append(i)
            remaining[sig] -= 1
        if indices:
          records.append(
            dict(
              tile=packet["id"],
              kind=mesh["kind"],
              mode="drawn",
              fingerprint=fingerprint(mesh),
              triangles=indices,
            )
          )
          evidence[path.relative_to(ROOT).as_posix()] = digest(path)
          drawn_count += len(indices)
    assert not +remaining, (tile, sum(remaining.values()))
  # Complete native owner signatures establish provenance before face selection.
  native_appearance = dict(schemaVersion=1, palette=[], packets={})
  palette_lookup = {}
  native_count = 0
  native_faces = {s["id"]: 0 for s in sites[:3]}
  for mode_spec in [
    ("minecraft", "altMitteNativeV169Data.ts", "altMitteV169Native", native_models),
    ("drawn", "altMitteDrawnV169Data.ts", "altMitteV169Drawn", drawn_models),
  ]:
    # The generated TS imports are the immutable packet-to-identity mapping.
    import re

    mode, source_name, folder, models = mode_spec
    mapping = re.findall(
      r'\{id:"([^"]+)",packet:p(\d+)\}', (DATA / source_name).read_text()
    )
    for identity, number in mapping:
      spatial = identity.split("-piece")[0]
      if spatial not in expected_by_tile:
        continue
      path = DATA / folder / f"packet-{int(number):03d}.json"
      packet = read(path)
      bounds = (
        packet["origin"][0],
        packet["origin"][2],
        packet["origin"][0] + 512,
        packet["origin"][2] + 512,
      )
      sigsets = {
        name: set(
          mesh_signature(
            {"meshes": pack_detail(d, bounds, origin_y=packet["origin"][1])}
          )
        )
        for name, d in models.items()
      }
      for mi, mesh in enumerate(packet["meshes"]):
        p, _, indices, sigs = decode(mesh)
        world = p.astype(float) / 100 + np.array(packet["origin"])
        selected_vertices = {}
        rejected = set()
        for tri, sig in zip(indices, sigs):
          points = world[tri]
          n = np.cross(points[1] - points[0], points[2] - points[0])
          mag = np.linalg.norm(n)
          if mag < 1e-8 or abs(n[1]) > 1e-8:
            rejected.update(map(int, tri))
            continue
          n = n / mag
          mid = points.mean(axis=0)
          matched = None
          for site in sites[:3]:
            if sig not in sigsets[site["id"]]:
              continue
            if site_face_contains(site["walls"], points, n, mode == "minecraft"):
              matched = site
            if matched:
              break
          if matched:
            rgb = linear(tuple(matched["color"]))
            tone = rgb[0] * 65536 + rgb[1] * 256 + rgb[2]
            for v in tri:
              selected_vertices[int(v)] = tone
            if mode == "minecraft":
              native_faces[matched["id"]] += 1
          else:
            rejected.update(map(int, tri))
        values = {v: c for v, c in selected_vertices.items() if v not in rejected}
        if values:
          # Existing audited helper encodes a palette index per contiguous vertex run.
          palette = native_appearance["palette"]
          look = palette_lookup
          runs = []
          last = None
          for v, c in sorted(values.items()):
            if c not in look:
              look[c] = len(palette)
              palette.append(c)
            if last and last[0] + last[1] == v and last[2] == look[c]:
              last[1] += 1
            else:
              last = [v, 1, look[c]]
              runs.append(last)
          rec = dict(
            mesh=mi,
            fingerprint=fingerprint(mesh),
            runs=base64.b64encode(np.array(runs, dtype="<u4").tobytes()).decode(),
          )
          native_appearance["packets"].setdefault(
            mode + ":alt-mitte-v169-" + identity, []
          ).append(rec)
          evidence[path.relative_to(ROOT).as_posix()] = digest(path)
          native_count += len(values)
  assert all(native_faces.values()), native_faces
  ownership = dict(schemaVersion=1, records=records, appearance=native_appearance)
  audit = dict(
    schemaVersion=1,
    preserved=evidence,
    sourceOwners=[s["owner"] for s in sites],
    drawnTransferredTriangles=drawn_count,
    colourVertices=native_count,
    nativeWallTriangles=native_faces,
    bodyTrianglesRemoved=0,
    roadSourceSha256=digest(roads_file),
    policy="Exact position and original colour multisets prove native owner before vertical-face selection. Shared boundary vertices touching any other face are excluded. All source positions, indices, roofs, courtyards, navigation and packet files remain byte-identical.",
  )
  return profile, ownership, audit


def anchor(surface, part, occupied, check_exposure=True):
  if surface["kind"] != "WallSurface":
    return None
  r = surface["rings"][0]
  normal = normal_of(r)
  if abs(normal[1]) > 0.01:
    return None
  a, b = max(
    ((a, b) for a in r for b in r),
    key=lambda q: math.hypot(q[1][0] - q[0][0], q[1][2] - q[0][2]),
  )
  length = math.hypot(b[0] - a[0], b[2] - a[2])
  if length < 3:
    return None
  mid = np.array(r).mean(axis=0)
  if check_exposure and any(
    occupied.covers(Point(mid[0] + normal[0] * d, mid[2] + normal[2] * d))
    for d in (0.5, 1.5, 3)
  ):
    return None
  tangent = [(b[0] - a[0]) / length, (b[2] - a[2]) / length]
  low = min(q[1] for q in r)
  high = min((q[1] for q in r if q[1] > low + 0.2), default=low)
  if high - low < 2:
    return None
  return dict(
    a=[a[0], a[2]],
    b=[b[0], b[2]],
    normal=[float(normal[0]), float(normal[2])],
    tangent=tangent,
    length=length,
    base=low,
    eave=high,
  )


def site_face_contains(walls, points, n, native):
  margin = 2.01 if native else 0.02
  for point in points:
    found = False
    for w in walls:
      normal = np.array(w["normal"])
      along = np.array(w["tangent"])
      xz = point[[0, 2]] - np.array(w["a"])
      distance = xz @ normal
      u = xz @ along
      if (
        n[[0, 2]] @ normal > 0.25
        and -0.02 <= distance <= (2.85 if native else 0.02)
        and -margin <= u <= w["length"] + margin
        and w["base"] - margin <= point[1] <= w["eave"] + margin
      ):
        found = True
        break
    if not found:
      return False
  return True


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  result = build()
  for path, data in zip(
    [
      DATA / "spreeFacadesV231.json",
      DATA / "spreeFacadesV231Ownership.json",
      ROOT / "geo_data/regierungsviertel/spree-facades-v231-evidence.json",
    ],
    result,
  ):
    if args.check:
      assert read(path) == data, path
    else:
      path.write_text(
        json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n"
      )
  print(
    json.dumps(
      {
        k: result[2][k]
        for k in [
          "drawnTransferredTriangles",
          "colourVertices",
          "nativeWallTriangles",
        ]
      }
    )
  )
