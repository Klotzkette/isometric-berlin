"""Verify complete mobile water in the production viewer, across drawn modes.

  uv run --with playwright python scripts/smoke_drawn_water.py URL --engine webkit

Uses the existing read-only React runtime probe; no production debug API.
Touch emulation checks integration and mode lifecycle, not physical phone RAM.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from smoke_mode_continuity import (
  PROBE,
  seed_camera,
  select_mode,
  viewer_url,
  wait_ready,
)

REPORT = """() => {
  const r = window.__modeContinuityRuntime();
  const root = r?.isoWorld?.getObjectByName('source-bound drawn water');
  if (!root) return null;
  const bounds = name => {
    const object = root.getObjectByName(name);
    if (!object) return null;
    object.geometry.computeBoundingBox();
    const b = object.geometry.boundingBox;
    return {min: b.min.toArray(), max: b.max.toArray(), visible: object.visible};
  };
  const names = []; root.traverse(o => {if(o.geometry) names.push(o.name);});
  const monuments = r.isoWorld.getObjectByName('OSM Tiergarten monuments');
  return {mode: r.lightingMode, coarse: r.coarsePointer, ready: r.presentationReady,
    water: root.userData.waterPolygonCount, basins: root.userData.basinCount,
    walls: root.userData.sunkenWallCount, names,
    wall: bounds('sunken walls'), crown: bounds('sunken wall crown path'),
    ink: bounds('basin and sunken wall ink'),
    genericExcluded: monuments?.userData.externallyModelledSourceKeys
      ?.includes('way/1065885229') === true,
    rasterDouble: Boolean(r.isoWorld.getObjectByName('drawn water surface'))};
}"""


def validate_report(report: dict[str, Any]) -> None:
  """Reject the former marker-only view and incomplete mode attachments."""
  assert report["coarse"] and report["ready"], report
  assert (report["water"], report["basins"], report["walls"]) == (175, 37, 1), report
  assert report["genericExcluded"] and not report["rasterDouble"], report
  for name in (
    "basin water",
    "natural pond water",
    "smooth quay walls",
    "sunken walls",
    "sunken wall crown path",
    "basin and sunken wall ink",
  ):
    assert name in report["names"], (name, report)
  wall, crown, ink = (report[key] for key in ("wall", "crown", "ink"))
  assert wall and crown and ink, report
  assert wall["visible"] and crown["visible"], report
  assert 38.8 < wall["max"][2] - wall["min"][2] < 39.3, report
  assert crown["max"][2] - crown["min"][2] > 38.8, report
  assert wall["max"][1] - wall["min"][1] > 6.5, report
  assert ink["max"][1] > crown["max"][1] + 0.8, report


def run(url: str, engine: str, output: Path | None, timeout: float) -> None:
  from playwright.sync_api import sync_playwright

  with sync_playwright() as playwright:
    browser = (
      playwright.webkit.launch()
      if engine == "webkit"
      else playwright.chromium.launch(channel="chrome")
    )
    context = browser.new_context(**playwright.devices["iPhone 13"])
    context.add_init_script(PROBE)
    page = context.new_page()
    page.set_default_timeout(timeout * 1000)
    errors: list[str] = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    try:
      page.goto(viewer_url(url), wait_until="domcontentloaded")
      wait_ready(page, "day", timeout)
      seed_camera(
        page,
        {
          "position": [413, 76, -1068],
          "target": [358, 6, -1150],
          "fov": 39,
        },
      )
      for mode in ("day", "night", "snowstorm", "schwellenraum", "day"):
        if mode != "day" or page.evaluate("window.__readModeContinuity().mode") != mode:
          select_mode(page, mode, True)
          wait_ready(page, mode, timeout)
        report = page.evaluate(REPORT)
        validate_report(report)
        print(json.dumps(report, ensure_ascii=False), flush=True)
        if output:
          output.mkdir(parents=True, exist_ok=True)
          if page.locator(".mobile-sheet-title button").is_visible():
            page.locator(".mobile-sheet-title button").tap()
          page.screenshot(path=str(output / f"invalidenpark-{engine}-{mode}.png"))
      assert not errors, errors
    finally:
      context.close()
      browser.close()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="webkit")
  parser.add_argument("--output", type=Path)
  parser.add_argument("--timeout", type=float, default=180)
  args = parser.parse_args()
  run(args.url, args.engine, args.output, args.timeout)
