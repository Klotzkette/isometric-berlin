"""Independently replay the positive ordinary-use evidence for new fronts."""

from __future__ import annotations

import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import Polygon, shape
from shapely.ops import transform

ROOT = Path(__file__).resolve().parents[1]
GEO = ROOT / "geo_data/regierungsviertel"


def read(path: Path) -> dict:
  raw = path.read_bytes()
  return json.loads(gzip.decompress(raw) if path.suffix == ".gz" else raw)


def test_southern_clusters_have_complete_distinct_source_owners() -> None:
  profile = read(GEO / "cluster-facades-v320-south-profile.json")
  clusters = profile["clusters"]
  faces = [f for c in clusters for f in c["faces"]]
  assert len(clusters) == 16
  assert Counter(c["ring"] for c in clusters) == {"inner": 12, "outer": 4}
  assert all(len(c["faces"]) == 4 and c["references"] for c in clusters)
  assert len({c["id"] for c in clusters}) == 16
  assert len({c["style"]["key"] for c in clusters}) == 16
  assert len({f["owner"] for f in faces}) == 64
  assert Counter(f["family"] for f in faces) == {
    "primary": 32,
    "v188": 24,
    "v230": 8,
  }
  # Older mapped material observations outrank contextual facade paint.
  selected = {f["owner"] for f in faces}
  for version in (232, 254, 263):
    recorded = read(GEO / f"outer-materials-v{version}-evidence.json.gz")
    assert not selected.intersection(recorded["owners"])


def test_new_southern_fronts_have_positive_frozen_residential_sources() -> None:
  profile_path = GEO / "cluster-facades-v320-south-profile.json"
  profile = read(profile_path)
  evidence = read(GEO / "cluster-facades-v320-south-ordinary-evidence.json.gz")
  assert (
    evidence["profileSha256"] == hashlib.sha256(profile_path.read_bytes()).hexdigest()
  )
  selected = {
    f["owner"]: f
    for c in profile["clusters"]
    for f in c["faces"]
    if f["family"] == "primary"
  }
  assert len(evidence["records"]) == 32
  assert {r["owner"] for r in evidence["records"]} == set(selected)
  projection = Transformer.from_crs(4326, 25833, always_xy=True)

  def world(x: float, y: float, z: float | None = None) -> tuple:
    east, north = projection.transform(x, y)
    return east - 389500, 5820000 - north

  manifest = read(ROOT / "src/app/public/mesh/surrounding-berlin-v159/manifest.json")
  descriptors = {d["id"]: d for d in manifest["chunks"]}
  checked = {}
  for record in evidence["records"]:
    face = selected[record["owner"]]
    assert record["ordinaryWallAudit"] == face["ordinaryWallAudit"]
    assert (
      record["ordinaryWallAudit"]["sourceFileSha256"] == evidence["sourceFileSha256"]
    )
    original = record["sourceRecord"]
    properties = original["properties"]
    assert properties["building"] in {
      "apartments",
      "residential",
      "house",
      "terrace",
      "detached",
      "semidetached_house",
    }
    assert all(
      properties[k] is None
      for k in ("name", "amenity", "office", "shop", "tourism", "historic")
    )
    tags = properties["other_tags"] or ""
    assert not any(
      f'"{tag}"' in tags
      for tag in (
        "building:colour",
        "building:color",
        "building:material",
        "facade:colour",
        "facade:color",
        "facade:material",
      )
    )
    source = record["sourceBody"]
    building = source["building"]
    assert building["sourceId"] == face["owner"]
    ox, _, oz = source["origin"]
    polygon = Polygon(
      [(x + ox, z + oz) for x, z in building["ring"]],
      [[(x + ox, z + oz) for x, z in h] for h in building["holes"]],
    )
    osm = transform(world, shape(original["geometry"]))
    overlap = polygon.intersection(osm).area / polygon.union(osm).area
    assert overlap >= 0.72
    assert abs(overlap - record["ordinaryWallAudit"]["footprintIoU"]) < 0.000001
    assert face["nativeSpans"]
    tile = record["chunk"]
    if tile not in checked:
      path = (
        ROOT
        / "src/app/public/mesh/surrounding-berlin-v159"
        / descriptors[tile]["drawn"]["url"]
      )
      checked[tile] = (hashlib.sha256(path.read_bytes()).hexdigest(), read(path))
    digest, packet = checked[tile]
    assert digest == record["bodyPacketSha256"]
    assert source["origin"] == packet["origin"]
    assert source["groundY"] == packet["nav"]["groundY"]
    assert building in packet["nav"]["buildings"]
