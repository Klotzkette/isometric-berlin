"""Exact two-owner NKZ retirement and bounded v188 frontage complement receipts.

The complete required factory must be attached before these immutable receipts
can be applied. This script never writes an original source packet or manifest.
"""

from __future__ import annotations

import base64
import math
from typing import Any

import numpy as np
from build_karl_marx_allee_v161 import Detail, mesh_signature, packed_detail
from build_panorama_facade_v202 import fingerprint
from build_south_fidelity_v294 import APP, GEO, ROOT, read, sha, write
from build_surrounding_outlines import chunk_payload
from integrate_city_refinements_v166 import line_signature
from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import triangulate, unary_union

OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def unpack(mesh: dict[str, Any]) -> tuple[np.ndarray, np.ndarray]:
  v = np.column_stack(
    [
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
      np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
    ]
  )
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return v, ix


def build() -> None:
  data = read(APP / "southFidelityV294.json")
  descs = {c["id"]: c for c in read(OUT / "manifest.json")["chunks"]}
  owners = [
    {**o["previous"], "geometry": shape(o["previous"]["geometry"])}
    for o in data["nkzOwners"]
  ]
  packets = {}
  audit = []
  for mode in ["drawn", "minecraft"]:
    desc = descs["6_4"]
    tile = box(*desc["bounds"])
    path = OUT / desc[mode]["url"]
    packet = read(path)
    full = chunk_payload("6_4", tile, tile, owners, {}, minecraft=mode == "minecraft")
    empty = chunk_payload("6_4", tile, tile, [], {}, minecraft=mode == "minecraft")
    expected = mesh_signature(full) - mesh_signature(empty)
    assert expected and not expected - mesh_signature(packet)
    records = []
    for meshIndex, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "city":
        continue
      v, ix = unpack(mesh)
      removed = []
      for i, tri in enumerate(v[ix]):
        key = b"".join(sorted(q.tobytes() for q in tri))
        if expected[key]:
          expected[key] -= 1
          removed.append(i)
      if removed:
        records.append(
          dict(
            mesh=meshIndex,
            fingerprint=fingerprint(
              [mesh[k] for k in ["positions", "colors", "indices"]]
            ),
            triangles=removed,
          )
        )
    assert not +expected
    segments = []
    lineFingerprint = None
    if mode == "drawn":
      expected = line_signature(full["lines"]) - line_signature(empty["lines"])
      m = packet["lines"]
      v = np.column_stack(
        [
          np.frombuffer(base64.b64decode(m["positions"]), "<u2").reshape(-1, 3),
          np.frombuffer(base64.b64decode(m["colors"]), "u1").reshape(-1, 3),
        ]
      ).reshape(-1, 2, 6)
      for i, seg in enumerate(v):
        key = b"".join(sorted(q.tobytes() for q in seg))
        if expected[key]:
          expected[key] -= 1
          segments.append(i)
      assert not +expected
      lineFingerprint = fingerprint([m["positions"], m["colors"]])
    nav = [
      dict(owner=r["sourceId"], original=r, groundY=packet["nav"]["groundY"])
      for r in packet["nav"]["buildings"]
      if r["sourceId"] in {o["sourceId"] for o in owners}
    ]
    assert {n["owner"] for n in nav} == {o["sourceId"] for o in owners}
    solids = []
    ox, _, oz = packet["origin"]
    if mode == "drawn":
      for shell in data["nkzShells"]:
        for s in shell["solids"]:
          solids.append(
            {
              **s,
              "ring": [[x - ox, z - oz] for x, z in s["ring"]],
              "holes": [[[x - ox, z - oz] for x, z in r] for r in s["holes"]],
            }
          )
    else:
      for shell in data["nkzShells"]:
        for x, y, z, w, h, d, tone in shell["blocks"]:
          solids.append(
            dict(
              ring=[
                [x - w / 2 - ox, z - d / 2 - oz],
                [x + w / 2 - ox, z - d / 2 - oz],
                [x + w / 2 - ox, z + d / 2 - oz],
                [x - w / 2 - ox, z + d / 2 - oz],
              ],
              holes=[],
              minY=y - h / 2,
              maxY=y + h / 2,
            )
          )
    packets[mode + ":6_4"] = dict(
      origin=packet["origin"],
      records=records,
      segments=segments,
      lineFingerprint=lineFingerprint,
      navigationRecords=nav,
      navigationSolids=solids,
      sourcePacketSha256=sha(path),
    )
    audit.append(
      dict(
        key=mode + ":6_4",
        triangles=sum(len(r["triangles"]) for r in records),
        lines=len(segments),
        sourcePacketSha256=sha(path),
      )
    )

  # Remove only the actual intersections of the existing v188 facade fittings
  # with the mapped lower passage. Every outside triangle fragment is republished
  # in the same immutable-packet transaction, including interpolated colours.
  cut = LineString(data["passage"]["cutPoints"]).buffer(
    data["passage"]["widthEstimateM"] / 2, cap_style=2
  )
  sourcePlan = unary_union(
    [shape(o["previous"]["geometry"]) for o in data["nkzOwners"]]
  )
  for mode in ["drawn", "minecraft"]:
    desc = descs["district188-6_4"]
    path = OUT / desc[mode]["url"]
    packet = read(path)
    ox, oy, oz = packet["origin"]
    records = []
    complement = Detail()
    for meshIndex, mesh in enumerate(packet["meshes"]):
      v, ix = unpack(mesh)
      removed = []
      for i, indices in enumerate(ix):
        tri = v[indices]
        ps = tri[:, :3].astype(float) / 100 + np.array([ox, oy, oz])
        if min(ps[:, 1]) >= 7.5 or max(ps[:, 1]) - min(ps[:, 1]) < 0.01:
          continue
        if not all(
          sourcePlan.buffer(1.0).covers(
            __import__("shapely").geometry.Point(p[0], p[2])
          )
          for p in ps
        ):
          continue
        aa, bb = max(
          ((a, b) for a in ps for b in ps),
          key=lambda p: math.hypot(p[0][0] - p[1][0], p[0][2] - p[1][2]),
        )
        le = math.hypot(bb[0] - aa[0], bb[2] - aa[2])
        if le < 0.005:
          continue
        dx = (bb[0] - aa[0]) / le
        dz = (bb[2] - aa[2]) / le
        crossing = LineString([[aa[0], aa[2]], [bb[0], bb[2]]]).intersection(cut)
        if crossing.geom_type != "LineString" or crossing.is_empty:
          continue
        uv = Polygon([[(p[0] - aa[0]) * dx + (p[2] - aa[2]) * dz, p[1]] for p in ps])
        us = [(x - aa[0]) * dx + (z - aa[2]) * dz for x, z in crossing.coords]
        retain = uv.difference(box(min(us), -100, max(us), 7.5))
        if abs(uv.area - retain.area) < 1e-8:
          continue
        # Existing v188 fitting triangles are flat-colour by construction.
        assert all(np.array_equal(tri[0, 3:], q[3:]) for q in tri)
        removed.append(i)
        for poly in [retain] if retain.geom_type == "Polygon" else retain.geoms:
          for t in triangulate(poly):
            if poly.covers(t):
              complement.polygon(
                [
                  [aa[0] + dx * u, y, aa[2] + dz * u]
                  for u, y in list(t.exterior.coords)[:3]
                ],
                tuple(map(int, tri[0, 3:])),
                "retained-v188-passage-complement",
              )
      if removed:
        records.append(
          dict(
            mesh=meshIndex,
            fingerprint=fingerprint(
              [mesh[k] for k in ["positions", "colors", "indices"]]
            ),
            triangles=removed,
          )
        )
    if records:
      packed = packed_detail(complement, box(*desc["bounds"]))
      if packed:
        packed["kind"] = "south-v294-retained-facade-complement"
      packets[mode + ":district188-6_4"] = dict(
        origin=packet["origin"],
        records=records,
        segments=[],
        lineFingerprint=None,
        navigationRecords=[],
        navigationSolids=[],
        complement=packed,
        sourcePacketSha256=sha(path),
      )
      audit.append(
        dict(
          key=mode + ":district188-6_4",
          triangles=sum(len(r["triangles"]) for r in records),
          retainedTriangles=len(complement.triangles),
          sourcePacketSha256=sha(path),
        )
      )
  write(
    APP / "southFidelityV294Packets.json",
    dict(schema=1, keys=list(packets), packets=packets),
  )
  write(
    GEO / "south-fidelity-v294-packet-evidence.json",
    dict(
      schema=1,
      retainedOwners=[o["sourceId"] for o in owners],
      allOriginalPacketsRetained=True,
      allOriginalSourceSheetsRetained=True,
      records=audit,
    ),
  )
  print(audit)


if __name__ == "__main__":
  build()
