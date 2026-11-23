"""Identify only the original drawn prism roofs, walls and roof ink of four surveyed replacements.

All mesh and line indices refer to intact source bytes. Ground, navigation and
the independent Minecraft edition are outside this receipt.
"""

from __future__ import annotations

import argparse
import base64
import json
from collections import defaultdict

import numpy as np
from shapely import union_all
from shapely.geometry import LineString, Polygon

from scripts.build_windowless_buildings_v377 import (
  GEO,
  ROOT,
  bodies,
  encoded_mesh,
  entity,
  packet,
)

TARGETS = (
  "DEBE02YY400000Y3",
  "DEBE09YYP00031P3",
  "DEBE11YYI00001Lx",
  "DEBE02AL5KH0003C",
)
OUT = ROOT / "src/app/src/data/surveyedShellRetirementsV377.json"
TOL = (
  0.018  # draw and nav use independent centimetre quantization of the original doubles.
)


def fnv(words):
  h = 2166136261
  for word in words:
    for c in word.encode("ascii"):
      h = ((h ^ c) * 16777619) & 0xFFFFFFFF
  return h


def colour(srgb):
  return np.rint(((np.array(srgb) / 255 + 0.055) / 1.055) ** 2.4 * 255).astype("u1")


WALL = colour([211, 208, 195])
ROOF = colour([157, 151, 140])
INK = colour([80, 80, 74])


def source_boundary(b, origin):
  rings = []
  for coords in [b["ring"], *b["holes"]]:
    world = [(round(x + origin[0], 3), round(z + origin[2], 3)) for x, z in coords]
    if len(world) > 2:
      rings.append(LineString(world + [world[0]]))
  return union_all(rings)


def select_tile(tile, target, family="drawn"):
  raw = packet(tile, family)
  origin = np.array(raw["origin"])
  rows, _ = bodies(tile, family)
  parts = [(b, p, lo, hi) for b, p, lo, hi in rows if entity(b) == target]
  levels = {(round(lo, 3), round(hi, 3)) for _, _, lo, hi in parts}
  if len(levels) != 1:
    raise ValueError((tile, target, "ambiguous heights"))
  low, high = levels.pop()
  outline = union_all([p for _, p, _, _ in parts], grid_size=0.001)
  edge = union_all([source_boundary(b, origin) for b, _, _, _ in parts])
  edge_band = edge.buffer(TOL)
  roof_band = outline.buffer(TOL)
  competitors = [
    (entity(b), p, p.boundary.buffer(TOL), lo, hi)
    for b, p, lo, hi in rows
    if entity(b) != target
    and abs(hi - high) < 0.011
    and not p.is_empty
    and p.intersects(roof_band)
  ]
  footprint_area = 0.0
  wall_edge_lengths = defaultdict(int)
  records = []
  stats = defaultdict(int)
  for meshno, mesh in enumerate(raw["meshes"]):
    if mesh["kind"] != "city":
      continue
    pos, idx = encoded_mesh(mesh)
    rgb = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    vertices = pos[idx].astype(float) / 100 + origin
    hues = rgb[idx]
    ys = vertices[:, :, 1]
    roofs = np.all(hues == ROOF, axis=(1, 2)) & np.all(
      np.abs(ys - high) < 0.011, axis=1
    )
    walls = (
      np.all(hues == WALL, axis=(1, 2))
      & (np.abs(ys.min(axis=1) - low) < 0.011)
      & (np.abs(ys.max(axis=1) - high) < 0.011)
    )
    take = []
    for ordinal in np.flatnonzero(roofs | walls):
      xz = vertices[ordinal][:, [0, 2]]
      if roofs[ordinal]:
        patch = Polygon(xz)
        if patch.area < 1e-8 or not roof_band.covers(patch):
          continue
        if any(p.buffer(TOL).covers(patch) for _, p, _, _, _ in competitors):
          raise ValueError((target, tile, "roof shared with another source", ordinal))
        footprint_area += patch.area
        stats["roofTriangles"] += 1
      else:
        pts = np.unique(xz, axis=0)
        if len(pts) != 2:
          continue
        cut = LineString(pts)
        if not edge_band.covers(cut):
          continue
        if any(
          abs(lo - low) < 0.011 and boundary.covers(cut)
          for _, _, boundary, lo, _ in competitors
        ):
          raise ValueError((target, tile, "wall shared with another source", ordinal))
        wall_edge_lengths[tuple(pts.flatten().tolist())] += 1
        stats["wallTriangles"] += 1
      take.append(int(ordinal))
    if take:
      records.append(
        dict(
          mesh=meshno,
          fingerprint=fnv(mesh[k] for k in ("positions", "colors", "indices")),
          triangles=take,
        )
      )
  allowance = max(0.06, outline.length * 0.009)
  if abs(footprint_area - outline.area) > allowance or not records:
    raise ValueError(
      (target, tile, "incomplete roof", footprint_area, outline.area, allowance)
    )
  # A zero-width notch can make an owner trace exactly the same nav edge
  # in both directions. Such an edge has two source quads (four triangles).
  nav_edge_counts = defaultdict(int)
  for b, _, _, _ in parts:
    for ring in [b["ring"], *b["holes"]]:
      for (x1, z1), (x2, z2) in zip(ring, ring[1:] + ring[:1]):
        ends = sorted(
          [
            (round(x1 + origin[0], 2), round(z1 + origin[2], 2)),
            (round(x2 + origin[0], 2), round(z2 + origin[2], 2)),
          ]
        )
        nav_edge_counts[tuple(ends[0] + ends[1])] += 1
  for edge_key, count in wall_edge_lengths.items():
    if (
      count != 2 and count != 2 * nav_edge_counts[tuple(round(v, 2) for v in edge_key)]
    ):
      raise ValueError(
        (
          target,
          tile,
          "wall triangle multiplicity lacks a matching source ring",
          edge_key,
          count,
        )
      )
  # Original builder omitted 2 cm next to tile seams. Require every remaining
  # source roof edge to belong to the pair of wall triangles or adjacent source cut.
  actual_edges = union_all(
    [LineString([coords[:2], coords[2:]]) for coords in wall_edge_lengths]
  )
  lines = raw.get("lines", {})
  segs = []
  if lines.get("positions"):
    lines_xyz = (
      np.frombuffer(base64.b64decode(lines["positions"]), "<u2")
      .reshape(-1, 2, 3)
      .astype(float)
      / 100
      + origin
    )
    colors = np.frombuffer(base64.b64decode(lines["colors"]), "u1").reshape(-1, 2, 3)
    possible = np.all(colors == INK, axis=(1, 2)) & np.all(
      abs(lines_xyz[:, :, 1] - (high + 0.02)) < 0.011, axis=1
    )
    for ordinal in np.flatnonzero(possible):
      line = LineString(lines_xyz[ordinal][:, [0, 2]])
      if not edge_band.covers(line):
        continue
      if any(boundary.covers(line) for _, _, boundary, _, _ in competitors):
        raise ValueError((target, tile, "ambiguous existing ink", ordinal))
      if line.length > 0.04 and not actual_edges.buffer(TOL).covers(line):
        raise ValueError(
          (
            target,
            tile,
            "source roof ink without matching source wall",
            ordinal,
            line.wkt,
          )
        )
      segs.append(int(ordinal))
  stats["inkSegments"] = len(segs)
  stats["roofDriftM2"] = round(footprint_area - outline.area, 4)
  return dict(
    origin=origin.tolist(),
    records=records,
    lineFingerprint=fnv([lines["positions"], lines.get("colors", "")])
    if segs
    else None,
    segments=segs,
    owners=[target],
  ), stats


def build():
  rank = json.loads((GEO / "windowless-buildings-v377.json").read_bytes())["targets"]
  by_owner = {t["id"]: t for t in rank}
  result = {}
  for owner in TARGETS:
    for tile in by_owner[owner]["tiles"]:
      if tile in result:
        raise ValueError(f"Overlapping replacement packet {tile}")
      result[tile], stats = select_tile(tile, owner)
      print(tile, owner, dict(stats))
  return (
    json.dumps(dict(packets=dict(sorted(result.items()))), separators=(",", ":")) + "\n"
  ).encode()


if __name__ == "__main__":
  arg = argparse.ArgumentParser(description=__doc__)
  arg.add_argument("--check", action="store_true")
  options = arg.parse_args()
  raw = build()
  if options.check:
    if OUT.read_bytes() != raw:
      raise ValueError("Retirement evidence changed")
  else:
    OUT.write_bytes(raw)
