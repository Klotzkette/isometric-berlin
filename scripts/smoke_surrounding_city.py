"""Exercise the real streamed outer city, mobile buffer residency and mode changes.

Uses browser-engine phone profiles, not physical-device memory limits.
uv run --with playwright python scripts/smoke_surrounding_city.py URL --engine webkit
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from smoke_mobile_memory import BUFFER_PROBE, READ_STATE, validate_sample
from smoke_mode_continuity import (
  PROBE,
  open_mobile_actions,
  seed_camera,
  select_mode,
  viewer_url,
  wait_ready,
)

ROUTE = (
  ("ulap-far", [-640, 210, -190], [-359, 5, -457]),
  ("moabit-core-near", [-380, 32, -965], [-325, 6, -871]),
  ("moabit-west", [-3900, 280, -1050], [-3700, 3, -1350]),
  ("knaackstrasse", [3250, 320, -1660], [3060, 3, -1910]),
  ("prenzlauer-berg-east", [6400, 420, -2740], [6100, 3, -3100]),
  ("karl-marx-allee", [5310, 310, 675], [5100, 3, 370]),
  ("schlesisches-tor", [5310, 350, 2770], [5100, 3, 2390]),
  ("schoeneberg", [-1250, 320, 4050], [-1450, 3, 3730]),
  ("joachim-friedrich-strasse", [-4920, 320, 2470], [-5150, 3, 2170]),
  ("expanded-overview", [400, 1400, 2300], [400, 3, 400]),
  ("original-core", [-900, 350, 300], [-650, 5, 0]),
)
OUTER_STATE = """() => {
  const r=window.__modeContinuityRuntime(), c=r?.surroundingCity;
  return {chunks:c?.residentChunkCount,bytes:c?.residentGeometryBytes,
    buffers:c?.residentBufferCount,pending:c?.pending,manifest:!!c?.manifest,
    camera:r?.camera.position.toArray(),target:r?.controls.target.toArray(),
    drawnRoots:c?.root.children.filter(x=>!x.userData.nativeMinecraft).length,
    nativeRoots:c?.root.children.filter(x=>x.userData.nativeMinecraft).length};
}"""


def run(
  url: str,
  engine: str,
  output: Path,
  desktop: bool = False,
  compact: bool = False,
) -> None:
  from playwright.sync_api import sync_playwright

  report = {"engine": engine, "desktop": desktop, "samples": [], "errors": []}
  output.parent.mkdir(parents=True, exist_ok=True)
  with sync_playwright() as p:
    browser = getattr(p, engine).launch(
      **({"channel": "chrome"} if engine == "chromium" else {})
    )
    context = browser.new_context(
      **(
        {"viewport": {"width": 1365, "height": 900}}
        if desktop
        else p.devices["iPhone 13" if engine == "webkit" else "Pixel 5"]
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
      lambda msg: (
        report["errors"].append(msg.text)
        if msg.type == "error" or msg.text.startswith("Berlin surroundings:")
        else None
      ),
    )
    try:
      page.goto(viewer_url(url))
      wait_ready(page, "day", 120)
      page.wait_for_function(
        "window.__modeContinuityRuntime()?.surroundingCity?.manifest"
      )
      for mode in ("day", "schwellenraum", "minecraft", "night", "snowstorm", "day"):
        if mode != "day" or report["samples"]:
          select_mode(page, mode, not desktop)
          wait_ready(page, mode, 120)
        route = ROUTE if mode in {"day", "schwellenraum"} else ROUTE[3:4] + ROUTE[8:9]
        if compact and mode in {"day", "schwellenraum"}:
          route = ROUTE[3:4] + ROUTE[8:]
        for name, position, target in route:
          seed_camera(page, {"position": position, "target": target, "fov": 39})
          page.wait_for_timeout(900)
          page.wait_for_function(
            "() => {const c=window.__modeContinuityRuntime()?.surroundingCity;"
            "return c?.manifest && !c.pending;}"
          )
          page.wait_for_timeout(2100)
          sample = page.evaluate(READ_STATE)
          sample.update(view=name, outer=page.evaluate(OUTER_STATE))
          report["samples"].append(sample)
          print(json.dumps(sample), flush=True)
          if not desktop:
            validate_sample(sample, mode)
          else:
            assert sample["ready"] and not sample["contextLost"] and sample["lost"] == 0
          # The narrow original-core view can legitimately see no outer tile.
          if name != "original-core":
            assert sample["outer"]["chunks"] > 0, sample
          assert sample["outer"]["buffers"] <= sample["outer"]["chunks"] * 3, sample
          assert (
            sample["outer"]["drawnRoots" if mode == "minecraft" else "nativeRoots"] == 0
          ), sample
          assert not report["errors"], report["errors"]
          if mode in {"day", "minecraft"}:
            page.screenshot(
              path=str(output.with_name(f"{output.stem}-{mode}-{name}.png"))
            )
      # Use the actual walking UI on a new dry source surface, with its minimap.
      seed_camera(
        page, {"position": [3250, 320, -1660], "target": [3060, 3, -1910], "fov": 39}
      )
      page.wait_for_timeout(3000)
      point = page.evaluate("""() => {
        const c=window.__modeContinuityRuntime().surroundingCity;
        for(let dx=-40;dx<=40;dx+=4)for(let dz=-40;dz<=40;dz+=4){
          const x=3060+dx,z=-1910+dz,y=c.groundAt(x,z);
          if(y!==null&&!c.waterAt(x,z)&&!c.solidAt(x,y+1,z,2))return [x,y,z];
        } return null;
      }""")
      assert point, "No dry unoccupied outer walking surface loaded"
      x, y, z = point
      seed_camera(
        page, {"position": [x, y + 4, z], "target": [x, y + 1, z - 12], "fov": 39}
      )
      if desktop:
        page.locator(".pedestrian-mode-toggle").click()
      else:
        open_mobile_actions(page)
        page.locator(".mobile-overflow-grid").get_by_role(
          "button", name="Walk", exact=True
        ).tap()
        if page.locator(".mobile-sheet-title button").is_visible():
          page.locator(".mobile-sheet-title button").tap()
      page.wait_for_function(
        "window.__readModeContinuity()?.pedestrian?.grounded === true"
      )
      state = page.evaluate("window.__readModeContinuity()")
      assert (
        abs(state["pedestrian"]["x"] - x) < 2 and abs(state["pedestrian"]["z"] - z) < 2
      ), state
      assert page.locator(".pedestrian-minimap").is_visible()
      page.keyboard.down("w")
      page.keyboard.down("ArrowRight")
      page.wait_for_timeout(400)
      page.keyboard.up("ArrowRight")
      page.keyboard.up("w")
      page.wait_for_timeout(300)
      report["walking"] = page.evaluate("window.__readModeContinuity()")
      walk_position = report["walking"]["pedestrian"]
      for mode in ("schwellenraum", "minecraft", "day"):
        select_mode(page, mode, not desktop)
        wait_ready(page, mode, 120)
        page.wait_for_timeout(2000)
        restored = page.evaluate("window.__readModeContinuity()")
        assert restored["enabled"], restored
        for axis in ("x", "z"):
          assert abs(restored["pedestrian"][axis] - walk_position[axis]) < 0.05, (
            restored
          )
        assert page.locator(".pedestrian-minimap").is_visible()
      page.screenshot(path=str(output.with_name(f"{output.stem}-outer-walking.png")))
      assert not report["errors"], report["errors"]
      report["success"] = True
    finally:
      output.write_text(json.dumps(report, indent=2))
      context.close()
      browser.close()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("webkit", "chromium"), default="webkit")
  parser.add_argument("--output", type=Path, default=Path("/tmp/surrounding-city.json"))
  parser.add_argument("--desktop", action="store_true")
  parser.add_argument("--compact", action="store_true")
  args = parser.parse_args()
  run(args.url, args.engine, args.output, args.desktop, args.compact)
