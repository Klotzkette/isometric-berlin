"""Final one-family exact ownership transfer after immutable v201 terrain stage."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
from collections import Counter

import numpy as np
from build_karl_marx_allee_v161 import mesh_signature
from build_surrounding_outlines import COLORS, chunk_payload, linear_rgb_bytes
from build_waldbuehne_v201 import GEO, PROXIES, RAW, encode, source
from build_weinberg_terrain_packets_v176 import array64, elevate_lines, elevate_mesh
from integrate_airports_v194 import signature_sha
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely import STRtree, constrained_delaunay_triangles
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

FAMILY = "outer187--19_0"
CHECKPOINT = GEO / "waldbuehne-v201-packet-checkpoint.json.gz"
RECEIPT = GEO / "waldbuehne-v201-packet-audit.json"


def digest(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


def stage() -> dict:
  prior = json.loads((GEO / "olympic-v201-manifest-patch.json").read_bytes())
  descriptors = [
    d
    for d in prior["chunks"]
    if d["id"] == FAMILY or d.get("detailCompanionOf") == FAMILY
  ]
  olddir = GEO / "raw/olympic-v201/packets"
  checkpoint = []
  packets = {}
  for d in descriptors:
    for mode in ("drawn", "minecraft"):
      raw = (olddir / d[mode]["url"]).read_bytes()
      assert digest(raw) == d[mode]["sha256"]
      checkpoint.append(
        {
          "id": d["id"],
          "mode": mode,
          "descriptor": d[mode],
          "gzipBase64": base64.b64encode(raw).decode(),
        }
      )
      packets[d["id"], mode] = json.loads(gzip.decompress(raw))
  CHECKPOINT.write_bytes(gzip.compress(encode(checkpoint), mtime=0))
  masks = json.loads((GEO / "waldbuehne-v201-ground-masks.json").read_bytes())
  records = [{**r, "geometry": shape(r["geometry"])} for r in source()["proxyRecords"]]
  # All23 owner aliases must exist in baseline navigation; never broad-mask a city.
  oldnav = {
    b["sourceId"]: b
    for d in descriptors
    for b in packets[d["id"], "drawn"]["nav"]["buildings"]
    if b["sourceId"] in PROXIES
  }
  assert set(oldnav) == PROXIES, set(oldnav) ^ PROXIES
  tile = box(*descriptors[0]["bounds"])
  empty = {}
  replays = {}
  ink_replays = {}
  replay_records = {}
  for mode in ("drawn", "minecraft"):
    native = mode == "minecraft"
    remove = Counter()
    ink = Counter()
    rows = []
    empty[mode] = chunk_payload(FAMILY, tile, tile, [], {}, minecraft=native)
    shapes = []
    offsets = []
    for dd in descriptors:
      pp = packets[dd["id"], mode]
      ox, _, oz = pp["origin"]
      for b in pp["nav"]["buildings"]:
        shapes.append(
          Polygon(
            [(x + ox, z + oz) for x, z in b["ring"]],
            [[(x + ox, z + oz) for x, z in h] for h in b["holes"]],
          ).buffer(0.1)
        )
        offsets.append(b.get("groundOffset", 0))
    tree = STRtree(shapes)

    class Owners:
      def lookup(self, points):
        p = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
        for idx in tree.query(p):
          if shapes[idx].covers(p):
            return offsets[idx]
        return None

    owners = Owners()
    for r in records:
      q = chunk_payload(FAMILY, tile, tile, [r], {}, minecraft=native)
      geometry = mesh_signature(q) - mesh_signature(empty[mode])
      assert geometry
      # Remove only baseline ground from this one-owner replay before applying
      # its exact pre-transfer recorded rigid offset to every remaining face.
      q["meshes"] = subtract_meshes(q["meshes"], mesh_signature(empty[mode]).copy())
      dy = oldnav[r["sourceId"]].get("groundOffset", 0)
      for i, m in enumerate(q["meshes"]):
        q["meshes"][i], _ = elevate_mesh(
          m, q["origin"], {}, owners.lookup, minecraft=native
        )
      sig = mesh_signature(q)
      remove.update(sig)
      available = sum(
        (mesh_signature(packets[d["id"], mode]) for d in descriptors), Counter()
      )
      if sig - available:
        print(
          "missing",
          mode,
          r["sourceId"],
          sum((sig - available).values()),
          "of",
          sum(sig.values()),
          flush=True,
        )
      if not native:
        q["lines"], _ = elevate_lines(q["lines"], q["origin"], owners, {})
        oneink = line_signature(q["lines"])
        ink.update(oneink)
      else:
        oneink = Counter()
      rows.append(
        {
          "sourceId": r["sourceId"],
          "groundOffset": dy,
          "triangles": sum(sig.values()),
          "triangleSha256": signature_sha(sig),
          "inkSegments": sum(oneink.values()),
          "inkSha256": signature_sha(oneink),
        }
      )
    allsig = sum(
      (mesh_signature(packets[d["id"], mode]) for d in descriptors), Counter()
    )
    assert not remove - allsig, (
      mode,
      "unmatched exact source replay",
      sum((remove - allsig).values()),
    )
    replays[mode] = remove
    ink_replays[mode] = ink
    replay_records[mode] = rows
  output = RAW / "packets"
  output.mkdir(parents=True, exist_ok=True)
  reports = []
  final = []
  ground_colours = {
    tuple(linear_rgb_bytes(np.asarray([COLORS[k]]))[0])
    for k in ["ground", "park", "path", "road", "rail"]
  }
  for d in descriptors:
    nd = copy.deepcopy(d)
    report = {"id": d["id"], "modes": {}}
    for mode in ("drawn", "minecraft"):
      p = copy.deepcopy(packets[d["id"], mode])
      before = mesh_signature(p)
      available = before & replays[mode]
      p["meshes"] = subtract_meshes(p["meshes"], available.copy())
      replays[mode] -= available
      removedink = (
        line_signature(p["lines"]) & ink_replays[mode]
        if p.get("lines", {}).get("positions")
        else Counter()
      )
      if removedink:
        p["lines"] = subtract_lines(p["lines"], removedink.copy())
        ink_replays[mode] -= removedink
      removednav = [b for b in p["nav"]["buildings"] if b["sourceId"] in PROXIES]
      p["nav"]["buildings"] = [
        b for b in p["nav"]["buildings"] if b["sourceId"] not in PROXIES
      ]
      # Fine clipping retains the exact old plane and material on every outside
      # fragment. The inside is replaced by the dedicated source floor, never
      # hidden with depthTest/polygonOffset tricks or a broad grass deletion.
      mask = shape(masks[mode])
      ground_runs = []
      for mi, m in enumerate(p["meshes"]):
        if m["kind"] != "city":
          continue
        pos = np.frombuffer(base64.b64decode(m["positions"]), dtype="<u2").reshape(
          -1, 3
        )
        col = np.frombuffer(base64.b64decode(m["colors"]), dtype="u1").reshape(-1, 3)
        ix = np.frombuffer(base64.b64decode(m["indices"]), dtype="<u4").reshape(-1, 3)
        origin = np.asarray(p["origin"])
        verts = []
        faces = []
        lookup = {}

        def add(ps, cs):
          for point, color in zip(ps, cs, strict=True):
            row = tuple(map(int, np.r_[point, color]))
            at = lookup.get(row)
            if at is None:
              at = len(verts)
              lookup[row] = at
              verts.append(row)
            faces.append(at)

        for j, t in enumerate(ix):
          w = pos[t] / 100 + origin
          rgb = col[t]
          if tuple(rgb[0]) not in ground_colours or not np.all(rgb == rgb[0]):
            add(pos[t], rgb)
            continue
          n = np.cross(w[1] - w[0], w[2] - w[0])
          axes = [0, 2]
          if abs(n[1]) > 1e-8:
            poly = Polygon(w[:, axes])
            if not poly.intersects(mask):
              add(pos[t], rgb)
              continue
            outside = poly.difference(mask)

            def lift(a, b):
              return [
                a,
                w[0, 1] - (n[0] * (a - w[0, 0]) + n[2] * (b - w[0, 2])) / n[1],
                b,
              ]
          else:
            axis = 0 if np.ptp(w[:, 0]) >= np.ptp(w[:, 2]) else 2
            other = 2 if axis == 0 else 0
            if np.ptp(w[:, axis]) < 1e-8 or abs(n[other]) < 1e-8:
              add(pos[t], rgb)
              continue
            axes = [axis, 1]
            poly = Polygon(w[:, axes])

            def lift(a, b):
              point = np.zeros(3)
              point[axis] = a
              point[1] = b
              point[other] = (
                w[0, other]
                - (n[axis] * (a - w[0, axis]) + n[1] * (b - w[0, 1])) / n[other]
              )
              return point

            lo, hi = float(w[:, axis].min()), float(w[:, axis].max())
            line = LineString(
              [np.asarray(lift(lo, 0))[[0, 2]], np.asarray(lift(hi, 0))[[0, 2]]]
            )
            section = line.intersection(mask.buffer(-1e-7))
            strips = []
            for piece in getattr(section, "geoms", [section]):
              if piece.geom_type != "LineString" or piece.length < 1e-7:
                continue
              positions = [q[0 if axis == 0 else 1] for q in piece.coords]
              strips.append(
                box(
                  min(positions), w[:, 1].min() - 1, max(positions), w[:, 1].max() + 1
                )
              )
            outside = poly.difference(unary_union(strips))
          if outside.area >= poly.area - 1e-9:
            add(pos[t], rgb)
            continue
          start = len(faces) // 3
          for tri in constrained_delaunay_triangles(outside).geoms:
            a = np.asarray([lift(x, y) for x, y in list(tri.exterior.coords)[:3]])
            if np.dot(np.cross(a[1] - a[0], a[2] - a[0]), n) < 0:
              a = a[::-1]
            add(np.rint((a - origin) * 100).astype("<u2"), np.tile(rgb[0], (3, 1)))
          ground_runs.append(
            {
              "mesh": mi,
              "sourceTriangle": j,
              "source": np.column_stack([pos[t], rgb]).tolist(),
              "outsideStart": start,
              "outsideCount": len(faces) // 3 - start,
              "projectionAxes": axes,
              "removedPlaneArea": poly.area - outside.area,
              "removedProjectedArea": poly.area - outside.area if axes == [0, 2] else 0,
            }
          )
        v = np.asarray(verts, dtype="<u2").reshape(-1, 6)
        p["meshes"][mi] = {
          **m,
          "positions": array64(v[:, :3].astype("<u2")),
          "colors": array64(v[:, 3:].astype("u1")),
          "indices": array64(np.asarray(faces, dtype="<u4")),
        }
      raw = encode(p)
      packed = gzip.compress(raw, mtime=0, compresslevel=9)
      assert len(raw) < 2600000 and len(packed) < 650000
      path = output / d[mode]["url"]
      path.parent.mkdir(parents=True, exist_ok=True)
      path.write_bytes(packed)
      nd[mode] = {
        **d[mode],
        "bytes": len(packed),
        "decodedBytes": len(raw),
        "sha256": digest(packed),
      }
      report["modes"][mode] = {
        "oldDescriptor": d[mode],
        "newDescriptor": nd[mode],
        "removedTriangles": sum(available.values()),
        "removedTriangleSha256": signature_sha(available),
        "removedInkSegments": sum(removedink.values()),
        "removedInkSha256": signature_sha(removedink),
        "removedNav": removednav,
        "groundCuts": ground_runs,
      }
      if mode == "drawn" and "buildingCount" in d:
        nd["buildingCount"] = max(
          0, d["buildingCount"] - len({b["sourceId"] for b in removednav})
        )
      print(
        d["id"],
        mode,
        "removed",
        sum(available.values()),
        "groundcuts",
        len(ground_runs),
        "bytes",
        len(packed),
        flush=True,
      )
    reports.append(report)
    final.append(nd)
  assert all(not c for c in replays.values()) and all(
    not c for c in ink_replays.values()
  )
  result = {
    "schemaVersion": 1,
    "transition": "after olympic-v201 terrain; exact Waldbuehne ownership and precise source-floor ground cutouts",
    "baselineDescriptors": descriptors,
    "replacementDescriptors": final,
    "checkpoint": {"url": CHECKPOINT.name, "sha256": digest(CHECKPOINT.read_bytes())},
    "sourceOwners": sorted(PROXIES),
    "sourceRecords": SOURCE_NAME,
    "ownerReplay": replay_records,
    "groundMasks": {
      "url": "waldbuehne-v201-ground-masks.json",
      "sha256": digest((GEO / "waldbuehne-v201-ground-masks.json").read_bytes()),
    },
    "packets": reports,
  }
  RECEIPT.write_bytes(encode(result))
  (RAW / "manifest-patch.json").write_bytes(encode({"chunks": final}))
  return result


SOURCE_NAME = "waldbuehne-v201-source.json.gz"
if __name__ == "__main__":
  stage()
