"""Exact removal of two previously transferred Funkturm proxy-owner remnants.

A floating point footprint difference in v187 left zero-width, 59.82m-tall
walls. Keep complete old packets, every old vertex/colour and unrelated face.
Stage changed packets/descriptors only; root integration owns manifest publication.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
STAGE = GEO / "raw/funkturm-v199/packets"
OWNERS = {"DEBE04YY500006Zr": 129.81, "DEBE04YY50002bpq": 59.82}


def owner_polygons():
  source = json.loads((GEO / "west-landmarks-v187-source.json").read_text())
  return {
    p["parentId"]: unary_union(
      [Polygon(s["ring"], s["holes"]) for s in p["sourceParts"]]
    )
    for p in source["profiles"]
    if p["parentId"] in OWNERS
  }


def decode(text, dtype, dim):
  return np.frombuffer(base64.b64decode(text), dtype=dtype).reshape(-1, dim)


def repair_payload(payload):
  origin = np.array(payload["origin"])
  polys = owner_polygons()
  allowed = {oid: poly.buffer(0.022) for oid, poly in polys.items()}
  before = json.loads(json.dumps(payload))
  removed = []
  for mesh_index, mesh in enumerate(payload["meshes"]):
    assert mesh["positionType"] == "u16cm"
    points = decode(mesh["positions"], "<u2", 3) / 100 + origin
    faces = decode(mesh["indices"], "<u4", 3)
    keep = []
    for face_index, face in enumerate(faces):
      tri = points[face]
      owner = next(
        (
          oid
          for oid, poly in allowed.items()
          if abs(tri[:, 1].max() - (3 + OWNERS[oid])) < 0.025
          and tri[:, 1].min() >= 2.99
          and all(poly.covers(Point(x, z)) for x, _, z in tri)
        ),
        None,
      )
      if owner:
        removed.append({"mesh": mesh_index, "triangle": face_index, "sourceId": owner})
      else:
        keep.append(face)
    mesh["indices"] = base64.b64encode(np.array(keep, dtype="<u4").tobytes()).decode()
  line_receipt = []
  lines = payload.get("lines")
  if lines:
    points = decode(lines["positions"], "<u2", 3) / 100 + origin
    colors = decode(lines["colors"], "u1", 3)
    kept = []
    for i in range(0, len(points), 2):
      seg = points[i : i + 2]
      owner = next(
        (
          oid
          for oid, poly in allowed.items()
          if np.max(abs(seg[:, 1] - (3 + OWNERS[oid] + 0.02))) < 0.025
          and all(poly.covers(Point(x, z)) for x, _, z in seg)
        ),
        None,
      )
      if owner:
        line_receipt.append({"segment": i // 2, "sourceId": owner})
      else:
        kept.extend([i, i + 1])
    original_positions = decode(before["lines"]["positions"], "<u2", 3)
    lines["positions"] = base64.b64encode(original_positions[kept].tobytes()).decode()
    lines["colors"] = base64.b64encode(colors[kept].tobytes()).decode()
  nav = [b for b in payload["nav"]["buildings"] if b["sourceId"] in OWNERS]
  payload["nav"]["buildings"] = [
    b for b in payload["nav"]["buildings"] if b["sourceId"] not in OWNERS
  ]
  return payload, {
    "removedTriangles": removed,
    "removedLines": line_receipt,
    "removedNavigation": nav,
    "retainedPositionColorBuffers": True,
    "otherNavPreserved": True,
  }


def build():
  STAGE.mkdir(parents=True, exist_ok=True)
  manifest = json.loads((PUBLIC / "manifest.json").read_text())
  chunk = next(c for c in manifest["chunks"] if c["id"] == "outer187--13_2")
  receipt = {
    "version": "1.0.99",
    "chunk": chunk["id"],
    "ownerIds": list(OWNERS),
    "sourceProfiles": "west-landmarks-v187-source.json",
    "policy": "Remove only remnants of already fully transferred exact Funkturm owners; source sheets, all unrelated triangles and all positions/colors retained. Never filter by broad bbox.",
    "modes": {},
  }
  for mode in ["drawn", "minecraft"]:
    descriptor = chunk[mode].copy()
    archive = GEO / f"funkturm-v199-original-{chunk['id']}-{mode}.json.gz"
    if not archive.exists():
      archive.write_bytes((PUBLIC / descriptor["url"]).read_bytes())
    old = json.loads(gzip.decompress(archive.read_bytes()))
    result, info = repair_payload(json.loads(json.dumps(old)))
    raw = (
      json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
    ).encode()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    staged = STAGE / descriptor["url"]
    staged.parent.mkdir(parents=True, exist_ok=True)
    staged.write_bytes(packed)
    descriptor.update(
      bytes=len(packed),
      decodedBytes=len(raw),
      sha256=hashlib.sha256(packed).hexdigest(),
    )
    chunk[mode] = descriptor
    receipt["modes"][mode] = {
      "archive": archive.name,
      "archiveSha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
      "stagedPath": str(staged.relative_to(ROOT)),
      "descriptor": descriptor,
      **info,
    }
  (GEO / "funkturm-v199-packet-repair.json").write_text(
    json.dumps(receipt, indent=2) + "\n"
  )
  (GEO / "funkturm-v199-manifest-patch.json").write_text(
    json.dumps({"chunks": [chunk]}, separators=(",", ":")) + "\n"
  )
  print(
    {
      m: {
        "triangles": len(v["removedTriangles"]),
        "lines": len(v["removedLines"]),
        "nav": len(v["removedNavigation"]),
      }
      for m, v in receipt["modes"].items()
    }
  )


if __name__ == "__main__":
  build()
