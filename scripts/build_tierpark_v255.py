"""Step 10: bounded Tierpark garden, retained-window and mapped-play companions."""

from __future__ import annotations

import argparse
import math
from collections import Counter
from typing import Any

import pyogrio
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

from scripts import build_city_streets_v249 as city
from scripts.build_surrounding_outlines import PackedMesh, tags_for, world

ROOT, GEO, DATA, OUT = city.ROOT, city.GEO, city.DATA, city.OUT
SOURCE = GEO / "tierpark-v255-source.json.gz"
EVIDENCE = GEO / "tierpark-v255-evidence.json.gz"
OUTPUT = DATA / "tierparkV255.json"
KIND = "tierpark-v255"
REFERENCES = [
  "https://www.tierpark-berlin.de/de/tickets-service/tierpark-plan",
  "https://www.tierpark-berlin.de/de/ueber-uns/historie",
  "https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/regenwaldhaus",
  "https://www.schloss-friedrichsfelde.de/das-schloss",
  "https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/fabelwald",
  "https://www.tierpark-berlin.de/de/aktuelles/news/artikel/zwei-auf-einen-streich",
  "https://danpearlman.com/news/auf-die-plaetze-fertig-los/",
]


def extract() -> None:
  """Freeze complete exact OSM rings and existing source-window anchors."""
  old_path = GEO / "east-landmarks-v187-evidence.json"
  old = city.read(old_path)
  zoo = shape(old["zooGeometry"])
  raw = GEO / "raw/east-v187/candidate.gpkg"
  gardens, plays, forbidden = [], [], []
  for layer in ("multipolygons", "lines", "points"):
    frame = pyogrio.read_dataframe(raw, layer=layer).to_crs(25833)
    for _, row in frame.iterrows():
      t, g = tags_for(row), world(row.geometry)
      if not zoo.intersects(g):
        continue
      ident = (
        "way/" + str(t["osm_way_id"])
        if "osm_way_id" in t
        else ("node/" if layer == "points" else "way/") + str(t["osm_id"])
      )
      if layer == "multipolygons":
        if t.get("leisure") == "garden" and t.get("name") != "Eulen":
          gardens.append(dict(id=ident, tags=t, geometry=mapping(g)))
        if (
          t.get("building")
          or t.get("natural") == "water"
          or t.get("waterway")
          or t.get("attraction") == "animal"
        ):
          forbidden.append(g.buffer(0.15))
      if layer == "lines" and t.get("highway"):
        try:
          width = float(t.get("width", "3"))
        except ValueError:
          width = 3
        forbidden.append(g.buffer(max(0.8, min(width / 2, 10)) + 0.3))
      if layer == "points" and t.get("playground") in {
        "swing",
        "basketswing",
        "structure",
        "trampoline",
      }:
        plays.append(dict(id=ident, tags=t, point=list(g.coords)[0]))
  owners = old["owners"][:3]
  profiles = {r["id"]: r for r in old["sourceProfiles"]}
  drawn = city.read(DATA / "eastLandmarksV187.json")
  panes = []
  for owner in owners:
    footprint = unary_union(
      [Polygon(p["ring"], p["holes"]) for p in profiles[owner["id"]]["parts"]]
    )
    for cell in drawn["cells"]:
      for r in cell["boxes"]:
        if (
          len(r) != 8 or r[7] != 0x607C82 or footprint.distance(Point(r[0], r[2])) > 0.2
        ):
          continue
        n = [math.sin(r[6]), math.cos(r[6])]
        if footprint.contains(Point(r[0] + n[0] * 0.3, r[2] + n[1] * 0.3)):
          n = [-v for v in n]
        panes.append(dict(owner=owner["id"], name=owner["name"], row=r, normal=n))
  sources = [
    old_path,
    DATA / "eastLandmarksV187.json",
    DATA / "eastLandmarksV187Native.json",
    DATA / "eastLandmarksV187Navigation.json",
  ]
  city.write(
    SOURCE,
    dict(
      schemaVersion=1,
      sourceDate="2026-09-29",
      checked="2026-10-20",
      references=REFERENCES,
      zoo=mapping(zoo),
      gardens=gardens,
      plays=plays,
      panes=panes,
      forbidden=mapping(unary_union(forbidden)),
      owners=owners,
      rawSha256=city.curbs.base.digest(raw),
      retained={str(p.relative_to(ROOT)): city.curbs.base.digest(p) for p in sources},
    ),
  )


def quad(mesh: PackedMesh, points: list, color: tuple[int, ...]) -> None:
  """Append one explicitly wound display quad."""
  mesh.triangle([points[i] for i in (0, 1, 2)], color)
  mesh.triangle([points[i] for i in (0, 2, 3)], color)


def solid(
  mesh: PackedMesh,
  x: float,
  y: float,
  z: float,
  w: float,
  h: float,
  d: float,
  color: tuple[int, ...],
) -> None:
  """Axis-aligned play members are independent native-compatible actual solids."""
  p = [
    (x + a * w / 2, y + b * h / 2, z + c * d / 2)
    for a, b, c in [
      (-1, -1, -1),
      (1, -1, -1),
      (1, 1, -1),
      (-1, 1, -1),
      (-1, -1, 1),
      (1, -1, 1),
      (1, 1, 1),
      (-1, 1, 1),
    ]
  ]
  for face in [
    (0, 3, 2, 1),
    (4, 5, 6, 7),
    (0, 4, 7, 3),
    (1, 2, 6, 5),
    (3, 7, 6, 2),
    (0, 1, 5, 4),
  ]:
    quad(mesh, [p[i] for i in face], color)


def pane_frames(mesh: PackedMesh, pane: dict, native: bool) -> None:
  """Use old opening positions; reveal/mullion widths are explicit estimates."""
  x, y, z, w, h, _, yaw, _ = pane["row"]
  nx, nz = pane["normal"]
  ux, uz = math.cos(yaw), -math.sin(yaw)
  if native:
    if abs(nx) > abs(nz):
      nx, nz = math.copysign(1, nx), 0
      ux, uz = 0, 1
      x = math.floor(x) + (1 if nx > 0 else 0) + nx * 0.045
      z = math.floor(z) + 0.5
    else:
      nx, nz = 0, math.copysign(1, nz)
      ux, uz = 1, 0
      z = math.floor(z) + (1 if nz > 0 else 0) + nz * 0.045
      x = math.floor(x) + 0.5
    w = 1.75
  else:
    x, z = x + nx * 0.075, z + nz * 0.075
  trim = 0.11 if native else 0.075
  color = (225, 216, 190) if "Schloss" in pane["name"] else (171, 178, 168)
  for left, b, r, t in [
    (-w / 2, -h / 2, -w / 2 + trim, h / 2),
    (w / 2 - trim, -h / 2, w / 2, h / 2),
    (-w / 2, h / 2 - trim, w / 2, h / 2),
    (-trim / 2, -h / 2, trim / 2, h / 2),
    (-w / 2, -trim / 2, w / 2, trim / 2),
  ]:
    points = [
      (x + ux * u, y + v, z + uz * u) for u, v in [(left, b), (r, b), (r, t), (left, t)]
    ]
    if -uz * nx + ux * nz < 0:
      points.reverse()
    quad(mesh, points, color)


def native_surface(
  mesh: PackedMesh, g: Any, y: float, color: tuple[int, ...], size: float = 1
) -> Any:
  """Only fully contained orthogonal cells; coalesce identical horizontal runs."""
  if g.is_empty:
    return g
  x0, z0, x1, z1 = g.bounds
  rectangles = []
  for zi in range(math.floor(z0 / size), math.ceil(z1 / size)):
    start = None
    for xi in range(math.floor(x0 / size), math.ceil(x1 / size) + 1):
      cell = box(xi * size, zi * size, (xi + 1) * size, (zi + 1) * size)
      inside = g.covers(cell)
      if inside and start is None:
        start = xi
      if not inside and start is not None:
        run = box(start * size, zi * size, xi * size, (zi + 1) * size)
        mesh.surface(run, y, color)
        rectangles.append(run)
        start = None
  return unary_union(rectangles)


def play_members(play: dict, native: bool) -> list:
  """Mapped equipment types and anchors; no inferred untagged slide or tower."""
  x, z = play["point"]
  wood = (143, 112, 77)
  metal = (113, 133, 130)
  blue = (84, 132, 145)
  members = []

  def add(
    dx: float, dy: float, dz: float, w: float, h: float, d: float, color: tuple
  ) -> None:
    if native:
      # Independently sized orthogonal timber/metal members on a bounded
      # eighth-metre display grid, still centred on the mapped equipment.
      dx, dy, dz = (round(v * 8) / 8 for v in (dx, dy, dz))
      w, h, d = (max(0.125, round(v * 8) / 8) for v in (w, h, d))
      dy = max(dy, h / 2)
    members.append([x + dx, 3 + dy, z + dz, w, h, d, color])

  kind = play["tags"]["playground"]
  if kind in {"swing", "basketswing"}:
    for dx in [-1.5, 1.5]:
      add(dx, 1.4, 0, 0.18, 2.8, 0.18, wood)
    add(0, 2.8, 0, 3.3, 0.2, 0.2, wood)
    for dx in [-0.5, 0.5]:
      add(dx, 1.65, 0, 0.065, 2.1, 0.065, metal)
    add(0, 0.58, 0, 1.2, 0.12, 1.05 if kind == "basketswing" else 0.45, blue)
  elif kind == "structure":
    for dx in [-1, 1]:
      for dz in [-1, 1]:
        add(dx, 1.1, dz, 0.16, 2.2, 0.16, wood)
    for dy in [0.45, 0.95, 1.45, 1.95]:
      add(0, dy, -1, 2, 0.12, 0.12, wood)
      add(-1, dy, 0, 0.12, 0.12, 2, wood)
    add(0, 2.2, 0, 2.2, 0.12, 0.12, wood)
  else:
    add(0, 0.06, 0, 2.6, 0.10, 2.6, metal)
    add(0, 0.12, 0, 2.15, 0.04, 2.15, blue)
  return members


def build() -> dict:
  """Deliver additions through existing geographic packets without mutation."""
  src = city.read(SOURCE)
  gardens = [(r, shape(r["geometry"])) for r in src["gardens"]]
  blocked = shape(src["forbidden"])
  packets, records, receipts, deferred = {}, [], {}, []
  counts = Counter()
  manifest = city.read(OUT / "manifest.json")
  for entry in manifest["chunks"]:
    if not entry["id"].startswith("outer187-") or not box(*entry["bounds"]).intersects(
      shape(src["zoo"])
    ):
      continue
    for family in ["drawn", "minecraft"]:
      native = family == "minecraft"
      path = OUT / entry[family]["url"]
      packet = city.read(path)
      ox, oy, oz = packet["origin"]
      if oy != -10 or packet["nav"]["groundY"] != 3:
        continue
      bounds = box(*entry["bounds"])
      ground = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz)
          for p in packet["nav"]["ground"]
        ]
      )
      # Retained measured parents take priority even where their envelope and
      # a later OSM play anchor disagree. Never insert a hidden device beneath
      # an existing roof or replace that owner implicitly.
      measured_buildings = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz).buffer(0.15)
          for p in packet["nav"]["buildings"]
        ]
      )
      allowed = (
        ground.intersection(bounds.buffer(-0.02))
        .difference(blocked)
        .difference(measured_buildings)
      )
      mesh = PackedMesh(ox, oz)
      audit = []
      solids = []
      for row, g in gardens:
        safe = g.intersection(allowed).buffer(-0.08)
        if safe.is_empty:
          continue
        inner = safe.buffer(-0.6)
        if native:
          outer_shown = native_surface(mesh, safe, 3.06, (108, 132, 84))
          shown = native_surface(mesh, inner, 3.08, (152, 166, 105))
        else:
          mesh.surface(safe, 3.06, (108, 132, 84))
          mesh.surface(inner, 3.08, (152, 166, 105))
          outer_shown, shown = safe, inner
        audit.append(
          dict(
            kind="garden",
            id=row["id"],
            geometry=mapping(outer_shown),
            inner=mapping(shown),
          )
        )
      for pane in src["panes"]:
        if bounds.contains(Point(pane["row"][0], pane["row"][2])):
          pane_frames(mesh, pane, native)
          audit.append(dict(kind="window", owner=pane["owner"], point=pane["row"][:3]))
      for play in src["plays"]:
        if not bounds.contains(Point(play["point"])):
          continue
        members = play_members(play, native)
        footprints = [
          box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
          for x, y, z, w, h, d, c in members
        ]
        if not all(allowed.covers(g) for g in footprints):
          footprint = unary_union(footprints)
          deferred.append(
            dict(
              family=family,
              id=play["id"],
              reason="No unoccupied delivered ground footprint; retain prior geometry.",
              conflictingOwners=[
                b["sourceId"]
                for b in packet["nav"]["buildings"]
                if translate(Polygon(b["ring"], b["holes"]), ox, oz).intersects(
                  footprint
                )
              ],
            )
          )
          continue
        for r, g in zip(members, footprints):
          solid(mesh, *r)
          x, y, z, w, h, d, c = r
          if h > 0.3:
            local = translate(g, -ox, -oz)
            solids.append(
              dict(
                ring=list(local.exterior.coords),
                holes=[],
                height=round(y + h / 2 - 3, 3),
                minHeight=round(y - h / 2 - 3, 3),
                sourceId="tierpark-v255-" + play["id"],
                heightSource="display-estimate",
              )
            )
        audit.append(
          dict(
            kind="play",
            id=play["id"],
            type=play["tags"]["playground"],
            geometry=mapping(unary_union(footprints)),
          )
        )
      payload = mesh.payload(KIND)
      if not payload:
        continue
      key = family + ":" + entry["id"]
      packets[key] = dict(
        origin=packet["origin"],
        guard=city.curbs.ground_guard(packet["nav"]["ground"]),
        mesh=payload,
        solids=solids,
      )
      receipts[str(path.relative_to(ROOT))] = city.curbs.base.digest(path)
      records.append(
        dict(
          key=key,
          records=audit,
          triangles=len(mesh.indices) // 3,
          vertices=len(mesh.vertices),
        )
      )
      counts[family + "Triangles"] += len(mesh.indices) // 3
      counts[family + "Packets"] += 1
  city.write(OUTPUT, dict(schemaVersion=1, ids=sorted(packets), packets=packets))
  evidence = dict(
    schemaVersion=1,
    version="1.0.155",
    counts=dict(counts),
    records=records,
    deferredPlayAnchors=deferred,
    retained={**src["retained"], **receipts},
    sourceSha256=city.curbs.base.digest(SOURCE),
    references=REFERENCES,
    estimates="The existing y=3 outline ground datum is retained, not asserted as surveyed terrain. Garden colours and 0.6m inner border, window reveal/mullion dimensions and play-member sizes/orientations are display estimates. Mapped equipment anchors/types and garden rings are retained. No copied visitor plan, speculative elephant house, source replacement, new descriptor or runtime-budget increase.",
  )
  city.write(EVIDENCE, evidence)
  return evidence


def main() -> None:
  """Regenerate the bounded optional source extraction and deterministic output."""
  parser = argparse.ArgumentParser()
  parser.add_argument("--extract", action="store_true")
  if parser.parse_args().extract:
    extract()
  result = build()
  print(result["counts"])


if __name__ == "__main__":
  main()
