"""Ad-hoc screenshot helper for visual QA of a single landmark deep link.

Usage: uv run python scripts/screenshot_landmark.py <hash> <output.png>
Example: uv run python scripts/screenshot_landmark.py landmark=berlin-hauptbahnhof /tmp/out.png
"""

from __future__ import annotations

import base64
import sys
import time

from playwright.sync_api import sync_playwright


def main() -> None:
    hash_fragment = sys.argv[1]
    out_path = sys.argv[2]
    url = f"http://localhost:8821/#{hash_fragment}"
    with sync_playwright() as p:
        browser = p.chromium.launch(
            args=["--no-sandbox", "--disable-gpu", "--use-gl=swiftshader"]
        )
        page = browser.new_page(
            viewport={"width": 1600, "height": 1000}, device_scale_factor=1
        )
        page.goto(url, wait_until="load", timeout=60000)
        time.sleep(8)
        client = page.context.new_cdp_session(page)
        result = client.send(
            "Page.captureScreenshot",
            {"format": "png", "captureBeyondViewport": False},
        )
        with open(out_path, "wb") as fh:
            fh.write(base64.b64decode(result["data"]))
        browser.close()
    print(f"Saved {out_path}")


if __name__ == "__main__":
    main()
