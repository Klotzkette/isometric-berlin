"""Check real flooded-mode rendering, idle animation and navigation continuity.

Run through uv with Playwright; --engine webkit --touch uses the iPhone 13
browser profile. Browser emulation cannot certify physical iPhone memory.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from smoke_mobile_memory import BUFFER_PROBE, READ_STATE, validate_sample
from smoke_mode_continuity import (
  PROBE,
  assert_pose,
  enter_walk,
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
READ_FLOOD = """() => {
  const r=window.__modeContinuityRuntime();if(!r)return null;
  const waters=[];r.scene.traverse(n=>{if(n.userData.floodWater)waters.push(n);});
  const visible=n=>{while(n){if(!n.visible)return false;n=n.parent;}return true;};
  return {mode:r.lightingMode,frame:r.renderer.info.render.frame,
    elapsed:r.floodElapsedSeconds,water:waters.map(n=>({
      name:n.name,uuid:n.uuid,visible:visible(n),geometryUuid:n.geometry.uuid,
      materialUuid:n.material.uuid,time:n.material.uniforms.time.value,
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


def validate_water(data: dict[str, Any], mode: str, identity: dict[str, Any]) -> None:
  """Each switch reuses the single finite water layer and its GPU geometry."""
  assert data["mode"] == mode, data
  assert len(data["water"]) == 1, data
  water = data["water"][0]
  assert water["visible"] == (mode == "flood"), data
  for key in ("uuid", "geometryUuid", "materialUuid", "bytes", "indices", "positions"):
    assert water[key] == identity[key], (key, identity, water)
  assert 0 < water["bytes"] < 2 * 1024 * 1024, water
  assert water["indices"] > 0 and water["positions"] > 0, water
  assert water["textures"] == 0 and water["depthWrite"], water


def run(args: argparse.Namespace) -> None:
  from playwright.sync_api import sync_playwright

  report: dict[str, Any] = {
    "engine": args.engine,
    "touch": args.touch,
    "samples": [],
    "animation": [],
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

    def sample(label: str, mode: str, expected: dict[str, Any] | None = None) -> None:
      state = page.evaluate(READ_STATE)
      state.update(
        label=label,
        flood=page.evaluate(READ_FLOOD),
        pose=page.evaluate("window.__readModeContinuity()"),
      )
      report["samples"].append(state)
      validate_water(state["flood"], mode, identity)
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

    try:
      page.goto(flood_url(args.url))
      wait_ready(page, "flood", 120)
      identity = page.evaluate(READ_FLOOD)["water"][0]
      sample("cold-flood", "flood")
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

      for walking in (False, True):
        if walking:
          select_mode(page, "day", args.touch)
          wait_ready(page, "day", 120)
          enter_walk(page, args.touch)
        else:
          seed_camera(
            page, {"position": VIEWS[0][1], "target": VIEWS[0][2], "fov": VIEWS[0][3]}
          )
        expected = page.evaluate("window.__readModeContinuity()")
        for visit, mode in enumerate(ROUND_TRIP):
          select_mode(page, mode, args.touch)
          wait_ready(page, mode, 120)
          sample(f"{'walk' if walking else 'flight'}-{visit}", mode, expected)
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
