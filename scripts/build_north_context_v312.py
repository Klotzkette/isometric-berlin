"""Step 10: finite additive Nordbahnhof, Helmholtzplatz and Danziger details."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import struct
import zipfile
from dataclasses import dataclass, field

import numpy as np
import pyogrio
from pyproj import Transformer
from shapely.affinity import translate
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

from scripts import build_district_facades_v188 as base
from scripts import build_nord_mauerpark_v266 as prior
from scripts import build_scheunen_v265 as fit

ROOT, GEO, OUT = base.ROOT, base.GEO, base.OUT
CORE = ROOT / "src/app/public/mesh/regierungsviertel"
LOD2 = GEO / "alt-mitte-v169/source-390_5821-00.json.gz"
PBF = GEO / "raw/outer-v159/berlin-260929.osm.pbf"
DGM = GEO / "raw/dgm/weinberg-v176/DGM1_390_5820.zip"
DATA = ROOT / "src/app/src/data/northContextV312.json"
EVIDENCE = GEO / "north-context-v312-evidence.json.gz"
MODES = ("drawn", "minecraft")
TABLES = ("2836208452", "2836209528", "4666202282", "4666202533", "9186931365")
SCHOOL = "DEBE03AL3Ho00003"
BRICK = 0xCFB275
TRIM = 0xAD8757
GLASS = 0x415A61
ROOF = 0x665753
REFERENCES = {
  "hall": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011300",
  "park": "https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2527_park-am-nordbahnhof.pdf",
  "tunnel": "https://www.berlin.de/landesdenkmalamt/aktivitaeten/presse/2025/pressemitteilung.1595442.php",
  "dgm": "https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5820.zip",
  "helmholtz": "https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/ausstellung/artikel.1513033.php",
  "tables": "https://www.berlin.de/special/stadtteile/kieze/7701852-7429665-helmholtzkiez.html",
  "danziger": "https://www.nachhaltige-erneuerung.berlin.de/prenzlauer-berg/grundschule-danziger-strasse-50-denkmalgerechter-umbau",
  "danzigerHeritage": "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09070139",
  "carrée": "https://www.heinze.de/architekturobjekt/stettiner-carre-berlin/12621434/",
  "myjump": "https://myjump.de/berlin-mitte",
}


def encode(values: list, dtype: str) -> str:
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()


def linear(rgb: int) -> list[int]:
  channels = [(rgb >> shift & 255) / 255 for shift in (16, 8, 0)]
  return [
    round(65535 * (v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4))
    for v in channels
  ]


@dataclass
class Mesh:
  vertices: list = field(default_factory=list)
  colours: list = field(default_factory=list)
  indices: list = field(default_factory=list)
  boxes: list = field(default_factory=list)

  def face(self, points: list, rgb: int) -> None:
    if len(points) < 3:
      return
    first = len(self.vertices)
    self.vertices.extend(points)
    self.colours.extend([linear(rgb)] * len(points))
    for i in range(1, len(points) - 1):
      self.indices.extend([first, first + i, first + i + 1])

  def solid(
    self,
    xz: np.ndarray,
    y: float,
    width: float,
    height: float,
    depth: float,
    rgb: int,
    direction: tuple | np.ndarray = (1, 0),
  ) -> None:
    dx, dz = direction
    assert abs(dx * dx + dz * dz - 1) < 1e-8
    self.boxes.append(
      [*map(float, [xz[0], y, xz[1], width, height, depth, dx, dz]), rgb]
    )

  def packed(self, key: str, native: bool) -> dict:
    assert self.boxes
    rows = []
    for x, y, z, w, h, d, dx, dz, rgb in self.boxes:
      if native:
        assert abs(dx) < 1e-9 or abs(dz) < 1e-9
        if abs(dz) > 0.5:
          w, d = d, w
        rows.append([x, y, z, w, h, d, rgb])
      else:
        rows.append([x, y, z, w, h, d, math.atan2(-dz, dx), rgb])
    fmt = "<6fI" if native else "<7fI"
    result = {
      "key": key,
      "native": native,
      "boxCount": len(rows),
      "boxes": base64.b64encode(b"".join(struct.pack(fmt, *r) for r in rows)).decode(),
    }
    if self.indices:
      assert not native
      result["curved"] = dict(
        key=f"{key} curved brick arches",
        native=False,
        origin=[0, 0, 0],
        positionType="f32",
        colorType="u16linear",
        positions=encode(self.vertices, "<f4"),
        colors=encode(self.colours, "<u2"),
        indices=encode(self.indices, "<u4"),
        vertices=len(self.vertices),
        triangles=len(self.indices) // 3,
      )
    return result


def line_frame(a: list | np.ndarray, b: list | np.ndarray, footprint: Polygon) -> tuple:
  a, b = np.asarray(a), np.asarray(b)
  width = float(np.linalg.norm(b - a))
  d = (b - a) / width
  n = np.array([-d[1], d[0]])
  if footprint.covers(Point((a + b) / 2 + n * 0.2)):
    n = -n
  return a, d, n, width


def panel(
  mesh: Mesh,
  frame: tuple,
  u: float,
  y: float,
  width: float,
  height: float,
  rgb: int,
  offset: float = 0.09,
) -> None:
  a, d, n, _ = frame
  mesh.solid(a + d * u + n * offset, y, width, height, 0.04, rgb, d)


def arch(
  mesh: Mesh,
  frame: tuple,
  centre: float,
  bottom: float,
  spring: float,
  half_width: float,
  rise: float,
  native: bool,
) -> None:
  a, d, n, _ = frame
  panel(
    mesh, frame, centre, (bottom + spring) / 2, 2 * half_width, spring - bottom, GLASS
  )
  if native:
    for j in range(9):
      u = (j - 4) / 4.5
      h = rise * math.sqrt(1 - u * u)
      panel(
        mesh,
        frame,
        centre + half_width * u,
        spring + h / 2,
        2 * half_width / 9,
        h,
        GLASS,
      )
    for u in (-half_width - 0.08, half_width + 0.08):
      panel(
        mesh,
        frame,
        centre + u,
        (bottom + spring) / 2,
        0.16,
        spring - bottom,
        TRIM,
        0.13,
      )
  else:

    def point(u: float, y: float, depth: float) -> list:
      x, z = a + d * (centre + u) + n * depth
      return [x, y, z]

    angles = np.linspace(0, math.pi, 17)
    fan = [point(0, spring, 0.115)]
    for t in angles:
      fan.append(point(half_width * math.cos(t), spring + rise * math.sin(t), 0.115))
    mesh.face(fan, GLASS)
    for t, s in zip(angles, angles[1:]):
      mesh.face(
        [
          point(half_width * math.cos(t), spring + rise * math.sin(t), 0.14),
          point(
            (half_width + 0.16) * math.cos(t),
            spring + (rise + 0.16) * math.sin(t),
            0.14,
          ),
          point(
            (half_width + 0.16) * math.cos(s),
            spring + (rise + 0.16) * math.sin(s),
            0.14,
          ),
          point(half_width * math.cos(s), spring + rise * math.sin(s), 0.14),
        ],
        TRIM,
      )
    for u in (-half_width - 0.08, half_width + 0.08):
      panel(
        mesh,
        frame,
        centre + u,
        (bottom + spring) / 2,
        0.16,
        spring - bottom,
        TRIM,
        0.13,
      )
  for u in (-half_width / 3, half_width / 3):
    h = spring + rise * 0.94 - bottom
    panel(mesh, frame, centre + u, bottom + h / 2, 0.12, h, 0xB8B2A1, 0.17)
  panel(mesh, frame, centre, spring, 2 * half_width, 0.13, 0xB8B2A1, 0.17)


def station_packets() -> tuple[dict, list]:
  geometry, inputs = {}, []
  for mode, family in zip(MODES, ("Drawn", "Native")):
    manifest = ROOT / f"src/app/src/data/altMitte{family}V169Source.json"
    source = base.read_json(manifest)
    assert "DEBE01YYK00007hE" in source["sourceParents"]
    inputs.append(manifest)
    local = []
    for entry in source["chunkFiles"]:
      if not entry["id"].startswith("1_-3-piece-"):
        continue
      path = manifest.parent / entry["file"]
      triangles = fit.drawn_triangles(base.read_json(path), [])
      inside = np.all(triangles.min(axis=1) >= [906, 5.0, -1502], axis=1) & np.all(
        triangles.max(axis=1) <= [947, 20.0, -1463], axis=1
      )
      if np.any(inside):
        local.extend(triangles[inside])
        inputs.append(path)
    geometry[mode] = np.asarray(local)
  return geometry, inputs


def station(
  draw: Mesh, native: Mesh, prism: dict, official: dict, geometry: dict
) -> dict:
  assert prism["id"] == "27822655" and prism["y0_dm"] == 52 and prism["h_dm"] == 60
  assert (
    len(official["parts"]) == 3
    and sum(len(p["surfaces"]) for p in official["parts"]) == 29
  )
  plan = Polygon([[x / 10, z / 10] for x, z in prism["ring"]])
  # The official upper gable is already present through Alt-Mitte v169.
  # Fit all ornament to the same measured street-facing plane.
  gable = line_frame([937.373, -1475.814], [927.18, -1469.848], plan)
  a, d, n, length = gable
  source = geometry["drawn"]
  offsets = source[:, :, [0, 2]] - a
  u, distance = offsets @ d, offsets @ n
  selected = np.max(np.abs(distance), axis=1) < 0.035
  faces = unary_union(
    [
      Polygon(np.column_stack([x, y]))
      for x, y in zip(u[selected], source[selected, :, 1])
    ]
  )
  assert faces.buffer(0.04).covers(box(0.18, 5.29, length - 0.18, 15.46))
  panel(draw, gable, length / 2, 10.375, length - 0.40, 10.10, BRICK, 0.027)
  panel(draw, gable, length / 2, 5.52, length - 0.42, 0.45, 0x8D8373, 0.075)
  for shift in (-3.15, 0, 3.15):
    arch(draw, gable, length / 2 + shift, 5.54, 8.36, 0.99, 0.57, False)
  panel(draw, gable, length / 2, 9.52, length - 0.36, 0.25, TRIM, 0.15)
  for shift in (-4.8, -1.6, 1.6, 4.8):
    panel(draw, gable, length / 2 + shift, 7.73, 0.22, 4.0, TRIM, 0.16)
  arch(draw, gable, length / 2, 11.42, 12.64, 3.39, 2.51, False)
  panel(draw, gable, length / 2, 11.21, 7.25, 0.18, TRIM, 0.15)
  panel(draw, gable, length / 2, 15.49, length - 0.31, 0.23, TRIM, 0.17)

  # Read real 2 m native wall planes. Accept only the frontmost source
  # plane covering an entire rectangle around each fitting centre.
  tris = geometry["minecraft"]
  planes = {}
  for z in sorted(set(tris[:, 0, 2])):
    sections = tris[(np.ptp(tris[:, :, 2], axis=1) < 0.001) & (tris[:, 0, 2] == z)]
    planes[z] = unary_union(
      [Polygon(p[:, :2]) for p in sections if Polygon(p[:, :2]).area > 0.01]
    )

  def front(x: float, y0: float, y1: float, width: float) -> tuple:
    position = a + d * ((x - a[0]) / d[0])
    candidates = [
      z
      for z, shape in planes.items()
      if abs(z - position[1]) <= 2.2
      and shape.covers(box(x - width / 2, y0, x + width / 2, y1))
    ]
    assert candidates, (x, y0, y1, width)
    return (
      np.array([x, max(candidates)]),
      np.array([1.0, 0.0]),
      np.array([0.0, 1.0]),
      width,
    )

  native_faces = []
  for x in (929.0, 931.0, 933.0):
    frame = front(x, 5.50, 9.02, 1.67)
    arch(native, frame, 0, 5.54, 8.40, 0.70, 0.56, True)
    native_faces.append(frame[0].tolist())
  for x, height in [
    (927.0, 0.82),
    (929.0, 1.64),
    (931.0, 2.03),
    (933.0, 1.64),
    (935.0, 0.82),
  ]:
    frame = front(x, 11.44, 12.84 + height, 1.45)
    panel(
      native, frame, 0, (11.44 + 12.84 + height) / 2, 1.39, 1.4 + height, GLASS, 0.12
    )
    panel(native, frame, 0, 11.26, 1.69, 0.20, TRIM, 0.15)
    panel(
      native,
      frame,
      0.62,
      (11.44 + 12.84 + height) / 2,
      0.11,
      1.4 + height,
      0xB8B2A1,
      0.15,
    )
    native_faces.append(frame[0].tolist())
  return {
    "suppressedOriginalPrism": prism,
    "officialFamily": official,
    "drawnFront": [a.tolist(), (a + d * length).tolist()],
    "nativeFrontPlanes": native_faces,
  }


def packet(key: str, mode: str) -> tuple:
  manifest = base.read_json(OUT / "manifest.json")
  desc = next(x for x in manifest["chunks"] if x["id"] == key)
  path = OUT / desc[mode]["url"]
  raw = path.read_bytes()
  assert len(raw) == desc[mode]["bytes"]
  assert hashlib.sha256(raw).hexdigest() == desc[mode]["sha256"]
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw), path


def ground_at(packet_data: dict, point: list) -> float:
  value = prior.ground_height(np.asarray(point), fit.drawn_triangles(packet_data, []))
  assert value is not None, point
  return value


def osm_features() -> tuple:
  transform = Transformer.from_crs(25833, 4326, always_xy=True)

  def fetch(layer: str, bounds: tuple, ids: set) -> dict:
    x0, z0, x1, z1 = bounds
    bbox = transform.transform(x0 + 389500, 5820000 - z1) + transform.transform(
      x1 + 389500, 5820000 - z0
    )
    df = pyogrio.read_dataframe(PBF, layer=layer, bbox=bbox).to_crs(25833)
    records = {
      str(row.osm_id): row for row in df.itertuples() if str(row.osm_id) in ids
    }
    assert set(records) == ids
    return records

  return (
    fetch("points", (3176, -2704, 3399, -2516), set(TABLES)),
    fetch("lines", (1070, -1635, 1110, -1586), {"53257004"})["53257004"],
  )


def tables(mesh: Mesh, p: dict, records: dict) -> list:
  result = []
  for id in TABLES:
    row = records[id]
    assert '"sport"=>"table_tennis"' in row.other_tags
    point = base.world(row.geometry)
    xz = np.array([point.x, point.y])
    y = ground_at(p, xz.tolist())
    mesh.solid(xz, y + 0.72, 2.74, 0.12, 1.53, 0x666F66)
    for dx in (-0.74, 0.74):
      mesh.solid(xz + [dx, 0], y + 0.34, 0.26, 0.68, 1.06, 0xA0A198)
    mesh.solid(xz, y + 0.865, 0.05, 0.17, 1.54, 0x575E5E)
    mesh.solid(xz, y + 0.958, 0.065, 0.035, 1.62, 0xA7AA9A)
    for dx in (-1.30, 1.30):
      mesh.solid(xz + [dx, 0], y + 0.785, 0.03, 0.011, 1.49, 0xCECEC1)
    result.append([id, *xz.tolist(), y])
  return result


def school(mesh: Mesh, p: dict, native: bool) -> dict:
  ox, oy, oz = p["origin"]
  row = next(x for x in p["nav"]["buildings"] if x["sourceId"] == SCHOOL)
  ring = row["ring"]
  footprint = translate(Polygon(ring, row["holes"]), ox, oz)
  low = p["nav"]["groundY"] + row["minHeight"] + row.get("groundOffset", 0)
  high = p["nav"]["groundY"] + row["height"] + row.get("groundOffset", 0)
  triangles = base.mesh_wall_triangles(p)
  selected = (
    (34, 36, 39, 46, 56, 59, 65, 69, 72)
    if native
    else (2, 3, 15, 19, 27, 29, 36, 38, 39, 45)
  )
  for i in selected:
    a, b = ring[i], ring[(i + 1) % len(ring)]
    assert base.source_wall_exists(triangles, a, b, low - oy, high - oy)
    frame = line_frame(np.array(a) + [ox, oz], np.array(b) + [ox, oz], footprint)
    width = frame[3]
    bays = max(1, round(width / 2.55))
    for storey in range(4):
      y = low + 3.1 + storey * 4.0
      for j in range(bays):
        u = (j + 0.5) * width / bays
        w = min(1.38, width / bays * 0.61)
        panel(mesh, frame, u, y, w + 0.19, 2.47, 0xA5684D, 0.08)
        panel(mesh, frame, u, y, w, 2.20, 0x46565B, 0.125)
        panel(mesh, frame, u, y, 0.075, 2.20, 0xC5B9A3, 0.16)
        panel(mesh, frame, u, y + 0.37, w, 0.072, 0xC5B9A3, 0.16)
        panel(mesh, frame, u, y - 1.18, w + 0.26, 0.115, 0xB38058, 0.16)
    panel(mesh, frame, width / 2, low + 16.94, width - 0.12, 0.19, 0xA37252, 0.125)
  return {"packetBuilding": row, "streetAndYardWallIndices": selected}


def offices(mesh: Mesh, features: list, native: bool) -> list:
  selected = {}
  for f in features:
    if f["role"] == "db-stettiner-blank-fascia-estimate":
      selected.setdefault(f["owner"], f)
  assert len(selected) == 4
  for feature in selected.values():
    face = feature["face"]
    if native:
      # Each previous projection is an independent exact exposed 2 m wall span.
      rects = [
        f
        for f in features
        if f["owner"] == feature["owner"]
        and f["role"] == feature["role"]
        and f.get("nativeFrame")
      ]
      for item in rects:
        ff = item["nativeFrame"]
        frame = (np.asarray(ff["a"]), np.asarray(ff["d"]), np.asarray(ff["n"]), 2)
        for y in (9.75, 12.5):
          panel(mesh, frame, 0, y, min(0.98, item["nativeWidth"]), 1.6, 0x5F7881)
          panel(mesh, frame, 0, y - 0.88, 1.05, 0.12, 0xB7BBB6, 0.14)
    else:
      frame = (
        np.asarray(face["a"]),
        np.asarray(face["d"]),
        np.asarray(face["n"]),
        face["length"],
      )
      width = frame[3]
      bays = math.floor(width / 2.0)
      for y in (9.75, 12.5):
        for i in range(bays):
          u = (i + 0.5) * width / bays
          panel(mesh, frame, u, y, 1.47, 1.6, 0x5F7881)
          panel(mesh, frame, u, y, 0.085, 1.62, 0xC0C4C0, 0.13)
          panel(mesh, frame, u, y - 0.86, 1.62, 0.12, 0xB7BBB6, 0.14)
  return list(selected.values())


def jump(mesh: Mesh, features: list, native: bool) -> dict:
  feature = next(f for f in features if f["role"] == "myjump-blank-fascia-estimate")
  if native:
    f = feature["nativeFrame"]
    a, d, n = map(np.asarray, [f["a"], f["d"], f["n"]])
  else:
    f = feature["face"]
    d, n = np.asarray(f["d"]), np.asarray(f["n"])
    a = np.asarray(f["a"]) + d * feature["u"]
  frame = (a, d, n, 1.15)
  # Plain short identification on the existing blank fascia, with the word
  # reading in the correct direction from outside; no logo or photo trace.
  if d[0] * n[1] - d[1] * n[0] < 0:
    frame = (a, -d, n, 1.15)
  letters = (
    "101111101101101",
    "101101010010010",
    "111001001101111",
    "101101101101111",
    "101111111101101",
    "110101110100100",
  )
  for k, letter in enumerate(letters):
    for j, bit in enumerate(letter):
      if bit == "1":
        panel(
          mesh,
          frame,
          (k * 4 + j % 3 - 11) * 0.043,
          8.30 + (2 - j // 3) * 0.043,
          0.042,
          0.042,
          0xF0D254,
          0.335,
        )
  return feature


def wall(draw: Mesh, native: Mesh, row: object) -> list:
  assert row.barrier == "retaining_wall"
  line = base.world(row.geometry)
  with zipfile.ZipFile(DGM) as archive, archive.open(archive.namelist()[0]) as stream:
    samples = np.loadtxt(stream, usecols=2).reshape(2000, 2000)

  def nhn(x: float, z: float) -> float:
    return float(samples[math.floor(-z), math.floor(x - 500)])

  # The profile uses the extant adjacent street as the local display datum.
  street_nhn = nhn(1107, -1608)

  def top(x: float, z: float) -> float:
    return round(5.2 + nhn(x, z) - street_nhn, 2)

  points = [np.asarray(p) for p in line.coords]
  course = []
  for a, b in zip(points, points[1:]):
    delta = b - a
    length = np.linalg.norm(delta)
    count = math.ceil(length / 1.3)
    d = delta / length
    n = np.array([d[1], -d[0]])
    for i in range(count):
      p, q = a + delta * i / count, a + delta * (i + 1) / count
      xz = (p + q) / 2
      # Park lies on the west side. Read DGM a few metres behind the edge.
      inside = xz + n * 3
      if inside[0] > xz[0]:
        inside = xz - n * 3
      y = max(5.45, top(*inside))
      assert y <= 9.7
      draw.solid(
        xz, (5.2 + y) / 2, np.linalg.norm(q - p) + 0.012, y - 5.2, 0.44, 0x897F70, d
      )
      draw.solid(xz, y + 0.06, np.linalg.norm(q - p) + 0.018, 0.12, 0.54, 0xA09B88, d)
      # Independent short cardinal steps preserve each course endpoint.
      elbow = np.array([q[0], p[1]])
      for u, v in ((p, elbow), (elbow, q)):
        ll = np.linalg.norm(v - u)
        if ll < 0.025:
          continue
        direction = (v - u) / ll
        native.solid(
          (u + v) / 2, (5.2 + y) / 2, ll + 0.42, y - 5.2, 0.42, 0x897F70, direction
        )
        native.solid((u + v) / 2, y + 0.06, ll + 0.49, 0.12, 0.49, 0xA09B88, direction)
      course.append([p.tolist(), q.tolist(), inside.tolist(), nhn(*inside), y])
  return [
    {
      "osmWay": str(row.osm_id),
      "originalCoordinates": list(line.coords),
      "streetDgmNhn": street_nhn,
      "samples": course,
    }
  ]


def build() -> None:
  draws = {
    k: Mesh()
    for k in (
      "Stettiner Vorortbahnhof",
      "Stettiner Carrée",
      "MYJUMP fascia",
      "Park am Nordbahnhof retaining edge",
      "Helmholtzplatz table tennis",
      "Grundschule im Hofgarten",
    )
  }
  natives = {k: Mesh() for k in draws}
  source = next(
    x for x in base.read_json(LOD2)["buildings"] if x["id"] == "DEBE01YYK00007hE"
  )
  prism_path = CORE / "lod2-prisms.json"
  prism = next(
    x for x in base.read_json(prism_path)["buildings"] if x["id"] == "27822655"
  )
  geometry, packets = station_packets()
  ownership = ROOT / "src/app/src/data/altMitteV169Ownership.json"
  assert prism["id"] in base.read_json(ownership)["prismIds"]
  inputs = [LOD2, PBF, DGM, prism_path, ownership, prior.EVIDENCE, *packets]
  evidence = {
    "station": station(
      draws["Stettiner Vorortbahnhof"],
      natives["Stettiner Vorortbahnhof"],
      prism,
      source,
      geometry,
    )
  }
  table_records, retaining_edge = osm_features()
  evidence["retainingEdge"] = wall(
    draws["Park am Nordbahnhof retaining edge"],
    natives["Park am Nordbahnhof retaining edge"],
    retaining_edge,
  )
  features = base.read_json(prior.EVIDENCE)["features"]
  parts = []
  for mode, meshes in zip(MODES, (draws, natives)):
    native = mode == "minecraft"
    sp, sp_path = packet("6_-5", mode)
    tp, tp_path = packet("6_-6", mode)
    inputs.extend([sp_path, tp_path])
    evidence[mode] = {
      "school": school(meshes["Grundschule im Hofgarten"], sp, native),
      "tables": tables(meshes["Helmholtzplatz table tennis"], tp, table_records),
      "offices": offices(meshes["Stettiner Carrée"], features, native),
      "myjump": jump(meshes["MYJUMP fascia"], features, native),
    }
    parts.extend(mesh.packed(key, native) for key, mesh in meshes.items())
  evidence["inputs"] = {
    str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs
  }
  evidence["references"] = REFERENCES
  base.write_json(EVIDENCE, evidence)
  DATA.write_text(json.dumps(parts, ensure_ascii=False, separators=(",", ":")) + "\n")
  print([(r["key"], r["native"], r["boxCount"]) for r in parts])


if __name__ == "__main__":
  build()
