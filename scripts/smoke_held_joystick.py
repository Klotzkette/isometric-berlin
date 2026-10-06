"""Exercise a stationary held orange joystick through actual browser pointer capture.

Chrome uses native CDP touch input; WebKit exercises the same pad with a mouse
in an iPhone layout. Device profiles do not impose physical phone memory limits.
"""

from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path

from playwright.sync_api import sync_playwright
from smoke_mobile_memory import BUFFER_PROBE, READ_STATE
from smoke_mode_continuity import PROBE, seed_camera, wait_ready


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  parser.add_argument("--output", type=Path, required=True)
  args = parser.parse_args()
  report: dict = {"engine": args.engine, "errors": [], "samples": []}
  with sync_playwright() as pw:
    browser = getattr(pw, args.engine).launch(
      **({"channel": "chrome"} if args.engine == "chromium" else {})
    )
    context = browser.new_context(
      **pw.devices["Pixel 5" if args.engine == "chromium" else "iPhone 13"]
    )
    context.add_init_script(PROBE)
    context.add_init_script(BUFFER_PROBE)
    page = context.new_page()
    page.on("pageerror", lambda error: report["errors"].append(str(error)))
    page.on("crash", lambda: report["errors"].append("page crashed"))
    try:
      page.goto(args.url, wait_until="domcontentloaded")
      wait_ready(page, "day", 180)
      seed_camera(page, {"position": [0, 50, 200], "target": [0, 5, 150], "fov": 39})
      page.wait_for_timeout(500)
      bounds = page.locator(".flight-joystick").bounding_box()
      assert bounds
      x, y = bounds["x"] + bounds["width"] / 2, bounds["y"] + bounds["height"] / 2
      cd = context.new_cdp_session(page) if args.engine == "chromium" else None
      if cd:

        def touch(kind: str, py: float) -> None:
          cd.send(
            "Input.dispatchTouchEvent",
            {
              "type": kind,
              "touchPoints": [] if kind == "touchEnd" else [{"x": x, "y": py, "id": 1}],
            },
          )

        touch("touchStart", y)
        touch("touchMove", y - 44)
      else:
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x, y - 44)
      # No further move events occur for the entire acceleration/steady hold.
      start = time.monotonic()
      for delay in (200, 1000, 1000, 1000):
        page.wait_for_timeout(delay)
        report["samples"].append(
          {
            "seconds": time.monotonic() - start,
            **page.evaluate("window.__readModeContinuity()"),
          }
        )
      if cd:
        touch("touchEnd", y - 44)
      else:
        page.mouse.up()
      page.wait_for_timeout(300)
      stopped = page.evaluate("window.__readModeContinuity()")
      page.wait_for_timeout(400)
      released = page.evaluate("window.__readModeContinuity()")
      samples = report["samples"]
      speeds = [
        math.dist(a["position"], b["position"]) / (b["seconds"] - a["seconds"])
        for a, b in zip(samples[1:], samples[2:])
      ]
      report["steadySpeedsMps"] = speeds
      # Base speed is 2.7 * camera distance; held-edge target is exactly 3x.
      expected = math.dist([0, 50, 200], [0, 5, 150]) * 2.7 * 3
      assert all(expected * 0.72 < speed < expected * 1.15 for speed in speeds), report
      assert math.dist(stopped["position"], released["position"]) < 0.01, report
      assert all(sample["ready"] and not sample["underside"] for sample in samples), (
        report
      )
      report["state"] = page.evaluate(READ_STATE)
      assert not report["state"]["contextLost"] and report["state"]["lost"] == 0, report
      assert not report["errors"], report
      report["passed"] = True
    finally:
      args.output.write_text(json.dumps(report, indent=2) + "\n")
      browser.close()
  print(json.dumps(report))


if __name__ == "__main__":
  main()
