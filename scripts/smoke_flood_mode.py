"""Check real flooded-mode rendering, idle animation and navigation continuity.

Run through uv with Playwright; --engine webkit --touch uses the iPhone 13
browser profile. Browser emulation cannot certify physical iPhone memory.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from smoke_mobile_memory import BUFFER_PROBE, READ_STATE, validate_sample
from smoke_mode_continuity import (
  PROBE,
  assert_pose,
  enter_walk,
  open_mobile_actions,
  seed_camera,
  select_mode,
  wait_ready,
)

VIEWS = (
  ("reichstag", [158, 74, 58], [317.729, 23, 40.477], 39),
  ("brandenburg", [522, 52, 319], [417.898, 17, 300.453], 39),
  ("city-overview", [-1300, 1500, -1300], [0, 5, 0], 50),
)
ROUND_TRIP = ("day", "flood", "schwellenraum", "night", "snowstorm", "day", "flood")
DEPTHS = (3, 6, 21)
FLOOD_BUFFER_PROBE = """(() => {
  let nextId=0;
  const ids=new WeakMap(), uploads=new WeakMap();
  window.__floodObjectId=o=>{if(!ids.has(o))ids.set(o,++nextId);return ids.get(o);};
  window.__floodUploadedBuffer=a=>uploads.get(a)??null;
  for(const P of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype]) {
    if(!P)continue;
    const contexts=new WeakMap();
    const bind=P.bindBuffer,data=P.bufferData;
    P.bindBuffer=function(t,b){
      let bound=contexts.get(this);if(!bound){bound=new Map();contexts.set(this,bound);}
      bound.set(t,b);return bind.apply(this,arguments);
    };
    P.bufferData=function(t,a){
      const b=contexts.get(this)?.get(t);
      if(b&&ArrayBuffer.isView(a))uploads.set(a,window.__floodObjectId(b));
      return data.apply(this,arguments);
    };
  }
})();"""
READ_FLOOD = """() => {
  const r=window.__modeContinuityRuntime();if(!r)return null;
  const waters=[];r.scene.traverse(n=>{if(n.userData.floodWater)waters.push(n);});
  const visible=n=>{while(n){if(!n.visible)return false;n=n.parent;}return true;};
  const buffers=g=>[...Object.entries(g.attributes),['index',g.index]].filter(([,a])=>a);
  return {mode:r.lightingMode,frame:r.renderer.info.render.frame,
    depth:r.floodDepth,underwater:r.underwater,
    elapsed:r.floodElapsedSeconds,water:waters.map(n=>({
      name:n.name,uuid:n.uuid,visible:visible(n),geometryUuid:n.geometry.uuid,
      materialUuid:n.material.uuid,time:n.material.uniforms.time.value,
      offsetY:n.position.y,surfaceY:n.geometry.getAttribute('position').getY(0)+n.position.y,
      cpuBuffers:Object.fromEntries(buffers(n.geometry).map(([name,a])=>[name,
        [a,a.array,a.array.buffer].map(window.__floodObjectId)])),
      gpuBuffers:Object.fromEntries(buffers(n.geometry).map(([name,a])=>[name,
        window.__floodUploadedBuffer(a.array)])),
      positions:n.geometry.getAttribute('position').count,
      indices:n.geometry.index?.count??0,
      bytes:Object.values(n.geometry.attributes).reduce((v,a)=>v+a.array.byteLength,0)+(n.geometry.index?.array.byteLength??0),
      transparent:n.material.transparent,depthWrite:n.material.depthWrite,
      textures:Object.values(n.material.uniforms).filter(v=>v.value?.isTexture).length
    }))};
}"""


def flood_url(url: str) -> str:
  """Request the new mode on a genuinely cold page, with stable English UI."""
  parts = urlsplit(url)
  query = dict(parse_qsl(parts.query))
  query.update(lang="en", theme="flood")
  return urlunsplit(parts._replace(query=urlencode(query), fragment=""))


def validate_water(
  data: dict[str, Any], mode: str, identity: dict[str, Any], depth: int = 3
) -> None:
  """Each switch reuses the single finite water layer and its GPU geometry."""
  assert data["mode"] == mode, data
  assert depth in DEPTHS and data["depth"] == depth, data
  assert len(data["water"]) == 1, data
  water = data["water"][0]
  assert water["visible"] == (mode == "flood"), data
  for key in (
    "uuid",
    "geometryUuid",
    "materialUuid",
    "cpuBuffers",
    "bytes",
    "indices",
    "positions",
  ):
    assert water[key] == identity[key], (key, identity, water)
  assert math.isclose(water["offsetY"], depth - 3, abs_tol=1e-5), water
  assert math.isclose(water["surfaceY"], 4.2 + depth, abs_tol=1e-5), water
  assert 0 < water["bytes"] < 2 * 1024 * 1024, water
  assert water["indices"] > 0 and water["positions"] > 0, water
  assert water["textures"] == 0 and water["depthWrite"], water


def validate_depth_change(
  before: dict[str, Any], after: dict[str, Any], depth: int
) -> None:
  """Changing depth preserves the existing uploaded buffers as well as CPU data."""
  validate_water(after, "flood", before["water"][0], depth)
  previous = before["water"][0]["gpuBuffers"]
  assert previous and all(value is not None for value in previous.values()), before
  assert after["water"][0]["gpuBuffers"] == previous, (before, after)


def select_depth(page: Any, depth: int, touch: bool) -> dict[str, Any]:
  """Click or tap the actual control and confirm its accessible selected state."""
  if touch:
    open_mobile_actions(page)
  group = page.locator('[role="group"][aria-label="Water level"]:visible')
  assert group.count() == 1
  controls = []
  viewport = page.evaluate("({width:innerWidth,height:innerHeight})")
  for option in DEPTHS:
    button = group.get_by_role("button", name=f"Water level: {option} m", exact=True)
    assert button.is_visible()
    box = button.bounding_box()
    assert box is not None and box["width"] >= 32 and box["height"] >= 32, box
    assert box["x"] >= 0 and box["y"] >= 0, box
    assert box["x"] + box["width"] <= viewport["width"], (box, viewport)
    assert box["y"] + box["height"] <= viewport["height"], (box, viewport)
    controls.append({"depth": option, "box": box})
  control = group.get_by_role("button", name=f"Water level: {depth} m", exact=True)
  control.tap() if touch else control.click()
  page.wait_for_function(
    "depth => window.__modeContinuityRuntime()?.floodDepth === depth", arg=depth
  )
  page.wait_for_timeout(250)
  for option in DEPTHS:
    assert (
      group.get_by_role(
        "button", name=f"Water level: {option} m", exact=True
      ).get_attribute("aria-pressed")
      == str(option == depth).lower()
    )
  if touch and page.locator(".mobile-sheet-title button").is_visible():
    page.locator(".mobile-sheet-title button").tap()
  return {"viewport": viewport, "buttons": controls, "depth": depth}


def run(args: argparse.Namespace) -> None:
  from playwright.sync_api import sync_playwright

  report: dict[str, Any] = {
    "engine": args.engine,
    "touch": args.touch,
    "samples": [],
    "animation": [],
    "depthChanges": [],
    "underwaterBoundaries": [],
    "controls": [],
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
    context.add_init_script(FLOOD_BUFFER_PROBE)
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

    selected_depth = 3

    def sample(label: str, mode: str, expected: dict[str, Any] | None = None) -> None:
      state = page.evaluate(READ_STATE)
      state.update(
        label=label,
        flood=page.evaluate(READ_FLOOD),
        pose=page.evaluate("window.__readModeContinuity()"),
      )
      report["samples"].append(state)
      validate_water(state["flood"], mode, identity, selected_depth)
      if mode != "flood":
        assert page.get_by_role("group", name="Water level", exact=True).count() == 0
      if args.touch:
        validate_sample(state, mode)
      else:
        assert state["ready"] and not state["contextLost"] and state["lost"] == 0
      if expected is not None:
        assert_pose(state["pose"], expected)
        assert state["pose"]["runtime"] == expected["runtime"], state
      assert not report["errors"], report["errors"]
      print(
        json.dumps(
          {
            "label": label,
            "mode": mode,
            "water": state["flood"],
            "buffers": state["buffers"],
          }
        ),
        flush=True,
      )

    def change_depth(label: str, depth: int, expected: dict[str, Any]) -> None:
      nonlocal selected_depth
      before = page.evaluate(READ_FLOOD)
      report["controls"].append(select_depth(page, depth, args.touch))
      selected_depth = depth
      after = page.evaluate(READ_FLOOD)
      validate_depth_change(before, after, depth)
      sample(label, "flood", expected)
      report["depthChanges"].append({"label": label, "before": before, "after": after})

    try:
      page.goto(flood_url(args.url))
      wait_ready(page, "flood", 120)
      identity = page.evaluate(READ_FLOOD)["water"][0]
      sample("cold-flood", "flood")
      # The default must be represented by the real, accessible control too.
      change_depth("default-depth", 3, page.evaluate("window.__readModeContinuity()"))
      for name, position, target, fov in VIEWS:
        seed_camera(page, {"position": position, "target": target, "fov": fov})
        page.wait_for_timeout(1800)
        sample(name, "flood")
        page.screenshot(path=str(args.output / f"flood-{name}.png"))
        before = page.evaluate(READ_FLOOD)
        page.wait_for_timeout(1400)
        after = page.evaluate(READ_FLOOD)
        assert after["elapsed"] > before["elapsed"] + 0.1, (before, after)
        assert after["frame"] > before["frame"], (before, after)
        assert after["water"][0]["time"] > before["water"][0]["time"] + 0.1
        assert after["water"][0]["bytes"] == before["water"][0]["bytes"]
        report["animation"].append({"view": name, "before": before, "after": after})
        if name == "brandenburg":
          page.screenshot(path=str(args.output / "flood-brandenburg-later.png"))

      # A fixed camera between each pair of water levels must submerge when
      # the water rises and surface when it falls, without camera movement.
      for camera_y, lower, upper in ((9, 3, 6), (17, 6, 21)):
        seed_camera(
          page,
          {
            "position": [522, camera_y, 319],
            "target": [417.898, 3, 300.453],
            "fov": 39,
          },
        )
        expected = page.evaluate("window.__readModeContinuity()")
        for depth, underwater in ((lower, False), (upper, True), (lower, False)):
          label = f"boundary-{camera_y}m-depth-{depth}m"
          change_depth(label, depth, expected)
          state = page.evaluate(READ_FLOOD)
          assert state["underwater"] is underwater, state
          report["underwaterBoundaries"].append(
            {"cameraY": camera_y, "depth": depth, "underwater": underwater}
          )

      original_viewport = page.viewport_size
      page.set_viewport_size(
        {"width": 844, "height": 390} if args.touch else {"width": 1025, "height": 768}
      )
      page.wait_for_timeout(350)
      change_depth(
        "compact-controls", 6, page.evaluate("window.__readModeContinuity()")
      )
      if args.touch:
        open_mobile_actions(page)
      page.screenshot(path=str(args.output / "flood-compact-controls.png"))
      if args.touch and page.locator(".mobile-sheet-title button").is_visible():
        page.locator(".mobile-sheet-title button").tap()
      page.set_viewport_size(original_viewport)
      page.wait_for_timeout(350)

      for walking in (False, True):
        if walking:
          select_mode(page, "day", args.touch)
          wait_ready(page, "day", 120)
          enter_walk(page, args.touch)
          select_mode(page, "flood", args.touch)
          wait_ready(page, "flood", 120)
        else:
          seed_camera(
            page, {"position": VIEWS[0][1], "target": VIEWS[0][2], "fov": VIEWS[0][3]}
          )
        expected = page.evaluate("window.__readModeContinuity()")
        navigation = "walk" if walking else "flight"
        for visit, depth in enumerate((3, 6, 21, 6) if walking else (3, 6, 21, 3, 21)):
          change_depth(f"{navigation}-depth-{visit}-{depth}m", depth, expected)
          if not walking and visit < 3:
            page.screenshot(path=str(args.output / f"flood-reichstag-{depth}m.png"))
        for visit, mode in enumerate(ROUND_TRIP):
          select_mode(page, mode, args.touch)
          wait_ready(page, mode, 120)
          sample(f"{navigation}-{visit}", mode, expected)
          if mode != "flood":
            before = page.evaluate(READ_FLOOD)
            page.wait_for_timeout(250)
            after = page.evaluate(READ_FLOOD)
            assert before["water"][0]["time"] == after["water"][0]["time"]
      report["success"] = True
    except Exception as exc:
      report["exception"] = str(exc)
      try:
        report["failureState"] = page.evaluate(READ_FLOOD)
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
  parser.add_argument("--output", type=Path, default=Path("/tmp/flood-mode-smoke"))
  run(parser.parse_args())
