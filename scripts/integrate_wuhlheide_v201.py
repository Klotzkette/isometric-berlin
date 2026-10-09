"""Private, immutable-v100 packet draping with exact two-owner replacement."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import subprocess
from collections import Counter

import build_weinberg_terrain_packets_v176 as terrain
import geopandas as gpd
import numpy as np
from build_karl_marx_allee_v161 import mesh_signature
from build_surrounding_outlines import chunk_payload
from build_wuhlheide_v201 import (
  GEO,
  NATIVE_STEP,
  PROXIES,
  RAW,
  ROOT,
  SOURCE,
  STEP,
  SUPPORT,
  encode,
  offset_at,
)
from integrate_airports_v194 import signature_sha
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely import STRtree
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union

PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
CHECKPOINT = GEO / "wuhlheide-v201-packet-checkpoint.json.gz"
RECEIPT = GEO / "wuhlheide-v201-packet-audit.json"
BASE = "v1.0.100"


def original(path):
  return subprocess.check_output(
    ["git", "show", f"{BASE}:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def arrays(mesh, origin):
  p = (
    np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + origin
  )
  c = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  i = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
  return p, c, i


def stage():
  manifest = json.loads(original(PUBLIC / "manifest.json"))
  support = box(*SUPPORT)
  selected = [d for d in manifest["chunks"] if support.intersects(box(*d["bounds"]))]
  baseline = {}
  checkpoints = []
  for d in selected:
    for mode in ["drawn", "minecraft"]:
      raw = original(PUBLIC / d[mode]["url"])
      assert hashlib.sha256(raw).hexdigest() == d[mode]["sha256"]
      baseline[d["id"], mode] = json.loads(gzip.decompress(raw))
      checkpoints.append(
        {
          "id": d["id"],
          "mode": mode,
          "descriptor": d[mode],
          "gzipBase64": base64.b64encode(raw).decode(),
        }
      )
  CHECKPOINT.write_bytes(gzip.compress(encode(checkpoints), mtime=0, compresslevel=9))
  records = gpd.read_file(
    GEO / "raw/east-city-v200/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN ('OSM-way-20418995','OSM-way-33468397')",
  ).to_dict("records")
  assert {r["sourceId"] for r in records} == PROXIES
  terrain.SUPPORT = SUPPORT
  terrain.STEP = STEP
  terrain.NATIVE_STEP = NATIVE_STEP
  terrain.sample_offset = lambda x, z: offset_at(x, z)
  terrain.sample_native_offset = lambda x, z: offset_at(x, z, True)
  descriptors, reports = [], []
  output = RAW / "packets"
  output.mkdir(exist_ok=True)
  for d in selected:
    new = copy.deepcopy(d)
    report = {"id": d["id"], "modes": {}}
    tile = box(*d["bounds"])
    for mode in ["drawn", "minecraft"]:
      minecraft = mode == "minecraft"
      before = baseline[d["id"], mode]
      p = copy.deepcopy(before)
      origin = np.asarray(p["origin"])
      ox, _, oz = origin
      active = [r for r in records if r["geometry"].intersects(tile)]
      remove, ink = Counter(), Counter()
      if active:
        a = chunk_payload(d["id"], tile, tile, active, {}, minecraft=minecraft)
        empty = chunk_payload(d["id"], tile, tile, [], {}, minecraft=minecraft)
        remove = mesh_signature(a) - mesh_signature(empty)
        assert remove and not remove - mesh_signature(before), (
          d["id"],
          mode,
          "exact replacement failed",
        )
        p["meshes"] = subtract_meshes(p["meshes"], remove.copy())
        if not minecraft:
          ink = line_signature(a["lines"]) - line_signature(empty["lines"])
          assert not ink - line_signature(before["lines"])
          p["lines"] = subtract_lines(p["lines"], ink.copy())
      removed_nav = [b for b in p["nav"]["buildings"] if b["sourceId"] in PROXIES]
      p["nav"]["buildings"] = [
        b for b in p["nav"]["buildings"] if b["sourceId"] not in PROXIES
      ]
      assert mesh_signature(p) == mesh_signature(before) - remove
      # Complete parent geometry unions across every adjoining baseline packet.
      parts = {}
      for other in selected:
        q = baseline[other["id"], mode]
        qx, _, qz = q["origin"]
        for b in q["nav"]["buildings"]:
          key = b.get("partId", b["sourceId"])
          parts.setdefault(key, []).append(
            Polygon(
              [(x + qx, z + qz) for x, z in b["ring"]],
              [[(x + qx, z + qz) for x, z in h] for h in b["holes"]],
            )
          )
      offsets = {}
      for key, polys in parts.items():
        anchor = unary_union(polys).representative_point()
        offsets[key] = round(offset_at(anchor.x, anchor.y, minecraft), 2)
      footprints = []
      values = []
      for b in p["nav"]["buildings"]:
        footprints.append(
          Polygon(
            [(x + ox, z + oz) for x, z in b["ring"]],
            [[(x + ox, z + oz) for x, z in h] for h in b["holes"]],
          ).buffer(0.08)
        )
        values.append(offsets[b.get("partId", b["sourceId"])])
      tree = STRtree(footprints)

      class Owners:
        def lookup(self, points):
          center = Point(float(points[:, 0].mean()), float(points[:, 2].mean()))
          for j in tree.query(center):
            if footprints[j].covers(center):
              return values[j]
          return None

      owners = Owners()
      audits = []
      for i, m in enumerate(p["meshes"]):
        positions, colors, indices = arrays(m, origin)
        exact = {}
        if m["kind"] == "outskirts-v187-forest":
          assert len(indices) % 18 == 0
          for start in range(0, len(indices), 18):
            trunk = positions[indices[start : start + 8].ravel()]
            x = (trunk[:, 0].min() + trunk[:, 0].max()) / 2
            z = (trunk[:, 2].min() + trunk[:, 2].max()) / 2
            dy = round(offset_at(x, z, minecraft), 2)
            for tri in indices[start : start + 18]:
              exact[
                terrain.triangle_key(np.rint(positions[tri] * 100).astype(np.int64))
              ] = dy
        p["meshes"][i], audit = terrain.elevate_mesh(
          m, p["origin"], exact, owners.lookup, minecraft=minecraft
        )
        audit["kind"] = m["kind"]
        audits.append(audit)
      if p.get("lines", {}).get("positions"):
        p["lines"], line_audit = terrain.elevate_lines(
          p["lines"], p["origin"], owners, {}
        )
      else:
        line_audit = {}
      for b in p["nav"]["buildings"]:
        dy = offsets[b.get("partId", b["sourceId"])]
        if dy:
          b["groundOffset"] = round(b.get("groundOffset", 0) + dy, 2)
      assert {k: v for k, v in before["nav"].items() if k != "buildings"} == {
        k: v for k, v in p["nav"].items() if k != "buildings"
      }
      plain = encode(p)
      packed = gzip.compress(plain, mtime=0, compresslevel=9)
      assert len(packed) <= 650000 and len(plain) <= 2600000, (
        d["id"],
        mode,
        len(packed),
        len(plain),
      )
      path = output / d[mode]["url"]
      path.parent.mkdir(parents=True, exist_ok=True)
      path.write_bytes(packed)
      new[mode] = {
        **d[mode],
        "sha256": hashlib.sha256(packed).hexdigest(),
        "bytes": len(packed),
        "decodedBytes": len(plain),
      }
      report["modes"][mode] = {
        "oldDescriptor": d[mode],
        "newDescriptor": new[mode],
        "removedTriangles": sum(remove.values()),
        "removedTriangleSha256": signature_sha(remove),
        "preservedSourceTriangles": sum((mesh_signature(before) - remove).values()),
        "preservedSourceTriangleSha256": signature_sha(mesh_signature(before) - remove),
        "removedInkSegments": sum(ink.values()),
        "removedNav": removed_nav,
        "meshes": audits,
        "lines": line_audit,
        "ownerOffsets": {k: v for k, v in offsets.items() if v},
      }
      if mode == "drawn":
        new["buildingCount"] = d["buildingCount"] - len(
          {b["sourceId"] for b in removed_nav}
        )
      print(d["id"], mode, len(packed), len(plain), flush=True)
    descriptors.append(new)
    reports.append(report)
  result = {
    "version": "1.0.101",
    "baselineRelease": BASE,
    "baselineManifestSha256": hashlib.sha256(
      original(PUBLIC / "manifest.json")
    ).hexdigest(),
    "support": SUPPORT,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "completeReplacementOwners": sorted(PROXIES),
    "sourceRecords": [
      {
        **{k: v for k, v in r.items() if k != "geometry"},
        "geometry": mapping(r["geometry"]),
      }
      for r in records
    ],
    "checkpoint": {
      "url": CHECKPOINT.name,
      "sha256": hashlib.sha256(CHECKPOINT.read_bytes()).hexdigest(),
    },
    "stagePath": str(output.relative_to(ROOT)),
    "descriptors": descriptors,
    "chunks": reports,
    "policy": "Every source triangle and segment survives either verbatim, rigidly translated, or subdivided onto the DGM without losing source XZ/colour. Only the exact replayed grandstand/roof fallback triangles and their collision bodies are replaced by source-bound open amphitheatre and tent geometry; all original source records retained. No tree is removed. No public file mutation.",
  }
  RECEIPT.write_text(json.dumps(result, indent=2) + "\n")
  (RAW / "manifest-patch.json").write_bytes(encode({"chunks": descriptors}))
  return result


if __name__ == "__main__":
  stage()
