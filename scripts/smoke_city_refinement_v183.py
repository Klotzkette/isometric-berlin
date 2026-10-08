"""Bounded real-browser architectural and six-mode checks for v183."""

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
from smoke_ring_city_v182 import MODES, settle_outer, walk_steglitz
from smoke_surrounding_city import OUTER_STATE

ROUTE = (
  ("nationalgalerie", [-160, 95, 1480], [-292, 14, 1319]),
  ("molecule", [5820, 75, 2440], [5891, 18, 2570]),
  ("alexander", [3250, 165, 50], [2910, 28, -180]),
  ("jannowitz", [3390, 80, 750], [3260, 14, 600]),
  ("charlottenburg", [-4860, 160, -80], [-5133, 22, -338]),
  ("moabit", [-950, 120, -640], [-1170, 25, -855]),
  ("fritz-schloss", [-650, 170, -930], [-1000, 12, -1220]),
  ("south-city", [-2200, 260, 6460], [-2400, 3, 6160]),
)


def run(url: str, engine: str, output: Path, desktop: bool = False) -> None:
  from playwright.sync_api import sync_playwright

  report = {"engine": engine, "desktop": desktop, "samples": [], "errors": []}
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
    page.on("pageerror", lambda e: report["errors"].append(str(e)))
    page.on("crash", lambda: report["errors"].append("Page crashed"))
    page.on(
      "console",
      lambda msg: report["errors"].append(msg.text) if msg.type == "error" else None,
    )
    try:
      page.goto(viewer_url(url), wait_until="domcontentloaded")
      wait_ready(page, "day", 120)
      for index, mode in enumerate(MODES):
        if index:
          select_mode(page, mode, not desktop)
          wait_ready(page, mode, 120)
        route = ROUTE if index == 0 else (ROUTE[0], ROUTE[2])
        for name, position, target in route:
          seed_camera(page, {"position": position, "target": target, "fov": 39})
          settle_outer(page)
          sample = page.evaluate(READ_STATE)
          sample.update(view=name, outer=page.evaluate(OUTER_STATE))
          if desktop:
            assert sample["ready"] and sample["mode"] == mode
            assert not sample["contextLost"] and sample["lost"] == 0
          else:
            validate_sample(sample, mode)
          outer = sample["outer"]
          assert outer["manifest"] and not outer["pending"]
          assert outer["buffers"] <= outer["chunks"] * 3
          assert outer["bytes"] <= outer["chunks"] * 12 * 1024 * 1024
          assert outer["drawnRoots" if mode == "minecraft" else "nativeRoots"] == 0
          assert not report["errors"], report["errors"]
          report["samples"].append(sample)
          print(json.dumps(sample), flush=True)
          if index == 0 or mode == "minecraft":
            page.screenshot(
              path=str(output.with_name(f"{output.stem}-{mode}-{name}.png"))
            )
      report["walking"] = walk_steglitz(page, not desktop)
      final = page.evaluate(READ_STATE)
      assert final["lost"] == 0 and not final["contextLost"] and not report["errors"]
      report.update(success=True, final=final)
    finally:
      output.write_text(json.dumps(report, indent=2))
      context.close()
      browser.close()


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("url")
  parser.add_argument("--engine", choices=("webkit", "chromium"), default="webkit")
  parser.add_argument("--output", type=Path, default=Path("/tmp/city-v183.json"))
  parser.add_argument("--desktop", action="store_true")
  args = parser.parse_args()
  run(args.url, args.engine, args.output, args.desktop)
