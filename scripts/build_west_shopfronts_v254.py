"""Step 10: fit existing west-street openings without adding a second grid."""

from __future__ import annotations

import gzip
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
from build_boulevard_architecture_v235 import (
  GLASS,
  decode,
  fingerprint,
  key,
  plan,
  read,
)
from build_boulevard_architecture_v235 import (
  fields as boulevard_fields,
)
from build_district_facades_v188 import window_grid
from shapely.affinity import scale, translate
from shapely.geometry import Point, Polygon, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
RUNTIME = ROOT / "src/app/src/data/westShopfrontsV254.json"
EVIDENCE = GEO / "west-shopfronts-v254-evidence.json.gz"


def digest(path: Path) -> str:
  """Retain immutable evidence hashes without rewriting any old file."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def rectangle_exists(points: np.ndarray, triangles: set[tuple]) -> bool:
  """Accept either exact source triangulation, never approximate empty panes."""
  return any(
    all(key(points[list(t)]) in triangles for t in pair)
    for pair in (
      ((0, 1, 2), (0, 2, 3)),
      ((0, 1, 3), (1, 2, 3)),
    )
  )


class Capture:
  """Replay the original v188 opening recipe, preserving its exact rectangles."""

  def __init__(self) -> None:
    self.fields: list[np.ndarray] = []

  def pane(
    self,
    a: Any,
    direction: Any,
    normal: Any,
    u: float,
    y: float,
    width: float,
    height: float,
    depth: float,
    *_: Any,
  ) -> None:
    if height < 1:
      return
    left = a + direction * (u - width / 2) + normal * depth
    right = a + direction * (u + width / 2) + normal * depth
    self.fields.append(
      np.array(
        [
          [left[0], y - height / 2, left[1]],
          [right[0], y - height / 2, right[1]],
          [right[0], y + height / 2, right[1]],
          [left[0], y + height / 2, left[1]],
        ]
      )
    )


def main() -> None:
  """Produce compact plans attached only to already delivered packet families."""
  district = read(GEO / "district-facades-v188-evidence.json.gz")
  context = read(GEO / "district-facades-v188-context.json.gz")
  doors = read(ROOT / "src/app/src/data/houseDoorsV233.json")["chunks"]
  packets: dict[str, Any] = {}
  receipts: list[dict[str, Any]] = []
  counts: Counter = Counter()
  sources = [
    "boulevard-architecture-v235-evidence.json.gz",
    "district-facades-v188-evidence.json.gz",
    "district-facades-v188-context.json.gz",
    "raw/outer-v159/berlin-260929.osm.pbf",
  ]
  # These retained public-place identities support commercial use only. No
  # current tenant name, exact door position, sign or merchandise is inferred.
  road_records = [r for r in context["roads"] if r["name"] == "Kantstraße"]
  road = unary_union([shape(r["geometry"]) for r in road_records])
  pois = gpd.read_file(
    GEO / "raw/outer-v159/berlin-260929.osm.pbf",
    layer="points",
    bbox=(13.27, 52.495, 13.335, 52.51),
    where="other_tags LIKE '%\"shop\"%' OR other_tags LIKE '%\"amenity\"%'",
  ).to_crs(25833)
  venues = []
  for _, row in pois.iterrows():
    tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', str(row["other_tags"])))
    commercial = tags.get("shop") not in {None, "no", "vacant"} or tags.get(
      "amenity"
    ) in {
      "cafe",
      "restaurant",
      "fast_food",
    }
    if not commercial or tags.get("level", "0") not in {"0", "0;1"}:
      continue
    geometry = translate(row.geometry, -389500, -5820000)
    # World Z increases southwards, unlike projected northing.
    geometry = scale(geometry, yfact=-1, origin=(0, 0))
    if geometry.distance(road) <= 35:
      venues.append(
        {
          "id": row["osm_id"],
          "element": "node",
          "amenity": tags.get("amenity"),
          "shop": tags.get("shop"),
          "geometry": mapping(geometry),
        }
      )

  def save(packet_key: str, packet_plan: dict, fields: list, records: list) -> None:
    if not fields:
      return
    mode, identity = packet_key.split(":")
    # The exact field is added once even when source ownership records repeat.
    unique = {tuple(f[:9]): (f, r) for f, r in zip(fields, records)}
    fields, records = map(list, zip(*unique.values()))
    packets[packet_key] = {**packet_plan, "fields": fields}
    receipts.append(
      {
        "key": packet_key,
        "packetSha256": digest(OUT / f"{identity}.{mode}.json.gz"),
        "fields": records,
      }
    )
    counts[mode] += len(fields)
    for record in records:
      counts[f"{mode}:{record['section']}"] += 1

  candidates, _ = boulevard_fields()
  grouped_shops: dict[str, list] = {}
  for field in candidates:
    if field["role"] != "shopfront glazing":
      continue
    center = np.mean(field["points"], axis=0)
    identity = f"{int(np.floor(center[0] / 512))}_{int(np.floor(center[2] / 512))}"
    grouped_shops.setdefault(identity, []).append(field)
  for identity, shop_fields in sorted(grouped_shops.items()):
    verified = []
    for mode in ("drawn", "minecraft"):
      path = OUT / f"{identity}.{mode}.json.gz"
      if not path.exists():
        continue
      chunk = read(path)
      origin = np.array(chunk["origin"])
      fields, selected, guards = [], [], []
      for mesh, part in enumerate(chunk["meshes"]):
        if part["kind"] not in {
          "city-west-street-fronts-v163",
          "tauentzien-street-fronts-v165",
        }:
          continue
        points, colors, indices = decode(part, origin)
        glass = [t for t in indices if all(tuple(colors[i]) == GLASS for i in t)]
        triangles = {key(points[t]) for t in glass}
        start = len(fields)
        if mode == "drawn":
          # Later terrain refinements can translate a complete source building.
          # Match its exact delivered XZ and pane height, taking Y only from the
          # delivered glass vertices rather than restoring an obsolete altitude.
          delivered_y: dict[tuple, set] = {}
          for vertex in {int(i) for t in glass for i in t}:
            q = points[vertex]
            delivered_y.setdefault(
              tuple(np.rint(q[[0, 2]] * 100).astype(int)), set()
            ).add(q[1])
          for record in shop_fields:
            if record["kind"] != part["kind"]:
              continue
            p = np.rint((np.array(record["points"]) - origin) * 100) / 100 + origin
            offset = 0.0
            if not rectangle_exists(p, triangles):
              candidates_y = delivered_y.get(
                tuple(np.rint(p[0, [0, 2]] * 100).astype(int)), set()
              )
              matches_y = []
              for y in candidates_y:
                shifted = p + np.array([0, y - p[0, 1], 0])
                if rectangle_exists(shifted, triangles):
                  matches_y.append((abs(y - p[0, 1]), y - p[0, 1], shifted))
              if not matches_y:
                continue
              _, offset, p = min(matches_y, key=lambda item: item[0])
            center = np.mean(p, axis=0)
            if any(
              np.linalg.norm(center[[0, 2]] - (np.array([d[0], d[2]]) + origin[[0, 2]]))
              < 2.2
              for d in doors.get(identity, {}).get(mode, {}).get("doors", [])
            ):
              continue
            record = {**record, "sourceVerticalOffsetM": round(offset, 3)}
            verified.append({**record, "points": p.tolist()})
            fields.append(plan(p, record["normal"], record["owner"], origin))
            selected.append({**record, "points": p.tolist()})
        else:
          matches_here = [f for f in verified if f["kind"] == part["kind"]]
          if not matches_here:
            continue
          centers = np.array([np.mean(f["points"], axis=0) for f in matches_here])
          tree = STRtree([Point(p[[0, 2]]) for p in centers])
          faces: dict[tuple, list] = {}
          for triangle in glass:
            p = points[triangle]
            normal = np.cross(p[1] - p[0], p[2] - p[0])
            length = np.linalg.norm(normal)
            if length < 0.01:
              continue
            normal /= length
            if abs(normal[1]) > 0.001 or np.count_nonzero(np.abs(normal) > 0.001) != 1:
              continue
            bounds = tuple(
              np.rint(np.concatenate([p.min(axis=0), p.max(axis=0)]) * 100).astype(int)
            )
            faces.setdefault((bounds, tuple(normal)), []).append(p)
          for (bounds, normal), pair in faces.items():
            if len(pair) != 2:
              continue
            p = np.unique(np.vstack(pair), axis=0)
            if len(p) != 4:
              continue
            center = p.mean(axis=0)
            matches = [
              matches_here[i]
              for i in tree.query(Point(center[[0, 2]]).buffer(2.6))
              if np.linalg.norm(centers[i] - center) < 2.6
              and abs(centers[i, 1] - center[1]) < 1.65
              and np.dot(normal, matches_here[i]["normal"]) > 0.55
            ]
            if not matches:
              continue
            record = min(
              matches,
              key=lambda f: np.linalg.norm(np.mean(f["points"], axis=0) - center),
            )
            if any(
              np.linalg.norm(center[[0, 2]] - (np.array([d[0], d[2]]) + origin[[0, 2]]))
              < 2.2
              for d in doors.get(identity, {}).get(mode, {}).get("doors", [])
            ):
              continue
            fields.append(plan(p, normal, record["owner"], origin))
            selected.append(
              {
                "owner": record["owner"],
                "section": record["section"],
                "cellFace": [int(v) for v in bounds],
                "normal": list(normal),
              }
            )
        if len(fields) > start:
          guards.append(
            {
              "mesh": mesh,
              "kind": part["kind"],
              "fingerprint": fingerprint(
                [part["positions"], part["colors"], part["indices"]]
              ),
            }
          )
      save(
        f"{mode}:{identity}",
        {"origin": chunk["origin"], "guards": guards},
        fields,
        selected,
      )

  grouped: dict[str, list] = {}
  for face in district["faces"]:
    if face["streetName"] == "Kantstraße":
      grouped.setdefault(face["chunk"], []).append(face)
  for identity, faces in sorted(grouped.items()):
    base = read(OUT / f"{identity}.drawn.json.gz")
    buildings = {b["sourceId"]: b for b in base["nav"]["buildings"]}
    for mode in ("drawn", "minecraft"):
      native = mode == "minecraft"
      companion = f"district188-{identity}"
      chunk = read(OUT / f"{companion}.{mode}.json.gz")
      if not chunk["meshes"]:
        continue
      part = chunk["meshes"][0]
      points, _, indices = decode(part, np.array(chunk["origin"]))
      triangles = {key(points[t]) for t in indices}
      fields, selected = [], []
      for face in faces:
        building = buildings.get(face["owner"])
        if building is None:
          continue
        footprint = translate(
          Polygon(building["ring"], building["holes"]),
          base["origin"][0],
          base["origin"][2],
        )
        matched = [
          v["id"] for v in venues if footprint.buffer(0.5).covers(shape(v["geometry"]))
        ]
        spans = face["nativeSpans"] if native else [face]
        for span in spans:
          captured = Capture()
          window_grid(captured, span, native)
          if not captured.fields:
            continue
          lowest = min(float(np.mean(p, axis=0)[1]) for p in captured.fields)
          for p in captured.fields:
            if abs(np.mean(p, axis=0)[1] - lowest) > 0.01:
              continue
            # Omitted/occluded v188 columns and any later mapped door win.
            origin = np.array(chunk["origin"])
            p = np.rint((p - origin) * 100) / 100 + origin
            if not rectangle_exists(p, triangles):
              continue
            center = np.mean(p, axis=0)
            if any(
              np.linalg.norm(
                center[[0, 2]]
                - (np.array([d[0], d[2]]) + np.array(base["origin"])[[0, 2]])
              )
              < 2.2
              for d in doors.get(identity, {}).get(mode, {}).get("doors", [])
            ):
              continue
            normal = [span["normal"][0], 0, span["normal"][1]]
            field = plan(p, normal, face["owner"], np.array(chunk["origin"]))
            field[9] = 2 if matched else 1
            fields.append(field)
            selected.append(
              {
                "owner": face["owner"],
                "section": "Kantstraße",
                "points": p.tolist(),
                "normal": normal,
                "commercialPoiIds": matched,
                "role": "retained lower opening; use unassigned"
                if not matched
                else "retained lower opening; mapped commercial use",
              }
            )
      save(
        f"{mode}:{companion}",
        {
          "origin": chunk["origin"],
          "guards": [
            {
              "mesh": 0,
              "kind": part["kind"],
              "fingerprint": fingerprint(
                [part["positions"], part["colors"], part["indices"]]
              ),
            }
          ],
        },
        fields,
        selected,
      )
  RUNTIME.write_text(
    json.dumps(
      {"schema": 1, "ids": sorted(packets), "packets": packets}, separators=(",", ":")
    )
    + "\n"
  )
  proof = {
    "schema": 1,
    "policy": "Only existing verified openings receive narrow fittings. "
    "No new window, door, shop name or tenant. Dimensions and material tones are display estimates. "
    "Original source packets, v235 glazing/profiles and v188 opening grids remain unchanged. "
    "Kant commercial cues require a retained shop/food/drink POI inside the exact source owner; "
    "other Kant openings receive only neutral reveal frames. Native faces are independently orthogonal.",
    "sources": {s: digest(GEO / s) for s in sources},
    "statistics": dict(counts),
    "kantRoads": road_records,
    "kantCommercialEvidence": venues,
    "packets": receipts,
  }
  EVIDENCE.write_bytes(
    gzip.compress(json.dumps(proof, separators=(",", ":")).encode(), mtime=0)
  )
  print(
    json.dumps(
      {
        "packets": len(packets),
        "runtimeBytes": RUNTIME.stat().st_size,
        "evidenceBytes": EVIDENCE.stat().st_size,
        "statistics": dict(counts),
      }
    )
  )


if __name__ == "__main__":
  main()
