"""Immutable source-owner triangle/ink transfer receipts for three named sites."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import sys
from collections import Counter
from pathlib import Path

import geopandas as gpd
import numpy as np
from shapely import orient_polygons
from shapely.affinity import translate
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_surrounding_outlines as exporter

ROOT = Path(__file__).resolve().parents[1]
PUB = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def fingerprint(texts: list[str]) -> int:
  """Match the bounded runtime FNV-1a guard over immutable encoded arrays."""
  value = 2166136261
  for text in texts:
    for char in text:
      value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
  return value


def vertices(mesh: dict) -> np.ndarray:
  """Decode source position and linear colour values without lossy conversion."""
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
    -1, 3
  )
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  return np.column_stack([positions, colors])


def signature(v: np.ndarray) -> bytes:
  """Ignore triangle winding while preserving every coordinate/colour bit."""
  return b"".join(sorted(row.tobytes() for row in v))


def build() -> dict:
  """Recreate only exact prior named owners from their retained source records."""
  source = json.loads(
    (
      ROOT / "geo_data/regierungsviertel/prisons-memorials-v209-source.json"
    ).read_bytes()
  )
  native_ids = [o["id"] for o in source["owners"] if o["site"] == "hsh"]
  hq_ids = [
    "OSM-way-" + n
    for n in [
      "317017752",
      "39224010",
      "1258995040",
      "1094447842",
      "39223951",
      "41276885",
      "41276925",
      "41277024",
      "1374082109",
      "41277060",
      "39223939",
    ]
  ]
  families = [
    ("east-city-v200", "east200-17_-5", native_ids),
    ("outskirts-v187", "outer187-15_1", hq_ids),
  ]
  records, line_records, navigation_records, originals = [], [], [], []
  for folder, tile, ids in families:
    where = "sourceId IN (" + ",".join("'" + p + "'" for p in ids) + ")"
    path = ROOT / "geo_data/regierungsviertel/raw" / folder / "resolved-outlines.gpkg"
    buildings = gpd.read_file(path, layer="buildings", where=where).to_dict("records")
    assert {b["sourceId"] for b in buildings} == set(ids)
    for b in buildings:
      originals.append(
        {
          k: (None if isinstance(v, float) and not math.isfinite(v) else v)
          for k, v in b.items()
          if k != "geometry"
        }
        | {"wkb": b["geometry"].wkb_hex}
      )
    for mode in ["drawn", "minecraft"]:
      path = PUB / f"{tile}.{mode}.json.gz"
      content = path.read_bytes()
      packet = json.loads(gzip.decompress(content))
      source_navigation = [
        row for row in packet["nav"]["buildings"] if row["sourceId"] in ids
      ]
      assert {row["sourceId"] for row in source_navigation} == set(ids)
      for row in source_navigation:
        old = next(b for b in buildings if b["sourceId"] == row["sourceId"])
        replacements = [
          owner["id"]
          for owner in source["owners"]
          if shape(owner["footprint"]).intersection(old["geometry"]).area
          / old["geometry"].area
          > 0.5
        ]
        if not replacements:
          raise ValueError(f"Missing required replacement for {row['sourceId']}")
        navigation_records.append(
          dict(
            tile=tile,
            mode=mode,
            owner=row["sourceId"],
            sha256=hashlib.sha256(content).hexdigest(),
            origin=packet["origin"],
            groundY=packet["nav"]["groundY"],
            original=row,
            replacementOwners=replacements,
          )
        )
      ox, oy, oz = packet["origin"]
      tile_shape = box(ox, oz, ox + 512, oz + 512)
      ground = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz)
          for p in packet["nav"]["ground"]
        ]
      )
      if folder == "outskirts-v187":
        geo = ROOT / "geo_data/regierungsviertel"
        ground = exporter.world(
          exporter.load_projected_polygon(
            geo / "bounds-outskirts-v187.geojson"
          ).difference(
            exporter.load_projected_polygon(geo / "bounds-retained-v186.geojson")
          )
        ).intersection(tile_shape)
      live = next(p for p in packet["meshes"] if p["kind"] == "city")
      actual_vertices = vertices(live)
      actual_indices = np.frombuffer(
        base64.b64decode(live["indices"]), dtype="<u4"
      ).reshape(-1, 3)
      keys = [signature(t) for t in actual_vertices[actual_indices]]
      for b in buildings:
        geom = exporter.polygonal(b["geometry"].intersection(tile_shape))
        if mode == "minecraft":
          geom = exporter.native_polygon(geom).intersection(ground)
        if geom.is_empty:
          continue
        low = 3 + b["minHeight"]
        high = 3 + max(b["height"], b["minHeight"] + 1)
        if mode == "minecraft":
          high = 3 + max(2, round((high - 3) / 2) * 2)
        outline = (
          orient_polygons(geom, exterior_cw=True).boundary
          if mode == "minecraft"
          else orient_polygons(b["geometry"], exterior_cw=True).boundary.intersection(
            tile_shape
          )
        )
        expected = exporter.PackedMesh(ox, oz)
        expected.building(geom, low, high, outline)
        expected_data = expected.payload("city")
        ev = vertices(expected_data)
        ei = np.frombuffer(
          base64.b64decode(expected_data["indices"]), dtype="<u4"
        ).reshape(-1, 3)
        wanted = Counter(signature(t) for t in ev[ei])
        removed = []
        for number, key in enumerate(keys):
          if wanted[key]:
            wanted[key] -= 1
            removed.append(number)
        missing = sum(wanted.values())
        if missing:
          raise ValueError(
            f"{tile} {mode} {b['sourceId']}: {missing} missing exact triangles"
          )
        records.append(
          dict(
            tile=tile,
            mode=mode,
            kind="city",
            owner=b["sourceId"],
            sha256=hashlib.sha256(content).hexdigest(),
            fingerprint=fingerprint(
              [live[k] for k in ["positions", "colors", "indices"]]
            ),
            triangles=removed,
          )
        )
        if mode == "drawn":
          line = packet["lines"]
          lv = vertices(line).reshape(-1, 2, 6)
          expected_lines = []
          for ring in exporter.line_parts(
            geom.boundary.difference(tile_shape.boundary.buffer(0.02))
          ):
            for a, c in zip(ring.coords, list(ring.coords)[1:]):
              positions = np.array(
                [
                  [
                    round((x - ox) * 100),
                    round((high + 0.02 - oy) * 100),
                    round((z - oz) * 100),
                  ]
                  for x, z in [a, c]
                ],
                dtype="<u2",
              )
              colors = exporter.linear_rgb_bytes(
                np.array([exporter.COLORS["ink"], exporter.COLORS["ink"]])
              )
              expected_lines.append(np.column_stack([positions, colors]))
          wanted_lines = Counter(signature(v) for v in expected_lines)
          selected = []
          for number, v in enumerate(lv):
            key = signature(v)
            if wanted_lines[key]:
              wanted_lines[key] -= 1
              selected.append(number)
          if sum(wanted_lines.values()):
            raise ValueError(f"Missing ink {tile} {b['sourceId']}")
          line_records.append(
            dict(
              tile=tile,
              mode=mode,
              owner=b["sourceId"],
              fingerprint=fingerprint([line["positions"], line.get("colors", "")]),
              segments=selected,
            )
          )
  return dict(
    records=records,
    lineRecords=line_records,
    navigationRecords=navigation_records,
    retainedOwners=originals,
    method="Exact retained source recipe position/colour matches plus immutable packet fingerprints; no area cull or packet mutation.",
  )


if __name__ == "__main__":
  data = build()
  path = ROOT / "src/app/src/data/prisonsMemorialsOwnershipV209.json"
  path.write_text(json.dumps(data, separators=(",", ":"), allow_nan=False) + "\n")
  print(
    len(data["records"]),
    sum(len(r["triangles"]) for r in data["records"]),
    len(data["lineRecords"]),
    path.stat().st_size,
  )
