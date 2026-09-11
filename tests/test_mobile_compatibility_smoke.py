"""Validate the browser smoke's argument guard without starting a browser."""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType

import pytest


@pytest.fixture
def smoke(monkeypatch: pytest.MonkeyPatch) -> ModuleType:
  scripts = Path(__file__).resolve().parents[1] / "scripts"
  monkeypatch.syspath_prepend(str(scripts))
  spec = importlib.util.spec_from_file_location(
    "mobile_compatibility_test", scripts / "smoke_mobile_compatibility.py"
  )
  assert spec and spec.loader
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


@pytest.mark.parametrize(
  "args",
  [
    ["file:///tmp/index.html", "--engine", "webkit"],
    ["https://example.test/", "--engine", "chromium", "--timeout", "0"],
  ],
)
def test_rejects_unservable_urls_and_unbounded_timeouts(
  smoke: ModuleType, monkeypatch: pytest.MonkeyPatch, args: list[str]
) -> None:
  monkeypatch.setattr(sys, "argv", ["smoke_mobile_compatibility", *args])
  with pytest.raises(SystemExit) as error:
    smoke.main()
  assert error.value.code == 2


def test_selects_distinct_safari_and_android_devices(smoke: ModuleType) -> None:
  assert smoke.browser_profile("webkit") == "iPhone SE"
  assert smoke.browser_profile("chromium") == "Pixel 5"
