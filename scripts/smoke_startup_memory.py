"""Measure a cold viewer start and check consumed JSON lifetime without changing detail.

Run with uv run --with playwright python. Chrome records live and post-GC JS
heap/backing storage. WebGL counters exclude textures/driver allocations;
phone browser profiles cannot certify physical phone RAM limits. Samples use
an empty HTTP cache in a fresh context, timed from the explicit startup choice,
with 25 seconds after presentation. Earlier auto-start builds time navigation.
"""

import argparse
import json
import time
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from playwright.sync_api import sync_playwright
from smoke_mobile_memory import BUFFER_PROBE, READ_STATE
from smoke_mode_continuity import PROBE, launch_startup_mode


def main() -> None:
  p = argparse.ArgumentParser()
  p.add_argument("url")
  p.add_argument("--out", required=True)
  p.add_argument("--touch", action="store_true")
  p.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  p.add_argument("--mode", default="day")
  p.add_argument("--expect-released-core", action="store_true")
  a = p.parse_args()
  report = {
    "engine": a.engine,
    "touch": a.touch,
    "mode": a.mode,
    "samples": [],
    "errors": [],
  }
  probe = """window.__startTasks=[];try{new PerformanceObserver(l=>{for(const e of l.getEntries())window.__startTasks.push([e.startTime,e.duration]);}).observe({type:'longtask',buffered:true});}catch{};window.__startFrames=[];let prev=0;function frame(t){if(prev)window.__startFrames.push([t,t-prev]);prev=t;if(window.__startFrames.length<15000)requestAnimationFrame(frame);}requestAnimationFrame(frame);"""
  with sync_playwright() as pw:
    b = getattr(pw, a.engine).launch(
      **({"channel": "chrome"} if a.engine == "chromium" else {})
    )
    c = b.new_context(
      **(
        pw.devices["iPhone 13" if a.engine == "webkit" else "Pixel 5"]
        if a.touch
        else {"viewport": {"width": 1365, "height": 900}}
      )
    )
    weak_probe = """window.__payloadRefs=[];const parse=Response.prototype.json;Response.prototype.json=async function(){const value=await parse.apply(this,arguments);if(value&&typeof value==="object")window.__payloadRefs.push({url:this.url,ref:new WeakRef(value)});return value;};"""
    for x in (PROBE, BUFFER_PROBE, probe, weak_probe):
      c.add_init_script(x)
    page = c.new_page()
    page.on("pageerror", lambda e: report["errors"].append(str(e)))
    page.on("crash", lambda: report["errors"].append("crash"))
    page.on(
      "console",
      lambda m: (
        report["errors"].append(m.text)
        if m.type == "error" and "interactive-widget" not in m.text
        else None
      ),
    )
    cd = c.new_cdp_session(page) if a.engine == "chromium" else None
    if cd:
      cd.send("Network.setCacheDisabled", {"cacheDisabled": True})
    start = time.monotonic()
    ready_at = None
    try:
      parts = urlsplit(a.url)
      query = dict(parse_qsl(parts.query))
      query.update(lang="en", theme=a.mode)
      page.goto(
        urlunsplit(parts._replace(query=urlencode(query))),
        wait_until="domcontentloaded",
        timeout=120000,
      )
      launched_at = launch_startup_mode(page, a.mode)
      if launched_at is not None:
        report["chooserSeconds"] = launched_at - start
        start = launched_at

      while time.monotonic() - start < 130:
        state = page.evaluate(READ_STATE)
        sample = {"s": time.monotonic() - start, "state": state}
        if cd:
          sample["heap"] = cd.send("Runtime.getHeapUsage")
        report["samples"].append(sample)
        if state and state["ready"]:
          if ready_at is None:
            ready_at = time.monotonic() - start
            report["readySeconds"] = ready_at
          if time.monotonic() - start > ready_at + 25:
            break
        page.wait_for_timeout(1000)
      assert ready_at is not None, "not ready"
      report["longTasks"] = page.evaluate("window.__startTasks")
      frames = page.evaluate("window.__startFrames")
      report["frames"] = frames
      report["resources"] = page.evaluate(
        'performance.getEntriesByType("resource").map(e=>({name:e.name,bytes:e.decodedBodySize,end:e.responseEnd}))'
      )
      if cd:
        cd.send("HeapProfiler.collectGarbage")
        report["postGcHeap"] = cd.send("Runtime.getHeapUsage")
      report["payloadRefs"] = page.evaluate(
        "window.__payloadRefs.map(v=>({url:v.url,retained:!!v.ref.deref()}))"
      )
      report["final"] = page.evaluate(READ_STATE)
      page.screenshot(path=a.out + ".png")
      if a.expect_released_core:
        assert cd is not None, "Lifetime verification requires Chrome GC"
        core = (
          "ground-context.json",
          "rail-lines.json",
          "street-details.json",
          "lod2-prisms.json",
          "surface-polygons.json",
          "park-details.json",
          "minecraft-voxels.json",
        )
        retained = [
          x["url"]
          for x in report["payloadRefs"]
          if x["retained"] and any(n in x["url"] for n in core)
        ]
        assert not retained, retained
      assert not report["errors"], report["errors"]
      assert report["final"]["ready"] and not report["final"]["contextLost"], report[
        "final"
      ]
      report["success"] = True
    except Exception as e:
      report["exception"] = str(e)
    finally:
      Path(a.out + ".json").write_text(json.dumps(report, indent=2))
      c.close()
      b.close()
  print(
    json.dumps(
      {
        k: v
        for k, v in report.items()
        if k not in ("samples", "longTasks", "frames", "resources", "payloadRefs")
      }
    )
  )
  if not report.get("success"):
    raise SystemExit(1)


if __name__ == "__main__":
  main()
