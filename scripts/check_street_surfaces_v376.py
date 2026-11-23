"""Compare delivered mesh geometry independently of GEOS triangle/vertex enumeration."""

import base64
import gzip
import math
import sys
import zlib
from collections import Counter

import numpy as np
import shapely as sh


def original_toolchain():
  return (
    sh.geos_version == (3, 14, 1)
    and np.__version__ == "2.3.5"
    and sys.version_info[:3] == (3, 12, 14)
    and zlib.ZLIB_RUNTIME_VERSION == "1.3.2"
  )


def words(data, dtype="<u2"):
  return np.frombuffer(gzip.decompress(base64.b64decode(data, validate=True)), dtype)


def faces(xy):
  """Counter keeps winding and multiplicity, regardless of the first vertex."""
  result = Counter()
  for tri in xy:
    corners = tuple(map(tuple, tri.tolist()))
    result[min(corners, corners[1:] + corners[:1], corners[2:] + corners[:2])] += 1
  return result


def walk_cells(data):
  rows = words(data["words"])
  cells = {}
  at = 0
  while at < len(rows):
    r, c, k, n = map(int, rows[at : at + 4])
    key = (r, c, k)
    assert key not in cells
    stop = at + 4 + 6 * n
    cells[key] = faces(rows[at + 4 : stop].reshape(-1, 3, 2))
    at = stop
  assert at == len(rows)
  return cells


def check_walks(old, new):
  assert {k: v for k, v in old.items() if k not in {"words", "ink"}} == {
    k: v for k, v in new.items() if k not in {"words", "ink"}
  }
  assert np.array_equal(words(old["ink"]), words(new["ink"]))
  assert walk_cells(old) == walk_cells(new)


def road_faces(data):
  groups = {}
  for p in data["chunks"]:
    xy = words(p["xz"]).reshape(-1, 2).astype(int) + p["origin"]
    idx = words(p["index"]).reshape(-1, 3)
    styles = words(p["style"], "u1")
    assert len(xy) == len(styles) == p["vertices"] and idx.size == p["indices"]
    assert np.all(styles[idx] == styles[idx[:, :1]])
    for style in np.unique(styles):
      key = (*p["origin"], int(style))
      assert key not in groups
      groups[key] = faces(xy[idx[styles[idx[:, 0]] == style]])
  return groups


def elevation(xz, ground):
  """Float32 mesh heights from the same cell-centred DGM as terrainPayload.ts."""
  gr, field = ground["grid"], ground["ground_height"]
  sx, sz = (
    np.asarray(xz) / 100 / ground["cell_m"] - [gr["min_x_idx"], gr["min_z_idx"]]
  ) / field["stride_cells"] - 0.5
  c, r = math.floor(sx), math.floor(sz)

  def clamp(n, max_index):
    return min(max(n, 0), max_index - 1)

  c0, c1 = clamp(c, field["cols"]), clamp(c + 1, field["cols"])
  r0, r1 = clamp(r, field["rows"]), clamp(r + 1, field["rows"])
  tx, tz = (sx - c if c0 != c1 else 0), (sz - r if r0 != r1 else 0)

  def h(col, row):
    return field["y_dm"][row * field["cols"] + col] / 10

  top = h(c0, r0) * (1 - tx) + h(c1, r0) * tx
  base = h(c0, r1) * (1 - tx) + h(c1, r1) * tx
  return float(np.float32(top * (1 - tz) + base * tz))


def checked_retessellation(original, revised, ground):
  # A Delaunay tie may flip an interior diagonal. Require identical support,
  # all boundary/interior samples, upward winding and no missing/doubled face.
  # The piecewise-linear height difference peaks at an overlay intersection
  # vertex. Test every such vertex against the two actual uploaded planes.
  def patches(group):
    corners, polys, planes = set(), [], []
    for tri in group.elements():
      corners.update(tri)
      a, b, c = tri
      assert (b[0] - a[0]) * (c[1] - a[1]) < (b[1] - a[1]) * (c[0] - a[0])
      xy = np.asarray(tri) / 100
      xy = xy.astype(np.float32).astype(float)
      polys.append(sh.Polygon(xy))
      planes.append(
        np.linalg.solve(
          np.column_stack((xy, np.ones(3))), [elevation(v, ground) for v in tri]
        )
      )
    return corners, polys, np.asarray(planes)

  a, pa, ya = patches(original)
  b, pb, yb = patches(revised)
  assert a == b
  sa, sb = sh.union_all(pa), sh.union_all(pb)
  assert sa.equals(sb)
  assert math.isclose(sum(sh.area(pa)), sa.area, abs_tol=1e-9, rel_tol=0)
  assert math.isclose(sum(sh.area(pb)), sb.area, abs_tol=1e-9, rel_tol=0)
  ix, jx = sh.STRtree(pb).query(pa, predicate="intersects")
  for i, j in zip(ix, jx):
    xy = sh.get_coordinates(pa[i].intersection(pb[j]))
    delta = np.column_stack((xy, np.ones(len(xy)))) @ (ya[i] - yb[j])
    assert np.max(np.abs(delta), initial=0) <= 0.00001


def check_roads(old, new, ground):
  assert {k: v for k, v in old.items() if k != "chunks"} == {
    k: v for k, v in new.items() if k != "chunks"
  }
  a, b = road_faces(old), road_faces(new)
  assert a.keys() == b.keys()
  for key, first in a.items():
    second = b[key]
    if first != second:
      checked_retessellation(first - second, second - first, ground)
