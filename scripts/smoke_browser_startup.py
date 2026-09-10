"""Check a cold 3D startup in a real browser, including caught console errors.

Run without changing the repository's dependencies:
  uv run --with playwright python scripts/smoke_browser_startup.py URL --channel chrome
  uv run --with playwright playwright install webkit
  uv run --with playwright python scripts/smoke_browser_startup.py URL --engine webkit --touch

Progress and the final result are JSON lines. The exit status is nonzero on failure.
A failed run saves a screenshot in the temporary directory unless --screenshot
provides a path; an explicit path also saves the successful ready view. Touch
emulation checks that startup profile, not physical iPhone GPU compatibility.
"""

from __future__ import annotations

import argparse
import json
import tempfile
import time
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import ConsoleMessage, Request, Response, sync_playwright

CRITICAL_RESOURCE_TYPES = {"document", "script", "stylesheet", "xhr", "fetch"}
CONSOLE_ADVISORIES = {
  'Viewport argument key "interactive-widget" not recognized and ignored.'
}
STARTUP_STATE = """() => {
  const visible = (element) => {
    if (!element) return false;
    const box = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return box.width > 0 && box.height > 0 &&
      style.display !== 'none' && style.visibility !== 'hidden';
  };
  const viewer = document.querySelector('.three-viewer.is-active');
  const canvas = viewer?.querySelector('canvas');
  const error = document.querySelector('.three-viewer-error.is-active');
  return {
    ready: !!viewer?.classList.contains('is-presentation-ready') &&
      visible(canvas) && canvas.width > 0 && canvas.height > 0 &&
      !viewer.querySelector('.three-startup-curtain, .three-progress'),
    canvasVisible: visible(canvas),
    curtain: !!viewer?.querySelector('.three-startup-curtain'),
    progress: viewer?.querySelector('.three-progress')?.textContent ?? null,
    error: visible(error) ? error.textContent : null,
  };
}"""


def emit(value: dict[str, Any]) -> None:
  print(json.dumps(value, ensure_ascii=False), flush=True)


def parse_args() -> argparse.Namespace:
  parser = argparse.ArgumentParser(
    description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
  )
  parser.add_argument("url", help="Complete HTTP(S) viewer URL")
  parser.add_argument("--engine", choices=("chromium", "webkit"), default="chromium")
  parser.add_argument("--channel", choices=("chrome",), help="Use installed Chrome")
  parser.add_argument("--touch", action="store_true", help="Use a mobile touch context")
  parser.add_argument("--timeout", type=float, default=120, help="Timeout in seconds")
  parser.add_argument("--screenshot", type=Path, help="Save a PNG at this path")
  args = parser.parse_args()
  if urlparse(args.url).scheme not in {"http", "https"}:
    parser.error("URL must use HTTP or HTTPS; file:// cannot load the complete viewer")
  if args.channel and args.engine != "chromium":
    parser.error("--channel chrome requires --engine chromium")
  if args.timeout <= 0:
    parser.error("--timeout must be positive")
  return args


def smoke(args: argparse.Namespace) -> dict[str, Any]:
  started = time.monotonic()
  deadline = started + args.timeout
  page_errors: list[str] = []
  console_errors: list[dict[str, Any]] = []
  console_advisories: list[dict[str, Any]] = []
  failed_requests: list[dict[str, Any]] = []
  response_count = 0
  state: dict[str, Any] = {}
  failure: str | None = None
  screenshot: str | None = None
  observing = True

  def on_console(message: ConsoleMessage) -> None:
    if observing and message.type == "error":
      # React/runtime catches can log exceptions without emitting pageerror.
      entries = (
        console_advisories if message.text in CONSOLE_ADVISORIES else console_errors
      )
      entries.append({"text": message.text, "location": message.location})

  def on_response(response: Response) -> None:
    nonlocal response_count
    if not observing:
      return
    response_count += 1
    if (
      response.status >= 400
      and response.request.resource_type in CRITICAL_RESOURCE_TYPES
    ):
      failed_requests.append({"url": response.url, "status": response.status})

  def on_request_failed(request: Request) -> None:
    if observing and request.resource_type in CRITICAL_RESOURCE_TYPES:
      failed_requests.append({"url": request.url, "error": request.failure})

  emit(
    {"event": "starting", "url": args.url, "engine": args.engine, "touch": args.touch}
  )
  with sync_playwright() as playwright:
    browser = None
    page = None
    try:
      launch_options: dict[str, Any] = {"headless": True}
      if args.channel:
        launch_options["channel"] = args.channel
      browser = getattr(playwright, args.engine).launch(**launch_options)
      # A new non-persistent context has no saved cookies, preferences or HTTP cache.
      context_options: dict[str, Any] = {"service_workers": "block"}
      if args.touch:
        context_options.update(playwright.devices["iPhone 13"])
      else:
        context_options["viewport"] = {"width": 1440, "height": 900}
      context = browser.new_context(**context_options)
      page = context.new_page()
      page.on("pageerror", lambda error: page_errors.append(str(error)))
      page.on("console", on_console)
      page.on("response", on_response)
      page.on("requestfailed", on_request_failed)
      page.goto(
        args.url, wait_until="domcontentloaded", timeout=min(args.timeout, 45) * 1000
      )
      next_progress = started
      ready_since: float | None = None
      while time.monotonic() < deadline:
        state = page.evaluate(STARTUP_STATE)
        if page_errors or console_errors or failed_requests or state["error"]:
          failure = "3D startup reported a browser, runtime or critical network error"
          break
        now = time.monotonic()
        ready_since = (ready_since or now) if state["ready"] else None
        if ready_since is not None and now - ready_since >= 3:
          break
        if now >= next_progress:
          emit({"event": "waiting", "elapsedSeconds": round(now - started, 1), **state})
          next_progress = now + 10
        page.wait_for_timeout(500)
      else:
        failure = "Timed out before the 3D canvas completed startup and remained ready"
    except Exception as error:
      failure = f"{type(error).__name__}: {error}"
    finally:
      if page is not None and (args.screenshot or failure):
        target = args.screenshot or Path(tempfile.gettempdir()) / (
          f"isometric-berlin-startup-{args.engine}-{time.time_ns()}.png"
        )
        try:
          target.parent.mkdir(parents=True, exist_ok=True)
          page.screenshot(path=str(target), full_page=True, timeout=10000)
          screenshot = str(target.resolve())
        except Exception as error:
          failure = f"{failure or 'Screenshot failed'}; screenshot: {error}"
      if failure is None and (page_errors or console_errors or failed_requests):
        failure = "3D startup reported a browser, runtime or critical network error"
      # Closing the test itself can abort background fetches; those are not
      # startup failures and must not contaminate an otherwise successful run.
      observing = False
      if browser is not None:
        browser.close()
  return {
    "event": "result",
    "success": failure is None,
    "url": args.url,
    "engine": args.engine,
    "channel": args.channel,
    "touch": args.touch,
    "elapsedSeconds": round(time.monotonic() - started, 2),
    "failure": failure,
    "state": state,
    "counts": {
      "responses": response_count,
      "pageErrors": len(page_errors),
      "consoleErrors": len(console_errors),
      "consoleAdvisories": len(console_advisories),
      "failedCriticalRequests": len(failed_requests),
    },
    "pageErrors": page_errors[:50],
    "consoleErrors": console_errors[:50],
    "consoleAdvisories": console_advisories[:50],
    "failedCriticalRequests": failed_requests[:50],
    "screenshot": screenshot,
  }


if __name__ == "__main__":
  result = smoke(parse_args())
  emit(result)
  raise SystemExit(0 if result["success"] else 1)
