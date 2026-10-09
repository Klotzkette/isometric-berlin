"""Exercise six modes, far/near GPU retirement and exact resident source reuse.

  uv run --with playwright python scripts/smoke_runtime_stability.py URL
  uv run --with playwright python scripts/smoke_runtime_stability.py URL \
    --engine webkit --touch

The bounded route normally takes about three minutes including cold family
construction. --max-seconds is a hard operation deadline, not an FPS target.
The browser profiles do not establish physical phone RAM limits. GPU figures
count vertex/index/instance buffers only, excluding textures and driver memory.
Only camera seeding writes viewer state; probes observe the real runtime and
source BufferGeometry disposal events without removing or replacing geometry.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlsplit

from smoke_flood_mode import FLOOD_BUFFER_PROBE, READ_FLOOD, flood_url, validate_water
from smoke_mobile_memory import BUFFER_PROBE, READ_STATE, validate_sample
from smoke_mode_continuity import (
  PROBE,
  assert_pose,
  seed_camera,
  select_mode,
  wait_ready,
)

MODES = ("flood", "day", "night", "snowstorm", "schwellenraum", "minecraft", "flood")
ROUTE = (
  ("brandenburg-near", [522, 52, 319], [417.898, 17, 300.453], 39),
  ("wide-city", [-1300, 1500, -1300], [0, 5, 0], 50),
  ("city-west", [-3280, 260, 1340], [-3000, 8, 1060], 50),
  ("brandenburg-return", [522, 52, 319], [417.898, 17, 300.453], 39),
)

# Only the permanently resident source envelopes are compared. Streamed facade
# packets may correctly leave/re-enter the scene, so their array content is
# deliberately outside this invariant. Hashes compare the exact bytes even after lossless CPU rehydration.
SOURCE_PROBE = """(() => {
  const runtimes=new WeakMap();
  window.__runtimeStabilitySource=async()=>{
    const r=window.__modeContinuityRuntime();if(!r)return null;
    let state=runtimes.get(r);
    if(!state){state={roots:new WeakMap(),hashes:new WeakMap()};runtimes.set(r,state);}
    const visible=n=>{while(n){if(!n.visible)return false;n=n.parent;}return true;};
    const names=['Alt-Mitte complete resident source envelopes','Alt-Mitte complete resident native source envelopes'];
    const results=[];
    for(let i=0;i<names.length;i++){
      const list=[];r.scene.traverse(n=>{if(n.name===names[i])list.push(n);});
      const root=list[0];
      if(!root){results.push({family:i===1?'native':'drawn',count:0,visible:false});continue;}
      let record=state.roots.get(root);
      if(!record){record={disposals:0,watched:new WeakSet()};state.roots.set(root,record);}
      let triangles=0,renderables=0,bytes=0;
      const buffers=new Set(),signature=[],pending=[];
      const add=(key,attribute)=>{
        const array=attribute?.data?.array??attribute?.array;if(!array)return;
        if(!buffers.has(array.buffer)){buffers.add(array.buffer);bytes+=array.buffer.byteLength;}
        const entry=[key,array.constructor.name,array.byteOffset,array.byteLength,null];
        const cached=state.hashes.get(array);
        // WebCrypto copies the bytes synchronously before the next task can
        // retire an exclusively owned decoded backing buffer.
        const digest=cached ? null : crypto.subtle.digest('SHA-256',new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
        signature.push(entry);pending.push([entry,array,cached,digest]);
      };
      root.traverse(n=>{
        if(!n.geometry)return;
        const g=n.geometry;renderables++;
        if(!record.watched.has(g)){
          record.watched.add(g);g.addEventListener('dispose',()=>record.disposals++);
        }
        if(n.isMesh)triangles+=(g.index?.count??g.attributes.position?.count??0)/3;
        signature.push(g.uuid);
        for(const [key,attribute]of Object.entries(g.attributes))add(key,attribute);
        add('index',g.index);
      });
      // Compare actual byte content after lossless rehydration, not allocation identity.
      // The root/geometry UUIDs still catch hidden replacement or reconstruction.
      for(const [entry,array,cached,digest] of pending){
        let hash=cached;
        if(!hash){
          hash=Array.from(new Uint8Array(await digest),v=>v.toString(16).padStart(2,'0')).join('');state.hashes.set(array,hash);
        }
        entry[4]=hash;
      }
      results.push({family:i===1?'native':'drawn',count:list.length,visible:visible(root),
        uuid:root.uuid,triangles,renderables,bytes,bufferCount:buffers.size,
        declaredBytes:root.userData.geometryBytes,
        parents:root.userData.sourceParents?.length??0,
        chunks:root.userData.sourceChunkIds?.length??0,
        sourceGpuDisposals:record.disposals,arrayContent:JSON.stringify(signature)});
    }
    return results;
  };
})();"""


def family(mode: str) -> str:
  """Only Minecraft owns a distinct source-geometry family."""
  return "native" if mode == "minecraft" else "drawn"


def validate_runtime_transition(
  previous: dict[str, Any], current: dict[str, Any], touch: bool
) -> None:
  """Recovery/remounts must not silently disguise a failed normal transition."""
  expected_remount = touch and family(previous["mode"]) != family(current["mode"])
  assert (previous["runtime"] != current["runtime"]) == expected_remount, {
    "previous": previous,
    "current": current,
    "expectedRemount": expected_remount,
  }
  assert_pose(current, previous)


def validate_source(
  sources: list[dict[str, Any]], mode: str, baseline: dict[str, Any] | None
) -> dict[str, Any]:
  """Require the complete unchanged resident source, even after GPU disposal."""
  active = next(source for source in sources if source["family"] == family(mode))
  inactive = next(source for source in sources if source["family"] != family(mode))
  assert active["count"] == 1 and active["visible"], sources
  assert inactive["count"] <= 1 and not inactive["visible"], sources
  assert active["bytes"] == active["declaredBytes"] > 0, active
  for field in ("triangles", "renderables", "parents", "chunks", "bufferCount"):
    assert active[field] > 0, (field, active)
  if baseline is not None:
    for field in (
      "uuid",
      "triangles",
      "renderables",
      "bytes",
      "bufferCount",
      "parents",
      "chunks",
      "arrayContent",
    ):
      assert active[field] == baseline[field], {"changed": field, "source": active}
  return active


def reclamation_evidence(samples: list[dict[str, Any]]) -> list[dict[str, Any]]:
  """Require actual GL deletion and retained CPU ownership in the same runtime."""
  prior: dict[tuple[int, str], dict[str, Any]] = {}
  evidence = []
  for sample in samples:
    source = sample["source"]
    key = (sample["pose"]["runtime"], source["family"])
    before = prior.get(key)
    if before is not None:
      retired = source["sourceGpuDisposals"] - before["source"]["sourceGpuDisposals"]
      deleted = sample["buffers"]["deletes"] - before["buffers"]["deletes"]
      if retired > 0 and deleted > 0:
        assert source["arrayContent"] == before["source"]["arrayContent"], sample
        evidence.append(
          {
            "runtime": key[0],
            "family": key[1],
            "from": before["view"],
            "to": sample["view"],
            "sourceGpuDisposals": retired,
            "deletedGlBuffers": deleted,
            "retainedSourceBytes": source["bytes"],
          }
        )
    prior[key] = sample
  return evidence


def run(args: argparse.Namespace) -> None:
  from playwright.sync_api import sync_playwright

  report: dict[str, Any] = {
    "engine": args.engine,
    "touch": args.touch,
    "samples": [],
    "transitions": [],
    "errors": [],
    "maxSeconds": args.max_seconds,
  }
  args.output.mkdir(parents=True, exist_ok=True)
  started = time.monotonic()
  with sync_playwright() as playwright:
    browser = getattr(playwright, args.engine).launch(
      **({"channel": "chrome"} if args.engine == "chromium" else {})
    )
    context = browser.new_context(
      **(
        playwright.devices["iPhone 13" if args.engine == "webkit" else "Pixel 5"]
        if args.touch
        else {"viewport": {"width": 1365, "height": 900}}
      )
    )
    for probe in (PROBE, BUFFER_PROBE, FLOOD_BUFFER_PROBE, SOURCE_PROBE):
      context.add_init_script(probe)
    page = context.new_page()
    page.on("pageerror", lambda error: report["errors"].append(str(error)))
    page.on("crash", lambda: report["errors"].append("Browser page crashed"))
    page.on(
      "console",
      lambda message: (
        report["errors"].append(message.text)
        if (message.type == "error" and "interactive-widget" not in message.text)
        or "Berlin surroundings:" in message.text
        else None
      ),
    )
    baselines: dict[tuple[int, str], dict[str, Any]] = {}
    waters: dict[int, dict[str, Any]] = {}

    def remaining() -> float:
      seconds = args.max_seconds - (time.monotonic() - started)
      assert seconds > 0, "Runtime stability route exceeded its operation deadline"
      page.set_default_timeout(seconds * 1000)
      return seconds

    def sample(mode: str, view: str, visit: int) -> None:
      remaining()
      state = page.evaluate(READ_STATE)
      pose = page.evaluate("window.__readModeContinuity()")
      assert pose["runtime"] == active_runtime, (
        "Unexpected runtime replacement during travel"
      )
      assert state["ready"] and state["mode"] == mode, state
      assert state["lost"] == 0 and not state["contextLost"], state
      for field in (
        "instanceResidentBytes",
        "instanceResidentBuffers",
        "geometryResidentBuffers",
      ):
        assert state[field] is not None, state
      if args.touch:
        validate_sample(state, mode)
      sources = page.evaluate("window.__runtimeStabilitySource()")
      key = (pose["runtime"], family(mode))
      source = validate_source(sources, mode, baselines.get(key))
      baselines.setdefault(key, source)
      flood = page.evaluate(READ_FLOOD)
      if mode == "flood":
        assert len(flood["water"]) == 1, flood
        waters.setdefault(pose["runtime"], flood["water"][0])
      if pose["runtime"] in waters:
        validate_water(flood, mode, waters[pose["runtime"]])
      else:
        assert not flood["water"], flood
      state.update(view=view, visit=visit, pose=pose, source=source, flood=flood)
      report["samples"].append(state)
      assert not report["errors"], report["errors"]
      print(
        json.dumps(
          {
            "mode": mode,
            "view": view,
            "runtime": pose["runtime"],
            "buffers": state["buffers"],
            "sourceGpuDisposals": source["sourceGpuDisposals"],
          }
        ),
        flush=True,
      )

    try:
      remaining()
      page.goto(flood_url(args.url))
      previous = wait_ready(page, "flood", remaining())
      active_runtime = previous["runtime"]
      for visit, mode in enumerate(MODES):
        if visit:
          previous = page.evaluate("window.__readModeContinuity()")
          remaining()
          select_mode(page, mode, args.touch)
          current = wait_ready(page, mode, remaining())
          validate_runtime_transition(previous, current, args.touch)
          report["transitions"].append({"previous": previous, "current": current})
          active_runtime = current["runtime"]
        for name, position, target, fov in ROUTE:
          remaining()
          seed_camera(page, {"position": position, "target": target, "fov": fov})
          page.wait_for_timeout(min(args.settle_ms, remaining() * 1000))
          sample(mode, name, visit)
        if args.screenshots:
          page.screenshot(path=str(args.output / f"{visit}-{mode}.png"))
      report["reclamation"] = reclamation_evidence(report["samples"])
      assert report["reclamation"], (
        "No observed GPU retirement with preserved resident source"
      )
      report["success"] = True
    except Exception as exc:
      report["exception"] = str(exc)
      try:
        report["failureState"] = page.evaluate(READ_STATE)
      except Exception as inspection_error:
        report["inspectionError"] = str(inspection_error)
      raise
    finally:
      report["elapsedSeconds"] = time.monotonic() - started
      (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
      context.close()
      browser.close()


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  parser.add_argument("--touch", action="store_true")
  parser.add_argument("--settle-ms", type=int, default=800)
  parser.add_argument("--max-seconds", type=float, default=240)
  parser.add_argument("--screenshots", action="store_true")
  parser.add_argument("--output", type=Path, default=Path("/tmp/runtime-stability"))
  args = parser.parse_args()
  if urlsplit(args.url).scheme not in {"http", "https"}:
    parser.error("Provide an HTTP(S) viewer URL")
  if args.max_seconds <= 0 or args.settle_ms < 0:
    parser.error("Use a positive deadline and a nonnegative settle duration")
  run(args)


if __name__ == "__main__":
  main()
