"""Make the explicitly requested silent local recording, without any audio stream."""

import argparse
import hashlib
import json
from pathlib import Path

import cv2

parser = argparse.ArgumentParser()
parser.add_argument("source", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
output = root / "src/app/public/media/columbiahalle-v257-silent.mp4"
capture = cv2.VideoCapture(str(args.source))
assert capture.isOpened()
assert capture.get(cv2.CAP_PROP_FPS) == 30
output.parent.mkdir(exist_ok=True)
writer = cv2.VideoWriter(str(output), cv2.VideoWriter_fourcc(*"avc1"), 15, (640, 360))
assert writer.isOpened()
frames = 0
while True:
  ok, frame = capture.read()
  if not ok:
    break
  if frames % 2 == 0:
    writer.write(cv2.resize(frame, (640, 360), interpolation=cv2.INTER_AREA))
  frames += 1
writer.release()
capture.release()
assert output.stat().st_size < 2 * 1024 * 1024
print(
  json.dumps(
    dict(
      frames=frames,
      outputBytes=output.stat().st_size,
      sourceSha256=hashlib.sha256(args.source.read_bytes()).hexdigest(),
      clipSha256=hashlib.sha256(output.read_bytes()).hexdigest(),
    )
  )
)
