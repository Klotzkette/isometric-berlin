import gzip
import json

from shapely.geometry import box

from isometric_berlin.data.fetch_berlin_mesh import (
  decode_index,
  merge_tile_records,
  select_index_features,
  terms_accepted,
)


def test_terms_gate_accepts_explicit_or_environment() -> None:
  assert terms_accepted(explicit=True, environ={})
  assert terms_accepted(environ={"BERLIN_3D_MESH_TERMS_ACCEPTED": "true"})
  assert not terms_accepted(environ={"BERLIN_3D_MESH_TERMS_ACCEPTED": "false"})


def test_decode_index_supports_headerless_gzip() -> None:
  payload = {"type": "FeatureCollection", "features": []}
  encoded = gzip.compress(json.dumps(payload).encode())
  assert decode_index(encoded) == payload


def test_select_index_features_clips_and_sorts() -> None:
  payload = {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[2, 2], [3, 2], [3, 3], [2, 3], [2, 2]]],
        },
        "properties": {"url": "b.zip"},
      },
      {
        "type": "Feature",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]],
        },
        "properties": {"url": "a.zip"},
      },
    ],
  }
  selected = select_index_features(payload, box(-0.5, -0.5, 1.1, 1.1))
  assert [feature["properties"]["url"] for feature in selected] == ["a.zip"]


def test_select_index_features_honours_exact_tile_allowlist() -> None:
  payload = {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "geometry": {
          "type": "Polygon",
          "coordinates": [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]],
        },
        "properties": {"url": name},
      }
      for name in ("a.zip", "b.zip")
    ],
  }
  selected = select_index_features(payload, box(0, 0, 2, 2), {"b.zip"})
  assert [feature["properties"]["url"] for feature in selected] == ["b.zip"]


def test_select_index_features_rejects_missing_requested_tile() -> None:
  payload = {"type": "FeatureCollection", "features": []}
  try:
    select_index_features(payload, box(0, 0, 2, 2), {"missing.zip"})
  except ValueError as error:
    assert "missing.zip" in str(error)
  else:
    raise AssertionError("missing requested tile should fail closed")


def test_merge_tile_records_is_additive_and_replaces_stale_duplicates() -> None:
  existing = [
    {"filename": "a.zip", "sha256": "old"},
    {"filename": "b.zip", "sha256": "keep"},
  ]
  selected = [
    {"filename": "a.zip", "sha256": "new"},
    {"filename": "c.zip", "sha256": "add"},
  ]
  assert merge_tile_records(existing, selected) == [
    {"filename": "a.zip", "sha256": "new"},
    {"filename": "b.zip", "sha256": "keep"},
    {"filename": "c.zip", "sha256": "add"},
  ]
