"""Exact, fingerprinted transfer of the two obsolete Deutsche Oper envelope owners."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
from collections import Counter

import geopandas as gpd
import numpy as np
from shapely import orient_polygons
from shapely.affinity import translate
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

from scripts import build_surrounding_outlines as exporter
from scripts.build_opera_theatres_v274 import DATA, GEO, PRISMS, ROOT
from scripts.build_prisons_memorials_ownership_v209 import (
  fingerprint,
  signature,
  vertices,
)
from scripts.build_theatres_v272 import write

IDS = {"DEBE04YY500002EM", "DEBE04YY50002cf0"}


def core_columns():
  """Only exclusive immutable source column tuples, keeping shared neighbour cells."""
  base = ROOT / "src/app/public/mesh/regierungsviertel"
  prisms = json.loads((base / "lod2-prisms.json").read_bytes())["buildings"]

  def poly(p):
    return Polygon(
      [[x / 10, z / 10] for x, z in p["ring"]],
      [[[x / 10, z / 10] for x, z in h] for h in p["holes"]],
    ).buffer(0)

  owners = [p for p in prisms if p["id"] in PRISMS]
  selected = unary_union([poly(p) for p in owners])
  bounds = selected.envelope.buffer(6)
  neighbours = [
    p for p in prisms if p["id"] not in PRISMS and poly(p).envelope.intersects(bounds)
  ]
  occupied = unary_union([poly(p) for p in neighbours])
  voxel = json.loads((base / "minecraft-voxels.json").read_bytes())
  cell, grid = voxel["cell_m"], voxel["grid"]
  columns, shared = [], []
  for zi, runs in enumerate(voxel["building_rows"]):
    iz = grid["min_z_idx"] + zi
    if not selected.bounds[1] - cell <= iz * cell <= selected.bounds[3]:
      continue
    for offset, count, low, high, kind in runs:
      for ix in range(grid["min_x_idx"] + offset, grid["min_x_idx"] + offset + count):
        square = box(ix * cell, iz * cell, (ix + 1) * cell, (iz + 1) * cell)
        if selected.intersection(square).area < 0.001:
          continue
        (shared if occupied.intersection(square).area > 0.001 else columns).append(
          [ix, iz, low, high, kind]
        )
  return dict(
    cellM=cell,
    columns=columns,
    sharedColumns=shared,
    neighbours=neighbours,
    bounds=list(bounds.bounds),
  )


def build():
  path = GEO / "raw/outer-v159/resolved-outlines.gpkg"
  owners = gpd.read_file(
    path, layer="buildings", where="sourceId IN ('DEBE04YY500002EM','DEBE04YY50002cf0')"
  ).to_dict("records")
  assert {o["sourceId"] for o in owners} == IDS
  records, lines, nav = [], [], []
  for tile in ["-9_0", "-9_1"]:
    for mode in ["drawn", "minecraft"]:
      raw = (
        ROOT / f"src/app/public/mesh/surrounding-berlin-v159/{tile}.{mode}.json.gz"
      ).read_bytes()
      packet = json.loads(gzip.decompress(raw))
      ox, oy, oz = packet["origin"]
      tile_shape = box(ox, oz, ox + 512, oz + 512)
      ground = unary_union(
        [
          translate(Polygon(p["ring"], p["holes"]), ox, oz)
          for p in packet["nav"]["ground"]
        ]
      )
      mesh = next(p for p in packet["meshes"] if p["kind"] == "city")
      vv = vertices(mesh)
      ii = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4").reshape(-1, 3)
      keys = [signature(t) for t in vv[ii]]
      for row in packet["nav"]["buildings"]:
        if row["sourceId"] in IDS:
          nav.append(
            dict(
              tile=tile,
              mode=mode,
              original=row,
              origin=packet["origin"],
              groundY=packet["nav"]["groundY"],
            )
          )
      for owner in owners:
        geom = exporter.polygonal(owner["geometry"].intersection(tile_shape))
        if mode == "minecraft":
          geom = exporter.native_polygon(geom).intersection(ground)
        if geom.is_empty:
          continue
        low = 3 + owner["minHeight"]
        high = 3 + max(owner["height"], owner["minHeight"] + 1)
        if mode == "minecraft":
          high = 3 + max(2, round((high - 3) / 2) * 2)
        outline = (
          orient_polygons(geom, exterior_cw=True).boundary
          if mode == "minecraft"
          else orient_polygons(
            owner["geometry"], exterior_cw=True
          ).boundary.intersection(tile_shape)
        )
        expected = exporter.PackedMesh(ox, oz)
        expected.building(geom, low, high, outline)
        payload = expected.payload("city")
        ev = vertices(payload)
        ei = np.frombuffer(base64.b64decode(payload["indices"]), dtype="<u4").reshape(
          -1, 3
        )
        wanted = Counter(signature(t) for t in ev[ei])
        selected = []
        for n, key in enumerate(keys):
          if wanted[key]:
            wanted[key] -= 1
            selected.append(n)
        assert not sum(wanted.values()), (
          tile,
          mode,
          owner["sourceId"],
          sum(wanted.values()),
        )
        records.append(
          dict(
            tile=tile,
            mode=mode,
            kind="city",
            owner=owner["sourceId"],
            sha256=hashlib.sha256(raw).hexdigest(),
            fingerprint=fingerprint(
              [mesh[k] for k in ["positions", "colors", "indices"]]
            ),
            triangles=selected,
          )
        )
        if mode == "drawn":
          line = packet["lines"]
          lv = vertices(line).reshape(-1, 2, 6)
          wanted = Counter()
          for ring in exporter.line_parts(
            geom.boundary.difference(tile_shape.boundary.buffer(0.02))
          ):
            for a, b in zip(ring.coords, list(ring.coords)[1:]):
              pos = np.array(
                [
                  [
                    round((x - ox) * 100),
                    round((high + 0.02 - oy) * 100),
                    round((z - oz) * 100),
                  ]
                  for x, z in [a, b]
                ],
                dtype="<u2",
              )
              col = exporter.linear_rgb_bytes(np.array([exporter.COLORS["ink"]] * 2))
              wanted[signature(np.column_stack([pos, col]))] += 1
          chosen = []
          for n, v in enumerate(lv):
            key = signature(v)
            if wanted[key]:
              wanted[key] -= 1
              chosen.append(n)
          assert not sum(wanted.values()), (tile, "ink", sum(wanted.values()))
          lines.append(
            dict(
              tile=tile,
              mode=mode,
              owner=owner["sourceId"],
              fingerprint=fingerprint([line["positions"], line.get("colors", "")]),
              segments=chosen,
            )
          )
  # Only generic window planes and their matching sill strokes on new glazed faces.
  prior = json.loads((DATA / "cityRecognitionV182.json").read_bytes())
  features = {f["parentId"]: f for f in prior["features"]}
  boxes = []
  segments = []
  for pid in ["DEBE04YY500004Vq", "DEBE04YY500002EM"]:
    f = features[pid]

    def on_face(row):
      x, z = row[0], row[2]
      return (
        (-3642 < x < -3619 and 694 < z < 707)
        if pid.endswith("004Vq")
        else (-4269 < x < -4263 and 628 < z < 668)
      )

    for i in range(f["firstBox"], f["firstBox"] + f["boxCount"]):
      row = prior["boxes"][i]
      if on_face(row):
        boxes.append([i, row])
    for i in range(f["firstSegment"], f["firstSegment"] + f["segmentCount"]):
      row = prior["segments"][i]
      if row[6] == 0xBDC5BF and on_face(row):
        segments.append([i, row])
  return dict(
    **core_columns(),
    records=records,
    lineRecords=lines,
    navigationRecords=nav,
    retainedOwners=[
      {k: v for k, v in o.items() if k != "geometry"} | {"wkb": o["geometry"].wkb_hex}
      for o in owners
    ],
    previousBoxes=boxes,
    previousSegments=segments,
    method="Exact retained owner replay with immutable position/colour/index fingerprints; only matching rows transfer. Full measured source replacement must be loaded first.",
  )


if __name__ == "__main__":
  data = build()
  write(DATA / "operaTheatresV274Ownership.json", data)
  print(
    {
      "records": len(data["records"]),
      "triangles": sum(len(r["triangles"]) for r in data["records"]),
      "lines": sum(len(r["segments"]) for r in data["lineRecords"]),
      "oldBoxes": len(data["previousBoxes"]),
      "oldSills": len(data["previousSegments"]),
    }
  )
