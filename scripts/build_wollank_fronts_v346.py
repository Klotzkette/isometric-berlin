"""Five source-matched Rettigweg fronts in the Wollankstraße station neighbourhood."""

from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from collections import Counter, defaultdict
from pathlib import Path

import pyogrio
from shapely.affinity import translate
from shapely.geometry import Polygon, mapping

from scripts import build_cluster_facades_v320 as f
from scripts import build_district_facades_v188 as district
from scripts.build_wedding_ring_west_v345 import confirm_ordinary_face

KIND = "wollank-fronts-v346"
PROFILE = f.GEO / (KIND + "-source.json")
RUNTIME = f.DATA / "wollankFrontsV346.json"
RECEIPT = f.GEO / (KIND + "-receipt.json")
OWNERS = [
  "DEBE03YY70003VjD",
  "DEBE03YY70003W43",
  "DEBE03YY70003Y3K",
  "DEBE03YY70003bV1",
  "DEBE03YY70003dxu",
]


def profile():
  context = f.read(f.GEO / "outer-facades-v230-context.json.gz")
  packet = f.read(f.PUBLIC / "north190-3_-10.drawn.json.gz")
  buildings = {b["sourceId"]: b for b in packet["nav"]["buildings"]}
  rows = pyogrio.read_dataframe(
    f.GEO / "raw/north-city-v190/candidate.gpkg",
    layer="multipolygons",
    bbox=(13.39, 52.562, 13.398, 52.567),
  ).to_crs(25833)
  records = []
  faces = []
  for old in f.read(f.GEO / "outer-facades-v230-evidence.json.gz")["faces"]:
    if old["owner"] not in OWNERS:
      continue
    b = buildings[old["owner"]]
    poly = translate(
      Polygon(b["ring"], b["holes"]), packet["origin"][0], packet["origin"][2]
    )
    candidates = []
    for _, row in rows.iterrows():
      shape = district.world(row.geometry)
      iou = poly.intersection(shape).area / poly.union(shape).area
      if iou >= 0.97:
        candidates.append((iou, row, shape))
    if len(candidates) != 1:
      raise ValueError("Unique actual OSM residential counterpart missing")
    iou, row, shape = candidates[0]
    props = {
      k: (v if isinstance(v, str) else None) for k, v in row.items() if k != "geometry"
    }
    record = dict(
      owner=old["owner"],
      sourceRecord=dict(type="Feature", properties=props, geometry=mapping(shape)),
      drawnRecord=b,
      street=next(r for r in context["roads"] if r["id"] == old["streetId"]),
      footprintIoU=iou,
    )
    face = dict(old, family="v230", district="Pankow")
    face["mappedStoreys"] = confirm_ordinary_face(face, record, packet)
    records.append(record)
    faces.append(face)
  if len(faces) != 5:
    raise ValueError("Incomplete finite selection")
  style = f.read(f.GEO / "wedding-ring-west-v345-source.json")["clusters"][0]["style"]
  return dict(
    schemaVersion=1,
    sourceBaseline="daa0c5e372f6c86147dd89962da3fdbd2947e861",
    policy="Five positive mapped ordinary residential owners near Wollankstraße; keep original body colours, measured shells and exact roofs. Individual 4/5-storey rhythms come from OSM; window subdivision and small joinery are estimates, not photographic surveys.",
    context="Rettigweg within the existing Pankow coverage; finite north/east station approach, not the entire neighbourhood.",
    faces=faces,
    ordinaryResidentialRecords=records,
    style=style,
  )


def build(p):
  prior = f.exclusions()
  for name in [
    "cluster-facades-v320-evidence.json.gz",
    "wedding-gesundbrunnen-fronts-v340-receipt.json",
    "wedding-ring-west-v345-receipt.json",
    *f.MATERIAL_EVIDENCE,
  ]:
    prior |= f.owner_ids(f.read(f.GEO / name))
  if prior.intersection(OWNERS):
    raise ValueError("An individually refined owner cannot be overpainted")
  originals = {
    r["owner"]: r
    for r in f.read(f.GEO / "outer-facades-v230-evidence.json.gz")["faces"]
  }
  records = {r["owner"]: r for r in p["ordinaryResidentialRecords"]}
  plans = {}
  reports = []
  totals = Counter()
  doors = f.read(f.GEO / "house-doors-v233-evidence.json.gz")["doors"]
  for mode in ["drawn", "minecraft"]:
    native = mode == "minecraft"
    body = f.read(f.PUBLIC / f"north190-3_-10.{mode}.json.gz")
    host = "outerfacade230-north190-3_-10"
    packet = f.read(f.PUBLIC / f"{host}.{mode}.json.gz")
    mesh = f.FrontMesh(packet["origin"])
    retired = defaultdict(set)
    for face in p["faces"]:
      original = originals[face["owner"]]
      if any(face[k] != v for k, v in original.items()):
        raise ValueError("Original facade receipt changed")
      levels = confirm_ordinary_face(
        face, records[face["owner"]], f.read(f.PUBLIC / "north190-3_-10.drawn.json.gz")
      )
      old = f.retire_generic(packet, [face], native, "outer-facades-v230")
      for item in old:
        if retired[item["mesh"]].intersection(item["triangles"]):
          raise ValueError("Shared old fitting triangles")
        retired[item["mesh"]].update(item["triangles"])
      fronts = []
      for span in face["nativeSpans"] if native else [face]:
        f.verify_wall(body, dict(span, owner=face["owner"]), native)
        style = f.normalized_style(
          dict(p["style"], floorPitchM=(span["high"] - span["low"] - 0.6) / levels)
        )
        report = f.build_front(
          mesh, dict(span, owner=face["owner"]), style, doors, native
        )
        if not report["windows"] or report["floors"] != levels:
          raise ValueError("Incomplete mapped storey rhythm")
        fronts.append(report)
        totals[mode + "Windows"] += report["windows"]
      reports.append(
        dict(
          mode=mode,
          owner=face["owner"],
          mappedStoreys=levels,
          fronts=fronts,
          retire=old,
        )
      )
    mesh.compact()
    part = mesh.payload()["meshes"][0]
    part["kind"] = KIND
    old_sizes = [f.arrays(m) for m in packet["meshes"]]
    if (
      sum(len(a) for a, _, _ in old_sizes) + len(mesh.positions) > 400000
      or sum(i.size for _, _, i in old_sizes) + len(mesh.indices) > 2400000
    ):
      raise ValueError("Original packet budget exceeded")
    totals[mode + "Triangles"] = len(mesh.indices) // 3
    plans[f"{mode}:{host}"] = dict(
      origin=packet["origin"],
      navGuard=0,
      lineGuard=None,
      records=[
        dict(mesh=i, kind=m["kind"], fingerprint=f.part_fingerprint(m))
        for i, m in enumerate(packet["meshes"])
      ],
      append=part,
      appendFingerprint=f.part_fingerprint(part),
      retire=[dict(mesh=i, triangles=sorted(ts)) for i, ts in sorted(retired.items())],
      owners=OWNERS,
    )
  return dict(schemaVersion=1, keys=sorted(plans), packets=plans), dict(
    schemaVersion=1,
    sourceBaseline=p["sourceBaseline"],
    kind=KIND,
    profileSha256=f.sha(PROFILE.read_bytes()),
    counts=dict(totals),
    sourceOwners=reports,
  )


if __name__ == "__main__":
  parser = argparse.ArgumentParser()
  parser.add_argument("--check", action="store_true")
  args = parser.parse_args()
  if not PROFILE.exists():
    f.write(PROFILE, profile())
  runtime, receipt = build(f.read(PROFILE))
  with tempfile.TemporaryDirectory(prefix=KIND) as tmp:
    rp = Path(tmp) / RUNTIME.name
    ep = Path(tmp) / "receipt.json.gz"
    f.write(rp, runtime)
    f.write(ep, receipt)
    subprocess.run(
      ["bun", "src/app/scripts/finalize-wollank-fronts-v346.ts", str(rp), str(ep)],
      cwd=f.ROOT,
      check=True,
    )
    if args.check:
      if rp.read_bytes() != RUNTIME.read_bytes() or f.read(ep) != f.read(RECEIPT):
        raise ValueError("Recipe reproduction changed")
    else:
      RUNTIME.write_bytes(rp.read_bytes())
      f.write(RECEIPT, f.read(ep))
  print(json.dumps(receipt["counts"]))
