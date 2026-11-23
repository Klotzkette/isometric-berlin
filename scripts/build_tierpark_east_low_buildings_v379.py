"""Remove verified spurious towers, reusing a single geometry slot for each tile.

Cut ownership of every original roof, wall and edge is individually proven in
both families. Current park ground and the remaining low roofs share one mesh.
The separate nav table identifies each source owner in that mesh.
"""

import gzip
import json
from collections import defaultdict

import numpy as np

from scripts.build_surveyed_shell_retirements_v377 import select_tile
from scripts.build_tierpark_east_v379 import DATA, GEO, GROUND, Mesh, triangles, write
from scripts.build_windowless_buildings_v377 import bodies, entity


def generate():
  candidates = json.load(gzip.open(GEO / "tierpark-east-v379-low-buildings.json.gz"))[
    "sites"
  ]
  folder = DATA / "tierparkEastV379LowTiles"
  folder.mkdir(exist_ok=True)
  admit = defaultdict(list)
  report = {}
  base_index = set(json.loads((DATA / "tierparkEastV379ShellIndex.json").read_text()))
  for owner, regions in candidates.items():
    ready = []
    try:
      for tile, row in regions.items():
        for family in ["drawn", "minecraft"]:
          cut, stats = select_tile(tile, owner, family)
          parts = [p for b, p, _, _ in bodies(tile, family)[0] if entity(b) == owner]
          if len(parts) != 1:
            raise ValueError("subdivided footprint")
          ready.append((tile, family, cut, parts[0], row))
    except ValueError as e:
      print("Retained ambiguous low building", owner, str(e)[:120])
      continue
    for tile, family, cut, poly, row in ready:
      admit[tile, family].append((owner, cut, poly, row))
    report[owner] = {
      tile: {
        "form": v["form"],
        "prior": v["prior"],
        "median": round(float(np.median(np.asarray(v["samples"])[:, 2])), 2),
      }
      for tile, v in regions.items()
    }
  for (tile, family), rows in admit.items():
    m = Mesh(tile)
    anchor = rows[0][0]
    cuts = {}
    nav = []
    base = (
      json.loads((DATA / "tierparkEastV379Tiles" / f"{family}_{tile}.json").read_text())
      if tile in base_index
      else None
    )
    previous = (
      base["retirements"]["packets"][tile] if base else {"records": [], "segments": []}
    )
    forbidden = set(t for cut in previous["records"] for t in cut["triangles"])
    segs = set()
    linehash = None
    for owner, receipt, poly, row in rows:
      values = np.array(row["samples"])
      h = round(float(np.median(values[:, 2])), 2)
      if family == "minecraft":
        h = round(h * 2) / 2
      open_ground = row["form"] == "open"
      nav.append([owner, 0 if open_ground else h])
      if not open_ground:
        top = GROUND + h
        median = np.quantile(values[:, 3:], 0.65, axis=0)
        color = tuple(np.clip(median, 69, 183).astype(int))
        wall = (157, 150, 127)
        rings = [poly.exterior, *poly.interiors]
        for r in rings:
          for a, b in zip(r.coords, list(r.coords)[1:]):
            m.quad(
              (a[0], GROUND, a[1]),
              (b[0], GROUND, b[1]),
              (b[0], top, b[1]),
              (a[0], top, a[1]),
              wall,
            )
        for tri in triangles(poly):
          m.tri(*[(x, top, z) for x, z in tri], color)
      for cut in receipt["records"]:
        if forbidden.intersection(cut["triangles"]):
          raise ValueError("Overlapping old zoo owners")
        forbidden.update(cut["triangles"])
        k = cut["mesh"]
        dest = cuts.setdefault(
          k, {"mesh": k, "fingerprint": cut["fingerprint"], "triangles": []}
        )
        assert dest["fingerprint"] == cut["fingerprint"]
        dest["triangles"].extend(cut["triangles"])
      if receipt["segments"]:
        assert not segs.intersection(receipt["segments"])
        linehash = receipt["lineFingerprint"]
        segs.update(receipt["segments"])
    if not m.indices:
      # The default park ground under these vacant footprints remains active.
      # A single coincident .02 m ground chip keeps the authenticated replacement nonempty.
      a = rows[0][2].representative_point()
      x, z = a.x, a.y
      m.tri(
        (x, GROUND, z), (x + 0.02, GROUND, z), (x, GROUND, z + 0.02), (120, 137, 102)
      )
    for cut in cuts.values():
      cut["triangles"].sort()
    shell = dict(
      id=anchor,
      parentId=anchor,
      mesh=m.payload("surveyed-building-shells-v377"),
      roofIndexStart=len(m.indices),
    )
    cut = dict(
      origin=m.origin.tolist(),
      owners=[anchor],
      records=list(cuts.values()),
      lineFingerprint=linehash,
      segments=sorted(segs),
    )
    assert not set(cut["segments"]).intersection(previous["segments"])
    write(folder / f"{family}_{tile}.json", dict(shell=shell, cut=cut, nav=nav))
  write(DATA / "tierparkEastV379LowIndex.json", sorted({tile for tile, _ in admit}))
  write(GEO / "tierpark-east-v379-low-owners.json", report)
  print(
    "Corrected small structures",
    len(report),
    sum(next(iter(s.values()))["form"] == "open" for s in report.values()),
    flush=True,
  )


if __name__ == "__main__":
  generate()
