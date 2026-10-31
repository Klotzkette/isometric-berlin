"""Freeze exact Dom ownership and native exterior fits; no download or host edits."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import struct
import subprocess
from collections import defaultdict
from pathlib import Path

from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data/berlinHistoricCoreV288.json"
OWNERSHIP = ROOT / "src/app/src/data/berlinHistoricCoreV288Ownership.json"
NAVIGATION = ROOT / "src/app/src/data/berlinHistoricCoreV288Navigation.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/berlin-historic-core-v288-evidence.json"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
NATIVE = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
IDS = {"02156993", "12706358", "12706359", "24351835", "24351837", "70855133"}


def polygon(p):
  return Polygon(
    [[x / 10, z / 10] for x, z in p["ring"]],
    [[[x / 10, z / 10] for x, z in h] for h in p["holes"]],
  )


def polygons(geometry):
  if geometry.geom_type == "Polygon":
    yield geometry
  elif hasattr(geometry, "geoms"):
    for g in geometry.geoms:
      yield from polygons(g)


def freeze_owners(data):
  data.setdefault("domOwnership", {})
  all_prisms = json.loads(PRISMS.read_text())["buildings"]
  legacy = [p for p in all_prisms if p["id"] in IDS]
  assert len(legacy) == 6
  owner_union = unary_union([polygon(p) for p in legacy])
  bounds = owner_union.bounds
  nearby = [p for p in all_prisms if box(*polygon(p).bounds).intersects(box(*bounds))]
  foreign = unary_union([polygon(p) for p in nearby if p["id"] not in IDS])
  measured = unary_union(
    [
      Polygon(p["ring"], p["holes"])
      for profile in data["profiles"][:3]
      for p in profile["parts"]
    ]
  )
  remainders = []
  for owner in legacy:
    for i, remainder in enumerate(polygons(polygon(owner).difference(measured))):
      if remainder.area <= 1e-8:
        continue
      ring = [list(v) for v in list(remainder.exterior.coords)[:-1]]
      holes = [[list(v) for v in list(h.coords)[:-1]] for h in remainder.interiors]
      low, high = owner["y0_dm"] / 10, (owner["y0_dm"] + owner["h_dm"]) / 10
      surfaces = [
        dict(
          kind="RoofSurface",
          rings=[[[x, high, z] for x, z in r] for r in [ring, *holes]],
        )
      ]
      for r in [ring, *holes]:
        for a, b in zip(r, r[1:] + r[:1]):
          surfaces.append(
            dict(
              kind="WallSurface",
              rings=[
                [
                  [a[0], low, a[1]],
                  [b[0], low, b[1]],
                  [b[0], high, b[1]],
                  [a[0], high, a[1]],
                ]
              ],
            )
          )
      remainders.append(
        dict(
          id=f"legacy-{owner['id']}-remainder-{i}",
          height_m=high - low,
          ground_y_m=low,
          top_y_m=high,
          ring=ring,
          holes=holes,
          surfaces=surfaces,
          sourceStatus="Exact original coarse prism outside complete official footprint; retained digitization sliver, not a new measurement",
        )
      )
  source = json.loads(NATIVE.read_text())
  nearby_columns, exclusive = [], []
  for rz, row in enumerate(source["building_rows"]):
    z = source["grid"]["min_z_idx"] + rz
    if z < math.floor(bounds[1] / 4) or z > math.floor(bounds[3] / 4):
      continue
    for start, count, low, high, kind in row:
      for x in range(
        max(start + source["grid"]["min_x_idx"], math.floor(bounds[0] / 4)),
        min(start + source["grid"]["min_x_idx"] + count, math.floor(bounds[2] / 4) + 1),
      ):
        item = [x, z, low, high, kind]
        nearby_columns.append(item)
        if owner_union.contains(Point((x + 0.5) * 4, (z + 0.5) * 4)):
          # Positive-area ownership, including whole-cell foreign protection.
          assert (
            foreign.intersection(box(x * 4, z * 4, x * 4 + 4, z * 4 + 4)).area < 1e-7
          )
          exclusive.append(item)
  assert len(exclusive) == 576
  data["domOwnership"].update(
    legacyPrisms=legacy,
    nearbyPrisms=nearby,
    nativeColumns=exclusive,
    nativeNearbyColumns=nearby_columns,
    bounds=list(bounds),
    legacyRemainderParts=remainders,
    nativeSchema=source["schema_version"],
    classes=source["classes"],
    gridOrigin=[source["grid"]["min_x_idx"], source["grid"]["min_z_idx"]],
    cellM=source["cell_m"],
    fullCellForeignOverlapAreaM2=0,
    inputSha256={
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [PRISMS, NATIVE]
    },
  )


def native_exterior_rectangles():
  paths = [
    ROOT / "src/app/public/mesh/surrounding-berlin-v159" / f"{tile}.minecraft.json.gz"
    for tile in ["5_0", "6_0"]
  ]
  groups = defaultdict(float)
  for path in paths:
    packet = json.loads(gzip.decompress(path.read_bytes()))
    origin = packet["origin"]
    for mesh in packet["meshes"]:
      if mesh["kind"] != "alt-mitte-v169":
        continue
      raw = base64.b64decode(mesh["positions"])
      values = struct.unpack("<" + "H" * (len(raw) // 2), raw)
      vertices = [
        [values[i + j] / 100 + origin[j] for j in range(3)]
        for i in range(0, len(values), 3)
      ]
      raw = base64.b64decode(mesh["indices"])
      indices = struct.unpack("<" + "I" * (len(raw) // 4), raw)
      for i in range(0, len(indices), 3):
        triangle = [vertices[j] for j in indices[i : i + 3]]
        centre = [sum(v[j] for v in triangle) / 3 for j in range(3)]
        if not (
          (2780 <= centre[0] <= 2845 and 285 <= centre[2] <= 340)
          or (2910 <= centre[0] <= 3010 and 180 <= centre[2] <= 285)
          or (3025 <= centre[0] <= 3150 and 180 <= centre[2] <= 286)
        ):
          continue
        for axis in [0, 2]:
          if max(v[axis] for v in triangle) - min(v[axis] for v in triangle) > 0.001:
            continue
          a, b, c = triangle
          cross = [
            (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
            (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
            (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
          ]
          if abs(cross[axis]) < 0.01:
            continue
          along = 2 - axis
          key = (
            axis,
            1 if cross[axis] > 0 else -1,
            round(a[axis], 5),
            min(v[along] for v in triangle),
            max(v[along] for v in triangle),
            min(v[1] for v in triangle),
            max(v[1] for v in triangle),
          )
          groups[key] += abs(cross[axis]) / 2
  rectangles = [
    list(k)
    for k, area in groups.items()
    if abs(area - (k[4] - k[3]) * (k[6] - k[5])) < 1e-5
  ]
  return paths, rectangles


def freeze_native_fittings(data):
  paths, rectangles = native_exterior_rectangles()
  result = subprocess.check_output(
    [
      "bun",
      "-e",
      "import {berlinHistoricCoreFacadeAnchorsV288 as anchors} from './src/app/src/BerlinHistoricCoreV288'; console.log(JSON.stringify(anchors()));",
    ],
    cwd=ROOT,
  )
  anchors = json.loads(result)
  rows, receipts = [], []
  for anchor in anchors:
    r = anchor["row"]
    normal = [math.sin(r[6]), math.cos(r[6])]
    axis = 0 if abs(normal[0]) >= abs(normal[1]) else 2
    along, sign = 2 - axis, 1 if normal[0 if axis == 0 else 1] >= 0 else -1
    candidates = []
    for rect in rectangles:
      ax, sn, plane, lo, hi, low, high = rect
      if (
        ax != axis
        or sn != sign
        or not lo + 0.6 <= r[along] <= hi - 0.6
        or not low + 0.75 <= r[1] <= high - 0.75
      ):
        continue
      offset = (plane - r[axis]) * sign
      if -0.15 <= offset <= 2.95:
        candidates.append(rect)
    if not candidates:
      continue
    rect = max(candidates, key=lambda a: a[2] * sign)
    _, _, plane, lo, hi, low, high = rect
    width, height = (
      min(1.55, 2 * (r[along] - lo) - 0.24, 2 * (hi - r[along]) - 0.24),
      min(1.8, 2 * (r[1] - low) - 0.24, 2 * (high - r[1]) - 0.24),
    )
    first = len(rows)

    def append(along_pos, y, w, h, d, color, offset):
      p = [r[0], y, r[2]]
      p[axis] = plane + sign * offset
      p[along] = along_pos
      size = [w, h, d] if axis == 2 else [d, h, w]
      rows.append([*p, *size, color])

    append(r[along], r[1], width, height, 0.065, int(r[7]), 0.06)
    if anchor["profile"] == "voltair":
      for dx in [-0.25, 0.25]:
        append(
          r[along] + dx * width,
          r[1] - 0.25,
          0.14,
          min(1.15, height - 0.35),
          0.06,
          0x576B6F if int(r[7]) == 0x293D42 else 0xD5DCDA,
          0.12,
        )
      receipts.append(
        dict(
          profile=anchor["profile"],
          anchor=r,
          nativeFace=rect,
          first=first,
          count=len(rows) - first,
        )
      )
      continue
    for dx in [-1, 1]:
      append(
        r[along] + dx * (width / 2 + 0.045),
        r[1],
        0.09,
        height + 0.18,
        0.08,
        0xD3C9B6,
        0.11,
      )
    for dy in [-1, 1]:
      append(
        r[along],
        r[1] + dy * (height / 2 + 0.045),
        width + 0.18,
        0.09,
        0.08,
        0xD3C9B6,
        0.11,
      )
    if anchor["profile"] == "klostergaerten":
      append(r[along], r[1] - 0.5, width + 0.18, 0.08, 0.08, 0x343D3D, 0.30)
      for dx in [-0.4, 0, 0.4]:
        append(r[along] + dx * width, r[1] - 0.8, 0.05, 0.6, 0.06, 0x343D3D, 0.30)
    receipts.append(
      dict(
        profile=anchor["profile"],
        anchor=r,
        nativeFace=rect,
        first=first,
        count=len(rows) - first,
      )
    )
  data["nativeOuterRows"] = rows
  data["nativeOuterFits"] = receipts
  data["nativeOuterSource"] = dict(
    files=[
      dict(
        path=str(path.relative_to(ROOT)),
        sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
      )
      for path in paths
    ],
    fittingStatus="Independent cardinal fittings on actual retained exterior rectangles; source shell and old details remain. Bay/rail dimensions are display estimates.",
  )


def freeze_ruin_fittings(data):
  path = ROOT / "src/app/src/data/altMitteV169Native/packet-100.json"
  packet = json.loads(path.read_text())
  origin = packet["origin"]
  profile = next(p for p in data["profiles"] if p["id"] == "ruin")
  footprint = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in profile["parts"]]
  ).buffer(2.1)
  groups = defaultdict(float)
  for mesh in packet["meshes"]:
    raw = base64.b64decode(mesh["positions"])
    values = struct.unpack("<" + "H" * (len(raw) // 2), raw)
    vertices = [
      [values[i + j] / 100 + origin[j] for j in range(3)]
      for i in range(0, len(values), 3)
    ]
    raw = base64.b64decode(mesh["indices"])
    indices = struct.unpack("<" + "I" * (len(raw) // 4), raw)
    for i in range(0, len(indices), 3):
      triangle = [vertices[j] for j in indices[i : i + 3]]
      centre = [sum(v[j] for v in triangle) / 3 for j in range(3)]
      if not 5.1 < centre[1] < 13.5 or not footprint.contains(
        Point(centre[0], centre[2])
      ):
        continue
      a, b, c = triangle
      for axis in [0, 2]:
        if max(v[axis] for v in triangle) - min(v[axis] for v in triangle) > 0.001:
          continue
        cross = [
          (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
          (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
          (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
        ]
        if abs(cross[axis]) < 0.01:
          continue
        along = 2 - axis
        key = (
          axis,
          1 if cross[axis] > 0 else -1,
          round(a[axis], 5),
          min(v[along] for v in triangle),
          max(v[along] for v in triangle),
          min(v[1] for v in triangle),
          max(v[1] for v in triangle),
        )
        groups[key] += abs(cross[axis]) / 2
  rows, receipts = [], []
  for rect, area in groups.items():
    axis, sign, plane, lo, hi, low, high = rect
    if abs(area - (hi - lo) * (high - low)) > 1e-5:
      continue
    for y_index in range(
      math.ceil((low + 0.08) / 0.4), math.floor((high - 0.08) / 0.4) + 1
    ):
      y = y_index * 0.4
      p = [0, y, 0]
      p[axis] = plane + sign * 0.045
      p[2 - axis] = (lo + hi) / 2
      size = (
        [hi - lo - 0.04, 0.035, 0.045] if axis == 2 else [0.045, 0.035, hi - lo - 0.04]
      )
      if min(size) <= 0:
        continue
      receipts.append(dict(first=len(rows), nativeFace=list(rect)))
      rows.append([*p, *size, 0x9D6850])
  data["nativeRuinRows"], data["nativeRuinFits"] = rows, receipts
  data["nativeRuinSource"] = dict(
    path=str(path.relative_to(ROOT)),
    sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
    fittingStatus="Shallow horizontal masonry joints on existing cardinal ruin surface cells. No new opaque church wall, aperture or roof.",
  )


def main():
  data = json.loads(DATA.read_text())
  freeze_owners(data)
  ownership = data.pop("domOwnership")
  data["domLegacyRemainderParts"] = ownership.pop("legacyRemainderParts")
  OWNERSHIP.write_text(
    json.dumps(ownership, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  navigation = []
  for p in [
    *[p for profile in data["profiles"][:3] for p in profile["parts"]],
    *data["domLegacyRemainderParts"],
  ]:
    planes = []
    for s in p["surfaces"]:
      if s["kind"] != "RoofSurface":
        continue
      ring = s["rings"][0]
      normal = [0.0, 0.0, 0.0]
      for a, b in zip(ring, ring[1:] + ring[:1]):
        normal[0] += (a[1] - b[1]) * (a[2] + b[2])
        normal[1] += (a[2] - b[2]) * (a[0] + b[0])
        normal[2] += (a[0] - b[0]) * (a[1] + b[1])
      if abs(normal[1]) > 1e-6:
        planes.append(
          dict(
            a=ring[0],
            normal=normal,
            rings=[[[x, z] for x, y, z in r] for r in s["rings"]],
          )
        )
    navigation.append(
      dict(
        id=p["id"],
        ring=p["ring"],
        holes=p["holes"],
        ground=p["ground_y_m"],
        top=p["top_y_m"],
        roofs=planes,
      )
    )
  NAVIGATION.write_text(
    json.dumps(navigation, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  # Publish owner receipts before importing the TS helper; geometry has no source mutation.
  DATA.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
  freeze_native_fittings(data)
  freeze_ruin_fittings(data)
  fits = {key: data.pop(key) for key in ["nativeOuterFits", "nativeRuinFits"]}
  EVIDENCE.write_text(
    json.dumps(
      dict(
        schemaVersion=1,
        currentAsOf=data["currentAsOf"],
        references=data["references"],
        nativeOuterSource=data["nativeOuterSource"],
        nativeRuinSource=data["nativeRuinSource"],
        **fits,
      ),
      ensure_ascii=False,
      separators=(",", ":"),
    )
    + "\n"
  )
  DATA.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
  print(
    {
      "owners": len(ownership["legacyPrisms"]),
      "columns": len(ownership["nativeColumns"]),
      "slivers": len(data["domLegacyRemainderParts"]),
      "nativeExteriorFits": len(fits["nativeOuterFits"]),
      "nativeFittings": len(data["nativeOuterRows"]),
    }
  )


if __name__ == "__main__":
  main()
