"""Independent retained-source and exact retired-envelope geometry checks."""

import base64
import gzip
import hashlib
import json
from pathlib import Path
from xml.etree import ElementTree

import numpy as np
from pyproj import Transformer
from shapely.geometry import LineString, Polygon
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
DATA = ROOT / "src/app/src/data"


def test_estrel_all_current_parts_and_generic_parent_are_source_backed():
  xml = gzip.decompress((GEO / "estrel-tower-v345-map.xml.gz").read_bytes())
  assert (
    hashlib.sha256(xml).hexdigest()
    == "83fa423d9d7ac9b2284f251c16715386838541c98791d42f026c02c82f78e3f8"
  )
  document = ElementTree.fromstring(xml)
  ways = {w.attrib["id"]: w for w in document.findall("way")}
  nodes = {n.attrib["id"]: n.attrib for n in document.findall("node")}

  def tags(el):
    return {t.attrib["k"]: t.attrib["v"] for t in el.findall("tag")}

  assert tags(ways["1535834585"]) == {"building": "construction"}
  relation = next(
    r for r in document.findall("relation") if r.attrib["id"] == "21070307"
  )
  assert tags(relation)["building:part"] == "construction"
  assert {m.attrib["ref"] for m in relation.findall("member")} == {
    "1535834587",
    "1535834588",
    "1017413850",
  }
  transform = Transformer.from_crs(4326, 25833, always_xy=True)
  parts = json.loads((DATA / "estrelTowerV345.json").read_bytes())["parts"]

  def map_polygon(way):
    return Polygon(
      [
        (float(nodes[n.attrib["ref"]]["lon"]), float(nodes[n.attrib["ref"]]["lat"]))
        for n in way.findall("nd")
      ]
    )

  parent = map_polygon(ways["1535834585"])
  complete = {
    key
    for key, way in ways.items()
    if "building:part" in tags(way)
    and parent.contains(map_polygon(way).representative_point())
  }
  assert len(parts) == 8
  assert {part["id"] for part in parts} == complete
  assert (
    parent.symmetric_difference(
      unary_union([map_polygon(ways[part["id"]]) for part in parts])
    ).area
    < 1e-15
  )
  for part in parts:
    way = ways[part["id"]]
    t = tags(way)
    assert t["building:part"] == "construction"
    assert float(t["height"]) == part["height"]
    assert float(t.get("roof:direction", 0)) == part["roofDirection"]
    assert float(t.get("roof:height", 0)) == part["roofHeight"]
    if t.get("construction") == "roof":
      assert part["kind"] == "canopy" and t["layer"] == "1"
    coords = []
    for nd in way.findall("nd")[:-1]:
      node = nodes[nd.attrib["ref"]]
      x, y = transform.transform(float(node["lon"]), float(node["lat"]))
      coords.append([x - 389500, 5820000 - y])
    assert np.max(np.abs(np.asarray(coords) - part["ring"])) < 0.001


def test_estrel_retirement_covers_only_both_exact_obsolete_envelopes():
  recipe = json.loads((DATA / "estrelTowerV345Packets.json").read_bytes())
  for mode in ("drawn", "minecraft"):
    packet = json.loads(
      gzip.decompress(
        (
          ROOT
          / f"src/app/public/mesh/surrounding-berlin-v159/ring182-11_10.{mode}.json.gz"
        ).read_bytes()
      )
    )
    plan = recipe["packets"][f"{mode}:ring182-11_10"]
    assert set(plan["owners"]) == {"OSM-way-1535834585", "OSM-relation-21070307"}
    assert plan["retireNav"] == [
      b for b in packet["nav"]["buildings"] if b["sourceId"] in plan["owners"]
    ]
    old = [(Polygon(b["ring"], b["holes"]), 3 + b["height"]) for b in plan["retireNav"]]
    roofs, wall_area = [], 0
    for selection in plan["retire"]:
      mesh = packet["meshes"][selection["mesh"]]
      assert mesh["kind"] == "city"
      a = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(-1, 3) / 100
      a[:, 1] += packet["origin"][1]
      triangles = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      for ordinal in selection["triangles"]:
        q = a[triangles[ordinal]]
        poly = Polygon(q[:, [0, 2]])
        if poly.area > 1e-7:
          assert any(
            np.max(np.abs(q[:, 1] - high)) < 0.001 and p.buffer(0.001).covers(poly)
            for p, high in old
          )
          roofs.append(poly)
        else:
          assert abs(q[:, 1].min() - 3) < 0.001
          assert any(
            abs(q[:, 1].max() - high) < 0.001
            and p.boundary.buffer(0.001).covers(LineString(q[:, [0, 2]]))
            for p, high in old
          )
          wall_area += np.linalg.norm(np.cross(q[1] - q[0], q[2] - q[0])) / 2
    assert (
      unary_union(roofs).symmetric_difference(unary_union([p for p, _ in old])).area
      < 0.01
    )
    assert abs(sum(p.area for p in roofs) - sum(p.area for p, _ in old)) < 0.02
    assert abs(wall_area - sum(p.length * (high - 3) for p, high in old)) < 0.05
