"""Bounded v257 anchors, preserving complete courthouse and Waisenstraße owners."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
COURT = ROOT / "geo_data/regierungsviertel/justice-palace-v183-evidence.json"
SOURCE = ROOT / "geo_data/regierungsviertel/alt-mitte-v169/source-392_5819-00.json.gz"
OWNERS = ["DEBE01YYK0000626", "DEBE01YYK00009MO", "DEBE01YYK00008M9"]


def sha(path):
  return hashlib.sha256(path.read_bytes()).hexdigest()


def edge(surface):
  points = np.array(surface["rings"][0])
  a, b = max(
    ((a, b) for a in points for b in points),
    key=lambda pair: math.hypot(*(pair[1] - pair[0])[[0, 2]]),
  )
  normal = sum(
    (
      np.cross(points[i] - points[0], points[i + 1] - points[0])
      for i in range(1, len(points) - 1)
    ),
    np.zeros(3),
  )
  norm = float(np.linalg.norm(normal))
  if norm < 0.01 or abs(normal[1] / norm) > 0.03:
    return None
  normal /= norm
  return {
    "a": [float(a[0]), float(a[2])],
    "b": [float(b[0]), float(b[2])],
    "normal": [round(float(normal[0]), 8), round(float(normal[2]), 8)],
    "bottom": float(points[:, 1].min()),
    "top": float(points[:, 1].max()),
  }


def build():
  court = next(
    r
    for r in json.loads(COURT.read_text())["records"]
    if r["parentId"] == "DEBE01YYK000017e"
  )
  omitted = []
  for index, surface in enumerate(court["surfaces"]):
    if surface["kind"] != "WallSurface":
      continue
    face = edge(surface)
    if face and 0.01 < math.dist(face["a"], face["b"]) < 3:
      omitted.append({**face, "surfaceIndex": index})
  buildings = json.loads(gzip.decompress(SOURCE.read_bytes()))["buildings"]
  court_ring = next(b for b in buildings if b["id"] == court["parentId"])[
    "footprintPolygons"
  ][0]["ring"]
  front_start = min(
    range(len(court_ring)), key=lambda i: math.dist(court_ring[i], [2831.19, 64.936])
  )
  front_end = min(
    range(len(court_ring)), key=lambda i: math.dist(court_ring[i], [2852.527, 100.287])
  )
  front = list(reversed(court_ring[front_end : front_start + 1]))
  restaurants = []
  for owner, surface_index in zip(OWNERS, [4, 8, 0], strict=True):
    building = next(b for b in buildings if b["id"] == owner)
    part = building["parts"][0]
    face = edge(part["surfaces"][surface_index])
    assert face and face["normal"][0] < -0.8
    restaurants.append(
      {
        "owner": owner,
        "osmWay": building["osmTags"]["osm_way_id"],
        "part": part["id"],
        "surfaceIndex": surface_index,
        **face,
      }
    )
  return {
    "schema": 1,
    "courtOwner": court["parentId"],
    "courtSource": str(COURT.relative_to(ROOT)),
    "courtSourceSha256": sha(COURT),
    "missingCourtFaces": omitted,
    "courtSkinTop": 27,
    "courtFront": front,
    "retainedProfiles": {
      name: sha(DATA / name)
      for name in ["justicePalaceV183.json", "justicePalaceV183Native.json"]
    },
    "restaurantSource": str(SOURCE.relative_to(ROOT)),
    "restaurantSourceSha256": sha(SOURCE),
    "restaurants": restaurants,
    "policy": "All delivered owners, roof triangles, facade details and navigation retained. Complete only the v183 upper skins omitted by its length<3m detail filter. The original 3.081m courthouse envelope remains intact; 27m skin top is the existing explicitly estimated v183 height. Reference-estimated shallow fittings are not surveyed dimensions. Independent orthogonal native fittings, no live textures.",
    "references": [
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011278",
        "image": "https://denkmaldatenbank.berlin.de/media/uploads/Mit/04/09011278b.jpg",
        "credit": "Landesdenkmalamt Berlin, LDA-Archiv, Bittner 2008",
        "use": "Visual reference only; no pixels bundled; surviving giant pilasters, curved pediments, portal, stone base, railings",
      },
      {
        "url": "https://www.berlin.de/gerichte/landgericht-zivil/das-gericht/wir-ueber-uns/historisches/littenstrasse/artikel.1310862.php",
        "credit": "Landgericht Berlin II",
        "use": "Building identity and extant wing history; demolished Grunerstraße towers are not rebuilt",
      },
      {
        "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011253",
        "image": "https://denkmaldatenbank.berlin.de/media/uploads/Mit/04/09011253a.jpg",
        "credit": "Landesdenkmalamt Berlin, LDA-Archiv, Bittner 2008",
        "use": "Visual reference only; no pixels bundled; three terrace fronts, four central window axes, mansard dormers",
      },
      {
        "url": "https://zurletzteninstanz.com/en/start-en/",
        "image": "https://zurletzteninstanz.com/wp-content/uploads/2021/11/zurletzteninstanz.jpg",
        "credit": "Zur letzten Instanz – Sperling OHG",
        "use": "Visual reference only; no pixels bundled; current brown fascia, ochre shutters, divided glazing and lanterns take precedence over historical green paint",
      },
    ],
    "cameras": {
      "court": {"eye": [2777, 48, 153], "target": [2856, 15, 80]},
      "courtPortal": {"eye": [2811, 10, 101], "target": [2840, 16, 84]},
      "instanz": {"eye": [2838, 10, 247], "target": [2865, 8, 235]},
    },
  }


if __name__ == "__main__":
  path = DATA / "littenInstanzV257.json"
  path.write_text(json.dumps(build(), separators=(",", ":")) + "\n")
  print(f"Wrote {path.name}: {path.stat().st_size:,} bytes")
