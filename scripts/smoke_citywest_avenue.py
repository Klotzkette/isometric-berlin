"""Inspect City West, the rotating Europa star and Karl-Marx-Allee in real browsers.

Phone profiles exercise the mobile renderer, not physical iPhone memory limits.
Run with uv run --with playwright python scripts/smoke_citywest_avenue.py URL.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from smoke_mobile_memory import BUFFER_PROBE, READ_STATE, validate_sample
from smoke_mode_continuity import (
  PROBE,
  seed_camera,
  select_mode,
  viewer_url,
  wait_ready,
)

VIEWS = (
  ("europa-star", [-2250, 128, 1670], [-2307, 103, 1578]),
  ("europa-center", [-2135, 162, 1740], [-2292, 63, 1585]),
  ("breitscheid-towers", [-2490, 170, 1800], [-2698, 60, 1470]),
  ("strausberger-platz", [3890, 190, 360], [3740, 25, 80]),
  ("frankfurter-tor", [5680, 195, 720], [5501, 30, 436]),
  ("avenue-frontages", [4460, 155, 515], [4300, 15, 240]),
)


def run(args: argparse.Namespace) -> None:
  from playwright.sync_api import sync_playwright

  report = {"engine": args.engine, "touch": args.touch, "samples": [], "errors": []}
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
        if message.type == "error" and "interactive-widget" not in message.text
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
        for name, position, target in VIEWS:
          if args.views and name not in args.views:
            continue
          seed_camera(page, {"position": position, "target": target, "fov": 45})
          page.wait_for_timeout(2200)
          sample = page.evaluate(READ_STATE)
          sample.update(view=name, visit=visit)
          if not args.baseline and name in {"europa-center", "europa-star"}:
            star_read = """() => {
              const r=window.__modeContinuityRuntime();
              return r.europaCenterStarTargets.map(node=>{
                let p=node,visible=true;
                while(p){visible=visible&&p.visible;p=p.parent;}
                return {visible,phase:node.rotation.y,uuid:node.uuid};
              });
            }"""
            page.wait_for_function(
              "window.__modeContinuityRuntime().europaCenterStarTargets.length > 0"
            )
            before = page.evaluate(star_read)
            page.wait_for_timeout(1200)
            after = page.evaluate(star_read)
            visible_before = [star for star in before if star["visible"]]
            visible_after = [star for star in after if star["visible"]]
            assert len(visible_before) == len(visible_after) == 1, (before, after)
            assert abs(visible_after[0]["phase"] - visible_before[0]["phase"]) > 0.05
            sample["star"] = {"before": before, "after": after}
          if name not in {"europa-center", "europa-star", "breitscheid-towers"}:
            page.wait_for_function(
              "() => {const c=window.__modeContinuityRuntime()?.surroundingCity;"
              "return c?.manifest && !c.pending;}"
            )
            page.wait_for_timeout(500)
          if not args.baseline:
            sample["towers"] = page.evaluate("""() => {
              const r=window.__modeContinuityRuntime();
              const name=r.lightingMode==='minecraft'
                ? 'Zoofenster and Upper West native surface blocks'
                : 'Zoofenster and Upper West exact source architecture';
              let count=0,visible=false;
              r.scene.traverse(node=>{
                if(node.name!==name)return;count++;
                let p=node,on=true;while(p){on=on&&p.visible;p=p.parent;}
                visible=visible||on;
              });
              return {count,visible};
            }""")
            assert sample["towers"] == {"count": 1, "visible": True}, sample
          report["samples"].append(sample)
          if args.touch:
            validate_sample(sample, mode)
          else:
            assert sample["ready"] and not sample["contextLost"] and sample["lost"] == 0
          assert not report["errors"], report["errors"]
          if visit < 3:
            page.screenshot(path=str(args.output / f"{mode}-{name}.png"))
        print(json.dumps({"mode": mode, "sample": sample}), flush=True)
    finally:
      (args.output / "report.json").write_text(json.dumps(report, indent=2) + "\n")
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
  parser.add_argument("--output", type=Path, default=Path("/tmp/citywest-avenue-smoke"))
  run(parser.parse_args())
