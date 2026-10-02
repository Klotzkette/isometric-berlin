"""The browser smoke must reject idle-but-empty and duplicate Alt-Mitte layers."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_alt_mitte_v169 import validate_alt_mitte  # noqa: E402


@pytest.fixture
def sample() -> dict:
  return {
    "altMitte": {
      "pending": False,
      "roots": [
        {
          "count": 1,
          "visible": True,
          "triangles": 20,
          "targetTriangles": 12,
          "renderables": 2,
          "sourceChunks": 1,
          "sourceParents": 1,
          "geometryBytes": 900,
          "declaredGeometryBytes": 900,
        },
        {"count": 0, "visible": False},
      ],
      "manifestedPackets": 3,
      "visiblePacketTriangles": 24,
      "targetPacketTriangles": 24,
      "residentPacketGeometryBytes": 1300,
    }
  }


def test_source_meshes_and_full_resident_bytes_are_required(sample: dict) -> None:
  validate_alt_mitte(sample, "day", True)
  sample["altMitte"]["visiblePacketTriangles"] = 0
  with pytest.raises(AssertionError):
    validate_alt_mitte(sample, "day", True)
  # The first-ready resident-core assertion does not wait for detail packets.
  validate_alt_mitte(sample, "day", False)


@pytest.mark.parametrize("defect", ["duplicate", "hidden", "partial", "double"])
def test_incomplete_or_duplicate_resident_roots_fail(sample: dict, defect: str) -> None:
  roots = sample["altMitte"]["roots"]
  if defect == "duplicate":
    roots[0]["count"] = 2
  elif defect == "hidden":
    roots[0]["visible"] = False
  elif defect == "partial":
    roots[0]["geometryBytes"] = 400
  else:
    roots[1].update(count=1, visible=True)
  with pytest.raises(AssertionError):
    validate_alt_mitte(sample, "day", False)


def test_native_requires_its_own_visible_source_family(sample: dict) -> None:
  with pytest.raises(AssertionError):
    validate_alt_mitte(sample, "minecraft", True)
  sample["altMitte"]["roots"].reverse()
  validate_alt_mitte(sample, "minecraft", True)


def test_packets_from_the_previous_view_do_not_count_as_current_coverage(
  sample: dict,
) -> None:
  sample["altMitte"]["targetPacketTriangles"] = 0
  with pytest.raises(AssertionError):
    validate_alt_mitte(sample, "day", True)


def test_native_without_streamed_detail_still_needs_real_core_in_the_target_tile(
  sample: dict,
) -> None:
  sample["altMitte"]["roots"].reverse()
  sample["altMitte"]["targetPacketTriangles"] = 0
  validate_alt_mitte(sample, "minecraft", False, True)
  sample["altMitte"]["roots"][1]["targetTriangles"] = 0
  with pytest.raises(AssertionError):
    validate_alt_mitte(sample, "minecraft", False, True)
