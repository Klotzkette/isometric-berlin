"""Inspect the source-bound v168 universities, Scheunenviertel and Teehaus ruin in real browser engines.

Phone profiles exercise the mobile renderer, not physical iPhone memory limits.
Run with uv run --with playwright python scripts/smoke_universities_v168.py URL.
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
  ("hu", [1532, 31, 220], [1508, 17, 135]),
  ("hu-court", [1530, 65, 290], [1510, 13, 150]),
  ("tu-north", [-3050, 62, 545], [-3040, 23, 657]),
  ("tu-south", [-3030, 65, 825], [-3040, 19, 707]),
  ("umlauftank", [-2640, 45, 590], [-2593, 19, 653]),
  ("umlauftank-high", [-2640, 75, 745], [-2593, 18, 655]),
  ("teehaus", [-1624, 23, 133], [-1585, 9, 158]),
  ("teehaus-roof", [-1545, 55, 209], [-1582, 9, 160]),
  ("scheunen-west", [2180, 80, -490], [2280, 16, -620]),
  ("scheunen-east", [2600, 160, -350], [2450, 18, -660]),
  ("preserve-tacheles", [1210, 27, -790], [1218, 18, -737]),
  ("preserve-invaliden", [-120, 60, -650], [-15, 8, -795]),
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
          if mode != "minecraft":
            page.wait_for_function(
              "() => {const p=window.__modeContinuityRuntime()?.parkDetails;return p?.parent && p.userData.pathCount > 0;}"
            )
          page.wait_for_timeout(500)
          sample = page.evaluate(READ_STATE)
          sample.update(view=name, visit=visit)
          if not args.baseline:
            sample["models"] = page.evaluate("""() => {
              const r=window.__modeContinuityRuntime();
              const names=r.lightingMode==='minecraft' ? ['HU main building independent native ornament','English Garden Teehaus independent native ruin','TU Berlin and Umlauftank 2 independent native blocks'] : ['HU main building additive facade ornament','English Garden Teehaus documented post-fire ruin','TU Berlin complete main building and Schleuseninsel Umlauftank 2'];
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
          if name.startswith("scheunen-") and not args.baseline:
            # A failed packet leaves pending=false too. Require the actual
            # source-bearing primary AND companion to exist in the scene.
            sample["scheunenChunks"] = page.evaluate("""() => {
              const r=window.__modeContinuityRuntime();
              return ['4_-2','4_-2-scheunen-v168'].map(id=>{
                const name=`Surrounding Berlin outline ${id}${r.lightingMode==='minecraft'?' native Minecraft':''}`;
                const root=r.surroundingCity.root.getObjectByName(name);
                let triangles=0;
                root?.traverse(node=>{if(node.isMesh)triangles+=(node.geometry.index?.count??0)/3;});
                return {id,visible:!!root?.visible,triangles};
              });
            }""")
            assert all(
              chunk["visible"] and chunk["triangles"] > 0
              for chunk in sample["scheunenChunks"]
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
    choices=["day", "schwellenraum", "minecraft", "night", "snowstorm"],
  )
  parser.add_argument(
    "--output", type=Path, default=Path("/tmp/universities-v168-smoke")
  )
  run(parser.parse_args())
