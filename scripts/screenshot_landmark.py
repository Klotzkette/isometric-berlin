"""Ad-hoc screenshot helper for visual QA of a single landmark deep link.

Usage: uv run python scripts/screenshot_landmark.py <hash> <output.png>
Example: uv run python scripts/screenshot_landmark.py landmark=berlin-hauptbahnhof /tmp/out.png
"""

from __future__ import annotations

import sys
import time

from playwright.sync_api import sync_playwright


def main() -> None:
    hash_fragment = sys.argv[1]
    out_path = sys.argv[2]
    url = f"http://localhost:8821/#{hash_fragment}"
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(
            viewport={"width": 1600, "height": 1000}, device_scale_factor=1
        )
        page.goto(url, wait_until="networkidle")
        time.sleep(4)
        try:
            page.evaluate(
                "document.querySelectorAll('*').forEach(e => "
                "e.style && (e.style.animationDuration = '0s', "
                "e.style.transitionDuration = '0s'))"
            )
        except Exception:
            pass
        time.sleep(2)
        page.screenshot(path=out_path, timeout=150000)
        browser.close()
    print(f"Saved {out_path}")


if __name__ == "__main__":
    main()
