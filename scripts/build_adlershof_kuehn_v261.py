"""Step 10: exact Adlershof prism transfers and the bounded Kühn workshop site."""

from __future__ import annotations

import base64
import copy
import gzip
import hashlib
import json
import math
from collections import Counter

import build_district_facades_v188 as io
import build_surrounding_outlines as outlines
import numpy as np
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_breitscheid_towers_v161 import normal_of, triangles_for
from build_karl_marx_allee_v161 import Detail, native_detail
from build_scheunenviertel_v168 import merge_native_faces
from shapely import wkb
from shapely.geometry import Point, Polygon, box, mapping, shape
from shapely.ops import unary_union

GEO, OUT = io.GEO, io.OUT
SOURCE = GEO / "adlershof-kuehn-v261-source.json.gz"
EVIDENCE = GEO / "adlershof-kuehn-v261-evidence.json"
ADDITION = GEO / "adlershof-kuehn-v261-manifest-addition.json"
BRICK, METAL, GLASS = (161, 98, 73), (82, 92, 94), (89, 132, 139)
CONCRETE, PLASTER, FRAME = (190, 189, 174), (223, 222, 204), (55, 63, 60)


def digest(value: object) -> str:
  """Canonical evidence fingerprint, independent of indentation."""
  return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def arrays(mesh: dict) -> tuple[np.ndarray, np.ndarray]:
  """Decode only a bounded existing packet's integer positions and indices."""
  assert mesh["positionType"] == "u16cm"
  points = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return points, indices


def signature(triangle: np.ndarray) -> tuple:
  """Ignore triangle winding, retaining every centimetre coordinate."""
  return tuple(sorted(tuple(int(v) for v in p) for p in triangle))


def old_mesh(buildings: list, family: str, bounds: list) -> dict:
  """Recreate only the old named source owners, never neighbouring geometry."""
  mesh = outlines.PackedMesh(bounds[0], bounds[1])
  for building in buildings:
    old = building["oldOwner"]
    geometry = wkb.loads(old["wkb"], hex=True)
    height = old["height"]
    if family == "minecraft":
      geometry = outlines.native_polygon(geometry)
      height = max(2, round(height / 2) * 2)
    mesh.building(geometry, 3 + old["minHeight"], 3 + height)
  return mesh.payload("source-owner-receipt")


def remove_old(packet: dict, buildings: list, family: str, bounds: list) -> dict:
  """Delete only independently reproduced old triangles and roof ink segments."""
  expected = old_mesh(buildings, family, bounds)
  ep, ei = arrays(expected)
  wanted = Counter(signature(t) for t in ep[ei])
  requested = wanted.copy()
  removed = []
  for mesh in packet["meshes"]:
    points, indices = arrays(mesh)
    keep = []
    for i, tri in enumerate(points[indices]):
      key = signature(tri)
      if wanted[key]:
        wanted[key] -= 1
        removed.append(key)
      else:
        keep.append(i)
    mesh["indices"] = base64.b64encode(indices[keep].astype("<u4").tobytes()).decode()
  # GEOS changed the diagonal of two isolated native roof cells after the old
  # ground intersection. Verify equal centimetre-planar coverage before transfer.
  equivalent_roofs = 0
  if +wanted:
    assert family == "minecraft"
    planes: dict[int, list] = {}
    for triangle, count in (+wanted).items():
      assert len({p[1] for p in triangle}) == 1 and count == 1
      planes.setdefault(triangle[0][1], []).append(
        Polygon([(p[0], p[2]) for p in triangle])
      )
    masks = {y: unary_union(polys) for y, polys in planes.items()}
    actual: dict[int, list] = {y: [] for y in masks}
    for mesh in packet["meshes"]:
      points, indices = arrays(mesh)
      keep = []
      for i, tri in enumerate(points[indices]):
        y = int(tri[0, 1])
        poly = Polygon(tri[:, [0, 2]])
        if (
          y in masks
          and np.all(tri[:, 1] == y)
          and poly.area > 0
          and masks[y].covers(poly)
        ):
          actual[y].append(poly)
          removed.append(signature(tri))
          equivalent_roofs += 1
        else:
          keep.append(i)
      mesh["indices"] = base64.b64encode(indices[keep].astype("<u4").tobytes()).decode()
    assert all(
      masks[y].symmetric_difference(unary_union(actual[y])).area == 0 for y in masks
    )
  ids = {b["id"] for b in buildings}
  old_nav = packet["nav"]["buildings"]
  owned_nav = [r for r in old_nav if r.get("sourceId") in ids]
  packet["nav"]["buildings"] = [r for r in old_nav if r.get("sourceId") not in ids]
  ink_removed = 0
  if "lines" in packet:
    lines = packet["lines"]
    points = np.frombuffer(base64.b64decode(lines["positions"]), "<u2").reshape(
      -1, 2, 3
    )
    colours = np.frombuffer(base64.b64decode(lines["colors"]), "u1").reshape(-1, 2, 3)
    wanted_ink = set()
    for b in buildings:
      old = b["oldOwner"]
      g = wkb.loads(old["wkb"], hex=True)
      for line in outlines.line_parts(g.boundary):
        for a, c in zip(line.coords, list(line.coords)[1:]):
          pts = [
            [a[0], 3 + old["height"] + 0.02, a[1]],
            [c[0], 3 + old["height"] + 0.02, c[1]],
          ]
          wanted_ink.add(signature(np.rint((np.array(pts) - packet["origin"]) * 100)))
    keep = [i for i, p in enumerate(points) if signature(p) not in wanted_ink]
    ink_removed = len(points) - len(keep)
    lines["positions"] = base64.b64encode(points[keep].astype("<u2").tobytes()).decode()
    lines["colors"] = base64.b64encode(colours[keep].tobytes()).decode()
  return {
    "removedTriangles": len(removed),
    "expectedTriangles": sum(requested.values()),
    "equivalentRoofTriangles": equivalent_roofs,
    "removedSignatureSha256": digest(sorted(removed)),
    "removedInkSegments": ink_removed,
    "oldOwnedNavigation": owned_nav,
    "unrelatedNavigationSha256": digest(packet["nav"]),
  }


def material(building: dict, part: dict, kind: str) -> tuple:
  """Reference-guided material identity; the metric surface is unchanged."""
  if building["site"] == "kuehn":
    return (135, 137, 127) if kind == "RoofSurface" else PLASTER
  if building["name"] == "Erwin-Schrödinger-Zentrum":
    return METAL if kind == "RoofSurface" or part["maxY"] > 20 else BRICK
  return CONCRETE


def detail(buildings: list) -> tuple[Detail, dict]:
  """Retain every measured wall and roof; add small exposed facade estimates."""
  mesh = Detail()
  counts = Counter()
  for building in buildings:
    for part in building["parts"]:
      foot = unary_union([shape(g) for g in part["footprints"]])
      for surface in part["surfaces"]:
        if surface["kind"] not in {"WallSurface", "RoofSurface"}:
          continue
        for triangle in triangles_for(surface["rings"]):
          mesh.polygon(
            triangle,
            material(building, part, surface["kind"]),
            "source " + surface["kind"],
          )
          counts["sourceTriangles"] += 1
        if surface["kind"] != "WallSurface" or building["name"] in {
          "Trudelturm",
          "Großer Windkanal",
          "Isothermische Kugellabore",
        }:
          continue
        r = surface["rings"][0]
        if abs(normal_of(r)[1]) > 0.01:
          continue
        a, b = max(
          ((a, b) for a in r for b in r),
          key=lambda ab: math.hypot(ab[0][0] - ab[1][0], ab[0][2] - ab[1][2]),
        )
        start = np.array([a[0], a[2]])
        direction = np.array([b[0] - a[0], b[2] - a[2]])
        length = np.linalg.norm(direction)
        if length < 5:
          continue
        direction /= length
        normal = np.array([direction[1], -direction[0]])
        if foot.covers(Point(*(start + direction * length / 2 + normal * 0.15))):
          normal *= -1
        poly = Polygon(
          [[(np.array([p[0], p[2]]) - start) @ direction, p[1]] for p in r]
        )
        low, high = min(p[1] for p in r), max(p[1] for p in r)
        pitch = 3.4 if building["site"] == "adlershof" else 3.0
        for y in np.arange(max(low + 1.0, 4), high - 1.5, 3.25):
          for u in np.arange(1.8, length - 1.5, pitch):
            if not poly.covers(box(u - 0.65, y, u + 0.65, y + 1.7)):
              continue

            def point(s: float, t: float, d: float = 0.09) -> list:
              xz = start + direction * s + normal * d
              return [float(xz[0]), t, float(xz[1])]

            mesh.polygon(
              [
                point(u - 0.72, y - 0.08),
                point(u + 0.72, y - 0.08),
                point(u + 0.72, y + 1.78),
                point(u - 0.72, y + 1.78),
              ],
              FRAME,
              "window surround",
            )
            mesh.polygon(
              [
                point(u - 0.6, y, 0.11),
                point(u + 0.6, y, 0.11),
                point(u + 0.6, y + 1.7, 0.11),
                point(u - 0.6, y + 1.7, 0.11),
              ],
              GLASS,
              "window glazing",
            )
            mesh.polygon(
              [
                point(u - 0.035, y, 0.13),
                point(u + 0.035, y, 0.13),
                point(u + 0.035, y + 1.7, 0.13),
                point(u - 0.035, y + 1.7, 0.13),
              ],
              PLASTER,
              "window mullion",
            )
            counts["estimatedWindowGroups"] += 1
  return mesh, dict(counts)


def navigation(buildings: list, bounds: list, family: str) -> list:
  """Use complete measured part footprints, retaining their real court holes."""
  result = []
  for b in buildings:
    for p in b["parts"]:
      geometry = unary_union([shape(g) for g in p["footprints"]])
      high = p["maxY"]
      if family == "minecraft":
        native = outlines.native_polygon(geometry)
        if native.is_empty:
          # The measured ESZ closure strip is only centimetres wide. Centre
          # sampling cannot represent it; preserve its intersecting native
          # cells instead of silently dropping the complete source part.
          x0, z0, x1, z1 = geometry.bounds
          native = unary_union(
            [
              cell
              for x in range(math.floor(x0 / 2) * 2, math.ceil(x1 / 2) * 2, 2)
              for z in range(math.floor(z0 / 2) * 2, math.ceil(z1 / 2) * 2, 2)
              if (cell := box(x, z, x + 2, z + 2)).intersection(geometry).area > 0
            ]
          )
        geometry = native
        high = 3 + math.ceil((high - 3) / 2) * 2
      for ring in outlines.navigation_polygons(geometry, bounds[0], bounds[1]):
        result.append(
          {
            **ring,
            "sourceId": b["id"],
            "partId": p["id"],
            "height": high - 3,
            "minHeight": max(0, p["minY"] - 3),
            "heightSource": "Berlin LoD2 complete part envelope; native uses surface cells",
          }
        )
  return result


def build() -> dict:
  """Write only v261 assets and exact descriptor replacements, retaining originals."""
  source = io.read_json(SOURCE)
  manifest = io.read_json(OUT / "manifest.json")
  # After integration the manifest points at our new assets. Rebuild from the
  # frozen original descriptors, never progressively refine our own result.
  baseline = (
    {r["old"]["id"]: r["old"] for r in io.read_json(ADDITION)["replacements"]}
    if ADDITION.exists()
    else {c["id"]: c for c in manifest["chunks"]}
  )
  groups = [
    (
      [
        b
        for b in source["buildings"]
        if b["oldOwner"] and b["name"] != "Isothermische Kugellabore"
      ],
      "east200-20_19",
    ),
    (
      [b for b in source["buildings"] if b["name"] == "Isothermische Kugellabore"],
      "east200-21_19",
    ),
    ([b for b in source["buildings"] if b["site"] == "kuehn"], "kuehn261-26_24"),
  ]
  replacements, additions, receipts = [], [], []
  for buildings, identity in groups:
    old = baseline.get(identity) if identity.startswith("east200-") else None
    if old:
      for family in ["drawn", "minecraft"]:
        assert io.digest(OUT / old[family]["url"]) == old[family]["sha256"]
    bounds = old["bounds"] if old else [13312, 12288, 13824, 12800]
    descriptor = (
      copy.deepcopy(old)
      if old
      else {"id": identity, "bounds": bounds, "buildingCount": len(buildings)}
    )
    drawn, counts = detail(buildings)
    native = merge_native_faces(native_detail(drawn))
    for family, model in [("drawn", drawn), ("minecraft", native)]:
      packet = (
        io.read_json(OUT / old[family]["url"])
        if old
        else empty_packet(identity, bounds)
      )
      receipt = {
        "id": identity,
        "family": family,
        "owners": [b["id"] for b in buildings],
        "counts": counts,
      }
      if old:
        receipt.update(
          oldAsset=old[family], **remove_old(packet, buildings, family, bounds)
        )
      else:
        site = unary_union(
          [shape(g) for b in buildings for p in b["parts"] for g in p["footprints"]]
        ).convex_hull
        ground = outlines.PackedMesh(bounds[0], bounds[1])
        display = outlines.native_polygon(site) if family == "minecraft" else site
        ground.surface(display, 3, (186, 180, 162))
        packet["meshes"].append(ground.payload("kuehn-site-ground"))
        packet["nav"]["ground"] = outlines.navigation_polygons(
          display, bounds[0], bounds[1]
        )
        receipt["siteFootprint"] = mapping(site)
      packet["meshes"].extend(pack_detail(model, bounds))
      packet["nav"]["buildings"].extend(navigation(buildings, bounds, family))
      path = OUT / f"adlershof261-{identity}.{family}.json.gz"
      io.write_json(path, packet)
      decoded = len(gzip.decompress(path.read_bytes()))
      assert path.stat().st_size < 650000 and decoded < 2600000, (
        identity,
        family,
        decoded,
      )
      descriptor[family] = {
        "url": path.name,
        "bytes": path.stat().st_size,
        "decodedBytes": decoded,
        "encoding": "gzip",
        "sha256": io.digest(path),
      }
      receipt["newAsset"] = descriptor[family]
      receipts.append(receipt)
    (replacements if old else additions).append(
      {"old": old, "new": descriptor} if old else descriptor
    )
  result = {
    "step": 10,
    "schemaVersion": 1,
    "sourceSha256": io.digest(SOURCE),
    "receipts": receipts,
    "sourceOwners": len(source["buildings"]),
    "sourceParts": sum(len(b["parts"]) for b in source["buildings"]),
    "policy": "Replace only exactly reproduced flat source prisms with all measured sheets. Every unrelated triangle, vertex/color buffer, navigation record and original source asset remains. Kühn is a separate bounded workshop footprint at Richterstrasse 6, Bohnsdorf. Native surfaces are independently orthogonal; no budget or tour changes.",
  }
  io.write_json(EVIDENCE, result)
  site = next(r["siteFootprint"] for r in receipts if "siteFootprint" in r)
  io.write_json(
    ADDITION,
    {
      "replacements": replacements,
      "chunks": additions,
      "footprint": outlines.navigation_polygons(shape(site), 0, 0),
      "adlershofKuehnV261": {
        "source": SOURCE.name,
        "sourceSha256": io.digest(SOURCE),
        "evidence": EVIDENCE.name,
      },
    },
  )
  print(
    json.dumps(
      {
        "owners": result["sourceOwners"],
        "parts": result["sourceParts"],
        "assets": [r["newAsset"] for r in receipts],
      },
      indent=2,
    )
  )
  return result


if __name__ == "__main__":
  build()
