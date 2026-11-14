"""Replace exactly two obsolete construction envelopes with all current parts.

The old OSM parent is an envelope, not a separately measured nine-metre building.
The current building:parts and architect's built exterior supersede that envelope.
"""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import subprocess
from pathlib import Path
from xml.etree import ElementTree

import numpy as np
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SCRATCH = Path("/tmp/estrel-packet-v345")
OWNERS = {"OSM-way-1535834585", "OSM-relation-21070307"}
KIND = "estrel-tower-v345"


def main():
  xml = gzip.decompress(
    (ROOT / "geo_data/regierungsviertel/estrel-tower-v345-map.xml.gz").read_bytes()
  )
  assert (
    hashlib.sha256(xml).hexdigest()
    == "83fa423d9d7ac9b2284f251c16715386838541c98791d42f026c02c82f78e3f8"
  )
  document = ElementTree.fromstring(xml)
  nodes = {n.attrib["id"]: n.attrib for n in document.findall("node")}
  ways = {w.attrib["id"]: w for w in document.findall("way")}

  def polygon(way):
    return Polygon(
      [
        (float(nodes[n.attrib["ref"]]["lon"]), float(nodes[n.attrib["ref"]]["lat"]))
        for n in way.findall("nd")
      ]
    )

  parent = polygon(ways["1535834585"])
  part_ids = {
    key
    for key, way in ways.items()
    if any(t.attrib["k"] == "building:part" for t in way.findall("tag"))
    and parent.contains(polygon(way).representative_point())
  }
  parts = json.loads((ROOT / "src/app/src/data/estrelTowerV345.json").read_bytes())[
    "parts"
  ]
  assert len(parts) == 8 and {p["id"] for p in parts} == part_ids
  assert (
    parent.symmetric_difference(
      unary_union([polygon(ways[key]) for key in part_ids])
    ).area
    < 1e-15
  )
  subprocess.run(
    ["bun", "scripts/export-estrel-packet-v345.ts", str(SCRATCH)],
    cwd=ROOT / "src/app",
    check=True,
  )
  packets, reports = {}, []
  for mode in ("drawn", "minecraft"):
    source = json.loads((SCRATCH / f"{mode}.json").read_bytes())
    packet, plan = source["prepared"], source["plan"]
    nav = [b for b in packet["nav"]["buildings"] if b["sourceId"] in OWNERS]
    assert len(nav) == 2 and {b["sourceId"] for b in nav} == OWNERS
    assert all(
      b["heightSource"] == "display_fallback:building=construction" for b in nav
    )
    assert all(
      b["minHeight"] == 0 and b["height"] == (8 if mode == "minecraft" else 9)
      for b in nav
    )
    owners = [(Polygon(b["ring"], b["holes"]), 3 + b["height"]) for b in nav]
    retire, roof_polys, walls = [], [], []
    for mi, mesh in enumerate(packet["meshes"]):
      if mesh["kind"] != "city":
        continue
      positions = (
        np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      )
      positions[:, 1] += packet["origin"][1]
      triangles = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      selected = []
      for ti, ids in enumerate(triangles):
        q = positions[ids]
        lo, hi = q[:, 1].min(), q[:, 1].max()
        poly = Polygon(q[:, [0, 2]])
        for owner, high in owners:
          if (
            abs(lo - high) < 0.001
            and abs(hi - high) < 0.001
            and poly.area > 0
            and owner.buffer(0.001).covers(poly)
          ):
            selected.append(ti)
            roof_polys.append(poly)
            break
          if abs(lo - 3) < 0.001 and abs(hi - high) < 0.001 and poly.area < 1e-7:
            line = LineString(q[:, [0, 2]])
            if owner.boundary.buffer(0.001).covers(line):
              selected.append(ti)
              walls.append(
                float(np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0])) / 2)
              )
              break
      if selected:
        retire.append(dict(mesh=mi, triangles=selected))
    expected = unary_union([p for p, _ in owners])
    assert expected.symmetric_difference(unary_union(roof_polys)).area < 0.01
    assert sum(walls) > 1000 and retire
    roof_segments = []
    if packet.get("lines"):
      lines = (
        np.frombuffer(base64.b64decode(packet["lines"]["positions"]), "<u2").reshape(
          -1, 2, 3
        )
        / 100
      )
      lines[:, :, 1] += packet["origin"][1]
      for index, line in enumerate(lines):
        if any(
          np.max(np.abs(line[:, 1] - high - 0.02)) < 0.001
          and p.boundary.buffer(0.001).covers(LineString(line[:, [0, 2]]))
          for p, high in owners
        ):
          roof_segments.append(index)
    if mode == "drawn":
      assert roof_segments
    plan.update(
      retire=retire, retireLines=roof_segments, retireNav=nav, owners=sorted(OWNERS)
    )
    packets[f"{mode}:ring182-11_10"] = plan
    reports.append(
      dict(
        mode=mode,
        retiredTriangles=sum(len(r["triangles"]) for r in retire),
        retiredRoofSegments=len(roof_segments),
        oldSourceEnvelopeArea=expected.area,
        retainedNewParts=len(parts),
        appendedNavigation=len(plan["appendNav"]),
        oldSourceNav=nav,
      )
    )
  runtime = ROOT / "src/app/src/data/estrelTowerV345Packets.json"
  runtime.write_text(
    json.dumps(
      dict(schemaVersion=1, keys=list(packets), packets=packets), separators=(",", ":")
    )
    + "\n"
  )
  audit = dict(
    schemaVersion=1,
    scope="Two exact obsolete OSM construction envelopes, not arbitrary nearby buildings",
    sourceMap="https://api.openstreetmap.org/api/0.6/map?bbox=13.4575,52.4699,13.4605,52.4726",
    sourceTags={
      "way/1535834585": {"building": "construction"},
      "relation/21070307": {
        "building:part": "construction",
        "name": "Estrel New Convention Hall",
        "members": ["way/1535834587", "way/1535834588", "way/1017413850"],
      },
    },
    sourcePartIds=[
      p["id"]
      for p in json.loads(
        (ROOT / "src/app/src/data/estrelTowerV345.json").read_bytes()
      )["parts"]
    ],
    outsideParentPolicy="All eight current building:parts exactly cover the complete old parent footprint, including the low plinth and two thin elevated glass canopies omitted from the initial five-part draft. The arbitrary 9m/8m full solid extrusion is superseded in full. Thin roofs retain their source clearance underneath. No nearby source building, ground, road or unrelated triangle is retired.",
    reports=reports,
    runtimeSha256=hashlib.sha256(runtime.read_bytes()).hexdigest(),
  )
  (ROOT / "geo_data/regierungsviertel/estrel-tower-v345-ownership.json").write_text(
    json.dumps(audit, indent=2) + "\n"
  )
  print(json.dumps(reports, default=str))


if __name__ == "__main__":
  main()
