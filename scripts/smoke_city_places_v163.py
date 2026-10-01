"""Inspect the source-bound v163 squares and streets in real browser engines.

Phone profiles exercise the mobile renderer, not physical iPhone memory limits.
Run with uv run --with playwright python scripts/smoke_city_places_v163.py URL.
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
  ("world-clock", [2860, 19, -167], [2845.618, 6, -188.915]),
  ("friendship-fountain", [2840, 24, -260], [2811.5, 5, -285.8]),
  ("floating-ring", [3890, 30, 158], [3855.7, 7, 125]),
  ("karl-marx-allee", [4435, 130, 470], [4300, 20, 240]),
  ("hackescher-markt", [2195, 84, -290], [2096, 12, -410]),
  ("hackesche-hoefe", [2170, 88, -485], [2060, 14, -581]),
  ("endell-court", [2104, 22, -531], [2080, 13, -548]),
  ("rosenthaler-platz", [2120, 64, -1095], [2067, 17, -1180]),
  ("ernst-reuter-platz", [-3240, 120, 740], [-3375, 8, 625]),
  ("wittenbergplatz", [-1910, 36, 1880], [-1975, 8, 1855]),
  ("kadewe", [-2050, 58, 1775], [-2111, 25, 1880]),
  ("kudamm-fasanen", [-3130, 85, 2100], [-3300, 16, 1940]),
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
          page.wait_for_function(
            "() => {const c=window.__modeContinuityRuntime()?.surroundingCity;return c?.manifest && !c.pending;}"
          )
          page.wait_for_timeout(500)
          sample = page.evaluate(READ_STATE)
          sample.update(view=name, visit=visit)
          if not args.baseline:
            sample["models"] = page.evaluate("""() => {
              const r=window.__modeContinuityRuntime();
              const names=r.lightingMode==='minecraft' ? [
                'Hackescher Markt and Hackesche Hoefe native blocks',
                'Minecraft eastern squares public art v163',
                'West squares independent native blocks',
              ] : [
                'Hackescher Markt and Hackesche Hoefe source architecture',
                'Eastern squares source-bound public art v163',
                'Ernst-Reuter-Platz Wittenbergplatz and KaDeWe source detail',
              ];
              return names.map(name => {
                let count=0;
                r.scene.traverse(object=>{if(object.name===name)count++;});
                let node=r.scene.getObjectByName(name), visible=!!node;
                while(node){visible=visible&&node.visible;node=node.parent;}
                return {name,visible,count};
              });
            }""")
            assert all(
              model["visible"] and model["count"] == 1 for model in sample["models"]
            ), sample
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
  parser.add_argument(
    "--output", type=Path, default=Path("/tmp/city-places-v163-smoke")
  )
  run(parser.parse_args())
