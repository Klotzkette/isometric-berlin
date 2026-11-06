"""One source-contained brick school frontage at the current Strahl Kulturhaus.

The original body, roofs, courts, doors, packets and every index remain intact.
The venue photograph supports the arched heads/brick bands; sizes are estimates.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

from scripts.build_berlin_senate_v321 import owner_polygon, source_fronts
from scripts.build_cluster_facades_v320 import (
  FrontMesh,
  door_bounds,
  fnv,
  paint_with_door_holes,
  part_fingerprint,
)

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OWNER = "DEBE07YY900009Vl"
KIND = "youth-theatres-v322"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def compile_fronts():
  descriptor = next(
    d for d in read(PUBLIC / "manifest.json")["chunks"] if d["id"] == "-3_5"
  )
  drawn = read(PUBLIC / descriptor["drawn"]["url"])
  full = owner_polygon(drawn, OWNER)
  # The frozen original generic companion contains no window front for this
  # owner. A new complete grid must never overlay an old dedicated one.
  for filename in [
    "district-facades-v188-evidence.json.gz",
    "outer-facades-v230-evidence.json.gz",
  ]:
    prior = read(GEO / filename)
    assert not any(f.get("owner") == OWNER for f in prior.get("faces", []))
  doors = read(GEO / "house-doors-v233-evidence.json.gz")["doors"]
  plans, reports, inputs = {}, [], []
  for mode in ["drawn", "minecraft"]:
    native = mode == "minecraft"
    asset = descriptor[mode]
    raw = (PUBLIC / asset["url"]).read_bytes()
    packet = json.loads(gzip.decompress(raw))
    mesh = FrontMesh(packet["origin"])
    faces = [
      f
      for f in source_fronts(packet, {"owner": OWNER}, full, native)
      if f["normal"][0] < -0.94
    ]
    panes = 0
    for face in faces:
      face = dict(face, high=min(face["high"], face["low"] + 18.1))
      width = math.dist(face["a"], face["b"])
      bounds = door_bounds(face, doors, native)
      paint_with_door_holes(mesh, face, bounds, [143, 102, 77], 0.025)
      pitch = 4.15
      # Native uses its own cardinal wall stair segments. Small fragments
      # receive only masonry; no tiny independently repeated window grid.
      bays = max(1, round(width / 3.05)) if not native else (1 if width >= 1.7 else 0)
      for row in range(4):
        cy = face["low"] + 2.5 + row * pitch
        for col in range(bays):
          u = width * (col + 0.5) / bays
          w, h = min(1.35, width / max(1, bays) - 0.35), 2.15
          if (
            u - w / 2 < 0.12
            or u + w / 2 > width - 0.12
            or cy + h / 2 + 0.5 > face["high"]
          ):
            continue
          if any(
            u + w / 2 > x0 and u - w / 2 < x1 and cy + h / 2 > y0 and cy - h / 2 < y1
            for x0, y0, x1, y1 in bounds
          ):
            continue
          mesh.rectangle(
            face,
            u - w / 2 - 0.08,
            cy - h / 2 - 0.08,
            u + w / 2 + 0.08,
            cy + h / 2 + 0.08,
            0.09,
            [218, 215, 200],
          )
          mesh.rectangle(
            face, u - w / 2, cy - h / 2, u + w / 2, cy + h / 2, 0.13, [74, 102, 112]
          )
          mesh.rectangle(
            face, u - 0.035, cy - h / 2, u + 0.035, cy + h / 2, 0.16, [220, 218, 207]
          )
          mesh.rectangle(
            face, u - w / 2, cy + 0.28, u + w / 2, cy + 0.35, 0.16, [220, 218, 207]
          )
          # Brick arch is a narrow ring above the retained wall plane,
          # not a filled rectangular fake recess or a copied photo.
          for i in range(10):
            a, b = i * math.pi / 10, (i + 1) * math.pi / 10
            r, t = w / 2 + 0.13, 0.13
            vertices = [
              (u + math.cos(q) * rr, cy + h / 2 + math.sin(q) * rr * 0.47, 0.17)
              for q, rr in [(a, r), (b, r), (b, r + t), (a, r + t)]
            ]
            if native:
              left, right = sorted([vertices[0][0], vertices[1][0]])
              y = min(vertices[0][1], vertices[1][1])
              mesh.rectangle(
                face,
                left,
                y,
                right,
                y + 0.13,
                0.17,
                [104, 76, 59] if i % 2 else [168, 117, 85],
              )
            else:
              mesh.local_quad(
                face, vertices, [104, 76, 59] if i % 2 else [168, 117, 85]
              )
          panes += 1
      for floor in range(1, 4):
        y = face["low"] + 0.4 + floor * pitch
        mesh.rectangle(face, 0.12, y, width - 0.12, y + 0.13, 0.12, [111, 83, 65])
    assert faces and panes > 0, (mode, len(faces), panes)
    mesh.compact()
    append = mesh.payload()["meshes"][0]
    append["kind"] = KIND
    line = packet.get("lines")
    guard = fnv(line["positions"], line.get("colors", "")) if line else None
    plans[f"{mode}:-3_5"] = dict(
      origin=packet["origin"],
      navGuard=fnv(json.dumps(packet["nav"], separators=(",", ":"))),
      preparedNavGuard=0,
      lineGuard=guard,
      preparedLineGuard=guard,
      records=[
        dict(mesh=i, kind=p["kind"], fingerprint=part_fingerprint(p))
        for i, p in enumerate(packet["meshes"])
      ],
      append=append,
      appendFingerprint=part_fingerprint(append),
      retire=[],
      owners=[OWNER],
    )
    reports.append(
      dict(
        mode=mode,
        sourceFaces=faces,
        panes=panes,
        sourceMappedDoorsRetained=True,
        triangles=len(mesh.indices) // 3,
      )
    )
    inputs.append(
      dict(
        mode=mode,
        url=asset["url"],
        sha256=hashlib.sha256(raw).hexdigest(),
        bytes=len(raw),
      )
    )
  return dict(schemaVersion=1, keys=sorted(plans), packets=plans), dict(
    schemaVersion=1,
    site="Theater Strahl / Kulturhaus Schöneberg",
    address="Kyffhäuserstraße23",
    owner=OWNER,
    references=[
      "https://www.theater-strahl.de/spielorte/",
      "https://kulturhaus-schoeneberg.de/",
      "https://kulturhaus-schoeneberg.de/wp-content/uploads/2020/03/Kulturhaus_Schoeneberg.jpg",
    ],
    licenseNote="Reference-only venue photo, rights retained by its owner; no pixels distributed",
    inputs=inputs,
    reports=reports,
    sourceBodiesRetired=0,
    sourceFittingsRetired=0,
    sourcePacketBytesChanged=0,
    requiredPreparedGuardFinalization=True,
  )


def main():
  source, proof = compile_fronts()
  write(DATA / "youthTheatreFrontsV322Packets.json", source)
  write(DATA / "youthTheatreFrontsV322PacketIndex.json", {"keys": source["keys"]})
  write(GEO / "youth-theatre-fronts-v322-evidence.json.gz", proof)
  print(
    json.dumps(
      {
        "keys": source["keys"],
        "reports": [
          {k: v for k, v in r.items() if k != "sourceFaces"} for r in proof["reports"]
        ],
      }
    )
  )


if __name__ == "__main__":
  main()
