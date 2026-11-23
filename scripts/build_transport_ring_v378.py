"""Place illustrative S-Bahn stock and tactile fields on measured Ringbahn station hosts."""

from __future__ import annotations
import argparse, json
from pathlib import Path
from shapely.geometry import LineString, Polygon, Point
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
HUBS = {
  "Ostkreuz": "relation/5660337",
  "Gesundbrunnen": "relation/3721106",
  "Wedding": "relation/5559039",
  "Westkreuz": "relation/5550689",
  "Südkreuz": "relation/6844110",
}


def parts(g):
  if g.is_empty:
    return []
  if g.geom_type == "LineString":
    return [g]
  return [line for part in getattr(g, "geoms", ()) for line in parts(part)]


def point(p):
  return [round(p.x, 3), round(p.y, 3)]


def build():
  data = json.loads((DATA / "railStationsV190.json").read_text())
  route = next(row for row in data["routes"] if row["id"] == "relation/14981")
  course = LineString(route["points"])
  items = []
  for station in data["stations"]:
    if "ringOrder" not in station or station.get("heroRetained"):
      continue
    name = station["name"]
    platforms = [
      p
      for p in data["platforms"]
      if p["station"] == name and p["sourceTags"].get("light_rail") == "yes"
    ]
    greens = []
    for p in platforms:
      poly = Polygon(p["rings"][0], p["rings"][1:]).buffer(0)
      # Only a measured Ring axis alongside this exact platform justifies the inner side of a tactile strip.
      # Preserve real setbacks, platform ends, islands and holes. Parallel Stadtbahn platforms stay distinct.
      if p["sourceTags"].get("tactile_paving") != "yes" or not (
        1 <= course.distance(poly) <= 3.5
      ):
        continue
      inner = poly.buffer(-0.68, join_style=2)
      inside = inner.boundary.intersection(course.buffer(3.6))
      tactile = [
        [point(Point(x, z)) for x, z in line.simplify(0.025).coords]
        for line in parts(inside)
        if line.length > 3.2
      ]
      if tactile:
        greens.append({"platform": p["id"], "grade": p["y"], "lines": tactile})
    vehicles = []
    wanted = HUBS.get(name)
    if wanted:
      p = next(p for p in platforms if p["id"] == wanted)
      poly = Polygon(p["rings"][0], p["rings"][1:]).buffer(0)
      covered = unary_union(
        [
          Polygon(r["rings"][0], r["rings"][1:]).buffer(0)
          for r in data["roofs"]
          if r["station"] == name
        ]
      )
      options = []
      at = course.project(Point(p["frame"]["x"], p["frame"]["z"]))
      for count, width in [(4, 3.10), (2, 3.10), (2, 2.84)]:
        for delta in range(-100, 101, 2):
          centre = (at + delta) % course.length
          cars = []
          points = []
          bodies = []
          for i in range(count):
            off = (i - (count - 1) / 2) * 18.34
            a = course.interpolate((centre + off - 8.85) % course.length)
            b = course.interpolate((centre + off + 8.85) % course.length)
            line = LineString([a, b])
            points.extend([a, line.interpolate(0.5, normalized=True), b])
            cars.append([*point(a), *point(b)])
            bodies.append(line.buffer(width / 2, cap_style=2))
          ds = [q.distance(poly) for q in points]
          if max(ds) > 6 or any(
            body.intersection(poly).area > 0.001 for body in bodies
          ):
            continue
          exposed = sum(not covered.covers(q) for q in points)
          options.append((exposed, -max(ds), -abs(delta), cars, width))
        if options:
          break
      if not options:
        raise ValueError(f"No train with documented platform clearance at {name}")
      best = max(options)
      vehicles = [
        {"platform": p["id"], "grade": p["y"], "cars": best[-2], "width": best[-1]}
      ]
    if vehicles or greens:
      items.append(
        {
          "name": name,
          "anchor": station["anchor"],
          "vehicles": vehicles,
          "tactile": greens,
        }
      )
  if sum(bool(v["vehicles"]) for v in items) != len(HUBS):
    raise ValueError("unbound station")
  return {"route": route["id"], "stations": items}


if __name__ == "__main__":
  ap = argparse.ArgumentParser()
  ap.add_argument("--check", action="store_true")
  args = ap.parse_args()
  path = DATA / "transportV378Ring.json"
  out = json.dumps(build(), ensure_ascii=False, separators=(",", ":")) + "\n"
  if args.check:
    if path.read_text() != out:
      raise SystemExit("transportV378Ring.json differs")
  else:
    path.write_text(out)
