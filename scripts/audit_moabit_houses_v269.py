"""Whole-Ortsteil retained-owner audit and exact public-front core selectors."""

from __future__ import annotations

import json
import math
import re
from collections import Counter

import numpy as np
from shapely.affinity import affine_transform, translate
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base
from scripts.build_district_house_scope_v225 import source_regions
from scripts.build_roof_house_v233 import fingerprint

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CORE = ROOT / "src/app/src/data/moabitHousesCoreV269.json"
AUDIT = GEO / "moabit-houses-v269-audit.json.gz"
PRISMS = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
VOXELS = ROOT / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json"
ATTR = ROOT / "src/app/src/buildingAttributeSource.json"
BLOCKED = {"06483932", "37533771"}


def core_guard(b):
  values = [b["y0_dm"], b["h_dm"], b.get("roof", 0), b["class"]]
  text = ",".join(map(str, values)) + ";"
  for ring in [b["ring"], *b.get("holes", [])]:
    text += "[" + "".join(str(x) + "," + str(z) + ";" for x, z in ring) + "]"
  return fingerprint([text])


def audit():
  region = source_regions()["Moabit"]
  quarters_source = base.read_json(GEO / "moabit-houses-v269-quarters.geojson")
  quarters = [
    (
      f["properties"]["plr_name"],
      affine_transform(
        shape(f["geometry"]), [1, 0, 0, -1, -389500, 5820000]
      ).intersection(region),
    )
    for f in quarters_source["features"]
  ]
  quarters = [(name, p) for name, p in quarters if p.area > 10]

  def quarter(p):
    return next((name for name, g in quarters if g.covers(p)), "Ortsteil boundary")

  raw = base.read_json(PRISMS)
  core = [
    (
      b,
      Polygon(np.array(b["ring"]) / 10, [np.array(r) / 10 for r in b.get("holes", [])]),
    )
    for b in raw["buildings"]
  ]
  core_all = [
    (b, p)
    for b, p in core
    if not p.is_empty and region.covers(p.representative_point())
  ]
  invalid_core = [b["id"] for b, p in core_all if not p.is_valid]
  core = [(b, p) for b, p in core_all if p.is_valid]
  context = base.read_json(GEO / "kiez-facades-v209-context.json.gz")
  roads_rows = [r for r in context["roads"] if r["scope"] == "Moabit"]
  roads = [shape(r["geometry"]) for r in roads_rows]
  road_tree = STRtree(roads)
  protected = STRtree([shape(r["geometry"]) for r in context["protectedBuildings"]])
  occupied = STRtree([p for _, p in core])
  authored = set(BLOCKED)
  # Existing exact named models and measurements always retain priority. Generic
  # attribute/scope records are evidence, not a list of authored landmarks.
  for p in (ROOT / "src/app/src").glob("*.ts"):
    if p.name in {"MoabitHousesV269.ts"}:
      continue
    authored.update(re.findall(r"[\"\']([A-Za-z0-9]{8})[\"\']", p.read_text()))
  for owner in context["authoredIds"]:
    authored.add(owner[-8:])
  attrs = base.read_json(ATTR)
  manifest = base.read_json(OUT / "manifest.json")
  packets = [
    d
    for d in manifest["chunks"]
    if not d.get("detailCompanionOf") and region.intersects(box(*d["bounds"]))
  ]
  inventory, assets = [], {}
  for desc in packets:
    packet = base.read_json(OUT / desc["drawn"]["url"])
    assets[desc["drawn"]["url"]] = base.digest(OUT / desc["drawn"]["url"])
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      p = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if p.is_valid and not p.is_empty and region.covers(p.representative_point()):
        inventory.append(
          dict(
            owner=b["sourceId"],
            chunk=desc["id"],
            quarter=quarter(p.representative_point()),
            height=b["height"],
            geometry=b,
            origin=packet["origin"],
          )
        )
  stream_ids = {r["owner"][-8:] for r in inventory}
  by_quarter = {name: Counter() for name, _ in quarters}
  all_rows, selected, counts = [], [], Counter()
  old_fronts = [
    LineString([f["a"], f["b"]])
    for f in base.read_json(base.EVIDENCE)["faces"]
    if f["district"] == "Moabit"
  ]
  old_front_tree = STRtree(old_fronts)
  for b, p in core:
    q = quarter(p.representative_point())
    tags = (
      attrs["records"][attrs["prisms"][b["id"]]]["tags"]
      if b["id"] in attrs["prisms"]
      else {}
    )
    by_quarter[q]["coreParts"] += 1
    by_quarter[q]["coreMappedStoreys"] += int("building:levels" in tags)
    by_quarter[q]["coreMappedFacade"] += int(
      "building:material" in tags or "building:colour" in tags
    )
    reason = None
    if b["id"] in authored:
      reason = "authoredOrNamedOwner"
    elif b["id"] in stream_ids:
      reason = "streamOwnerAlreadyHandled"
    elif b["class"] != 0 or not 9 <= b["h_dm"] / 10 <= 32:
      reason = "outsideOrdinaryHeightOrClass"
    elif not region.covers(p):
      reason = "OrtsteilBoundaryPart"
    elif len(protected.query(p, predicate="intersects")):
      reason = "protectedMappedUseOrMaterial"
    candidates = []
    if reason is None:
      ring = np.array(b["ring"], dtype=float) / 10
      wall_index = -1
      for i, (a, end) in enumerate(zip(ring, np.roll(ring, -1, axis=0))):
        if np.linalg.norm(end - a) < 1e-6:
          continue
        wall_index += 1
        candidate = base.exposed_front(a, end, p, roads, road_tree, occupied)
        if candidate is None:
          continue
        length, d, n, ri = candidate
        line = LineString([a, end])
        if any(
          line.intersection(old_fronts[j].buffer(0.22, cap_style="flat")).length
          > 0.5 * length
          for j in old_front_tree.query(line.buffer(0.22))
        ):
          continue
        candidates.append(
          dict(
            index=wall_index,
            sourceRingEdge=i,
            a=a.tolist(),
            b=end.tolist(),
            n=n.tolist(),
            length=length,
            street=roads_rows[ri]["name"],
            streetId=roads_rows[ri]["id"],
          )
        )
      if not candidates:
        reason = "noCompleteClearStreetFront"
    if candidates:
      face = max(candidates, key=lambda f: f["length"])
      record = dict(
        owner=b["id"],
        quarter=q,
        guard=core_guard(b),
        face=face,
        ground=b["y0_dm"] / 10,
        height=b["h_dm"] / 10,
        source=b,
        tags=tags,
      )
      selected.append(record)
      reason = "selectedCoreHeadRhythm"
      by_quarter[q]["selectedCoreFronts"] += 1
    counts[reason] += 1
    all_rows.append(dict(owner=b["id"], quarter=q, reason=reason, tags=tags))
  for r in inventory:
    by_quarter[r["quarter"]]["streamNavigationParts"] += 1
  old_faces = [
    f for f in base.read_json(base.EVIDENCE)["faces"] if f["district"] == "Moabit"
  ]
  for f in old_faces:
    q = quarter(Point(np.mean([f["a"], f["b"]], axis=0)))
    by_quarter[q]["v188Fronts"] += 1
    by_quarter[q]["v188Panes"] += f["windowCount"]
    by_quarter[q]["v188NativePanes"] += f["nativeWindowCount"]
  evidence = base.read_json(GEO / "moabit-houses-v269-evidence.json.gz")
  for mode in ["drawn", "minecraft"]:
    rows = [r for r in evidence["surrounds"] if r["mode"] == mode]
    for r in rows:
      by_quarter[quarter(Point(r["point"]))][mode + "NewFrames"] += 1
  for r in evidence["shops"]:
    by_quarter[quarter(Point(r["face"]["point"]))]["mappedShopFronts"] += 1
  # Native candidates bind an actual existing independent voxel exterior plane,
  # not a rounded version of a smooth drawn wall or its new line positions.
  vox = base.read_json(VOXELS)
  cell = vox["cell_m"]
  grid = vox["grid"]
  columns = {}
  for zi, row in enumerate(vox["building_rows"]):
    iz = grid["min_z_idx"] + zi
    if (iz + 0.5) * cell < region.bounds[1] - cell or (iz + 0.5) * cell > region.bounds[
      3
    ] + cell:
      continue
    for x0, n, y0, y1, c in row:
      for xi in range(grid["min_x_idx"] + x0, grid["min_x_idx"] + x0 + n):
        if region.bounds[0] - cell <= (xi + 0.5) * cell <= region.bounds[2] + cell:
          columns[(xi, iz)] = [y0, y1, c]
  native = []
  for record in selected:
    f = record["face"]
    edge = LineString([f["a"], f["b"]])
    p = Polygon(
      np.array(record["source"]["ring"]) / 10,
      [np.array(r) / 10 for r in record["source"].get("holes", [])],
    )
    x0, z0, x1, z1 = edge.bounds
    for iz in range(math.floor(z0 / cell) - 1, math.floor(z1 / cell) + 2):
      for ix in range(math.floor(x0 / cell) - 1, math.floor(x1 / cell) + 2):
        col = columns.get((ix, iz))
        center = Point((ix + 0.5) * cell, (iz + 0.5) * cell)
        if not col or col[2] != 3 or not p.covers(center):
          continue
        for dx, dz in [(1, 0), (-1, 0), (0, 1), (0, -1)]:
          if dx * f["n"][0] + dz * f["n"][1] < 0.7:
            continue
          front = Point(center.x + dx * cell / 2, center.y + dz * cell / 2)
          neighbour = columns.get((ix + dx, iz + dz))
          if neighbour and neighbour[1] >= col[1] - 10:
            continue
          if (
            edge.distance(front) > 2.7
            or edge.project(front) < 0.5
            or edge.project(front) > edge.length - 0.5
          ):
            continue
          native.append([ix, iz, dx, dz, col[0], col[1], record["owner"]])
  unique = {",".join(map(str, r[:4])): r for r in native}
  selected_quarters = {r["owner"]: r["quarter"] for r in selected}
  for r in unique.values():
    by_quarter[selected_quarters[r[6]]]["nativeCoreFaces"] += 1
  runtime = dict(
    schemaVersion=1,
    core={
      r["owner"]: dict(
        guard=r["guard"], wall=r["face"]["index"], a=r["face"]["a"], b=r["face"]["b"]
      )
      for r in selected
    },
    native={key: r[4:] for key, r in unique.items()},
  )
  base.write_json(CORE, runtime)
  inputs = [
    PRISMS,
    VOXELS,
    ATTR,
    GEO / "moabit-houses-v269-quarters.geojson",
    GEO / "district-facades-v188-boundaries.geojson",
    GEO / "kiez-facades-v209-context.json.gz",
    GEO / "district-facades-v188-evidence.json.gz",
    GEO / "kiez-facades-v209-evidence.json.gz",
    GEO / "grey-facades-v263-evidence.json.gz",
    ROOT / "src/app/src/data/outerFacadesV262.json",
    ROOT / "src/app/src/data/districtHouseScopeV225.json",
  ]
  result = dict(
    schemaVersion=1,
    scopeAreaM2=region.area,
    coreParts=len(core),
    invalidCoreParts=invalid_core,
    streamNavigationParts=len(inventory),
    distinctStreamOwners=len({r["owner"] for r in inventory}),
    quarters={k: dict(v) for k, v in by_quarter.items()},
    coreDisposition=dict(counts),
    coreInventory=all_rows,
    streamInventory=inventory,
    selected=selected,
    nativeFaces=list(unique.values()),
    assets=assets,
    inputs={str(p.relative_to(ROOT)): base.digest(p) for p in inputs},
    policy="Complete Moabit ALKIS scan. Core heads extend only the existing inferred axis rhythm in its existing batch; unchanged roofs, glass, material tags, old lines and named models. Native heads qualify exact existing voxel faces. No new windows/doors or footprint. Ground follows existing source y0, never a district-wide constant. Existing v188/v209 panes/sills/crossbars retained; new stream recipes append independently.",
  )
  base.write_json(AUDIT, result)
  print(
    json.dumps(
      {
        k: result[k]
        for k in [
          "coreParts",
          "streamNavigationParts",
          "distinctStreamOwners",
          "coreDisposition",
          "quarters",
        ]
      },
      indent=2,
    )
  )
  print(
    "selected",
    len(selected),
    "nativeFaces",
    len(unique),
    "runtimeBytes",
    CORE.stat().st_size,
  )
  return result


if __name__ == "__main__":
  audit()
