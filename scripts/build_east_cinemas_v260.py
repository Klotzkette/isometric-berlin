"""Step 10: exact International cantilever and source-bound Moskau anchors."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import build_alt_mitte_v169 as core
import numpy as np
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_karl_marx_allee_v161 import Detail, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint, signature, vertices
from build_scheunenviertel_v168 import merge_native_faces
from build_springer_v215 import old_models
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OWNER = "DEBE01YYK0000BqW"
MOSKAU = "DEBE01YYK0000359"
BOUNDS = [3072, -512, 3584, 0]
FRONT_A = [3476.469, -103.914]
FRONT_B = [3507.760, -87.711]
DEPTH = 9.0
SOFFIT = 9.0
D = np.subtract(FRONT_B, FRONT_A)
D /= np.linalg.norm(D)
INWARD = np.array([D[1], -D[0]])


def digest(value: object) -> str:
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def write(path: Path, value: object) -> None:
  path.write_text(json.dumps(value, separators=(",", ":")) + "\n")


def depth(p: list[float]) -> float:
  return float((np.array([p[0], p[2]]) - FRONT_A) @ INWARD)


def clip(ring: list, value, threshold: float, keep_high: bool) -> list:
  result = []
  for a, b in zip(ring, ring[1:] + ring[:1], strict=True):
    da, db = value(a) - threshold, value(b) - threshold
    ia, ib = da >= -1e-8, db >= -1e-8
    if not keep_high:
      ia, ib = da <= 1e-8, db <= 1e-8
    if ia:
      result.append(a)
    if ia != ib:
      t = da / (da - db)
      result.append([round(a[k] + (b[k] - a[k]) * t, 8) for k in range(3)])
  return result


def source() -> tuple[dict, dict, list, dict]:
  records, hashes = [], {}
  for tile in ["392_5820", "393_5820", "392_5819", "393_5819"]:
    p = GEO / f"alt-mitte-v169/source-{tile}-00.json.gz"
    records.extend(json.loads(gzip.decompress(p.read_bytes()))["buildings"])
    hashes[str(p.relative_to(ROOT))] = hashlib.sha256(p.read_bytes()).hexdigest()
  kino = next(b for b in records if b["id"] == OWNER)
  moskau = next(b for b in records if b["id"] == MOSKAU)
  return kino, moskau, records, hashes


def corrected(kino: dict) -> tuple[Detail, list, list]:
  """Keep every upper source sheet; cut only the demonstrably closed undercroft."""
  detail = Detail()
  stone, roof = (217, 214, 201), (168, 173, 169)
  original = kino["parts"][0]["surfaces"]
  source_foot = kino["footprintPolygons"][0]["ring"]
  lower = clip([[x, 3.0, z] for x, z in source_foot], depth, DEPTH, True)
  underside = clip([[x, SOFFIT, z] for x, z in source_foot], depth, DEPTH, False)
  kept = []
  for s in original:
    if s["kind"] == "RoofSurface":
      kept.append(copy.deepcopy(s))
    elif s["kind"] == "WallSurface":
      upper = clip(s["rings"][0], lambda p: p[1], SOFFIT, True)
      lower_face = clip(
        clip(s["rings"][0], lambda p: p[1], SOFFIT, False), depth, DEPTH, True
      )
      for r in [upper, lower_face]:
        if (
          len(r) >= 3
          and np.linalg.norm(np.cross(np.subtract(r[1], r[0]), np.subtract(r[2], r[0])))
          > 1e-7
        ):
          kept.append(dict(kind="WallSurface", rings=[r]))
  # Actual lower foyer enclosure at the source-aligned 9 m recess.
  edge = [p for p in lower if abs(depth(p) - DEPTH) < 1e-5]
  edge.sort(key=lambda p: (np.array([p[0], p[2]]) - FRONT_A) @ D)
  assert len(edge) == 2
  a, b = edge
  recessed = [a, b, [b[0], SOFFIT, b[2]], [a[0], SOFFIT, a[2]]]
  kept.append(dict(kind="WallSurface", rings=[recessed]))
  kept.append(dict(kind="ClosureSurface", rings=[underside]))
  for s in kept:
    for t in core.triangulate(s["rings"]):
      detail.polygon(
        t, roof if s["kind"] == "RoofSurface" else stone, "source " + s["kind"]
      )
  return detail, kept, [[p[0], p[2]] for p in lower]


def receipts(
  shell: Detail, front: Detail, native: Detail, kino: dict, neighbours: list
) -> tuple[list, list, list, list]:
  records, originals, line_records, nav_records = [], [], [], []
  full = Detail()
  full.triangles = shell.triangles + front.triangles
  for mode, layer, detail in [
    ("drawn", "complete", full),
    ("minecraft", "complete", native),
  ]:
    candidates = [
      (
        p.name.removesuffix(f".{mode}.json.gz"),
        p,
        json.loads(gzip.decompress(p.read_bytes())),
      )
      for p in sorted(PUB.glob(f"6_-1*.{mode}.json.gz"))
    ]
    remaining = {}
    for tile, path, packet in candidates:
      origin = packet["origin"]
      key = tuple(origin)
      if key not in remaining:
        wanted = Counter()
        for m in pack_detail(
          core.isometric_shading(detail) if mode == "drawn" else detail,
          BOUNDS,
          origin_y=origin[1],
        ):
          inds = np.frombuffer(base64.b64decode(m["indices"]), dtype="<u4").reshape(
            -1, 3
          )
          wanted.update(signature(t) for t in vertices(m)[inds])
        remaining[key] = wanted
      wanted = remaining[key]
      for mesh in packet["meshes"]:
        if mesh["kind"] != "alt-mitte-v169":
          continue
        inds = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(
          -1, 3
        )
        matches = []
        for i, t in enumerate(vertices(mesh)[inds]):
          sig = signature(t)
          if wanted[sig]:
            matches.append(i)
            wanted[sig] -= 1
        if matches:
          records.append(
            dict(
              tile=tile,
              kind=mesh["kind"],
              mode=mode,
              fingerprint=fingerprint(
                [mesh["positions"], mesh["colors"], mesh["indices"]]
              ),
              triangles=matches,
              part=OWNER,
              layer=layer,
            )
          )
          originals.append(
            dict(
              file=str(path.relative_to(ROOT)),
              sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
            )
          )
      if mode == "drawn":
        for nav in packet.get("nav", {}).get("buildings", []):
          if nav.get("sourceId") == OWNER:
            nav_records.append(dict(tile=tile, original=nav))
    missing = sum(sum(c.values()) for c in remaining.values())
    assert remaining and missing == 0, (mode, layer, missing)
  edges = [
    (a, b)
    for part in kino["parts"]
    for s in part["surfaces"]
    if s["kind"] in {"WallSurface", "RoofSurface"}
    for r in s["rings"]
    for a, b in zip(r, r[1:] + r[:1], strict=True)
  ]
  other_edges = [
    (a, b)
    for record in neighbours
    if record["id"] != OWNER
    for part in record["parts"]
    for s in part["surfaces"]
    if s["kind"] in {"WallSurface", "RoofSurface"}
    for r in s["rings"]
    for a, b in zip(r, r[1:] + r[:1], strict=True)
    if 3470 < a[0] < 3535 and -150 < a[2] < -80
  ]
  for p in sorted(PUB.glob("6_-1*.drawn.json.gz")):
    packet = json.loads(gzip.decompress(p.read_bytes()))
    if "lines" not in packet:
      continue
    origin = np.array(packet["origin"])

    def keys(pairs):
      return {
        tuple(
          sorted(tuple(np.rint((np.array(q) - origin) * 100).astype(int)) for q in pair)
        )
        for pair in pairs
      }

    wanted = keys(edges) - keys(other_edges)
    lines = packet["lines"]
    values = np.frombuffer(base64.b64decode(lines["positions"]), dtype="<u2").reshape(
      -1, 2, 3
    )
    matches = [
      i
      for i, pair in enumerate(values)
      if tuple(sorted(tuple(q) for q in pair)) in wanted
    ]
    if matches:
      line_records.append(
        dict(
          tile=p.name.removesuffix(".drawn.json.gz"),
          mode="drawn",
          fingerprint=fingerprint([lines["positions"], lines.get("colors", "")]),
          segments=matches,
          part=OWNER,
        )
      )
      originals.append(
        dict(
          file=str(p.relative_to(ROOT)),
          sha256=hashlib.sha256(p.read_bytes()).hexdigest(),
        )
      )
  # All outer collision packets retain their original exact record for matching.
  for p in sorted(PUB.glob("6_-1*.drawn.json.gz")):
    packet = json.loads(gzip.decompress(p.read_bytes()))
    for nav in packet.get("nav", {}).get("buildings", []):
      if nav.get("sourceId") == OWNER:
        nav_records.append(
          dict(tile=p.name.removesuffix(".drawn.json.gz"), original=nav)
        )
  return records, line_records, originals, nav_records


def faces(building: dict) -> list:
  result = []
  footprint = unary_union(
    [Polygon(p["ring"], p["holes"]) for p in building["footprintPolygons"]]
  )
  for part in building["parts"]:
    for i, s in enumerate(part["surfaces"]):
      if s["kind"] != "WallSurface":
        continue
      r = s["rings"][0]
      a, b = max(
        ((a, b) for a in r for b in r),
        key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
      )
      length = math.hypot(b[0] - a[0], b[2] - a[2])
      if length < 2 or max(p[1] for p in r) - min(p[1] for p in r) < 3:
        continue
      n = [(b[2] - a[2]) / length, -(b[0] - a[0]) / length]
      if footprint.covers(
        Point((a[0] + b[0]) / 2 + n[0] * 0.1, (a[2] + b[2]) / 2 + n[1] * 0.1)
      ):
        n = [-n[0], -n[1]]
      result.append(
        dict(
          part=part["id"],
          index=i,
          a=[a[0], a[2]],
          b=[b[0], b[2]],
          normal=n,
          bottom=min(p[1] for p in r),
          top=min(p[1] for p in r if p[1] > 3.01),
          surfaceSha256=digest(s),
        )
      )
  return result


def build() -> dict:
  kino, moskau, neighbours, hashes = source()
  old_shell, old_front, old_native = old_models(kino, neighbours)
  shell, sheets, lower = corrected(kino)
  native_raw = native_detail(shell)
  native = merge_native_faces(native_raw)
  cells = set()
  for triangle, _, _ in native_raw.triangles:
    points = np.array(triangle)
    normal = np.cross(points[1] - points[0], points[2] - points[0])
    normal /= np.linalg.norm(normal)
    cells.add(
      tuple(
        np.floor((points.mean(0) - normal * 0.01 - [0, 3, 0]) / 2).astype(int).tolist()
      )
    )
  transfer, line_transfer, originals, nav = receipts(
    old_shell, old_front, old_native, kino, neighbours
  )
  for family, detail in [
    ("Drawn", core.isometric_shading(shell)),
    ("Minecraft", native),
  ]:
    packet = empty_packet("east-cinemas-v260", BOUNDS)
    packet["meshes"] = pack_detail(detail, BOUNDS)
    write(APP / f"eastCinemasV260{family}.json", packet)
  nav = list({digest(r): r for r in nav}.values())
  ownership = dict(
    owner=OWNER, records=transfer, lineRecords=line_transfer, navigationRecords=nav
  )
  write(
    APP / "eastCinemasV260Navigation.json",
    dict(
      owner=OWNER,
      nativeShellCells=sorted(cells),
      sourceGroundY=3,
      soffitY=SOFFIT,
      nativeRoofY=21,
    ),
  )
  write(APP / "eastCinemasV260Ownership.json", ownership)
  anchors = dict(
    schema=1,
    license="Geoportal Berlin dl-de/zero-2-0; OSM ODbL-1.0",
    sites={
      "international": dict(
        parent=OWNER,
        osm="way/24240975",
        partCount=1,
        sourceSha256=digest(kino),
        faces=faces(kino),
        upperRing=kino["footprintPolygons"][0]["ring"],
        lowerRing=lower,
        frontA=FRONT_A,
        frontB=FRONT_B,
        inward=INWARD.tolist(),
        soffitY=SOFFIT,
        sourceRoofY=kino["parts"][0]["topY"],
        cantileverM=DEPTH,
      ),
      "moskau": dict(
        parent=MOSKAU,
        osm="relation/1320420",
        partCount=6,
        sourceSha256=digest(moskau),
        faces=faces(moskau),
        footprintPolygons=moskau["footprintPolygons"],
      ),
    },
    sourcePackets=hashes,
    estimates="Soffit height 9 m scene Y, facade subdivisions, colours, relief impressions, glazing and Sputnik support are display estimates. Nine-metre cinema projection is published; all source roof vertices and upper walls retained.",
  )
  write(APP / "eastCinemasV260.json", anchors)
  complete = dict(
    originalInternational=kino,
    originalMoskau=moskau,
    correctedInternationalSurfaces=sheets,
    sourcePackets=hashes,
  )
  (GEO / "east-cinemas-v260-source.json.gz").write_bytes(
    gzip.compress(
      (json.dumps(complete, separators=(",", ":")) + "\n").encode(), mtime=0
    )
  )
  evidence = dict(
    schema=1,
    owner=OWNER,
    retainedSourcePackets=hashes,
    retainedRuntimePackets=originals,
    originalRoofSha256=digest(
      [s for s in kino["parts"][0]["surfaces"] if s["kind"] == "RoofSurface"]
    ),
    correctedRoofSha256=digest([s for s in sheets if s["kind"] == "RoofSurface"]),
    drawnShellTriangles=len(shell.triangles),
    nativeShellTriangles=len(native.triangles),
    transferTriangles=sum(len(r["triangles"]) for r in transfer),
    transferLines=sum(len(r["segments"]) for r in line_transfer),
    conflict="LoD2 models the cantilever to ground; exact owner correction opens its published 9 m recess. Source height 17.127 m above display ground differs from OSM 15 m; source roof height retained. Soffit height is a documented photo estimate.",
  )
  write(GEO / "east-cinemas-v260-evidence.json", evidence)
  return evidence


if __name__ == "__main__":
  print(json.dumps(build(), indent=2))
