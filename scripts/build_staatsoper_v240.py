"""Source-bound Staatsoper recognition; measured v169 bodies and nav stay intact.

Only the obsolete procedural facade recipes yield. Native removal is a surface
set difference with an explicit measured-shell restoration, never an owner cut.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import build_alt_mitte_v169 as core
import numpy as np
import shapely
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_bundeswehr_hospital_v215 import detail_difference
from build_karl_marx_allee_v161 import Detail, native_detail
from build_prisons_memorials_ownership_v209 import fingerprint, signature, vertices
from build_scheunenviertel_v168 import merge_native_faces
from build_schlossplatz_v239 import GLYPHS, oriented
from build_schlossplatz_v239 import Facade as BaseFacade
from build_venues_hermann_v238 import face_axes, rgb
from shapely.geometry import box
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/src/data"
RUNTIME = OUT / "staatsoperV240.json"
PREVIOUS = OUT / "staatsoperV240Previous.json"
EVIDENCE = GEO / "staatsoper-v240-evidence.json"
PARENTS = {"DEBE01YYK0000Bw5", "DEBE00YY1P700099"}
MAIN = "DEBE01YYK0000Bw5"
HALL = "DEBE3DGPCT541Z3R"
STAGE = "DEBE3DyA4hFuGJHE"
SOUTH = "DEBE3DOwOZucTYVO"
PODIUM = "DEBE3DW9MfeQXluR"
BOUNDS = (1500, 200, 1650, 360)
CREAM, STONE, SHADOW, GLASS = 0xDDD7BE, 0xC7C3AF, 0x9A9F96, 0x526368
REFS = [
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095952",
  "https://www.berlin.de/landesdenkmalamt/aktivitaeten/kurzmeldungen/2022/einladung-staatsoper-unter-den-linden-1215421.php",
  "https://www.staatsoper-berlin.de/de/staatsoper/unter-den-linden/sanierung/",
]
V182_RANGES = [
  [7208, 7240],
  [7271, 7335],
  [7342, 7406],
  [7481, 7513],
  [7528, 7552],
  [7553, 7569],
  [7591, 7607],
  [7609, 7625],
  [7644, 7660],
  [7664, 7688],
  [7707, 7739],
  [7746, 7762],
  [7765, 7781],
  [7809, 7825],
  [7826, 7842],
  [7861, 7885],
  [7886, 7902],
]


class Facade(BaseFacade):
  """The retained v169 native shell uses 2m cells, not v239's 1m skin.

  Its outward conservative reach is 2.16m for the measured opera wall axes.
  Native fittings stand just outside it; drawn dimensions remain unchanged.
  """

  def block(self, *args, **kwargs):
    for mode, detail in self.models.items():
      origin = self.a + self.n * (1.4 if mode == "minecraft" else 0)
      BaseFacade({mode: detail}, origin, self.d, self.n, self.name).block(
        *args, **kwargs
      )

  def cylinder(self, *args, **kwargs):
    for mode, detail in self.models.items():
      origin = self.a + self.n * (1.4 if mode == "minecraft" else 0)
      BaseFacade({mode: detail}, origin, self.d, self.n, self.name).cylinder(
        *args, **kwargs
      )


def text_label(detail, text, center, direction, normal, height, color, native):
  glyphs = {
    **GLYPHS,
    "F": ["111", "100", "110", "100", "100"],
    "D": ["110", "101", "101", "101", "110"],
    "P": ["110", "101", "110", "100", "100"],
    "V": ["101", "101", "101", "101", "010"],
  }
  pitch = height / 5
  cursor = -(sum(len(glyphs[ch][0]) + 1 for ch in text) * pitch - pitch) / 2
  for ch in text:
    for ri, row in enumerate(glyphs[ch]):
      for ci, bit in enumerate(row):
        if bit == "0":
          continue
        p = (
          np.array(center)[[0, 2]]
          + direction * (cursor + (ci + 0.5) * pitch)
          + normal * (2.27 if native else 0.12)
        )
        oriented(
          detail,
          [p[0], center[1] + (2 - ri) * pitch, p[1]],
          [pitch * 0.84, pitch * 0.84, 0.045],
          math.atan2(direction[1], direction[0]),
          color,
          "north-portico/architrave-inscription",
          native,
        )
    cursor += (len(glyphs[ch][0]) + 1) * pitch


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def write(path, data):
  path.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n")


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def retained():
  manifest = read(core.SOURCE / "source-manifest.json")
  all_records = [
    b for c in manifest["chunks"] for b in read(core.SOURCE / c["file"])["buildings"]
  ]
  occupied = unary_union([core.footprint(b) for b in all_records])
  shapely.prepare(occupied)
  core.APPEARANCE.clear()
  ranks = {}
  for previous in read(core.SOURCE / "appearance-baseline.json.gz")["records"]:
    for binding in previous["bindings"]:
      for part in binding["parts"]:
        rank = (part["match"] == "leaf-id", part["overlapAreaM2"])
        if rank > ranks.get(part["partId"], (False, -1)):
          core.APPEARANCE[part["partId"]] = previous
          ranks[part["partId"]] = rank
  buildings = [b for b in all_records if b["id"] in PARENTS]
  assert len(buildings) == 2 and sum(len(b["parts"]) for b in buildings) == 12
  return buildings, occupied


def pediment(facade, u, base, width, rise, out, role):
  """Planar drawn triangle; independently stepped native courses."""
  for mode, detail in facade.models.items():
    color = rgb(CREAM)
    if mode == "drawn":
      detail.polygon(
        [
          facade.point(u - width / 2, base, out),
          facade.point(u + width / 2, base, out),
          facade.point(u, base + rise, out),
        ],
        color,
        role,
      )
    else:
      count = max(3, math.ceil(rise / 0.24))
      single = Facade({mode: detail}, facade.a, facade.d, facade.n, facade.name)
      for i in range(count):
        w = width * (1 - (i + 0.5) / count)
        single.block(
          u, base + (i + 0.5) * rise / count, w, rise / count, 0.3, CREAM, role, out
        )
  # Sloped raking cornices are quadrilateral bands, with stepped native bars.
  for side in [-1, 1]:
    for mode, detail in facade.models.items():
      if mode == "drawn":
        a, b = (u + side * width / 2, base), (u, base + rise)
        detail.polygon(
          [
            facade.point(a[0], a[1] - 0.06, out + 0.18),
            facade.point(b[0], b[1] - 0.06, out + 0.18),
            facade.point(b[0], b[1] + 0.18, out + 0.18),
            facade.point(a[0], a[1] + 0.18, out + 0.18),
          ],
          rgb(STONE),
          role + "-raking-cornice",
        )
      else:
        single = Facade({mode: detail}, facade.a, facade.d, facade.n, facade.name)
        count = max(3, math.ceil(width / 1.1))
        for i in range(count):
          t = (i + 0.5) / count
          single.block(
            u + side * width / 2 * (1 - t),
            base + rise * t,
            width / count / 2 + 0.05,
            0.28,
            0.36,
            STONE,
            role + "-raking-cornice",
            out + 0.18,
          )


def figure(f, u, y, scale=1.0, role="roof-figure", out=0.4):
  """Original abstract standing drapery silhouette, no artwork reproduction."""
  f.block(
    u,
    y + 0.13 * scale,
    0.8 * scale,
    0.26 * scale,
    0.7 * scale,
    STONE,
    role + "-plinth",
    out,
  )
  f.cylinder(
    u, y + 0.26 * scale, y + 1.55 * scale, 0.26 * scale, STONE, role + "-drapery", out
  )
  f.cylinder(
    u, y + 1.56 * scale, y + 1.95 * scale, 0.22 * scale, CREAM, role + "-head", out
  )
  f.block(
    u + 0.32 * scale,
    y + 1.30 * scale,
    0.32 * scale,
    0.55 * scale,
    0.22 * scale,
    STONE,
    role + "-arm",
    out,
  )


def balustrade(f, width, top, out=0.3):
  f.block(width / 2, top, width, 0.2, 0.4, CREAM, "balustrade-rail", out)
  f.block(width / 2, top - 1.0, width, 0.18, 0.4, STONE, "balustrade-base", out)
  for u in np.arange(0.3, width - 0.1, 0.8):
    f.cylinder(float(u), top - 0.9, top - 0.12, 0.11, STONE, "baluster", out)


def architecture(buildings):
  models = {"drawn": Detail(), "minecraft": Detail()}
  parts = [
    dict(
      p,
      ring=p["footprintPolygons"][0]["ring"],
      holes=p["footprintPolygons"][0]["holes"],
      top_y_m=p["topY"],
    )
    for b in buildings
    for p in b["parts"]
  ]
  faces = face_axes(dict(parts=parts, sourceGroundY=3))
  audit = []
  # New frame coverage includes every exposed source wall that carried old
  # recipes; short returns and low wings are preserved, not quietly dropped.
  for face in faces:
    length, low, high = face["length"], max(5.2, face["low"]), face["high"]
    if length < 2.4 or high - low < 2.5:
      continue
    f = Facade(models, face["a"], face["d"], face["n"], face["part"])
    north_portico = face["part"] == HALL and face["n"][1] < -0.8 and length > 10
    stage = face["part"] == STAGE
    hall = face["part"] == HALL
    # Exact measured wall plane checks bound every frame. The visible upper
    # stage sides have their own sparse composition instead of repeated floors.
    if stage:
      levels = [(high - 4.4, 3.3)]
      count = 3 if length > 14 else 1
    elif hall:
      levels = [(8.2, 1.15), (17.7, 6.0), (23.6, 1.15)]
      count = max(1, round(length / 4.5))
    elif face["part"] in (PODIUM, "DEBE00YY1P700099"):
      levels = [(7.4, 2.7)]
      count = 3 if length > 10 else 1
    else:
      levels = [(8.2, 1.2), (15.7, 4.5), (22.1, 1.5)]
      count = max(1, round(length / 3.7))
    if north_portico:
      count, levels = 3, [(17.7, 6.0), (23.6, 1.15)]
    window_count = 0
    for y, height in levels:
      for i in range(count):
        u = (i + 0.5) * length / count
        width = min(2.15 if height > 3 else 1.45, length / count * 0.53)
        if y - height / 2 < low + 0.15 or not face["plane"].buffer(0.001).covers(
          box(
            u - width / 2 - 0.15,
            y - height / 2 - 0.13,
            u + width / 2 + 0.15,
            y + height / 2 + 0.13,
          )
        ):
          continue
        f.window(u, y, width, height, "window", STONE, GLASS)
        f.block(
          u, y - height / 2 - 0.22, width + 0.55, 0.2, 0.42, CREAM, "window-sill", 0.3
        )
        if height > 3 and not north_portico:
          pediment(
            f, u, y + height / 2 + 0.28, width + 0.62, 0.60, 0.32, "window-pediment"
          )
        window_count += 1
    if high - low > 8:
      f.block(
        length / 2, high - 0.35, length - 0.12, 0.32, 0.3, CREAM, "source-eave-course"
      )
      if hall and abs(face["n"][0]) > 0.8:
        balustrade(f, length, high + 0.83)
      elif stage and length > 15:
        balustrade(f, length, high + 0.5)
      if not stage:
        for u in [0.32, length - 0.32]:
          f.block(
            u,
            (max(low, 10.8) + high - 0.65) / 2,
            0.45,
            high - 0.65 - max(low, 10.8),
            0.25,
            CREAM,
            "corner-pilaster",
            0.2,
          )
      if low < 10.8 < high:
        f.block(
          length / 2,
          10.75,
          length - 0.10,
          0.24,
          0.36,
          STONE,
          "raised-base-course",
          0.25,
        )
    audit.append(
      dict(
        part=face["part"],
        a=face["a"].tolist(),
        d=face["d"].tolist(),
        normal=face["n"].tolist(),
        length=length,
        low=low,
        high=high,
        windowCount=window_count,
      )
    )

  front = next(
    f for f in faces if f["part"] == HALL and f["n"][1] < -0.8 and f["length"] > 10
  )
  center = front["a"] + front["d"] * front["length"] / 2
  # Reading direction runs west-to-east; source north wall ran the other way.
  d = -front["d"] if front["d"][0] < 0 else front["d"]
  f = Facade(models, center, d, front["n"], "north-portico")
  for u in np.linspace(-7.5, 7.5, 6):
    f.cylinder(float(u), 10.86, 24.95, 0.45, CREAM, "six-column-order", 3.15)
    f.block(float(u), 24.65, 1.20, 0.65, 0.98, STONE, "corinthian-capital", 3.15)
    for offset in [-0.40, 0.40]:
      f.cylinder(float(u + offset), 24.7, 25.1, 0.16, CREAM, "capital-volute", 3.15)
  for y, height, width, depth in [
    (25.25, 0.40, 18.6, 3.7),
    (25.92, 0.94, 18.65, 0.45),
    (26.65, 0.36, 19.25, 0.65),
  ]:
    f.block(
      0,
      y,
      width,
      height,
      depth,
      CREAM,
      "portico-entablature",
      3.15 if depth < 1 else 1.4,
    )
  pediment(f, 0, 26.85, 19.3, 4.5, 3.5, "north-pediment")
  # Relief is a few subdued shallow abstract figures within the tympanum.
  for u in np.linspace(-5.5, 5.5, 7):
    figure(f, float(u), 27.05, 0.65 if abs(u) > 3 else 0.85, "tympanum-relief", 3.62)
  for u, y in [(-9.2, 27.1), (0, 31.55), (9.2, 27.1)]:
    figure(f, u, y, 1.15, "north-roof-sculpture", 3.5)
  for mode, detail in models.items():
    text_label(
      detail,
      "FRIDERICVS REX APOLLINI ET MVSIS",
      f.point(0, 25.94, 3.51),
      f.d,
      f.n,
      0.57,
      rgb(0x737971),
      mode == "minecraft",
    )

  # The west/east lateral projection and southern pediment are independently
  # anchored to their own measured outer faces, not copied into empty space.
  for face in faces:
    if (
      face["part"] in {"DEBE3DvMyVld2CWF", "DEBE3DzafWYL81en"}
      and abs(face["n"][0]) > 0.9
      and face["length"] > 13
    ):
      f = Facade(models, face["a"], face["d"], face["n"], "side-risalit")
      for u in np.linspace(1.0, face["length"] - 1.0, 4):
        f.cylinder(
          float(u), 11.1, face["high"] - 1.0, 0.30, CREAM, "risalit-column", 0.4
        )
      for u in [1.4, face["length"] / 2, face["length"] - 1.4]:
        figure(f, u, face["high"] + 0.25, 1.0, "risalit-roof-sculpture", 0.55)
    if face["part"] == SOUTH and face["n"][1] > 0.8 and face["length"] > 10:
      f = Facade(models, face["a"], face["d"], face["n"], "south-front")
      base = min(26.8, face["high"] - 4.2)
      pediment(f, face["length"] / 2, base, face["length"], 4.05, 0.3, "south-pediment")
  return models, audit


def mesh_signatures(mesh):
  v = vertices(mesh)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [signature(t) for t in v[ix]]


def old_models(buildings, occupied):
  old = {"front": Detail(), "minecraft": Detail()}
  restore = Detail()
  counts = {}
  for b in buildings:
    shell, front, _, _ = core.model(b, occupied)
    full = Detail()
    full.triangles = shell.triangles + front.triangles
    native_full = merge_native_faces(native_detail(full))
    native_shell = merge_native_faces(native_detail(shell))
    removed = detail_difference(native_full, native_shell)
    restored = detail_difference(native_shell, native_full)
    old["front"].triangles.extend(core.isometric_shading(front).triangles)
    old["minecraft"].triangles.extend(removed.triangles)
    restore.triangles.extend(restored.triangles)
    counts[b["id"]] = dict(
      sourceParts=len(b["parts"]),
      shellTriangles=len(shell.triangles),
      oldFacadeTriangles=len(front.triangles),
      nativeFull=len(native_full.triangles),
      nativeShell=len(native_shell.triangles),
      nativeRemoved=len(removed.triangles),
      nativeRestored=len(restored.triangles),
    )
  return old, restore, counts


def receipt(old):
  paths = []
  for item in read(OUT / "altMitteNativeV169Source.json")["chunkFiles"]:
    if item["id"].startswith("3_0-"):
      paths.append(
        ("minecraft", "alt-mitte-v169-" + item["id"], OUT / item["file"], "minecraft")
      )
  pub = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
  for item in read(pub / "manifest.json")["chunks"]:
    if item["id"] == "3_0" or item["id"].startswith("3_0-alt-mitte-v169-"):
      paths.append(("drawn", item["id"], pub / item["drawn"]["url"], "front"))
  records, inputs, remaining, audit = [], {}, {}, []
  for mode, tile, path, layer in paths:
    packet = read(path)
    origin = packet["origin"]
    bounds = (origin[0], origin[2], origin[0] + 512, origin[2] + 512)
    key = (layer, *origin)
    if key not in remaining:
      remaining[key] = Counter(
        s
        for m in pack_detail(old[layer], bounds, origin_y=origin[1])
        for s in mesh_signatures(m)
      )
    for mesh in packet["meshes"]:
      if mesh["kind"] != "alt-mitte-v169":
        continue
      sigs = mesh_signatures(mesh)
      selected = []
      for i, sig in enumerate(sigs):
        if remaining[key][sig]:
          remaining[key][sig] -= 1
          selected.append(i)
      if selected:
        records.append(
          dict(
            tile=tile,
            kind=mesh["kind"],
            mode=mode,
            fingerprint=fingerprint(
              [mesh["positions"], mesh["colors"], mesh["indices"]]
            ),
            triangles=selected,
            parents=sorted(PARENTS),
            layer=layer,
          )
        )
        inputs[str(path.relative_to(ROOT))] = sha(path)
        selected_set = set(selected)
        audit.append(
          dict(
            tile=tile,
            mode=mode,
            selected=len(selected),
            unchanged=len(sigs) - len(selected),
            unchangedSha256=hashlib.sha256(
              repr([s for i, s in enumerate(sigs) if i not in selected_set]).encode()
            ).hexdigest(),
          )
        )
  assert all(not sum(c.values()) for c in remaining.values()), {
    str(k): sum(v.values()) for k, v in remaining.items()
  }
  v182 = read(OUT / "cityRecognitionV182.json")
  rows = [
    dict(index=i, row=v182["segments"][i]) for a, b in V182_RANGES for i in range(a, b)
  ]
  assert len(rows) == 440 and all(r["row"][6] == 0xBDC5BF for r in rows)
  result = dict(
    schemaVersion=1,
    records=records,
    boxes=[dict(index=i, row=v182["boxes"][i]) for i in range(2228, 2448)],
    segments=rows,
  )
  inputs[str((OUT / "cityRecognitionV182.json").relative_to(ROOT))] = sha(
    OUT / "cityRecognitionV182.json"
  )
  return result, inputs, audit


def build():
  buildings, occupied = retained()
  models, facade_audit = architecture(buildings)
  print(
    "Staatsoper ornaments", {k: len(v.triangles) for k, v in models.items()}, flush=True
  )
  old, restore, old_counts = old_models(buildings, occupied)
  print("Staatsoper previous", old_counts, flush=True)
  previous, inputs, old_audit = receipt(old)
  models["minecraft"].triangles.extend(restore.triangles)
  runtime, counts = {}, {}
  for mode, detail in models.items():
    packet = empty_packet("staatsoper-v240-" + mode, BOUNDS)
    packet["meshes"] = pack_detail(
      core.isometric_shading(detail) if mode == "drawn" else detail, BOUNDS
    )
    for mesh in packet["meshes"]:
      mesh["kind"] = "staatsoper-v240"
    packet["nav"]["groundY"] = 5.2
    runtime[mode] = packet
    counts[mode] = dict(
      triangles=len(detail.triangles),
      vertices=sum(
        len(base64.b64decode(m["positions"])) // 6 for m in packet["meshes"]
      ),
      indices=sum(len(base64.b64decode(m["indices"])) // 4 for m in packet["meshes"]),
      roles=dict(Counter(t[2] for t in detail.triangles)),
    )
  write(RUNTIME, runtime)
  write(PREVIOUS, previous)
  inputs[str((core.SOURCE / "source-391_5819-00.json.gz").relative_to(ROOT))] = sha(
    core.SOURCE / "source-391_5819-00.json.gz"
  )
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      references=REFS,
      parents=sorted(PARENTS),
      sourceParts=[p["id"] for b in buildings for p in b["parts"]],
      inputs=inputs,
      previous=old_counts,
      exactTransfer=old_audit,
      facades=facade_audit,
      counts=counts,
      policy="All measured v169 shells, roofs, source ink, ground datum and navigation are unchanged. Exact old v169/v182 procedural windows yield only with the required complete v240 recognition model. Native full-minus-shell removed; shell-minus-full restored. Window division, pilaster and portico proportions, colours and abstract sculpture are source-view display estimates. Independent orthogonal native geometry; full mobile detail; no texture or bundled photograph.",
    ),
  )
  print(
    "Wrote Staatsoper",
    {k: {q: v for q, v in c.items() if q != "roles"} for k, c in counts.items()},
    flush=True,
  )


if __name__ == "__main__":
  build()
