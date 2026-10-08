"""Source-location and preservation checks for the bounded northern additions."""

import hashlib
import json
from pathlib import Path

import pytest
from shapely.geometry import LineString, Point, Polygon, box, shape
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / "src/app/src/data/northV185.json").read_text())


def test_fronts_are_exact_retained_owner_edges_with_outward_normals() -> None:
  """A decoration must attach to a named source edge, never a guessed block."""
  owners = {p["id"]: p for p in SOURCE["owners"]}
  assert len(owners) == 35
  for f in SOURCE["faces"]:
    owner = owners[f["id"]]
    footprint = shape(owner["geometry"])
    segment = LineString([f["a"], f["b"]])
    assert segment.difference(footprint.boundary.buffer(0.002)).length < 0.001
    assert f["height"] == owner["height"]
    wall = shape(f["wallGeometry"])
    assert wall.buffer(0.004).covers(
      box(0.08, f["wallBottom"] + 0.03, segment.length - 0.08, f["wallTop"] - 0.03)
    )
    assert f["wallTop"] - f["wallBottom"] >= 4
    center = segment.interpolate(0.5, normalized=True)
    nx, nz = f["normal"]
    assert nx * nx + nz * nz == pytest.approx(1, abs=1e-7)
    assert not footprint.covers(Point(center.x + nx * 0.15, center.y + nz * 0.15))
  assert {p["kind"] for p in owners.values()} == {
    "kulturbrauerei",
    "hagenauer",
    "choriner",
  }


def test_flowerbed_accent_does_not_replace_or_spill_into_other_park_surfaces() -> None:
  """The new flowers use the same seven already-rendered OSM planted beds."""
  heritage_path = ROOT / "src/app/src/data/mitteHeritageV166Source.json"
  assert (
    hashlib.sha256(heritage_path.read_bytes()).hexdigest()
    == SOURCE["inputSha256"]["heritage"]
  )
  heritage = json.loads(heritage_path.read_text())
  park = shape(next(p["geometry"] for p in heritage["parks"] if p["id"] == "104954713"))
  delivered_beds = unary_union(
    [
      Polygon([(p[0], p[2]) for p in t])
      for s in heritage["groundSurfaces"]
      if s["kind"] == "flowerbed"
      for t in s["triangles"]
    ]
  )
  assert len(SOURCE["beds"]) == 7
  for bed in SOURCE["beds"]:
    p = shape(bed["geometry"])
    assert park.covers(p)
    assert p.difference(delivered_beds.buffer(0.005)).area < 0.1


def test_hagenauer_retains_tagged_width_and_all_three_source_segments() -> None:
  """The added kerbs follow the retained tagged alignment without a new route."""
  assert {p["id"] for p in SOURCE["roads"]} == {
    "way/4606266",
    "way/1133761541",
    "way/1415465562",
  }
  assert all(
    p["width"] == 11.2 and p["widthSource"] == "ARCore" for p in SOURCE["roads"]
  )
  assert {p["surface"] for p in SOURCE["roads"]} == {"sett", "asphalt"}
  assert all(len(p["line"]) >= 2 for p in SOURCE["roads"])
