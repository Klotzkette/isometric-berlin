"""Prepare one supplied Columbiahalle recording, preserving its aspect ratio.

OpenCV writes video frames only, so no source audio track can be copied.
"""

import argparse
import hashlib
import json
from pathlib import Path

import cv2


def prepare(source: Path, output: Path) -> dict:
  capture = cv2.VideoCapture(str(source))
  if not capture.isOpened():
    raise ValueError(f"Cannot open supplied video: {source.name}")
  fps = capture.get(cv2.CAP_PROP_FPS)
  width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
  height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
  if fps <= 0 or min(width, height) <= 0:
    capture.release()
    raise ValueError("Invalid video dimensions or frame rate")
  scale = min(1, 640 / max(width, height))
  dimensions = tuple(max(2, round(v * scale / 2) * 2) for v in (width, height))
  output.parent.mkdir(parents=True, exist_ok=True)
  temporary = output.with_name(output.stem + ".pending.mp4")
  writer = cv2.VideoWriter(
    str(temporary), cv2.VideoWriter_fourcc(*"avc1"), 15, dimensions
  )
  if not writer.isOpened():
    capture.release()
    raise RuntimeError("H.264 video encoder is unavailable")
  source_frames = frames = 0
  try:
    while True:
      ok, frame = capture.read()
      if not ok:
        break
      if source_frames / fps + 1e-9 >= frames / 15:
        writer.write(cv2.resize(frame, dimensions, interpolation=cv2.INTER_AREA))
        frames += 1
      source_frames += 1
  finally:
    capture.release()
    writer.release()
  if not frames or temporary.stat().st_size >= 2 * 1024 * 1024:
    temporary.unlink(missing_ok=True)
    raise ValueError("Empty video or unexpectedly large derivative")
  temporary.replace(output)
  return {
    "source": source.name,
    "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
    "sourceFrames": source_frames,
    "sourceFps": fps,
    "file": "media/" + output.name,
    "bytes": output.stat().st_size,
    "sha256": hashlib.sha256(output.read_bytes()).hexdigest(),
    "width": dimensions[0],
    "height": dimensions[1],
    "fps": 15,
    "frames": frames,
    "audioTracks": 0,
  }


def main():
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("source", type=Path)
  parser.add_argument("output", type=Path)
  args = parser.parse_args()
  print(json.dumps(prepare(args.source, args.output), indent=2))


if __name__ == "__main__":
  main()
