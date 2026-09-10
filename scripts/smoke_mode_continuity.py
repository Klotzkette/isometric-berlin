"""Check real-browser camera/walking continuity across all five visual modes.

  uv run --with playwright python scripts/smoke_mode_continuity.py URL
  uv run --with playwright python scripts/smoke_mode_continuity.py URL --touch

Mode and walk controls are exercised through the actual UI. A React-fiber probe
reads the runtime without introducing a production debug API. The only direct
runtime write seeds an arbitrary, off-landmark camera before each scenario.
Touch emulation checks the coarse-pointer remount lifecycle, not iPhone speed.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

MODES = ("minecraft", "night", "snowstorm", "schwellenraum", "day")
LABELS = {
  "day": "Day",
  "minecraft": "Minecraft",
  "night": "Night",
  "snowstorm": "Snowstorm",
  "schwellenraum": "Schwellenraum",
}
FLIGHT_POSE = {
  "position": [712.375, 153.625, 618.875],
  "target": [507.125, 7.375, 300.625],
  "fov": 31.25,
}
WALK_SEED = {
  "position": [508.25, 9.25, 305.75],
  "target": [482.25, 6.75, 292.25],
  "fov": 37.5,
}
PROBE = """(() => {
  let nextId = 0;
  const ids = new WeakMap();
  window.__modeContinuity = {tracking: false, samples: []};
  window.__modeContinuityRuntime = () => {
    const el = document.querySelector('.three-viewer.is-active');
    if (!el) return null;
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber'));
    for (let f = el[key]; f; f = f.return) {
      for (let h = f.memoizedState; h; h = h.next) {
        const r = h.memoizedState?.current;
        if (r?.camera && r?.scene && r?.controls && !r.disposed &&
            r.landmarkByName?.size) return r;
      }
    }
    return null;
  };
  window.__readModeContinuity = () => {
    const r = window.__modeContinuityRuntime();
    if (!r) return null;
    if (!ids.has(r)) ids.set(r, ++nextId);
    const p = r.pedestrian;
    return {
      runtime: ids.get(r), mode: r.lightingMode, ready: r.presentationReady,
      position: r.camera.position.toArray(), target: r.controls.target.toArray(),
      fov: r.camera.fov, near: r.camera.near, underside: r.underside,
      enabled: p.enabled, requested: p.requested,
      pedestrian: p.state ? {...p.state} : null,
      savedPosition: p.savedPose?.position.toArray() ?? null,
      savedTarget: p.savedPose?.target.toArray() ?? null,
      savedFov: p.savedFov, savedNear: p.savedNear,
      voxelAttached: Boolean(r.voxelWorld),
    };
  };
  setInterval(() => {
    const p = window.__modeContinuity;
    if (!p.tracking || p.samples.length >= 8000) return;
    const sample = window.__readModeContinuity();
    if (sample) p.samples.push(sample);
  }, 50);
})();"""


def emit(**values: object) -> None:
  print(json.dumps(values, ensure_ascii=False), flush=True)


def viewer_url(url: str) -> str:
  parts = urlsplit(url)
  query = dict(parse_qsl(parts.query))
  query.update(lang="en", theme="day")
  return urlunsplit(parts._replace(query=urlencode(query), fragment=""))


def near(actual: Any, expected: Any, name: str, epsilon: float = 0.01) -> None:
  if isinstance(expected, list):
    assert isinstance(actual, list) and len(actual) == len(expected), name
    for index, (a, b) in enumerate(zip(actual, expected, strict=True)):
      near(a, b, f"{name}[{index}]", epsilon)
  elif isinstance(expected, (float, int)) and not isinstance(expected, bool):
    assert isinstance(actual, (float, int)) and math.isfinite(actual), name
    assert abs(actual - expected) <= epsilon, {
      "field": name,
      "expected": expected,
      "actual": actual,
    }
  else:
    assert actual == expected, {"field": name, "expected": expected, "actual": actual}


def assert_pose(actual: dict[str, Any], expected: dict[str, Any]) -> None:
  for key in ("position", "target", "fov", "near", "enabled", "requested"):
    near(actual[key], expected[key], key)
  if expected["enabled"]:
    for key in (
      "x",
      "z",
      "groundY",
      "yaw",
      "pitch",
      "groundLayer",
      "insideTunnel",
      "grounded",
      "jumpOffset",
      "verticalVelocity",
    ):
      near(actual["pedestrian"][key], expected["pedestrian"][key], f"walk.{key}")
    for key in ("savedPosition", "savedTarget", "savedFov", "savedNear"):
      near(actual[key], expected[key], key)


def wait_ready(page: Any, mode: str, timeout: float) -> dict[str, Any]:
  page.wait_for_function(
    "mode => {const r = window.__readModeContinuity?.(); "
    "return r?.mode === mode && r.ready;}",
    arg=mode,
    timeout=timeout * 1000,
  )
  page.wait_for_timeout(650)
  return page.evaluate("window.__readModeContinuity()")


def open_mobile_actions(page: Any) -> None:
  if not page.locator(".mobile-visual-mode-grid").is_visible():
    page.locator(".mobile-overflow").tap()


def select_mode(page: Any, mode: str, touch: bool) -> None:
  if touch:
    open_mobile_actions(page)
    page.locator(".mobile-visual-mode-grid").get_by_role(
      "button", name=LABELS[mode], exact=True
    ).tap()
  else:
    page.locator(".visual-mode-switch").get_by_role(
      "button", name=LABELS[mode], exact=True
    ).click()
  page.wait_for_function(
    "mode => document.querySelector('.app-shell')?.classList.contains(`app-shell--${mode}`)",
    arg=mode,
  )


def seed_camera(page: Any, pose: dict[str, Any]) -> None:
  page.evaluate(
    """pose => {
      const r = window.__modeContinuityRuntime();
      const damping = r.controls.enableDamping;
      r.controls.enableDamping = false;
      r.camera.position.fromArray(pose.position);
      r.controls.target.fromArray(pose.target);
      r.camera.fov = pose.fov;
      r.camera.updateProjectionMatrix();
      r.controls.update();
      r.controls.enableDamping = damping;
      r.renderInvalidated = true;
    }""",
    pose,
  )
  page.wait_for_timeout(1000)
  actual = page.evaluate("window.__readModeContinuity()")
  for key in ("position", "target", "fov"):
    near(actual[key], pose[key], f"seed.{key}")


def enter_walk(page: Any, touch: bool) -> None:
  seed_camera(page, WALK_SEED)
  if touch:
    open_mobile_actions(page)
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Walk", exact=True
    ).tap()
    if page.locator(".mobile-sheet-title button").is_visible():
      page.locator(".mobile-sheet-title button").tap()
  else:
    page.locator(".pedestrian-mode-toggle").click()
  page.wait_for_function(
    "() => window.__readModeContinuity()?.pedestrian?.grounded === true"
  )
  # Real held navigation moves away from the seed, then comes to rest. Touch
  # still exercises the coarse-pointer viewer lifecycle with a hardware key.
  page.keyboard.down("w")
  page.wait_for_timeout(180)
  page.keyboard.up("w")
  page.keyboard.down("ArrowRight")
  page.wait_for_timeout(140)
  page.keyboard.up("ArrowRight")
  page.wait_for_timeout(800)
  actual = page.evaluate("window.__readModeContinuity()")
  assert actual["enabled"] and actual["pedestrian"]["grounded"], actual
  assert (
    math.hypot(
      actual["pedestrian"]["x"] - WALK_SEED["position"][0],
      actual["pedestrian"]["z"] - WALK_SEED["position"][2],
    )
    > 0.2
  ), "Held walking input did not move the player"


def start_tracking(page: Any) -> dict[str, Any]:
  return page.evaluate(
    """() => {
      window.__modeContinuity.samples = [];
      window.__modeContinuity.tracking = true;
      return window.__readModeContinuity();
    }"""
  )


def check_tracking(page: Any, expected: dict[str, Any]) -> int:
  samples = page.evaluate(
    """() => {
      window.__modeContinuity.tracking = false;
      return window.__modeContinuity.samples;
    }"""
  )
  visible = [sample for sample in samples if sample["ready"]]
  assert visible, "No presented camera samples were captured"
  for sample in visible:
    assert_pose(sample, expected)
  return len(visible)


def sequence(page: Any, touch: bool, timeout: float) -> None:
  for walking in (False, True):
    if walking:
      enter_walk(page, touch)
    else:
      seed_camera(page, FLIGHT_POSE)
    expected = start_tracking(page)
    runtimes = {expected["runtime"]}
    for mode in MODES:
      select_mode(page, mode, touch)
      actual = wait_ready(page, mode, timeout)
      assert_pose(actual, expected)
      runtimes.add(actual["runtime"])
      emit(event="mode-position-passed", touch=touch, walking=walking, state=actual)
    if touch:
      assert len(runtimes) >= 3, "Touch did not exercise drawn/voxel remounts"
    samples = check_tracking(page, expected)
    emit(event="sequence-passed", touch=touch, walking=walking, samples=samples)


def rapid_switches(page: Any, touch: bool, walking: bool, timeout: float) -> None:
  pending: list[Any] = []
  page.route("**/minecraft-voxels.json*", lambda route: pending.append(route))
  if walking:
    enter_walk(page, touch)
  else:
    seed_camera(page, FLIGHT_POSE)
  expected = start_tracking(page)
  select_mode(page, "minecraft", touch)
  # Waiting for the captured network request proves this is an unfinished
  # cold Minecraft load, rather than merely toggling a cached representation.
  for _ in range(100):
    if pending:
      break
    page.wait_for_timeout(100)
  assert pending, "Minecraft payload request was not intercepted"
  assert not page.evaluate("window.__readModeContinuity()?.voxelAttached"), (
    "Minecraft unexpectedly finished before rapid mode changes"
  )
  for mode in ("night", "snowstorm", "schwellenraum", "day"):
    select_mode(page, mode, touch)
  wait_ready(page, "day", timeout)
  assert_pose(page.evaluate("window.__readModeContinuity()"), expected)
  for route in pending:
    route.continue_()
  page.unroute("**/minecraft-voxels.json*")
  page.wait_for_timeout(5000)
  actual = page.evaluate("window.__readModeContinuity()")
  assert actual["mode"] == "day", actual
  assert_pose(actual, expected)
  samples = check_tracking(page, expected)
  emit(event="rapid-switch-passed", touch=touch, walking=walking, samples=samples)


def explicit_actions(page: Any, touch: bool, timeout: float) -> None:
  seed_camera(page, FLIGHT_POSE)
  select_mode(page, "minecraft", touch)
  wait_ready(page, "minecraft", timeout)
  reset = page.locator(".toolbar-reset")
  if reset.is_visible():
    reset.tap() if touch else reset.click()
  else:
    page.keyboard.press("r")
  wait_ready(page, "day", timeout)
  page.wait_for_timeout(2000)
  reset_pose = page.evaluate("window.__readModeContinuity()")
  assert not reset_pose["enabled"], reset_pose
  near(reset_pose["target"], [317.729, 21.595, 40.477], "reset.target", 0.05)
  emit(event="explicit-reset-passed", touch=touch, state=reset_pose)

  enter_walk(page, touch)
  expected = page.evaluate("window.__readModeContinuity()")
  for mode in ("minecraft", "day"):
    select_mode(page, mode, touch)
    assert_pose(wait_ready(page, mode, timeout), expected)
  # Recovery is a real user control; on this open pavement the recent safe
  # checkpoint should keep the player in the immediate neighbourhood.
  if touch and page.locator(".attribution.is-expanded").is_visible():
    page.locator(".attribution-toggle").tap()
  recovery = page.locator(".navigation-recovery-button")
  recovery.tap() if touch else recovery.click()
  page.wait_for_timeout(700)
  recovered = page.evaluate("window.__readModeContinuity()")
  assert math.dist(recovered["position"], expected["position"]) < 40, recovered
  emit(event="recovery-control-passed", touch=touch, state=recovered)

  # The only renderer is now 3D. An explicit Walk toggle restores the saved
  # flight pose; subsequent visual-style changes must preserve that pose too.
  assert page.locator('.map-stage[data-viewer-mode="three"]').is_visible()
  assert page.get_by_role("button", name="2D", exact=True).count() == 0
  assert (
    page.get_by_role(
      "button", name="Switch to the high-resolution detail map", exact=True
    ).count()
    == 0
  )
  assert recovered["enabled"] and recovered["requested"], recovered
  if touch:
    open_mobile_actions(page)
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Walk", exact=True
    ).tap()
    if page.locator(".mobile-sheet-title button").is_visible():
      page.locator(".mobile-sheet-title button").tap()
  else:
    page.locator(".pedestrian-mode-toggle").click()
  actual = wait_ready(page, "day", timeout)
  assert not actual["enabled"] and not actual["requested"], actual
  assert actual["pedestrian"] is None, actual
  near(actual["position"], recovered["savedPosition"], "walk-exit.position")
  near(actual["target"], recovered["savedTarget"], "walk-exit.target")
  near(actual["fov"], recovered["savedFov"], "walk-exit.fov")
  near(actual["near"], recovered["savedNear"], "walk-exit.near")
  expected_flight = start_tracking(page)
  for mode in ("minecraft", "night", "day"):
    select_mode(page, mode, touch)
    assert_pose(wait_ready(page, mode, timeout), expected_flight)
  samples = check_tracking(page, expected_flight)
  emit(event="walk-flight-3d-only-passed", touch=touch, samples=samples, state=actual)


def run(url: str, touch: bool, timeout: float, case: str, output: Path | None) -> None:
  from playwright.sync_api import sync_playwright

  with sync_playwright() as playwright:
    browser = playwright.chromium.launch(channel="chrome")
    options = (
      playwright.devices["iPhone 13"]
      if touch
      else {"viewport": {"width": 1440, "height": 1000}}
    )
    cases = (
      ("sequence", "rapid-flight", "rapid-walk", "explicit-actions")
      if case == "all"
      else (case,)
    )
    for scenario in cases:
      context = browser.new_context(**options)
      context.add_init_script(PROBE)
      page = context.new_page()
      page.set_default_timeout(timeout * 1000)
      errors: list[str] = []
      page.on("pageerror", lambda error: errors.append(str(error)))
      try:
        page.goto(viewer_url(url), wait_until="domcontentloaded")
        wait_ready(page, "day", timeout)
        page.wait_for_timeout(2500)
        if scenario == "sequence":
          sequence(page, touch, timeout)
        elif scenario == "explicit-actions":
          explicit_actions(page, touch, timeout)
        else:
          rapid_switches(page, touch, scenario == "rapid-walk", timeout)
        assert not errors, errors
        emit(event="scenario-passed", scenario=scenario, touch=touch)
      except Exception:
        if output:
          output.mkdir(parents=True, exist_ok=True)
          prefix = output / f"mode-{scenario}-{'touch' if touch else 'desktop'}"
          page.screenshot(path=f"{prefix}.png")
          samples = page.evaluate("window.__modeContinuity?.samples ?? []")
          Path(f"{prefix}.json").write_text(
            json.dumps({"samples": samples, "errors": errors}, indent=2)
          )
        raise
      finally:
        context.close()
    browser.close()
  emit(event="mode-continuity-passed", touch=touch, case=case)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--touch", action="store_true")
  parser.add_argument("--timeout", type=float, default=120)
  parser.add_argument(
    "--case",
    choices=("all", "sequence", "rapid-flight", "rapid-walk", "explicit-actions"),
    default="all",
  )
  parser.add_argument("--failure-output", type=Path)
  args = parser.parse_args()
  if urlsplit(args.url).scheme not in {"http", "https"} or args.timeout <= 0:
    parser.error("Provide an HTTP(S) URL and a positive timeout")
  run(args.url, args.touch, args.timeout, args.case, args.failure_output)


if __name__ == "__main__":
  main()
