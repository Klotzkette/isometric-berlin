"""Finite source-bound Thälmann estate and swimming-hall facade refinements.

All measured bodies, roofs, paint, terrain and navigation remain immutable.
Only exact replayed generic panes on fully represented source wall carriers
yield to the new shallow fittings, in the same atomic packet transaction.
"""

from __future__ import annotations

import base64
import math
from pathlib import Path
from typing import Any

from shapely.geometry import shape

from scripts import build_ost_housing_v301 as front
from scripts.build_friedrichshain_v303 import (
  choose_old_faces,
  guards,
  packet_path,
  source_records,
)
from scripts.build_north_sites_v306 import DATA, GEO, SOURCE, read, sha, write

KIND = "north-quarter-v306"


class Fittings306(front.Fittings):
  def payload(self) -> dict[str, Any]:
    return {**super().payload(), "kind": KIND}


def pool_front(mesh: Any, face: dict, plane: Any, native: bool) -> None:
  """1986 low hall: separate glazing strips, structural bays and opaque base.

  The current operator confirms two storeys and the retained hall. Bay widths,
  glazing proportions and muted fittings are reference-guided estimates; the
  complete measured carrier clips every pane and no new wing is fabricated.
  """
  low, high, length = (face[k] for k in ["low", "high", "length"])
  floors = 2
  cols = max(1, round(length / 3.6))
  for floor in range(floors):
    y = low + 2.0 + floor * 3.8
    if y + 1.25 > high - 0.15:
      continue
    for col in range(cols):
      u = (col + 0.5) * length / cols
      width = min(2.8, length / cols - 0.35)
      if not front.pane_if_backed(
        mesh,
        face,
        plane,
        u,
        y,
        width + 0.2,
        2.65,
        0xCCC9BE,
        "pool-individual-structural-bay",
        0.09,
      ):
        continue
      mesh.pane(face, u, y, width, 2.45, 0x577B83, "pool-glazing", 0.12)
      mesh.pane(face, u, y, 0.07, 2.45, 0xD9DFD6, "pool-window-mullion", 0.14)
      mesh.pane(face, u, y - 0.2, width, 0.07, 0xD9DFD6, "pool-window-transom", 0.14)
  for y in [low + 0.7, low + 4.1, min(high - 0.3, low + 8.0)]:
    front.pane_if_backed(
      mesh,
      face,
      plane,
      length / 2,
      y,
      length - 0.15,
      0.09,
      0xB7BCB0,
      "pool-retained-low-hall-band",
      0.08,
    )


def build() -> dict[str, Any]:
  front.TRIANGLES.clear()
  front.NATIVE_PLANES.clear()
  source = read(SOURCE)
  old_faces = read(GEO / "district-facades-v188-evidence.json.gz")["faces"]
  wanted = {}
  for group in source["housing"]:
    for p in group["predecessors"]:
      if p["height"] >= 14:
        wanted[p["id"]] = {
          **p,
          "floors": group["levels"],
          "type": "qp-slab",
          "osm": group["osm"],
        }
  for p in source["swimmingHallPredecessors"]:
    wanted[p["id"]] = {**p, "floors": 2, "type": "pool", "osm": "24634435"}
  originals: dict[Path, dict] = {}
  paths: set[Path] = set()

  def packet(tile: str, native: bool) -> dict:
    path = packet_path(tile, native)
    paths.add(path)
    if path not in originals:
      originals[path] = read(path)
    return originals[path]

  recipes, evidence = {}, []
  for owner, original in wanted.items():
    w, n, e, b = shape(original["geometry"]).bounds
    for z in range(math.floor(n / 512), math.floor(b / 512) + 1):
      for x in range(math.floor(w / 512), math.floor(e / 512) + 1):
        tile = f"{x}_{z}"
        if not packet_path(tile, False).exists():
          continue
        drawn = packet(tile, False)
        faces = front.owner_faces(drawn, owner)
        if not faces:
          continue
        profile = dict(
          id=f"{owner}-{tile}",
          owner=owner,
          packet=tile,
          type=original["type"],
          floors=original["floors"],
          windowWidth=1.55,
          windowHeight=1.5,
          columns=1,
          reveal=0xBDBFB4,
        )
        # Retirement is bounded to actually delivered source-backed facade
        # axes. Low service annexes and all bodies remain completely retained.
        valid = [
          f
          for f in faces
          if front.source_plane(drawn, f).area > 6 and f["high"] - f["low"] > 7
        ]
        old = choose_old_faces(profile, valid, old_faces)
        target = "district188-" + tile if old else tile
        for native in [False, True]:
          raw = packet(target, native)
          support = packet(tile, native)
          key = ("minecraft:" if native else "drawn:") + target
          rec = recipes.setdefault(
            key,
            dict(raw=raw, mesh=Fittings306(raw["origin"]), owners=set(), oldFaces=[]),
          )
          represented = (
            front.native_fronts(support, profile, valid) if native else valid
          )
          before = len(rec["mesh"].positions)
          faceproof = []
          for f in represented:
            plane = front.source_plane(support, f)
            start = len(rec["mesh"].positions)
            if original["type"] == "pool":
              pool_front(rec["mesh"], f, plane, native)
            else:
              local = {**profile, "columns": max(1, round(f["length"] / 3.6))}
              # Each complete wall has its own source axes. The native wall
              # has independent cardinal axes and never borrows a smooth ring.
              front.reference_front(rec["mesh"], f, local, native, plane, f)
            if len(rec["mesh"].positions) == start:
              raise ValueError(f"Unrepresented source facade {owner} {key}")
            faceproof.append(
              dict(
                a=f["a"],
                d=f["d"],
                n=f["n"],
                length=f["length"],
                low=f["low"],
                high=f["high"],
                vertices=len(rec["mesh"].positions) - start,
                cardinal=native,
              )
            )
          if len(rec["mesh"].positions) == before:
            raise ValueError(f"No supported complete fitting {owner} {key}")
          rec["owners"].add(owner)
          rec["oldFaces"].extend(old)
          evidence.append(
            dict(
              key=key,
              owner=owner,
              osm=original["osm"],
              floors=profile["floors"],
              type=original["type"],
              sourceBodyRetained=True,
              sourceRoofRetained=True,
              sourcePaintRetained=True,
              faces=faceproof,
              roles=dict(rec["mesh"].roles),
            )
          )
  pins = guards(sorted(paths))
  plans, proof = {}, []
  for key, rec in recipes.items():
    native, tile = key.startswith("minecraft:"), key.split(":", 1)[1]
    raw = rec["raw"]
    path = packet_path(tile, native)
    retire, receipts = front.exact_retirements(
      {**raw, "_auditNative": native}, rec["oldFaces"]
    )
    append = rec["mesh"].payload()
    prepared = pins[str(path)]["prepared"]
    remaining = sum(
      len(base64.b64decode(p["positions"])) // 6 for p in prepared["meshes"]
    ) + len(rec["mesh"].positions)
    indices = sum(
      len(base64.b64decode(p["indices"])) // 4 for p in prepared["meshes"]
    ) + len(rec["mesh"].indices)
    if remaining > 400000 or indices > 2400000 or len(prepared["meshes"]) + 1 > 16:
      raise ValueError("Unchanged complete packet cap " + key)
    plans[key] = dict(
      origin=raw["origin"],
      **{k: v for k, v in pins[str(path)].items() if k != "prepared"},
      records=source_records(raw),
      preparedRecords=source_records(prepared),
      append=append,
      appendFingerprint=front.mesh_fingerprint(append),
      retire=retire,
      retireLines=[],
      retireNav=[],
      appendNav=[],
      owners=sorted(rec["owners"]),
    )
    proof.extend({"key": key, **p} for p in receipts)
  write(
    DATA / "northQuarterV306.json",
    dict(schemaVersion=1, keys=sorted(plans), packets=plans),
  )
  write(
    GEO / "north-quarter-v306-evidence.json.gz",
    dict(
      schemaVersion=1,
      predecessor="9727870f79db9c6a6e9d6437668e5ac13229522f",
      sourceSha256=sha(SOURCE),
      fronts=evidence,
      retiredGenericPanes=proof,
      inputs={str(p.relative_to(GEO.parents[1])): sha(p) for p in paths},
      policy="Retain every measured body/roof/material/nav and all unrelated panes. Fully source-backed shallow WBS70 and low swimming-hall fittings; exact old v188 pane replay only; no coverage or photo pixels.",
    ),
  )
  return dict(
    packets=len(plans),
    owners=len(wanted),
    oldPanes=len(proof),
    vertices={
      k: len(base64.b64decode(p["append"]["positions"])) // 6 for k, p in plans.items()
    },
    bytes=(DATA / "northQuarterV306.json").stat().st_size,
  )


if __name__ == "__main__":
  print(build())
