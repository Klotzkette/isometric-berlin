"""Exercise startup error handling without installing a browser in pytest."""

from __future__ import annotations

import argparse
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/smoke_browser_startup.py"
READY = {
  "ready": True,
  "canvasVisible": True,
  "curtain": False,
  "progress": None,
  "error": None,
}
LOADING = {**READY, "ready": False, "curtain": True, "progress": "Building 75%"}


@pytest.fixture
def smoke_harness(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Any:
  api = ModuleType("playwright.sync_api")
  api.ConsoleMessage = object
  api.Request = object
  api.Response = object
  api.sync_playwright = lambda: None
  monkeypatch.setitem(sys.modules, "playwright", ModuleType("playwright"))
  monkeypatch.setitem(sys.modules, "playwright.sync_api", api)
  spec = importlib.util.spec_from_file_location("startup_smoke_test", SCRIPT)
  assert spec is not None and spec.loader is not None
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)

  class Clock:
    now = 100.0

    def monotonic(self) -> float:
      return self.now

  clock = Clock()
  module.time = SimpleNamespace(monotonic=clock.monotonic, time_ns=lambda: 123)

  class Page:
    def __init__(self) -> None:
      self.callbacks: dict[str, Any] = {}
      self.events: list[tuple[str, Any]] = []
      self.states = [READY]
      self.screenshots: list[str] = []

    def on(self, event: str, callback: Any) -> None:
      self.callbacks[event] = callback

    def goto(self, *_args: Any, **_kwargs: Any) -> None:
      self.emit_state()
      for event, payload in self.events:
        self.callbacks[event](payload)

    def add_init_script(self, script: str) -> None:
      assert "setInterval" in script
      assert module.STATE_MESSAGE_PREFIX in script

    def emit_state(self) -> None:
      state = self.states.pop(0) if len(self.states) > 1 else self.states[0]
      self.callbacks["console"](
        SimpleNamespace(
          type="debug",
          text=module.STATE_MESSAGE_PREFIX + module.json.dumps(state),
        )
      )

    def evaluate(self, _expression: str) -> None:
      pytest.fail("The probe must not grant user activation via page.evaluate")

    def wait_for_timeout(self, milliseconds: float) -> None:
      clock.now += milliseconds / 1000
      self.emit_state()

    def screenshot(self, *, path: str, **_kwargs: Any) -> None:
      self.screenshots.append(path)

  page = Page()
  context = SimpleNamespace(new_page=lambda: page)
  browser = SimpleNamespace(new_context=lambda **_kwargs: context, close=lambda: None)

  class Playwright:
    chromium = SimpleNamespace(launch=lambda **_kwargs: browser)
    webkit = chromium
    devices = {"iPhone 13": {"has_touch": True}}

    def __enter__(self) -> Playwright:
      return self

    def __exit__(self, *_args: Any) -> None:
      pass

  module.sync_playwright = Playwright
  args = argparse.Namespace(
    url="http://localhost:8879/",
    engine="chromium",
    channel=None,
    touch=False,
    timeout=5,
    screenshot=tmp_path / "startup.png",
  )
  return SimpleNamespace(run=lambda: module.smoke(args), page=page, args=args)


def test_console_glyph_exception_fails_without_pageerror(smoke_harness: Any) -> None:
  message = 'Isometric Berlin 3D: The drawn alphabet has no glyph for "Ä"'
  smoke_harness.page.events = [
    ("console", SimpleNamespace(type="error", text=message, location={}))
  ]
  result = smoke_harness.run()
  assert result["success"] is False
  assert result["counts"]["pageErrors"] == 0
  assert result["counts"]["consoleErrors"] == 1
  assert result["consoleErrors"][0]["text"] == message
  assert result["screenshot"]


def test_transient_ready_then_startup_curtain_does_not_pass(smoke_harness: Any) -> None:
  smoke_harness.page.states = [READY, LOADING]
  result = smoke_harness.run()
  assert result["success"] is False
  assert "Timed out" in result["failure"]
  assert result["state"]["curtain"] is True


def test_blocked_audio_start_warning_fails_even_with_a_ready_scene(
  smoke_harness: Any,
) -> None:
  message = (
    "The AudioContext was not allowed to start. It must be resumed (or created) "
    "after a user gesture on the page."
  )
  smoke_harness.page.events = [
    ("console", SimpleNamespace(type="warning", text=message, location={}))
  ]
  result = smoke_harness.run()
  assert result["success"] is False
  assert result["state"]["ready"] is True
  assert result["consoleErrors"][0]["type"] == "warning"
  assert result["consoleErrors"][0]["text"] == message


def test_critical_http_failure_does_not_pass(smoke_harness: Any) -> None:
  smoke_harness.page.events = [
    (
      "response",
      SimpleNamespace(
        status=404,
        url="http://localhost:8879/assets/ThreeViewer-missing.js",
        request=SimpleNamespace(resource_type="script"),
      ),
    )
  ]
  result = smoke_harness.run()
  assert result["success"] is False
  assert result["counts"]["failedCriticalRequests"] == 1
  assert result["failedCriticalRequests"][0]["status"] == 404


def test_stable_ready_canvas_passes(smoke_harness: Any) -> None:
  smoke_harness.page.states = [LOADING, READY]
  smoke_harness.args.touch = True
  result = smoke_harness.run()
  assert result["success"] is True
  assert result["state"] == READY
  assert result["elapsedSeconds"] >= 3
  assert result["counts"] == {
    "responses": 0,
    "pageErrors": 0,
    "consoleErrors": 0,
    "consoleAdvisories": 0,
    "failedCriticalRequests": 0,
  }
  assert result["screenshot"]


def test_exact_webkit_viewport_advisory_is_reported_without_failure(
  smoke_harness: Any,
) -> None:
  smoke_harness.page.events = [
    (
      "console",
      SimpleNamespace(
        type="error",
        text='Viewport argument key "interactive-widget" not recognized and ignored.',
        location={},
      ),
    )
  ]
  result = smoke_harness.run()
  assert result["success"] is True
  assert result["counts"]["consoleErrors"] == 0
  assert result["counts"]["consoleAdvisories"] == 1
