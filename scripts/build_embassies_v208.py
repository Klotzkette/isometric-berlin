"""Step 10: source-plane embassy returns and the twelve-axis Aeroflot facade.

Retain every source shell and the earlier embassy monument/forecourt assembly.
Replace only the documented eight-axis Aeroflot authored recognition recipe.
"""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from shapely.geometry import LineString, Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("src/app/src/unterDenLindenSource.json")
OUT = Path("src/app/src/data/embassiesV208.json")
RECEIPT = Path("geo_data/regierungsviertel/embassies-v208-source.json")
FRONTS = [
  [[751.861, 306.257], [776.098, 304.169]],
  [[775.221, 326.504], [795.044, 324.82]],
  [[794.628, 320.211], [813.301, 318.697]],
  [[813.788, 323.228], [833.054, 321.592]],
  [[829.27, 299.461], [853.256, 297.429]],
]
WARM, LIGHT, JOINT, GLASS, FRAME = 0xD4CEBC, 0xE3DFCF, 0x9E998B, 0x5D797F, 0xBCC6BC


def build(root: Path = ROOT) -> tuple[dict, dict]:
  """Prepare shallow deterministic attachments in the retained viewer frame."""
  source = json.loads((root / SOURCE).read_text())
  embassy = next(p for p in source["profiles"] if p["key"] == "russianEmbassy")
  aero = next(p for p in source["profiles"] if p["key"] == "aeroflot")
  parts = embassy["parts"] + aero["parts"]
  shapes = [Polygon(p["ring"], p["holes"]) for p in parts]
  prisms = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/lod2-prisms.json").read_text()
  )
  ap = next(p for p in prisms["buildings"] if p["id"] == aero["parent_id"][-8:])
  voxel = json.loads(
    (root / "src/app/public/mesh/regierungsviertel/minecraft-voxels.json").read_text()
  )
  grid, cell = voxel["grid"], voxel["cell_m"]
  native_solids = []
  # Embassy columns are already superseded by its exact source-shell model.
  # The unrelated Aeroflot body still uses the original four-metre columns.
  aero_shape = shapes[-1]
  for row, runs in enumerate(voxel["building_rows"]):
    z = (grid["min_z_idx"] + row + 0.5) * cell
    if z < 280 or z > 315:
      continue
    for ix, count, low, high, _ in runs:
      for index in range(ix, ix + count):
        x = (grid["min_x_idx"] + index + 0.5) * cell
        if not aero_shape.buffer(2.84).covers(Point(x, z)):
          continue
        native_solids.append(
          [x - cell / 2, z - cell / 2, x + cell / 2, z + cell / 2, low / 10, high / 10]
        )
  # Retained native embassy wall recipe uses min thickness .4 m; roofs can
  # protrude up to a 2 m-cell half diagonal in the touch-specific legacy shell.
  faces, boxes, blocks, cylinders = [], [], [], []

  def face(a: list, b: list, oi: int, role: str, low: float, high: float) -> int:
    dx, dz = b[0] - a[0], b[1] - a[1]
    length = math.hypot(dx, dz)
    d = [dx / length, dz / length]
    n = [d[1], -d[0]]
    middle = [(a[k] + b[k]) / 2 for k in range(2)]
    if shapes[oi].covers(Point(middle[0] + n[0] * 0.12, middle[1] + n[1] * 0.12)):
      n = [-v for v in n]
    clearance = 0.52 if oi < 16 else 0
    if oi == 16:
      for x0, z0, x1, z1, y0, y1 in native_solids:
        if y1 <= low or y0 >= high:
          continue
        corners = [(x, z) for x in [x0, x1] for z in [z0, z1]]
        u = [sum((p[k] - a[k]) * d[k] for k in range(2)) for p in corners]
        if max(u) < -0.4 or min(u) > length + 0.4:
          continue
        out = [sum((p[k] - a[k]) * n[k] for k in range(2)) for p in corners]
        if min(out) < 1 and max(out) > -0.4:
          clearance = max(clearance, max(out) + 0.19)
    faces.append(
      dict(
        owner=oi,
        role=role,
        start=a,
        end=b,
        direction=d,
        outward=n,
        length=length,
        low=low,
        high=high,
        nativeClearanceM=clearance,
      )
    )
    return len(faces) - 1

  def emit(
    fi: int,
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    outward: float,
    color: int,
    role: str,
    native: bool = True,
  ) -> None:
    f = faces[fi]
    d, n, a = f["direction"], f["outward"], f["start"]
    yaw = math.atan2(-d[1], d[0])
    q = [a[0] + u * d[0] + outward * n[0], y, a[1] + u * d[1] + outward * n[1]]
    boxes.append([*[round(v, 5) for v in [*q, w, h, depth, yaw]], color, fi, role])
    if native:
      steps = max(1, math.ceil(w / 0.82))
      for j in range(steps):
        along = u - w / 2 + (j + 0.5) * w / steps
        reach = outward + f["nativeClearanceM"]
        x, z = [a[k] + along * d[k] + reach * n[k] for k in range(2)]
        sx = abs(d[0]) * w / steps + abs(n[0]) * depth
        sz = abs(d[1]) * w / steps + abs(n[1]) * depth
        blocks.append([*[round(v, 5) for v in [x, y, z, sx, h, sz]], color, fi, role])

  def window(
    fi: int,
    u: float,
    y: float,
    w: float,
    h: float,
    base_out: float = 0.3,
    color: int = GLASS,
  ) -> None:
    emit(fi, u, y, w + 0.25, h + 0.28, 0.13, base_out, JOINT, "window-reveal")
    emit(fi, u, y, w, h, 0.09, base_out + 0.12, color, "pane")
    for du in [-w / 2, w / 2]:
      emit(fi, u + du, y, 0.10, h + 0.16, 0.12, base_out + 0.23, LIGHT, "jamb")
    for dy in [-h / 2, h / 2]:
      emit(fi, u, y + dy, w + 0.19, 0.10, 0.12, base_out + 0.23, LIGHT, "frame")
    emit(fi, u, y - h / 2 - 0.20, w + 0.45, 0.20, 0.39, base_out + 0.28, LIGHT, "sill")
    emit(fi, u, y, 0.07, h, 0.08, base_out + 0.25, FRAME, "mullion")
    emit(fi, u, y + h * 0.17, w, 0.07, 0.08, base_out + 0.25, FRAME, "transom")

  # The five earlier north-facing fronts stay untouched. Complete return and
  # Behrenstrasse walls are subdivided only on genuinely exposed source edges.
  existing_fronts = [LineString(v) for v in FRONTS]
  for oi, part in enumerate(parts[:16]):
    if part["id"] == "DEBE3DmaCMlAOled":
      continue  # Preserve the actual chimney without invented windows.
    ring = part["ring"]
    for index, a in enumerate(ring):
      b = ring[(index + 1) % len(ring)]
      axis = LineString([a, b])
      if axis.length < 4.2 or any(
        axis.hausdorff_distance(old) < 0.05 for old in existing_fronts
      ):
        continue
      # Use the actual wall eaves at this source edge, not its higher roof ridge.
      tops = []
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        sr = surface["rings"][0]
        if max(axis.distance(Point(v[0], v[2])) for v in sr) > 0.07:
          continue
        columns = {}
        for x, y, z in sr:
          key = (round(x, 2), round(z, 2))
          columns[key] = max(columns.get(key, -math.inf), y)
        tops.extend(columns.values())
      high = (min(tops) if tops else part["top_y_m"]) + 3.527
      fi = face(a, b, oi, "embassy-return", 5.2, high)
      f, length = faces[fi], axis.length
      m = axis.interpolate(0.5, normalized=True)
      n = f["outward"]
      check = Point(m.x + n[0] * 0.7, m.y + n[1] * 0.7)
      if any(
        i != oi and p.buffer(0.08).covers(check) for i, p in enumerate(shapes[:16])
      ):
        faces.pop()
        continue
      # A photograph-guided rusticated skin with exposed stone between openings.
      emit(fi, length / 2, 7.25, length, 4.1, 0.12, 0.22, 0xBBB5A3, "rusticated-base")
      for level in [5.9, 6.6, 7.3, 8.0, 8.7]:
        emit(fi, length / 2, level, length, 0.045, 0.04, 0.31, JOINT, "stone-joint")
      count = max(1, round(length / 3.6))
      for bay in range(count):
        u = (bay + 0.5) * length / count
        for y in [12.4, 17.7, 23.1]:
          if y + 1.8 > high - 1.15:
            continue
          q = Point(
            a[0] + f["direction"][0] * u + n[0] * 0.7,
            a[1] + f["direction"][1] * u + n[1] * 0.7,
          )
          if any(i != oi and p.covers(q) for i, p in enumerate(shapes[:16])):
            continue
          window(fi, u, y, min(2.0, length / count * 0.58), 2.95)
        emit(
          fi,
          u,
          7.4,
          min(1.2, length / count * 0.36),
          2.4,
          0.1,
          0.39,
          GLASS,
          "basement-pane",
        )
      for y in [9.7, min(high - 1.2, 25.7), min(high - 0.7, 26.2)]:
        emit(fi, length / 2, y, length, 0.23, 0.42, 0.4, LIGHT, "return-cornice")
  # Extra articulation on the retained front does not cover its apertures,
  # columns, sculpture, arch heads, original frieze or forecourt enclosure.
  for section, (a, b) in enumerate(FRONTS):
    oi = min(
      range(16),
      key=lambda i: shapes[i].boundary.distance(
        LineString([a, b]).interpolate(0.5, normalized=True)
      ),
    )
    fi = face(a, b, oi, "embassy-front-finishing", 5.2, 28.2)
    length = faces[fi]["length"]
    count = 3 if section == 2 else 5 if section in [0, 4] else 4
    pitch = length / count
    for row in range(9):
      y = 5.5 + row * 0.44
      # Short vertical joints alternate, with no full black facade grid.
      for bay in range(count):
        u = (bay + (0.3 if row % 2 else 0.7)) * pitch
        if abs(u - length / 2) < 2.7 and section == 2:
          continue
        emit(fi, u, y, 0.045, 0.40, 0.06, 0.58, JOINT, "front-rustication")
    if section in [0, 4]:
      for column in range(6):
        u = 0.45 + column * (length - 0.9) / 5
        for y, width, height in [
          (25.03, 1.11, 0.20),
          (25.31, 1.24, 0.16),
          (25.55, 1.39, 0.19),
        ]:
          emit(fi, u, y, width, height, 0.84, 0.76, LIGHT, "capital-abacus")
        for y, radius, height in [
          (10.1, 0.59, 0.16),
          (10.34, 0.54, 0.17),
          (24.8, 0.53, 0.19),
        ]:
          f = faces[fi]
          x, z = [
            f["start"][k] + f["direction"][k] * u + f["outward"][k] * 0.73
            for k in range(2)
          ]
          cylinders.append(
            [round(x, 5), y, round(z, 5), radius * 2, height, radius * 2, LIGHT]
          )
          emit(
            fi,
            u,
            y,
            radius * 2,
            height,
            radius * 2,
            0.73,
            LIGHT,
            "native-capital",
            native=True,
          )
          boxes.pop()  # Smooth mode gets the round torus-like collar only.
    # Small relief rectangles and doubled sills sit on existing window skirts.
    for bay in range(count):
      u = (bay + 0.5) * pitch
      if section == 2:
        continue
      emit(fi, u, 15.88, pitch * 0.62, 0.13, 0.21, 0.85, LIGHT, "front-stringcourse")
      for du in [-0.5, 0, 0.5]:
        emit(fi, u + du, 15.51, 0.19, 0.16, 0.075, 0.84, WARM, "front-rosette")

  # Correct twelve-axis modern frontage. The old eight-axis authored facade is
  # suppressed by an exact opt-out; its source prism/roof is unchanged.
  a, b = [926.231, 288.437], [958.331, 285.567]
  fi = face(
    a,
    b,
    16,
    "aeroflot-twelve-axis-front",
    ap["y0_dm"] / 10,
    (ap["y0_dm"] + ap["h_dm"]) / 10,
  )
  f, base = faces[fi], 5.2
  length = f["length"]
  lattice_start, lattice_width = length - 2.8, 2.65
  glass_start, glass_end = 1.13, lattice_start - 0.64
  pitch = (glass_end - glass_start) / 12
  # Wall behind openings retains the existing envelope; cream panels add relief.
  emit(
    fi,
    length / 2,
    base + 9.78,
    length,
    19.55,
    0.12,
    0.37,
    0xDADBD2,
    "aeroflot-stone-plane",
  )
  for row in range(4):
    y = base + 6.12 + row * 3.36
    for bay in range(12):
      u = glass_start + (bay + 0.5) * pitch
      window(fi, u, y, pitch - 0.28, 2.93, 0.50, 0x577A87)
      emit(fi, u, y - 0.97, pitch - 0.46, 0.58, 0.10, 0.78, 0x37657A, "blue-spandrel")
      emit(
        fi,
        u + (pitch - 0.4) * 0.24,
        y + 0.27,
        0.055,
        1.93,
        0.08,
        0.81,
        FRAME,
        "aeroflot-window-leaf",
      )
  for y in [base + 0.26, base + 4.43, base + 17.91, base + 19.52]:
    emit(fi, length / 2, y, length, 0.17, 0.22, 0.73, 0xF0EFE5, "aeroflot-floor-string")
  for bay in range(10):
    u = glass_start + (bay + 0.5) * (glass_end - glass_start) / 10
    emit(
      fi,
      u,
      base + 1.98,
      (glass_end - glass_start) / 10 - 0.15,
      3.66,
      0.14,
      0.53,
      0x6C8E92,
      "aeroflot-shop-glazing",
    )
    emit(fi, u, base + 1.97, 0.09, 3.7, 0.12, 0.73, 0xC2CABF, "aeroflot-shop-mullion")
    emit(
      fi,
      u,
      base + 3.52,
      (glass_end - glass_start) / 10 - 0.1,
      0.10,
      0.12,
      0.75,
      FRAME,
      "shop-transom",
    )
  # Square-screen voids read dark behind separate thin concrete members, with
  # no new structural building mass beyond the retained source plane.
  emit(
    fi,
    lattice_start + lattice_width / 2,
    base + 11.5,
    lattice_width,
    15.6,
    0.10,
    0.53,
    0x6E756C,
    "screen-shadow",
  )
  for col in range(5):
    emit(
      fi,
      lattice_start + col * lattice_width / 4,
      base + 11.5,
      0.14,
      15.6,
      0.19,
      0.79,
      0xE8E7DE,
      "lattice-upright",
    )
  for row in range(23):
    emit(
      fi,
      lattice_start + lattice_width / 2,
      base + 4.0 + row * 0.68,
      lattice_width,
      0.14,
      0.21,
      0.81,
      0xE8E7DE,
      "lattice-crossmember",
    )
  # Roof letters have their own supports and no solid board.
  for u in [1.7, 4.2, 6.7, 9.2, 11.7]:
    emit(fi, u, base + 19.86, 0.07, 0.61, 0.10, 0.56, 0x596063, "roof-letter-support")
  # The side return is measured separately, with restrained panel seams.
  side = face(b, [959.946, 304.541], 16, "aeroflot-east-return", base, base + 19.606)
  sl = faces[side]["length"]
  for y in [base + 4.44, base + 7.8, base + 11.16, base + 14.52, base + 17.88]:
    emit(side, sl / 2, y, sl, 0.075, 0.07, 0.3, 0xA6AA9F, "side-panel-seam")
  for j in range(5):
    emit(
      side,
      (j + 0.5) * sl / 5,
      base + 11.1,
      0.065,
      14.2,
      0.07,
      0.3,
      0xA6AA9F,
      "side-panel-seam",
    )
  for row in range(4):
    for bay in range(3):
      window(side, sl * (0.21 + 0.27 * bay), base + 6.12 + row * 3.36, 1.62, 2.68, 0.34)
  data = dict(
    schemaVersion=1,
    faces=faces,
    boxes=boxes,
    blocks=blocks,
    cylinders=cylinders,
    aeroflotFrontFace=fi,
    aeroflotWindowAxes=12,
    aeroflotWindowFloors=4,
    sourceIds=[p["id"] for p in parts],
  )
  retained = [
    SOURCE,
    Path("src/app/src/RussianEmbassySourceGeometry.ts"),
    Path("src/app/src/unterDenLindenProfiles.ts"),
    Path("src/app/public/mesh/regierungsviertel/lod2-prisms.json"),
    Path("src/app/public/mesh/regierungsviertel/minecraft-voxels.json"),
  ]
  receipt = dict(
    schemaVersion=1,
    step=10,
    source=source,
    sourceRetention="All17 original source parts and complete sheets remain unchanged and rendered; embassy v148 front, lantern, figures and forecourt stay intact. Only the former8-axis Aeroflot authored recipe is opted out in production.",
    retainedHashes={
      str(p): hashlib.sha256((root / p).read_bytes()).hexdigest() for p in retained
    },
    metric="LoD2 ground rings/wall edges and original vertical envelopes. Embassy +3.527m translation retained. Aeroflot existing5.2m display facade datum retained.",
    estimates="Facade aperture subdivisions,12-axis photo count, colour, stone joints, corner trimming, lattice pitch and native offsets are photographic/architectural display fits, not surveyed aperture coordinates.",
    nativeAeroflotRetainedColumns=native_solids,
    originalAeroflotPrism=ap,
    sourceUrl=source["source_url"],
    maximumNativeClearanceM=max(f["nativeClearanceM"] for f in faces),
    drawingsEqualOnTouch=True,
    photographsBundled=False,
    priorSourceSha256=hashlib.sha256((root / SOURCE).read_bytes()).hexdigest(),
  )
  return data, receipt


if __name__ == "__main__":
  data, receipt = build()
  for path, value in [(OUT, data), (RECEIPT, receipt)]:
    (ROOT / path).write_text(
      json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n"
    )
  print(
    json.dumps(
      dict(
        faces=len(data["faces"]),
        boxes=len(data["boxes"]),
        blocks=len(data["blocks"]),
        cylinders=len(data["cylinders"]),
        bytes=(ROOT / OUT).stat().st_size,
        sha256=hashlib.sha256((ROOT / OUT).read_bytes()).hexdigest(),
      )
    )
  )
