"""Exact streamed coarse-owner complements for the finite university families.

Published packets remain immutable. Only exact complete named-source body and
generic fitting triangles/roof ink/navigation may yield to the required model.
"""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import sqlite3
import subprocess
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box, mapping, shape
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import build_surrounding_outlines as exporter
from build_cluster_facades_v320 import retire_generic
from build_outskirts_v187 import exclusions as outskirts_exclusions
from extract_universities_v322 import gpkg_geometry

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
APP = ROOT / "src/app"
DATA = APP / "src/data"
PUBLIC = APP / "public/mesh/surrounding-berlin-v159"


def read(path):
  raw = Path(path).read_bytes()
  return json.loads(gzip.decompress(raw) if raw[:2] == b"\x1f\x8b" else raw)


def write(path, value):
  raw = (json.dumps(value, separators=(",", ":"), allow_nan=False) + "\n").encode()
  Path(path).write_bytes(
    gzip.compress(raw, mtime=0) if str(path).endswith(".gz") else raw
  )


def triangle_keys(mesh):
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
  return [tuple(sorted(tuple(map(int, q)) for q in positions[t])) for t in indices]


def targets():
  profile = read(DATA / "universitiesArchitectureV322.json")
  retained = read(GEO / "universities-v322-source.json.gz")["sites"]
  by_site = {s["key"]: s for s in profile["sites"]}
  selected = {}
  for directory in (
    "outer-v159",
    "ring-v182",
    "city-v183",
    "outskirts-v187",
    "north-city-v190",
    "east-city-v200",
    "marzahn-v230",
  ):
    path = GEO / "raw" / directory / "resolved-outlines.gpkg"
    if not path.exists():
      continue
    database = sqlite3.connect(path)
    for key, site in by_site.items():
      scope = unary_union([shape(m["geometry"]) for m in retained[key]["mapped"]])
      x0, z0, x1, z1 = scope.bounds
      parents = set(site["parents"])
      full = unary_union(
        [
          Polygon(p["ring"], p["holes"])
          for p in profile["navigation"]
          if p["site"] == key and "new-ground" not in p["id"]
        ]
      )
      query = "SELECT b.sourceId,b.height,b.minHeight,b.heightSource,b.geom FROM buildings b JOIN rtree_buildings_geom r ON b.fid=r.id WHERE r.minx<? AND r.maxx>? AND r.miny<? AND r.maxy>?"
      for identity, height, minimum, evidence, blob in database.execute(
        query, (x1, x0, z1, z0)
      ):
        poly = gpkg_geometry(blob)
        if not poly.is_valid:
          poly = poly.buffer(0)
        if poly.is_empty:
          continue
        overlap = full.intersection(poly).area
        exact_parent = identity in parents
        named_mapped_body = (
          scope.covers(poly.representative_point()) and overlap / poly.area >= 0.65
        )
        if not exact_parent and not named_mapped_body:
          continue
        record = {
          "sourceId": identity,
          "height": height,
          "minHeight": minimum,
          "heightSource": evidence,
          "geometry": mapping(poly),
          "site": key,
          "proof": {
            "resolvedSource": str(path.relative_to(ROOT)),
            "resolvedSourceSha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "sourceAreaM2": poly.area,
            "newCompleteFamilyOverlapM2": overlap,
            "exactOfficialParent": exact_parent,
            "completeNamedCampus": True,
          },
        }
        prior = selected.get(identity)
        if prior and prior != record:
          # The same original owner may occur in several retained generation
          # files. Identical geometry/height has one source identity.
          if any(
            prior[k] != record[k] for k in ("geometry", "height", "minHeight", "site")
          ):
            raise ValueError((identity, "Conflicting old source records"))
        else:
          selected[identity] = record
    database.close()
  return selected


def audit(external):
  selected = targets()
  manifest = read(PUBLIC / "manifest.json")
  bounds = unary_union([shape(r["geometry"]) for r in selected.values()])
  tasks = []
  seen = set()
  for chunk in manifest["chunks"]:
    if not box(*chunk["bounds"]).intersects(bounds):
      continue
    for mode in ("drawn", "minecraft"):
      path = PUBLIC / chunk[mode]["url"]
      raw = read(path)
      owners = sorted(
        {b["sourceId"] for b in raw["nav"]["buildings"]} & selected.keys()
      )
      if not owners:
        continue
      tasks.append(
        {
          "mode": mode,
          "id": raw["id"],
          "path": str(path),
          "owners": owners,
          "output": str(external / (mode + ":" + raw["id"] + ".json.gz")),
        }
      )
      seen.update(owners)
  # Source records not delivered in a current packet are retained evidence,
  # never invented as additional retirements.
  selected = {k: v for k, v in selected.items() if k in seen}
  write(external / "targets.json", {"targets": list(selected.values()), "tasks": tasks})
  print(
    json.dumps(
      {
        "owners": len(selected),
        "packets": len(tasks),
        "sites": sorted({r["site"] for r in selected.values()}),
      }
    ),
    flush=True,
  )
  return selected, tasks


def compile_packets(external):
  selected, tasks = audit(external)
  if not all(Path(task["output"]).exists() for task in tasks):
    subprocess.run(
      [
        "bun",
        "run",
        "scripts/prepare-universities-packets-v322.ts",
        str(external / "targets.json"),
      ],
      cwd=APP,
      check=True,
    )
  plans, records = {}, []
  outskirts_hero, _ = outskirts_exclusions()
  old_faces = {
    version: read(GEO / name)["faces"]
    for version, name in [
      ("v188", "district-facades-v188-evidence.json.gz"),
      ("v230", "outer-facades-v230-evidence.json.gz"),
    ]
  }
  for task in tasks:
    raw, capture = read(task["path"]), read(task["output"])
    packet = capture["packet"]
    native = task["mode"] == "minecraft"
    ox, _, oz = raw["origin"]
    tile = box(ox, oz, ox + 512, oz + 512)
    wanted, ink = Counter(), Counter()
    for identity in task["owners"]:
      record = selected[identity]
      source = shape(record["geometry"])
      if task["id"].startswith("outer187-"):
        source = exporter.polygonal(source.difference(outskirts_hero))
      geometry = exporter.polygonal(source.intersection(tile))
      if native:
        geometry = exporter.native_polygon(geometry)
        actual_ground = unary_union(
          [
            Polygon(
              [(x + ox, z + oz) for x, z in b["ring"]],
              [[(x + ox, z + oz) for x, z in h] for h in b["holes"]],
            )
            for b in raw["nav"]["buildings"]
            if b["sourceId"] == identity
          ]
        )
        geometry = actual_ground
      if geometry.is_empty:
        raise ValueError((identity, "Current source body became empty"))
      low, high = (
        3 + record["minHeight"],
        3 + max(record["height"], record["minHeight"] + 1),
      )
      if native:
        high = 3 + max(2, round((high - 3) / 2) * 2)
      outline = shapely.orient_polygons(
        geometry if native else source, exterior_cw=True
      ).boundary.intersection(tile)
      mesh = exporter.PackedMesh(ox, oz)
      mesh.building(geometry, low, high, outline)
      wanted.update(triangle_keys(mesh.payload("city")))
      if not native:
        for line in exporter.line_parts(
          geometry.boundary.difference(tile.boundary.buffer(0.02))
        ):
          for a, b in zip(line.coords, list(line.coords)[1:]):
            ink[
              tuple(
                sorted(
                  tuple(round(v * 100) for v in (p[0] - ox, high + 10.02, p[1] - oz))
                  for p in (a, b)
                )
              )
            ] += 1
    retire = []
    for index, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "city":
        continue
      ordinals = []
      for ordinal, key in enumerate(triangle_keys(mesh)):
        if wanted[key]:
          wanted[key] -= 1
          ordinals.append(ordinal)
      if ordinals:
        retire.append({"mesh": index, "triangles": ordinals})
    if +wanted:
      write(
        external / (task["mode"] + ":" + task["id"] + "-missing.json"),
        {"owners": task["owners"], "triangles": [[k, n] for k, n in (+wanted).items()]},
      )
      missing = list((+wanted).elements())
      # Published native roofs can retain the opposite exact CDT diagonal of
      # a cardinal rectangle. Each whole four-vertex rectangle is proved with
      # integer coordinates and equal exact covered area, without tolerance.
      if not native:
        raise ValueError(
          (task["mode"], task["id"], "Missing exact old body triangles", len(missing))
        )
      retired = {r["mesh"]: set(r["triangles"]) for r in retire}
      available = [
        (mi, ordinal, tri)
        for mi, mesh in enumerate(packet["meshes"])
        if mesh["kind"] == "city"
        for ordinal, tri in enumerate(triangle_keys(mesh))
        if ordinal not in retired.get(mi, set())
      ]
      proofs = []
      while missing:
        matched = False
        for i, first in enumerate(missing):
          for j in range(i + 1, len(missing)):
            second = missing[j]
            vertices = set(first) | set(second)
            if (
              len(vertices) != 4
              or len(set(first) & set(second)) != 2
              or len({p[1] for p in vertices}) != 1
            ):
              continue
            xs, zs = {p[0] for p in vertices}, {p[2] for p in vertices}
            if len(xs) != 2 or len(zs) != 2:
              continue
            polygon = box(min(xs), min(zs), max(xs), max(zs))
            if polygon.area != sum(
              Polygon([(p[0], p[2]) for p in t]).area for t in (first, second)
            ):
              continue
            choices = [
              (mi, ordinal, tri)
              for mi, ordinal, tri in available
              if set(tri) <= vertices
            ]
            if len(choices) != 2 or set(choices[0][2]) | set(choices[1][2]) != vertices:
              continue
            actual_polygons = [
              Polygon([(p[0], p[2]) for p in tri]) for _, _, tri in choices
            ]
            if (
              actual_polygons[0].intersection(actual_polygons[1]).area
              or unary_union(actual_polygons).symmetric_difference(polygon).area
            ):
              continue
            for mi, ordinal, _ in choices:
              row = next((r for r in retire if r["mesh"] == mi), None)
              if row is None:
                row = {"mesh": mi, "triangles": []}
                retire.append(row)
              row["triangles"].append(ordinal)
              row["triangles"].sort()
            proofs.append(
              {
                "originalExpected": [first, second],
                "actualPublished": choices,
                "sameFourIntegerVertices": True,
                "sameExactArea": True,
              }
            )
            available = [a for a in available if a not in choices]
            missing.pop(j)
            missing.pop(i)
            matched = True
            break
          if matched:
            break
        if not matched:
          raise ValueError(
            (
              task["mode"],
              task["id"],
              "No exact complete source rectangle alternative",
              len(missing),
            )
          )
      write(
        external / (task["mode"] + ":" + task["id"] + "-exact-diagonal-proof.json"),
        {"rectangles": proofs},
      )
    for version, kind in (
      ("v188", "district-facades-v188"),
      ("v230", "outer-facades-v230"),
    ):
      faces = [f for f in old_faces[version] if f["owner"] in task["owners"]]
      if faces:
        retire.extend(retire_generic(packet, faces, native, kind))
    lines = []
    if packet.get("lines"):
      ps = np.frombuffer(base64.b64decode(packet["lines"]["positions"]), "<u2").reshape(
        -1, 2, 3
      )
      for index, segment in enumerate(ps):
        key = tuple(sorted(tuple(map(int, point)) for point in segment))
        if ink[key]:
          lines.append(index)
          ink[key] -= 1
    if +ink:
      raise ValueError((task["id"], "Missing exact old roof ink", sum((+ink).values())))
    nav = [b for b in packet["nav"]["buildings"] if b["sourceId"] in task["owners"]]
    key = task["mode"] + ":" + task["id"]
    plans[key] = {
      "origin": raw["origin"],
      "records": capture["raw"]["records"],
      "preparedRecords": capture["prepared"]["records"],
      "navGuard": capture["raw"]["nav"],
      "lineGuard": capture["raw"]["lines"],
      "preparedNavGuard": capture["prepared"]["nav"],
      "preparedLineGuard": capture["prepared"]["lines"],
      "retire": sorted(retire, key=lambda r: r["mesh"]),
      "retireLines": lines,
      "retireNav": nav,
      "appendNav": [],
      "owners": task["owners"],
    }
    records.append(
      {
        "key": key,
        "sourceSha256": hashlib.sha256(Path(task["path"]).read_bytes()).hexdigest(),
        "retiredTriangles": sum(len(r["triangles"]) for r in retire),
        "retiredLines": len(lines),
        "retiredNav": len(nav),
        "owners": task["owners"],
      }
    )
    print(key, records[-1]["retiredTriangles"], flush=True)
  write(
    DATA / "universitiesV322Packets.json",
    {"schemaVersion": 1, "keys": list(plans), "packets": plans},
  )
  write(DATA / "universitiesV322PacketIndex.json", {"keys": list(plans)})
  write(
    GEO / "universities-v322-packet-evidence.json.gz",
    {
      "schemaVersion": 1,
      "targets": list(selected.values()),
      "packets": records,
      "exactNativeDiagonalProofs": {
        p.name: read(p) for p in sorted(external.glob("*-exact-diagonal-proof.json"))
      },
      "outsidePolicy": "Every original XYZ/RGB and line word is retained; only these exact original indices collapse. All unrelated navigation records remain verbatim.",
    },
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("external", type=Path)
  parser.add_argument("--audit-only", action="store_true")
  args = parser.parse_args()
  args.external.mkdir(parents=True, exist_ok=True)
  audit(args.external) if args.audit_only else compile_packets(args.external)
