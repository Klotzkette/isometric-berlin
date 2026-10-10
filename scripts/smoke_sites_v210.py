"""Inspect named v210 sites in the built viewer, with real mode-switch controls.

uv run --with playwright python scripts/smoke_sites_v210.py URL [--engine webkit]
The WebKit iPhone profile is automation, not a physical iPhone GPU test.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from smoke_mode_continuity import PROBE, seed_camera, select_mode, wait_ready

POSES = {
  "blue-obelisk": ([-6668, 65, 1005], [-6761.892, 8, 904.051]),
  "rbb": ([-6425, 155, 835], [-6585, 30, 975]),
  "haus-des-rundfunks": ([-6410, 95, 1235], [-6518, 12, 1054]),
  "drv": ([-4010, 100, 3195], [-4131, 15, 3075]),
  "erika": ([65, 125, -1910], [-56, 12, -2070]),
  "bayer": ([125, 230, -2020], [-285, 21, -2320]),
  "hermannplatz": ([3635, 115, 3755], [3500, 14, 3580]),
  "richardplatz": ([4870, 110, 4940], [5018, 9, 5090]),
  "kudamm": ([-4889, 120, 2309], [-5019, 3, 2179]),
  "friedrichstrasse": ([1429, 120, 1980], [1299, 5.2, 1850]),
  "karl-marx-allee": ([5248, 120, 517], [5118, 3, 387]),
  "karl-marx-strasse": ([4170, 120, 4247], [4040, 3, 4117]),
}
REQUIRED = [
  "Westend and DRV civic recognition v210 required solids",
  "Wedding stadium and source-bound Bayer campus v210 required hall roof supplement",
  "Required Neukoelln source envelopes v210",
]
OPTIONAL = [
  "Westend and DRV civic recognition v210 optional facades",
  "Wedding stadium and source-bound Bayer campus v210 exterior detail",
  "Richardplatz and Hermannplatz current architecture v210",
  "Source-bound boulevard paint and curbs v210",
]


def main() -> None:
  from playwright.sync_api import sync_playwright

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=["chromium", "webkit"], default="chromium")
  parser.add_argument("--output", type=Path, default=Path("/tmp/v210-sites"))
  parser.add_argument(
    "--modes", default="day,night,snowstorm,schwellenraum,flood,minecraft"
  )
  parser.add_argument(
    "--sites", help="Comma-separated camera names for a focused inspection"
  )
  parser.add_argument("--settle-seconds", type=float, default=2)
  args = parser.parse_args()
  args.output.mkdir(exist_ok=True, parents=True)
  report = {"engine": args.engine, "url": args.url, "modes": [], "errors": []}
  with sync_playwright() as p:
    touch = args.engine == "webkit"
    browser = getattr(p, args.engine).launch(
      headless=True, **({} if touch else {"channel": "chrome"})
    )
    page = browser.new_page(
      **(
        p.devices["iPhone 13"]
        if touch
        else {"viewport": {"width": 1440, "height": 1000}}
      )
    )
    page.add_init_script(PROBE)
    page.on("pageerror", lambda e: report["errors"].append(str(e)))
    page.on(
      "console",
      lambda m: report["errors"].append(m.text) if m.type == "error" else None,
    )
    page.goto(
      args.url.rstrip("/") + "/?lang=en&theme=day", wait_until="domcontentloaded"
    )
    wait_ready(page, "day", 180)
    for mode in args.modes.split(","):
      if mode != "day":
        select_mode(page, mode, touch)
        wait_ready(page, mode, 180)
      suffix = " native" if mode == "minecraft" else ""
      assert page.evaluate(
        "names => names.every(n => !!window.__modeContinuityRuntime()?.scene.getObjectByName(n))",
        [n + suffix for n in REQUIRED],
      ), "Required replacement body missing at presentation"
      page.wait_for_function(
        "names => names.every(n => !!window.__modeContinuityRuntime()?.scene.getObjectByName(n))",
        arg=[n + suffix for n in OPTIONAL],
        timeout=90000,
      )
      names = (
        args.sites.split(",")
        if args.sites
        else (POSES if mode in ("day", "minecraft") else ["hermannplatz"])
      )
      for name in names:
        position, target = POSES[name]
        seed_camera(page, {"position": position, "target": target, "fov": 40})
        page.wait_for_timeout(args.settle_seconds * 1000)
        page.screenshot(path=str(args.output / f"{mode}-{name}.png"))
        state = page.evaluate(
          """() => { const r = window.__modeContinuityRuntime(); return {
            mode: r.lightingMode, lost: r.renderer.getContext().isContextLost(),
            ready: r.presentationReady, geometries: r.renderer.info.memory.geometries,
            textures: r.renderer.info.memory.textures, calls: r.renderer.info.render.calls,
          }; }"""
        )
        assert state["mode"] == mode and state["ready"] and not state["lost"], state
        report["modes"].append({"site": name, **state})
        print(json.dumps(report["modes"][-1]), flush=True)
      assert not report["errors"], report["errors"]
    browser.close()
  (args.output / "report.json").write_text(json.dumps(report, indent=2))
  print(
    json.dumps({"passed": len(report["modes"]), "errors": report["errors"]}), flush=True
  )


if __name__ == "__main__":
  main()
