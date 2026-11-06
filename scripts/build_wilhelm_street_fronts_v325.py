"""Compose the additional eleven real street families through nine photo styles.

The input is the finite audited set of actual resident/Core wall planes, not a
selection of unrelated survey walls. No body, roof, void or navigation changes.
Native uses its independent complete cardinal wall unions and existing floor
metadata. Outputs remain outside the product until the owner accepts the proof.
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

from build_wilhelm_composition_v325 import Compositor, dot, point
from build_wilhelm_housing_v324 import compact, read, recipe_controls
from shapely import make_valid
from shapely.geometry import Polygon, box
from wilhelm_street_photo_styles_v325 import (
  DISPLAY_TYPES,
  STYLE_PARAMETERS,
  emit_photo_style,
)

ROOT = Path(__file__).resolve().parents[1]
MATERIALS = {
  "robert-koch-brick": 0xBFA477,
  "wilhelm65-folded-glass": 0x7D939D,
  "gdv-colonnade": 0xB9BFBC,
  "rossi-brick-green": 0xA2634E,
  "grupo2c-block9": 0x9A5D4C,
  "kita-segmental-brick": 0xB17E50,
  "de-rossi-colour": 0x9F5F4B,
  "beulwitz-terraces": 0xD9D9CC,
  "fehling-curved-bands": 0xD3C1BA,
}


def sha(path: Path) -> str:
  return hashlib.sha256(path.read_bytes()).hexdigest()


def family_layout(family: dict[str, Any], runs: list[dict[str, Any]]) -> dict[str, Any]:
  style = family["displayType"]
  if style not in DISPLAY_TYPES:
    raise ValueError("An exact named photographic display type is required")
  parameters = STYLE_PARAMETERS[style]
  patches = [p for run in runs for p in run["patches"]]
  datum = min(p["bounds"][1] for p in patches)
  top = max(p["bounds"][3] for p in patches)
  base_height = parameters["groundFloorHeightM"]
  base_top = datum + base_height
  # The tall tower and lower wings share the same family axes. Individual
  # actual wall polygons alone decide which upper storeys are supported.
  if "floorCount" in parameters:
    count = int(parameters["floorCount"]) - 1
    pitch = (top - base_top - 0.45) / count
  else:
    pitch = parameters["targetPitchM"]
    count = max(1, math.floor((top - base_top - 0.4) / pitch))
  upper = [round(base_top + (i + 0.5) * pitch, 6) for i in range(count)]
  centers = [round(datum + base_height / 2, 6), *upper]
  return {
    "family": family["id"],
    "displayType": style,
    "datumY": datum,
    "groundFloorRange": [datum, base_top],
    "sharedFamilyFloors": centers,
    "residentialFloorCenters": upper,
    "residentialPitchM": pitch,
    "roofZoneRange": [top - 0.45, top],
    "bayModuleM": parameters["bayModuleM"],
    "precision": "photo-guided shared storey/module interpretation on the actual retained wall support, not surveyed openings",
  }


def run_layout(run: dict[str, Any], family: dict[str, Any]) -> dict[str, Any]:
  normal = run.get("normal", max(run["patches"], key=lambda p: p["area"])["n"])
  length = math.hypot(*normal)
  n = [v / length for v in normal]
  d = [n[1], -n[0]]
  intervals = []
  for patch in run["patches"]:
    positions = [point(patch, u, y) for u, y in patch["rings"][0]]
    values = [p[0] * d[0] + p[2] * d[1] for p in positions]
    intervals.append([min(values), max(values)])
  lo, hi = min(a for a, _ in intervals), max(b for _, b in intervals)
  module = family["bayModuleM"]
  origin = lo + module / 2
  axes = [
    {"s": round(origin + i * module, 6), "column": i}
    for i in range(max(1, math.ceil((hi - origin) / module)))
    if origin + i * module < hi - 0.18
  ]
  return {
    "run": run["id"],
    "family": run["family"],
    "normal": n,
    "tangent": d,
    "bayModuleM": module,
    "bayOriginS": origin,
    "globalAxes": axes,
    "streetIntervals": intervals,
    "phasePolicy": "one complete original run, never one source leaf",
  }


class StreetCompositor(Compositor):
  def __init__(self, profile, sources, native=False):
    super().__init__(profile, sources)
    self.native = native
    self.final_unique: set[bytes] = set()
    self.current_style = ""

  def emit(
    self, wall, run, u, y, width, height, depth, offset, rgb, role, label, floor=None
  ):
    before = len(self.rows)
    super().emit(wall, run, u, y, width, height, depth, offset, rgb, role, label, floor)
    if len(self.rows) == before:
      return False
    row = self.rows[-1]
    if self.native:
      n = wall["n"]
      if not ((abs(n[0]) == 1 and n[1] == 0) or (abs(n[1]) == 1 and n[0] == 0)):
        raise ValueError("Native fitting requires an actual cardinal wall union")
      if n[0]:
        row[3], row[5] = row[5], row[3]
      row[6] = 0
    key = compact(row)
    if key in self.final_unique:
      self.rows.pop()
      self.proof.pop()
      return False
    self.final_unique.add(key)
    self.proof[-1].update(
      {
        "displayType": self.current_style,
        "sourceKind": wall.get("sourceKind", "actual-native-wall-union"),
        "sourceTriangleOrdinals": wall.get("sourceTriangleOrdinals", []),
      }
    )
    return True


def context_for(wall, run, family, layout):
  u0, y0, u1, y1 = wall["bounds"]
  denominator = dot(wall["d"], layout["tangent"])
  shift = wall["c"] * dot(wall["n"], layout["tangent"])
  axes = []
  if abs(denominator) > 0.14:
    for axis in layout["globalAxes"]:
      u = (axis["s"] - shift) / denominator
      if u0 + 0.08 <= u <= u1 - 0.08:
        axes.append({**axis, "u": u})
  wall_role = "return" if dot(wall["n"], layout["normal"]) < 0.90 else "street"
  return {
    "family": run["family"],
    "run": run["id"],
    "sourcePolygonId": wall["sourcePolygonIds"][0],
    "uMin": u0 + 0.018,
    "uMax": u1 - 0.018,
    "yMin": y0 + 0.018,
    "yMax": y1 - 0.018,
    "datumY": family["datumY"],
    "groundFloorRange": family["groundFloorRange"],
    "sharedFamilyFloors": family["sharedFamilyFloors"],
    "residentialPitchM": family["residentialPitchM"],
    "roofZoneRange": family["roofZoneRange"],
    "globalAxes": axes,
    "bayModuleM": layout["bayModuleM"],
    "wallNormal": wall["n"],
    "wallRole": wall_role,
    "hasEntrance": False,
    "fits": lambda u, y, w, h: (
      wall["_polygon"]
      .buffer(-0.012)
      .covers(box(u - w / 2, y - h / 2, u + w / 2, y + h / 2))
    ),
  }


def material_fields(compositor, wall, run, family, ctx):
  """Thin source-contained fields; never whole new volume or courtyard fill."""
  boundaries = [ctx["yMin"], ctx["yMax"]]
  centers = family["sharedFamilyFloors"]
  boundaries += [
    (a + b) / 2
    for a, b in zip(centers, centers[1:])
    if ctx["yMin"] < (a + b) / 2 < ctx["yMax"]
  ]
  boundaries = sorted(boundaries)
  style = family["displayType"]
  for low, high in zip(boundaries, boundaries[1:]):
    color = MATERIALS[style]
    if (
      style == "de-rossi-colour"
      and (low + high) / 2 >= centers[min(6, len(centers) - 1)]
    ):
      color = 0x89748F
    compositor.emit(
      wall,
      run,
      (ctx["uMin"] + ctx["uMax"]) / 2,
      (low + high) / 2,
      ctx["uMax"] - ctx["uMin"],
      high - low - 0.025,
      0.018,
      0.020,
      color,
      "wall-material",
      "photographic family material field",
      None,
    )


def compile_fronts(
  input_path: Path,
  families_path: Path,
  native_path: Path,
  output_dir: Path,
  expected_input_sha: str,
  expected_native_sha="193c3bd4b59c53bf6d4da38d6a66fe2ba65f6d36310fa498af10d3f5f98eadc6",
  reference_path: Path | None = None,
):
  output_dir = output_dir.resolve()
  if output_dir == ROOT or ROOT in output_dir.parents:
    raise ValueError("Unaccepted review candidates must remain outside the product")
  if sha(input_path) != expected_input_sha:
    raise ValueError("Changed audited complete street-wall input")
  if sha(native_path) != expected_native_sha:
    raise ValueError("Changed complete actual Native wall support")
  if (
    reference_path is None
    or sha(reference_path)
    != "709853294729b120d3ec051b1646e149e193663085d80a8042e99841cd8e015e"
  ):
    raise ValueError("Complete reviewed nine-photo/primary reference plan required")
  reference_plan = read(reference_path)
  if (
    len(reference_plan["groups"]) != 9
    or {g["displayType"] for g in reference_plan["groups"]} != DISPLAY_TYPES
  ):
    raise ValueError("Incomplete photographic display-type evidence")
  profile, sources, support = read(input_path), read(families_path), read(native_path)
  if (
    len(profile["families"]) != 11
    or len(profile["runs"]) != 22
    or len({f["displayType"] for f in profile["families"]}) != 9
  ):
    raise ValueError(
      "Complete eleven-family/nine-style/twenty-two-run inventory required"
    )
  if len({run["id"] for run in profile["runs"]}) != 22:
    raise ValueError("Duplicate original source run")
  polygon_runs = {}
  for run in profile["runs"]:
    for patch in run["patches"]:
      for sid in patch["sourcePolygonIds"]:
        if sid in polygon_runs and polygon_runs[sid] != run["id"]:
          raise ValueError("One actual wall cannot restart a second street phase")
        polygon_runs[sid] = run["id"]
  vertical = [
    family_layout(f, [r for r in profile["runs"] if r["family"] == f["id"]])
    for f in profile["families"]
  ]
  families = {f["family"]: f for f in vertical}
  layouts = [run_layout(run, families[run["family"]]) for run in profile["runs"]]
  by_run = {run["id"]: run for run in profile["runs"]}
  by_layout = {layout["run"]: layout for layout in layouts}
  # Some complete southern source records retain metric part heights rather
  # than transformed world tops. Occlusion queries conservatively use the
  # completed actual rendered family wall maximum, without changing a source.
  query_sources = copy.deepcopy(sources)
  for family in query_sources["buildings"]:
    maximum = max(
      p["bounds"][3]
      for r in profile["runs"]
      if r["family"] == family["id"]
      for p in r["patches"]
    )
    for part in family["parts"]:
      if "topY" not in part:
        part["topY"] = maximum
  binding_path = ROOT / "src/app/src/data/wilhelmStreetFrontsV325Sources.json"
  bindings = read(binding_path)
  repaired_queries = []
  for prism in bindings["contributorPrisms"]:
    polygon = Polygon(
      [(x / 10, z / 10) for x, z in prism["ring"]],
      [[(x / 10, z / 10) for x, z in hole] for hole in prism.get("holes", [])],
    )
    if not polygon.is_valid:
      repaired_queries.append(prism["id"])
      polygon = make_valid(polygon)
    parts = list(polygon.geoms) if hasattr(polygon, "geoms") else [polygon]
    polygons = [
      {"ring": list(p.exterior.coords), "holes": [list(h.coords) for h in p.interiors]}
      for p in parts
      if p.geom_type == "Polygon"
    ]
    query_sources["buildings"].append(
      {
        "id": "foreign-occluder:" + prism["id"],
        "footprintPolygons": polygons,
        "parts": [{"topY": (prism["y0_dm"] + prism["h_dm"]) / 10}],
      }
    )
  compositors = [
    StreetCompositor(profile, query_sources, native) for native in [False, True]
  ]
  proof_walls = []
  for native, compositor in zip([False, True], compositors, strict=True):
    selected = (
      [(run, patch) for run in profile["runs"] for patch in run["patches"]]
      if not native
      else [(by_run[s["run"]], s) for s in support["surfaces"]]
    )
    current_walls = {}
    for index, (run, patch) in enumerate(selected):
      wall = copy.deepcopy(patch)
      wall["_polygon"] = Polygon(wall["rings"][0], wall["rings"][1:])
      if not wall["_polygon"].is_valid or wall["_polygon"].is_empty:
        raise ValueError("A complete valid source wall/hole polygon is required")
      if native:
        wall["bounds"] = list(wall["_polygon"].bounds)
        wall["sourcePolygonIds"] = [f"native-full-wall-{index}"]
        wall["part"] = patch.get("part", run["family"])
        wall["sourceKind"] = "independently proven cardinal full wall union"
      current_walls[wall["sourcePolygonIds"][0]] = wall
      family, layout = families[run["family"]], by_layout[run["id"]]
      # Native bay placement is a separate world-cardinal lattice, not a
      # rotation/copy of a Drawn corner/window. Only the family storeys agree.
      if native:
        n = wall["n"]
        tangent = [n[1], -n[0]]
        projected = [
          dot([p[0], p[2]], tangent)
          for p in (point(wall, u, y) for u, y in wall["rings"][0])
        ]
        s0, s1 = min(projected), max(projected)
        module = family["bayModuleM"]
        start = math.ceil((s0 + 0.2) / module)
        layout = {
          **layout,
          "normal": n,
          "tangent": tangent,
          "globalAxes": [
            {"s": round(i * module, 6), "column": i}
            for i in range(start, math.floor((s1 - 0.2) / module) + 1)
          ],
        }
      ctx = context_for(wall, run, family, layout)
      compositor.current_style = family["displayType"]
      material_fields(compositor, wall, run, family, ctx)
      emit_photo_style(
        family["displayType"],
        ctx,
        lambda *args, wall=wall, run=run: compositor.emit(wall, run, *args),
      )
    # Prove the serialized final rows independently, after their rounding and
    # cardinal Native axis conversion. Do not trust centre-only placement.
    for row, receipt in zip(compositor.rows, compositor.proof, strict=True):
      wall = current_walls[receipt["sourcePolygonIds"][0]]
      width = (
        abs(wall["d"][0]) * row[3] + abs(wall["d"][1]) * row[5] if native else row[3]
      )
      u = row[0] * wall["d"][0] + row[2] * wall["d"][1]
      if (
        not wall["_polygon"]
        .buffer(0.00001)
        .covers(
          box(u - width / 2, row[1] - row[4] / 2, u + width / 2, row[1] + row[4] / 2)
        )
      ):
        raise ValueError("Rounded complete fitting escaped its actual retained wall")
      if native and row[6] != 0:
        raise ValueError("A rotated Drawn clone cannot be a Native fitting")
    if len(compositor.rows) > 65000:
      raise ValueError("Finite additional fitting budget exceeded")
    proof_walls.append(
      {
        sid: {k: v for k, v in wall.items() if not k.startswith("_")}
        for sid, wall in current_walls.items()
      }
    )
  candidate = copy.deepcopy(profile)
  references = list(profile.get("references", []))
  for group in reference_plan["groups"]:
    references.extend(
      [group["primaryUrl"], group["photo"]["url"], group["photo"]["licenseUrl"]]
    )
  for family in sources["buildings"]:
    references.extend(
      part["sourceUrl"] for part in family["parts"] if part.get("sourceUrl")
    )
  candidate["references"] = list(dict.fromkeys(references))
  candidate["drawn"], candidate["native"] = (c.rows for c in compositors)
  for family in candidate["families"]:
    family["neutralBackingRgb"] = MATERIALS[family["displayType"]]
  for run in candidate["runs"]:
    run["windowCount"] = sum(
      row[8] == "glazing" and row[9] == run["id"] for row in candidate["drawn"]
    )
  native_runs = {row[9] for row in candidate["native"]}
  optional = {
    item["run"] if isinstance(item, dict) else item
    for item in support.get("unexposedNativeRuns", [])
  }
  if {r["id"] for r in profile["runs"]} - native_runs != optional:
    raise ValueError("Unexpected missing actual Native run")
  for mode in ["drawn", "native"]:
    if {by_run[row[9]]["family"] for row in candidate[mode]} != set(families):
      raise ValueError("Every named family must have a real positive fitting")
  candidate["estimates"] = {
    **candidate.get("estimates", {}),
    "compositionV325": "nine reference-specific visual treatments on complete actual retained wall planes; no micro-wall phase reset",
    "unexposedNativeRuns": sorted(optional),
  }
  output_dir.mkdir(parents=True, exist_ok=True)
  file = output_dir / "wilhelmStreetFrontsV325.candidate.json"
  file.write_bytes(compact(candidate) + b"\n")
  (output_dir / "street-photo-credits-v325.json").write_bytes(
    compact(
      {
        "referencePlanSha256": sha(reference_path),
        "pixelAssetsBundled": False,
        "groups": [
          {
            "displayType": group["displayType"],
            "primaryUrl": group["primaryUrl"],
            "photo": group["photo"],
          }
          for group in reference_plan["groups"]
        ],
      }
    )
    + b"\n"
  )
  (output_dir / "street-composition-metadata-v325.json").write_bytes(
    compact(
      {
        "schemaVersion": 1,
        "families": vertical,
        "runs": layouts,
        "auditedInputSha256": sha(input_path),
        "nativeSupportSha256": sha(native_path),
        "completeFamilySourceSha256": sha(families_path),
        "bindingSourceSha256": sha(binding_path),
        "foreignOccludersBoundInBothModes": len(bindings["contributorPrisms"]),
        "queryOnlyRepairedForeignRings": repaired_queries,
        "unexposedNativeRuns": sorted(optional),
      }
    )
    + b"\n"
  )
  for native, compositor, walls in zip(
    [False, True], compositors, proof_walls, strict=True
  ):
    mode = "native" if native else "drawn"
    (output_dir / f"street-{mode}-row-proof-v325.json").write_bytes(
      compact({"walls": walls, "rows": compositor.proof}) + b"\n"
    )
  report = {
    "families": 11,
    "displayTypes": 9,
    "runs": 22,
    "sourcePatches": sum(len(r["patches"]) for r in profile["runs"]),
    "drawnRows": len(candidate["drawn"]),
    "nativeRows": len(candidate["native"]),
    "drawnRoles": dict(Counter(row[8] for row in candidate["drawn"])),
    "nativeRoles": dict(Counter(row[8] for row in candidate["native"])),
    "candidateSha256": sha(file),
    "controls": recipe_controls(file),
    "allSerializedRectanglesContained": True,
    "nativeMatricesCardinal": True,
    "unexposedNativeRuns": sorted(optional),
    "sourceBodiesRoofsVoidsNavigationChanged": False,
    "referenceUrls": len(candidate["references"]),
    "reviewedPhotoSources": 9,
  }
  (output_dir / "street-composition-proof-v325.json").write_text(
    json.dumps(report, indent=2) + "\n"
  )
  print(json.dumps(report))


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--input", type=Path, required=True)
  parser.add_argument("--expected-input-sha256", required=True)
  parser.add_argument("--families", type=Path, required=True)
  parser.add_argument("--native-support", type=Path, required=True)
  parser.add_argument(
    "--expected-native-sha256",
    default="0269dc64fae76c582e6e21ffcfbeeb393740f32f0f3e23316b9de48ad6f7af9e",
  )
  parser.add_argument("--output-dir", type=Path, required=True)
  parser.add_argument("--reference-plan", type=Path, required=True)
  args = parser.parse_args()
  compile_fronts(
    args.input,
    args.families,
    args.native_support,
    args.output_dir,
    args.expected_input_sha256,
    args.expected_native_sha256,
    args.reference_plan,
  )
