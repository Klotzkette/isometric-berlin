"""Compile finite, source-contained Wilhelm-quarter joinery; never change a body.

The complete official input is retained as compressed evidence. Only actual
selected wall polygons and small estimated fitting boxes enter the viewer.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import math
import struct
import subprocess
from pathlib import Path
from typing import Any

from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

PREFIX = "DEBE01YYK000"
HISTORICAL = (
  "0DBg",
  "0CFo",
  "0FDI",
  "01jc",
  "03XD",
  "0CKk",
  "05Ge",
  "0Ch1",
  "05zY",
  "0DM1",
  "01Jz",
  "03SE",
  "0CHE",
  "02at",
  "0EU6",
  "07Au",
  "05cj",
)
MODERN = ("DEBE01AL1H500005", "DEBE01AL1H500002")
IDS = tuple(PREFIX + s for s in HISTORICAL) + MODERN
REFS = [
  "https://www.berlin.de/sen/stadtentwicklung/denkmal/landesdenkmalamt/erklaerungsbogen_wohnquartier.pdf?ts=1691738889",
  "https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075020",
  "https://commons.wikimedia.org/wiki/File:Wohnbebauung-Wilhelmstr-Hannah-Arendt-Str-Berlin-Mitte-08-2017a.jpg",
  "https://commons.wikimedia.org/wiki/File:Mitte_Wilhelmstra%C3%9Fe_87.jpg",
  "https://commons.wikimedia.org/wiki/File:Berlin-Mitte_An_der_Kolonnade.jpg",
  "https://www.berlin.de/sehenswuerdigkeiten/3561913-3558930-georg-elser-denkmal.html",
]


def read(path: Path) -> Any:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def compact(value: Any) -> bytes:
  return json.dumps(
    value, ensure_ascii=False, separators=(",", ":"), allow_nan=False
  ).encode()


def recipe_controls(path: Path) -> dict[str, int]:
  """Use the consumer's exact ECMAScript number/string representation."""
  code = """import{readFileSync}from'node:fs';const d=JSON.parse(readFileSync(process.argv[1],'utf8'));
const h=q=>{let h=2166136261;for(const c of JSON.stringify(q))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;return h};
console.log(JSON.stringify({metadata:h({schemaVersion:d.schemaVersion,references:d.references,families:d.families,runs:d.runs,estimates:d.estimates}),drawn:h(d.drawn),native:h(d.native)}));"""
  run = subprocess.run(
    ["bun", "--eval", code, str(path.resolve())],
    check=True,
    capture_output=True,
    text=True,
  )
  return json.loads(run.stdout)


def footprints(family: dict[str, Any]) -> Any:
  return unary_union(
    [Polygon(p["ring"], p.get("holes", [])) for p in family["footprintPolygons"]]
  )


def walls(
  family: dict[str, Any], neighbours: list[dict[str, Any]]
) -> list[dict[str, Any]]:
  """Original vertical polygons, with outward direction proved by full footprints."""
  footprint = footprints(family)
  other = [
    (footprints(q), max(p["topY"] for p in q["parts"]))
    for q in neighbours
    if q["id"] != family["id"]
  ]
  result = []
  for part in family["parts"]:
    for surface in part["surfaces"]:
      if surface["kind"] != "WallSurface":
        continue
      rings = surface["rings"]
      ring = rings[0]
      a, b = max(
        ((a, b) for a in ring for b in ring),
        key=lambda pair: math.hypot(pair[0][0] - pair[1][0], pair[0][2] - pair[1][2]),
      )
      length = math.hypot(b[0] - a[0], b[2] - a[2])
      if length < 0.85:
        continue
      d = [(b[0] - a[0]) / length, (b[2] - a[2]) / length]
      n = [-d[1], d[0]]
      c = n[0] * a[0] + n[1] * a[2]
      if max(abs(n[0] * p[0] + n[1] * p[2] - c) for r in rings for p in r) > 0.00001:
        continue
      projected = [[(p[0] * d[0] + p[2] * d[1], p[1]) for p in r] for r in rings]
      polygon = Polygon(projected[0], projected[1:])
      if not polygon.is_valid or polygon.area < 6:
        continue
      u0, y0, u1, y1 = polygon.bounds
      center = polygon.representative_point()
      x, z = d[0] * center.x + n[0] * c, d[1] * center.x + n[1] * c
      plus = footprint.contains(Point(x + n[0] * 0.12, z + n[1] * 0.12))
      minus = footprint.contains(Point(x - n[0] * 0.12, z - n[1] * 0.12))
      if plus == minus:
        continue
      sign = -1 if plus else 1
      n = [v * sign for v in n]
      c *= sign
      if any(
        top > center.y and p.contains(Point(x + n[0] * 0.25, z + n[1] * 0.25))
        for p, top in other
      ):
        continue
      result.append(
        {
          "part": part["id"],
          "sourcePolygonIds": [surface["sourcePolygonId"]],
          "n": n,
          "d": d,
          "c": c,
          "rings": projected,
          "bounds": [u0, y0, u1, y1],
          "area": polygon.area,
          "_polygon": polygon,
          "_other": other,
        }
      )
  return result


def selected(
  candidates: list[dict[str, Any]], family_id: str
) -> list[list[dict[str, Any]]]:
  # Whole street-side runs, including their measured canted bay facets. A run
  # may span several official leaves/planes; it is NOT the largest tiny sheet.
  ns = {
    "0DBg": [(0, -1), (0, 1)],
    "0FDI": [(0, 1), (-1, 0)],
    "01jc": [(0, -1), (1, 0)],
    "05Ge": [(1, 0), (0, 1)],
    "0Ch1": [(0, 1), (0, -1)],
    "05zY": [(0, 1), (0, -1)],
    "01Jz": [(0, -1), (0, 1)],
    "03SE": [(0, -1), (0, 1)],
    "0DM1": [(0, -1), (0, 1)],
    "05cj": [(0, -1), (0, 1)],
  }
  directions = ns.get(family_id.removeprefix(PREFIX), [(1, 0), (-1, 0)])
  groups: list[list[dict[str, Any]]] = [[], []]
  for q in sorted(candidates, key=lambda q: q["sourcePolygonIds"]):
    scores = [sum(a * b for a, b in zip(q["n"], n, strict=True)) for n in directions]
    best = max(range(2), key=lambda i: scores[i])
    if scores[best] >= 0.62:
      groups[best].append(q)
  return [q for q in groups if q]


def compile_profile(
  source_path: Path,
  inventory_path: Path,
  output: Path,
  evidence: Path,
  native_support_path: Path | None = None,
  native_core_support_path: Path | None = None,
) -> None:
  data, inventory = read(source_path), read(inventory_path)
  source = {q["id"]: q for q in data["buildings"]}
  audit = {q["parentId"]: q for q in inventory["allNonSteleFamiliesIntersectingWindow"]}
  if len(source) != len(data["buildings"]) or any(
    i not in source or i not in audit for i in IDS
  ):
    raise ValueError("Incomplete or duplicate source-family inventory")
  families, runs, rows, checks = [], [], [], []
  for family_id in IDS:
    family, record = source[family_id], audit[family_id]
    modern = family_id in MODERN
    kindergarten = family_id == PREFIX + "0EU6"
    style = (
      "modern-retained-joinery"
      if modern
      else "low-kindergarten"
      if kindergarten
      else "kolonnade-grouped"
      if family["footprintPolygons"][0]["ring"][0][1] > 690
      else "wilhelm-panel-bays"
    )
    backing = 0xD7D3C7 if modern else 0xC9C7BB if kindergarten else 0xC1BDB2
    families.append(
      {
        "id": family_id,
        "parts": [p["id"] for p in family["parts"]],
        "addresses": record["addressSummary"],
        "style": style,
        "neutralBackingRgb": backing,
      }
    )
    for patches in selected(walls(family, data["buildings"]), family_id):
      run_id = len(runs)
      run_patches, total_windows = [], 0
      for wall in patches:
        total_windows += compile_wall(
          rows, wall, run_id, modern, kindergarten, family_id, footprints(family)
        )
        run_patches.append({k: v for k, v in wall.items() if not k.startswith("_")})
      if not total_windows:
        continue
      runs.append(
        {
          "id": run_id,
          "family": family_id,
          "style": style,
          "patches": run_patches,
          "windowCount": total_windows,
        }
      )
      checks.append(
        {
          "run": run_id,
          "fullPolygonSupport": True,
          "outwardFootprintProof": True,
          "neighbourRejects": True,
          "windowCount": total_windows,
        }
      )
  if (
    len(families) != 19
    or not 30 <= len(runs) <= 40
    or sum(len(q["parts"]) for q in families) != 83
  ):
    raise ValueError("Finite 19-family/83-leaf/30..40-run inventory changed")
  support = read(native_support_path) if native_support_path else None
  if native_core_support_path:
    if not support:
      raise ValueError("The original native packet support must be supplied too")
    core_support = read(native_core_support_path)
    if len(core_support.get("actualBodySupportProofs", [])) != 2 or not all(
      p.get("complete") and p.get("finalMissingAreaM2") == 0
      for p in core_support["actualBodySupportProofs"]
    ):
      raise ValueError("Actual Full and Touch body support proofs are required")
    support = {
      **support,
      "surfaces": [*support["surfaces"], *core_support["surfaces"]],
    }
  native_rows, native_checks = (
    compile_native_support(support, runs) if support else ([], [])
  )
  if native_support_path and set(
    q["family"] for q in native_checks if q["windows"]
  ) != set(IDS):
    raise ValueError("Native source supports do not cover all nineteen families")
  result = {
    "schemaVersion": 1,
    "references": REFS,
    "families": families,
    "runs": runs,
    "drawn": rows,
    "native": native_rows,
    "estimates": {
      "joinery": "small dimensions, bay rhythms, occupancy and tones interpreted from public context; not surveyed",
      "noNewRoofMasses": True,
      "native": "actual cardinal source support required before admission",
    },
  }
  output.parent.mkdir(parents=True, exist_ok=True)
  output.write_bytes(compact(result) + b"\n")
  evidence.parent.mkdir(parents=True, exist_ok=True)
  proof = {
    "schemaVersion": 1,
    "source": {
      "path": str(source_path),
      "sha256": sha(source_path),
      "officialOriginal": data["sourceFile"],
    },
    "inventorySha256": sha(inventory_path),
    "families": [source[i] for i in IDS],
    "completeNeighbourSourceFamilies": [
      q for q in data["buildings"] if q["id"] not in IDS
    ],
    "selectedInventoryRecords": [audit[i] for i in IDS],
    "runChecks": checks,
    "outputSha256": sha(output),
    "runtimeRecipeControls": recipe_controls(output),
    "nativeSupport": (
      {
        "sha256": sha(native_support_path),
        "source": support,
        "coreSupportSha256": sha(native_core_support_path)
        if native_core_support_path
        else None,
        "coreSource": read(native_core_support_path)
        if native_core_support_path
        else None,
        "checks": native_checks,
      }
      if native_support_path
      else None
    ),
    "metrics": {
      "families": len(families),
      "leaves": 83,
      "runs": len(runs),
      "drawnBoxes": len(rows),
      "drawnInstanceBytes": len(rows) * 76,
      "nativeBoxes": len(native_rows),
      "nativeInstanceBytes": len(native_rows) * 76,
    },
  }
  evidence.write_bytes(gzip.compress(compact(proof), mtime=0))
  print(
    json.dumps(
      {"output": str(output), "bytes": output.stat().st_size, **proof["metrics"]}
    )
  )


def compile_wall(
  rows: list[list[Any]],
  wall: dict[str, Any],
  run_id: int,
  modern: bool,
  kindergarten: bool,
  family_id: str,
  footprint: Any,
) -> int:
  """All rectangles must fit one complete original vertical polygon."""
  polygon = wall["_polygon"]
  u0, y0, u1, y1 = wall["bounds"]
  pitch = 3.0 if kindergarten else 3.1 if modern else 2.8
  width = min(1.48 if modern else 1.55 if kindergarten else 1.68, (u1 - u0) - 0.5)
  if width < 0.45 or y1 - y0 < 2.5:
    return 0
  height = 1.65 if kindergarten else 1.80 if modern else 1.62
  frame = 0.065 if modern else 0.08
  floor_count = max(1, math.floor((y1 - y0 - 0.7) / pitch))
  bay_count = max(
    1, math.floor((u1 - u0 - 0.7) / (3.1 if modern else 3.6 if kindergarten else 3.0))
  )
  window_count = 0

  def add(
    u: float,
    y: float,
    w: float,
    h: float,
    depth: float,
    offset: float,
    rgb: int,
    role: str,
  ) -> None:
    # The entire attachment rectangle, not merely its centre, is supported.
    if not polygon.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
      raise ValueError("Fitting crosses original source polygon/hole")
    nx, nz = wall["n"]
    dx, dz = wall["d"]
    x, z = dx * u + nx * (wall["c"] + offset), dz * u + nz * (wall["c"] + offset)
    if any(
      top > y - h / 2 and p.contains(Point(x + nx * 0.1, z + nz * 0.1))
      for p, top in wall["_other"]
    ):
      return
    # Matrix convention: local +X follows d; local +Z is either outward sign.
    angle = math.atan2(-dz, dx)
    rows.append(
      [round(v, 6) for v in [x, y, z, w, h, depth, angle]] + [rgb, role, run_id]
    )

  for floor in range(floor_count):
    y = y0 + 0.65 + (floor + 0.5) * (y1 - y0 - 1.3) / floor_count
    for bay in range(bay_count):
      u = u0 + (bay + 0.5) * (u1 - u0) / bay_count
      outer = box(
        u - width / 2 - frame,
        y - height / 2 - frame,
        u + width / 2 + frame,
        y + height / 2 + frame,
      )
      if not polygon.buffer(-0.12).covers(outer):
        continue
      # Bay joinery follows an existing canted sheet or a genuine measured
      # recessed pocket. There is no invented every-third balcony grid.
      nx, nz = wall["n"]
      dx, dz = wall["d"]
      x, z = dx * u + nx * wall["c"], dz * u + nz * wall["c"]
      envelope = Polygon(
        [
          (
            x + dx * side * (width / 2 + 0.12) + nx * depth,
            z + dz * side * (width / 2 + 0.12) + nz * depth,
          )
          for side, depth in [(-1, 0), (1, 0), (1, 0.34), (-1, 0.34)]
        ]
      )
      if any(
        top > y - height / 2 - frame and p.intersection(envelope).area > 1e-8
        for p, top in wall["_other"]
      ):
        continue
      recess = 0.0
      for dep in (0.20, 0.35, 0.50, 0.65):
        if all(
          footprint.contains(
            Point(
              x + nx * dep + dx * side * (width / 2 + 0.30),
              z + nz * dep + dz * side * (width / 2 + 0.30),
            )
          )
          for side in (-1, 1)
        ):
          recess = dep
      grouped = (
        not modern and not kindergarten and (min(abs(nx), abs(nz)) > 0.40 or recess > 0)
      )
      glass = 0x526269 if modern else 0x4E6268 if grouped else 0x65777B
      frame_rgb = 0x61584D if grouped else 0xC5C4B8 if modern else 0xDFE0D8
      # Restrained daylight glass and joinery. Warm occupancy shares the existing lighting pass.
      add(u, y, width, height, 0.065, 0.065, glass, "glazing")
      for side in (-1, 1):
        add(
          u + side * (width / 2 + frame / 2),
          y,
          frame,
          height + frame * 2,
          0.10,
          0.11,
          frame_rgb,
          "frame",
        )
        add(
          u,
          y + side * (height / 2 + frame / 2),
          width,
          frame,
          0.10,
          0.11,
          frame_rgb,
          "frame",
        )
      add(u, y + height * 0.15, width, 0.045, 0.105, 0.12, frame_rgb, "transom")
      if grouped:
        for side in (-1, 1):
          add(u + side * width / 6, y, 0.045, height, 0.105, 0.12, frame_rgb, "mullion")
      if recess > 0 and floor > 0:
        # Open rail only in a real source recess; no filled wall, deck or
        # artificial cavity. Its depth stays inside the measured side tabs.
        add(
          u,
          y - height / 2 + 0.45,
          width,
          0.055,
          0.055,
          recess,
          0xC9CBC1,
          "source-recess-loggia-rail",
        )
        for side in (-1, 0, 1):
          add(
            u + side * width * 0.43,
            y - height / 2 + 0.22,
            0.045,
            0.49,
            0.055,
            recess,
            0xC9CBC1,
            "source-recess-loggia-post",
          )
      # French rails remain shallow; no balcony floor or false cut into a body.
      if (
        not modern
        and not kindergarten
        and (bay + floor) % 3 == 0
        and floor > 0
        and polygon.covers(
          box(u - width / 2 - 0.1, y - height / 2, u + width / 2 + 0.1, y + height / 2)
        )
      ):
        add(
          u,
          y - height / 2 + 0.39,
          width + 0.10,
          0.04,
          0.06,
          0.28,
          0x9FA49D,
          "french-rail",
        )
        for side in (-1, 1):
          add(
            u + side * width * 0.45,
            y - height / 2 + 0.20,
            0.04,
            0.42,
            0.06,
            0.28,
            0x9FA49D,
            "rail-post",
          )
      window_count += 1
  return window_count


def compile_native_support(
  support: dict[str, Any], runs: list[dict[str, Any]]
) -> tuple[list[list[Any]], list[dict[str, Any]]]:
  """Independent cardinal layout on actual native exterior polygons only."""
  if support["schemaVersion"] != 1:
    raise ValueError("Unknown native support schema")
  by_run = {r["id"]: r for r in runs}
  rows: list[list[Any]] = []
  checks: list[dict[str, Any]] = []
  for index, q in enumerate(support["surfaces"]):
    run = by_run[q["run"]]
    if q["family"] != run["family"]:
      raise ValueError("Native support family/run mismatch")
    nx, nz = q["n"]
    dx, dz = q["d"]
    if (
      (nx, nz) not in ((1, 0), (-1, 0), (0, 1), (0, -1))
      or (dx, dz) not in ((1, 0), (-1, 0), (0, 1), (0, -1))
      or nx * dx + nz * dz != 0
    ):
      raise ValueError("Native support is not an exact cardinal source plane")
    polygon = Polygon(q["rings"][0], q["rings"][1:])
    if not polygon.is_valid or polygon.area <= 0:
      raise ValueError("Invalid native source polygon")
    u0, y0, u1, y1 = polygon.bounds
    modern = run["family"] in MODERN
    kindergarten = run["family"] == PREFIX + "0EU6"
    width, height, frame = 1.25, 1.25 if kindergarten else 1.50, 0.125
    count = 0

    def add(
      u: float,
      y: float,
      w: float,
      h: float,
      depth: float,
      offset: float,
      rgb: int,
      role: str,
    ) -> None:
      if not polygon.covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2)):
        raise ValueError("Native box crosses actual native source face/hole")
      x, z = dx * u + nx * (q["c"] + offset), dz * u + nz * (q["c"] + offset)
      sx, sz = (w, depth) if dx else (depth, w)
      rows.append(
        [round(v, 6) for v in (x, y, z, sx, h, sz, 0)] + [rgb, role, q["run"]]
      )

    # The original cardinal 2m surface topology, independent of drawn bays.
    # A connected 2m glass face gets one complete inset joinery group; larger
    # connected native column walls use the same orthogonal 2m source lattice.
    for yi in range(max(1, math.floor((y1 - y0) / 2))):
      y = y0 + (yi + 0.5) * (y1 - y0) / max(1, math.floor((y1 - y0) / 2))
      for ui in range(max(1, math.floor((u1 - u0) / 2))):
        u = u0 + (ui + 0.5) * (u1 - u0) / max(1, math.floor((u1 - u0) / 2))
        if not polygon.buffer(-0.125).covers(
          box(
            u - width / 2 - frame,
            y - height / 2 - frame,
            u + width / 2 + frame,
            y + height / 2 + frame,
          )
        ):
          continue
        glass = 0x526269 if modern else 0x65777B
        tone = 0xC5C4B8 if modern else 0xDFE0D8
        add(u, y, width, height, 0.125, 0.125, glass, "glazing")
        for side in (-1, 1):
          add(
            u + side * (width / 2 + frame / 2),
            y,
            frame,
            height + frame * 2,
            0.125,
            0.25,
            tone,
            "frame",
          )
          add(
            u,
            y + side * (height / 2 + frame / 2),
            width,
            frame,
            0.125,
            0.25,
            tone,
            "frame",
          )
        add(u, y + height * 0.125, width, 0.0625, 0.125, 0.25, tone, "transom")
        count += 1
    checks.append(
      {
        "surface": index,
        "run": q["run"],
        "family": q["family"],
        "windows": count,
        "allCardinal": True,
        "fullActualSupport": True,
      }
    )
  # The production compiler requires all nineteen; a bounded diagnostic may
  # inspect a source-proved partial export through this pure helper.
  return rows, checks


def native_core_support(
  core_input: Path, bindings_path: Path, voxels_path: Path
) -> dict[str, Any]:
  """Common Full/Touch actual 4m column walls and complete adjacent-RLE exposure.

  The plinth/roof cap are excluded. Unknown neighbour membership must first
  become part of the strict source receipt; it can never mean an empty cell.
  """
  core, bindings, voxels = read(core_input), read(bindings_path), read(voxels_path)
  spec = bindings["nativeVoxels"]
  if spec["cellM"] != 4 or voxels["cell_m"] != 4 or spec["grid"] != voxels["grid"]:
    raise ValueError("Unknown native grid")
  family_ids = {
    f["parentId"]: set(f["oldCorePrismsStillActive"]) for f in core["families"]
  }
  all_ids = set.union(*family_ids.values())
  known = {
    (q["x"], q["z"]): q for q in [*spec["cells"], *spec.get("exposureCells", [])]
  }
  grid = voxels["grid"]
  cache: dict[tuple[int, int], list[list[int]]] = {}

  def actual(x: int, z: int) -> list[list[int]]:
    key = (x, z)
    if key not in known:
      raise ValueError(f"Unpinned native exposure neighbour {x},{z}")
    if key not in cache:
      rows = voxels["building_rows"][z - grid["min_z_idx"]]
      cache[key] = [
        [x, z, r[2], r[3], r[4]]
        for r in rows
        if grid["min_x_idx"] + r[0] <= x < grid["min_x_idx"] + r[0] + r[1]
      ]
      if cache[key] != known[key]["intervals"]:
        raise ValueError("Actual native interval signature differs from admission")
    return cache[key]

  parts: dict[tuple[str, int, int, int, float], list[Any]] = {}
  used_cells: set[tuple[int, int]] = set()
  source_columns = []
  for q in spec["cells"]:
    contributors = set(q["contributors"])
    if not contributors or not contributors <= all_ids:
      continue
    owners = [f for f, ids in family_ids.items() if contributors <= ids]
    if len(owners) != 1:
      continue
    family = owners[0]
    x, z = q["x"], q["z"]
    for column in actual(x, z):
      low, high = column[2] / 10 + 1.25, column[3] / 10 - 1.25
      if high <= low:
        continue
      for nx, nz in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        neighbours = actual(x + nx, z + nz)
        used_cells.update(((x, z), (x + nx, z + nz)))
        visible = box(0, low, 4, high)
        for neighbour in neighbours:
          visible = visible.difference(box(-1, neighbour[2] / 10, 5, neighbour[3] / 10))
        if visible.is_empty:
          continue
        dx, dz = -nz, nx
        wx = (x + 0.5) * 4 + nx * 2
        wz = (z + 0.5) * 4 + nz * 2
        c = nx * wx + nz * wz
        umid = dx * wx + dz * wz
        for run in core["runs"]:
          if run["family"] != family:
            continue
          masks = []
          for patch in run["patches"]:
            if nx * patch["n"][0] + nz * patch["n"][1] < 0.62:
              continue
            distance = abs(patch["n"][0] * wx + patch["n"][1] * wz - patch["c"])
            if distance > 4 * math.sqrt(2):
              continue
            rings = []
            for ring in patch["rings"]:
              projected = []
              for u, y in ring:
                px = patch["d"][0] * u + patch["n"][0] * patch["c"]
                pz = patch["d"][1] * u + patch["n"][1] * patch["c"]
                projected.append((dx * px + dz * pz, y))
              rings.append(projected)
            mask = Polygon(rings[0], rings[1:])
            if mask.is_valid:
              masks.append(mask)
          if not masks:
            continue
          exposed = [visible] if visible.geom_type == "Polygon" else list(visible.geoms)
          face = unary_union(
            [
              Polygon(
                [(umid - 2 + u, y) for u, y in p.exterior.coords],
                [[(umid - 2 + u, y) for u, y in h.coords] for h in p.interiors],
              )
              for p in exposed
            ]
          )
          clipped = face.intersection(unary_union(masks))
          if clipped.is_empty:
            continue
          parts.setdefault((family, run["id"], nx, nz, c), []).append(clipped)
          source_columns.append(
            {
              "family": family,
              "run": run["id"],
              "column": column,
              "neighbourXY": [x + nx, z + nz],
              "n": [nx, nz],
            }
          )
  surfaces = []
  for (family, run, nx, nz, c), polygons in sorted(parts.items()):
    merged = unary_union(polygons)
    for p in [merged] if merged.geom_type == "Polygon" else merged.geoms:
      if p.geom_type != "Polygon" or p.area <= 0:
        continue
      surfaces.append(
        {
          "family": family,
          "run": run,
          "n": [nx, nz],
          "d": [-nz, nx],
          "c": c,
          "rings": [
            list(map(list, p.exterior.coords)),
            *[list(map(list, h.coords)) for h in p.interiors],
          ],
          "source": {
            "kind": "actual-original-4m-column-envelope",
            "unmodifiedSourceDatum": True,
            "roofAndPlinthExcludedM": 1.25,
          },
        }
      )
  return {
    "schemaVersion": 1,
    "surfaces": surfaces,
    "sourceColumns": source_columns,
    "exposureCells": [known[key] for key in sorted(used_cells)],
    "inputSha256": sha(core_input),
    "sourceBindingsSha256": sha(bindings_path),
    "voxelsSha256": sha(voxels_path),
  }


def verify_actual_native_core_support(
  support: dict[str, Any], capture_path: Path
) -> dict[str, Any]:
  """Independently check every support point against the real rendered body.

  No synthetic whole-world matrix or raw height scalar is accepted as proof.
  The bounded capture includes all real source and neighbour rows at this site.
  """
  capture = read(capture_path)
  parts = [p for p in capture["parts"] if p["name"] == "Voxel building columns"]
  if len(parts) != 1 or not parts[0]["rows"]:
    raise ValueError("Missing actual native body host")
  cubes = []
  for row in parts[0]["rows"]:
    m = struct.unpack("<16f", base64.b64decode(row["matrix"]))
    if (
      any(m[i] != 0 for i in (1, 2, 3, 4, 6, 7, 8, 9, 11))
      or m[15] != 1
      or m[0] != 4
      or m[10] != 4
      or m[5] <= 0
    ):
      raise ValueError("Unexpected actual native body matrix")
    cubes.append(
      (
        row["index"],
        m[12] - m[0] / 2,
        m[13] - m[5] / 2,
        m[14] - m[10] / 2,
        m[12] + m[0] / 2,
        m[13] + m[5] / 2,
        m[14] + m[10] / 2,
      )
    )
  matched = set()
  final_surfaces = []
  clipped_area = 0.0
  for s in support["surfaces"]:
    nx, nz = s["n"]
    dx, dz = s["d"]
    c = s["c"]
    faces = []
    occluders = []
    for row, x0, y0, z0, x1, y1, z1 in cubes:
      cs = [nx * x + nz * z for x in (x0, x1) for z in (z0, z1)]
      us = [dx * x + dz * z for x in (x0, x1) for z in (z0, z1)]
      face = box(min(us), y0, max(us), y1)
      if max(cs) == c:
        faces.append(face)
        matched.add(row)
      if min(cs) < c + 0.01 < max(cs):
        occluders.append(face)
    actual = unary_union(faces).difference(unary_union(occluders))
    wanted = Polygon(s["rings"][0], s["rings"][1:])
    missing = wanted.difference(actual)
    # Original matrix words stay unchanged. Clip the NEW fitting support to
    # their actual Float32 faces, including tiny original layer-rounding steps.
    clipped_area += missing.area
    retained = wanted.intersection(actual)
    pieces = [retained] if retained.geom_type == "Polygon" else retained.geoms
    for p in pieces:
      if p.geom_type != "Polygon" or p.area <= 0:
        continue
      if p.difference(actual).area != 0:
        raise ValueError("New fitting support escapes the actual body")
      final_surfaces.append(
        {
          **s,
          "rings": [
            list(map(list, p.exterior.coords)),
            *[list(map(list, h.coords)) for h in p.interiors],
          ],
        }
      )
  support["surfaces"] = final_surfaces
  return {
    "complete": True,
    "captureSha256": sha(capture_path),
    "actualBodyGlobalRows": sorted(matched),
    "verifiedSurfaces": len(final_surfaces),
    "actualNearbyBodyRows": len(cubes),
    "newSupportClippedToActualFloat32BodyM2": clipped_area,
    "finalMissingAreaM2": 0,
  }


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--source", type=Path, required=True)
  parser.add_argument("--inventory", type=Path, required=True)
  parser.add_argument("--native-support", type=Path)
  parser.add_argument("--native-core-support", type=Path)
  parser.add_argument(
    "--output", type=Path, default=Path("src/app/src/data/wilhelmHousingV324.json")
  )
  parser.add_argument(
    "--evidence",
    type=Path,
    default=Path("geo_data/regierungsviertel/wilhelm-housing-v324-evidence.json.gz"),
  )
  args = parser.parse_args()
  compile_profile(
    args.source,
    args.inventory,
    args.output,
    args.evidence,
    args.native_support,
    args.native_core_support,
  )


if __name__ == "__main__":
  main()
