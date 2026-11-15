import zipfile

import pytest

from scripts.build_fuel_terrain_v351 import cell_for, read_cells, site_points


def test_source_cell_axis_and_tile_boundary():
  assert cell_for(0, 0) == ("388_5820", 389500, 5820000)
  assert cell_for(500, 0.01) == ("390_5818", 390000, 5819999)
  assert cell_for(-1500.01, -2000) == ("386_5822", 387999, 5822000)


def test_requested_coordinates_must_match_original_dgm_rows(tmp_path):
  path = tmp_path / "DGM1_388_5820.zip"
  with zipfile.ZipFile(path, "w") as archive:
    archive.writestr(
      "dgm1_33_388_5820_2_be.xyz",
      "388000.5 5820000.5 34.27\n388001.5 5820000.5 34.28\n",
    )
  result, _ = read_cells(path, "388_5820", {(388001, 5820000)})
  assert result == {(388001, 5820000): 34.28}
  with zipfile.ZipFile(path, "w") as archive:
    archive.writestr(
      "sample.xyz", "388001.25 5820000.5 34.28\n388000.5 5820000.5 34.27\n"
    )
  with pytest.raises(AssertionError):
    read_cells(path, "388_5820", {(388001, 5820000)})


def test_support_samples_keep_original_noninteger_outline_vertices():
  polygon = {
    "type": "Polygon",
    "coordinates": [
      [[1.13, 2.29], [9.71, 2.29], [9.71, 6.43], [1.13, 6.43], [1.13, 2.29]]
    ],
  }
  points = site_points(
    {
      "roof": {"geometry": polygon},
      "site": {"geometry": {"type": "Point", "coordinates": [5, 4]}},
    }
  )
  assert (1.13, 2.29) in points and (9.71, 6.43) in points
  assert len(points) == len(set(points))
  assert len(points) < 100
