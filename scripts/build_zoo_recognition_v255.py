"""Step 10: bounded Zoo Berlin recognition anchors; no source replacement."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/app/src/data/zooGroundsV165Source.json"
EVIDENCE = ROOT / "src/app/src/data/zooGroundsV165Evidence.json"
DEST = ROOT / "src/app/src/data/zooRecognitionV255Source.json"


def build() -> dict:
  """Keep original source courses and explicitly distinguish estimated fittings."""
  source = json.loads(SOURCE.read_text())
  evidence = json.loads(EVIDENCE.read_text())
  features = {f["id"]: f for f in evidence["features"]}
  tower = features["1557644530"]
  polygon = Polygon(tower["coordinates"])
  centre = polygon.centroid
  # The current mapped tower is a square with clipped corners. Its fitted
  # recognition courses remain inside that complete, unmodified source ring.
  yaw = -math.atan2(6.0990799408, 5.9204677806)
  footprint_width = 7.05
  corners = [
    (
      centre.x + math.cos(yaw) * u + math.sin(yaw) * v,
      centre.y - math.sin(yaw) * u + math.cos(yaw) * v,
    )
    for u, v in [
      (-footprint_width / 2, -footprint_width / 2),
      (footprint_width / 2, -footprint_width / 2),
      (footprint_width / 2, footprint_width / 2),
      (-footprint_width / 2, footprint_width / 2),
    ]
  ]
  assert polygon.covers(Polygon(corners))
  paths = unary_union(
    [LineString(p["line"]).buffer(p["width"] / 2) for p in evidence["paths"]]
  )
  buildings = unary_union([Polygon(p["ring"], p["holes"]) for p in source["parts"]])
  water = unary_union([Polygon(w["ring"]) for w in evidence["waters"]])
  rhino = Polygon(features["1185284028"]["coordinates"])
  allowed = rhino.difference(paths.buffer(1)).difference(buildings).difference(water)
  reeds = []
  for pond in evidence["waters"]:
    edge = Polygon(pond["ring"]).exterior
    if not edge.intersects(rhino):
      continue
    for distance in range(0, int(edge.length), 7):
      point = edge.interpolate(distance)
      for dx, dz in [(1.0, 0), (-1.0, 0), (0, 1.0), (0, -1.0)]:
        candidate = Point(point.x + dx, point.y + dz)
        if allowed.covers(candidate.buffer(0.5)) and all(
          candidate.distance(Point(*r)) > 3 for r in reeds
        ):
          reeds.append([round(candidate.x, 3), round(candidate.y, 3)])
          break
  reeds = reeds[:20]
  playground = Polygon(features["25415847"]["coordinates"])
  play_towers = [
    {"position": [-2288.0, 1029.0], "deck": 2.8, "roof": 5.5},
    {"position": [-2278.0, 1025.0], "deck": 3.8, "roof": 6.5},
    {"position": [-2267.0, 1023.0], "deck": 2.7, "roof": 5.2},
  ]
  for item in play_towers:
    p = Point(*item["position"])
    assert playground.covers(p.buffer(3))
    assert paths.distance(p) > 3
  result = {
    "schemaVersion": 1,
    "groundY": 5.2,
    "tower": {
      "osm": tower["id"],
      "ring": tower["coordinates"],
      "centre": [round(centre.x, 6), round(centre.y, 6)],
      "yaw": round(yaw, 9),
      "width": footprint_width,
      "height": 25,
      "levels": 18,
      "status": "OSM position and published height; taper and band sizes estimated",
    },
    "playground": {
      "osm": "25415847",
      "ring": features["25415847"]["coordinates"],
      "towers": play_towers,
      "status": "Mapped boundary; photo-supported equipment, estimated internal layout",
    },
    "reeds": reeds,
    "reedHabitat": "1185284028",
    "vegetationStatus": "Illustrative reeds beside mapped ponds, within rhino habitat",
  }
  DEST.write_text(json.dumps(result, separators=(",", ":")) + "\n")
  receipt = {
    "step": 10,
    "scope": "v255 Zoo Berlin west, inside existing v165 site",
    "preservedInputs": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [
        SOURCE,
        EVIDENCE,
        ROOT / "src/app/src/data/zooGroundsV165Navigation.json",
        ROOT / "src/app/public/mesh/regierungsviertel/park-details.json",
      ]
    },
    "replacementOwners": [],
    "newStreamingDescriptors": 0,
    "newDrawCalls": 0,
    "towerConflict": (
      "Retained LoD2 rhino house maximum is 12.35 m, while mapped tower "
      "1557644530 and Zoo opening report give 25 m. Add only the separate "
      "tower recognition within its exact ring; retain all original surfaces."
    ),
    "sources": [
      {
        "url": "https://www.zoo-berlin.de/de/aktuelles/news/artikel/eroeffnung-der-nashorn-pagode-im-zoo-berlin",
        "facts": "25 m, 18 tower levels, red concrete, lotus ornament and ETFE roof",
      },
      {
        "url": "https://www.zoo-berlin.de/de/aktuelles/news/artikel/einblicke-in-neue-erlebniswelt",
        "facts": "Gold crown and built tower/roof photograph; reference-only",
      },
      {
        "url": "https://www.zoo-berlin.de/de/aktuelles/news/artikel/180-jahre-berlin-antilopenhaus",
        "facts": "1872 house, 21 historic brown doors; current facade photo reference",
      },
      {
        "url": "https://www.zoo-berlin.de/fileadmin/zoo-berlin/downloads/Investor_Relations/Geschaeftsberichte/Geschaeftsbericht_AG_2019.pdf",
        "page": 50,
        "facts": (
          "2019 playground completed; timber climbing towers, steel slides, "
          "palisades and timber walk/seating. Former ship was replaced."
        ),
      },
      {
        "url": "https://www.zoo-berlin.de/de/tickets-service/zoo-plan",
        "facts": "Site identity and orientation only; no tracing or bundled plan",
      },
    ],
    "estimates": (
      "Facade band depths, minaret subdivisions, tower taper/ornament widths, "
      "playground equipment dimensions/internal layout and individual reed positions "
      "are original display estimates. No photo or plan is a metric geometry source."
    ),
    "playgroundPathClearanceM": [
      round(paths.distance(Point(*t["position"])), 3) for t in play_towers
    ],
    "reedCount": len(reeds),
  }
  (ROOT / "geo_data/regierungsviertel/zoo-recognition-v255-evidence.json").write_text(
    json.dumps(receipt, indent=2) + "\n"
  )
  return result


if __name__ == "__main__":
  data = build()
  print(f"Zoo v255: 1 tower, 3 play towers, {len(data['reeds'])} reed groups")
