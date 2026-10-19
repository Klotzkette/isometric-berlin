"""Exact Q207 generic-pane retirement and retained source/native audit.

Only the delivered estimated v169 facade of the main owner is eligible for
retirement. Measured shells, the twelve internal owners and all native faces
are evidence-only and remain untouched.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

import build_alt_mitte_v169 as core
import numpy as np
import shapely
from alt_mitte_v169_packets import pack_detail
from build_karl_marx_allee_v161 import Detail, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint, signature, vertices
from build_scheunenviertel_v168 import merge_native_faces
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app/src/data"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
MAIN = "DEBE01YYK00008UX"
INTERIOR = {"DEBE00YY1280004" + suffix for suffix in "ofVRdia bZhTX".replace(" ", "")}
OWNERS = {MAIN, *INTERIOR}
PREVIOUS = APP / "quartier207V241Previous.json"
EVIDENCE = ROOT / "geo_data/regierungsviertel/lafayette-v241-retirement-evidence.json"


def read(path: Path) -> dict:
  """Read a retained input without changing it."""
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  """Identify the complete immutable input."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def mesh_signatures(mesh: dict) -> list[bytes]:
  """Match all original position and colour bits, independent of winding."""
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [signature(t) for t in vertices(mesh)[indices]]


def retained() -> tuple[list[dict], object, dict[str, str]]:
  """Replay the original complete occupancy and inherited appearance."""
  manifest = core.SOURCE / "source-manifest.json"
  inputs = {str(manifest.relative_to(ROOT)): sha(manifest)}
  all_records = []
  for item in read(manifest)["chunks"]:
    path = core.SOURCE / item["file"]
    all_records.extend(read(path)["buildings"])
    inputs[str(path.relative_to(ROOT))] = sha(path)
  occupied = unary_union([core.footprint(b) for b in all_records])
  shapely.prepare(occupied)
  appearance = core.SOURCE / "appearance-baseline.json.gz"
  inputs[str(appearance.relative_to(ROOT))] = sha(appearance)
  core.APPEARANCE.clear()
  ranks = {}
  for previous in read(appearance)["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          core.APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  buildings = [b for b in all_records if b["id"] in OWNERS]
  assert {b["id"] for b in buildings} == OWNERS
  return buildings, occupied, inputs


def packet_paths(mode: str, resident: bool) -> list[tuple[str, Path]]:
  """Only the two spatial cells intersecting the documented Q207 owners."""
  if resident:
    name = (
      "altMitteDrawnV169Source.json"
      if mode == "drawn"
      else "altMitteNativeV169Source.json"
    )
    return [
      ("alt-mitte-v169-" + c["id"], APP / c["file"])
      for c in read(APP / name)["chunkFiles"]
      if c["id"].startswith(("2_0-", "2_1-")) and "-ink-" not in c["id"]
    ]
  return [
    (c["id"], PUB / c[mode]["url"])
    for c in read(PUB / "manifest.json")["chunks"]
    if c["id"] in {"2_0", "2_1"}
    or c["id"].startswith(("2_0-alt-mitte-v169-", "2_1-alt-mitte-v169-"))
  ]


def matches(detail: Detail, mode: str, resident: bool) -> tuple[list, list, dict]:
  """Fail closed unless every replayed triangle exists in an exact packet."""
  records, audit, inputs, pending = [], [], {}, {}
  delivered = core.isometric_shading(detail) if mode == "drawn" else detail
  for tile, path in packet_paths(mode, resident):
    packet = read(path)
    origin = tuple(packet["origin"])
    bounds = (origin[0], origin[2], origin[0] + 512, origin[2] + 512)
    if origin not in pending:
      pending[origin] = Counter(
        s
        for mesh in pack_detail(delivered, bounds, origin_y=origin[1])
        for s in mesh_signatures(mesh)
      )
    for mesh_index, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "alt-mitte-v169":
        continue
      sigs = mesh_signatures(mesh)
      selected = []
      for i, sig in enumerate(sigs):
        if pending[origin][sig]:
          pending[origin][sig] -= 1
          selected.append(i)
      if not selected:
        continue
      digest = fingerprint([mesh["positions"], mesh["colors"], mesh["indices"]])
      records.append(
        dict(
          tile=tile,
          kind=mesh["kind"],
          mode=mode,
          fingerprint=digest,
          triangles=selected,
        )
      )
      chosen = set(selected)
      audit.append(
        dict(
          tile=tile,
          mode=mode,
          mesh=mesh_index,
          fingerprint=digest,
          selected=len(selected),
          unchanged=len(sigs) - len(selected),
          selectedSha256=hashlib.sha256(
            b"".join(sigs[i] for i in selected)
          ).hexdigest(),
          unchangedSha256=hashlib.sha256(
            b"".join(s for i, s in enumerate(sigs) if i not in chosen)
          ).hexdigest(),
        )
      )
      inputs[str(path.relative_to(ROOT))] = sha(path)
  assert pending and all(not sum(v.values()) for v in pending.values()), {
    str(k): sum(v.values()) for k, v in pending.items()
  }
  return records, audit, inputs


def clearance(native: Detail, arc: list[list[float]]) -> dict:
  """Measure actual native exterior reach relative to the two source fronts."""
  points = np.array([p for t, _, _ in native.triangles for p in t])
  xz = points[:, [0, 2]]
  result = dict(
    minimum=points.min(axis=0).tolist(), maximum=points.max(axis=0).tolist(), fronts=[]
  )
  for name, a, b, outward in [
    ("west", [1205.976, 510.885], [1210.68, 573.45], [-1, 0]),
    ("north", [1219.018, 495.707], [1273.94, 491.344], [0, -1]),
  ]:
    a, b = np.array(a), np.array(b)
    tangent = (b - a) / np.linalg.norm(b - a)
    normal = np.array([-tangent[1], tangent[0]])
    if np.dot(normal, outward) < 0:
      normal *= -1
    u = (xz - a) @ tangent
    n = (xz - a) @ normal
    selected = (u >= 0) & (u <= np.linalg.norm(b - a))
    maximum = float(n[selected].max())
    result["fronts"].append(
      dict(
        name=name,
        a=a.tolist(),
        b=b.tolist(),
        normal=normal.tolist(),
        nativeOutwardReachM=maximum,
        minimumPanelInnerFaceOffsetM=maximum + 0.03,
      )
    )
  curve = np.array(arc)
  matrix = np.column_stack([2 * curve[:, 0], 2 * curve[:, 1], np.ones(len(curve))])
  cx, cz, k = np.linalg.lstsq(matrix, (curve**2).sum(axis=1), rcond=None)[0]
  radius = float(np.sqrt(k + cx * cx + cz * cz))
  corner = points[(points[:, 0] < cx) & (points[:, 2] < cz)]
  reach = np.hypot(corner[:, 0] - cx, corner[:, 2] - cz) - radius
  farthest = int(reach.argmax())
  result["roundedNorthwest"] = dict(
    method="Least-squares circle fitted only to the 31 retained northwest footprint vertices; radial clearance includes every existing main-native vertex in the northwest quadrant.",
    center=[float(cx), float(cz)],
    radiusM=radius,
    maximumSourceFitErrorM=float(
      np.max(np.abs(np.hypot(curve[:, 0] - cx, curve[:, 1] - cz) - radius))
    ),
    nativeOutwardReachM=float(reach[farthest]),
    minimumPanelInnerFaceOffsetM=float(reach[farthest]) + 0.03,
    farthestNativeVertex=corner[farthest].tolist(),
  )
  return result


def interior_roof_audit(buildings: list[dict], roofs: list) -> list[dict]:
  """Compare every retained interior roof vertex with the local main roof."""
  triangles = [np.array(t) for t in roofs]
  shapes = [Polygon(t[:, [0, 2]]) for t in triangles]

  def main_roof_at(x: float, z: float) -> float | None:
    heights = []
    for triangle, shape in zip(triangles, shapes, strict=True):
      if shape.area < 1e-10 or not shape.buffer(1e-8).covers(Point(x, z)):
        continue
      a, b, c = triangle
      n = np.cross(b - a, c - a)
      if abs(n[1]) > 1e-9:
        heights.append(float(a[1] - (n[0] * (x - a[0]) + n[2] * (z - a[2])) / n[1]))
    return max(heights) if heights else None

  result = []
  for building in sorted(buildings, key=lambda b: b["id"]):
    if building["id"] == MAIN:
      continue
    vertices = {
      tuple(p)
      for part in building["parts"]
      for surface in part["surfaces"]
      if surface["kind"] == "RoofSurface"
      for ring in surface["rings"]
      for p in ring
    }
    gaps = []
    for x, y, z in vertices:
      height = main_roof_at(x, z)
      if height is not None:
        gaps.append(height - y)
    assert len(gaps) == len(vertices) and min(gaps) > 0
    result.append(
      dict(
        owner=building["id"],
        sourceRoofVertices=len(vertices),
        verticesCoveredByMainRoof=len(gaps),
        minimumMainRoofGapM=round(min(gaps), 6),
        maximumMainRoofGapM=round(max(gaps), 6),
      )
    )
  return result


def main() -> None:
  """Write small runtime retirement receipts and independently checkable proof."""
  buildings, occupied, inputs = retained()
  main_building = next(b for b in buildings if b["id"] == MAIN)
  models = {b["id"]: core.model(b, occupied) for b in buildings}
  main_shell, main_front, _, _ = models[MAIN]
  records, facade_audit, packet_inputs = matches(main_front, "drawn", False)
  inputs.update(packet_inputs)
  assert len(main_front.triangles) == 3672
  source_audit = []
  for building in sorted(buildings, key=lambda b: b["id"]):
    shell, fronts, _, _ = models[building["id"]]
    _, audit, packet_inputs = matches(shell, "drawn", True)
    inputs.update(packet_inputs)
    source_audit.append(
      dict(
        owner=building["id"],
        emittedSourceTriangles=len(shell.triangles),
        deliveredSourceTriangles=sum(a["selected"] for a in audit),
        genericFacadeTriangles=len(fronts.triangles),
        groundY=building["groundY"],
        topY=max(p["topY"] for p in building["parts"]),
        packets=audit,
      )
    )
  complete = Detail()
  complete.triangles = main_shell.triangles + main_front.triangles
  native = merge_native_faces(native_detail(complete))
  _, native_audit, packet_inputs = matches(native, "minecraft", True)
  inputs.update(packet_inputs)
  edge_path = ROOT / "geo_data/regierungsviertel/alt-mitte-edges-v186-evidence.json"
  edge_faces = [f for f in read(edge_path)["faces"] if f["parentId"] in OWNERS]
  inputs[str(edge_path.relative_to(ROOT))] = sha(edge_path)
  house_membership = {}
  for filename, field in [
    ("roofHouseV233.json", "keys"),
    ("houseDoorsV233.json", "ids"),
    ("houseCurbsV233.json", "ids"),
  ]:
    path = APP / filename
    house_membership[filename] = [
      k for k in read(path)[field] if k.split(":")[-1] in {"2_0", "2_1"}
    ]
    inputs[str(path.relative_to(ROOT))] = sha(path)
  for filename in [
    "lafayette_v241_receipts.py",
    "build_alt_mitte_v169.py",
    "alt_mitte_v169_packets.py",
    "build_karl_marx_allee_v161.py",
    "build_surrounding_outlines.py",
  ]:
    path = ROOT / "scripts" / filename
    inputs[str(path.relative_to(ROOT))] = sha(path)
  result = dict(schemaVersion=1, records=records)
  evidence = dict(
    schemaVersion=1,
    policy="Retire only the exact delivered estimated v169 facade of DEBE01YYK00008UX. All measured source shells/roofs, twelve interior owners, ink, native faces and unrelated packet triangles remain unchanged. The replay includes the complete original occupancy and inherited appearance; any mismatch fails closed.",
    mainOwner=MAIN,
    interiorOwners=sorted(INTERIOR),
    sourceInputs=inputs,
    emittedGenericFacadeTriangles=len(main_front.triangles),
    deliveredRetiredGenericFacadeTriangles=sum(len(r["triangles"]) for r in records),
    facadePackets=facade_audit,
    retainedSourceOwners=source_audit,
    interiorRoofOcclusion=interior_roof_audit(buildings, models[MAIN][3]),
    retainedNativeMain=dict(
      emittedTriangles=len(native.triangles),
      deliveredTriangles=sum(a["selected"] for a in native_audit),
      packets=native_audit,
      clearance=clearance(native, main_building["footprintPolygons"][0]["ring"][:31]),
    ),
    retainedV186Edges=edge_faces,
    v233PacketMembership=house_membership,
    v186Relief="The runtime relief/shading pass acts on the same generic panes; their exact retirement also retires their relief. It adds no geometry. Main owner is excluded from measured v186 edge additions by its mapped glass material.",
    interiorHeightPolicy="Retain original roof sheets and all twelve owners without lifting or inventing exterior towers. Every sampled original interior roof vertex lies below the local measured main roof, with the exact per-owner vertex counts and vertical gaps recorded separately.",
  )
  for path, data in [(PREVIOUS, result), (EVIDENCE, evidence)]:
    path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    json.dumps(
      dict(
        emitted=len(main_front.triangles),
        retired=evidence["deliveredRetiredGenericFacadeTriangles"],
        packets=facade_audit,
        sourceOwners=[
          {k: v for k, v in a.items() if k != "packets"} for a in source_audit
        ],
        native=evidence["retainedNativeMain"],
        v186EdgeCount=len(edge_faces),
        v233=house_membership,
      ),
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
