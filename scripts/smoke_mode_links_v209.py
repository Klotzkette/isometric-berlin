"""Verify copyable mode links, direct cold starts and subsequent mode switching.

Browser profiles exercise WebKit/Chrome behavior, not physical phone memory.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlsplit

from smoke_mode_continuity import PROBE, select_mode, wait_ready
from smoke_startup_mode_selection import (
  CHOICES,
  STARTUP_PROBE,
  assert_controls_reachable,
  assert_defaults,
  assert_gate,
  choose_mode,
  startup_url,
)


def run(playwright: Any, browser: Any, url: str, engine: str, out: Path) -> None:
  """Exercise real DOM controls and fresh documents without synthetic Start."""
  device = (
    playwright.devices["iPhone 13"]
    if engine == "webkit"
    else {"viewport": {"width": 1440, "height": 1000}}
  )
  links: dict[str, str] = {}
  with browser.new_context(**device) as context:
    context.add_init_script(PROBE)
    context.add_init_script(STARTUP_PROBE)
    # Clipboard rejection must leave a selectable URL and must not launch 3D.
    context.add_init_script(
      "Object.defineProperty(navigator, 'clipboard', {configurable:true, "
      "value:{writeText:async()=>{throw new Error('Clipboard denied')}}});"
    )
    page = context.new_page()
    page.goto(startup_url(url, None), wait_until="domcontentloaded")
    assert_gate(page, [])
    assert_controls_reachable(page)
    for mode in CHOICES:
      choose_mode(page, mode)
      link = page.locator(".startup-mode-sharing a").get_attribute("href")
      assert link
      links[mode] = link
      assert parse_qs(urlsplit(link).query) == {"theme": [mode], "lang": ["en"]}
      assert urlsplit(link).path == urlsplit(url).path
      page.get_by_role("button", name="Copy link", exact=True).click()
      fallback = page.locator(".startup-share-fallback input")
      fallback.wait_for(state="visible")
      assert fallback.input_value() == link
      assert_gate(page, [])
    page.screenshot(path=str(out / f"{engine}-links.png"))
    # Invalid mode parameters don't accidentally start a costly world.
    page.goto(startup_url(url, "invalid"), wait_until="domcontentloaded")
    assert_gate(page, [])

  for mode, link in links.items():
    with browser.new_context(**device) as context:
      context.add_init_script(PROBE)
      context.add_init_script(STARTUP_PROBE)
      page = context.new_page()
      errors: list[str] = []
      page.on("pageerror", lambda error: errors.append(str(error)))
      page.on("crash", lambda: errors.append("Page crashed"))
      page.goto(link, wait_until="domcontentloaded")
      page.locator(".three-viewer").wait_for(state="visible", timeout=180_000)
      assert page.locator(".startup-mode-selection").count() == 0
      wait_ready(page, mode, 180)
      state = page.evaluate("window.__readStartupSelection()")
      assert_defaults(state, mode)
      probe = page.evaluate("window.__startupSelection")
      assert probe["audioContexts"] == 0, probe
      assert probe["modes"] == [mode], probe
      assert not errors, errors
      page.screenshot(path=str(out / f"{engine}-{mode}.png"))
      # A shared mode is an initial state, not a lock on the toolbar.
      changed = "night" if mode == "day" else "day"
      select_mode(page, changed, engine == "webkit")
      wait_ready(page, changed, 180)
      assert page.locator(".startup-mode-selection").count() == 0
      # The viewer's own copied link must carry the NEW mode, not the old query.
      if engine == "chromium":
        page.get_by_role("button", name="Copy view link", exact=True).click()
        page.wait_for_function(
          "mode => new URL(location.href).searchParams.get('theme') === mode",
          arg=changed,
        )
      assert not errors, errors
      print(
        json.dumps(
          {
            "engine": engine,
            "mode": mode,
            "direct": state,
            "switchedTo": changed,
            "errors": errors,
          }
        ),
        flush=True,
      )


def main() -> None:
  """Run one engine serially to keep the local memory workload bounded."""
  from playwright.sync_api import sync_playwright

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("chromium", "webkit"), required=True)
  parser.add_argument("--out", type=Path, required=True)
  args = parser.parse_args()
  args.out.mkdir(parents=True, exist_ok=True)
  with sync_playwright() as playwright:
    with getattr(playwright, args.engine).launch(
      **({"channel": "chrome"} if args.engine == "chromium" else {})
    ) as browser:
      run(playwright, browser, args.url, args.engine, args.out)


if __name__ == "__main__":
  main()
