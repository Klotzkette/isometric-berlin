"""Exercise cold loading, movement and all five modes in mobile browser profiles.

uv run --with playwright python scripts/smoke_mobile_compatibility.py URL --engine webkit
uv run --with playwright python scripts/smoke_mobile_compatibility.py URL --engine chromium

Uses WebKit/iPhone SE and Chromium/Pixel 5 emulation on the host; this checks
engine, touch layout and lifecycle compatibility, not physical phone speed/RAM.
Chromium uses installed Google Chrome; WebKit uses the Playwright engine.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from smoke_mode_continuity import (
  PROBE,
  open_mobile_actions,
  seed_camera,
  select_mode,
  viewer_url,
  wait_ready,
)

POSE = {
  "position": [1760, 230, 530],
  "target": [1520, 8, 280],
  "fov": 39,
}
CONTEXT_PROBE = """(() => {
  window.__mobileCompatibility = {lost: 0, restored: 0};
  document.addEventListener('webglcontextlost', () => window.__mobileCompatibility.lost++, true);
  document.addEventListener('webglcontextrestored', () => window.__mobileCompatibility.restored++, true);
})();"""


def browser_profile(engine: str) -> str:
  return "iPhone SE" if engine == "webkit" else "Pixel 5"


def run(url: str, engine: str, timeout: float, output: Path | None) -> None:
  from playwright.sync_api import sync_playwright

  errors: list[str] = []
  console_errors: list[str] = []
  advisories: list[str] = []
  with sync_playwright() as p:
    browser = getattr(p, engine).launch(
      **({"channel": "chrome"} if engine == "chromium" else {})
    )
    context = browser.new_context(**p.devices[browser_profile(engine)])
    context.add_init_script(PROBE)
    context.add_init_script(CONTEXT_PROBE)
    page = context.new_page()
    page.set_default_timeout(timeout * 1000)
    page.on("pageerror", lambda error: errors.append(str(error)))

    def on_console(message: Any) -> None:
      if message.type != "error":
        return
      if 'Viewport argument key "interactive-widget" not recognized' in message.text:
        advisories.append(message.text)
      else:
        console_errors.append(message.text)

    page.on("console", on_console)
    reports = []
    try:
      page.goto(viewer_url(url), wait_until="domcontentloaded")
      wait_ready(page, "day", timeout)
      for mode in ("day", "night", "snowstorm", "schwellenraum", "minecraft", "day"):
        if mode != "day" or reports:
          select_mode(page, mode, True)
          wait_ready(page, mode, timeout)
        seed_camera(page, POSE)
        open_mobile_actions(page)
        assert page.locator(".mobile-visual-mode-grid").is_visible()
        close = page.locator(".mobile-sheet-title button")
        if close.is_visible():
          close.tap()
        # Pointer capture and the same joystick handlers used on touch devices.
        joystick = page.locator(".flight-joystick")
        box = joystick.bounding_box()
        assert box and box["width"] > 0 and box["height"] > 0
        before = page.evaluate("window.__readModeContinuity().position")
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 8, y - box["height"] * 0.32, steps=6)
        page.wait_for_timeout(350)
        page.mouse.up()
        page.wait_for_timeout(500)
        state = page.evaluate("""() => {
          const r=window.__modeContinuityRuntime(), gl=r.renderer.getContext();
          return {position:r.camera.position.toArray(), ready:r.presentationReady,
            mode:r.lightingMode, contextLost:gl.isContextLost(),
            contextEvents:window.__mobileCompatibility,
            geometryCount:r.renderer.info.memory.geometries,
            textureCount:r.renderer.info.memory.textures,
            error:document.querySelector('.three-viewer-error.is-active')?.textContent || null};
        }""")
        assert (
          state["mode"] == mode
          and state["ready"]
          and not state["contextLost"]
          and not state["error"]
        ), state
        assert state["contextEvents"]["lost"] == 0, state
        assert (
          sum(abs(a - b) for a, b in zip(before, state["position"], strict=True)) > 0.1
        ), state
        assert not errors and not console_errors, (errors, console_errors)
        reports.append(state)
        print(
          json.dumps(
            {
              "engine": engine,
              "profile": browser_profile(engine),
              "passed": mode,
              "state": state,
            }
          ),
          flush=True,
        )
      print(
        json.dumps(
          {
            "success": True,
            "engine": engine,
            "profile": browser_profile(engine),
            "modeChecks": len(reports),
            "pageErrors": errors,
            "consoleErrors": console_errors,
            "advisories": advisories,
          }
        ),
        flush=True,
      )
    except Exception:
      if output:
        output.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(output / f"mobile-{engine}.png"))
        (output / f"mobile-{engine}.json").write_text(
          json.dumps(
            {"reports": reports, "errors": errors, "consoleErrors": console_errors},
            indent=2,
          )
        )
      raise
    finally:
      context.close()
      browser.close()


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("webkit", "chromium"), required=True)
  parser.add_argument("--timeout", type=float, default=120)
  parser.add_argument("--failure-output", type=Path)
  args = parser.parse_args()
  if urlsplit(args.url).scheme not in {"http", "https"} or args.timeout <= 0:
    parser.error("Provide an HTTP(S) URL and a positive timeout")
  run(args.url, args.engine, args.timeout, args.failure_output)


if __name__ == "__main__":
  main()
