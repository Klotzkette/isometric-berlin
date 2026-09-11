"""Profile repeatable desktop motion without changing production viewer code.

uv run --with playwright python scripts/profile_viewer_motion.py URL --output /tmp/motion.json
Add --profile to save a Chrome DevTools .cpuprofile per location. --duration
sets each of the idle, pointer-orbit and W-flight phases (default 6 seconds).
Run one browser profile at a time on the same machine, power mode and display.
renderer.render duration measures CPU submission, not asynchronous GPU time.
Every renderer.render call is sampled before the next compositor pass resets
renderer.info, and all calls/triangles are summed into each observed RAF frame.
"""

from __future__ import annotations

import argparse
import json
import math
import platform
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

LOCATIONS = {
  "kanzleramt": {
    "slug": "bundeskanzleramt",
    "position": [-12, 55, -121],
    "target": [-153.882, 20, -144.215],
    "fov": 39,
  },
  "washingtonplatz": {
    "slug": "berlin-hauptbahnhof",
    "position": [-60, 62, -530],
    "target": [-86.48, 25, -599.79],
    "fov": 39,
  },
  "gate": {
    "slug": "brandenburger-tor",
    "position": [522, 52, 319],
    "target": [417.898, 17, 300.453],
    "fov": 39,
  },
  "panorama": {
    "slug": "reichstagsgebaeude",
    "position": [1500, 1350, 1500],
    "target": [100, 8, 0],
    "fov": 39,
  },
}
RUNTIME_PROBE = """() => {
  const el = document.querySelector('.three-viewer.is-active');
  if (!el) return null;
  const key = Object.keys(el).find(k => k.startsWith('__reactFiber'));
  for (let f = el[key]; f; f = f.return)
    for (let h = f.memoizedState; h; h = h.next) {
      const r = h.memoizedState?.current;
      if (r?.camera && r?.scene && r?.controls && r?.renderer && !r.disposed &&
          r.landmarkByName?.size) return r;
    }
  return null;
}"""
INSTALL_PROBE = """() => {
  const r = window.__motionRuntime();
  if (!r?.presentationReady) throw Error('No presented runtime to profile');
  const probe = {runtime: r, active: null, phases: [], longTasks: [], lastRaf: null};
  window.__motionProfile = probe;
  const snapshot = () => ({
    position: r.camera.position.toArray(), target: r.controls.target.toArray(),
    fov: r.camera.fov, near: r.camera.near, mode: r.lightingMode,
    walking: r.pedestrian.enabled, pixelRatio: r.renderer.getPixelRatio(),
    drawingBuffer: [r.renderer.domElement.width, r.renderer.domElement.height],
    webglMemory: {...r.renderer.info.memory},
    jsHeap: performance.memory ? {
      usedBytes: performance.memory.usedJSHeapSize,
      totalBytes: performance.memory.totalJSHeapSize,
      limitBytes: performance.memory.jsHeapSizeLimit,
    } : null,
  });
  probe.snapshot = snapshot;
  const observer = new PerformanceObserver(list => {
    for (const e of list.getEntries())
      probe.longTasks.push({startMs: e.startTime, durationMs: e.duration});
  });
  if (PerformanceObserver.supportedEntryTypes.includes('longtask'))
    observer.observe({type: 'longtask', buffered: true});
  probe.longTaskSupported = PerformanceObserver.supportedEntryTypes.includes('longtask');
  const originalRender = r.renderer.render;
  r.renderer.render = function (...args) {
    const phase = probe.active;
    const start = performance.now();
    const autoReset = this.info.autoReset;
    const before = {...this.info.render};
    try { return originalRender.apply(this, args); }
    finally {
      if (phase && probe.active === phase) {
        const end = performance.now();
        const after = this.info.render;
        const draw = {startMs: start, durationMs: end - start};
        for (const key of ['calls', 'triangles', 'lines', 'points'])
          draw[key] = autoReset ? after[key] : Math.max(0, after[key] - before[key]);
        phase.renders.push(draw);
        phase.pending.cpuMs += draw.durationMs;
        phase.pending.calls += draw.calls;
        phase.pending.triangles += draw.triangles;
      }
    }
  };
  const tick = now => {
    const phase = probe.active;
    if (phase) {
      const p = r.camera.position, initial = phase.start.position;
      phase.maxCameraDisplacementM = Math.max(phase.maxCameraDisplacementM,
        Math.hypot(p.x - initial[0], p.y - initial[1], p.z - initial[2]));
      if (probe.lastRaf !== null && probe.lastRaf >= phase.startMs)
        phase.frames.push({startMs: probe.lastRaf, durationMs: now - probe.lastRaf,
          renderCpuMs: phase.pending.cpuMs, calls: phase.pending.calls,
          triangles: phase.pending.triangles});
      phase.pending = {cpuMs: 0, calls: 0, triangles: 0};
    }
    probe.lastRaf = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  probe.begin = name => {
    const phase = {name, startMs: performance.now(), endMs: null,
      start: snapshot(), maxCameraDisplacementM: 0, frames: [], renders: [],
      pending: {cpuMs: 0, calls: 0, triangles: 0}};
    probe.phases.push(phase); probe.active = phase; probe.lastRaf = null;
  };
  probe.end = () => {
    const phase = probe.active;
    phase.endMs = performance.now(); phase.end = snapshot(); probe.active = null;
    delete phase.pending;
    return phase;
  };
  const gl = r.renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {initial: snapshot(), userAgent: navigator.userAgent,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGB: navigator.deviceMemory ?? null,
    webglRenderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    webglVendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    longTaskSupported: probe.longTaskSupported};
}"""


def distribution(
  values: list[float], *, milliseconds: bool = True
) -> dict[str, float | int | None]:
  """Nearest-rank percentiles, retaining stalls instead of trimming outliers."""
  ordered = sorted(values)
  summary: dict[str, float | int | None] = {
    "count": len(ordered),
    **{
      f"p{p}": ordered[math.ceil(len(ordered) * p / 100) - 1] if ordered else None
      for p in (50, 95, 99)
    },
    "max": ordered[-1] if ordered else None,
    "mean": sum(ordered) / len(ordered) if ordered else None,
  }
  if milliseconds:
    for threshold in (33, 50):
      count = sum(value > threshold for value in ordered)
      summary[f"over{threshold}ms"] = count
      summary[f"over{threshold}msPercent"] = (
        100 * count / len(ordered) if ordered else 0
      )
  return summary


def start_url(url: str, location: str) -> str:
  parts = urlsplit(url)
  query = dict(parse_qsl(parts.query))
  query.update(lang="en", theme="day")
  query.pop("view", None)
  return urlunsplit(
    parts._replace(
      query=urlencode(query), fragment=f"landmark={LOCATIONS[location]['slug']}"
    )
  )


def seed(page: Any, pose: dict[str, Any]) -> None:
  page.evaluate(
    """pose => {
    const r = window.__motionProfile.runtime;
    r.controls.enabled = true;
    r.camera.position.fromArray(pose.position);
    r.controls.target.fromArray(pose.target);
    r.camera.fov = pose.fov; r.camera.updateProjectionMatrix();
    r.controls.update(); r.camera.updateMatrixWorld(); r.renderInvalidated = true;
  }""",
    pose,
  )


def pointer_position(elapsed: float, duration: float) -> tuple[float, float]:
  """Two closed orbit loops through identical pixel coordinates each run."""
  angle = min(1.0, elapsed / duration) * math.tau * 2
  return 720 + 130 * math.sin(angle), 450 + 55 * math.sin(angle * 2)


def perform_motion(page: Any, name: str, duration: float) -> dict[str, Any]:
  events = 0
  gaps: list[float] = []
  if name == "orbit":
    page.mouse.move(720, 450)
    page.mouse.down()
  elif name == "flight":
    # Focus the existing canvas without a camera-changing click.
    page.locator(".three-viewer.is-active canvas").focus()
    page.keyboard.down("w")
  start = time.monotonic()
  previous = start
  try:
    while (elapsed := time.monotonic() - start) < duration:
      if name == "orbit":
        page.mouse.move(*pointer_position(elapsed, duration))
        current = time.monotonic()
        gaps.append((current - previous) * 1000)
        previous = current
        events += 1
      page.wait_for_timeout(
        min(1000 / 60, max(0, duration - (time.monotonic() - start)) * 1000)
      )
    if name == "orbit":
      page.mouse.move(*pointer_position(duration, duration))
  finally:
    if name == "orbit":
      page.mouse.up()
    elif name == "flight":
      page.keyboard.up("w")
  return {
    "requestedSeconds": duration,
    "wallSeconds": time.monotonic() - start,
    "pointerMoveEvents": events,
    "pointerEventGapMs": distribution(gaps),
  }


def metrics(session: Any) -> dict[str, float]:
  return {
    item["name"]: item["value"]
    for item in session.send("Performance.getMetrics")["metrics"]
  }


def summarize(
  phase: dict[str, Any], long_tasks: list[dict[str, float]]
) -> dict[str, Any]:
  phase["longTasks"] = [
    task for task in long_tasks if phase["startMs"] <= task["startMs"] < phase["endMs"]
  ]
  phase["summary"] = {
    "rafIntervalMs": distribution([frame["durationMs"] for frame in phase["frames"]]),
    "renderCallCpuMs": distribution([draw["durationMs"] for draw in phase["renders"]]),
    "renderCpuMsPerRaf": distribution(
      [frame["renderCpuMs"] for frame in phase["frames"]]
    ),
    "drawCallsPerRaf": distribution(
      [frame["calls"] for frame in phase["frames"]], milliseconds=False
    ),
    "trianglesPerRaf": distribution(
      [frame["triangles"] for frame in phase["frames"]], milliseconds=False
    ),
    "longTaskMs": distribution([task["durationMs"] for task in phase["longTasks"]]),
    "totalDrawCalls": sum(draw["calls"] for draw in phase["renders"]),
    "totalTriangles": sum(draw["triangles"] for draw in phase["renders"]),
  }
  return phase


def run(args: argparse.Namespace) -> None:
  from playwright.sync_api import sync_playwright

  report: dict[str, Any] = {
    "schemaVersion": 1,
    "recordedAt": datetime.now(UTC).isoformat(),
    "host": platform.platform(),
    "url": args.url,
    "configuration": {
      "viewport": [1440, 900],
      "deviceScaleFactor": 1,
      "headless": not args.headed,
      "durationPerPhaseSeconds": args.duration,
      "settleSeconds": args.settle,
      "cacheDisabled": True,
      "cpuProfile": args.profile,
    },
    "notes": [
      "CPU renderer submission duration is not GPU time.",
      "Draw calls and triangles include every compositor pass, not only its final pass.",
      "JS heap and WebGL resource counts are not total browser/process RAM.",
      "Compare on the same hardware, power state and browser; profiling adds overhead.",
    ],
    "locations": [],
  }
  args.output.parent.mkdir(parents=True, exist_ok=True)
  with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=not args.headed)
    report["chromeVersion"] = browser.version
    try:
      for name in args.locations:
        context = browser.new_context(
          viewport={"width": 1440, "height": 900},
          device_scale_factor=1,
          has_touch=False,
          is_mobile=False,
        )
        context.add_init_script(f"window.__motionRuntime = {RUNTIME_PROBE};")
        page = context.new_page()
        page.set_default_timeout(args.timeout * 1000)
        session = context.new_cdp_session(page)
        session.send("Network.enable")
        session.send("Network.setCacheDisabled", {"cacheDisabled": True})
        session.send("Network.clearBrowserCache")
        session.send("Performance.enable")
        errors: list[str] = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        location: dict[str, Any] = {
          "name": name,
          "url": start_url(args.url, name),
          "phases": [],
          "errors": errors,
        }
        report["locations"].append(location)
        try:
          started = time.monotonic()
          page.goto(location["url"], wait_until="domcontentloaded")
          page.wait_for_function(
            "() => window.__motionRuntime()?.presentationReady === true"
          )
          location["startupSeconds"] = time.monotonic() - started
          location["environment"] = page.evaluate(INSTALL_PROBE)
          page.wait_for_timeout(args.settle * 1000)
          if args.profile:
            session.send("Profiler.enable")
            session.send("Profiler.setSamplingInterval", {"interval": 1000})
            session.send("Profiler.start")
          for phase_name in ("idle", "orbit", "flight"):
            seed(page, LOCATIONS[name])
            page.wait_for_timeout(args.settle * 1000)
            before = metrics(session)
            page.evaluate("name => window.__motionProfile.begin(name)", phase_name)
            inputs = perform_motion(page, phase_name, args.duration)
            phase = page.evaluate("window.__motionProfile.end()")
            phase["input"] = inputs
            phase["cdpMetricsBefore"] = before
            phase["cdpMetricsAfter"] = metrics(session)
            location["phases"].append(phase)
            print(
              json.dumps(
                {"location": name, "phase": phase_name, "frames": len(phase["frames"])}
              ),
              flush=True,
            )
          if args.profile:
            profile = session.send("Profiler.stop")["profile"]
            destination = args.output.with_name(f"{args.output.stem}-{name}.cpuprofile")
            destination.write_text(json.dumps(profile), encoding="utf-8")
            location["cpuProfile"] = str(destination)
          page.wait_for_timeout(100)
          tasks = page.evaluate("window.__motionProfile.longTasks")
          location["phases"] = [summarize(phase, tasks) for phase in location["phases"]]
          location["domCounters"] = session.send("Memory.getDOMCounters")
          location["passed"] = not errors and all(
            phase["frames"]
            and (
              phase["name"] == "idle"
              or (phase["renders"] and phase["maxCameraDisplacementM"] > 0.1)
            )
            for phase in location["phases"]
          )
        except Exception as error:
          location["failure"] = str(error)
          location["passed"] = False
          raise
        finally:
          args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
          context.close()
    finally:
      browser.close()
  if not all(location["passed"] for location in report["locations"]):
    raise SystemExit(f"Incomplete profile or browser errors; inspect {args.output}")
  print(f"Wrote {args.output}", flush=True)


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--duration", type=float, default=6)
  parser.add_argument("--settle", type=float, default=3)
  parser.add_argument("--timeout", type=float, default=120)
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--profile", action="store_true")
  parser.add_argument("--headed", action="store_true")
  parser.add_argument(
    "--locations",
    nargs="+",
    choices=tuple(LOCATIONS),
    default=["kanzleramt", "washingtonplatz"],
  )
  args = parser.parse_args()
  if urlsplit(args.url).scheme not in {"http", "https"}:
    parser.error("Provide an HTTP(S) viewer URL")
  if (
    not all(
      math.isfinite(value) and value > 0 for value in (args.duration, args.timeout)
    )
    or not math.isfinite(args.settle)
    or args.settle < 0
  ):
    parser.error("Duration/timeout must be positive and settle must be nonnegative")
  run(args)


if __name__ == "__main__":
  main()
