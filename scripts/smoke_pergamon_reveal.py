"""Exercise real clicks/taps and retained altar state through all six modes.

Browser profiles do not reproduce physical iPhone RAM limits. Only camera
seeding uses the existing test probe; toggles and mode changes use real inputs.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from smoke_flood_mode import select_depth
from smoke_mode_continuity import PROBE, seed_camera, select_mode, wait_ready

READ = """() => {
 const r=window.__modeContinuityRuntime();if(!r)return null;
 const owners=[];r.scene.traverse(o=>{if(o.userData.pergamonExterior)owners.push(o.visible)});
 return {revealed:r.pergamonReveal?.revealed,mode:r.lightingMode,owners,
 altar:r.scene.getObjectByName('Pergamon Altar — reversible museum reveal')?.visible,
 lost:r.renderer.getContext().isContextLost(),water:r.floodWater?.material.uniforms.pergamonReveal.value,
 position:r.camera.position.toArray(),target:r.controls.target.toArray()};
}"""
POINT = """() => {
 const r=window.__modeContinuityRuntime(), p=r.camera.position.clone();
 const c=Math.cos(.655),s=Math.sin(.655),u=-50.5,v=-75.9;
 p.set(1819.5+c*u+s*v,38,-184-s*u+c*v).project(r.camera);
 const b=r.renderer.domElement.getBoundingClientRect();
 return {x:b.left+(p.x+1)*b.width/2,y:b.top+(1-p.y)*b.height/2};
}"""


def run(url: str, engine: str, touch: bool, output: Path) -> None:
  """Check the production viewer's complete reveal/restore interaction."""
  from playwright.sync_api import sync_playwright

  report: dict[str, Any] = {
    "engine": engine,
    "touch": touch,
    "samples": [],
    "errors": [],
  }
  output.mkdir(parents=True, exist_ok=True)
  with sync_playwright() as p:
    browser = getattr(p, engine).launch(
      headless=True, **({"channel": "chrome"} if engine == "chromium" else {})
    )
    config = (
      p.devices["iPhone 13"] if touch else {"viewport": {"width": 1280, "height": 900}}
    )
    page = browser.new_page(**config)
    page.add_init_script(PROBE)
    page.on("pageerror", lambda e: report["errors"].append(str(e)))
    try:
      page.goto(url + "?lang=en&theme=day", wait_until="domcontentloaded")
      wait_ready(page, "day", 160)
      assert not page.evaluate(
        "performance.getEntriesByType('resource').some(r=>r.name.includes('PergamonAltarV204'))"
      )
      # Clear isometric approach from the west courtyard.
      import math

      def world(u: float, y: float, v: float) -> list[float]:
        c, s = math.cos(0.655), math.sin(0.655)
        return [1819.5 + c * u + s * v, y, -184 - s * u + c * v]

      seed_camera(
        page,
        {
          "position": world(-190, 150, -145),
          "target": world(-65, 15, -75.9),
          "fov": 40,
        },
      )
      point = page.evaluate(POINT)
      page.screenshot(path=str(output / "day-exterior.png"))
      if touch:
        page.touchscreen.tap(**point)
      else:
        page.mouse.click(**point)
      page.wait_for_function(
        "window.__modeContinuityRuntime()?.pergamonReveal?.revealed", timeout=15000
      )
      page.wait_for_timeout(750)
      for mode in [
        "day",
        "night",
        "snowstorm",
        "schwellenraum",
        "flood",
        "minecraft",
        "day",
      ]:
        if mode != "day" or report["samples"]:
          select_mode(page, mode, touch)
          wait_ready(page, mode, 180)
        page.wait_for_function(
          "window.__modeContinuityRuntime()?.pergamonReveal?.revealed", timeout=15000
        )
        sample = page.evaluate(READ)
        assert (
          sample["revealed"]
          and sample["altar"]
          and not any(sample["owners"])
          and not sample["lost"]
        ), sample
        if mode == "flood":
          assert sample["water"] == 1
          for depth in (6, 21, 3):
            select_depth(page, depth, touch)
            assert page.evaluate(READ)["water"] == 1
            if depth == 21:
              page.screenshot(path=str(output / "flood-21m-altar.png"))
              # A shader flag alone cannot prove the exhibit remains visible.
              # Compare its bright stone pixels at the unchanged camera pose.
              from PIL import Image

              rect = page.evaluate("""() => {
                const r=window.__modeContinuityRuntime(), b=r.renderer.domElement.getBoundingClientRect(), xs=[],ys=[];
                const c=Math.cos(.655),s=Math.sin(.655),scale=devicePixelRatio;
                for(const u of[-61,-40])for(const v of[-94.5,-57.3])for(const y of[4.15,17]){
                  const p=r.camera.position.clone().set(1819.5+c*u+s*v,y,-184-s*u+c*v).project(r.camera);
                  xs.push((b.left+(p.x+1)*b.width/2)*scale);ys.push((b.top+(1-p.y)*b.height/2)*scale);
                }
                return [Math.floor(Math.min(...xs)),Math.floor(Math.min(...ys)),Math.ceil(Math.max(...xs)),Math.ceil(Math.max(...ys))];
              }""")
              before = Image.open(output / "1-day-altar.png").convert("RGB").crop(rect)
              after = (
                Image.open(output / "flood-21m-altar.png").convert("RGB").crop(rect)
              )
              stone = kept = 0
              for a, b in zip(before.getdata(), after.getdata(), strict=True):
                if min(a) > 175 and max(a) - min(a) < 40:
                  stone += 1
                  kept += max(abs(x - y) for x, y in zip(a, b, strict=True)) < 35
              report["floodStonePixelRetention"] = kept / max(1, stone)
              assert stone > 100 and kept / stone > 0.97, (stone, kept)
          if touch and page.locator(".mobile-sheet-title button").is_visible():
            page.locator(".mobile-sheet-title button").tap()
        report["samples"].append(sample)
        page.screenshot(path=str(output / f"{len(report['samples'])}-{mode}-altar.png"))
        print(json.dumps({"mode": mode, "reveal": True}), flush=True)
      point = page.evaluate(POINT)
      if touch:
        page.touchscreen.tap(**point)
      else:
        page.mouse.click(**point)
      page.wait_for_function(
        "window.__modeContinuityRuntime()?.pergamonReveal?.revealed === false"
      )
      sample = page.evaluate(READ)
      assert all(sample["owners"]) and not sample["altar"], sample
      report["restored"] = sample
      page.wait_for_timeout(450)
      if touch:
        page.touchscreen.tap(**point)
      else:
        page.mouse.click(**point)
      page.wait_for_function(
        "window.__modeContinuityRuntime()?.pergamonReveal?.revealed"
      )
      seed_camera(
        page,
        {"position": world(-96, 32, -90), "target": world(-50.5, 9, -75.9), "fov": 42},
      )
      page.screenshot(path=str(output / "altar-close.png"))
      assert not report["errors"], report["errors"]
      report["passed"] = True
    finally:
      (output / "report.json").write_text(json.dumps(report, indent=2))
      browser.close()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=["chromium", "webkit"], default="chromium")
  parser.add_argument("--touch", action="store_true")
  parser.add_argument("--output", type=Path, required=True)
  args = parser.parse_args()
  run(args.url, args.engine, args.touch, args.output)
