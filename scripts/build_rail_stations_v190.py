"""Step 10: finite Stadtbahn/Ring station inventory and source-bound accents.

Coordinates are losslessly retained in evidence. No source packet is changed.
The presentation grade is explicitly not a railway engineering survey.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import pyogrio
from pyproj import Transformer
from shapely.geometry import Point, Polygon, shape
from shapely.ops import linemerge, substring, transform, unary_union

from isometric_berlin.data.fetch_osm import parse_hstore

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
RAW = GEO / "raw/rail-v190"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
PROJECT = Transformer.from_crs(4326, 25833, always_xy=True).transform
STADTBAHN = [
  ("Westkreuz", "34666754"),
  ("Charlottenburg", "3808290434"),
  ("Savignyplatz", "610324733"),
  ("Zoologischer Garten", "1351158702"),
  ("Tiergarten", "21302157"),
  ("Bellevue", "27528155"),
  ("Hauptbahnhof", "3856100106"),
  ("Friedrichstraße", "3869306763"),
  ("Hackescher Markt", "3867910430"),
  ("Alexanderplatz", "3908141014"),
  ("Jannowitzbrücke", "21487225"),
  ("Ostbahnhof", "2837556546"),
  ("Warschauer Straße", "3658970189"),
  ("Ostkreuz", "670801913"),
]
PRESERVED = {
  "Hauptbahnhof",
  "Zoologischer Garten",
  "Friedrichstraße",
  "Alexanderplatz",
  "Jannowitzbrücke",
}
HUBS = {"Westkreuz", "Ostkreuz", "Südkreuz", "Gesundbrunnen"}
ROUTE_URLS = ["https://sbahn.berlin/fahren/s41/", "https://sbahn.berlin/fahren/s5/"]
POLICY = (
  "Exact OSM positions, full platform/roof rings and route vertices. Existing "
  "source shells (except four explicitly audited Ostkreuz proxies), historic Ring hairlines and five detailed "
  "Stadtbahn hero models remain. Relative crossing order is sourced; vertical "
  "platform separation, rail display grades, canopy member spacing, materials "
  "and furniture are illustrative, not surveyed elevation or engineering data. "
  "Negative OSM layer is retained as metadata, never multiplied by a height."
)


def digest(path: Path) -> str:
  """Fingerprint an immutable source."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def world(g: Any) -> Any:
  """Use the established EPSG:25833 city coordinate frame."""
  return transform(lambda x, y: (x - 389500, 5820000 - y), transform(PROJECT, g))


def tags(feature: dict[str, Any]) -> dict[str, str]:
  """Recover the complete original OSM tags exposed by GDAL."""
  p = feature["properties"]
  return {
    **parse_hstore(p.get("other_tags") or ""),
    **{
      k: v
      for k, v in p.items()
      if v is not None
      and k
      not in {
        "other_tags",
        "osm_id",
        "osm_way_id",
        "z_order",
      }
    },
  }


def ident(f: dict[str, Any], node: bool = False) -> str:
  """Keep original OSM type and identifier."""
  p = f["properties"]
  return ("node/" if node else "relation/" if p.get("osm_id") else "way/") + str(
    p.get("osm_id") or p["osm_way_id"]
  )


def cache() -> None:
  """Read only the retained Berlin extract within the requested rail extent."""
  RAW.mkdir(parents=True, exist_ok=True)
  queries = {
    "lines": "railway IN ('rail','light_rail')",
    "points": "other_tags LIKE '%railway%station%' OR other_tags LIKE '%railway%halt%'",
    "multipolygons": "other_tags LIKE '%railway%platform%' OR building IN ('roof','train_station')",
    "multilinestrings": "name LIKE '%S5%' OR name LIKE '%S 5%' OR name LIKE '%S41%' OR name LIKE '%S 41%'",
  }
  for layer, where in queries.items():
    dest = RAW / f"{layer}.geojson"
    if not dest.exists():
      frame = pyogrio.read_dataframe(
        PBF, layer=layer, bbox=(13.25, 52.45, 13.5, 52.57), where=where
      )
      dest.write_text(frame.to_json(drop_id=True), encoding="utf8")


def features(layer: str) -> list[dict[str, Any]]:
  """Load the bounded retained feature cache."""
  return json.loads((RAW / f"{layer}.geojson").read_text())["features"]


def rings(p: Polygon) -> list[list[list[float]]]:
  """Keep all source vertices and holes, rounded only to world millimetres."""
  return [
    [[round(x, 3), round(z, 3)] for x, z in r.coords]
    for r in [p.exterior, *p.interiors]
  ]


def frame(p: Polygon) -> dict[str, Any]:
  """Use a source-fitted orientation only for repeated shallow details."""
  cs = list(p.minimum_rotated_rectangle.exterior.coords)[:-1]
  a, b = max(zip(cs, cs[1:] + cs[:1], strict=True), key=lambda ab: math.dist(*ab))
  length = math.dist(a, b)
  dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
  if dx < 0:
    dx, dz = -dx, -dz
  return dict(
    x=round(p.centroid.x, 3),
    z=round(p.centroid.y, 3),
    dx=dx,
    dz=dz,
    length=round(length, 3),
    width=round(p.minimum_rotated_rectangle.area / length, 3),
  )


def platform_y(name: str, t: dict[str, Any]) -> float:
  """Encode crossing order, not arbitrary arithmetic on relative OSM layers."""
  if name == "Ostkreuz":
    return 12.46 if t.get("layer") == "1" else 3.96
  if name in {"Westkreuz", "Südkreuz"}:
    return 10.46 if t.get("layer") == "1" else 3.96
  if name in {
    "Tiergarten",
    "Bellevue",
    "Hackescher Markt",
  }:
    return 15.435
  if name == "Schöneberg":
    return 10.46 if t.get("layer") == "1" else 3.96
  return 3.96


def build() -> tuple[dict[str, Any], dict[str, Any]]:
  """Prepare source identities and exact accents without replacing old owners."""
  cache()
  prior = json.loads((GEO / "ring-stations-v180.json").read_text())
  original = json.loads((GEO / "outer-thin-outlines-v179.json").read_text())
  points = {ident(f, True): f for f in features("points")}
  poly = {ident(f): f for f in features("multipolygons")}
  for f in original["footprints"] + prior["footprints"]:
    if not f["kind"].startswith("station-"):
      continue
    key = f["osmIds"][0]
    if key not in poly:
      poly[key] = dict(
        properties={
          "osm_way_id": key.split("/")[1],
          **f.get("sourceTags", {}),
          "building": "roof" if f["kind"] == "station-roof" else "train_station",
        },
        geometry=dict(type="Polygon", coordinates=f["rings"]),
      )
  stations: dict[str, Any] = {}
  for a in prior["anchors"]:
    p = world(Point(a["lon"], a["lat"]))
    stations[a["stationName"]] = dict(
      name=a["stationName"],
      anchor=a["osmIds"][0],
      point=[p.x, p.y],
      ringOrder=a["clockwiseOrder"],
      platformIds=[],
      roofs=[],
    )
  for order, (name, node) in enumerate(STADTBAHN):
    # The source's S-Bahn station node includes an accent in its name; select
    # railway=station/light_rail, never the similarly named U6 or mainline node.
    if not node:
      candidates = [
        f
        for f in points.values()
        if "Friedrich" in (tags(f).get("name") or "")
        and tags(f).get("station") == "light_rail"
      ]
      assert len(candidates) == 1
      node = ident(candidates[0], True).split("/")[1]
    f = points["node/" + node]
    p = world(shape(f["geometry"]))
    s = stations.setdefault(
      name,
      dict(
        name=name, anchor="node/" + node, point=[p.x, p.y], platformIds=[], roofs=[]
      ),
    )
    s["stadtbahnAnchor"] = "node/" + node
    s["stadtbahnOrder"] = order
    s["heroRetained"] = name in PRESERVED
  platform_owners: dict[str, str] = {}
  roof_owners: dict[str, str] = {}
  for f in original["footprints"] + prior["footprints"]:
    name = f.get("stationName") or f["name"].removeprefix("Bahnhof ")
    if name not in stations:
      continue
    for key in f["osmIds"]:
      if f["kind"] == "station-platform":
        platform_owners[key] = name
      elif f["kind"].startswith("station-"):
        roof_owners[key] = name
  for key, f in poly.items():
    t = tags(f)
    name = t.get("name", "").removeprefix("Berlin ")
    if (
      name in dict(STADTBAHN)
      and t.get("railway") == "platform"
      and t.get("subway") != "yes"
      and t.get("level") not in {"-2", "-3"}
    ):
      platform_owners[key] = name
  platforms = []
  source_records = []
  for key, name in sorted(platform_owners.items()):
    f = poly[key]
    t = tags(f)
    assert t.get("subway") != "yes"
    s = stations[name]
    s["platformIds"].append(key)
    geom = world(shape(f["geometry"]))
    for p in geom.geoms if geom.geom_type == "MultiPolygon" else [geom]:
      platforms.append(
        dict(
          id=key,
          station=name,
          rings=rings(p),
          frame=frame(p),
          y=platform_y(name, t),
          sourceTags=t,
          retainedHero=name in PRESERVED,
        )
      )
    source_records.append(
      dict(id=key, station=name, geometry=f["geometry"], sourceTags=t)
    )
  # For the nine not-already-detailed Stadtbahn stations only use roofs that
  # actually overlap an inventoried platform, not nearby unrelated buildings.
  for key, f in poly.items():
    t = tags(f)
    if t.get("building") not in {"roof", "train_station"}:
      continue
    p = world(shape(f["geometry"]))
    for name, _ in STADTBAHN:
      if name in PRESERVED or name in HUBS:
        continue
      ps = [
        Polygon(q["rings"][0], q["rings"][1:])
        for q in platforms
        if q["station"] == name
      ]
      if ps and p.intersection(unary_union(ps)).area > 15:
        roof_owners.setdefault(key, name)
  # Match retained generic sources for metric roof-top accents only. Existing
  # geometry is untouched; source IDs and measured vertical envelopes survive.
  owners = []
  for rel in [
    "raw/outer-v159/resolved-outlines.gpkg",
    "raw/ring-v182/resolved-outlines.gpkg",
    "raw/city-v183/resolved-outlines.gpkg",
  ]:
    path = GEO / rel
    if path.exists():
      owners.extend(gpd.read_file(path, layer="buildings").to_dict("records"))
  from shapely import STRtree

  tree = STRtree([o["geometry"] for o in owners])
  roofs = []
  for key, name in sorted(roof_owners.items()):
    f = poly[key]
    t = tags(f)
    geom = world(shape(f["geometry"]))
    for p in geom.geoms if geom.geom_type == "MultiPolygon" else [geom]:
      matches = [owners[i] for i in tree.query(p, predicate="intersects")]
      matches = [
        o for o in matches if p.intersection(o["geometry"]).area / p.area > 0.5
      ]
      owner = max(
        matches, key=lambda o: p.intersection(o["geometry"]).area, default=None
      )
      y = (
        3 + float(owner["height"])
        if owner
        else max(q["y"] for q in platforms if q["station"] == name) + 4.5
      )
      roofs.append(
        dict(
          id=key,
          station=name,
          rings=rings(p),
          frame=frame(p),
          y=round(y, 3),
          sourceTags=t,
          retainedOwnerId=str(owner["sourceId"]).strip() if owner else None,
          heightSource=owner["heightSource"]
          if owner
          else "illustrative 4.5 m above platform",
          heightEstimate=not owner
          or not str(owner["heightSource"]).startswith("Berlin LoD2"),
        )
      )
      stations[name]["roofs"].append(key)
    source_records.append(
      dict(id=key, station=name, geometry=f["geometry"], sourceTags=t)
    )
  # Keep each original route vertex. S5 is clipped at the outer ends of its
  # exact Westkreuz/Ostkreuz platform neighbourhood, never connected by chords.
  routes = []
  routes_qa = []
  for f in features("multilinestrings"):
    sid = f["properties"]["osm_id"]
    g = linemerge(world(shape(f["geometry"])))
    assert g.geom_type == "LineString"
    if sid != "14981":
      west = Point(stations["Westkreuz"]["point"])
      east = Point(stations["Ostkreuz"]["point"])
      a, b = sorted([g.project(west), g.project(east)])
      g = substring(g, max(0, a - 180), min(g.length, b + 180))
    routes.append(
      dict(
        id="relation/" + sid,
        family="ring" if sid == "14981" else "stadtbahn",
        points=[[round(x, 3), round(z, 3)] for x, z in g.coords],
      )
    )
    routes_qa.append(
      dict(
        id="relation/" + sid,
        lengthM=round(g.length, 3),
        vertexCount=len(g.coords),
        closed=g.is_closed,
      )
    )
  for name, s in stations.items():
    assert s["platformIds"], name
    s["point"] = [round(n, 3) for n in s["point"]]
    s["hub"] = name in HUBS
    s.setdefault("heroRetained", False)
    s["roofs"] = sorted(set(s["roofs"]))
  evidence = dict(
    schemaVersion=1,
    sourceUrl="https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    sourceSha256=digest(PBF),
    sourceTimestamp="2026-09-29T20:22:51Z",
    license="ODbL-1.0; dl-de/zero-2-0",
    policy=POLICY,
    identitySources=ROUTE_URLS,
    stations=list(stations.values()),
    features=source_records,
    routeAudit=routes_qa,
    ringSourceUnchanged=True,
    originalRingSha256=digest(GEO / "outer-thin-outlines-v179.json"),
    originalDetailedRailSha256=digest(
      ROOT / "src/app/public/mesh/regierungsviertel/rail-lines.json"
    ),
    platformCount=len(platforms),
    roofCount=len(roofs),
    uniqueStationCount=len(stations),
    ringStationCount=27,
    stadtbahnStationCount=14,
    preservedHeroNames=sorted(PRESERVED),
    limitations=[
      "Unsurveyed vertical grades and platform clearances remain explicitly illustrative.",
      "Only four audited Ostkreuz generic source owners are replaced by open geometry. Other retained station shells remain; this pass does not claim complete surveyed station interiors.",
      "The 27-stop Ring geographical circuit is shared by S41/S42; the S41 rail geometry is not falsely presented as both directional tracks.",
    ],
  )
  data = dict(
    schemaVersion=1,
    policy=POLICY,
    sourceSha256=evidence["sourceSha256"],
    stations=list(stations.values()),
    platforms=platforms,
    roofs=roofs,
    routes=routes,
  )
  return data, evidence


def main() -> None:
  """Write small runtime data and independent source evidence."""
  data, evidence = build()
  (ROOT / "src/app/src/data/railStationsV190.json").write_text(
    json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  (GEO / "rail-stations-v190-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
  )
  print(
    json.dumps(
      {
        k: evidence[k]
        for k in [
          "uniqueStationCount",
          "ringStationCount",
          "stadtbahnStationCount",
          "platformCount",
          "roofCount",
          "routeAudit",
        ]
      },
      indent=2,
    )
  )


if __name__ == "__main__":
  main()
