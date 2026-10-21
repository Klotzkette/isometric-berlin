"""Validate the delivered landscape/portrait clips, including absence of audio."""

import hashlib
import json
import struct
from pathlib import Path

import cv2
import pytest

ROOT = Path(__file__).resolve().parents[1]
RECEIPTS = json.loads((ROOT / "docs/columbiahalle-v258-sources.json").read_text())


def track_handlers(data, start=0, end=None):
  end = len(data) if end is None else end
  result = []
  while start + 8 <= end:
    size, kind = struct.unpack_from(">I4s", data, start)
    assert size >= 8 and start + size <= end
    if kind in (b"moov", b"trak", b"mdia"):
      result.extend(track_handlers(data, start + 8, start + size))
    if kind == b"hdlr":
      result.append(data[start + 16 : start + 20])
    start += size
  assert start == end
  return result


@pytest.mark.parametrize("record", RECEIPTS["videos"])
def test_delivered_clip_is_complete_silent_and_keeps_its_aspect(record):
  path = ROOT / "src/app/public" / record["file"]
  data = path.read_bytes()
  assert hashlib.sha256(data).hexdigest() == record["sha256"]
  assert len(data) == record["bytes"] < 2 * 1024 * 1024
  assert track_handlers(data) == [b"vide"]
  assert b"avc1" in data
  capture = cv2.VideoCapture(str(path))
  try:
    assert capture.isOpened()
    assert int(capture.get(cv2.CAP_PROP_FRAME_WIDTH)) == record["width"]
    assert int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT)) == record["height"]
    assert capture.get(cv2.CAP_PROP_FPS) == 15
    count = 0
    while True:
      ok, frame = capture.read()
      if not ok:
        break
      assert frame.shape[:2] == (record["height"], record["width"])
      count += 1
    assert count == record["frames"]
    assert abs(count / 15 - record["sourceFrames"] / record["sourceFps"]) < 1 / 15
  finally:
    capture.release()
  if "portrait" in path.name:
    assert record["width"] / record["height"] == 9 / 16
  else:
    assert record["width"] / record["height"] == 16 / 9


def test_media_preparation_rejects_invalid_capture_before_creating_output(
  monkeypatch, tmp_path
):
  from scripts.prepare_columbia_video_v258 import prepare

  class InvalidCapture:
    released = False

    def isOpened(self):
      return True

    def get(self, _):
      return 0

    def release(self):
      self.released = True

  invalid = InvalidCapture()
  monkeypatch.setattr(cv2, "VideoCapture", lambda _: invalid)
  output = tmp_path / "output.mp4"
  with pytest.raises(ValueError, match="dimensions or frame rate"):
    prepare(tmp_path / "input.mov", output)
  assert invalid.released
  assert not output.exists()
