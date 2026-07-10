import geopandas as gpd
import numpy as np
import trimesh
from shapely.geometry import Point

from isometric_berlin.generation.prepare_webgl_mesh import (
  architectural_signature_payload,
  crop_mesh,
  metric_to_world,
  split_bounds,
)


def test_metric_to_world_uses_east_up_south_axes() -> None:
  transformed = metric_to_world(np.array([[389_510.0, 5_820_020.0, 42.0]], dtype=float))
  assert transformed.tolist() == [[10.0, 12.0, -20.0]]


def test_crop_mesh_keeps_faces_in_metric_rectangle() -> None:
  mesh = trimesh.Trimesh(
    vertices=np.array(
      [
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0],
        [10.0, 10.0, 0.0],
        [11.0, 10.0, 0.0],
        [10.0, 11.0, 0.0],
      ]
    ),
    faces=np.array([[0, 1, 2], [3, 4, 5]]),
    process=False,
  )
  cropped = crop_mesh(mesh, (-1.0, -1.0, 2.0, 2.0))
  assert cropped is not None
  assert len(cropped.faces) == 1


def test_split_bounds_uses_longer_axis() -> None:
  first, second = split_bounds((0.0, 0.0, 20.0, 8.0))
  assert first == (0.0, 0.0, 10.0, 8.0)
  assert second == (10.0, 0.0, 20.0, 8.0)


def test_reichstag_signature_uses_official_dimensions_and_mesh_apex() -> None:
  landmarks = gpd.GeoDataFrame(
    {"name": ["Reichstagsgebäude"]},
    geometry=[Point(390_000.0, 5_820_000.0)],
    crs="EPSG:25833",
  )
  details = {
    "reichstag": [
      {
        "source_bounds_epsg25833": [
          [389_950.0, 5_819_950.0, 33.0],
          [390_050.0, 5_820_050.0, 90.0],
        ]
      }
    ]
  }

  signature = architectural_signature_payload(landmarks, details)[0]

  assert signature["anchor_world"] == [500.0, 36.5, 0.0]
  assert signature["height_m"] == 23.5
  assert signature["diameter_m"] == 40.0
  assert signature["vertical_ribs"] == 24
  assert signature["horizontal_rings"] == 17
  assert signature["source_url"].startswith("https://www.bundestag.de/")
