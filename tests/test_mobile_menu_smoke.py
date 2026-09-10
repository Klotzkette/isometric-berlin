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
    check=lambda: module.check_modes(page),
    first_visit=module.check_first_visit_navigation,
    states=states,
    selected=selected,
  )


def test_all_five_visible_touch_targets_pass(menu_probe: Any) -> None:
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
