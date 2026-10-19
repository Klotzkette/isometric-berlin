"""Step 10: bounded Danziger street fronts on exact retained wall triangles.

No old packet is rewritten. All eligible exposed faces are kept, without a
building quota. Opening positions and small fittings remain display estimates.
"""

from __future__ import annotations

import gzip
import json
import re
from collections import Counter, defaultdict
from typing import Any

import build_district_facades_v188 as base
import numpy as np
import pyogrio
from build_roof_house_v233 import protected_ids
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import unary_union
from shapely.strtree import STRtree

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
SOURCE = GEO / "danziger-fronts-v244-source.json.gz"
EVIDENCE = GEO / "danziger-fronts-v244-evidence.json"
ADDITION = GEO / "danziger-fronts-v244-manifest-addition.json"
PREFIX = "danzigerfront244-"
KIND = "danziger-fronts-v244"
POLICY = (
  "Complete retained Danziger road courses select existing exposed ordinary wall "
  "sheets. Every face must match both original wall triangles; keep all qualifying "
  "faces without owner quotas. Authored buildings, named/public uses, mapped "
  "materials, previous facade owners and all original geometry remain intact. "
  "New openings, frames, shallow sills and light colours are display estimates, "
  "not individually surveyed elevations. Native faces follow separate delivered "
  "orthogonal walls. Full mobile detail and existing residency limits remain."
)
PRIMARY_SITES = [
  {
    "id": "09075102",
    "name": "Danziger Straße 57",
    "lon": 13.421556170029838,
    "lat": 52.5398801306592276,
  },
  {
    "id": "09070139",
    "name": "Danziger Straße 50",
    "lon": 13.419509464115027,
    "lat": 52.5389778729838497,
  },
]
REFERENCES = [
  {
    "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09070139",
    "name": "162. und 197. Gemeindeschule, Danziger Straße 50",
    "use": "School complex by Hermann Blankenstein and Dylewski, designed 1892 and built 1893–94. Primary locator is retained for protection; no unverified residential model is introduced.",
  },
  {
    "url": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075102",
    "name": "Danziger Straße 57 / Senefelderstraße 35",
    "use": "Named 1893–94 Eugen Reethen corner and later workshop; protect its distinct architecture from an ordinary repeated grid.",
  },
  {
    "url": "https://graftlab.com/projects/paragon-apartments",
    "name": "Paragon Apartments, Danziger Straße 73–77",
    "use": "Architect confirms modern varying-depth balcony cubes, open corner and three courts. Named source complex is protected; no old-town facade or closed courtyard is inferred.",
  },
]


def tags(value: Any) -> dict[str, str]:
  """Read only retained OSM tag syntax, never inferred occupant information."""
  return dict(
    re.findall(r'"([^\"]+)"=>"([^\"]*)"', value if isinstance(value, str) else "")
  )


def wall_key(face: dict) -> tuple:
  """Deduplicate exact wall spans, retaining distinct faces of one real owner."""
  ends = sorted(tuple(round(x, 2) for x in face[k]) for k in ("a", "b"))
  return face["owner"], *ends, round(face["low"], 2), round(face["high"], 2)


def extract() -> dict:
  """Freeze finite source courses, actual walls and independent native spans."""
  raw = GEO / "raw/outer-v159/candidate.gpkg"
  roads_frame = pyogrio.read_dataframe(
    raw, layer="lines", where="name='Danziger Straße' AND highway='primary'"
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
    bbox=(13.40, 52.522, 13.452, 52.544),
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
          "streetName": "Danziger Straße",
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


def grid_shape(face: dict, native: bool = False) -> tuple[int, int]:
  """Use positively matched OSM levels, otherwise retain a labelled estimate."""
  height = face["high"] - face["low"]
  width = np.linalg.norm(np.array(face["b"]) - face["a"])
  levels = face.get("mappedLevels")
  rows = (
    levels
    if levels and 2.6 <= height / levels <= 5.0
    else max(1, int((height - 1.5) / 3.6))
  )
  return rows, max(1, int((width - 1.4) / (4.0 if native else 3.8)))


def omitted_columns(face: dict, occupied: STRtree, native: bool = False) -> list[int]:
  """Avoid source neighbours even where a short projection touches the front."""
  a, b = np.array(face["a"]), np.array(face["b"])
  width = np.linalg.norm(b - a)
  d, n = (b - a) / width, np.array(face["normal"])
  _, cols = grid_shape(face, native)
  omitted = []
  for col in range(cols):
    u = (col + 0.5) * width / cols
    left, right = a + d * (u - 0.8), a + d * (u + 0.8)
    approach = Polygon(
      [left + n * 0.025, right + n * 0.025, right + n * 2, left + n * 2]
    )
    if len(occupied.query(approach, predicate="intersects")):
      omitted.append(col)
  return omitted


def render_face(mesh: base.FacadeMesh, face: dict, native: bool = False) -> int:
  """Restrained window glass, four thin frames and sill; no mass/roof repaint."""
  a, b = np.array(face["a"]), np.array(face["b"])
  width = float(np.linalg.norm(b - a))
  d, n = (b - a) / width, np.array(face["normal"])
  low, high = face["low"], face["high"]
  rows, cols = grid_shape(face, native)
  pw, ph = (1.15, 1.4) if native else (1.32, 1.8)
  count = 0
  for row in range(rows):
    y = low + 1.4 + (row + 0.5) * (high - low - 2.6) / rows
    for col in range(cols):
      if col in face.get("omittedWindowColumns", []):
        continue
      u = (col + 0.5) * width / cols
      mesh.pane(a, d, n, u, y, pw, ph, 0.075, (91, 119, 129), (165, 185, 187))
      for sign in (-1, 1):
        mesh.pane(
          a,
          d,
          n,
          u + sign * (pw / 2 + 0.035),
          y,
          0.07,
          ph + 0.14,
          0.10,
          (210, 205, 188),
        )
        mesh.pane(
          a,
          d,
          n,
          u,
          y + sign * (ph / 2 + 0.035),
          pw + 0.14,
          0.07,
          0.10,
          (215, 210, 192),
        )
      mesh.pane(
        a,
        d,
        n,
        u,
        y - ph / 2 - 0.10,
        pw + 0.24,
        0.10,
        0.13,
        (190, 183, 165),
        (230, 223, 204),
      )
      if not native:
        mesh.pane(a, d, n, u, y, 0.055, ph, 0.11, (188, 194, 184))
        mesh.pane(a, d, n, u, y + ph * 0.18, pw, 0.055, 0.11, (188, 194, 184))
      count += 1
  for y in (low + 0.65, high - 0.32):
    mesh.pane(
      a, d, n, width / 2, y, width - 0.6, 0.13, 0.10, (186, 181, 166), (224, 216, 198)
    )
  return count


def build() -> dict:
  """Replay compact frozen faces and emit a manifest addition, never a mutation."""
  source = base.read_json(SOURCE) if SOURCE.exists() else extract()
  for url, expected in source["packetReceipts"].items():
    assert base.digest(OUT / url) == expected, url
  counts, companions = Counter(source["counts"]), []
  for chunk, desc in source["parents"].items():
    faces = [f for f in source["faces"] if f["chunk"] == chunk]
    companion = {
      "id": PREFIX + chunk,
      "detailCompanionOf": chunk,
      "bounds": desc["bounds"],
    }
    for family in ("drawn", "minecraft"):
      original = base.read_json(OUT / desc[family]["url"])
      mesh = base.FacadeMesh(original["origin"])
      selected = (
        faces if family == "drawn" else [s for f in faces for s in f["nativeSpans"]]
      )
      for face in selected:
        counts[family + "Windows"] += render_face(mesh, face, family == "minecraft")
      payload = mesh.payload()
      for part in payload["meshes"]:
        part["kind"] = KIND
      url = companion["id"] + "." + family + ".json.gz"
      path = OUT / url
      base.write_json(path, {"id": companion["id"], **payload})
      decoded = len(gzip.decompress(path.read_bytes()))
      assert decoded < 4 * 1024 * 1024
      assert len(mesh.positions) < 400_000 and len(mesh.indices) < 2_400_000
      companion[family] = {
        "url": url,
        "bytes": path.stat().st_size,
        "decodedBytes": decoded,
        "encoding": "gzip",
        "sha256": base.digest(path),
      }
      counts[family + "Vertices"] += len(mesh.positions)
      counts[family + "GeometryBytes"] += len(mesh.positions) * 12 + len(
        mesh.indices
      ) * (2 if len(mesh.positions) <= 65535 else 4)
      counts[family + "TransferBytes"] += path.stat().st_size
    companions.append(companion)
  counts["fronts"] = len(source["faces"])
  counts["owners"] = len({f["owner"] for f in source["faces"]})
  evidence = {
    "schemaVersion": 1,
    "policy": POLICY,
    "sourceSha256": base.digest(SOURCE),
    "counts": dict(counts),
    "companions": companions,
    "references": source["references"],
  }
  base.write_json(EVIDENCE, evidence)
  base.write_json(
    ADDITION,
    {
      "chunks": companions,
      "danzigerFrontsV244": {"policy": POLICY, "counts": dict(counts)},
    },
  )
  print(json.dumps({"companions": len(companions), **counts}, indent=2))
  return evidence


if __name__ == "__main__":
  build()
