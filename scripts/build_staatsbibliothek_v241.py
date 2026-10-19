"""Finite renovated Linden-front correction; all other library sources survive."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import build_alt_mitte_v169 as core
import numpy as np
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_bundeswehr_hospital_v215 import detail_difference
from build_karl_marx_allee_v161 import Detail, clip_polygon, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint
from build_scheunenviertel_v168 import merge_native_faces
from build_schlossplatz_alt_mitte_v239 import edges, line_signatures
from build_schlossplatz_alt_mitte_v239 import signatures as mesh_signatures
from build_schlossplatz_v239 import Facade as BaseFacade
from build_staatsoper_v240 import Facade as OperaFacade
from build_staatsoper_v240 import figure, pediment
from build_venues_hermann_v238 import rgb
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/src/data"
PARENT = "DEBE01YYK00002vr"
CUPOLA = "DEBE3DbBJ132QVQ7"
MAIN = "DEBE3Di3VeB8rUHf"
BOUNDS = (1280, 0, 1440, 220)
SLATE = (70, 85, 91)
CREAM, STONE, DARK = 0xD7D1BC, 0xBDBAA8, 0x596F73


class Facade(OperaFacade):
  def arched_glass(self, u: float, spring: float, radius: float) -> None:
    for mode, detail in self.models.items():
      if mode == "drawn":
        detail.polygon(
          [self.point(u, spring, 0.22)]
          + [
            self.point(u + radius * math.cos(t), spring + radius * math.sin(t), 0.22)
            for t in np.linspace(0, math.pi, 17)
          ],
          rgb(DARK),
          self.name + "/arched-glass",
        )
      else:
        for step in range(12):
          x = -radius + (step + 0.5) * radius / 6
          high = math.sqrt(max(0, radius * radius - x * x))
          p = self.point(u + x, spring + high / 2, 2.37)
          detail.box(
            p, [radius / 6, high, 0.15], rgb(DARK), self.name + "/arched-glass"
          )

  def arch(self, *args: Any, **kwargs: Any) -> None:
    for mode, detail in self.models.items():
      origin = self.a + self.n * (1.4 if mode == "minecraft" else 0)
      BaseFacade({mode: detail}, origin, self.d, self.n, self.name).arch(
        *args, **kwargs
      )


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path: Path, data: Any) -> None:
  path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def retained() -> tuple[list, dict, Any]:
  manifest = read(core.SOURCE / "source-manifest.json")
  all_records = [
    b for c in manifest["chunks"] for b in read(core.SOURCE / c["file"])["buildings"]
  ]
  occupied = unary_union([core.footprint(b) for b in all_records])
  core.APPEARANCE.clear()
  ranks = {}
  for previous in read(core.SOURCE / "appearance-baseline.json.gz")["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          core.APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  return all_records, next(b for b in all_records if b["id"] == PARENT), occupied


def corrected(original: dict) -> dict:
  """One complete corrected roof, no change to foot course, courts or datum.

  The generalized LoD2 portal turns its curved slate skirt into high vertical
  walls. Restore the documented convex pavilion cap between its exact source
  base course and retained maximum top. Profile stations are display estimates.
  """
  building = copy.deepcopy(original)
  p = next(p for p in building["parts"] if p["id"] == CUPOLA)
  base, top = 32.2, p["topY"]
  new = []
  for s in p["surfaces"]:
    if s["kind"] == "RoofSurface":
      continue
    rings = [clip_polygon(r, 1, base, False) for r in s["rings"]]
    rings = [r for r in rings if len(r) >= 3]
    if rings:
      new.append({**s, "rings": rings})
  footprint = np.array(p["footprintPolygons"][0]["ring"])
  if np.allclose(footprint[0], footprint[-1]):
    footprint = footprint[:-1]
  centre = np.array([1365.97, 182.0])
  rings = []
  for i in range(9):
    t = math.pi / 2 * i / 8
    factor = 0.32 + 0.68 * math.cos(t)
    xz = centre + (footprint - centre) * factor
    y = base + (top - base) * math.sin(t)
    rings.append([[float(x), float(y), float(z)] for x, z in xz])
  for a, b in zip(rings, rings[1:]):
    for j in range(len(a)):
      k = (j + 1) % len(a)
      new.append(dict(kind="RoofSurface", rings=[[a[j], a[k], b[k], b[j]]]))
  new.append(dict(kind="RoofSurface", rings=[rings[-1]]))
  p["surfaces"] = new
  # The front wing is another flat LoD2 abstraction. Reinterpret only its
  # narrow outer roof skirt, keeping rear ridge, footprint and all court holes.
  main = next(p for p in building["parts"] if p["id"] == MAIN)
  surfaces = []
  for surface in main["surfaces"]:
    if surface["kind"] not in ("WallSurface", "RoofSurface", "ClosureSurface") or all(
      front_distance(p) <= -9 for r in surface["rings"] for p in r
    ):
      surfaces.append(surface)
      continue
    for triangle in core.triangulate(surface["rings"]):
      # Split at both profile hinges; the height transformation is linear
      # inside each piece and hence retains exact polygon holes.
      pieces = [triangle]
      for boundary in [-9.0, 0.0]:
        split = []
        for ring in pieces:
          for positive in [False, True]:
            value = clip_front(ring, boundary, positive)
            if len(value) >= 3:
              split.append(value)
        pieces = split
      for ring in pieces:
        # Also split the existing wall at the eaves to preserve lower courses.
        for high in [False, True]:
          clipped = clip_polygon(ring, 1, base, high)
          if len(clipped) < 3:
            continue
          transformed = [
            [
              x,
              min(
                y,
                base
                + (main["topY"] - base)
                * min(1.0, max(0.0, -front_distance([x, y, z]) / 9)),
              ),
              z,
            ]
            for x, y, z in clipped
          ]
          if (
            sum(
              np.linalg.norm(
                np.cross(
                  np.subtract(transformed[i], transformed[0]),
                  np.subtract(transformed[i + 1], transformed[0]),
                )
              )
              for i in range(1, len(transformed) - 1)
            )
            > 1e-8
          ):
            surfaces.append({**surface, "rings": [transformed]})
  main["surfaces"] = surfaces
  return building


def front_distance(p: list) -> float:
  return (p[0] - 1366.35) * 0.081602 + (p[2] - 190.60) * 0.996665


def clip_front(ring: list, boundary: float, positive: bool) -> list:
  output = []
  for a, b in zip(ring, ring[1:] + ring[:1]):
    va, vb = front_distance(a) - boundary, front_distance(b) - boundary
    ia, ib = (va >= -1e-8, vb >= -1e-8) if positive else (va <= 1e-8, vb <= 1e-8)
    if ia:
      output.append(a)
    if ia != ib:
      t = va / (va - vb)
      output.append([a[i] + t * (b[i] - a[i]) for i in range(3)])
  return output


def corrected_model(building: dict, occupied: Any) -> Detail:
  saved = {key: core.APPEARANCE.get(key) for key in (MAIN, CUPOLA)}
  for key in saved:
    if saved[key]:
      core.APPEARANCE[key] = {**saved[key], "roof": {"srgb8": SLATE}}
  shell = core.model(building, occupied)[0]
  for key, value in saved.items():
    if value is not None:
      core.APPEARANCE[key] = value
  return shell


def ornaments(data: dict) -> tuple[dict, dict]:
  models = {"drawn": Detail(), "minecraft": Detail()}
  oi = next(i for i, o in enumerate(data["owners"]) if o["id"] == MAIN)
  ci = next(i for i, o in enumerate(data["owners"]) if o["id"] == CUPOLA)
  old_boxes = []
  upper = []
  for i, r in enumerate(data["boxes"]):
    front = r[11] == oi and r[10] > 0.9 and r[2] > 180
    if front and (
      r[1] - r[4] / 2 > 18
      or ((1353 < r[0] < 1379 or r[0] < 1327.2 or r[0] > 1406.2) and r[8] != 3)
    ):
      old_boxes.append(dict(index=i, row=r))
    if front and r[8] == 1 and r[4] == 4.8:
      upper.append(r)
  # Sixteen windows keep their existing source-wall centres. Their upper storey
  # is taller and has alternating curved/triangular heads, not an attic grid.
  for i, r in enumerate(sorted(upper, key=lambda r: r[0])):
    if r[0] < 1327.2 or r[0] > 1406.2:
      continue
    d = np.array([math.cos(r[6]), -math.sin(r[6])])
    n = np.array(r[9:11])
    f = Facade(models, np.array([r[0], r[2]]) - n * 0.16, d, n, "street-upper")
    f.window(0, 23.3, 2.7, 6.3, "tall-window", STONE, DARK)
    f.block(0, 19.6, 3.0, 0.18, 0.4, CREAM, "window-balcony-base", 0.3)
    f.block(0, 20.2, 3.0, 0.15, 0.4, CREAM, "window-balcony-rail", 0.3)
    for u in np.linspace(-1.3, 1.3, 7):
      f.cylinder(float(u), 19.7, 20.15, 0.08, STONE, "window-baluster", 0.3)
    if not 1353 < r[0] < 1379:
      if i % 2:
        pediment(f, 0, 27.0, 3.8, 1.0, 0.3, "triangular-window-head")
      else:
        # Segmental heads are independently stepped in native form.
        f.arch(0, 26.7, 1.9, 0.20, CREAM, "curved-window-head", 0.3)
  for lo, hi in [(1315, 1327.2), (1406.2, 1417.3)]:
    end = [r for r in upper if lo < r[0] < hi]
    xz = np.mean([[r[0], r[2]] for r in end], axis=0)
    d = np.array([math.cos(end[0][6]), -math.sin(end[0][6])])
    n = np.array(end[0][9:11])
    f = Facade(models, xz - n * 0.16, d, n, "corner-risalit")
    f.window(0, 23.0, 3.9, 8.0, "large-corner-window", STONE, DARK)
    f.window(0, 10.6, 3.9, 8.0, "lower-corner-window", STONE, DARK)
    f.arched_glass(0, 14.6, 1.95)
    f.arch(0, 14.6, 1.95, 0.28, CREAM, "corner-round-arch", 0.35)
    for u in [-3.7, 3.7]:
      f.block(u, 19.0, 1.0, 20.0, 0.28, CREAM, "corner-pilaster", 0.3)
      f.block(u, 28.8, 1.7, 0.7, 0.5, STONE, "corner-capital", 0.3)
    f.block(0, 18.5, 5.0, 0.22, 0.6, CREAM, "corner-balcony", 0.5)
    for u in np.arange(-2.3, 2.4, 0.45):
      f.cylinder(float(u), 18.6, 19.4, 0.09, STONE, "corner-baluster", 0.5)
    f.block(0, 19.5, 5.0, 0.18, 0.6, CREAM, "corner-balcony-rail", 0.5)
  centre = np.array([1366.35, 190.60])
  d = np.array([0.996665, -0.081602])
  n = np.array([0.081602, 0.996665])
  f = Facade(models, centre, d, n, "Linden-portal")
  for u in [-6.95, 0, 6.95]:
    # Dark gates are shallow facade recesses, not invented navigable passages.
    f.window(u, 11.5, 4.2, 9.6, "portal-gate", STONE, DARK)
    f.arched_glass(u, 16.3, 2.1)
    f.arch(u, 16.3, 2.1, 0.3, CREAM, "portal-round-arch", 0.38)
    for v in [-1.4, -0.7, 0, 0.7, 1.4]:
      f.block(u + v, 11.5, 0.07, 9.5, 0.1, STONE, "portal-grille", 0.35)
  for u in [-10.2, -3.45, 3.45, 10.2]:
    f.cylinder(u, 8.4, 29.0, 0.55, CREAM, "giant-column", 0.7)
    f.block(u, 8.6, 1.5, 0.8, 1.1, STONE, "column-base", 0.7)
    f.block(u, 28.7, 1.8, 0.75, 1.3, STONE, "corinthian-capital", 0.7)
  for y, h, w in [(29.4, 0.55, 23.4), (30.5, 1.5, 23.6), (31.5, 0.4, 24.1)]:
    f.block(0, y, w, h, 0.65, CREAM, "portal-entablature", 0.65)
  pediment(f, 0, 31.75, 24.4, 6.2, 0.8, "Linden-pediment")
  for u in [-10.9, 10.9]:
    figure(f, u, 32.2, 1.25, "pediment-sculpture", 0.8)
  for u in np.linspace(-6.0, 6.0, 7):
    figure(f, float(u), 32.15, 0.85 if abs(u) < 3 else 0.65, "tympanum-relief", 0.95)
  # The full 107m street cornice is broken around the central pediment. Only
  # shallow rails and balusters are added; never a wall across an open court.
  for lo, hi in [(-46.0, -12.5), (12.5, 47.0)]:
    mid = (lo + hi) / 2
    for y in [31.8, 33.0]:
      f.block(mid, y, hi - lo, 0.20, 0.6, CREAM, "street-balustrade-rail", -0.55)
    for u in np.arange(lo + 0.35, hi - 0.1, 0.85):
      f.cylinder(float(u), 31.9, 32.9, 0.12, STONE, "street-baluster", -0.55)
    for u in [lo, hi]:
      f.block(u, 32.4, 1.4, 1.35, 1.0, STONE, "urn-pedestal", -0.55)
      f.cylinder(u, 33.1, 34.5, 0.40, CREAM, "roof-urn", -0.55)
      f.cylinder(u, 34.5, 35.0, 0.17, STONE, "urn-finial", -0.55)
  # Small crown at the documented reconstructed portal cupola's source top.
  crown = Facade(models, [1365.97, 182], d, n, "cupola-crown")
  for side in [-1, 1]:
    crown.block(0, 45.0, 7.3, 0.65, 0.14, STONE, "crown-rail", side * 2.1)
    for u in np.linspace(-3.3, 3.3, 16):
      crown.block(float(u), 45.0, 0.07, 0.7, 0.16, DARK, "crown-louvre", side * 2.2)
  old_blocks = [
    dict(index=i, row=r)
    for i, r in enumerate(data["blocks"])
    if (r[8] == ci and r[5] == 7)
    or (
      r[8] == oi
      and r[5] in (1, 2, 3)
      and r[2] > 185
      and r[2] > 301.0 - 0.0818 * r[0]
      and (
        r[1] - r[6] / 2 > 18
        or 1353 < r[0] < 1379
        or ((r[0] < 1327.2 or r[0] > 1406.2) and r[5] != 3)
      )
    )
  ]
  old_surfaces = [
    dict(index=i, row=r)
    for i, r in enumerate(data["surfaces"])
    if r["owner"] == ci and r["role"] == 7
  ]
  return models, dict(boxes=old_boxes, blocks=old_blocks, surfaces=old_surfaces)


def build() -> None:
  all_records, original, occupied = retained()
  changed = corrected(original)
  old_shell, old_front, _, _ = core.model(original, occupied)
  new_shell = corrected_model(changed, occupied)
  full = Detail()
  full.triangles = old_shell.triangles + old_front.triangles
  old_native = merge_native_faces(native_detail(full))
  new_native = merge_native_faces(native_detail(new_shell))
  diffs = {
    "drawn": (
      detail_difference(old_shell, new_shell),
      detail_difference(new_shell, old_shell),
    ),
    "front": (old_front, Detail()),
    "minecraft": (
      detail_difference(old_native, new_native),
      detail_difference(new_native, old_native),
    ),
  }
  models, old_library = ornaments(read(OUT / "librariesV202.json"))
  transfer, inputs, remaining = [], {}, {}
  pub = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  paths = []
  for mode, label in [("drawn", "Drawn"), ("minecraft", "Native")]:
    for item in read(OUT / f"altMitte{label}V169Source.json")["chunkFiles"]:
      if item["id"].startswith("2_0-"):
        paths.append((mode, "alt-mitte-v169-" + item["id"], OUT / item["file"], mode))
  for item in read(pub / "manifest.json")["chunks"]:
    if item["id"] == "2_0" or item["id"].startswith("2_0-alt-mitte-v169-"):
      paths.append(("drawn", item["id"], pub / item["drawn"]["url"], "front"))
  for mode, tile, path, layer in paths:
    packet = read(path)
    origin = packet["origin"]
    bounds = (origin[0], origin[2], origin[0] + 512, origin[2] + 512)
    key = (layer, *origin)
    if key not in remaining:
      previous = (
        core.isometric_shading(diffs[layer][0]) if mode == "drawn" else diffs[layer][0]
      )
      remaining[key] = Counter(
        s
        for m in pack_detail(previous, bounds, origin_y=origin[1])
        for s in mesh_signatures(m)
      )
    for mesh in packet["meshes"]:
      if mesh["kind"] != "alt-mitte-v169":
        continue
      selected = []
      for i, sig in enumerate(mesh_signatures(mesh)):
        if remaining[key][sig]:
          remaining[key][sig] -= 1
          selected.append(i)
      if selected:
        transfer.append(
          dict(
            tile=tile,
            kind=mesh["kind"],
            mode=mode,
            fingerprint=fingerprint(
              [mesh["positions"], mesh["colors"], mesh["indices"]]
            ),
            triangles=selected,
            layer=layer,
          )
        )
        inputs[str(path.relative_to(ROOT))] = sha(path)
  assert all(not sum(v.values()) for v in remaining.values()), {
    str(k): sum(v.values()) for k, v in remaining.items()
  }
  line_records, new_ink = [], set()
  for mode, tile, path, layer in paths:
    packet = read(path)
    if mode != "drawn" or layer != "drawn" or "lines" not in packet:
      continue
    origin = np.array(packet["origin"])
    bounds = (
      int(origin[0]),
      int(origin[2]),
      int(origin[0]) + 512,
      int(origin[2]) + 512,
    )
    old = line_signatures(edges([original]), bounds, int(origin[1]))
    new = line_signatures(edges([changed]), bounds, int(origin[1]))
    cupola_new = line_signatures(
      edges([{"parts": [p for p in changed["parts"] if p["id"] == CUPOLA]}]),
      bounds,
      int(origin[1]),
    )
    for segment in (new - old) & cupola_new:
      ends = tuple(tuple(np.array(p) / 100 + origin) for p in segment)
      if min(p[1] for p in ends) <= 32.21:
        new_ink.add(ends)
    others = line_signatures(
      edges(
        [
          b
          for b in all_records
          if b["id"] != PARENT
          and core.footprint(b).intersects(core.footprint(original))
        ]
      ),
      bounds,
      int(origin[1]),
    )
    obsolete = old - new - others
    values = np.frombuffer(
      base64.b64decode(packet["lines"]["positions"]), "<u2"
    ).reshape(-1, 2, 3)
    selected = [
      i
      for i, ends in enumerate(values)
      if tuple(sorted(tuple(p) for p in ends)) in obsolete
    ]
    if selected:
      line_records.append(
        dict(
          tile=tile,
          mode="drawn",
          fingerprint=fingerprint(
            [packet["lines"]["positions"], packet["lines"].get("colors", "")]
          ),
          segments=selected,
        )
      )
      inputs[str(path.relative_to(ROOT))] = sha(path)
  runtime, counts = {}, {}
  for mode, detail in models.items():
    detail.triangles.extend(diffs[mode][1].triangles)
    packet = empty_packet("staatsbibliothek-v241-" + mode, BOUNDS)
    packet["meshes"] = pack_detail(
      core.isometric_shading(detail) if mode == "drawn" else detail, BOUNDS
    )
    for mesh in packet["meshes"]:
      mesh["kind"] = "staatsbibliothek-v241"
    runtime[mode] = packet
    if mode == "drawn" and new_ink:
      positions = np.array(
        [
          np.rint((np.array(p) - np.array(packet["origin"])) * 100)
          for segment in sorted(new_ink)
          for p in segment
        ],
        dtype="<u2",
      )
      packet["lines"] = dict(positions=base64.b64encode(positions.tobytes()).decode())
    counts[mode] = dict(
      roles=dict(Counter(r for _, _, r in detail.triangles)),
      triangles=len(detail.triangles),
      vertices=sum(
        len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"]
      ),
    )
  inputs["src/app/src/data/librariesV202.json"] = sha(OUT / "librariesV202.json")
  inputs["geo_data/regierungsviertel/alt-mitte-v169/source-390_5819-00.json.gz"] = sha(
    core.SOURCE / "source-390_5819-00.json.gz"
  )
  write(OUT / "staatsbibliothekV241.json", runtime)
  write(
    OUT / "staatsbibliothekV241Previous.json",
    dict(records=transfer, lineRecords=line_records, **old_library),
  )
  write(
    GEO / "staatsbibliothek-v241-evidence.json",
    dict(
      parent=PARENT,
      cupola=CUPOLA,
      inputs=inputs,
      counts=counts,
      correctedPart=next(p for p in changed["parts"] if p["id"] == CUPOLA),
      frontRoofBand=dict(
        mainPart=MAIN, eaveY=32.2, ridgeY=37.773, depthM=9, slate=SLATE
      ),
      previousCounts={k: len(v[0].triangles) for k, v in diffs.items()},
      additionCounts={k: len(v[1].triangles) for k, v in diffs.items()},
      libraryRows={k: len(v) for k, v in old_library.items()},
      policy="Two generalized roof interpretations corrected from primary restored-building reference: curved portal cap and nine-metre front roof skirt, plus slate material on the main roof. Complete original 18-part record remains archived. Source footprints, eight main-part court holes, datums and maximum tops unchanged; curved profile and front eave are display estimates. Every other part, rear source sheet geometry, v202 court portico, modern readingroom and Potsdamer Strasse preserved. Only exact generic v169 windows and identified wrong streetfront v202 rows yield.",
    ),
  )
  print(
    {
      mode: {k: v for k, v in count.items() if k != "roles"}
      for mode, count in counts.items()
    },
    {k: len(v) for k, v in old_library.items()},
    flush=True,
  )


if __name__ == "__main__":
  build()
