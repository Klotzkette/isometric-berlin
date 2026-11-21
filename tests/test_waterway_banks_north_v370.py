"""Check the new finishes against the geometry actually visible in each mode."""

import gzip
import importlib.util
import json
from collections import Counter
from functools import cache
from math import ceil, floor, hypot
from pathlib import Path

from shapely.affinity import translate
from shapely.geometry import LineString, Point, Polygon, shape
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src/app/src/data"
GEO = ROOT / "geo_data/regierungsviertel"
PACK = ROOT / "src/app/public/mesh/surrounding-berlin-v159"
DEST = DATA / "waterwayBanksV370North.json"


def read(path):
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def test_north_build_reproduces_installed_records_offline(tmp_path, monkeypatch):
  script = ROOT / "scripts/build_waterway_banks_north_v370.py"
  spec = importlib.util.spec_from_file_location("north_banks_v370", script)
  builder = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(builder)
  rebuilt = tmp_path / "banks.json"
  monkeypatch.setattr(builder, "DEST", rebuilt)
  builder.build()
  assert rebuilt.read_bytes() == DEST.read_bytes()
  records = read(rebuilt)["records"]
  assert Counter(r["modes"][0] for r in records) == {"drawn": 48, "minecraft": 44}


@cache
def existing_water(host, mode):
  if host == "west-lakes-v194":
    sites = read(DATA / "westLakesV194Navigation.json")[
      "native" if mode == "minecraft" else mode
    ]
    lake = next(s for s in sites if s["key"] == "tegel-water")
    return prep(
      unary_union([Polygon(ring, holes) for ring, *holes in lake["polygons"]])
    )
  packet = read(PACK / f"{host}.{mode}.json.gz")
  x, _, z = packet["origin"]
  return prep(
    unary_union(
      [
        translate(Polygon(p["ring"], p.get("holes", [])), x, z)
        for p in packet["nav"]["water"]
      ]
    )
  )


def test_bank_and_normal_are_registered_to_water_in_the_correct_family():
  for row in read(DEST)["records"]:
    if row["host"] == "panke-v229":
      continue
    water = existing_water(row["host"], row["modes"][0])
    assert row["waterSide"] == 1 and row["waterY"] == -1.15
    for (x0, z0), (x1, z1) in zip(row["points"], row["points"][1:], strict=False):
      x, z = (x0 + x1) * 0.5, (z0 + z1) * 0.5
      dx, dz = x1 - x0, z1 - z0
      length = hypot(dx, dz)
      nx, nz = -dz / length, dx / length
      # 2 cm on each side distinguishes the actual wet/dry boundary even at
      # a bevelled drawn corner or within a single Native two-metre cell.
      assert water.contains(Point(x + 0.02 * nx, z + 0.02 * nz)), row["id"]
      assert not water.contains(Point(x - 0.02 * nx, z - 0.02 * nz)), row["id"]


def test_wedding_masonry_uses_unchanged_source_faces_heights_and_normals():
  for mode, model, field in (
    ("drawn", "pankeBanksV229.json", "pankeFaces"),
    ("minecraft", "pankeNativeBanksV229.json", "nativePankeFaces"),
  ):
    rows = read(DATA / model)["banks"]
    used = set()
    for r in read(DEST)["records"]:
      if r["modes"] != [mode] or r["host"] != "panke-v229":
        continue
      assert len(r["points"]) == len(r["topY"]) == len(r[field]) + 1
      if "brickPlinthHeight" in r:
        assert r["source"] == "walter-roeber" and r["faceOffset"] == 0
      else:
        assert r["faceOffset"] == (-0.055 if mode == "drawn" else -0.012)
      for i, idx in enumerate(r[field]):
        assert idx not in used
        used.add(idx)
        ax, az, bx, bz, nx, nz, kind, h0, h1, *_ = rows[idx]
        a, b = r["points"][i : i + 2]
        assert kind == "brick"
        assert {tuple(a), tuple(b)} == {(ax, az), (bx, bz)}
        assert r["topY"][i : i + 2] == ([h0, h1] if a == [ax, az] else [h1, h0])
        assert -(b[1] - a[1]) * nx + (b[0] - a[0]) * nz > 0


def test_mapped_beach_and_reeds_are_disjoint_and_badstrasse_portal_is_open():
  rows = read(DEST)["records"]
  tunnels = shape(read(GEO / "panke-banks-v229-source.json")["tunnels"])
  for mode in ("drawn", "minecraft"):
    selected = [r for r in rows if r["modes"] == [mode]]

    def lines(key):
      return unary_union(
        [LineString(r["points"]) for r in selected if r["source"] == key]
      )

    assert lines("badegewaesser").distance(lines("roehricht")) > 1.0
    assert lines("gropius-badstrasse").distance(tunnels) > 60


def test_low_plinths_on_both_sides_clear_every_legacy_paint_stroke():
  rows = read(DEST)["records"]
  for mode, source in (
    ("drawn", "pankeBanksV229.json"),
    ("minecraft", "pankeNativeBanksV229.json"),
  ):
    walls = [r for r in rows if r["modes"] == [mode] and "brickPlinthHeight" in r]
    assert len(walls) == 2
    signed = set()
    for wall in walls:
      assert wall["source"] == "walter-roeber" and wall["width"] == 0.9
      assert wall["waterY"] + wall["brickPlinthHeight"] < min(wall["topY"])
      signed.add(wall["points"][-1][1] > wall["points"][0][1])
    assert signed == {True, False}
    slopes = unary_union([LineString(r["points"]) for r in walls])
    for ax, az, bx, bz, nx, nz, kind, *_ in read(DATA / source)["banks"]:
      if kind != "brick":
        continue
      length = hypot(bx - ax, bz - az)
      dx, dz = (bx - ax) / length, (bz - az) / length
      segments = ceil(length / 12)
      interval = length / segments
      if interval <= 2.2:
        continue
      for i in range(segments):
        mid = (i + 0.5) * interval
        if (floor((ax + dx * mid) / 24) + floor((az + dz * mid) / 24)) % 3:
          continue
        # Full footprint from first to last painted stroke and the original
        # waterward offset; the safety margin also covers the Native box width.
        lo = i * interval + 0.4
        hi = lo + 1.51
        paint = LineString(
          [(ax + dx * u + nx * 0.12, az + dz * u + nz * 0.12) for u in (lo, hi)]
        )
        assert slopes.distance(paint) > 2.8
