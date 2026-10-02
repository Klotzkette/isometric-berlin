"""Inspect the bounded v176 DGM hill, attached source buildings and native terraces in real browser engines.

Phone profiles exercise the mobile renderer, not physical iPhone memory limits.
Run with uv run --with playwright python scripts/smoke_weinberg_v176.py URL.
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
  ("uphill", [2110, 65, -1230], [2215, 25, -1560]),
  ("park", [2380, 145, -1240], [2110, 17, -1510]),
  ("church", [2335, 95, -1560], [2230, 43, -1705]),
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
        else ("day", "schwellenraum", "minecraft", "night", "snowstorm", "flood", "day")
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
          if mode != "minecraft":
            page.wait_for_function(
              "() => {const p=window.__modeContinuityRuntime()?.parkDetails;return p?.parent && p.userData.pathCount > 0;}"
            )
          page.wait_for_timeout(500)
          sample = page.evaluate(READ_STATE)
          sample.update(view=name, visit=visit)
          sample["terrain"] = page.evaluate("""() => {
            const r=window.__modeContinuityRuntime(), e=r.pedestrian.environment;
            return [[2049.95,-1157.12],[2076.09,-1209.44],[2183.45,-1400.91],[2266.59,-1534.38],[2231.897,-1706.217]].map(([x,z])=>({x,z,y:e?.groundAt(x,z),stream:r.surroundingCity?.groundAt(x,z)}));
          }""")
          if not args.baseline:
            assert sample["terrain"][0]["y"] > 6, sample["terrain"]
            assert sample["terrain"][-1]["y"] > 22, sample["terrain"]
            assert sample["terrain"][-1]["y"] - sample["terrain"][0]["y"] > 15, sample[
              "terrain"
            ]
          if not args.baseline:
            sample["models"] = page.evaluate("""() => {
              const r=window.__modeContinuityRuntime(), names=[];
              r.scene.traverse(node=>{
                if (node.userData.zionskirchplatzV175) {
                  let p=node,visible=true;
                  while(p){visible=visible&&p.visible;p=p.parent;}
                  if(visible) names.push("frontages");
                }
              });
              return names.sort();
            }""")
            assert sample["models"] == ["frontages"], sample
          report["samples"].append(sample)
          if args.touch:
            validate_sample(sample, mode)
          else:
            assert sample["ready"] and not sample["contextLost"] and sample["lost"] == 0
          assert not report["errors"], report["errors"]
          if visit < 3:
            page.screenshot(path=str(args.output / f"{mode}-{name}.png"))
        print(json.dumps({"mode": mode, "sample": sample}), flush=True)
    except Exception as exc:
      report["exception"] = str(exc)
      if "Browser page crashed" in report["errors"]:
        raise
      report["failureState"] = page.evaluate("""() => {
        const r=window.__modeContinuityRuntime();
        return {mode:r?.lightingMode,ready:window.__readModeContinuity?.(),
          hidden:document.hidden,park:r?.parkDetails?.userData,
          parkParent:r?.parkDetails?.parent?.name,
          progressive:r?.progressiveWorldState,
          deferredStarter:typeof r?.startDeferredDetails,
          text:document.body.innerText};
      }""")
      page.screenshot(path=str(args.output / "failure.png"))
      raise
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
    choices=["day", "schwellenraum", "minecraft", "night", "snowstorm", "flood"],
  )
  parser.add_argument("--output", type=Path, default=Path("/tmp/weinberg-v176-smoke"))
  run(parser.parse_args())
