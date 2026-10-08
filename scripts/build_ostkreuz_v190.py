"""Step 10: complete OSM roof footprints and open Ostkreuz crossing geometry."""

from __future__ import annotations

import hashlib
import json
import math
from typing import Any

from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import unary_union

from scripts.build_rail_stations_v190 import (
  GEO,
  ROOT,
  features,
  frame,
  ident,
  rings,
  tags,
  world,
)

IDS = {"way/110639235", "way/463652072", "way/1228253162", "way/1228253163"}
PUBLISHED = "https://sbahn.berlin/fileadmin/user_upload/Punkt3/PDF-Archiv/2011/punkt3_2011-03-10.pdf"


def build() -> dict[str, Any]:
  """Retain all original source footprints and separately record estimates."""
  roofs = []
  official = json.loads((GEO / "raw/rail-v190/ostkreuz-lod2.json").read_text())
  platforms = json.loads((ROOT / "src/app/src/data/railStationsV190.json").read_text())[
    "platforms"
  ]
  high_platforms = unary_union(
    [
      Polygon(p["rings"][0], p["rings"][1:])
      for p in platforms
      if p["station"] == "Ostkreuz" and p["y"] > 9
    ]
  )
  for f in features("multipolygons"):
    sid = ident(f)
    if sid not in IDS:
      continue
    geom = world(shape(f["geometry"]))
    for p in geom.geoms if geom.geom_type == "MultiPolygon" else [geom]:
      axis = frame(p)
      is_hall = sid == "way/110639235"
      floor = 12.46 if sid in {"way/110639235", "way/463652072"} else 3.96
      matched = [a for a in official if a["matches"].get(sid, 0) > 100]
      top = (
        max(3 + part["height_m"] for a in matched for part in a["parts"])
        if matched
        else floor + (15 if is_hall else 4.5)
      )
      roof_panels = []
      # Full plan split into eight transverse strips, without simplified edges.
      # The shallow barrel profile is photo informed; not a measured radius.
      for j in range(8 if is_hall else 1):
        low = axis["width"] * (-0.5 + j / 8) if is_hall else -axis["width"]
        high = axis["width"] * (-0.5 + (j + 1) / 8) if is_hall else axis["width"]
        if j == 0:
          low = -300
        if j == (7 if is_hall else 0):
          high = 300

        def q(u: float, v: float) -> tuple[float, float]:
          return axis["x"] + axis["dx"] * u - axis["dz"] * v, axis["z"] + axis[
            "dz"
          ] * u + axis["dx"] * v

        strip = p.intersection(
          Polygon([q(-300, low), q(300, low), q(300, high), q(-300, high)])
        )
        for part in strip.geoms if strip.geom_type == "MultiPolygon" else [strip]:
          if part.geom_type == "Polygon" and not part.is_empty:
            roof_panels.append(rings(part))
      sections = []
      count = 9 if is_hall else max(2, round(axis["length"] / 10))
      for i in range(count + 1):
        u = (-0.49 + 0.98 * i / count) * axis["length"]
        x, z = axis["x"] + axis["dx"] * u, axis["z"] + axis["dz"] * u
        cross = LineString(
          [
            (x - axis["dz"] * 200, z + axis["dx"] * 200),
            (x + axis["dz"] * 200, z - axis["dx"] * 200),
          ]
        ).intersection(p)
        if cross.geom_type != "LineString" or cross.is_empty:
          continue
        sections.append(
          [[round(v, 3) for v in q] for q in [cross.coords[0], cross.coords[-1]]]
        )
      roofs.append(
        dict(
          id=sid,
          rings=rings(p),
          frame=axis,
          floor=floor,
          top=top,
          hall=is_hall,
          sections=sections,
          roofPanels=roof_panels,
          sourceTags=tags(f),
          originalGeometry=f["geometry"],
          heightSource="S-Bahn Berlin punkt3 05/2011 p.10: hall 15 m high"
          if is_hall
          else "official LoD2 relative canopy heights; complete surfaces retained in evidence"
          if matched
          else "illustrative 4.5 m canopy clearance; original source polygons retained",
          officialMatches=[a["id"] for a in matched],
        )
      )
  tracks = []
  scope = Point(6600, 1900).buffer(290)
  for f in features("lines"):
    t = tags(f)
    if t.get("railway") not in {"light_rail", "rail"} or t.get("service"):
      continue
    line = world(shape(f["geometry"]))
    if line.distance(Point(6600, 1900)) > 110:
      continue
    clipped = line.intersection(scope)
    if clipped.is_empty:
      continue
    high = t.get("level") == "1"
    for part in clipped.geoms if clipped.geom_type == "MultiLineString" else [clipped]:
      if part.geom_type != "LineString":
        continue
      points = []
      # Only new interpolation points for grade continuity; source vertices stay.
      cs = list(part.coords)
      for a, b in zip(cs, cs[1:]):
        n = max(1, math.ceil(math.dist(a, b) / 10))
        for i in range(n):
          x, z = (a[j] + (b[j] - a[j]) * i / n for j in range(2))
          lift = (
            max(0, min(1, (170 - high_platforms.distance(Point(x, z))) / 130))
            if high
            else 0
          )
          points.append([round(x, 3), round(3.15 + 8.35 * lift, 3), round(z, 3)])
      x, z = cs[-1]
      lift = (
        max(0, min(1, (170 - high_platforms.distance(Point(x, z))) / 130))
        if high
        else 0
      )
      points.append([round(x, 3), round(3.15 + 8.35 * lift, 3), round(z, 3)])
      tracks.append(
        dict(
          id="way/" + f["properties"]["osm_id"],
          high=high,
          sourceTags=t,
          points=points,
          originalGeometry=f["geometry"],
        )
      )
  lower_tracks = unary_union(
    [LineString([(x, z) for x, _, z in t["points"]]) for t in tracks if not t["high"]]
  )
  lower_platforms = unary_union(
    [
      Polygon(p["rings"][0], p["rings"][1:])
      for p in platforms
      if p["station"] == "Ostkreuz" and p["y"] < 5
    ]
  )
  supports = []
  for roof in roofs:
    if roof["floor"] < 10:
      continue
    for section in roof["sections"][::2]:
      for a, b in [section, section[::-1]]:
        x, z = [a[i] + (b[i] - a[i]) * 0.04 for i in range(2)]
        if (
          lower_tracks.distance(Point(x, z)) > 2.4
          and lower_platforms.distance(Point(x, z)) > 0.9
        ):
          supports.append([round(x, 3), round(z, 3), 3, 11.1, 0.9])
  navigation = []
  for roof in roofs:
    navigation.append(
      dict(
        id=roof["id"] + "-roof",
        rings=roof["rings"],
        minY=roof["top"] - (3.7 if roof["hall"] else 0.2),
        maxY=roof["top"],
      )
    )
    if roof["floor"] > 10:
      navigation.append(
        dict(id=roof["id"] + "-deck", rings=roof["rings"], minY=10.9, maxY=11.1)
      )
  for p in platforms:
    if p["station"] == "Ostkreuz":
      navigation.append(
        dict(id=p["id"] + "-platform", rings=p["rings"], minY=p["y"] - 0.3, maxY=p["y"])
      )
  for i, (x, z, base, top, width) in enumerate(supports):
    half = width / 2
    navigation.append(
      dict(
        id=f"support-{i}",
        rings=[
          [
            [x - half, z - half],
            [x + half, z - half],
            [x + half, z + half],
            [x - half, z + half],
            [x - half, z - half],
          ]
        ],
        minY=base,
        maxY=top,
      )
    )
  return dict(
    schemaVersion=1,
    roofs=roofs,
    tracks=tracks,
    supports=supports,
    navigation=navigation,
    ownerIds=sorted("OSM-" + s.replace("/", "-") for s in IDS),
    sourceUrls=[
      PUBLISHED,
      "https://www.stahlglas.de/referenzen/bahnhof-ostkreuz-berlin-bahnhofshalle/",
    ],
    policy="Exact source footprints; open rail mouths and transparent side glazing replace four closed generic OSM proxies only. Published hall height 15 m above the displayed upper deck. Display grade separation and smooth local transitions, structural subdivisions and materials remain estimates. The pre-existing detailed rail-network payload is unchanged.",
  )


def main() -> None:
  """Write bounded runtime and source evidence, including official lower roofs."""
  data = build()
  (ROOT / "src/app/src/data/ostkreuzV190.json").write_text(
    json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
  )
  path = GEO / "raw/rail-v190/ostkreuz-lod2.json"
  evidence = {
    **data,
    "availableOfficialContext": json.loads(path.read_text()),
    "officialArchive": dict(
      url="https://gdi.berlin.de/data/a_lod2/atom/LoD2_396_5818.zip",
      sha256=hashlib.sha256(
        (GEO / "raw/lod2/LoD2_396_5818.zip").read_bytes()
      ).hexdigest(),
      license="dl-de/zero-2-0",
    ),
    "officialConflict": "The inspected official tile contains lower-platform/service roofs, but no matching continuous Ringbahnhalle roof owner. OSM governs the full hall plan and the operator's published 15 m height governs its upper envelope. All inspected official matching parts remain retained as evidence, not silently treated as a full hall survey.",
  }
  (GEO / "ostkreuz-v190-evidence.json").write_text(
    json.dumps(evidence, ensure_ascii=False, indent=2) + "\n"
  )
  print(len(data["roofs"]), len(data["tracks"]))


if __name__ == "__main__":
  main()
