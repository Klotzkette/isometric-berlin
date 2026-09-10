"""Verify 3D-only startup, real look controls and 3D-only error recovery.

  uv run --with playwright python scripts/smoke_isometric_only.py URL
  uv run --with playwright python scripts/smoke_isometric_only.py URL --touch

Uses the existing read-only React runtime probe and real mouse, keyboard and
Chromium touch input. Direct camera writes only establish an off-landmark test
pose. Touch emulation checks input/lifecycle, not physical iPhone GPU speed.
"""

from __future__ import annotations

import argparse
import math
import re
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from smoke_mode_continuity import (
  FLIGHT_POSE,
  MODES,
  PROBE,
  assert_pose,
  emit,
  enter_walk,
  near,
  open_mobile_actions,
  seed_camera,
  select_mode,
  wait_ready,
)

RETIRED_REQUEST = re.compile(
  r"openseadragon|(?:^|/)map-engine[^/]*\.js(?:\?|$)|"
  r"\.dzi(?:\?|$)|/regierungsviertel_files/",
  re.IGNORECASE,
)
RETIRED_BUTTON = re.compile(
  r"^(?:2D|3D|Open 2D map|Detail map|Switch to the high-resolution detail map|"
  r"Switch to the free official 3D view|Top-down reference map)$",
  re.IGNORECASE,
)


def url_for(url: str, legacy: bool = False) -> str:
  parts = urlsplit(url)
  query = dict(parse_qsl(parts.query))
  query.update(lang="en", theme="day")
  if legacy:
    query["view"] = "map"
  else:
    query.pop("view", None)
  return urlunsplit(parts._replace(query=urlencode(query), fragment=""))


def read_pose(page: Any) -> dict[str, Any]:
  pose = page.evaluate("window.__readModeContinuity()")
  assert pose and pose["ready"], "Missing ready isometric runtime"
  return pose


def direction_y(pose: dict[str, Any]) -> float:
  delta = [b - a for a, b in zip(pose["position"], pose["target"], strict=True)]
  length = math.hypot(*delta)
  assert length > 0, "Camera direction has zero length"
  return delta[1] / length


def heading(pose: dict[str, Any]) -> float:
  dx = pose["target"][0] - pose["position"][0]
  dz = pose["target"][2] - pose["position"][2]
  assert math.hypot(dx, dz) > 0.01, "Heading is undefined for a vertical camera"
  return math.atan2(dx, -dz)


def check_no_2d(page: Any, requests: list[str], touch: bool) -> None:
  assert not [url for url in requests if RETIRED_REQUEST.search(url)], requests
  assert (
    page.locator(
      "#openseadragon-viewer, .openseadragon-container, .openseadragon-canvas"
    ).count()
    == 0
  )
  assert page.get_by_role("button", name=RETIRED_BUTTON).count() == 0
  if touch:
    open_mobile_actions(page)
    assert page.get_by_role("button", name=RETIRED_BUTTON).count() == 0
    page.locator(".mobile-sheet-title button").tap()


def held_key(page: Any, key: str, duration_ms: int = 180) -> None:
  page.keyboard.down(key)
  page.wait_for_timeout(duration_ms)
  page.keyboard.up(key)
  page.wait_for_timeout(400)


def drag(
  page: Any,
  start: tuple[float, float],
  end: tuple[float, float],
  touch: bool,
  hold_ms: int = 0,
) -> None:
  if touch:
    session = page.context.new_cdp_session(page)
    session.send(
      "Input.dispatchTouchEvent",
      {"type": "touchStart", "touchPoints": [{"x": start[0], "y": start[1]}]},
    )
    for step in range(1, 7):
      point = {
        "x": start[0] + (end[0] - start[0]) * step / 6,
        "y": start[1] + (end[1] - start[1]) * step / 6,
      }
      session.send(
        "Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": [point]}
      )
      page.wait_for_timeout(15)
    page.wait_for_timeout(hold_ms)
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    session.detach()
  else:
    page.mouse.move(*start)
    page.mouse.down(button="left")
    page.mouse.move(*end, steps=6)
    page.wait_for_timeout(hold_ms)
    page.mouse.up(button="left")
  page.wait_for_timeout(500)


def look_change(
  page: Any,
  before: dict[str, Any],
  sign: int,
  label: str,
  walking: bool,
) -> dict[str, Any]:
  after = read_pose(page)
  change = direction_y(after) - direction_y(before)
  assert change * sign > 0.002, {
    "action": label,
    "walking": walking,
    "direction_y_change": change,
    "before": before,
    "after": after,
  }
  if walking:
    for key in ("x", "z"):
      near(after["pedestrian"][key], before["pedestrian"][key], f"{label}.{key}")
  emit(event="look-direction-passed", action=label, walking=walking, delta_y=change)
  return after


def heading_change(
  page: Any,
  before: dict[str, Any],
  sign: int,
  label: str,
  walking: bool,
) -> dict[str, Any]:
  after = read_pose(page)
  delta = heading(after) - heading(before)
  change = math.atan2(math.sin(delta), math.cos(delta))
  assert change * sign > 0.002, {
    "action": label,
    "walking": walking,
    "heading_change": change,
    "before": before,
    "after": after,
  }
  if walking:
    for key in ("x", "z"):
      near(after["pedestrian"][key], before["pedestrian"][key], f"{label}.{key}")
  emit(event="heading-direction-passed", action=label, walking=walking, radians=change)
  return after


def camera_button(page: Any, label: str, touch: bool) -> Any:
  selector = f'button[aria-label="{label}"]:visible'
  if page.locator(selector).count() == 0 and touch:
    page.locator(".mobile-compass-fab").tap()
  button = page.locator(selector).first
  button.wait_for(state="visible")
  return button


def close_mobile_sheet(page: Any, touch: bool) -> None:
  if touch and page.locator(".mobile-sheet-title button").is_visible():
    page.locator(".mobile-sheet-title button").tap()


def check_controls(page: Any, touch: bool) -> None:
  for walking in (False, True):
    if walking:
      enter_walk(page, touch)
    else:
      seed_camera(page, FLIGHT_POSE)
    for key, sign in (("ArrowRight", 1), ("ArrowLeft", -1)):
      before = read_pose(page)
      held_key(page, key)
      heading_change(page, before, sign, key, walking)
    for label, sign in (("Rotate right", 1), ("Rotate left", -1)):
      button = camera_button(page, label, touch)
      before = read_pose(page)
      button.tap() if touch else button.click()
      page.wait_for_timeout(450)
      heading_change(page, before, sign, f"{label}-tap", walking)
      if not touch:
        before = read_pose(page)
        point = button.bounding_box()
        assert point
        centre = (point["x"] + point["width"] / 2, point["y"] + point["height"] / 2)
        drag(page, centre, centre, False, hold_ms=220)
        heading_change(page, before, sign, f"{label}-hold", walking)
    close_mobile_sheet(page, touch)
    for key, sign in (("ArrowUp", 1), ("ArrowDown", -1)):
      before = read_pose(page)
      held_key(page, key)
      look_change(page, before, sign, key, walking)
    canvas = page.locator(".three-viewer.is-active canvas").first
    box = canvas.bounding_box()
    assert box
    start = (box["x"] + box["width"] * 0.63, box["y"] + box["height"] * 0.42)
    for dy, sign in ((-24, 1), (24, -1)):
      before = read_pose(page)
      drag(page, start, (start[0], start[1] + dy), touch)
      look_change(page, before, sign, f"canvas-drag-{dy}", walking)

    for label, sign in (("Look up", 1), ("Look down", -1)):
      button = camera_button(page, label, touch)
      before = read_pose(page)
      button.tap() if touch else button.click()
      page.wait_for_timeout(450)
      look_change(page, before, sign, f"{label}-tap", walking)
      if not touch:
        before = read_pose(page)
        point = button.bounding_box()
        assert point
        centre = (point["x"] + point["width"] / 2, point["y"] + point["height"] / 2)
        drag(page, centre, centre, False, hold_ms=220)
        look_change(page, before, sign, f"{label}-hold", walking)
    close_mobile_sheet(page, touch)

    before = read_pose(page)
    joystick = page.locator(".flight-joystick").bounding_box()
    assert joystick
    centre = (
      joystick["x"] + joystick["width"] / 2,
      joystick["y"] + joystick["height"] / 2,
    )
    drag(page, centre, (centre[0], centre[1] - joystick["height"] * 0.28), touch, 180)
    after = read_pose(page)
    # Horizontal forward control must never become look-up or vertical flight.
    near(direction_y(after), direction_y(before), "joystick.pitch", 0.0001)
    distance = math.hypot(
      after["position"][0] - before["position"][0],
      after["position"][2] - before["position"][2],
    )
    assert distance > 0.2, {"joystick_horizontal_distance": distance}
    if not walking:
      near(after["position"][1], before["position"][1], "joystick.altitude")
    else:
      for key in ("w", "s"):
        before = read_pose(page)
        held_key(page, key)
        after = read_pose(page)
        assert (
          math.hypot(
            after["pedestrian"]["x"] - before["pedestrian"]["x"],
            after["pedestrian"]["z"] - before["pedestrian"]["z"],
          )
          > 0.2
        ), f"{key} did not move the walker"
        near(
          after["pedestrian"]["pitch"], before["pedestrian"]["pitch"], f"{key}.pitch"
        )
    emit(
      event="level-joystick-passed", walking=walking, touch=touch, distance_m=distance
    )


def check_legacy_start(page: Any, url: str, touch: bool, timeout: float) -> None:
  page.goto(url_for(url, legacy=True), wait_until="domcontentloaded")
  wait_ready(page, "day", timeout)
  page.wait_for_timeout(1800)
  seed_camera(page, FLIGHT_POSE)
  expected = read_pose(page)
  for mode in MODES:
    select_mode(page, mode, touch)
    assert_pose(wait_ready(page, mode, timeout), expected)
  emit(event="legacy-map-url-is-3d-passed", touch=touch)


def check_error(
  browser: Any, options: dict[str, Any], url: str, timeout: float
) -> None:
  context = browser.new_context(**options)
  context.add_init_script("""(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
      if (/^(webgl2?|experimental-webgl)$/.test(kind)) return null;
      return original.call(this, kind, ...args);
    };
  })();""")
  page = context.new_page()
  requests: list[str] = []
  page.on("request", lambda request: requests.append(request.url))
  try:
    page.goto(url_for(url, legacy=True), wait_until="domcontentloaded")
    panel = page.locator(".three-viewer-error-panel")
    panel.wait_for(state="visible", timeout=timeout * 1000)
    assert not re.search(r"\b2D\b|OpenSeadragon|DZI", panel.inner_text(), re.IGNORECASE)
    assert panel.get_by_role("button").count() == 1
    reload_button = panel.get_by_role("button", name="Reload page", exact=True)
    with page.expect_navigation(wait_until="domcontentloaded"):
      reload_button.click()
    panel.wait_for(state="visible", timeout=timeout * 1000)
    assert panel.get_by_role("button").count() == 1
    assert not [request for request in requests if RETIRED_REQUEST.search(request)]
    assert page.get_by_role("button", name=RETIRED_BUTTON).count() == 0
    emit(event="webgl-error-reload-only-passed")
  finally:
    context.close()


def run(url: str, touch: bool, timeout: float, output: Path | None) -> None:
  from playwright.sync_api import sync_playwright

  with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome")
    options = (
      playwright.devices["iPhone 13"]
      if touch
      else {"viewport": {"width": 1440, "height": 1000}}
    )
    context = browser.new_context(**options)
    context.add_init_script(PROBE)
    page = context.new_page()
    page.set_default_timeout(timeout * 1000)
    requests: list[str] = []
    errors: list[str] = []
    page.on("request", lambda request: requests.append(request.url))
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
      page.goto(url_for(url), wait_until="domcontentloaded")
      wait_ready(page, "day", timeout)
      check_no_2d(page, requests, touch)
      check_legacy_start(page, url, touch, timeout)
      check_no_2d(page, requests, touch)
      check_controls(page, touch)
      check_no_2d(page, requests, touch)
      assert not errors, errors
      if output:
        output.mkdir(parents=True, exist_ok=True)
        page.screenshot(
          path=str(output / f"isometric-only-{'touch' if touch else 'desktop'}.png")
        )
      emit(
        event="isometric-only-controls-passed",
        touch=touch,
        requests=len(requests),
        loaded_entry_scripts=sorted(
          {url for url in requests if re.search(r"/assets/index-[^/]+\.js$", url)}
        ),
      )
    except Exception:
      if output:
        output.mkdir(parents=True, exist_ok=True)
        page.screenshot(
          path=str(
            output / f"isometric-only-failed-{'touch' if touch else 'desktop'}.png"
          )
        )
      raise
    finally:
      context.close()
    check_error(browser, options, url, timeout)
    browser.close()
  emit(event="isometric-only-smoke-passed", touch=touch)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--touch", action="store_true")
  parser.add_argument("--timeout", type=float, default=120)
  parser.add_argument("--screenshots", type=Path)
  args = parser.parse_args()
  if urlsplit(args.url).scheme not in {"http", "https"} or args.timeout <= 0:
    parser.error("Provide an HTTP(S) URL and a positive timeout")
  run(args.url, args.touch, args.timeout, args.screenshots)


if __name__ == "__main__":
  main()
