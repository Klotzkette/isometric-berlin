import numpy as np
import trimesh

from isometric_berlin.generation.prepare_webgl_mesh import (
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
