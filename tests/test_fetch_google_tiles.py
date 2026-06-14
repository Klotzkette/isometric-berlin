"""Smoke tests for the Google 3D Tiles opt-in gate."""

from __future__ import annotations

import json
from pathlib import Path

from isometric_berlin.data.fetch_google_tiles import (
  build_manifest,
  opt_in_satisfied,
  to_url_template,
  write_unavailable_manifest,
)

TILESET = {
  "asset": {"version": "1.1", "copyright": "Google"},
  "root": {
    "geometricError": 100.0,
    "content": {"uri": "/v1/3dtiles/abc.glb?key=secret-key&session=xyz"},
    "children": [
      {"content": {"uri": "https://tile.googleapis.com/v1/3dtiles/d.json?key=k2"}},
    ],
  },
}


def test_opt_in_blocks_without_env() -> None:
  ok, reason = opt_in_satisfied({})
  assert ok is False
  assert "GOOGLE_MAPS_API_KEY" in reason


def test_opt_in_requires_terms_accepted() -> None:
  env = {
    "GOOGLE_MAPS_API_KEY": "x",
    "GOOGLE_MAPS_3D_TILES_ENABLED": "true",
    "GOOGLE_MAPS_TERMS_ACCEPTED": "false",
  }
  ok, reason = opt_in_satisfied(env)
  assert ok is False
  assert "TERMS_ACCEPTED" in reason


def test_opt_in_passes_when_all_three_set() -> None:
  env = {
    "GOOGLE_MAPS_API_KEY": "x",
    "GOOGLE_MAPS_3D_TILES_ENABLED": "true",
    "GOOGLE_MAPS_TERMS_ACCEPTED": "true",
  }
  ok, reason = opt_in_satisfied(env)
  assert ok is True
  assert reason == "ok"


def test_unavailable_manifest_has_no_key(tmp_path: Path) -> None:
  out = tmp_path / "manifest.json"
  write_unavailable_manifest(out, "opt_in_env_missing: test")
  payload = json.loads(out.read_text(encoding="utf-8"))
  assert payload["source"] == "google3d"
  assert payload["available"] is False
  assert payload["url_template"] is None
  assert payload["tiles"] == []
  # Hard guard: no key leakage.
  raw = out.read_text(encoding="utf-8")
  assert "GOOGLE_MAPS_API_KEY" not in raw or "{GOOGLE_MAPS_API_KEY}" in raw


def test_to_url_template_replaces_key_keeps_session() -> None:
  template = to_url_template("https://x/y?key=secret&session=abc")
  assert "secret" not in template
  assert "key={GOOGLE_MAPS_API_KEY}" in template
  assert "session=abc" in template


def test_build_manifest_never_leaks_key() -> None:
  manifest = build_manifest(TILESET)
  assert manifest["source"] == "google3d"
  assert manifest["available"] is True
  assert len(manifest["tiles"]) == 2
  blob = json.dumps(manifest)
  assert "secret-key" not in blob and "k2" not in blob
  assert "{GOOGLE_MAPS_API_KEY}" in manifest["url_template"]
  assert manifest["tiles"][0]["content_type"] == "model/gltf-binary"
