"""Exercise the compact mode menu with real browser taps and native scrolling.

Run without changing project dependencies:
  uv run --with playwright python scripts/smoke_mobile_menu.py URL --engine chromium
  uv run --with playwright python scripts/smoke_mobile_menu.py URL --engine webkit

Chromium uses installed Chrome and tests actual touch-drag scrolling. WebKit
checks touch taps and scroll-container layout. Neither emulates physical iPhone GPU
performance. Screenshots are written only when --screenshots is supplied.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.sync_api import Page, sync_playwright

MODES = ("Tag", "Nacht", "Minecraft", "Schneesturm", "Schwellenraum")
VIEWPORTS = ((390, 664), (320, 568), (844, 390), (568, 320), (1024, 768))
BUTTON_STATE = """element => {
  const rect = element.getBoundingClientRect();
  const sheet = element.closest('.mobile-sheet')?.getBoundingClientRect();
  const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
  return {
    text: element.innerText,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    left: rect.left,
    inside: rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth &&
      rect.bottom <= innerHeight && (!sheet ||
      (rect.top >= sheet.top && rect.bottom <= sheet.bottom)),
    hittable: !!hit && (hit === element || element.contains(hit)),
  };
}"""


def emit(**value: object) -> None:
  print(json.dumps(value, ensure_ascii=False), flush=True)


def check_modes(page: Page, selected: str = "Tag") -> list[dict]:
  group = page.locator(".mobile-visual-mode-grid")
  states = group.locator("button").evaluate_all(
    f"elements => elements.map({BUTTON_STATE})"
  )
  assert tuple(state["text"] for state in states) == MODES, states
  for state in states:
    assert state["inside"] and state["hittable"], state
    assert state["width"] >= 44 and state["height"] >= 44, state
  assert group.locator('[aria-pressed="true"]').all_text_contents() == [selected]
  return states


def check_scroll(page: Page, chromium: bool) -> None:
  sheet = page.locator(".mobile-overflow-sheet")
  actions = sheet.locator(".mobile-overflow-grid")
  before = check_modes(page)
  actions.locator("button").last.scroll_into_view_if_needed()
  assert actions.evaluate("el => el.scrollTop") > 0
  assert check_modes(page) == before, (
    "Mode row moved out of reach when actions scrolled"
  )
  if chromium:
    # A downward finger drag scrolls back toward earlier actions; the old
    # touchend handler dismissed the sheet for every drag above 48 px.
    session = page.context.new_cdp_session(page)
    rect = actions.bounding_box()
    assert rect and rect["height"] >= 85, rect
    x, y = rect["x"] + rect["width"] / 2, rect["y"] + 5
    start_scroll = actions.evaluate("el => el.scrollTop")
    session.send(
      "Input.dispatchTouchEvent",
      {"type": "touchStart", "touchPoints": [{"x": x, "y": y}]},
    )
    for step in range(1, 9):
      session.send(
        "Input.dispatchTouchEvent",
        {"type": "touchMove", "touchPoints": [{"x": x, "y": y + step * 10}]},
      )
      page.wait_for_timeout(25)
    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    session.detach()
    assert sheet.count() == 1, "Native scrolling incorrectly dismissed the mode menu"
    page.wait_for_function(
      "([selector, start]) => document.querySelector(selector).scrollTop < start",
      arg=[".mobile-overflow-grid", start_scroll],
    )
    check_modes(page)


def check_first_visit_navigation(page: Page, screenshots: Path | None) -> None:
  attribution = page.locator(".attribution-toggle")
  assert attribution.get_attribute("aria-expanded") == "true", (
    "A fresh visitor must see source credits, including under React StrictMode"
  )
  assert page.locator(".attribution-copy").is_visible()
  opener = page.locator(".mobile-overflow")
  for width, height in ((390, 664), (568, 320)):
    page.set_viewport_size({"width": width, "height": height})
    if attribution.get_attribute("aria-expanded") != "true":
      attribution.tap()
    opener.tap()
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Sehenswürdigkeiten", exact=True
    ).tap()
    rail = page.locator(".landmark-rail")
    sight = rail.get_by_role("button", name="Sehenswürdigkeit: Siegessäule", exact=True)
    sight.scroll_into_view_if_needed()
    assert attribution.get_attribute("aria-expanded") == "false"
    state = sight.evaluate(BUTTON_STATE)
    assert state["inside"] and state["hittable"], state
    rail_box, credit_box = rail.bounding_box(), attribution.bounding_box()
    assert rail_box and credit_box
    assert rail_box["y"] + rail_box["height"] <= credit_box["y"], (
      "The source-credit toggle must not cover the landmark list"
    )
    if screenshots:
      screenshots.mkdir(parents=True, exist_ok=True)
      page.screenshot(path=str(screenshots / f"landmarks-{width}x{height}.png"))
    sight.tap()
    assert rail.count() == 0
    assert "Siegessäule" in page.locator(".brand-mobile strong").inner_text()

    opener.tap()
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Sehenswürdigkeiten", exact=True
    ).tap()
    rail.wait_for()
    attribution.tap()
    assert attribution.get_attribute("aria-expanded") == "true"
    assert rail.count() == 0, "Opening source credits must close the compact rail"
    emit(event="first-visit-navigation-passed", width=width, height=height)


def run(url: str, engine: str, screenshots: Path | None) -> None:
  parts = urlsplit(url)
  query = dict(parse_qsl(parts.query))
  query.update(lang="de", theme="day")
  url = urlunsplit(parts._replace(query=urlencode(query)))
  errors: list[str] = []
  with sync_playwright() as playwright:
    browser = getattr(playwright, engine).launch(
      **({"channel": "chrome"} if engine == "chromium" else {})
    )
    context = browser.new_context(**playwright.devices["iPhone 13"])
    page = context.new_page()
    page.set_default_timeout(30000)
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(url)
    page.locator(".three-viewer.is-active.is-presentation-ready").wait_for(
      timeout=120000
    )
    check_first_visit_navigation(page, screenshots)
    opener = page.locator(".mobile-overflow")
    for width, height in VIEWPORTS:
      page.set_viewport_size({"width": width, "height": height})
      state = opener.evaluate(BUTTON_STATE)
      assert state["inside"] and state["hittable"], state
      assert state["left"] < width / 3, "Compact mode menu must remain at bottom-left"
      assert state["top"] > height / 2, state
      opener.tap()
      check_modes(page)
      if (width, height) == VIEWPORTS[0]:
        check_scroll(page, engine == "chromium")
      if screenshots:
        screenshots.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(screenshots / f"{engine}-{width}x{height}.png"))
      page.locator(".mobile-sheet-title button").tap()
      assert opener.get_attribute("aria-expanded") == "false"
      emit(event="layout-passed", engine=engine, width=width, height=height)

    page.set_viewport_size({"width": 390, "height": 664})
    selected = "Tag"
    for mode in ("Nacht", "Schneesturm", "Schwellenraum", "Minecraft", "Tag"):
      opener.tap()
      check_modes(page, selected)
      page.locator(".mobile-visual-mode-grid").get_by_role(
        "button", name=mode, exact=True
      ).tap()
      assert page.locator(".mobile-overflow-sheet").count() == 0
      page.locator(".three-viewer.is-active.is-presentation-ready").wait_for(
        timeout=120000
      )
      opener.tap()
      check_modes(page, mode)
      page.locator(".mobile-sheet-backdrop").tap(position={"x": 4, "y": 150})
      assert opener.get_attribute("aria-expanded") == "false"
      selected = mode
      emit(event="mode-passed", engine=engine, mode=mode)
    assert not errors, errors
    assert page.locator(".three-viewer-error.is-active").count() == 0
    page.reload()
    page.locator(".mobile-overflow").wait_for()
    assert page.locator(".attribution-toggle").get_attribute("aria-expanded") == "false"
    browser.close()
  emit(event="passed", engine=engine, layouts=len(VIEWPORTS), modes=len(MODES))


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  parser.add_argument("--screenshots", type=Path)
  args = parser.parse_args()
  run(args.url, args.engine, args.screenshots)


if __name__ == "__main__":
  main()
