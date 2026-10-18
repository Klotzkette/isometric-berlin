"""Step 10: audit the complete Ring; bounded additions to existing station fittings."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PRESERVED = {"Wedding", "Gesundbrunnen", "Ostkreuz", "Südkreuz", "Westkreuz"}
CANOPIES = {"way/36218351", "way/375394534", "way/438832765", "way/44426688"}
SOURCES = [
  "src/app/src/data/railStationsV190.json",
  "src/app/src/data/ringStationDetailsV205.json",
  "geo_data/regierungsviertel/ring-stations-v180.json",
  "src/app/src/RailStationsV190.ts",
  "src/app/src/OstkreuzV190.ts",
  "src/app/src/WeddingMoabitV229.ts",
  "src/app/src/weddingMoabitV229Profile.ts",
  "src/app/src/data/weddingStationCorePreviousV229.json",
]


def digest(path: Path) -> str:
  """Hash retained sources, including the five protected station implementations."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def xy(frame: dict[str, Any], u: float, v: float = 0) -> tuple[float, float]:
  """Use the exact existing source frame, not a new station rotation."""
  return (
    frame["x"] + frame["dx"] * u - frame["dz"] * v,
    frame["z"] + frame["dz"] * u + frame["dx"] * v,
  )


def polygon(row: dict[str, Any]) -> Polygon:
  """Read full retained rings, including holes."""
  return Polygon(row["rings"][0], row["rings"][1:])


def rounded(point: tuple[float, float]) -> list[float]:
  """Millimetre output follows the earlier metric station data."""
  return [round(v, 3) for v in point]


def build() -> tuple[dict[str, Any], dict[str, Any]]:
  """Derive finite additions and independently auditable all-27 coverage."""
  source = json.loads((DATA / "railStationsV190.json").read_text())
  prior = json.loads((DATA / "ringStationDetailsV205.json").read_text())
  anchors = json.loads((GEO / "ring-stations-v180.json").read_text())["anchors"]
  stations = sorted(
    [s for s in source["stations"] if s.get("ringOrder") is not None],
    key=lambda s: s["ringOrder"],
  )
  assert len(stations) == 27
  assert {s["ringOrder"] for s in stations} == set(range(27))
  assert {s["name"] for s in stations} == {a["stationName"] for a in anchors}
  core = json.loads(
    (ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )["buildings"]
  assert not {p["id"] for p in core} & {s.split("/")[1] for s in CANOPIES}
  sites, inventory = [], []
  for station in stations:
    name = station["name"]
    platforms = [p for p in source["platforms"] if p["station"] == name]
    assert platforms
    passenger = next(
      (p for p in platforms if p["sourceTags"].get("light_rail") == "yes"), None
    )
    assert passenger, name
    inventory.append(
      {
        "name": name,
        "order": station["ringOrder"],
        "anchor": station["anchor"],
        "platforms": [p["id"] for p in platforms],
        "roofs": station["roofs"],
        "protected": name in PRESERVED,
      }
    )
    if name in PRESERVED:
      continue
    f = passenger["frame"]
    choices = [xy(f, f["length"] * t) for t in [0.43, -0.43, 0.3, -0.3, 0]]
    # Exactly the v190 furniture selector. No second board or new post.
    x, z = next(p for p in choices if polygon(passenger).contains(Point(p)))
    site = {
      "name": name,
      "anchor": station["anchor"],
      "platform": passenger["id"],
      "sign": {"x": x, "z": z, "y": passenger["y"], "dx": f["dx"], "dz": f["dz"]},
      "canopies": [],
    }
    previous = next(s for s in prior["stations"] if s["name"] == name)
    for old in previous["canopies"]:
      assert old["id"] in CANOPIES
      roof = next(r for r in source["roofs"] if r["id"] == old["id"])
      assert roof["retainedOwnerId"] is None
      assert roof["rings"] == old["rings"] and roof["y"] == old["y"]
      footprint = polygon(roof)
      ground = unary_union([polygon(p) for p in platforms])
      clear = footprint.intersection(ground).buffer(-0.45)
      frame = roof["frame"]
      posts, cross = [], []
      bays = max(1, math.floor(frame["length"] / 9))
      for b in range(bays):
        u = frame["length"] * ((b + 0.5) / bays - 0.5)
        center = xy(frame, u)
        if not clear.covers(Point(center).buffer(0.20)):
          continue
        posts.append(rounded(center))
        line = LineString([xy(frame, u, -frame["width"]), xy(frame, u, frame["width"])])
        clipped = line.intersection(footprint.buffer(-0.30))
        parts = list(clipped.geoms) if hasattr(clipped, "geoms") else [clipped]
        for part in parts:
          if part.geom_type == "LineString" and part.length > 0.5:
            cross.append([rounded(part.coords[0]), rounded(part.coords[-1])])
      assert posts and cross, old["id"]
      site["canopies"].append(
        {
          "id": roof["id"],
          "floor": passenger["y"],
          "top": roof["y"],
          "posts": posts,
          "cross": cross,
        }
      )
    sites.append(site)
  evidence = {
    "schema": "ring-stations-v232/1",
    "operatorSource": "https://sbahn.berlin/fahren/s41/",
    "operatorChecked": "2026-10-18",
    "operatorStationCount": 27,
    "inventory": inventory,
    "protectedStations": sorted(PRESERVED),
    "preservedSha256": {s: digest(ROOT / s) for s in SOURCES},
    "policy": "All 27 existing OSM station/platform/roof identities retained. Only back lettering and a small S41/S42 line strip at the 22 existing sign coordinates, and estimated open supports below four already-rendered v205 canopy planes. No source shell, platform, elevation, route, packet, navigation or source owner is replaced.",
    "estimates": "Sign styling, line-strip placement, steel colors, support spacing/sections and bracing are illustrative. The four roof plans and their existing display grades are retained, not newly surveyed. Existing station envelopes outside these four open planes are unchanged; the audit is completeness, not a survey of every interior.",
  }
  return {"schemaVersion": 1, "sites": sites}, evidence


def main() -> None:
  """Write only the compact v232 data and evidence."""
  data, evidence = build()
  (DATA / "ringStationsV232.json").write_text(
    json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  (GEO / "ring-stations-v232-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
  )
  print(
    {
      "stationsAudited": len(evidence["inventory"]),
      "stationsRefined": len(data["sites"]),
      "canopies": sum(len(s["canopies"]) for s in data["sites"]),
    }
  )


if __name__ == "__main__":
  main()
