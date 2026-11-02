"""Step 10: receipted, bounded placement of the retained Mauerpark packets.

Keep original files untouched. Emit exact offline terrain alternatives which the
decoder admits only after verifying every original byte and navigation owner.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import subprocess
import tempfile
from pathlib import Path

import build_weinberg_terrain_packets_v176 as drape
import numpy as np
from shapely import STRtree
from shapely.geometry import LineString, MultiPoint, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
PACKETS = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
FIELD = DATA / "wallGalleryV298.json"
OUT = DATA / "mauerparkTerrainV298.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/mauerpark-terrain-v298-evidence.json.gz"


def canonical(value):
  return json.dumps(
    value, ensure_ascii=False, separators=(",", ":"), allow_nan=False
  ).encode()


def fnv(text):
  value = 2166136261
  for c in text:
    value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def nav_guard(nav):
  pieces = []

  def numbers(row):
    pieces.append(",".join(str(math.floor(n * 1_000_000 + 0.5)) for n in row) + ";")

  numbers([nav["groundY"]])
  for name in ["ground", "water", "roads", "bridges", "buildings"]:
    pieces.append(name + ":")
    for p in nav.get(name, []):
      if name == "buildings":
        pieces.append(p["sourceId"] + ";")
        numbers([p["minHeight"], p["height"], p.get("groundOffset", 0)])
      for ring in [p["ring"], *p["holes"]]:
        pieces.append("[")
        for point in ring:
          numbers(point)
        pieces.append("]")
  return fnv("".join(pieces))


def build_lines(packet, sample, owner, offsets, mask, step=4):
  """Append complete raised ink, retaining every original source segment index.

  Include v276 arcs already appended by the earlier line helper. Every new
  segment keeps the old source-index parent, so retired old ink stays retired.
  """
  original = packet.get("lines")
  if not original:
    return None, None
  curve = packet.get("streetCurvesV276", {}).get("lines")
  inputs = [original] + ([curve] if curve else [])
  origin = np.array(packet["origin"])
  values = np.concatenate(
    [
      np.frombuffer(base64.b64decode(p["positions"]), dtype="<u2").reshape(-1, 2, 3)
      for p in inputs
    ]
  )
  colours = np.concatenate(
    [
      np.frombuffer(base64.b64decode(p["colors"]), dtype="u1").reshape(-1, 2, 3)
      if p.get("colors")
      else np.full((len(base64.b64decode(p["positions"])) // 12, 2, 3), 255, dtype="u1")
      for p in inputs
    ]
  )
  output = []
  tints = []
  records = []
  audit = []
  west, north, _, _ = mask.bounds
  for i, raw in enumerate(values):
    points = raw.astype(float) / 100 + origin
    if np.array_equal(raw[0], raw[1]):
      continue
    oi = owner(points)
    rigid = offsets[oi] if oi is not None else None
    flat = np.ptp(points[:, 1]) < 0.002 and abs(points[0, 1] - 3.13) < 0.003
    if not flat and rigid is None:
      continue
    if not flat and not rigid:
      continue
    if flat and not LineString(points[:, [0, 2]]).intersects(mask):
      continue
    fractions = {0.0, 1.0}
    if flat:
      delta = points[1] - points[0]
      for axis, base in [(0, west), (2, north)]:
        if abs(delta[axis]) < 1e-12:
          continue
        low, high = sorted(points[:, axis])
        for k in range(
          math.floor((low - base) / step) + 1, math.ceil((high - base) / step)
        ):
          t = (base + k * step - points[0, axis]) / delta[axis]
          if 0 < t < 1:
            fractions.add(t)
      diagonal = delta[0] - delta[2]
      if abs(diagonal) > 1e-12:
        base = west - north
        low, high = sorted(points[:, 0] - points[:, 2])
        for k in range(
          math.floor((low - base) / step) + 1, math.ceil((high - base) / step)
        ):
          t = (base + k * step - points[0, 0] + points[0, 2]) / diagonal
          if 0 < t < 1:
            fractions.add(t)
      # Preserve complete portions outside the actual polygon, not only bbox.
      crossing = LineString(points[:, [0, 2]]).intersection(mask.boundary)
      for q in (
        [crossing]
        if crossing.geom_type == "Point"
        else list(getattr(crossing, "geoms", []))
      ):
        if q.geom_type != "Point":
          continue
        d = delta[[0, 2]]
        t = float(np.dot(np.array(q.coords[0]) - points[0, [0, 2]], d) / np.dot(d, d))
        if 0 < t < 1:
          fractions.add(t)
    ts = sorted(fractions)
    path = []
    color_path = []
    for t in ts:
      q = points[0] + (points[1] - points[0]) * t
      q[1] += sample(q[0], q[2]) if flat else rigid
      path.append(np.rint((q - origin) * 100).astype(np.int64))
      color_path.append(
        np.rint(colours[i, 0] * (1 - t) + colours[i, 1] * t).astype("u1")
      )
    if len(path) == 2 and np.array_equal(np.array(path), raw):
      continue
    start = len(output)
    for j in range(len(path) - 1):
      segment = np.array(path[j : j + 2])
      if np.array_equal(segment[0], segment[1]):
        continue
      if np.any(segment < 0) or np.any(segment > 65535):
        raise ValueError("Raised ink exceeds UInt16 positions")
      output.append(segment)
      tints.append(np.array(color_path[j : j + 2]))
    count = len(output) - start
    if count:
      records.append([i, start, count])
      audit.append(
        {
          "source": i,
          "kind": "terrain" if flat else "rigid",
          "offsetCm": None if flat else round(rigid * 100),
          "segments": count,
        }
      )
  append = {"positions": drape.array64(np.asarray(output, dtype="<u2").reshape(-1, 3))}
  if original.get("colors"):
    append["colors"] = drape.array64(np.asarray(tints, dtype="u1").reshape(-1, 3))

  def pin(lines):
    return fnv(lines["positions"] + lines.get("colors", ""))

  plan = {
    "sourceVertices": len(base64.b64decode(original["positions"])) // 6,
    "sourceFingerprint": pin(original),
    "curveVertices": len(base64.b64decode(curve["positions"])) // 6 if curve else 0,
    "curveFingerprint": pin(curve) if curve else None,
    "records": records,
    "append": append,
    "appendFingerprint": pin(append),
  }
  assert len(output) * 2 <= 400000
  return plan, {
    "sourceSegments": len(values),
    "appendedSegments": len(output),
    "records": audit,
  }


def main():
  hill = json.loads(FIELD.read_bytes())["hill"]
  mask = Polygon(hill["mask"]["coordinates"][0])
  bounds = mask.bounds
  grid = np.array(hill["heights"])
  step = hill["stepM"]
  ox, oz = hill["origin"]

  def blended(x, z, baseline=3):
    p = Point(x, z)
    if not mask.contains(p):
      return 0
    u, v = (x - ox) / step, (z - oz) / step
    ix, iz = math.floor(u), math.floor(v)
    a, b = u - ix, v - iz
    raw = (grid[iz, ix] * (1 - a) + grid[iz, ix + 1] * a) * (1 - b) + (
      grid[iz + 1, ix] * (1 - a) + grid[iz + 1, ix + 1] * a
    ) * b
    t = min(1, mask.boundary.distance(p) / hill["seamWidthM"])
    y = baseline + (raw - baseline) * t * t * (3 - 2 * t)
    return y - baseline

  def sample(x, z, native=False, baseline=3):
    if native:
      x, z = math.floor(x / 4) * 4 + 2, math.floor(z / 4) * 4 + 2
      value = baseline + blended(x, z, baseline)
      return (
        math.ceil(value / 0.125) * 0.125 - baseline if mask.contains(Point(x, z)) else 0
      )
    if not mask.contains(Point(x, z)):
      return 0
    u, v = (x - bounds[0]) / 4, (z - bounds[1]) / 4
    ix, iz = math.floor(u), math.floor(v)
    a, b = u - ix, v - iz
    x0, z0 = bounds[0] + ix * 4, bounds[1] + iz * 4
    nw, ne, sw, se = [
      blended(px, pz, baseline)
      for px, pz in [(x0, z0), (x0 + 4, z0), (x0, z0 + 4), (x0 + 4, z0 + 4)]
    ]
    return (
      nw * (1 - a) + ne * (a - b) + se * b
      if a >= b
      else nw * (1 - b) + sw * (b - a) + se * a
    )

  # Existing exact triangle splitter retains the full outside complement and
  # source colour. Both clipping and navigation use the same NW/SE piecewise
  # planar 4m surface, whose unchanged raster corners are bilinear DGM samples.
  drape.SUPPORT = bounds
  drape.STEP = step
  drape.NATIVE_STEP = 4
  drape.sample_offset = lambda x, z: sample(x, z)
  drape.sample_native_offset = lambda x, z: sample(x, z, True)
  original_drape = drape.drape_triangle

  def masked_drape(points, *, minecraft=False):
    footprint = MultiPoint(points[:, [0, 2]]).convex_hull
    if not footprint.intersects(mask):
      return [points]
    return original_drape(points, minecraft=minecraft)

  drape.drape_triangle = masked_drape
  original_ground = drape.is_ground_triangle

  def source_ground(kind, points, colors):
    if kind in {"city-streets-v249", "street-curves-v276"}:
      return points[:, 1].min() >= 3.08 and points[:, 1].max() <= 3.35
    return original_ground(kind, points, colors)

  drape.is_ground_triangle = source_ground
  output, evidence = {}, []
  manifest = json.loads((PACKETS / "manifest.json").read_bytes())
  # Resolve one complete parent across adjacent tile cuts before sampling any
  # anchor. The two halves of a building must never receive different heights.
  grouped = {False: {}, True: {}}
  for descriptor in manifest["chunks"]:
    if descriptor.get("detailCompanionOf") or not box(*descriptor["bounds"]).intersects(
      mask.buffer(512)
    ):
      continue
    for native, mode in [(False, "drawn"), (True, "minecraft")]:
      p = json.loads(gzip.decompress((PACKETS / descriptor[mode]["url"]).read_bytes()))
      for b in p["nav"]["buildings"]:
        s = Polygon(
          [(x + p["origin"][0], z + p["origin"][2]) for x, z in b["ring"]],
          [
            [(x + p["origin"][0], z + p["origin"][2]) for x, z in r] for r in b["holes"]
          ],
        )
        # Repair only the temporary lookup footprint; source rings/bytes stay
        # untouched, including their recorded original topology.
        grouped[native].setdefault(b["sourceId"], []).append(
          s if s.is_valid else s.buffer(0)
        )
  owner_offsets = {native: {} for native in [False, True]}
  for native, groups in grouped.items():
    for identity, shapes in groups.items():
      p = unary_union(shapes).representative_point()
      owner_offsets[native][identity] = round(sample(p.x, p.y, native), 2)
  temporary = tempfile.TemporaryDirectory(prefix="mauerpark-v298-")
  subprocess.run(
    ["bun", "scripts/prepare-mauerpark-terrain-v298.ts", temporary.name],
    cwd=ROOT / "src/app",
    check=True,
    capture_output=True,
  )
  for descriptor in manifest["chunks"]:
    if descriptor.get("detailCompanionOf") or not box(*descriptor["bounds"]).intersects(
      mask
    ):
      continue
    key = descriptor["id"]
    for native, mode in [(False, "drawn"), (True, "minecraft")]:
      path = PACKETS / descriptor[mode]["url"]
      raw = path.read_bytes()
      packet = json.loads((Path(temporary.name) / f"{key}.{mode}.json").read_bytes())
      origin = np.array(packet["origin"])
      shapes, offsets = [], []
      for building in packet["nav"]["buildings"]:
        s = Polygon(
          [(x + origin[0], z + origin[2]) for x, z in building["ring"]],
          [[(x + origin[0], z + origin[2]) for x, z in r] for r in building["holes"]],
        )
        shapes.append(s)
        offsets.append(owner_offsets[native][building["sourceId"]])
      tree = STRtree(shapes)

      def owner(points):
        flat = points[:, [0, 2]]
        centre = Point(*flat.mean(axis=0))
        candidates = tree.query(centre.buffer(2.1 if native else 0.12))
        scored = []
        for i in candidates:
          s = shapes[int(i)]
          worst = max(s.distance(Point(*p)) for p in flat)
          if worst <= (2.1 if native else 0.12):
            scored.append(
              (
                worst,
                s.area,
                str(packet["nav"]["buildings"][int(i)]["sourceId"]),
                int(i),
              )
            )
        return min(scored)[3] if scored else None

      plans = []
      mesh_records = []
      for mi, mesh in enumerate(packet["meshes"]):
        p = (
          np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2")
          .reshape(-1, 3)
          .astype(float)
          / 100
          + origin
        )
        idx = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
          -1, 3
        )
        colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(
          -1, 3
        )
        mesh_records.append(
          {
            "mesh": mi,
            "kind": mesh["kind"],
            "fingerprint": fnv(mesh["positions"] + mesh["colors"] + mesh["indices"]),
          }
        )
        exact = {}
        unknown = []
        for ti, tri in enumerate(idx):
          points = p[tri]
          oi = owner(points)
          if oi is not None:
            exact[drape.triangle_key(np.rint(points * 100).astype(np.int64))] = offsets[
              oi
            ]
          elif not drape.is_ground_triangle(mesh["kind"], points, colors[tri]):
            unknown.append(ti)
        # Remaining non-ground components are retained small street/park props.
        # Join equal positions independently of source material, then translate
        # the whole connected body once; never sample each facade vertex.
        parent = {}

        def find(a):
          parent.setdefault(a, a)
          while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
          return a

        def union(a, b):
          a, b = find(a), find(b)
          if a != b:
            parent[b] = a

        for ti in unknown:
          keys = [tuple(np.rint(p[v] * 100).astype(int)) for v in idx[ti]]
          for q in keys[1:]:
            union(keys[0], q)
        components = {}
        for ti in unknown:
          k = find(tuple(np.rint(p[idx[ti, 0]] * 100).astype(int)))
          components.setdefault(k, []).append(ti)
        for tris in components.values():
          points = p[np.unique(idx[tris])]
          centre = (points[:, [0, 2]].min(axis=0) + points[:, [0, 2]].max(axis=0)) / 2
          dy = round(sample(*centre, native, packet["nav"]["groundY"]), 2)
          for ti in tris:
            exact[drape.triangle_key(np.rint(p[idx[ti]] * 100).astype(np.int64))] = dy
        changed, receipt = drape.elevate_mesh(
          mesh, packet["origin"], exact, lambda _: None, minecraft=native
        )
        if changed is mesh:
          continue
        changed_idx = np.frombuffer(
          base64.b64decode(changed["indices"]), dtype="<u4"
        ).reshape(-1, 3)
        changed_p = np.frombuffer(
          base64.b64decode(changed["positions"]), dtype="<u2"
        ).reshape(-1, 3)
        changed_c = np.frombuffer(
          base64.b64decode(changed["colors"]), dtype="u1"
        ).reshape(-1, 3)
        removed = []
        new_triangles = []
        cursor = 0
        for start, count, kind, dy, per_source in receipt["placementRuns"]:
          for si in range(start, start + count):
            ids = changed_idx[cursor : cursor + per_source]
            if kind != "rigid" or dy:
              removed.append(si)
              new_triangles.extend(ids)
            cursor += per_source
        assert cursor == len(changed_idx)
        used = np.unique(np.array(new_triangles).reshape(-1))
        remap = np.full(len(changed_p), -1, dtype=np.int64)
        remap[used] = np.arange(len(used))
        appended = {
          "kind": "city",
          "positionType": "u16cm",
          "positions": drape.array64(changed_p[used].astype("<u2")),
          "colors": drape.array64(changed_c[used].astype("u1")),
          "indices": drape.array64(remap[np.array(new_triangles)].astype("<u4")),
        }
        plans.append(
          {
            "mesh": mi,
            "kind": mesh["kind"],
            "fingerprint": fnv(mesh["positions"] + mesh["colors"] + mesh["indices"]),
            "remove": removed,
            "append": appended,
            "appendFingerprint": fnv(
              appended["positions"] + appended["colors"] + appended["indices"]
            ),
          }
        )
        evidence.append(
          {
            "id": key,
            "mode": mode,
            "mesh": mi,
            "kind": mesh["kind"],
            "originalPacketSha256": hashlib.sha256(raw).hexdigest(),
            "originalMeshSha256": hashlib.sha256(canonical(mesh)).hexdigest(),
            "replacementMeshSha256": hashlib.sha256(canonical(changed)).hexdigest(),
            "components": len(components),
            "receipt": receipt,
          }
        )
      if plans:
        line_plan, line_audit = (
          build_lines(packet, sample, owner, offsets, mask)
          if not native
          else (None, None)
        )
        output.setdefault(key, {})[mode] = {
          "records": mesh_records,
          "lines": line_plan,
          "origin": packet["origin"],
          "navSha256": hashlib.sha256(canonical(packet["nav"])).hexdigest(),
          "navGuard": nav_guard(packet["nav"]),
          "navOffsets": offsets,
          "parts": plans,
        }
        evidence.append({"id": key, "mode": mode, "ink": line_audit})
  OUT.write_bytes(canonical({"schemaVersion": 1, "packets": output}) + b"\n")
  EVIDENCE.write_bytes(
    gzip.compress(
      canonical(
        {
          "schemaVersion": 1,
          "fieldSha256": hashlib.sha256(FIELD.read_bytes()).hexdigest(),
          "bounds": bounds,
          "sourceFilesUnchanged": True,
          "records": evidence,
        }
      ),
      mtime=0,
    )
  )
  temporary.cleanup()
  print(
    {
      "packets": len(output),
      "runtimeBytes": OUT.stat().st_size,
      "gzipBytes": len(gzip.compress(OUT.read_bytes(), mtime=0)),
      "evidenceBytes": EVIDENCE.stat().st_size,
    }
  )


if __name__ == "__main__":
  main()
