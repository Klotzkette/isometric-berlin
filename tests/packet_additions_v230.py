"""Audited finite v230 append; never a waiver for changing historical packets."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
import subprocess
from functools import lru_cache
from pathlib import Path

import numpy as np
from pyproj import Transformer
from shapely import make_valid
from shapely.geometry import Polygon, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"


def digest(raw: bytes) -> str:
  return hashlib.sha256(raw).hexdigest()


@lru_cache(maxsize=1)
def baseline_v229_bytes() -> bytes:
  return subprocess.check_output(
    [
      "git",
      "show",
      "v1.0.129:src/app/public/mesh/surrounding-berlin-v159/manifest.json",
    ],
    cwd=ROOT,
  )


@lru_cache(maxsize=1)
def baseline_v229() -> dict:
  return json.loads(baseline_v229_bytes())


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def checked(asset: dict, reader) -> dict:
  assert set(asset) == {"url", "encoding", "bytes", "decodedBytes", "sha256"}
  assert Path(asset["url"]).name == asset["url"] and asset["encoding"] == "gzip"
  packed = reader(PUBLIC / asset["url"])
  assert len(packed) == asset["bytes"] < 650_000
  assert digest(packed) == asset["sha256"]
  raw = gzip.decompress(packed)
  assert len(raw) == asset["decodedBytes"] < 2_600_000
  return json.loads(raw)


def normalize_v230_additions(current: dict, reader) -> tuple[dict, dict]:
  """Return the immutable predecessor only after proving the complete append.

  All old fields, descriptors, order, footprints and actual bytes are bound to
  the released predecessor. The new named footprint and both finite families
  are checked separately; deleting arbitrary prefixed records is forbidden.
  """
  from scripts.integrate_ber_airport_v236 import normalize_ber_additions

  current = normalize_ber_additions(current, reader)
  names = {"outerFacadesV230", "marzahnV230"}
  if not names.intersection(current):
    assert not any(
      c["id"].startswith(("outerfacade230-", "marzahn230-")) for c in current["chunks"]
    )
    return current, {}
  assert names <= current.keys()
  old = baseline_v229()
  evidence = read(GEO / "outer-facades-v230-evidence.json.gz")
  supplement = read(GEO / "marzahn-v230-manifest.json")
  context = read(GEO / "outer-facades-v230-context.json.gz")
  assert evidence["contextSha256"] == digest(
    (GEO / "outer-facades-v230-context.json.gz").read_bytes()
  )
  assert evidence["oldAssets"] == [
    dict(url=c[m]["url"], sha256=c[m]["sha256"])
    for c in old["chunks"]
    for m in ("drawn", "minecraft")
  ]
  companions = evidence["companions"]
  assert (
    len(old["chunks"]) == 1905
    and len(companions) == 90
    and len(supplement["chunks"]) == 17
  )
  assert len(evidence["faces"]) == 3563
  assert (
    evidence["counts"]["windows"]
    == sum(f["windowCount"] for f in evidence["faces"])
    == 34348
  )
  assert (
    evidence["counts"]["nativeWindows"]
    == sum(f["nativeWindowCount"] for f in evidence["faces"])
    == 12263
  )
  assert not {f["owner"] for f in evidence["faces"]} & set(context["authoredIds"])
  assert supplement["version"] == "1.0.130"
  assert (
    supplement["source"]["buildingCount"] == 379
    and supplement["source"]["officialBuildingCount"] == 334
  )
  expected = {
    **old,
    "chunks": old["chunks"] + companions + supplement["chunks"],
    "footprint": old["footprint"] + supplement["footprint"],
    "bounds": [
      (min if i < 2 else max)(old["bounds"][i], supplement["bounds"][i])
      for i in range(4)
    ],
    "outerFacadesV230": dict(
      policy=evidence["policy"], counts=evidence["counts"], companions=90, fronts=3563
    ),
    "marzahnV230": supplement["source"],
  }
  assert current == expected
  assert len(current["chunks"]) == 2012 <= 2048
  assert len(json.dumps(current, separators=(",", ":")).encode()) < 2 * 1024**2
  old_by_id = {c["id"]: c for c in old["chunks"]}
  additions = {c["id"]: c for c in companions + supplement["chunks"]}
  assert len(additions) == 107 and not additions.keys() & old_by_id.keys()
  # No mutation, omission or metadata rewrite of old payloads is normalized away.
  for descriptor in old["chunks"]:
    for mode in ("drawn", "minecraft"):
      asset = descriptor[mode]
      raw = reader(PUBLIC / asset["url"])
      assert len(raw) == asset["bytes"] and digest(raw) == asset["sha256"], asset["url"]
  totals = {"drawnBytes": 0, "minecraftBytes": 0}
  for c in companions:
    assert set(c) == {"id", "detailCompanionOf", "bounds", "drawn", "minecraft"}
    parent = c["detailCompanionOf"]
    assert parent in old_by_id
    assert (
      c["id"] == "outerfacade230-" + parent
      and c["bounds"] == old_by_id[parent]["bounds"]
    )
    for mode in ("drawn", "minecraft"):
      assert c[mode]["url"] == c["id"] + "." + mode + ".json.gz"
      p = checked(c[mode], reader)
      totals[mode + "Bytes"] += c[mode]["bytes"]
      assert p["id"] == c["id"] and p["schemaVersion"] == 1
      assert p["origin"] == [c["bounds"][0], -10, c["bounds"][1]]
      assert p["nav"] == {"groundY": 3, "ground": [], "water": [], "buildings": []}
      expected_windows = sum(
        f["windowCount" if mode == "drawn" else "nativeWindowCount"]
        for f in evidence["faces"]
        if f["chunk"] == parent
      )
      assert set(p) == {"id", "schemaVersion", "origin", "meshes", "nav"}
      assert len(p["meshes"]) == int(expected_windows > 0)
      if not p["meshes"]:
        continue
      mesh = p["meshes"][0]
      assert mesh["kind"] == "outer-facades-v230" and mesh["positionType"] == "u16cm"
      vertices = np.frombuffer(base64.b64decode(mesh["positions"]), "<u2").reshape(
        -1, 3
      )
      indices = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
      assert len(base64.b64decode(mesh["colors"])) == len(
        vertices
      ) * 3 and indices.max() < len(vertices)
      if mode == "minecraft":
        spans = np.ptp(vertices[indices].astype(int), axis=1)
        assert np.all((spans[:, 0] == 0) | (spans[:, 2] == 0))
  assert totals == {k: evidence["counts"][k] for k in totals}
  # The only new geography is the independent finite Marzahn source difference.
  project = Transformer.from_crs(4326, 25833, always_xy=True).transform

  def geographic(path):
    return unary_union(
      [
        make_valid(transform(project, shape(f["geometry"])))
        for f in read(path)["features"]
      ]
    )

  scope = geographic(GEO / "bounds-marzahn-v230.geojson")
  retained = geographic(GEO / "bounds-marzahn-v230-retained.geojson")
  assert supplement["source"]["boundsSha256"] == digest(
    (GEO / "bounds-marzahn-v230.geojson").read_bytes()
  )
  assert supplement["source"]["preservedCoreSha256"] == digest(
    (GEO / "bounds-marzahn-v230-retained.geojson").read_bytes()
  )
  actual = unary_union(
    [make_valid(Polygon(p["ring"], p["holes"])) for p in supplement["footprint"]]
  )
  actual = transform(lambda x, z: (x + 389500, 5820000 - z), actual)
  difference = scope.difference(retained)
  assert actual.symmetric_difference(difference).area < difference.length * 0.015
  assert actual.intersection(retained.buffer(-0.015)).area < 0.1
  for c in supplement["chunks"]:
    assert c["id"].startswith("marzahn230-") and "detailCompanionOf" not in c
    for mode in ("drawn", "minecraft"):
      assert c[mode]["url"] == c["id"] + "." + mode + ".json.gz"
      p = checked(c[mode], reader)
      assert p["id"] == c["id"] and p["nav"]["groundY"] == 3
      assert p["origin"] == [c["bounds"][0], -10, c["bounds"][1]]
  checked(supplement["source"]["inventory"], reader)
  return old, additions


@lru_cache(maxsize=1)
def audited_v230_additions() -> dict:
  _, additions = normalize_v230_additions(
    read(PUBLIC / "manifest.json"), lambda p: p.read_bytes()
  )
  return additions


@lru_cache(maxsize=1)
def predecessor_manifest_v230() -> dict:
  audited_v230_additions()
  return baseline_v229()
