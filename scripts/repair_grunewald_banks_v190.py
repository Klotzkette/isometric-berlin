"""Refine v190 staged water without rerunning unchanged full-terrain tessellation."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import zipfile
from functools import lru_cache

import build_grunewald_terrain_v190 as g
import build_weinberg_terrain_packets_v176 as t
import geopandas as gpd
import numpy as np
from build_surrounding_outlines import source_identity, world
from build_weinberg_dgm_samples import tile_code
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union


def additional_water() -> None:
  evidence = json.loads(g.EVIDENCE.read_bytes())
  if "additionalWater" in evidence:
    return

  @lru_cache(maxsize=4)
  def tile(code):
    paths = list((g.GEO / "raw/dgm").glob(f"*/DGM1_{code}.zip"))
    path = paths[0] if paths else g.RAW / f"DGM1_{code}.zip"
    with zipfile.ZipFile(path) as archive:
      with archive.open(f"dgm1_33_{code}_2_be.xyz") as stream:
        xyz = np.loadtxt(stream)
    a, b = [int(v) * 1000 for v in code.split("_")]
    grid = np.full((2000, 2000), np.nan, dtype=np.float32)
    grid[np.floor(xyz[:, 1] - b).astype(int), np.floor(xyz[:, 0] - a).astype(int)] = (
      xyz[:, 2]
    )
    return grid

  def nhn(x, z):
    east, north = 389500 + x, 5820000 - z
    code = tile_code(east, north)
    a, b = [int(v) * 1000 for v in code.split("_")]
    return float(tile(code)[math.floor(north - b), math.floor(east - a)])

  frame = gpd.read_file(
    g.GEO / "raw/outskirts-v187/candidate.gpkg",
    layer="multipolygons",
    where="\"natural\"='water'",
  ).to_crs(25833)
  support = box(*g.field()["profiles"][0]["support"])
  known = {lake["sourceId"] for lake in evidence["lakes"]}
  added = []
  for _, row in frame.iterrows():
    identity = source_identity(row)
    if identity in known:
      continue
    geom = world(row.geometry)
    if not geom.intersects(support):
      continue
    part = geom.intersection(support)
    p = part.representative_point()
    points = [
      (x, z)
      for x in np.arange(part.bounds[0] + 8, part.bounds[2], 64)
      for z in np.arange(part.bounds[1] + 8, part.bounds[3], 64)
      if part.contains(Point(x, z)) and abs(g.offset_at(x, z)) > 0.02
    ]
    if abs(g.offset_at(p.x, p.y)) > 0.02:
      points.append((p.x, p.y))
    if not points:
      continue
    vals = [nhn(x, z) for x, z in points]
    vals = [v for v in vals if math.isfinite(v)]
    if not vals:
      raise ValueError(f"No water DGM {identity}")
    added.append(
      {
        "sourceId": identity,
        "name": row["name"] if isinstance(row["name"], str) else identity,
        "geometry": mapping(geom),
        "waterY": round(float(np.median(vals)) - 30, 2),
        "samples": len(vals),
        "sampleMethod": "Median original 1m DGM cells at 64m interior points plus representative point; only already mapped water within active relief.",
      }
    )
    print("water", identity, row["name"], added[-1]["waterY"], len(vals), flush=True)
  evidence["additionalWater"] = added
  g.EVIDENCE.write_bytes(g.encode(evidence))


def triangles(mesh):
  pos = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(-1, 3)
  col = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return pos[ix], col[ix]


def packed_mesh(template, positions, colors):
  rows = np.concatenate([positions.reshape(-1, 3), colors.reshape(-1, 3)], axis=1)
  unique, indices = np.unique(rows, axis=0, return_inverse=True)
  return {
    **template,
    "positions": t.array64(unique[:, :3].astype("<u2")),
    "colors": t.array64(unique[:, 3:].astype("u1")),
    "indices": t.array64(indices.astype("<u4")),
  }


def preserve_connected_water() -> set[str]:
  """Keep unchanged water tables across this bounded relief's external edge."""
  evidence = json.loads(g.EVIDENCE.read_bytes())
  bodies = evidence["additionalWater"]
  shapes = [shape(b["geometry"]) for b in bodies]
  support = box(*g.field()["profiles"][0]["support"])
  marked = {i for i, p in enumerate(shapes) if not support.covers(p)}
  while True:
    added = {
      i
      for i, p in enumerate(shapes)
      if any(p.distance(shapes[j]) < 0.15 for j in marked)
    } - marked
    if not added:
      break
    marked |= added
  identities = {bodies[i]["sourceId"] for i in marked}
  if all(
    bodies[i].get("displayWaterPolicy") == "retain-connected-v189-plane" for i in marked
  ):
    return identities
  levels = {i: set() for i in marked}
  counts = {i: 0 for i in marked}
  buffered = {i: shapes[i].buffer(0.12) for i in marked}
  selected = g.read_receipt()["replacementDescriptors"]
  for d in selected:
    candidates = [i for i in marked if shapes[i].intersects(box(*d["bounds"]))]
    if not candidates:
      continue
    packet = json.loads(gzip.decompress(g.original(g.PUBLIC / d["drawn"]["url"])))
    for mesh in packet["meshes"]:
      if mesh["kind"] != "city":
        continue
      vertices, _ = triangles(mesh)
      vertices = vertices.astype(float) / 100 + np.asarray(packet["origin"])
      for pts in vertices:
        if pts[:, 1].min() >= 0 or np.ptp(pts[:, 1]) > 0.001:
          continue
        centre = Point(float(pts[:, 0].mean()), float(pts[:, 2].mean()))
        for i in candidates:
          if buffered[i].covers(centre):
            levels[i].add(round(float(pts[0, 1]), 2))
            counts[i] += 1
  for i in sorted(marked):
    if len(levels[i]) != 1:
      raise ValueError(
        f"Connected water has nonuniform/missing baseline: {bodies[i]['sourceId']}:{levels[i]}"
      )
    body = bodies[i]
    body.update(
      measuredWaterY=body["waterY"],
      waterY=next(iter(levels[i])),
      baselineWaterY=next(iter(levels[i])),
      baselineRelease=g.BASE,
      baselineWaterTriangles=counts[i],
      displayWaterPolicy="retain-connected-v189-plane",
    )
    print(
      "retained connected water",
      body["sourceId"],
      body["waterY"],
      counts[i],
      flush=True,
    )
  g.EVIDENCE.write_bytes(g.encode(evidence))
  return identities


def record_connected_boundaries() -> list[dict]:
  """Record reproducible probes crossing edited/unaltered packet boundaries."""
  evidence = json.loads(g.EVIDENCE.read_bytes())
  selected = g.read_receipt()["replacementDescriptors"]
  edited = {d["id"] for d in selected}
  baseline = json.loads(g.original(g.PUBLIC / "manifest.json"))
  outside = {
    tuple(d["bounds"]): d
    for d in baseline["chunks"]
    if d["id"].startswith("outer187-")
    and d["id"] not in edited
    and not d.get("detailCompanionOf")
  }
  checks = []
  for body in evidence["additionalWater"]:
    if body.get("displayWaterPolicy") != "retain-connected-v189-plane":
      continue
    polygon = shape(body["geometry"])
    found = False
    for d in selected:
      x0, z0, x1, z1 = d["bounds"]
      here = box(x0, z0, x1, z1)
      if not here.intersects(polygon):
        continue
      width, depth = x1 - x0, z1 - z0
      for dx, dz in [(0, depth), (-width, 0), (0, -depth), (width, 0)]:
        bounds = (x0 + dx, z0 + dz, x1 + dx, z1 + dz)
        neighbour = outside.get(bounds)
        if not neighbour:
          continue
        shared = here.boundary.intersection(box(*bounds).boundary).intersection(polygon)
        segments = list(shared.geoms) if hasattr(shared, "geoms") else [shared]
        segments = [
          s for s in segments if s.geom_type == "LineString" and s.length > 20
        ]
        if not segments:
          continue
        middle = max(segments, key=lambda s: s.length).interpolate(0.5, normalized=True)
        ux, uz = dx / (width or 1), dz / (depth or 1)
        inside = [round(middle.x - ux * 0.25, 4), round(middle.y - uz * 0.25, 4)]
        beyond = [round(middle.x + ux * 0.25, 4), round(middle.y + uz * 0.25, 4)]
        if not all(polygon.covers(Point(*p)) for p in [inside, beyond]):
          continue
        checks.append(
          {
            "sourceId": body["sourceId"],
            "insidePacket": d["id"],
            "outsidePacket": neighbour["id"],
            "insidePoint": inside,
            "outsidePoint": beyond,
            "waterY": body["baselineWaterY"],
          }
        )
        found = True
        break
      if found:
        break
  evidence["connectedWaterBoundaryChecks"] = checks
  g.EVIDENCE.write_bytes(g.encode(evidence))
  return checks


def repair(connected_only: bool = False) -> None:
  additional_water()
  connected = preserve_connected_water()
  receipt = g.read_receipt()
  output = g.RAW / "packets"
  descriptors = {d["id"]: d for d in receipt["replacementDescriptors"]}
  extras = receipt.get("extraDescriptors", [])
  splits = {d["id"]: d for d in receipt.get("splitPackets", [])}
  details = {d["id"]: d for d in receipt["packets"]}
  ev = json.loads(g.EVIDENCE.read_bytes())
  waters = [
    (shape(lake["geometry"]).buffer(0.12), lake["waterY"])
    for lake in ev["lakes"] + ev["additionalWater"]
    if not connected_only or lake["sourceId"] in connected
  ]
  selected = {
    identity
    for identity, d in descriptors.items()
    if not connected_only or any(p.intersects(box(*d["bounds"])) for p, _ in waters)
  }
  ex = json.loads((g.GEO / "grunewald-landmarks-v190-exclusions.geojson").read_bytes())
  hero_ids = {i for f in ex["features"] for i in f["properties"]["sourceIds"]}
  changed_packets = 0
  for identity, d in descriptors.items():
    if identity not in selected:
      continue
    did_change = False
    for mode in ["drawn", "minecraft"]:
      path = output / d[mode]["url"]
      packet = json.loads(gzip.decompress(path.read_bytes()))
      split = next(
        (
          x
          for x in splits.get(identity, {}).get("representations", [])
          if x["mode"] == mode
        ),
        None,
      )
      if split:
        meshes = list(packet["meshes"])
        for companion in extras:
          if companion["detailCompanionOf"] == identity:
            meshes.extend(
              json.loads(
                gzip.decompress((output / companion[mode]["url"]).read_bytes())
              )["meshes"]
            )
        joined = []
        cursor = 0
        for count in split["meshPieceCounts"]:
          pieces = meshes[cursor : cursor + count]
          cursor += count
          if count == 1:
            joined.append(pieces[0])
            continue
          arrays = [triangles(m) for m in pieces]
          joined.append(
            packed_mesh(
              pieces[0],
              np.concatenate([a[0] for a in arrays]),
              np.concatenate([a[1] for a in arrays]),
            )
          )
        assert cursor == len(meshes)
        packet["meshes"] = joined
      record = next(
        (m for m in details[identity]["representations"] if m["mode"] == mode), None
      )
      if not record:
        continue
      original = json.loads(gzip.decompress(g.original(g.PUBLIC / d[mode]["url"])))
      origin = np.asarray(packet["origin"])
      ox, _, oz = origin
      heroes = unary_union(
        [
          Polygon(
            [(x + ox, z + oz) for x, z in b["ring"]],
            [[(x + ox, z + oz) for x, z in h] for h in b.get("holes", [])],
          )
          for b in json.loads(gzip.decompress(g.original(g.PUBLIC / d[mode]["url"])))[
            "nav"
          ]["buildings"]
          if b["sourceId"] in hero_ids
        ]
      ).buffer(0.08)
      changed = False
      for mi, (source, mesh, audit) in enumerate(
        zip(original["meshes"], packet["meshes"], record["meshes"], strict=True)
      ):
        if source["kind"] != "city":
          continue
        old_pos, old_col = triangles(source)
        source_world = old_pos.astype(float) / 100 + origin
        if audit.get("replacedHeroTriangles"):
          keep = [
            i
            for i, pts in enumerate(source_world)
            if not (
              not t.is_ground_triangle(source["kind"], pts, old_col[i])
              and np.min(pts[:, 1]) >= 2.999
              and all(heroes.covers(Point(x, z)) for x, _, z in pts)
            )
          ]
          source_world, old_col = source_world[keep], old_col[keep]
        assert len(source_world) == audit["sourceTriangles"]
        positions, colors = triangles(mesh)
        out_pos = []
        out_col = []
        runs = []
        cursor = 0
        modified = False
        for start, count, kind, dy, nout in audit["placementRuns"]:
          for index in range(start, start + count):
            pts = source_world[index]
            col = old_col[index]
            newkind, newdy = kind, dy
            water = None
            if np.min(pts[:, 1]) < 0 and np.max(pts[:, 1]) <= 3.001:
              centre = Point(float(pts[:, 0].mean()), float(pts[:, 2].mean()))
              water = next(
                (level for poly, level in waters if poly.covers(centre)), None
              )
            if water is not None:
              if np.ptp(pts[:, 1]) < 0.001:
                p = pts.copy()
                p[:, 1] = water
                pieces = [p]
                newkind, newdy = "rigid", round((water - pts[0, 1]) * 100)
              else:
                pieces = g.bank_pieces(pts, water, mode == "minecraft")
                newkind, newdy = "bank", 0
              coords = np.rint(
                (np.asarray(pieces).reshape(-1, 3, 3) - origin) * 100
              ).astype(np.int64)
              if coords.size and (coords.min() < 0 or coords.max() > 65535):
                raise ValueError("bank overflow")
              out_pos.append(coords.astype("<u2"))
              out_col.append(np.broadcast_to(col, coords.shape).copy())
              newcount = len(coords)
              modified = True
            else:
              out_pos.append(positions[cursor : cursor + nout])
              out_col.append(colors[cursor : cursor + nout])
              newcount = nout
            tail = [newkind, newdy, newcount]
            if runs and runs[-1][2:] == tail:
              runs[-1][1] += 1
            else:
              runs.append([index, 1, *tail])
            cursor += nout
        assert cursor == len(positions)
        if modified:
          merged = packed_mesh(mesh, np.concatenate(out_pos), np.concatenate(out_col))
          packet["meshes"][mi] = merged
          audit["placementRuns"] = runs
          audit["resultTriangles"] = sum(r[1] * r[4] for r in runs)
          audit["resultVertices"] = len(base64.b64decode(merged["positions"])) // 6
          audit["waterBankCorrection"] = (
            "Complete existing source water; native bank tops split exactly at 8m grid. No source XZ removal."
          )
          changed = True
      if changed or split:
        raw = g.encode(packet)
        zipped = gzip.compress(raw, mtime=0, compresslevel=9)
        path.write_bytes(zipped)
        d[mode].update(
          bytes=len(zipped),
          decodedBytes=len(raw),
          sha256=hashlib.sha256(zipped).hexdigest(),
        )
        record["sha256"] = d[mode]["sha256"]
        did_change = True
    if did_change:
      changed_packets += 1
      print("repaired water/rejoined", identity, changed_packets, flush=True)
  receipt["extraDescriptors"] = [
    d for d in extras if d["detailCompanionOf"] not in selected
  ]
  receipt["splitPackets"] = [d for d in splits.values() if d["id"] not in selected]
  receipt["waterCorrection"] = (
    "Five named lakes and contained existing ponds use original DGM levels; the connected Havel/Wannsee/Stoessensee component crossing this bounded relief retains its uniform v1.0.89 source plane. Native bank triangles preserve source XZ and have exact 8m stair tops."
  )
  g.write_receipt(receipt)
  g.split_prepared(only=selected)
  record_connected_boundaries()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--connected-only", action="store_true")
  repair(parser.parse_args().connected_only)
