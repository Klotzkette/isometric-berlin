"""Check hospital/landing animation and four bounded architecture contexts.

Uses existing controls and read-only runtime probe; captured appearance is not
proof of a surveyed facade. Core/stream settlement and mode continuity required.
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

POSES = {
  "hospital": ([-350, 165, -1630], [-55, 17, -1845]),
  "helipad": ([-214, 31, -1812], [-188, 16, -1846]),
  "gendarmenmarkt": ([1620, 105, 703], [1450, 15, 643]),
  "bnd": ([499, 50, -1588], [571, 16, -1640]),
  "living108": ([755.70, 30, -1382.08], [735.53, 17, -1373.28]),
  "nationalgalerie": ([-610, 95, 1455], [-492, 17, 1350]),
  "potsdamer": ([350, 135, 1390], [195, 25, 1260]),
}
OUTER_SITES = set()
CONTEXT_PROBE = """(() => {
  window.__cityPolishContextLosses = 0;
  document.addEventListener('webglcontextlost', () => {
    window.__cityPolishContextLosses++;
  }, true);
})();"""
READ_STATE = """() => {
  const r = window.__modeContinuityRuntime();
  if (!r) return null;
  let visibleRenderables = 0, appearanceVertices = 0;
  r.scene.traverseVisible(o => {
    if (o.isMesh || o.isLineSegments) visibleRenderables++;
    appearanceVertices += o.userData.altMitteAppearanceVerticesV213 ?? 0;
  });
  let helicopter;
  r.scene.traverse(o => { if(o.userData.rescueHelicopterV214 && o.isGroup) helicopter=o; });
  const c = r.surroundingCity;
  return {
    helicopterHeight: helicopter?.userData.heightAbovePad, helicopterPhase: helicopter?.userData.elapsedSeconds,
    mode: r.lightingMode, ready: r.presentationReady,
    presented: !!document.querySelector('.three-viewer.is-presentation-ready'),
    lost: r.renderer.getContext().isContextLost(),
    contextLosses: window.__cityPolishContextLosses,
    visibleRenderables, appearanceVertices, geometries: r.renderer.info.memory.geometries,
    textures: r.renderer.info.memory.textures, calls: r.renderer.info.render.calls,
    residentChunks: c?.residentChunkCount ?? 0,
    coreState: r.progressiveWorldState,
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
  parser.add_argument("--output", type=Path, default=Path("/tmp/v214-refinements"))
  parser.add_argument(
    "--modes", default="day,night,snowstorm,schwellenraum,flood,minecraft"
  )
  parser.add_argument(
    "--sites",
    help="Comma-separated camera names; selected views run in every requested mode: "
    + ", ".join(POSES),
  )
  parser.add_argument("--settle-seconds", type=float, default=2)
  parser.add_argument("--require-v214", action="store_true")
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
          names = sites or (
            list(POSES) if mode in ("day", "minecraft") else ["helipad"]
          )
          for name in names:
            position, target = POSES[name]
            seed_camera(page, {"position": position, "target": target, "fov": 40})
            page.wait_for_function(
              "quietMs => {const r=window.__modeContinuityRuntime(),c=r?.surroundingCity;"
              "const ready=c?.manifest && !c.pending && (r.lightingMode === 'minecraft'"
              "? !!r.voxelWorld : r.progressiveWorldState === 'complete');"
              "const key=[r?.lightingMode,c?.residentChunkCount,c?.residentGeometryBytes,"
              "r?.mobileBuildingViewRevision].join(':');"
              "if(!ready){window.__appearanceQuiet=null;return false;}"
              "let q=window.__appearanceQuiet;"
              "if(!q||q.key!==key)q=window.__appearanceQuiet={key,start:performance.now()};"
              "return performance.now()-q.start>=quietMs;}",
              arg=max(2000, args.settle_seconds * 1000),
              timeout=180000,
            )
            page.screenshot(path=str(args.output / f"{mode}-{name}.png"))
            state = page.evaluate(READ_STATE)
            assert state and state["mode"] == mode, state
            assert state["ready"] and state["presented"], state
            assert not state["lost"] and state["contextLosses"] == 0, state
            assert state["visibleRenderables"] > 0 and state["calls"] > 0, state
            assert not state["pending"], state
            if args.require_v214:
              assert state.get("helicopterHeight") is not None, state
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
