"""Torstraße: source-bound glazing, physical jambs and existing shopfront profiles.

The exact v239 opening/parent receipts are reused. No new window distribution,
wall repaint, roof, door or street geometry is inferred. Shared files are read-only.
"""

from __future__ import annotations

import base64
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np
import shapely
from build_karl_marx_allee_v161 import Detail, packed_detail
from build_north_mitte_fronts_v239 import panel
from build_stadthaus_v239 import read, sha, write
from build_west_streets_v163 import partition_detail
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
OUT = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
OLD_SOURCE = GEO / "north-mitte-fronts-v239-source.json.gz"
OLD_ADDITION = GEO / "north-mitte-fronts-v239-manifest-addition.json"
SOURCE = GEO / "tor-fronts-v244-source.json.gz"
ADDITION = GEO / "tor-fronts-v244-manifest-addition.json"
EVIDENCE = GEO / "tor-fronts-v244-evidence.json"
POLICY = (
  "Refine only the 1999 exact delivered Torstraße opening receipts on 77 existing "
  "parents, including 220 already-modelled shopfront panes. Add recessed divided "
  "glass, shallow three-dimensional jambs and sill returns, and shopfront lower "
  "panels. Preserve original central mullions, v239 upper reflections, all authored "
  "heads/sills, complete walls, measured roofs/courts and navigation. No new "
  "window/entrance distribution or whole-wall repaint. Material tones and small "
  "fitting dimensions are display estimates, not individual building surveys. "
  "Full drawn mobile geometry and independently orthogonal native geometry share "
  "existing cancellable packet lifetime and unchanged runtime limits."
)
GLASS_UPPER = (132, 155, 157)
GLASS_LOWER = (107, 133, 136)
SHOP_GLASS_UPPER = (141, 160, 157)
SHOP_GLASS_LOWER = (160, 157, 138)
FRAME = (215, 211, 194)
JAMB = (207, 199, 180)
JAMB_SIDE = (163, 157, 143)
SHOP_BASE = (179, 169, 148)


def extract() -> dict[str, Any]:
  """Take the existing finite, triangle-verified street selection verbatim."""
  old = read(OLD_SOURCE)
  panes = [w for w in old["windows"] if w["road"] == "Torstraße"]
  assert len(panes) == 1999 and len({w["owner"] for w in panes}) == 77
  receipts = dict(old["packetReceipts"])
  for d in read(OLD_ADDITION)["chunks"]:
    for mode in ("drawn", "minecraft"):
      p = OUT / d[mode]["url"]
      assert sha(p) == d[mode]["sha256"]
      receipts[str(p.relative_to(ROOT))] = sha(p)
  result = dict(
    schemaVersion=1,
    policy=POLICY,
    windows=panes,
    roads=[r for r in old["roads"] if r["name"] == "Torstraße"],
    sourceHashes={
      **old["sourceHashes"],
      str(OLD_SOURCE.relative_to(ROOT)): sha(OLD_SOURCE),
      str(OLD_ADDITION.relative_to(ROOT)): sha(OLD_ADDITION),
    },
    unchangedPackets=receipts,
    excludedOwners=old["excludedOwners"],
    namedSitesReviewed=[
      dict(
        name="Torstraße 138",
        owner="DEBE01YYK00007I6",
        osmWay="386915734",
        reference="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080095",
        decision="No exact v239 opening receipts; retained historical detail is not changed.",
      ),
      dict(
        name="Königliches Leihamt, Torstraße 164",
        reference="https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080101",
        decision="No unambiguous retained parent binding established; no guessed reconstruction.",
      ),
    ],
    licences=old["licences"],
  )
  write(SOURCE, result)
  return result


def wall_clip(w: dict) -> Any:
  """Project the complete original wall and its holes into the opening frame."""
  center, t = np.array(w["center"]), np.array(w["tangent"])
  rings = [
    [
      (float(np.dot(np.array(q) - center, t)), q[1] + w["terrainOffsetY"] - center[1])
      for q in ring
    ]
    for ring in w["sourceWall"]
  ]
  return shapely.make_valid(Polygon(rings[0], rings[1:])).buffer(1e-7)


def profile(
  detail: Detail,
  center: np.ndarray,
  t: np.ndarray,
  n: np.ndarray,
  width: float,
  height: float,
  depth: float,
  native: bool,
  role: str,
) -> None:
  """One physical open-backed profile; native independently uses box steps."""
  if native:
    count = max(1, math.ceil(width / 0.42))
    for i in range(count):
      p = center + t * ((i + 0.5) * width / count - width / 2)
      size = [
        abs(t[0]) * width / count + abs(n[0]) * depth,
        height,
        abs(t[2]) * width / count + abs(n[2]) * depth,
      ]
      detail.box(p.tolist(), size, JAMB, role)
    return
  corners = [
    (center + t * u + n * out + [0, y, 0]).tolist()
    for out in (-depth / 2, depth / 2)
    for u, y in [
      (-width / 2, -height / 2),
      (width / 2, -height / 2),
      (width / 2, height / 2),
      (-width / 2, height / 2),
    ]
  ]
  # No back face: it is hidden against the retained wall/surround. Distinct
  # side light makes the actual shallow depth legible, without more wall layers.
  for ids in [(4, 5, 6, 7), (0, 4, 7, 3), (1, 2, 6, 5), (3, 7, 6, 2), (0, 1, 5, 4)]:
    detail.polygon(
      [corners[i] for i in ids], JAMB if ids == (4, 5, 6, 7) else JAMB_SIDE, role
    )


def opening(detail: Detail, w: dict, native: bool) -> None:
  """Every feature follows this existing opening; never introduces another bay."""
  center, t, n = (np.array(w[k]) for k in ("center", "tangent", "normal"))
  width, height = w["width"], w["height"]
  shop = w["role"] == "shopfront glazing"
  clip = wall_clip(w)
  # The drawn glass sits behind the original 25/30mm central mullion. The
  # native construction has its own orthogonal v239 front (+.95m), not a
  # diagonal drawn sheet or a hidden full voxel rebuild.
  surface = center + n * (0.012 + (0.95 if native else 0))
  gap = 0.14 if shop else 0.12
  pane_width = (width - gap) / 2 - 0.025
  for sign in (-1, 1):
    x = sign * (gap / 2 + pane_width / 2)
    for low, high, tone, role in [
      (
        -height * 0.48,
        height * 0.10,
        SHOP_GLASS_LOWER if shop else GLASS_LOWER,
        "recessed-lower-glass",
      ),
      (
        height * 0.10,
        height * 0.48,
        SHOP_GLASS_UPPER if shop else GLASS_UPPER,
        "recessed-upper-glass",
      ),
    ]:
      panel(
        detail,
        surface + t * x + [0, (low + high) / 2, 0],
        t,
        n,
        pane_width,
        high - low,
        tone,
        native,
        role,
      )
    # A slim crossbar subdivides the existing tall pane, leaving the original
    # central mullion and both v239 high reflections completely intact.
    panel(
      detail,
      surface + n * 0.015 + t * x + [0, height * 0.10, 0],
      t,
      n,
      pane_width,
      0.045,
      FRAME,
      native,
      "existing-pane-transom",
    )
    if shop:
      # The lower panel remains wholly within the existing shopfront glazing.
      # No shop name, display content, new door or doorway is invented.
      panel(
        detail,
        surface + n * 0.018 + t * x + [0, -height * 0.405, 0],
        t,
        n,
        pane_width,
        height * 0.12,
        SHOP_BASE,
        native,
        "existing-shopfront-base-panel",
      )
  fittings = [
    (-width / 2 - 0.065, 0, 0.075, height + 0.08, "existing-left-jamb-depth"),
    (width / 2 + 0.065, 0, 0.075, height + 0.08, "existing-right-jamb-depth"),
    (0, -height / 2 - 0.085, width + 0.19, 0.10, "existing-sill-return-depth"),
  ]
  for x, y, sx, sy, role in fittings:
    if not clip.covers(box(x - sx / 2, y - sy / 2, x + sx / 2, y + sy / 2)):
      continue
    p = center + t * x + [0, y, 0] + n * (0.045 + (0.95 if native else 0))
    profile(detail, p, t, n, sx, sy, 0.065, native, role)


def models(source: dict[str, Any]) -> dict[str, Detail]:
  details = {mode: Detail() for mode in ("drawn", "minecraft")}
  for w in source["windows"]:
    assert w["road"] == "Torstraße" and len(w["triangles"]) == 2
    for mode, detail in details.items():
      opening(detail, w, mode == "minecraft")
  return details


def build() -> None:
  source = read(SOURCE) if SOURCE.exists() else extract()
  # Fail closed before writing anything when the retained supporting source or
  # any original/v239 geometry packet changed underneath this finite revision.
  for path, expected in {
    **source["sourceHashes"],
    **source["unchangedPackets"],
  }.items():
    assert sha(ROOT / path) == expected, path
  details = models(source)
  partitions = {mode: partition_detail(detail) for mode, detail in details.items()}
  descriptors, counts = [], {}
  for cell in sorted(set().union(*(set(p) for p in partitions.values()))):
    ix, iz = cell
    ident = f"torfront244-{ix}_{iz}"
    bounds = [ix * 512, iz * 512, (ix + 1) * 512, (iz + 1) * 512]
    desc = dict(id=ident, bounds=bounds)
    for mode in details:
      mesh = packed_detail(partitions[mode].get(cell, Detail()), box(*bounds))
      assert mesh is not None
      mesh["kind"] = "tor-fronts-v244"
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
      version="1.0.144",
      chunks=descriptors,
      source=dict(sourceSha256=sha(SOURCE), policy=POLICY),
    ),
  )
  result = dict(
    schemaVersion=1,
    policy=POLICY,
    sourceSha256=sha(SOURCE),
    additionSha256=sha(ADDITION),
    panes=len(source["windows"]),
    owners=len({w["owner"] for w in source["windows"]}),
    byOpeningRole=dict(Counter(w["role"] for w in source["windows"])),
    roles={
      mode: dict(Counter(role for _, _, role in d.triangles))
      for mode, d in details.items()
    },
    packetCounts=counts,
    unchangedPackets=source["unchangedPackets"],
    sourceHashes=source["sourceHashes"],
    limitations=[
      "Existing source openings are earlier display estimates, not a new window survey.",
      "Neither Tor138 nor Tor164 receives guessed architectural replacement.",
      "Small profile dimensions and glass/interior tones are restrained display estimates.",
    ],
  )
  write(EVIDENCE, result)
  print(
    json.dumps(
      dict(
        panes=result["panes"],
        owners=result["owners"],
        shops=result["byOpeningRole"]["shopfront glazing"],
        packets=len(descriptors),
        compressed=sum(d[m]["bytes"] for d in descriptors for m in details),
        gpuBytesByMode={
          m: sum(v["gpuBytes"] for k, v in counts.items() if k.startswith(m + ":"))
          for m in details
        },
      ),
      indent=2,
    )
  )


if __name__ == "__main__":
  build()
