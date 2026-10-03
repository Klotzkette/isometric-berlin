"""Measure a fresh mobile Day startup without hiding load-time memory peaks.

  uv run --with playwright python scripts/smoke_cold_start.py URL
  uv run --with playwright python scripts/smoke_cold_start.py URL --engine webkit

Chrome uses Pixel 5 and WebKit uses iPhone 13 browser profiles. These are not
physical phones or their process-memory limits. Chromium heap/backing metrics
cover the main JavaScript realm, not workers or total process RAM. GPU counters
measure actual WebGL buffer allocations, excluding textures and driver memory.
Optional --collect-garbage runs only after the unmodified observation window.
The JSON report and exit status fail on incomplete loading, recovery or errors.
When the startup chooser is present, Day is selected through its visible controls
and the load observation window begins at Start; its earlier sample is retained.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import math
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from smoke_mobile_memory import BUFFER_PROBE
from smoke_mode_continuity import PROBE, viewer_url

CONSOLE_ADVISORIES = {
  'Viewport argument key "interactive-widget" not recognized and ignored.'
}
STARTUP_GROUPS = ("signatures", "park", "central", "cultural", "civic", "monuments")
TRACK_CONTEXTS = """(() => {
  const seen = new WeakSet();
  const original = HTMLCanvasElement.prototype.getContext;
  window.__coldStartContexts = 0;
  HTMLCanvasElement.prototype.getContext = function(kind, ...args) {
    const context = original.call(this, kind, ...args);
    if (context && ['webgl','webgl2','experimental-webgl'].includes(kind) && !seen.has(context)) {
      seen.add(context);window.__coldStartContexts++;
    }
    return context;
  };
})();"""
SAMPLE = """() => {
 const r=window.__modeContinuityRuntime?.();
 const pose=window.__readModeContinuity?.();
 const resources=performance.getEntriesByType('resource');
 const groups={};
 for(const resource of resources){
   const group=resource.name.includes('/mesh/')?'mesh':resource.initiatorType;
   groups[group]??={count:0,decodedBodySize:0,encodedBodySize:0,transferSize:0};
   for(const key of ['decodedBodySize','encodedBodySize','transferSize'])groups[group][key]+=resource[key]||0;
   groups[group].count++;
 }
 return {at:performance.now(),ready:!!r?.presentationReady,runtime:pose?.runtime??null,
 mode:r?.lightingMode??null,position:pose?.position??null,target:pose?.target??null,
 state:r?{openingDetailReady:r.openingDetailReady,iso:r.isoWorldState,isoReady:!!r.isoWorld,
 voxel:r.voxelWorldState,progressive:r.progressiveWorldState,batches:r.progressiveWorldBatches.length,
 pendingAttachments:r.progressiveWorldMessages.length,
 signatures:r.signatures.children.length,park:r.parkDetails.children.length,
 central:r.centralDetails.children.length,cultural:r.culturalDetails.children.length,
 civic:r.civicDetails.children.length,monuments:r.monuments.children.length,
 schwellenraum:r.schwellenraumContentReady,surrounding:!!r.surroundingCity,
 surroundingManifest:!!r.surroundingCity?.manifest,surroundingPending:r.surroundingCity?.pending??null,
 surroundingChunks:r.surroundingCity?.residentChunkCount??null}:null,
 buffers:window.__mobileBuffers??null,contextCount:window.__coldStartContexts??null,
 resident:r?{instances:r.gpuResidency?.residentBytes,instanceBuffers:r.gpuResidency?.residentBuffers,
 geometryBuffers:r.geometryResidency?.residentBuffers}:null,
 renderer:r?{programs:r.renderer.info.programs?.length,memory:{...r.renderer.info.memory},
 render:{...r.renderer.info.render},lost:r.renderer.getContext().isContextLost()}:null,
 memory:performance.memory?{usedJSHeapSize:performance.memory.usedJSHeapSize,
 totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit}:null,
 resources:groups,resourceCount:resources.length,
 decodedBodySize:resources.reduce((sum,item)=>sum+(item.decodedBodySize||0),0),
 canvasCount:document.querySelectorAll('canvas').length,
 progress:document.querySelector('.three-progress')?.textContent??null,
 pageReady:document.readyState};
}"""
READ_RESOURCES = """() => performance.getEntriesByType('resource').map(r=>({
 name:r.name,initiatorType:r.initiatorType,decodedBodySize:r.decodedBodySize,
 encodedBodySize:r.encodedBodySize,transferSize:r.transferSize,duration:r.duration,startTime:r.startTime
}))"""


def number(value: Any) -> float | int | None:
  """Unavailable measurements stay null rather than pretending to be zero."""
  if isinstance(value, (float, int)) and not isinstance(value, bool):
    if math.isfinite(value) and value >= 0:
      return value
  return None


def memory_totals(sample: dict[str, Any]) -> dict[str, float | int | None]:
  """Sum same-sample CDP heap and backing storage, never independent peaks."""
  usage = sample.get("heapUsage") or {}
  used = number(usage.get("usedSize"))
  backing = number(usage.get("backingStorageSize"))
  return {
    "usedBytes": used,
    "backingStorageBytes": backing,
    "combinedBytes": used + backing
    if used is not None and backing is not None
    else None,
  }


def peak(values: list[Any]) -> float | int | None:
  measured = [n for value in values if (n := number(value)) is not None]
  return max(measured) if measured else None


def summarize_report(report: dict[str, Any]) -> dict[str, Any]:
  """Produce comparable peak and final measurements from ordinary startup samples."""
  samples = report.get("samples", [])
  totals = [memory_totals(sample) for sample in samples]
  used = peak([total["usedBytes"] for total in totals])
  backing = peak([total["backingStorageBytes"] for total in totals])
  return {
    "sampleCount": len(samples),
    "firstReadySeconds": next(
      (sample["wallSeconds"] for sample in samples if sample.get("ready")), None
    ),
    "peakJSHeapUsedBytes": used,
    "peakJSBackingStorageBytes": backing,
    "peakJSCombinedBytes": peak([total["combinedBytes"] for total in totals]),
    # This bound is intentionally separate: peaks can occur in different samples.
    "sumOfComponentPeaksBytes": (
      used + backing if used is not None and backing is not None else None
    ),
    "finalMemoryTotals": totals[-1] if totals else memory_totals({}),
    "peakPerformanceMemoryUsedBytes": peak(
      [(sample.get("memory") or {}).get("usedJSHeapSize") for sample in samples]
    ),
    "peakGpuBufferBytes": peak(
      [(sample.get("buffers") or {}).get("peak") for sample in samples]
    ),
    "runtimeIds": sorted(
      {sample["runtime"] for sample in samples if sample.get("runtime") is not None}
    ),
    "maxDecodedBytes": peak([sample.get("decodedBodySize") for sample in samples]),
    "maxSampleReadSeconds": peak(
      [sample["wallSeconds"] - sample["pollStartedSeconds"] for sample in samples]
    ),
  }


def failure_reasons(report: dict[str, Any]) -> list[str]:
  """A recovered context or a briefly ready but incomplete city cannot pass."""
  failures = list(report.get("errors", []))
  samples = report.get("samples", [])
  if not samples:
    return [*failures, "No startup samples were recorded"]
  if len(report.get("navigations", [])) != 1:
    failures.append(
      "Expected one cold document navigation; reload or navigation detected"
    )
  runtimes = {s["runtime"] for s in samples if s.get("runtime") is not None}
  if len(runtimes) != 1:
    failures.append("Expected one runtime; missing or rebuilt runtime detected")
  if any((s.get("contextCount") or 0) > 1 for s in samples):
    failures.append("More than one WebGL context was created")
  if any((s.get("buffers") or {}).get("lost", 0) for s in samples):
    failures.append("A WebGL context was lost, including any recovered loss")
  if any((s.get("renderer") or {}).get("lost") for s in samples):
    failures.append("Renderer reported a lost WebGL context")
  seen_ready = False
  for sample in samples:
    if seen_ready and not sample.get("ready"):
      failures.append("Viewer readiness regressed after its first ready frame")
      break
    seen_ready = seen_ready or bool(sample.get("ready"))
  final = samples[-1]
  state = final.get("state") or {}
  if not final.get("ready") or final.get("mode") != "day":
    failures.append("Day viewer was not ready at the end of the observation window")
  if not state.get("isoReady") or not state.get("openingDetailReady"):
    failures.append("The complete initial drawn world was not attached")
  if state.get("progressive") != "complete" or state.get("pendingAttachments") != 0:
    failures.append("Requested progressive startup layers did not finish loading")
  missing = [group for group in STARTUP_GROUPS if not (state.get(group) or 0) > 0]
  if missing:
    failures.append(f"Startup scene groups are missing: {', '.join(missing)}")
  if (
    not state.get("surroundingManifest") or state.get("surroundingPending") is not False
  ):
    failures.append("Requested surrounding-city layers did not finish loading")
  buffers = final.get("buffers") or {}
  renderer = final.get("renderer") or {}
  if final.get("contextCount") != 1 or not (buffers.get("bytes") or 0) > 0:
    failures.append("No live measured WebGL buffers at the end of startup")
  if not (renderer.get("render", {}).get("frame") or 0) > 0:
    failures.append("No rendered frame was observed")
  return failures


async def run(args: argparse.Namespace) -> dict[str, Any]:
  """Observe loading in a fresh non-persistent browser context and save evidence."""
  from playwright.async_api import async_playwright

  report: dict[str, Any] = {
    "kind": "mobile cold Day startup",
    "engine": args.engine,
    "device": "iPhone 13" if args.engine == "webkit" else "Pixel 5",
    "url": viewer_url(args.url),
    "durationSeconds": args.duration,
    "sampleIntervalSeconds": args.interval,
    "heapLimitMiB": args.heap_limit or None,
    "samples": [],
    "errors": [],
    "advisories": [],
    "navigations": [],
    "memoryScope": "Main JS realm only; excludes workers and total process RAM",
    "gpuScope": "Actual WebGL vertex/instance buffers; excludes textures and drivers",
  }
  args.output.parent.mkdir(parents=True, exist_ok=True)
  browser = context = page = session = None
  observing = True
  began = time.monotonic()

  def on_console(message: Any) -> None:
    if not observing:
      return
    if message.text in CONSOLE_ADVISORIES:
      report["advisories"].append(message.text)
    elif message.type == "error" or "Berlin surroundings:" in message.text:
      report["errors"].append(message.text)

  def on_response(response: Any) -> None:
    if (
      observing
      and response.status >= 400
      and response.request.resource_type
      in {"document", "script", "stylesheet", "xhr", "fetch"}
    ):
      report["errors"].append(f"HTTP {response.status}: {response.url}")

  async def sample() -> dict[str, Any]:
    started = time.monotonic() - began
    state = await asyncio.wait_for(page.evaluate(SAMPLE), timeout=30)
    if session:
      state["heapUsage"] = await session.send("Runtime.getHeapUsage")
    state["wallSeconds"] = round(time.monotonic() - began, 3)
    state["pollStartedSeconds"] = round(started, 3)
    state["memoryTotals"] = memory_totals(state)
    return state

  try:
    async with async_playwright() as playwright:
      options: dict[str, Any] = {}
      if args.engine == "chromium":
        options = {"channel": "chrome", "args": ["--enable-precise-memory-info"]}
        if args.heap_limit:
          options["args"].append(f"--js-flags=--max-old-space-size={args.heap_limit}")
      browser = await getattr(playwright, args.engine).launch(**options)
      try:
        context = await browser.new_context(
          **playwright.devices[report["device"]], service_workers="block"
        )
        for probe in (PROBE, BUFFER_PROBE, TRACK_CONTEXTS):
          await context.add_init_script(probe)
        await context.add_init_script("performance.setResourceTimingBufferSize(3000);")
        page = await context.new_page()
        page.set_default_timeout(30_000)
        page.on("pageerror", lambda error: report["errors"].append(str(error)))
        page.on("crash", lambda: report["errors"].append("Browser page crashed"))
        page.on("console", on_console)
        page.on("response", on_response)
        page.on(
          "framenavigated",
          lambda frame: (
            report["navigations"].append(
              {"url": frame.url, "wallSeconds": round(time.monotonic() - began, 3)}
            )
            if frame == page.main_frame
            else None
          ),
        )
        session = (
          await context.new_cdp_session(page) if args.engine == "chromium" else None
        )
        began = time.monotonic()
        await page.goto(report["url"], wait_until="commit")
        await page.locator(".startup-mode-selection, .three-viewer").first.wait_for(
          state="visible"
        )
        if await page.locator(".startup-mode-selection").is_visible():
          # This probe has always measured Day, including its completion checks.
          # Use the same chooser interaction as a visitor, without a URL bypass.
          await (
            page.locator(".startup-mode-option")
            .filter(has=page.locator('input[name="startup-mode"][value="day"]'))
            .click()
          )
          report["selectionSample"] = await sample()
          report["documentStartupSeconds"] = round(time.monotonic() - began, 3)
          report["timingOrigin"] = "Start button"
          began = time.monotonic()
          await page.locator(".startup-launch").click()
        else:
          report["timingOrigin"] = "Document navigation"
        while time.monotonic() - began < args.duration:
          started = time.monotonic()
          state = await sample()
          report["samples"].append(state)
          print(
            json.dumps(
              {
                key: state.get(key)
                for key in (
                  "wallSeconds",
                  "ready",
                  "runtime",
                  "state",
                  "buffers",
                  "memoryTotals",
                )
              }
            ),
            flush=True,
          )
          await asyncio.sleep(max(0, args.interval - (time.monotonic() - started)))
        report["elapsedSeconds"] = round(time.monotonic() - began, 3)
        report["finalResources"] = await page.evaluate(READ_RESOURCES)
        # GC is deliberately outside the peak window and cannot turn an
        # incomplete or crashed ordinary startup into a successful report.
        if args.collect_garbage:
          assert session is not None
          await session.send("HeapProfiler.collectGarbage")
          report["afterGcSample"] = await sample()
        await page.screenshot(path=str(args.output.with_suffix(".png")), timeout=10_000)
      finally:
        observing = False
        if context:
          await context.close()
        await browser.close()
  except Exception as error:
    report["errors"].append(f"{type(error).__name__}: {error}")
  report["summary"] = summarize_report(report)
  report["failures"] = failure_reasons(report)
  report["success"] = not report["failures"]
  args.output.write_text(json.dumps(report, indent=2) + "\n")
  print(
    json.dumps(
      {
        "success": report["success"],
        **report["summary"],
        "failures": report["failures"],
      },
      indent=2,
    ),
    flush=True,
  )
  return report


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url", help="Complete HTTP(S) viewer URL")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  parser.add_argument("--duration", type=float, default=45, help="Observation seconds")
  parser.add_argument(
    "--interval", type=float, default=0.5, help="Sample interval seconds"
  )
  parser.add_argument(
    "--heap-limit",
    type=int,
    default=0,
    help="Optional Chromium old-space MiB; not a phone RAM simulation",
  )
  parser.add_argument(
    "--collect-garbage",
    action="store_true",
    help="Collect Chromium JS garbage only after the observation window",
  )
  parser.add_argument("--output", type=Path, default=Path("/tmp/cold-start.json"))
  args = parser.parse_args(argv)
  if urlsplit(args.url).scheme not in {"http", "https"}:
    parser.error("Provide an HTTP(S) viewer URL")
  if not math.isfinite(args.duration) or args.duration <= 0:
    parser.error("--duration must be finite and positive")
  if (
    not math.isfinite(args.interval)
    or args.interval <= 0
    or args.interval > args.duration
  ):
    parser.error("--interval must be finite, positive and no longer than --duration")
  if args.heap_limit < 0:
    parser.error("--heap-limit cannot be negative")
  if args.engine != "chromium" and (args.heap_limit or args.collect_garbage):
    parser.error("--heap-limit and --collect-garbage require --engine chromium")
  return args


def main() -> None:
  report = asyncio.run(run(parse_args()))
  if not report["success"]:
    raise SystemExit(1)


if __name__ == "__main__":
  main()
