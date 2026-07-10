import gzip
import json

from shapely.geometry import box

from isometric_berlin.data.fetch_berlin_mesh import (
  decode_index,
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
