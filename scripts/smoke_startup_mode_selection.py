"""Verify the explicit startup chooser in fresh Chrome and iPhone WebKit contexts.

uv run --with playwright python scripts/smoke_startup_mode_selection.py URL
Checks the five drawn starts, Minecraft's retained option, language, refresh,
mode defaults, and the absence of world/audio work before Start. Small portrait
and landscape checks exercise accessible controls and the chooser's own scroll.
Browser device profiles do not certify physical phone memory or performance.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from smoke_mode_continuity import PROBE, emit, wait_ready

MODES = ("day", "night", "snowstorm", "schwellenraum", "flood")
CHOICES = (*MODES, "minecraft")
STARTUP_PROBE = """(() => {
  window.__startupSelection = {audioContexts: 0, modes: [], firstReady: null,
    fetches: [], documentErrors: []};
  window.addEventListener('error', event => {
    window.__startupSelection.documentErrors.push(String(event.error ?? event.message));
  });
  window.addEventListener('unhandledrejection', event => {
    window.__startupSelection.documentErrors.push(String(event.reason));
  });
  const fetch = window.fetch;
  window.fetch = function(...args) {
    const input = args[0] instanceof Request ? args[0].url : String(args[0]);
    window.__startupSelection.fetches.push(new URL(input, location.href).href);
    return Reflect.apply(fetch, this, args);
  };
  for (const name of ['AudioContext', 'webkitAudioContext']) {
    const Native = window[name];
    if (!Native) continue;
    window[name] = new Proxy(Native, {construct(target, args) {
      window.__startupSelection.audioContexts++;
      return Reflect.construct(target, args);
    }});
  }
  try {
    localStorage.setItem('isometric-berlin.nightLightsOn', 'false');
    localStorage.setItem('isometric-berlin.language', 'de');
  } catch {}
  window.__readStartupSelection = () => {
    const r = window.__modeContinuityRuntime?.();
    if (!r) return null;
    return {mode: r.lightingMode, ready: r.presentationReady,
      nightLightsOn: r.nightLightsOn,
      precipitationEnabled: r.precipitationEnabled, floodDepth: r.floodDepth,
      contextLost: r.renderer.getContext().isContextLost()};
  };
  setInterval(() => {
    const r = window.__readStartupSelection();
    if (!r) return;
    const p = window.__startupSelection;
    if (!p.modes.includes(r.mode)) p.modes.push(r.mode);
    if (r.ready && !p.firstReady) p.firstReady = r;
  }, 25);
})();"""


def startup_url(url: str, mode: str | None, language: str = "en") -> str:
  """Keep arbitrary hosting subpaths while choosing explicit startup intent."""
  parts = urlsplit(url)
  query = dict(parse_qsl(parts.query))
  query.pop("theme", None)
  query["lang"] = language
  if mode is not None:
    query["theme"] = mode
  return urlunsplit(parts._replace(query=urlencode(query), fragment=""))


def world_request(url: str) -> bool:
  """Detect the lazy renderer, engine, workers, and scene payloads in builds."""
  path = urlsplit(url).path.lower()
  return "/mesh/" in path or any(
    name in path
    for name in ("threeviewer", "three-engine", "progressiveworld", ".glb", ".gltf")
  )


def choose_mode(page: Any, mode: str) -> None:
  radio = page.locator(f'input[name="startup-mode"][value="{mode}"]')
  # The native radio is visually hidden; activate its visible label as a user.
  radio.locator("..").click()
  assert radio.is_checked(), mode


def assert_gate(page: Any, requests: list[str]) -> dict[str, Any]:
  page.locator(".startup-mode-selection").wait_for(state="visible")
  page.wait_for_timeout(600)
  radios = page.get_by_role("radio")
  assert radios.count() == len(CHOICES), "Missing accessible mode choices"
  assert set(radios.evaluate_all("els => els.map(e => e.value)")) == set(CHOICES)
  assert page.locator("canvas, .three-viewer").count() == 0
  assert page.evaluate("window.__modeContinuityRuntime()") is None
  probe = page.evaluate("window.__startupSelection")
  assert probe["audioContexts"] == 0, probe
  assert not probe["modes"] and probe["firstReady"] is None, probe
  assert not probe["documentErrors"], probe["documentErrors"]
  resources = page.evaluate(
    "performance.getEntriesByType('resource').map(resource => resource.name)"
  )
  forbidden = sorted(
    {url for url in [*requests, *resources, *probe["fetches"]] if world_request(url)}
  )
  assert not forbidden, {"prematureWorldRequests": forbidden}
  return {"requestCount": len(requests), "audioContexts": probe["audioContexts"]}


def assert_controls_reachable(page: Any) -> dict[str, Any]:
  """A scrollable chooser must expose every option and the final Start button."""
  data = page.locator(".startup-mode-selection").evaluate(
    """el => ({width: el.clientWidth, scrollWidth: el.scrollWidth,
      height: el.clientHeight, scrollHeight: el.scrollHeight,
      overflowY: getComputedStyle(el).overflowY})"""
  )
  assert data["scrollWidth"] <= data["width"] + 1, data
  if data["scrollHeight"] > data["height"] + 1:
    assert data["overflowY"] in {"auto", "scroll"}, data
  text_overflow = page.locator(
    ".startup-mode-option strong, .startup-mode-option small"
  ).evaluate_all(
    """els => els.filter(el => el.scrollWidth > el.clientWidth + 1)
      .map(el => ({text: el.textContent, width: el.clientWidth, scrollWidth: el.scrollWidth}))"""
  )
  assert not text_overflow, {"cardTextOverflow": text_overflow}
  controls = [
    page.locator(f'input[name="startup-mode"][value="{mode}"]').locator("..")
    for mode in CHOICES
  ]
  controls.append(page.get_by_role("button", name=re.compile("Start Berlin")))
  for control in controls:
    control.scroll_into_view_if_needed()
    box = control.bounding_box()
    viewport = page.viewport_size
    assert box and viewport, "Control is not rendered"
    assert box["width"] >= 44 and box["height"] >= 44, box
    assert box["x"] >= -1 and box["y"] >= -1, box
    assert box["x"] + box["width"] <= viewport["width"] + 1, box
    assert box["y"] + box["height"] <= viewport["height"] + 1, box
  return data


def assert_defaults(state: dict[str, Any], mode: str) -> None:
  assert state["mode"] == mode and state["ready"], state
  assert not state["contextLost"], state
  if mode == "night":
    assert state["nightLightsOn"] is True, state
  if mode == "snowstorm":
    assert state["precipitationEnabled"] is True, state
  if mode == "flood":
    assert state["floodDepth"] == 3, state


def run_case(
  playwright: Any,
  browser: Any,
  url: str,
  engine: str,
  mode: str,
  timeout: float,
  output: Path | None,
) -> dict[str, Any]:
  options = (
    playwright.devices["iPhone 13"]
    if engine == "webkit"
    else {"viewport": {"width": 1440, "height": 1000}}
  )
  context = browser.new_context(**options)
  context.add_init_script(PROBE)
  context.add_init_script(STARTUP_PROBE)
  page = context.new_page()
  page.set_default_timeout(timeout * 1000)
  errors: list[str] = []
  requests: list[str] = []
  report: dict[str, Any] = {"engine": engine, "mode": mode, "errors": errors}
  refresh_started = False
  page.on("crash", lambda: errors.append("Browser page crashed"))

  def track_error(message: str) -> None:
    if (
      refresh_started
      and "due to access control checks" in message
      and "/mesh/surrounding-berlin" in message
    ):
      # WebKit calls old-document fetch cancellation an access-control error.
      # Old queued fetches can report after DOMContentLoaded without a network
      # request event. The new document's fetch ledger and resource/request
      # records must all pass assert_gate, so new world fetches cannot hide here.
      report.setdefault("navigationAborts", []).append(message)
    else:
      errors.append(message)

  page.on("pageerror", lambda error: track_error(str(error)))
  page.on(
    "console",
    lambda message: (
      track_error(message.text)
      if message.type == "error" and "interactive-widget" not in message.text
      else None
    ),
  )
  page.on("request", lambda request: requests.append(request.url))
  # The old world can issue a final request after reload's document request but
  # before the new document commits. Only the new document is the startup gate.
  page.on(
    "framenavigated",
    lambda frame: requests.clear() if frame == page.main_frame else None,
  )
  prefix = output / f"{engine}-{mode}" if output else None
  try:
    # Plain visits keep the explicit chooser; valid theme links have their own
    # direct-entry smoke test since v209.
    page.goto(
      startup_url(url, None),
      wait_until="domcontentloaded",
    )
    report["gate"] = assert_gate(page, requests)
    assert page.locator('input[value="day"]').is_checked()
    assert page.get_by_role("button", name=re.compile("Start Berlin")).is_visible()
    assert_controls_reachable(page)
    if prefix:
      page.screenshot(path=f"{prefix}-chooser.png")
    if engine == "webkit" and mode == "day":
      original_viewport = page.viewport_size
      report["smallLayouts"] = []
      for viewport in ({"width": 320, "height": 568}, {"width": 568, "height": 320}):
        page.set_viewport_size(viewport)
        report["smallLayouts"].append(
          {"viewport": viewport, "layout": assert_controls_reachable(page)}
        )
        if prefix:
          page.screenshot(path=f"{prefix}-{viewport['width']}x{viewport['height']}.png")
      page.set_viewport_size(original_viewport)
    # A real selection gesture must not trigger either world or audio loading.
    choose_mode(page, "night" if mode == "day" else "day")
    choose_mode(page, mode)
    report["selectedGate"] = assert_gate(page, requests)
    page.get_by_role("button", name=re.compile("Start Berlin")).click()
    wait_ready(page, mode, timeout)
    state = page.evaluate("window.__readStartupSelection()")
    assert_defaults(state, mode)
    probe = page.evaluate("window.__startupSelection")
    assert probe["modes"] == [mode], probe
    assert_defaults(probe["firstReady"], mode)
    assert page.locator(".startup-mode-selection").count() == 0
    assert page.locator(".three-viewer.is-active canvas").count() == 1
    report["firstReady"] = probe["firstReady"]
    report["final"] = state
    if prefix:
      page.screenshot(path=f"{prefix}-viewer.png")
    # Let bounded surrounding chunks settle before testing refresh. WebKit
    # otherwise reports its navigation-aborted fetches as access-control errors.
    page.wait_for_load_state("networkidle")
    assert not errors, errors
    refresh_started = True
    page.reload(wait_until="domcontentloaded")
    report["refreshGate"] = assert_gate(page, requests)
    assert page.locator('input[value="day"]').is_checked()
    if mode == "day":
      page.goto(startup_url(url, None, "de"), wait_until="domcontentloaded")
      report["germanGate"] = assert_gate(page, requests)
      assert page.get_by_role("button", name=re.compile("Berlin starten")).is_visible()
      assert page.get_by_role("radio", name=re.compile("Normal")).is_checked()
    assert not errors, errors
    report["success"] = True
  except Exception as error:
    report["exception"] = str(error)
    report["requests"] = requests.copy()
    if prefix:
      try:
        page.screenshot(path=f"{prefix}-failure.png")
      except Exception:
        pass
    raise
  finally:
    if prefix:
      Path(f"{prefix}.json").write_text(json.dumps(report, indent=2))
    emit(
      **{key: value for key, value in report.items() if key != "navigationAborts"},
      navigationAbortCount=len(report.get("navigationAborts", [])),
    )
    context.close()
  return report


def main() -> None:
  from playwright.sync_api import sync_playwright

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("all", "chromium", "webkit"), default="all")
  parser.add_argument("--modes", nargs="+", choices=CHOICES, default=MODES)
  parser.add_argument("--timeout", type=float, default=180)
  parser.add_argument("--out", type=Path)
  args = parser.parse_args()
  if urlsplit(args.url).scheme not in {"http", "https"} or args.timeout <= 0:
    parser.error("Provide an HTTP(S) URL and a positive timeout")
  if args.out:
    args.out.mkdir(parents=True, exist_ok=True)
  engines = ("chromium", "webkit") if args.engine == "all" else (args.engine,)
  with sync_playwright() as playwright:
    for engine in engines:
      browser = getattr(playwright, engine).launch(
        **({"channel": "chrome"} if engine == "chromium" else {})
      )
      try:
        for mode in args.modes:
          run_case(playwright, browser, args.url, engine, mode, args.timeout, args.out)
      finally:
        browser.close()
  emit(event="startup-mode-selection-passed", engines=engines, modes=args.modes)


if __name__ == "__main__":
  main()
