"""Verified memorial anchor; current visible terrain owns its altitude.

No historical border line, new ground, portrait or copied image is introduced.
The 2.60 m Fechter height is documented; other dimensions and path orientation
are explicit display estimates. Every old named-grave model remains unchanged.
"""

from __future__ import annotations

import argparse
import hashlib
import math

from shapely.geometry import Point, Polygon

from scripts.build_mcdonalds_inventory_v351 import GEO, ROOT, read, write
from scripts.build_named_graves_v347 import Grave
from scripts.build_surrounding_outlines import PackedMesh

DATA = ROOT / "src/app/src/data"
KIND = "wall-markers-v352"
SITES = [
  dict(
    key="fechter-v352",
    id="node/3624148007",
    foundation="foundation:1804",
    name="Peter Fechter — Zimmerstraße",
    yaw=0.0,
    reference="https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/peter-fechter/841",
    photo="https://www.gedenktafeln-in-berlin.de/tafeln_content/tafeln/zimmerstrasse_26-29_a_01.jpg",
  ),
  dict(
    key="wohlfahrt-v352",
    id="node/12309152002",
    foundation="foundation:1821",
    name="Dieter Wohlfahrt — Bergstraße",
    yaw=0.0,
    reference="https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/opfer-der-mauer-dieter-wohlfahrt/989",
    photo="https://d2exd72xrrp1s7.cloudfront.net/www/000/1k4/1j/1j9lt9xjr3cnt11o8j1cbs0k573iq36rdg-uhi23147663/0?crop=false&q=70&width=3840",
  ),
]


def build():
  records = {r["id"]: r for r in read(GEO / "wall-places-v352-osm.json.gz")["records"]}
  sites = []
  evidence = []
  for site in SITES[:1]:
    row = records[site["id"]]
    assert row["geometry"]["type"] == "Point"
    models = {}
    for native in (False, True):
      mode = "minecraft" if native else "drawn"
      model = Grave(site, [0, 0], 0, native)
      if site["key"] == "fechter-v352":
        radius = 0.29
        height = 2.6
        rgb = (116, 77, 53)
        if native:
          step = 0.04
          for i in range(-8, 8):
            for j in range(-8, 8):
              x = (i + 0.5) * step
              z = (j + 0.5) * step
              if x * x + z * z <= radius * radius:
                model.cuboid(x, height / 2, z, step, height, step, rgb, True)
        else:
          ring = []
          for i in range(32):
            a = i * math.tau / 32
            b = (i + 1) * math.tau / 32
            ax, az = radius * math.cos(a), radius * math.sin(a)
            bx, bz = radius * math.cos(b), radius * math.sin(b)
            ring.append([ax, az])
            color = tuple(v + (i % 3 - 1) * 3 for v in rgb)
            for tri in [
              [(ax, 0, az), (bx, 0, bz), (bx, height, bz)],
              [(ax, 0, az), (bx, height, bz), (ax, height, az)],
              [(0, height, 0), (ax, height, az), (bx, height, bz)],
            ]:
              model.detail.triangles.append((tri, color, "weathered-steel"))
          model.solids.append((Polygon(ring), 0, height))
      else:
        wood = (74, 65, 49)
        bronze = (63, 82, 77)
        model.cuboid(0, 1.35, 0, 0.15, 2.7, 0.16, wood, True)
        model.cuboid(0, 2.14, 0, 1.12, 0.15, 0.16, wood, True)
        # The documented portrait frame remains deliberately neutral;
        # no synthetic face or unlicensed photographic pixels are used.
        model.cuboid(0, 1.91, -0.105, 0.4, 0.46, 0.07, wood, True)
        model.cuboid(0, 1.91, -0.148, 0.33, 0.38, 0.015, (69, 73, 71))
        model.cuboid(0, 0.035, -0.36, 0.88, 0.07, 0.47, bronze, True)
      mesh = PackedMesh(-4, -4)
      for tri, color, _ in model.detail.triangles:
        mesh.triangle(tri, color)
      solids = [
        dict(
          ring=[[round(x, 2), round(z, 2)] for x, z in list(p.exterior.coords)[:-1]],
          low=round(lo, 2),
          high=round(hi, 2),
        )
        for p, lo, hi in model.solids
      ]
      vv = list(mesh.vertices)
      bounds = [round(min(p[a] for p in vv) * 0.01 - 4, 2) for a in (0, 2)] + [
        round(max(p[a] for p in vv) * 0.01 - 4, 2) for a in (0, 2)
      ]
      models[mode] = dict(mesh=mesh.payload(KIND), solids=solids, bounds=bounds)
      evidence.append(
        dict(
          key=site["key"],
          mode=mode,
          vertices=len(mesh.vertices),
          indices=len(mesh.indices),
          solids=len(solids),
        )
      )
    sites.append(
      dict(
        key=site["key"],
        id=site["id"],
        name=site["name"],
        anchor=row["geometry"]["coordinates"],
        models=models,
      )
    )
  old = read(DATA / "namedGravesV347.json")["sites"]
  allsites = sites + old
  # Disjoint admission disks preserve the existing maximum one live memorial
  # mesh/material. No increase to the renderer or Worker residency budgets.
  distances = [
    math.dist(a["anchor"], b["anchor"])
    for i, a in enumerate(allsites)
    for b in allsites[i + 1 :]
  ]
  assert min(distances) > 360
  return dict(schemaVersion=1, origin=[-4, -10, -4], sites=sites), dict(
    schemaVersion=1,
    models=evidence,
    sources=SITES,
    sourceInventorySha256=hashlib.sha256(
      (GEO / "wall-places-v352-osm.json.gz").read_bytes()
    ).hexdigest(),
    retainedGravesSha256=hashlib.sha256(
      (DATA / "namedGravesV347.json").read_bytes()
    ).hexdigest(),
    minimumSiteSeparation=min(distances),
    maxSimultaneousModels=1,
    radius=180,
    estimates=[
      "Fechter diameter; cross dimensions and orientation; simplified material colour",
      "Portrait and lettering deliberately omitted, not fabricated; no claim of complete artistic reproduction",
    ],
    support="All 25 footprint samples must have actual resident dry, unblocked, consistent ground. No static Y or added ground. Missing support retires the complete model and its exact solids.",
  )


def audit():
  source = read(GEO / "wall-places-v352-source.json.gz")
  rows = read(GEO / "wall-places-v352-osm.json.gz")["records"]
  physical = [
    r
    for r in rows
    if r["tags"].get("historic") in ("memorial", "monument")
    or r["tags"].get("memorial")
  ]
  retained = {
    "foundation:1890": "BerlinWallMemorialV174 / exact chapel",
    "foundation:1909": "BerlinWallMemorialV174 / preserved double-wall installation",
    "foundation:1899": "BerlinWallMemorialV174 / Window of Remembrance",
    "foundation:1764": "TiergartenMonuments / Weiße Kreuze",
  }
  added = {s["foundation"]: s for s in SITES[:1]}
  outcomes = []
  for r in source["records"]:
    candidates = []
    if r["category"] in ("Todesopfer", "Gedenkort"):
      for m in physical:
        from shapely.geometry import shape

        d = shape(m["geometry"]).distance(Point(r["point"]))
        if d <= 100:
          candidates.append(
            dict(id=m["id"], name=m["tags"].get("name"), distance=round(d, 2))
          )
    status = "directory-only-physical-form-unverified"
    if r["id"] in retained:
      status = "authored-model-retained"
    if r["id"] in added:
      status = "mapped-marker-added-on-resident-ground"
    outcomes.append(
      dict(
        id=r["id"],
        title=r["title"],
        category=r["category"],
        status=status,
        source=r["url"],
        nearbyCandidates=sorted(candidates, key=lambda r: r["distance"]),
        representedBy=retained.get(r["id"], added.get(r["id"], {}).get("id")),
      )
    )
  return dict(
    schemaVersion=1,
    records=outcomes,
    total=len(outcomes),
    limitations=[
      "196 directory records are NOT 196 new models. Candidate proximity alone never authorizes a match.",
      "Foundation records 1852 and 1883 both name Udo Düllick with distinct pins; unresolved rather than merged.",
      "Outer-ring steles Kliem/Schulze and Schwietzer have photographic evidence but no resident ground at exact mapped points; remain unplaced.",
      "Wohlfahrt cross has an exact mapped anchor and reference photos, but the nearest ground footprint ends 405 m away; no floating memorial is emitted.",
      "Historical 1989 border and demolished segments are not current physical structures.",
    ],
  )


if __name__ == "__main__":
  p = argparse.ArgumentParser()
  p.add_argument("--check", action="store_true")
  a = p.parse_args()
  data, evidence = build()
  for path, value in [
    (DATA / "wallMarkersV352.json", data),
    (GEO / "wall-markers-v352-evidence.json", evidence),
    (GEO / "wall-places-v352-audit.json.gz", audit()),
  ]:
    if a.check:
      assert read(path) == value, str(path)
    else:
      write(path, value)
  print(evidence["models"])
