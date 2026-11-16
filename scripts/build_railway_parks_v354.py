"""Mapped former railway park detail; every fitting belongs to a retained host.

Old terrain, active tracks and navigation are never removed. Widths without an
OSM measurement and tower fittings are explicitly photographic estimates.
"""

from __future__ import annotations

import gzip
import math
from collections import defaultdict
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts.build_fuel_packets_v351 import Mesh as BaseMesh
from scripts.build_fuel_packets_v351 import fingerprint, navsolid, rgb
from scripts.build_karl_marx_allee_v161 import Detail
from scripts.build_mcdonalds_inventory_v351 import read, write

ROOT = Path(__file__).resolve().parents[1]
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v354"
)
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
KIND = "railway-parks-v354"
REFS = [
  "https://gruen-berlin.de/projekte/parks/dora-duncker-park",
  "https://gruen-berlin.de/projekte/parks/hans-baluschek-park",
  "https://www.natur-park-suedgelaende.de/bahntechnik-industriekultur/wasserturm/",
  "https://www.natur-park-suedgelaende.de/bahntechnik-industriekultur/drehscheibe/",
  "https://www.natur-park-suedgelaende.de/entdecken-erleben/rundwege/",
  "https://www.natur-park-suedgelaende.de/fileadmin/suedgelaende/00_Startseite/suedgelaende_parkplan_2022-w.jpeg",
  "https://www.berlin.de/ba-tempelhof-schoeneberg/politik-und-verwaltung/aemter/stadtentwicklungsamt/zukunft-planen/stadtumbau-west/artikel.365782.php",
]


class Mesh(BaseMesh):
  def triangle(self, points, colors):
    q = np.rint((np.asarray(points) - self.origin) * 100).astype(np.int64)
    if not np.any(np.cross(q[1] - q[0], q[2] - q[0])):
      return
    super().triangle(points, colors)


class Support:
  def __init__(self, c):
    a = np.asarray(c["triangles"]).reshape(-1, 3, 3)
    polys = shapely.polygons(a[:, :, [0, 2]])
    keep = (
      (shapely.area(polys) > 1e-5)
      & (a[:, :, 1].max(axis=1) < c["nav"]["groundY"] + 1.1)
      & (a[:, :, 1].min(axis=1) > c["nav"]["groundY"] - 0.2)
    )
    self.a = a[keep]
    self.polys = polys[keep]
    self.tree = STRtree(self.polys)
    self.planes = np.linalg.solve(
      np.concatenate((self.a[:, :, [0, 2]], np.ones((len(self.a), 3, 1))), axis=2),
      self.a[:, :, 1, None],
    )[:, :, 0]

  def at(self, x, z):
    p = Point(x, z)
    ix = self.tree.query(p, predicate="intersects")
    return max((float(self.planes[i] @ [x, z, 1]) for i in ix), default=None)


def cardinal(p, cell=0.25):
  if p.is_empty:
    return p
  x0, z0, x1, z1 = p.bounds
  rects = []
  for z in range(math.floor(z0 / cell), math.ceil(z1 / cell)):
    xs = np.arange(math.floor(x0 / cell), math.ceil(x1 / cell))
    ok = shapely.covers(
      p, shapely.points((xs + 0.5) * cell, np.full(len(xs), (z + 0.5) * cell))
    )
    gaps = np.flatnonzero(np.diff(np.r_[False, ok, False]))
    for a, b in zip(gaps[::2], gaps[1::2]):
      rects.append(box(xs[a] * cell, z * cell, (xs[b - 1] + 1) * cell, (z + 1) * cell))
  return unary_union(rects).simplify(0)


def circle(x, z, r, native):
  p = Point(x, z).buffer(r, quad_segs=8)
  return cardinal(p, 0.25) if native else p


def build():
  source = read(TASK / "railpark-features.json")
  group = defaultdict(list)
  for f in source["features"]:
    group[f["host"]].append(f)
  sources = []
  reports = []
  retained = {}
  total = defaultdict(int)
  for host, features in group.items():
    for mode in ["drawn", "minecraft"]:
      c = read(TASK / "railpark-support" / f"{mode}-{host}.json.gz")
      native = mode == "minecraft"
      o = c["prepared"]["origin"]
      ground = c["nav"]["groundY"]
      sup = Support(c)
      # One historic rejected network recipe is already absent in the baseline.
      assert all(d == "network-fidelity-v326:raw" for d in c["declined"]), c["declined"]
      mesh = Mesh(o)
      nav = []
      owners = []
      bounds = box(o[0] + 0.02, o[2] + 0.02, o[0] + 511.98, o[2] + 511.98)
      buildings = unary_union(
        [
          shapely.make_valid(
            shapely.affinity.translate(
              Polygon(b["ring"], b.get("holes", [])), o[0], o[2]
            )
          )
          for b in c["nav"]["buildings"]
        ]
      )

      def solid(p, lo, hi, color, identity, collide=False):
        if p.is_empty:
          return
        if native:
          p = cardinal(p)
        p = p.intersection(bounds)
        if p.is_empty:
          return
        mesh.prism(p, lo, hi, rgb(color))
        if collide:
          for part in shapely.get_parts(p):
            if part.geom_type != "Polygon":
              continue
            v = navsolid(part, lo, hi, o, ground, KIND + ":" + identity)
            v["heightSource"] = (
              "OSM position; measured tower total height, photographic fitting dimensions"
            )
            nav.append(v)

      for f in features:
        g = shape(f["geometry"])
        start = len(mesh.indices)
        ident = f["id"]
        if f["kind"] in ["path", "rail", "boardwalk"]:
          # Surface strips are confined to each retained host, away from buildings.
          line = g
          length = line.length
          step = 3 if f["kind"] == "rail" else 5
          for j in range(math.ceil(length / step)):
            a = line.interpolate(j * step)
            b = line.interpolate(min(length, (j + 1) * step))
            seg = LineString([a, b])
            mid = seg.interpolate(0.5, normalized=True)
            h = [sup.at(p.x, p.y) for p in [a, mid, b]]
            if any(y is None for y in h) or max(h) - min(h) > 0.45:
              continue
            y = max(h)
            width = 1.435 if f["kind"] == "rail" else f["width"]
            foot = (
              seg.buffer(width / 2, cap_style=2)
              .intersection(bounds)
              .difference(buildings.buffer(0.08))
            )
            if foot.area < 0.2:
              continue
            if f["kind"] == "rail":
              d = np.array(b.coords[0]) - np.array(a.coords[0])
              d = d / np.linalg.norm(d)
              n = np.array([-d[1], d[0]])
              for side in [-1, 1]:
                rail = LineString(
                  [
                    np.array(a.coords[0]) + n * 0.7175 * side,
                    np.array(b.coords[0]) + n * 0.7175 * side,
                  ]
                ).buffer(0.055, cap_style=2)
                solid(
                  rail.intersection(foot.buffer(0.12)),
                  y + 0.02,
                  y + 0.13,
                  [105, 86, 70],
                  ident,
                )
              # No modern ballast or catenary on the retired rails.
              for dist in np.arange(0.4, seg.length, 0.8):
                pt = seg.interpolate(dist)
                s = (
                  LineString(
                    [
                      np.array(pt.coords[0]) - n * 1.05,
                      np.array(pt.coords[0]) + n * 1.05,
                    ]
                  )
                  .buffer(0.11, cap_style=2)
                  .difference(buildings.buffer(0.08))
                )
                mesh.surface(
                  (cardinal(s) if native else s).intersection(bounds),
                  y + 0.025,
                  rgb([105, 99, 80]),
                )
            elif f["kind"] == "boardwalk":
              # Height 0.5 and width 1.4 are recorded in OSM; short end ramps join ground.
              original = shape(f.get("sourceGeometry", f["geometry"]))
              along = original.project(mid)
              dist = min(along, original.length - along)
              lift = max(0.04, min(0.5, dist * 0.1))
              solid(foot, y + lift - 0.04, y + lift, [116, 124, 120], ident, True)
              d = np.array(b.coords[0]) - np.array(a.coords[0])
              d = d / np.linalg.norm(d)
              n = np.array([-d[1], d[0]])
              for dist in np.arange(0.2, seg.length, 0.3):
                pt = np.array(seg.interpolate(dist).coords[0])
                grid = LineString([pt - n * width / 2, pt + n * width / 2]).buffer(
                  0.018, cap_style=2
                )
                solid(grid, y + lift + 0.001, y + lift + 0.02, [62, 70, 66], ident)
            else:
              surface = f["tags"].get("surface")
              color = (
                [113, 116, 110]
                if surface == "asphalt"
                else [173, 167, 146]
                if surface in ["fine_gravel", "compacted"]
                else [145, 124, 94]
              )
              mesh.surface(cardinal(foot) if native else foot, y + 0.032, rgb(color))
              # The rust-coloured edging follows the mapped path, not a new route.
              if surface == "asphalt":
                edge = foot.difference(foot.buffer(-0.06))
                solid(edge, y + 0.034, y + 0.085, [116, 103, 84], ident)
        elif f["kind"] == "tree":
          x, z = g.coords[0]
          y = sup.at(x, z)
          if y is None or buildings.distance(g) < 3:
            continue
          height = (
            float(f["tags"].get("height", "8"))
            if f["tags"].get("height", "8").replace(".", "", 1).isdigit()
            else 8
          )
          height = max(4, min(18, height))
          radius = height * 0.26
          solid(
            circle(x, z, 0.16, native),
            y,
            y + height * 0.65,
            [105, 100, 80],
            ident + ":trunk",
            True,
          )
          if native:
            for lo, hi, r in [
              (height * 0.45, height * 0.6, radius * 0.7),
              (height * 0.6, height * 0.85, radius),
              (height * 0.85, height, radius * 0.65),
            ]:
              solid(
                circle(x, z, r, True), y + lo, y + hi, [83, 111, 64], ident + ":crown"
              )
          else:
            d = Detail()
            d.lathe(
              x,
              z,
              [
                (y + height * 0.4, 0.5),
                (y + height * 0.6, radius * 0.85),
                (y + height * 0.8, radius),
                (y + height * 0.95, radius * 0.65),
                (y + height, 0),
              ],
              (83, 111, 64),
              "canopy",
              10,
            )
            for pts, col, _ in d.triangles:
              mesh.triangle(pts, [rgb(col)] * 3)
        elif f["kind"] == "water-tower":
          x, z = g.centroid.coords[0]
          y = sup.at(x, z)
          if y is None or buildings.intersection(g).area > 0.1:
            raise ValueError("unsupported or already occupied tower")
          solid(
            circle(x, z, 5.5, native),
            y,
            y + 0.2,
            [155, 151, 138],
            ident + ":base",
            True,
          )
          red = [154, 50, 54]
          dark = [119, 40, 42]
          for dx in [-3.1, 3.1]:
            for dz in [-3.1, 3.1]:
              solid(
                box(x + dx - 0.3, z + dz - 0.3, x + dx + 0.3, z + dz + 0.3),
                y + 0.2,
                y + 41,
                red,
                ident + ":column",
                True,
              )
          solid(
            circle(x, z, 0.68, native), y + 0.2, y + 42, dark, ident + ":pipe", True
          )
          for yy in [7, 14, 21, 28, 35, 41]:
            ring = box(x - 3.4, z - 3.4, x + 3.4, z + 3.4).difference(
              box(x - 2.8, z - 2.8, x + 2.8, z + 2.8)
            )
            solid(ring, y + yy, y + yy + 0.45, red, ident + ":frame")
          # Rounded tank, conical underside and dome are visible in official drone photos.
          prof = [
            (y + 39, 1.1),
            (y + 42, 4.9),
            (y + 44, 5.25),
            (y + 46, 4.8),
            (y + 48, 3.65),
            (y + 49.7, 1.5),
            (y + 50, 0.6),
            (y + 50, 0),
          ]
          if native:
            for (lo, r0), (hi, r1) in zip(prof, prof[1:]):
              for h in np.arange(lo, hi, 0.5):
                r = r0 + (r1 - r0) * min(1, (h + 0.25 - lo) / max(0.01, hi - lo))
                solid(
                  circle(x, z, max(0.25, r), True),
                  h,
                  min(h + 0.5, hi),
                  red,
                  ident + ":tank",
                  True,
                )
          else:
            d = Detail()
            d.lathe(x, z, prof, tuple(red), "tank", 32)
            for pts, col, _ in d.triangles:
              mesh.triangle(pts, [rgb(col)] * 3)
            for (lo, r0), (hi, r1) in zip(prof, prof[1:]):
              if hi > lo:
                nav.append(
                  navsolid(
                    circle(x, z, max(r0, r1), False),
                    lo,
                    hi,
                    o,
                    ground,
                    KIND + ":" + ident + ":tank",
                  )
                )
          ring = circle(x, z, 5.5, native).difference(circle(x, z, 5.2, native))
          solid(ring, y + 43.8, y + 44, red, ident + ":gallery")
          for j in range(32):
            ang = j * math.tau / 32
            px, pz = x + 5.4 * math.cos(ang), z + 5.4 * math.sin(ang)
            solid(
              box(px - 0.045, pz - 0.045, px + 0.045, pz + 0.045),
              y + 44,
              y + 44.9,
              dark,
              ident + ":railing",
            )
          for h in [44.45, 44.9]:
            solid(
              circle(x, z, 5.5, native).difference(circle(x, z, 5.38, native)),
              y + h,
              y + h + 0.05,
              red,
              ident + ":rail",
            )
        elif f["kind"] == "turntable":
          x, z = g.centroid.coords[0]
          y = sup.at(x, z)
          if y is None:
            raise ValueError("unsupported turntable")
          solid(g, y + 0.015, y + 0.04, [69, 72, 65], ident + ":floor")
          solid(
            g.difference(g.buffer(-0.32)),
            y + 0.04,
            y + 0.28,
            [123, 118, 102],
            ident + ":rim",
            True,
          )
          # Direction follows the neighbouring preserved north/south yard tracks.
          v = np.array([0.24, -0.97077])
          a = np.array([x, z]) - v * 11.3
          b = np.array([x, z]) + v * 11.3
          deck = LineString([a, b]).buffer(1.25, cap_style=2)
          solid(deck, y + 0.18, y + 0.32, [96, 100, 91], ident + ":deck", True)
          n = np.array([-v[1], v[0]])
          for s in [-1, 1]:
            solid(
              LineString([a + n * 0.7175 * s, b + n * 0.7175 * s]).buffer(
                0.06, cap_style=2
              ),
              y + 0.32,
              y + 0.44,
              [130, 126, 113],
              ident + ":track",
            )
          for t in np.linspace(0, 1, 16):
            pt = a + (b - a) * t + n * 1.18
            solid(
              box(pt[0] - 0.045, pt[1] - 0.045, pt[0] + 0.045, pt[1] + 0.045),
              y + 0.32,
              y + 1.25,
              [93, 98, 88],
              ident + ":post",
            )
          solid(
            LineString([a + n * 1.18, b + n * 1.18]).buffer(0.045, cap_style=2),
            y + 1.2,
            y + 1.27,
            [93, 98, 88],
            ident + ":rail",
          )
        count = (len(mesh.indices) - start) // 3
        if count:
          owners.append(ident)
          reports.append(
            dict(host=host, mode=mode, id=ident, kind=f["kind"], triangles=count)
          )
          total[f["kind"]] += count
      if not mesh.indices:
        continue

      for v in nav:
        v["heightSource"] = (
          "Mapped park position; documented total tower height and turntable diameter, photo-estimated fitting dimensions"
        )
      append = mesh.payload()
      append["kind"] = KIND
      plan = c["plan"]
      plan.update(
        append=append,
        appendFingerprint=fingerprint(append),
        owners=sorted(set(owners)),
        retire=[],
        retireLines=[],
        retireNav=[],
        appendNav=nav,
      )
      key = f"{mode}:{host}"
      file = f"railwayParksV354Packets{len(sources):03d}.json.gz"
      write(DATA / file, dict(schemaVersion=1, keys=[key], packets={key: plan}))
      decoded = len(gzip.decompress((DATA / file).read_bytes()))
      assert decoded < 2 * 1024 * 1024 and (DATA / file).stat().st_size < 512 * 1024
      sources.append(dict(file=file, keys=[key], decodedBytes=decoded))
      retained[key] = c["plan"]["preparedRecords"]
  write(DATA / "railwayParksV354Index.json", dict(schemaVersion=1, sources=sources))
  write(
    GEO / "railway-parks-v354-source.json.gz",
    dict(
      schemaVersion=1,
      retrieved="2026-11-16",
      references=REFS,
      parks=source["parks"],
      features=source["features"],
      policy="Mapped footprints and routes. Existing ground, buildings and active railway remain. Tower total 50m and turntable diameter 23m documented by operator; fitting dimensions, rail sleeper spacing and untagged widths are estimates. No claim of a surveyed pit depth.",
    ),
  )
  write(
    GEO / "railway-parks-v354-validation.json.gz",
    dict(
      schemaVersion=1,
      reports=reports,
      retained=retained,
      totals=dict(total),
      compressedBytes=sum((DATA / r["file"]).stat().st_size for r in sources),
    ),
  )
  print(
    "packets",
    len(sources),
    "triangles",
    dict(total),
    "bytes",
    sum((DATA / r["file"]).stat().st_size for r in sources),
  )


if __name__ == "__main__":
  build()
