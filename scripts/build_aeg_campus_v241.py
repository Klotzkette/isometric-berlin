"""Bounded, complete AEG campus source shells and source-bound recognition.

Measured geometry comes from retained Berlin LoD2, while facade materials and
window rhythm are restrained interpretations of the cited primary references.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
from pathlib import Path

import build_townhall_core_previous_v227 as previous
from alt_mitte_v169_packets import empty_packet, pack_detail
from build_breitscheid_towers_v161 import triangles_for
from build_karl_marx_allee_v161 import Detail
from build_steglitz_v182 import native_blocks
from build_townhall_source_v227 import source_wall_edges
from shapely.affinity import translate
from shapely.geometry import Point, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "aeg-campus-v241-source.json.gz"
OWNERS = {
  "78621265": "DEBE01YYK00042AM",
  "78621263": "DEBE01YYK00042AM",
  "78621266": "DEBE01YYK00042AM",
  "86645907": "DEBE01ALld000006",
  "45234467": "DEBE01YYK0003tN3",
  "26410650": "DEBE01YYK00047Dr",
}
REFERENCES = {
  "enter": [
    "https://www.merantix-aicampus.com/",
    "https://www.townscape.de/projects/enter-berlin/",
    "https://rkw.plus/de/projekt/enter-berlin/",
  ],
  "phorms": [
    "https://berlin-mitte.phorms.de/",
    "https://www.phorms.de/karriere/berlin-mitte/",
    "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030340",
  ],
  "dw": [
    "https://corporate.dw.com/en/dw-tv-berlin/a-326991",
    "https://kleihues.com/mediaport-berlin/",
  ],
}


def write(path, data):
  """Write deterministic, readable-by-runtime JSON without source images."""
  path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


def rgb(color):
  """Packed colour to existing batch colour channels."""
  return ((color >> 16) & 255, (color >> 8) & 255, color & 255)


def surfaces(detail, rings, color, role):
  """Retain complete concave source polygons and every courtyard hole."""
  triangles = triangles_for(rings)
  detail.triangles.extend((tri, rgb(color), role) for tri in triangles)
  return triangles


def native_skin(blocks):
  """Losslessly merge exposed cube faces; omit only internal shared faces."""
  cells = {}
  for x, y, z, w, h, d, color in blocks:
    for xi in range(round(x - w / 2), round(x + w / 2)):
      for yi in range(round(y - h / 2), round(y + h / 2)):
        for zi in range(round(z - d / 2), round(z + d / 2)):
          cells[(xi, yi, zi)] = color
  planes = {}
  for p, color in cells.items():
    for axis in range(3):
      uv = [i for i in range(3) if i != axis]
      for direction in (-1, 1):
        neighbour = list(p)
        neighbour[axis] += direction
        if tuple(neighbour) in cells:
          continue
        key = (axis, direction, p[axis] + (direction == 1), color)
        planes.setdefault(key, set()).add((p[uv[0]], p[uv[1]]))
  result = Detail()
  for (axis, direction, height, color), points in sorted(planes.items()):
    uv = [i for i in range(3) if i != axis]
    while points:
      u, v = min(points)
      width = 1
      while (u + width, v) in points:
        width += 1
      depth = 1
      while all((i, v + depth) in points for i in range(u, u + width)):
        depth += 1
      points.difference_update(
        (i, j) for i in range(u, u + width) for j in range(v, v + depth)
      )
      face = []
      for a, b in [(u, v), (u + width, v), (u + width, v + depth), (u, v + depth)]:
        p = [0, 0, 0]
        p[axis], p[uv[0]], p[uv[1]] = height, a, b
        face.append(p)
      # Canonical winding has +normal for X/Z and -normal for Y.
      if direction != (1 if axis != 1 else -1):
        face.reverse()
      result.polygon(face, rgb(color), "native-cell-skin")
  return result


def joined_walls(parts):
  """Join coplanar source fragments before decorating, retaining their holes."""
  planes = {}
  for part, offset, _, _, _ in parts:
    for sheet in part["surfaces"]:
      if sheet["kind"] != "WallSurface":
        continue
      ring = sheet["rings"][0]
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda ab: math.hypot(ab[1][0] - ab[0][0], ab[1][2] - ab[0][2]),
      )
      length = math.hypot(b[0] - a[0], b[2] - a[2])
      if length < 1:
        continue
      ux, uz = (b[0] - a[0]) / length, (b[2] - a[2]) / length
      if ux < 0 or (abs(ux) < 0.00001 and uz < 0):
        ux, uz = -ux, -uz
      d = -uz * a[0] + ux * a[2]
      if any(abs(-uz * p[0] + ux * p[2] - d) > 0.03 for p in ring):
        continue
      rings = [[(ux * x + uz * z, y + offset) for x, y, z in r] for r in sheet["rings"]]
      polygon = Polygon(rings[0], rings[1:]).buffer(0)
      key = (round(ux, 3), round(uz, 3), round(d, 2))
      if key not in planes:
        planes[key] = (ux, uz, d, [])
      planes[key][3].append(polygon)
  for ux, uz, d, polygons in planes.values():
    merged = unary_union(polygons)
    for wall in [merged] if merged.geom_type == "Polygon" else merged.geoms:
      if wall.geom_type != "Polygon" or wall.area < 4:
        continue
      u0, lo, u1, hi = wall.bounds
      u, y = wall.representative_point().coords[0]
      x, z = ux * u - uz * d, uz * u + ux * d
      nx, nz = -uz, ux

      def occupied(sign):
        return any(
          low - 0.1 <= y <= high + 0.1
          and g.covers(Point(x + nx * sign * 0.15, z + nz * sign * 0.15))
          for _, _, g, low, high in parts
        )

      left, right = occupied(1), occupied(-1)
      if left and right:
        continue
      if left:
        nx, nz = -nx, -nz
      yield {
        "a": [ux * u0 - uz * d, uz * u0 + ux * d],
        "b": [ux * u1 - uz * d, uz * u1 + ux * d],
        "normal": [nx, nz],
        "base": lo,
        "eave": hi,
        "mask": translate(wall, xoff=-u0),
      }


def fittings(detail, edge, key, ground, tower):
  """A finite window rhythm, tightly inset within a verified source wall span."""
  ax, az = edge["a"]
  bx, bz = edge["b"]
  length = math.hypot(bx - ax, bz - az)
  ux, uz = (bx - ax) / length, (bz - az) / length
  nx, nz = edge["normal"]
  low, high = edge["base"], edge["eave"]
  if length < 3 or high - low < 2.6:
    return 0

  def plane(points, color, role, out=0.045):
    if "mask" in edge:
      clipped = Polygon(points).intersection(edge["mask"])
      for polygon in (
        [clipped] if clipped.geom_type == "Polygon" else getattr(clipped, "geoms", [])
      ):
        if polygon.geom_type == "Polygon" and polygon.area > 0.001:
          rings = [
            [(ax + ux * u + nx * out, y, az + uz * u + nz * out) for u, y in r.coords]
            for r in [polygon.exterior, *polygon.interiors]
          ]
          surfaces(detail, rings, color, role)
      return
    detail.polygon(
      [(ax + ux * u + nx * out, y, az + uz * u + nz * out) for u, y in points],
      rgb(color),
      role,
    )

  def rect(u, y, w, h, color, role, out=0.045):
    plane(
      [
        (u - w / 2, y - h / 2),
        (u + w / 2, y - h / 2),
        (u + w / 2, y + h / 2),
        (u - w / 2, y + h / 2),
      ],
      color,
      role,
      out,
    )

  step = 3.65 if tower else (4.4 if key == "phorms" else 3.8)
  pitch = 3.2 if key == "phorms" else (3.25 if tower else 3.6)
  cols = max(1, int((length - 1.1) / pitch))
  pitch = (length - 1.1) / cols
  count = 0
  first = max(0, math.ceil((low - ground - 0.7) / step))
  for floor in range(first, 15):
    y0 = ground + floor * step + 0.8
    h = 2.65 if key == "phorms" else (1.95 if tower else 2.85)
    if y0 + h > high - 0.25:
      break
    if y0 < low + 0.2:
      continue
    if key == "enter":
      rect(length / 2, y0 + h / 2, length - 0.6, h, 0x82999B, "enter-glass-band")
      rect(length / 2, y0 - 0.12, length - 0.4, 0.22, 0x535D5B, "enter-transom")
    for col in range(cols):
      u = 0.55 + (col + 0.5) * pitch
      w = min(pitch - 0.65, 1.95 if tower else 2.35)
      glass = (0x81989A, 0x71898D, 0x91A3A2)[(col + floor) % 3]
      if key == "phorms":
        # Shallow segmental arch, rather than black rectangular cavities.
        rise = 0.3
        shape = [(u - w / 2, y0), (u + w / 2, y0), (u + w / 2, y0 + h - rise)]
        shape += [
          (u + w / 2 * math.cos(t), y0 + h - rise + rise * math.sin(t))
          for t in [i * math.pi / 8 for i in range(1, 9)]
        ]
        plane(shape, glass, "phorms-segmental-window")
        rect(u, y0 - 0.08, w + 0.2, 0.15, 0xD7BDA0, "phorms-sill", 0.075)
      elif key != "enter":
        rect(u, y0 + h / 2, w + 0.2, h + 0.18, 0xB6A999, "dw-window-reveal")
        rect(u, y0 + h / 2, w, h, glass, "dw-window", 0.06)
      frame = 0xCED1C5 if key == "phorms" else 0x55605E
      rect(u, y0 + h / 2, 0.08, h, frame, "window-mullion", 0.085)
      rect(u, y0 + h * 0.57, w, 0.075, frame, "window-transom", 0.085)
      if key == "enter":
        rect(
          u - pitch / 2, y0 + h / 2, 0.3, h + 0.6, 0xD7D6CD, "enter-concrete-pier", 0.09
        )
      count += 1
    if key == "phorms":
      rect(
        length / 2,
        y0 + h + 0.13,
        length - 0.3,
        0.13,
        0xC7A882,
        "phorms-terracotta-stringcourse",
      )
  return count


def build():
  """Compile only the three audited campuses into two independent styles."""
  source = json.loads(gzip.decompress(SOURCE.read_bytes()))
  runtime = {"drawn": [], "minecraft": []}
  navigation, evidence = [], []
  for site in source["sites"]:
    key = site["key"]
    drawn = Detail()
    roof, owners, offsets, part_rows = [], [], {}, []
    source_count = 0
    for parent in site["parents"]:
      # Legacy terrain at all six original core owners is 5.2m. One rigid
      # translation per complete source parent prevents floating foundations;
      # all measured roof/wing differences inside that parent are retained.
      offset = 5.2 - min(p["ground_y_m"] for p in parent["parts"])
      offsets[parent["id"]] = round(offset, 6)
      for part in parent["parts"]:
        p = {**part, "owner": parent["id"]}
        lo, hi = part["ground_y_m"] + offset, part["top_y_m"] + offset
        poly = (
          Polygon(part["ring"], part.get("holes", []))
          if len(part["ring"]) >= 3
          else Polygon()
        )
        part_rows.append((p, offset, poly, lo, hi))
        if not poly.is_empty:
          owners.append(
            {
              "id": part["id"],
              "owner": parent["id"],
              "ring": part["ring"],
              "holes": part.get("holes", []),
              "low": lo,
              "high": hi,
            }
          )
        for sheet in part["surfaces"]:
          rings = [[(x, y + offset, z) for x, y, z in ring] for ring in sheet["rings"]]
          is_roof = sheet["kind"] == "RoofSurface"
          color = {"enter": 0xD5D5CC, "phorms": 0xA6684F, "dw": 0x9E7158}[key]
          if is_roof:
            color = 0x7D8580 if key == "enter" else 0x696B61
          tris = surfaces(drawn, rings, color, "source:" + part["id"])
          source_count += len(tris)
          if is_roof:
            roof.extend(tris)
    windows = 0
    for part, offset, poly, lo, hi in [] if key == "enter" else part_rows:
      if poly.is_empty:
        continue
      for edge in source_wall_edges(part, offset):
        mx, mz = [
          (edge["a"][i] + edge["b"][i]) / 2 + edge["normal"][i] * 0.15 for i in range(2)
        ]
        if any(
          other["id"] != part["id"]
          and low <= edge["base"] + 0.1
          and high >= edge["eave"] - 0.1
          and g.covers(Point(mx, mz))
          for other, _, g, low, high in part_rows
        ):
          continue
        # The new Mediaport spine is the middle source parent. The flanking
        # retained AEG factories keep their larger industrial window rhythm.
        tower = key == "dw" and part["owner"] == "DEBE01YYK0003tN3"
        windows += fittings(drawn, edge, key, lo, tower)
    if key == "enter":
      for edge in joined_walls(part_rows):
        windows += fittings(drawn, edge, key, 5.2, False)
    points = [p for tri, _, _ in drawn.triangles for p in tri]
    bounds = [
      min(p[0] for p in points) - 2,
      min(p[2] for p in points) - 2,
      max(p[0] for p in points) + 2,
      max(p[2] for p in points) + 2,
    ]
    packet = empty_packet("aeg-v241-" + key, bounds)
    packet["meshes"] = pack_detail(drawn, bounds)
    runtime["drawn"].append(packet)
    # Compile a separate metre-grid skin. It shares no slanted drawn geometry
    # and has no floating, thin facade attachment in Minecraft mode.
    blocks = native_blocks(
      {
        "surfaces": [
          {"triangles": [t], "color": c[0] * 65536 + c[1] * 256 + c[2]}
          for t, c, _ in drawn.triangles
        ],
        "boxes": [],
        "rods": [],
      }
    )
    native = native_skin(blocks)
    npacket = empty_packet("aeg-v241-" + key + "-native", bounds)
    npacket["meshes"] = pack_detail(native, bounds)
    runtime["minecraft"].append(npacket)
    navigation.append(
      {
        "key": key,
        "bounds": bounds,
        "owners": owners,
        "roofTriangles": roof,
        "pads": [],
      }
    )
    evidence.append(
      {
        "key": key,
        "name": site["name"],
        "references": REFERENCES[key],
        "parents": [p["id"] for p in site["parents"]],
        "parts": len(part_rows),
        "sourceTriangles": source_count,
        "drawnTriangles": len(drawn.triangles),
        "windows": windows,
        "nativeBoxes": len(blocks),
        "nativeTriangles": len(native.triangles),
        "sourceGroundTranslations": offsets,
        "drawnMeshes": len(packet["meshes"]),
        "nativeMeshes": len(npacket["meshes"]),
      }
    )
    print(key, evidence[-1], flush=True)
  previous.OWNERS = OWNERS
  receipt = previous.build()
  receipt["schema"] = "aeg-campus-core-transfer-v241/1"
  # A core OSM factory envelope can overlap more than one precise LoD2 parent.
  receipt["replacementParents"] = {
    s["key"]: [p["id"] for p in s["parents"]] for s in source["sites"]
  }
  write(DATA / "aegCampusV241.json", runtime)
  write(DATA / "aegCampusV241Navigation.json", {"sites": navigation})
  write(DATA / "aegCampusV241CorePrevious.json", receipt)
  write(
    GEO / "aeg-campus-v241-evidence.json",
    {
      "schema": "aeg-campus-v241/1",
      "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
      "sites": evidence,
      "precision": "Complete official source sheets and holes; per-parent rigid ground registration at existing terrain 5.2m. Window rhythms, dimensions and colours are bounded architectural interpretations, not measurements. No photographic texture, no invented campus infill.",
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.parse_args()
  build()
