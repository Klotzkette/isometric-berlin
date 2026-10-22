"""Step 10: exact EUREF historical roofs and compact campus recognition inputs."""

from __future__ import annotations

import argparse
import base64
import copy
import gzip
import hashlib
import json
import math
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter

import build_district_facades_v188 as io
import build_surrounding_outlines as outlines
import numpy as np
import pyogrio
import shapely
from alt_mitte_v169_packets import pack_detail
from build_adlershof_kuehn_v261 import arrays, signature
from build_breitscheid_towers_v161 import triangles_for
from build_citywest_cinemas_v166 import footprints, polygons_of
from build_karl_marx_allee_v161 import Detail, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from build_west_venues_v260 import face_axes
from pyproj import Transformer
from shapely import wkb
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

ROOT, GEO, OUT = io.ROOT, io.GEO, io.OUT
SOURCE = GEO / "euref-v262-source.json.gz"
EVIDENCE = GEO / "euref-v262-evidence.json"
ADDITION = GEO / "euref-v262-manifest-addition.json"
RUNTIME = ROOT / "src/app/src/data/eurefV262.json"
TRANSFERS = ROOT / "src/app/src/data/eurefTransfersV262.json"
NS = {
  "b": "http://www.opengis.net/citygml/building/1.0",
  "g": "http://www.opengis.net/gml",
}
# Names are resolved against retained OSM identities and the operator's 10/2025
# campus plan, not inferred from geometric proximity or arbitrary site placement.
OWNERS = {
  "DEBE07YY90000JL7": ("Gasometer / Haus 17", 1307229197, "gasometer", False),
  "DEBE07YY900004na": ("Wasserturm / Haus 18–19", 49369406, "brick", True),
  "DEBE07YY90000KAU": ("Retortenhaus / Haus 16", 49369402, "brick", True),
  "DEBE07YY900009rT": ("Haus 3", 49369394, "brick", True),
  "DEBE07YY90000Of6": ("Schmiede / Haus 15", 49369397, "brick", True),
  "DEBE07YY90002dBc": ("Schmiede attachment", 49369397, "brick", True),
  "DEBE07YY90000Itb": ("Schleusenhaus / Haus 20", 809478122, "brick", True),
  "DEBE07YY900000xa": ("Reglerhaus / Haus 25", 337793702, "brick", True),
  "DEBE07YY900004Zc": ("Werkstatt 26", 49369395, "workshop", True),
  "DEBE07YY90000Cdn": ("Haus 4–5", 49369405, "office", False),
  "DEBE07YY90000ATK": ("Haus 6–9", 881922621, "office", False),
  "DEBE00YY1iE0004i": ("Haus 10–11", 512725288, "office", False),
  "DEBE07YY90000Iby": ("Haus 12–13", 293167501, "office", False),
  "DEBE00YYH600008C": ("Haus 14", 306702754, "round-office", False),
  "DEBE00YY2dK002da": ("Haus 21–22", 624240549, "office", False),
  "DEBE07AL4sT0000l": ("Haus 23–24", 715648453, "office", False),
  "DEBE07YY90000Gwe": ("Zeemobase / Haus 15c", 49369396, "workshop", False),
  "DEBE07YY900001EZ": ("Haus 15a", 257920316, "workshop", False),
  "DEBE00YY1dX00000": ("Holzhaus / Haus 15b", 49369399, "timber", False),
}


def digest(value: object) -> str:
  """Canonical semantic fingerprint independent of JSON whitespace."""
  return hashlib.sha256(
    json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
  ).hexdigest()


def fingerprint(parts: list[str]) -> int:
  value = 2166136261
  for text in parts:
    for char in text:
      value = ((value ^ ord(char)) * 16777619) & 0xFFFFFFFF
  return value


def mesh_fingerprint(mesh: dict) -> int:
  return fingerprint([mesh[k] for k in ("positions", "colors", "indices")])


def json_for_js(value: object) -> str:
  """Original JSON field order, with JS's integral-number serialization."""

  def normalized(item):
    if isinstance(item, float) and item.is_integer():
      return int(item)
    if isinstance(item, dict):
      return {k: normalized(v) for k, v in item.items()}
    if isinstance(item, list):
      return [normalized(v) for v in item]
    return item

  return json.dumps(normalized(value), separators=(",", ":"), ensure_ascii=False)


def extract_source() -> dict:
  """Freeze only the named campus owners from one retained official tile."""
  archive = GEO / "raw/lod2/LoD2_388_5815.zip"
  cache = io.read_json(GEO / "raw/euref-v262/osm-site-audit.json")
  osm = {e["id"]: e for e in cache["elements"] if e["type"] == "way"}
  transform = Transformer.from_crs(4326, 25833, always_xy=True)

  def osm_ring(identity: int) -> list:
    return [
      [round(x - 389500, 5), round(5820000 - y, 5)]
      for x, y in (
        transform.transform(p["lon"], p["lat"]) for p in osm[identity]["geometry"]
      )
    ]

  old = pyogrio.read_dataframe(
    GEO / "raw/outer-v159/resolved-outlines.gpkg",
    layer="buildings",
    bbox=(-1344, 3950, -980, 4315),
  )
  old = {r.sourceId: r for r in old.itertuples() if r.sourceId in OWNERS}
  assert set(old) == set(OWNERS)
  with zipfile.ZipFile(archive) as z:
    tree = ET.fromstring(z.read(z.namelist()[0]))
  buildings = []
  for parent in tree.findall(".//b:Building", NS):
    identity = parent.get("{" + NS["g"] + "}id")
    if identity not in OWNERS:
      continue
    name, osm_id, kind, replace = OWNERS[identity]
    ground = min(
      float(v)
      for e in parent.findall(".//b:GroundSurface//g:posList", NS)
      for v in e.text.split()[2::3]
    )
    parts = []
    for part in parent.findall(".//b:BuildingPart", NS) or [parent]:
      surfaces = []
      for boundary in part.findall("b:boundedBy", NS):
        for surface in boundary:
          for polygon in surface.findall(".//g:Polygon", NS):
            rings = []
            for e in polygon.findall(".//g:posList", NS):
              a = list(map(float, e.text.split()))
              ring = [
                [
                  round(a[i] - 389500, 3),
                  round(a[i + 2] - ground + 3, 3),
                  round(5820000 - a[i + 1], 3),
                ]
                for i in range(0, len(a), 3)
              ]
              if ring[0] == ring[-1]:
                ring.pop()
              rings.append(ring)
            surfaces.append(
              {
                "kind": surface.tag.split("}")[-1],
                "rings": rings,
                "sourcePolygonId": polygon.get("{" + NS["g"] + "}id"),
              }
            )
      points = [p for s in surfaces for ring in s["rings"] for p in ring]
      foot = footprints(surfaces)
      parts.append(
        {
          "id": part.get("{" + NS["g"] + "}id"),
          "surfaces": surfaces,
          "minY": min(p[1] for p in points),
          "maxY": max(p[1] for p in points),
          "footprints": [mapping(p) for p in polygons_of(foot)],
        }
      )
    previous = old[identity]
    source_foot = unary_union([shape(g) for p in parts for g in p["footprints"]])
    assert source_foot.symmetric_difference(previous.geometry).area < 0.000001
    osmpoly = Polygon(osm_ring(osm_id))
    buildings.append(
      {
        "id": identity,
        "name": name,
        "osmId": osm_id,
        "kind": kind,
        "replace": replace,
        "groundNHN": ground,
        "parts": parts,
        "oldOwner": {
          "wkb": previous.geometry.wkb_hex,
          "height": previous.height,
          "minHeight": previous.minHeight,
        },
        "osmRing": osm_ring(osm_id),
        "osmTags": osm[osm_id].get("tags", {}),
        "sourceOsmIntersectionM2": source_foot.intersection(osmpoly).area,
        "sourceAreaM2": source_foot.area,
        "osmAreaM2": osmpoly.area,
        "measuredHeightAboveViewerGroundM": max(p["maxY"] for p in parts) - 3,
      }
    )
  assert len(buildings) == len(OWNERS)
  gas = next(b for b in buildings if b["kind"] == "gasometer")
  poly = wkb.loads(gas["oldOwner"]["wkb"], hex=True)
  result = {
    "schemaVersion": 1,
    "step": 10,
    "buildings": buildings,
    "campus": {"osmId": 23458867, "ring": osm_ring(23458867)},
    "gasometer": {
      "owner": gas["id"],
      "center": [round(poly.centroid.x, 5), 3, round(poly.centroid.y, 5)],
      "sourceRoofY": max(p["maxY"] for p in gas["parts"]),
      "frameHeightM": 78,
      "terraceHeightM": 66,
      "baseMantleHeightM": 16,
      "posts": 24,
      "horizontalRings": 7,
      "frameRadiusEstimateM": 31.5,
      "nativeFrameRadiusEstimateM": 33.5,
      "geometryConflict": {
        "outerRingOsmId": 23458860,
        "outerRing": osm_ring(23458860),
        "innerBodyOsmId": gas["osmId"],
        "innerBodyRing": gas["osmRing"],
        "sourceEnvelopeAreaM2": poly.area,
        "outerRingAreaM2": Polygon(osm_ring(23458860)).area,
        "innerBodyAreaM2": gas["osmAreaM2"],
        "explanation": "Retained LoD2 envelope follows the historic outer ring (about 60.8 m diameter), while OSM's 2024 inner body is only about 47.8 m diameter. Containment is not footprint identity. Operator and architect describe about 1 m clearance to the steel frame. The retained cylinder is preserved completely; glazing follows that envelope and the 31.5 m display frame reconciles conflicting sources, without claiming a surveyed glass diameter. Native frame radius 33.5 m provides explicit 2 m grid clearance.",
      },
    },
    "sources": [
      {
        "url": "https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5815.zip",
        "sha256": io.digest(archive),
        "license": "dl-de/zero-2-0",
      },
      {
        "url": cache["sourceUrl"],
        "supplementalUrls": cache.get("supplementalSourceUrls", []),
        "license": "ODbL-1.0",
      },
    ],
    "policy": "Complete retained LoD2 and OSM owners. Source base remains existing viewer y=3. Only eight exact historic flat prisms transfer to all measured sheets. Other shells and all unrelated packets/detail stay retained. The retained Gasometer envelope is not a surveyed current glass facade: conflicting OSM inner/outer rings are frozen explicitly. Small facade subdivisions, frame dimensions and the native grid clearance are display estimates.",
  }
  io.write_json(SOURCE, result)
  return result


def historical_mesh(buildings: list) -> Detail:
  """Every measured wall and roof, without a second fabricated roof form."""
  model = Detail()
  for b in buildings:
    for p in b["parts"]:
      for s in p["surfaces"]:
        if s["kind"] not in {"WallSurface", "RoofSurface"}:
          continue
        color = (
          ((114, 113, 101) if b["kind"] == "workshop" else (160, 103, 81))
          if s["kind"] == "RoofSurface"
          else (179, 118, 83)
        )
        for triangle in triangles_for(s["rings"]):
          model.polygon(triangle, color, "complete measured " + s["kind"])
  return model


def old_mesh(buildings: list, family: str, bounds: list) -> dict:
  """Independently reconstruct the historical tile clipping/wall provenance."""
  mesh = outlines.PackedMesh(bounds[0], bounds[1])
  tile = box(*bounds)
  for b in buildings:
    old = b["oldOwner"]
    full = wkb.loads(old["wkb"], hex=True)
    geometry = outlines.polygonal(full.intersection(tile))
    if family == "minecraft":
      geometry = outlines.native_polygon(geometry)
    if geometry.is_empty:
      continue
    high = 3 + (
      max(2, round(old["height"] / 2) * 2) if family == "minecraft" else old["height"]
    )
    wall = shapely.orient_polygons(
      geometry if family == "minecraft" else full, exterior_cw=True
    ).boundary
    if family != "minecraft":
      wall = wall.intersection(tile)
    mesh.building(geometry, 3 + old["minHeight"], high, wall)
  return mesh.payload("exact-old-campus-owner-receipt")


def remove_old(packet: dict, buildings: list, family: str, bounds: list) -> dict:
  """Remove exact reproduced triangle signatures, preserving every complement."""
  expected = old_mesh(buildings, family, bounds)
  ep, ei = arrays(expected)
  wanted = Counter(signature(t) for t in ep[ei])
  requested = wanted.copy()
  removed, complements, records = [], [], []
  for mesh_index, mesh in enumerate(packet["meshes"]):
    points, indices = arrays(mesh)
    keep, retired = [], []
    for i, tri in enumerate(points[indices]):
      key = signature(tri)
      if wanted[key]:
        wanted[key] -= 1
        removed.append(key)
        retired.append(i)
      else:
        keep.append(i)
    if retired:
      records.append(
        {
          "mesh": mesh_index,
          "fingerprint": mesh_fingerprint(mesh),
          "triangles": retired,
        }
      )
    mesh["indices"] = base64.b64encode(indices[keep].astype("<u4").tobytes()).decode()
    complements.append(digest(mesh))
  assert not +wanted, (
    family,
    bounds,
    "Unmatched source triangles",
    sum((+wanted).values()),
  )
  ids = {b["id"] for b in buildings}
  owned_nav = [r for r in packet["nav"]["buildings"] if r.get("sourceId") in ids]
  packet["nav"]["buildings"] = [
    r for r in packet["nav"]["buildings"] if r.get("sourceId") not in ids
  ]
  ink_removed, segments = 0, []
  line_fingerprint = None
  if family == "drawn":
    lines = packet["lines"]
    points = np.frombuffer(base64.b64decode(lines["positions"]), "<u2").reshape(
      -1, 2, 3
    )
    colors = np.frombuffer(base64.b64decode(lines["colors"]), "u1").reshape(-1, 2, 3)
    wanted_ink = set()
    tile = box(*bounds)
    for b in buildings:
      old = b["oldOwner"]
      g = wkb.loads(old["wkb"], hex=True).intersection(tile)
      for line in outlines.line_parts(
        g.boundary.difference(tile.boundary.buffer(0.02))
      ):
        for a, c in zip(line.coords, list(line.coords)[1:]):
          pts = [
            [a[0], 3 + old["height"] + 0.02, a[1]],
            [c[0], 3 + old["height"] + 0.02, c[1]],
          ]
          wanted_ink.add(signature(np.rint((np.array(pts) - packet["origin"]) * 100)))
    keep = [i for i, p in enumerate(points) if signature(p) not in wanted_ink]
    segments = [i for i, p in enumerate(points) if signature(p) in wanted_ink]
    line_fingerprint = fingerprint([lines["positions"], lines.get("colors", "")])
    ink_removed = len(points) - len(keep)
    lines["positions"] = base64.b64encode(points[keep].astype("<u2").tobytes()).decode()
    lines["colors"] = base64.b64encode(colors[keep].tobytes()).decode()
  return {
    "removedTriangles": len(removed),
    "expectedTriangles": sum(requested.values()),
    "removedSignatureSha256": digest(sorted(removed)),
    "removedInkSegments": ink_removed,
    "oldOwnedNavigation": owned_nav,
    "unrelatedNavigationSha256": digest(packet["nav"]),
    "retainedMeshComplementSha256": complements,
    "retainedLineComplementSha256": digest(packet.get("lines")),
    "runtimeRecords": records,
    "runtimeSegments": segments,
    "runtimeLineFingerprint": line_fingerprint,
  }


def navigation(buildings: list, bounds: list, native: bool) -> list:
  """Complete named part ownership and holes, clipped only at existing tiles."""
  result = []
  for b in buildings:
    for p in b["parts"]:
      foot = unary_union([shape(g) for g in p["footprints"]]).intersection(box(*bounds))
      if native:
        foot = outlines.native_polygon(foot)
      high = 3 + math.ceil((p["maxY"] - 3) / 2) * 2 if native else p["maxY"]
      for poly in outlines.navigation_polygons(foot, bounds[0], bounds[1]):
        result.append(
          {
            **poly,
            "sourceId": b["id"],
            "partId": p["id"],
            "height": high - 3,
            "minHeight": max(0, p["minY"] - 3),
            "heightSource": "Complete measured LoD2 part; independent native surface cells",
          }
        )
  return result


def recognition_data(source: dict) -> dict:
  """Compact source planes allow statically batched, bounded facade fittings."""
  faces, buildings = [], []
  for b in source["buildings"]:
    foot = wkb.loads(b["oldOwner"]["wkb"], hex=True)
    record = {k: b[k] for k in ["id", "name", "kind", "osmId", "replace"]}
    record.update(
      height=b["oldOwner"]["height"],
      center=[foot.centroid.x, foot.centroid.y],
      rings=[list(p.exterior.coords)[:-1] for p in polygons_of(foot)],
    )
    buildings.append(record)
    if b["kind"] == "gasometer":
      continue
    for p in b["parts"]:
      for s in p["surfaces"]:
        if s["kind"] != "WallSurface":
          continue
        f = face_axes(s, foot)
        if not f or f["length"] < 2.4 or f["hi"] - f["lo"] < 2.5:
          continue
        # Keep only an exterior sheet: coincident internal part faces receive no windows.
        if foot.covers(Point(f["a"] + f["d"] * f["length"] / 2 + f["n"] * 0.2)):
          continue
        faces.append(
          {
            "owner": b["id"],
            "kind": b["kind"],
            "replace": b["replace"],
            "a": f["a"].tolist(),
            "d": f["d"].tolist(),
            "n": f["n"].tolist(),
            "length": float(f["length"]),
            "lo": f["lo"],
            "hi": f["hi"],
            "polygon": list(f["poly"].exterior.coords),
            "sourcePolygonId": s["sourcePolygonId"],
          }
        )
  return {
    "sourceSha256": io.digest(SOURCE),
    "campus": source["campus"],
    "gasometer": source["gasometer"],
    "buildings": buildings,
    "faces": faces,
    "status": "Current 2024 Gasometer appearance and October 2025 numbered campus. Retained cylindrical source envelope and conflicting OSM inner/outer rings are preserved; facade fit, member dimensions and native grid clearance are display estimates.",
  }


def build() -> dict:
  """Write new finite packets and a reversible descriptor adapter input."""
  source = io.read_json(SOURCE)
  previous = io.read_json(OUT / "manifest.json")
  baseline = (
    {r["old"]["id"]: r["old"] for r in io.read_json(ADDITION)["replacements"]}
    if ADDITION.exists()
    else {c["id"]: c for c in previous["chunks"]}
  )
  selected = [b for b in source["buildings"] if b["replace"]]
  drawn = historical_mesh(selected)
  native = merge_native_faces(native_detail(drawn))
  receipts, replacements, transfers = [], [], {}
  for identity in ["-3_7", "-3_8", "-2_7"]:
    old = baseline[identity]
    bounds = old["bounds"]
    group = [
      b
      for b in selected
      if wkb.loads(b["oldOwner"]["wkb"], hex=True).intersection(box(*bounds)).area
      > 0.00001
    ]
    descriptor = copy.deepcopy(old)
    for family, model in [("drawn", drawn), ("minecraft", native)]:
      assert io.digest(OUT / old[family]["url"]) == old[family]["sha256"]
      packet = io.read_json(OUT / old[family]["url"])
      stripped = copy.deepcopy(packet)
      receipt = {
        "id": identity,
        "family": family,
        "owners": [b["id"] for b in group],
        "oldAsset": old[family],
        **remove_old(stripped, group, family, bounds),
      }
      extras = pack_detail(model, bounds)
      for part in extras:
        part["kind"] = "euref-historic-v262"
      transfers[f"{family}:{identity}"] = {
        "origin": packet["origin"],
        "records": receipt["runtimeRecords"],
        "lineFingerprint": receipt["runtimeLineFingerprint"],
        "segments": receipt["runtimeSegments"],
        "replacements": [
          {"mesh": len(packet["meshes"]) + i, "fingerprint": mesh_fingerprint(part)}
          for i, part in enumerate(extras)
        ],
        "navigationFingerprint": fingerprint([json_for_js(packet["nav"])]),
        "retiredOwners": receipt["owners"],
        "buildings": navigation(group, bounds, family == "minecraft"),
      }
      # Preserve every encoded predecessor byte, including indices/ink/nav:
      # older v233-v254 receipts must see their exact original source. The new
      # complete geometry joins this same packet, then only receipted entries
      # are retired in final decoded buffers after all older preparations.
      packet["meshes"].extend(extras)
      path = OUT / f"euref262-{identity}.{family}.json.gz"
      io.write_json(path, packet)
      decoded = len(gzip.decompress(path.read_bytes()))
      assert path.stat().st_size < 650_000 and decoded < 2_600_000
      descriptor[family] = {
        "url": path.name,
        "bytes": path.stat().st_size,
        "decodedBytes": decoded,
        "encoding": "gzip",
        "sha256": io.digest(path),
      }
      receipt["newAsset"] = descriptor[family]
      receipts.append(receipt)
    replacements.append({"old": old, "new": descriptor})
  result = {
    "step": 10,
    "sourceSha256": io.digest(SOURCE),
    "receipts": receipts,
    "sourceOwners": len(source["buildings"]),
    "replacementOwners": len(selected),
    "replacementParts": sum(len(b["parts"]) for b in selected),
    "policy": source["policy"],
  }
  io.write_json(EVIDENCE, result)
  io.write_json(
    TRANSFERS,
    {
      "schema": 1,
      "sourceSha256": io.digest(SOURCE),
      "keys": sorted(transfers),
      "packets": transfers,
    },
  )
  io.write_json(
    ADDITION,
    {
      "replacements": replacements,
      "eurefCampusV262": {
        "source": SOURCE.name,
        "sourceSha256": io.digest(SOURCE),
        "evidence": EVIDENCE.name,
        "transfers": "src/app/src/data/eurefTransfersV262.json",
        "transfersSha256": io.digest(TRANSFERS),
      },
    },
  )
  io.write_json(RUNTIME, recognition_data(source))
  print(json.dumps({k: v for k, v in result.items() if k != "receipts"}, indent=2))
  return result


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--extract", action="store_true")
  args = parser.parse_args()
  if args.extract:
    extract_source()
  build()
