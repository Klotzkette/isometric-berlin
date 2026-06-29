"""Tests for Deep Zoom export helpers."""

from __future__ import annotations

import json
from pathlib import Path

from isometric_berlin.generation.export_dzi import (
  WIKIMEDIA_ATTRIBUTION,
  wikimedia_extra_attribution,
  write_preview,
)


def test_wikimedia_extra_attribution_requires_manifest_records(tmp_path: Path) -> None:
  missing = tmp_path / "missing.json"
  empty = tmp_path / "empty.json"
  with_records = tmp_path / "wikimedia_references.json"
  empty.write_text(json.dumps({"records": []}), encoding="utf-8")
  with_records.write_text(
    json.dumps({"records": [{"title": "File:Reichstag.jpg"}]}), encoding="utf-8"
  )

  assert wikimedia_extra_attribution(missing) == ""
  assert wikimedia_extra_attribution(empty) == ""
  assert wikimedia_extra_attribution(with_records) == WIKIMEDIA_ATTRIBUTION


def test_preview_can_carry_wikimedia_attribution(tmp_path: Path) -> None:
  preview = tmp_path / "preview.html"

  write_preview(
    preview,
    title="Preview",
    overview_path=tmp_path / "overview.png",
    dzi_path=tmp_path / "regierungsviertel.dzi",
    extra_attribution=WIKIMEDIA_ATTRIBUTION,
  )

  assert WIKIMEDIA_ATTRIBUTION in preview.read_text(encoding="utf-8")
