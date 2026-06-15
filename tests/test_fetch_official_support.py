"""Tests for optional Berlin official support layer fetching."""

from __future__ import annotations

import pytest

from isometric_berlin.data import fetch_official_support as support


def test_parse_layers_accepts_subset_and_preserves_order() -> None:
  assert support.parse_layers("dop, alkis,dop") == ["dop", "alkis"]


def test_parse_layers_rejects_unknown_layer() -> None:
  with pytest.raises(ValueError, match="Unknown support layer"):
    support.parse_layers("alkis,trees")


def test_dgm_tile_codes_cover_regierungsviertel_bbox() -> None:
  bbox = (388784.93, 5818549.04, 390105.78, 5821029.82)

  assert support.dgm_tile_codes(bbox) == [
    "388_5818",
    "388_5820",
    "390_5818",
    "390_5820",
  ]


def test_wms_getmap_url_uses_epsg_25833_bbox() -> None:
  url = support.wms_getmap_url(
    service="https://example.test/wms",
    layer="layer_a",
    bbox=(1.0, 2.0, 101.0, 202.0),
    width=500,
  )

  assert "REQUEST=GetMap" in url
  assert "LAYERS=layer_a" in url
  assert "CRS=EPSG%3A25833" in url
  assert "BBOX=1.0%2C2.0%2C101.0%2C202.0" in url
  assert "WIDTH=500" in url
  assert "HEIGHT=1000" in url
