"""Verify that first-key audio activation does not cancel held navigation.

uv run --with playwright python scripts/smoke_keyboard_audio.py URL
Fresh Chrome contexts exercise orbit and flight separately, without a preceding
click. Playback must start, motion must continue across audio-state updates, and
releasing the key must stop the movement. This is an input check, not an FPS test.
"""

from __future__ import annotations

import argparse
import math
from typing import Any

from profile_viewer_motion import start_url
from smoke_mode_continuity import PROBE, emit, wait_ready


def displacement(a: dict[str, Any], b: dict[str, Any]) -> float:
  return math.dist(a["position"], b["position"])


def assert_continuous_motion(samples: list[dict[str, Any]]) -> list[float]:
  distances = [displacement(a, b) for a, b in zip(samples, samples[1:])]
  assert distances and min(distances) > 0.5, {
    "failure": "Held navigation stopped during audio activation",
    "distances": distances,
  }
  return distances


def main() -> None:
  from playwright.sync_api import sync_playwright

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  args = parser.parse_args()
  with sync_playwright() as p:
    browser = p.chromium.launch(
      channel="chrome", args=["--autoplay-policy=user-gesture-required"]
    )
    try:
      for key in ("ArrowRight", "w"):
        context = browser.new_context(viewport={"width": 1440, "height": 900})
        context.add_init_script(PROBE)
        page = context.new_page()
        page.set_default_timeout(120_000)
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on(
          "console",
          lambda message: (
            errors.append(message.text)
            if "AudioContext was not allowed" in message.text
            else None
          ),
        )
        page.goto(start_url(args.url, "kanzleramt"))
        wait_ready(page, "day", 120)
        emit(key=key, stage="ready")
        page.wait_for_timeout(12_000)
        soundtrack = page.locator(".soundtrack-toggle").first
        assert soundtrack.get_attribute("aria-pressed") == "false"
        page.locator(".three-viewer.is-active canvas").focus()
        samples = [page.evaluate("window.__readModeContinuity()")]
        page.keyboard.down(key)
        try:
          for _ in range(4):
            page.wait_for_timeout(800)
            samples.append(page.evaluate("window.__readModeContinuity()"))
          distances = assert_continuous_motion(samples)
          assert soundtrack.get_attribute("aria-pressed") == "true"
        finally:
          page.keyboard.up(key)
        page.wait_for_timeout(1200)
        stopped = page.evaluate("window.__readModeContinuity()")
        page.wait_for_timeout(800)
        drift = displacement(stopped, page.evaluate("window.__readModeContinuity()"))
        assert drift < 0.05, {"releaseDriftM": drift}
        assert not errors, errors
        emit(key=key, continuousDistancesM=distances, releaseDriftM=drift, passed=True)
        context.close()
    finally:
      browser.close()


if __name__ == "__main__":
  main()
