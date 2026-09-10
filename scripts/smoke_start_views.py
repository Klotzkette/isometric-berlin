"""Verify curated opening views in the built viewer using a real browser.

  uv run --with playwright python scripts/smoke_start_views.py URL
  uv run --with playwright python scripts/smoke_start_views.py URL --touch

Expected poses are read directly from the repository TypeScript profile with Bun.
The diagnostic reads React's runtime objects; it adds no production debug API.
Touch emulation checks layout and lifecycle, not physical iPhone performance.
"""

from __future__ import annotations

import argparse
import json
import math
import subprocess
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
PROBE = """(() => {
  window.__startViewProbe = {samples: []};
  const read = () => {
    const el = document.querySelector('.three-viewer.is-active');
    if (!el) return null;
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber'));
    for (let f = el[key]; f; f = f.return) {
      for (let h = f.memoizedState; h; h = h.next) {
        const r = h.memoizedState?.current;
        if (r?.camera && r?.scene && r?.controls && !r.disposed &&
            r.landmarkByName?.size) {
          return {camera:r.camera.position.toArray(), target:r.controls.target.toArray(),
            fov:r.camera.fov, ready:r.presentationReady, mode:r.lightingMode};
        }
      }
    }
    return null;
  };
  window.__readStartViewPose = read;
  setInterval(() => {
    const state = read();
    if (!state) return;
    const probe = window.__startViewProbe;
    const text = JSON.stringify(state);
    if (text !== probe.last && probe.samples.length < 128) {
      probe.samples.push(state); probe.last = text;
    }
  }, 25);
})();"""


def emit(**value: object) -> None:
  print(json.dumps(value, ensure_ascii=False), flush=True)


def read_profile() -> dict[str, Any]:
  source = """
import { SIMULATION_START_SIGHT_NAMES, SIMULATION_START_STORAGE_KEY, sightSlug }
  from './src/viewNavigation.ts';
import { SIMULATION_START_VIEWS, simulationStartLabel } from './src/simulationStartViews.ts';
console.log(JSON.stringify({key: SIMULATION_START_STORAGE_KEY,
  views: SIMULATION_START_SIGHT_NAMES.map(name => ({name, slug: sightSlug(name),
    label: simulationStartLabel(name), ...SIMULATION_START_VIEWS[name]}))}));
"""
  result = subprocess.run(
    ["bun", "-e", source],
    cwd=ROOT / "src/app",
    check=True,
    capture_output=True,
    text=True,
  )
  profile = json.loads(result.stdout)
  assert len(profile["views"]) == 6, "Opening contract requires six views"
  assert len({v["name"] for v in profile["views"]}) == 6
  return profile


def pose_matches(pose: dict[str, Any], view: dict[str, Any]) -> bool:
  pairs = ((pose.get("camera"), view["position"]), (pose.get("target"), view["target"]))
  for actual, expected in pairs:
    if not isinstance(actual, list) or len(actual) != 3:
      return False
    if any(not isinstance(x, (float, int)) or not math.isfinite(x) for x in actual):
      return False
    if max(abs(a - b) for a, b in zip(actual, expected, strict=True)) > 0.02:
      return False
  fov = pose.get("fov")
  return isinstance(fov, (float, int)) and abs(fov - view["fov"]) <= 0.001


def check_samples(samples: list[dict[str, Any]], view: dict[str, Any]) -> None:
  assert samples, "No loaded runtime was observed"
  assert any(not sample["ready"] for sample in samples), "Missing pre-ready pose"
  assert any(sample["ready"] for sample in samples), "Missing ready pose"
  for sample in samples:
    assert pose_matches(sample, view), {"expected": view, "actual": sample}


def viewer_url(url: str, slug: str | None = None) -> str:
  parts = urlsplit(url)
  query = dict(parse_qsl(parts.query))
  query.update(lang="de", theme="day")
  return urlunsplit(
    parts._replace(query=urlencode(query), fragment=f"landmark={slug}" if slug else "")
  )


def wait_ready(page: Any, timeout: float) -> None:
  page.locator(".three-viewer.is-active.is-presentation-ready").wait_for(
    timeout=timeout * 1000
  )
  page.wait_for_timeout(2500)


def switch_touch_mode(page: Any, label: str, timeout: float) -> None:
  opener = page.locator(".mobile-overflow")
  if not page.locator(".mobile-visual-mode-grid").is_visible():
    opener.tap()
  page.locator(".mobile-visual-mode-grid").get_by_role(
    "button", name=label, exact=True
  ).tap()
  wait_ready(page, timeout)


def select_same_sight(page: Any, name: str, touch: bool) -> None:
  rail = page.locator(".landmark-rail")
  if not rail.is_visible():
    page.locator(".mobile-overflow").tap()
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Sehenswürdigkeiten", exact=True
    ).tap()
  button = rail.get_by_role("button", name=f"Sehenswürdigkeit: {name}", exact=True)
  button.scroll_into_view_if_needed()
  if touch:
    button.tap()
  else:
    button.click()


def run(
  url: str, touch: bool, engine: str, timeout: float, screenshots: Path | None
) -> None:
  from playwright.sync_api import sync_playwright

  profile = read_profile()
  views = profile["views"]
  errors: list[str] = []
  with sync_playwright() as playwright:
    browser = getattr(playwright, engine).launch(
      **({"channel": "chrome"} if engine == "chromium" else {})
    )
    options = (
      playwright.devices["iPhone 13"]
      if touch
      else {"viewport": {"width": 1440, "height": 1000}}
    )
    context = browser.new_context(**options)
    context.add_init_script(PROBE)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on(
      "console",
      lambda message: errors.append(message.text) if message.type == "error" else None,
    )
    page.set_default_timeout(timeout * 1000)
    # One context and real reloads prove the persisted rotation, rather than
    # seeding each expected value before every visit.
    for index, view in enumerate(views):
      if index:
        page.reload(wait_until="domcontentloaded")
      else:
        page.goto(viewer_url(url), wait_until="domcontentloaded")
      wait_ready(page, timeout)
      samples = page.evaluate("window.__startViewProbe.samples")
      check_samples(samples, view)
      stored = page.evaluate("key => localStorage.getItem(key)", profile["key"])
      assert stored == view["name"], (stored, view["name"])
      assert not errors, errors
      if screenshots:
        screenshots.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(screenshots / f"{index + 1}-{view['slug']}.png"))
      emit(
        event="rotating-opening-passed",
        name=view["name"],
        touch=touch,
        samples=len(samples),
        first=samples[0],
        last=samples[-1],
      )

    # A seventh load wraps; use this same featured sight for manual reselection.
    view = views[0]
    page.reload(wait_until="domcontentloaded")
    wait_ready(page, timeout)
    check_samples(page.evaluate("window.__startViewProbe.samples"), view)
    if touch:
      for label, mode in (("Minecraft", "minecraft"), ("Tag", "day")):
        switch_touch_mode(page, label, timeout)
        pose = page.evaluate("window.__readStartViewPose()")
        assert pose["mode"] == mode and pose_matches(pose, view), pose
      emit(event="touch-world-remount-passed", name=view["name"])
    select_same_sight(page, view["name"], touch)
    page.wait_for_timeout(500)
    normal = page.evaluate("window.__readStartViewPose()")
    assert not pose_matches(normal, view), (
      "Manual same-name selection kept opening pose"
    )
    if touch:
      for label in ("Minecraft", "Tag"):
        switch_touch_mode(page, label, timeout)
        pose = page.evaluate("window.__readStartViewPose()")
        assert not pose_matches(pose, view), "A remount restored the cleared opening"
    emit(event="manual-same-name-focus-passed", name=view["name"], pose=normal)
    context.close()

    # Fresh explicit deep link must neither consume a rotation slot nor use
    # the automatic close-up. Test the station, whose two cameras differ most.
    view = next(view for view in views if view["name"] == "Berlin Hauptbahnhof")
    context = browser.new_context(**options)
    context.add_init_script(PROBE)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(viewer_url(url, view["slug"]), wait_until="domcontentloaded")
    wait_ready(page, timeout)
    pose = page.evaluate("window.__readStartViewPose()")
    assert not pose_matches(pose, view), "Explicit link incorrectly used opening pose"
    assert page.evaluate("key => localStorage.getItem(key)", profile["key"]) is None
    assert not errors, errors
    emit(event="explicit-link-exemption-passed", name=view["name"], pose=pose)
    context.close()
    browser.close()
  emit(event="start-view-smoke-passed", touch=touch, engine=engine)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--touch", action="store_true")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  parser.add_argument("--timeout", type=float, default=120)
  parser.add_argument("--screenshots", type=Path)
  args = parser.parse_args()
  if urlsplit(args.url).scheme not in {"http", "https"} or args.timeout <= 0:
    parser.error("Provide an HTTP(S) URL and a positive timeout")
  run(args.url, args.touch, args.engine, args.timeout, args.screenshots)


if __name__ == "__main__":
  main()
