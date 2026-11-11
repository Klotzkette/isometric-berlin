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


def test_all_five_visible_touch_targets_pass(menu_probe: Any) -> None:
  assert [state["text"] for state in menu_probe.states] == [
    "Tag",
    "Nacht",
    "Minecraft",
    "Schneesturm",
    "Schwellenraum",
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


def test_first_visit_rejects_automatically_expanded_source_credits(
  menu_probe: Any,
) -> None:
  attribution = SimpleNamespace(is_visible=lambda: True)
  page = SimpleNamespace(locator=lambda _selector: attribution)
  with pytest.raises(
    AssertionError, match="fresh visitor must not see automatic source credits"
  ):
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


def test_all_public_modes_are_visited_in_the_mode_switch_cycle(
  menu_probe: Any,
) -> None:
  assert menu_probe.transitions == (
    "Nacht",
    "Schneesturm",
    "Schwellenraum",
    "Minecraft",
    "Tag",
  )
  assert set(menu_probe.transitions) == {state["text"] for state in menu_probe.states}
