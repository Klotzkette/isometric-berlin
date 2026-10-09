"""Step 10: bounded, additive Treptow park / Köpenick recognition evidence."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
from build_east_landmarks_v187 import polygons
from build_surrounding_outlines import line_parts, tags_for, world
from shapely.geometry import LineString, Point, Polygon, mapping, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/src/data/eastParksV198.json"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
CACHE = GEO / "raw/east-v198/treptow.gpkg"
BOUNDS = [
  "bounds.geojson",
  "bounds-ring-v182.geojson",
  "bounds-city-v183.geojson",
  "bounds-outskirts-v187.geojson",
  "bounds-north-v190.geojson",
  "bounds-named-v194.geojson",
]
REFERENCES = [
  "https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/treptower-park/",
  "https://www.berlin.de/ba-treptow-koepenick/ueber-den-bezirk/treptower-park/artikel.541822.php",
  "https://www.berlin.de/ba-treptow-koepenick/ueber-den-bezirk/treptower-park/artikel.541823.php",
  "https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/udssr/treptow-koepenick/sowjetisches-ehrenmal-im-treptower-park-648099.php",
  "https://www.berlin.de/ba-treptow-koepenick/ueber-den-bezirk/artikel.9466.php",
  "https://www.smb.museum/museen-einrichtungen/schloss-koepenick/ueber-uns/profil/",
]


def ident(row: Any, layer: str) -> str:
  """Preserve source kind, not just a numeric ID."""
  if layer == "points":
    return "node/" + str(row.osm_id)
  if layer == "lines":
    return "way/" + str(row.osm_id)
  value = row.get("osm_way_id")
  return "way/" + value if isinstance(value, str) else "relation/" + str(row.osm_id)


def rings(poly: Polygon) -> list:
  """Keep every source vertex and hole at millimetre storage precision."""
  return [
    [[round(float(v), 3) for v in p] for p in r.coords]
    for r in [poly.exterior, *poly.interiors]
  ]


def runs(poly: Any, pitch: float) -> list:
  """Native flat surfaces as exact-width axis-aligned scanline runs."""
  result = []
  if poly.is_empty:
    return result
  x0, z0, x1, z1 = poly.bounds
  for z in range(math.floor(z0 / pitch), math.ceil(z1 / pitch)):
    mid = (z + 0.5) * pitch
    for part in line_parts(
      poly.intersection(LineString([(x0 - 1, mid), (x1 + 1, mid)]))
    ):
      a, _, b, _ = part.bounds
      lo, hi = math.ceil(a / pitch), math.floor(b / pitch)
      if hi > lo:
        result.append(
          [
            round((lo + hi) * pitch / 2, 3),
            round(mid, 3),
            round((hi - lo) * pitch, 3),
            pitch,
          ]
        )
  return result


def build() -> dict:
  """Retain bounded source courses; no existing packet or owner is replaced."""
  CACHE.parent.mkdir(parents=True, exist_ok=True)
  if not CACHE.exists():
    for layer in ["multipolygons", "lines", "points"]:
      f = gpd.read_file(
        PBF, layer=layer, bbox=(13.455, 52.48, 13.493, 52.50), engine="pyogrio"
      )
      f.to_file(CACHE, layer=layer, driver="GPKG")
  frames = {
    layer: gpd.read_file(CACHE, layer=layer).to_crs(25833)
    for layer in ["multipolygons", "lines", "points"]
  }
  for f in frames.values():
    f.geometry = f.geometry.map(world)
  area = frames["multipolygons"]
  park = area[area.osm_way_id == "4685998"].iloc[0].geometry
  memorial = area[area.osm_way_id == "442879072"].iloc[0].geometry
  old_crs84 = unary_union(
    [
      shape(v["geometry"])
      for name in BOUNDS
      for v in json.loads((GEO / name).read_text())["features"]
    ]
  )
  old = world(gpd.GeoSeries([old_crs84], crs=4326).to_crs(25833).iloc[0])
  new = park.difference(old)
  source = []
  grounds, paths, cenotaphs, flags, gates, buildings, anchors, benches, trees = (
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
    [],
  )
  woods, waters, lawns, surfaces, path_areas = [], [], [], [], []
  for _, r in area.iterrows():
    if not r.geometry.intersects(park):
      continue
    t = tags_for(r)
    id_ = ident(r, "multipolygons")
    g = r.geometry.intersection(park)
    role = ""
    if t.get("building"):
      role = "building"
      buildings.append(
        {
          "id": id_,
          "name": t.get("name", ""),
          "center": [round(g.centroid.x, 3), round(g.centroid.y, 3)],
          "rings": [rings(p) for p in polygons(g.intersection(new))],
          "nativeRoofRuns": runs(g.intersection(new), 1),
          "height": float(t.get("height", "7"))
          if str(t.get("height", "7")).replace(".", "", 1).isdigit()
          else 7,
          "heightEvidence": "OSM explicit" if t.get("height") else "display estimate",
        }
      )
    elif id_ in ["way/142701792", "way/1002636043"]:
      role = "lowered-granite-banner"
      flags.append({"id": id_, "rings": rings(polygons(g)[0]), "height": 14})
    elif t.get("natural") == "water" or t.get("water"):
      role = "water"
      waters.append(g)
    elif t.get("natural") == "wood" or t.get("landuse") == "forest":
      role = "wood"
      woods.append(g)
    elif t.get("landuse") == "grass":
      role = "lawn"
      lawns.append(g)
    elif t.get("highway") in ["pedestrian", "footway", "path"]:
      role = "mapped-paving"
      surfaces.append(g)
    if role:
      source.append(
        {
          "id": id_,
          "role": role,
          "geometry": mapping(g),
          "tags": {
            k: v
            for k, v in t.items()
            if k
            in ["name", "height", "surface", "building", "landuse", "natural", "tomb"]
          },
        }
      )
  for _, r in frames["lines"].iterrows():
    if not r.geometry.intersects(park):
      continue
    t = tags_for(r)
    id_ = ident(r, "lines")
    if t.get("description") == "Kenotaphe":
      g = Polygon(r.geometry.coords)
      cenotaphs.append({"id": id_, "rings": rings(g), "height": 2.5})
      source.append(
        {"id": id_, "role": "cenotaph", "geometry": mapping(g), "height": 2.5}
      )
    elif t.get("highway") in [
      "footway",
      "path",
      "pedestrian",
      "steps",
      "cycleway",
      "service",
      "residential",
    ]:
      if t.get("tunnel") or str(t.get("layer", "0")).startswith("-"):
        continue
      width = t.get("width")
      width = (
        float(width)
        if str(width).replace(".", "", 1).isdigit()
        else (5 if t.get("highway") in ["service", "residential"] else 3)
      )
      g = r.geometry.intersection(park)
      for line in line_parts(g):
        paths.append(
          {
            "id": id_,
            "points": [[round(v, 3) for v in p] for p in line.coords],
            "width": width,
            "steps": t.get("highway") == "steps",
            "widthEvidence": "OSM width" if t.get("width") else "display estimate",
          }
        )
      path_areas.append(g.buffer(width / 2, quad_segs=3).intersection(park))
  for _, r in frames["points"].iterrows():
    if not park.covers(r.geometry):
      continue
    t = tags_for(r)
    p = [round(v, 3) for v in r.geometry.coords[0]]
    id_ = ident(r, "points")
    if id_ in [
      "node/1561640301",
      "node/9255913447",
      "node/9256186730",
      "node/9256186731",
    ]:
      anchors.append({"id": id_, "name": t.get("name", "Kneeling soldier"), "point": p})
    elif t.get("amenity") == "bench":
      benches.append({"id": id_, "point": p})
    elif t.get("natural") == "tree" and new.covers(r.geometry):
      trees.append(
        {
          "id": id_,
          "point": p,
          "height": 11,
          "radius": 3.6,
          "evidence": "OSM anchor, dimensions illustrative",
        }
      )
  # The large pedestrian relation describes the memorial's walkable precinct,
  # not paving over its five mapped grass grave-fields and planted margins.
  lawn_union = unary_union(lawns)
  path_union = unary_union([*path_areas, *[g.difference(lawn_union) for g in surfaces]])
  building_union = unary_union(
    [Polygon(r[0], r[1:]) for b in buildings for r in b["rings"]]
  )
  water_union = unary_union(waters)
  # New park only: old streamed source paths, water and ground remain visible unchanged.
  for kind, geom, color, y, pitch in [
    ("water", water_union, 0x789EA8, -1.15, 4),
    ("path", path_union.difference(building_union), 0xB5AD98, 3.05, 2),
    (
      "park",
      park.difference(unary_union([path_union, water_union, building_union])),
      0x8CA571,
      3.01,
      8,
    ),
  ]:
    geom = geom.intersection(new)
    for poly in polygons(geom):
      if poly.area < 0.01:
        continue
      grounds.append(
        {
          "kind": kind,
          "rings": rings(poly),
          "color": color,
          "y": y,
          "nativeRuns": runs(poly, pitch),
        }
      )
  wood = (
    unary_union(woods)
    .intersection(new)
    .difference(path_union.buffer(4))
    .difference(building_union.buffer(5))
    .difference(water_union.buffer(4))
    .difference(memorial)
  )
  occupied = unary_union([Point(t["point"]).buffer(7) for t in trees])
  for x in range(math.floor(wood.bounds[0] / 17), math.ceil(wood.bounds[2] / 17)):
    for z in range(math.floor(wood.bounds[1] / 17), math.ceil(wood.bounds[3] / 17)):
      p = Point(x * 17 + math.sin(z * 3.1) * 3, z * 17 + math.cos(x * 4.7) * 3)
      if wood.buffer(-4).covers(p) and not occupied.covers(p):
        trees.append(
          {
            "id": "woodland-display",
            "point": [round(p.x, 3), round(p.y, 3)],
            "height": 12,
            "radius": 4,
            "evidence": "illustrative within mapped woodland",
          }
        )
  # Existing full source envelope remains; add masonry division to its exact wall faces.
  old_evidence = json.loads((GEO / "east-landmarks-v187-evidence.json").read_text())
  facades = []
  for owner in old_evidence["owners"]:
    if owner["name"] not in [
      "Schloss Köpenick",
      "Rathaus Köpenick",
      "Stadtkirche St. Laurentius",
    ]:
      continue
    profile = next(p for p in old_evidence["sourceProfiles"] if p["id"] == owner["id"])
    for part in profile["parts"]:
      for face in part["surfaces"]:
        if face["kind"] != "WallSurface":
          continue
        rr = [
          [[p[0], round(p[1] + owner["rigidYOffset"], 3), p[2]] for p in ring]
          for ring in face["rings"]
        ]
        facades.append({"owner": owner["id"], "name": owner["name"], "rings": rr})
  result = {
    "version": "1.0.98",
    "groundDatum": 3,
    "policy": "Additive exact named park, original Köpenick envelopes retained",
    "parkId": "way/4685998",
    "park": [rings(p) for p in polygons(park)],
    "newAreaM2": new.area,
    "memorialId": "way/442879072",
    "memorial": rings(polygons(memorial)[0]),
    "grounds": grounds,
    "paths": paths,
    "cenotaphs": cenotaphs,
    "flags": flags,
    "gates": gates,
    "buildings": buildings,
    "anchors": anchors,
    "benches": benches,
    "trees": trees,
    "facades": facades,
  }
  OUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
  navigation = []
  for owner in [*buildings, *cenotaphs, *flags]:
    if owner["id"] in ["way/44387292", "way/142701801"]:
      # Open ceremonial portals do not become invisible solid gatehouses.
      continue
    ground = 11 if owner["id"] == "way/142701713" else 3
    owner_rings = owner["rings"] if "name" in owner else [owner["rings"]]
    for index, rr in enumerate(owner_rings):
      navigation.append(
        {
          "id": owner["id"] + ":v198:" + str(index),
          "owner": owner["id"],
          "ring": rr[0],
          "holes": rr[1:],
          "groundY": ground,
          "topY": ground + owner["height"],
        }
      )
  (OUT.parent / "eastParksV198Navigation.json").write_text(
    json.dumps(navigation, separators=(",", ":"))
  )
  (OUT.parent / "eastParksV198Water.json").write_text(
    json.dumps(
      [
        {"rings": g["rings"], "nativeRuns": g["nativeRuns"], "y": g["y"]}
        for g in grounds
        if g["kind"] == "water"
      ],
      separators=(",", ":"),
    )
  )
  receipt = {
    "version": "1.0.98",
    "pbf": "berlin-260929.osm.pbf",
    "pbfSha256": json.loads((GEO / "east-landmarks-v187-evidence.json").read_text())[
      "osmSha256"
    ],
    "sourceDate": "2026-09-29",
    "license": "ODbL-1.0; prior Köpenick official source dl-de/zero-2-0",
    "records": source,
    "references": REFERENCES,
    "preserved": {
      name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
      for name in [
        "src/app/src/data/eastLandmarksV187.json",
        "src/app/src/data/eastLandmarksV187Native.json",
        "src/app/src/data/eastLandmarksV187Navigation.json",
      ]
    },
    "estimates": {
      "figureHeight": "13 m district art catalogue; other published sources say 11–12 m; OSM tags 15 m. Preserve source conflict rather than averaging invisibly.",
      "totalMemorialHeight": "30 m district history; mound/pedestal subdivision is illustrative",
      "figures": "procedural silhouette, no sculpture scan or photographic tracing",
      "unmappedWidths": "3 m park paths / 5 m service roads; display only",
      "treeDimensions": "illustrative; exact mapped anchors or within mapped woodland",
    },
    "statistics": {
      "grounds": len(grounds),
      "paths": len(paths),
      "cenotaphs": len(cenotaphs),
      "flags": len(flags),
      "trees": len(trees),
      "benches": len(benches),
      "facadeFaces": len(facades),
    },
  }
  (GEO / "east-parks-v198-evidence.json").write_text(
    json.dumps(receipt, ensure_ascii=False, separators=(",", ":"))
  )
  print(json.dumps(receipt["statistics"]))
  print("payload", OUT.stat().st_size)
  return result


if __name__ == "__main__":
  build()
