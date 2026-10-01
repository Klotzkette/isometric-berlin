"""Inspect the source-bound v166 Mitte, Alexanderplatz and City West detail in real browser engines.

Phone profiles exercise the mobile renderer, not physical iPhone memory limits.
Run with uv run --with playwright python scripts/smoke_city_refinements_v166.py URL.
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
  ("kosmos", [5330, 27, 400], [5325, 11, 322]),
  ("park-inn", [2770, 145, -420], [2840, 45, -735]),
  ("berlinian", [2550, 100, -205], [2680, 50, -340]),
  ("schonhauser-tor", [2480, 75, -950], [2660, 18, -1090]),
  ("jandorf", [1870, 36, -1430], [1924, 15, -1530]),
  ("heine", [1961, 5.5, -1467], [1961, 4.5, -1477]),
  ("elisabeth", [1810, 22, -1470], [1784, 12, -1537]),
  ("weinberg", [1920, 150, -1260], [2070, 4, -1470]),
  ("monbijou", [1650, 95, -250], [1730, 7, -470]),
  ("krausnick", [1695, 70, -520], [1790, 8, -625]),
  ("cemeteries", [1430, 155, -1360], [1460, 5, -1650]),
  ("moabit-court", [-1150, 95, -490], [-1060, 23, -705]),
  ("jva", [-1120, 175, -760], [-910, 17, -880]),
  ("savigny", [-3420, 85, 1510], [-3345, 12, 1415]),
  ("kant-kino", [-4312, 16, 1274], [-4314, 10, 1254]),
  ("zoo-palast", [-2560, 38, 1470], [-2567, 13, 1364]),
  ("furst", [-3210, 100, 1955], [-3294, 35, 1879]),
  ("upbeat", [-543, 90, -1830], [-677, 35, -1974]),
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
              const names=r.lightingMode==='minecraft' ? ['Alexander north: independent orthogonal native skin', 'City West cinemas Savignyplatz and FÜRST native blocks', 'Moabit justice and Lesser-Ury independent native surface blocks', 'Mitte heritage independent native blocks', 'KOSMOS event venue native blocks'] : ['Alexander north: complete Park Inn, Pressehaus, Tor and street sources', 'City West cinemas Savignyplatz and surveyed FÜRST architecture', 'Moabit criminal court, prison exterior and Lesser-Ury houses', 'Mitte parks cemeteries and measured historical buildings', 'KOSMOS former cinema and current event venue'];
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
  parser.add_argument(
    "--output", type=Path, default=Path("/tmp/city-refinements-v166-smoke")
  )
  run(parser.parse_args())
