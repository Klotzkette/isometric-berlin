"""Step 10: exact Rosenthaler Platz source shells and open Weltzeituhr ownership.

Only eleven fixed measured parents and one misinterpreted OSM clock canopy are
owned. Streets, all other source geometry and both native/drawn layers survive.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import shapely
from build_concert_halls_v160 import normal_of, triangulate
from build_karl_marx_allee_v161 import (
  Detail,
  mesh_signature,
  native_detail,
  packed_detail,
)
from build_surrounding_outlines import (
  DEFAULT_OUTPUT,
  GROUND_Y,
  ROOT,
  chunk_payload,
  load_projected_polygon,
  navigation_polygons,
  polygonal,
  world,
  write_json,
)
from shapely.geometry import Polygon, box

SOURCE = ROOT / "geo_data/regierungsviertel/rosenthaler-platz-v163.json"
RAW = ROOT / "geo_data/regierungsviertel/raw/outer-v159"
CLOCK_ID = "OSM-way-417529567"
HOSTEL_ID = "DEBE01YYK0000E7j"


def facade(
  detail: Detail,
  rings: list[list[list[float]]],
  ground: float,
  levels: int,
  hostel: bool,
) -> None:
  """Photo-guided plaster/window subdivisions on measured planes only."""
  n = normal_of(rings[0])
  if abs(n[1]) > 0.08:
    return
  a, b = max(
    ((a, b) for a in rings[0] for b in rings[0]),
    key=lambda v: math.hypot(v[1][0] - v[0][0], v[1][2] - v[0][2]),
  )
  length = math.hypot(b[0] - a[0], b[2] - a[2])
  if length < 2.5:
    return
  dx, dz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
  poly = Polygon(
    [[(p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]] for p in rings[0]],
    [[[(p[0] - a[0]) * dx + (p[2] - a[2]) * dz, p[1]] for p in r] for r in rings[1:]],
  )
  if not poly.is_valid:
    poly = shapely.make_valid(poly)
  if poly.area < 8:
    return
  u0, y0, u1, y1 = poly.bounds

  def pane(
    u: float,
    y: float,
    w: float,
    h: float,
    color: tuple[int, ...],
    role: str,
    out: float = 0.13,
  ) -> None:
    r = box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    if not poly.buffer(-0.03).covers(r):
      return
    detail.polygon(
      [
        [a[0] + dx * q + n[0] * out, v, a[2] + dz * q + n[2] * out]
        for q, v in list(r.exterior.coords)[:-1]
      ],
      color,
      role,
    )

  # OSM level count anchors the register; local projections are not a survey.
  level_height = max(2.65, (y1 - ground - 0.35) / levels)
  bays = max(1, round((u1 - u0) / 3.1))
  pitch = (u1 - u0) / bays
  trim = (207, 207, 197) if hostel else (228, 221, 203)
  for floor in range(levels):
    y = ground + (floor + 0.53) * level_height
    for i in range(bays):
      u = u0 + (i + 0.5) * pitch
      w = min(1.45, pitch * 0.6)
      h = min(2.4, level_height * 0.65)
      if floor == 0:
        w = min(2.5, pitch - 0.35)
        h = min(3.2, level_height * 0.81)
      pane(u, y, w + 0.28, h + 0.24, trim, "window surround", 0.075)
      pane(u, y, w, h, (60, 75, 78), "window glazing", 0.12)
      pane(u, y, 0.07, h, trim, "window mullion", 0.16)
      pane(u, y + h * 0.20, w, 0.065, trim, "window transom", 0.16)
      pane(u, y - h / 2 - 0.15, w + 0.4, 0.15, trim, "stone window sill", 0.18)
    pane(
      (u0 + u1) / 2,
      ground + (floor + 1) * level_height - 0.03,
      u1 - u0 - 0.1,
      0.17,
      trim,
      "continuous cornice",
      0.15,
    )
  # Deep storey border visible on the documented white Hostel corner.
  if hostel:
    pane(
      (u0 + u1) / 2,
      ground + level_height * 3,
      u1 - u0 - 0.10,
      0.22,
      (130, 138, 135),
      "continuous cornice",
      0.19,
    )

  if hostel and length > 8 and (a[2] + b[2]) / 2 > -1187:
    sign_y = ground + level_height * 3 + 0.46
    pane(
      (u0 + u1) / 2,
      sign_y,
      u1 - u0 - 0.12,
      0.78,
      (155, 65, 56),
      "hostel sign band",
      0.20,
    )
    paths = json.loads(
      (ROOT / "geo_data/regierungsviertel/rosenthaler-sign-strokes.json").read_text()
    )
    for path in paths:
      for left, right in zip(path, path[1:]):
        length2 = math.hypot(right[0] - left[0], right[1] - left[1])
        if length2 < 0.001:
          continue
        nx, ny = (
          -(right[1] - left[1]) / length2 * 0.029,
          (right[0] - left[0]) / length2 * 0.029,
        )
        points = [
          [left[0] + nx, left[1] + ny],
          [right[0] + nx, right[1] + ny],
          [right[0] - nx, right[1] - ny],
          [left[0] - nx, left[1] - ny],
        ]
        local = [[(u0 + u1) / 2 + q, sign_y - 0.225 + v] for q, v in points]
        if not poly.buffer(-0.03).covers(Polygon(local)):
          continue
        detail.polygon(
          [
            [a[0] + dx * q + n[0] * 0.225, v, a[2] + dz * q + n[2] * 0.225]
            for q, v in local
          ],
          (241, 233, 210),
          "window mullion",
        )


def building_detail(building: dict[str, Any]) -> tuple[Detail, list[dict[str, Any]]]:
  """Keep every original sheet, translate the shared parent datum to y=3."""
  detail = Detail()
  navigation = []
  base = min(p["ground_y_m"] for p in building["parts"])
  offset = GROUND_Y - base
  hostel = building["id"] == HOSTEL_ID
  tags = building["osmTags"]
  levels = int(tags.get("building:levels", 5))
  wall = (232, 231, 217) if hostel else (220, 211, 190)
  roof = (
    (167, 168, 158)
    if hostel
    else (171, 103, 81)
    if tags.get("roof:colour") == "#c75d4d"
    else (111, 112, 105)
  )
  for part in building["parts"]:
    footprint = Polygon(part["ring"], part["holes"])
    navigation.append(
      {
        "sourceId": building["id"],
        "partId": part["id"],
        "geometry": footprint,
        "height": part["top_y_m"] - base,
        "minHeight": 0,
        "heightSource": "Berlin LoD2 exact part envelope",
      }
    )
    for s in part["surfaces"]:
      if s["kind"] not in {"WallSurface", "RoofSurface"}:
        continue
      rings = [[[x, y + offset, z] for x, y, z in ring] for ring in s["rings"]]
      for triangle in triangulate(rings):
        detail.polygon(
          triangle, roof if s["kind"] == "RoofSurface" else wall, "source " + s["kind"]
        )
      if s["kind"] == "WallSurface":
        facade(detail, rings, GROUND_Y, levels, hostel)
  return detail, navigation


def publish(output: Path, source_path: Path = SOURCE) -> dict[str, Any]:
  """Write a finite descriptor patch, leaving the shared manifest to integration."""
  output.mkdir(parents=True, exist_ok=True)
  source = json.loads(source_path.read_text())
  ids = frozenset([b["id"] for b in source["buildings"]] + [CLOCK_ID])
  buildings = gpd.read_file(RAW / "resolved-outlines.gpkg", layer="buildings").to_dict(
    "records"
  )
  surfaces = {
    r["kind"]: r.geometry
    for _, r in gpd.read_file(
      RAW / "resolved-outlines.gpkg", layer="surfaces"
    ).iterrows()
  }
  scope = world(
    load_projected_polygon(
      ROOT / "geo_data/regierungsviertel/bounds.geojson"
    ).difference(
      load_projected_polygon(ROOT / "geo_data/regierungsviertel/bounds-v158.geojson")
    )
  )
  details = {"drawn": Detail(), "minecraft": Detail()}
  nav = []
  for b in source["buildings"]:
    d, n = building_detail(b)
    details["drawn"].triangles.extend(d.triangles)
    details["minecraft"].triangles.extend(native_detail(d).triangles)
    nav.extend(n)
  manifest = json.loads((DEFAULT_OUTPUT / "manifest.json").read_text())
  patch = []
  audit = []
  for descriptor in manifest["chunks"]:
    tile = box(*descriptor["bounds"])
    selected = [b for b in buildings if b["geometry"].intersects(tile)]
    owned = ids.intersection(b["sourceId"] for b in selected)
    if not owned:
      continue
    entry = {"chunk": descriptor["id"], "ownedIds": sorted(owned)}
    ground = tile.intersection(scope)
    local = {
      k: polygonal(shapely.make_valid(shapely.clip_by_rect(g, *tile.bounds)))
      for k, g in surfaces.items()
    }
    for mode in ["drawn", "minecraft"]:
      original = json.loads(
        gzip.decompress((DEFAULT_OUTPUT / descriptor[mode]["url"]).read_bytes())
      )
      baseline = chunk_payload(
        descriptor["id"], tile, ground, selected, local, minecraft=mode == "minecraft"
      )
      assert mesh_signature(original) == mesh_signature(baseline), (
        f"Unaccounted existing refinement {descriptor['id']} {mode}"
      )
      payload = chunk_payload(
        descriptor["id"],
        tile,
        ground,
        selected,
        local,
        minecraft=mode == "minecraft",
        replaced_source_ids=ids,
      )
      # The prepared GeoPackage row order need not match the original STRtree
      # query order. Preserve original unowned navigation records verbatim.
      payload["nav"]["buildings"] = [
        b for b in original["nav"]["buildings"] if b["sourceId"] not in ids
      ]
      unowned = mesh_signature(payload)
      mesh = packed_detail(details[mode], tile)
      if mesh:
        mesh["name"] = "rosenthaler-source-part-detail"
        payload["meshes"].append(mesh)
      for record in nav:
        for polygon in navigation_polygons(
          record["geometry"].intersection(tile), *tile.bounds[:2]
        ):
          height = (
            record["height"]
            if mode == "drawn"
            else math.ceil(record["height"] / 2) * 2 + 2
          )
          payload["nav"]["buildings"].append(
            {
              **polygon,
              **{k: v for k, v in record.items() if k not in {"geometry", "height"}},
              "height": round(height, 3),
            }
          )
      assert not (unowned - mesh_signature(payload)), "Unowned source triangles lost"
      assert [b for b in original["nav"]["buildings"] if b["sourceId"] not in ids] == [
        b for b in payload["nav"]["buildings"] if b["sourceId"] not in ids
      ]
      for key in ["ground", "water", "roads", "bridges"]:
        assert original["nav"][key] == payload["nav"][key]
      assert all(b["sourceId"] != CLOCK_ID for b in payload["nav"]["buildings"])
      data = (
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False) + "\n"
      ).encode()
      packed = gzip.compress(data, compresslevel=9, mtime=0)
      assert len(data) < 12 * 1024 * 1024
      for m in payload["meshes"]:
        assert len(base64.b64decode(m["positions"])) // 6 <= 400000
        assert len(base64.b64decode(m["indices"])) // 4 <= 2400000
      (output / descriptor[mode]["url"]).write_bytes(packed)
      descriptor[mode].update(
        bytes=len(packed),
        decodedBytes=len(data),
        sha256=hashlib.sha256(packed).hexdigest(),
      )
      entry[mode] = {
        "retainedUnownedTriangles": sum(unowned.values()),
        "decodedBytes": len(data),
        "bytes": len(packed),
        "navigationOutsideNamedIdsUnchanged": True,
      }
    patch.append(descriptor)
    audit.append(entry)
    print(descriptor["id"], entry, flush=True)
  report = {
    "sourceParents": len(source["buildings"]),
    "sourceParts": sum(len(b["parts"]) for b in source["buildings"]),
    "suppressedClockCanopy": CLOCK_ID,
    "replacementClockModule": "EastSquaresV163.ts",
    "chunks": audit,
  }
  write_json(
    output / "rosenthaler-manifest-patch.json",
    {
      "chunks": patch,
      "source": {
        "rosenthalerPlatz": {
          "version": "1.0.63",
          "sourceIds": sorted(ids),
          "sourceEvidence": "geo_data/regierungsviertel/rosenthaler-platz-v163.json",
          "policy": source["policy"],
        }
      },
    },
  )
  write_json(
    ROOT / "geo_data/regierungsviertel/rosenthaler-platz-v163-audit.json", report
  )
  return report


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--out", type=Path, default=Path("/tmp/rosenthaler-v163-packets"))
  args = parser.parse_args()
  print(json.dumps(publish(args.out)))


if __name__ == "__main__":
  main()
