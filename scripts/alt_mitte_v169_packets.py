"""Step 10: bounded, lossless packet splitting for the Alt-Mitte refinement.

Limits match the actual runtime aggregate limits. Splitting may duplicate shared
vertices between packets, but it never drops a source face, colour or hole.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path
from typing import Any

import numpy as np
from build_karl_marx_allee_v161 import Detail, clip_polygon
from build_scheunenviertel_v168 import packet_counts, within_geometry_limits
from build_surrounding_outlines import POSITION_ORIGIN_Y, PackedMesh

KIND = "alt-mitte-v169"
MAX_DECODED_BYTES = 12 * 1024 * 1024


def empty_packet(
  identity: str, bounds: tuple | list, origin_y: float = POSITION_ORIGIN_Y
) -> dict[str, Any]:
  """Geometry-only companions never override a primary's navigation."""
  return {
    "schemaVersion": 1,
    "id": identity,
    "origin": [bounds[0], origin_y, bounds[1]],
    "meshes": [],
    "nav": {
      "ground": [],
      "water": [],
      "buildings": [],
      "roads": [],
      "bridges": [],
      "groundY": 3,
    },
  }


def raw_packet(payload: dict) -> bytes:
  """Stable canonical runtime envelope."""
  return (
    json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
  ).encode()


def fits(payload: dict) -> bool:
  """Both byte and aggregate geometry limits are binding."""
  return (
    within_geometry_limits(payload) and len(raw_packet(payload)) <= MAX_DECODED_BYTES
  )


def pack_detail(
  detail: Detail,
  bounds: tuple | list,
  *,
  origin_y: float = POSITION_ORIGIN_Y,
  max_vertices: int = 340_000,
  max_indices: int = 900_000,
) -> list[dict]:
  """Clip into this spatial cell, then split on complete triangles only."""
  minx, minz, maxx, maxz = bounds
  meshes: list[dict] = []
  mesh = PackedMesh(minx, minz)

  def flush() -> None:
    nonlocal mesh
    payload = mesh.payload(KIND)
    if payload:
      meshes.append(payload)
    mesh = PackedMesh(minx, minz)

  for triangle, color, _ in detail.triangles:
    if (
      max(p[0] for p in triangle) < minx
      or min(p[0] for p in triangle) > maxx
      or max(p[2] for p in triangle) < minz
      or min(p[2] for p in triangle) > maxz
    ):
      continue
    points = triangle
    for axis, edge, lower in [
      (0, minx, True),
      (0, maxx, False),
      (2, minz, True),
      (2, maxz, False),
    ]:
      points = clip_polygon(points, axis, edge, lower)
      if len(points) < 3:
        break
    for i in range(1, len(points) - 1):
      if len(mesh.vertices) + 3 > max_vertices or len(mesh.indices) + 3 > max_indices:
        flush()
      # Only the packet coordinate frame changes. Preserve measured elevations,
      # including source basement sheets below the older fixed -10 m origin.
      mesh.triangle(
        [
          (x, y + POSITION_ORIGIN_Y - origin_y, z)
          for x, y, z in (points[0], points[i], points[i + 1])
        ],
        color,
      )
  flush()
  for part in meshes:
    envelope = empty_packet("check", bounds)
    envelope["meshes"] = [part]
    assert fits(envelope), packet_counts(envelope)
  return meshes


def distribute(
  primary: dict, meshes: list[dict], identity: str, bounds: tuple | list
) -> list[dict]:
  """Preserve the old packet and move only excess new faces to companions."""
  result = [primary]
  assert fits(primary), (identity, "retained primary already violates limits")
  for mesh in meshes:
    candidate = {**result[-1], "meshes": [*result[-1]["meshes"], mesh]}
    if fits(candidate):
      result[-1] = candidate
    else:
      companion = empty_packet(f"{identity}-alt-mitte-v169-{len(result)}", bounds)
      companion["origin"] = list(primary["origin"])
      companion["meshes"] = [mesh]
      assert fits(companion), (identity, "single new mesh exceeds limits")
      result.append(companion)
  return result


def save_packet(folder: Path, identity: str, mode: str, payload: dict) -> dict:
  """Reject invalid bounds before any artifact can become publishable."""
  assert fits(payload), (identity, mode, packet_counts(payload))
  raw = raw_packet(payload)
  data = gzip.compress(raw, compresslevel=9, mtime=0)
  assert len(data) <= 5 * 1024 * 1024, (identity, mode, "packed asset exceeds 5 MiB")
  name = f"{identity}.{mode}.json.gz"
  (folder / name).write_bytes(data)
  return {
    "url": name,
    "encoding": "gzip",
    "bytes": len(data),
    "decodedBytes": len(raw),
    "sha256": hashlib.sha256(data).hexdigest(),
  }


def triangles(meshes: list[dict]) -> int:
  """Count actual indexed triangles after centimetre quantisation."""
  return sum(len(base64.b64decode(mesh["indices"])) // 12 for mesh in meshes)


def append_ink(packets: list[dict], edges: list, identity: str, bounds: tuple) -> None:
  """Source boundary lines, clipped without introducing tile-boundary seams."""
  segments = set()
  for a, b in edges:
    a, b = np.asarray(a), np.asarray(b)
    delta = b - a
    t0, t1 = 0.0, 1.0
    for axis, lo, hi in ((0, bounds[0], bounds[2]), (2, bounds[1], bounds[3])):
      if abs(delta[axis]) < 1e-10:
        if a[axis] < lo or a[axis] > hi:
          t1 = -1
          break
      else:
        u, v = (lo - a[axis]) / delta[axis], (hi - a[axis]) / delta[axis]
        t0, t1 = max(t0, min(u, v)), min(t1, max(u, v))
    if t1 <= t0:
      continue
    origin = np.asarray(packets[0]["origin"])
    ends = [
      tuple(np.rint((a + t * delta - origin) * 100).astype(int)) for t in (t0, t1)
    ]
    if ends[0] != ends[1]:
      assert all(0 <= x <= 65535 for end in ends for x in end)
      segments.add(tuple(sorted(ends)))
  segments = sorted(segments)
  for start in range(0, len(segments), 175_000):
    positions = np.array(segments[start : start + 175_000], dtype="<u2")
    line = {"positions": base64.b64encode(positions.tobytes()).decode()}
    # Keeping ink in its own bounded packet also leaves pre-existing accent
    # colours and line order completely unchanged.
    packet = empty_packet(f"{identity}-alt-mitte-v169-{len(packets)}", bounds)
    packet["origin"] = list(packets[0]["origin"])
    packet["lines"] = line
    assert fits(packet)
    packets.append(packet)
