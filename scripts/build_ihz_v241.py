"""Bounded source-plane facade refinement: Neue IHZ and Dorotheenstrasse 33."""

from __future__ import annotations

import base64
import gzip
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

import build_alt_mitte_v169 as core
import numpy as np
import shapely
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_karl_marx_allee_v161 import Detail, native_detail
from build_lafayette_v241 import pieces, read, sha, surface_plane, write
from build_scheunenviertel_v168 import merge_native_faces
from lafayette_v241_receipts import fingerprint, mesh_signatures, retained
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app/src/data"
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OWNERS = {
  "DEBE01YYK0001uk4",
  "DEBE00YY1mz0006y",
  "DEBE00YY1mz00070",
  "DEBE01YYK0000A9a",
}
DORO = "DEBE01YYK0000A9a"
BOUNDS = [1160, -85, 1285, 85]
SOURCE = GEO / "ihz-v241-source.json.gz"
EVIDENCE = GEO / "ihz-v241-evidence.json"
RUNTIME = APP / "ihzV241.json"
PREVIOUS = APP / "ihzV241Previous.json"


def selected(surface: dict, owner: str) -> bool:
  if surface["kind"] != "WallSurface":
    return False
  _, n, _, _, poly = surface_plane(surface)
  p = np.array(surface["rings"][0])
  x, y, z = p.mean(0)
  if poly.area < 12 or abs(n[1]) > 0.1 or p[:, 1].max() - p[:, 1].min() < 2:
    return False
  if owner == DORO:
    return (n[2] < -0.8 and z < 50) or (n[0] > 0.8 and x > 1278)
  return (
    (n[0] < -0.8 and x < 1175)
    or (abs(n[2]) > 0.8 and (z < -70 or z > 29))
    or (n[2] < -0.8 and -16 < z < -10)
    or (n[2] > 0.8 and -32 < z < -27)
  )


def fitting(surface: dict, owner: str, native: bool) -> Detail:
  """Stone spandrels, paired panes, fine reveals on one clipped source sheet."""
  detail = Detail()
  o, n, dominant, axes, poly = surface_plane(surface)
  if axes[1] != 1:
    axes.reverse()
    poly = shapely.make_valid(
      Polygon(
        np.array(surface["rings"][0])[:, axes],
        [np.array(r)[:, axes] for r in surface["rings"][1:]],
      )
    )
  a, low, b, high = poly.bounds
  doro = owner == DORO
  pitch = 3.0 if doro else 3.7
  floors = (
    [4.3, 8.6, 12.0, 15.4, 18.8, 22.2, 25.6, 29.0, 32.4]
    if doro
    else [3.7, 8.0, 11.6, 15.2, 18.8, 22.4, 26.0, 29.6, 33.2, 37.2]
  )
  stone = (184, 177, 162) if doro else (169, 168, 159)
  glass = (82, 111, 117) if doro else (69, 91, 90)
  metal = (157, 161, 153)

  def emit(shape, color, role, offset):
    for p in pieces(poly.intersection(shape)):
      if p.area < 0.0001:
        continue
      for t in shapely.constrained_delaunay_triangles(p).geoms:
        points = []
        for u, v in list(t.exterior.coords)[:-1]:
          q = np.zeros(3)
          q[axes] = [u, v]
          q[dominant] = (
            o[dominant] - sum(n[k] * (q[k] - o[k]) for k in axes) / n[dominant]
          )
          # Separate native layers beyond centimetre quantization/depth error.
          q += n * (0.08 + (offset - 0.22) * 3 if native else offset)
          points.append(q.tolist())
        detail.polygon(points, color, role)

  if not doro:
    emit(poly, stone, "source-bound stone grid", 0.22)
  for u in np.arange(math.floor(a / pitch) * pitch, b, pitch):
    for level, (bottom, top) in enumerate(zip(floors, floors[1:])):
      sill = 0.18 if level == 0 else (0.45 if doro else 0.72)
      head = 0.14 if level == 0 else 0.40
      left = u + 0.27
      right = u + pitch - 0.27
      mid = (left + right) / 2
      w = box(left, bottom + sill, right, top - head)
      tint = tuple(c + ((level % 3) - 1) * 3 for c in glass)
      if not doro:
        emit(w, tint, "paired office glass", 0.25)
      emit(
        box(left, bottom + sill, right, bottom + sill + 0.10),
        metal,
        "projected sill",
        0.35,
      )
      emit(box(left, top - head - 0.09, right, top - head), metal, "window head", 0.34)
      for x in [left, mid, right]:
        emit(
          box(x - 0.045, bottom + sill, x + 0.045, top - head),
          metal,
          "window jamb and paired mullion",
          0.33,
        )
      if not doro:
        emit(
          box(left + 0.09, top - head - 0.46, right - 0.09, top - head - 0.26),
          tuple(c + 10 for c in tint),
          "glass reflection",
          0.275,
        )
  for y in floors[1:]:
    emit(
      box(a, y - 0.11, b, y + 0.11),
      tuple(min(255, c + 19) for c in stone),
      "horizontal stone course",
      0.36,
    )
    emit(
      box(a, y - 0.30, b, y - 0.25),
      tuple(c - 17 for c in stone),
      "spandrel shadow joint",
      0.32,
    )
  return detail


def native_faces(native: Detail, targets: list[dict]) -> list[dict]:
  """Fit only existing orthogonal faces near the selected source fronts."""
  groups = defaultdict(list)
  planes = [surface_plane(s) for s in targets]
  for t, _, _ in native.triangles:
    p = np.array(t)
    n = np.cross(p[1] - p[0], p[2] - p[0])
    n /= np.linalg.norm(n)
    axis = int(np.argmax(abs(n)))
    if axis == 1:
      continue
    center = p.mean(0)
    found = False
    for o, sn, _, sa, sp in planes:
      dist = float((center - o) @ sn)
      if -0.05 <= dist <= 3.1 and n @ sn > 0.03:
        projected = center - dist * sn
        if sp.buffer(1.6).covers(Point(projected[sa])):
          found = True
          break
    if found:
      axes = [i for i in range(3) if i != axis]
      groups[(axis, int(np.sign(n[axis])), float(p[0, axis]))].append(
        Polygon(p[:, axes])
      )
  result = []
  for (axis, sign, value), triangles in sorted(groups.items()):
    axes = [i for i in range(3) if i != axis]
    for poly in pieces(unary_union(triangles)):
      rings = []
      for r in [poly.exterior, *poly.interiors]:
        points = []
        for u, v in list(r.coords)[:-1]:
          p = [0.0, 0.0, 0.0]
          p[axis] = value
          p[axes[0]], p[axes[1]] = u, v
          points.append(p)
        rings.append(points)
      s = dict(kind="WallSurface", rings=rings)
      if surface_plane(s)[1][axis] * sign < 0:
        s["rings"] = [list(reversed(r)) for r in rings]
      result.append(s)
  return result


def receipts(front: Detail) -> tuple[list, dict]:
  """Exact selected old facade receipts; other indices remain untouched."""
  result = []
  inputs = {}
  shaded = core.isometric_shading(front)
  for tile in ["2_-1", "2_0"]:
    p = read(PUB / (tile + ".drawn.json.gz"))
    origin = p["origin"]
    bounds = [origin[0], origin[2], origin[0] + 512, origin[2] + 512]
    pending = Counter(
      s
      for m in pack_detail(shaded, bounds, origin_y=origin[1])
      for s in mesh_signatures(m)
    )
    candidates = [
      c
      for c in read(PUB / "manifest.json")["chunks"]
      if c["id"] == tile or c["id"].startswith(tile + "-alt-mitte-v169-")
    ]
    for candidate in candidates:
      path = PUB / candidate["drawn"]["url"]
      p = read(path)
      for m in p["meshes"]:
        if m["kind"] != "alt-mitte-v169":
          continue
        chosen = []
        for i, s in enumerate(mesh_signatures(m)):
          if pending[s]:
            chosen.append(i)
            pending[s] -= 1
        if chosen:
          result.append(
            dict(
              tile=candidate["id"],
              kind=m["kind"],
              mode="drawn",
              fingerprint=fingerprint([m["positions"], m["colors"], m["indices"]]),
              triangles=chosen,
            )
          )
      inputs[str(path.relative_to(ROOT))] = sha(path)

    assert sum(pending.values()) == 0, (tile, sum(pending.values()))
    inputs[str(path.relative_to(ROOT))] = sha(path)
  return result, inputs


def build() -> None:
  # Reuse original occupancy/appearance replay, without changing its owner set.
  _, occupied, inputs = retained()
  buildings = []
  for path in sorted(core.SOURCE.glob("source-*.json.gz")):
    buildings.extend(b for b in read(path)["buildings"] if b["id"] in OWNERS)
  assert {b["id"] for b in buildings} == OWNERS
  write(
    SOURCE,
    dict(
      schemaVersion=1,
      buildings=buildings,
      primaryReferences=[
        "https://www.wbm.de/gewerbe-berlin/internationales-handelszentrum/",
        "https://hausinvest.de/de/blog/immobilienmarkt-berlin/",
        "https://www.immobilienscout24.de/expose/170479236",
        "https://www.zeit.de/zeitverlag/PR/impressum",
        "https://www.zeit.de/impressum/index",
      ],
      visualReference=dict(
        url="https://commons.wikimedia.org/wiki/File:Internationales_Handelszentrum_Berlin_Sockel_Denis_Apel_CC.jpg",
        author="Denis Apel / flyingpixel.de / Wikipedia",
        date="2011-03-04",
        license="CC-BY-SA-4.0",
        licenseUrl="https://creativecommons.org/licenses/by-sa/4.0/",
        use="Reference only, no image bundled",
      ),
    ),
  )
  drawn, native, old = Detail(), Detail(), Detail()
  annex_native = Detail()
  annex_targets = []
  audit = []
  for b in buildings:
    targets = []
    removed = 0
    for pi, p in enumerate(b["parts"]):
      low = min(
        (
          q[1]
          for s in p["surfaces"]
          if s["kind"] == "GroundSurface"
          for r in s["rings"]
          for q in r
        ),
        default=p["groundY"],
      )
      for si, s in enumerate(p["surfaces"]):
        if not selected(s, b["id"]):
          continue
        targets.append(s)
        new = fitting(s, b["id"], False)
        drawn.triangles.extend(new.triangles)
        oldface = core.facade(s["rings"], low, p["topY"], occupied)
        if b["category"] != "retained":
          old.triangles.extend(oldface.triangles)
          removed += len(oldface.triangles)
    shell, front, _, _ = core.model(b, occupied)
    full = Detail()
    full.triangles = shell.triangles + front.triangles
    existing = merge_native_faces(native_detail(full))
    if b["id"] == DORO:
      for s in native_faces(existing, targets):
        native.triangles.extend(fitting(s, b["id"], True).triangles)
    else:
      annex_native.triangles.extend(existing.triangles)
      annex_targets.extend(targets)
    audit.append(
      dict(
        owner=b["id"],
        sourceSheets=sum(len(p["surfaces"]) for p in b["parts"]),
        sourceTriangles=len(shell.triangles),
        nativeSourceTriangles=len(existing.triangles),
        selectedSheets=len(targets),
        oldFacadeTriangles=removed,
      )
    )
  # Several measured owners share the annex perimeter: union their native
  # planes before fitting, so coincident bodies never add duplicate skins.
  for s in native_faces(annex_native, annex_targets):
    native.triangles.extend(fitting(s, "annex", True).triangles)
  records, packet_inputs = receipts(old)
  inputs.update(packet_inputs)
  write(PREVIOUS, dict(schemaVersion=1, records=records))
  runtime = {}
  counts = {}
  for name, d in [("drawn", drawn), ("minecraft", native)]:
    # Exact coincident source planes may occur in multiple retained owners.
    seen = set()
    unique = []
    for t, c, role in d.triangles:
      key = (tuple(sorted(tuple(round(v, 5) for v in p) for p in t)), c)
      if key not in seen:
        seen.add(key)
        unique.append((t, c, role))
    d.triangles = unique
    packet = empty_packet("ihz-v241-" + name, BOUNDS)
    packet["meshes"] = pack_detail(d, BOUNDS, origin_y=-10)
    for m in packet["meshes"]:
      m["kind"] = "ihz-v241"
    runtime[name] = packet
    counts[name] = dict(
      triangles=sum(
        len(base64.b64decode(m["indices"])) // 12 for m in packet["meshes"]
      ),
      vertices=sum(
        len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"]
      ),
      roles=dict(Counter(r for _, _, r in d.triangles)),
    )
  write(RUNTIME, runtime)
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      sourceSha256=sha(SOURCE),
      runtimeSha256=sha(RUNTIME),
      previousSha256=sha(PREVIOUS),
      sourceInputs=inputs,
      owners=audit,
      counts=counts,
      retiredTriangles=sum(len(r["triangles"]) for r in records),
      runtimeBytes=RUNTIME.stat().st_size,
      runtimeGzipBytes=len(gzip.compress(RUNTIME.read_bytes(), mtime=0)),
      preserve="All source sheets, roofs, courts, navigation and native cells unchanged. Only exactly receipted generic drawn decoration on selected replacement faces retires. Unsurveyed bay/material/fitting dimensions are display estimates. Full mobile detail and live limits unchanged. No current tenant claim.",
    ),
  )
  print(
    json.dumps(
      dict(
        owners=audit,
        counts=counts,
        retired=sum(len(r["triangles"]) for r in records),
        bytes=RUNTIME.stat().st_size,
        gzip=len(gzip.compress(RUNTIME.read_bytes(), mtime=0)),
      ),
      indent=2,
    )
  )


if __name__ == "__main__":
  build()
