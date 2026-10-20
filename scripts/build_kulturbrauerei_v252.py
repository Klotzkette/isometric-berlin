"""Step 10: Kulturbrauerei and its three named street approaches.

All old packets remain immutable. Measured faces select only genuinely bare
ordinary fronts; small opening dimensions remain display estimates.
"""

from __future__ import annotations

import base64
import json
import math
from collections import Counter, defaultdict

import build_district_facades_v188 as base
import numpy as np
import pyogrio
from build_danziger_fronts_v244 import grid_shape, omitted_columns, tags, wall_key
from build_roof_house_v233 import protected_ids
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "kulturbrauerei-v252-source.json.gz"
EVIDENCE = GEO / "kulturbrauerei-v252-evidence.json"
DATA = ROOT / "src/app/src/data"
POLICY = "Retain measured shells, roofs, all earlier fittings and open courts. Source-bound ordinary facades only where no previous authored facade owner exists. Unsurveyed small dimensions are explicit display estimates; both complete families share the existing NorthV185 batch and budgets."
PRIMARY_SITES = []
REFERENCES = [
  {
    "url": "https://www.kulturbrauerei.de/gelaende/geschichte/",
    "use": "Primary ensemble identity, clinker facades, six courts; complete v185/v190 bodies and arches retained.",
  },
  {
    "url": "https://www.kulturbrauerei.de/gelaende/guide/",
    "use": "Primary entrances Sredzkistrasse 1, Knaackstrasse 97, Schoenhauser Allee 36; no inferred closed gates.",
  },
  {
    "url": "https://www.berlin.de/sehenswuerdigkeiten/3560308-3558930-kulturbrauerei.html",
    "use": "District architectural context: red-brick nineteenth-century industrial ensemble.",
  },
]


def extract() -> dict:
  """Freeze finite source courses, actual walls and independent native spans."""
  raw = GEO / "raw/outer-v159/candidate.gpkg"
  roads_frame = pyogrio.read_dataframe(
    raw,
    layer="lines",
    where="name IN ('Oderberger Straße','Eberswalder Straße','Sredzkistraße') AND highway IS NOT NULL",
  ).to_crs(25833)
  roads = [
    {"id": str(r.osm_id), "name": r.name, "geometry": mapping(base.world(r.geometry))}
    for r in roads_frame.itertuples()
  ]
  streets = [shape(r["geometry"]) for r in roads]
  route = unary_union(streets)
  region = route.buffer(55)
  street_tree = STRtree(streets)
  mapped = pyogrio.read_dataframe(
    raw,
    layer="multipolygons",
    where="building IS NOT NULL",
    bbox=(13.397, 52.530, 13.43, 52.548),
  ).to_crs(25833)
  source_buildings, protected = [], []
  projection = Transformer.from_crs(4326, 25833, always_xy=True)
  primary_sites = []
  for site in PRIMARY_SITES:
    x, y = projection.transform(site["lon"], site["lat"])
    primary_sites.append({**site, "point": [x - 389500, 5820000 - y]})
  for r in mapped.itertuples():
    poly = base.world(r.geometry)
    if not poly.intersects(region):
      continue
    t = tags(r.other_tags)
    identity = r.osm_id if isinstance(r.osm_id, str) else r.osm_way_id
    reasons = []
    if any(poly.covers(Point(site["point"])) for site in primary_sites):
      reasons.append("primary-heritage-locator")
    if r.building not in {"yes", "apartments", "residential", "house", "terrace"}:
      reasons.append("specific-use")
    if any(isinstance(getattr(r, k), str) for k in ("name", "amenity", "tourism")):
      reasons.append("named-public-building")
    if any(
      "material" in k or "colour" in k
      for k in t
      if k.startswith(("building:", "facade:"))
    ):
      reasons.append("source-material-colour")
    record = {
      "id": str(identity),
      "geometry": mapping(poly),
      "building": r.building,
      "tags": {
        k: v
        for k, v in t.items()
        if k
        in {
          "building:levels",
          "roof:levels",
          "roof:shape",
          "addr:street",
          "addr:housenumber",
          "heritage",
          "ref:lda",
        }
      },
      "protectedReasons": reasons,
    }
    if isinstance(r.name, str):
      record["name"] = r.name
    source_buildings.append(record)
    if reasons:
      protected.append(poly)
  protection = STRtree(protected)
  mapped_polys = [shape(b["geometry"]) for b in source_buildings]
  mapped_tree = STRtree(mapped_polys)
  authored = protected_ids()
  for name in ("danziger-fronts-v244",):
    authored.update(
      f["owner"] for f in base.read_json(GEO / f"{name}-source.json.gz")["faces"]
    )
  manifest = base.read_json(OUT / "manifest.json")
  primary = [
    d
    for d in manifest["chunks"]
    if not d.get("detailCompanionOf") and region.intersects(box(*d["bounds"]))
  ]
  packets, inventory, receipts = {}, [], {}
  for desc in primary:
    packet = base.read_json(OUT / desc["drawn"]["url"])
    packets[desc["id"]] = packet
    for family in ("drawn", "minecraft"):
      receipts[desc[family]["url"]] = base.digest(OUT / desc[family]["url"])
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if poly.is_valid and not poly.is_empty:
        inventory.append((desc["id"], b, poly))
  occupied = STRtree([p for _, _, p in inventory])
  by_chunk = defaultdict(list)
  for chunk, b, poly in inventory:
    by_chunk[chunk].append((b, poly))
  counts, faces, seen = Counter(), [], set()
  for desc in primary:
    packet = packets[desc["id"]]
    triangles = base.mesh_wall_triangles(packet)
    ox, oy, oz = packet["origin"]
    for b, poly in by_chunk[desc["id"]]:
      if not poly.intersects(region):
        continue
      owner = b["sourceId"]
      counts["scannedSourceParts"] += 1
      if not owner.startswith("DEBE") or owner in authored:
        counts["protectedAuthoredParts"] += 1
        continue
      if len(protection.query(poly, predicate="intersects")):
        counts["protectedMappedParts"] += 1
        continue
      low = packet["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
      high = packet["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
      if not 7 <= high - low <= 36 or b["minHeight"] > 0.1:
        counts["outsideOrdinaryHeightParts"] += 1
        continue
      match = []
      for mi in mapped_tree.query(poly, predicate="intersects"):
        other = mapped_polys[mi]
        if poly.intersection(other).area / poly.area > 0.9:
          match.append(source_buildings[mi])
      levels = None
      if len(match) == 1:
        v = match[0]["tags"].get("building:levels", "")
        if v.isdigit() and 2 <= int(v) <= 10:
          levels = int(v)
      ring = b["ring"]
      for a, end in zip(ring, ring[1:] + ring[:1]):
        if not base.source_wall_exists(triangles, a, end, low - oy, high - oy):
          continue
        wa, wb = np.array(a) + [ox, oz], np.array(end) + [ox, oz]
        selected = base.exposed_front(wa, wb, poly, streets, street_tree, occupied)
        if selected is None:
          continue
        _, _, normal, ri = selected
        if (
          not box(*desc["bounds"])
          .buffer(-0.01)
          .covers(LineString([wa + normal * 0.14, wb + normal * 0.14]))
        ):
          continue
        face = {
          "owner": owner,
          "chunk": desc["id"],
          "a": wa.tolist(),
          "b": wb.tolist(),
          "low": low,
          "high": high,
          "normal": normal.tolist(),
          "streetId": roads[ri]["id"],
          "streetName": roads[ri]["name"],
          "sourceBuilding": b,
          "mappedSourceIds": [m["id"] for m in match],
          "mappedLevels": levels,
          "nativeSpans": [],
        }
        key = wall_key(face)
        if key in seen:
          continue
        seen.add(key)
        # Freeze the same exposure test for each proposed opening column.
        face["omittedWindowColumns"] = omitted_columns(face, occupied)
        faces.append(face)
  native_seen = set()
  native_packets = {
    d["id"]: base.read_json(OUT / d["minecraft"]["url"]) for d in primary
  }
  native_polys = []
  for packet in native_packets.values():
    ox, _, oz = packet["origin"]
    for b in packet["nav"]["buildings"]:
      poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
      if poly.is_valid and not poly.is_empty:
        native_polys.append(poly)
  native_occupied = STRtree(native_polys)
  for desc in primary:
    here = [f for f in faces if f["chunk"] == desc["id"]]
    if not here:
      continue
    packet = native_packets[desc["id"]]
    triangles = base.mesh_wall_triangles(packet)
    ox, oy, oz = packet["origin"]
    native_owners = defaultdict(list)
    for b in packet["nav"]["buildings"]:
      native_owners[b["sourceId"]].append(b)
    for face in here:
      corridor = LineString([face["a"], face["b"]]).buffer(1.6, cap_style=2)
      for b in native_owners[face["owner"]]:
        low = packet["nav"]["groundY"] + b["minHeight"] + b.get("groundOffset", 0)
        high = packet["nav"]["groundY"] + b["height"] + b.get("groundOffset", 0)
        poly = translate(Polygon(b["ring"], b["holes"]), ox, oz)
        ring = b["ring"]
        for a, end in zip(ring, ring[1:] + ring[:1]):
          if a[0] != end[0] and a[1] != end[1]:
            continue
          if not base.source_wall_exists(triangles, a, end, low - oy, high - oy):
            continue
          original = [np.array(a) + [ox, oz], np.array(end) + [ox, oz]]
          clipped = LineString(original).intersection(corridor)
          if clipped.geom_type != "LineString" or clipped.length < 2:
            continue
          wa, wb = np.array(clipped.coords[0]), np.array(clipped.coords[-1])
          direction = (wb - wa) / clipped.length
          normal = np.array([-direction[1], direction[0]])
          if np.dot(normal, face["normal"]) < 0:
            normal = -normal
          if np.dot(normal, face["normal"]) < 0.65 or not box(*desc["bounds"]).buffer(
            -0.01
          ).covers(LineString([wa + normal * 0.14, wb + normal * 0.14])):
            continue
          if any(
            poly.covers(Point(*(wa + (wb - wa) * t + normal * 0.2)))
            for t in [0.05, 0.25, 0.5, 0.75, 0.95]
          ):
            continue
          span = {
            "owner": face["owner"],
            "a": wa.tolist(),
            "b": wb.tolist(),
            "normal": normal.tolist(),
            "low": low,
            "high": high,
            "sourceWall": [p.tolist() for p in original],
            "sourceBuilding": b,
            "mappedLevels": face["mappedLevels"],
          }
          key = wall_key(span)
          if key not in native_seen:
            native_seen.add(key)
            span["omittedWindowColumns"] = omitted_columns(
              span, native_occupied, native=True
            )
            face["nativeSpans"].append(span)
  result = {
    "schemaVersion": 1,
    "policy": POLICY,
    "roads": roads,
    "sourceBuildings": source_buildings,
    "authoredIds": sorted(authored),
    "faces": faces,
    "counts": dict(counts),
    "parents": {
      d["id"]: d for d in primary if any(f["chunk"] == d["id"] for f in faces)
    },
    "packetReceipts": receipts,
    "inputReceipts": {str(raw.relative_to(ROOT)): base.digest(raw)},
    "references": REFERENCES,
    "primarySites": primary_sites,
  }
  base.write_json(SOURCE, result)
  return result


def old_glazing_receipts(source: dict) -> list[dict]:
  """Replay only exact existing Sredzki panes; do not invent a second grid."""
  old_path = GEO / "kiez-facades-v209-evidence.json.gz"
  old = base.read_json(old_path)
  source["inputReceipts"][str(old_path.relative_to(ROOT))] = base.digest(old_path)
  descriptors = {d["detailCompanionOf"]: d for d in old["companions"]}
  packets, triangles, result = {}, {}, []
  for face in old["faces"]:
    if face["streetName"] != "Sredzkistraße" or face["previousV188"]:
      continue
    for native in (False, True):
      family = "minecraft" if native else "drawn"
      url = descriptors[face["chunk"]][family]["url"]
      if url not in packets:
        packet = packets[url] = base.read_json(OUT / url)
        source["packetReceipts"][url] = base.digest(OUT / url)
        tris = set()
        for mesh in packet["meshes"]:
          pos = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
          ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
          tris.update(tuple(sorted(tuple(map(int, p)) for p in pos[t])) for t in ix)
        triangles[url] = tris
      for span in face["nativeSpans"] if native else [face]:
        a, b = np.array(span["a"]), np.array(span["b"])
        width = float(np.linalg.norm(b - a))
        d, n = (b - a) / width, np.array(span["normal"])
        lo, hi = span["low"], span["high"]
        nr = max(1, int((hi - lo - 1.5) / (4 if native else 3.6)))
        nc = max(1, int((width - 1.5) / (4 if native else 3.8)))
        pw, ph = (1.15, 1.4) if native else (1.32, 1.8)
        windows = []
        for row in range(nr):
          y = lo + 1.5 + (row + 0.5) * (hi - lo - 2.4) / nr
          for col in range(nc):
            if not native and col in face["omittedWindowColumns"]:
              continue
            u = (col + 0.5) * width / nc
            mesh = base.FacadeMesh(packets[url]["origin"])
            mesh.pane(a, d, n, u, y, pw, ph, 0.045 if native else 0.075, (0, 0, 0))
            keys = [
              tuple(sorted(tuple(mesh.positions[i]) for i in t))
              for t in ((0, 1, 2), (0, 2, 3))
            ]
            assert all(k in triangles[url] for k in keys), (face["owner"], u, y)
            windows.append([u, y, pw, ph])
        if windows:
          result.append(
            {
              "owner": face["owner"],
              "streetName": face["streetName"],
              "a": span["a"],
              "b": span["b"],
              "normal": span["normal"],
              "low": lo,
              "high": hi,
              "native": native,
              "windows": windows,
              "packet": url,
              "sourceFace": face,
            }
          )
  return result


def new_recipe(face: dict, native: bool) -> dict:
  """Store a compact measured face and independently selected opening centres."""
  nr, nc = grid_shape(face, native)
  width = math.dist(face["a"], face["b"])
  pw, ph = (1.15, 1.4) if native else (1.32, 1.8)
  windows = [
    [
      round((col + 0.5) * width / nc, 6),
      round(
        face["low"] + 1.4 + (row + 0.5) * (face["high"] - face["low"] - 2.6) / nr, 6
      ),
      pw,
      ph,
    ]
    for row in range(nr)
    for col in range(nc)
    if col not in face["omittedWindowColumns"]
  ]
  return {
    "owner": face["owner"],
    "a": face["a"],
    "b": face["b"],
    "n": face["normal"],
    "low": face["low"],
    "high": face["high"],
    "existing": False,
    "windows": windows,
  }


def build() -> dict:
  """Freeze exact source receipts and write only the bounded new recipe."""
  source = base.read_json(SOURCE) if SOURCE.exists() else extract()
  source["existingGlazing"] = old_glazing_receipts(source)
  north_path = DATA / "northV185.json"
  source["inputReceipts"][str(north_path.relative_to(ROOT))] = base.digest(north_path)
  north = base.read_json(north_path)
  source["breweryFaces"] = [f for f in north["faces"] if f["kind"] == "kulturbrauerei"]
  recipes = {}
  for native in (False, True):
    family = "native" if native else "drawn"
    selected = (
      [s for f in source["faces"] for s in f["nativeSpans"]]
      if native
      else source["faces"]
    )
    recipes[family] = [new_recipe(f, native) for f in selected]
    recipes[family].extend(
      {
        "owner": f["owner"],
        "a": f["a"],
        "b": f["b"],
        "n": f["normal"],
        "low": f["low"],
        "high": f["high"],
        "existing": True,
        "windows": f["windows"],
      }
      for f in source["existingGlazing"]
      if f["native"] == native
    )
  cameras = [
    {"name": "Kulturbrauerei", "eye": [2800, 50, -2050], "target": [2910, 14, -2210]},
    {
      "name": "Oderberger Straße",
      "eye": [2420, 24, -2290],
      "target": [2480, 11, -2220],
    },
    {
      "name": "Eberswalder Straße",
      "eye": [2500, 30, -2420],
      "target": [2470, 12, -2375],
    },
    {"name": "Sredzkistraße", "eye": [3080, 25, -2020], "target": [3080, 12, -2140]},
  ]
  counts = {
    "newFaces": len(source["faces"]),
    "newOwners": len({f["owner"] for f in source["faces"]}),
    "streets": dict(Counter(f["streetName"] for f in source["faces"])),
    "breweryFaces": len(source["breweryFaces"]),
    **{
      family + "NewWindows": sum(len(f["windows"]) for f in fs if not f["existing"])
      for family, fs in recipes.items()
    },
    **{
      family + "RetainedWindows": sum(len(f["windows"]) for f in fs if f["existing"])
      for family, fs in recipes.items()
    },
  }
  payload = {"policy": POLICY, **recipes, "cameras": cameras, "counts": counts}
  base.write_json(DATA / "kulturbrauereiV252.json", payload)
  base.write_json(SOURCE, source)
  evidence = {
    "policy": POLICY,
    "counts": counts,
    "references": REFERENCES,
    "cameras": cameras,
    "sourceSha256": base.digest(SOURCE),
    "runtimeBytes": (DATA / "kulturbrauereiV252.json").stat().st_size,
    "preservation": "No source, shell, roof, opening, courtyard, packet, descriptor, navigation or older fitting is replaced.",
  }
  base.write_json(EVIDENCE, evidence)
  print(json.dumps(evidence, ensure_ascii=False, indent=2))
  return payload


if __name__ == "__main__":
  build()
