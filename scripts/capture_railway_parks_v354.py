import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path.cwd()))
from shapely.geometry import Point, box, mapping, shape
from shapely.ops import unary_union

from scripts.build_mcdonalds_inventory_v351 import read, write

ROOT = Path.cwd()
TASK = Path(
  "/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v354"
)
PK = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
allrows = read(TASK / "railpark-osm-inventory.json")
ids = {"23484395", "23490387", "267756710", "251951286"}
parks = [
  r
  for r in allrows
  if r["layer"] == "multipolygons" and r["tags"].get("osm_way_id") in ids
]
region = unary_union([shape(r["geometry"]) for r in parks])
feats = []
for r in allrows:
  t = r["tags"]
  g = shape(r["geometry"])
  if (
    r["layer"] != "lines"
    or not region.intersects(g)
    or t.get("tunnel")
    or t.get("access") in ["private", "no"]
    or t.get("highway") == "steps"
  ):
    continue
  rail = t.get("railway") == "disused" and not t.get("bridge")
  path = (
    t.get("highway") in ["footway", "path", "cycleway", "pedestrian"]
    and t.get("surface")
    in ["asphalt", "fine_gravel", "compacted", "woodchips", "metal", "metal_grid"]
    and (not t.get("bridge") or t.get("bridge") == "boardwalk")
  )
  if not (rail or path):
    continue
  clip = g.intersection(region)
  kind = (
    "boardwalk"
    if t.get("surface") == "metal_grid" and t.get("height") == "0.5"
    else "rail"
    if rail
    else "path"
  )
  if kind == "path" and t.get("surface") in ["metal", "metal_grid"]:
    continue
  width = (
    float(t.get("width", "1.4" if rail else "2"))
    if t.get("width", "2").replace(".", "", 1).isdigit()
    else 2
  )
  if width > 6:
    continue
  for i, line in enumerate(getattr(clip, "geoms", [clip])):
    if line.geom_type == "LineString" and line.length > 2:
      feats.append(
        dict(
          id="way/" + t["osm_id"] + f"/{i}",
          kind=kind,
          tags=t,
          geometry=mapping(line),
          width=width,
        )
      )
# Detailed retained rails are only the observable strips beside mapped paths;
# all remote overgrown traces remain in the older base, untouched.
path_envelope = unary_union(
  [
    shape(f["geometry"]).buffer(f.get("width", 2) / 2 + 2)
    for f in feats
    if f["kind"] in ["path", "boardwalk"]
  ]
)
selected = []
for f in feats:
  if f["kind"] != "rail":
    selected.append(f)
    continue
  clip = shape(f["geometry"]).intersection(path_envelope)
  for n, g in enumerate(getattr(clip, "geoms", [clip])):
    if g.geom_type == "LineString" and g.length > 2:
      selected.append(
        {
          **f,
          "id": f["id"] + f"/visible{n}",
          "sourceGeometry": f["geometry"],
          "geometry": mapping(g),
        }
      )
feats = selected
for r in read(TASK / "railpark-trees.json"):
  feats.append(
    dict(
      id="node/" + r["tags"]["osm_id"],
      kind="tree",
      tags=r["tags"],
      geometry=r["geometry"],
    )
  )
tower = read(TASK / "railpark-landmarks.json")[0]
feats.append(
  dict(
    id="way/524828720",
    kind="water-tower",
    tags=tower["tags"],
    geometry=tower["geometry"],
  )
)
turn = next(r for r in allrows if r["tags"].get("osm_id") == "14072352562")
feats.append(
  dict(
    id="node/14072352562",
    kind="turntable",
    tags=turn["tags"],
    geometry=mapping(Point(shape(turn["geometry"])).buffer(11.5, quad_segs=16)),
  )
)
chunks = [
  c
  for c in read(PK / "manifest.json")["chunks"]
  if (c["id"].startswith("city183-") or c["id"][0] in "-0123456789")
  and box(*c["bounds"]).intersects(region.buffer(20))
]
cache = {}
jobs = {}
out = []
for f in feats:
  g = shape(f["geometry"])
  seen = []
  for c in chunks:
    b = box(*c["bounds"])
    x = g.intersection(b)
    if x.is_empty:
      continue
    d = cache.setdefault(c["id"], read(PK / c["drawn"]["url"]))
    if not d["nav"]["ground"]:
      continue
    if f["kind"] in ["water-tower", "turntable", "tree"] and not b.contains(g):
      continue
    if f["kind"] in ["path", "rail", "boardwalk"]:
      xs = [
        s
        for s in getattr(x, "geoms", [x])
        if s.geom_type == "LineString" and s.length > 1
      ]
    else:
      xs = [x]
    for n, s in enumerate(xs):
      v = {
        **f,
        "host": c["id"],
        "geometry": mapping(s),
        "sourceGeometry": f["geometry"],
      }
      out.append(v)
      for mode in ["drawn", "minecraft"]:
        key = (c["id"], mode)
        job = jobs.setdefault(
          key,
          dict(
            id=c["id"],
            path=str(PK / c[mode]["url"]),
            mode=mode,
            windows=[],
            featureIds=[],
          ),
        )
        job["windows"].append(
          list(s.buffer(5).bounds) if f["kind"] == "tree" else list(s.bounds)
        )
        job["featureIds"].append(f["id"])
    if f["kind"] in ["water-tower", "turntable", "tree"]:
      break
write(TASK / "railpark-features.json", dict(parks=parks, features=out))
write(TASK / "railpark-capture-jobs.json", list(jobs.values()))
print(
  "features",
  len(out),
  "hosts",
  len(jobs) // 2,
  "kinds",
  __import__("collections").Counter(f["kind"] for f in out),
)
subprocess.run(
  ["bun", "scripts/capture-railway-parks-v354.ts", str(TASK / "railpark-support")],
  input=json.dumps(list(jobs.values())),
  text=True,
  cwd=ROOT / "src/app",
  check=True,
)
