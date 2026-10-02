"""Split modules preserve world frames, oriented faces, colour and ink exactly."""

import base64
import copy
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))

import split_alt_mitte_v169_core as splitter  # noqa: E402
from alt_mitte_v169_packets import empty_packet, pack_detail, raw_packet  # noqa: E402
from build_karl_marx_allee_v161 import Detail  # noqa: E402


def encode(values, dtype):
  return base64.b64encode(np.asarray(values, dtype=dtype).tobytes()).decode()


def fixture_packet(origin_y=-60, colored_ink=True):
  packet = empty_packet("sample", (-512, 1024, 0, 1536), origin_y)
  mesh = {
    "kind": "source-preservation",
    "positionType": "u16cm",
    "positions": encode(
      [[0, 777, 0], [1300, 1234, 0], [0, 1900, 850], [0, 777, 0]], "<u2"
    ),
    "colors": encode(
      [[80, 120, 180], [200, 170, 100], [90, 200, 170], [180, 90, 130]], "u1"
    ),
    # Repeated/opposite faces and a coincident vertex with another colour all matter.
    "indices": encode(([0, 1, 2, 2, 1, 0, 3, 1, 2] * 10_001), "<u4"),
  }
  packet["meshes"] = [mesh]
  packet["lines"] = {
    "positionType": "u16cm",
    "positions": encode([[0, 777, 0], [1300, 1234, 0]] * 120_001, "<u2"),
  }
  if colored_ink:
    packet["lines"]["colors"] = encode([[21, 32, 43], [54, 65, 76]] * 120_001, "u1")
  return packet


def face_keys(packet):
  result = Counter()
  origin = np.rint(np.asarray(packet["origin"]) * 100).astype("<i4")
  for mesh in packet["meshes"]:
    xyz = (
      np.frombuffer(base64.b64decode(mesh["positions"]), "<u2")
      .reshape(-1, 3)
      .astype("<i4")
      + origin
    )
    rgb = np.frombuffer(base64.b64decode(mesh["colors"]), "u1").reshape(-1, 3)
    rows = np.column_stack((xyz, rgb.astype("<i4")))
    faces = np.frombuffer(base64.b64decode(mesh["indices"]), "<u4").reshape(-1, 3)
    for face in faces:
      vertices = [rows[index].tobytes() for index in face]
      # Cyclic rotation preserves winding; reversing it must remain distinguishable.
      result[min(b"".join(vertices[i:] + vertices[:i]) for i in range(3))] += 1
  return result


def ink_keys(packet):
  if not packet.get("lines"):
    return Counter()
  line = packet["lines"]
  xyz = (
    np.frombuffer(base64.b64decode(line["positions"]), "<u2")
    .reshape(-1, 3)
    .astype("<i4")
  )
  xyz += np.rint(np.asarray(packet["origin"]) * 100).astype("<i4")
  rgb = (
    np.frombuffer(base64.b64decode(line["colors"]), "u1").reshape(-1, 3).astype("<i4")
    if "colors" in line
    else np.full_like(xyz, -1)
  )
  rows = np.column_stack((xyz, rgb)).reshape(-1, 2, 6)
  return Counter(b"".join(sorted(row.tobytes() for row in pair)) for pair in rows)


@pytest.mark.parametrize("mode", ["drawn", "minecraft"])
@pytest.mark.parametrize("colored_ink", [True, False])
def test_split_source_preserves_negative_origin_winding_colours_duplicate_faces_and_ink(
  mode, colored_ink
):
  original = fixture_packet(-60, colored_ink)
  source = {
    "schemaVersion": 1,
    "sourceParents": ["family"],
    "drawnChunks": [],
    "minecraftChunks": [],
  }
  source[mode + "Chunks"] = [{"id": original["id"], "packet": original}]
  frozen = copy.deepcopy(source)
  result = splitter.split_source(source, mode)
  assert source == frozen
  assert len(result) == 4  # two triangle pieces and two complete-segment ink pieces
  assert len({item["id"] for item in result}) == len(result)
  faces, lines = Counter(), Counter()
  for item in result:
    packet = item["packet"]
    assert packet["origin"] == [-512, -60, 1024]
    assert item["id"] == packet["id"]
    assert len(raw_packet(packet)) < splitter.MAX_MODULE_BYTES
    assert all(
      packet["nav"][field] == []
      for field in ("ground", "water", "roads", "bridges", "buildings")
    )
    faces.update(face_keys(packet))
    lines.update(ink_keys(packet))
  assert faces == face_keys(original)
  assert lines == ink_keys(original)


def test_publish_metadata_references_each_exact_packet_with_mode_separation(
  tmp_path, monkeypatch
):
  source_folder = tmp_path / "input"
  data_folder = tmp_path / "published"
  source_folder.mkdir()
  data_folder.mkdir()
  original = fixture_packet(-60)
  # This test checks the import graph; the previous test exercises size splitting.
  original["meshes"][0]["indices"] = encode([0, 1, 2, 3, 1, 2], "<u4")
  original["lines"]["positions"] = encode([[0, 777, 0], [1300, 1234, 0]], "<u2")
  original["lines"]["colors"] = encode([[21, 32, 43], [54, 65, 76]], "u1")
  for label, mode in (("Drawn", "drawn"), ("Native", "minecraft")):
    value = {
      "schemaVersion": 1,
      "sourceParents": ["complete-parent"],
      "drawnChunks": [],
      "minecraftChunks": [],
    }
    value[mode + "Chunks"] = [{"id": original["id"], "packet": original}]
    (source_folder / f"altMitte{label}V169Source.json").write_text(json.dumps(value))
  (source_folder / "altMitteV169Navigation.json").write_text(
    json.dumps({"legacyPrisms": [], "parts": []})
  )
  monkeypatch.setattr(splitter, "DATA", data_folder)
  report = splitter.publish(source_folder)
  for label, mode in (("Drawn", "drawn"), ("Native", "minecraft")):
    metadata = json.loads(
      (data_folder / f"altMitte{label}V169Source.json").read_bytes()
    )
    assert metadata["mode"] == mode and metadata["sourceParents"] == ["complete-parent"]
    assert metadata["drawnChunks"] == metadata["minecraftChunks"] == []
    assert len(metadata["chunkFiles"]) == report[mode]["packets"] == 2
    actual_faces, actual_lines = Counter(), Counter()
    code = (data_folder / f"altMitte{label}V169Data.ts").read_text()
    for entry in metadata["chunkFiles"]:
      assert entry["file"].startswith(f"altMitteV169{label}/packet-")
      assert f'"./{entry["file"]}"' in code
      packet = json.loads((data_folder / entry["file"]).read_bytes())
      assert packet["id"] == entry["id"]
      actual_faces.update(face_keys(packet))
      actual_lines.update(ink_keys(packet))
    assert actual_faces == face_keys(original) and actual_lines == ink_keys(original)


def test_navigation_split_reassembles_every_record_in_order_below_two_mib(
  tmp_path, monkeypatch
):
  source_folder, data_folder = tmp_path / "input", tmp_path / "published"
  source_folder.mkdir()
  data_folder.mkdir()
  records = [
    {
      "id": f"source-{i}",
      "ring": [[i / 10, -52.228], [i / 10 + 1, 5.2], [i / 10 + 2, 5.2]],
      "holes": [[[0.125, 4.125], [0.375, 4.125], [0.25, 4.375]]],
      "source": "Straße mit Höfen — αβ " * 256,
    }
    for i in range(700)
  ]
  # Repeated records and empty fields remain meaningful in the joined sequence.
  source = {
    "legacyPrisms": [records[0], records[0]],
    "parts": records,
    "empty": [],
    "roofs": list(reversed(records[:3])),
  }
  source_path = source_folder / "altMitteV169Navigation.json"
  source_path.write_text(json.dumps(source, ensure_ascii=False))
  original = source_path.read_bytes()
  monkeypatch.setattr(splitter, "DATA", data_folder)
  report = splitter.publish_navigation(source_folder)
  assert source_path.read_bytes() == original
  metadata = json.loads((data_folder / source_path.name).read_bytes())
  assert metadata["schemaVersion"] == 1
  assert metadata["fields"] == list(source)
  assert len(metadata["chunkFiles"]) == report["packets"]
  assert sum(entry["field"] == "parts" for entry in metadata["chunkFiles"]) >= 2
  assert len({e["file"] for e in metadata["chunkFiles"]}) == report["packets"]
  code = (data_folder / "altMitteV169NavigationData.ts").read_text()
  reconstructed = {field: [] for field in metadata["fields"]}
  actual_bytes = 0
  field_imports = {field: [] for field in metadata["fields"]}
  for index, entry in enumerate(metadata["chunkFiles"]):
    content = (data_folder / entry["file"]).read_bytes()
    assert len(content) < 2 * 1024 * 1024
    actual_bytes += len(content)
    assert f'import p{index} from "./{entry["file"]}";' in code
    field_imports[entry["field"]].append(f"...p{index}")
    reconstructed[entry["field"]].extend(json.loads(content))
  for field, imports in field_imports.items():
    assert f"{field}:[{','.join(imports)}]" in code
  assert reconstructed == source
  assert actual_bytes == report["bytes"]


def test_packer_and_splitter_preserve_low_source_geometry_without_height_clamping():
  detail = Detail()
  detail.polygon(
    [[1, -52.228, 2], [8, 5.2, 2], [1, 5.2, 9]],
    (180, 155, 120),
    "source ClosureSurface",
  )
  meshes = pack_detail(detail, (0, 0, 512, 512), origin_y=-60)
  packet = empty_packet("negative-source", (0, 0, 512, 512), -60)
  packet["meshes"] = meshes
  world_vertices = np.frombuffer(
    base64.b64decode(meshes[0]["positions"]), "<u2"
  ).reshape(-1, 3) / 100 + [0, -60, 0]
  assert sorted(world_vertices[:, 1]) == pytest.approx([-52.23, 5.2, 5.2])
  result = splitter.split_source(
    {"drawnChunks": [{"id": packet["id"], "packet": packet}]}, "drawn"
  )
  assert sum((face_keys(item["packet"]) for item in result), Counter()) == face_keys(
    packet
  )
