"""Replay mobile cold-start, far/near travel and repeated drawn-mode transitions.

Run with uv run --with playwright python scripts/smoke_mobile_memory.py URL.
The iPhone 13/Pixel 5 profiles test browser engines, not physical phone RAM.
GPU counters measure vertex/instance buffers only, excluding textures/drivers.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from smoke_mode_continuity import (
  PROBE,
  seed_camera,
  select_mode,
  viewer_url,
  wait_ready,
)

# The first three poses reproduced the WebKit context failure in v1.0.57.
ROUTE = (
  ("ulap-far", [-640, 210, -190], [-359, 5, -457], 39),
  ("moabit-far", [-600, 225, -1090], [-335, 6, -900], 39),
  ("moabit-near", [-380, 32, -965], [-325, 6, -871], 50),
  ("alexanderplatz", [1940, 320, 620], [1670, 8, 320], 50),
  ("city-west", [-3280, 260, 1340], [-3000, 8, 1060], 50),
  ("charite", [110, 170, -620], [-75, 8, -950], 50),
  ("city-overview", [-1300, 1500, -1300], [0, 5, 0], 50),
)
BUFFER_PROBE = """(() => {
  const stats = window.__mobileBuffers = {bytes:0,peak:0,handles:0,peakHandles:0,uploads:0,deletes:0,lost:0};
  document.addEventListener('webglcontextlost',()=>stats.lost++,true);
  for(const P of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype]) {
    if(!P)continue;
    const contexts=new WeakMap();
    const state=c=>{let s=contexts.get(c);if(!s){s={bound:new Map(),sizes:new WeakMap(),live:new WeakSet()};contexts.set(c,s);}return s;};
    const create=P.createBuffer,bind=P.bindBuffer,data=P.bufferData,del=P.deleteBuffer;
    P.createBuffer=function(){const b=create.apply(this,arguments);if(b){state(this).live.add(b);
      stats.handles++;stats.peakHandles=Math.max(stats.peakHandles,stats.handles);}return b;};
    P.bindBuffer=function(t,b){state(this).bound.set(t,b);return bind.apply(this,arguments);};
    P.bufferData=function(t,d,usage,offset,length){
      const s=state(this),b=s.bound.get(t);
      if(b){const n=typeof d==='number'?d:d instanceof ArrayBuffer?d.byteLength:
        (length??((d?.length??0)-(offset||0)))*(d?.BYTES_PER_ELEMENT||1);
        stats.bytes+=n-(s.sizes.get(b)||0);s.sizes.set(b,n);
        stats.peak=Math.max(stats.peak,stats.bytes);stats.uploads++;}
      return data.apply(this,arguments);
    };
    P.deleteBuffer=function(b){const s=state(this);stats.bytes-=s.sizes.get(b)||0;
      s.sizes.delete(b);if(b&&s.live.has(b)){s.live.delete(b);stats.handles--;stats.deletes++;}return del.apply(this,arguments);};
  }
})();"""
READ_STATE = """() => {
  const r=window.__modeContinuityRuntime();
  return {ready:!!r?.presentationReady,mode:r?.lightingMode,
    lost:window.__mobileBuffers.lost, buffers:{...window.__mobileBuffers},
    instanceResidentBytes:r?.gpuResidency?.residentBytes??null,
    instanceResidentBuffers:r?.gpuResidency?.residentBuffers??null,
    geometryResidentBuffers:r?.geometryResidency?.residentBuffers??null,
    speculativeWarmup:!!r?.gpuWarmup,programs:r?.renderer.info.programs?.length,
    contextLost:r?.renderer.getContext().isContextLost()??true};
}"""


def validate_sample(sample: dict[str, Any], mode: str) -> None:
  """A recovered context still fails this test; it must never hide a crash."""
  assert sample["ready"] and sample["mode"] == mode, sample
  assert sample["lost"] == 0 and not sample["contextLost"], sample
  assert not sample["speculativeWarmup"], sample
  assert sample["instanceResidentBytes"] is not None, sample
  assert sample["instanceResidentBuffers"] is not None, sample
  assert sample["geometryResidentBuffers"] is not None, sample


def run(url: str, engine: str, output: Path, hold_seconds: float = 45) -> None:
  from playwright.sync_api import sync_playwright

  report: dict[str, Any] = {"engine": engine, "samples": [], "errors": []}
  output.parent.mkdir(parents=True, exist_ok=True)
  with sync_playwright() as p:
    browser = getattr(p, engine).launch(
      **({"channel": "chrome"} if engine == "chromium" else {})
    )
    context = browser.new_context(
      **p.devices["iPhone 13" if engine == "webkit" else "Pixel 5"]
    )
    context.add_init_script(PROBE)
    context.add_init_script(BUFFER_PROBE)
    page = context.new_page()
    page.set_default_timeout(120_000)
    page.on("pageerror", lambda error: report["errors"].append(str(error)))
    page.on("crash", lambda: report["errors"].append("Browser page crashed"))
    page.on(
      "console",
      lambda message: (
        report["errors"].append(message.text)
        if message.type == "error" and "interactive-widget" not in message.text
        else None
      ),
    )
    try:
      page.goto(viewer_url(url))
      wait_ready(page, "day", 120)
      page.wait_for_timeout(hold_seconds * 1000)
      for visit, mode in enumerate(("day", "schwellenraum", "day", "schwellenraum")):
        if visit:
          select_mode(page, mode, True)
          wait_ready(page, mode, 120)
        for name, position, target, fov in ROUTE:
          seed_camera(page, {"position": position, "target": target, "fov": fov})
          page.wait_for_timeout(3500)
          sample = page.evaluate(READ_STATE)
          sample.update(view=name, visit=visit)
          report["samples"].append(sample)
          print(json.dumps(sample), flush=True)
          validate_sample(sample, mode)
          assert not report["errors"], report["errors"]
      page.screenshot(path=str(output.with_suffix(".png")))
      report["success"] = True
    finally:
      output.write_text(json.dumps(report, indent=2))
      context.close()
      browser.close()


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("webkit", "chromium"), default="webkit")
  parser.add_argument("--output", type=Path, default=Path("/tmp/mobile-memory.json"))
  args = parser.parse_args()
  if urlsplit(args.url).scheme not in {"http", "https"}:
    parser.error("Provide an HTTP(S) viewer URL")
  run(args.url, args.engine, args.output)


if __name__ == "__main__":
  main()
