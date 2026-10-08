"""Explicit v193→v194 airport and Viktoriapark transitions; no blanket exceptions."""

from __future__ import annotations

import gzip
import hashlib
import json
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

import numpy as np
from shapely.geometry import Point, Polygon

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"
PUBLIC = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
sys.path.insert(0, str(ROOT / "scripts"))


def load(path: Path) -> dict:
  return json.loads(path.read_bytes())


@lru_cache(maxsize=None)
def baseline_v193(path: Path) -> bytes:
  return subprocess.check_output(
    ["git", "show", f"v1.0.93:{path.relative_to(ROOT)}"], cwd=ROOT
  )


def owned_points(
  packet: dict, counter: dict, owners: set, *, ink: bool = False
) -> None:
  regions = [
    (
      Polygon(r["ring"], r["holes"]).buffer(0.011),
      packet["nav"]["groundY"] + r.get("groundOffset", 0) + r["minHeight"],
      packet["nav"]["groundY"] + r.get("groundOffset", 0) + r["height"],
    )
    for r in packet["nav"]["buildings"]
    if r["sourceId"] in owners
  ]
  assert regions
  for key in counter:
    pts = np.frombuffer(key, dtype="<u2").reshape(-1, 6)[:, :3].astype(float) / 100
    pts[:, 1] += packet["origin"][1]
    assert any(
      all(
        poly.covers(Point(x, z))
        and (abs(y - high - 0.02) < 0.012 if ink else low - 0.011 <= y <= high + 0.031)
        for x, y, z in pts
      )
      for poly, low, high in regions
    )


@lru_cache(maxsize=1)
def audited_v194_changes() -> dict:
  from build_karl_marx_allee_v161 import mesh_signature
  from integrate_airports_v194 import signature_sha
  from integrate_city_refinements_v166 import line_signature
  from integrate_viktoriapark_v194 import water_signature

  changes = {}
  baseline = {
    d["id"]: d for d in json.loads(baseline_v193(PUBLIC / "manifest.json"))["chunks"]
  }
  air = load(GEO / "airports-v194-packet-patch.json")
  owners = {
    "DEBE07YY90002dwR",
    "DEBE07YY90002daO",
    "DEBE07YY90002dsj",
    "DEBE07YY900008Ks",
    "DEBE07YY900002ol",
    "DEBE07YY9000088X",
  }
  assert set(air["ownerIds"]) == owners and air["unrelatedGeometryPreserved"]
  assert {c["id"] for c in air["chunks"]} == {
    "1_7",
    "1_8",
    "2_7",
    "2_8",
    "3_7",
    "ring182-1_8",
    "ring182-1_9",
    "ring182-2_8",
  }
  for c in air["chunks"]:
    for mode, r in c["modes"].items():
      path = PUBLIC / c["descriptor"][mode]["url"]
      oldraw, newraw = baseline_v193(path), path.read_bytes()
      assert (
        hashlib.sha256(oldraw).hexdigest()
        == r["oldSha256"]
        == baseline[c["id"]][mode]["sha256"]
      )
      assert hashlib.sha256(newraw).hexdigest() == r["newSha256"]
      old, new = map(lambda b: json.loads(gzip.decompress(b)), [oldraw, newraw])
      before, after = mesh_signature(old), mesh_signature(new)
      removed = before - after
      assert not after - before and sum(removed.values()) == r["removedTriangles"] > 0
      assert sum(after.values()) == r["preservedTriangles"]
      assert signature_sha(after) == r["preservedTriangleSha256"]
      owned_points(old, removed, owners)
      assert {k: v for k, v in old.items() if k not in ["meshes", "lines", "nav"]} == {
        k: v for k, v in new.items() if k not in ["meshes", "lines", "nav"]
      }
      assert [m for m in old["meshes"] if m["kind"] != "city"] == [
        m for m in new["meshes"] if m["kind"] != "city"
      ]
      assert {k: v for k, v in old["nav"].items() if k != "buildings"} == {
        k: v for k, v in new["nav"].items() if k != "buildings"
      }
      assert [b for b in old["nav"]["buildings"] if b["sourceId"] not in owners] == new[
        "nav"
      ]["buildings"]
      if mode == "drawn":
        a, b = line_signature(old["lines"]), line_signature(new["lines"])
        assert not b - a
        assert sum((a - b).values()) == r["removedSourceInkSegments"]
        owned_points(old, a - b, owners, ink=True)
      else:
        assert old.get("lines") == new.get("lines")
      changes[c["id"], mode] = (r["oldSha256"], r["newSha256"])
  park = load(GEO / "viktoriapark-v194-packet-audit.json")
  assert (
    park["baseRelease"] == "v1.0.93"
    and park["id"] == "1_6"
    and park["owner"] == "DEBE02YY400001Vu"
  )
  for mode, r in park["modes"].items():
    path = PUBLIC / r["newDescriptor"]["url"]
    oldraw, newraw = baseline_v193(path), path.read_bytes()
    assert (
      hashlib.sha256(oldraw).hexdigest()
      == r["oldSha256"]
      == baseline["1_6"][mode]["sha256"]
    )
    assert hashlib.sha256(newraw).hexdigest() == r["newSha256"]
    old, new = map(lambda b: json.loads(gzip.decompress(b)), [oldraw, newraw])
    before = mesh_signature(old) - water_signature(old)
    after = mesh_signature(new) - water_signature(new)
    removed = before - after
    assert (
      not after - before and sum(removed.values()) == r["removedOwnerTriangles"] > 0
    )
    owned_points(old, removed, {park["owner"]})
    assert (
      sum(after.values()) == r["preservedTriangles"]
      and signature_sha(after) == r["preservedTrianglesSha256"]
    )
    assert water_signature(old, True) == water_signature(new, True)
    assert signature_sha(water_signature(old, True)) == r["sourceWaterXzSha256"]
    assert old["nav"] == new["nav"] and r["allNavigationUnchanged"]
    assert {k: v for k, v in old.items() if k not in ["meshes", "lines"]} == {
      k: v for k, v in new.items() if k not in ["meshes", "lines"]
    }
    if mode == "drawn":
      a, b = line_signature(old["lines"]), line_signature(new["lines"])
      assert not b - a
      assert sum((a - b).values()) == r["removedOwnerInkSegments"]
      owned_points(old, a - b, {park["owner"]}, ink=True)
    else:
      assert old.get("lines") == new.get("lines")
    changes["1_6", mode] = (r["oldSha256"], r["newSha256"])
  assert len(changes) == 18
  return changes
