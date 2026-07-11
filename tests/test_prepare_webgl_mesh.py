import geopandas as gpd
import numpy as np
import pytest
import trimesh
from shapely.affinity import rotate
from shapely.geometry import Point, box

from isometric_berlin.generation.prepare_webgl_mesh import (
  architectural_signature_payload,
  crop_mesh,
  metric_to_world,
  oriented_geometry_frame,
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


def test_oriented_geometry_frame_preserves_metric_rotation_and_center() -> None:
  source = rotate(box(-20.0, -80.0, 20.0, 80.0), 21.82, origin=(0, 0))

  frame = oriented_geometry_frame(source, x_axis="short")

  assert frame.center_x == pytest.approx(0.0, abs=1e-9)
  assert frame.center_y == pytest.approx(0.0, abs=1e-9)
  assert frame.rotation_degrees == pytest.approx(21.82, abs=1e-6)
  assert frame.width_m == pytest.approx(40.0, abs=1e-6)
  assert frame.depth_m == pytest.approx(160.0, abs=1e-6)


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


def test_architecture_signatures_keep_published_dimensions() -> None:
  landmarks = gpd.GeoDataFrame(
    {
      "name": [
        "Reichstagsgebäude",
        "Bundeskanzleramt",
        "Berlin Hauptbahnhof",
        "Brandenburger Tor",
      ]
    },
    geometry=[
      Point(389_815.0, 5_819_960.0),
      Point(389_346.0, 5_820_144.0),
      Point(389_377.0, 5_820_693.0),
      Point(389_918.0, 5_819_700.0),
    ],
    crs="EPSG:25833",
  )
  buildings = gpd.GeoDataFrame(
    {
      "building_name": [
        "Deutscher Bundestag; Reichstagsgebäude",
        "Bundeskanzleramt",
        "Bundeskanzleramt",
        "Bahnhofshalle",
      ],
      "measured_height_m": [28.06, 36.0, 18.0, 28.15],
    },
    geometry=[
      box(389_765, 5_819_890, 389_865, 5_820_028),
      box(389_318, 5_820_116, 389_374, 5_820_172),
      box(389_107, 5_820_091, 389_452, 5_820_197),
      box(389_327, 5_820_609, 389_432, 5_820_757),
    ],
    crs="EPSG:25833",
  )
  details = {
    identifier: [
      {
        "source_bounds_epsg25833": [
          [389_000.0, 5_819_000.0, 34.0],
          [390_000.0, 5_821_000.0, 90.0],
        ]
      }
    ]
    for identifier in (
      "reichstag",
      "bundeskanzleramt",
      "hauptbahnhof",
      "brandenburger-tor",
    )
  }

  signatures = architectural_signature_payload(landmarks, details, buildings)
  by_id = {signature["id"]: signature for signature in signatures}

  assert by_id["reichstag-model"]["depth_m"] == 138.0
  assert by_id["reichstag-model"]["rotation_y_degrees"] == 0.0
  assert by_id["bundeskanzleramt-model"]["cube_height_m"] == 36.0
  assert by_id["bundeskanzleramt-model"]["office_height_m"] == 18.0
  assert by_id["hauptbahnhof-model"]["east_west_roof_length_m"] == 321.0
  assert by_id["hauptbahnhof-model"]["office_bridge_height_m"] == 46.0
  assert by_id["hauptbahnhof-model"]["rotation_y_degrees"] == 0.0
  assert by_id["brandenburger-tor-model"]["columns_per_row"] == 6
  assert by_id["brandenburger-tor-model"]["total_height_m"] == 26.0
