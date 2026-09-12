"""Exercise rendered camera state and atomic resize in the production viewer.

Browser emulation does not establish physical iPhone memory or GPU stability.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from smoke_mode_continuity import PROBE, viewer_url, wait_ready

FRAME_PROBE = """() => {
  const r = window.__modeContinuityRuntime();
  const state = window.__stability = {frames: 0, badFrames: [], resizeCount: 0,
    unpaintedResizes: 0};
  const render = r.composer.render.bind(r.composer);
  r.composer.render = (...args) => {
    const result = render(...args);
    state.frames++;
    if (r.underwater || r.underside || !r.isoWorld?.visible) {
      state.badFrames.push({position:r.camera.position.toArray(),
        underwater:r.underwater, underside:r.underside, visible:r.isoWorld?.visible});
    }
    return result;
  };
  const resize = r.renderer.setSize.bind(r.renderer);
  r.renderer.setSize = (...args) => {
    const serial = state.frames;
    state.resizeCount++;
    const result = resize(...args);
    queueMicrotask(() => {if (serial === state.frames) state.unpaintedResizes++;});
    return result;
  };
}"""


def validate_frames(state: dict[str, Any]) -> None:
  """Reject the captured blue/cutaway regression and any unpainted resize."""
  assert state["frames"] >= 20, state
  assert not state["badFrames"], state
  assert state["resizeCount"] >= 2, state
  assert state["unpaintedResizes"] == 0, state


def main() -> int:
  from playwright.sync_api import sync_playwright

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  parser.add_argument("--touch", action="store_true")
  parser.add_argument("--output", type=Path, default=Path("/tmp/viewer-stability.png"))
  args = parser.parse_args()
  errors: list[str] = []
  with sync_playwright() as playwright:
    browser = getattr(playwright, args.engine).launch(
      headless=True, **({"channel": "chrome"} if args.engine == "chromium" else {})
    )
    page = browser.new_page(
      viewport={"width": 390 if args.touch else 1100, "height": 760},
      has_touch=args.touch,
      is_mobile=args.touch,
    )
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.add_init_script(PROBE)
    page.goto(viewer_url(args.url))
    wait_ready(page, "day", 120)
    page.evaluate(FRAME_PROBE)
    # These wide poses previously either hid an above-ground city or enabled
    # dense blue underwater fog above dry land. The live RAF must repair them.
    for position, target in (
      ([400, 100, 500], [400, 180, -1500]),
      ([400, -5, 500], [400, -110, -1500]),
    ):
      page.evaluate(
        """pose => {
          const r = window.__modeContinuityRuntime();
          r.camera.position.fromArray(pose[0]);r.controls.target.fromArray(pose[1]);
          r.camera.fov=39;r.camera.updateProjectionMatrix();
          r.controls.maxPolarAngle=Math.PI-0.06;r.controls.update();
          r.renderInvalidated=true;
        }""",
        [position, target],
      )
      page.wait_for_timeout(500)
      canvas = page.locator(".three-viewer.is-active canvas.three-canvas")
      canvas.focus()
      for key in ("w", "s", "ArrowUp", "ArrowDown", "Shift", "Space"):
        page.keyboard.down(key)
        page.wait_for_timeout(250)
        page.keyboard.up(key)
      page.wait_for_timeout(250)
    # Pointer looking uses the real viewer handler on both browser engines.
    page.mouse.move(240 if args.touch else 600, 350)
    page.mouse.down()
    page.mouse.move(260 if args.touch else 640, 300, steps=8)
    page.mouse.move(230 if args.touch else 580, 400, steps=8)
    page.mouse.up()
    page.wait_for_timeout(350)
    if args.touch and args.engine == "chromium":
      # Trusted two-finger motion and release exercise the real glide path.
      session = page.context.new_cdp_session(page)
      points = [{"x": 170, "y": 340}, {"x": 230, "y": 340}]
      session.send(
        "Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": points}
      )
      for step in range(1, 6):
        moved = [{"x": p["x"] + step * 6, "y": p["y"] + step * 8} for p in points]
        session.send(
          "Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": moved}
        )
        page.wait_for_timeout(25)
      session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
      page.wait_for_timeout(700)
      session.detach()
    width = 390 if args.touch else 1100
    for height in (664, 700, 664, 760):
      page.set_viewport_size({"width": width, "height": height})
      page.wait_for_timeout(250)
    state = page.evaluate("window.__stability")
    validate_frames(state)
    assert not errors, errors
    args.output.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(args.output))
    if not args.touch:
      cutaway = page.get_by_role(
        "button",
        name="Underground overview with rail and Tiergarten tunnels",
        exact=True,
      )
      cutaway.click()
      page.wait_for_function(
        "() => {const r=window.__modeContinuityRuntime();return r.underside && r.undergroundNetwork.visible && !r.isoWorld.visible;}"
      )
      cutaway.click()
      page.wait_for_function(
        "() => {const r=window.__modeContinuityRuntime();return !r.underside && r.isoWorld.visible;}"
      )
    browser.close()
  print(
    json.dumps({"success": True, "engine": args.engine, "touch": args.touch, **state})
  )
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
