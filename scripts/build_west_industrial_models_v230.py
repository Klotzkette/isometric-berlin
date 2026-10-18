"""Full original industrial shells, clipped recognition and a documented tower.

Original OSM/LoD2 records stay in the bounded source file. Rendering replaces
only independently replayed old owners, at their existing ground datum. Opening
rhythms/material shades and cooling-tower radial profile are explicit estimates.
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

from shapely.geometry import Point, Polygon, mapping, shape
from shapely.ops import transform, unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
from build_breitscheid_towers_v161 import triangles_for
from build_district_courts_v229 import face_for
from build_school_culture_v228 import label
from build_schools_places_v205 import group
from build_steglitz_v182 import native_blocks
from build_townhall_envelopes_v227 import color_tag
from build_townhall_source_v227 import (
  DATA,
  GEO,
  TO_METRES,
  digest,
  read,
  source_wall_edges,
  world_geometry,
  write,
)
from build_west_industrial_v230 import SOURCE


def sheet_triangles(rings):
  """Triangulate original sheets in a translated plane without cancellation.

  Millimetre-quantized fallback slivers can contain zero-area edges; those have
  no drawable surface. Exact source rings stay untouched in retained evidence.
  """
  import numpy as np
  from shapely import constrained_delaunay_triangles, make_valid

  origin = np.asarray(rings[0][0], dtype=float)
  ring = [np.asarray(p, dtype=float) - origin for p in rings[0]]
  n = sum((np.cross(a, b) for a, b in zip(ring, ring[1:] + ring[:1])), np.zeros(3))
  if np.linalg.norm(n) < 1e-8:
    return []
  missing = int(np.argmax(np.abs(n)))
  axes = [i for i in range(3) if i != missing]
  projected = [
    [(p[axes[0]] - origin[axes[0]], p[axes[1]] - origin[axes[1]]) for p in r]
    for r in rings
  ]
  original_vertices = {
    tuple(q): list(p) for r, ps in zip(rings, projected) for p, q in zip(r, ps)
  }
  polygon = make_valid(Polygon(projected[0], projected[1:]))
  polygons = (
    [polygon]
    if polygon.geom_type == "Polygon"
    else [p for p in getattr(polygon, "geoms", []) if p.geom_type == "Polygon"]
  )
  result = []
  for poly in polygons:
    if poly.area < 1e-8:
      continue
    for triangle in constrained_delaunay_triangles(poly).geoms:
      vertices = []
      for q in list(triangle.exterior.coords)[:3]:
        if tuple(q) in original_vertices:
          vertices.append(original_vertices[tuple(q)])
          continue
        v = origin.copy()
        v[axes] = np.asarray(q) + origin[axes]
        v[missing] = (
          origin[missing] - sum(n[i] * (v[i] - origin[i]) for i in axes) / n[missing]
        )
        vertices.append([round(float(c), 3) for c in v])
      if (
        np.dot(
          np.cross(
            np.subtract(vertices[1], vertices[0]), np.subtract(vertices[2], vertices[0])
          ),
          n,
        )
        < 0
      ):
        vertices.reverse()
      result.append(vertices)
  return result


def poly(part):
  return Polygon(part["ring"], part.get("holes", [])).buffer(0)


def closest_osm(site, parent):
  geometry = unary_union([poly(p) for p in parent["parts"]])
  return max(
    site["osm"],
    key=lambda r: (
      geometry.intersection(
        world_geometry(transform(TO_METRES, shape(r["geometry"])))
      ).area
    ),
  )


def recognition(target, part, offset, modern, warehouse, neighbours):
  """Only visible measured wall spans, never openings across source roofs."""
  for edge in source_wall_edges(part, offset):
    a, b, n = edge["a"], edge["b"], edge["normal"]
    w = math.dist(a, b)
    height = edge["eave"] - edge["base"]
    if w < 3.8 or height < 4.1:
      continue
    probe = Point((a[0] + b[0]) / 2 + n[0] * 0.65, (a[1] + b[1]) / 2 + n[1] * 0.65)
    # Exact source owners can touch: never decorate shared party walls.
    if any(
      p.covers(probe) and low < edge["base"] + height * 0.5 < high
      for p, low, high in neighbours
    ):
      continue
    f = face_for(target, edge)
    stone = 0xC7B999 if warehouse else 0xD2C6AC
    u = (f.left + f.right) / 2
    f.member(u, f.base + 0.5, w - 0.3, 0.28, stone, 0.12, 0.22)
    f.member(u, f.top - 0.28, w - 0.3, 0.24, stone, 0.15, 0.26)
    pitch = 4.8 if warehouse else 3.6
    floors = max(1, int((height - 1) / (4.25 if warehouse else 3.25)))
    count = max(1, int((w - 1.4) / pitch))
    for j in range(floors):
      y = f.base + 2.05 + j * (4.25 if warehouse else 3.25)
      for i in range(count):
        x = f.left + (i + 0.5) * w / count
        ww = 1.95 if warehouse else 1.35
        wh = 1.9 if warehouse else 1.65
        f.member(x, y, ww + 0.22, wh + 0.22, stone, 0.10, 0.26)
        f.member(x, y, ww, wh, 0x657C7B if warehouse else 0x718B89, 0.10, 0.40)
        f.member(x, y, 0.07, wh, 0xC7CCBC, 0.08, 0.47)
        f.member(x, y + 0.12, ww, 0.07, 0xC7CCBC, 0.08, 0.47)
    if warehouse and w > 15:
      # Documented loading-door/hoist grammar; positions are measured-wall estimates.
      bays = max(1, int(w / 18))
      for i in range(bays):
        x = f.left + (i + 0.5) * w / bays
        f.member(x, f.base + 1.7, 2.6, 3.0, 0x58645F, 0.14, 0.48)
        f.member(x, f.base + 3.3, 3.0, 0.22, stone, 0.12, 0.5)
        if height > 8:
          f.member(x, min(f.top - 0.8, f.base + 6.0), 0.15, 2.3, 0x555C57, 0.15, 0.52)
      f.member(u, f.top - 0.8, w - 0.6, 0.12, 0x4F5753, 0.10, 0.47)
    if not modern:
      for x in [f.left + 0.25, f.right - 0.25]:
        f.member(x, (f.base + f.top) / 2, 0.25, height - 0.5, stone, 0.12, 0.28)


def tower(site):
  """Open shell: 100 m source height, exact mapped centre/base radius.

  LoD2 preserves the surveyed low service/basin building only. Intermediate
  radii, 0.9 m shell thickness, panel/stripe rhythm are photograph-based estimates.
  No top disk and no cylindrical/chimney proxy is generated.
  """
  footprint = shape(site["worldFootprint"])
  c = footprint.centroid
  base_radius = math.sqrt(footprint.area / math.pi)
  profile = [
    [15.218, base_radius],
    [23, base_radius * 0.94],
    [35, base_radius * 0.865],
    [48, base_radius * 0.805],
    [61, base_radius * 0.765],
    [75, base_radius * 0.75],
    [87, base_radius * 0.758],
    [103, base_radius * 0.79],
  ]
  segments = 128
  surfaces = []

  def vertex(theta, y, r):
    return [round(c.x + r * math.cos(theta), 3), y, round(c.y + r * math.sin(theta), 3)]

  for j, ((lo, r0), (hi, r1)) in enumerate(zip(profile, profile[1:])):
    for k in range(segments):
      a, b = k * 2 * math.pi / segments, (k + 1) * 2 * math.pi / segments
      # The photographed dark vertical bands occupy the lower-middle shell.
      color = (
        0x656861 if 1 <= j <= 3 and k % 4 < 2 else (0xC4C3B8 if k % 2 else 0xB9B9AE)
      )
      ring = [
        vertex(a, lo, r0),
        vertex(b, lo, r0),
        vertex(b, hi, r1),
        vertex(a, hi, r1),
      ]
      surfaces.append(
        {
          "color": color,
          "triangles": [[ring[0], ring[1], ring[2]], [ring[0], ring[2], ring[3]]],
        }
      )
      inner = [
        vertex(a, lo, r0 - 0.9),
        vertex(a, hi, r1 - 0.9),
        vertex(b, hi, r1 - 0.9),
        vertex(b, lo, r0 - 0.9),
      ]
      surfaces.append(
        {
          "color": 0x8A8D84,
          "triangles": [[inner[0], inner[1], inner[2]], [inner[0], inner[2], inner[3]]],
        }
      )
  # Only a thin annular top rim; its centre remains open in both modes.
  y, r = profile[-1]
  for k in range(segments):
    a, b = k * 2 * math.pi / segments, (k + 1) * 2 * math.pi / segments
    ring = [
      vertex(a, y, r),
      vertex(b, y, r),
      vertex(b, y, r - 0.9),
      vertex(a, y, r - 0.9),
    ]
    surfaces.append(
      {
        "color": 0xC8C7BD,
        "triangles": [[ring[0], ring[1], ring[2]], [ring[0], ring[2], ring[3]]],
      }
    )
  return surfaces, dict(
    center=[round(c.x, 3), round(c.y, 3)],
    ground=3,
    height=100,
    profile=profile,
    thickness=0.9,
    heightSource="BEW 2025 UVP report and retained OSM way/26131445 height=100",
    profileEstimated=True,
    osmOwner="way/26131445",
  )


def compile_models():
  source = read(SOURCE)
  receipt = read(DATA / "westIndustrialV230Ownership.json")
  assert receipt["sourceSha256"] == digest(SOURCE)
  assert not receipt["blocked"], (
    "A required complete replacement needs every old owner in both modes"
  )
  approved = set(receipt["authorizedOwners"])
  drawn = []
  native = []
  navigation = []
  audits = []
  for site in source["sites"]:
    assert set(site["previousOwners"]) <= approved
    chunks = {}
    geometry = []
    for p in site["parents"]:
      for part in p["parts"]:
        geometry.append(
          (
            poly(part),
            part["ground_y_m"] + p["rigidYOffset"],
            part["top_y_m"] + p["rigidYOffset"],
          )
        )
    for parent in site["parents"]:
      offset = parent["rigidYOffset"]
      gparent = unary_union([poly(p) for p in parent["parts"]])
      c = gparent.centroid
      key = site["key"] + f"-{math.floor(c.x / 256)}_{math.floor(c.y / 256)}"
      g = chunks.setdefault(
        key,
        dict(
          **group(site["name"], key),
          key=key,
          siteKey=site["key"],
          owners=[],
          surfaces=[],
          nav=[],
          roofTriangles=[],
          pads=[],
        ),
      )
      g["owners"].append(parent["id"])
      osm = closest_osm(site, parent)
      tags = osm["tags"]
      year = tags.get("start_date", "")[:4]
      modern = tags.get("building") in {"apartments", "residential", "house"} or (
        year.isdigit() and int(year) > 1950
      )
      historical_island = (
        site["key"] == "eiswerder"
        and not modern
        and (
          (year.isdigit() and int(year) < 1945)
          or tags.get("addr:housenumber", "").startswith(("16", "18"))
        )
      )
      historic = site["key"] == "westhafen" or historical_island
      neutral = [0xCEC5B4, 0xC2B8A3, 0xC9CBBB][int(osm["id"].split("/")[1]) % 3]
      wall = color_tag(tags.get("building:colour"), 0x80624F if historic else neutral)
      roof = color_tag(
        tags.get("roof:colour"), 0x6B716A if site["key"] == "westhafen" else 0x8B7460
      )
      if site["key"] == "reuter-west":
        wall, roof = 0xB9B9AD, 0x8D938A
      for part in parent["parts"]:
        g["nav"].append(
          dict(
            id=part["id"],
            owner=parent["id"],
            ring=part["ring"],
            holes=part["holes"],
            low=round(part["ground_y_m"] + offset, 3),
            high=round(part["top_y_m"] + offset, 3),
          )
        )
        for sheet in part["surfaces"]:
          rings = [
            [[x, round(y + offset, 3), z] for x, y, z in r] for r in sheet["rings"]
          ]
          tri = sheet_triangles(rings)
          if not tri:
            continue
          isroof = sheet["kind"] == "RoofSurface"
          g["surfaces"].append(
            dict(color=roof if isroof else wall, roof=isroof, triangles=tri)
          )
          if isroof:
            g["roofTriangles"].extend(tri)
        # Thin residual slivers preserve exact old footprint, but never receive
        # invented window grids. Meaningful fallback houses still get detail.
        if site["key"] != "reuter-west" and poly(part).area > 25:
          recognition(g, part, offset, modern, historic, geometry)
      if site["key"] == "westhafen" and osm["id"] == "way/26929310":
        faces = [
          face_for(g, e)
          for p in parent["parts"]
          for e in source_wall_edges(p, offset)
          if math.dist(e["a"], e["b"]) > 12 and e["eave"] - e["base"] > 5
        ]
        if faces:
          f = max(faces, key=lambda f: f.length)
          label(f, "BEHALA", (f.left + f.right) / 2, f.top - 1.6, 1.0, 0xDBD0AF)
    if site["key"] == "reuter-west":
      g = next(iter(chunks.values()))
      surfaces, info = tower(site)
      g["surfaces"].extend(surfaces)
      g["tower"] = info
      g["roofTriangles"].extend(t for s in surfaces[-128:] for t in s["triangles"])
      footprint = unary_union(
        [shape(site["worldFootprint"]), *[v[0] for v in geometry]]
      )
      pieces = [footprint] if footprint.geom_type == "Polygon" else footprint.geoms
      for p in pieces:
        ring = [[round(x, 3), round(z, 3)] for x, z in list(p.exterior.coords)[:-1]]
        holes = [
          [[round(x, 3), round(z, 3)] for x, z in list(r.coords)[:-1]]
          for r in p.interiors
        ]
        pad = dict(ring=ring, holes=holes, low=-2, high=3)
        g["pads"].append(pad)
        g["surfaces"].append(
          dict(
            color=0xA3A599,
            triangles=triangles_for(
              [[[x, 3, z] for x, z in r] for r in [ring, *holes]]
            ),
          )
        )
      # Named source footprint only; no district rectangle or adjacent plant infill.
      write(
        GEO / "west-industrial-v230-required-extent.json",
        dict(
          key="reuter-west",
          worldGeometry=mapping(footprint),
          bounds=list(footprint.bounds),
          reason="Complete original cooling-tower parent/service base plus mapped shell footprint",
        ),
      )
    for key, g in sorted(chunks.items()):
      print(
        key,
        len(g["surfaces"]),
        "sheets",
        len(g["boxes"]),
        "fits; native skin",
        flush=True,
      )
      skin = native_blocks(dict(surfaces=g["surfaces"], boxes=[], rods=[]))
      # Source skin is independent orthogonal geometry; native facade members are
      # constructed on outward stepped source faces, never rotated drawn copies.
      native_rows = skin + g["nativeRows"]
      points = [
        v for p in [*g["nav"], *g["pads"]] for r in [p["ring"], *p["holes"]] for v in r
      ]
      bounds = [
        min(v[0] for v in points),
        min(v[1] for v in points),
        max(v[0] for v in points),
        max(v[1] for v in points),
      ]
      common = dict(key=key, siteKey=g["siteKey"], name=g["name"], owners=g["owners"])
      drawn.append(
        common | dict(surfaces=g["surfaces"], boxes=g["boxes"], labels=g["labels"])
      )
      native.append(
        common | dict(blocks=native_rows, skinCount=len(skin), labels=g["labels"])
      )
      navigation.append(
        dict(
          key=key,
          bounds=list(bounds),
          owners=g["nav"],
          roofTriangles=g["roofTriangles"],
          pads=g["pads"],
          tower=g.get("tower"),
        )
      )
      audits.append(
        common
        | dict(
          sourceParts=len(g["nav"]),
          sheets=len(g["surfaces"]),
          triangles=sum(len(s["triangles"]) for s in g["surfaces"]),
          nativeSkinRuns=len(skin),
          drawnFittings=len(g["boxes"]),
          nativeFittings=len(g["nativeRows"]),
          wallFaces=g["faces"],
        )
      )
  for name, items in [
    ("westIndustrialV230Envelopes", drawn),
    ("westIndustrialV230Native", native),
    ("westIndustrialV230Navigation", navigation),
  ]:
    write(DATA / (name + ".json"), dict(sites=items))
  write(
    GEO / "west-industrial-v230-evidence.json",
    dict(
      sourceSha256=digest(SOURCE),
      ownershipSha256=digest(DATA / "westIndustrialV230Ownership.json"),
      sites=audits,
      limitations="Original measured sheets and original mapped fallback residuals retained. All window rhythms, trim, untagged materials and cooling-tower intermediate radii are bounded visual estimates, not a facade survey. Shell height100m comes from current official BEW UVP; no top cap.",
    ),
  )
  print(
    "Runtime bytes",
    sum(
      (DATA / (n + ".json")).stat().st_size
      for n in [
        "westIndustrialV230Envelopes",
        "westIndustrialV230Native",
        "westIndustrialV230Navigation",
      ]
    ),
  )


if __name__ == "__main__":
  compile_models()
