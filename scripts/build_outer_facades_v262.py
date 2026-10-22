"""Step 10: bounded additive window recipes on 24 existing outer tiles only."""

from __future__ import annotations

import json
import re
from collections import defaultdict

import numpy as np
from shapely.affinity import translate
from shapely.geometry import LineString, Polygon, box, shape
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base
from scripts import build_outer_facades_v230 as previous
from scripts.build_house_doors_v233 import nav_fingerprint
from scripts.build_roof_house_v233 import fingerprint

GEO, OUT, ROOT = base.GEO, base.OUT, base.ROOT
OUTPUT = ROOT / "src/app/src/data/outerFacadesV262.json"
EVIDENCE = GEO / "outer-facades-v262-evidence.json.gz"
MAX_TILES, MAX_OWNERS, MAX_DRAWN, MAX_NATIVE = 24, 8, 96, 64
ROOF_TILES = {"outer187--22_-5", "east200-4_-15", "east200-23_17", "east200-23_18"}
POLICY = (
  "Only complete existing generic street-wall triangles; prior authored, facade, "
  "door and measured-roof owners excluded. At most 24 sampled tiles, eight owners "
  "and 96 drawn/64 independently orthogonal native windows each. Window rhythm, "
  "frames, sills and colours are display estimates; no entrance or roof inferred. "
  "Original packets/navigation and all live limits remain unchanged."
)


class WindowRecorder(base.FacadeMesh):
  """Reuse v230's grid/occlusion recipe without storing generated triangles."""

  def __init__(self, origin: list) -> None:
    super().__init__(origin)
    self.windows: list[list[float]] = []

  def pane(self, a, direction, normal, u, y, width, height, depth, bottom, top=None):
    """Retain only window centers; runtime emits the bounded shallow fittings."""
    if height not in {1.8, 1.4}:
      return
    center = a + direction * u
    self.windows.append(
      [
        round(float(center[0] - self.origin[0]), 6),
        round(float(y - self.origin[1]), 6),
        round(float(center[1] - self.origin[2]), 6),
        *[round(float(v), 8) for v in [*direction, *normal]],
      ]
    )


def selected_tiles(manifest: dict) -> list[dict]:
  """Choose a fixed bounded sample using descriptors, never citywide decoding."""
  already = {d.get("detailCompanionOf") for d in manifest["chunks"]}
  choices = [
    d
    for d in manifest["chunks"]
    if re.fullmatch(r"(?:outer187|east200|north190)-\-?\d+_\-?\d+", d["id"])
    and d["id"] not in ROOF_TILES
    and d["id"] not in already
    and 25 <= d.get("buildingCount", 0) <= 250
  ]
  selected = [next(d for d in choices if d["id"] == "outer187-27_6")]
  while len(selected) < MAX_TILES:
    next_tile = max(
      (d for d in choices if d not in selected),
      key=lambda d: (
        min(
          (d["bounds"][0] - s["bounds"][0]) ** 2
          + (d["bounds"][1] - s["bounds"][1]) ** 2
          for s in selected
        ),
        d["buildingCount"],
        d["id"],
      ),
    )
    selected.append(next_tile)
  return selected


def protected_owners(context: dict) -> set[str]:
  """Protect previous fitting receipts and all current named source identities."""
  ids = set(context["authoredIds"])
  for name in ["district-facades-v188", "kiez-facades-v209", "outer-facades-v230"]:
    ids.update(
      f["owner"] for f in base.read_json(GEO / f"{name}-evidence.json.gz")["faces"]
    )
  for name in ["roof-house-v233", "outer-roofs-v262"]:
    ids.update(
      f["owner"] for f in base.read_json(GEO / f"{name}-source.json.gz")["owners"]
    )
  ids.update(
    f["owner"]
    for f in base.read_json(GEO / "house-doors-v233-evidence.json.gz")["doors"]
  )
  for pattern in [
    "src/app/src/data/*.json",
    "src/app/src/*.ts",
    "src/app/src/*Source.json",
    "src/app/src/*Prisms.json",
  ]:
    for path in ROOT.glob(pattern):
      if path.name not in {"buildingAttributeSource.json", OUTPUT.name}:
        ids.update(
          re.findall(
            r"\b(?:DEBE[A-Za-z0-9]+|OSM-(?:way|relation)-\d+)", path.read_text()
          )
        )
  return ids


def build() -> dict:
  """Read only the chosen tiles and their nearby occupancy; write tiny recipes."""
  context = base.read_json(previous.CONTEXT)
  protected = STRtree([shape(g) for g in context["protected"]])
  blocked = protected_owners(context)
  roads = [shape(r["geometry"]) for r in context["roads"]]
  road_tree = STRtree(roads)
  manifest = base.read_json(OUT / "manifest.json")
  selected = selected_tiles(manifest)
  primary = [d for d in manifest["chunks"] if not d.get("detailCompanionOf")]
  inputs, packets, faces, seen = {}, {}, [], set()
  for desc in selected:
    tile = desc["id"]
    source = base.read_json(OUT / desc["drawn"]["url"])
    native = base.read_json(OUT / desc["minecraft"]["url"])
    occupied_shapes = []
    # Neighbour occupancy is needed only within the maximum 30 m street sightline.
    area = box(*desc["bounds"]).buffer(32)
    for neighbour in primary:
      if not area.intersects(box(*neighbour["bounds"])):
        continue
      path = OUT / neighbour["drawn"]["url"]
      near = source if neighbour["id"] == tile else base.read_json(path)
      inputs[neighbour["drawn"]["url"]] = base.digest(path)
      for b in near["nav"]["buildings"]:
        p = translate(
          Polygon(b["ring"], b["holes"]), near["origin"][0], near["origin"][2]
        )
        if p.is_valid and not p.is_empty:
          occupied_shapes.append(p)
    occupied = STRtree(occupied_shapes)
    triangles, nt = base.mesh_wall_triangles(source), base.mesh_wall_triangles(native)
    ox, oy, oz = source["origin"]
    candidates = defaultdict(list)
    for b in source["nav"]["buildings"]:
      owner = b["sourceId"]
      if owner in blocked or owner in seen:
        continue
      if not owner.startswith("DEBE") and not re.search(
        r"building=(?:house|apartments|residential|detached|terrace)$",
        b.get("heightSource", ""),
      ):
        continue
      p = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if (
        not p.is_valid or p.is_empty or len(protected.query(p, predicate="intersects"))
      ):
        continue
      low = source["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
      high = source["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
      if not 7 <= high - low <= 28 or b["minHeight"] > 0.1:
        continue
      for a, end in zip(b["ring"], b["ring"][1:] + b["ring"][:1]):
        if not base.source_wall_exists(triangles, a, end, low - oy, high - oy):
          continue
        wa, wb = np.array(a) + [ox, oz], np.array(end) + [ox, oz]
        visible = base.exposed_front(wa, wb, p, roads, road_tree, occupied)
        if visible is None:
          continue
        width, _, normal, ri = visible
        if not box(*desc["bounds"]).covers(
          LineString([wa + normal * 0.14, wb + normal * 0.14])
        ):
          continue
        f = dict(
          owner=owner,
          chunk=tile,
          a=wa.tolist(),
          b=wb.tolist(),
          normal=normal.tolist(),
          low=low,
          high=high,
          streetId=context["roads"][ri]["id"],
          streetName=context["roads"][ri]["name"],
        )
        draw_windows, native_windows = (
          WindowRecorder(source["origin"]),
          WindowRecorder(native["origin"]),
        )
        base.window_grid(draw_windows, f, occupied=occupied)
        # Frames/sills are slightly wider than the older bare panes. Check their
        # complete 1.60 m width against the same nearby source occupancy too.
        clear_windows = []
        for window in draw_windows.windows:
          center = np.array([window[0] + ox, window[2] + oz])
          direction = np.array(window[3:5])
          n = np.array(window[5:7])
          left, right = center - direction * 0.81, center + direction * 0.81
          approach = Polygon(
            [left + n * 0.025, right + n * 0.025, right + n * 3, left + n * 3]
          )
          if not len(occupied.query(approach, predicate="intersects")):
            clear_windows.append(window)
        f["frameOccludedWindows"] = len(draw_windows.windows) - len(clear_windows)
        draw_windows.windows = clear_windows
        spans = previous.native_faces(f, native, nt, desc["bounds"])
        for span in spans:
          base.window_grid(native_windows, span, True)
        if draw_windows.windows and native_windows.windows:
          f.update(
            nativeSpans=spans,
            windowCount=len(draw_windows.windows),
            nativeWindowCount=len(native_windows.windows),
          )
          candidates[owner].append(
            (width, f, draw_windows.windows, native_windows.windows)
          )
    plans = {"drawn": [], "minecraft": []}
    accepted = 0
    for owner, options in sorted(candidates.items()):
      _, face, drawn_windows, native_windows = max(options, key=lambda r: r[0])
      if (
        accepted >= MAX_OWNERS
        or len(plans["drawn"]) + len(drawn_windows) > MAX_DRAWN
        or len(plans["minecraft"]) + len(native_windows) > MAX_NATIVE
      ):
        continue
      accepted += 1
      seen.add(owner)
      faces.append(face)
      plans["drawn"] += drawn_windows
      plans["minecraft"] += native_windows
    for family, original in [("drawn", source), ("minecraft", native)]:
      if not plans[family]:
        continue
      records = [
        dict(
          mesh=i, fingerprint=fingerprint([p["positions"], p["colors"], p["indices"]])
        )
        for i, p in enumerate(original["meshes"])
        if p["kind"] == "city"
      ]
      packets[f"{family}:{tile}"] = dict(
        origin=original["origin"],
        guard=nav_fingerprint(original["nav"]),
        records=records,
        windows=plans[family],
      )
      inputs[desc[family]["url"]] = base.digest(OUT / desc[family]["url"])
    print(tile, accepted, len(plans["drawn"]), len(plans["minecraft"]), flush=True)
  result = dict(schemaVersion=1, packets=packets)
  base.write_json(OUTPUT, result)
  evidence = dict(
    policy=POLICY,
    sampled=[d["id"] for d in selected],
    faces=faces,
    inputs=inputs,
    contextSha256=base.digest(previous.CONTEXT),
    excludedRoofTiles=sorted(ROOF_TILES),
    runtimeBytes=OUTPUT.stat().st_size,
    runtimeSha256=base.digest(OUTPUT),
  )
  base.write_json(EVIDENCE, evidence)
  print(
    json.dumps(
      dict(
        tiles=len(packets) // 2,
        owners=len(faces),
        windows=sum(f["windowCount"] for f in faces),
        nativeWindows=sum(f["nativeWindowCount"] for f in faces),
        runtimeBytes=OUTPUT.stat().st_size,
      )
    ),
    flush=True,
  )
  return evidence


if __name__ == "__main__":
  build()
