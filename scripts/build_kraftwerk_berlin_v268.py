"""Step 10: exact Kraftwerk facade correction and mapped HKW skyline additions."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import re
from collections import Counter
from pathlib import Path

import numpy as np
import pyogrio
from alt_mitte_v169_packets import pack_detail
from build_alt_mitte_v169 import APPEARANCE, footprint, isometric_shading, model
from build_breitscheid_towers_v161 import triangles_for
from build_euref_v262 import fingerprint, json_for_js, mesh_fingerprint
from build_feuerwache_kreuzberg_v267 import frame
from build_karl_marx_allee_v161 import Detail, mesh_signature, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from build_surrounding_outlines import PackedMesh, navigation_polygons
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OUT = ROOT / "src/app/src/data/kraftwerkBerlinV268.json"
EVIDENCE = GEO / "kraftwerk-berlin-v268-evidence.json.gz"
OWNER = "DEBE01YYK00002yj"
HKW = ["DEBE01YYK00007Fz", "DEBE01YYK00007Vq", "DEBE01YYK0000AOd", "DEBE01YYK00008nb"]
KIND = "kraftwerk-berlin-v268"
BOUNDS = [3072, 512, 3584, 1024]
METAL = (151, 149, 138)
DARK = (58, 62, 61)
LIGHT = (187, 186, 173)
GLASS = (75, 91, 91)


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, data: dict) -> None:
  raw = (json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def arrays(mesh: dict) -> tuple:
  p = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
  c = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  i = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return p, c, i


def exact_receipt(packet: dict, removed: list[dict]) -> list[dict]:
  """Find only complete position+colour triangles from reconstructed old recipes."""
  wanted = mesh_signature({"meshes": removed})
  total = sum(wanted.values())
  result = []
  for mi, m in enumerate(packet["meshes"]):
    if m["kind"] != "alt-mitte-v169":
      continue
    p, c, indices = arrays(m)
    v = np.column_stack([p, c])
    selected = []
    for ti, triangle in enumerate(v[indices]):
      key = b"".join(sorted(row.tobytes() for row in triangle))
      if wanted[key]:
        selected.append(ti)
        wanted[key] -= 1
    if selected:
      result.append(
        dict(
          mesh=mi, kind=m["kind"], fingerprint=mesh_fingerprint(m), triangles=selected
        )
      )
  assert not +wanted, ("unmatched exact old owner", sum((+wanted).values()), total)
  return result


def extract_stacks() -> list[dict]:
  """Keep the two mapped major chimneys, separately from the venue identity."""
  path = GEO / "kraftwerk-berlin-v268-context.json"
  if path.exists():
    return read(path)["stacks"]
  data = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/berlin-260929.osm.pbf",
    layer="lines",
    bbox=(13.4204, 52.5114, 13.4212, 52.5118),
  ).to_crs(25833)
  stacks = []
  for row in data.itertuples():
    if str(row.osm_id) not in {"193480704", "908097945"}:
      continue
    tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', row.other_tags))
    geometry = affine_transform(row.geometry, [1, 0, 0, -1, -389500, 5820000])
    stacks.append(
      dict(
        id="way/" + str(row.osm_id),
        height=float(tags["height"]),
        ring=[[round(x, 4), round(z, 4)] for x, z in geometry.coords[:-1]],
        tags={"man_made": row.man_made, **tags},
      )
    )
  assert len(stacks) == 2
  stacks.sort(key=lambda s: s["id"])
  write(path, dict(stacks=stacks, source="Geofabrik Berlin 2026-09-29, ODbL-1.0"))
  return stacks


def camera_checks(stacks: list[dict]) -> dict:
  """Ray-test actual adjacent packet rings/heights in both delivered families."""
  cameras = {
    "front": dict(position=[3240.5, 27, 1023.5], target=[3252, 15, 995.8]),
    "wholeSite": dict(position=[3410, 105, 715], target=[3260, 24, 970]),
  }
  for name, camera in cameras.items():
    eye = camera["position"]
    targets = [camera["target"]]
    if name == "wholeSite":
      targets += [
        [Polygon(s["ring"]).centroid.x, 85, Polygon(s["ring"]).centroid.y]
        for s in stacks
      ]
    checks = []
    for family in ["drawn", "minecraft"]:
      blockers, inside = [], []
      for tile in ["6_1", "6_2"]:
        raw = read(PUB / f"{tile}.{family}.json.gz")
        origin = raw["origin"]
        for building in raw["nav"]["buildings"]:
          poly = Polygon(
            [[x + origin[0], z + origin[2]] for x, z in building["ring"]],
            [
              [[x + origin[0], z + origin[2]] for x, z in ring]
              for ring in building["holes"]
            ],
          )
          if poly.covers(Point(eye[0], eye[2])):
            inside.append(building["sourceId"])
          if building["sourceId"] == OWNER:
            continue  # target hall itself, never an unrelated occluder
          top = (
            raw["nav"]["groundY"] + building.get("groundOffset", 0) + building["height"]
          )
          for target in targets:
            dx, dz = target[0] - eye[0], target[2] - eye[2]
            hit = poly.intersection(
              LineString([(eye[0], eye[2]), (target[0], target[2])])
            )
            if hit.is_empty:
              continue
            for g in getattr(hit, "geoms", [hit]):
              for x, z in g.coords:
                t = ((x - eye[0]) * dx + (z - eye[2]) * dz) / (dx * dx + dz * dz)
                if 0.001 < t < 0.999 and eye[1] + t * (target[1] - eye[1]) < top + 0.4:
                  blockers.append(building["sourceId"])
      assert not blockers and not inside, (name, family, blockers, inside)
      checks.append(
        dict(family=family, rayCount=len(targets), blockers=blockers, eyeInside=inside)
      )
    camera["checks"] = checks
  return dict(packets=["6_1", "6_2"], clearanceM=0.4, cameras=cameras)


def build() -> None:
  """Preserve complete source owners and append one bounded packet transaction."""
  source_paths = [
    GEO / f"alt-mitte-v169/source-392_{y}-00.json.gz" for y in [5818, 5819]
  ]
  records = [b for p in source_paths for b in read(p)["buildings"]]
  site = next(b for b in records if b["id"] == OWNER)
  adjacent = [b for b in records if b["id"] in HKW]
  occupied = unary_union([footprint(b) for b in records])
  appearance_path = GEO / "alt-mitte-v169/appearance-baseline.json.gz"
  ranks = {}
  APPEARANCE.clear()
  for previous in read(appearance_path)["records"]:
    for binding in previous["bindings"]:
      for p in binding["parts"]:
        rank = (p["match"] == "leaf-id", p["overlapAreaM2"])
        if rank > ranks.get(p["partId"], (False, -1)):
          APPEARANCE[p["partId"]] = previous
          ranks[p["partId"]] = rank
  shells, fronts, _, _ = model(site, occupied)
  old_full = Detail()
  old_full.triangles = shells.triangles + fronts.triangles
  old_native = merge_native_faces(native_detail(old_full))
  native_source = merge_native_faces(native_detail(shells))
  packets = {f: read(PUB / f"6_1.{f}.json.gz") for f in ["drawn", "minecraft"]}
  ground = packets["drawn"]["nav"]["groundY"]
  assert ground == packets["minecraft"]["nav"]["groundY"] == site["groundY"] == 3
  terrain_path = ROOT / "src/app/public/mesh/regierungsviertel/ground-context.json"
  terrain = read(terrain_path)
  grid, cell = terrain["grid"], terrain["cell_m"]
  assert footprint(site).bounds[0] > (grid["min_x_idx"] + grid["cols"]) * cell
  removed = {
    "drawn": pack_detail(isometric_shading(fronts), BOUNDS),
    "minecraft": pack_detail(old_native, BOUNDS),
  }
  receipts = {f: exact_receipt(packets[f], removed[f]) for f in packets}
  drawn, native = PackedMesh(BOUNDS[0], BOUNDS[1]), PackedMesh(BOUNDS[0], BOUNDS[1])
  for points, colour, _ in native_source.triangles:
    native.triangle(points, colour)
  native_shell_triangles = len(native.indices) // 3
  # Native panel anchors are the actual independently rebuilt cardinal walls.
  native_walls = []
  for points, _, _ in native_source.triangles:
    p = np.asarray(points)
    n = np.cross(p[1] - p[0], p[2] - p[0])
    if abs(n[1]) > 1e-6 or np.linalg.norm(n) < 1e-6:
      continue
    n /= np.linalg.norm(n)
    axis = int(np.argmax(np.abs(n)))
    other = 2 if axis == 0 else 0
    poly = Polygon(p[:, [other, 1]])
    native_walls.append((axis, other, float(p[0, axis]), float(n[axis]), poly))
  roles = Counter()
  fittings = []

  def panel(
    surface: dict, rect: list, colour: tuple, role: str, depth: float = 0.16
  ) -> None:
    a, d, n, poly, length = frame(surface)
    mid = a + d * (length / 2)
    if footprint(site).covers(Point(mid[0] + n[0] * 0.1, mid[2] + n[2] * 0.1)):
      n = -n
    patch = poly.intersection(box(*rect))
    if patch.is_empty or patch.area < 0.001:
      return
    for g in getattr(patch, "geoms", [patch]):
      if g.geom_type != "Polygon":
        continue
      rings = [list(g.exterior.coords)[:-1]] + [
        list(r.coords)[:-1] for r in g.interiors
      ]
      wr = [
        [
          [
            float(a[0] + d[0] * u + n[0] * depth),
            y,
            float(a[2] + d[2] * u + n[2] * depth),
          ]
          for u, y in ring
        ]
        for ring in rings
      ]
      for t in triangles_for(wr):
        drawn.triangle(t, colour)
    u0, y0, u1, y1 = patch.bounds
    for axis, other, fixed, sign, wall_poly in native_walls:
      if sign * n[axis] < 0.25:
        continue
      # Project the actual cardinal wall centre onto the source facade.
      along = wall_poly.centroid.x
      u = (along - a[other]) / d[other]
      expected = a[axis] + d[axis] * u
      if not u0 - 3 <= u <= u1 + 3 or abs(fixed - expected) > 2.9:
        continue
      aa, bb = sorted([a[other] + d[other] * u0, a[other] + d[other] * u1])
      cut = wall_poly.intersection(box(aa, y0, bb, y1))
      for g in getattr(cut, "geoms", [cut]):
        if g.geom_type != "Polygon" or g.area < 0.001:
          continue
        rings = [list(g.exterior.coords)[:-1]] + [
          list(r.coords)[:-1] for r in g.interiors
        ]
        wr = []
        for ring in rings:
          points = []
          for along, y in ring:
            p = [0.0, y, 0.0]
            p[axis], p[other] = fixed + sign * depth, along
            points.append(p)
          wr.append(points)
        for t in triangles_for(wr):
          native.triangle(t, colour)
    roles[role] += 1
    fittings.append(
      dict(
        role=role, rect=rect, sourcePolygonId=surface["sourcePolygonId"], depth=depth
      )
    )

  # All long exterior hall walls and measured corner strips receive their
  # complete industrial treatment. Dimensions are reference-led estimates.
  for part in site["parts"]:
    for surface in part["surfaces"]:
      if surface["kind"] != "WallSurface":
        continue
      _, _, _, poly, length = frame(surface)
      low, high = poly.bounds[1], poly.bounds[3]
      if length < 2 or high - low < 6:
        continue
      panel(
        surface, [0, low + 0.08, length, high - 0.08], METAL, "metal screen field", 0.15
      )
      # Tall expanded-metal panels, open dark lower bays and upper lantern band.
      panel(
        surface,
        [0, low + 0.12, length, low + 4.2],
        DARK,
        "dark lower service band",
        0.17,
      )
      panel(
        surface,
        [0, high - 3.35, length, high - 0.12],
        DARK,
        "dark upper lantern band",
        0.17,
      )
      pitch = length / max(1, round(length / 5.7))
      for u in np.arange(0.1, length, pitch):
        panel(
          surface,
          [u, low + 0.1, min(u + 0.13, length), high - 0.1],
          LIGHT,
          "vertical panel seam",
          0.20,
        )
        if u + 3.2 < length:
          panel(
            surface,
            [u + 0.35, low + 0.45, min(u + pitch - 0.4, length), low + 3.9],
            GLASS,
            "recessed lower bay",
            0.19,
          )
      # Sparse shallow corrugation is geometry, not a copied perforation texture.
      for y in np.arange(low + 4.45, high - 3.5, 0.55):
        panel(
          surface,
          [0, y, length, y + 0.035],
          LIGHT,
          "metal screen horizontal relief",
          0.19,
        )
      for u in np.arange(0.55, length - 0.2, 1.45):
        panel(
          surface,
          [u, high - 3.3, u + 0.065, high - 0.15],
          METAL,
          "lantern mullion",
          0.21,
        )
      panel(
        surface, [0, high - 0.12, length, high], LIGHT, "measured parapet edge", 0.22
      )

  stacks = extract_stacks()
  stack_nav = {"drawn": [], "minecraft": []}
  # Complete measured stepped halls below are unchanged. Only the previously
  # absent major stack portions above the existing high roof are added.
  for stack in stacks:
    ring = Polygon(stack["ring"])
    bottom, top = 45.0, ground + stack["height"]
    stack["displayBottomY"], stack["displayTopY"] = bottom, top
    for a, b in zip(stack["ring"], stack["ring"][1:] + stack["ring"][:1]):
      q = [
        [a[0], bottom, a[1]],
        [b[0], bottom, b[1]],
        [b[0], top, b[1]],
        [a[0], top, a[1]],
      ]
      drawn.triangle(q[:3], (176, 174, 167))
      drawn.triangle([q[0], q[2], q[3]], (176, 174, 167))
    # Keep open flue mouths; rim is a narrow ring, not a filled roof disk.
    rim = ring.buffer(0.30, join_style="mitre").difference(
      ring.buffer(-0.30, join_style="mitre")
    )
    drawn.surface(rim, top, LIGHT)
    native_ring = unary_union(
      [
        box(x, z, x + 1, z + 1)
        for x in range(math.floor(ring.bounds[0]), math.ceil(ring.bounds[2]))
        for z in range(math.floor(ring.bounds[1]), math.ceil(ring.bounds[3]))
        if ring.covers(Point(x + 0.5, z + 0.5))
      ]
    )
    for poly in getattr(native_ring, "geoms", [native_ring]):
      r = list(poly.exterior.coords)[:-1]
      for a, b in zip(r, r[1:] + r[:1]):
        q = [
          [a[0], bottom, a[1]],
          [b[0], bottom, b[1]],
          [b[0], top, b[1]],
          [a[0], top, a[1]],
        ]
        native.triangle(q[:3], (176, 174, 167))
        native.triangle([q[0], q[2], q[3]], (176, 174, 167))
    native_rim = native_ring.difference(native_ring.buffer(-1, join_style="mitre"))
    native.surface(native_rim, top, LIGHT)
    # Collision and roof sampling share the visible rim's complete inner hole.
    # A filled footprint would create an invisible deck over the open flue.
    for family, poly in [("drawn", rim), ("minecraft", native_rim)]:
      for nav in navigation_polygons(poly, BOUNDS[0], BOUNDS[1]):
        stack_nav[family].append(
          dict(
            **nav,
            sourceId="kraftwerk-v268-" + stack["id"],
            height=top - ground,
            minHeight=bottom - ground,
            heightSource="retained OSM chimney height=100m; hollow upper stack",
          )
        )

  runtime = dict(
    schema=1,
    keys=[],
    packets={},
    profile=dict(
      owner=OWNER,
      adjacentOwners=HKW,
      sourceParts=len(site["parts"]),
      sourceSheets=sum(len(p["surfaces"]) for p in site["parts"]),
      groundY=ground,
      drawnTriangles=len(drawn.indices) // 3,
      nativeTriangles=len(native.indices) // 3,
      nativeShellTriangles=native_shell_triangles,
      roles=dict(roles),
      fullMobileIdentical=True,
      independentlyOrthogonalNative=True,
      stacks=stacks,
    ),
  )
  for family, mesh in [("drawn", drawn), ("minecraft", native)]:
    packet = packets[family]
    added = mesh.payload(KIND)
    key = family + ":6_1"
    runtime["keys"].append(key)
    runtime["packets"][key] = dict(
      origin=packet["origin"],
      records=receipts[family],
      navigationFingerprint=fingerprint([json_for_js(packet["nav"])]),
      replacement=added,
      replacementFingerprint=mesh_fingerprint(added),
      buildings=stack_nav[family],
    )
  inputs = source_paths + [
    appearance_path,
    terrain_path,
    GEO / "kraftwerk-berlin-v268-context.json",
  ]
  inputs += [PUB / f"{tile}.{f}.json.gz" for tile in ["6_1", "6_2"] for f in packets]
  evidence = dict(
    schema=1,
    policy="Only exact false v169 residential-window estimates yield; complete drawn measured sheets remain. Native complete measured source is independently reconstructed without the false window recipe. No neighbour/roof/line/ground retirement.",
    inputs=[dict(path=str(p.relative_to(ROOT)), sha256=sha(p)) for p in inputs],
    source=site,
    adjacentSources=adjacent,
    oldDrawnFacadeTriangles=len(fronts.triangles),
    oldNativeTriangles=len(old_native.triangles),
    nativeSourceTriangles=len(native_source.triangles),
    receipts=receipts,
    fittings=fittings,
    stacks=stacks,
    profile=runtime["profile"],
    cameraQA=camera_checks(stacks),
  )
  write(OUT, runtime)
  write(EVIDENCE, evidence)
  print(
    json.dumps(
      dict(
        runtimeBytes=OUT.stat().st_size,
        evidenceBytes=EVIDENCE.stat().st_size,
        triangles={
          "drawn": runtime["profile"]["drawnTriangles"],
          "native": runtime["profile"]["nativeTriangles"],
        },
        retired={f: sum(len(r["triangles"]) for r in receipts[f]) for f in packets},
      ),
      default=str,
    )
  )


if __name__ == "__main__":
  build()
