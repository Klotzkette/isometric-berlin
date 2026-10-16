# v1.0.122 — runtime recovery and continuous walking

Step 10. The owner reports recurring returns to the opening screen and stuck
walking, and requests double/triple joystick-tap jumping and a smooth flight to
walking handover. The release keeps all authored geometry, colours, materials,
resolution, view distance and CPU/GPU residency budgets.

## Runtime

A recoverable WebGL context loss now pauses the existing renderer, background
uploads and progressive construction instead of immediately destroying the city
and constructing it again. The original scene, camera, walking state and decoded
source backing survive. The browser and Three.js restore the context; visible
buffers upload normally, shadows are invalidated, and interrupted construction
resumes using its existing completed-batch IDs. Surrounding-city requests pause
without evicting their resident packets. Releasing the component cancels its
recovery timer and listeners. A context that does not return within 20 seconds
still uses the existing bounded clean-restart fallback; no retry loop was added.

Instance-residency bookkeeping formerly read `attribute.array.byteLength`.
For a losslessly parked matrix, that getter inflates the whole backing array,
even when the object is invisible. Registration now reads its existing metadata.
The regression demonstrates zero inflating getter calls, exact byte accounting,
unchanged restored matrix values and correct disposal. This avoids unnecessary
allocations; it is not a claimed fixed number of megabytes saved on every device.

## Walking

- Two completed taps on the orange joystick jump. A third tap upgrades the same
  ascent to the existing higher jump. Touch, pen and mouse share the gesture;
  long holds, drags, cancellation, blur and mode changes cannot become taps.
- A subsequent joystick drag moves during the jump; release stops translation.
  The existing keyboard and jump-button controls remain available.
- Airborne feet retain their absolute world height across changes in supporting
  terrain. Low roofs and hurdles can be cleared and landed on, ceilings stop
  ascent, and an upgraded jump remains bounded relative to its takeoff altitude.
- Switching from flight to walking retains the current eye height and eases down
  with bounded speed, landing on the resolved surface at the same horizontal
  position. Grounded stairs, bridge entrances and station-floor rules are intact.
- Explicit Get unstuck first uses safe history and the existing same-level
  search. If these fail, it can seek a clear lower above-ground destination with
  a walkable exit. It cannot exchange a tunnel for its overhead road. The
  bounded flight-escape fallback remains available.

## Verification

Focused navigation tests cover descent, low hurdles, ceilings, elevated traps,
tunnel separation, all bridge profiles, Hauptbahnhof floor joins and the gallery
podium/doors. Real joystick-handler tests cover taps, cancellation, held-edge
motion at 30/60/120 Hz, release and subsequent drag. GPU recovery tests cover
repeated loss, timer cancellation, expiry, disposal and late events. Streaming
and residency tests verify unchanged retained data and resumed requests.

`scripts/smoke_runtime_recovery_v222.py` exercises desktop Chromium and an iPhone
WebKit profile: actual double/triple taps, held drag/release, sampled descending
entry, explicit recovery, and two controlled `WEBGL_lose_context` loss/restore
cycles. Each cycle requires the same runtime, scene, world and camera objects,
unchanged pose and resumed actual draw calls, without the startup chooser.
Its deterministic stuck fixture is removed after the check. This probe is not
shipped with the application.

These tests do not certify a physical phone's available RAM or prevent an
operating system from killing a browser process. No actual-device cause has
been conclusively identified for every reported return to the opening screen.

Observed validation on 2026-10-16:

- Production build, TypeScript, Ruff, release readiness and packaged-viewer smoke
  pass. The standalone type check uses Bun, matching the project build runtime.
- The complete Bun run exercised 3,410 tests: 3,398 passed initially. Its twelve
  failures were individually resolved and rerun: three stale/interleaved source
  checks, eight historical preservation comparisons and a new streaming test
  that mixed fixed timestamps with the process clock. Final affected runtime
  files pass 70 tests / 761 assertions; historical files pass 14 / 218.
- Historical geometry fixtures are unchanged. A compact immutable-release
  receipt independently reproduces six old hashes and pins the already-released
  gallery and later additions before projecting earlier inventories.
- Chromium and iPhone-profile WebKit pass jump, recovery and descent probes,
  including two forced context-loss cycles per engine. Both pass the gallery
  stairs/door route and pose retention through all six modes.
- The final WebKit build completes 28 district views over repeated Day and
  Schwellenraum switches, with no page errors or context loss. GPU buffer bytes
  stabilize at corresponding repeated views; this measures tracked buffers,
  not total browser RAM, textures or driver allocations.
- The complete Python suite passes across its two partitions: 1,310 unique tests
  passed and four skipped (1,226 general checks plus 84 release/package checks;
  the six new probe-validator checks also passed in the release partition).
  Two existing unreferenced-CRS fixture warnings remain.
