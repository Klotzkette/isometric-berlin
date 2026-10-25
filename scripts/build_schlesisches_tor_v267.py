"""Bounded Schlesisches Tor source evidence; keep every previous source owner."""

from __future__ import annotations

import gzip
import hashlib
import json
import math
import sys
from pathlib import Path

import pyogrio
from shapely.affinity import affine_transform
from shapely.geometry import LineString, Point, Polygon, box, mapping

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_bebelplatz_building_source import extract_parent, part_profile, world_ring

from isometric_berlin.data.fetch_lod2 import NS

ROOT = Path(__file__).resolve().parents[1]
OWNER = "DEBE02YY400009V1"
REFERENCES = [
  {
    "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031242",
    "author": "Landesdenkmalamt Berlin",
    "claim": "Asymmetric masonry station, red brick and sandstone, separate side-platform roofs; Grisebach & Dinklage, sculptor Heinrich Giesecke.",
  },
  {
    "url": "https://www.uvp-verbund.de/documents-ige-ng/igc_be/D96E3618-90A7-49B5-A3FF-D71D9DEE5284/S_PG_Erlaeuterungsbericht.pdf",
    "author": "Berliner Verkehrsbetriebe, February 2018 planning report, page 3",
    "claim": "Two approximately 110m outside platforms, hipped gabled roofs, northwest/southeast show facades and northeast access. Proposed elevator alternatives are not treated as as-built evidence.",
  },
  {
    "url": "https://www.bvg.de/de/verbindungen/stationsuebersicht/u-schlesisches-tor",
    "author": "Berliner Verkehrsbetriebe",
    "claim": "Current U1/U3 station identity; no timetable or temporary works are modelled.",
  },
  {
    "url": "https://commons.wikimedia.org/wiki/File:Berlin,_Kreuzberg,_Skalitzer_Strasse,_Bahnhof_Schlesisches_Tor.jpg",
    "author": "Jorg Zaegel / Jörg Zägel",
    "date": "2012-05-04",
    "license": "CC-BY-SA-3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
    "referenceImage": "https://upload.wikimedia.org/wikipedia/commons/3/39/Berlin%2C_Kreuzberg%2C_Skalitzer_Strasse%2C_Bahnhof_Schlesisches_Tor.jpg",
    "claim": "First-hand exterior photograph: red hipped roofs, curved west tower roof and pierced crown, paired sandstone portal arches, grouped upper arched windows, dark green steel lattice girders and railings. External reference only; original procedural geometry, no photographic texture.",
  },
]


def digest(path: Path) -> str:
  with path.open("rb") as source:
    return hashlib.file_digest(source, "sha256").hexdigest()


def world(geometry):
  return affine_transform(geometry, [1, 0, 0, -1, -389500, 5820000])


def build(root: Path = ROOT):
  archive = root / "geo_data/regierungsviertel/raw/lod2/LoD2_394_5817.zip"
  parent = extract_parent(archive, OWNER)
  part = part_profile(parent)
  part["all_surfaces"] = [
    {
      "kind": child.tag.split("}")[-1],
      "rings": [world_ring(p) for p in child.findall(".//gml:posList", NS)],
    }
    for bound in parent.findall("bldg:boundedBy", NS)
    for child in bound
  ]
  raw = root / "geo_data/regierungsviertel/raw/outer-v159"
  old = pyogrio.read_dataframe(
    raw / "resolved-outlines.gpkg", layer="buildings", where=f"sourceId='{OWNER}'"
  ).iloc[0]
  outline = {
    key: old[key]
    for key in ("sourceId", "height", "minHeight", "heightSource", "sourceGroundY")
  }
  outline["geometry"] = json.loads(json.dumps(mapping(old.geometry)))
  candidate = raw / "candidate.gpkg"
  tracks, track_evidence = [], []
  for identifier in ["384345627", "384345629"]:
    row = (
      pyogrio.read_dataframe(candidate, layer="lines", where=f"osm_id='{identifier}'")
      .to_crs(25833)
      .iloc[0]
    )
    complete = world(row.geometry)
    clipped = complete.intersection(box(4635, 2105, 4686, 2145))
    assert clipped.geom_type == "LineString" and 40 < clipped.length < 60
    tracks.append(
      {
        "id": identifier,
        "points": [[round(x, 3), round(z, 3)] for x, z in clipped.coords],
      }
    )
    track_evidence.append(
      {
        "id": identifier,
        "tags": row.other_tags,
        "sourceGeometry": mapping(complete),
        "retainedLocalGeometry": mapping(clipped),
      }
    )
  features = []
  for identifier in ["738323475", "49038493", "49038495"]:
    row = (
      pyogrio.read_dataframe(
        candidate, layer="multipolygons", where=f"osm_way_id='{identifier}'"
      )
      .to_crs(25833)
      .iloc[0]
    )
    features.append(
      {
        "id": identifier,
        "tags": row.other_tags,
        "geometry": mapping(world(row.geometry)),
      }
    )
  # Offline clipping retains the exact irregular source plan beneath new roofs.
  direction = [0.893, -0.45]
  norm = math.hypot(*direction)
  direction = [v / norm for v in direction]
  centre = [4709, 2115]

  def point(u, v):
    return [
      centre[0] + direction[0] * u - direction[1] * v,
      centre[1] + direction[1] * u + direction[0] * v,
    ]

  specs = [
    {
      "name": "north-platform-hip",
      "u": -1,
      "v": -7,
      "length": 39,
      "width": 5.8,
      "rise": 3.1,
    },
    {
      "name": "south-platform-hip",
      "u": -2,
      "v": 5.4,
      "length": 36,
      "width": 5.8,
      "rise": 3.1,
    },
    {
      "name": "east-portal-hip",
      "u": 15.4,
      "v": 3.0,
      "length": 12.4,
      "width": 10.4,
      "rise": 3.0,
    },
  ]
  plan = Polygon(part["ring"], part["holes"])
  for spec in specs:
    u, v, length, width = (spec[k] for k in ["u", "v", "length", "width"])
    polygon = Polygon(
      [
        point(u - length / 2, v - width / 2),
        point(u + length / 2, v - width / 2),
        point(u + length / 2, v + width / 2),
        point(u - length / 2, v + width / 2),
      ]
    ).intersection(plan)
    assert polygon.geom_type == "Polygon"
    spec["ring"] = [
      [round(x, 3), round(z, 3)] for x, z in list(polygon.exterior.coords)[:-1]
    ]
    corners = [
      (-length / 2, -width / 2),
      (length / 2, -width / 2),
      (length / 2, width / 2),
      (-length / 2, width / 2),
    ]
    left, right = (-length / 2 + width / 2, 0), (length / 2 - width / 2, 0)
    faces = [
      [corners[0], corners[1], right, left],
      [corners[1], corners[2], right],
      [corners[2], corners[3], left, right],
      [corners[3], corners[0], left],
    ]
    spec["faces"] = []
    for face in faces:
      clipped = Polygon([point(u + a, v + b) for a, b in face]).intersection(plan)
      pieces = [clipped] if clipped.geom_type == "Polygon" else list(clipped.geoms)
      for piece in pieces:
        if piece.geom_type != "Polygon" or piece.area < 0.001:
          continue
        vertices = []
        for x, z in list(piece.exterior.coords)[:-1]:
          uu = (x - centre[0]) * direction[0] + (z - centre[1]) * direction[1] - u
          vv = -(x - centre[0]) * direction[1] + (z - centre[1]) * direction[0] - v
          rise = (
            max(0, min(width / 2 - abs(vv), length / 2 - abs(uu)))
            / (width / 2)
            * spec["rise"]
          )
          vertices.append(
            [round(x, 3), round(3 + old.height + rise + 0.03, 3), round(z, 3)]
          )
        spec["faces"].append(vertices)
  native_packet = json.loads(
    gzip.decompress(
      (
        root / "src/app/public/mesh/surrounding-berlin-v159/9_4.minecraft.json.gz"
      ).read_bytes()
    )
  )
  native_owner = next(
    b for b in native_packet["nav"]["buildings"] if b["sourceId"] == OWNER
  )
  native_ring = [
    [x + native_packet["origin"][0], z + native_packet["origin"][2]]
    for x, z in native_owner["ring"][:-1]
  ]
  # Simplify zero-distance collinear vertices only: the exact supplied stepped
  # native wall planes remain intact, rather than voxelising the smooth facade.
  native_ring = [
    list(p) for p in list(Polygon(native_ring).simplify(0).exterior.coords)[:-1]
  ]
  portal_edges = []
  a, b = part["ring"][51:53]
  for f in [0.25, 0.75]:
    target = Point(a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]))
    candidates = []
    for i, p in enumerate(native_ring):
      q = native_ring[(i + 1) % len(native_ring)]
      edge = LineString([p, q])
      if abs(p[1] - q[1]) < 0.001 and edge.length >= 3.5:
        candidates.append((edge.distance(target), i))
    distance, index = min(candidates)
    assert distance < 1.65
    portal_edges.append(index)
  inputs = [
    raw / "resolved-outlines.gpkg",
    candidate,
    archive,
    root / "src/app/public/mesh/surrounding-berlin-v159/9_4.drawn.json.gz",
    root / "src/app/public/mesh/surrounding-berlin-v159/9_4.minecraft.json.gz",
  ]
  estimates = "Complete original source walls, flat cap, footprints and existing packets remain unchanged. Roof subdivisions, tower profile/height, sandstone fitting dimensions and colours are explicit photo-based display estimates. Display ground Y3 and source parent height10.71 match immutable v159. OSM supplies gauge1.435m and track height6m above display ground. New west viaduct is limited to two mapped tracks x4635..4686; support spacing/member sizes are illustrative. Portal is an exterior recognition detail, not an opened walkable interior. No elevators, new park geometry or coverage are invented."
  evidence = {
    "schema": "schlesisches-tor-v267-evidence/1",
    "checked": "2026-10-25",
    "sourcePart": part,
    "retainedOutline": outline,
    "retainedOsmFeatures": features,
    "tracks": track_evidence,
    "inputSha256": {str(p.relative_to(root)): digest(p) for p in inputs},
    "references": REFERENCES,
    "estimates": estimates,
    "retiredOwners": [],
    "removedTriangles": 0,
    "nativeRetainedOwner": native_owner,
    "nativePortalEdges": portal_edges,
  }
  runtime = {
    "schema": "schlesisches-tor-v267/1",
    "owner": OWNER,
    "ring": part["ring"],
    "holes": part["holes"],
    "nativeRing": native_ring,
    "nativePortalEdges": portal_edges,
    "nativeBaseTopY": 3 + native_owner["height"],
    "groundY": 3,
    "baseTopY": 3 + old.height,
    "centre": centre,
    "direction": direction,
    "roofs": specs,
    "tower": {
      "centre": [4694.8, 2126.0],
      "radius": 4.65,
      "profile": [
        [0, 4.65],
        [0.7, 4.95],
        [1.7, 4.86],
        [3.3, 3.95],
        [4.5, 2.55],
        [5.4, 0.7],
        [5.7, 0.25],
      ],
    },
    "tracks": tracks,
    "estimates": estimates,
  }
  return evidence, runtime


if __name__ == "__main__":
  evidence, runtime = build()
  for path, value in [
    ("geo_data/regierungsviertel/schlesisches-tor-v267-evidence.json", evidence),
    ("src/app/src/data/schlesischesTorV267.json", runtime),
  ]:
    target = ROOT / path
    target.write_text(
      json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n"
    )
    print(f"{path}: {target.stat().st_size} bytes")
