"""Bounded real-viewer v182 route, mode-family and Steglitz walking smoke.

Phone browser profiles exercise engines, not the RAM limit of physical devices.
Uses the existing actual-UI helpers; direct runtime writes only seed the camera.
"""

from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path
from typing import Any

from shapely.geometry import Point, Polygon
from smoke_mobile_memory import BUFFER_PROBE, READ_STATE, validate_sample
from smoke_mode_continuity import (
  PROBE,
  open_mobile_actions,
  seed_camera,
  select_mode,
  viewer_url,
  wait_ready,
)
from smoke_surrounding_city import OUTER_STATE

ROOT = Path(__file__).resolve().parents[1]
MODES = ("day", "night", "snowstorm", "schwellenraum", "flood", "minecraft", "day")
ROUTE = (
  ("kreisel", [-3430, 220, 7160], [-3626, 55, 6933]),
  ("rbb", [-6410, 220, 1320], [-6660, 35, 1102]),
  ("estrel", [6070, 260, 5430], [5790, 60, 5222]),
  ("humboldthain", [1190, 180, -2920], [1030, 30, -3140]),
  ("viktoriapark", [720, 190, 3750], [575, 18, 3505]),
  ("friedrichshain", [4460, 210, -650], [4150, 20, -940]),
)
CORE_VIEW = ("return-core", [-900, 350, 300], [-650, 5, 0])


def ring_view(root: Path = ROOT) -> tuple[str, list[float], list[float], str]:
  """Choose an inhabited new Ringbahn tile, with its centre inside actual ground."""
  manifest = json.loads(
    (root / "geo_data/regierungsviertel/ring-city-v182-manifest.json").read_bytes()
  )
  folder = root / "src/app/public/mesh/surrounding-berlin-v159"
  for chunk in manifest["chunks"]:
    x0, z0, x1, z1 = chunk["bounds"]
    if x0 <= 0 or z0 <= 3500 or chunk["buildingCount"] < 150:
      continue
    payload = json.loads(gzip.decompress((folder / chunk["drawn"]["url"]).read_bytes()))
    x, z = (x0 + x1) / 2, (z0 + z1) / 2
    local = Point(x - payload["origin"][0], z - payload["origin"][2])
    if len(payload["nav"]["buildings"]) < 50 or not any(
      Polygon(p["ring"], p["holes"]).covers(local) for p in payload["nav"]["ground"]
    ):
      continue
    return "ring-urban", [x + 240, 235, z + 270], [x, 3, z], chunk["id"]
  raise AssertionError("No populated new Ringbahn tile with a source-ground centre")


def settle_outer(page: Any) -> None:
  """Wait for the existing serial queue and its reversal retirement window."""
  page.wait_for_function(
    "() => {const c=window.__modeContinuityRuntime()?.surroundingCity;"
    "return c?.manifest && !c.pending;}",
    timeout=60_000,
  )
  page.wait_for_timeout(2100)


def walk_steglitz(page: Any, touch: bool) -> dict[str, Any]:
  """Enter walking through the visible UI on loaded free ground at the market."""
  seed_camera(
    page, {"position": [-3220, 180, 7100], "target": [-3447, 3, 6834], "fov": 39}
  )
  settle_outer(page)
  point = page.evaluate("""() => {
    const c=window.__modeContinuityRuntime().surroundingCity;
    for(let dz=0;dz<=32;dz+=4)for(let dx=0;dx<=32;dx+=4){
      const x=-3447+dx,z=6834+dz,y=c.groundAt(x,z);
      if(y!==null&&!c.waterAt(x,z)&&!c.solidAt(x,y+1,z,2))return [x,y,z];
    } return null;
  }""")
  assert point, "No dry free Steglitz source ground loaded"
  x, y, z = point
  assert z > 4380, "Walking gate must exercise the former southern world limit"
  seed_camera(
    page, {"position": [x, y + 4, z], "target": [x, y + 1, z - 12], "fov": 39}
  )
  if touch:
    open_mobile_actions(page)
    page.locator(".mobile-overflow-grid").get_by_role(
      "button", name="Walk", exact=True
    ).tap()
    if page.locator(".mobile-sheet-title button").is_visible():
      page.locator(".mobile-sheet-title button").tap()
  else:
    page.locator(".pedestrian-mode-toggle").click()
  page.wait_for_function("window.__readModeContinuity()?.pedestrian?.grounded === true")
  initial = page.evaluate("window.__readModeContinuity()")
  assert initial["enabled"] and abs(initial["pedestrian"]["x"] - x) < 2
  assert abs(initial["pedestrian"]["z"] - z) < 2, initial
  assert page.locator(".pedestrian-minimap").is_visible()
  page.keyboard.down("w")
  page.keyboard.down("ArrowRight")
  page.wait_for_timeout(180)
  page.keyboard.up("ArrowRight")
  page.keyboard.up("w")
  page.wait_for_timeout(500)
  moved = page.evaluate("window.__readModeContinuity()")
  assert moved["pedestrian"]["z"] > 4380 and moved["pedestrian"]["grounded"], moved
  assert abs(moved["pedestrian"]["x"] - x) + abs(moved["pedestrian"]["z"] - z) > 0.2, (
    moved
  )
  for mode in ("minecraft", "day"):
    select_mode(page, mode, touch)
    restored = wait_ready(page, mode, 120)
    assert restored["enabled"] and restored["pedestrian"]["z"] > 4380, restored
    for axis in ("x", "z"):
      assert abs(restored["pedestrian"][axis] - moved["pedestrian"][axis]) < 0.05, (
        restored
      )
  return {
    "sourcePoint": point,
    "initial": initial,
    "moved": moved,
    "restored": restored,
  }


def run(url: str, engine: str, output: Path, desktop: bool = False) -> None:
  """Exercise only the new release sites, plus one old-core retirement return."""
  from playwright.sync_api import sync_playwright

  urban_name, urban_position, urban_target, urban_id = ring_view()
  urban = (urban_name, urban_position, urban_target)
  report: dict[str, Any] = {
    "engine": engine,
    "desktop": desktop,
    "ringTile": urban_id,
    "samples": [],
    "errors": [],
    "budgetPolicy": "One source family, at most3buffers perchunk, perchunk12MiB guard;24MiB residency is a soft target that never evicts visible detail.",
  }
  output.parent.mkdir(parents=True, exist_ok=True)
  with sync_playwright() as p:
    browser = getattr(p, engine).launch(
      **({"channel": "chrome"} if engine == "chromium" else {})
    )
    context = browser.new_context(
      **(
        {"viewport": {"width": 1365, "height": 900}}
        if desktop
        else p.devices["iPhone 13" if engine == "webkit" else "Pixel 5"]
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
      lambda msg: (
        report["errors"].append(msg.text)
        if msg.type == "error" or msg.text.startswith("Berlin surroundings:")
        else None
      ),
    )
    try:
      page.goto(viewer_url(url), wait_until="domcontentloaded")
      wait_ready(page, "day", 120)
      for index, mode in enumerate(MODES):
        if index:
          select_mode(page, mode, not desktop)
          wait_ready(page, mode, 120)
        route = (
          (*ROUTE, urban)
          if index == 0
          else (CORE_VIEW,)
          if index == len(MODES) - 1
          else (ROUTE[0], ROUTE[3])
        )
        for name, position, target in route:
          seed_camera(page, {"position": position, "target": target, "fov": 39})
          settle_outer(page)
          sample = page.evaluate(READ_STATE)
          sample.update(view=name, outer=page.evaluate(OUTER_STATE))
          if name == "kreisel":
            sample["steglitzFamilies"] = page.evaluate("""() => {
              const roots=[];
              window.__modeContinuityRuntime().scene.traverse(o=>{
                if(!o.name.startsWith('Steglitz:'))return;
                for(let p=o;p;p=p.parent)if(!p.visible)return;
                roots.push(o.name.includes('block-native')?'native':'drawn');
              });return roots;
            }""")
            assert sample["steglitzFamilies"] == [
              "native" if mode == "minecraft" else "drawn"
            ], sample
          if desktop:
            assert (
              sample["ready"]
              and sample["mode"] == mode
              and not sample["contextLost"]
              and sample["lost"] == 0
            ), sample
          else:
            validate_sample(sample, mode)
          outer = sample["outer"]
          assert outer["manifest"] and not outer["pending"], sample
          assert outer["buffers"] <= outer["chunks"] * 3, sample
          assert outer["bytes"] <= outer["chunks"] * 12 * 1024 * 1024, sample
          assert outer["drawnRoots" if mode == "minecraft" else "nativeRoots"] == 0, (
            sample
          )
          if name in {"kreisel", "rbb", "estrel", "ring-urban"}:
            assert outer["chunks"] > 0, sample
          if name == "ring-urban":
            assert page.evaluate(
              "id => window.__modeContinuityRuntime().surroundingCity.root.children.some(c=>c.name.includes(id))",
              urban_id,
            ), sample
          report["samples"].append(sample)
          print(json.dumps(sample), flush=True)
          assert not report["errors"], report["errors"]
          if (
            index == 0
            and name in {"kreisel", "humboldthain", "viktoriapark", "friedrichshain"}
          ) or mode == "minecraft":
            page.screenshot(
              path=str(output.with_name(f"{output.stem}-{mode}-{name}.png"))
            )
      report["walking"] = walk_steglitz(page, not desktop)
      page.screenshot(path=str(output.with_name(f"{output.stem}-steglitz-walking.png")))
      final = page.evaluate(READ_STATE)
      assert final["lost"] == 0 and not final["contextLost"] and not report["errors"], (
        final
      )
      report.update(success=True, final=final)
    finally:
      output.write_text(json.dumps(report, indent=2))
      context.close()
      browser.close()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("webkit", "chromium"), default="webkit")
  parser.add_argument("--output", type=Path, default=Path("/tmp/ring-city-v182.json"))
  parser.add_argument("--desktop", action="store_true")
  args = parser.parse_args()
  run(args.url, args.engine, args.output, args.desktop)
