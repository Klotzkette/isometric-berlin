import base64
import gzip
import hashlib
import json
import math
import sys
import zlib
from collections import Counter, defaultdict

import numpy as np
import shapely
from shapely import Point, Polygon

from scripts.build_sinti_roma_apron_v375 import GROUND, OUTPUT, PHOTO, ROOT, X, Z, build


def geometry(packet):
  def unpack(key, dtype, width):
    return np.frombuffer(gzip.decompress(base64.b64decode(packet[key])), dtype).reshape(
      -1, width
    )

  vertices = unpack("vertices", "<i2", 4)
  indices = unpack("indices", "<u2", 3)
  return vertices, indices


def oriented_faces(vertices, indices):
  faces = Counter()
  for triangle in vertices[indices]:
    ring = [tuple(map(int, v)) for v in triangle]
    # Normalise vertex numbering without accepting reversed faces.
    faces[min(tuple(ring[n:] + ring[:n]) for n in range(3))] += 1
  return faces


def planar_patches(faces):
  patches = defaultdict(list)
  for face in faces.elements():
    a, b, c = np.asarray(face, dtype=np.int64)
    assert a[3] == b[3] == c[3]
    normal = np.cross(b[:3] - a[:3], c[:3] - a[:3])
    assert normal[1] > 0
    normal //= math.gcd(*normal.tolist())
    plane = (*normal.tolist(), int(normal @ a[:3]), int(a[3]))
    patches[plane].append(Polygon([(u[0], u[2]) for u in face]))
  return patches


def test_orthophoto_and_world_ground_rebuild_the_shipped_geometry():
  original = json.loads(gzip.decompress(GROUND.read_bytes()))
  assert original["osm"].endswith("/relation/8329726")
  assert original["imagery"]["layer"] == "truedop_2024"
  assert (
    hashlib.sha256(PHOTO.read_bytes()).hexdigest()
    == "1cfe55b9a16583c8a213b3557ae7e4da6eb10759271b9d3224420effc668d337"
  )
  frozen = OUTPUT.read_bytes()
  assert (
    hashlib.sha256(frozen).hexdigest()
    == "2fa46b7aa978e07c0b5d38e166b49ca44896f70f6c7cba8b77a7cfa2fd45c228"
  )
  expected, actual = json.loads(frozen), build()
  assert all(expected[key] == actual[key] for key in ("origin", "areasM2", "triangles"))
  av, ai = geometry(expected)
  bv, bi = geometry(actual)
  assert Counter(map(tuple, av)) == Counter(map(tuple, bv))
  old, new = oriented_faces(av, ai), oriented_faces(bv, bi)
  # GEOS 3.13 and 3.14 choose opposite diagonals for a flat, mineral four-point
  # patch. Both must preserve exact XYZ planes, material, winding and coverage.
  before, after = planar_patches(old - new), planar_patches(new - old)
  assert before.keys() == after.keys()
  for plane, polygons in before.items():
    replacement = after[plane]
    assert sum(p.area for p in polygons) == sum(p.area for p in replacement)
    assert shapely.union_all(polygons).equals(shapely.union_all(replacement))
  if (
    shapely.geos_version == (3, 14, 1)
    and np.__version__ == "2.3.5"
    and sys.version_info[:3] == (3, 12, 14)
    and zlib.ZLIB_RUNTIME_VERSION == "1.3.2"
  ):
    assert actual == expected


def test_new_triangles_preserve_every_inner_stone_and_all_tree_contacts():
  packet = json.loads(OUTPUT.read_bytes())
  vertices = np.frombuffer(
    gzip.decompress(base64.b64decode(packet["vertices"])), "<i2"
  ).reshape(-1, 4)
  indices = np.frombuffer(
    gzip.decompress(base64.b64decode(packet["indices"])), "<u2"
  ).reshape(-1, 3)
  xz = vertices[:, [0, 2]] / 1000 + [X, Z]
  current = shapely.union_all([Polygon(p) for p in xz[indices]])
  fixed = json.loads((ROOT / "src/app/src/data/sintiRomaPavingV256.json").read_text())
  old = shapely.union_all(
    [Polygon(np.array(s["ring"]) + [X, Z]) for s in fixed["shards"]]
  )
  assert len(fixed["shards"]) == 237
  assert current.intersection(old).area == 0
  assert current.distance(Point(X, Z)) >= 9.55
  assert math.isclose(sum(packet["areasM2"][:2]), 176.957, abs_tol=0.002)
  assert math.isclose(sum(packet["areasM2"][2:]), 63.389, abs_tol=0.002)
  contacts = json.loads(
    gzip.decompress(
      (
        ROOT / "geo_data/regierungsviertel/mitte-tree-contacts-v375.json.gz"
      ).read_bytes()
    )
  )["rows"]
  assert all(not current.covers(Point(x, z)) for x, z, *_ in contacts)
