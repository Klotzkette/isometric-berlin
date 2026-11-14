"""Stage finite, reference-guided detail on three retained park buildings."""

from __future__ import annotations

import argparse
import gzip
import json
import math
import subprocess
from functools import partial
from pathlib import Path

from shapely.geometry import LineString, Point

from scripts.build_spree_details_v337 import GEO, PUBLIC, ROOT, json_bytes, sha
from scripts.build_surrounding_outlines import PackedMesh
from scripts.build_tierpark_v255 import quad
from scripts.marzahn_garden_landmarks_v330 import (
  Garden,
  centroid,
  fitted_boxes,
  polygons,
)
from scripts.marzahn_garden_terrain_v330 import load_terrain, terrain_height

PREVIOUS = "3134ff0e"
KIND = "zoo-garden-details-v341"
DATA = ROOT / "src/app/src/data"
HOSTS = {
  "antelope": "-5_2",
  "palace": "outer187-20_3",
  "korean": "gardens330-27_-4-p2",
}
SOURCES = [
  DATA / "zooGroundsV165Source.json",
  DATA / "zooRecognitionV255Source.json",
  GEO / "tierpark-v255-source.json.gz",
  DATA / "eastLandmarksV187Native.json",
  GEO / "marzahn-garden-landmarks-v330.json",
  GEO / "marzahn-garden-terrain-v330-source.json.gz",
]
REFERENCES = {
  "antelope": "https://www.zoo-berlin.de/de/aktuelles/news/artikel/180-jahre-berlin-antilopenhaus",
  "palace": "https://www.schloss-friedrichsfelde.de/",
  "korean": "https://www.gaertenderwelt.de/welt-entdecken/themengaerten/koreanischer-garten/",
}


def original(path: Path) -> bytes:
  """Read the immutable predecessor, never today's concurrently edited packet."""
  return subprocess.check_output(
    ["git", "show", f"{PREVIOUS}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def read(path: Path) -> dict:
  raw = original(path)
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def cube(mesh, center, size, color, yaw=0):
  x, y, z = center
  w, h, d = size
  points = [
    (
      x + math.cos(yaw) * u * w / 2 + math.sin(yaw) * v * d / 2,
      y + t * h / 2,
      z - math.sin(yaw) * u * w / 2 + math.cos(yaw) * v * d / 2,
    )
    for u, t, v in [
      (-1, -1, -1),
      (1, -1, -1),
      (1, 1, -1),
      (-1, 1, -1),
      (-1, -1, 1),
      (1, -1, 1),
      (1, 1, 1),
      (-1, 1, 1),
    ]
  ]
  for face in (
    (0, 3, 2, 1),
    (4, 5, 6, 7),
    (0, 4, 7, 3),
    (1, 2, 6, 5),
    (3, 7, 6, 2),
    (0, 1, 5, 4),
  ):
    quad(mesh, [points[i] for i in face], color)


def antelope(mesh: PackedMesh, native: bool) -> dict:
  """Layered buff cornice, blue stringcourse and small dentils on the main entry."""
  source = read(DATA / "zooGroundsV165Source.json")
  part = next(p for p in source["parts"] if p["id"] == "DEBE3DlyqEefwivU")
  a, b = part["ring"][7], part["ring"][0]
  length = math.dist(a, b)
  ux, uz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  nx, nz = uz, -ux
  yaw = math.atan2(-uz, ux)
  cream, shade, blue = (196, 182, 142), (154, 142, 109), (109, 143, 163)
  rows = []
  if native:
    # Borrow actual independently cardinal exterior faces of the retained shell.
    body = source["nativeRows"]
    line = LineString([a, b])
    seen = set()
    for x, y, z, w, h, d, _ in body:
      if not (y - h / 2 < 16.1 < y + h / 2):
        continue
      for dx, dz, span in ((1, 0, d), (-1, 0, d), (0, 1, w), (0, -1, w)):
        cx, cz = x + dx * w / 2, z + dz * d / 2
        if line.distance(Point(cx, cz)) > 1.15 or dx * nx + dz * nz < 0.2:
          continue
        if any(
          abs(cx + dx * 0.03 - q[0]) < q[3] / 2 - 1e-7
          and abs(cz + dz * 0.03 - q[2]) < q[5] / 2 - 1e-7
          and q[1] - q[4] / 2 < 16.1 < q[1] + q[4] / 2
          for q in body
        ):
          continue
        key = (cx, cz, dx, dz, span)
        if key not in seen:
          rows.append((cx, cz, -dz, dx, dx, dz, span, 0 if dz else math.pi / 2))
          seen.add(key)
  else:
    rows.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ux, uz, nx, nz, length, yaw))
  dentils = 0
  for x, z, tx, tz, ox, oz, span, angle in rows:
    for y, h, dep, offset, color in [
      (16.13, 0.10, 0.10, 0.28, blue),
      (16.35, 0.13, 0.18, 0.32, cream),
      (16.91, 0.17, 0.24, 0.34, cream),
      (17.12, 0.09, 0.28, 0.36, shade),
    ]:
      cube(mesh, (x + ox * offset, y, z + oz * offset), (span, h, dep), color, angle)
    count = max(1, round(span / 0.38))
    for i in range(count):
      u = (i + 0.5) * span / count - span / 2
      cube(
        mesh,
        (x + tx * u + ox * 0.34, 16.63, z + tz * u + oz * 0.34),
        (min(0.16, span * 0.48), 0.38, 0.22),
        cream,
        angle,
      )
      dentils += 1
  assert rows and dentils
  return dict(
    owner=part["id"],
    fittedRuns=len(rows),
    dentils=dentils,
    sourceFront=[a, b],
    nativeActualFaces=native,
  )


def palace(mesh: PackedMesh, native: bool) -> dict:
  """Fine pale joinery and raised pink/cream surrounds on existing openings."""
  source = read(GEO / "tierpark-v255-source.json.gz")
  panes = [p for p in source["panes"] if p["owner"] == "DEBE11YYI00009hE"]
  frames = []
  if native:
    body = [
      r
      for c in read(DATA / "eastLandmarksV187Native.json")["cells"]
      for r in c["boxes"]
      if 10255 < r[0] < 10325 and 1775 < r[2] < 1830
    ]
    for x, y, z, w, h, d, color in body:
      if color != 0x607C82:
        continue
      for nx, nz, width in ((1, 0, d), (-1, 0, d), (0, 1, w), (0, -1, w)):
        px, pz = x + nx * w / 2, z + nz * d / 2
        if any(
          abs(px + nx * 0.03 - q[0]) < q[3] / 2 - 1e-7
          and abs(pz + nz * 0.03 - q[2]) < q[5] / 2 - 1e-7
          and q[1] - q[4] / 2 < y < q[1] + q[4] / 2
          for q in body
        ):
          continue
        frames.append(
          (
            px + nx * 0.055,
            y,
            pz + nz * 0.055,
            width,
            h,
            nx,
            nz,
            0 if nz else math.pi / 2,
          )
        )
  else:
    for p in panes:
      x, y, z, w, h, _, yaw, _ = p["row"]
      nx, nz = p["normal"]
      frames.append((x + nx * 0.12, y, z + nz * 0.12, w, h, nx, nz, yaw))
  pale, pink = (225, 218, 197), (190, 151, 139)
  for x, y, z, w, h, nx, nz, yaw in frames:
    ux, uz = math.cos(yaw), -math.sin(yaw)
    for side in (-1, 1):
      u = side * (w / 2 + 0.10)
      cube(mesh, (x + ux * u, y, z + uz * u), (0.16, h + 0.34, 0.10), pale, yaw)
      u = side * (w / 2 + 0.23)
      cube(mesh, (x + ux * u, y, z + uz * u), (0.08, h + 0.46, 0.08), pink, yaw)
    for side in (-1, 1):
      cube(mesh, (x, y + side * (h / 2 + 0.11), z), (w + 0.36, 0.14, 0.15), pale, yaw)
    # Divide tall retained glazing into three lights, in addition to its old cross.
    for fraction in (-1 / 3, 1 / 3):
      cube(
        mesh,
        (x + nx * 0.025, y + h * fraction, z + nz * 0.025),
        (max(0.2, w - 0.14), 0.055, 0.055),
        pale,
        yaw,
      )
  assert frames
  return dict(owner="DEBE11YYI00009hE", frames=len(frames), nativeActualFaces=native)


def korean(mesh: PackedMesh, native: bool) -> dict:
  """Tile courses and eave fascia on retained Kye Zeong and three gate roofs."""
  source = read(GEO / "marzahn-garden-landmarks-v330.json")
  terrain = load_terrain(GEO / "marzahn-garden-terrain-v330-source.json.gz")
  height = partial(terrain_height, terrain, native=native)
  garden = Garden(source, height, native)
  sites = [(source["korean"]["kyeOsm"], 2.96, 1.19, None)]
  sites += [(i, 2.57, 0.66, 1.12) for i in source["korean"]["gatesOsm"]]
  faces = 0
  for identity, eaves, rise, inset in sites:
    footprint = garden.raw(identity).intersection(garden.park)
    base = height(*centroid(footprint)) + eaves
    reach = min(math.sqrt(footprint.area) * 0.38, inset if inset is not None else 2.4)
    for p in polygons(footprint):
      vertices = list(p.exterior.coords)[:-1]
      # Tile channels descend perpendicular to each real roof edge. Trim every
      # strip to that edge's roof sector; no new footprint or opaque roof cap.
      for a, b in zip(vertices, vertices[1:] + vertices[:1]):
        length = math.dist(a, b)
        if length < 0.55:
          continue
        ux, uz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
        nx, nz = -uz, ux
        if not p.contains(
          Point((a[0] + b[0]) / 2 + nx * 0.1, (a[1] + b[1]) / 2 + nz * 0.1)
        ):
          nx, nz = -nx, -nz
        for i in range(max(1, int(length / 0.42))):
          u = (i + 0.5) * length / max(1, int(length / 0.42))
          x, z = a[0] + ux * u, a[1] + uz * u
          strip = LineString(
            [(x + nx * 0.09, z + nz * 0.09), (x + nx * reach, z + nz * reach)]
          ).buffer(0.035, cap_style=2)
          strip = strip.intersection(p.buffer(-0.035))
          if native:
            for lo, hi, y in (
              (0, 0.3, 0.30),
              (0.3, 0.59, 0.59),
              (0.59, 0.82, 0.82),
              (0.82, 1, 1),
            ):
              region = p.buffer(-reach * lo, join_style="mitre").difference(
                p.buffer(-reach * hi, join_style="mitre")
              )
              # Explicit cardinal tile bands follow the original stair roof.
              q = fitted_boxes(strip.buffer(0.10).intersection(region), 0.20, False)
              # Match the actual previous roof's independently cardinal domain.
              q = q.intersection(
                fitted_boxes(p.buffer(-reach * lo, join_style="mitre"), 0.25, True)
              )
              garden.triangles_on(q, base + rise * y + 0.035, (98, 105, 101))
          else:
            garden.triangles_on(
              strip,
              lambda x, z: (
                base + rise * min(1, p.boundary.distance(Point(x, z)) / reach) + 0.035
              ),
              (100, 106, 103),
            )
          faces += 1
      fascia = p.boundary.buffer(0.065).intersection(p)
      garden.solid(
        fascia, base - 0.13, base - 0.045, (101, 79, 61), None, grid=0.20, strict=False
      )
  for triangle, color in garden.triangles:
    mesh.triangle(triangle, color)
  return dict(
    owners=[i[0] for i in sites], tileCourses=faces, nativeIndependentRoof=native
  )


BUILDERS = {"antelope": antelope, "palace": palace, "korean": korean}


def stage(directory: Path) -> dict:
  """Produce exact append-only candidate assets; root merges the shared manifest."""
  directory.mkdir(parents=True, exist_ok=True)
  for path in SOURCES:
    if path.read_bytes() != original(path):
      raise ValueError(f"Changed source owner: {path.relative_to(ROOT)}")
  manifest = read(PUBLIC / "manifest.json")
  hosts = {r["id"]: r for r in manifest["chunks"]}
  receipt = dict(
    previous=PREVIOUS,
    kind=KIND,
    references=REFERENCES,
    sources={str(p.relative_to(ROOT)): sha(original(p)) for p in SOURCES},
    packets={},
  )
  for site, identity in HOSTS.items():
    for family in ("drawn", "minecraft"):
      asset = hosts[identity][family]
      path = PUBLIC / asset["url"]
      raw = original(path)
      assert sha(raw) == asset["sha256"]
      packet = json.loads(gzip.decompress(raw))
      x, y, z = packet["origin"]
      assert y == -10
      mesh = PackedMesh(x, z)
      audit = BUILDERS[site](mesh, family == "minecraft")
      addition = mesh.payload(KIND)
      assert addition and len(mesh.vertices) < 40000
      packet["meshes"].append(addition)
      decoded = json_bytes(packet)
      wire = gzip.compress(decoded, compresslevel=9, mtime=0)
      assert len(decoded) < 12 * 1024 * 1024
      (directory / path.name).write_bytes(wire)
      after = dict(
        url=path.name,
        encoding="gzip",
        bytes=len(wire),
        decodedBytes=len(decoded),
        sha256=sha(wire),
      )
      receipt["packets"][f"{family}:{identity}"] = dict(
        before=asset,
        after=after,
        site=site,
        audit=audit,
        vertices=len(mesh.vertices),
        triangles=len(mesh.indices) // 3,
      )
  (directory / "receipt.json").write_bytes(json_bytes(receipt))
  return receipt


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, required=True)
  args = parser.parse_args()
  result = stage(args.out)
  print(
    json.dumps(
      {
        key: {k: row[k] for k in ("audit", "vertices", "triangles")}
        for key, row in result["packets"].items()
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
