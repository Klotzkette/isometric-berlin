"""Step 10: small, source-bound recognition members for five existing schools."""

from __future__ import annotations

import copy
import gzip
import hashlib
import json
import math
from pathlib import Path
from typing import Any

import geopandas as gpd
import numpy as np
import pyogrio
from shapely.geometry import Point, Polygon, box
from shapely.ops import nearest_points, transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def digest(path: Path) -> str:
  """Fingerprint the source without changing it."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def source_parts() -> list[dict[str, Any]]:
  """Select existing delivered owners, including explicit legacy conflicts."""
  prisms_path = ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json"
  prisms = {p["id"]: p for p in json.loads(prisms_path.read_text())["buildings"]}
  schools: list[dict[str, Any]] = []

  def add(
    name: str, street: str, owner: str, source: Path, parts: list, style: str
  ) -> None:
    offsets = json.loads((DATA / "weinbergBuildingOffsetsV176.json").read_text())[
      "offsets"
    ]
    display_offset = offsets.get(owner, 0.0)
    parts = copy.deepcopy(parts)
    if display_offset:
      for part in parts:
        for surface in part["surfaces"]:
          for ring in surface["rings"]:
            for point in ring:
              point[1] += display_offset
    schools.append(
      {
        "name": name,
        "street": street,
        "owner": owner,
        "sourceFile": str(source.relative_to(ROOT)),
        "sourceSha256": digest(source),
        "parts": parts,
        "style": style,
        "displayTerrainOffsetY": display_offset,
      }
    )

  # These two official families have a documented legacy-mass conflict. Follow
  # the retained, rendered faces rather than attaching floating official faces.
  for name, street, pid, style in [
    ("Berlin Metropolitan School", "Linienstraße", "98765758", "copper"),
    ("Kastanienbaum Grundschule front", "Gipsstraße", "23991547", "brick"),
  ]:
    p = prisms[pid]
    poly = Polygon([(x / 10, z / 10) for x, z in p["ring"]])
    if not poly.exterior.is_ccw:
      poly = Polygon(list(poly.exterior.coords)[::-1])
    ring = list(poly.exterior.coords)
    lo, hi = p["y0_dm"] / 10, (p["y0_dm"] + p["h_dm"]) / 10
    surfaces = [
      {
        "kind": "WallSurface",
        "rings": [
          [[a[0], hi, a[1]], [b[0], hi, b[1]], [b[0], lo, b[1]], [a[0], lo, a[1]]]
        ],
      }
      for a, b in zip(ring, ring[1:])
    ]
    # Ring surfaces above have outward normals for the viewer's reversed Z.
    add(
      name,
      street,
      "OSM-way-" + pid,
      prisms_path,
      [{"id": pid, "surfaces": surfaces}],
      style,
    )

  for name, street, pid, tile in [
    ("Kastanienbaum Grundschule main", "Gipsstraße", "DEBE01YYK00001Eq", "391_5820"),
    ("John-Lennon-Gymnasium", "Zehdenicker Straße", "DEBE01YYK000064P", "391_5821"),
  ]:
    path = GEO / f"alt-mitte-v169/source-{tile}-00.json.gz"
    source = json.loads(gzip.decompress(path.read_bytes()))
    school = next(b for b in source["buildings"] if b["id"] == pid)
    assert school["category"] == "outer"
    add(name, street, pid, path, school["parts"], "brick")

  # The Steglitz file already includes the rigid display datum of the full
  # original LoD2 family. Its triangle sheets can be joined only when coplanar.
  path = DATA / "steglitzV182Source.json"
  source = json.loads(path.read_text())
  surfaces = []
  for s in source["surfaces"]:
    if s["owner"] != "DEBE06YYB0000AUq":
      continue
    # A source surface is already triangulated. Recover only its common wall
    # polygon from those exact triangles; no bounding-box facade is introduced.
    tris = s["triangles"]
    if not tris:
      continue
    pts = np.array(tris[0])
    n = np.cross(pts[1] - pts[0], pts[2] - pts[0])
    if np.linalg.norm(n) < 1e-6:
      continue
    n /= np.linalg.norm(n)
    if abs(n[1]) > 0.01:
      continue
    origin = pts[0]
    d = np.array([-n[2], 0, n[0]])
    polygons = [
      Polygon([(float(np.dot(np.array(p) - origin, d)), p[1]) for p in t]) for t in tris
    ]
    union = unary_union(polygons)
    for polygon in [union] if union.geom_type == "Polygon" else union.geoms:
      rings = []
      for ring in [polygon.exterior, *polygon.interiors]:
        rings.append(
          [
            [float(origin[0] + d[0] * u), y, float(origin[2] + d[2] * u)]
            for u, y in ring.coords
          ]
        )
      # Retain the original source normal explicitly after polygon union.
      surfaces.append({"kind": "WallSurface", "rings": rings, "normal": n.tolist()})
  add(
    "Gymnasium Steglitz",
    "Heesestraße",
    "DEBE06YYB0000AUq",
    path,
    [{"id": "DEBE06YYB0000AUq", "surfaces": surfaces}],
    "stone",
  )

  path = ROOT / "src/app/src/gymnasiumTiergartenSource.json"
  source = json.loads(path.read_text())
  parts = []
  for part in source["parts"]:
    parts.append(
      {
        "id": part["id"],
        "surfaces": [
          {
            **s,
            "rings": [
              [[x, y + source["display_y_translation_m"], z] for x, y, z in ring]
              for ring in s["rings"]
            ],
          }
          for s in part["surfaces"]
        ],
      }
    )
  add(
    "Gymnasium Tiergarten",
    "Altonaer Straße",
    source["parent_id"],
    path,
    parts,
    "modern",
  )
  return schools


def build() -> tuple[dict[str, Any], dict[str, Any]]:
  """Build clipped eave/corner members; never another window or building shell."""
  roads_frame = gpd.read_file(GEO / "osm.gpkg", layer="roads").to_crs(25833)
  boxes: list[list] = []
  native: list[list] = []
  evidence: list[dict] = []
  for school in source_parts():
    selected_roads = roads_frame.loc[
      roads_frame["name"] == school["street"], "geometry"
    ]
    if selected_roads.empty:
      surrounding = pyogrio.read_dataframe(
        GEO / "raw/outer-v159/berlin-260929.osm.pbf",
        layer="lines",
        bbox=(13.40, 52.525, 13.42, 52.54)
        if school["street"] == "Zehdenicker Straße"
        else (13.32, 52.445, 13.34, 52.46),
      ).to_crs(25833)
      selected_roads = surrounding.loc[
        surrounding["name"] == school["street"], "geometry"
      ]
    roads = unary_union(
      [transform(lambda x, y: (x - 389500, 5820000 - y), p) for p in selected_roads]
    )
    assert not roads.is_empty, school["street"]
    candidates = []
    for part in school["parts"]:
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        pts = np.array(surface["rings"][0])
        n = np.array(surface.get("normal", [0.0, 0.0, 0.0]))
        if "normal" not in surface:
          for i in range(1, len(pts) - 1):
            n += np.cross(pts[i] - pts[0], pts[i + 1] - pts[0])
        if np.linalg.norm(n) < 0.01:
          continue
        n /= np.linalg.norm(n)
        if abs(n[1]) > 0.03:
          continue
        a, b = max(
          ((a, b) for a in pts for b in pts),
          key=lambda ab: np.linalg.norm((ab[1] - ab[0])[[0, 2]]),
        )
        d = np.array([b[0] - a[0], 0, b[2] - a[2]])
        length = float(np.linalg.norm(d))
        if length < 9:
          continue
        d /= length
        wall = Polygon(
          [(float(np.dot(p - a, d)), p[1]) for p in pts],
          [
            [(float(np.dot(np.array(p) - a, d)), p[1]) for p in r]
            for r in surface["rings"][1:]
          ],
        ).buffer(0)
        left, base, right, top = wall.bounds
        if top - base < 6 or base > 8 + school["displayTerrainOffsetY"]:
          continue
        center = a + d * ((left + right) / 2)
        plan = Point(center[0], center[2])
        nearest = nearest_points(plan, roads)[1]
        toward = np.array([nearest.x - center[0], 0, nearest.y - center[2]])
        distance = float(np.linalg.norm(toward))
        if distance < 0.1 or distance > 100 or np.dot(toward, n) / distance < 0.55:
          continue
        candidates.append((length, distance, part["id"], surface, a, d, n, wall))
    # Prefer the actual long frontage, then at most two accompanying source wings.
    selected = sorted(candidates, key=lambda f: f[0] / (1 + f[1] / 100), reverse=True)[
      :3
    ]
    assert selected, school["name"]
    start, native_start = len(boxes), len(native)
    selected_evidence = []
    for _, _, pid, surface, a, d, n, wall in selected:
      left, base, right, top = wall.bounds
      yaw = -math.atan2(d[2], d[0])
      style = school["style"]
      cap = {
        "brick": 0xA87555,
        "copper": 0xA07459,
        "stone": 0xD6C5A4,
        "modern": 0xD5DDD8,
      }[style]
      shade = {
        "brick": 0x855A47,
        "copper": 0x6F6256,
        "stone": 0xA9977E,
        "modern": 0x879B9F,
      }[style]
      first = len(boxes)

      def member(
        u: float, y: float, w: float, h: float, depth: float, color: int
      ) -> None:
        rectangle = box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
        if not wall.buffer(0.00001).covers(rectangle):
          return
        p = a + d * u + n * (0.20 + depth / 2)
        boxes.append(
          [*[round(v, 3) for v in [p[0], y, p[2], w, h, depth]], round(yaw, 6), color]
        )
        # Axis-aligned surface-only blocks, never solid school infill.
        count = max(1, math.ceil(w / 0.9))
        for i in range(count):
          q = a + d * (u - w / 2 + (i + 0.5) * w / count) + n * 1.2
          native.append(
            [
              *[
                round(v, 3)
                for v in [
                  q[0],
                  y,
                  q[2],
                  max(0.22, abs(d[0]) * w / count),
                  h,
                  max(0.22, abs(d[2]) * w / count),
                ]
              ],
              color,
            ]
          )

      # Fine lips and masonry console course. All rectangles must lie fully on
      # an existing source face, keeping pitched gables and irregular setbacks.
      y = top - 0.46
      strip = wall.intersection(box(left + 0.15, y - 0.16, right - 0.15, y + 0.16))
      for polygon in (
        [strip] if strip.geom_type == "Polygon" else getattr(strip, "geoms", [])
      ):
        if polygon.geom_type != "Polygon":
          continue
        lo, _, hi, _ = polygon.bounds
        member((lo + hi) / 2, y, hi - lo, 0.28, 0.21, cap)
        member((lo + hi) / 2, y - 0.25, hi - lo, 0.12, 0.12, shade)
        if style != "modern":
          for i in range(max(1, int((hi - lo) / 2.4))):
            u = lo + (i + 0.5) * (hi - lo) / max(1, int((hi - lo) / 2.4))
            member(u, y - 0.5, 0.22, 0.34, 0.25, cap)
      # Narrow corner reveals distinguish wings without repainting any pane.
      for u in [left + 0.27, right - 0.27]:
        member(u, (base + top) / 2, 0.26, top - base - 0.8, 0.11, cap)
      selected_evidence.append(
        {
          "partId": pid,
          "rings": surface["rings"],
          "normal": n.tolist(),
          "firstBox": first,
          "boxCount": len(boxes) - first,
        }
      )
    evidence.append(
      {k: v for k, v in school.items() if k != "parts"}
      | {
        "faces": selected_evidence,
        "firstBox": start,
        "boxCount": len(boxes) - start,
        "firstNative": native_start,
        "nativeCount": len(native) - native_start,
      }
    )
  return {
    "schemaVersion": 1,
    "boxes": boxes,
    "nativeRows": native,
    "schools": [
      {
        k: s[k]
        for k in ["name", "owner", "firstBox", "boxCount", "firstNative", "nativeCount"]
      }
      for s in evidence
    ],
  }, {
    "schemaVersion": 1,
    "schools": evidence,
    "policy": "Additive shallow eave lips, console course and narrow end reveals only. No new shell, window, door, court fill, height or navigation obstacle. Fine member dimensions and restrained tones are procedural recognition estimates, not a measured facade survey.",
    "sourceLicenses": {"Berlin LoD2": "dl-de/zero-2-0", "OpenStreetMap": "ODbL-1.0"},
  }


def main() -> None:
  """Write independent bounded arrays; all delivered city packets stay unchanged."""
  model, evidence = build()
  for path, value in [
    (DATA / "schoolsV185.json", model),
    (GEO / "schools-v185-evidence.json", evidence),
  ]:
    path.write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")
  print(
    {
      "drawn": len(model["boxes"]),
      "native": len(model["nativeRows"]),
      "schools": [(s["name"], s["boxCount"]) for s in evidence["schools"]],
    }
  )


if __name__ == "__main__":
  main()
