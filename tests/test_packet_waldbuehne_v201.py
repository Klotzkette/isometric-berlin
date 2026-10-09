"""Finite final ownership proof and negative checks for precise ground cutouts."""

import copy

import numpy as np
import pytest
from packet_waldbuehne_v201 import (
  FAMILY,
  GEO,
  IDS,
  PUBLIC,
  audit_waldbuehne,
  load,
  triangles,
  unique_rows,
  verify_ground_cuts,
)
from shapely.geometry import box


def fixture():
  from build_surrounding_outlines import COLORS, linear_rgb_bytes
  from test_weinberg_terrain_packets_v176 import _mesh

  color = linear_rgb_bytes(np.asarray([COLORS["ground"]]))[0]
  before = _mesh(
    [[0, 3, 0], [4, 3, 0], [0, 3, 4]],
    [[0, 1, 2]],
    [0, 0, 0],
    kind="city",
    colors=np.tile(color, (3, 1)),
  )
  after = _mesh(
    [[1, 3, 0], [4, 3, 0], [1, 3, 3]],
    [[0, 1, 2]],
    [0, 0, 0],
    kind="city",
    colors=np.tile(color, (3, 1)),
  )
  cut = {
    "mesh": 0,
    "sourceTriangle": 0,
    "source": triangles(before)[0].tolist(),
    "outsideStart": 0,
    "outsideCount": 1,
    "projectionAxes": [0, 2],
    "removedPlaneArea": 3.5,
    "removedProjectedArea": 3.5,
  }
  return (
    {"origin": [0, 0, 0], "meshes": [before]},
    {"origin": [0, 0, 0], "meshes": [after]},
    [cut],
    box(0, 0, 1, 4),
  )


def test_ground_cut_requires_complete_outside_original_plane_and_material() -> None:
  import base64

  before, after, cuts, mask = fixture()
  verify_ground_cuts(before, after, cuts, mask)
  for column in (0, 1):
    altered = copy.deepcopy(after)
    mesh = altered["meshes"][0]
    positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").copy()
    positions.reshape(-1, 3)[:, column] += 100
    mesh["positions"] = base64.b64encode(positions).decode()
    with pytest.raises(AssertionError):
      verify_ground_cuts(before, altered, cuts, mask)
  altered = copy.deepcopy(after)
  altered["meshes"][0]["colors"] = base64.b64encode(
    np.full((3, 3), 99, dtype="u1")
  ).decode()
  with pytest.raises(AssertionError):
    verify_ground_cuts(before, altered, cuts, mask)
  altered = copy.deepcopy(after)
  altered["meshes"][0]["indices"] = base64.b64encode(
    np.array([0, 2, 1], dtype="<u4")
  ).decode()
  with pytest.raises(AssertionError):
    verify_ground_cuts(before, altered, cuts, mask)


def test_ground_cut_cannot_hide_an_uncut_face_or_repeat_its_receipt() -> None:
  before, after, cuts, mask = fixture()
  with pytest.raises(AssertionError):
    verify_ground_cuts(before, after, cuts + cuts, mask)
  # The reported source triangle must be the exact immutable input.
  incorrect = copy.deepcopy(cuts)
  incorrect[0]["source"][0][1] += 1
  with pytest.raises(AssertionError):
    verify_ground_cuts(before, after, incorrect, mask)
  with pytest.raises(AssertionError):
    verify_ground_cuts(before, after, cuts, box(20, 20, 21, 21))


def test_vertical_riser_cut_preserves_outside_wall_plane_and_height() -> None:
  import base64

  from build_surrounding_outlines import COLORS, linear_rgb_bytes
  from test_weinberg_terrain_packets_v176 import _mesh

  color = np.tile(linear_rgb_bytes(np.asarray([COLORS["ground"]]))[0], (3, 1))
  before = {
    "origin": [0, 0, 0],
    "meshes": [
      _mesh(
        [[0, 3, 2], [4, 3, 2], [0, 7, 2]],
        [[0, 1, 2]],
        [0, 0, 0],
        kind="city",
        colors=color,
      )
    ],
  }
  after = {
    "origin": [0, 0, 0],
    "meshes": [
      _mesh(
        [[1, 3, 2], [4, 3, 2], [1, 6, 2]],
        [[0, 1, 2]],
        [0, 0, 0],
        kind="city",
        colors=color,
      )
    ],
  }
  # The inner boundary convention leaves a negligible <1e-6 m² source sliver.
  cut = {
    "mesh": 0,
    "sourceTriangle": 0,
    "source": triangles(before["meshes"][0])[0].tolist(),
    "outsideStart": 0,
    "outsideCount": 1,
    "projectionAxes": [0, 1],
    "removedPlaneArea": 8 - (3 + 1e-7) ** 2 / 2,
    "removedProjectedArea": 0,
  }
  mask = box(-1, 1, 1, 3)
  verify_ground_cuts(before, after, [cut], mask)
  altered = copy.deepcopy(after)
  mesh = altered["meshes"][0]
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").copy()
  positions.reshape(-1, 3)[:, 2] += 100
  mesh["positions"] = base64.b64encode(positions).decode()
  with pytest.raises(AssertionError):
    verify_ground_cuts(before, altered, [cut], mask)
  with pytest.raises(AssertionError):
    verify_ground_cuts(before, before, [cut], mask)


def test_packet_rows_must_cover_exact_family_once() -> None:
  rows = [{"id": i} for i in sorted(IDS)]
  assert set(unique_rows(rows, IDS)) == IDS
  for invalid in (rows[:1], rows + rows[:1], rows + [{"id": "unrelated"}]):
    with pytest.raises(AssertionError):
      unique_rows(invalid, IDS)


def test_collinear_centimetre_wall_outside_mask_stays_byte_exact() -> None:
  from build_surrounding_outlines import COLORS, linear_rgb_bytes
  from test_weinberg_terrain_packets_v176 import _mesh

  origin = [-9728, -10, 0]
  mesh = _mesh(
    [[-9704, 37.6, 400], [-9704.01, 37.6, 399.99], [-9708.36, 37.01, 395.64]],
    [[0, 1, 2]],
    origin,
    kind="city",
    colors=np.tile(linear_rgb_bytes(np.asarray([COLORS["ground"]]))[0], (3, 1)),
  )
  packet = {"origin": origin, "meshes": [mesh]}
  verify_ground_cuts(packet, copy.deepcopy(packet), [], box(-9718, 75, -9625, 209))


def test_final_waldbuehne_packets_preserve_every_unrelated_face() -> None:
  terrain = load(GEO / "olympic-v201-packet-audit.json")
  terrain = {
    d["id"]: d for d in terrain["replacementDescriptors"] + terrain["extraDescriptors"]
  }
  current = {d["id"]: d for d in load(PUBLIC / "manifest.json")["chunks"]}
  checkpoints, final, counts = audit_waldbuehne(terrain, current)
  assert len(checkpoints) == 4 and set(final) == IDS
  assert counts == {FAMILY: (70, 47)}
