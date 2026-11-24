"""Rebuild surveyed road space, tree positions and photo-registered Schöneberg street fronts."""

import argparse
import gzip
import hashlib
import json
import math
import tempfile
from pathlib import Path

import numpy as np
import shapely as s
from build_kollwitz_fronts_v381 import surfaces
from build_kreuzberg_plaetze_v380 import METAL, Mesh, lines, rail
from build_matthiaskirche_v383 import architectural_details
from build_prenzlauer_streets_v380 import (
  COLORS,
  COURSES,
  WALK,
  Packet,
  graded_walk,
  parts,
)
from build_ryke_streets_v381 import assemble, tree_rows
from schoeneberg_ground_v384 import PlazaGround, winterfeld_road_extension
from shapely.affinity import translate
from shapely.geometry import Polygon

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "geo_data/regierungsviertel/schoeneberger-plaetze-v383.json.gz"
OUT = ROOT / "src/app/src/data/schoenebergPlaetzeV383"


def road_space(source, packet, references, ground):
  areas, bands, public = assemble(source)
  kerbs = [
    (s.from_wkb(w), 0.296 if props["bor"] == 3 else 0.319)
    for _, props, w in source["layers"]["bd_bordstein"]
    if props["bor"] in (2, 3)
  ]
  index = s.STRtree([g for g, _ in kerbs])

  def plate(g, tone, h, grade=False):
    for poly in parts(g, "Polygon"):
      patches = graded_walk(poly, tone, h, kerbs, index) if grade else [(poly, tone, h)]
      for piece, _, top in patches:
        for region in parts(piece, "Polygon"):
          if region.area < 0.00015:
            continue
          for face in ground.cut(region, "Polygon"):
            for tri in s.constrained_delaunay_triangles(face).geoms:
              pts = list(s.orient_polygons(tri, exterior_cw=True).exterior.coords)[:3]
              packet.facet(
                [
                  (x, ground.at(x, z) + (top(x, z) if callable(top) else top), z)
                  for x, z in pts
                ],
                COLORS.get(tone, tone),
                COURSES.get(tone, 0),
              )

  for (tone, h), area in areas.items():
    # Crossing colours of today's Nollendorfplatz are mapped from TrueDOP below.
    if tone == "green-cycle" and source["red"]:
      continue
    plate(area, tone, h, h in (0.367, 0.4, 0.419))
  for code, h in [(1, 0.425), (2, 0.321), (3, 0.30)]:
    plate(bands[code], "kerb" if code == 1 else "lowered", h)
    if code == 1:
      for line in lines(bands[code].boundary):
        for piece in ground.cut(line, "LineString"):
          for a, b in zip(piece.coords, list(piece.coords)[1:]):
            ya, yb = ground.at(*a), ground.at(*b)
            lowA, highA = (a[0], ya + 0.285, a[1]), (a[0], ya + h, a[1])
            lowB, highB = (b[0], yb + 0.285, b[1]), (b[0], yb + h, b[1])
            packet.facet([lowA, highA, highB], 0xA6A297)
            packet.facet([lowA, highB, lowB], 0xA6A297)
  for w in source["red"]:
    plate(s.from_wkb(w), 0xB97065, 0.302)
  claimed = public.union(s.union_all([s.from_wkb(w) for _, w in source["buildings"]]))
  for _, props, w in source["plazas"]:
    g = s.from_wkb(w).difference(claimed)
    plate(g, WALK.get(props["material"], "slabs"), 0.35)
    claimed = claimed.union(g)
  if "market" in source:
    plate(s.from_wkb(source["market"]).difference(claimed), 0xBCB09B, 0.345)
  measured = []
  for record in source["trees"]:
    item = list(record)
    if item[0] in source["estimate"]:
      item[4] = float(
        np.median([references[id][3] for id in source["estimate"][item[0]]])
      )
    measured.append(item)
  packet.trees, _ = tree_rows(
    {**source, "trees": measured}, s.from_wkb(source["scope"])
  )

  for tree in packet.trees:
    tree[2] = round(ground.at(tree[0], tree[1]) + 0.36, 2)


def furniture(mesh, source, ground):
  for _, _, w in source["rails"]:
    for line in lines(s.from_wkb(w)):
      for a, b in zip(line.coords, list(line.coords)[1:]):
        # Sample each real support, so a rail follows a changing footway.
        length = math.dist(a, b)
        points = np.linspace(a, b, max(2, math.ceil(length / 1.65) + 1))
        color = METAL
        bases = [(x, ground.at(x, z) + 0.40, z) for x, z in points]
        if max(p[1] for p in bases) - min(p[1] for p in bases) < 0.001:
          rail(mesh, a, b, bases[0][1])
          continue
        for x, y, z in bases:
          mesh.rod((x, y, z), (x, y + 1.02, z), 0.047, color)
        for a0, b0 in zip(bases, bases[1:]):
          for h in (0.47, 0.99):
            mesh.rod((a0[0], a0[1] + h, a0[2]), (b0[0], b0[1] + h, b0[2]), 0.055, color)
  for _, _, w in source["benches"]:
    for line in lines(s.from_wkb(w)):
      if line.length < 0.7:
        continue
      a, b = np.array(line.coords[0]), np.array(line.coords[-1])
      width = math.dist(a, b)
      axis = (b - a) / width
      normal = np.array([-axis[1], axis[0]])

      datum = ground.at(*((a + b) / 2))

      def point(along, depth, y):
        x, z = a + along * axis + depth * normal
        return (x, y + datum - 3, z)

      for d in [-0.18, -0.05, 0.08, 0.21]:
        mesh.face(
          [
            point(0, d - 0.05, 3.86),
            point(width, d - 0.05, 3.86),
            point(width, d + 0.05, 3.86),
            point(0, d + 0.05, 3.86),
          ],
          (145, 129, 106),
        )
      for along in np.linspace(0.25, width - 0.25, max(2, round(width / 1.5))):
        mesh.rod(point(along, 0, 3.37), point(along, 0, 3.84), 0.077, (83, 87, 79))


def frontage(mesh, record, outlines, native):
  segments = surfaces(record, outlines, native)
  if not segments:
    raise ValueError(("Unregistered public frontage", record["owner"]))
  color = tuple(bytes.fromhex(record["color"]))
  pale = tuple(np.rint(0.70 * np.array(color) + 0.30 * np.array([247, 239, 215])))
  width = math.dist(record["a"], record["b"])

  def panel(left, right, base, top, depth, tone):
    for start, end, a, b, n in segments:
      lo, hi = max(start, left), min(end, right)
      if hi - lo < 0.01:
        continue
      corners = []
      for u, y in ((lo, base), (hi, base), (hi, top), (lo, top)):
        x, z = a + (b - a) * (u - start) / (end - start) + n * depth
        corners.append((x, record["ground"] + y, z))
      mesh.face(corners, tone)

  panel(0, width, record["base"], record["top"], 0.18, color)
  for x, y, w, h in record["windows"]:
    left, right = x - w / 2, x + w / 2
    panel(left - 0.105, right + 0.105, y - h / 2 - 0.1, y + h / 2 + 0.11, 0.22, pale)
    panel(left, right, y - h / 2, y + h / 2, 0.242, (73, 77, 77))
    panel(
      left + 0.07,
      right - 0.06,
      y - h / 2 + 0.06,
      y + h / 2 - 0.05,
      0.254,
      (96, 109, 114),
    )
    panel(x - 0.045, x + 0.045, y - h / 2, y + h / 2, 0.271, pale)
    panel(left, right, y + h * 0.16 - 0.035, y + h * 0.16 + 0.035, 0.273, pale)
    panel(left - 0.13, right + 0.13, y - h / 2 - 0.15, y - h / 2 - 0.04, 0.319, pale)


def build(check):
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  OUT.mkdir(exist_ok=True)

  def emit(file, data):
    if check:
      assert (OUT / file).read_bytes() == data, "Stale " + file
    else:
      (OUT / file).write_bytes(data)

  root = ROOT / "src/app/public/mesh/regierungsviertel"
  core = json.loads((root / "ground-context.json").read_bytes())
  district = {}
  for host in source["hosts"]:
    file = (
      ROOT / "src/app/public/mesh/surrounding-berlin-v159" / (host + ".drawn.json.gz")
    )
    district[host] = json.loads(gzip.decompress(file.read_bytes()))["nav"]["groundY"]
  assert len(set(district.values())) == 1
  for place, origin in [("noll", [-1250, 0, 2116]), ("winter", [-1224, 0, 2500])]:
    packet = Packet(0, 0)
    packet.origin = origin
    extension = None
    if place == "winter":
      previous_roads = json.loads((root / "surface-polygons.json").read_bytes())[
        "roads"
      ]
      extension = winterfeld_road_extension(source[place], previous_roads)
    ground = PlazaGround(
      s.from_wkb(source[place]["scope"]), core, next(iter(district.values())), extension
    )
    road_space(source[place], packet, source["crownObservations"], ground)
    with tempfile.TemporaryDirectory() as tmp:
      target = Path(tmp) / "surface.json"
      packet.save(target)
      emit(place + ".json", target.read_bytes())
    for style in ("drawn", "native"):
      native = style == "native"
      family = "minecraft" if native else "drawn"
      walls = {}
      for host, hashes in source["hosts"].items():
        data = (
          ROOT
          / "src/app/public/mesh/surrounding-berlin-v159"
          / (host + "." + family + ".json.gz")
        ).read_bytes()
        assert hashlib.sha256(data).hexdigest() == hashes[family]
        chunk = json.loads(gzip.decompress(data))
        x, _, z = chunk["origin"]
        for building in chunk["nav"]["buildings"]:
          poly = Polygon(building["ring"], building["holes"])
          if poly.is_valid:
            walls.setdefault(building["sourceId"], []).append(translate(poly, x, z))
      mesh = Mesh(origin)
      furniture(mesh, source[place], ground)
      if place == "winter":
        architectural_details(mesh, source["church"], native)
      for face in source["fronts"]:
        if (face["a"][1] < 2250) == (place == "noll"):
          frontage(mesh, face, walls[face["owner"]], native)
      emit(
        place + "_" + style + ".json",
        (json.dumps([mesh.finish()], separators=(",", ":")) + "\n").encode(),
      )
    print(place, len(packet.indices) // 3, len(packet.trees), flush=True)


if __name__ == "__main__":
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("--check", action="store_true")
  build(p.parse_args().check)
