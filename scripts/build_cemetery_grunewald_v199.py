"""Step 10: source-bound Grunewald-Forst cemetery recognition, no packet edits."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

import geopandas as gpd
from build_grunewald_terrain_v190 import offset_at
from build_surrounding_outlines import tags_for, world
from shapely.geometry import LineString, Point, Polygon, mapping, shape

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
SOURCE = GEO / "cemetery-grunewald-v199-source.json"
BBOX = (13.2095, 52.4915, 13.2122, 52.4938)


def write(path: Path, value: object) -> None:
  path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")


def extract() -> dict:
  cache = GEO / "raw/outskirts-v187/candidate.gpkg"
  areas = gpd.read_file(cache, layer="multipolygons", bbox=BBOX).to_crs(25833)
  row = areas[areas.osm_way_id == "23105617"].iloc[0]
  cemetery = world(row.geometry)
  source = {
    "boundary": {
      "id": "way/23105617",
      "geometry": mapping(cemetery),
      "tags": tags_for(row),
    },
    "paths": [],
    "sectors": [],
    "points": [],
  }
  lines = gpd.read_file(cache, layer="lines", bbox=BBOX).to_crs(25833)
  for _, row in lines.iterrows():
    geom, tags = world(row.geometry), tags_for(row)
    if geom.intersection(cemetery).length < 1:
      continue
    record = {"id": "way/" + row.osm_id, "geometry": mapping(geom), "tags": tags}
    if tags.get("highway") == "footway":
      source["paths"].append(record)
    elif tags.get("cemetery") == "sector":
      source["sectors"].append(record)
  # The retained candidate GPKG has no point layer. Read the same dated PBF.
  points = gpd.read_file(
    GEO / "raw/outer-v159/berlin-260929.osm.pbf", layer="points", bbox=BBOX
  ).to_crs(25833)
  for _, row in points.iterrows():
    geom = world(row.geometry)
    if cemetery.buffer(0.1).covers(geom):
      source["points"].append(
        {
          "id": "node/" + row.osm_id,
          "point": list(geom.coords)[0],
          "tags": tags_for(row),
        }
      )
  source["terrain"] = {
    "file": "src/app/src/data/grunewaldTerrainV190.json",
    "sha256": hashlib.sha256(
      (DATA / "grunewaldTerrainV190.json").read_bytes()
    ).hexdigest(),
    "datum": "NHN minus 30 metres; existing v190 field unchanged",
  }
  source["osm"] = {
    "url": "https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf",
    "license": "ODbL-1.0",
  }
  write(SOURCE, source)
  return source


class Model:
  def __init__(self, native: bool) -> None:
    self.native = native
    self.boxes = []
    self.solids = []
    self.positions = []
    self.colors = []

  def ground(self, x: float, z: float) -> float:
    return 3 + offset_at(x, z, self.native)

  def put(
    self,
    x: float,
    y: float,
    z: float,
    w: float,
    h: float,
    d: float,
    color: int,
    yaw: float = 0,
    solid: bool = False,
  ) -> None:
    if self.native and abs(yaw) > 1e-8:
      # Independent small axis-aligned runs, not a large rotated bounding box.
      count = max(1, math.ceil(w / 0.3))
      for i in range(count):
        along = w * ((i + 0.5) / count - 0.5)
        self.put(
          x + math.cos(yaw) * along,
          y,
          z - math.sin(yaw) * along,
          abs(math.cos(yaw)) * w / count + abs(math.sin(yaw)) * d,
          h,
          abs(math.sin(yaw)) * w / count + abs(math.cos(yaw)) * d,
          color,
          solid=solid,
        )
      return
    row = [x, y, z, w, h, d] + ([] if self.native else [yaw]) + [color]
    self.boxes.append([round(v, 5) if isinstance(v, float) else v for v in row])
    if solid:
      self.solids.append(
        [round(v, 5) for v in [x, y, z, w, h, d, 0 if self.native else yaw]]
      )

  def tri(self, points: list, color: int) -> None:
    assert not self.native
    self.positions.extend(round(v, 5) for p in points for v in p)
    self.colors.extend([(color >> 16) & 255, (color >> 8) & 255, color & 255] * 3)

  def line(
    self,
    a: list,
    b: list,
    h: float,
    w: float,
    color: int,
    offset: float = 0,
    solid: bool = False,
    joint: bool = False,
  ) -> None:
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    count = max(1, math.ceil(length / (0.45 if self.native else 0.9)))
    for i in range(count):
      t = (i + 0.5) / count
      x, z = a[0] + dx * t, a[1] + dz * t
      y = self.ground(x, z)
      self.put(
        x,
        y + offset + h / 2,
        z,
        length / count + 0.015,
        h,
        w,
        color,
        -math.atan2(dz, dx),
        solid,
      )
      if joint and i % 2 == 0:
        self.put(
          x,
          y + 0.52,
          z,
          length / count + 0.01,
          0.025,
          w + 0.014,
          0x797D68,
          -math.atan2(dz, dx),
        )


def generate(source: dict, native: bool) -> tuple[dict, dict]:
  model = Model(native)
  poly = shape(source["boundary"]["geometry"]).geoms[0]
  gate = next(p["point"] for p in source["points"] if p["id"] == "node/249450500")
  nico = next(p["point"] for p in source["points"] if p["id"] == "node/277933694")
  # Original mapped boundary, with only the real entrance kept open.
  ring = list(poly.exterior.coords)
  wall = LineString(ring).difference(Point(gate).buffer(2.25))
  for segment in getattr(wall, "geoms", [wall]):
    coords = list(segment.coords)
    for a, b in zip(coords[:-1], coords[1:], strict=True):
      model.line(a, b, 1.02, 0.42, 0x91937C, solid=True, joint=True)
      model.line(a, b, 0.12, 0.50, 0x565F4E, 1.02)
  # Existing bare-earth path tops are retained. Modest loose-soil margins follow
  # exact mapped paths, with explicitly estimated 1.2m width (no false kerbs).
  for path in source["paths"]:
    line = shape(path["geometry"]).intersection(poly)
    for part in getattr(line, "geoms", [line]):
      coords = list(part.coords)
      for a, b in zip(coords[:-1], coords[1:], strict=True):
        length = math.dist(a, b)
        if length < 0.01:
          continue
        nx, nz = (b[1] - a[1]) / length, -(b[0] - a[0]) / length
        for sign in [-1, 1]:
          model.line(
            [a[0] + nx * 0.60 * sign, a[1] + nz * 0.60 * sign],
            [b[0] + nx * 0.60 * sign, b[1] + nz * 0.60 * sign],
            0.035,
            0.11,
            0x958C6E,
            0.025,
          )
  # Roofed stone portal at exact gate node; proportions are reference estimates.
  tangent = (43.7100677648, -56.696757109)
  norm = math.hypot(*tangent)
  tx, tz = tangent[0] / norm, tangent[1] / norm
  yaw = -math.atan2(tz, tx)
  gx, gz = gate
  gy = model.ground(gx, gz)

  def local(u: float, y: float, v: float = 0) -> list:
    return [gx + tx * u - tz * v, gy + y, gz + tz * u + tx * v]

  def box_at(
    u: float,
    y: float,
    v: float,
    w: float,
    h: float,
    d: float,
    color: int,
    solid: bool = False,
  ) -> None:
    model.put(*local(u, y, v), w, h, d, color, yaw, solid)

  for side in [-1, 1]:
    box_at(side * 1.92, 1.22, 0, 0.76, 2.44, 0.74, 0xA39D87, True)
    for y in [0.35, 0.72, 1.1, 1.47, 1.86, 2.22]:
      box_at(side * 1.92, y, -0.38, 0.75, 0.023, 0.02, 0x736F61)
    # Two open wooden leaves leave the centre traversable; not a closed slab.
    for j in range(8):
      u = side * 1.54
      v = 0.12 + (j + 0.5) * 0.19
      model.put(*local(u, 0.86, v), 0.17, 1.70, 0.17, 0x61432F, solid=True)
    for y in [0.27, 0.83, 1.39]:
      for j in range(6):
        model.put(
          *local(side * 1.54, y, 0.14 + (j + 0.5) * 0.25), 0.19, 0.045, 0.27, 0x333D37
        )
  # True semicircular opening, twelve independent stone voussoirs, roof above.
  for i in range(18):
    a, b = math.pi * i / 18, math.pi * (i + 1) / 18
    if native:
      u = 1.91 * math.cos((a + b) / 2)
      y = 2.14 + 1.91 * math.sin((a + b) / 2)
      box_at(u, y, 0, 0.39, 0.37, 0.74, 0xA29B87, True)
    else:
      for v in [-0.37, 0.37]:
        q = [
          local(1.55 * math.cos(a), 2.14 + 1.55 * math.sin(a), v),
          local(2.25 * math.cos(a), 2.14 + 2.25 * math.sin(a), v),
          local(2.25 * math.cos(b), 2.14 + 2.25 * math.sin(b), v),
          local(1.55 * math.cos(b), 2.14 + 1.55 * math.sin(b), v),
        ]
        for tri in [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]:
          model.tri(tri, [0xA29B87, 0xAAA18C, 0x99927F][i % 3])
      # Inner arch soffit keeps the opening visibly thick from either side.
      q = [
        local(1.55 * math.cos(a), 2.14 + 1.55 * math.sin(a), -0.37),
        local(1.55 * math.cos(b), 2.14 + 1.55 * math.sin(b), -0.37),
        local(1.55 * math.cos(b), 2.14 + 1.55 * math.sin(b), 0.37),
        local(1.55 * math.cos(a), 2.14 + 1.55 * math.sin(a), 0.37),
      ]
      model.tri(q[:3], 0x817E6B)
      model.tri([q[0], q[2], q[3]], 0x817E6B)
  for side in [-1, 1]:
    for i in range(15):
      u = side * (i + 0.5) * 2.65 / 15
      roof = 4.62 - abs(u) * 0.63
      box_at(u, roof, 0, 0.19, 0.14, 1.17, 0x41483F)
      # Fill the gable only above the outer arch, never across the opening.
      lower = 2.14 + math.sqrt(max(0, 2.25**2 - min(abs(u), 2.25) ** 2))
      if abs(u) < 2.25 and roof - lower > 0.03:
        box_at(u, (roof + lower) / 2, 0, 0.19, roof - lower, 0.74, 0x99927F)
  # Exact grave anchors. Only Nico receives identity lettering in the factory.
  graves = []
  for point in source["points"]:
    tags = point["tags"]
    x, z = point["point"]
    if tags.get("cemetery") == "grave":
      y = model.ground(x, z)
      is_nico = point["id"] == "node/277933694"
      model.put(
        x,
        y + 0.59,
        z,
        0.88 if is_nico else 0.75,
        1.18,
        0.17,
        0x242B29 if is_nico else 0x8E8B77,
        yaw,
        True,
      )
      graves.append({"id": point["id"], "point": [x, z], "groundY": y, "yaw": yaw})
      if is_nico:
        # Two modest grave lights; no fan photo, letter content or bottle label.
        for u, color in [(-0.26, 0xECE5D2), (0.25, 0x882D2D)]:
          model.put(x + tx * u, y + 1.31, z + tz * u, 0.13, 0.24, 0.13, color)
          model.put(x + tx * u, y + 1.45, z + tz * u, 0.15, 0.04, 0.15, 0x9B8556)
    elif tags.get("amenity") == "bench":
      # Positions/seats/wood come from OSM, individual slats are display estimates.
      for v in [-0.22, 0, 0.22]:
        model.put(x, model.ground(x, z) + 0.48, z + v, 1.55, 0.075, 0.16, 0x526249, yaw)
      for u in [-0.58, 0.58]:
        model.put(
          x + tx * u, model.ground(x, z) + 0.23, z + tz * u, 0.10, 0.46, 0.46, 0x424A3E
        )
  # Mapped sector geometry supplies location, not an invented individual grave
  # survey: representative anonymous crosses are declared as schematic markers.
  representative = []
  for sector in source["sectors"]:
    outline = shape(sector["geometry"])
    polygon = Polygon(outline.coords)
    coords = list(outline.coords)
    a, b = max(
      zip(coords[:-1], coords[1:], strict=True), key=lambda edge: math.dist(*edge)
    )
    length = math.dist(a, b)
    dx, dz = (b[0] - a[0]) / length, (b[1] - a[1]) / length
    centre = polygon.centroid
    line = LineString(
      [
        (centre.x - dx * (length / 2 - 1), centre.y - dz * (length / 2 - 1)),
        (centre.x + dx * (length / 2 - 1), centre.y + dz * (length / 2 - 1)),
      ]
    )
    count = 6 if sector["id"] == "way/1279179119" else 8
    for i in range(count):
      p = line.interpolate((i + 0.5) / count, normalized=True)
      if not poly.covers(p):
        continue
      x, z, y = p.x, p.y, model.ground(p.x, p.y)
      if sector["id"] == "way/1279179119":
        model.put(x, y + 0.55, z, 0.10, 1.10, 0.10, 0x665D49)
        model.put(x, y + 0.79, z, 0.54, 0.085, 0.09, 0x665D49, yaw)
        model.put(x, y + 0.99, z, 0.30, 0.075, 0.09, 0x665D49, yaw)
      else:
        model.put(x, y + 0.23, z, 0.40, 0.46, 0.16, 0xADA994, yaw)
      representative.append([sector["id"], x, z])
  model_data = {
    "boxes": model.boxes,
    "positions": model.positions,
    "colors": model.colors,
  }
  navigation = {
    "bounds": list(poly.bounds),
    "solids": model.solids,
    "graves": graves,
    "gate": [gx, gy, gz],
    "nico": [*nico, model.ground(*nico)],
    "representativeSectorMarkers": representative,
  }
  return model_data, navigation


def main() -> None:
  source = json.loads(SOURCE.read_bytes()) if SOURCE.exists() else extract()
  evidence = {
    "step": 10,
    "boundaryId": source["boundary"]["id"],
    "areaM2": shape(source["boundary"]["geometry"]).area,
    "bounds": list(shape(source["boundary"]["geometry"]).bounds),
    "sourcePaths": len(source["paths"]),
    "sourceGraves": 3,
    "sourceGeometryRetained": True,
    "packetEdits": [],
    "estimates": [
      "Portal proportions/stone courses/wall height; mapped path width 1.2m; grave dimensions and bearing aligned to mapped rows; bench slats; representative anonymous sector markers, not surveyed individual burials"
    ],
    "limits": [
      "No complete plot-by-plot grave inventory; existing woodland trees, paths, source buildings and measured terrain retained; no new forest distribution or chapel invented"
    ],
    "models": {},
  }
  nav = {}
  for native in [False, True]:
    key = "native" if native else "drawn"
    model, navigation = generate(source, native)
    write(
      DATA
      / (
        "cemeteryGrunewaldV199Native.json"
        if native
        else "cemeteryGrunewaldV199Drawn.json"
      ),
      model,
    )
    nav[key] = navigation
    evidence["models"][key] = {
      "boxes": len(model["boxes"]),
      "triangles": len(model["positions"]) // 9,
      "constructorBufferBytes": len(model["boxes"]) * 76 + len(model["positions"]) * 9,
    }
  write(DATA / "cemeteryGrunewaldV199Navigation.json", nav)
  write(GEO / "cemetery-grunewald-v199-evidence.json", evidence)
  print(json.dumps(evidence["models"]))


if __name__ == "__main__":
  main()
