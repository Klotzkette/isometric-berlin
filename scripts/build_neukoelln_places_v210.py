"""Bounded current Karstadt, Richardplatz source shells and mapped place furniture.

Retains all source rings/sheets; never edits an old packet or historical data.
"""

from __future__ import annotations

import base64
import json
import math
from pathlib import Path

import numpy as np
import pyogrio
from build_bebelplatz_building_source import extract_parent, part_profile
from build_breitscheid_towers_v161 import triangles_for
from build_district_facades_v188 import digest, read_json, world, write_json
from build_karl_marx_allee_v161 import mesh_signature
from build_panorama_facade_v202 import fingerprint
from build_steglitz_v182 import native_blocks
from build_surrounding_outlines import chunk_payload, load_projected_polygon, tags_for
from integrate_city_refinements_v166 import line_signature
from shapely.geometry import Point, Polygon, box, mapping, shape

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "neukoelln-places-v210-source.json"
TARGETS = {
  "DEBE02YY40001IT3": (
    "karstadt",
    "Galeria / Karstadt Hermannplatz",
    "LoD2_392_5816.zip",
    ["24315001", "26824425"],
  ),
  "DEBE08YYF000005L": (
    "church",
    "Bethlehemskirche Richardplatz",
    "LoD2_394_5814.zip",
    ["47023388"],
  ),
  "DEBE08YYF00005wd": (
    "smithy",
    "Rixdorfer Schmiede west workshop",
    "LoD2_394_5814.zip",
    ["334062969"],
  ),
  "DEBE08YYF00006o6": (
    "smithy",
    "Rixdorfer Schmiede coal shed",
    "LoD2_394_5814.zip",
    ["334062957"],
  ),
  "DEBE08YYF00003et": (
    "smithy",
    "Rixdorfer Schmiede house",
    "LoD2_394_5814.zip",
    ["88382458"],
  ),
  "DEBE08YYF00008Fc": (
    "smithy",
    "Rixdorfer Schmiede east workshop",
    "LoD2_394_5814.zip",
    ["334062967"],
  ),
}


def extract():
  ids = [i for *_, osm in TARGETS.values() for i in osm]
  a = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    where="osm_way_id IN (" + ",".join(repr(i) for i in ids) + ")",
  ).to_crs(25833)
  buildings = []
  for pid, (site, name, tile, osm) in TARGETS.items():
    path = GEO / "raw/lod2" / tile
    parent = extract_parent(path, pid)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    buildings.append(
      {
        "id": pid,
        "site": site,
        "name": name,
        "parts": parts,
        "sourceGroundY": min(p["ground_y_m"] for p in parts),
        "sourceUrl": "https://gdi.berlin.de/data/a_lod2/atom/" + tile,
        "sourceSha256": digest(path),
        "sourceLicense": "dl-de/zero-2-0",
        "osmOwners": [
          {
            "id": "OSM-way-" + i,
            "geometry": mapping(world(a[a.osm_way_id == i].iloc[0].geometry)),
            "tags": tags_for(a[a.osm_way_id == i].iloc[0]),
          }
          for i in osm
        ],
      }
    )
  places = []
  for key, where in [
    ("hermannplatz", "osm_id = '6888246'"),
    ("richardplatz", "osm_way_id = '1267038130'"),
  ]:
    r = (
      pyogrio.read_dataframe(
        GEO / "raw/outer-v159/candidate.gpkg", layer="multipolygons", where=where
      )
      .to_crs(25833)
      .iloc[0]
    )
    places.append(
      {
        "key": key,
        "id": ("relation/" if key == "hermannplatz" else "way/")
        + ("6888246" if key == "hermannplatz" else "1267038130"),
        "geometry": mapping(world(r.geometry)),
        "tags": tags_for(r),
      }
    )
  points = []
  for bbox in [(13.422, 52.486, 13.426, 52.489), (13.442, 52.4735, 13.448, 52.475)]:
    frame = pyogrio.read_dataframe(
      GEO / "raw/outer-v159/berlin-260929.osm.pbf", layer="points", bbox=bbox
    ).to_crs(25833)
    for _, r in frame.iterrows():
      t = tags_for(r)
      g = world(r.geometry)
      place = next(
        (s for s in places if shape(s["geometry"]).buffer(1).covers(g)), None
      )
      if not place or t.get("amenity") not in {
        "bench",
        "waste_basket",
        "drinking_water",
      }:
        continue
      if (
        t.get("amenity") == "bench"
        and not t.get("direction", "").replace(".", "", 1).isdigit()
      ):
        continue
      if t.get("level", "0") not in ["0", ""] or t.get("access", "yes") == "private":
        continue
      points.append(
        {
          "id": "node/" + str(r.osm_id),
          "site": place["key"],
          "position": [round(g.x, 3), round(g.y, 3)],
          "tags": t,
        }
      )
  source = {
    "schemaVersion": 1,
    "buildings": buildings,
    "places": places,
    "furniture": points,
    "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmLicense": "ODbL-1.0",
    "factualReferences": [
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031163",
      "https://www.galeria.de/filialen/l/berlin/hermannplatz-5-10/001101",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090415",
      "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090419",
      "https://www.berlin.de/tourismus-neukoelln/entdecken/artikel.1152599.php",
    ],
    "visualReferences": [
      {
        "title": "Berlin, Kreuzberg, Hasenheide 1-6, Karstadt.jpg",
        "pageUrl": "https://commons.wikimedia.org/wiki/File:Berlin,_Kreuzberg,_Hasenheide_1-6,_Karstadt.jpg",
        "author": "Jörg Zägel",
        "date": "2011-03-24",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "use": "External reference for extant postwar limestone window courses, lower glazing, central glass frontage and retained vertical Hasenheide wing. No image pixels/signs/advertisements reproduced.",
      },
      {
        "title": "Richardplatz 28 1.jpg",
        "pageUrl": "https://commons.wikimedia.org/wiki/File:Richardplatz_28_1.jpg",
        "author": "Frank schubert",
        "date": "2012-01-25",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "use": "External reference for cream smithy walls, terracotta roofs, house shutters and workshop windows. No image pixels reproduced.",
      },
      {
        "title": "Richardplatz 22 1.JPG",
        "pageUrl": "https://commons.wikimedia.org/wiki/File:Richardplatz_22_1.JPG",
        "author": "Frank schubert",
        "date": "2012-01-25",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "use": "External reference for cream church hall, slate tower, red tile roof and clock placement. No image pixels reproduced.",
      },
      {
        "title": "Evangelische Bethlehemskirche (Rixdorfer Dorfkirche) am Richardplatz in Berlin-Neukölln.jpg",
        "pageUrl": "https://commons.wikimedia.org/wiki/File:Evangelische_Bethlehemskirche_(Rixdorfer_Dorfkirche)_am_Richardplatz_in_Berlin-Neuk%C3%B6lln.jpg",
        "author": "Neuköllner",
        "date": "2020-07-19",
        "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        "use": "External reference for clock, belfry louvres and small spire. Heavily tinted photo not used for colour sampling.",
      },
    ],
    "policy": "All LoD2 wall/roof sheets, rings, holes and part offsets retained. Heights/source footprint are measured; openings, colours, clock and furniture dimensions are explicit recognition estimates from dated permitted references, not a 2026 survey. Current low postwar store only: no prewar twin towers or future rebuilding. Public furniture only mapped at-grade points within exact public-place polygons. No linear road marking, kerb or blanket plaza overlay. Old v185 profiles remain, except one exact mistaken church cornice is transferred to the source eave with complete original receipt. Garage and open smithy canopy remain their old owners.",
  }
  a = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/candidate.gpkg",
    layer="multipolygons",
    where="osm_way_id IN ('964322061','964322037')",
  ).to_crs(25833)
  source["bicycleParking"] = [
    {
      "id": "way/" + str(r.osm_way_id),
      "geometry": mapping(world(r.geometry)),
      "tags": tags_for(r),
      "site": "hermannplatz",
    }
    for _, r in a.iterrows()
  ]
  source["churchBelfryEstimate"] = {
    "positionXZ": [5060.45, 5091.38],
    "footprintSize": [4.2, 4.2],
    "bottomY": 12.3,
    "wallTopY": 19.8,
    "roofPeakY": 21.7,
    "status": "Unsurveyed recognition estimate within original church footprint; all measured roof sheets retained.",
  }
  add_sculpture_evidence(source)
  write_json(SOURCE, source)
  return source


def add_sculpture_evidence(source):
  source["sculpture"] = {
    "id": "node/1555473622",
    "name": "Das tanzende Paar",
    "position": [3543.19, 3617.44],
    "artist": "Joachim Schmettau",
    "date": "1985",
    "status": "Mapped placement. Pedestal and gilded pair silhouette are simplified recognition estimates, no inscriptions, faces, relief or rotation reproduced.",
  }
  ref = "https://bildhauerei-in-berlin.de/bildwerk/tanzendes-paar-6645/"
  if ref not in source["factualReferences"]:
    source["factualReferences"].append(ref)
  title = "Hermannplatz3 Berlin Neukoelln.JPG"
  if not any(r["title"] == title for r in source["visualReferences"]):
    source["visualReferences"].append(
      {
        "title": title,
        "pageUrl": "https://commons.wikimedia.org/wiki/File:Hermannplatz3_Berlin_Neukoelln.JPG",
        "author": "Lienhard Schulz",
        "date": "2005-11",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "use": "External reference for the mapped sculpture pedestal and gilded dancing-pair silhouette; highly simplified procedural estimate, no photographic pixels or inscriptions reproduced.",
      }
    )


def ownership(source, nav):
  ids = {o["id"]: b["id"] for b in source["buildings"] for o in b["osmOwners"]}
  selected = pyogrio.read_dataframe(
    GEO / "raw/ring-v182/resolved-outlines.gpkg",
    layer="buildings",
    where="sourceId IN (" + ",".join(repr(i) for i in ids) + ")",
  ).to_dict("records")
  assert {r["sourceId"] for r in selected} == set(ids)
  scope = world(
    load_projected_polygon(GEO / "bounds-ring-v182.geojson").difference(
      load_projected_polygon(GEO / "bounds.geojson")
    )
  )
  records = []
  lines = []
  navigation = []
  for desc in read_json(OUT / "manifest.json")["chunks"]:
    if desc.get("detailCompanionOf") or not desc["id"].startswith("ring"):
      continue
    tile = box(*desc["bounds"])
    owned = [r for r in selected if r["geometry"].intersects(tile)]
    if not owned:
      continue
    for mode in ["drawn", "minecraft"]:
      path = OUT / desc[mode]["url"]
      payload = read_json(path)
      for owner in owned:
        sourceid = owner["sourceId"]
        matching = [r for r in payload["nav"]["buildings"] if r["sourceId"] == sourceid]
        if not matching:
          continue
        for row in matching:
          navigation.append(
            {
              "tile": desc["id"],
              "mode": mode,
              "owner": sourceid,
              "groundY": payload["nav"]["groundY"],
              "original": row,
              "replacementOwners": [ids[sourceid]],
            }
          )
        full = chunk_payload(
          desc["id"],
          tile,
          scope.intersection(tile),
          [owner],
          {},
          minecraft=mode == "minecraft",
        )
        empty = chunk_payload(
          desc["id"],
          tile,
          scope.intersection(tile),
          [],
          {},
          minecraft=mode == "minecraft",
        )
        expected = mesh_signature(full) - mesh_signature(empty)
        assert not expected - mesh_signature(payload), sourceid
        for mesh in payload["meshes"]:
          if mesh["kind"] != "city":
            continue
          v = np.column_stack(
            [
              np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
              np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
            ]
          )
          ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
          removed = []
          for i, t in enumerate(v[ix]):
            key = b"".join(sorted(p.tobytes() for p in t))
            if expected[key]:
              expected[key] -= 1
              removed.append(i)
          if removed:
            records.append(
              {
                "tile": desc["id"],
                "mode": mode,
                "kind": "city",
                "owner": sourceid,
                "sha256": digest(path),
                "fingerprint": fingerprint(
                  [mesh[k] for k in ["positions", "colors", "indices"]]
                ),
                "triangles": removed,
              }
            )
        assert not +expected
        if mode == "drawn" and payload.get("lines"):
          expected = line_signature(full["lines"]) - line_signature(empty["lines"])
          mesh = payload["lines"]
          v = np.column_stack(
            [
              np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3),
              np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3),
            ]
          ).reshape(-1, 2, 6)
          removed = []
          for i, t in enumerate(v):
            key = b"".join(sorted(p.tobytes() for p in t))
            if expected[key]:
              expected[key] -= 1
              removed.append(i)
          assert not +expected
          if removed:
            lines.append(
              {
                "tile": desc["id"],
                "mode": mode,
                "owner": sourceid,
                "sha256": digest(path),
                "fingerprint": fingerprint([mesh[k] for k in ["positions", "colors"]]),
                "segments": removed,
              }
            )
  assert {r["owner"] for r in records} == set(ids)
  legacy = []
  for mode, name, index, count in [
    ("drawn", "southKiezV185.json", 2557, 3),
    ("minecraft", "southKiezV185Native.json", 9232, 18),
  ]:
    old = read_json(DATA / name)["nativeRows" if mode == "minecraft" else "boxes"]
    # Exact index/range confirmed by v185 evidence; preserve remaining two profiles.
    legacy.append(
      {
        "mode": mode,
        "file": name,
        "sourceSha256": digest(DATA / name),
        "first": index,
        "original": old[index : index + count],
        "owner": "OSM-way-47023388",
        "replacement": [
          row[:1]
          + [(11.02 if mode == "drawn" else 11.5) if row[1] > 20 else row[1]]
          + row[2:]
          for row in old[index : index + count]
        ],
        "reason": "Former25m OSM church prism cornice. Move exact source-frontage strip to the measured low hall eave; no other v185 geometry changes.",
      }
    )
  return {
    "schemaVersion": 1,
    "sourceSha256": digest(SOURCE),
    "records": records,
    "lineRecords": lines,
    "navigationRecords": navigation,
    "legacyDetailRecords": legacy,
    "coarseOwners": [
      {
        k: (mapping(v) if k == "geometry" else v)
        for k, v in r.items()
        if k in ["sourceId", "height", "minHeight", "heightSource", "geometry"]
      }
      for r in selected
    ],
  }


def build():
  source = read_json(SOURCE) if SOURCE.exists() else extract()
  add_sculpture_evidence(source)
  write_json(SOURCE, source)
  surfaces = []
  boxes = []
  native_offsets = []
  owners = []
  navigation = []
  faces = []
  allparts = [
    (b, p, Polygon(p["ring"], p["holes"]))
    for b in source["buildings"]
    for p in b["parts"]
  ]
  lows = {b["id"]: b["sourceGroundY"] for b in source["buildings"]}
  # Keep all four forge members on their original common source ground datum.
  forge = min(b["sourceGroundY"] for b in source["buildings"] if b["site"] == "smithy")
  lows.update({b["id"]: forge for b in source["buildings"] if b["site"] == "smithy"})

  def emit(x, y, z, w, h, d, yaw, color, role, owner, native_normal=(0, 0)):
    boxes.append(
      [*[round(float(v), 4) for v in [x, y, z, w, h, d, yaw]], color, role, owner]
    )

    native_offsets.append(native_normal)

  for oi, b in enumerate(source["buildings"]):
    low = lows[b["id"]]
    owners.append(
      {
        "id": b["id"],
        "site": b["site"],
        "name": b["name"],
        "sourceGroundY": low,
        "osmOwners": [o["id"] for o in b["osmOwners"]],
      }
    )
    for p in b["parts"]:
      footprint = Polygon(p["ring"], p["holes"])
      top = p["top_y_m"] - low + 3
      navigation.append(
        {
          "id": p["id"],
          "owner": b["id"],
          "ring": p["ring"],
          "holes": p["holes"],
          "low": 3 + p["ground_y_m"] - low,
          "high": top,
        }
      )
      for si, s in enumerate(p["surfaces"]):
        rings = [
          [[v[0], round(v[1] - low + 3, 3), v[2]] for v in ring] for ring in s["rings"]
        ]
        n = sum(
          (np.cross(a, c) for a, c in zip(rings[0], rings[0][1:] + rings[0][:1])),
          np.zeros(3),
        )
        if np.linalg.norm(n) < 1e-7:
          continue
        color = 0xB3B2A9 if b["site"] == "karstadt" else 0xE1D8BC
        if s["kind"] == "RoofSurface":
          color = 0x777F7F if b["site"] == "karstadt" else 0x9B523C
        # The source divides the church roof into strips; none is a surveyed tower.
        surfaces.append(
          {
            "owner": oi,
            "part": p["id"],
            "surface": si,
            "kind": s["kind"],
            "triangles": triangles_for(rings),
            "color": color,
          }
        )
        if s["kind"] != "WallSurface":
          continue
        horizontal = [
          (a, c)
          for a, c in zip(rings[0], rings[0][1:] + rings[0][:1])
          if abs(a[1] - c[1]) < 0.03
        ]
        if not horizontal:
          continue
        a, c = max(horizontal, key=lambda q: math.dist(q[0], q[1]))
        av = np.array([a[0], a[2]])
        cv = np.array([c[0], c[2]])
        width = float(np.linalg.norm(cv - av))
        if width < 2.5:
          continue
        direction = (cv - av) / width
        normal = np.array([-direction[1], direction[0]])
        if footprint.covers(Point(*(av + cv) / 2 + normal * 0.12)):
          normal = -normal
        middle = (av + cv) / 2 + normal * 0.22
        neighbors = [
          q["top_y_m"] - lows[bb["id"]] + 3
          for bb, q, g in allparts
          if q["id"] != p["id"] and g.covers(Point(*middle))
        ]
        bottom = max(min(v[1] for v in rings[0]), max(neighbors, default=3))
        upper = max(v[1] for v in rings[0])
        yaw = math.atan2(-direction[1], direction[0])
        if upper - bottom < 1.1:
          continue
        plane = Polygon(
          [[(np.array([v[0], v[2]]) - av).dot(direction), v[1]] for v in rings[0]]
        )
        if not plane.is_valid:
          plane = plane.buffer(0)

        def panel(u, y, w, h, d, color, role, offset=0.08):
          if not plane.buffer(0.001).covers(
            box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
          ):
            return
          if y - h / 2 < bottom + 0.02:
            return
          pt = av + direction * u + normal * offset
          emit(pt[0], y, pt[1], w, h, d, yaw, color, role, b["id"], normal)

        faces.append(
          {
            "owner": b["id"],
            "part": p["id"],
            "a": list(av),
            "b": list(cv),
            "bottom": bottom,
            "top": upper,
            "normal": list(normal),
          }
        )
        if b["site"] == "karstadt":
          # Only street-exposed frontage, original Hasenheide section and Urbanstr.
          # Back/service and roof plant walls receive trim only, never fake windows.
          facing = (
            normal.dot(np.array([3546, 3610]) - (av + cv) / 2) > 0 and normal[0] > 0.5
          )
          south = normal[1] > 0.55 and (av[1] + cv[1]) / 2 > 3610
          north = normal[1] < -0.55 and (av[1] + cv[1]) / 2 < 3560
          historic = (av[0] + cv[0]) / 2 < 3452 and south
          if not (facing or south or north):
            continue
          central = facing and 3565 < (av[1] + cv[1]) / 2 < 3633
          if central:
            for y in np.arange(max(bottom + 1.1, 4.5), min(upper - 0.5, 22), 2.35):
              count = max(1, int(width / 2.05))
              for i in range(count):
                u = width * (i + 0.5) / count
                panel(
                  u,
                  y,
                  min(1.76, width / count - 0.15),
                  1.95,
                  0.11,
                  0x53747B,
                  "store-central-glass",
                )
                panel(
                  u,
                  y,
                  min(1.76, width / count - 0.15),
                  0.065,
                  0.16,
                  0xA9B6B6,
                  "store-glass-transom",
                  0.13,
                )
          else:
            rows = (
              [5.2, 8.0, 12.3, 16.0] if not historic else [5.5, 10, 14.5, 19, 23.5, 28]
            )
            count = max(1, int(width / (3.05 if not historic else 3.2)))
            for y in rows:
              for i in range(count):
                u = width * (i + 0.5) / count
                w = min(1.55, width / count * 0.65)
                panel(u, y, w, 2.2 if y > 10 else 2.4, 0.10, 0x567078, "store-window")
                panel(
                  u, y + 0.78, w + 0.18, 0.085, 0.16, 0xD3D1C1, "store-lintel", 0.13
                )
                panel(u, y - 1.17, w + 0.2, 0.13, 0.18, 0xD3D1C1, "store-sill", 0.15)
            for y in [9.3, 18.05] if not historic else [5, 29.8]:
              panel(
                width / 2,
                y,
                width - 0.15,
                0.18,
                0.22,
                0xCFCCBD,
                "store-horizontal-course",
                0.14,
              )
            if historic:
              for i in range(1, count):
                panel(
                  width * i / count,
                  (bottom + upper) / 2,
                  0.20,
                  upper - bottom - 0.3,
                  0.28,
                  0xD1CDBB,
                  "historic-vertical-pier",
                  0.17,
                )
        elif b["site"] == "smithy":
          if neighbors:
            continue
          for y in [3.45, upper - 0.45]:
            panel(
              width / 2,
              y,
              width - 0.12,
              0.13,
              0.17,
              0xB9B7A6,
              "smithy-plinth-eave",
              0.1,
            )
          if p["id"] == "DEBE08YYF00006o6":
            continue
          count = max(1, int(width / 3.2))
          house = p["id"] == "DEBE08YYF00003et"
          y = 5.3 if house else 4.8
          for i in range(count):
            u = width * (i + 0.5) / count
            panel(u, y, 0.8, 1.75 if house else 1.15, 0.10, 0x45524F, "smithy-window")
            panel(
              u, y, 0.06, 1.7 if house else 1.12, 0.14, 0xDCD8C6, "smithy-mullion", 0.13
            )
            panel(u, y, 0.78, 0.06, 0.14, 0xDCD8C6, "smithy-transom", 0.13)
            if house:
              for dx in [-0.58, 0.58]:
                panel(
                  u + dx, y, 0.30, 1.8, 0.15, 0x385446, "smithy-green-shutter", 0.12
                )
        else:
          if neighbors:
            continue
          tower = False
          if tower:
            y = min(upper - 2.0, 13.3)
            panel(width / 2, y, 1.5, 1.5, 0.13, 0xD7C481, "church-clock-surround", 0.13)
            panel(width / 2, y, 1.22, 1.22, 0.16, 0x38494C, "church-clock-face", 0.22)
            panel(
              width / 2, y + 0.2, 0.065, 0.47, 0.2, 0xE3D6A9, "church-clock-hand", 0.32
            )
            panel(
              width / 2 + 0.20, y, 0.45, 0.065, 0.2, 0xE3D6A9, "church-clock-hand", 0.32
            )
            for dy in [-0.7, -0.45, -0.2, 0.05, 0.3, 0.55]:
              panel(
                width / 2,
                9.5 + dy,
                1.0,
                0.10,
                0.15,
                0x303B3C,
                "church-belfry-louvre",
                0.13,
              )
          else:
            count = max(1, int(width / 4.5))
            for i in range(count):
              u = width * (i + 0.5) / count
              panel(u, 5.4, 0.85, 1.5, 0.1, 0x677B7C, "church-window")
              panel(u, 5.4, 0.06, 1.48, 0.14, 0xE6E1CA, "church-window-mullion", 0.14)
              panel(u, 5.4, 0.83, 0.06, 0.14, 0xE6E1CA, "church-window-transom", 0.14)
  # Dated free exterior photos show the small west belfry omitted by LoD2.
  # Explicit recognition estimate; measured source walls/roofs remain untouched.
  church = next(b for b in source["buildings"] if b["site"] == "church")
  oi = next(i for i, b in enumerate(source["buildings"]) if b["site"] == "church")
  cx, cz = 5060.45, 5091.38
  tower_ring = [
    [cx - 2.1, cz - 2.1],
    [cx + 2.1, cz - 2.1],
    [cx + 2.1, cz + 2.1],
    [cx - 2.1, cz + 2.1],
  ]
  for a, b in zip(tower_ring, tower_ring[1:] + tower_ring[:1]):
    quad = [
      [a[0], 12.3, a[1]],
      [b[0], 12.3, b[1]],
      [b[0], 19.8, b[1]],
      [a[0], 19.8, a[1]],
    ]
    surfaces.append(
      {
        "owner": oi,
        "part": "estimated-west-belfry",
        "surface": -1,
        "kind": "WallSurface",
        "triangles": triangles_for([quad]),
        "color": 0x646D70,
        "estimate": True,
      }
    )
    roof = [
      [a[0] - 0.12 * (cx - a[0]), 19.8, a[1] - 0.12 * (cz - a[1])],
      [b[0] - 0.12 * (cx - b[0]), 19.8, b[1] - 0.12 * (cz - b[1])],
      [cx, 21.7, cz],
    ]
    surfaces.append(
      {
        "owner": oi,
        "part": "estimated-west-belfry",
        "surface": -1,
        "kind": "RoofSurface",
        "triangles": [roof],
        "color": 0x5B666B,
        "estimate": True,
      }
    )
    av, cv = np.array(a), np.array(b)
    direction = (cv - av) / np.linalg.norm(cv - av)
    normal = np.array([direction[1], -direction[0]])
    mid = (av + cv) / 2
    angle = math.atan2(-direction[1], direction[0])
    for y, w, h, d, col, role in [
      (17.8, 1.65, 1.65, 0.12, 0xD7C481, "church-clock-surround"),
      (17.8, 1.4, 1.4, 0.14, 0x38494C, "church-clock-face"),
      (17.98, 0.065, 0.48, 0.18, 0xE3D6A9, "church-clock-hand"),
      (17.8, 0.45, 0.065, 0.19, 0xE3D6A9, "church-clock-hand"),
    ]:
      pt = mid + normal * (0.1 + d)
      emit(pt[0], y, pt[1], w, h, d, angle, col, role, church["id"], normal)
    for y in np.arange(14.2, 15.8, 0.25):
      pt = mid + normal * 0.12
      emit(
        pt[0],
        y,
        pt[1],
        1.05,
        0.10,
        0.16,
        angle,
        0x303B3C,
        "church-belfry-louvre",
        church["id"],
        normal,
      )
  navigation.append(
    {
      "id": "estimated-west-belfry",
      "owner": church["id"],
      "ring": tower_ring,
      "holes": [],
      "low": 12.3,
      "high": 21.7,
      "estimate": True,
    }
  )
  for item in source["furniture"]:
    x, z = item["position"]
    tags = item["tags"]
    owner = item["id"]
    kind = tags["amenity"]
    if kind == "bench":
      yaw = math.radians(-float(tags["direction"]))
      c, s = math.cos(yaw), math.sin(yaw)
      w = min(2.5, max(1.65, int(tags.get("seats", "3")) * 0.5))
      emit(x, 3.46, z, w, 0.11, 0.45, yaw, 0x8D7961, "mapped-bench-seat", owner)
      for u in [-w * 0.35, w * 0.35]:
        emit(
          x + c * u,
          3.22,
          z - s * u,
          0.1,
          0.44,
          0.38,
          yaw,
          0x485250,
          "mapped-bench-leg",
          owner,
        )
      if tags.get("backrest") == "yes":
        emit(
          x + s * 0.19,
          3.80,
          z + c * 0.19,
          w,
          0.43,
          0.085,
          yaw,
          0x8D7961,
          "mapped-bench-back",
          owner,
        )
    elif kind == "waste_basket":
      emit(
        x,
        3.57,
        z,
        0.38,
        1.05,
        0.38,
        0,
        0xB97333 if tags.get("colour") == "orange" else 0x606663,
        "mapped-bin",
        owner,
      )
    else:
      emit(x, 3.57, z, 0.23, 1.14, 0.23, 0, 0x5B7F88, "mapped-drinking-fountain", owner)
      emit(
        x, 4.12, z, 0.42, 0.12, 0.34, 0, 0x8AA2A5, "mapped-drinking-fountain-top", owner
      )
  # Two mapped stands areas: capacity means two bicycles per U-shaped stand.
  for parking in source["bicycleParking"]:
    poly = shape(parking["geometry"])
    rect = poly.minimum_rotated_rectangle
    ring = list(rect.exterior.coords)
    a, b = max(zip(ring, ring[1:]), key=lambda q: math.dist(*q))
    direction = (np.array(b) - np.array(a)) / math.dist(a, b)
    normal = np.array([-direction[1], direction[0]])
    center = np.array([poly.centroid.x, poly.centroid.y])
    length = math.dist(a, b)
    count = int(parking["tags"]["capacity"]) // 2
    yaw = math.atan2(-normal[1], normal[0])
    for i in range(count):
      p = center + direction * (length * 0.85 * ((i + 0.5) / count - 0.5))
      for u in [-0.35, 0.35]:
        pt = p + normal * u
        emit(
          pt[0],
          3.44,
          pt[1],
          0.075,
          0.88,
          0.075,
          0,
          0x626E70,
          "mapped-bike-stand-leg",
          parking["id"],
        )
      emit(
        p[0],
        3.87,
        p[1],
        0.78,
        0.075,
        0.075,
        yaw,
        0x626E70,
        "mapped-bike-stand-top",
        parking["id"],
      )
  # Fixed simplified recognition of the mapped 1985 pair; no invented lettering.
  x, z = source["sculpture"]["position"]
  owner = source["sculpture"]["id"]
  for y, w, h, d, col, role in [
    (3.13, 2.4, 0.26, 2.4, 0xB8AF89, "sculpture-base"),
    (4.22, 1.48, 1.94, 1.48, 0x9A9671, "sculpture-brick-pedestal"),
    (5.72, 1.30, 1.06, 1.30, 0x9C9D91, "sculpture-upper-pedestal"),
    (6.57, 0.88, 0.64, 0.88, 0x9E9D84, "sculpture-column"),
  ]:
    emit(x, y, z, w, h, d, 0, col, role, owner)
  for side in [-1, 1]:
    cx = x + side * 0.30
    for y, dx, w, h, d in [
      (7.0, -side * 0.05, 0.17, 0.75, 0.18),
      (7.58, side * 0.08, 0.26, 0.65, 0.25),
      (8.10, side * 0.08, 0.26, 0.32, 0.26),
      (7.72, side * 0.30, 0.55, 0.12, 0.14),
      (8.02, side * 0.53, 0.12, 0.52, 0.14),
    ]:
      emit(
        cx + dx,
        y,
        z + side * 0.1,
        w,
        h,
        d,
        side * 0.22,
        0xB5A354,
        "sculpture-gilded-pair",
        owner,
      )
  shell = native_blocks({"surfaces": surfaces, "boxes": [], "rods": []})
  native = []
  for r, normal in zip(boxes, native_offsets, strict=True):
    x, y, z, w, h, d, yaw, col, role, owner = r
    # Orthogonal facade accents clear the one-metre sampled shell skin.
    x += normal[0] * 1.05
    z += normal[1] * 1.05
    count = max(1, math.ceil(w / 0.75))
    c, s = math.cos(yaw), math.sin(yaw)
    for i in range(count):
      u = w * ((i + 0.5) / count - 0.5)
      native.append(
        [
          round(x + c * u, 4),
          y,
          round(z - s * u, 4),
          round(max(0.13, abs(c) * w / count + abs(s) * d), 4),
          h,
          round(max(0.13, abs(s) * w / count + abs(c) * d), 4),
          col,
          role,
          owner,
        ]
      )
  runtime = {
    "schemaVersion": 1,
    "owners": owners,
    "surfaces": surfaces,
    "shellBlocks": shell,
    "boxes": boxes,
    "blocks": native,
  }
  write_json(DATA / "neukoellnPlacesV210.json", runtime)
  nav = {
    "owners": navigation,
    "roofTriangles": [
      t for s in surfaces if s["kind"] == "RoofSurface" for t in s["triangles"]
    ],
    "bounds": [[3420, 3470, 3557, 3665], [4944, 5077, 5085, 5096]],
  }
  write_json(DATA / "neukoellnPlacesV210Navigation.json", nav)
  receipt = ownership(source, nav)
  write_json(DATA / "neukoellnPlacesV210Ownership.json", receipt)
  evidence = {
    "sourceSha256": digest(SOURCE),
    "owners": len(owners),
    "parts": len(navigation),
    "surfaces": len(surfaces),
    "triangles": sum(len(s["triangles"]) for s in surfaces),
    "nativeShellRuns": len(shell),
    "boxes": len(boxes),
    "nativeDetailBlocks": len(native),
    "mappedFurnitureCount": len(source["furniture"]),
    "faces": faces,
    "transferOwners": sorted({r["owner"] for r in receipt["records"]}),
    "transferTriangles": sum(len(r["triangles"]) for r in receipt["records"]),
    "transferInkSegments": sum(len(r["segments"]) for r in receipt["lineRecords"]),
    "runtimeBytes": (DATA / "neukoellnPlacesV210.json").stat().st_size,
    "policy": source["policy"],
  }
  write_json(GEO / "neukoelln-places-v210-evidence.json", evidence)
  write_json(
    ROOT / "docs/neukoelln-places-v210-credits.json",
    {
      "sources": source["visualReferences"],
      "factualReferences": source["factualReferences"],
    },
  )
  print(
    json.dumps(
      {k: v for k, v in evidence.items() if k not in ["faces", "policy"]}, indent=2
    )
  )
  return runtime


if __name__ == "__main__":
  build()
