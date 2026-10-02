"""Cold-start evidence must reject incomplete loading and recovered crashes."""

from __future__ import annotations

import copy
import sys
from pathlib import Path
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_cold_start import (  # noqa: E402
  STARTUP_GROUPS,
  failure_reasons,
  memory_totals,
  parse_args,
  summarize_report,
)


@pytest.fixture
def complete_report() -> dict[str, Any]:
  sample = {
    "wallSeconds": 20,
    "pollStartedSeconds": 19.9,
    "ready": True,
    "runtime": 1,
    "mode": "day",
    "contextCount": 1,
    "state": {
      "isoReady": True,
      "openingDetailReady": True,
      "progressive": "complete",
      "pendingAttachments": 0,
      "surroundingManifest": True,
      "surroundingPending": False,
      **dict.fromkeys(STARTUP_GROUPS, 2),
    },
    "buffers": {"bytes": 200, "peak": 300, "lost": 0},
    "renderer": {"lost": False, "render": {"frame": 12}},
    "heapUsage": {"usedSize": 80, "backingStorageSize": 20},
    "memory": {"usedJSHeapSize": 100},
    "decodedBodySize": 250,
  }
  return {
    "samples": [sample],
    "navigations": [{"url": "https://example.org"}],
    "errors": [],
  }


def test_complete_cold_day_with_one_runtime_passes(
  complete_report: dict[str, Any],
) -> None:
  report = complete_report
  loading = copy.deepcopy(report["samples"][0])
  loading.update(
    ready=False, runtime=None, state=None, wallSeconds=1, pollStartedSeconds=0.9
  )
  report["samples"].insert(0, loading)
  assert failure_reasons(report) == []
  assert summarize_report(report)["firstReadySeconds"] == 20


def test_memory_peaks_sum_only_simultaneous_samples(
  complete_report: dict[str, Any],
) -> None:
  report = complete_report
  second = copy.deepcopy(report["samples"][0])
  second["heapUsage"] = {"usedSize": 20, "backingStorageSize": 90}
  report["samples"].append(second)
  # Deliberately enormous after-GC data must never contaminate normal peaks.
  report["afterGcSample"] = {"heapUsage": {"usedSize": 999, "backingStorageSize": 999}}
  summary = summarize_report(report)
  assert summary["peakJSHeapUsedBytes"] == 80
  assert summary["peakJSBackingStorageBytes"] == 90
  assert summary["peakJSCombinedBytes"] == 110
  assert summary["sumOfComponentPeaksBytes"] == 170
  assert summary["finalMemoryTotals"]["combinedBytes"] == 110
  assert summary["peakGpuBufferBytes"] == 300
  assert summary["maxDecodedBytes"] == 250


def test_missing_browser_memory_is_null_not_zero(
  complete_report: dict[str, Any],
) -> None:
  sample = complete_report["samples"][0]
  sample.pop("heapUsage")
  sample["memory"] = None
  summary = summarize_report(complete_report)
  assert summary["peakJSHeapUsedBytes"] is None
  assert summary["peakJSBackingStorageBytes"] is None
  assert summary["peakJSCombinedBytes"] is None
  assert summary["sumOfComponentPeaksBytes"] is None
  assert summary["peakPerformanceMemoryUsedBytes"] is None
  assert failure_reasons(complete_report) == []
  assert memory_totals({"heapUsage": {"usedSize": 0, "backingStorageSize": 0}}) == {
    "usedBytes": 0,
    "backingStorageBytes": 0,
    "combinedBytes": 0,
  }
  assert memory_totals({"heapUsage": {"usedSize": 50}})["combinedBytes"] is None


@pytest.mark.parametrize(
  "recovery", ["reload", "runtime", "context", "lost", "renderer"]
)
def test_recovery_cannot_hide_startup_failure(
  complete_report: dict[str, Any], recovery: str
) -> None:
  report = complete_report
  old = copy.deepcopy(report["samples"][0])
  if recovery == "reload":
    report["navigations"].append({"url": "https://example.org"})
  elif recovery == "runtime":
    old["runtime"] = 2
  elif recovery == "context":
    old["contextCount"] = 2
  elif recovery == "lost":
    old["buffers"]["lost"] = 1
  else:
    old["renderer"]["lost"] = True
  report["samples"].insert(0, old)
  assert failure_reasons(report)


@pytest.mark.parametrize(
  "missing",
  [
    "world",
    "opening",
    "progressive",
    "attachment",
    "park",
    "surrounding",
    "manifest",
    "buffers",
    "frame",
  ],
)
def test_ready_flag_does_not_mask_missing_startup_layers(
  complete_report: dict[str, Any], missing: str
) -> None:
  sample = complete_report["samples"][0]
  state = sample["state"]
  if missing == "world":
    state["isoReady"] = False
  elif missing == "opening":
    state["openingDetailReady"] = False
  elif missing == "progressive":
    state["progressive"] = "loading"
  elif missing == "attachment":
    state["pendingAttachments"] = 1
  elif missing == "park":
    state["park"] = 0
  elif missing == "surrounding":
    state["surroundingPending"] = True
  elif missing == "manifest":
    state["surroundingManifest"] = False
  elif missing == "buffers":
    sample["buffers"]["bytes"] = 0
  else:
    sample["renderer"]["render"]["frame"] = 0
  assert failure_reasons(complete_report)


def test_transient_ready_and_errors_still_fail(complete_report: dict[str, Any]) -> None:
  loading = copy.deepcopy(complete_report["samples"][0])
  loading["ready"] = False
  complete_report["samples"].append(loading)
  complete_report["errors"].append("Browser page crashed")
  failures = failure_reasons(complete_report)
  assert "Browser page crashed" in failures
  assert any("regressed" in reason for reason in failures)
  assert any("not ready" in reason for reason in failures)


def test_no_samples_is_failure_with_unknown_memory() -> None:
  report = {"samples": [], "errors": []}
  assert failure_reasons(report)
  summary = summarize_report(report)
  assert summary["sampleCount"] == 0
  assert summary["firstReadySeconds"] is None
  assert summary["peakJSCombinedBytes"] is None


def test_default_cli_is_45_second_mobile_chrome_without_forced_gc() -> None:
  args = parse_args(["https://example.org/viewer/"])
  assert args.duration == 45
  assert args.interval == 0.5
  assert args.engine == "chromium"
  assert not args.collect_garbage
  assert args.heap_limit == 0


@pytest.mark.parametrize(
  "extra",
  [
    ["--duration", "0"],
    ["--duration", "nan"],
    ["--interval", "inf"],
    ["--interval", "60"],
    ["--heap-limit", "-1"],
    ["--engine", "webkit", "--collect-garbage"],
    ["--engine", "webkit", "--heap-limit", "512"],
  ],
)
def test_invalid_or_unavailable_measurement_options_fail(extra: list[str]) -> None:
  with pytest.raises(SystemExit):
    parse_args(["https://example.org", *extra])
