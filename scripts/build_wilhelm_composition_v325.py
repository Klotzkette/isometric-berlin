"""Compose whole Wilhelm facades on the existing exact V324 wall masks.

This second generation changes the fitting recipe, never a source shell, roof,
hole, street, collision or prior product. Family storeys and run bay axes are
shared across leaves/planes. Small oriel returns inherit those storeys instead
of becoming little independent apartment blocks. The Elser corner is the first
explicit photographic composition. All dimensions below are display estimates.

Outputs are review candidates in an explicitly supplied external directory.
Native rows remain marked as the unchanged V324 baseline until the independent
full-native-wall compositor supplies its own complete source support.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from typing import Any

from build_wilhelm_housing_v324 import (
  compact,
  footprints,
  read,
  recipe_controls,
  walls,
)
from shapely.geometry import Point, box

ROOT = Path(__file__).resolve().parents[1]
ELSER = "DEBE01YYK00005Ge"
# These are named interpretations, never window positions attributed to LoD2.
# Roof, recessed balcony and projecting bay geometry stays with its actual owner.
PALE = 0xC7C0B2
PANEL_LIGHT = 0xD0CABC
PANEL_JOINT = 0xA8A395
CORNER_BRICK = 0xAA8174
GLASS = 0x516A74
WHITE_FRAME = 0xE0DFD5
DARK_FRAME = 0x3C4444
RAIL = 0xBFC3BE
# Photographic column composition on positively identified complete wall sheets.
# Fractions express a reviewable visual interpretation along each actual source
# plane, not a newly surveyed window coordinate. They are promoted to one run
# coordinate system before any micro-wall is visited.
ELSER_COLUMNS = {
  "UUID_0b1cba1a-b6d6-41b5-8aef-512c3ca8dc6a": [
    (0.16, "ordinary"),
    (0.51, "oriel"),
    (0.86, "ordinary"),
  ],
  "UUID_269fa551-7be9-4e04-adf2-d6fc9114770c": [
    (0.17, "ordinary"),
    (0.52, "oriel"),
    (0.86, "ordinary"),
  ],
  "UUID_433116b6-78b0-4ed5-bafc-499b6e004183": [(0.20, "ordinary"), (0.66, "oriel")],
  "UUID_881c6eb3-f448-4ebf-b17c-5c49be9deda1": [(0.22, "ordinary"), (0.66, "oriel")],
}
OBSERVED_FRENCH_RAILS = {ELSER, "DEBE01YYK00001jc", "DEBE01YYK00003XD"}


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def dot(a: list[float], b: list[float]) -> float:
  return sum(x * y for x, y in zip(a, b, strict=True))


def point(wall: dict[str, Any], u: float, y: float, offset=0.0) -> list[float]:
  d, n, c = wall["d"], wall["n"], wall["c"]
  return [d[0] * u + n[0] * (c + offset), y, d[1] * u + n[1] * (c + offset)]


def weighted_quantile(values: list[tuple[float, float]], quantile: float) -> float:
  ordered = sorted(values)
  target, current = sum(w for _, w in ordered) * quantile, 0.0
  for value, weight in ordered:
    current += weight
    if current >= target:
      return value
  return ordered[-1][0]


def vertical_composition(
  family: dict[str, Any], runs: list[dict[str, Any]]
) -> dict[str, Any]:
  patches = [p for run in runs for p in run["patches"]]
  datum = min(p["bounds"][1] for p in patches)
  modern = family["style"] == "modern-retained-joinery"
  school = family["style"] == "low-kindergarten"
  tall = [
    (p["bounds"][3], p["area"])
    for p in patches
    if p["bounds"][2] - p["bounds"][0] >= 4 and p["bounds"][1] <= datum + 0.2
  ]
  eave = weighted_quantile(tall, 0.35)
  top = max(p["bounds"][3] for p in patches)
  # The actual Elser source has the lower long street wall at 27.967 m;
  # the separate higher folded/corner wall sheets continue into the roof zone.
  if family["id"] == ELSER:
    eave = 27.967
  ground_top = datum + (
    3.40 if family["id"] == ELSER else 3.15 if school else 3.55 if modern else 3.35
  )
  target_pitch = (
    3.10 if modern else 3.0 if school else 2.80 if family["id"] == ELSER else 2.90
  )
  count = max(1, round((eave - ground_top - 0.25) / target_pitch))
  pitch = (eave - ground_top - 0.30) / count
  centers = [round(ground_top + pitch * (i + 0.5), 6) for i in range(count)]
  roof_center = round((eave + top) / 2, 6)
  return {
    "family": family["id"],
    "datumY": datum,
    "groundFloorRange": [datum, round(ground_top, 6)],
    "residentialFloorCenters": centers,
    "residentialPitchM": round(pitch, 9),
    "roofZoneRange": [eave, top],
    "roofOpeningCenters": [roof_center] if top - eave > 1.8 and not school else [],
    "groundUse": "corner-shopfront"
    if family["id"] == ELSER
    else "modern-base"
    if modern
    else "residential-base",
    "modulePitchM": 3.10 if modern else 3.60 if school else 3.15,
    "floorOrigin": "shared complete family datum and measured major-wall eave; floor subdivision is a display interpretation",
    "referenceLabels": ["fridolin2026", "berlin-dpa"]
    if family["id"] == ELSER
    else ["lda2021", "run-specific source wall geometry"],
    "roleVerticalRanges": {
      "base": [datum, ground_top],
      "housing": [ground_top, eave],
      "roof-front-joinery": [eave, top],
    },
  }


def run_composition(run: dict[str, Any], vertical: dict[str, Any]) -> dict[str, Any]:
  # A dominant actual long plane supplies one oriented run axis. It is not
  # recomputed independently for every narrow original panel/leaf.
  primary = max(run["patches"], key=lambda p: p["area"])
  n = primary["n"][:]
  d = [n[1], -n[0]]
  intervals, depths, feature_centers = [], [], []
  for patch in run["patches"]:
    points = [point(patch, u, y) for u, y in patch["rings"][0]]
    values = [p[0] * d[0] + p[2] * d[1] for p in points]
    lo, hi = min(values), max(values)
    depth = sum(p[0] * n[0] + p[2] * n[1] for p in points) / len(points)
    intervals.append([lo, hi])
    depths.append((depth, patch["area"]))
    if hi - lo < 5.5 and abs(dot(patch["n"], n)) < 0.985:
      feature_centers.append((lo + hi) / 2)
  lo, hi = min(a for a, _ in intervals), max(b for _, b in intervals)
  module = vertical["modulePitchM"]
  # The first measured bay return is a stable photographic composition anchor;
  # otherwise the complete run's endpoint anchors one shared set of bay axes.
  origin = min(feature_centers) if feature_centers else lo + module / 2
  count_low, count_high = (
    math.ceil((lo - origin) / module),
    math.floor((hi - origin) / module),
  )
  axes = [round(origin + k * module, 6) for k in range(count_low, count_high + 1)]
  photographic = []
  if run["family"] == ELSER:
    for patch in run["patches"]:
      for sid in patch["sourcePolygonIds"]:
        for fraction, kind in ELSER_COLUMNS.get(sid, []):
          u0, _y0, u1, _y1 = patch["bounds"]
          p = point(patch, u0 + (u1 - u0) * fraction, 0)
          photographic.append(
            {
              "s": round(p[0] * d[0] + p[2] * d[1], 6),
              "kind": kind,
              "sourceAnchorPolygonId": sid,
              "sourceFraction": fraction,
              "precision": "photographic display composition, not a surveyed opening",
            }
          )
  return {
    "run": run["id"],
    "family": run["family"],
    "normal": n,
    "tangent": d,
    "bayModuleM": module,
    "bayOriginS": round(origin, 6),
    "bayAxesS": axes,
    "streetIntervals": intervals,
    "backingDepth": weighted_quantile(depths, 0.35),
    "outerDepth": weighted_quantile(depths, 0.90),
    "photographicColumnAxes": photographic,
    "axisOrigin": "complete run's actual source bay return or endpoint; one phase across every source wall",
  }


class Compositor:
  def __init__(self, baseline: dict[str, Any], sources: dict[str, Any]):
    self.baseline, self.sources = baseline, sources
    self.rows: list[list[Any]] = []
    self.proof: list[dict[str, Any]] = []
    self.unique: set[bytes] = set()
    self.rejected = Counter()
    self.exposed = {b["id"]: footprints(b) for b in sources["buildings"]}
    self.tops = {
      b["id"]: max(p["topY"] for p in b["parts"]) for b in sources["buildings"]
    }
    self.neighbours = {}
    for family_id, footprint in self.exposed.items():
      near = box(*footprint.bounds).buffer(1)
      self.neighbours[family_id] = [
        (other_id, other, other.bounds)
        for other_id, other in self.exposed.items()
        if other_id != family_id and near.intersects(other)
      ]

  def emit(
    self, wall, run, u, y, width, height, depth, offset, rgb, role, label, floor=None
  ):
    if min(width, height, depth) <= 0:
      return
    rectangle = box(u - width / 2, y - height / 2, u + width / 2, y + height / 2)
    if not wall["_polygon"].buffer(-0.012).covers(rectangle):
      self.rejected["outside-exact-wall-or-hole"] += 1
      return
    xyz = point(wall, u, y, offset)
    nx, nz = wall["n"]
    # Every complete attachment rectangle must remain outside other source
    # buildings at the new fitting's outward edge, not just at its centre.
    for other_id, footprint, bounds in self.neighbours[run["family"]]:
      if self.tops[other_id] <= y - height / 2:
        continue
      if any(
        bounds[0] <= p[0] + nx * 0.1 <= bounds[2]
        and bounds[1] <= p[2] + nz * 0.1 <= bounds[3]
        and footprint.contains(Point(p[0] + nx * 0.10, p[2] + nz * 0.10))
        for p in (
          point(wall, uu, y, offset + depth / 2)
          for uu in (u - width / 2, u, u + width / 2)
        )
      ):
        self.rejected["occluded-by-complete-neighbour"] += 1
        return
    angle = math.atan2(-wall["d"][1], wall["d"][0])
    row = [round(v, 6) for v in (*xyz, width, height, depth, angle)] + [
      rgb,
      role,
      run["id"],
    ]
    key = compact(row)
    if key in self.unique:
      return
    self.unique.add(key)
    self.proof.append(
      {
        "row": len(self.rows),
        "family": run["family"],
        "run": run["id"],
        "part": wall["part"],
        "sourcePolygonIds": wall["sourcePolygonIds"],
        "uv": [u, y, width, height],
        "label": label,
        "floor": floor,
      }
    )
    self.rows.append(row)

  def rectangle(self, wall, run, x0, y0, x1, y1, rgb, label, offset=0.025, depth=0.025):
    if x1 - x0 > 0.04 and y1 - y0 > 0.008:
      self.emit(
        wall,
        run,
        (x0 + x1) / 2,
        (y0 + y1) / 2,
        x1 - x0,
        y1 - y0,
        depth,
        offset,
        rgb,
        "wall-material",
        label,
      )

  def opening(
    self, wall, run, u, y, width, height, label, floor, dark=False, french=False
  ):
    frame = 0.075
    # Require the whole group before adding any member: no dangling half-frame.
    if (
      not wall["_polygon"]
      .buffer(-0.055)
      .covers(
        box(
          u - width / 2 - frame,
          y - height / 2 - frame,
          u + width / 2 + frame,
          y + height / 2 + frame,
        )
      )
    ):
      return
    color = DARK_FRAME if dark else WHITE_FRAME
    self.emit(
      wall, run, u, y, width, height, 0.055, 0.070, GLASS, "glazing", label, floor
    )
    for sign in (-1, 1):
      self.emit(
        wall,
        run,
        u + sign * (width + frame) / 2,
        y,
        frame,
        height + frame * 2,
        0.085,
        0.110,
        color,
        "frame",
        label,
        floor,
      )
      self.emit(
        wall,
        run,
        u,
        y + sign * (height + frame) / 2,
        width,
        frame,
        0.085,
        0.110,
        color,
        "frame",
        label,
        floor,
      )
    if dark or width > 2:
      # One coherent wrapped bay pane; narrow return panes are not each given
      # another arbitrary three-column housing grid.
      for fraction in [0] if width < 2.4 else [-0.18, 0.18]:
        self.emit(
          wall,
          run,
          u + width * fraction,
          y,
          0.055,
          height,
          0.09,
          0.12,
          color,
          "mullion",
          label,
          floor,
        )
      self.emit(
        wall,
        run,
        u,
        y - height * 0.28,
        width,
        0.055,
        0.09,
        0.12,
        color,
        "transom",
        label,
        floor,
      )
    elif not french:
      self.emit(
        wall, run, u, y, 0.055, height, 0.09, 0.12, color, "mullion", label, floor
      )
    if french:
      # An explicit whole window-column treatment, shared on every inhabited
      # floor. There is no modulo-based selection of unrelated window bars.
      self.emit(
        wall,
        run,
        u,
        y - height / 2 + 0.49,
        width + 0.12,
        0.045,
        0.045,
        0.24,
        RAIL,
        "french-rail",
        label,
        floor,
      )
      for fraction in [-0.43, 0.43] if run["family"] in OBSERVED_FRENCH_RAILS else []:
        self.emit(
          wall,
          run,
          u + fraction * width,
          y - height / 2 + 0.25,
          0.035,
          0.48,
          0.045,
          0.24,
          RAIL,
          "rail-post",
          label,
          floor,
        )

  def wall(self, wall, run, vertical, layout):
    u0, y0, u1, y1 = wall["bounds"]
    width = u1 - u0
    modern = run["style"] == "modern-retained-joinery"
    school = run["style"] == "low-kindergarten"
    aligned = abs(dot(wall["n"], layout["normal"]))
    middle = point(wall, (u0 + u1) / 2, (y0 + y1) / 2)
    depth = middle[0] * layout["normal"][0] + middle[2] * layout["normal"][1]
    # Geometry, not a compass-angle threshold, identifies a projecting/recessed
    # bay. The canted facets are tied to one actual measured folded run.
    projecting = (
      not modern
      and not school
      and (aligned < 0.965 or depth > layout["backingDepth"] + 0.45)
      and width < 6.2
    )
    recessed = (
      not modern
      and not school
      and aligned > 0.98
      and depth < layout["outerDepth"] - 0.42
      and width < 5.5
    )
    base_top = vertical["groundFloorRange"][1]
    eave = vertical["roofZoneRange"][0]
    # Large material fields carry the photograph's pale wall/brick bay hierarchy.
    # Their rectangles stay fully within one source wall including its holes.
    # They are thin colour cues, not substitute building volumes.
    corner_material = (
      projecting
      and run["family"] == ELSER
      and math.hypot(middle[0] - 749.614475, middle[2] - 749.844173) < 25
    )
    wall_color = (
      0xD0CDC4
      if modern
      else 0xCDC9BD
      if school
      else CORNER_BRICK
      if corner_material
      else PALE
    )
    self.rectangle(
      wall,
      run,
      u0 + 0.04,
      max(y0, base_top) + 0.04,
      u1 - 0.04,
      min(y1, eave) - 0.04,
      wall_color,
      "continuous-pale-panel-or-red-oriel-field",
    )
    if y0 <= vertical["datumY"] + 0.2:
      self.rectangle(
        wall,
        run,
        u0 + 0.04,
        y0 + 0.04,
        u1 - 0.04,
        min(y1, base_top) - 0.04,
        0xB3AFA2 if not modern else 0xB9B9B1,
        "separate-ground-floor-plinth",
      )
    # Panel joints use family storey boundaries across every measured plane.
    for center in vertical["residentialFloorCenters"]:
      y = center - vertical["residentialPitchM"] / 2
      if y0 + 0.1 < y < min(y1, eave) - 0.1:
        self.rectangle(
          wall,
          run,
          u0 + 0.07,
          y,
          u1 - 0.07,
          y + 0.025,
          PANEL_JOINT,
          "shared-horizontal-panel-joint",
          0.047,
          0.014,
        )
    tangent = layout["tangent"]
    denominator = wall["d"][0] * tangent[0] + wall["d"][1] * tangent[1]
    shift = wall["c"] * dot(wall["n"], tangent)
    if abs(denominator) < 0.15:
      return
    # One oriented bay list for a complete run. Window centres do not reset at
    # a micro-wall's low/high bounds. Narrow bay facets receive one pane that
    # belongs to the actual folded bay and shares all family storeys.
    centers = [
      {"u": (s - shift) / denominator, "kind": "ordinary"} for s in layout["bayAxesS"]
    ]
    photographic = [
      axis
      for axis in layout["photographicColumnAxes"]
      if axis["sourceAnchorPolygonId"] in wall["sourcePolygonIds"]
    ]
    if photographic:
      centers = [
        {"u": (axis["s"] - shift) / denominator, "kind": axis["kind"]}
        for axis in photographic
      ]
    centers = [axis for axis in centers if u0 + 0.25 <= axis["u"] <= u1 - 0.25]
    if projecting and width < 6.2:
      centers = [{"u": (u0 + u1) / 2, "kind": "oriel"}]
    regular_width = (
      min(3.50, width - 0.38) if projecting else 1.30 if not modern else 1.55
    )
    if school:
      regular_width = 1.75
    regular_height = 1.85 if modern else 1.88 if projecting else 1.95
    for floor, y in enumerate(vertical["residentialFloorCenters"]):
      if y >= eave - 0.55:
        continue
      for axis in centers:
        u, column_oriel = axis["u"], axis["kind"] == "oriel"
        opening_width = min(width - 0.38, 3.25) if column_oriel else regular_width
        photo_loggia = (
          run["family"] == ELSER
          and column_oriel
          and floor in {1, len(vertical["residentialFloorCenters"]) - 1}
        )
        if recessed and floor == len(vertical["residentialFloorCenters"]) - 1:
          # The roof-adjacent loggia remains an open dark recess, with only an
          # explicit source-supported back pane and slender horizontal rail.
          self.opening(
            wall,
            run,
            u,
            y,
            min(2.9, width - 0.4),
            1.9,
            "source-recess-upper-loggia",
            floor,
            dark=True,
          )
          self.emit(
            wall,
            run,
            u,
            y - 0.40,
            min(3.0, width - 0.35),
            0.045,
            0.045,
            0.30,
            RAIL,
            "source-recess-loggia-rail",
            "source-recess-upper-loggia",
            floor,
          )
        else:
          self.opening(
            wall,
            run,
            u,
            y,
            opening_width,
            regular_height,
            "photographic-upper-or-low-loggia"
            if photo_loggia
            else "wrapped-source-oriel"
            if column_oriel
            else "aligned-ordinary-window-column",
            floor,
            dark=column_oriel or modern,
            french=not column_oriel and not modern and not school,
          )
          if photo_loggia:
            # This is a rail/back-pane cue on a measured source wall, never a
            # claimed excavated loggia, new balcony floor or collision opening.
            self.emit(
              wall,
              run,
              u,
              y - 0.40,
              opening_width + 0.10,
              0.055,
              0.06,
              0.26,
              RAIL,
              "photographic-loggia-rail",
              "photographic-upper-or-low-loggia",
              floor,
            )
    if vertical["groundUse"] == "corner-shopfront":
      ground_y = vertical["datumY"]
      # A continuous EG shop composition wraps the measured corner planes.
      # It creates no new door aperture or navigable passage and copies no logo.
      shop_centers = (
        [axis["u"] for axis in centers] if width >= 5.5 else [(u0 + u1) / 2]
      )
      shop_width = min(layout["bayModuleM"] - 0.14, width - 0.25)
      for u in shop_centers:
        self.opening(
          wall,
          run,
          u,
          ground_y + 1.62,
          shop_width,
          2.43,
          "continuous-corner-shopfront",
          -1,
          dark=False,
        )
      self.rectangle(
        wall,
        run,
        u0 + 0.05,
        base_top - 0.45,
        u1 - 0.05,
        base_top - 0.04,
        0xE1E0D8,
        "shopfront-white-fascia",
        0.14,
        0.10,
      )
    else:
      for axis in centers:
        u = axis["u"]
        self.opening(
          wall,
          run,
          u,
          vertical["datumY"] + 1.80,
          regular_width,
          1.85,
          "independent-residential-ground-floor",
          -1,
          dark=modern,
        )
    # New roof-front joinery is restricted to an actual narrow higher measured
    # source wall/return. No roof, dormer mass, crown or cut is invented.
    if not modern and not school and width < 6.2 and y1 > eave + 1.8:
      roof_y = (
        vertical["roofOpeningCenters"][0] if vertical["roofOpeningCenters"] else 0
      )
      for u in [(u0 + u1) / 2]:
        self.opening(
          wall,
          run,
          u,
          roof_y,
          min(width - 0.40, 2.9),
          min(1.9, y1 - eave - 0.25),
          "actual-measured-roof-front-joinery",
          -2,
          dark=True,
        )


def svg_comparison(output: Path, baseline, candidate, compositions):
  layouts = {r["run"]: r for r in compositions["runs"]}
  runs = [r for r in candidate["runs"] if r["family"] == ELSER]
  width, height, scale = 1400, 1170, 11.0
  elements = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
    '<rect width="100%" height="100%" fill="#f5f3ec"/>',
    '<text x="24" y="30" font-family="sans-serif" font-size="20">Elser corner — common source masks; facade composition comparison</text>',
    '<text x="24" y="54" font-family="sans-serif" font-size="13">Analytical elevation projection, not a viewer screenshot or metric window survey. Source shell/roof unchanged.</text>',
  ]
  vertical = next(f for f in compositions["families"] if f["family"] == ELSER)
  for col, run in enumerate(runs):
    layout = layouts[run["id"]]
    lo = min(a for a, _ in layout["streetIntervals"])
    for generation, profile in enumerate([baseline, candidate]):
      ox, oy = 30 + col * 680, 80 + generation * 535
      elements.append(
        f'<text x="{ox}" y="{oy}" font-family="sans-serif" font-size="17">{"V324 independent panel grids" if generation == 0 else "V325 shared floors, wrapped bays, shop base"} — run {run["id"]}</text>'
      )

      def x(s):
        return ox + 12 + (s - lo) * scale

      def y(v):
        return oy + 475 - (v - vertical["datumY"]) * scale

      for patch in run["patches"]:
        p = [point(patch, u, yy) for u, yy in patch["rings"][0]]
        values = " ".join(
          f"{x(q[0] * layout['tangent'][0] + q[2] * layout['tangent'][1]):.3f},{y(q[1]):.3f}"
          for q in p
        )
        elements.append(
          f'<polygon points="{values}" fill="#d1cabc" stroke="#847d72" stroke-width=".7"/>'
        )
      for row in sorted(profile["drawn"], key=lambda row: row[8] == "glazing"):
        xx, yy, zz, w, h, _dep, angle, rgb, role, rid = row
        if rid != run["id"] or role not in {"glazing", "wall-material"}:
          continue
        s = xx * layout["tangent"][0] + zz * layout["tangent"][1]
        projected = (
          abs(
            math.cos(angle) * layout["tangent"][0]
            - math.sin(angle) * layout["tangent"][1]
          )
          * w
        )
        elements.append(
          f'<rect x="{x(s - projected / 2):.3f}" y="{y(yy + h / 2):.3f}" width="{projected * scale:.3f}" height="{h * scale:.3f}" fill="#{rgb:06x}"/>'
        )
      if generation:
        for center in vertical["residentialFloorCenters"]:
          elements.append(
            f'<line x1="{ox + 5}" x2="{ox + 655}" y1="{y(center):.3f}" y2="{y(center):.3f}" stroke="#a45632" opacity=".35" stroke-dasharray="4 5"/>'
          )
  elements.append("</svg>")
  output.write_text("\n".join(elements) + "\n")


def compile_composition(baseline_path: Path, families_path: Path, output_dir: Path):
  output_dir = output_dir.resolve()
  if output_dir == ROOT or ROOT in output_dir.parents:
    raise ValueError("Review output must stay outside the product repository")
  baseline, sources = read(baseline_path), read(families_path)
  if len(baseline["families"]) != 19 or len(baseline["runs"]) != 38:
    raise ValueError("Complete current19-family/38-mask input required")
  lookup = {f["id"]: f for f in sources["buildings"]}
  if any(f["id"] not in lookup for f in baseline["families"]):
    raise ValueError("Every complete original family is required")
  original = {}
  for family in baseline["families"]:
    for wall in walls(lookup[family["id"]], sources["buildings"]):
      for sid in wall["sourcePolygonIds"]:
        original[sid] = wall
  for run in baseline["runs"]:
    for patch in run["patches"]:
      actual = original.get(patch["sourcePolygonIds"][0])
      if not actual or any(
        compact(actual[k]) != compact(patch[k])
        for k in ["part", "n", "d", "c", "rings", "bounds"]
      ):
        raise ValueError("Changed/missing complete original supporting wall")
  verticals = [
    vertical_composition(
      family, [r for r in baseline["runs"] if r["family"] == family["id"]]
    )
    for family in baseline["families"]
  ]
  by_family = {v["family"]: v for v in verticals}
  layouts = [run_composition(run, by_family[run["family"]]) for run in baseline["runs"]]
  compositor = Compositor(baseline, sources)
  for run, layout in zip(baseline["runs"], layouts, strict=True):
    for patch in run["patches"]:
      compositor.wall(
        original[patch["sourcePolygonIds"][0]], run, by_family[run["family"]], layout
      )
  # Independent final proof uses the serialized, rounded actual new rows.
  for row, record in zip(compositor.rows, compositor.proof, strict=True):
    wall = original[record["sourcePolygonIds"][0]]
    u = row[0] * wall["d"][0] + row[2] * wall["d"][1]
    if (
      not wall["_polygon"]
      .buffer(0.00001)
      .covers(
        box(u - row[3] / 2, row[1] - row[4] / 2, u + row[3] / 2, row[1] + row[4] / 2)
      )
    ):
      raise ValueError("Rounded fitting escaped its complete source polygon")
  if len(compositor.rows) > len(baseline["drawn"]):
    raise ValueError(
      f"New composition must fit the previous fitting/scene budget: {len(compositor.rows)}>{len(baseline['drawn'])}; {dict(Counter(row[8] for row in compositor.rows))}"
    )
  per_run = Counter(
    p["run"]
    for row, p in zip(compositor.rows, compositor.proof, strict=True)
    if row[8] == "glazing"
  )
  if set(per_run) != {run["id"] for run in baseline["runs"]}:
    raise ValueError("Every original run must retain nonempty new fitting coverage")
  profile = copy.deepcopy(baseline)
  profile["drawn"] = compositor.rows
  for run in profile["runs"]:
    run["windowCount"] = per_run[run["id"]]
  profile["estimates"] = {
    **profile["estimates"],
    "compositionV325": "shared family storeys/run axes; Elser shopfront/oriel/roof-front composition; source-contained display estimates",
  }
  composition = {
    "schemaVersion": 1,
    "baselineSha256": sha(baseline_path),
    "completeFamilySourceSha256": sha(families_path),
    "families": verticals,
    "runs": layouts,
    "drawnCandidateOnly": True,
    "nativeStatus": "unchanged V324 baseline pending independent full-wall-supported composition",
    "bodiesRoofsHolesNavigationChanged": False,
    "frenchRailModuloSelection": False,
    "precision": "named photographic composition and small fittings are interpretations; all retained wall support is exact",
  }
  metrics = {
    "beforeRows": len(baseline["drawn"]),
    "afterRows": len(profile["drawn"]),
    "beforeWindowGroups": sum(r["windowCount"] for r in baseline["runs"]),
    "afterWindowGroups": sum(per_run.values()),
    "roles": dict(Counter(r[8] for r in profile["drawn"])),
    "labels": dict(Counter(p["label"] for p in compositor.proof)),
    "rejectedUnsupportedCandidates": dict(compositor.rejected),
    "sourceWallPolygons": len(original),
    "usedWallPolygons": len({p["sourcePolygonIds"][0] for p in compositor.proof}),
    "fullRowContainmentProofs": len(profile["drawn"]),
    "families": 19,
    "runs": 38,
  }
  run_family = {r["id"]: r["family"] for r in baseline["runs"]}
  metrics["familyFloorComparison"] = [
    {
      "family": family,
      "beforeIndependentGlazingYCount": len(
        {
          row[1]
          for row in baseline["drawn"]
          if row[8] == "glazing" and run_family[row[9]] == family
        }
      ),
      "afterSharedResidentialYCount": len(vertical["residentialFloorCenters"]),
      "afterSharedResidentialYs": vertical["residentialFloorCenters"],
      "allResidentialGlazingUsesSharedFloor": all(
        row[1] == vertical["residentialFloorCenters"][record["floor"]]
        for row, record in zip(compositor.rows, compositor.proof, strict=True)
        if record["family"] == family
        and row[8] == "glazing"
        and record["floor"] is not None
        and record["floor"] >= 0
      ),
    }
    for family, vertical in by_family.items()
  ]
  output_dir.mkdir(parents=True, exist_ok=True)
  candidate = output_dir / "wilhelmHousingCompositionV325.json"
  candidate.write_bytes(compact(profile) + b"\n")
  (output_dir / "composition-metadata-v325.json").write_bytes(
    compact(composition) + b"\n"
  )
  (output_dir / "composition-row-proof-v325.json").write_bytes(
    compact(compositor.proof) + b"\n"
  )
  controls = recipe_controls(candidate)
  (output_dir / "composition-comparison-v325.json").write_text(
    json.dumps(
      {
        **metrics,
        "controls": controls,
        "candidateSha256": sha(candidate),
        "baselineUnchanged": sha(baseline_path) == composition["baselineSha256"],
        "newNativePending": True,
      },
      indent=2,
    )
    + "\n"
  )
  svg_comparison(
    output_dir / "elser-composition-before-after-v325.svg",
    baseline,
    profile,
    composition,
  )
  print(
    json.dumps(
      {
        **{k: v for k, v in metrics.items() if k != "familyFloorComparison"},
        "output": str(candidate),
        "controls": controls,
      }
    )
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument(
    "--baseline", type=Path, default=ROOT / "src/app/src/data/wilhelmHousingV324.json"
  )
  parser.add_argument(
    "--families",
    type=Path,
    required=True,
    help="Complete original external family records including neighbours",
  )
  parser.add_argument(
    "--output-dir",
    type=Path,
    required=True,
    help="External review directory, never a product-data path",
  )
  args = parser.parse_args()
  output = args.output_dir.resolve()
  if output == ROOT or ROOT in output.parents:
    parser.error("Review output must stay outside the product repository")
  compile_composition(args.baseline.resolve(), args.families.resolve(), output)
