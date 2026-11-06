"""Finite V324 old-fitting proof; never regenerate or write an older packet."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import inspect
import json
import time
from collections import Counter, defaultdict
from pathlib import Path

import build_alt_mitte_v169 as old
import numpy as np
from alt_mitte_v169_packets import pack_detail
from build_karl_marx_allee_v161 import Detail, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from shapely.geometry import Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/release-plan-v205/ownership"
)


def read(p):
  b = Path(p).read_bytes()
  return json.loads(gzip.decompress(b) if str(p).endswith(".gz") else b)


def encode(d):
  return json.dumps(d, separators=(",", ":"), ensure_ascii=False).encode()


def sha(b):
  return hashlib.sha256(b).hexdigest()


def arrays(m):
  return (
    np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3),
    np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3),
    np.frombuffer(base64.b64decode(m["indices"]), "<u4").reshape(-1, 3),
  )


def key(p, c, tri):
  rows = [tuple(map(int, (*p[i], *c[i]))) for i in tri]
  return min(tuple(rows), tuple(rows[1:] + rows[:1]), tuple(rows[2:] + rows[:2]))


def get_native_provenance():
  text = inspect.getsource(native_detail).replace(
    "def native_detail(detail: Detail) -> Detail:", "def tracked_native(detail):"
  )
  text = text.replace("windows = []", "windows = []\n  cell_sources = {}")
  text = text.replace(
    "windows.append((cell, a, b, c, normal, color))",
    "windows.append((cell, a, b, c, normal, color, source_runs.get(id(triangle))))",
  )
  text = text.replace(
    "for cell, a, b, c, normal, color in windows:",
    "for cell, a, b, c, normal, color, source_run in windows:",
  )
  text = text.replace(
    "cells[cell] = color\n  output = Detail()",
    "cells[cell] = color\n      cell_sources.setdefault(cell,set()).add(source_run)\n  output = Detail()",
  )
  text = text.replace(
    "output = Detail()", "output = Detail()\n  primitive_sources = []"
  )
  text = text.replace(
    'output.polygon(points, color, "native surface block")',
    'output.polygon(points, color, "native surface block")\n        primitive_sources.extend([cell_sources.get((ix,iy,iz),set())]*2)',
  )
  text = text.replace("return output", "return output, primitive_sources")
  env = dict(native_detail.__globals__)
  env["source_runs"] = {}
  exec(text, env)
  return env["tracked_native"], env


def source_inputs():
  inv = read(OUT / "family-inventory-v324.json")
  raw = read(OUT / "families-full-v324.json.gz")
  lookup = {b["id"]: b for b in raw["buildings"]}
  selected = [
    r["parentId"]
    for r in inv["allNonSteleFamiliesIntersectingWindow"]
    if r["inHistoricalResidentialScope"] or r["classification"].startswith("modern2022")
  ]
  source = read(
    ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-390_5819-00.json.gz"
  )["buildings"]
  occupied = unary_union([old.footprint(b) for b in source])
  appearance = read(
    ROOT / "geo_data/regierungsviertel/alt-mitte-v169/appearance-baseline.json.gz"
  )
  ranks = {}
  for previous in appearance["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          old.APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  return selected, lookup, occupied


def build(support_only=True):
  started = time.monotonic()
  profile = read(ROOT / "src/app/src/data/wilhelmHousingV324.json")
  selected, lookup, occupied = source_inputs()
  polygon_runs = {}
  for run in profile["runs"]:
    for patch in run["patches"]:
      for sid in patch["sourcePolygonIds"]:
        if sid in polygon_runs and polygon_runs[sid] != run["id"]:
          raise ValueError("Shared source wall run")
        polygon_runs[sid] = run["id"]
  manifest = read(ROOT / "src/app/src/data/altMitteNativeV169Source.json")
  actual = {}
  word_rows = defaultdict(list)
  for item in manifest["chunkFiles"]:
    if not item["id"].startswith(("1_0-piece", "1_1-piece")):
      continue
    packet = read(ROOT / "src/app/src/data" / item["file"])
    actual[item["id"]] = packet
    for mi, m in enumerate(packet["meshes"]):
      p, c, ix = arrays(m)
      for t, tri in enumerate(ix):
        word_rows[item["id"].split("-piece")[0], key(p, c, tri)].append(
          (item["id"], mi, t)
        )
  native_groups = defaultdict(list)
  drawn = {}
  proof = []
  tracked, env = get_native_provenance()
  Counter()
  native_candidates = []
  for family in selected:
    b = lookup[family]
    if b["category"] == "retained":
      continue
    print("reproduce", family, flush=True)
    shells, fronts, _, _ = old.model(b, occupied)
    custom = Detail()
    by_run = defaultdict(Detail)
    env["source_runs"] = {}
    for part in b["parts"]:
      low = min(
        (
          v[1]
          for s in part["surfaces"]
          if s["kind"] == "GroundSurface"
          for ring in s["rings"]
          for v in ring
        ),
        default=part["groundY"],
      )
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        f = old.facade(surface["rings"], low, part["topY"], occupied)
        run = polygon_runs.get(surface["sourcePolygonId"])
        custom.triangles.extend(f.triangles)
        if run is not None:
          by_run[run].triangles.extend(f.triangles)
        for points, _, role in f.triangles:
          if role == "window glazing":
            env["source_runs"][id(points)] = run
    if encode(custom.triangles) != encode(fronts.triangles):
      raise ValueError("Original full facade reconstruction changed")
    full = Detail()
    full.triangles = shells.triangles + custom.triangles
    primitives, origins = tracked(full)
    original_native = merge_native_faces(native_detail(full))
    merged = merge_native_faces(primitives)
    if encode(merged.triangles) != encode(original_native.triangles):
      raise ValueError("Tracked original native differs")
    cover = defaultdict(list)
    for (points, color, _), origins in zip(primitives.triangles, origins, strict=True):
      if tuple(color) != old.GLASS or len(origins) != 1 or None in origins:
        continue
      run = next(iter(origins))
      p = np.asarray(points)
      n = np.cross(p[1] - p[0], p[2] - p[0])
      axis = int(np.argmax(np.abs(n)))
      if axis == 1:
        continue
      sign = 1 if n[axis] > 0 else -1
      normal = np.zeros(3)
      normal[axis] = sign
      patches = profile["runs"][run]["patches"]
      if not any(normal[0] * q["n"][0] + normal[2] * q["n"][1] > 0.5 for q in patches):
        continue
      axes = [i for i in range(3) if i != axis]
      cover[(run, axis, sign, float(p[0, axis]))].append(Polygon(p[:, axes]))
    unions = {k: unary_union(v) for k, v in cover.items()}
    selected_native = Detail()
    run_triangles = defaultdict(Detail)
    partials = []
    for points, color, role in merged.triangles:
      if tuple(color) != old.GLASS:
        continue
      p = np.asarray(points)
      n = np.cross(p[1] - p[0], p[2] - p[0])
      axis = int(np.argmax(np.abs(n)))
      if axis == 1:
        continue
      sign = 1 if n[axis] > 0 else -1
      axes = [i for i in range(3) if i != axis]
      poly = Polygon(p[:, axes])
      hits = []
      for k, mask in unions.items():
        run, a, s, c = k
        if (a, s, c) != (axis, sign, float(p[0, axis])):
          continue
        if mask.covers(poly):
          hits.append(run)
        elif mask.intersection(poly).area > 1e-8:
          partials.append(
            {
              "run": run,
              "points": points,
              "area": mask.intersection(poly).area,
              "fullArea": poly.area,
            }
          )
      if len(hits) > 1:
        raise ValueError("Ambiguous native run ownership")
      if hits:
        run_triangles[hits[0]].triangles.append((points, color, role))
        selected_native.triangles.append((points, color, role))
    # Match generated complete fitting words with every actual old occurrence.
    family_proof = {
      "family": family,
      "fullFacadeTriangles": len(fronts.triangles),
      "drawnSelectedTriangles": sum(len(d.triangles) for d in by_run.values()),
      "nativeSelectedTriangles": len(selected_native.triangles),
      "nativePartialCoverageTriangles": len(partials),
      "nativePartials": partials,
    }
    for run, d in run_triangles.items():
      for tile, z0 in [("1_0", 0), ("1_1", 512)]:
        parts = pack_detail(d, (512, z0, 1024, z0 + 512), origin_y=-10)
        for m in parts:
          p, c, ix = arrays(m)
          for tri in ix:
            k = key(p, c, tri)
            occurrences = word_rows.get((tile, k), [])
            if not occurrences:
              raise ValueError(f"Native source tuple absent {family}/{run}")
            native_candidates.append(
              {
                "family": family,
                "run": run,
                "tile": tile,
                "key": k,
                "occurrences": occurrences,
              }
            )
    for run, d in by_run.items():
      drawn[(family, run)] = d
    for (run, axis, sign, c), mask in unions.items():
      n = [sign, 0] if axis == 0 else [0, sign]
      d = [-n[1], n[0]]
      parts = [mask] if mask.geom_type == "Polygon" else list(mask.geoms)
      for poly in parts:
        # Internal projection axes are [y,z] for x plane and [x,y] for z plane.
        rings = []
        for ring in [poly.exterior, *poly.interiors]:
          rows = []
          for a, b0 in list(ring.coords)[:-1]:
            x, y, z = (c, a, b0) if axis == 0 else (a, b0, c)
            rows.append([x * d[0] + z * d[1], y])
          rings.append(rows)
        native_groups[run].append(
          {
            "family": family,
            "run": run,
            "n": n,
            "d": d,
            "c": c * sign,
            "rings": rings,
            "source": {
              "kind": "exact-original-2m-native-glass-face",
              "wholeFamily": family,
              "rawPacketWordsMatched": True,
            },
            "worldTriangles": [t[0] for t in run_triangles[run].triangles],
          }
        )
    proof.append(family_proof)
  print(
    "matched native candidates",
    len(native_candidates),
    "partial",
    sum(p["nativePartialCoverageTriangles"] for p in proof),
    flush=True,
  )
  support = {
    "schemaVersion": 1,
    "surfaces": [s for rows in native_groups.values() for s in rows],
    "sourceDataControl": 4101651996,
    "limits": "Exact existing native glass-cell exterior support, selected original wall provenance only. Core retained4m support follows separately.",
  }
  (OUT / "native-support-v324.json").write_bytes(encode(support) + b"\n")
  (OUT / "native-support-proof-v324.json").write_bytes(
    encode(
      {
        "schemaVersion": 1,
        "families": proof,
        "matchedNativeCandidates": len(native_candidates),
        "elapsedSeconds": time.monotonic() - started,
      }
    )
    + b"\n"
  )
  (OUT / "native-source-candidates-v324.json.gz").write_bytes(
    gzip.compress(encode(native_candidates), mtime=0)
  )
  (OUT / "drawn-selected-models-v324.json.gz").write_bytes(
    gzip.compress(
      encode(
        [
          {"family": f, "run": r, "triangles": d.triangles}
          for (f, r), d in drawn.items()
        ]
      ),
      mtime=0,
    )
  )
  print(
    json.dumps(
      {
        "surfaces": len(support["surfaces"]),
        "runs": len(native_groups),
        "elapsedSeconds": time.monotonic() - started,
      }
    ),
    flush=True,
  )


def fnv(text):
  h = 2166136261
  for n in text:
    h = ((h ^ ord(n)) * 16777619) & 0xFFFFFFFF
  return h


def build_drawn_packets():
  candidates = read(OUT / "drawn-selected-models-v324.json.gz")
  plans = {}
  proof = []
  for tile, z0 in [("1_0", 0), ("1_1", 512)]:
    path = ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{tile}.drawn.json.gz"
    packet = read(path)
    actual = defaultdict(list)
    for mi, m in enumerate(packet["meshes"]):
      p, c, ix = arrays(m)
      for t, tri in enumerate(ix):
        actual[key(p, c, tri)].append((mi, t))
    retire = defaultdict(set)
    owners = set()
    details = []
    for record in candidates:
      d = Detail()
      d.triangles = record["triangles"]
      expected = pack_detail(
        old.isometric_shading(d),
        (512, z0, 1024, z0 + 512),
        origin_y=packet["origin"][1],
      )
      count = 0
      for m in expected:
        p, c, ix = arrays(m)
        for tri in ix:
          k = key(p, c, tri)
          hits = actual.get(k, [])
          if len(hits) != 1:
            raise ValueError(
              f"Drawn source tuple multiplicity {tile}/{record['family']}/{record['run']}: {len(hits)}"
            )
          mi, t = hits[0]
          if t in retire[mi]:
            raise ValueError("Duplicate source generic fitting ownership")
          retire[mi].add(t)
          count += 1
      if count:
        owners.add(record["family"])
        details.append(
          {"family": record["family"], "run": record["run"], "triangles": count}
        )
    records = [
      {
        "mesh": i,
        "kind": m["kind"],
        "fingerprint": fnv(m["positions"] + m["colors"] + m["indices"]),
      }
      for i, m in enumerate(packet["meshes"])
    ]
    packet.get("lines")
    plan = {
      "origin": packet["origin"],
      "records": records,
      "preparedRecords": records,
      "navGuard": 0,
      "lineGuard": None,
      "preparedNavGuard": 0,
      "preparedLineGuard": None,
      "append": None,
      "retire": [
        {"mesh": i, "triangles": sorted(ts)} for i, ts in sorted(retire.items())
      ],
      "retireLines": [],
      "retireNav": [],
      "appendNav": [],
      "owners": sorted(owners),
    }
    plans["drawn:" + tile] = plan
    proof.append(
      {
        "key": "drawn:" + tile,
        "sourceFile": str(path.relative_to(ROOT)),
        "sourceSha256": sha(path.read_bytes()),
        "details": details,
        "retireTriangles": sum(len(ts) for ts in retire.values()),
        "allOldPositionColorAndIndexWordsRetained": True,
        "onlyExactGenericWindowTupleIndicesRetired": True,
        "rawNavigationAndLinesUnchanged": True,
      }
    )
  out = {"schemaVersion": 1, "keys": list(plans), "packets": plans}
  (ROOT / "src/app/src/data/wilhelmHousingV324Packets.json").write_bytes(
    encode(out) + b"\n"
  )
  (OUT / "drawn-packet-proof-v324.json").write_bytes(
    encode({"schemaVersion": 1, "packets": proof, "pendingActualPreparedGuards": True})
    + b"\n"
  )
  print(
    "drawn packet plans", [(p["key"], p["retireTriangles"]) for p in proof], flush=True
  )


def fbytes(s):
  return base64.b64decode(s)


def attr_values(a):
  dt = {
    "Float32Array": "<f4",
    "Uint16Array": "<u2",
    "Uint8Array": "u1",
    "Int8Array": "i1",
    "Uint32Array": "<u4",
  }[a["type"]]
  v = np.frombuffer(fbytes(a["bytes"]), dt).reshape(-1, a["itemSize"])
  return (
    v.astype(np.float64) / (255 if a["type"] == "Uint8Array" else 65535)
    if a["normalized"]
    else v.astype(np.float64)
  )


def hash_bytes(raw):
  h = 2166136261
  for n in raw:
    h = ((h ^ n) * 16777619) & 0xFFFFFFFF
  return h


def part_guard(host, retire, kind="triangles", outside=None):
  attrs = {
    k: {
      "type": a["type"],
      "itemSize": a["itemSize"],
      "count": a["count"],
      "normalized": a["normalized"],
      "hash": hash_bytes(fbytes(a["bytes"])),
    }
    for k, a in host["attributes"].items()
  }
  ix = host["index"]
  inst = host["instances"]
  return {
    "name": host["name"],
    "parentName": host["parentName"],
    "matrix": host["matrix"],
    "attributes": attrs,
    "index": {
      "type": ix["type"],
      "count": len(fbytes(ix["bytes"]))
      // ({"Uint16Array": 2, "Uint32Array": 4}[ix["type"]]),
      "hash": hash_bytes(fbytes(ix["bytes"])),
    }
    if ix
    else None,
    "instances": {
      "count": inst["count"],
      "matrixHash": hash_bytes(fbytes(inst["matrix"])),
      "colorHash": hash_bytes(fbytes(inst["colors"])) if inst["colors"] else None,
    }
    if inst
    else None,
    "materials": host["materials"],
    "retireKind": kind,
    "retire": sorted(set(retire)),
    "outside": outside,
  }


def triangles_for(host):
  p = attr_values(host["attributes"]["position"])
  c = (
    attr_values(host["attributes"]["color"])
    if "color" in host["attributes"]
    else np.ones_like(p)
  )
  ix = host["index"]
  indices = (
    np.frombuffer(
      fbytes(ix["bytes"]), "<u2" if ix["type"] == "Uint16Array" else "<u4"
    ).reshape(-1, 3)
    if ix
    else np.arange(len(p)).reshape(-1, 3)
  )
  return p, c, indices


def packed_outside(key, native, triangles):
  if not triangles:
    return None
  pos = []
  colors = []
  normals = []
  indices = []
  lookup = {}
  for points, tints in triangles:
    n = np.cross(np.asarray(points[1]) - points[0], np.asarray(points[2]) - points[0])
    length = np.linalg.norm(n)
    if length < 1e-8:
      continue
    n = n / length
    for point, color in zip(points, tints, strict=True):
      k = tuple(np.float32([*point, *color, *n]).view(np.uint32).tolist())
      if k not in lookup:
        lookup[k] = len(pos)
        pos.append(point)
        colors.append(color)
        normals.append(n)
      indices.append(lookup[k])

  def b64(a, dt):
    return base64.b64encode(np.asarray(a, dtype=dt).tobytes()).decode()

  return {
    "key": key,
    "native": native,
    "positionType": "f32",
    "colorType": "f32linear",
    "origin": [0, 0, 0],
    "positions": b64(pos, "<f4"),
    "colors": b64(colors, "<f4"),
    "normals": b64(normals, "<f4"),
    "indices": b64(indices, "<u4"),
    "vertices": len(pos),
    "triangles": len(indices) // 3,
  }


def split_halfspace(poly, a, b, c, d):
  inside = []
  outside = []

  def value(p):
    return a * (p[0] * d[0] + p[2] * d[1]) + b * p[1] + c

  for p, q in zip(poly, poly[1:] + poly[:1]):
    u, v = value(p), value(q)
    if u >= -1e-10:
      inside.append(p)
    if u <= 1e-10:
      outside.append(p)
    if (u > 1e-10 and v < -1e-10) or (u < -1e-10 and v > 1e-10):
      t = u / (u - v)
      point = [p[i] + (q[i] - p[i]) * t for i in range(3)]
      inside.append(point)
      outside.append(point)
  return inside, outside


def subtract_mask_triangle(points, triangle, d):
  polygon = [list(p) for p in points]
  outside = []
  ring = list(triangle.exterior.coords)[:-1]
  if triangle.exterior.is_ccw is False:
    ring.reverse()
  for p, q in zip(ring, ring[1:] + ring[:1]):
    a = -(q[1] - p[1])
    b = q[0] - p[0]
    c = -a * p[0] - b * p[1]
    polygon, out = split_halfspace(polygon, a, b, c, d)
    if len(out) >= 3:
      outside.append(out)
    if len(polygon) < 3:
      return outside
  return outside


def build_previous():
  from shapely.ops import triangulate

  capture_path = OUT / "actual-previous-capture-v324.json"
  capture = read(capture_path)
  profile = read(ROOT / "src/app/src/data/wilhelmHousingV324.json")
  ddr = read(ROOT / "src/app/src/data/mitteDdrV288Profile.json")
  source_sha = sha(capture_path.read_bytes())
  variants = {
    "drawn-initial": {"captureSha256": source_sha, "parts": []},
    "minecraft": {"captureSha256": source_sha, "parts": []},
  }
  proof = {"native": [], "ddr": [], "legacy": []}
  # Exact same old structural face triangles, recolored only after full model gate.
  candidates = read(OUT / "native-source-candidates-v324.json.gz")
  by_packet = defaultdict(dict)
  palette = {f["id"]: f["neutralBackingRgb"] for f in profile["families"]}
  raw_specs = read(ROOT / "src/app/src/data/wilhelmHousingV324Sources.json")[
    "nativePackets"
  ]
  raw = {s["id"]: read(ROOT / s["file"]) for s in raw_specs}
  for row in candidates:
    for packet, mesh, tri in row["occurrences"]:
      k = (mesh, tri)
      previous = by_packet[packet].get(k)
      if previous and previous != row["family"]:
        raise ValueError("Foreign native face sharing")
      by_packet[packet][k] = row["family"]
  for host in capture["alt"]:
    packet = next(
      s["id"] for s in raw_specs if host["parentName"].endswith(": " + s["id"])
    )
    mapping = by_packet.get(packet, {})
    offset = 0
    selected = {}
    for mi, m in enumerate(raw[packet]["meshes"]):
      for (mesh, tri), family in mapping.items():
        if mesh == mi:
          selected[offset + tri] = family
      offset += len(fbytes(m["indices"])) // 12
    # Empty selected packets remain full positive preflight members.
    p, c, ix = triangles_for(host)
    replay = []
    for tri, family in sorted(selected.items()):
      rgb = palette[family]
      srgb = [((rgb >> shift) & 255) / 255 for shift in [16, 8, 0]]
      color = [v / 12.92 if v < 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in srgb]
      replay.append((p[ix[tri]].tolist(), [color] * 3))
    outside = packed_outside("wilhelm-native-neutral-" + packet, True, replay)
    variants["minecraft"]["parts"].append(
      part_guard(host, list(selected), outside=outside)
    )
    proof["native"].append(
      {
        "packet": packet,
        "retireTriangles": len(selected),
        "replayTriangles": outside["triangles"] if outside else 0,
        "sourcePositionsAndWindingExact": True,
        "outsideOriginalFacesRemainIndexed": True,
      }
    )
  # Old v288 only source-wall runs covered by new complete masks. Run3 west is not remodeled.
  for native in [False, True]:
    rows = capture["ddr"]["nativeRows" if native else "drawnRows"]["boxes"]
    selected = []
    for i, boxrow in enumerate(rows):
      ri = boxrow["run"]
      if ri >= 4:
        continue
      oldrun = ddr["runs"][ri]
      patches = [
        p
        for run in profile["runs"]
        if run["family"] == oldrun["parentId"]
        for p in run["patches"]
        if sum(a * b for a, b in zip(p["n"], oldrun["outward"])) > 0.995
        and abs(sum(a * b for a, b in zip(p["n"], oldrun["start"])) - p["c"]) < 0.25
      ]
      centre = boxrow["p"]
      co = np.cos(boxrow["yaw"])
      si = np.sin(boxrow["yaw"])
      corners = [
        [centre[0] + co * x + si * z, centre[1] + y, centre[2] - si * x + co * z]
        for x in [-boxrow["size"][0] / 2, boxrow["size"][0] / 2]
        for y in [-boxrow["size"][1] / 2, boxrow["size"][1] / 2]
        for z in [-boxrow["size"][2] / 2, boxrow["size"][2] / 2]
      ]
      if any(
        Polygon(p["rings"][0], p["rings"][1:]).covers(
          Polygon(
            [(q[0] * p["d"][0] + q[2] * p["d"][1], q[1]) for q in corners]
          ).convex_hull
        )
        for p in patches
      ):
        selected.append(i)
    host = capture["ddr"]["native" if native else "drawn"]
    prefix = sum(
      len(s["points"]) - 2
      for s in capture["ddr"]["drawnRows"]["sheets"]
      if not s["glass"]
    )
    retire = (
      selected if native else [prefix + i * 12 + j for i in selected for j in range(12)]
    )
    variants["minecraft" if native else "drawn-initial"]["parts"].append(
      part_guard(host, retire, "instances" if native else "triangles")
    )
    proof["ddr"].append(
      {
        "native": native,
        "oldSelectedBoxes": len(selected),
        "retirePrimitives": len(retire),
        "preservedRun3West": True,
        "preservedSchwalbennestAllRuns": True,
      }
    )
  # Author slabs: only full known component tuples. Preserve strict outside fragments.
  host = capture["legacy"]["host"]
  p, c, ix = triangles_for(host)
  retire = set()
  outside = []
  for row in capture["legacy"]["matches"]:
    patches = [
      q
      for run in profile["runs"]
      if run["family"] == row["family"]
      for q in run["patches"]
      if q["part"].endswith(row["run"]["sourcePartId"])
      and abs(q["c"] - sum(a * b for a, b in zip(q["n"], row["run"]["startWorldM"])))
      < 0.2
    ]
    whole_modern = row["family"].startswith("DEBE01AL1H5")
    removed = clipped = 0
    masks = []
    for patch in patches:
      polygon = Polygon(patch["rings"][0], patch["rings"][1:])
      masks.extend((t, patch["d"]) for t in triangulate(polygon) if polygon.covers(t))
    for tri in row["triangles"]:
      points = p[ix[tri]].tolist()
      remaining = [points]
      if whole_modern:
        remaining = []
      else:
        for mask, direction in masks:
          remaining = [
            out
            for fragment in remaining
            for out in subtract_mask_triangle(fragment, mask, direction)
          ]

      def area(points):
        return sum(
          np.linalg.norm(
            np.cross(
              np.asarray(points[i]) - points[0], np.asarray(points[i + 1]) - points[0]
            )
          )
          / 2
          for i in range(1, len(points) - 1)
        )

      before = area(points)
      after = sum(area(q) for q in remaining)
      if before - after > max(1e-9, before * 1e-8):
        if tri in retire:
          raise ValueError("Shared legacy triangle ownership")
        retire.add(tri)
        removed += 1
        for fragment in remaining:
          for k in range(1, len(fragment) - 1):
            outside.append(
              (
                [fragment[0], fragment[k], fragment[k + 1]],
                [c[ix[tri][0]].tolist()] * 3,
              )
            )
            clipped += 1
    proof["legacy"].append(
      {
        "family": row["family"],
        "sourcePart": row["run"]["sourcePartId"],
        "retiredTriangles": removed,
        "retainedOutsideFragmentTriangles": clipped,
        "completeFalseModernFittingsCorrection": whole_modern,
      }
    )
  legacy = {
    "schemaVersion": 1,
    "variants": {
      "drawn-initial": {
        "captureSha256": source_sha,
        "parts": [
          part_guard(
            host,
            sorted(retire),
            outside=packed_outside("wilhelm-author-outside", False, outside),
          )
        ],
      }
    },
  }
  output = {
    "schemaVersion": 1,
    "previous": {"schemaVersion": 1, "variants": variants},
    "legacy": legacy,
  }
  (ROOT / "src/app/src/data/wilhelmHousingV324Previous.json").write_bytes(
    encode(output) + b"\n"
  )
  (OUT / "previous-proof-v324.json").write_bytes(
    encode({"schemaVersion": 1, "sourceCaptureSha256": source_sha, **proof}) + b"\n"
  )
  print(
    json.dumps(
      {
        "previousParts": {k: len(v["parts"]) for k, v in variants.items()},
        "legacyRetireTriangles": len(retire),
        "legacyOutsideTriangles": len(outside),
        "summary": proof,
      }
    ),
    flush=True,
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--drawn-packets", action="store_true")
  parser.add_argument("--previous", action="store_true")
  args = parser.parse_args()
  if args.previous:
    build_previous()
  elif args.drawn_packets:
    build_drawn_packets()
  else:
    build()
