"""Keep the browser menu probe strict about clipped and blocked touch targets."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from typing import Any

import pytest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/smoke_mobile_menu.py"


@pytest.fixture
def menu_probe(monkeypatch: pytest.MonkeyPatch) -> Any:
  api = ModuleType("playwright.sync_api")
  api.Page = object
  api.sync_playwright = lambda: None
  monkeypatch.setitem(sys.modules, "playwright", ModuleType("playwright"))
  monkeypatch.setitem(sys.modules, "playwright.sync_api", api)
  monkeypatch.syspath_prepend(str(SCRIPT.parent))
  spec = importlib.util.spec_from_file_location("mobile_menu_smoke_test", SCRIPT)
  assert spec and spec.loader
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  states = [
    {"text": mode, "inside": True, "hittable": True, "width": 52, "height": 60}
    for mode in module.MODES
  ]
  selected = ["Tag"]
  buttons = SimpleNamespace(
    evaluate_all=lambda _expression: states,
    all_text_contents=lambda: selected,
  )
  group = SimpleNamespace(locator=lambda _selector: buttons)
  page = SimpleNamespace(locator=lambda _selector: group)
  return SimpleNamespace(
    check=lambda selected_mode="Tag": module.check_modes(page, selected_mode),
    transitions=module.MODE_TRANSITIONS,
    module=module,
    first_visit=module.check_first_visit_navigation,
    start=module.start_day_viewer,
    states=states,
    selected=selected,
  )


def test_all_six_visible_touch_targets_pass(menu_probe: Any) -> None:
  assert [state["text"] for state in menu_probe.states] == [
    "Tag",
    "Nacht",
    "Minecraft",
    "Schneesturm",
    "Schwellenraum",
    "Versunken",
  ]
  assert menu_probe.check() == menu_probe.states


@pytest.mark.parametrize(
  ("property_name", "invalid_value"),
  [("inside", False), ("hittable", False), ("width", 43), ("height", 43)],
)
def test_clipped_blocked_or_small_mode_button_fails(
  menu_probe: Any, property_name: str, invalid_value: object
) -> None:
  menu_probe.states[-1][property_name] = invalid_value
  with pytest.raises(AssertionError):
    menu_probe.check()


def test_absent_mode_fails_even_when_remaining_buttons_are_visible(
  menu_probe: Any,
) -> None:
  menu_probe.states.pop()
  with pytest.raises(AssertionError):
    menu_probe.check()


def test_incorrect_selected_mode_fails(menu_probe: Any) -> None:
  menu_probe.selected[:] = ["Nacht"]
  with pytest.raises(AssertionError):
    menu_probe.check()


def test_first_visit_cannot_silently_skip_expanded_source_credits(
  menu_probe: Any,
) -> None:
  attribution = SimpleNamespace(get_attribute=lambda _name: "false")
  page = SimpleNamespace(locator=lambda _selector: attribution)
  with pytest.raises(AssertionError, match="fresh visitor must see source credits"):
    menu_probe.first_visit(page, None)


def test_first_visit_and_reload_use_start_taps_before_waiting_for_canvas(
  menu_probe: Any,
) -> None:
  events: list[str] = []
  selected = "night"
  visible = True

  class Locator:
    def __init__(self, selector: str) -> None:
      self.selector = selector

    def locator(self, selector: str) -> Locator:
      return self if selector == ".." else Locator(selector)

    def is_visible(self) -> bool:
      return visible

    def is_checked(self) -> bool:
      return selected == "day"

    def tap(self) -> None:
      nonlocal selected, visible
      events.append(self.selector)
      if self.selector == ".startup-launch":
        visible = False
      else:
        assert self.selector == 'input[name="startup-mode"][value="day"]'
        selected = "day"

    def click(self) -> None:
      pytest.fail("Mobile startup must use real taps")

    def wait_for(self, *, timeout: int) -> None:
      assert timeout == 120000
      assert visible is False, "Never await a canvas behind the startup gate"
      events.append(self.selector)

  page = SimpleNamespace(
    locator=Locator,
    wait_for_function=lambda *_args, **_kwargs: None,
  )
  menu_probe.start(page)
  ready = ".three-viewer.is-active.is-presentation-ready"
  assert events == ['input[name="startup-mode"][value="day"]', ".startup-launch", ready]
  # Reload shows the gate again; the persisted Day choice needs only launch.
  visible = True
  events.clear()
  menu_probe.start(page)
  assert events == [".startup-launch", ready]
  # Calling on a running viewer does not restart it or add activation.
  events.clear()
  menu_probe.start(page)
  assert events == [ready]


def test_flood_is_selected_and_visited_in_the_real_mode_switch_cycle(
  menu_probe: Any,
) -> None:
  menu_probe.selected[:] = ["Versunken"]
  assert menu_probe.check("Versunken") == menu_probe.states
  assert menu_probe.transitions == (
    "Nacht",
    "Schneesturm",
    "Schwellenraum",
    "Minecraft",
    "Versunken",
    "Tag",
  )
  assert set(menu_probe.transitions) == {state["text"] for state in menu_probe.states}


@pytest.fixture
def flood_probe(menu_probe: Any, monkeypatch: pytest.MonkeyPatch) -> Any:
  selected = ["3 m"]
  states = [
    {"text": f"{depth} m", "inside": True, "hittable": True, "width": 52, "height": 44}
    for depth in (3, 6, 21)
  ]
  taps: list[str] = []
  waits: list[str] = []
  settled_taps: list[str] = []
  visible = True
  stuck = False

  class Locator:
    def __init__(self, selector: str = "", index: int | None = None) -> None:
      self.selector = selector
      self.index = index

    def locator(self, selector: str) -> Locator:
      return Locator(selector)

    def nth(self, index: int) -> Locator:
      return Locator(self.selector, index)

    def evaluate_all(self, _expression: str) -> list[dict]:
      return states

    def all_text_contents(self) -> list[str]:
      return selected

    def is_visible(self) -> bool:
      return visible

    def wait_for(self, *, state: str) -> None:
      waits.append(state)
      assert visible == (state == "visible"), "Unexpected menu closure state"

    def tap(self) -> None:
      nonlocal visible
      if self.selector == ".mobile-sheet-title button":
        taps.append("close")
        visible = False
      else:
        assert self.index is not None
        label = states[self.index]["text"]
        taps.append(label)
        if not stuck:
          selected[:] = [label]

  page = SimpleNamespace(
    locator=Locator,
    wait_for_function=lambda _expression, **_kwargs: settled_taps.append(taps[-1]),
  )
  monkeypatch.setattr(menu_probe.module, "check_modes", lambda _page, _mode: None)

  def set_visible(value: bool) -> None:
    nonlocal visible
    visible = value

  def set_stuck() -> None:
    nonlocal stuck
    stuck = True

  return SimpleNamespace(
    check=lambda depth: menu_probe.module.check_flood_depths(page, depth),
    finish=lambda mode="Versunken": menu_probe.module.finish_mode_selection(page, mode),
    states=states,
    selected=selected,
    taps=taps,
    waits=waits,
    settled_taps=settled_taps,
    set_visible=set_visible,
    set_stuck=set_stuck,
  )


def test_flood_depth_taps_keep_controls_open_until_explicit_close(
  flood_probe: Any,
) -> None:
  flood_probe.finish()
  assert flood_probe.taps == ["6 m", "21 m", "3 m", "close"]
  assert flood_probe.selected == ["3 m"]
  assert flood_probe.waits == ["visible", "hidden"]
  assert flood_probe.settled_taps == ["6 m", "21 m", "3 m"]


@pytest.mark.parametrize(
  ("property_name", "invalid_value"),
  [("inside", False), ("hittable", False), ("width", 43), ("height", 43)],
)
def test_flood_depths_reject_unreachable_or_small_targets(
  flood_probe: Any, property_name: str, invalid_value: object
) -> None:
  flood_probe.states[2][property_name] = invalid_value
  with pytest.raises(AssertionError):
    flood_probe.check(3)


def test_flood_depth_tap_must_update_pressed_state(flood_probe: Any) -> None:
  flood_probe.set_stuck()
  with pytest.raises(AssertionError):
    flood_probe.finish()
  assert flood_probe.taps == ["6 m"]


def test_ordinary_modes_cannot_pass_with_a_sheet_left_open(flood_probe: Any) -> None:
  with pytest.raises(AssertionError, match="closure state"):
    flood_probe.finish("Nacht")
  assert flood_probe.taps == []
  flood_probe.set_visible(False)
  flood_probe.finish("Nacht")
  assert flood_probe.taps == []
