"""Step 10: finite Alte Münze and Leipziger Straße source-face recognition.

Only the exact old generic Münze facade recipe is overlaid by a complete
three-storey reading. Source walls/roofs and every other earlier detail survive.
The independent native surfaces share the existing v186 spatial cube batches.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import math
from collections import defaultdict
from itertools import product
from pathlib import Path

import numpy as np
from build_alt_mitte_v169 import facade, footprint
from build_concert_halls_v160 import normal_of
from build_north_mitte_fronts_v239 import current_triangles, tri_key
from build_schools_places_v205 import Face, group
from shapely.geometry import Point, box, shape
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"
MINT = "DEBE01YYK00006oT"
TOWERS = {
  "DEBE01YYK0000EiI": "40",
  "DEBE01YYK00002mi": "41",
  "DEBE01YYK0000Djy": "43",
  "DEBE01YYK0000FR1": "44",
  "DEBE01YYK00004Mh": "46",
  "DEBE01YYK00001NH": "47",
}
PAVILIONS = {"DEBE01YYK00003Gh": "42", "DEBE01YYK0000F7J": "45"}
WEST = {
  "DEBE01YYK0000B5V",
  "DEBE01YYK0000EdR",
  "DEBE01YYK00007So",
  "DEBE01YYK0000Ak4",
  "DEBE01YYK00004NG",
}
STONE, PALE, INK, GLASS = 0xB8AD92, 0xDCD5BE, 0x4A514B, 0x66818A
POLICY = (
  "Bounded source-wall fittings only. Complete measured buildings, roof sheets, "
  "courts, ground, earlier detail and navigation remain unchanged. Only the "
  "exact receipted v169 generic window estimate on six Münze/Palais street "
  "planes receives a complete shallow reference-based replacement reading. "
  "All aperture subdivisions, small dimensions, colours and relief figures "
  "are display estimates, not surveyed architecture. No photographs, texts "
  "or protected plans are bundled. Full drawn mobile detail, independent "
  "orthogonal native rows and unchanged live budgets; existing v186 cells only."
)


def read(path: Path) -> dict:
  """Read compact retained source records."""
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def sha(path: Path) -> str:
  """Receipt an unchanged complete source file."""
  return hashlib.sha256(path.read_bytes()).hexdigest()


def receipt(triangle: list, keys: set[bytes]) -> bytes | None:
  """Match delivered cm triangles, allowing only exact half-centimetre ties.

  Packet-local and world-space float arithmetic can round a .005 tie in
  opposite directions. Every returned key is an actual immutable triangle;
  no geometric tolerance wider than the original quantizer is admitted.
  """
  key = tri_key(triangle)
  if key in keys:
    return key
  scaled = np.asarray(triangle).reshape(-1) * 100
  choices = [
    [math.floor(v), math.ceil(v)] if abs(v - math.floor(v) - 0.5) < 1e-7 else [round(v)]
    for v in scaled
  ]
  for rounded in product(*choices):
    key = tri_key(np.array(rounded).reshape(3, 3) / 100)
    if key in keys:
      return key
  return None


def source_records() -> tuple[list, dict]:
  """Read only the finite named corridor's four retained source tiles."""
  records, receipts = [], {}
  for tile in ["390_5818", "390_5819", "391_5818", "391_5819", "392_5819"]:
    path = GEO / f"alt-mitte-v169/source-{tile}-00.json.gz"
    records.extend(read(path)["buildings"])
    receipts[str(path.relative_to(ROOT))] = sha(path)
  return records, receipts


def extract() -> dict:
  """Freeze source planes and exact previous pane receipts before authoring."""
  records, receipts = source_records()
  road_path = GEO / "alt-mitte-edges-v186-streets.json"
  receipts[str(road_path.relative_to(ROOT))] = sha(road_path)
  roads = [r for r in read(road_path)["roads"] if r["name"] == "Leipziger Straße"]
  route = unary_union([shape(r["geometry"]) for r in roads])
  occupied = unary_union([footprint(b) for b in records])
  keys, packets = current_triangles(box(860, 340, 2570, 1080))
  selected, corrections = [], []
  names = {
    MINT: "Alte Münze / Palais Schwerin",
    **{k: f"Leipziger Straße {v}" for k, v in (TOWERS | PAVILIONS).items()},
    **{k: "Leipziger Straße western frontage" for k in WEST},
  }
  for b in records:
    if b["id"] not in names:
      continue
    for p in b["parts"]:
      for index, s in enumerate(p["surfaces"]):
        if s["kind"] != "WallSurface":
          continue
        a = np.array(s["rings"][0])
        n = normal_of(s["rings"][0])
        span = max(np.linalg.norm((p - q)[[0, 2]]) for p in a for q in a)
        if abs(n[1]) > 0.01 or span < 4 or np.ptp(a[:, 1]) < 4:
          continue
        center = a.mean(0)
        if b["id"] == MINT:
          if index not in {4, 7, 20, 25, 33, 110}:
            continue
        elif b["id"] in TOWERS:
          # Loggias run on the east/west long sides; keep every measured cap.
          if abs(n[0]) < 0.8 or np.ptp(a[:, 1]) < 45:
            continue
        else:
          nearest = nearest_points(Point(center[0], center[2]), route)[1]
          toward = np.array([nearest.x - center[0], 0, nearest.y - center[2]])
          distance = np.linalg.norm(toward)
          if distance > 45 or distance < 1 or np.dot(toward, n) / distance < 0.75:
            continue
        old = facade(s["rings"], p["groundY"], p["topY"], occupied)
        matched = [t for t in old.triangles if receipt(t[0], keys)]
        window_quads = []
        for i in range(len(old.triangles) - 1):
          a, q = old.triangles[i], old.triangles[i + 1]
          if a[2] != "window glazing" or q[2] != a[2]:
            continue
          if a[0][0] != q[0][0] or a[0][2] != q[0][1]:
            continue
          if not all(receipt(t[0], keys) for t in [a, q]):
            continue
          window_quads.append([a[0][0], a[0][1], a[0][2], q[0][2]])
        if not window_quads and b["id"] not in PAVILIONS:
          continue
        record = dict(
          name=names[b["id"]],
          owner=b["id"],
          partId=p["id"],
          surfaceIndex=index,
          rings=s["rings"],
          normal=n.tolist(),
          previousWindows=window_quads,
        )
        selected.append(record)
        if b["id"] == MINT:
          assert len(matched) == len(old.triangles), (index, len(matched))
          corrections.append(
            dict(
              owner=b["id"],
              partId=p["id"],
              surfaceIndex=index,
              reason="Generic 3.25 m six-row estimate conflicts with three-storey primary record and reference photograph.",
              triangles=[receipt(t[0], keys).hex() for t in matched],
              roles=sorted({t[2] for t in matched}),
              unchangedSourcePlane=s,
            )
          )
  assert len(corrections) == 6
  assert {r["owner"] for r in selected} == set(names), set(names) - {
    r["owner"] for r in selected
  }
  return dict(
    schemaVersion=1,
    policy=POLICY,
    sources=receipts,
    previousPacketReceipts=packets,
    faces=selected,
    correctedAuthoredEstimates=corrections,
  )


class Wall(Face):
  """Keep Face clipping, but use a compact independent native surface scale."""

  def member(
    self,
    u: float,
    y: float,
    w: float,
    h: float,
    color: int,
    depth: float = 0.10,
    out: float = 0.34,
  ) -> None:
    if not self.wall.buffer(1e-5).covers(
      box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)
    ):
      return
    self.audit["boxes"].append(len(self.target["boxes"]))
    self.target["boxes"].append([*self.point(u, y, out), w, h, depth, self.yaw, color])
    count = max(1, math.ceil(w / 1.25))
    for i in range(count):
      p = self.point(u - w / 2 + (i + 0.5) * w / count, y, 1.4 + out - 0.34)
      self.target["nativeRows"].append(
        [
          *p,
          max(0.18, abs(self.d[0]) * w / count),
          h,
          max(0.18, abs(self.d[2]) * w / count),
          color,
        ]
      )


def window(
  f: Wall, u: float, y: float, w: float, h: float, barred: bool = False
) -> None:
  """Stone reveal, white six-pane frame and optional ground-floor bars."""
  f.member(u, y, w + 0.34, h + 0.34, STONE, 0.15, 0.31)
  f.member(u, y, w, h, GLASS, 0.08, 0.42)
  for dx in [-w / 2, 0, w / 2]:
    f.member(u + dx, y, 0.065, h, PALE, 0.07, 0.49)
  for dy in [-h / 2, h * 0.20, h / 2]:
    f.member(u, y + dy, w, 0.075, PALE, 0.07, 0.49)
  f.member(u, y - h / 2 - 0.17, w + 0.47, 0.13, STONE, 0.24, 0.47)
  if barred:
    for dx in [-0.45, -0.15, 0.15, 0.45]:
      f.member(u + dx, y, 0.045, h, INK, 0.07, 0.56)


def mint(f: Wall, index: int) -> None:
  """Three storeys, paired entry piers and restrained Schadow-frieze relief."""
  length, mid = f.right - f.left, (f.left + f.right) / 2
  f.member(
    mid,
    (f.base + f.top) / 2,
    length - 0.015,
    f.top - f.base - 0.02,
    0xD5BB7B if index in {4, 33, 110} else 0xD6CEAF,
    0.06,
    0.20,
  )
  f.member(mid, f.top - 0.20, length - 0.06, 0.25, STONE, 0.22, 0.37)
  f.member(mid, f.top - 0.63, length - 0.06, 0.10, STONE, 0.18, 0.34)
  if index in {20, 25}:
    for j in range(7):
      u = f.left + (j + 0.5) * length / 7
      for y, h in [(5.15, 2.1), (10.60, 3.5), (18.50, 3.25)]:
        window(f, u, y, 1.55, h, y < 6)
    # A narrow stone band and independent small relief silhouettes. These
    # suggest the historic craft procession without tracing photographic art.
    band = min(18.4, length - 0.9)
    band_mid = f.left + band / 2 if index == 20 else f.right - band / 2
    f.member(band_mid, 14.95, band, 1.45, STONE, 0.15, 0.40)
    for y in [14.15, 15.75]:
      f.member(band_mid, y, band, 0.13, 0xAA9E82, 0.21, 0.44)
    for j in range(18):
      u = band_mid - band / 2 + 0.5 + j * (band - 1) / 17
      f.member(u, 15.28, 0.20, 0.23, 0xCABD9D, 0.16, 0.55)
      f.member(u + 0.04, 14.85, 0.24, 0.58, 0xC5B898, 0.15, 0.54)
      for dx in [-0.14, 0.14]:
        f.member(u + dx, 14.45, 0.105, 0.34, 0xCABD9D, 0.13, 0.52)
  elif index == 7:
    # The source facade has no geometric entry cutout. Represent a dark
    # recessed, gated portal on its wall; do not invent a walk-through hole.
    f.member(mid, 8.3, 5.9, 10.3, 0x72694F, 0.08, 0.30)
    for dx in [-2.05, 2.05]:
      f.member(mid + dx, 8.3, 0.70, 10.3, STONE, 0.55, 0.64)
    f.member(mid, 13.55, 6.35, 0.30, STONE, 0.52, 0.56)
    for u in np.arange(mid - 2.7, mid + 2.71, 0.28):
      f.member(float(u), 4.5, 0.055, 2.8, INK, 0.12, 0.73)
    for y in [3.22, 5.8]:
      f.member(mid, y, 5.5, 0.08, INK, 0.14, 0.73)
    for dx in [-2.55, 0, 2.55]:
      window(f, mid + dx, 18.5, 1.4, 3.25)
    f.member(mid, 14.95, length - 0.05, 1.45, STONE, 0.18, 0.40)
  else:
    # Palais: seven axes over its measured 6.21 + 12.30 + 6.21 m front.
    bays = 3 if index == 33 else 2
    for j in range(bays):
      u = f.left + (j + 0.5) * length / bays
      for y, h in [(6.0, 3.2), (12.6, 3.8), (19.0, 2.7)]:
        window(f, u, y, 1.8, h)
      # Baroque rounded window head and relief panel, kept below the roof.
      for k in range(9):
        theta = math.pi * k / 8
        f.member(
          u + 1.1 * math.cos(theta),
          14.7 + 0.55 * math.sin(theta),
          0.25,
          0.14,
          STONE,
          0.14,
          0.55,
        )
      f.member(u, 15.25, 0.54, 0.28, STONE, 0.20, 0.63)
    for y in np.arange(3.7, f.top - 0.8, 0.85):
      for u in [f.left + 0.30, f.right - 0.30]:
        f.member(u, float(y), 0.54, 0.48, STONE, 0.17, 0.37)
    if index == 33:
      # Two balconies are a primary-record fact. Small consoles are estimates.
      for u in [f.left + length / 6, f.left + length * 5 / 6]:
        f.member(u, 10.53, 2.6, 0.22, STONE, 0.90, 0.69)
        f.member(u, 11.03, 2.5, 0.75, 0xBCAD8D, 0.16, 1.1)
        for dx in [-0.72, 0.72]:
          f.member(u + dx, 10.1, 0.35, 0.55, STONE, 0.45, 0.65)


def existing_openings(f: Wall, raw: dict) -> list[tuple[float, float, float, float]]:
  """Project only positively receipted old apertures into the source plane."""
  result = []
  for q in raw["previousWindows"]:
    a = np.asarray(q)
    u = float(np.dot(a.mean(0) - f.a, f.d))
    result.append(
      (u, float(a[:, 1].mean()), float(np.ptp(a @ f.d)), float(np.ptp(a[:, 1])))
    )
  return result


def build(source: dict) -> tuple[dict, dict]:
  """Emit small independent drawn/native additions with immutable face audit."""
  groups = []
  for raw in source["faces"]:
    g = group(raw["name"], raw["owner"])
    f = Wall(g, raw["rings"], raw["normal"])
    mid, length = (f.left + f.right) / 2, f.right - f.left
    openings = existing_openings(f, raw)
    levels = sorted({round(p[1], 3) for p in openings})
    if raw["owner"] == MINT:
      mint(f, raw["surfaceIndex"])
    elif raw["owner"] in TOWERS:
      # Retain the source roof, old openings and all tower bodies. Shallow
      # balcony floor noses, light parapet panels and vertical dividers make
      # the long-side open-loggia hierarchy legible without a second skin.
      for y in levels:
        if y < f.base + 6:
          continue
        f.member(mid, y - 1.13, length - 0.15, 0.18, 0xD6D7CB, 0.70, 0.40)
        for u, yy, w, _ in openings:
          if abs(yy - y) < 0.01:
            blue_pair = raw["owner"] in {"DEBE01YYK0000EiI", "DEBE01YYK00002mi"}
            f.member(
              u,
              y - 0.82,
              w + 0.46,
              0.28 if blue_pair else 0.65,
              0x4D6A96 if blue_pair else 0xC8D1CB,
              0.13,
              0.72,
            )
      for u in sorted({round(o[0], 3) for o in openings}):
        f.member(
          u + 1.44,
          (f.base + 6 + f.top) / 2,
          0.17,
          f.top - f.base - 6.25,
          0xDDE0D3,
          0.58,
          0.40,
        )
      f.member(mid, f.base + 5.95, length - 0.15, 0.34, 0xA7A99D, 0.70, 0.4)
    elif raw["owner"] in PAVILIONS:
      # Official account: folded precast parapet over the two-storey shops.
      f.member(mid, f.top - 0.75, length - 0.1, 0.8, 0xD4D1BC, 0.22, 0.34)
      for u in np.arange(f.left + 0.65, f.right - 0.5, 1.25):
        f.member(float(u), f.top - 0.75, 0.13, 0.75, 0xA9A892, 0.25, 0.49)
      for u, y, w, h in openings:
        f.member(u, y + h / 2 + 0.22, w + 0.45, 0.14, PALE, 0.16, 0.23)
    else:
      # Westward urban houses: original apertures stay authoritative; this
      # is restrained window depth and masonry, not an invented new grid.
      for u, y, w, h in openings:
        f.member(u, y - h / 2 - 0.17, w + 0.50, 0.16, STONE, 0.23, 0.27)
        f.member(u - w / 2 - 0.11, y, 0.10, h + 0.13, PALE, 0.10, 0.22)
      for y in [f.top - 0.18, f.top - 0.51]:
        f.member(mid, y, length - 0.14, 0.14, STONE, 0.21, 0.29)
    groups.append(dict(**g, partId=raw["partId"], surfaceIndex=raw["surfaceIndex"]))
  palette = sorted(
    {int(r[-1]) for g in groups for k in ["boxes", "nativeRows"] for r in g[k]}
  )
  cells = defaultdict(lambda: {"drawn": [], "native": []})
  cell_ids = {c["cell"] for c in read(DATA / "altMitteEdgesV186.json")["cells"]}
  for g in groups:
    for kind, key in [("drawn", "boxes"), ("native", "nativeRows")]:
      for r in g[key]:
        cell = f"{math.floor(r[0] / 512)}:{math.floor(r[2] / 512)}"
        assert cell in cell_ids, cell
        row = [round(v * 1000) for v in r[:6]]
        if kind == "drawn":
          row.append(round(r[6] * 1_000_000))
        row.append(palette.index(int(r[-1])))
        cells[cell][kind].append(row)
  packed = dict(schemaVersion=1, palette=palette, cells=dict(sorted(cells.items())))
  evidence = dict(
    schemaVersion=1,
    policy=POLICY,
    sourceFaces=len(groups),
    ownerIds=sorted({g["owner"] for g in groups}),
    drawnRows=sum(len(g["boxes"]) for g in groups),
    nativeRows=sum(len(g["nativeRows"]) for g in groups),
    existingSpatialCells=sorted(cells),
    oldCellsReceipt=sha(DATA / "altMitteEdgesV186.json"),
    groups=groups,
    cameras=[
      {"name": "Alte Münze", "position": [2380, 48, 333], "target": [2482, 14, 416]},
      {
        "name": "Palais Schwerin",
        "position": [2470, 36, 295],
        "target": [2525, 14, 372],
      },
      {
        "name": "Leipziger towers",
        "position": [1460, 75, 830],
        "target": [1630, 38, 990],
      },
      {
        "name": "Leipziger western fronts",
        "position": [1020, 42, 875],
        "target": [1000, 18, 954],
      },
    ],
  )
  return packed, evidence


def main() -> None:
  """Rebuild only this finite overlay; no old asset or manifest is written."""
  source = extract()
  packed, evidence = build(source)
  (DATA / "leipzigerMuenzeV257.json").write_text(
    json.dumps(packed, separators=(",", ":")) + "\n"
  )
  for name, value in [("source", source), ("evidence", evidence)]:
    path = GEO / f"leipziger-muenze-v257-{name}.json.gz"
    path.write_bytes(
      gzip.compress(json.dumps(value, separators=(",", ":")).encode(), mtime=0)
    )
  print({k: v for k, v in evidence.items() if k not in {"policy", "groups"}})


if __name__ == "__main__":
  main()
