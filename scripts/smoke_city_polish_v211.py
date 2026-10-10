"""Compare broad existing-city views before and after the v211 presentation pass.

uv run --with playwright python scripts/smoke_city_polish_v211.py URL
Defaults: ten views in Day and Minecraft, one Mitte view in each other mode.
Use distinct --output directories for the v110 baseline and candidate builds.
WebKit uses an automated iPhone profile, not a physical-device GPU test.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from smoke_mode_continuity import (
  LABELS,
  PROBE,
  assert_pose,
  seed_camera,
  select_mode,
  viewer_url,
  wait_ready,
)

# Wider versions of retained v209/v210, City-West and Ringbahn QA poses.
# The three farther town centres were also checked against populated packets:
# north190-4_-12 (177 buildings), outer187--23_-5 (314), outer187-26_16 (354).
# These targets follow source neighbourhoods, not unbuilt scope-box corners.
POSES = {
  "moabit": ([-2290, 300, -1130], [-2650, 14, -1510]),
  "wedding": ([125, 320, -1900], [-285, 14, -2320]),
  "city-west": ([-2920, 320, 2320], [-3300, 16, 1940]),
  "steglitz": ([-3240, 320, 7370], [-3626, 25, 6933]),
  "neukoelln": ([4380, 300, 4480], [4040, 12, 4117]),
  "friedrichshain": ([5490, 320, 767], [5118, 12, 387]),
  "pankow": ([2720, 300, -5300], [2360, 12, -5680]),
  "spandau": ([-11160, 300, -1730], [-11550, 12, -2120]),
  "koepenick": ([14065, 340, 8740], [13685, 12, 8360]),
  "mitte": ([1910, 330, 1010], [1520, 16, 620]),
}
OUTER_SITES = {
  "city-west",
  "steglitz",
  "neukoelln",
  "friedrichshain",
  "pankow",
  "spandau",
  "koepenick",
}
CONTEXT_PROBE = """(() => {
  window.__cityPolishContextLosses = 0;
  document.addEventListener('webglcontextlost', () => {
    window.__cityPolishContextLosses++;
  }, true);
})();"""
READ_STATE = """() => {
  const r = window.__modeContinuityRuntime();
  if (!r) return null;
  let visibleRenderables = 0;
  r.scene.traverseVisible(o => {
    if (o.isMesh || o.isLineSegments) visibleRenderables++;
  });
  const c = r.surroundingCity;
  return {
    mode: r.lightingMode, ready: r.presentationReady,
    presented: !!document.querySelector('.three-viewer.is-presentation-ready'),
    lost: r.renderer.getContext().isContextLost(),
    contextLosses: window.__cityPolishContextLosses,
    visibleRenderables, geometries: r.renderer.info.memory.geometries,
    textures: r.renderer.info.memory.textures, calls: r.renderer.info.render.calls,
    residentChunks: c?.residentChunkCount ?? 0,
    residentGeometryBytes: c?.residentGeometryBytes ?? 0,
    pending: c?.pending ?? false,
    position: r.camera.position.toArray(), target: r.controls.target.toArray(),
    fov: r.camera.fov,
  };
}"""


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=["chromium", "webkit"], default="chromium")
  parser.add_argument("--output", type=Path, default=Path("/tmp/v211-city-polish"))
  parser.add_argument(
    "--modes", default="day,night,snowstorm,schwellenraum,flood,minecraft"
  )
  parser.add_argument(
    "--sites",
    help="Comma-separated camera names; selected views run in every requested mode: "
    + ", ".join(POSES),
  )
  parser.add_argument("--settle-seconds", type=float, default=2)
  args = parser.parse_args()
  modes = [mode.strip() for mode in args.modes.split(",")]
  sites = [name.strip() for name in args.sites.split(",")] if args.sites else None
  if any(mode not in LABELS for mode in modes):
    parser.error("--modes must contain known mode names: " + ", ".join(LABELS))
  if sites is not None and any(name not in POSES for name in sites):
    parser.error("--sites must contain known camera names: " + ", ".join(POSES))
  if not math.isfinite(args.settle_seconds) or args.settle_seconds < 0:
    parser.error("--settle-seconds must be finite and nonnegative")
  from playwright.sync_api import sync_playwright

  args.output.mkdir(exist_ok=True, parents=True)
  report = {
    "engine": args.engine,
    "url": args.url,
    "requestedModes": modes,
    "requestedSites": sites,
    "settleSeconds": args.settle_seconds,
    "modes": [],
    "transitions": [],
    "errors": [],
  }
  try:
    with sync_playwright() as p:
      touch = args.engine == "webkit"
      browser = getattr(p, args.engine).launch(
        headless=True, **({} if touch else {"channel": "chrome"})
      )
      try:
        page = browser.new_page(
          **(
            p.devices["iPhone 13"]
            if touch
            else {"viewport": {"width": 1440, "height": 1000}}
          )
        )
        page.add_init_script(PROBE)
        page.add_init_script(CONTEXT_PROBE)
        page.on("pageerror", lambda e: report["errors"].append(str(e)))
        page.on("crash", lambda: report["errors"].append("Browser page crashed"))
        page.on(
          "console",
          lambda m: (
            report["errors"].append(m.text)
            if m.type == "error" or m.text.startswith("Berlin surroundings:")
            else None
          ),
        )
        page.goto(viewer_url(args.url), wait_until="domcontentloaded")
        wait_ready(page, "day", 180)
        current_mode = "day"
        for mode in modes:
          if mode != current_mode:
            previous = page.evaluate("window.__readModeContinuity()")
            select_mode(page, mode, touch)
            actual = wait_ready(page, mode, 180)
            assert_pose(actual, previous)
            report["transitions"].append(
              {"from": current_mode, "to": mode, "posePreserved": True}
            )
            current_mode = mode
          names = sites or (list(POSES) if mode in ("day", "minecraft") else ["mitte"])
          for name in names:
            position, target = POSES[name]
            seed_camera(page, {"position": position, "target": target, "fov": 40})
            page.wait_for_function(
              "() => {const c=window.__modeContinuityRuntime()?.surroundingCity;"
              "return c?.manifest && !c.pending;}",
              timeout=90000,
            )
            page.wait_for_timeout(args.settle_seconds * 1000)
            page.screenshot(path=str(args.output / f"{mode}-{name}.png"))
            state = page.evaluate(READ_STATE)
            assert state and state["mode"] == mode, state
            assert state["ready"] and state["presented"], state
            assert not state["lost"] and state["contextLosses"] == 0, state
            assert state["visibleRenderables"] > 0 and state["calls"] > 0, state
            assert not state["pending"], state
            if name in OUTER_SITES:
              assert state["residentChunks"] > 0, state
            report["modes"].append({"site": name, **state})
            print(json.dumps(report["modes"][-1]), flush=True)
            assert not report["errors"], report["errors"]
      finally:
        browser.close()
  except Exception as error:
    report["failure"] = str(error)
    raise
  finally:
    (args.output / "report.json").write_text(json.dumps(report, indent=2))
  print(
    json.dumps({"passed": len(report["modes"]), "errors": report["errors"]}), flush=True
  )


if __name__ == "__main__":
  main()
