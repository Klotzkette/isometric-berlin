"""Bounded upper opening depth at retained August-/Oranienburger street fronts."""

from __future__ import annotations

import gzip
import json
import math
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from shapely.geometry import Polygon, box

sys.path.insert(0, str(Path(__file__).resolve().parent))

from scripts import build_north_mitte_fronts_v239 as old
from scripts import build_scheunen_v265 as fittings
from scripts.build_core_house_colours_v273 import protections
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint

ROOT, GEO, OUT = old.ROOT, old.GEO, old.OUT
SOURCE = GEO / "august-fronts-v274-source.json.gz"
EVIDENCE = GEO / "august-fronts-v274-evidence.json.gz"
RUNTIME = ROOT / "src/app/src/data/augustFrontsV274.json"
V270_OWNERS = {
  "DEBE01YYK00004fg",
  "DEBE01YYK00006o3",
  "DEBE01YYK0000EXQ",
  "DEBE01YYK00006Ft",
  "DEBE01YYK00002MI",
}
POLICY = "Upper depth only at exact retained panes on Auguststrasse and Oranienburger Strasse. Both original drawn triangles must match. Independently orthogonal native fittings require a complete actual delivered wall plane. No new window grid, glazing, colour pass, roof, navigation, descriptor or coverage; all earlier detail remains. Fitting sections and neutral tones are display estimates."


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def extract():
  """Reuse only the exact-pane extractor, always writing a NEW evidence path."""
  before = old.sha(old.SOURCE)
  saved = old.NAMES, old.EXCLUDED, old.SOURCE, old.POLICY
  protected, _ = protections()
  try:
    old.NAMES = {"Auguststraße", "Oranienburger Straße"}
    old.EXCLUDED = old.EXCLUDED | V270_OWNERS | protected
    old.SOURCE, old.POLICY = SOURCE, POLICY
    source = old.extract()
  finally:
    old.NAMES, old.EXCLUDED, old.SOURCE, old.POLICY = saved
  if before != old.sha(old.SOURCE):
    raise ValueError("Old v239 source was modified")
  source["choriner"] = []
  source["references"] = [
    "https://gdi.berlin.de/services/wfs/alkis_gebaeude",
    "https://www.openstreetmap.org/",
  ]
  source["previousV239Sha256"] = before
  source["excludedV270Owners"] = sorted(V270_OWNERS)
  write(SOURCE, source)
  return source


def native_surface_fit(point, normal, width, height, planes):
  candidates = []
  for plane in planes:
    axis, coordinate, poly = plane["axis"], plane["plane"], plane["polygon"]
    across = 2 if axis == 0 else 0
    distance = abs(point[axis] - coordinate)
    # Retained 4m coarse cells can put the exposed face over 2m from a
    # diagonal drawn pane. The finite 2.5m bound still requires full wall cover.
    if distance > 2.5 or abs(normal[axis]) < 0.65:
      continue
    required = box(
      point[across] - width / 2,
      point[1] - height / 2,
      point[across] + width / 2,
      point[1] + height / 2,
    )
    if not poly.buffer(0.01).covers(required):
      continue
    centre = list(point)
    centre[axis] = coordinate
    n = [0.0, 0.0, 0.0]
    n[axis] = math.copysign(1, normal[axis])
    t = [0.0, 0.0, 0.0]
    t[across] = 1.0
    candidates.append(
      (
        distance,
        dict(
          center=centre,
          normal=n,
          tangent=t,
          axis=axis,
          plane=coordinate,
          required=required.wkt,
        ),
      )
    )
  return min(candidates, key=lambda p: p[0])[1] if candidates else None


def templates(window):
  w, h = window["width"], window["height"]
  return [
    (0, h / 2 + 0.13, w + 0.34, 0.18, 0.22, 0xD0C5AF),
    (-w / 2 - 0.085, 0, 0.13, h - 0.06, 0.13, 0xBEB5A4),
    (w / 2 + 0.085, 0, 0.13, h - 0.06, 0.13, 0xBEB5A4),
  ]


def native_fittings(window, planes):
  """Fit each small part to a real cardinal wall, following native stair steps."""
  result = []
  c, t, n = map(np.array, [window["center"], window["tangent"], window["normal"]])
  for u, dy, w, h, depth, rgb in templates(window):
    # Long head is stepped independently; jambs stay a full-height thin section.
    count = max(1, math.ceil(w / 0.48))
    for i in range(count):
      point = c + t * (u + (i + 0.5) * w / count - w / 2) + [0, dy, 0]
      # Actual native plane determines both the fitting axis and its exposed side.
      fitted = native_surface_fit(point.tolist(), n, w / count, h, planes)
      if fitted is None:
        return None
      result.append(
        {**fitted, "width": w / count, "height": h, "depth": depth, "rgb": rgb}
      )
  return result


def plans(source):
  if EVIDENCE.exists():
    previous = old.read(EVIDENCE)
    if previous["sourceSha256"] == old.sha(SOURCE):
      for path, digest in previous["packetReceipts"].items():
        if old.sha(ROOT / path) != digest:
          raise ValueError(f"Retained native/drawn packet changed: {path}")
  for path, digest in source["sourceHashes"].items():
    if old.sha(ROOT / path) != digest:
      raise ValueError(f"Source changed: {path}")
  for path, digest in source["packetReceipts"].items():
    if old.sha(ROOT / path) != digest:
      raise ValueError(f"Packet changed: {path}")
  candidates = defaultdict(list)
  for w in source["windows"]:
    if w["role"] != "window glazing":
      continue
    ground = min(p[1] for ring in w["sourceWall"] for p in ring) + w["terrainOffsetY"]
    if w["center"][1] < ground + 4.5:
      continue
    c, t = np.array(w["center"]), np.array(w["tangent"])
    ring = [
      [(float((np.array(p) - c) @ t), p[1] + w["terrainOffsetY"] - c[1]) for p in r]
      for r in w["sourceWall"]
    ]
    poly = Polygon(ring[0], ring[1:]).buffer(1e-7)
    if not poly.covers(
      box(
        -w["width"] / 2 - 0.2,
        -w["height"] / 2 - 0.04,
        w["width"] / 2 + 0.2,
        w["height"] / 2 + 0.24,
      )
    ):
      continue
    tile = f"{math.floor(c[0] / 512)}_{math.floor(c[2] / 512)}"
    candidates[tile].append(w)
  manifest = {d["id"]: d for d in old.read(OUT / "manifest.json")["chunks"]}
  chunks = {}
  accepted = []
  packet_receipts = {}
  rejected = Counter()
  for tile, windows in sorted(candidates.items()):
    if tile not in manifest:
      continue
    desc = manifest[tile]
    packets = {m: old.read(OUT / desc[m]["url"]) for m in ["drawn", "minecraft"]}
    planes = fittings.native_planes(packets["minecraft"], [])
    local = {
      m: dict(
        origin=p["origin"],
        guard=nav_fingerprint(p["nav"]),
        records=[
          dict(
            mesh=i,
            kind=v["kind"],
            fingerprint=fingerprint([v["positions"], v["colors"], v["indices"]]),
          )
          for i, v in enumerate(p["meshes"])
        ],
        boxes=[],
      )
      for m, p in packets.items()
    }
    # Bound additions evenly across the already evidenced owners. Twelve
    # upper openings per owner prevents one long frontage consuming a tile.
    by_owner = defaultdict(list)
    for w in windows:
      by_owner[w["owner"]].append(w)
    ordered = []
    for owner in sorted(by_owner):
      rows = sorted(
        by_owner[owner], key=lambda w: (w["center"][1], w["center"][0], w["center"][2])
      )
      step = max(1, len(rows) // 12)
      ordered.extend(rows[::step][:12])
    for w in ordered:
      if len(local["drawn"]["boxes"]) + 3 > 900:
        rejected["boundedTileLimit"] += 1
        continue
      nf = native_fittings(w, planes)
      if nf is None:
        rejected["noCompleteNativeWall"] += 1
        continue
      if len(local["minecraft"]["boxes"]) + len(nf) > 900:
        rejected["boundedNativeTileLimit"] += 1
        continue
      centre, t, n = map(np.array, [w["center"], w["tangent"], w["normal"]])
      rows = {"drawn": [], "minecraft": []}
      for u, dy, ww, hh, depth, rgb in templates(w):
        p = (
          centre + t * u + n * 0.15 + [0, dy, 0] - np.array(packets["drawn"]["origin"])
        )
        rows["drawn"].append([*p.tolist(), t[0], t[2], n[0], n[2], ww, hh, depth, rgb])
      for f in nf:
        c, t, n = map(np.array, [f["center"], f["tangent"], f["normal"]])
        p = c + n * 0.17 - np.array(packets["minecraft"]["origin"])
        rows["minecraft"].append(
          [
            *p.tolist(),
            t[0],
            t[2],
            n[0],
            n[2],
            f["width"],
            f["height"],
            f["depth"],
            f["rgb"],
          ]
        )
      valid = True
      for mode in rows:
        for x, y, z, dx, dz, nx, nz, ww, hh, depth, rgb in rows[mode]:
          for su in [-1, 1]:
            for sv in [-1, 1]:
              for sw in [-1, 1]:
                q = [
                  x + dx * su * ww / 2 + nx * sw * depth / 2,
                  y + sv * hh / 2,
                  z + dz * su * ww / 2 + nz * sw * depth / 2,
                ]
                if not all(0 <= v <= 655.35 for v in q):
                  valid = False
      if not valid:
        rejected["encodedBounds"] += 1
        continue
      for mode in rows:
        local[mode]["boxes"].extend(rows[mode])
      accepted.append({**w, "chunk": tile, "native": nf})
    if local["drawn"]["boxes"]:
      chunks[tile] = local
      for mode in packets:
        path = OUT / desc[mode]["url"]
        packet_receipts[str(path.relative_to(ROOT))] = old.sha(path)
  return {"schemaVersion": 1, "keys": list(chunks), "chunks": chunks}, {
    "schemaVersion": 1,
    "policy": POLICY,
    "sourceSha256": old.sha(SOURCE),
    "accepted": accepted,
    "packetReceipts": packet_receipts,
    "excludedOwners": source["excludedOwners"],
    "excludedV270Owners": sorted(V270_OWNERS),
    "rejected": dict(rejected),
    "byStreet": dict(Counter(w["road"] for w in accepted)),
    "counts": {
      k: {m: len(p["boxes"]) for m, p in v.items()} for k, v in chunks.items()
    },
  }


def main():
  source = old.read(SOURCE) if SOURCE.exists() else extract()
  runtime, evidence = plans(source)
  write(RUNTIME, runtime)
  write(EVIDENCE, evidence)
  print(
    json.dumps(
      {
        "accepted": len(evidence["accepted"]),
        "streets": evidence["byStreet"],
        "counts": evidence["counts"],
        "runtimeBytes": RUNTIME.stat().st_size,
      }
    )
  )


if __name__ == "__main__":
  main()
