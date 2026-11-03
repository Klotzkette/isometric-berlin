"""One finite union transfer for all measured v306/v307 ground fields.

The input is the complete, final decoded v195 predecessor captured by the
bounded companion script. Unchanged outside fragments retain all UInt16 linear
paint. Inside fragments live only in the atomic required contact root.
"""

from __future__ import annotations

import argparse
import base64
from pathlib import Path
from typing import Any

import numpy as np
from build_north_park_terrain_v306 import baseline_height_v306, sample_offset_v306
from build_rail_sse_v307 import (
  DATA,
  GEO,
  ROOT,
  read_v307,
  sha_v307,
  terrain_fields_v307,
  write_v307,
)
from shapely.geometry import box, shape
from terrain_fields_v307 import TerrainFieldV307, TerrainMeshV307, compile_ground_v307


def complete_fields_v307() -> list[TerrainFieldV307]:
  """The disjoint measured domains, with no outer fade or duplicated triangle."""
  fields = []
  for p in read_v307(DATA / "northParkTerrainV306.json")["profiles"]:
    fields.append(
      TerrainFieldV307(
        p["key"],
        shape(p["domain"]),
        tuple(p["bounds"]),
        p["step"],
        lambda x, z, native=False, p=p: sample_offset_v306(p, x, z, native),
        baseline_height_v306,
      )
    )
  return fields + terrain_fields_v307()


def predecessor_parts_v307(capture: dict[str, Any]) -> list[dict[str, Any]]:
  """Split actual final buffers back into the pinned original part ordinals."""
  positions = np.frombuffer(
    base64.b64decode(capture["mesh"]["positions"]), "<u2"
  ).reshape(-1, 3)
  colors = np.frombuffer(base64.b64decode(capture["mesh"]["colors"]), "<u2").reshape(
    -1, 3
  )
  indices = np.frombuffer(base64.b64decode(capture["mesh"]["indices"]), "<u4")
  result = []
  for p in capture["parts"]:
    start, end = p["vertexStart"], p["vertexStart"] + p["vertexCount"]
    ix = (
      indices[p["indexStart"] : p["indexStart"] + p["indexCount"]].astype(np.int64)
      - start
    )
    if ix.size and (ix.min() < 0 or ix.max() >= p["vertexCount"]):
      raise ValueError("Final source part ordinals changed")
    result.append(
      dict(
        mesh=p["mesh"],
        kind=p["kind"],
        positions=base64.b64encode(positions[start:end].tobytes()).decode(),
        colors=base64.b64encode(colors[start:end].tobytes()).decode(),
        indices=base64.b64encode(ix.astype("<u4").tobytes()).decode(),
      )
    )
  return result


def _is_ground_v307(
  native: bool, kind: str, p: np.ndarray, _colors: np.ndarray
) -> bool:
  if kind != "city":
    return False
  lifts = (0, 0.01, 0.015, 0.035, 0.05, 0.07, 0.09, 0.12, 0.15)
  for x, y, z in p:
    candidates = (
      [(x, z)]
      if not native
      else [(x + dx, z + dz) for dx in (-0.002, 0.002) for dz in (-0.002, 0.002)]
    )
    if not any(
      abs(y - baseline_height_v306(float(a), float(b), native) - lift) < 0.027
      for a, b in candidates
      for lift in lifts
    ):
      return False
  return True


def _merge_v307(mesh: TerrainMeshV307, packed: dict[str, Any] | None) -> None:
  if packed is None:
    return
  p = (
    np.frombuffer(base64.b64decode(packed["positions"]), "<u2")
    .reshape(-1, 3)
    .astype(float)
    / 100
    + packed["origin"]
  )
  c = np.frombuffer(base64.b64decode(packed["colors"]), "<u2").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(packed["indices"]), "<u4").reshape(-1, 3)
  for t in ix:
    mesh.add(p[t], c[t])


def build_contact_v307(captures: Path) -> None:
  """Compile complete union recipes and all required mode-specific contact parts."""
  fields = complete_fields_v307()
  manifest = read_v307(
    ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json"
  )
  ids = [
    q["id"]
    for q in manifest["chunks"]
    if any(f.domain.intersects(box(*q["bounds"])) for f in fields)
  ]
  packets: dict[str, Any] = {}
  contacts = []
  evidence = []
  for native in (False, True):
    mode = "minecraft" if native else "drawn"
    for identity in ids:
      path = captures / f"{identity}.{mode}.json"
      capture = read_v307(path)
      result = compile_ground_v307(
        predecessor_parts_v307(capture),
        capture["origin"],
        fields,
        native=native,
        ground_predicate=lambda k, p, c: _is_ground_v307(native, k, p, c),
      )
      if not result["parts"]:
        continue
      outside = TerrainMeshV307(capture["origin"])
      field_meshes = {f.key: TerrainMeshV307(capture["origin"]) for f in fields}
      for part in result["parts"]:
        _merge_v307(outside, part["outside"])
        for field, packed in part["fields"].items():
          _merge_v307(field_meshes[field], packed)
      required = []
      for field, mesh in field_meshes.items():
        packed = mesh.packed()
        if packed:
          contacts.append(
            dict(key=f"{mode}:{identity}:{field}", field=field, native=native, **packed)
          )
          required.append(field)
      raw, prepared = capture["pins"]["raw"], capture["pins"]["prepared"]
      plan = dict(
        origin=capture["origin"],
        records=raw["records"],
        preparedRecords=prepared["records"],
        navGuard=raw["nav"],
        lineGuard=raw["lines"],
        preparedNavGuard=prepared["nav"],
        preparedLineGuard=prepared["lines"],
        retire=[
          dict(mesh=p["mesh"], triangles=p["retireTriangles"]) for p in result["parts"]
        ],
        retireLines=[],
        retireNav=[],
        appendNav=[],
        owners=[f"measured-ground-v307:{f}" for f in required],
      )
      packed = outside.packed()
      if packed:
        plan["append"] = {
          k: v
          for k, v in packed.items()
          if k not in ("origin", "vertices", "triangles")
        }
        plan["append"]["kind"] = "measured-ground-outside-v307"
        # Exact same concatenated-string FNV as surroundingPacketFingerprint.
        h = 2166136261
        for character in (
          plan["append"]["positions"]
          + plan["append"]["colors"]
          + plan["append"]["indices"]
        ):
          h = ((h ^ ord(character)) * 16777619) & 0xFFFFFFFF
        plan["appendFingerprint"] = h
      key = f"{mode}:{identity}"
      packets[key] = plan
      evidence.append(
        dict(
          key=key,
          captureSha256=sha_v307(path),
          origin=capture["origin"],
          requiredFields=required,
          parts=[
            {k: v for k, v in p.items() if k not in ("outside", "fields")}
            for p in result["parts"]
          ],
        )
      )
      print(
        key,
        sum(len(p["retireTriangles"]) for p in result["parts"]),
        sum(q["triangles"] for q in contacts if q["key"].startswith(key + ":")),
        flush=True,
      )
  write_v307(
    DATA / "railTerrainContactV307.json",
    dict(schemaVersion=1, fields=[f.key for f in fields], meshes=contacts),
  )
  write_v307(
    DATA / "railTerrainContactV307Packets.json",
    dict(schemaVersion=1, keys=list(packets), packets=packets),
  )
  for packet in evidence:
    for part in packet["parts"]:
      part.pop("outside", None)
      part.pop("fields", None)
      part["provenanceColumns"] = [
        "sourceTriangle",
        "sourceAreaM2",
        "outsideAreaM2",
        "outsideTriangles",
        "verticalSourcePlane",
        "fields",
      ]
      part["provenanceRows"] = [
        [
          v["sourceTriangle"],
          v["sourceAreaM2"],
          v["outsideAreaM2"],
          v.get("outsideTriangles", 0),
          v.get("verticalSourcePlane", False),
          v["fields"],
        ]
        for v in part.pop("provenance")
      ]
  write_v307(
    GEO / "rail-terrain-contact-v307-evidence.json.gz",
    dict(
      schemaVersion=1,
      baseHead="9727870f79db9c6a6e9d6437668e5ac13229522f",
      fieldSources={
        str(p.relative_to(ROOT)): sha_v307(p)
        for p in [DATA / "northParkTerrainV306.json", DATA / "railSseTerrainV307.json"]
      },
      packets=evidence,
      policy="One original triangle is cut once against the union; complete outside source plane and full UInt16 linear paint survive; field interiors are required-root-only. No original packet is changed.",
    ),
  )
  print("complete", len(packets), "plans", len(contacts), "contact meshes", flush=True)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("captures", type=Path)
  build_contact_v307(parser.parse_args().captures)


if __name__ == "__main__":
  main()
