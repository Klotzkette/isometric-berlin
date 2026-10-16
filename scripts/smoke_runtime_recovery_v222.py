"""Exercise real joystick gestures, falling entry, rescue and two GPU resets.

uv run --with playwright python scripts/smoke_runtime_recovery_v222.py URL
  --engine chromium --output /tmp/runtime-v222-chromium
WebKit uses iPhone 13: native touch taps followed by a captured mouse drag,
because Playwright exposes native touch taps but no WebKit touch-drag API.
Device profiles do not certify physical-phone performance or memory limits.
Only scenario seeding uses the existing React runtime probe. A temporary local
collision fixture makes rescue deterministic and is removed in a finally block.
"""

from __future__ import annotations

import argparse
import json
import math
import time
from pathlib import Path
from typing import Any

from smoke_mode_continuity import (
  PROBE,
  assert_pose,
  near,
  open_mobile_actions,
  seed_camera,
  wait_ready,
)
from smoke_startup_mode_selection import startup_url

RECOVERY_PROBE = """(() => {
  const p = window.__recoveryV222 = {lost:0,restored:0,tracking:false,samples:[],
    armEntry:false,entry:null,pointers:[]};
  document.addEventListener('webglcontextlost',()=>p.lost++,true);
  document.addEventListener('webglcontextrestored',()=>p.restored++,true);
  document.addEventListener('pointerdown',event=>{
    if(event.target.closest?.('.flight-joystick'))
      p.pointers.push({type:event.pointerType,trusted:event.isTrusted});
  },true);
  document.addEventListener('click',()=>{
    if(p.armEntry && window.__readModeContinuity()?.enabled){
      p.entry=window.__readModeContinuity();p.armEntry=false;
    }
  });
  const observe=()=>{
    requestAnimationFrame(observe);
    if(p.tracking && p.samples.length<1200){
      const s=window.__readModeContinuity();
      if(s)p.samples.push({...s,at:performance.now()});
    }
  };
  requestAnimationFrame(observe);
})();"""


def read(page: Any) -> dict[str, Any]:
  return page.evaluate("window.__readModeContinuity()")


def track(page: Any) -> None:
  page.evaluate("Object.assign(window.__recoveryV222,{tracking:true,samples:[]})")


def samples(page: Any) -> list[dict[str, Any]]:
  return page.evaluate(
    "() => {const p=window.__recoveryV222;p.tracking=false;return p.samples;}"
  )


def toggle_walk(page: Any, touch: bool) -> None:
  if touch:
    open_mobile_actions(page)
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Walk", exact=True
    ).tap()
    close = page.locator(".mobile-sheet-title button")
    if close.is_visible():
      close.tap()
  else:
    page.locator(".pedestrian-mode-toggle").click()


def horizontal_distance(a: dict[str, Any], b: dict[str, Any]) -> float:
  return math.dist(a["position"][::2], b["position"][::2])


def validate_descent(
  entry: dict[str, Any], observations: list[dict[str, Any]], seeded_eye_y: float
) -> dict[str, Any]:
  """Reject instant ground snapping and upward/teleporting recovery artifacts."""
  near(entry["position"][1], seeded_eye_y, "walking entry eye height", 0.02)
  assert not entry["pedestrian"]["grounded"], entry
  falling = [sample for sample in observations if sample["enabled"]]
  assert len(falling) >= 5 and falling[-1]["pedestrian"]["grounded"], falling
  heights = [entry["position"][1], *[s["position"][1] for s in falling]]
  assert heights[0] - heights[-1] > 12, heights
  assert all(a + 0.02 >= b for a, b in zip(heights, heights[1:])), heights
  assert max(a - b for a, b in zip(heights, heights[1:])) < 2.0, heights
  assert all(horizontal_distance(entry, s) < 0.02 for s in falling), falling
  return {
    "initialEyeY": heights[0],
    "landedEyeY": heights[-1],
    "samples": len(falling),
    "largestObservedDropM": max(a - b for a, b in zip(heights, heights[1:])),
  }


def jump_check(page: Any, touch: bool, count: int) -> dict[str, Any]:
  page.wait_for_function("() => window.__readModeContinuity()?.pedestrian?.grounded")
  bounds = page.locator(".flight-joystick").bounding_box()
  assert bounds
  x, y = bounds["x"] + bounds["width"] / 2, bounds["y"] + bounds["height"] / 2
  before = read(page)
  track(page)
  tap_states = []
  for index in range(count):
    page.touchscreen.tap(x, y) if touch else page.mouse.click(x, y)
    tap_states.append(read(page))
    if index + 1 < count:
      page.wait_for_timeout(65)
  assert tap_states[0]["pedestrian"]["grounded"], tap_states
  assert not tap_states[1]["pedestrian"]["grounded"], tap_states
  if count == 3:
    assert (
      tap_states[2]["pedestrian"]["verticalVelocity"]
      > tap_states[1]["pedestrian"]["verticalVelocity"] + 1
    ), tap_states
  # Continue away from the gallery with an actual held, captured pointer.
  # There is no automated movement retained from the completed taps.
  page.mouse.move(x, y)
  page.mouse.down()
  try:
    page.mouse.move(x, y + 36, steps=3)
    page.wait_for_timeout(650)
  finally:
    page.mouse.up()
  released = read(page)
  assert horizontal_distance(before, released) > 0.8, (before, released)
  page.wait_for_function(
    "() => window.__readModeContinuity()?.pedestrian?.grounded", timeout=12_000
  )
  page.wait_for_timeout(250)
  after = read(page)
  assert horizontal_distance(released, after) < 0.03, (released, after)
  observed = samples(page)
  apex = max(s["position"][1] for s in observed) - before["position"][1]
  assert (4.7 < apex < 6.6) if count == 2 else (8.5 < apex < 11), apex
  return {
    "taps": count,
    "apexM": apex,
    "heldMotionM": horizontal_distance(before, released),
    "releasedMotionM": horizontal_distance(released, after),
  }


def wedged_recovery(page: Any, touch: bool) -> dict[str, Any]:
  before = read(page)
  # This fixture adds an enclosed 6m-wide cavity around the current open
  # pavement, leaving all genuine geometry/support/protection queries intact.
  page.evaluate("""() => {
    const r=window.__modeContinuityRuntime(),p=r.pedestrian,e=p.environment,s=p.state;
    window.__recoveryFixtureV222={environment:e,solid:e.interiorSolidAt,history:p.recoveryHistory};
    const original=e.interiorSolidAt, cx=s.x,cz=s.z;
    e.interiorSolidAt=(x,y,z,radius=0)=>{
      const distance=Math.max(Math.abs(x-cx),Math.abs(z-cz));
      return (distance+radius>=0.8 && distance-radius<3 && y<s.groundY+4)
        || Boolean(original?.(x,y,z,radius));
    };
    p.recoveryHistory={checkpoints:[],lastRecorded:null};
  }""")
  try:
    page.locator(".three-canvas").focus()
    page.keyboard.down("w")
    try:
      page.wait_for_timeout(450)
    finally:
      page.keyboard.up("w")
    wedged = read(page)
    assert horizontal_distance(before, wedged) < 0.5, (before, wedged)
    button = page.locator(".navigation-recovery-button")
    button.tap() if touch else button.click()
    page.wait_for_timeout(250)
    recovered = read(page)
    distance = horizontal_distance(before, recovered)
    assert 3.4 < distance <= 96.1, (before, recovered)
    assert recovered["enabled"] and recovered["pedestrian"]["grounded"], recovered
    near(recovered["pedestrian"]["yaw"], before["pedestrian"]["yaw"], "rescue heading")
    return {
      "wedgedMotionM": horizontal_distance(before, wedged),
      "recoveryDistanceM": distance,
      "walkingRetained": True,
    }
  finally:
    page.evaluate("""() => {
      const f=window.__recoveryFixtureV222;
      if(f){f.environment.interiorSolidAt=f.solid;
        const r=window.__modeContinuityRuntime();
        if(r?.pedestrian.environment===f.environment)r.pedestrian.recoveryHistory=f.history;}
      window.__recoveryFixtureV222=null;
    }""")


def gpu_reset(page: Any, cycle: int) -> dict[str, Any]:
  before = read(page)
  setup = page.evaluate("""() => {
    const r=window.__modeContinuityRuntime(),gl=r.renderer.getContext();
    const extension=gl.getExtension('WEBGL_lose_context');
    if(!extension)return false;
    window.__sameRuntimeV222={runtime:r,scene:r.scene,camera:r.camera,world:r.isoWorld,extension};
    extension.loseContext();return true;
  }""")
  assert setup, "WEBGL_lose_context is unavailable; the reset was not tested"
  try:
    page.wait_for_function(
      "() => {const r=window.__modeContinuityRuntime();return r?.contextLost && r.renderer.getContext().isContextLost();}",
      timeout=5000,
    )
    page.wait_for_timeout(250)
    assert_pose(read(page), before)
    page.evaluate("window.__sameRuntimeV222.extension.restoreContext()")
    page.wait_for_function(
      """() => {
      const r=window.__modeContinuityRuntime();
      return r && !r.contextLost && !r.renderer.getContext().isContextLost()
        && r.presentationReady && r.renderer.info.render.frame>0;
    }""",
      timeout=15_000,
    )
    first_frame = page.evaluate(
      "window.__modeContinuityRuntime().renderer.info.render.frame"
    )
    page.evaluate("window.__modeContinuityRuntime().renderInvalidated=true")
    page.wait_for_function(
      "n => window.__modeContinuityRuntime().renderer.info.render.frame > n",
      arg=first_frame,
      timeout=10_000,
    )
    evidence = page.evaluate("""() => {
      const r=window.__modeContinuityRuntime(),saved=window.__sameRuntimeV222,p=window.__recoveryV222;
      return {runtimeSame:r===saved.runtime,sceneSame:r.scene===saved.scene,
        cameraSame:r.camera===saved.camera,worldSame:r.isoWorld===saved.world,
        disposed:r.disposed,lost:p.lost,restored:p.restored,
        renderedFrame:r.renderer.info.render.frame,drawCalls:r.renderer.info.render.calls};
    }""")
    assert all(
      evidence[key] for key in ("runtimeSame", "sceneSame", "cameraSame", "worldSame")
    ), evidence
    assert not evidence["disposed"] and evidence["drawCalls"] > 0, evidence
    assert evidence["lost"] == evidence["restored"] == cycle, evidence
    assert_pose(read(page), before)
    assert not page.locator(".startup-mode-selection").is_visible()
    return evidence
  finally:
    # Do not keep an old scene alive if a later scenario/page changes runtime.
    page.evaluate("window.__sameRuntimeV222=null")


def run(url: str, engine: str, output: Path) -> dict[str, Any]:
  from playwright.sync_api import sync_playwright

  output.mkdir(parents=True, exist_ok=True)
  report: dict[str, Any] = {
    "engine": engine,
    "errors": [],
    "checks": [],
    "passed": False,
  }
  started = time.monotonic()
  with sync_playwright() as playwright:
    touch = engine == "webkit"
    with getattr(playwright, engine).launch(
      **({} if touch else {"channel": "chrome"})
    ) as browser:
      page = browser.new_page(
        **(
          playwright.devices["iPhone 13"]
          if touch
          else {"viewport": {"width": 1440, "height": 1000}}
        )
      )
      page.set_default_timeout(20_000)
      page.add_init_script(PROBE)
      page.add_init_script(RECOVERY_PROBE)
      page.on("pageerror", lambda error: report["errors"].append(str(error)))
      page.on("crash", lambda: report["errors"].append("Browser page crashed"))
      try:
        page.goto(startup_url(url, None), wait_until="domcontentloaded")
        initial = wait_ready(page, "day", 180)
        page.wait_for_function(
          """() => {
          const r=window.__modeContinuityRuntime();
          if(!r?.presentationReady || !r.openingDetailReady || !r.isoWorld || !r.outerThinOutlines
              || r.progressiveWorldState!=='complete' || r.openingWalkingPending)return false;
          let museum=0,exhibition=0,sculptures=0;
          r.scene.traverseVisible(o=>{if(o.userData.transparentHall) museum++;
            if(o.userData.cattelanExhibitionV217)exhibition++;
            if(o.userData.nationalgalerieSculpturesV221)sculptures++;});
          return museum===1 && exhibition===1 && sculptures===1;
        }""",
          timeout=180_000,
        )
        # Ordinary entry is flight again in v123. Exercise the optional walking
        # controls through their real toggle before the existing jump checks.
        if not initial["enabled"]:
          toggle_walk(page, touch)
          page.wait_for_function(
            "() => window.__readModeContinuity()?.pedestrian?.grounded", timeout=25_000
          )
          initial = read(page)
        assert initial["enabled"] and initial["pedestrian"]["grounded"], initial
        report["startupSeconds"] = round(time.monotonic() - started, 2)
        normal = jump_check(page, touch, 2)
        higher = jump_check(page, touch, 3)
        assert higher["apexM"] > normal["apexM"] + 2, (normal, higher)
        report["checks"].extend([normal, higher])
        toggle_walk(page, touch)
        assert not read(page)["enabled"]
        elevated = {
          "position": [initial["position"][0], 25, initial["position"][2]],
          "target": [initial["position"][0], 24, initial["position"][2] - 10],
          "fov": 40,
        }
        seed_camera(page, elevated)
        track(page)
        page.evaluate("Object.assign(window.__recoveryV222,{armEntry:true,entry:null})")
        toggle_walk(page, touch)
        entry = page.evaluate("window.__recoveryV222.entry")
        assert entry, "The real Walk gesture did not enter walking"
        page.wait_for_function(
          "() => window.__readModeContinuity()?.pedestrian?.grounded", timeout=15_000
        )
        page.wait_for_timeout(100)
        report["checks"].append(
          {"elevatedEntry": validate_descent(entry, samples(page), 25)}
        )
        report["checks"].append({"wedgedRecovery": wedged_recovery(page, touch)})
        for cycle in (1, 2):
          report["checks"].append({"gpuReset": cycle, **gpu_reset(page, cycle)})
        report["pointerEvents"] = page.evaluate("window.__recoveryV222.pointers")
        assert report["pointerEvents"] and all(
          p["trusted"] for p in report["pointerEvents"]
        )
        assert not report["errors"], report["errors"]
        report["passed"] = True
        page.screenshot(path=str(output / "restored.png"))
      except Exception as error:
        report["failure"] = f"{type(error).__name__}: {error}"
        try:
          report["failurePose"] = read(page)
          report["failureSamples"] = samples(page)
          page.screenshot(path=str(output / "failure.png"), timeout=5000)
        except Exception as inspection_error:
          report["inspectionError"] = str(inspection_error)
        raise
      finally:
        report["elapsedSeconds"] = round(time.monotonic() - started, 2)
        (output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
  return report


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("chromium", "webkit"), required=True)
  parser.add_argument("--output", type=Path, required=True)
  args = parser.parse_args()
  print(json.dumps(run(args.url, args.engine, args.output)))


if __name__ == "__main__":
  main()
