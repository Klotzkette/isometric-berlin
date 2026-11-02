"""Step 10: freeze bounded retained Litten/Stadthaus/Münze facade companions.

No download, old file write or source-owner transfer. Native fittings are fitted
to exact delivered exterior rectangles rather than pushed out by a blind offset.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import subprocess
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
from build_alt_mitte_v169 import facade, footprint
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_leipziger_muenze_v257 import receipt
from build_litten_instanz_v257 import edge
from build_north_mitte_fronts_v239 import tri_key
from build_small_tiergarten_v237 import oriented
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data/littenStadthausV297.json"
EVIDENCE = GEO / "litten-stadthaus-v297-source.json.gz"
PACKETS = ROOT / "src/app/src/data/littenStadthausV297Packets.json"
OWNERS = {
  "DEBE01YYK0000626": "instanz-centre",
  "DEBE01YYK00009MO": "instanz-north",
  "DEBE01YYK00008M9": "instanz-south",
  "DEBE01YYK00005yc": "stadthaus",
  "DEBE01YYK000027c": "neues-stadthaus",
  "DEBE01YYK00002Vr": "podewil",
  "DEBE01YYK0000A7P": "verwaltung-c",
  "DEBE01YYK0000FSW": "muenze-court",
  "DEBE01YYK0000CCw": "muenze-court",
  "DEBE01YYK0000FTB": "muenze-court",
  "DEBE01YYK00002vn": "muenze-court",
  "DEBE01YYK00005h1": "muenze-court",
  "DEBE01YYK00002kI": "muenze-court",
  "DEBE01YYK00002LG": "direktorenhaus",
  "DEBE01YYK00006oT": "muenze-front",
}


def read(path: Path) -> Any:
  """Read one finite retained input."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, value: Any) -> None:
  """Write deterministic new constructor/evidence files only."""
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  """Pin the full unchanged input."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def extract() -> tuple[dict[str, Any], dict[str, Any]]:
  """Retain complete original records and derive only exterior wall descriptors."""
  sources = [
    GEO / f"alt-mitte-v169/source-{tile}-00.json.gz"
    for tile in ["391_5819", "392_5819"]
  ]
  records = [b for path in sources for b in read(path)["buildings"]]
  selected = [b for b in records if b["id"] in OWNERS]
  assert {b["id"] for b in selected} == set(OWNERS)
  occupied = unary_union([footprint(b) for b in records])
  faces = []
  for building in selected:
    key = OWNERS[building["id"]]
    for part in building["parts"]:
      for index, s in enumerate(part["surfaces"]):
        if s["kind"] != "WallSurface":
          continue
        if key == "muenze-front" and index not in {4, 7, 20, 25, 33, 110}:
          continue
        f = edge(s)
        if not f or math.dist(f["a"], f["b"]) < 3 or f["top"] - f["bottom"] < 3:
          continue
        centre = [(f["a"][i] + f["b"][i]) / 2 for i in range(2)]
        if any(
          occupied.covers(Point(*(centre[i] + f["normal"][i] * d for i in range(2))))
          for d in (0.5, 1.5)
        ):
          continue
        windows = []
        if key not in {
          "stadthaus",
          "instanz-centre",
          "instanz-north",
          "instanz-south",
          "muenze-front",
        }:
          old = facade(s["rings"], part["groundY"], part["topY"], occupied)
          for i in range(len(old.triangles) - 1):
            t, q = old.triangles[i], old.triangles[i + 1]
            if t[2] != "window glazing" or q[2] != t[2]:
              continue
            if t[0][0] == q[0][0] and t[0][2] == q[0][1]:
              v = np.asarray(t[0] + [q[0][2]])
              windows.append([*v.mean(0), 1.25, 1.79])
        faces.append(
          dict(
            key=key,
            owner=building["id"],
            part=part["id"],
            index=index,
            **f,
            windows=windows,
          )
        )
  stadthaus = read(GEO / "stadthaus-v239-source.json.gz")
  old = read(ROOT / "src/app/src/data/cityRecognitionV182.json")
  feature = stadthaus["oldFeature"]
  outer = LineString(stadthaus["part"]["ring"] + [stadthaus["part"]["ring"][0]])
  windows = [
    r
    for r in old["boxes"][
      feature["firstBox"] : feature["firstBox"] + feature["boxCount"]
    ]
    if outer.distance(Point(r[0], r[2])) < 0.4
  ]
  for f in faces:
    if f["key"] != "stadthaus":
      continue
    line = LineString([f["a"], f["b"]])
    for r in windows:
      if line.distance(Point(r[0], r[2])) < 0.4:
        f["windows"].append([*r[:3], r[3], r[4]])
  inputs = [
    *sources,
    GEO / "stadthaus-v239-source.json.gz",
    ROOT / "src/app/src/data/cityRecognitionV182.json",
    ROOT / "src/app/src/data/littenInstanzV257.json",
    ROOT / "src/app/src/data/leipzigerMuenzeV257.json",
  ]
  receipts = {str(p.relative_to(ROOT)): sha(p) for p in inputs}
  data = dict(
    schemaVersion=1,
    sourceGeometryRetained=True,
    sourceOwners=list(OWNERS),
    faces=faces,
    nativeRows=[],
    sourceReceipts=receipts,
  )
  evidence = dict(
    schemaVersion=1,
    buildings=selected,
    stadthaus=stadthaus,
    sourceReceipts=receipts,
    nativeFits=[],
    nativeUnmatched=[],
  )
  return data, evidence


def rectangles() -> tuple[list[Path], list[list[Any]]]:
  """Union complete actual coplanar triangles, including nonrectangular faces.

  Large merged source faces are not necessarily triangulated as rectangle pairs.
  Exact projected polygons keep every concavity and hole when fitting members.
  """
  paths = [
    ROOT / "src/app/public/mesh/surrounding-berlin-v159" / f"{tile}.minecraft.json.gz"
    for tile in ["4_0", "5_0", "stadthaus239-5_0"]
  ]
  paths.extend(
    ROOT / "src/app/src/data/altMitteV169Native" / f"packet-{i}.json"
    for i in ["091", "092", "100"]
  )
  planes: dict[tuple, list] = defaultdict(list)
  for path in paths:
    packet = read(path)
    for mesh in packet["meshes"]:
      if mesh["kind"] not in {"alt-mitte-v169", "stadthaus-v239", "city"}:
        continue
      vertices, _, indices = decoded_mesh(packet, mesh)
      for t in vertices[indices]:
        c = t.mean(0)
        if not (2440 < c[0] < 2940 and 180 < c[2] < 520):
          continue
        cross = np.cross(t[1] - t[0], t[2] - t[0])
        for axis in [0, 2]:
          if np.ptp(t[:, axis]) > 0.001 or abs(cross[axis]) < 0.01:
            continue
          along = 2 - axis
          key = (axis, 1 if cross[axis] > 0 else -1, round(t[0, axis], 5))
          planes[key].append(Polygon(t[:, [along, 1]]))
  result = []
  for key, triangles in sorted(planes.items()):
    union = unary_union(triangles)
    for poly in getattr(union, "geoms", [union]):
      if poly.geom_type != "Polygon" or poly.area < 1e-8:
        continue
      lo, low, hi, high = poly.bounds
      result.append([*key, lo, hi, low, high, poly, len(result)])
  return paths, result


def native_fit(data: dict[str, Any], evidence: dict[str, Any]) -> None:
  """Fit independent cardinal members onto real retained exterior faces."""
  paths, rects = rectangles()
  evidence["nativeSupports"] = [
    dict(
      id=q[8],
      face=q[:7],
      ring=list(q[7].exterior.coords),
      holes=[list(r.coords) for r in q[7].interiors],
    )
    for q in rects
  ]
  output = subprocess.check_output(
    [
      "bun",
      "-e",
      "import {littenStadthausGeometryV297 as build,podewilFacadeRowsV297 as front} from './src/app/src/LittenStadthausV297'; console.log(JSON.stringify({additive:build(false).rows,replacement:front()}));",
    ],
    cwd=ROOT,
  )
  generated = json.loads(output)
  rows = [(r, False) for r in generated["additive"]] + [
    (r, True) for r in generated["replacement"]
  ]
  fitted, replacement = [], []
  evidence["replacementDrawnRows"] = generated["replacement"]
  evidence["replacementNativeFits"] = []
  buckets: dict[tuple[int, int, int], list] = defaultdict(list)
  for q in rects:
    for bucket in range(math.floor(q[3] / 4), math.floor(q[4] / 4) + 1):
      buckets[(int(q[0]), int(q[1]), bucket)].append(q)
  for r, correction in rows:
    # Tower fittings are already independently cardinal in the native factory.
    if r["role"].startswith("stadthaus-tower"):
      continue
    p, size, normal = r["p"], r["s"], r["normal"]
    axis = 0 if abs(normal[0]) > abs(normal[1]) else 2
    along, sign = 2 - axis, 1 if normal[0 if axis == 0 else 1] > 0 else -1
    c, sn = math.cos(r["yaw"]), -math.sin(r["yaw"])
    n, vertical = max(1, math.ceil(size[0] / 0.55)), max(1, math.ceil(size[1] / 0.48))
    # The separate native name fits its complete retained lower return face;
    # this small vertical layout is an explicit native display estimate.
    name_shift = -2.4 if r["role"] == "instanz-north-return-name" else 0
    for j in range(n):
      u = (j + 0.5) * size[0] / n - size[0] / 2
      for k in range(vertical):
        pos = [
          p[0] + c * u,
          p[1] + (k + 0.5) * size[1] / vertical - size[1] / 2 + name_shift,
          p[2] + sn * u,
        ]
        width = max(0.025, abs(sn if axis == 0 else c) * size[0] / n)
        height = size[1] / vertical
        candidates = [
          q
          for q in buckets[(axis, sign, math.floor(pos[along] / 4))]
          if q[3] + width / 2 <= pos[along] <= q[4] - width / 2
          and q[5] + height / 2 <= pos[1] <= q[6] - height / 2
          and -0.35 <= (q[2] - pos[axis]) * sign <= 3.1
          and q[7].covers(
            box(
              pos[along] - width / 2,
              pos[1] - height / 2,
              pos[along] + width / 2,
              pos[1] + height / 2,
            )
          )
        ]
        if not candidates:
          evidence["nativeUnmatched"].append(
            dict(role=r["role"], owner=r["sourceId"], p=pos)
          )
          continue
        q = max(candidates, key=lambda q: q[2] * sign)
        # Every piece is strictly outside its actual delivered support surface.
        pos[axis] = q[2] + sign * (0.035 + size[2] / 2)
        sizes = [size[2], height, width] if axis == 0 else [width, height, size[2]]
        result = dict(
          p=[round(x, 5) for x in pos],
          s=[round(x, 5) for x in sizes],
          yaw=0,
          tone=r["tone"],
          role=r["role"],
          sourceId=r["sourceId"],
          normal=normal,
        )
        target = replacement if correction else fitted
        evidence["replacementNativeFits" if correction else "nativeFits"].append(
          dict(
            row=len(target),
            face=q[:7],
            support=q[8],
            original=r,
            nativeNameShiftY=name_shift,
          )
        )
        target.append(result)
  evidence["nativeAtomicRows"] = fitted
  evidence["replacementNativeAtomicRows"] = replacement
  fitted, merge_proof = compact_native(fitted)
  replacement, replacement_proof = compact_native(replacement)
  evidence["nativeMergeProof"] = merge_proof
  evidence["replacementNativeMergeProof"] = replacement_proof
  evidence["replacementNativeRows"] = replacement
  data["nativeRows"] = fitted
  evidence["nativePacketReceipts"] = {str(p.relative_to(ROOT)): sha(p) for p in paths}
  data["sourceReceipts"].update(evidence["nativePacketReceipts"])


def compact_native(rows: list[dict]) -> tuple[list[dict], list[dict]]:
  """Merge only exact touching/overlapping same-colour cardinal intervals.

  Integer half-microunits preserve every rounded input endpoint. The other two
  axes and semantic/source identity must be identical. No raster coarsening,
  gap filling or change to occupied volume occurs.
  """
  entries = []
  for index, r in enumerate(rows):
    bounds = [
      [
        2 * round(p * 100000) - round(s * 100000),
        2 * round(p * 100000) + round(s * 100000),
      ]
      for p, s in zip(r["p"], r["s"], strict=True)
    ]
    entries.append(dict(row=r, bounds=bounds, atoms=[index]))
  proof = []
  for axis in [0, 1, 2]:
    groups: dict[tuple, list] = defaultdict(list)
    for entry in entries:
      r, bounds = entry["row"], entry["bounds"]
      key = (
        r["sourceId"],
        r["role"],
        r["tone"],
        *r["normal"],
        *(q for i, values in enumerate(bounds) if i != axis for q in values),
      )
      groups[key].append(entry)
    entries = []
    for group in groups.values():
      group.sort(key=lambda e: e["bounds"][axis])
      current = group[0]
      for next_entry in group[1:]:
        if current["bounds"][axis][1] < next_entry["bounds"][axis][0]:
          entries.append(current)
          current = next_entry
          continue
        proof.append(dict(axis=axis, a=current["bounds"], b=next_entry["bounds"]))
        bounds = [list(q) for q in current["bounds"]]
        bounds[axis] = [
          min(current["bounds"][axis][0], next_entry["bounds"][axis][0]),
          max(current["bounds"][axis][1], next_entry["bounds"][axis][1]),
        ]
        current = dict(
          row=current["row"],
          bounds=bounds,
          atoms=current["atoms"] + next_entry["atoms"],
        )
      entries.append(current)
  output = []
  for e in entries:
    r = dict(e["row"])
    r["p"] = [(lo + hi) / 400000 for lo, hi in e["bounds"]]
    r["s"] = [(hi - lo) / 200000 for lo, hi in e["bounds"]]
    output.append(r)
  return output, proof


def fingerprint(parts: list[str]) -> int:
  """Match the bounded decoder's exact-string FNV receipt."""
  value = 2166136261
  for text in parts:
    for c in text:
      value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def decoded_mesh(packet: dict, mesh: dict) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
  """Return exact delivered centimetre coordinates and byte colours."""
  v = (
    np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + packet["origin"]
  )
  c = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return v, c, ix


def append_exact_linear_faces(
  mesh: dict[str, Any], triangles: list[list[list[float]]], origin: list[float]
) -> None:
  """Append original centimetre faces with their already-linear source colour.

  The ordinary packer accepts authored sRGB swatches and converts them to
  linear bytes. Source-packet bytes already have that conversion; applying it
  twice would visibly darken the retained source wall.
  """
  if not triangles:
    return
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4")
  points = np.asarray(triangles).reshape(-1, 3)
  exact = np.rint((points - origin) * 100)
  assert exact.min() >= 0 and exact.max() <= 65535
  assert np.max(np.abs(points - (exact / 100 + origin))) < 1e-9
  first = len(positions)
  additions = {
    "positions": np.concatenate([positions, exact.astype("<u2")]).astype("<u2"),
    "colors": np.concatenate(
      [colors, np.tile(np.array([164, 154, 125], dtype="u1"), (len(points), 1))]
    ),
    "indices": np.concatenate(
      [indices, np.arange(first, first + len(points), dtype="<u4")]
    ).astype("<u4"),
  }
  for key, array in additions.items():
    mesh[key] = base64.b64encode(array.tobytes()).decode("ascii")


def corrected_packets(data: dict[str, Any], evidence: dict[str, Any]) -> None:
  """Exact old estimate transfer, complete replacement within the same packet.

  Drawn source wall/roof triangles remain untouched. Native source geometry
  remains identical: the exact old dark window faces are republished in the
  original adjacent wall tone, followed by independent 7-by-3 fittings.
  """
  record = next(b for b in evidence["buildings"] if b["id"] == "DEBE01YYK00002Vr")
  part = record["parts"][0]
  face = part["surfaces"][33]
  all_records = [
    b
    for tile in ["391_5819", "392_5819"]
    for b in read(GEO / f"alt-mitte-v169/source-{tile}-00.json.gz")["buildings"]
  ]
  old = facade(
    face["rings"],
    part["groundY"],
    part["topY"],
    unary_union([footprint(b) for b in all_records]),
  )
  a, b = np.array([2808.201, 238.625]), np.array([2789.907, 242.082])
  length = np.linalg.norm(b - a)
  axis, normal = (b - a) / length, np.array([0.18568284, 0.98260973])
  selected: dict[str, Any] = {}
  paths = [
    ROOT / "src/app/public/mesh/surrounding-berlin-v159/5_0.drawn.json.gz",
    ROOT / "src/app/src/data/altMitteV169Native/packet-100.json",
  ]
  drawn_found: set[bytes] = set()
  for native, path in enumerate(paths):
    packet = read(path)
    replacement = Detail()
    restored_faces = []
    records = []
    for mesh_index, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "alt-mitte-v169":
        continue
      vertices, colors, indices = decoded_mesh(packet, mesh)
      keys = {tri_key(t) for t in vertices[indices]}
      matched = {
        key for t, _, _ in old.triangles if (key := receipt(t, keys)) is not None
      }
      triangles = []
      for index, ids in enumerate(indices):
        t = vertices[ids]
        if not native:
          key = tri_key(t)
          if key in matched:
            triangles.append(index)
            drawn_found.add(key)
          continue
        u, out = (t[:, [0, 2]] - a) @ axis, (t[:, [0, 2]] - a) @ normal
        cross = np.cross(t[1] - t[0], t[2] - t[0])
        if (
          np.all(colors[ids] == [22, 38, 44])
          and cross[2] > 0.01
          and u.min() > -0.1
          and u.max() < length + 0.1
          and out.min() > -0.5
          and out.max() < 3.5
          and t[:, 1].min() > 4
          and t[:, 1].max() < 24
        ):
          triangles.append(index)
          restored_faces.append(t.tolist())
      if triangles:
        records.append(
          dict(
            mesh=mesh_index,
            fingerprint=fingerprint(
              [mesh[k] for k in ["positions", "colors", "indices"]]
            ),
            triangles=triangles,
          )
        )
    assert records, path
    source_rows = evidence[
      "replacementNativeRows" if native else "replacementDrawnRows"
    ]
    for r in source_rows:
      c = tuple((r["tone"] >> shift) & 255 for shift in [16, 8, 0])
      if native:
        replacement.box(r["p"], r["s"], c, r["role"])
      else:
        oriented(replacement, r["p"], r["s"], -r["yaw"], c, r["role"], False)
    x, _, z = packet["origin"]
    complement = packed_detail(replacement, box(x, z, x + 512, z + 512))
    assert complement
    append_exact_linear_faces(complement, restored_faces, packet["origin"])
    complement["kind"] = "podewil-complete-principal-front-v297"
    key = ("minecraft:alt-mitte-v169-" if native else "drawn:") + packet["id"]
    selected[key] = dict(
      origin=packet["origin"],
      records=records,
      complement=complement,
      complementFingerprint=fingerprint(
        [complement[k] for k in ["positions", "colors", "indices"]]
      ),
      openingCount=21,
      sourceOwner=record["id"],
      sourcePart=part["id"],
      sourceSurfaceIndex=33,
      sourcePlane=face,
      nativeGeometryPreserved=bool(native),
      packetPath=str(path.relative_to(ROOT)),
      packetSha256=sha(path),
    )
  assert len(drawn_found) == len(old.triangles), (len(drawn_found), len(old.triangles))
  proof = dict(schema=1, keys=list(selected), packets=selected)
  write(PACKETS, proof)
  evidence["podewilCorrection"] = dict(
    sourcePlane=face,
    oldDrawnFittings=old.triangles,
    oldDrawnTriangleCount=len(drawn_found),
    packets=proof,
    policy="Only original generic fittings on this exact source face transfer. Complete three-storey seven-axis replacement belongs to the same fingerprint-guarded unpublished packet. Native old dark front faces retain identical coordinates/indices in their original adjacent wall tone. No curtain skin, source body/roof retirement, foreign facade, navigation or lifetime change.",
  )


def build() -> None:
  """Rebuild only the new v297 companions/evidence."""
  data, evidence = extract()
  write(DATA, data)
  native_fit(data, evidence)
  corrected_packets(data, evidence)
  write(DATA, data)
  write(EVIDENCE, evidence)
  print(
    json.dumps(
      dict(
        faces=len(data["faces"]),
        nativeRows=len(data["nativeRows"]),
        bytes=DATA.stat().st_size,
        evidenceBytes=EVIDENCE.stat().st_size,
      )
    )
  )


if __name__ == "__main__":
  build()
