"""Exact finite whole-owner prism transfers for the complete v307 rail models."""

from __future__ import annotations

import argparse
import base64
from collections import Counter
from pathlib import Path
from typing import Any

import build_surrounding_outlines as exporter
import numpy as np
import shapely
from build_rail_sse_v307 import DATA, GEO, SOURCE, read_v307, write_v307
from shapely.geometry import box, shape


def triangle_keys_v307(mesh: dict[str, Any]) -> list[tuple]:
  ps = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  ix = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [tuple(sorted(tuple(map(int, q)) for q in ps[t])) for t in ix]


def build_packets_v307(captures: Path) -> None:
  source = read_v307(SOURCE)
  plans = {}
  evidence = []
  owners = source["predecessors"]
  for path in sorted(captures.glob("*.json")):
    if path.name.startswith("legacy."):
      continue
    identity, mode, _ = path.name.rsplit(".", 2)
    native = mode == "minecraft"
    capture = read_v307(path)
    packet = capture["raw"]
    prepared = capture["prepared"]
    ox, _, oz = packet["origin"]
    tile = box(ox, oz, ox + 512, oz + 512)
    actual_body = Counter(
      t
      for m in prepared["meshes"]
      if m["kind"] == "city"
      for t in triangle_keys_v307(m)
    )
    wanted = Counter()
    wanted_lines = Counter()
    hits = []
    for old in owners:
      if old["sourceId"] not in {
        b.get("sourceId") for b in capture["nav"]["buildings"]
      }:
        continue
      original = shape(old["geometry"])
      g = exporter.polygonal(original.intersection(tile))
      if native:
        g = exporter.native_polygon(g).intersection(tile)
      if g.is_empty:
        continue
      hits.append(old["sourceId"])
      offsets = {
        b.get("groundOffset", 0)
        for b in capture["nav"]["buildings"]
        if b.get("sourceId") == old["sourceId"]
      }
      if len(offsets) != 1:
        raise ValueError("Ambiguous original complete family grade")
      chosen = None
      outline = (
        shapely.orient_polygons(g, exterior_cw=True).boundary
        if native
        else shapely.orient_polygons(original, exterior_cw=True).boundary.intersection(
          tile
        )
      )
      for offset in sorted({0, *offsets}):
        low = 3 + old["minHeight"] + offset
        high = 3 + max(old["height"], old["minHeight"] + 1) + offset
        if native:
          high = 3 + offset + max(2, round((high - 3 - offset) / 2) * 2)
        mesh = exporter.PackedMesh(ox, oz)
        mesh.building(g, low, high, outline)
        candidate = Counter(triangle_keys_v307(mesh.payload("city")))
        if not candidate - actual_body:
          chosen = candidate
          break
      if chosen is None:
        raise ValueError(
          f"No complete exact old source family grade: {old['sourceId']} in {path.name}"
        )
      wanted.update(chosen)
      if not native:
        for line in exporter.line_parts(
          g.boundary.difference(tile.boundary.buffer(0.02))
        ):
          for a, b in zip(line.coords, list(line.coords)[1:]):
            wanted_lines[
              tuple(
                sorted(
                  tuple(
                    round(v * 100) for v in [q[0] - ox, high + 0.02 + 10, q[1] - oz]
                  )
                  for q in (a, b)
                )
              )
            ] += 1
    if not hits:
      continue
    retire = []
    for mi, m in enumerate(prepared["meshes"]):
      if m["kind"] != "city":
        continue
      rows = []
      for i, t in enumerate(triangle_keys_v307(m)):
        if wanted[t] > 0:
          rows.append(i)
          wanted[t] -= 1
      if rows:
        retire.append(dict(mesh=mi, triangles=rows))
    if sum(wanted.values()):
      raise ValueError(
        f"{path.name}: {sum(wanted.values())} complete old owner triangles missing"
      )
    lines = []
    if prepared.get("lines"):
      ps = np.frombuffer(
        base64.b64decode(prepared["lines"]["positions"]), "<u2"
      ).reshape(-1, 2, 3)
      for i, pset in enumerate(ps):
        key = tuple(sorted(tuple(map(int, q)) for q in pset))
        if wanted_lines[key] > 0:
          lines.append(i)
          wanted_lines[key] -= 1
    if sum(wanted_lines.values()):
      raise ValueError(f"{path.name}: complete old owner roof ink missing")
    nav = [b for b in capture["nav"]["buildings"] if b.get("sourceId") in hits]
    if set(hits) != {b["sourceId"] for b in nav}:
      raise ValueError("Complete old owner navigation missing")
    rawpin, prepin = capture["pins"]["raw"], capture["pins"]["prepared"]
    key = f"{mode}:{identity}"
    plans[key] = dict(
      origin=packet["origin"],
      records=rawpin["records"],
      preparedRecords=prepin["records"],
      navGuard=rawpin["nav"],
      lineGuard=rawpin["lines"],
      preparedNavGuard=prepin["nav"],
      preparedLineGuard=prepin["lines"],
      retire=retire,
      retireLines=lines,
      retireNav=nav,
      appendNav=[],
      owners=hits,
    )
    evidence.append(
      dict(
        key=key,
        owners=hits,
        retireTriangles=sum(len(p["triangles"]) for p in retire),
        roofLines=len(lines),
        navigation=len(nav),
      )
    )
  write_v307(
    DATA / "railSseArchitectureV307Packets.json",
    dict(schemaVersion=1, keys=list(plans), packets=plans),
  )
  write_v307(
    GEO / "rail-sse-v307-packet-evidence.json.gz",
    dict(
      schemaVersion=1,
      packets=evidence,
      policy="Complete exact original city body/roof ink/nav only. Every foreign triangle/line remains. Complete original footprint is in the required replacement; no cropped outside footprint is discarded.",
    ),
  )
  print(evidence)


def main() -> None:
  p = argparse.ArgumentParser(description=__doc__)
  p.add_argument("captures", type=Path)
  build_packets_v307(p.parse_args().captures)


if __name__ == "__main__":
  main()
