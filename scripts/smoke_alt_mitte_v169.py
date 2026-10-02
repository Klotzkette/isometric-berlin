"""Inspect the complete resident Alt-Mitte envelopes and bounded facade packets.

Run with uv run --with playwright python scripts/smoke_alt_mitte_v169.py URL.
Use --engine webkit --touch for the iPhone 13 browser profile, or chromium
with --touch for Android input/rendering. Emulation cannot certify device RAM.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from smoke_mobile_memory import BUFFER_PROBE, READ_STATE, validate_sample
from smoke_mode_continuity import (
  PROBE,
  seed_camera,
  select_mode,
  viewer_url,
  wait_ready,
)

VIEWS = (
  ("mitte-northwest", [600, -1500]),
  ("mitte-north", [1800, -1300]),
  ("mitte-east", [2800, -550]),
  ("mitte-southeast", [2800, 650]),
  ("mitte-south", [1500, 850]),
  ("mitte-west", [450, -500]),
)
STREAM_REQUIRED_VIEWS = frozenset(name for name, _ in VIEWS[:2])
READ_ALT_MITTE = """target => {
  const r=window.__modeContinuityRuntime();
  if(!r)return null;
  const visible=node=>{if(!node)return false;while(node){if(!node.visible)return false;node=node.parent;}return true;};
  const geometry=root=>{
    let triangles=0,renderables=0,bytes=0;
    const buffers=new Set();
    const add=attribute=>{const a=attribute?.data?.array??attribute?.array;
      if(a&&!buffers.has(a.buffer)){buffers.add(a.buffer);bytes+=a.buffer.byteLength;}};
    root?.traverse(node=>{if(!node.geometry)return;renderables++;
      if(node.isMesh)triangles+=(node.geometry.index?.count??node.geometry.attributes.position?.count??0)/3;
      for(const a of Object.values(node.geometry.attributes))add(a);
      add(node.geometry.index);});
    return {triangles,renderables,geometryBytes:bytes,bufferCount:buffers.size};
  };
  const names=['Alt-Mitte complete resident source envelopes','Alt-Mitte complete resident native source envelopes'];
  const roots=names.map(name=>{
    const found=[];r.scene.traverse(node=>{if(node.name===name)found.push(node);});
    const node=found[0];
    const targetTriangles=(node?.children??[]).filter(child=>target&&target[0]>=child.position.x&&target[0]<child.position.x+512&&target[1]>=child.position.z&&target[1]<child.position.z+512).reduce((n,child)=>n+geometry(child).triangles,0);
    return {name,count:found.length,visible:visible(node),...geometry(node),targetTriangles,
      declaredGeometryBytes:node?.userData.geometryBytes??0,
      sourceParents:node?.userData.sourceParents?.length??0,
      sourceChunks:node?.userData.sourceChunkIds?.length??0};
  });
  const city=r.surroundingCity;
  const descriptors=new Map((city?.manifest?.chunks??[]).map(chunk=>[chunk.id,chunk]));
  const packets=(city?.root.children??[]).filter(node=>node.userData.sourceKinds?.includes('alt-mitte-v169')).map(node=>{
    const id=node.name.replace(/^Surrounding Berlin outline /,'').replace(/ native Minecraft$/,'');
    const bounds=descriptors.get(id)?.bounds;
    const atTarget=!!target&&!!bounds&&target[0]>=bounds[0]&&target[0]<bounds[2]&&target[1]>=bounds[1]&&target[1]<bounds[3];
    return {id,name:node.name,visible:visible(node),atTarget,bounds,...geometry(node)};
  });
  return {roots,packets,pending:!!city?.pending,
    manifestedPackets:city?.manifest?.chunks.filter(chunk=>chunk.id.includes('-alt-mitte-v169-')).length??0,
    residentPacketGeometryBytes:packets.reduce((n,p)=>n+p.geometryBytes,0),
    visiblePacketTriangles:packets.filter(p=>p.visible).reduce((n,p)=>n+p.triangles,0),
    targetPacketTriangles:packets.filter(p=>p.visible&&p.atTarget).reduce((n,p)=>n+p.triangles,0)};
}"""


def validate_alt_mitte(
  sample: dict[str, Any],
  mode: str,
  require_stream: bool,
  require_core_at_target: bool = False,
) -> None:
  """An idle loader is insufficient: require actual source-bearing geometry."""
  data = sample["altMitte"]
  expected = 1 if mode == "minecraft" else 0
  active = data["roots"][expected]
  inactive = data["roots"][1 - expected]
  assert active["count"] == 1 and active["visible"], sample
  assert inactive["count"] <= 1 and not inactive["visible"], sample
  assert active["triangles"] > 0 and active["renderables"] > 0, sample
  assert active["sourceChunks"] > 0 and active["sourceParents"] > 0, sample
  assert active["geometryBytes"] == active["declaredGeometryBytes"] > 0, sample
  if require_core_at_target:
    assert active["targetTriangles"] > 0, sample
  if require_stream:
    assert data["manifestedPackets"] > 0, sample
    assert data["visiblePacketTriangles"] > 0 and data["targetPacketTriangles"] > 0, (
      sample
    )
    assert data["residentPacketGeometryBytes"] > 0, sample


def run(args: argparse.Namespace) -> None:
  from playwright.sync_api import sync_playwright

  report: dict[str, Any] = {
    "engine": args.engine,
    "touch": args.touch,
    "startup": [],
    "samples": [],
    "errors": [],
  }
  args.output.mkdir(parents=True, exist_ok=True)
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
        if (message.type == "error" and "interactive-widget" not in message.text)
        or "Berlin surroundings:" in message.text
        else None
      ),
    )
    try:
      page.goto(viewer_url(args.url))
      wait_ready(page, "day", 120)
      modes = args.modes or (
        ("day",)
        if args.baseline
        else ("day", "schwellenraum", "minecraft", "night", "snowstorm", "day")
      )
      for visit, mode in enumerate(modes):
        if visit or mode != "day":
          select_mode(page, mode, args.touch)
          wait_ready(page, mode, 120)
        if not args.baseline:
          startup = {
            "mode": mode,
            "visit": visit,
            "altMitte": page.evaluate(READ_ALT_MITTE),
            "nativePacketRequests": page.evaluate(
              "() => performance.getEntriesByType('resource').filter(entry => "
              "entry.name.includes('alt-mitte-v169-native-packet-')).length"
            ),
          }
          validate_alt_mitte(startup, mode, False)
          if visit == 0 and mode == "day":
            assert startup["nativePacketRequests"] == 0, startup
          report["startup"].append(startup)
        for name, (x, z) in VIEWS:
          if args.views and name not in args.views:
            continue
          seed_camera(
            page, {"position": [x + 180, 140, z + 180], "target": [x, 12, z], "fov": 45}
          )
          page.wait_for_timeout(2200)
          page.wait_for_function(
            "() => {const c=window.__modeContinuityRuntime()?.surroundingCity;return c?.manifest && !c.pending;}"
          )
          if (
            not args.baseline and mode != "minecraft" and name in STREAM_REQUIRED_VIEWS
          ):
            # A rejected request can also clear pending. Wait for real new
            # facade meshes, then inspect their actual resident buffer sizes.
            page.wait_for_function(
              "() => {const r=window.__modeContinuityRuntime();let triangles=0;"
              "for(const root of r?.surroundingCity?.root.children??[]) {"
              "if(!root.visible||!root.userData.sourceKinds?.includes('alt-mitte-v169'))continue;"
              "root.traverse(n=>{if(n.isMesh)triangles+=(n.geometry.index?.count??0)/3;});}"
              "return triangles>0;}"
            )
          page.wait_for_timeout(500)
          sample = page.evaluate(READ_STATE)
          sample.update(
            view=name, visit=visit, altMitte=page.evaluate(READ_ALT_MITTE, [x, z])
          )
          report["samples"].append(sample)
          if not args.baseline:
            validate_alt_mitte(
              sample,
              mode,
              mode != "minecraft" and name in STREAM_REQUIRED_VIEWS,
              mode == "minecraft" and name in STREAM_REQUIRED_VIEWS,
            )
          if args.touch:
            validate_sample(sample, mode)
          else:
            assert sample["ready"] and not sample["contextLost"] and sample["lost"] == 0
          assert not report["errors"], report["errors"]
          if visit < 3:
            page.screenshot(path=str(args.output / f"{mode}-{name}.png"))
          print(json.dumps({"mode": mode, "sample": sample}), flush=True)
      report["success"] = True
    except Exception as exc:
      report["exception"] = str(exc)
      if "Browser page crashed" not in report["errors"]:
        try:
          report["failureState"] = page.evaluate(
            "() => {const r=window.__modeContinuityRuntime();return {"
            "mode:r?.lightingMode,ready:window.__readModeContinuity?.(),"
            "progressive:r?.progressiveWorldState,text:document.body.innerText};}"
          )
          page.screenshot(path=str(args.output / "failure.png"))
        except Exception as inspection_error:
          report["inspectionError"] = str(inspection_error)
      raise
    finally:
      (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
      context.close()
      browser.close()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  parser.add_argument("--touch", action="store_true")
  parser.add_argument("--baseline", action="store_true")
  parser.add_argument("--views", nargs="+", choices=[view[0] for view in VIEWS])
  parser.add_argument(
    "--modes",
    nargs="+",
    choices=["day", "schwellenraum", "minecraft", "night", "snowstorm"],
  )
  parser.add_argument("--output", type=Path, default=Path("/tmp/alt-mitte-v169-smoke"))
  run(parser.parse_args())
