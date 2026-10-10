"""Step 10: three exact Helmholtzplatz owners, one documented height conflict.

Old city packet bytes remain immutable. Fingerprinted triangle/line receipts
transfer only these owners into a tiny required drawn/native model.
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
from build_surrounding_outlines import chunk_payload, load_projected_polygon
from integrate_city_refinements_v166 import line_signature
from shapely.geometry import Point, Polygon, box, mapping

from isometric_berlin.data.fetch_lod2 import leaf_building_parts

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "helmholtz-sites-v209-source.json"
OWNERS = {
  "DEBE03YY60001rGC": ("Kiezkind / former transformer house", "35605731"),
  "DEBE03YY6000002o": ("Kiezkind / former transformer house", "35605731"),
  "DEBE03YY60000DEJ": ("Platzhaus / neighbourhood house", "35605732"),
}
PLATZHAUS = "DEBE03YY60000DEJ"
CORRECTED_HEIGHT = 3.4


def extract() -> dict:
  """Retain all original sheets independently of the explicit height decision."""
  path = GEO / "raw/lod2/LoD2_392_5822.zip"
  areas = pyogrio.read_dataframe(
    GEO / "raw/north-city-v190/candidate.gpkg",
    layer="multipolygons",
    where="osm_way_id IN ('35605731','35605732')",
  ).to_crs(25833)
  buildings = []
  for pid, (name, osm) in OWNERS.items():
    parent = extract_parent(path, pid)
    parts = [part_profile(p) for p in leaf_building_parts(parent) or [parent]]
    row = areas[areas.osm_way_id == osm].iloc[0]
    buildings.append(
      {
        "id": pid,
        "name": name,
        "osmId": "way/" + osm,
        "osmGeometry": mapping(world(row.geometry)),
        "osmTags": row.other_tags,
        "parts": parts,
        "sourceGroundY": min(p["ground_y_m"] for p in parts),
        "sourceUrl": f"https://gdi.berlin.de/data/a_lod2/atom/{path.name}",
        "sourceSha256": digest(path),
        "sourceLicense": "dl-de/zero-2-0",
      }
    )
  source = {
    "schemaVersion": 1,
    "buildings": buildings,
    "osmSource": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "osmLicense": "ODbL-1.0",
    "conflict": {
      "owner": PLATZHAUS,
      "oldHeight": 12.071,
      "decision": "Keep every exact source XZ point and the full original sheets in evidence. Replace only the erroneous tall gable with a flat single-storey interpretation, height3.4m explicitly estimated from one-storey OSM and the free contextual photo. Not a new survey.",
      "heightEstimate": CORRECTED_HEIGHT,
      "evidence": [
        "OSM way35605732 building:levels=1",
        "Mazbln Helmholtzplatz Mitte.jpg shows both separate low buildings; Platzhaus visibly flat-roofed.",
      ],
    },
    "factualReferences": [
      "https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/ausstellung/artikel.1513033.php",
      "https://platzhaus-helmholtzplatz.de/die-idee/",
      "https://www.visitberlin.de/de/kiezkind-im-prenzlauer-berg",
    ],
    "visualReferences": [
      {
        "title": "Helmholtzplatz Trafohaus.jpg",
        "pageUrl": "https://commons.wikimedia.org/wiki/File:Helmholtzplatz_Trafohaus.jpg",
        "author": "Mazbln",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "date": "2005-08-19",
        "use": "External free reference only: low transformer/cafe volume, orange fins, pale eave, tall glazed panels. Archival appearance interpretation; not a2026 colour survey.",
      },
      {
        "title": "Helmholtzplatz Mitte.jpg",
        "pageUrl": "https://commons.wikimedia.org/wiki/File:Helmholtzplatz_Mitte.jpg",
        "author": "Mazbln",
        "license": "CC BY-SA 3.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/",
        "date": "2005-08-19",
        "use": "External free reference only: both separate building forms; low flat-roof Platzhaus. Graffiti, sculpture and signs are not reproduced.",
      },
    ],
    "policy": "Exact named source ownership only. Full Kiezkind walls/roofs retained, all prior source sheets retained as evidence; only Platzhaus vertical envelope is explicitly corrected. Unsurveyed openings/colours/fins/roof trim are estimated. No people, toys, lettering, protected graffiti or photographic pixels added.",
  }
  write_json(SOURCE, source)
  return source


def ownership_receipt(source: dict) -> dict:
  """Match regenerated exact coloured owner geometry against unchanged packets."""
  rows = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(3280, -2600, 3355, -2545),
  )
  selected = rows[rows.sourceId.isin(OWNERS)].to_dict("records")
  assert {b["sourceId"] for b in selected} == set(OWNERS)
  scope = world(
    load_projected_polygon(GEO / "bounds.geojson").difference(
      load_projected_polygon(GEO / "bounds-v158.geojson")
    )
  )
  manifest = read_json(OUT / "manifest.json")
  records, line_records, navigation_records = [], [], []
  for desc in manifest["chunks"]:
    if desc.get("detailCompanionOf"):
      continue
    tile = box(*desc["bounds"])
    owned = [b for b in selected if b["geometry"].intersects(tile)]
    if not owned:
      continue
    for mode in ["drawn", "minecraft"]:
      path = OUT / desc[mode]["url"]
      payload = read_json(path)
      ids = {b["sourceId"] for b in payload["nav"]["buildings"]} & set(OWNERS)
      for original in payload["nav"]["buildings"]:
        if original["sourceId"] != PLATZHAUS:
          continue
        canonical = [
          original["sourceId"],
          f"{original['height']:.4f}",
          f"{original['minHeight']:.4f}",
        ]
        canonical.extend(f"{v:.4f}" for p in original["ring"] for v in p)
        navigation_records.append(
          {
            "tile": desc["id"],
            "mode": mode,
            "owner": PLATZHAUS,
            "original": original,
            "originalHeight": original["height"],
            "newHeight": CORRECTED_HEIGHT,
            "fingerprint": fingerprint(canonical),
          }
        )
      for owner in owned:
        if owner["sourceId"] not in ids:
          continue
        baseline = chunk_payload(
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
        expected = mesh_signature(baseline) - mesh_signature(empty)
        assert not expected - mesh_signature(payload)
        for mesh in payload["meshes"]:
          if mesh["kind"] != "city":
            continue
          positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
            -1, 3
          )
          colors = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
          ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
          vertices, removed = np.column_stack([positions, colors]), []
          for i, triangle in enumerate(vertices[ix]):
            key = b"".join(sorted(r.tobytes() for r in triangle))
            if expected[key]:
              expected[key] -= 1
              removed.append(i)
          if removed:
            records.append(
              {
                "tile": desc["id"],
                "mode": mode,
                "kind": mesh["kind"],
                "owner": owner["sourceId"],
                "sha256": digest(path),
                "fingerprint": fingerprint(
                  [mesh[k] for k in ["positions", "colors", "indices"]]
                ),
                "triangles": removed,
              }
            )
        assert not +expected
        if mode == "drawn" and payload.get("lines"):
          expected_lines = line_signature(baseline["lines"]) - line_signature(
            empty["lines"]
          )
          lines = payload["lines"]
          pos = np.frombuffer(base64.b64decode(lines["positions"]), "<u2").reshape(
            -1, 3
          )
          col = np.frombuffer(base64.b64decode(lines["colors"]), "u1").reshape(-1, 3)
          removed_lines = []
          for i, pair in enumerate(np.column_stack([pos, col]).reshape(-1, 2, 6)):
            key = b"".join(sorted(r.tobytes() for r in pair))
            if expected_lines[key]:
              expected_lines[key] -= 1
              removed_lines.append(i)
          assert not +expected_lines
          line_records.append(
            {
              "tile": desc["id"],
              "mode": mode,
              "owner": owner["sourceId"],
              "sha256": digest(path),
              "fingerprint": fingerprint([lines[k] for k in ["positions", "colors"]]),
              "segments": removed_lines,
            }
          )
  assert {r["owner"] for r in records} == set(OWNERS)
  return {
    "schemaVersion": 1,
    "sourceSha256": digest(SOURCE),
    "method": "Exact complete coloured coarse-owner triangle and ink-segment multisets. FNV1a fingerprints guard every runtime transfer; unchanged packets, navigation, ground and unrelated geometry.",
    "records": records,
    "lineRecords": line_records,
    "navigationRecords": navigation_records,
    "navigationFingerprintRecipe": "FNV1a over sourceId, height.toFixed(4), minHeight.toFixed(4), then each ordered ring coordinate.toFixed(4), concatenated without separator. Additionally compare complete original ring/holes and sourceId exactly. Only height changes; original packet stays immutable.",
    "coarseOwners": [
      {
        k: (mapping(v) if k == "geometry" else v)
        for k, v in row.items()
        if k
        in {"sourceId", "geometry", "height", "minHeight", "heightSource", "partId"}
      }
      for row in selected
    ],
  }


def build() -> dict:
  """Complete required shells plus bounded separate recognition furniture."""
  source = read_json(SOURCE) if SOURCE.exists() else extract()
  owners, surfaces, boxes = [], [], []
  # One common original source-ground datum preserves Kiezkind part offsets.
  cafe_low = min(
    b["sourceGroundY"] for b in source["buildings"] if b["id"] != PLATZHAUS
  )
  for oi, building in enumerate(source["buildings"]):
    corrected = building["id"] == PLATZHAUS
    low = building["sourceGroundY"] if corrected else cafe_low
    footprint = Polygon(building["parts"][0]["ring"])
    owners.append(
      {
        "id": building["id"],
        "name": building["name"],
        "osmId": building["osmId"],
        "groundY": 3,
        "anchor": [footprint.centroid.x, footprint.centroid.y],
        "heightCorrection": corrected,
        "sourceGroundY": low,
      }
    )
    for part in building["parts"]:
      for surface in part["surfaces"]:
        rings = [
          [
            [
              p[0],
              (3 if p[1] <= low + 0.01 else 3 + CORRECTED_HEIGHT)
              if corrected
              else p[1] - low + 3,
              p[2],
            ]
            for p in ring
          ]
          for ring in surface["rings"]
        ]
        normal = sum(
          (np.cross(a, b) for a, b in zip(rings[0], rings[0][1:] + rings[0][:1])),
          np.zeros(3),
        )
        if np.linalg.norm(normal) < 1e-7:
          continue
        color = (
          0x7B807B
          if surface["kind"] == "RoofSurface"
          else 0xD5D2C0
          if corrected
          else 0xBCAB87
        )
        surfaces.append(
          {
            "owner": oi,
            "kind": surface["kind"],
            "triangles": triangles_for(rings),
            "color": color,
          }
        )
    # Accent only outer measured source footprint edges, never courtyard fills.
    ring = part["ring"] if corrected else building["parts"][0]["ring"]
    polygon = Polygon(ring)
    for a, b in zip(ring, ring[1:] + ring[:1]):
      av, bv = np.array(a), np.array(b)
      width = float(np.linalg.norm(bv - av))
      if width < 4:
        continue
      direction = (bv - av) / width
      normal = np.array([-direction[1], direction[0]])
      if polygon.covers(Point(*((av + bv) / 2 + normal * 0.1))):
        normal = -normal
      yaw = math.atan2(-direction[1], direction[0])

      def emit(
        u: float,
        y: float,
        w: float,
        h: float,
        depth: float,
        color: int,
        offset: float = 0.065,
      ) -> None:
        p = av + direction * u + normal * offset
        boxes.append(
          [round(float(v), 4) for v in [p[0], y, p[1], w, h, depth, yaw]] + [color, oi]
        )

      # Fins follow the two long external sides of the cafe main owner only.
      if not corrected and building["id"] == "DEBE03YY60001rGC":
        continue
      bays = max(1, int(width / (2.5 if corrected else 1.75)))
      for i in range(bays):
        u = width * (i + 0.5) / bays
        emit(u, 4.6, min(1.15, width / bays * 0.6), 2.12, 0.08, 0x536B70)
        emit(u, 4.72, min(1.15, width / bays * 0.6), 0.075, 0.10, 0xCBCDC4, 0.095)
        emit(u, 3.50, min(1.35, width / bays * 0.7), 0.12, 0.15, 0xDFD8C0, 0.1)
        if not corrected:
          emit(width * i / bays + 0.16, 4.64, 0.11, 2.8, 0.38, 0xD69838, 0.19)
      emit(
        width / 2, 6.24 if corrected else 6.60, width - 0.1, 0.15, 0.16, 0xDDD9CB, 0.08
      )
  shell_blocks = []
  for corrected in [False, True]:
    shell = {
      "surfaces": [
        s for s in surfaces if owners[s["owner"]]["heightCorrection"] == corrected
      ],
      "boxes": [],
      "rods": [],
    }
    blocks = native_blocks(shell)
    if corrected:
      # Keep the native roof and the explicitly corrected navigation height in
      # agreement. Partial-height top blocks remain orthogonal native geometry.
      clipped = []
      for block in blocks:
        bottom = block[1] - block[4] / 2
        top = min(block[1] + block[4] / 2, 3 + CORRECTED_HEIGHT)
        if top > bottom:
          block[1], block[4] = (top + bottom) / 2, top - bottom
          clipped.append(block)
      blocks = clipped
    shell_blocks.extend(blocks)
  native_detail = []
  # Small native trim members sampled as independent orthogonal facades.
  for r in boxes:
    x, y, z, width, height, depth, yaw, color, owner = r
    for i in range(max(1, math.ceil(width / 0.7))):
      count = max(1, math.ceil(width / 0.7))
      u = width * ((i + 0.5) / count - 0.5)
      native_detail.append(
        [
          round(x + math.cos(yaw) * u, 3),
          y,
          round(z - math.sin(yaw) * u, 3),
          max(0.15, abs(math.cos(yaw)) * width / count + abs(math.sin(yaw)) * depth),
          height,
          max(0.15, abs(math.sin(yaw)) * width / count + abs(math.cos(yaw)) * depth),
          color,
          owner,
        ]
      )
  runtime = {
    "schemaVersion": 1,
    "owners": owners,
    "surfaces": surfaces,
    "shellBlocks": shell_blocks,
    "boxes": boxes,
    "blocks": native_detail,
  }
  write_json(DATA / "kiezFacadesV209.json", runtime)
  receipt = ownership_receipt(source)
  write_json(DATA / "kiezSitesOwnershipV209.json", receipt)
  report = {
    "sourceSha256": digest(SOURCE),
    "surfaceCount": len(surfaces),
    "triangles": sum(len(s["triangles"]) for s in surfaces),
    "boxes": len(boxes),
    "nativeShellBlocks": len(shell_blocks),
    "nativeDetailBlocks": len(native_detail),
    "originalParts": sum(len(b["parts"]) for b in source["buildings"]),
    "originalSurfaces": sum(
      len(p["surfaces"]) for b in source["buildings"] for p in b["parts"]
    ),
    "transferTriangles": sum(len(r["triangles"]) for r in receipt["records"]),
    "transferInkSegments": sum(len(r["segments"]) for r in receipt["lineRecords"]),
    "conflict": source["conflict"],
    "policy": source["policy"],
  }
  write_json(GEO / "helmholtz-sites-v209-evidence.json", report)
  print(json.dumps(report, indent=2))
  return runtime


if __name__ == "__main__":
  build()
