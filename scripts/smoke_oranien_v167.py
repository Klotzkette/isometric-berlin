"""Inspect the source-bound v167 Oranien corridors, synagogue, Tacheles and pools in real browser engines.

Phone profiles exercise the mobile renderer, not physical iPhone memory limits.
Run with uv run --with playwright python scripts/smoke_oranien_v167.py URL.
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
  ("synagogue", [1550, 49, -540], [1566, 28, -642]),
  ("synagogue-roof", [1640, 95, -570], [1567, 25, -642]),
  ("tacheles", [1210, 27, -790], [1218, 18, -737]),
  ("tacheles-court", [1210, 27, -659], [1220, 18, -728]),
  ("tacheles-roof", [1280, 70, -647], [1210, 16, -728]),
  ("bath", [1746, 69, -338], [1717, 5.4, -393]),
  ("rio", [3510, 50, 2175], [3453, 9, 2115]),
  ("bethanien", [3660, 100, 1860], [3520, 20, 1720]),
  ("thomas", [3720, 90, 1730], [3705, 22, 1590]),
  ("gorli", [3780, 105, 2370], [3800, 12, 2270]),
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
              const names=r.lightingMode==='minecraft' ? ['Neue Synagoge independent native blocks','Tacheles Fotografiska independent native blocks','Kinderbad Monbijou independent native pools'] : ['Neue Synagoge preserved building and gilded crowns','Tacheles Fotografiska current measured historic envelope','Kinderbad Monbijou measured pools and stone surrounds'];
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
  parser.add_argument("--output", type=Path, default=Path("/tmp/oranien-v167-smoke"))
  run(parser.parse_args())
