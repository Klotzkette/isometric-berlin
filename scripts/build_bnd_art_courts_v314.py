"""Step 10: bounded BND art-court openings on the immutable Alt-Mitte packets."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import subprocess
from pathlib import Path
from typing import Any

import numpy as np
from partition_rail_bridge_contact_v307 import triangle_complement
from shapely.geometry import Point, Polygon, box, mapping
from shapely.ops import unary_union
from terrain_fields_v307 import triangulate_v307

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src/app"
DATA = APP / "src/data"
GEO = ROOT / "geo_data/regierungsviertel"
KIND = "bnd-public-art-court-v314"
OWNER = "DEBE00YY1tw0009x"
EAST_PIXEL_RING = [(39, 267), (396, 79), (457, 201), (98, 391)]
WEST_PIXEL_RING = [
  (199, 177),
  (259, 144),
  (296, 207),
  (487, 104),
  (731, 525),
  (468, 663),
  (236, 241),
]


def read(path: Path) -> Any:
  return json.loads(path.read_text())


def write(path: Path, value: Any) -> None:
  path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def fnv(*texts: str) -> int:
  value = 2166136261
  for text in texts:
    for c in text:
      value = ((value ^ ord(c)) * 16777619) & 0xFFFFFFFF
  return value


def point_domain(x: float, z: float, ring: list) -> Polygon:
  return Polygon([(x + px / 6, z + pz / 6) for px, pz in ring])


def parts(shape: Any) -> list:
  if shape.is_empty:
    return []
  return (
    [shape]
    if shape.geom_type == "Polygon"
    else [p for p in shape.geoms if p.geom_type == "Polygon"]
  )


C, S = math.cos(-0.49), math.sin(-0.49)


def east_station(x: float, z: float) -> float:
  return (x - 455.4) * C + (z + 1686.35) * S


# Plateau and ramp are supported by public bDOM points. The last join to the
# retained 5.2 m scene grade and the interpolation are display fits.
EAST_HEIGHTS = [(-40, 8.48), (3.8, 8.48)] + [
  (east_station(x, z), y)
  for x, z, y in [
    (467, -1693, 7.47),
    (474, -1697, 6.75),
    (481, -1701, 6.25),
    (499, -1705, 5.2),
  ]
]
WEST_HEIGHT = 8.78


def height(site: str, x: float, z: float) -> float:
  if site == "west":
    return WEST_HEIGHT
  station = east_station(x, z)
  return float(np.interp(station, *zip(*EAST_HEIGHTS, strict=True)))


def cells(domain: Any) -> list[tuple[int, int]]:
  x0, z0, x1, z1 = domain.bounds
  return [
    (x, z)
    for z in range(math.floor(z0 / 2) * 2, math.ceil(z1 / 2) * 2, 2)
    for x in range(math.floor(x0 / 2) * 2, math.ceil(x1 / 2) * 2, 2)
    if domain.covers(box(x, z, x + 2, z + 2))
  ]


class Packed:
  def __init__(self, origin: list[float]) -> None:
    self.origin = np.asarray(origin)
    self.points: list = []
    self.colors: list = []
    self.indices: list = []
    self.cache: dict = {}

  def triangle(self, points: Any, colors: Any) -> None:
    rounded = np.rint((np.asarray(points) - self.origin) * 100).astype(int)
    if rounded.min() < 0 or rounded.max() > 65535:
      raise ValueError("Court outside source packet frame")
    if not np.any(np.cross(rounded[1] - rounded[0], rounded[2] - rounded[0])):
      return
    for position, color in zip(rounded, np.rint(colors).astype(int), strict=True):
      key = (*position, *color)
      if key not in self.cache:
        self.cache[key] = len(self.points)
        self.points.append(position.tolist())
        self.colors.append(color.tolist())
      self.indices.append(self.cache[key])

  def paint(self, points: Any, rgb: list[int]) -> None:
    self.triangle(points, [rgb] * 3)

  def quad(self, a: Any, b: Any, c: Any, d: Any, rgb: list[int]) -> None:
    self.paint([a, b, c], rgb)
    self.paint([a, c, d], rgb)

  def payload(self) -> dict:
    def encoded(rows: list, dtype: str) -> str:
      return base64.b64encode(np.asarray(rows, dtype=dtype).tobytes()).decode()

    return {
      "kind": KIND,
      "positionType": "u16cm",
      "positions": encoded(self.points, "<u2"),
      "colors": encoded(self.colors, "u1"),
      "indices": encoded(self.indices, "<u4"),
    }


def capture(paths: list[Path]) -> dict:
  code = r"""
import {prepareSurroundingQuarterPredecessorV303} from './src/SurroundingCityGeometry';
const results = {};
for (const path of Bun.argv.slice(1)) {
 const raw = await Bun.file(path).json();
 const stepper = prepareSurroundingQuarterPredecessorV303(raw, `alt-mitte-v169-${raw.id}`, path.includes('Native/'),
   {neighbourhoodV300:true,westKiezV302:true,golgathaV270:true,tachelesFrontsV270:true,northernSitesV266:true,chariteBridgesV265:true,schlossplatzV239:true,staatsoperV240:true,architectureV241:true,littenStadthausV297:true,wallGalleryV298:true});
 let next = stepper.next(); while (!next.done) next = stepper.next();
 const prepared = next.value;
 const fnv = s => {let h=2166136261; for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0; return h;};
 const pins = p => ({
   records:p.meshes.map((m,mesh)=>({mesh,kind:m.kind,fingerprint:fnv(m.positions+m.colors+m.indices)})),
   nav:fnv(JSON.stringify(p.nav)), lines:p.lines?fnv(p.lines.positions+(p.lines.colors??'')):null,
 });
 results[path] = {raw:pins(raw),prepared:pins(prepared),packet:prepared};
}
process.stdout.write(JSON.stringify(results));
"""
  return json.loads(
    subprocess.check_output(["bun", "-e", code, *map(str, paths)], cwd=APP)
  )


def decode(part: dict, origin: list) -> tuple:
  assert part["positionType"] == "u16cm" and part.get("colorType", "u8") == "u8"
  positions = np.frombuffer(base64.b64decode(part["positions"]), "<u2").reshape(-1, 3)
  colors = np.frombuffer(base64.b64decode(part["colors"]), "u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(part["indices"]), "<u4").reshape(-1, 3)
  return positions / 100 + origin, colors, indices


def clip_mesh(part: dict, origin: list, domain: Any, packed: Packed) -> tuple:
  positions, colors, indices = decode(part, origin)
  triangles = positions[indices]
  low = triangles.min(axis=1)
  high = triangles.max(axis=1)
  x0, z0, x1, z1 = domain.bounds
  # The suspect lower shell has an 18.29 m drawn or 19 m block cap.
  # Exclude intact ground caps and all taller legitimate neighbouring roofs.
  candidates = np.flatnonzero(
    (high[:, 0] >= x0)
    & (low[:, 0] <= x1)
    & (high[:, 2] >= z0)
    & (low[:, 2] <= z1)
    & (high[:, 1] > 9.0)
    & (high[:, 1] <= 19.01)
  )
  retire, audit = [], []
  for index in candidates:
    xyz = triangles[index]
    if np.linalg.norm(np.cross(xyz[1] - xyz[0], xyz[2] - xyz[0])) < 1e-10:
      continue
    outside, removed, total = triangle_complement(xyz, domain)
    if removed <= 1e-9:
      continue
    retire.append(int(index))
    start = len(packed.indices) // 3
    for barycentric in outside:
      packed.triangle(barycentric @ xyz, barycentric @ colors[indices[index]])
    audit.append(
      [
        int(index),
        round(removed, 7),
        round(total, 7),
        start,
        len(packed.indices) // 3 - start,
      ]
    )
  return retire, audit


def clip_lines(lines: dict, origin: list, domain: Any) -> tuple:
  from shapely.geometry import LineString

  positions = np.frombuffer(base64.b64decode(lines["positions"]), "<u2").reshape(
    -1, 2, 3
  )
  rgb = (
    np.frombuffer(base64.b64decode(lines["colors"]), "u1").reshape(-1, 2, 3)
    if lines.get("colors")
    else None
  )
  keep, colors, retire = [], [], []
  for index, source in enumerate(positions):
    xyz = source / 100 + origin
    if xyz[:, 1].max() <= 9.0 or xyz[:, 1].max() > 19.06:
      continue
    a, b = xyz[:, [0, 2]]
    diff = b - a
    length2 = float(np.dot(diff, diff))
    if length2 < 1e-10:
      if domain.contains(Point(a)):
        retire.append(index)
      continue
    source_line = LineString([a, b])
    if source_line.intersection(domain).length < 1e-8:
      continue
    retire.append(index)
    remainder = source_line.difference(domain)
    members = (
      [remainder]
      if remainder.geom_type == "LineString"
      else getattr(remainder, "geoms", [])
    )
    for line in members:
      if line.geom_type != "LineString" or line.is_empty:
        continue
      endpoints = np.asarray([line.coords[0], line.coords[-1]])
      times = ((endpoints - a) @ diff) / length2
      keep.extend(
        np.rint((xyz[0] + times[:, None] * (xyz[1] - xyz[0]) - origin) * 100)
        .astype(int)
        .tolist()
      )
      if rgb is not None:
        colors.extend(
          np.rint(
            rgb[index][0]
            + times[:, None] * (rgb[index][1].astype(float) - rgb[index][0])
          )
          .astype(int)
          .tolist()
        )
  packed = {
    "positions": base64.b64encode(np.asarray(keep, dtype="<u2").tobytes()).decode()
  }
  if rgb is not None:
    packed["colors"] = base64.b64encode(
      np.asarray(colors, dtype="u1").tobytes()
    ).decode()
  return retire, packed if keep else None


def drawn_floor(packed: Packed, site: str, domain: Any) -> None:
  if site == "east":
    # Clip at the grade control lines before triangulation, preserving the
    # measured ramp stations instead of interpolating across all of them.
    def corner(u: float, v: float) -> tuple:
      return (455.4 + C * u - S * v, -1686.35 + S * u + C * v)

    strips = [
      domain.intersection(
        Polygon([corner(a, -40), corner(b, -40), corner(b, 40), corner(a, 40)])
      )
      for (a, _), (b, _) in zip(EAST_HEIGHTS, EAST_HEIGHTS[1:])
    ]
  else:
    strips = [domain]
  rgb = [160, 164, 155] if site == "east" else [132, 148, 107]
  for strip in strips:
    for tri in triangulate_v307(strip):
      packed.paint([[x, height(site, x, z), z] for x, z in tri[::-1]], rgb)


def walls(packed: Packed, site: str, domain: Any, shell: Any, native: bool) -> None:
  # Close only where the opening abuts the retained original lower mass.
  # At the open street end the replacement stays a continuous paved grade.
  cap = 19.0 if native else 18.29
  for face in parts(domain):
    for ring in [face.exterior, *face.interiors]:
      for (x, z), (u, v) in zip(ring.coords, list(ring.coords)[1:]):
        span = math.hypot(u - x, v - z)
        if span < 0.035:
          continue
        mx, mz = (x + u) / 2, (z + v) / 2
        dx, dz = (v - z) / span, (x - u) / span
        samples = [
          Point(mx + dx * 0.20, mz + dz * 0.20),
          Point(mx - dx * 0.20, mz - dz * 0.20),
        ]
        if not any(shell.covers(p) and not domain.covers(p) for p in samples):
          continue
        if native:
          # Every native wall stays in one cardinal plane. Break the long
          # merged polygon side back into source-scale ground-height steps.
          steps = max(1, math.ceil(span / 2 - 1e-8))
          for i in range(steps):
            t, s = i / steps, (i + 1) / steps
            ax, az = x + (u - x) * t, z + (v - z) * t
            bx, bz = x + (u - x) * s, z + (v - z) * s
            floor = min(height(site, ax, az), height(site, bx, bz))
            packed.quad(
              [ax, floor, az],
              [bx, floor, bz],
              [bx, cap, bz],
              [ax, cap, az],
              [124, 133, 128],
            )
        else:
          packed.quad(
            [x, height(site, x, z), z],
            [u, height(site, u, v), v],
            [u, cap, v],
            [x, cap, z],
            [124, 133, 128],
          )


def main() -> None:
  evidence = read(DATA / "bndHeadquartersV174Evidence.json")
  owner = next(b for b in evidence["sourceParents"] if b["id"] == OWNER)
  shell = unary_union(
    [Polygon(p["ring"], p.get("holes", [])) for p in owner["footprintPolygons"]]
  )
  protected = unary_union(
    [Polygon(p["ring"], p.get("holes", [])) for p in evidence["mappedExteriorParts"]]
  )
  photographed = {
    "east": point_domain(422, -1730, EAST_PIXEL_RING),
    "west": point_domain(245, -1675, WEST_PIXEL_RING),
  }
  source_path = ROOT / evidence["sourcePacket"]
  source = json.loads(gzip.decompress(source_path.read_bytes()))
  bounds = unary_union(list(photographed.values())).buffer(3)
  neighbours = {}
  for other in source["buildings"]:
    if other["id"] == OWNER:
      continue
    footprint = unary_union(
      [
        Polygon(part["ring"], part.get("holes", [])).buffer(0)
        for part in other["footprintPolygons"]
      ]
    )
    if footprint.intersects(bounds):
      neighbours[other["id"]] = footprint
  neighbour_union = unary_union(list(neighbours.values()))
  drawn = {
    site: domain.difference(protected.buffer(0.15)).difference(
      neighbour_union.buffer(0.08)
    )
    for site, domain in photographed.items()
  }
  native_cells = {
    site: cells(domain.difference(neighbour_union.buffer(math.sqrt(2))))
    for site, domain in drawn.items()
  }
  native = {
    site: unary_union([box(x, z, x + 2, z + 2) for x, z in values])
    for site, values in native_cells.items()
  }
  for domains in [drawn, native]:
    assert domains["east"].covers(Point(455.4, -1686.35)) and domains["west"].covers(
      Point(287.25, -1639.25)
    )
    assert all(
      domain.intersection(protected.union(neighbour_union)).area < 1e-8
      for domain in domains.values()
    )
  paths = [
    p
    for mode in ["Drawn", "Native"]
    for p in sorted((DATA / f"altMitteV169{mode}").glob("packet-*.json"))
    if read(p)["id"].startswith("0_-4")
  ]
  captures = capture(paths)
  plans, audit = {}, []
  for mode, domains in [("drawn", drawn), ("minecraft", native)]:
    union = unary_union(list(domains.values()))
    touched = []
    for path in [
      p for p in paths if ("Native" in p.parent.name) == (mode == "minecraft")
    ]:
      capture_record = captures[str(path)]
      packet = capture_record["packet"]
      packed = Packed(packet["origin"])
      retire, audit_meshes = [], []
      for i, part in enumerate(packet["meshes"]):
        ordinals, triangles = clip_mesh(part, packet["origin"], union, packed)
        if ordinals:
          retire.append({"mesh": i, "triangles": ordinals})
          audit_meshes.append({"mesh": i, "triangles": triangles})
      retired_lines, extra_lines = (
        clip_lines(packet["lines"], packet["origin"], union)
        if packet.get("lines")
        else ([], None)
      )
      if not retire and not retired_lines:
        continue
      key = f"{mode}:alt-mitte-v169-{packet['id']}"
      plan = {
        "origin": packet["origin"],
        "records": capture_record["raw"]["records"],
        "preparedRecords": capture_record["prepared"]["records"],
        "navGuard": capture_record["raw"]["nav"],
        "lineGuard": capture_record["raw"]["lines"],
        "preparedNavGuard": capture_record["prepared"]["nav"],
        "preparedLineGuard": capture_record["prepared"]["lines"],
        "retire": retire,
        "retireLines": retired_lines,
        "retireNav": [],
        "appendNav": [],
        "owners": [OWNER],
      }
      if extra_lines:
        plan["appendLines"] = extra_lines
      touched.append((path, key, plan, packed, audit_meshes))
    assert touched
    floor = Packed(touched[0][2]["origin"])
    for site, domain in domains.items():
      if mode == "drawn":
        drawn_floor(floor, site, domain)
      else:
        tops = {(x, z): height(site, x + 1, z + 1) for x, z in native_cells[site]}
        rgb = [166, 167, 153] if site == "east" else [132, 148, 107]
        for (x, z), y in tops.items():
          floor.quad([x, y, z], [x, y, z + 2], [x + 2, y, z + 2], [x + 2, y, z], rgb)
          for dx, dz, a, b in [
            (-2, 0, (x, z), (x, z + 2)),
            (2, 0, (x + 2, z + 2), (x + 2, z)),
            (0, -2, (x + 2, z), (x, z)),
            (0, 2, (x, z + 2), (x + 2, z + 2)),
          ]:
            lower = tops.get((x + dx, z + dz), 5.2)
            if lower < y - 0.005:
              floor.quad(
                [a[0], lower, a[1]],
                [b[0], lower, b[1]],
                [b[0], y, b[1]],
                [a[0], y, a[1]],
                rgb,
              )
      walls(floor, site, domain, shell, mode == "minecraft")
    floor_vertices = np.asarray(floor.points) / 100 + floor.origin
    floor_triangles = iter(np.asarray(floor.indices).reshape(-1, 3))
    # A line-only packet still needs a real replacement owner. Assign it one
    # exact face of the new floor, with that face absent from the main append.
    for _, _, _, packed, _ in touched:
      if not packed.indices:
        indices = next(floor_triangles)
        packed.triangle(floor_vertices[indices], [floor.colors[i] for i in indices])
    for indices in floor_triangles:
      touched[0][3].triangle(
        floor_vertices[indices], [floor.colors[i] for i in indices]
      )
    for path, key, plan, packed, audit_meshes in touched:
      append = packed.payload()
      plan["append"] = append
      plan["appendFingerprint"] = fnv(
        append["positions"], append["colors"], append["indices"]
      )
      plans[key] = plan
      audit.append(
        {
          "key": key,
          "source": str(path.relative_to(ROOT)),
          "sourceSha256": sha(path),
          "retireTriangles": audit_meshes,
          "retireLines": plan["retireLines"],
          "replacementVertices": len(packed.points),
          "replacementTriangles": len(packed.indices) // 3,
        }
      )
  write(
    DATA / "bndArtCourtsV314.json",
    {"schemaVersion": 1, "keys": list(plans), "packets": plans},
  )
  write(
    GEO / "bnd-art-courts-v314-evidence.json",
    {
      "owner": OWNER,
      "sourceOwnerPacketSha256": sha(source_path),
      "protectedNeighbourOwners": sorted(neighbours),
      "drawnDomains": {k: mapping(v) for k, v in drawn.items()},
      "nativeDomains": {k: mapping(v) for k, v in native.items()},
      "sourceCourtPixels": {"east": EAST_PIXEL_RING, "west": WEST_PIXEL_RING},
      "displayGrade": {"eastStations": EAST_HEIGHTS, "westTerrace": WEST_HEIGHT},
      "records": audit,
    },
  )
  print(
    [
      (
        r["key"],
        sum(len(p["triangles"]) for p in r["retireTriangles"]),
        len(r["retireLines"]),
        r["replacementTriangles"],
      )
      for r in audit
    ]
  )


if __name__ == "__main__":
  main()
