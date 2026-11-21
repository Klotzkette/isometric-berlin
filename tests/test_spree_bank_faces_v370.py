import json

from shapely.geometry import LineString

from scripts.build_spree_bank_faces_v370 import REACHES, fit
from scripts.index_waterway_banks_v370 import DATA, SOURCES


def test_rungestrasse_faces_follow_the_released_water_polygons():
  records = json.loads((DATA / "waterwayBanksV370Spree.json").read_bytes())["records"]
  assert len(records) == len(REACHES)
  for mode, points, top in (
    ("drawn", "points", "topY"),
    ("minecraft", "nativePoints", "nativeTopY"),
  ):
    shorelines, crown = fit(mode)
    for (name, material, a, b), boundary, record in zip(
      REACHES, shorelines, records, strict=True
    ):
      assert (
        record["id"] == f"spree-rungestrasse-{name}" and record["material"] == material
      )
      assert record[points] == boundary
      assert all(y == crown for y in record[top])
      assert len(record[top]) == len(boundary)
      assert record["waterY"] < crown and record["waterSide"] == -1
      assert LineString(boundary).length >= 0.9 * LineString([a, b]).length
      if mode == "minecraft":
        assert all(
          x == xx or z == zz for (x, z), (xx, zz) in zip(boundary, boundary[1:])
        )


def test_directory_references_every_local_reach_exactly_once():
  directory = json.loads((DATA / "waterwayBankHostsV370.json").read_bytes())
  for source in SOURCES:
    rows = json.loads((DATA / f"waterwayBanksV370{source}.json").read_bytes())[
      "records"
    ]
    indices = []
    for host, sources in directory["sections"].items():
      for i in sources.get(source, []):
        indices.append(i)
        if host not in directory["bounds"]:
          assert host == rows[i]["host"]
          continue
        x0, z0, x1, z1 = directory["bounds"][host]
        assert all(
          x0 < x < x1 and z0 < z < z1
          for x, z in rows[i]["points"] + rows[i].get("nativePoints", [])
        )
    assert sorted(indices) == list(range(len(rows)))
