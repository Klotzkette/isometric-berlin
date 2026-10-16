"""Check the gallery walking start, podium collision, stairs and mode continuity.

Run with uv run --with playwright python scripts/smoke_gallery_start_v220.py
URL --engine chromium --output OUTPUT_DIRECTORY. WebKit uses an iPhone profile;
browser emulation does not certify physical-device memory or performance.
The existing probe observes runtime state. Only the existing camera seed helper
positions the flight view at the stairs; walking uses real held keyboard input.
"""

from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path
from typing import Any

from smoke_mode_continuity import (
  PROBE,
  assert_pose,
  open_mobile_actions,
  seed_camera,
  select_mode,
  wait_ready,
)
from smoke_startup_mode_selection import startup_url

YAW = math.radians(-19.58)
CENTER_X = -291.8564511089675
CENTER_Z = 1319.4697376737176


def read(page: Any) -> dict[str, Any]:
  return page.evaluate("window.__readModeContinuity()")


def toggle_walk(page: Any, touch: bool) -> None:
  if touch:
    open_mobile_actions(page)
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Walk", exact=True
    ).tap()
    if page.locator(".mobile-sheet-title button").is_visible():
      page.locator(".mobile-sheet-title button").tap()
  else:
    page.locator(".pedestrian-mode-toggle").click()
  page.wait_for_timeout(300)


def local(x: float, z: float) -> tuple[float, float]:
  c, s = math.cos(YAW), math.sin(YAW)
  dx, dz = x - CENTER_X, z - CENTER_Z
  return c * dx - s * dz, s * dx + c * dz


def world(u: float, y: float, v: float) -> list[float]:
  c, s = math.cos(YAW), math.sin(YAW)
  return [CENTER_X + c * u + s * v, y, CENTER_Z - s * u + c * v]


def run(url: str, engine: str, output: Path) -> dict[str, Any]:
  from playwright.sync_api import sync_playwright

  output.mkdir(parents=True, exist_ok=True)
  report: dict[str, Any] = {
    "engine": engine,
    "url": url,
    "errors": [],
    "checks": [],
    "passed": False,
  }
  with sync_playwright() as playwright:
    touch = engine == "webkit"
    with getattr(playwright, engine).launch(
      headless=True, **({} if touch else {"channel": "chrome"})
    ) as browser:
      page = browser.new_page(
        **(
          playwright.devices["iPhone 13"]
          if touch
          else {"viewport": {"width": 1440, "height": 1000}}
        )
      )
      page.add_init_script(PROBE)
      page.on("pageerror", lambda error: report["errors"].append(str(error)))
      page.on("crash", lambda: report["errors"].append("Browser page crashed"))
      page.on(
        "console",
        lambda message: (
          report["errors"].append(message.text) if message.type == "error" else None
        ),
      )
      try:
        started = time.monotonic()
        page.goto(startup_url(url, None), wait_until="domcontentloaded")
        initial = wait_ready(page, "day", 180)
        assert (
          initial["enabled"]
          and initial["requested"]
          and initial["pedestrian"]["grounded"]
        ), initial
        assert abs(initial["pedestrian"]["x"] + 253.58000339381397) < 0.001, initial
        assert abs(initial["pedestrian"]["z"] - 1383.3085012966767) < 0.001, initial
        assert abs(initial["pedestrian"]["groundY"] - 5.2) < 0.001, initial
        counts = page.evaluate(
          """() => {
            const r = window.__modeContinuityRuntime();
            let g = 0, e = 0;
            r.scene.traverseVisible(o => {
              if (o.userData.columnCount === 8 && o.userData.transparentHall) g++;
              if (o.userData.cattelanExhibitionV217) e++;
            });
            return {g, e, lost: r.renderer.getContext().isContextLost()};
          }"""
        )
        assert counts == {"g": 1, "e": 1, "lost": False}, counts
        report["checks"].append(
          {
            "startupSeconds": round(time.monotonic() - started, 2),
            "pose": initial,
            "museum": counts,
          }
        )
        page.screenshot(path=str(output / "startup.png"))

        # Held navigation reaches the podium wall without passing beneath it.
        page.locator(".three-canvas").focus()
        page.keyboard.down("w")
        page.wait_for_timeout(5000)
        page.keyboard.up("w")
        page.wait_for_timeout(300)
        blocked = read(page)
        u, v = local(blocked["pedestrian"]["x"], blocked["pedestrian"]["z"])
        assert (
          math.hypot(
            blocked["pedestrian"]["x"] - initial["pedestrian"]["x"],
            blocked["pedestrian"]["z"] - initial["pedestrian"]["z"],
          )
          > 1
        ), blocked
        assert abs(blocked["pedestrian"]["groundY"] - 5.2) < 0.01, blocked
        # A second sustained push must remain at the same wall.
        page.keyboard.down("w")
        page.wait_for_timeout(1000)
        page.keyboard.up("w")
        page.wait_for_timeout(300)
        still = read(page)
        assert (
          math.hypot(
            still["pedestrian"]["x"] - blocked["pedestrian"]["x"],
            still["pedestrian"]["z"] - blocked["pedestrian"]["z"],
          )
          < 0.15
        ), (blocked, still)
        report["checks"].append({"podiumBlocksHeldInput": True, "localFeet": [u, v]})

        # Use the existing flight toggle to seed the actual staircase foot,
        # then walk through the doorway using real held W input.
        toggle_walk(page, touch)
        assert not read(page)["enabled"]
        seed_camera(
          page,
          {
            "position": world(0, 7, 62),
            "target": world(0, 6.475922207169586, 52),
            "fov": 40,
          },
        )
        toggle_walk(page, touch)
        assert read(page)["enabled"]
        page.keyboard.down("w")
        deadline = time.monotonic() + 20
        try:
          while time.monotonic() < deadline:
            page.wait_for_timeout(150)
            state = read(page)
            u, v = local(state["pedestrian"]["x"], state["pedestrian"]["z"])
            if v < 22:
              break
        finally:
          page.keyboard.up("w")
        assert v < 22, (u, v, state)
        assert abs(state["pedestrian"]["groundY"] - 9.82) < 0.01, state
        report["checks"].append({"walkedUpStairsThroughDoor": True, "pose": state})
        page.screenshot(path=str(output / "entered-hall.png"))

        current = read(page)
        for mode in [
          "night",
          "snowstorm",
          "schwellenraum",
          "flood",
          "minecraft",
          "day",
        ]:
          select_mode(page, mode, touch)
          actual = wait_ready(page, mode, 180)
          assert_pose(actual, current)
          if touch and page.locator(".mobile-sheet-title button").is_visible():
            page.locator(".mobile-sheet-title button").tap()
          report["checks"].append({"mode": mode, "walkingPosePreserved": True})
          current = read(page)
        assert not report["errors"], report["errors"]
        report["passed"] = True
      except Exception as error:
        report["failure"] = f"{type(error).__name__}: {error}"
        try:
          page.screenshot(path=str(output / "failure.png"), timeout=5000)
        except Exception as screenshot_error:
          report["failureScreenshotError"] = str(screenshot_error)
        raise
      finally:
        (output / "report.json").write_text(
          json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
  return report


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url", help="Viewer URL, including any hosting subpath")
  parser.add_argument("--engine", choices=("chromium", "webkit"), required=True)
  parser.add_argument("--output", type=Path, required=True)
  args = parser.parse_args()
  print(json.dumps(run(args.url, args.engine, args.output), ensure_ascii=False))


if __name__ == "__main__":
  main()
