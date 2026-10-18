"""Step 10: map real OSM entrances onto retained ordinary-house wall sheets."""

from __future__ import annotations

import base64
import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from typing import Any

import numpy as np
import pyogrio
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

from scripts import build_district_facades_v188 as base

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CONTEXT = GEO / "house-doors-v233-context.json.gz"
EVIDENCE = GEO / "house-doors-v233-evidence.json.gz"
OUTPUT = ROOT / "src/app/src/data/houseDoorsV233.json"
SOUTHWEST = {
  "Steglitz",
  "Lichterfelde",
  "Lankwitz",
  "Zehlendorf",
  "Dahlem",
  "Nikolassee",
  "Wannsee",
  "Schlachtensee",
}
POLICY = (
  "Only retained ordinary building walls with positively mapped ground-floor "
  "OSM entrances. Door position follows the mapped node projected at most 0.35m "
  "onto a verified delivered source wall. Width 1.1m, height 2.25m and framing "
  "are restrained display estimates, not measured opening dimensions. Existing "
  "source sheets, prior detail, navigation and residency budgets remain intact."
)


def regions() -> dict[str, Any]:
  """Reuse exact retained ALKIS district rings; no inferred coverage expansion."""
  result = {}
  for feature in base.read_json(GEO / "house-districts-v233.geojson")["features"]:
    result[feature["properties"]["nam"]] = base.world(shape(feature["geometry"]))
  return result


def extract_context() -> None:
  """Retain bounded public entrance geometry, no addresses or occupant fields."""
  area = unary_union(list(regions().values()))
  source = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
  nodes = pyogrio.read_dataframe(
    source,
    layer="points",
    where="other_tags LIKE '%\"entrance\"%'",
    columns=["osm_id", "other_tags"],
  ).to_crs(25833)
  entrances = []
  for node in nodes.itertuples():
    tags = dict(re.findall(r'"([^"]+)"=>"([^"]*)"', node.other_tags or ""))
    if tags.get("entrance") not in {"yes", "main", "home", "staircase"}:
      continue
    if (
      tags.get("level", "0") not in {"0", "0.0"}
      or tags.get("indoor") == "yes"
      or "railway" in tags
      or "public_transport" in tags
    ):
      continue
    point = base.world(node.geometry)
    if area.covers(point):
      entrances.append(
        {
          "id": "node/" + node.osm_id,
          "point": [point.x, point.y],
          "tags": {
            k: tags[k]
            for k in ("entrance", "level", "door", "material", "colour")
            if k in tags
          },
        }
      )
  points = [Point(*r["point"]) for r in entrances]
  tree = STRtree(points)
  southwest = unary_union([p for name, p in regions().items() if name in SOUTHWEST])

  def building_rows():
    for cache in ("outer-v159", "outskirts-v187"):
      frame = pyogrio.read_dataframe(
        GEO / "raw" / cache / "candidate.gpkg",
        layer="multipolygons",
        where="building IS NOT NULL",
      ).to_crs(25833)
      for row in frame.itertuples():
        yield cache, row

  owners, seen = [], set()
  for cache, row in building_rows():
    if row.building not in {
      "yes",
      "apartments",
      "residential",
      "house",
      "detached",
      "terrace",
    }:
      continue
    if any(
      isinstance(getattr(row, key, None), str) for key in ("name", "amenity", "tourism")
    ):
      continue
    polygon = base.world(row.geometry)
    if not polygon.is_valid:
      continue
    owner = (
      "way/" + row.osm_way_id
      if isinstance(row.osm_way_id, str)
      else "relation/" + str(row.osm_id)
    )
    if owner in seen or (
      cache == "outskirts-v187" and not southwest.covers(polygon.representative_point())
    ):
      continue
    refs = [
      int(i) for i in tree.query(polygon.boundary.buffer(0.08), predicate="intersects")
    ]
    if refs:
      seen.add(owner)
      owners.append(
        {
          "id": owner,
          "geometry": mapping(polygon),
          "entrances": refs,
        }
      )
  used = sorted({i for row in owners for i in row["entrances"]})
  remap = {old: i for i, old in enumerate(used)}
  for row in owners:
    row["entrances"] = [remap[i] for i in row["entrances"]]
  base.write_json(
    CONTEXT,
    {
      "schemaVersion": 1,
      "policy": POLICY,
      "source": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
      "license": "ODbL-1.0",
      "sourceSha256": base.digest(source),
      "buildingSourceSha256": base.digest(GEO / "raw/outer-v159/candidate.gpkg"),
      "outerBuildingSourceSha256": base.digest(
        GEO / "raw/outskirts-v187/candidate.gpkg"
      ),
      "districts": sorted(regions()),
      "entrances": [entrances[i] for i in used],
      "buildings": owners,
    },
  )


def nav_fingerprint(nav: dict) -> int:
  """Compact stable guard over source owner coordinates/heights, not scene data."""
  value = 2166136261

  def feed(text: str) -> None:
    nonlocal value
    for char in text:
      value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF

  def numbers(values: list) -> None:
    feed(",".join(str(math.floor(float(v) * 1000 + 0.5)) for v in values) + ";")

  numbers([nav["groundY"]])
  for building in nav["buildings"]:
    feed(building["sourceId"] + ";")
    numbers(
      [building["minHeight"], building["height"], building.get("groundOffset", 0)]
    )
    for ring in [building["ring"], *building["holes"]]:
      feed("[")
      for point in ring:
        numbers(point)
      feed("]")
  return value


def triangles(packet: dict) -> set[tuple]:
  """Only existing city shell triangles; no overlay, fitting or invented wall."""
  result = set()
  for part in packet["meshes"]:
    if part["kind"] not in {"city", "alt-mitte-v169"}:
      continue
    positions = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
    indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
    for tri in indices:
      p = positions[tri]
      if np.ptp(p[:, 1]) > 250:
        result.add(tuple(sorted(tuple(map(int, v)) for v in p)))
  return result


def door_face(
  packet: dict,
  building: dict,
  node: list,
  sheets: set,
  native: bool = False,
  normal: list | None = None,
) -> dict | None:
  """Choose a unique actual wall near the mapped entrance; reject seam/corner."""
  ox, oy, oz = packet["origin"]
  low = (
    packet["nav"]["groundY"] + building.get("groundOffset", 0) + building["minHeight"]
  )
  high = packet["nav"]["groundY"] + building.get("groundOffset", 0) + building["height"]
  if building["minHeight"] > 0.1 or not 3 <= high - low <= 38:
    return None
  polygon = translate(Polygon(building["ring"], building["holes"]), ox, oz)
  point = Point(*node)
  candidates = []
  ring = building["ring"]
  for a, b in zip(ring, ring[1:] + ring[:1]):
    if native and a[0] != b[0] and a[1] != b[1]:
      continue
    if not base.source_wall_exists(sheets, a, b, low - oy, high - oy):
      continue
    wa, wb = np.array(a) + [ox, oz], np.array(b) + [ox, oz]
    edge = LineString([wa, wb])
    length = edge.length
    distance, u = edge.distance(point), edge.project(point)
    if distance > (1.6 if native else 0.35) or not 0.66 < u < length - 0.66:
      continue
    d = (wb - wa) / length
    n = np.array([-d[1], d[0]])
    center = wa + d * u
    if polygon.covers(Point(*(center + n * 0.2))):
      n = -n
    if normal is not None and np.dot(n, normal) < 0.65:
      continue
    candidates.append(
      (
        distance,
        {
          "owner": building["sourceId"],
          "a": wa.tolist(),
          "b": wb.tolist(),
          "normal": n.tolist(),
          "point": center.tolist(),
          "low": low,
          "high": high,
          "offset": distance,
          "width": 1.1,
          "height": 2.25,
        },
      )
    )
  candidates.sort(key=lambda row: row[0])
  if (
    not candidates
    or len(candidates) > 1
    and abs(candidates[0][0] - candidates[1][0]) < 0.05
  ):
    return None
  return candidates[0][1]


def fits_packet(face: dict, origin: list) -> bool:
  """Do not wrap a narrow tile-edge fitting through unsigned centimetres."""
  d = np.array(face["b"]) - face["a"]
  d /= np.linalg.norm(d)
  n = np.array(face["normal"])
  center = np.array(face["point"]) - [origin[0], origin[2]]
  margin = np.abs(d) * 0.63 + np.abs(n) * 0.085
  return bool(
    np.all(center - margin >= 0.005)
    and np.all(center + margin <= 655.345)
    and 0 <= face["low"] - origin[1] <= 652.9
  )


def recipe_digest(rows: list) -> str:
  return hashlib.sha256(json.dumps(rows, separators=(",", ":")).encode()).hexdigest()


def retain_previous_recipes(runtime: dict, previous: dict) -> None:
  """An additive district supplement keeps every previously delivered row first."""
  for chunk, entry in previous.items():
    for family, old in entry.items():
      current = runtime[chunk][family]
      if old["origin"] != current["origin"] or old["guard"] != current["guard"]:
        raise ValueError(f"Prior entrance source changed: {chunk}/{family}")
      old_rows = {tuple(row) for row in old["doors"]}
      if not old_rows.issubset(tuple(row) for row in current["doors"]):
        raise ValueError(f"Prior entrance lost: {chunk}/{family}")
      current["doors"] = old["doors"] + [
        row for row in current["doors"] if tuple(row) not in old_rows
      ]


def build() -> dict:
  """Read immutable packet shells; emit small recipes, never regenerate them."""
  if not CONTEXT.exists():
    extract_context()
  context = base.read_json(CONTEXT)
  district = regions()
  if context.get("districts") != sorted(district) or not context.get(
    "outerBuildingSourceSha256"
  ):
    extract_context()
    context = base.read_json(CONTEXT)
  previous_runtime = base.read_json(OUTPUT)["chunks"] if OUTPUT.exists() else {}
  old_evidence = base.read_json(EVIDENCE) if EVIDENCE.exists() else {}
  preserved = old_evidence.get("preservedV133")
  if preserved is None and previous_runtime:
    preserved = {
      "runtimeSha256": base.digest(OUTPUT),
      "chunks": {
        chunk: {
          family: {"count": len(plan["doors"]), "sha256": recipe_digest(plan["doors"])}
          for family, plan in entry.items()
        }
        for chunk, entry in previous_runtime.items()
      },
    }
  area = unary_union(list(district.values()))
  mapped = [shape(row["geometry"]) for row in context["buildings"]]
  mapped_tree = STRtree(mapped)
  protected = set(base.read_json(base.CONTEXT)["authoredIds"])
  # Dedicated modern source owners are protected even if added after v188.
  for path in list((ROOT / "src/app/src").glob("*.ts")) + list(
    (ROOT / "src/app/src/data").glob("*.json")
  ):
    if path.name not in {"houseDoorsV233.json", "buildingAttributeSource.json"}:
      protected.update(re.findall(r"\bDEBE[A-Za-z0-9]+", path.read_text()))
  roof_source = GEO / "roof-house-v233-source.json.gz"
  if roof_source.exists():
    protected.update(row["owner"] for row in base.read_json(roof_source)["owners"])
  manifest = base.read_json(OUT / "manifest.json")
  descriptors = [
    d
    for d in manifest["chunks"]
    if not d.get("detailCompanionOf") and area.intersects(box(*d["bounds"]))
  ]
  accepted, sources = {}, {}
  for desc in descriptors:
    packet = base.read_json(OUT / desc["drawn"]["url"])
    if not any(p["kind"] in {"city", "alt-mitte-v169"} for p in packet["meshes"]):
      continue
    sheets = triangles(packet)
    if not sheets:
      continue
    ox, _, oz = packet["origin"]
    for building in packet["nav"]["buildings"]:
      if building["sourceId"] in protected:
        continue
      poly = translate(Polygon(building["ring"], building["holes"]), ox, oz)
      if not poly.is_valid or poly.area < 30:
        continue
      region = next(
        (name for name, p in district.items() if p.covers(poly.representative_point())),
        None,
      )
      if not region:
        continue
      matches = []
      for i in mapped_tree.query(poly):
        overlap = poly.intersection(mapped[i]).area
        if overlap / poly.area >= 0.90 and overlap / mapped[i].area >= 0.70:
          matches.append(int(i))
      if len(matches) != 1:
        continue
      i = matches[0]
      for ref in context["buildings"][i]["entrances"]:
        node = context["entrances"][ref]
        face = door_face(packet, building, node["point"], sheets)
        if face is None or not fits_packet(face, packet["origin"]):
          continue
        face.update(
          {
            "node": node["id"],
            "mappedPoint": node["point"],
            "mappedOwner": context["buildings"][i]["id"],
            "district": region,
            "chunk": desc["id"],
            "mappedBuildingIndex": i,
            "sourceRing": building,
          }
        )
        # A tile seam may repeat one source owner: retain one complete real wall.
        previous = accepted.get(node["id"])
        if previous and (previous["offset"], previous["chunk"]) <= (
          face["offset"],
          face["chunk"],
        ):
          continue
        accepted[node["id"]] = face
        sources[desc["id"]] = (desc, packet)
  by_chunk = defaultdict(list)
  for face in accepted.values():
    by_chunk[face["chunk"]].append(face)
  runtime, counts, evidence = {}, Counter(), []
  for chunk, faces in sorted(by_chunk.items()):
    desc, packet = sources[chunk]
    native_packet = base.read_json(OUT / desc["minecraft"]["url"])
    native_sheets = triangles(native_packet)
    rows_by_owner = defaultdict(list)
    for b in native_packet["nav"]["buildings"]:
      rows_by_owner[b["sourceId"]].append(b)
    draw, native = [], []
    for face in sorted(faces, key=lambda f: f["node"]):
      # Reject repeated doors closer than 1.5m instead of hiding one another.
      if any(
        math.dist(face["point"], f["point"]) < 1.5
        for f in evidence
        if f["chunk"] == chunk
      ):
        continue

      def recipe(f: dict, origin: list) -> list:
        direction = np.array(f["b"]) - f["a"]
        direction /= np.linalg.norm(direction)
        return [
          round(f["point"][0] - origin[0], 4),
          round(f["low"] - origin[1], 4),
          round(f["point"][1] - origin[2], 4),
          round(float(direction[0]), 7),
          round(float(direction[1]), 7),
          round(f["normal"][0], 7),
          round(f["normal"][1], 7),
        ]

      draw.append(recipe(face, packet["origin"]))
      options = [
        f
        for b in rows_by_owner[face["owner"]]
        if (
          f := door_face(
            native_packet, b, face["mappedPoint"], native_sheets, True, face["normal"]
          )
        )
        is not None
      ]
      options = [f for f in options if fits_packet(f, native_packet["origin"])]
      options.sort(key=lambda f: f["offset"])
      face["native"] = options[0] if options else None
      if options:
        native.append(recipe(options[0], native_packet["origin"]))
      counts[face["district"]] += 1
      evidence.append(face)
    if draw:
      runtime[chunk] = {
        "drawn": {
          "origin": packet["origin"],
          "guard": nav_fingerprint(packet["nav"]),
          "doors": draw,
        },
        "minecraft": {
          "origin": native_packet["origin"],
          "guard": nav_fingerprint(native_packet["nav"]),
          "doors": native,
        },
      }
  retain_previous_recipes(runtime, previous_runtime)
  result = {"schemaVersion": 1, "ids": list(runtime), "chunks": runtime}
  base.write_json(OUTPUT, result)
  base.write_json(
    EVIDENCE,
    {
      "schemaVersion": 1,
      "policy": POLICY,
      "contextSha256": base.digest(CONTEXT),
      "boundarySha256": base.digest(GEO / "house-districts-v233.geojson"),
      "counts": dict(counts),
      "doorCount": len(evidence),
      "nativeDoorCount": sum(len(v["minecraft"]["doors"]) for v in runtime.values()),
      "chunkCount": len(runtime),
      "runtimeBytes": OUTPUT.stat().st_size,
      "preservedV133": preserved,
      "doors": evidence,
      "oldAssets": [
        {"url": desc[f]["url"], "sha256": desc[f]["sha256"]}
        for desc, _ in sources.values()
        for f in ("drawn", "minecraft")
      ],
    },
  )
  return {
    "doors": len(evidence),
    "chunks": len(runtime),
    "counts": dict(counts),
    "bytes": OUTPUT.stat().st_size,
  }


if __name__ == "__main__":
  print(build())
