"""Measure high-camera streamed-city latency without changing production code.

uv run --with playwright python scripts/smoke_high_flight_v212.py URL --output DIR
Run Chromium and WebKit serially. A fresh browser context starts cold; later
poses intentionally share its ordinary browser cache. Local-host timings are
comparative QA, not internet or physical-phone performance guarantees.
Settlement covers only the surrounding-city controller; core detail workers may
still be active, so screenshots are not complete-core preservation fixtures.
Immediate residency can include the ordinary 1.8s previous-view grace period;
use --retention-audit for a separate untimed post-eviction snapshot.
Route settledMs includes all 48 pose commands, their waits/frame work and the
final settlement period; it is not load latency measured from the final pose.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import time
from pathlib import Path
from typing import Any
from urllib.request import urlopen

from smoke_mode_continuity import (
  LABELS,
  PROBE,
  assert_pose,
  near,
  select_mode,
  viewer_url,
  wait_ready,
)

POSES = {
  "mitte-high": ([3100, 1800, 2500], [800, 15, 200]),
  "spandau-high": ([-9350, 1500, -20], [-11550, 12, -2120]),
  "koepenick-high": ([15985, 1800, 10560], [13685, 12, 8360]),
}
ROUTE = [
  ([3000, 1800, 2500], [800, 15, 200]),
  ([-5000, 1700, 500], [-3300, 15, 1900]),
  ([3800, 1800, -3300], [2360, 15, -5680]),
  ([6700, 1700, 2700], [5118, 15, 387]),
  ([3100, 1800, 2500], [800, 15, 200]),
]
CHUNK_PATH = "/surrounding-berlin-v159/"
FLIGHT_PROBE = r"""(() => {
  const q = window.__highFlight = {resources:[], contextLosses:0, phase:null};
  performance.setResourceTimingBufferSize(20000);
  new PerformanceObserver(list => {
    for(const e of list.getEntries()) if(q.resources.length<20000)
      q.resources.push({url:e.name,start:e.startTime,end:e.responseEnd,
        duration:e.duration,transferBytes:e.transferSize,
        encodedBytes:e.encodedBodySize,decodedBytes:e.decodedBodySize});
  }).observe({type:'resource',buffered:true});
  document.addEventListener('webglcontextlost',()=>q.contextLosses++,true);
  const id = node => node.name.replace(/^Surrounding Berlin outline /,'')
    .replace(/ native Minecraft$/,'');
  function inView(e,b) {
    const points=[];
    for(const x of [b[0],b[2]])for(const y of [-12,410])for(const z of [b[1],b[3]])
      points.push([e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],
        e[2]*x+e[6]*y+e[10]*z+e[14],e[3]*x+e[7]*y+e[11]*z+e[15]]);
    return ![0,1,2].some(axis=>[-1,1].some(sign=>points.every(p=>sign*p[axis]>p[3])));
  }
  q.pose = pose => {
    const r=window.__modeContinuityRuntime(), old=r.controls.enableDamping;
    r.controls.enableDamping=false;r.camera.position.fromArray(pose.position);
    r.controls.target.fromArray(pose.target);r.camera.fov=pose.fov??40;
    r.camera.updateProjectionMatrix();r.controls.update();
    r.controls.enableDamping=old;r.renderInvalidated=true;
  };
  q.read = () => {
    const r=window.__modeContinuityRuntime(), c=r?.surroundingCity;
    if(!r)return null;
    r.camera.updateMatrixWorld();
    const roots=c?.root.children??[], resident=new Set(roots.map(id));
    const withGeometry=new Set(roots.filter(n=>n.children.some(o=>
      o.geometry?.attributes.position?.count>0)).map(id));
    const key=[...r.camera.projectionMatrix.elements,
      ...r.camera.matrixWorldInverse.elements].join(',');
    if(q.visibility?.key!==key||q.visibility.manifest!==c?.manifest){
      const exact=r.camera.projectionMatrix.clone().multiply(r.camera.matrixWorldInverse);
      const expanded=r.camera.projectionMatrix.clone();
      expanded.elements[0]/=1.18;expanded.elements[5]/=1.18;
      expanded.multiply(r.camera.matrixWorldInverse);
      const visible=[],wanted=[];
      for(const d of c?.manifest?.chunks??[]){
        if(inView(exact.elements,d.bounds))visible.push(d.id);
        const b=d.bounds,p=r.camera.position,
          dx=Math.max(b[0]-p.x,0,p.x-b[2]),dz=Math.max(b[1]-p.z,0,p.z-b[3]);
        if(dx*dx+dz*dz<180*180||inView(expanded.elements,b))wanted.push(d.id);
      }
      q.visibility={key,manifest:c?.manifest,visible,wanted};
    }
    const {visible,wanted}=q.visibility;
    const attached=visible.filter(n=>resident.has(n)&&withGeometry.has(n));
    return {now:performance.now(),mode:r.lightingMode,ready:r.presentationReady,
      presented:!!document.querySelector('.three-viewer.is-active.is-presentation-ready'),
      contextLost:r.renderer.getContext().isContextLost(),contextLosses:q.contextLosses,
      pending:c?.pending??false,manifestReady:!!c?.manifest,
      residentChunks:c?.residentChunkCount??0,geometryBytes:c?.residentGeometryBytes??0,
      bufferCount:c?.residentBufferCount??0,visibleSourceChunks:attached.length,
      visibleSourceIds:attached,wantedChunks:wanted.length,
      missingWanted:wanted.filter(n=>!resident.has(n)).length,
      calls:r.renderer.info.render.calls,geometries:r.renderer.info.memory.geometries,
      position:r.camera.position.toArray(),target:r.controls.target.toArray(),fov:r.camera.fov};
  };
  q.begin = (name,pose) => {
    if(pose)q.pose(pose);
    const state=q.read();
    q.phase={name,start:performance.now(),initialVisible:state.visibleSourceChunks,
      initialIds:new Set((window.__modeContinuityRuntime()?.surroundingCity?.root.children??[]).map(id)),
      firstVisibleMs:state.visibleSourceChunks?0:null,firstNewVisibleMs:null,
      settledMs:null,quietSince:null,samples:[],lastSample:null,maxSampleGapMs:0};
    q.tick();return q.phase.start;
  };
  q.tick = () => {
    const p=q.phase;if(!p)return;
    const s=q.read();if(!s)return;
    const t=s.now-p.start;
    if(p.lastSample!==null)p.maxSampleGapMs=Math.max(p.maxSampleGapMs,s.now-p.lastSample);
    p.lastSample=s.now;
    if(p.firstVisibleMs===null&&s.visibleSourceChunks)p.firstVisibleMs=t;
    if(p.firstNewVisibleMs===null&&s.visibleSourceIds.some(id=>!p.initialIds.has(id)))p.firstNewVisibleMs=t;
    if(s.manifestReady&&!s.pending&&s.missingWanted===0){
      p.quietSince??=s.now;
      if(t>=750&&s.now-p.quietSince>=750)p.settledMs??=t;
    }else p.quietSince=null;
    if(p.samples.length<3000){delete s.visibleSourceIds;p.samples.push({...s,elapsedMs:t});}
  };
  q.finish = () => {
    q.tick();const p=q.phase,s=q.read(),now=performance.now();
    const resources=q.resources.filter(e=>e.start>=p.start&&e.url.includes('/surrounding-berlin-v159/'));
    const output={name:p.name,durationMs:now-p.start,firstVisibleMs:p.firstVisibleMs,
      firstNewVisibleMs:p.firstNewVisibleMs,settledMs:p.settledMs,
      initialVisibleChunks:p.initialVisible,maxSampleGapMs:p.maxSampleGapMs,
      chunkResources:{completed:resources.length,
        transferBytes:resources.reduce((n,r)=>n+r.transferBytes,0),
        encodedBytes:resources.reduce((n,r)=>n+r.encodedBytes,0),
        decodedBytes:resources.reduce((n,r)=>n+r.decodedBytes,0),
        browserCacheHits:resources.filter(r=>r.transferBytes===0&&r.encodedBytes>0).length},
      final:s,samples:p.samples};
    q.phase=null;return output;
  };
  setInterval(()=>q.tick(),100);
})();"""


def pose(position: list[float], target: list[float]) -> dict[str, Any]:
  return {"position": position, "target": target, "fov": 40}


def validate(state: dict[str, Any], mode: str) -> None:
  assert state["mode"] == mode and state["ready"] and state["presented"], state
  assert not state["contextLost"] and state["contextLosses"] == 0, state
  assert state["calls"] > 0, state


def settle(page: Any, timeout: float) -> bool:
  deadline = time.monotonic() + timeout
  while time.monotonic() < deadline:
    if page.evaluate("window.__highFlight.phase?.settledMs!==null"):
      return True
    page.wait_for_timeout(250)
  return False


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=["chromium", "webkit"], default="chromium")
  parser.add_argument("--output", type=Path, required=True)
  parser.add_argument("--modes", default="day,minecraft,day")
  parser.add_argument("--poses", default=",".join(POSES))
  parser.add_argument("--timeout", type=float, default=90)
  parser.add_argument("--route-leg-seconds", type=float, default=1.2)
  parser.add_argument("--skip-route", action="store_true")
  parser.add_argument(
    "--retention-audit",
    action="store_true",
    help="Add an untimed snapshot 2.2s after each phase for offscreen eviction QA",
  )
  parser.add_argument(
    "--latency-ms",
    type=float,
    default=0,
    help="Chromium-only CDP latency emulation; no throughput or CPU throttling",
  )
  args = parser.parse_args()
  modes, names = args.modes.split(","), args.poses.split(",")
  if any(m not in LABELS for m in modes) or any(n not in POSES for n in names):
    parser.error("Unknown mode or pose")
  if any(
    not math.isfinite(v) or v <= 0 for v in (args.timeout, args.route_leg_seconds)
  ):
    parser.error("Timing limits must be positive finite numbers")
  if not math.isfinite(args.latency_ms) or args.latency_ms < 0:
    parser.error("Latency must be a nonnegative finite number")
  if args.latency_ms and args.engine != "chromium":
    parser.error("Latency emulation is Chromium-only")
  from playwright.sync_api import sync_playwright

  args.output.mkdir(parents=True, exist_ok=True)
  html = urlopen(args.url, timeout=10).read()
  report: dict[str, Any] = {
    "url": args.url,
    "engine": args.engine,
    "retentionAudit": args.retention_audit,
    "networkEmulation": {
      "latencyMs": args.latency_ms,
      "throughputLimited": False,
      "cpuThrottled": False,
    },
    "indexSha256": hashlib.sha256(html).hexdigest(),
    "entryAssets": re.findall(r'(?:src|href)="([^"]*/assets/[^"]+)"', html.decode()),
    "poses": POSES,
    "route": ROUTE,
    "scope": "First visible = attached source-bearing chunk in exact camera frustum. "
    "Settled = no pending work and all expanded-frustum descriptors resident for 750ms. "
    "100ms polling resolution; local static host, fresh browser context; ordinary cache "
    "retained across poses. Core detail workers are not part of settlement. "
    "Immediate residency may include 1.8s previous-view retention. "
    "Route settledMs includes scripted motion plus final settlement. "
    "WebKit iPhone13 emulation is not physical-phone timing.",
    "runs": [],
    "transitions": [],
    "errors": [],
    "warnings": [],
    "requests": [],
  }
  network = {"started": 0, "finished": 0, "failed": 0}
  started = time.monotonic()

  def request_event(request: Any, kind: str) -> None:
    if CHUNK_PATH not in request.url:
      return
    network[kind] += 1
    report["requests"].append(
      {
        "event": kind,
        "url": request.url,
        "elapsedMs": (time.monotonic() - started) * 1000,
        **({"failure": request.failure} if kind == "failed" else {}),
      }
    )

  def save() -> None:
    (args.output / "report.json").write_text(json.dumps(report, indent=2))

  def finish(page: Any, mode: str, label: str, previous: dict[str, int]) -> None:
    result = page.evaluate("window.__highFlight.finish()")
    result["mode"] = mode
    result["settledWithinTimeout"] = result["settledMs"] is not None
    result["timingKind"] = (
      "route-plus-settlement"
      if result["name"] == "rapid-flight-pan-route"
      else "pose-settlement"
    )
    result["network"] = {k: network[k] - previous[k] for k in network}
    validate(result["final"], mode)
    if args.retention_audit:
      # This is deliberately outside the measured phase: the ordinary controller
      # may keep previous-view chunks for 1.8s even after the new view is complete.
      page.wait_for_timeout(2200)
      result["afterRetention"] = page.evaluate("window.__highFlight.read()")
      validate(result["afterRetention"], mode)
    report["runs"].append(result)
    page.screenshot(path=str(args.output / f"{len(report['runs']):02}-{label}.png"))
    save()
    print(json.dumps({k: v for k, v in result.items() if k != "samples"}), flush=True)

  try:
    with sync_playwright() as p:
      touch = args.engine == "webkit"
      browser = getattr(p, args.engine).launch(
        headless=True, **({} if touch else {"channel": "chrome"})
      )
      try:
        page = browser.new_page(
          **(
            p.devices["iPhone 13"]
            if touch
            else {"viewport": {"width": 1440, "height": 1000}}
          )
        )
        if args.latency_ms:
          cdp = page.context.new_cdp_session(page)
          cdp.send("Network.enable")
          cdp.send(
            "Network.emulateNetworkConditions",
            {
              "offline": False,
              "latency": args.latency_ms,
              "downloadThroughput": -1,
              "uploadThroughput": -1,
            },
          )
        page.add_init_script(PROBE)
        page.add_init_script(FLIGHT_PROBE)
        page.on("pageerror", lambda e: report["errors"].append(str(e)))
        page.on("crash", lambda: report["errors"].append("Browser page crashed"))
        page.on(
          "console",
          lambda m: (
            report["errors"].append(m.text)
            if m.type == "error"
            else report["warnings"].append(m.text)
            if m.type == "warning"
            else None
          ),
        )
        page.on("request", lambda r: request_event(r, "started"))
        page.on("requestfinished", lambda r: request_event(r, "finished"))
        page.on("requestfailed", lambda r: request_event(r, "failed"))
        page.goto(viewer_url(args.url), wait_until="domcontentloaded")
        wait_ready(page, "day", 180)
        report["startupMs"] = (time.monotonic() - started) * 1000
        current_mode = "day"
        for mode_index, mode in enumerate(modes):
          if mode != current_mode:
            before = page.evaluate("window.__readModeContinuity()")
            switched = time.monotonic()
            select_mode(page, mode, touch)
            actual = wait_ready(page, mode, 180)
            assert_pose(actual, before)
            report["transitions"].append(
              {
                "from": current_mode,
                "to": mode,
                "posePreserved": True,
                "readyMs": (time.monotonic() - switched) * 1000,
              }
            )
            current_mode = mode
          # Returning to the first family checks remount/cache recovery once.
          selected = names[:1] if mode_index > 1 else names
          for name in selected:
            position, target = POSES[name]
            requested = pose(position, target)
            prior = dict(network)
            page.evaluate(
              "([name,pose])=>window.__highFlight.begin(name,pose)", [name, requested]
            )
            settle(page, args.timeout)
            actual = page.evaluate("window.__readModeContinuity()")
            for key in ("position", "target", "fov"):
              near(actual[key], requested[key], key)
            finish(page, mode, f"{mode}-{name}", prior)
          if not args.skip_route and mode_index == 0:
            prior = dict(network)
            page.evaluate(
              "([name,pose])=>window.__highFlight.begin(name,pose)",
              ["rapid-flight-pan-route", pose(*ROUTE[0])],
            )
            for first, last in zip(ROUTE, ROUTE[1:], strict=False):
              frames = 12
              for step in range(1, frames + 1):
                fraction = step / frames
                position = [
                  a + (b - a) * fraction for a, b in zip(first[0], last[0], strict=True)
                ]
                target = [
                  a + (b - a) * fraction for a, b in zip(first[1], last[1], strict=True)
                ]
                page.evaluate(
                  "pose=>window.__highFlight.pose(pose)", pose(position, target)
                )
                page.wait_for_timeout(args.route_leg_seconds * 1000 / frames)
            # Settlement starts after the final route pose, not an earlier leg.
            page.evaluate(
              "()=>{const p=window.__highFlight.phase;p.settledMs=null;p.quietSince=null;}"
            )
            settle(page, args.timeout)
            finish(page, mode, "rapid-flight-pan-route", prior)
          assert not report["errors"], report["errors"]
        report["networkTotals"] = network
        report["resourceTotals"] = page.evaluate(
          "()=>{const a=window.__highFlight.resources;return {count:a.length,"
          "transferBytes:a.reduce((n,r)=>n+r.transferBytes,0),"
          "encodedBytes:a.reduce((n,r)=>n+r.encodedBytes,0)};}"
        )
        report["incompletePhases"] = [
          f"{r['mode']}:{r['name']}"
          for r in report["runs"]
          if not r["settledWithinTimeout"]
        ]
        assert not report["incompletePhases"], report["incompletePhases"]
      finally:
        browser.close()
  except Exception as error:
    report["failure"] = str(error)
    raise
  finally:
    report["elapsedSeconds"] = time.monotonic() - started
    save()
  print(
    json.dumps({"runs": len(report["runs"]), "errors": report["errors"]}), flush=True
  )


if __name__ == "__main__":
  main()
