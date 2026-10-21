"""The withdrawn recordings must not return to the shipped product."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_no_recording_files_or_player_in_current_product():
  public = ROOT / "src/app/public"
  assert not list(public.rglob("*columbia*.mp4"))
  assert not list(public.rglob("*columbia*.mov"))
  assert not list(public.rglob("*columbia*.webm"))
  code = (ROOT / "src/app/src/ColumbiahalleV257.ts").read_text()
  assert "COLUMBIA_RECORDINGS" not in code
  assert 'createElement("video")' not in code
  assert ".mp4" not in code
  assert "VideoTexture" not in code


def test_attribution_does_not_advertise_withdrawn_media():
  data = json.loads(
    (
      ROOT / "src/app/public/dzi/regierungsviertel/visual_reference_attribution.json"
    ).read_text()
  )
  records = [
    r for r in data["records"] if r.get("landmark_id", "").startswith("columbiahalle")
  ]
  assert records
  assert all(not r.get("video_bundled") and "video_file" not in r for r in records)
