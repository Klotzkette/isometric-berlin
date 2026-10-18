"""Step 10: finite north-Mitte street fronts, using verified existing panes only.

Every ordinary opening is reproduced from its original source recipe and matched
against both exact delivered triangles before adding detail. No shell is changed.
"""

from __future__ import annotations

import base64
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from build_alt_mitte_v169 import facade as old_facade
from build_alt_mitte_v169 import footprint
from build_concert_halls_v160 import normal_of
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_stadthaus_v239 import read, sha, write
from build_west_streets_v163 import facade as street_facade
from build_west_streets_v163 import partition_detail
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import nearest_points, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
SOURCE = GEO / "north-mitte-fronts-v239-source.json.gz"
EVIDENCE = GEO / "north-mitte-fronts-v239-evidence.json"
ADDITION = GEO / "north-mitte-fronts-v239-manifest-addition.json"
NAMES = {
  "Torstraße",
  "Linienstraße",
  "Koppenplatz",
  "Gipsstraße",
  "Steinstraße",
  "Fehrbelliner Straße",
  "Veteranenstraße",
  "Choriner Straße",
  "Zehdenicker Straße",
}
EXCLUDED = {
  "DEBE01YYK00004EC",
  "DEBE01YYK0000C4T",
  "DEBE01YYK00001R6",
  "DEBE01YYK0000CJs",
  "DEBE01YYK000005AW",
  "DEBE01YYK00000DK5",
  "DEBE01YYK00000Ddl",
  "DEBE01YYK0000088B",
  "DEBE00YY1HJ000Bw",
}
KINDS = {"mitte-street-fronts-v166", "scheunenviertel-v168", "alt-mitte-v169"}
POLICY = "Add shallow framing and split glazing reflections only to existing source-bound openings along the named mapped streets. Each ordinary opening matches both original delivered triangles; no new window grid, shell, roof, terrain, street or navigation is generated. Existing authored detail is retained. All dimensions/material colors beyond original source planes are display estimates; drawn mobile detail is complete, native geometry independently orthogonal and existing residency limits unchanged."


def tri_key(triangle: Any) -> bytes:
  """Orientation-independent centimetre geometry receipt, independent of colour."""
  a = np.rint(np.asarray(triangle) * 100).astype("<i4")
  return hashlib.blake2s(
    b"".join(sorted(q.tobytes() for q in a)), digest_size=16
  ).digest()


def current_triangles(zone: Any) -> tuple[set[bytes], dict[str, str]]:
  """Read only intersecting immutable packets and relevant old detail families."""
  keys, receipts = set(), {}
  for desc in read(OUT / "manifest.json")["chunks"]:
    if not box(*desc["bounds"]).intersects(zone):
      continue
    path = OUT / desc["drawn"]["url"]
    data = read(path)
    selected = [m for m in data["meshes"] if m["kind"] in KINDS]
    if not selected:
      continue
    receipts[str(path.relative_to(ROOT))] = sha(path)
    for mesh in selected:
      ps = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
        -1, 3
      ).astype(float) / 100 + np.asarray(data["origin"])
      ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      for tri in ps[ix]:
        keys.add(tri_key(tri))
  return keys, receipts


def extract() -> dict[str, Any]:
  """Freeze exact matched old panes and their finite street/parent provenance."""
  road_path = GEO / "alt-mitte-edges-v186-streets.json"
  # Choriner is limited to the already requested junction/block, not its full
  # course into a different neighbourhood. All other named routes are retained.
  roads = []
  for r in read(road_path)["roads"]:
    if r["name"] not in NAMES:
      continue
    line = shape(r["geometry"])
    if r["name"] == "Choriner Straße":
      line = line.intersection(box(2000, -1575, 2650, -1100))
    if not line.is_empty:
      roads.append({**r, "geometry": mapping(line)})
  lines = unary_union([shape(r["geometry"]) for r in roads])
  zone = lines.buffer(28)
  hashes = {str(road_path.relative_to(ROOT)): sha(road_path)}
  offset_path = ROOT / "src/app/src/data/weinbergBuildingOffsetsV176.json"
  offsets = read(offset_path)["offsets"]
  hashes[str(offset_path.relative_to(ROOT))] = sha(offset_path)
  old_sources = []
  for name in ["mitte-streets-v166", "scheunenviertel-v168"]:
    path = GEO / (name + ".json")
    old_sources.append((name, read(path)))
    hashes[str(path.relative_to(ROOT))] = sha(path)
  records = []
  for path in sorted((GEO / "alt-mitte-v169").glob("source-*.json.gz")):
    rows = read(path)["buildings"]
    if any(footprint(b).intersects(zone) for b in rows):
      records.extend(rows)
      hashes[str(path.relative_to(ROOT))] = sha(path)
  occupied = unary_union([footprint(b) for b in records])
  shapely.prepare(occupied)
  keys, packet_receipts = current_triangles(zone)
  windows, seen = [], set()
  rejected = Counter()

  def accept(
    detail: Detail,
    normal: Any,
    owner: str,
    family: str,
    source_file: str,
    surface: dict,
    offset: float,
  ) -> None:
    n = np.asarray(normal)
    if not np.isfinite(n).all() or abs(n[1]) > 0.05:
      return
    ts = detail.triangles
    for i in range(0, len(ts) - 1):
      if (
        ts[i][2] not in {"window glazing", "shopfront glazing"}
        or ts[i + 1][2] != ts[i][2]
      ):
        continue
      # The original polygon fan is two triangles sharing vertex 0 and the
      # diagonal. Only its first triangle starts one complete rectangular pane.
      a, b = ts[i][0], ts[i + 1][0]
      if a[0] != b[0] or a[2] != b[1]:
        continue
      quad = np.array([a[0], a[1], a[2], b[2]], dtype=float)
      center = quad.mean(axis=0)
      nearest = nearest_points(Point(center[0], center[2]), lines)[1]
      toward = np.array([nearest.x - center[0], 0, nearest.y - center[2]])
      distance = np.linalg.norm(toward)
      if distance > 26 or distance < 0.1 or np.dot(toward, n) / distance < 0.55:
        continue
      ray = LineString(
        [(center[0] + n[0] * 0.35, center[2] + n[2] * 0.35), (nearest.x, nearest.y)]
      )
      if occupied.intersection(ray).length > 0.7:
        continue
      shifted = quad + [0, offset, 0]
      triangles = [
        [shifted[0], shifted[1], shifted[2]],
        [shifted[0], shifted[2], shifted[3]],
      ]
      if not all(tri_key(t) in keys for t in triangles):
        # Some older source packets keep unshifted geometry and apply the
        # registered rigid parent transform later. The old geometry still
        # needs an exact receipt, while the new detail uses the displayed y.
        raw = [[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]
        if not all(tri_key(t) in keys for t in raw):
          rejected[family] += 1
          continue
        receipts = [tri_key(t).hex() for t in raw]
        receipt_offset = 0
      else:
        receipts = [tri_key(t).hex() for t in triangles]
        receipt_offset = offset
      center = shifted.mean(axis=0)
      tangent = np.array([n[2], 0, -n[0]])
      width = float(np.ptp(shifted @ tangent))
      height = float(np.ptp(shifted[:, 1]))
      key = tuple(np.rint(center * 100).astype(int)) + (
        round(width * 100),
        round(height * 100),
      )
      if key in seen:
        continue
      seen.add(key)
      road = min(
        roads, key=lambda r: shape(r["geometry"]).distance(Point(center[0], center[2]))
      )
      windows.append(
        dict(
          owner=owner,
          family=family,
          sourceFile=source_file,
          role=ts[i][2],
          center=center.tolist(),
          normal=n.tolist(),
          tangent=tangent.tolist(),
          width=width,
          height=height,
          quad=quad.tolist(),
          terrainOffsetY=offset,
          receiptOffsetY=receipt_offset,
          triangles=receipts,
          road=road["name"],
          roadId=road["id"],
          sourceWall=surface["rings"],
        )
      )

  for family, source in old_sources:
    original_roads = unary_union([shape(r["geometry"]) for r in source["roads"]])
    for b in source["buildings"] + source.get("retainedDetailedBuildings", []):
      if b["id"] in EXCLUDED:
        continue
      for part in b["parts"]:
        points = [p for s in part["surfaces"] for r in s["rings"] for p in r]
        if not points:
          continue
        top = max(q[1] for q in points)
        for surface in part["surfaces"]:
          if surface["kind"] != "WallSurface":
            continue
          center = np.mean(surface["rings"][0], axis=0)
          if lines.distance(Point(center[0], center[2])) > 35:
            continue
          detail = Detail()
          street_facade(detail, surface["rings"], original_roads, 3, top)
          accept(
            detail,
            normal_of(surface["rings"][0]),
            b["id"],
            family,
            "geo_data/regierungsviertel/" + family + ".json",
            surface,
            offsets.get(b["id"], 0),
          )
  for b in records:
    if (
      b["category"] == "retained"
      or b["id"] in EXCLUDED
      or not footprint(b).intersects(zone)
    ):
      continue
    for part in b["parts"]:
      ground = min(
        (
          p[1]
          for s in part["surfaces"]
          if s["kind"] == "GroundSurface"
          for r in s["rings"]
          for p in r
        ),
        default=part["groundY"],
      )
      for surface in part["surfaces"]:
        if surface["kind"] != "WallSurface":
          continue
        center = np.mean(surface["rings"][0], axis=0)
        if lines.distance(Point(center[0], center[2])) > 35:
          continue
        detail = old_facade(surface["rings"], ground, part["topY"], occupied)
        accept(
          detail,
          normal_of(surface["rings"][0]),
          b["id"],
          "alt-mitte-v169",
          b["tile"],
          surface,
          offsets.get(b["id"], 0),
        )
  # The prior explicit Choriner owner uses a different register. Replay that
  # register verbatim, keeping the complete v185/v230 masonry and roof work.
  northpath = ROOT / "src/app/src/data/northV185.json"
  hashes[str(northpath.relative_to(ROOT))] = sha(northpath)
  choriner = []
  for f in read(northpath)["faces"]:
    if f["kind"] != "choriner":
      continue
    a, b = np.array(f["a"]), np.array(f["b"])
    length = float(np.linalg.norm(b - a))
    t = (b - a) / length
    n = np.array(f["normal"])
    baseline = 3 + offsets[f["id"]]
    ground = baseline + f["wallBottom"]
    top = baseline + f["wallTop"]
    floors = min(7, max(1, math.floor((top - ground - 1) / 3.65)))
    pitch_y = (top - ground - 1.5) / floors
    bays = max(1, math.floor(length / 3.7))
    pitch = length / bays
    for level in range(floors):
      y = ground + 1.85 + level * pitch_y
      if y + 1.15 >= top - 0.8:
        continue
      for bay in range(bays):
        u = (bay + 0.5) * pitch
        q = a + t * u + n * 0.29
        choriner.append(
          dict(
            owner=f["id"],
            family="north-v185",
            center=[q[0], y, q[1]],
            normal=[n[0], 0, n[1]],
            tangent=[t[0], 0, t[1]],
            width=min(2.1, pitch * 0.48),
            height=min(2, pitch_y * 0.58),
            road="Choriner Höfe",
            roadId="source-v185",
            nativeAdditionalOffset=1.05,
          )
        )
  result = dict(
    schemaVersion=1,
    policy=POLICY,
    roads=roads,
    windows=windows,
    choriner=choriner,
    sourceHashes=hashes,
    packetReceipts=packet_receipts,
    excludedOwners=sorted(EXCLUDED),
    unmatchedCandidatePanes=dict(rejected),
    references=[
      "https://www.haas-architekten.de/projekte/wohnbauten/choriner-hoefe",
      "https://www.collignonarchitektur.com/de/projekte/choriner-hoefe",
    ],
    licences=[
      "Geoportal Berlin: dl-de/zero-2-0",
      "OpenStreetMap contributors: ODbL-1.0",
    ],
  )
  write(SOURCE, result)
  return result


def panel(
  detail: Detail,
  p: np.ndarray,
  t: np.ndarray,
  n: np.ndarray,
  width: float,
  height: float,
  color: tuple[int, ...],
  native: bool,
  role: str,
) -> None:
  """Drawn rectangle, independently stepped orthogonal native rectangles."""
  if not native:
    detail.polygon(
      [
        (p + t * u + [0, dy, 0]).tolist()
        for u, dy in [
          (-width / 2, -height / 2),
          (width / 2, -height / 2),
          (width / 2, height / 2),
          (-width / 2, height / 2),
        ]
      ],
      color,
      role,
    )
    return
  count = max(1, math.ceil(width / 0.42))
  for i in range(count):
    u = (i + 0.5) * width / count - width / 2
    q = p + t * u
    # A native step has two perpendicular exposed faces and never a diagonal.
    sx = max(0.045, abs(t[0]) * width / count)
    sz = max(0.045, abs(t[2]) * width / count)
    detail.polygon(
      [
        [q[0] - sx / 2, q[1] - height / 2, q[2]],
        [q[0] + sx / 2, q[1] - height / 2, q[2]],
        [q[0] + sx / 2, q[1] + height / 2, q[2]],
        [q[0] - sx / 2, q[1] + height / 2, q[2]],
      ],
      color,
      role,
    )
    detail.polygon(
      [
        [q[0], q[1] - height / 2, q[2] - sz / 2],
        [q[0], q[1] - height / 2, q[2] + sz / 2],
        [q[0], q[1] + height / 2, q[2] + sz / 2],
        [q[0], q[1] + height / 2, q[2] - sz / 2],
      ],
      color,
      role,
    )


def models(source: dict[str, Any]) -> dict[str, Detail]:
  """Shallow fittings retain existing central mullions and most pane area."""
  details = {m: Detail() for m in ["drawn", "minecraft"]}
  for w in source["windows"] + source["choriner"]:
    center, t, n = np.array(w["center"]), np.array(w["tangent"]), np.array(w["normal"])
    width, height = w["width"], w["height"]
    clip = None
    if "sourceWall" in w:
      rings = [
        [
          (
            float(np.dot(np.array(q) - center, t)),
            q[1] + w["terrainOffsetY"] - center[1],
          )
          for q in r
        ]
        for r in w["sourceWall"]
      ]
      clip = shapely.make_valid(Polygon(rings[0], rings[1:])).buffer(1e-7)
    for mode, d in details.items():
      native = mode == "minecraft"
      p = center + n * (0.09 + (w.get("nativeAdditionalOffset", 0.95) if native else 0))
      # Split glazing respects the original central mullion. A limited upper
      # reflection makes glazing readable without repainting the whole pane.
      for side in [-1, 1]:
        panel(
          d,
          p + t * side * width * 0.265 + [0, height * 0.21, 0],
          t,
          n,
          width * 0.37,
          height * 0.30,
          (141, 163, 160),
          native,
          "split-upper-glazing-reflection",
        )
      panel(
        d,
        p + t * (-width * 0.44),
        t,
        n,
        0.055,
        height * 0.83,
        (188, 201, 187),
        native,
        "existing-opening-side-reveal",
      )
      if clip is None or clip.covers(
        box(
          -(width + 0.26) / 2, height / 2 + 0.06, (width + 0.26) / 2, height / 2 + 0.16
        )
      ):
        panel(
          d,
          p + [0, height / 2 + 0.11, 0],
          t,
          n,
          width + 0.26,
          0.10,
          (213, 205, 184),
          native,
          "existing-opening-stone-head",
        )
      if clip is None or clip.covers(
        box(
          -(width + 0.30) / 2,
          -height / 2 - 0.135,
          (width + 0.30) / 2,
          -height / 2 - 0.025,
        )
      ):
        panel(
          d,
          p + [0, -height / 2 - 0.08, 0],
          t,
          n,
          width + 0.30,
          0.11,
          (203, 194, 172),
          native,
          "existing-opening-sill",
        )
  return details


def build() -> None:
  """Write bounded companion packets only; original packets remain byte-exact."""
  source = read(SOURCE) if SOURCE.exists() else extract()
  details = models(source)
  partitions = {m: partition_detail(d) for m, d in details.items()}
  descriptors = []
  counts = {}
  for cell in sorted(set().union(*(set(p) for p in partitions.values()))):
    ix, iz = cell
    ident = f"northfront239-{ix}_{iz}"
    bounds = [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512]
    desc = dict(id=ident, bounds=bounds)
    for mode in details:
      mesh = packed_detail(partitions[mode].get(cell, Detail()), box(*bounds))
      mesh["kind"] = "north-mitte-fronts-v239"
      payload = dict(
        schemaVersion=1,
        id=ident,
        origin=[ix * 512, -10, iz * 512],
        meshes=[mesh],
        nav=dict(groundY=3, ground=[], water=[], buildings=[]),
      )
      path = OUT / f"{ident}.{mode}.json.gz"
      write(path, payload)
      raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
      desc[mode] = dict(
        url=path.name,
        encoding="gzip",
        bytes=path.stat().st_size,
        decodedBytes=len(raw) + 1,
        sha256=sha(path),
      )
      nv = len(base64.b64decode(mesh["positions"])) // 6
      ni = len(base64.b64decode(mesh["indices"])) // 4
      counts[f"{mode}:{ident}"] = dict(
        vertices=nv,
        triangles=ni // 3,
        gpuBytes=nv * 12 + ni * (2 if nv <= 65535 else 4),
      )
    descriptors.append(desc)
  write(
    ADDITION,
    dict(
      schemaVersion=1,
      version="1.0.139",
      chunks=descriptors,
      source=dict(sourceSha256=sha(SOURCE), policy=POLICY),
    ),
  )
  write(
    EVIDENCE,
    dict(
      schemaVersion=1,
      policy=POLICY,
      sourceSha256=sha(SOURCE),
      additionSha256=sha(ADDITION),
      verifiedOrdinaryPanes=len(source["windows"]),
      chorinerPanes=len(source["choriner"]),
      owners=len({w["owner"] for w in source["windows"]}),
      byStreet=dict(Counter(w["road"] for w in source["windows"])),
      byFamily=dict(Counter(w["family"] for w in source["windows"])),
      packetCounts=counts,
      sourceHashes=source["sourceHashes"],
      unchangedPackets=source["packetReceipts"],
      limitations=[
        "Material hues, reflection bands, reveal widths and sill subdivisions are procedural estimates; no individual facade survey.",
        "Both exact delivered triangles must match for each ordinary pane; unmatched candidates are skipped with counts retained.",
        "Choriner follows its distinct v185 register and preserves v230 stone joints/roof edges; no building height or roof is invented.",
      ],
    ),
  )
  print(
    json.dumps(
      dict(
        panes=len(source["windows"]),
        choriner=len(source["choriner"]),
        owners=len({w["owner"] for w in source["windows"]}),
        byStreet=dict(Counter(w["road"] for w in source["windows"])),
        packets=len(descriptors),
        compressed=sum(d[m]["bytes"] for d in descriptors for m in details),
      ),
      indent=2,
    )
  )


if __name__ == "__main__":
  build()
