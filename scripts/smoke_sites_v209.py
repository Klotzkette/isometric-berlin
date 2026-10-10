"""Inspect named v209 sites in the built viewer, with real mode-switch controls.

uv run --with playwright python scripts/smoke_sites_v209.py URL [--engine webkit]
The WebKit iPhone profile is automation, not a physical iPhone GPU test.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from smoke_mode_continuity import PROBE, seed_camera, select_mode, wait_ready

POSES = {
  "tegel": ([-4680, 340, -5870], [-5165, 8, -6112]),
  "stasi-headquarters": ([7460, 220, 930], [7810, 8, 690]),
  "hohenschoenhausen": ([8620, 160, -2180], [8867, 7, -2350]),
  "volksbuehne-front": ([2658, 89, -700], [2768, 15, -848]),
  "volksbuehne-rear": ([2862, 85, -955], [2768, 22, -848]),
  "orankesee": ([7853.18, 210, -2865.15], [7593.18, 3, -3165.15]),
  "moabit": ([-2470, 170, -1310], [-2650, 14, -1510]),
  "kastanienallee": ([2570.7, 75, -2142.8], [2637.3, 14, -2098.5]),
  "weinbergsweg": ([2510, 110, -1040], [2390, 14, -1180]),
  "kollwitz": ([3340, 150, -1910], [3180, 14, -2080]),
  "helmholtz": ([3365, 45, -2514], [3316, 5, -2573]),
}
REQUIRED = [
  "Tegel and two distinct Stasi memorial sites v209 complete source envelopes",
  "Complete Volksbuehne source body and measured upper volumes v209",
  "Required Helmholtzplatz source envelopes v209",
]
OPTIONAL = [
  "Tegel and two distinct Stasi memorial sites v209 exterior details",
  "Helmholtzplatz community and cafe facades v209",
]


def main() -> None:
  from playwright.sync_api import sync_playwright

  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=["chromium", "webkit"], default="chromium")
  parser.add_argument("--output", type=Path, default=Path("/tmp/v209-sites"))
  parser.add_argument(
    "--modes", default="day,night,snowstorm,schwellenraum,flood,minecraft"
  )
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
        arg=[n + suffix for n in OPTIONAL]
        + ["Exact Orankesee shore and mapped public lido fittings v209"],
        timeout=90000,
      )
      names = POSES if mode in ("day", "minecraft") else ["volksbuehne-front"]
      for name in names:
        position, target = POSES[name]
        seed_camera(page, {"position": position, "target": target, "fov": 40})
        page.wait_for_timeout(2000)
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
