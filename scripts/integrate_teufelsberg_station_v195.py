"""Subtract only the 23 exact station proxies from immutable finer-terrain stages."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import subprocess
from collections import Counter

import numpy as np
from build_karl_marx_allee_v161 import mesh_signature
from build_surrounding_outlines import chunk_payload, load_projected_polygon, world
from build_teufelsberg_station_v195 import GEO, ROOT, SOURCE, encode
from integrate_airports_v194 import signature_sha
from integrate_city_refinements_v166 import (
  line_signature,
  subtract_lines,
  subtract_meshes,
)
from shapely import STRtree
from shapely.geometry import Point, Polygon, box, shape

FAMILY = "outer187--18_4"
TERRAIN = GEO / "raw/teufelsberg-v195/packets"
STAGE = GEO / "raw/teufelsberg-v195/station-packets"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RECEIPT = GEO / "teufelsberg-station-v195-packet-audit.json"


def expected_subtraction(
  mode: str, descriptor: dict, offsets: dict
) -> tuple[Counter, Counter]:
  """Recreate named source proxies and precisely replay their existing rigid datum."""
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  records = [
    {
      "sourceId": r["id"],
      "geometry": shape(r["geometry"]),
      "height": r["height"],
      "minHeight": r["minHeight"],
      "heightSource": r["heightSource"],
    }
    for r in source["replacedOwners"]
  ]
  tile = box(*descriptor["bounds"])
  scope = world(
    load_projected_polygon(GEO / "bounds-outskirts-v187.geojson").difference(
      load_projected_polygon(GEO / "bounds-retained-v186.geojson")
    )
  )
  selected = chunk_payload(
    FAMILY, tile, scope.intersection(tile), records, {}, minecraft=mode == "minecraft"
  )
  empty = chunk_payload(
    FAMILY, tile, scope.intersection(tile), [], {}, minecraft=mode == "minecraft"
  )
  raw = subprocess.check_output(
    ["git", "show", f"v1.0.89:{(PUBLIC / descriptor[mode]['url']).relative_to(ROOT)}"],
    cwd=ROOT,
  )
  original = json.loads(gzip.decompress(raw))
  assert original["origin"] == selected["origin"]
  ox, oy, oz = original["origin"]
  polys = [
    Polygon(
      [(x + ox, z + oz) for x, z in b["ring"]],
      [[(x + ox, z + oz) for x, z in h] for h in b["holes"]],
    ).buffer(0.1)
    for b in original["nav"]["buildings"]
  ]
  tree = STRtree(polys)
  ids = [b.get("partId", b["sourceId"]) for b in original["nav"]["buildings"]]

  def elevated(counter: Counter) -> Counter:
    result = Counter()
    for key, n in counter.items():
      a = np.frombuffer(key, dtype="<u2").reshape(-1, 6).copy()
      p = Point(float(a[:, 0].mean() / 100 + ox), float(a[:, 2].mean() / 100 + oz))
      matches = [i for i in tree.query(p) if polys[i].covers(p)]
      assert matches, (
        "Every selected face/ink segment belongs to a recorded source proxy"
      )
      dy = offsets[ids[matches[0]]]
      a[:, 1] += round(dy * 100)
      result[b"".join(sorted(r.tobytes() for r in a))] += n
    return result

  return elevated(mesh_signature(selected) - mesh_signature(empty)), elevated(
    line_signature(selected["lines"]) - line_signature(empty["lines"])
  ) if mode == "drawn" else Counter()


def integrate() -> dict:
  """Write an independent third checkpoint; never mutate the terrain source stage."""
  terrain = json.loads((GEO / "teufelsberg-v195-packet-audit.json").read_bytes())
  detail = json.loads(gzip.decompress((GEO / terrain["details"]["url"]).read_bytes()))
  rows = [
    d
    for d in terrain["replacementDescriptors"] + terrain["extraDescriptors"]
    if d["id"] == FAMILY or d.get("detailCompanionOf") == FAMILY
  ]
  primary = next(d for d in rows if d["id"] == FAMILY)
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  owners = {r["id"] for r in source["replacedOwners"]}
  assert len(owners) == 23
  output = {d["id"]: copy.deepcopy(d) for d in rows}
  reports = []
  checkpoints = []
  for mode in ["drawn", "minecraft"]:
    remove, ink = expected_subtraction(mode, primary, detail["parentOffsets"])
    expected_faces = remove.copy()
    expected_ink = ink.copy()
    before_all = Counter()
    after_all = Counter()
    files = []
    packets = []
    for d in rows:
      raw = (TERRAIN / d[mode]["url"]).read_bytes()
      assert hashlib.sha256(raw).hexdigest() == d[mode]["sha256"]
      packets.append((d, raw, json.loads(gzip.decompress(raw))))
      checkpoints.append(
        {
          "id": d["id"],
          "mode": mode,
          "descriptor": d[mode],
          "gzipBase64": base64.b64encode(raw).decode(),
        }
      )
    for _, _, p in packets:
      before_all.update(mesh_signature(p))
    assert not remove - before_all, (
      f"Source-owner reconstruction mismatch: {mode}, {sum((remove - before_all).values())}"
    )
    for d, raw, before in packets:
      after = copy.deepcopy(before)
      local = mesh_signature(before) & remove
      after["meshes"] = subtract_meshes(after["meshes"], local.copy())
      remove -= local
      local_ink = Counter()
      if mode == "drawn" and before.get("lines", {}).get("positions"):
        local_ink = line_signature(before["lines"]) & ink
        after["lines"] = subtract_lines(after["lines"], local_ink.copy())
        ink -= local_ink
      after["nav"]["buildings"] = [
        b for b in before["nav"]["buildings"] if b["sourceId"] not in owners
      ]
      assert {k: v for k, v in before["nav"].items() if k != "buildings"} == {
        k: v for k, v in after["nav"].items() if k != "buildings"
      }
      assert mesh_signature(after) == mesh_signature(before) - local
      after_all.update(mesh_signature(after))
      plain = encode(after)
      packed = gzip.compress(plain, mtime=0, compresslevel=9)
      dest = STAGE / d[mode]["url"]
      dest.parent.mkdir(parents=True, exist_ok=True)
      dest.write_bytes(packed)
      descriptor = {
        **d[mode],
        "sha256": hashlib.sha256(packed).hexdigest(),
        "bytes": len(packed),
        "decodedBytes": len(plain),
      }
      output[d["id"]][mode] = descriptor
      files.append(
        {
          "id": d["id"],
          "oldDescriptor": d[mode],
          "newDescriptor": descriptor,
          "removedTriangles": sum(local.values()),
          "removedInk": sum(local_ink.values()),
          "removedNavOwners": [
            b["sourceId"] for b in before["nav"]["buildings"] if b["sourceId"] in owners
          ],
        }
      )
    assert not remove and not ink
    assert before_all - expected_faces == after_all
    reports.append(
      {
        "mode": mode,
        "files": files,
        "removedTriangles": sum(expected_faces.values()),
        "removedInk": sum(expected_ink.values()),
        "preservedTriangles": sum(after_all.values()),
        "preservedSha256": signature_sha(after_all),
        "removedSha256": signature_sha(expected_faces),
      }
    )
  checkpoint_path = GEO / "teufelsberg-station-v195-terrain-checkpoint.json.gz"
  checkpoint_raw = encode(checkpoints)
  checkpoint_blob = gzip.compress(checkpoint_raw, mtime=0, compresslevel=9)
  assert len(checkpoint_blob) < 2_000_000
  checkpoint_path.write_bytes(checkpoint_blob)
  result = {
    "schemaVersion": 1,
    "family": FAMILY,
    "terrainAuditSha256": hashlib.sha256(
      (GEO / "teufelsberg-v195-packet-audit.json").read_bytes()
    ).hexdigest(),
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "terrainCheckpoint": {
      "url": checkpoint_path.name,
      "bytes": len(checkpoint_blob),
      "decodedBytes": len(checkpoint_raw),
      "sha256": hashlib.sha256(checkpoint_blob).hexdigest(),
    },
    "ownerIds": sorted(owners),
    "replacedSourceRecords": source["replacedOwners"],
    "modes": reports,
    "descriptors": list(output.values()),
    "policy": "Terrain checkpoints remain immutable. Complete family triangle/colour multisets lose only the independently replayed exact 23 OSM proxy owners and their source roof ink. All unrelated navigation and non-owner geometry remain exact; replacement solids come from the station runtime model.",
  }
  RECEIPT.write_text(json.dumps(result, indent=2) + "\n")
  return result


if __name__ == "__main__":
  print([(r["mode"], r["removedTriangles"]) for r in integrate()["modes"]])
