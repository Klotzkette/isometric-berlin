# v1.0.20 audio activation repair and verification

Pipeline step 10. Chrome reported that AudioContext could not start before a
user gesture. The warning remained reproducible in public v1.0.19: mount-time
preparation created two contexts without activation, the next animation frame
tried to resume them, and hover/scroll/focus could repeat those attempts.
The 3D scene still became ready; this was an independent audio-start defect.

## Repair

- Remove App's mount-time graph prewarming and eager animation-frame start.
- Create/start audio synchronously only from a trusted activating mouse, key,
  or completed touch/pen gesture. Ignore hover, wheel, scroll, synthetic events
  and nonactivating keys. Keep capture-phase handling for canvas gestures.
- Gate focus/pageshow/visibility retries on a successful audible start of that
  engine; reset activation on disposal/failure. Keep explicit mute and mode
  handovers, including Schwellenraum's independent room/score mix.
- Use neutral waiting labels, without claiming autoplay was blocked before
  any playback attempt.
- Make the browser startup gate reject the specific blocked AudioContext
  warning. Enforce Chromium's user-activation policy and disable media
  engagement bypass. Observe startup from a page timer: Playwright's
  page.evaluate protocol can grant activation and conceal this defect.

This follows [Chrome's Web Audio autoplay guidance](https://developer.chrome.com/blog/autoplay/#web_audio).
No city geometry, detail level or visual rendering settings change.

## Evidence

- Public v1.0.19 instrumentation captured contexts created with activation
  false and the reported warnings. The tightened gate correctly failed on
  two warnings while confirming a ready 3D canvas.
- Fixed desktop Chrome and Chrome touch emulation created zero contexts on
  cold load, hover, wheel, tab refocus, Shift and Escape. A trusted click or
  completed tap created exactly two running standard engines. Audio off/on
  cycles passed with zero audio-policy warnings or JavaScript errors.
- A direct Schwellenraum load remained silent until a real ArrowRight key,
  then created its one running context. Room/score off/on cycles passed.
- Ordinary-mode keyboard activation also passed. WebKit touch created zero
  contexts before the first tap, then synchronously resumed both new contexts
  to running; audio off/on cycles passed. No audio-policy or JavaScript errors
  occurred, only the documented viewport-option advisory.
- The production build passed the stricter cold Chrome startup gate (9.18 s):
  ready scene, zero browser errors, warnings or failed critical requests.
- The 119 focused audio/lifecycle/startup tests pass (4,829 assertions).
  All 367 Python tests pass (43.69 s); Ruff, TypeScript, production build,
  release readiness and local package HTTP/start-page checks pass.
- The complete frontend suite passes: 1,854 tests across 231 files, zero
  failures and 7,030,792 assertions (343.73 s).
- The final package's 19 entry/browser asset files match the browser-tested
  production build byte for byte. Independent code review found no blockers.

Browser timings are local observations, not performance guarantees. Touch
emulation does not establish physical iPhone compatibility.

## Artifacts

- ZIP: 36,305,246 bytes, SHA-256
  `ff0965404bf8ab7a7cdebfcfc9c011f9f944d2e49c6f7eaee78ccd3507ae4e8d`.
- Static viewer archive: 35,725,147 bytes, SHA-256
  `c45faa633cb5af0ec9630d5c4e4295bd05ce0baae1a7a13aef1f63fe39839e94`.
