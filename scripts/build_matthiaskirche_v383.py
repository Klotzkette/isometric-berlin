"""Fit St. Matthias' five official building parts and the surviving clock tower to the two source tiles."""

import argparse
import base64
import gzip
import json
import math
import tempfile
from pathlib import Path

import numpy as np
from build_surveyed_building_shells_v377 import build_meshes, encoded, triangulate
from historic_architecture_voxels_v378 import create_native, display_colour
from shapely.geometry import Point, Polygon

from scripts.build_surveyed_shell_retirements_v377 import select_tile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/schoeneberger-plaetze-v383.json.gz"
OUT = ROOT / "src/app/src/data/matthiaskircheV383"
BRICK = (173, 96, 74)
TERRA = (159, 84, 64)
SAND = (207, 179, 143)
SHADOW = (88, 68, 59)
GLASS = (69, 79, 82)
ROOF = (151, 88, 72)
METAL = (91, 100, 99)


def volume(source):
  surfaces = []
  colors = {}
  walls = []

  def add(kind, part, rings, tone):
    key = str(len(surfaces))
    rings = [[[float(n) for n in point] for point in ring] for ring in rings]
    surfaces.append((kind, part, key, key, rings))
    colors[key] = tone
    return key

  datum = min(p["ground_y_m"] for p in source["parts"]) - 3
  for part in source["parts"]:
    footprint = Polygon(part["ring"])
    for patch in part["surfaces"]:
      kind = patch["kind"]
      rings = [[[x, y - datum, z] for x, y, z in row] for row in patch["rings"]]
      key = add(kind, part["id"], rings, ROOF if kind == "RoofSurface" else BRICK)
      if kind == "WallSurface":
        r = np.array(rings[0])[:, [0, 2]]
        a, b = max(
          ((a, b) for a in r for b in r), key=lambda x: np.linalg.norm(x[0] - x[1])
        )
        d = b - a
        length = np.linalg.norm(d)
        if length < 0.10:
          continue
        normal = np.array([-d[1], d[0]]) / length
        if footprint.contains(Point((a + b) / 2 + normal * 0.05)):
          normal = -normal
        walls.append(
          dict(a=a.tolist(), b=b.tolist(), normal=normal.tolist(), wallId=key)
        )
  tower = np.array(source["tower"]["points"])
  center = tower.mean(axis=0)
  # The four high masonry gables surround the recessed, much lower roof;
  # this is the 1952 crown on the surviving shaft photographed by the LDA.
  tower = center + (tower - center) * 1.15
  roof_peak = 3 + source["tower"]["roofMeasured"]
  for a, b in zip(tower, np.roll(tower, -1, axis=0)):
    mid = (a + b) / 2

    def at(p, y):
      return [p[0], y, p[1]]

    wall = add(
      "WallSurface",
      "Turm",
      [
        [
          at(a, 23),
          at(b, 23),
          at(b, roof_peak - 0.70),
          at(mid, 63),
          at(a, roof_peak - 0.70),
        ]
      ],
      TERRA,
    )
    n = (mid - center) / np.linalg.norm(mid - center)
    walls.append(dict(a=a.tolist(), b=b.tolist(), normal=n.tolist(), wallId=wall))
    # Thin gable copings, not a pyramidal roof visible from the street.
    back_a = center + (a - center) * 0.92
    back_b = center + (b - center) * 0.92
    back_mid = (back_a + back_b) / 2
    for f, g, u, v in [(a, mid, back_a, back_mid), (mid, b, back_mid, back_b)]:
      yf = 63 if np.allclose(f, mid) else roof_peak - 0.70
      yg = 63 if np.allclose(g, mid) else roof_peak - 0.70
      add(
        "RoofSurface",
        "Turm",
        [[at(f, yf), at(g, yg), at(v, yg - 0.3), at(u, yf - 0.3)]],
        METAL,
      )
    add(
      "RoofSurface",
      "Turm",
      [
        [
          at(back_a, roof_peak - 0.80),
          at(back_b, roof_peak - 0.80),
          at(center, roof_peak),
        ]
      ],
      METAL,
    )
  return surfaces, colors, walls, tower


def architectural_details(mesh, source, native):
  _, _, _, tower = volume(source)
  center = tower.mean(axis=0)

  def plane(a, b, normal):
    d = b - a
    width = np.linalg.norm(d)

    def at(u, y, depth=0.08):
      x, z = a + d * (u / width) + normal * depth
      return (x, y, z)

    def patch(pairs, depth, tone):
      mesh.face([at(u, y, depth) for u, y in pairs], tone)

    def rect(u, v, y, h, depth, tone):
      patch([(u, y), (v, y), (v, y + h), (u, y + h)], depth, tone)

    def pointed(u, y, w, h, depth, tone):
      # Convex lancet with a pointed two-centred head. Each strip shares its sill.
      steps = 5 if native else 12
      curves = []
      r = w / 2
      for t in np.linspace(-1, 1, steps * 2 + 1):
        top = (
          y
          + h
          - r * 1.55
          + r * 1.55 * math.sqrt(max(0, 4 - (abs(t) + 1) ** 2)) / math.sqrt(3)
        )
        curves.append((u + r * t, top))
      patch([(u - r, y), (u + r, y), *reversed(curves)], depth, tone)

    return width, at, patch, rect, pointed

  peak = 3 + source["tower"]["roofMeasured"]
  for a, b in zip(tower, np.roll(tower, -1, axis=0)):
    normal = (a + b) / 2 - center
    normal /= np.linalg.norm(normal)
    width, at, patch, rect, arch = plane(a, b, normal)
    mid = width / 2
    for y in [31.5, 46.2, 50.45, 54.3, 55.55]:
      rect(
        -0.13,
        width + 0.13,
        y,
        0.23,
        0.18,
        SAND if y in [31.5, 50.45, 55.55] else SHADOW,
      )
    arch(mid, 32.3, 4.4, 13.2, 0.19, SAND)
    arch(mid, 32.7, 3.83, 12.4, 0.24, SHADOW)
    for dx in [-0.91, 0.91]:
      arch(mid + dx, 32.8, 1.57, 10.5, 0.28, GLASS)
      for y in np.arange(34.0, 41.2, 0.60):
        rect(mid + dx - 0.64, mid + dx + 0.65, y, 0.12, 0.32, (114, 98, 83))
    for dx in [-2.1, 0, 2.1]:
      arch(mid + dx, 51.1, 1.51, 2.42, 0.19, SAND)
      arch(mid + dx, 51.23, 1.19, 1.98, 0.23, SHADOW)
    # Round dark oculi are visible in the four triangular post-war gables.
    for radius, depth, tone in [(1.14, 0.18, SAND), (0.88, 0.22, SHADOW)]:
      patch(
        [
          (mid + radius * math.cos(t), 57.5 + radius * math.sin(t))
          for t in np.linspace(0, 2 * math.pi, 17)[:-1]
        ],
        depth,
        tone,
      )
    for u in [mid - 0.99, mid + 0.99]:
      mesh.rod(at(u, 32.65, 0.31), at(u, 41.0, 0.31), 0.085, SAND, 5)
    for y in [31.87, 46.51, 50.77, 54.62]:
      rect(0, width, y, 0.09, 0.22, (202, 155, 124))
    for u in [0.18, width - 0.18]:
      mesh.rod(at(u, 29, 0.08), at(u, peak + 0.12, 0.08), 0.23, TERRA, 6)
    for u in [0, width]:
      mesh.rod(at(u, peak - 0.68, 0.13), at(mid, 63, 0.13), 0.115, SAND, 4)
  body = source["parts"][-1]
  ring = Polygon(body["ring"])
  # Actual projecting buttresses divide the two long nave elevations; the
  # seven-metre recess between each pair is the registered window bay.
  seen = set()
  for wall in body["surfaces"]:
    if wall["kind"] != "WallSurface":
      continue
    r = np.array(wall["rings"][0])[:, [0, 2]]
    a, b = max(
      ((a, b) for a in r for b in r), key=lambda pts: np.linalg.norm(pts[0] - pts[1])
    )
    w = np.linalg.norm(b - a)
    mid = (a + b) / 2
    key = tuple(np.round(mid, 1))
    if key in seen or not (
      6.4 < w < 10 and 2579 < mid[1] < 2616 and abs(a[1] - b[1]) > 0.85 * w
    ):
      continue
    seen.add(key)
    n = np.array([b[1] - a[1], a[0] - b[0]]) / w
    if ring.contains(Point(mid + n * 0.10)):
      n = -n
    width, at, patch, rect, arch = plane(a, b, n)
    arch(w / 2, 7.0, w * 0.62, 12.1, 0.15, SAND)
    arch(w / 2, 7.21, w * 0.55, 11.62, 0.18, SHADOW)
    for dx in [-w * 0.128, w * 0.128]:
      arch(w / 2 + dx, 7.34, w * 0.22, 10.25, 0.20, GLASS)
    rect(w * 0.19, w * 0.81, 6.86, 0.20, 0.31, SAND)
  # Official south front central wall on the original ground plan.
  a = np.array([-1205.777, 2619.382])
  b = np.array([-1197.42, 2618.394])
  n = np.array([a[1] - b[1], b[0] - a[0]])
  n /= np.linalg.norm(n)
  w, at, patch, rect, arch = plane(a, b, n)
  arch(w / 2, 3.16, w * 0.94, 18.3, 0.11, SAND)
  arch(w / 2, 5.84, w * 0.72, 14.1, 0.17, SHADOW)
  for dx in [-1.75, 0, 1.75]:
    arch(w / 2 + dx, 7.35, 1.57, 10.75, 0.23, GLASS)
  for dx in [-1.72, 1.72]:
    rect(w / 2 + dx - 1.31, w / 2 + dx + 1.31, 3.18, 4.0, 0.25, (65, 56, 48))
  rect(0.3, w - 0.3, 7.0, 0.29, 0.29, SAND)
  for u in [1.05, 2.55, 4.18, 5.81, 7.31]:
    mesh.rod(
      at(u, 7.20, 0.33),
      at(u, 15.4 if u in (1.05, 7.31) else 17.8, 0.33),
      0.095,
      SAND,
      5,
    )
  for u in [0.10, w - 0.10]:
    mesh.rod(at(u, 3.1, 0.21), at(u, 16.9, 0.21), 0.41, (184, 143, 114), 6)
    mesh.rod(at(u, 16.9, 0.21), at(u, 18.6, 0.21), 0.26, SAND, 5)
  for c, d in [
    [[-1214.297, 2618.636], [-1207.708, 2617.867]],
    [[-1195.903, 2616.482], [-1189.336, 2615.695]],
  ]:
    c, d = np.array(c), np.array(d)
    w, at, patch, rect, arch = plane(c, d, n)
    for y in [4.2, 4.62, 6.02, 19.2]:
      rect(0, w, y, 0.16, 0.18, (186, 154, 125))
    arch(w / 2, 7.0, w * 0.68, 10.7, 0.16, (148, 90, 71))
    arch(w / 2, 7.16, w * 0.61, 10.15, 0.20, (172, 107, 83))
    for edge in [0, w]:
      mesh.rod(at(edge, 3.3, 0.08), at(edge, 20, 0.08), 0.23, (154, 96, 76), 5)


def build(check):
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))["church"]
  owner = source["owner"]
  surfaces, colors, walls, _ = volume(source)
  domains = {
    t: dict(origin=[-1536, -10, z], planes=[(0, 1, -z), (0, -1, z + 512)])
    for t, z in [("-3_4", 2048), ("-3_5", 2560)]
  }
  OUT.mkdir(exist_ok=True)

  def write(path, record):
    raw = json.dumps(record, separators=(",", ":")) + "\n"
    if check:
      assert path.read_text() == raw, path.name
    else:
      path.write_text(raw)

  with tempfile.TemporaryDirectory() as f:
    q = Path(f)
    build_meshes(
      [(owner, BRICK, domains, surfaces)],
      {owner: {}},
      surface_colours={owner: colors},
      output=q / "shell",
      receipt_path=q / "audit",
    )
    drawings = {k: a[0] for k, a in json.load(open(q / "shell"))["tiles"].items()}
  # The broad nave and sacristies follow the actual two-metre native cells.
  # The narrow four-gabled crown and its separate skin share the measured
  # shaft plan. Sampling these thin gables into the nave grid would produce
  # isolated full-height columns across the tower's arched belfry windows.
  body = [f for f in surfaces if f[1] != "Turm"]
  native, _, _ = create_native(owner, body, colors, domains, walls, default_wall=BRICK)
  packet = native["-3_5"]
  mesh = packet["mesh"]
  pos = (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3).tolist()
  )
  rgb = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3).tolist()
  idx = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").tolist()
  sides = idx[: packet["roofIndexStart"]]
  roofs = idx[packet["roofIndexStart"] :]
  origin = np.array(domains["-3_5"]["origin"])
  vertices = {}
  for kind, part, _, key, rings in surfaces:
    if part != "Turm":
      continue
    tone = display_colour(colors[key], 1 if kind == "RoofSurface" else 0.96)
    for triangle in triangulate(rings):
      for point in triangle:
        xyz = tuple(np.rint((np.array(point) - origin) * 100).astype(int))
        v = (xyz, tone)
        if v not in vertices:
          vertices[v] = len(pos)
          pos.append(xyz)
          rgb.append(tone)
        (roofs if kind == "RoofSurface" else sides).append(vertices[v])
  packet["roofIndexStart"] = len(sides)
  mesh.update(
    positions=encoded(pos, "<u2"),
    colors=encoded(rgb, "u1"),
    indices=encoded(sides + roofs, "<u4"),
  )
  for family, models in [("drawn", drawings), ("minecraft", native)]:
    for tile, shell in models.items():
      receipt, stats = select_tile(tile, owner, family)
      write(
        OUT / (family + "_" + tile + ".json"),
        dict(
          shells=dict(tiles={tile: [shell]}), retirements=dict(packets={tile: receipt})
        ),
      )
      print(family, tile, stats["roofTriangles"], flush=True)


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("--check", action="store_true")
  build(p.parse_args().check)
