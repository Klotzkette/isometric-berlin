"""Step 10: retained northern shopfronts, with source-bound lower-wall gaps.

No old packet or descriptor is rewritten. OSM retail points establish use, not
surveyed opening positions; each small fitting is an explicit display estimate.
"""

from __future__ import annotations

import json
import math
from collections import Counter

import build_district_facades_v188 as base
import numpy as np
import pyogrio
from build_danziger_fronts_v244 import grid_shape, tags
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "north-shopfronts-v254-source.json.gz"
EVIDENCE = GEO / "north-shopfronts-v254-evidence.json"
RUNTIME = ROOT / "src/app/src/data/northShopfrontsV254.json"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
POLICY = (
  "Preserve all source shells, existing panes, plinths, earlier fittings and courts. "
  "Retained OSM shop/food-service points bind only to their existing source owner "
  "and named street face. Lower shop glazing occupies a verified empty vertical "
  "band above the retained plinth and below earlier windows. Aperture position, "
  "size, blank fascia and trim are explicit display estimates, not a facade survey "
  "or a current-tenant claim. Native uses independently orthogonal blocks. Both "
  "families share NorthV185 batches, disposal and unchanged live limits."
)
INPUTS = [
  GEO / "tor-fronts-v244-source.json.gz",
  GEO / "kiez-facades-v209-evidence.json.gz",
  GEO / "danziger-fronts-v244-source.json.gz",
  GEO / "tor-landmark-v245-source.json.gz",
  GEO / "danziger-landmark-v245-source.json.gz",
  GEO / "kulturbrauerei-v252-source.json.gz",
  ROOT / "src/app/src/data/houseDoorsV233.json",
]
STREETS = {"Kastanienallee", "Danziger Straße"}


def lowest_pane(face: dict, native: bool, kiez: bool) -> float:
  """Bottom of the exact earlier row, including its retained sill clearance."""
  height, width = face["high"] - face["low"], math.dist(face["a"], face["b"])
  if kiez:
    rows = max(1, int((height - 1.5) / (4 if native else 3.6)))
    center = face["low"] + 1.5 + 0.5 * (height - 2.4) / rows
  else:
    rows, _ = grid_shape(face, native)
    center = face["low"] + 1.4 + 0.5 * (height - 2.6) / rows
  assert width > 0
  return center - (0.7 if native else 0.9)


def fit(
  face: dict, point: list[float], kiez: bool, native: bool = False
) -> dict | None:
  """Fit one estimated opening in the free band; retain every earlier pane."""
  a, b, normal = (np.array(face[key]) for key in ("a", "b", "normal"))
  width = float(np.linalg.norm(b - a))
  if width < 3.2:
    return None
  tangent = (b - a) / width
  w = min(2.8, width - 0.8)
  u = max(
    w / 2 + 0.28, min(width - w / 2 - 0.28, float(np.dot(np.array(point) - a, tangent)))
  )
  old_bottom = lowest_pane(face, native, kiez)
  bottom = face["low"] + 1.10
  top = min(face["low"] + 2.45, old_bottom - 0.38)
  if top - bottom < 0.9:
    return None
  center = a + tangent * u
  return {
    "owner": face["owner"],
    "street": face.get("streetName", ""),
    "c": [float(center[0]), (bottom + top) / 2, float(center[1])],
    "t": tangent.tolist(),
    "n": normal.tolist(),
    "w": w,
    "h": top - bottom,
    "out": 0.13,
    "existing": False,
    "oldPaneBottom": old_bottom,
    "wallLow": face["low"],
    "u": u,
    "face": face,
  }


def extract() -> dict:
  """Freeze finite bindings and source/packet preservation receipts."""
  tor, kiez, danziger, _, _, kultur, door_data = [base.read_json(p) for p in INPUTS]
  manifest = {d["id"]: d for d in base.read_json(OUT / "manifest.json")["chunks"]}
  faces = [
    {**f, "kiez": True}
    for f in kiez["faces"]
    if f["streetName"] == "Kastanienallee" and not f["previousV188"]
  ] + [{**f, "kiez": False} for f in danziger["faces"]]
  protected = {f["owner"] for f in kultur["faces"]}
  faces = [f for f in faces if f["owner"] not in protected]
  receipts, owners, all_polys = {}, {}, []
  for chunk in sorted({f["chunk"] for f in faces}):
    desc = manifest[chunk]
    for family in ("drawn", "minecraft"):
      path = OUT / desc[family]["url"]
      receipts[str(path.relative_to(ROOT))] = base.digest(path)
    packet = base.read_json(OUT / desc["drawn"]["url"])
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if poly.is_valid and not poly.is_empty:
        owners.setdefault(b["sourceId"], []).append(poly)
        all_polys.append(poly)
  occupied = STRtree(all_polys)
  raw = pyogrio.read_dataframe(PBF, layer="points", bbox=(13.38, 52.525, 13.46, 52.55))
  projection = Transformer.from_crs(4326, 25833, always_xy=True)
  points, entrances = [], []
  for r in raw.itertuples():
    t = tags(r.other_tags) if isinstance(r.other_tags, str) else {}
    if t.get("entrance") and t["entrance"] != "no":
      x, y = projection.transform(r.geometry.x, r.geometry.y)
      entrances.append({"osmId": str(r.osm_id), "point": [x - 389500, 5820000 - y]})
    street = t.get("addr:street")
    if street not in STREETS or t.get("level", "0") not in {"0", "ground"}:
      continue
    use = t.get("shop")
    if not use or use in {"no", "vacant"}:
      use = t.get("amenity")
      if use not in {"cafe", "restaurant", "bar", "fast_food", "pub", "ice_cream"}:
        continue
    x, y = projection.transform(r.geometry.x, r.geometry.y)
    points.append(
      {
        "osmId": str(r.osm_id),
        "street": street,
        "use": use,
        "point": [x - 389500, 5820000 - y],
        "sourceCoordinate": [r.geometry.x, r.geometry.y],
      }
    )
  # Actual retained entrance recipes also protect their independently snapped
  # native positions, which can differ from the source node by a grid cell.
  for chunk in door_data["chunks"].values():
    for plan in chunk.values():
      ox, _, oz = plan["origin"]
      entrances.extend(
        {"osmId": "retained-v233", "point": [d[0] + ox, d[2] + oz]}
        for d in plan["doors"]
      )
  entrance_tree = STRtree([Point(e["point"]) for e in entrances])
  selected, used, omissions = [], set(), Counter()
  for poi in sorted(points, key=lambda p: int(p["osmId"])):
    point = Point(poi["point"])
    matches = []
    for f in faces:
      if f["streetName"] != poi["street"]:
        continue
      # A retail point must lie in its existing building (1 m source alignment
      # tolerance), not merely be close to a neighbouring street frontage.
      if not any(poly.buffer(1).covers(point) for poly in owners.get(f["owner"], [])):
        continue
      distance = LineString([f["a"], f["b"]]).distance(point)
      if distance <= 12:
        matches.append((distance, f))
    if not matches or len({f["owner"] for _, f in matches}) != 1:
      omissions["noUnambiguousRetainedFront"] += 1
      continue
    _, face = min(matches, key=lambda item: item[0])
    opening = fit(face, poi["point"], face["kiez"])
    if opening is None:
      omissions["noClearVerticalBand"] += 1
      continue
    if len(
      entrance_tree.query(
        Point(opening["c"][0], opening["c"][2]).buffer(2.4),
        predicate="intersects",
      )
    ):
      omissions["mappedEntranceClearance"] += 1
      continue
    a, t, n = np.array(face["a"]), np.array(opening["t"]), np.array(opening["n"])
    left = a + t * (opening["u"] - opening["w"] / 2 - 0.1)
    right = a + t * (opening["u"] + opening["w"] / 2 + 0.1)
    approach = Polygon(
      [left + n * 0.2, right + n * 0.2, right + n * 1.0, left + n * 1.0]
    )
    if len(occupied.query(approach, predicate="intersects")):
      omissions["obstructedFront"] += 1
      continue
    # One opening per short facade segment. Multiple POIs are not evidence of
    # multiple measured doors/windows; nearby inferred rectangles cannot overlap.
    key = (face["owner"], tuple(face["a"]), tuple(face["b"]))
    if key in used:
      omissions["sameFrontAlreadyRepresented"] += 1
      continue
    used.add(key)
    native = None
    spans = sorted(
      face["nativeSpans"], key=lambda s: LineString([s["a"], s["b"]]).distance(point)
    )
    for span in spans:
      native = fit(
        {**span, "owner": face["owner"], "streetName": poi["street"]},
        poi["point"],
        face["kiez"],
        True,
      )
      if native is not None:
        break
    if native is None:
      # Kastanienallee v209 has no independent native pane spans; a separate
      # staircase at the earlier v239 facade offset avoids diagonal native faces.
      native = fit(face, poi["point"], face["kiez"], True)
      if native is not None:
        native["out"] = 1.08
    if native is None:
      omissions["noNativeFit"] += 1
      continue
    if len(
      entrance_tree.query(
        Point(native["c"][0], native["c"][2]).buffer(2.4),
        predicate="intersects",
      )
    ):
      omissions["nativeEntranceClearance"] += 1
      continue
    selected.append({"poi": poi, "drawn": opening, "native": native})
  tor_panes = [w for w in tor["windows"] if w["role"] == "shopfront glazing"]
  # Receipts retain all supporting earlier companion bytes, not only their
  # geometry sources. No new packet replaces any of these layers.
  receipts.update(tor["unchangedPackets"])
  for d in [
    *kiez["companions"],
    *base.read_json(GEO / "danziger-fronts-v244-manifest-addition.json")["chunks"],
    *base.read_json(GEO / "tor-fronts-v244-manifest-addition.json")["chunks"],
  ]:
    for family in ("drawn", "minecraft"):
      path = OUT / d[family]["url"]
      receipts[str(path.relative_to(ROOT))] = base.digest(path)
  nearby_entrances = set()
  for shop in selected:
    for family in ("drawn", "native"):
      c = shop[family]["c"]
      nearby_entrances.update(
        int(i) for i in entrance_tree.query(Point(c[0], c[2]).buffer(15))
      )
  result = {
    "schemaVersion": 1,
    "policy": POLICY,
    "shops": selected,
    "torPanes": tor_panes,
    "omissions": dict(omissions),
    "protectedV252Owners": sorted(protected),
    "protectedEntrances": [entrances[i] for i in sorted(nearby_entrances)],
    "packetReceipts": receipts,
    "inputReceipts": {str(p.relative_to(ROOT)): base.digest(p) for p in INPUTS},
    "osmSnapshot": {
      "path": str(PBF.relative_to(ROOT)),
      "sha256": base.digest(PBF),
      "date": "2026-09-29",
    },
  }
  base.write_json(SOURCE, result)
  return result


def build() -> dict:
  """Replay the bounded frozen source without fetching or rewriting old assets."""
  source = base.read_json(SOURCE) if SOURCE.exists() else extract()
  for path, expected in {**source["inputReceipts"], **source["packetReceipts"]}.items():
    assert base.digest(ROOT / path) == expected, path
  payload = {"policy": POLICY, "drawn": [], "native": []}
  for family in ("drawn", "native"):
    for w in source["torPanes"]:
      payload[family].append(
        {
          "owner": w["owner"],
          "street": "Torstraße",
          "c": w["center"],
          "t": [w["tangent"][0], w["tangent"][2]],
          "n": [w["normal"][0], w["normal"][2]],
          "w": w["width"],
          "h": w["height"],
          "out": 1.07 if family == "native" else 0.12,
          "existing": True,
        }
      )
    for shop in source["shops"]:
      payload[family].append(
        {
          k: v
          for k, v in shop[family].items()
          if k not in {"face", "u", "wallLow", "oldPaneBottom"}
        }
      )
  counts = {
    "existingTorPanes": len(source["torPanes"]),
    "newShopfronts": dict(Counter(s["poi"]["street"] for s in source["shops"])),
    "retainedOsmPoints": len(source["shops"]),
    "newDescriptors": 0,
  }
  payload["counts"] = counts
  payload["cameras"] = [
    {"name": "Tor shopfronts", "eye": [2625, 12, -1060], "target": [2625, 5, -1018]},
    *[
      {
        "name": s["poi"]["street"],
        "eye": [
          s["drawn"]["c"][0] + s["drawn"]["n"][0] * 35,
          12,
          s["drawn"]["c"][2] + s["drawn"]["n"][1] * 35,
        ],
        "target": s["drawn"]["c"],
      }
      for street in sorted(STREETS)
      for s in source["shops"]
      if s is next((p for p in source["shops"] if p["poi"]["street"] == street), None)
    ],
  ]
  base.write_json(RUNTIME, payload)
  evidence = {
    "policy": POLICY,
    "counts": counts,
    "omissions": source["omissions"],
    "runtimeBytes": RUNTIME.stat().st_size,
    "sourceSha256": base.digest(SOURCE),
    "preservation": "All old packet/source bytes, pane positions, plinths, roofs, courts and descriptors retained.",
    "sourceLicences": [
      "OpenStreetMap contributors, ODbL-1.0",
      "Geoportal Berlin LoD2, dl-de/zero-2-0",
    ],
    "limitations": [
      "OSM snapshot is 29 September 2026; no claim about today's tenants.",
      "Small storefront openings and trim dimensions are estimates, not surveyed apertures.",
      "Tor retains its 220 previously modelled shopfront panes; only outer trim is added.",
      "Kastanienallee lacks earlier native pane spans; independent staircase blocks follow its retained source face.",
    ],
  }
  base.write_json(EVIDENCE, evidence)
  print(json.dumps(evidence, ensure_ascii=False, indent=2))
  return payload


if __name__ == "__main__":
  build()
