"""Exact two-leaf material correction; source and cap geometry remain byte exact."""

import base64
import hashlib
import json
import math
from collections import Counter
from typing import Any, Callable

import numpy as np
import shapely
from shapely.geometry import Polygon

MATERIALS = {
  "DEBE3DMi3WPKjJTh": dict(
    site="rathaus",
    before=0xA45F47,
    after=0x8A9190,
    description="DOP2025 gray flat roof of the modern Donaustraße annex",
  ),
  "DEBE3DSzE6HSwLls": dict(
    site="arcaden",
    before=0x737D7B,
    after=0x8B8269,
    description="DOP2025 brown-olive appearance of the large upper roof field; substrate/vegetation type and exact shade remain estimates",
  ),
}
ROOF_MATERIAL_REFERENCES_V305 = {
  "authority": "Geoportal Berlin DOP2025, dl-de/zero-2-0",
  "url": "https://gdi.berlin.de/services/wms/dop_2025_fruehjahr",
  "layer": "dop_2025",
  "checked": "2026-11-02",
  "use": "Reference-only RGB/material correction; all80 source leaves reviewed; only2 definite leaf-roof colour errors corrected. Other78 leaves and all facades retain their explicitly estimated paint. No pixels redistributed.",
  "requests": [
    {
      "site": "rathaus",
      "bboxEPSG25833": [393690, 5815680, 393900, 5815820],
      "imageSha256": "4558e0b7aa4bf388d2019da5c73f2946d599a9570dd7007d87c57fc3dffc78e4",
    },
    {
      "site": "arcaden",
      "bboxEPSG25833": [393420, 5815750, 393650, 5815890],
      "imageSha256": "74418a835ebf9a8f25d4bd236d8d6b6f45a520c45b444e3656d660ee981b2783",
    },
  ],
}


def sha(b: bytes) -> str:
  return hashlib.sha256(b).hexdigest()


def key(t: Any) -> tuple:
  return tuple(sorted(tuple(map(float, np.asarray(p, dtype="<f4"))) for p in t))


def linear(tone: int) -> list[int]:
  return [
    round(
      (v / 255 / 12.92 if v <= 10.31475 else ((v / 255 + 0.055) / 1.055) ** 2.4) * 255
    )
    for v in [(tone >> 16) & 255, (tone >> 8) & 255, tone & 255]
  ]


def apply_roof_materials_v305(
  model: dict[str, Any],
  profile: dict[str, Any],
  roof_heights: Callable[[list[list[list[float]]], np.ndarray, np.ndarray], np.ndarray],
) -> dict[str, Any]:
  before_model = sha(
    (json.dumps(model, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
  )
  if before_model != "e18298356b756bbbe9b0360d65547b694bf5fc4763ad7d6f7eb0c1a2f677a995":
    raise ValueError("Unexpected frozen v305 complete model predecessor")
  positions = np.frombuffer(
    base64.b64decode(model["drawn"]["positions"]), "<f4"
  ).reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(model["drawn"]["indices"]), "<u4").reshape(
    -1, 3
  )
  before = base64.b64decode(model["drawn"]["colors"])
  colors = np.frombuffer(before, dtype="u1").copy().reshape(-1, 3)
  old_native = json.loads(json.dumps(model["nativeBoxes"]))
  target_vertices = set()
  target_native = set()
  audit = []
  for identity, material in MATERIALS.items():
    part = next(p for p in profile["navigation"] if p["id"] == identity)
    wanted = Counter(key(t) for t in part["roofTriangles"] if len(set(key(t))) == 3)
    triangles = []
    for i, t in enumerate(indices):
      k = key(positions[t])
      if wanted[k]:
        triangles.append(i)
        wanted[k] -= 1
    if sum(wanted.values()):
      raise ValueError("Missing exact source roof triangles")
    owned = {int(v) for i in triangles for v in indices[i]}
    shared = {
      int(v) for i, t in enumerate(indices) if i not in set(triangles) for v in t
    } & owned
    if shared:
      raise ValueError(
        f"{identity}: roof vertices shared with an outside triangle: {sorted(shared)}"
      )
    if any(list(colors[i]) != linear(material["before"]) for i in owned):
      raise ValueError("Original roof paint differs")
    for i in owned:
      colors[i] = linear(material["after"])
    target_vertices.update(owned)
    g = Polygon(part["ring"], part["holes"])
    rows = []
    mixed = []
    for i, r in enumerate(model["nativeBoxes"]):
      x, y, z, w, h, d, yaw, tone = r
      if (
        abs(h - 0.05) > 1e-9
        or abs(d - 0.5) > 1e-9
        or yaw != 0
        or tone != material["before"]
      ):
        continue
      count = round(w / 0.5)
      if count <= 0 or abs(count * 0.5 - w) > 1e-6:
        raise ValueError("Unexpected native cap run")
      xs = x - w / 2 + (np.arange(count) + 0.5) * 0.5
      zs = np.full(count, z)
      inside = shapely.contains_xy(g, xs, zs)
      if not inside.any():
        continue
      tops = roof_heights(part["roofTriangles"], xs, zs)
      quantized = np.full(count, -math.inf)
      good = np.isfinite(tops)
      quantized[good] = np.ceil(tops[good] / 0.5) * 0.5
      winning = inside & (np.abs(quantized - (y - 0.025)) < 1e-6)
      if not winning.any():
        continue
      if not winning.all():
        mixed.append(i)
        continue
      r[7] = material["after"]
      rows.append(i)
      target_native.add(i)
    if mixed:
      raise ValueError(
        f"{identity}: mixed winning native cap runs cannot be repainted without changing geometry: {mixed}"
      )
    if not rows:
      raise ValueError("No matching winning native caps")
    audit.append(
      dict(
        part=identity,
        **material,
        drawnTriangles=triangles,
        drawnVertices=sorted(owned),
        nativeCaps=rows,
      )
    )
  model["drawn"]["colors"] = base64.b64encode(colors.tobytes()).decode()
  outside = bytes(
    int(v) for i, row in enumerate(colors) if i not in target_vertices for v in row
  )
  outside_before = bytes(
    v
    for i in range(len(colors))
    if i not in target_vertices
    for v in before[i * 3 : i * 3 + 3]
  )
  if outside != outside_before:
    raise ValueError("Outside vertex paint changed")
  if any(a[:7] != b[:7] for a, b in zip(old_native, model["nativeBoxes"], strict=True)):
    raise ValueError("Native geometry changed")
  if any(
    a != b
    for i, (a, b) in enumerate(zip(old_native, model["nativeBoxes"], strict=True))
    if i not in target_native
  ):
    raise ValueError("Outside native paint changed")
  return dict(
    schemaVersion=1,
    beforeModelSha256=before_model,
    references=ROOF_MATERIAL_REFERENCES_V305,
    scope="Two exact leaf roofs; only RGB values and winning existing native-cap tints change",
    sourcePositionsSha256=sha(base64.b64decode(model["drawn"]["positions"])),
    sourceIndicesSha256=sha(base64.b64decode(model["drawn"]["indices"])),
    outsidePaintSha256=sha(outside),
    beforePaintSha256=sha(before),
    afterPaintSha256=sha(colors.tobytes()),
    nativeGeometrySha256=sha(
      json.dumps([r[:7] for r in model["nativeBoxes"]], separators=(",", ":")).encode()
    ),
    beforeNativePaintSha256=sha(
      json.dumps([r[7] for r in old_native], separators=(",", ":")).encode()
    ),
    afterNativePaintSha256=sha(
      json.dumps([r[7] for r in model["nativeBoxes"]], separators=(",", ":")).encode()
    ),
    targets=audit,
  )
