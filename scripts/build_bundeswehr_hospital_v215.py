"""Correct one obsolete modern hospital roof; preserve immutable source packets."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_alt_mitte_v169 as core
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_karl_marx_allee_v161 import Detail, clip_polygon, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint, signature, vertices
from build_scheunenviertel_v168 import merge_native_faces

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src/app/src/data"
PARENT = "DEBE01YYK0000365"
PART = "DEBE3DbYCNYOhBDw"
BOUNDS = (-512, -2048, 0, -1536)
MAIN = 33.878
TECH = 38.078
EAVE = 30.837


def dump(path, obj):
  path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + "\n")


def detail_difference(a, b):
  def key(t):
    return (
      tuple(sorted(tuple(round(float(v), 7) for v in p) for p in t[0])),
      tuple(t[1]),
    )

  wanted = Counter(key(t) for t in b.triangles)
  out = Detail()
  for t in a.triangles:
    k = key(t)
    if wanted[k]:
      wanted[k] -= 1
    else:
      out.triangles.append(t)
  return out


def build():
  records = []
  manifest = json.loads((core.SOURCE / "source-manifest.json").read_bytes())
  for c in manifest["chunks"]:
    records.extend(
      json.loads(gzip.decompress((core.SOURCE / c["file"]).read_bytes()))["buildings"]
    )
  building = next(b for b in records if b["id"] == PARENT)
  occupied = unary_union([core.footprint(b) for b in records])
  appearance = json.loads(
    gzip.decompress((core.SOURCE / "appearance-baseline.json.gz").read_bytes())
  )
  ranks = {}
  for previous in appearance["records"]:
    for binding in previous["bindings"]:
      for p in binding["parts"]:
        rank = (p["match"] == "leaf-id", p["overlapAreaM2"])
        if rank > ranks.get(p["partId"], (False, -1)):
          core.APPEARANCE[p["partId"]] = previous
          ranks[p["partId"]] = rank
  changed = copy.deepcopy(building)
  part = next(p for p in changed["parts"] if p["id"] == PART)
  original = copy.deepcopy(part)
  footprint = Polygon(
    part["footprintPolygons"][0]["ring"], part["footprintPolygons"][0]["holes"]
  )
  evidence = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v215-bdom.json"
    ).read_bytes()
  )
  basis = evidence["basis"]
  centre = np.array(basis["centre"])
  u = np.array(basis["u"])
  v = np.array(basis["v"])
  # Orthophoto-derived technical extension, checked against centre bDOM samples.
  technical = Polygon(
    [centre + u * a + v * b for a, b in [(-19, -4.5), (20, -4.5), (20, 8), (-19, 8)]]
  ).intersection(footprint)
  surfaces = []
  for surface in original["surfaces"]:
    if surface["kind"] == "RoofSurface":
      continue
    clipped = [clip_polygon(r, 1, EAVE, False) for r in surface["rings"]]
    clipped = [
      r
      for r in clipped
      if len(r) >= 3
      and np.linalg.norm(
        sum((np.cross(a, b) for a, b in zip(r, r[1:] + r[:1])), np.zeros(3))
      )
      > 1e-8
    ]
    if clipped:
      surfaces.append({**surface, "rings": clipped})

  def shell(poly, low, high, base=False):
    poly = orient(poly, sign=-1)
    rings = [
      list(poly.exterior.coords)[:-1],
      *[list(r.coords)[:-1] for r in poly.interiors],
    ]
    for ring in rings:
      for (ax, az), (bx, bz) in zip(ring, ring[1:] + ring[:1]):
        surfaces.append(
          {
            "kind": "WallSurface",
            "rings": [[[ax, low, az], [bx, low, bz], [bx, high, bz], [ax, high, az]]],
          }
        )
    surfaces.append(
      {"kind": "RoofSurface", "rings": [[[x, high, z] for x, z in r] for r in rings]}
    )

  shell(footprint, EAVE, MAIN)
  shell(technical, MAIN, TECH)
  part["surfaces"] = surfaces
  part["topY"] = TECH
  old_shell, old_front, _, _ = core.model(building, occupied)
  new_shell, new_front, new_nav, new_roofs = core.model(changed, occupied)
  old_full = Detail()
  old_full.triangles = old_shell.triangles + old_front.triangles
  new_full = Detail()
  new_full.triangles = new_shell.triangles + new_front.triangles
  print("native original", flush=True)
  old_native = merge_native_faces(native_detail(old_full))
  print("native corrected", flush=True)
  new_native = merge_native_faces(native_detail(new_full))
  diffs = {
    "drawn": (
      detail_difference(old_shell, new_shell),
      detail_difference(new_shell, old_shell),
    ),
    "front": (
      detail_difference(old_front, new_front),
      detail_difference(new_front, old_front),
    ),
    "minecraft": (
      detail_difference(old_native, new_native),
      detail_difference(new_native, old_native),
    ),
  }
  print(
    "diffs",
    {k: [len(a.triangles), len(b.triangles)] for k, (a, b) in diffs.items()},
    flush=True,
  )
  transfer = []
  original_packets = []
  corrections = {}
  for mode in ["drawn", "minecraft"]:
    folder = OUT / ("altMitteV169Drawn" if mode == "drawn" else "altMitteV169Native")
    ts = (
      OUT
      / ("altMitteDrawnV169Data.ts" if mode == "drawn" else "altMitteNativeV169Data.ts")
    ).read_text()
    import re

    names = dict(
      (int(n), identity)
      for identity, n in re.findall(r'\{id:"([^"]+)",packet:p(\d+)\}', ts)
    )
    candidates = [
      (f"alt-mitte-v169-{names[int(p.stem[-3:])]}", p, json.loads(p.read_bytes()))
      for p in sorted(folder.glob("packet-*.json"))
      if names[int(p.stem[-3:])].startswith("-1_-4")
    ]
    # Separately streamed v169 window layer also contains old gable glazing.
    if mode == "drawn":
      pub = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
      for p in sorted(pub.glob("-1_-4*.drawn.json.gz")):
        candidates.append(
          (
            p.name.removesuffix(".drawn.json.gz"),
            p,
            json.loads(gzip.decompress(p.read_bytes())),
          )
        )
    for which in [mode, "front"] if mode == "drawn" else [mode]:
      before, after = diffs[which]
      wanted_by_origin = {}
      matched = 0
      for tile, path, packet in candidates:
        if which == "front" and tile.startswith("alt-mitte-v169-"):
          continue
        if which != "front" and not tile.startswith("alt-mitte-v169-"):
          continue
        origin = packet["origin"]
        expected = pack_detail(
          core.isometric_shading(before) if mode == "drawn" else before,
          BOUNDS,
          origin_y=origin[1],
        )
        wanted = Counter()
        for m in expected:
          verts = vertices(m)
          inds = np.frombuffer(base64.b64decode(m["indices"]), dtype="<u4").reshape(
            -1, 3
          )
          wanted.update(signature(t) for t in verts[inds])
        # Across split packets consume matches once, with packet-specific origin.
        key = tuple(origin)
        if key not in wanted_by_origin:
          wanted_by_origin[key] = wanted
        remaining = wanted_by_origin[key]
        for m in packet["meshes"]:
          if m["kind"] != "alt-mitte-v169":
            continue
          verts = vertices(m)
          inds = np.frombuffer(base64.b64decode(m["indices"]), dtype="<u4").reshape(
            -1, 3
          )
          triangles = []
          for i, t in enumerate(verts[inds]):
            sig = signature(t)
            if remaining[sig]:
              triangles.append(i)
              remaining[sig] -= 1
          if triangles:
            matched += len(triangles)
            transfer.append(
              dict(
                tile=tile,
                kind=m["kind"],
                mode=mode,
                fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
                triangles=triangles,
                part=PART,
                layer=which,
              )
            )
            original_packets.append(
              {
                "file": str(path.relative_to(ROOT)),
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
              }
            )
      missing = sum(sum(c.values()) for c in wanted_by_origin.values())
      assert missing == 0, (which, missing, matched)
    addition = Detail()
    addition.triangles = diffs[mode][1].triangles[:]
    if mode == "drawn":
      addition.triangles.extend(diffs["front"][1].triangles)
    packet = empty_packet("hospital-corrected-v215", BOUNDS)
    packet["meshes"] = pack_detail(
      core.isometric_shading(addition) if mode == "drawn" else addition, BOUNDS
    )
    corrections[mode] = packet

  # Old roof/gable ink: retire only exact boundary segments not retained in the new source.
  def edges(p):
    return [
      (a, b)
      for s in p["surfaces"]
      if s["kind"] in ["WallSurface", "RoofSurface", "ClosureSurface"]
      for r in s["rings"]
      for a, b in zip(r, r[1:] + r[:1])
    ]

  def packed_edges(e, origin):
    result = set()
    for a, b in e:
      pts = [tuple(np.rint((np.asarray(q) - origin) * 100).astype(int)) for q in [a, b]]
      if pts[0] != pts[1]:
        result.add(tuple(sorted(pts)))
    return result

  old_edges, new_edges = edges(original), edges(part)
  line_records = []
  for path in sorted((OUT / "altMitteV169Drawn").glob("packet-*.json")):
    packet = json.loads(path.read_bytes())
    if (
      packet["origin"][0] != BOUNDS[0]
      or packet["origin"][2] != BOUNDS[1]
      or "lines" not in packet
    ):
      continue
    origin = np.asarray(packet["origin"])
    old = packed_edges(old_edges, origin)
    new = packed_edges(new_edges, origin)
    # Ink is deduplicated across source parts: a shared edge belongs to every
    # contributor and must survive if another unchanged part still needs it.
    other_edges = packed_edges(
      [edge for p in building["parts"] if p["id"] != PART for edge in edges(p)],
      origin,
    )
    obsolete = old - new - other_edges
    line = packet["lines"]
    values = np.frombuffer(base64.b64decode(line["positions"]), dtype="<u2").reshape(
      -1, 2, 3
    )
    segments = [
      i for i, p in enumerate(values) if tuple(sorted(tuple(q) for q in p)) in obsolete
    ]
    if segments:
      original_packets.append(
        {
          "file": str(path.relative_to(ROOT)),
          "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        }
      )
      drawn_ts = (OUT / "altMitteDrawnV169Data.ts").read_text()
      idx = int(path.stem[-3:])
      identity = re.search(r'\{id:"([^"]+)",packet:p' + str(idx) + r"\}", drawn_ts)[1]
      line_records.append(
        dict(
          tile="alt-mitte-v169-" + identity,
          mode="drawn",
          fingerprint=fingerprint([line["positions"], line.get("colors", "")]),
          segments=segments,
        )
      )
    # Only new edges missing from the original are added; old lower ink remains.
    new_only = [
      (np.array(a) / 100 + origin, np.array(b) / 100 + origin)
      for a, b in sorted(new - old)
    ]
    positions = np.array(
      [
        [
          np.rint((q - np.array(corrections["drawn"]["origin"])) * 100).astype(int)
          for q in ends
        ]
        for ends in new_only
      ],
      dtype="<u2",
    )
    corrections["drawn"]["lines"] = {
      "positions": base64.b64encode(positions.tobytes()).decode()
    }
  # Existing v214 lower wall glazing remains byte-for-byte. Only upper erroneous
  # gable fittings are retired, and roofline strips moved to the flat parapet.
  detail = json.loads((OUT / "bundeswehrHospitalV214.json").read_bytes())
  faces = {
    i
    for i, f in enumerate(
      json.loads(
        (
          ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v214-facades.json"
        ).read_bytes()
      )
    )
    if f["part"] == PART
  }
  adjustments = {}
  for mode, key in [("drawn", "boxes"), ("minecraft", "blocks")]:
    moves = []
    retire = []
    for i, row in enumerate(detail[key]):
      role = row[-1]
      if ":" not in role or int(role.split(":", 1)[0]) not in faces:
        continue
      if row[1] + row[4] / 2 > MAIN:
        if role.endswith(":eaves"):
          moves.append([i, MAIN - 0.24])
        else:
          retire.append(i)
    adjustments[mode] = {"moveY": moves, "retire": retire}
  native_cells = core.native_roofs(new_native)
  old_cells = core.native_roofs(old_native)
  changed_cells = [
    [x, z, old_cells.get((x, z)), native_cells.get((x, z))]
    for x, z in sorted(set(old_cells) | set(native_cells))
    if old_cells.get((x, z)) != native_cells.get((x, z))
  ]
  receipt = {
    "schemaVersion": 1,
    "owner": PARENT,
    "part": PART,
    "ring": list(footprint.exterior.coords)[:-1],
    "technicalRing": list(technical.exterior.coords)[:-1],
    "groundY": 5.2,
    "roofY": MAIN,
    "technicalRoofY": TECH,
    "oldPart": original,
    "correctedPart": part,
    "records": transfer,
    "lineRecords": line_records,
    "originalPackets": original_packets,
    "adjustments": adjustments,
    "oldTargetRoofs": [
      t
      for q in original["surfaces"]
      if q["kind"] == "RoofSurface"
      for t in core.triangulate(q["rings"])
    ],
    "newFamilyRoofs": new_roofs,
    "nativeChangedRoofCells": changed_cells,
    "counts": {
      "transferredTriangles": sum(len(r["triangles"]) for r in transfer),
      "transferredLines": sum(len(r["segments"]) for r in line_records),
      "drawnAddedTriangles": sum(
        len(base64.b64decode(m["indices"])) // 12
        for m in corrections["drawn"]["meshes"]
      ),
      "nativeAddedTriangles": sum(
        len(base64.b64decode(m["indices"])) // 12
        for m in corrections["minecraft"]["meshes"]
      ),
    },
  }
  # Runtime receipt excludes bulky retained source snapshots, which stay in audit.
  dump(
    ROOT / "geo_data/regierungsviertel/bundeswehr-hospital-v215-correction.json",
    receipt,
  )
  dump(
    OUT / "bundeswehrHospitalV215Ownership.json",
    {k: receipt[k] for k in ["owner", "part", "records", "lineRecords", "adjustments"]},
  )
  dump(
    OUT / "bundeswehrHospitalV215Navigation.json",
    {
      k: receipt[k]
      for k in [
        "ring",
        "technicalRing",
        "roofY",
        "technicalRoofY",
        "oldTargetRoofs",
        "newFamilyRoofs",
        "nativeChangedRoofCells",
      ]
    },
  )
  for mode, p in corrections.items():
    dump(OUT / f"bundeswehrHospitalV215{mode.title()}.json", p)
  print(receipt["counts"])
  print("adjustments", adjustments)


if __name__ == "__main__":
  build()
