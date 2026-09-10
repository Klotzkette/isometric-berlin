"""Capture three fixed Day canvas views, or compare two existing capture folders.

uv run --with playwright python scripts/compare_viewer_frames.py URL --capture /tmp/before
uv run --with playwright python scripts/compare_viewer_frames.py URL --capture /tmp/after
uv run python scripts/compare_viewer_frames.py --compare /tmp/before /tmp/after

Captures use Chrome, 1440x900, DPR 1, reduced motion and a fixed random seed.
The complete progressive world, park and GPU upload queue must settle first.
Comparison reports raw pixel differences; it never declares a visual pass from
an arbitrary tolerance. Residual environmental animation must be reviewed.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from PIL import Image, ImageChops
from profile_viewer_motion import LOCATIONS, RUNTIME_PROBE, start_url

VIEWS = {
  "kanzleramt": LOCATIONS["kanzleramt"],
  "washingtonplatz": LOCATIONS["washingtonplatz"],
  "tiergarten": {
    "position": [-830, 540, 1040],
    "target": [-1230, 5, 450],
    "fov": 39,
  },
}
SETTLED = """() => {
  const r = window.__frameRuntime();
  const ready = r?.presentationReady && !r.disposed &&
    r.progressiveWorldState === 'complete' &&
    r.progressiveWorldMessages.length === 0 &&
    r.parkDetails.name !== 'Pending OSM park details' &&
    r.parkDetails.children.length > 0 && !r.gpuWarmup?.pending;
  if (!ready) { window.__frameSettled = null; return false; }
  const signature = [r.progressiveWorldBatches.length, r.parkDetails.children.length,
    r.renderer.info.memory.geometries, r.renderer.info.memory.textures].join(':');
  const old = window.__frameSettled;
  if (!old || old.signature !== signature)
    window.__frameSettled = {signature, since: performance.now()};
  return performance.now() - window.__frameSettled.since >= 1500;
}"""
SEED = """pose => {
  const r = window.__frameRuntime();
  window.__frameSettled = null;
  r.camera.position.fromArray(pose.position); r.controls.target.fromArray(pose.target);
  r.camera.fov = pose.fov; r.camera.updateProjectionMatrix();
  r.controls.update(); r.camera.updateMatrixWorld(); r.renderInvalidated = true;
}"""
RENDER = """() => {
  const r = window.__frameRuntime();
  r.camera.updateMatrixWorld();
  r.renderer.shadowMap.needsUpdate = true;
  const render = r.composer.render;
  render.call(r.composer);
  // Hold this exact completed canvas while Playwright takes its screenshot.
  // RAF and input keep working; only the test capture's compositor is paused.
  r.composer.render = () => {};
  window.__restoreFrameComposer = () => {
    r.composer.render = render; r.renderInvalidated = true;
  };
  let meshes = 0, instances = 0, positionVertices = 0;
  r.scene.traverseVisible(o => {
    if (!o.isMesh) return;
    meshes += 1;
    instances += o.isInstancedMesh ? o.count : 1;
    positionVertices += (o.geometry.attributes.position?.count ?? 0) * (o.isInstancedMesh ? o.count : 1);
  });
  return {position: r.camera.position.toArray(), target: r.controls.target.toArray(),
    fov: r.camera.fov, mode: r.lightingMode, reducedMotion: r.reducedMotion,
    progressiveWorldState: r.progressiveWorldState, gpuPending: r.gpuWarmup?.pending ?? false,
    parkName: r.parkDetails.name, meshes, instances, positionVertices,
    pixelRatio: r.renderer.getPixelRatio(),
    drawingBuffer: [r.renderer.domElement.width, r.renderer.domElement.height],
    webglMemory: {...r.renderer.info.memory}};
}"""


def capture(url: str, destination: Path, timeout: float) -> None:
  from playwright.sync_api import sync_playwright

  destination.mkdir(parents=True, exist_ok=True)
  report: dict[str, Any] = {
    "url": url,
    "configuration": {
      "viewport": [1440, 900],
      "deviceScaleFactor": 1,
      "mode": "day",
      "reducedMotion": "reduce",
      "randomSeed": 128,
    },
    "views": {},
    "notes": [
      "Canvas bounds including overlaid controls; the composer is paused for the screenshot.",
      "Reduced motion does not guarantee all environmental animation is static.",
    ],
  }
  with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    report["chromeVersion"] = browser.version
    try:
      for name, pose in VIEWS.items():
        context = browser.new_context(
          viewport={"width": 1440, "height": 900},
          device_scale_factor=1,
          reduced_motion="reduce",
          has_touch=False,
          is_mobile=False,
        )
        context.add_init_script("""(() => {
          let state = 128;
          Math.random = () => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
          };
        })();""")
        context.add_init_script(f"window.__frameRuntime = {RUNTIME_PROBE};")
        page = context.new_page()
        page.set_default_timeout(timeout * 1000)
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        try:
          page.goto(
            start_url(url, name if name in LOCATIONS else "gate"),
            wait_until="domcontentloaded",
          )
          page.wait_for_function(
            "() => window.__frameRuntime()?.presentationReady === true"
          )
          page.wait_for_function(SETTLED)
          page.evaluate(SEED, pose)
          page.wait_for_function(SETTLED)
          metadata = page.evaluate(RENDER)
          try:
            page.locator(".three-viewer.is-active canvas").screenshot(
              path=str(destination / f"{name}.png"), animations="disabled"
            )
          finally:
            page.evaluate("window.__restoreFrameComposer?.()")
          metadata["requestedPose"] = pose
          metadata["errors"] = errors
          report["views"][name] = metadata
          for key in ("position", "target"):
            if math.dist(metadata[key], pose[key]) > 0.01:
              raise RuntimeError(f"{name}: camera moved away from requested {key}")
          if metadata["mode"] != "day" or not metadata["reducedMotion"] or errors:
            raise RuntimeError(f"{name}: invalid capture state: {metadata}")
          report["views"][name] = metadata
          print(
            json.dumps({"captured": name, "file": str(destination / f"{name}.png")}),
            flush=True,
          )
        finally:
          (destination / "capture.json").write_text(
            json.dumps(report, indent=2) + "\n", encoding="utf-8"
          )
          context.close()
    finally:
      browser.close()


def pixel_difference(before: Image.Image, after: Image.Image) -> dict[str, Any]:
  """Report exact RGB differences without a pass/fail tolerance."""
  if before.size != after.size:
    return {
      "comparable": False,
      "beforeSize": list(before.size),
      "afterSize": list(after.size),
    }
  difference = ImageChops.difference(before.convert("RGB"), after.convert("RGB"))
  pixels = before.width * before.height
  channels = difference.split()
  max_channel = ImageChops.lighter(
    ImageChops.lighter(channels[0], channels[1]), channels[2]
  )
  changed = pixels - max_channel.histogram()[0]
  histogram = difference.histogram()
  absolute_sum = sum((index % 256) * count for index, count in enumerate(histogram))
  square_sum = sum((index % 256) ** 2 * count for index, count in enumerate(histogram))
  return {
    "comparable": True,
    "size": list(before.size),
    "pixels": pixels,
    "changedPixels": changed,
    "changedPercent": 100 * changed / pixels,
    "meanAbsoluteChannelError": absolute_sum / (pixels * 3),
    "rootMeanSquareChannelError": math.sqrt(square_sum / (pixels * 3)),
    "maxChannelError": max(high for _, high in difference.getextrema()),
    "differenceBounds": difference.getbbox(),
  }


def compare(before: Path, after: Path, output: Path | None = None) -> None:
  names = sorted(
    {p.name for p in before.glob("*.png")} | {p.name for p in after.glob("*.png")}
  )
  if not names:
    raise SystemExit("No captured PNG files found")
  result: dict[str, Any] = {"before": str(before), "after": str(after), "views": {}}
  for name in names:
    left, right = before / name, after / name
    if not left.is_file() or not right.is_file():
      result["views"][name] = {
        "comparable": False,
        "missing": str(left if not left.exists() else right),
      }
      continue
    with Image.open(left) as a, Image.open(right) as b:
      result["views"][name] = pixel_difference(a, b)
  for label, folder in (("beforeCapture", before), ("afterCapture", after)):
    metadata = folder / "capture.json"
    if metadata.exists():
      result[label] = json.loads(metadata.read_text(encoding="utf-8"))
  destination = output or after / "frame-comparison.json"
  destination.parent.mkdir(parents=True, exist_ok=True)
  destination.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
  print(json.dumps(result["views"], indent=2), flush=True)
  print(f"Wrote {destination}", flush=True)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url", nargs="?")
  action = parser.add_mutually_exclusive_group(required=True)
  action.add_argument("--capture", type=Path)
  action.add_argument("--compare", type=Path, nargs=2, metavar=("BEFORE", "AFTER"))
  parser.add_argument("--output", type=Path)
  parser.add_argument("--timeout", type=float, default=180)
  args = parser.parse_args()
  if args.capture:
    if not args.url or urlsplit(args.url).scheme not in {"http", "https"}:
      parser.error("Capture requires an HTTP(S) viewer URL")
    if not math.isfinite(args.timeout) or args.timeout <= 0:
      parser.error("Timeout must be positive")
    capture(args.url, args.capture, args.timeout)
  else:
    compare(*args.compare, args.output)


if __name__ == "__main__":
  main()
