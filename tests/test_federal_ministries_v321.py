"""Finite public-source and lossless geometry contracts for federal V321."""

from __future__ import annotations

import base64
import gzip
import json
from collections import Counter
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"


def read(path):
  data = path.read_bytes()
  return json.loads(gzip.decompress(data) if path.suffix == ".gz" else data)


def model_arrays(model):
  dtype = "<f4" if model["positionType"] == "f32" else "<u2"
  p = np.frombuffer(base64.b64decode(model["positions"]), dtype=dtype).reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(model["indices"]), dtype="<u4").reshape(
    -1, 3
  )
  return p, indices


def signature(points):
  words = np.asarray(points, dtype="<f4").view("<u4").reshape(-1, 3)
  rows = [tuple(map(int, p)) for p in words]
  return min(tuple(rows[i:] + rows[:i]) for i in range(3))


def test_all_sixteen_current_seats_distinguish_bonn_and_existing_authored_models():
  directory = read(GEO / "federal-ministries-v321-directory.json")
  assert directory["checked"] == "2026-11-06"
  assert directory["directoryUrl"].startswith("https://www.bundesregierung.de/")
  rows = directory["ministries"]
  assert len(rows) == len({r["code"] for r in rows}) == 16
  assert Counter(r["assessment"] for r in rows) == {"preserve": 8, "refine": 8}
  by_code = {r["code"]: r for r in rows}
  assert "Rudi-Dutschke" in by_code["BMWSB"]["berlinServiceAddress"]
  assert "Mauerstraße 29" in by_code["BMG"]["berlinServiceAddress"]
  assert "Friedrichstraße 108" in by_code["BMDS"]["berlinServiceAddress"]
  assert sum(r["firstListedServiceSeat"] == "Bonn" for r in rows) == 6
  assert {r["code"] for r in rows if r["assessment"] == "preserve"} == {
    "BMF",
    "AA",
    "BMVg",
    "BMWE",
    "BMFTR",
    "BMAS",
    "BMV",
    "BMUKN",
  }


def test_complete_families_and_original_five_coarse_records_remain_available():
  runtime = read(DATA / "federalMinistriesV321.json")
  evidence = read(GEO / "federal-ministries-v321-evidence.json.gz")
  lookup = {
    p["id"]: p
    for p in read(ROOT / "src/app/public/mesh/regierungsviertel/lod2-prisms.json")[
      "buildings"
    ]
  }
  assert len(runtime["oldBodies"]) == 5
  assert all(p == lookup[p["id"]] for p in runtime["oldBodies"])
  assert {p["id"] for p in runtime["oldBodies"]} == {
    "32698095",
    "32698102",
    "74476580",
    "41953739",
    "n-280071",
  }
  assert len(runtime["navigation"]) == 56
  x8 = [p for f in evidence["source"]["BMWSB"] for p in f["parts"]]
  justice = [p for f in evidence["source"]["BMJV"] for p in f["parts"]]
  assert len(x8) == 28
  assert len(justice) == 34
  ids = {p["id"] for p in runtime["navigation"]}
  assert not {"DEBE3DZjmMEK2SZD", "DEBE3DUspil8YjZO"} & ids
  preserved = {
    p["id"]
    for f in evidence["source"]["BMJV"]
    if f["id"] == "DEBE01YYK0000ABQ"
    for p in f["parts"]
  }
  assert len(preserved) == 4 and not preserved & ids
  assert len({p["id"] for p in runtime["sourcePrisms"]}) == len(runtime["sourcePrisms"])
  assert all(p == lookup[p["id"]] for p in runtime["sourcePrisms"])


def test_measured_models_use_float32_positions_and_original_flat_source_normals(
  monkeypatch,
):
  monkeypatch.syspath_prepend(str(ROOT / "scripts"))
  from scripts.build_alt_mitte_v169 import triangulate

  runtime = read(DATA / "federalMinistriesV321.json")
  evidence = read(GEO / "federal-ministries-v321-evidence.json.gz")
  for key in ["BMJV", "BMWSB"]:
    model = next(m for m in runtime["models"] if m["key"] == key + "-complete-source")
    assert model["positionType"] == "f32"
    p, indices = model_arrays(model)
    n = np.frombuffer(base64.b64decode(model["normals"]), dtype="<f4").reshape(-1, 3)
    assert len(n) == len(p) == model["vertices"]
    assert np.isfinite(p).all() and np.isfinite(n).all()
    assert np.allclose(np.linalg.norm(n, axis=1), 1, atol=1e-6)
    actual = Counter(signature(p[row]) for row in indices)
    expected = Counter()
    for family in evidence["source"][key]:
      if key == "BMJV" and family["id"] == "DEBE01YYK0000ABQ":
        continue
      for part in family["parts"]:
        if part["id"] in {"DEBE3DZjmMEK2SZD", "DEBE3DUspil8YjZO"}:
          continue
        for surface in part["surfaces"]:
          if surface["kind"] in {"RoofSurface", "GroundSurface"}:
            for triangle in triangulate(surface["rings"]):
              local = np.asarray(triangle) - np.asarray(model["origin"])
              expected[signature(local)] += 1
    assert not expected - actual, (
      key,
      "a measured roof/ground word or winding was lost",
    )


def test_native_models_and_navigation_use_the_same_complete_cardinal_surface_cells():
  runtime = read(DATA / "federalMinistriesV321.json")
  assert len(runtime["nativeNavigationCells"]) == len(
    {tuple(row) for row in runtime["nativeNavigationCells"]}
  )
  assert all(
    len(row) == 3 and all(type(n) is int for n in row)
    for row in runtime["nativeNavigationCells"]
  )
  for model in runtime["models"]:
    if not model["native"]:
      continue
    p, indices = model_arrays(model)
    triangles = p[indices].astype(float)
    normals = np.cross(
      triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0]
    )
    assert np.all((normals != 0).sum(axis=1) == 1), model["key"]
  c = runtime["justiceColonnade"]
  assert c["bays"] == 7 and c["base"] == 4.922 and c["nativeBase"] == 5.2
  assert c["crown"] < c["ceiling"] < c["nativeCeiling"]


def test_every_ministry_has_full_drawn_and_actual_orthogonal_native_hosts():
  runtime = read(DATA / "federalMinistriesV321.json")
  assert {s["key"] for s in runtime["sites"]} == {
    "BMI",
    "BMJV",
    "BMBFSFJ",
    "BMDS",
    "BMG",
    "BMLEH",
    "BMZ",
    "BMWSB",
  }
  for site in runtime["sites"]:
    assert site["faces"] and site["nativeFaces"]
    assert len(site["partIds"]) == len(set(site["partIds"]))
    for face in site["faces"] + site["nativeFaces"]:
      assert face["owner"] in site["partIds"]
      assert face["range"][1] > face["range"][0]
      assert face["range"][3] > face["range"][2]
      assert face["polygon"]
    for face in site["nativeFaces"]:
      assert face["d"][0] * face["d"][1] == 0
      assert face["n"][0] * face["n"][1] == 0
  agriculture = next(s for s in runtime["sites"] if s["key"] == "BMLEH")
  assert any(
    f.get("detail", {}).get("style") == "basalt-shifted" for f in agriculture["faces"]
  )


def test_actual_native_columns_retain_all_mixed_foreign_or_tower_contributions():
  previous = read(DATA / "federalMinistriesV321Previous.json")
  proof = read(GEO / "federal-ministries-v321-native-evidence.json.gz")
  assert proof["mixedRetained"]
  for key in ["nativeFull", "nativeTouch"]:
    plan = previous["plans"][key]
    source = plan["nativeSource"]
    ids = {p["id"] for p in plan["owners"] if p["retireBody"]}
    assert source["cell"] == 4
    assert len(source["columns"]) == len(
      {tuple(c["source"][:2]) for c in source["columns"]}
    )
    for column in source["columns"]:
      assert column["contributors"]
      if column["retireBody"]:
        assert set(column["contributors"]) <= ids
    assert not {tuple(c["source"]) for c in source["columns"]} & {
      tuple(c["source"]) for c in proof["mixedRetained"]
    }
  assert len(previous["plans"]["preview"]["owners"]) == 5
  assert len(previous["plans"]["central"]["owners"]) == 1


def test_ten_packet_sources_remain_immutable_and_all_prepared_guards_are_closed():
  plans = read(DATA / "federalMinistriesV321Packets.json")
  proof = read(GEO / "federal-ministries-v321-packets-evidence.json.gz")
  assert len(plans["keys"]) == len(plans["packets"]) == 10
  assert set(plans["keys"]) == set(
    read(DATA / "federalMinistriesV321PacketIndex.json")["keys"]
  )
  assert proof["preparedGuardsFinalized"]
  for key, plan in plans["packets"].items():
    assert plan["navGuard"] and plan["preparedNavGuard"]
    assert plan["records"] and plan["preparedRecords"]
    assert plan["retire"] and not plan["retireLines"]
    assert not plan["appendNav"] and not plan["retireNav"]
    assert "append" not in plan
    for retired in plan["retire"]:
      assert retired["triangles"] == sorted(set(retired["triangles"]))
