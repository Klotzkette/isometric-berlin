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
from smoke_mode_continuity import launch_startup_mode

MODES = ("Tag", "Nacht", "Minecraft", "Schneesturm", "Schwellenraum", "Versunken")
MODE_TRANSITIONS = (
  "Nacht",
  "Schneesturm",
  "Schwellenraum",
  "Minecraft",
  "Versunken",
  "Tag",
)
FLOOD_DEPTHS = (3, 6, 21)
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


def start_day_viewer(page: Page) -> None:
  """Launch via real taps on first visit and reload before checking the menu."""
  launch_startup_mode(page, "day", touch=True)
  page.locator(".three-viewer.is-active.is-presentation-ready").wait_for(timeout=120000)


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


def check_flood_depths(page: Page, selected: int) -> None:
  """Keep every depth reachable and require exactly the selected pressed state."""
  group = page.locator(".mobile-flood-depth-control")
  states = group.locator("button").evaluate_all(
    f"elements => elements.map({BUTTON_STATE})"
  )
  assert [state["text"] for state in states] == [f"{d} m" for d in FLOOD_DEPTHS], states
  for state in states:
    assert state["inside"] and state["hittable"], state
    assert state["width"] >= 44 and state["height"] >= 44, state
  assert group.locator('[aria-pressed="true"]').all_text_contents() == [f"{selected} m"]


def finish_mode_selection(page: Page, mode: str) -> None:
  """Flood keeps its controls open; every other mode must close the sheet itself."""
  sheet = page.locator(".mobile-overflow-sheet")
  if mode == "Versunken":
    sheet.wait_for(state="visible")
    check_modes(page, mode)
    check_flood_depths(page, 3)
    buttons = page.locator(".mobile-flood-depth-control").locator("button")
    for depth in (6, 21, 3):
      buttons.nth(FLOOD_DEPTHS.index(depth)).tap()
      # Chrome can return from tap during the 80 ms pressed-scale feedback.
      # Measure the settled target without relaxing its 44 px requirement.
      page.wait_for_function(
        """() => [...document.querySelectorAll('.mobile-flood-depth-control button')]
          .every(button => !button.matches(':active') &&
            !button.getAnimations().some(animation => animation.playState === 'running'))""",
        timeout=5000,
      )
      check_flood_depths(page, depth)
      check_modes(page, mode)
      assert sheet.is_visible(), "Depth taps must keep the Flood controls open"
    page.locator(".mobile-sheet-title button").tap()
  sheet.wait_for(state="hidden")


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
  sources = page.locator(".sources-dialog")
  assert not sources.is_visible(), (
    "A fresh visitor must not see automatic source credits"
  )
  opener = page.locator(".mobile-overflow")
  for width, height in ((390, 664), (568, 320)):
    page.set_viewport_size({"width": width, "height": height})
    opener.tap()
    source_button = page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Quellen & Lizenzen", exact=True
    )
    source_button.scroll_into_view_if_needed()
    state = source_button.evaluate(BUTTON_STATE)
    assert state["inside"] and state["hittable"], state
    source_button.tap()
    sources.wait_for(state="visible")
    assert page.locator(".mobile-overflow-grid").count() == 0
    credits = sources.locator(".sources-attribution")
    assert credits.is_visible()
    text = credits.inner_text()
    for credit in (
      "© OpenStreetMap contributors",
      "Geoportal Berlin (dl-de/zero-2-0)",
      "Wikimedia Commons/Wikipedia",
      "Kindertransport visual references: © Pauline Ahrens, 2021",
      "Bildhauerei in Berlin (CC BY 4.0)",
    ):
      assert credit in text
    sources.get_by_role("button", name="Quellen schließen", exact=True).tap()
    sources.wait_for(state="hidden")

    opener.tap()
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Sehenswürdigkeiten", exact=True
    ).tap()
    rail = page.locator(".landmark-rail")
    sight = rail.get_by_role("button", name="Sehenswürdigkeit: Siegessäule", exact=True)
    sight.scroll_into_view_if_needed()
    assert not sources.is_visible()
    state = sight.evaluate(BUTTON_STATE)
    assert state["inside"] and state["hittable"], state
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
    opener.tap()
    source_button.scroll_into_view_if_needed()
    source_button.tap()
    sources.wait_for(state="visible")
    assert rail.count() == 0, "Opening source credits must close the compact rail"
    page.keyboard.press("Escape")
    sources.wait_for(state="hidden")
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
    start_day_viewer(page)
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

    # The mode opener is a separate viewport control, including while the
    # chrome is hidden and after an iPhone orientation change.
    for width, height in ((390, 664), (568, 320)):
      page.set_viewport_size({"width": width, "height": height})
      page.locator(".chrome-toggle").tap()
      page.wait_for_timeout(220)
      assert page.locator(".app-shell--chrome-hidden").count() == 1
      state = opener.evaluate(BUTTON_STATE)
      assert state["inside"] and state["hittable"], state
      opener.tap()
      check_modes(page)
      assert page.locator(".app-shell--chrome-hidden").count() == 0
      page.locator(".mobile-sheet-title button").tap()
    emit(event="hidden-chrome-menu-passed", engine=engine)
    page.set_viewport_size({"width": 390, "height": 664})
    selected = "Tag"
    for mode in MODE_TRANSITIONS:
      opener.tap()
      check_modes(page, selected)
      page.locator(".mobile-visual-mode-grid").get_by_role(
        "button", name=mode, exact=True
      ).tap()
      finish_mode_selection(page, mode)
      page.locator(".three-viewer.is-active.is-presentation-ready").wait_for(
        timeout=120000
      )
      opener.tap()
      check_modes(page, mode)
      if mode == "Versunken":
        check_flood_depths(page, 3)
      lights = page.locator(".mobile-light-toggle")
      if lights.count():
        state = lights.evaluate(BUTTON_STATE)
        assert state["inside"] and state["hittable"], state
        previous = lights.get_attribute("aria-pressed")
        lights.tap()
        assert lights.get_attribute("aria-pressed") != previous
        lights.tap()
        assert lights.get_attribute("aria-pressed") == previous
        if mode == "Nacht":
          for width, height in ((568, 320), (320, 568), (844, 390)):
            page.set_viewport_size({"width": width, "height": height})
            check_modes(page, mode)
            state = lights.evaluate(BUTTON_STATE)
            assert state["inside"] and state["hittable"], state
            assert page.locator(".mobile-overflow-grid").bounding_box()["height"] >= 60
            if screenshots:
              page.screenshot(
                path=str(screenshots / f"{engine}-night-{width}x{height}.png")
              )
          page.set_viewport_size({"width": 390, "height": 664})
      page.locator(".mobile-sheet-backdrop").tap(position={"x": 4, "y": 150})
      assert opener.get_attribute("aria-expanded") == "false"
      selected = mode
      emit(event="mode-passed", engine=engine, mode=mode)
    assert not errors, errors
    assert page.locator(".three-viewer-error.is-active").count() == 0
    page.reload()
    start_day_viewer(page)
    page.locator(".mobile-overflow").wait_for()
    assert not page.locator(".sources-dialog").is_visible()
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
