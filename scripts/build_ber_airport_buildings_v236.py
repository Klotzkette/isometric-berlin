"""Step 10: source-bound BER architecture, returned to the shared packet builder.

Complete OSM rings stay in a bounded replay archive. Existing v200 lines/v205
caps, columns and glass are never removed or re-emitted. No runtime scene root.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

import numpy as np
import shapely
from build_karl_marx_allee_v161 import Detail
from build_region_outlines_v200 import (
  RAW,
  height,
  mapped_shapes,
  polygons,
  world,
  xml_elements,
)
from build_surrounding_outlines import native_polygon
from shapely.affinity import scale, translate
from shapely.geometry import LineString, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
SOURCE = GEO / "ber-buildings-v236-source.json.gz"
EVIDENCE = GEO / "ber-buildings-v236-evidence.json"
OLD = ROOT / "src/app/src/data/berAirportV205.json"
ROOF_PATCH = ROOT / "src/app/src/data/berAirportRoofPatchV236.json"
LANDSIDE = {
  128894403,
  157811263,
  157811265,
  158252003,
  158252005,
  158251999,
  157807988,
  885812396,
  193019556,
  193019557,
  1083495099,
  193019551,
  519141136,
}
T1 = "way/1132137322"
OUTLINE_PARENTS = {T1, "way/193677374"}
T2_BRIDGES = {"way/999966725", "way/999966726"}
NORTH_PIER = "way/1083495102"
COLORS = {
  "wall": (189, 190, 180),
  "roof": (151, 158, 157),
  "glass": (104, 137, 144),
  "frame": (210, 214, 203),
  "metal": (182, 191, 194),
  "concrete": (178, 177, 165),
  "soffit": (205, 198, 176),
  "dark": (89, 107, 112),
}


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def save(path, value):
  raw = (json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  path.write_bytes(gzip.compress(raw, mtime=0) if path.suffix == ".gz" else raw)


def extract():
  regional = read(GEO / "region-outlines-v200-source.json.gz")
  old = read(GEO / "ber-v205-parts-source.json")
  elements = {}
  hashes = {}
  for name in ("ber-map.osm", "ber-west.osm", "ber-north.osm"):
    path = RAW / name
    elements.update(xml_elements(path))
    hashes[name] = hashlib.sha256(path.read_bytes()).hexdigest()
  shapes, _ = mapped_shapes(elements)
  records = {
    f["id"]: {**f, "origin": "regional-v200"}
    for f in regional["features"]
    if f.get("site") == "BER" and f["kind"] == "building"
  }
  for f in old["features"]:
    records[f["id"]] = {**f, "origin": "parts-v205"}
  airport = shape(regional["sites"]["BER"]["geometry"])
  for key, element in elements.items():
    if (
      key[0] != "way"
      or key not in shapes
      or shapes[key].geom_type not in ("Polygon", "MultiPolygon")
    ):
      continue
    tags = element["tags"]
    geometry = shapes[key]
    identity = f"way/{key[1]}"
    if identity in records:
      continue
    landside = key[1] in LANDSIDE
    exterior_part = (
      tags.get("building:part")
      and "height" in tags
      and not tags.get("indoor")
      and airport.intersects(geometry)
    )
    if landside or exterior_part:
      records[identity] = {
        "id": identity,
        "tags": tags,
        "geometry": mapping(geometry),
        "origin": "mapped-landside-v236" if landside else "mapped-part-v236",
      }
  source = {
    "schema": 1,
    "license": "OpenStreetMap contributors, ODbL-1.0",
    "rawSha256": hashes,
    "retainedSourceSha256": {
      str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
      for p in [
        GEO / "region-outlines-v200-source.json.gz",
        GEO / "ber-v205-parts-source.json",
        OLD,
      ]
    },
    "features": list(records.values()),
    "references": [
      "https://www.gmp.de/de/aktuelles/41/presse/8766/ready-for-take-off-flugbetrieb-am-ber-startet",
      "https://corporate.berlin-airport.de/content/dam/corporate/de/unternehmen-presse/ber/flughafenanlagen-ber.pdf",
      "https://www.atp.ag/de/projekte/terminal-2-flughafen-berlin-brandenburg/",
      "https://www.imhof-architektur.de/tower-ber",
    ],
  }
  save(SOURCE, source)
  return source


def surface(detail, geometry, y, colour, role):
  for polygon in polygons(shapely.make_valid(geometry)):
    for triangle in shapely.constrained_delaunay_triangles(polygon).geoms:
      p = list(triangle.exterior.coords)[:3]
      detail.polygon([[x, y, z] for x, z in p], colour, role)


def walls(detail, geometry, low, high, colour, role):
  for poly in polygons(shapely.orient_polygons(geometry, exterior_cw=True)):
    for ring in [poly.exterior, *poly.interiors]:
      for (ax, az), (bx, bz) in zip(ring.coords, list(ring.coords)[1:]):
        detail.polygon(
          [[ax, low, az], [bx, low, bz], [bx, high, bz], [ax, high, az]], colour, role
        )


def beam(detail, a, b, y, width, thickness, colour, role, native):
  dx, dz = b[0] - a[0], b[1] - a[1]
  length = math.hypot(dx, dz)
  if length < 0.05:
    return
  if native:
    # independent axis-aligned stepped construction; no rotated native boxes.
    count = max(1, math.ceil(length / 3))
    for i in range(count):
      detail.box(
        [a[0] + dx * (i + 0.5) / count, y, a[1] + dz * (i + 0.5) / count],
        [max(width, abs(dx) / count), thickness, max(width, abs(dz) / count)],
        colour,
        role,
      )
  else:
    poly = LineString([a, b]).buffer(width / 2, cap_style="flat")
    walls(detail, poly, y - thickness / 2, y + thickness / 2, colour, role)
    surface(detail, poly, y + thickness / 2, colour, role)


def frontage(detail, geometry, low, high, usage, native, role, storeys=None):
  """Illustrative profiles on the actual wall edge, bounded to the source wall."""
  for polygon in polygons(shapely.orient_polygons(geometry, exterior_cw=True)):
    for ring in [polygon.exterior, *polygon.interiors]:
      for a, b in zip(ring.coords, list(ring.coords)[1:]):
        dx, dz = b[0] - a[0], b[1] - a[1]
        length = math.hypot(dx, dz)
        if length < 3:
          continue
        nx, nz = -dz / length, dx / length
        levels = (
          [low + 1.5]
          if usage == "hangar"
          else list(np.arange(low + 2.2, high - 0.6, 3.3))
        )
        if usage == "parking":
          levels = list(np.arange(low + 1.5, high - 0.6, 2.7))
        step = (high - low) / storeys if storeys else 3.3
        if storeys:
          levels = [low + step * i + min(1.5, step * 0.25) for i in range(storeys)]
        for y in levels:
          h = min(1.35, high - y - 0.15)
          if h <= 0:
            continue
          # Continuous bands at hangars/parking/terminal volumes are explicitly
          # display subdivisions; all axes remain on the mapped exterior.
          if usage in ("parking", "hangar", "terminal"):
            aa = [a[0] + nx * 0.035, a[1] + nz * 0.035]
            bb = [b[0] + nx * 0.035, b[1] + nz * 0.035]
            detail.polygon(
              [
                [aa[0], y, aa[1]],
                [bb[0], y, bb[1]],
                [bb[0], y + h, bb[1]],
                [aa[0], y + h, aa[1]],
              ],
              COLORS["dark"] if usage == "parking" else COLORS["glass"],
              role + " glazing",
            )
            # Since native geometry's edges are orthogonal, these sheets are too.
          else:
            count = max(1, int(length / 5))
            for i in range(count):
              u = (i + 0.5) / count
              w = min(1.5, length / count * 0.55)
              cx = a[0] + dx * u + nx * 0.035
              cz = a[1] + dz * u + nz * 0.035
              detail.polygon(
                [
                  [cx - dx / length * w / 2, y, cz - dz / length * w / 2],
                  [cx + dx / length * w / 2, y, cz + dz / length * w / 2],
                  [cx + dx / length * w / 2, y + h, cz + dz / length * w / 2],
                  [cx - dx / length * w / 2, y + h, cz - dz / length * w / 2],
                ],
                COLORS["glass"],
                role + " window",
              )
        if usage in ("parking", "terminal"):
          for y in np.arange(low + step, high - 0.1, step):
            beam(
              detail,
              a,
              b,
              float(y),
              0.16,
              0.18,
              COLORS["frame"],
              role + " slab edge",
              native,
            )


def outline_only(identity, tags):
  """Do not turn source envelopes/unknown raised structures into solid walls."""
  if identity in OUTLINE_PARENTS:
    return "coarse complete-terminal envelope; mapped parts carry the solids"
  if tags.get("location") == "underground":
    return "underground"
  if tags.get("building") in ("construction", "ruins"):
    return "unfinished construction or ruins"
  if "height" not in tags and (
    tags.get("building") in ("bridge", "roof") or tags.get("building:part") == "roof"
  ):
    return "raised bridge/canopy without a supported height interval"
  return None


def envelope(tags):
  tagged, why = height(tags)
  return 3 + float(tags.get("min_height", 0)), 3 + tagged, why


def tower_shaft(geometry):
  """Narrow concrete shaft recognition estimate, entirely inside mapped crown."""
  rectangle = geometry.minimum_rotated_rectangle
  center = shapely.maximum_inscribed_circle(geometry).coords[0]
  rectangle = translate(
    rectangle,
    xoff=center[0] - rectangle.centroid.x,
    yoff=center[1] - rectangle.centroid.y,
  )
  for factor in (0.36, 0.32, 0.28, 0.24):
    candidate = scale(rectangle, xfact=factor, yfact=factor, origin="centroid")
    if geometry.covers(candidate):
      return candidate
  raise ValueError("DFS shaft estimate must stay inside retained source crown")


def rings(geometry):
  return [
    [[list(p) for p in ring.coords] for ring in [poly.exterior, *poly.interiors]]
    for poly in polygons(geometry)
  ]


def native_roof_rows(old_rows, cut):
  """Preserve every untouched old box; split only intersected boxes orthogonally."""
  rows = []
  for row in old_rows:
    x, y, z, w, h, d, colour = row
    original = box(x - w / 2, z - d / 2, x + w / 2, z + d / 2)
    if original.intersection(cut).area < 1e-9:
      rows.append(row)
      continue
    remainder = original.difference(cut)
    zs = sorted(
      {
        p[1]
        for poly in polygons(remainder)
        for ring in [poly.exterior, *poly.interiors]
        for p in ring.coords
      }
    )
    for za, zb in zip(zs, zs[1:]):
      section = remainder.intersection(
        LineString([(x - w, (za + zb) / 2), (x + w, (za + zb) / 2)])
      )
      segments = [section] if section.geom_type == "LineString" else section.geoms
      for segment in segments:
        if segment.is_empty or segment.length <= 1e-9:
          continue
        xa, _, xb, _ = segment.bounds
        rows.append([(xa + xb) / 2, y, (za + zb) / 2, xb - xa, h, zb - za, colour])
  return rows


def roof_patch(old, bridge_footprints):
  parent = old[NORTH_PIER]
  original = Polygon(parent["rings"][0], parent["rings"][1:])
  native_original = unary_union(
    [
      box(r[0] - r[3] / 2, r[2] - r[5] / 2, r[0] + r[3] / 2, r[2] + r[5] / 2)
      for r in parent["native"]
    ]
  )
  native_cut = native_polygon(bridge_footprints)
  drawn = original.difference(bridge_footprints)
  native = native_original.difference(native_cut)
  patch = {
    "schema": 1,
    "id": NORTH_PIER,
    "bridgeIds": sorted(T2_BRIDGES),
    "sourceSha256": read(OLD)["sourceSha256"],
    "originalFileSha256": hashlib.sha256(OLD.read_bytes()).hexdigest(),
    "buildingSourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "bridgeChecks": [
      {
        "drawn": list(p.representative_point().coords)[0],
        "minecraft": list(
          native_original.intersection(native_polygon(p)).representative_point().coords
        )[0],
      }
      for p in polygons(bridge_footprints)
    ],
    "drawnRings": rings(drawn),
    "nativeRings": rings(native),
    "nativeRows": native_roof_rows(parent["native"], native_cut),
    "removedArea": {
      "drawn": original.intersection(bridge_footprints).area,
      "minecraft": native_original.intersection(native_cut).area,
    },
    "policy": "Only the old north-pier cap and its edge profiles over the two mapped elevated T2 bridges are corrected; complete original v205 source remains unchanged. Native cut follows independent 2m bridge cells within existing 2.5m roof runs.",
  }
  save(ROOF_PATCH, patch)
  return drawn, native


def build():
  source = read(SOURCE) if SOURCE.exists() else extract()
  old = {p["id"]: p for p in read(OLD)["buildings"]}
  drawn, native = Detail(), Detail()
  nav = []
  evidence = []
  additional_scope = []
  geometry = {
    f["id"]: transform(world, shape(f["geometry"])) for f in source["features"]
  }
  feature = {f["id"]: f for f in source["features"]}
  bridge_footprints = unary_union([geometry[i] for i in sorted(T2_BRIDGES)])
  north_drawn, north_native = roof_patch(old, bridge_footprints)
  existing_parents = []
  for identity, geom in geometry.items():
    f = feature[identity]
    if outline_only(identity, f["tags"]):
      continue
    if identity in old:
      p = old[identity]
      if p["column"] or p["glass"] or p["tower"] or identity == "way/1082978657":
        continue
      existing_parents.append((identity, geom, p["bottom"], p["top"]))
    elif f["origin"] == "regional-v200":
      low, high, _ = envelope(f["tags"])
      existing_parents.append((identity, geom, low, high))
  for f in source["features"]:
    identity, tags = f["id"], f["tags"]
    geom = geometry[identity]
    if f["origin"] == "mapped-landside-v236":
      additional_scope.append(geom)
    reason = outline_only(identity, tags)
    if reason:
      evidence.append(
        {
          "id": identity,
          "action": "retained outline only",
          "reason": reason,
        }
      )
      continue
    if identity in old and (old[identity]["column"] or identity == "way/1082978657"):
      evidence.append(
        {"id": identity, "action": "retain existing v205 complete column/roof"}
      )
      continue
    low, high, why = envelope(tags)
    parent = next(
      (
        i
        for i, g, lo, hi in existing_parents
        if lo <= low and hi >= high and g.buffer(0.05).covers(geom)
      ),
      None,
    )
    if f["origin"] == "mapped-part-v236" and parent and identity not in T2_BRIDGES:
      evidence.append(
        {
          "id": identity,
          "action": "archive part; existing complete XYZ owner covers it",
          "parent": parent,
          "low": low,
          "high": high,
        }
      )
      continue
    cap = True
    usage = "ordinary"
    storeys = None
    if tags.get("building:levels"):
      storeys = max(
        1,
        int(float(tags["building:levels"]))
        - int(float(tags.get("building:min_level", 0))),
      )
    if identity in old:
      p = old[identity]
      low = p["bottom"]
      high = p["top"]
      cap = False
      if p["glass"]:
        # The source upper hall starts10m above ground; fill only the podium
        # below it, never duplicate/occlude its retained glass or roof.
        low, high = 3, p["bottom"]
        usage = "terminal"
        storeys = int(float(tags.get("building:min_level", 2)))
      elif p["tower"]:
        high = p["top"] - 6
        usage = "tower"
        geom = tower_shaft(geom)
        why = "retained 70m OSM crown; narrow concrete shaft cross-section estimated inside mapped outline"
      else:
        usage = "terminal"
    if high <= low:
      evidence.append(
        {"id": identity, "action": "retained only", "reason": "invalid height interval"}
      )
      continue
    if tags.get("parking") == "multi-storey":
      usage = "parking"
    elif tags.get("aeroway") == "hangar" or tags.get("building") == "hangar":
      usage = "hangar"
    elif tags.get("aeroway") == "terminal":
      usage = "terminal"
    if tags.get("building") == "roof" or tags.get("building:part") == "roof":
      low = max(low, high - 0.35)
      usage = "canopy"
    if identity in T2_BRIDGES:
      usage = "terminal"
    glass = (
      tags.get("building:material", tags.get("material")) == "glass"
      or identity in T2_BRIDGES
    )
    colour = (
      COLORS["glass"]
      if glass
      else COLORS["metal"]
      if usage in ("hangar", "parking") or tags.get("building:material") == "metal"
      else COLORS["concrete"]
      if usage == "tower"
      else COLORS["wall"]
    )
    # Existing v205 native caps use wholly contained2.5m runs. Follow their exact
    # footprint for supporting walls, instead of mixing two voxel origins.
    if identity in old and usage != "tower":
      p = old[identity]
      ng = unary_union(
        [
          box(r[0] - r[3] / 2, r[2] - r[5] / 2, r[0] + r[3] / 2, r[2] + r[5] / 2)
          for r in p["native"]
        ]
      )
    else:
      ng = native_polygon(geom)
    if identity == NORTH_PIER:
      # The retained broad owner also encompasses the two elevated T2 bridges.
      # Its old cap/line stays, but a new ground-to-roof fill must not obstruct
      # the source min_height=5m bridge clearances.
      geom, ng = north_drawn, north_native
    for detail, g, is_native in ((drawn, geom, False), (native, ng, True)):
      if g.is_empty:
        continue
      walls(
        detail,
        g,
        low,
        high,
        colour,
        identity + (" estimated shaft wall" if usage == "tower" else " source wall"),
      )
      if cap:
        surface(detail, g, high, COLORS["roof"], identity + " source roof")
      if low > 3:
        surface(detail, g, low, COLORS["soffit"], identity + " elevated underside")
      if usage not in ("canopy", "tower"):
        frontage(detail, g, low, high, usage, is_native, identity, storeys)
    # Preserve source levels and actual elevated bridge/canopy clearance.
    nav.append(
      {
        "sourceId": identity,
        "geometry": geom,
        "height": high - 3,
        "minHeight": low - 3,
        "heightSource": why,
        "mappedStoreys": storeys,
        "groundOffset": 0,
      }
    )
    evidence.append(
      {
        "id": identity,
        "origin": f["origin"],
        "action": "add source walls"
        + (" and roof" if cap else "; retain old cap/glass/columns"),
        "usage": usage,
        "low": low,
        "high": high,
        "heightSource": why,
        "mappedArea": round(geometry[identity].area, 3),
        "renderedFootprintArea": round(geom.area, 3),
        "holes": sum(len(p.interiors) for p in polygons(geom)),
        **({"clearanceParts": sorted(T2_BRIDGES)} if identity == NORTH_PIER else {}),
      }
    )
  # Only horizontal restrained cable-grid cues on the already-existing main
  # glass hall. Existing vertical source-frame details remain intact.
  hall = old["way/519141137"]
  roof = old["way/1082978657"]
  for detail, is_native in ((drawn, False), (native, True)):
    for ring in hall["rings"]:
      for a, b in zip(ring, ring[1:]):
        for y in np.arange(hall["bottom"] + 3, hall["top"] - 1, 3):
          beam(
            detail,
            a,
            b,
            float(y),
            0.12,
            0.12,
            COLORS["frame"],
            "T1 horizontal cable grid estimate",
            is_native,
          )
    rgeom = Polygon(roof["rings"][0], roof["rings"][1:])
    hgeom = Polygon(hall["rings"][0], hall["rings"][1:])
    canopy = rgeom.difference(hgeom)
    if is_native:
      canopy = native_polygon(canopy)
    surface(
      detail,
      canopy,
      roof["roofBottom"] - 0.03,
      COLORS["soffit"],
      "T1 open canopy underside",
    )
  audit = {
    "schema": 1,
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "oldV205Sha256": hashlib.sha256(OLD.read_bytes()).hexdigest(),
    "roofPatchSha256": hashlib.sha256(ROOF_PATCH.read_bytes()).hexdigest(),
    "records": evidence,
    "triangles": {"drawn": len(drawn.triangles), "minecraft": len(native.triangles)},
    "policy": "Exact retained OSM rings and holes; all existing source files unchanged. Old north-pier cap/profile portions over the two mapped T2 bridges alone receive a receipted correction. Remaining v200/v205 lines/caps/columns/glass retained. Unknown heights follow retained outline estimates; window spacing, bands, canopy thickness, material swatches and narrow DFS shaft cross-section are display estimates. Tower retains original 70m crown envelope despite primary approximate 72m. Only complete XYZ containment skips subsidiary parts; coarse terminal envelopes never become solid fills. No underground pump works, ruins, construction footprints or unknown elevated bridges/canopies become finished ground-level shells.",
  }
  save(EVIDENCE, audit)
  return {
    "drawn": drawn,
    "minecraft": native,
    "navigation": nav,
    "evidence": audit,
    "scope": unary_union(additional_scope),
  }


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--refresh-source", action="store_true")
  args = parser.parse_args()
  if args.refresh_source:
    extract()
  out = build()
  print(
    json.dumps(
      {
        "triangles": out["evidence"]["triangles"],
        "records": dict(Counter(x["action"] for x in out["evidence"]["records"])),
        "navigation": len(out["navigation"]),
        "sourceBytes": SOURCE.stat().st_size,
        "additionalScopeArea": out["scope"].area,
      }
    )
  )
