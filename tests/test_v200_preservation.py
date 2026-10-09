"""The new district layer must retain every previously published packet."""

from packet_additions_v200 import audited_v200_additions


def test_v199_geometry_and_metadata_survive_exact_bounded_v200_append() -> None:
  assert audited_v200_additions()
