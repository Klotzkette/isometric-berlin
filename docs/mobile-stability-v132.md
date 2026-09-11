# Mobile stability safeguards — v1.0.32

Graphics context loss now immediately cancels animation, GPU warmup, pending
downloads and progressive worker work. The existing single automatic retry
rebuilds the viewer after cleanup, preserving the visitor's camera and walking
state. A second failure stops at the recovery screen instead of restarting again.
Hidden tabs skip frame rendering and navigation updates.

Scene geometry, render quality, drawing distance and movement speed are unchanged.

## Verification

- Production build succeeds.
- All 424 Python tests, Ruff checks, release readiness and local-package smoke
  checks pass.
- 28 focused frontend tests pass (navigation, residency and rendering quality).
- The mobile smoke probe injects actual `WEBGL_lose_context` events into Chrome
  with a Pixel 5 profile and WebKit with an iPhone SE profile. Both recover at
  the same pose, release the old scene and worker, and stop after a second loss.
  Chrome additionally verifies recovery while walking.
- Context-loss injection is opt-in: `--context-loss`.

These are browser-engine tests with mobile profiles, not tests on physical
phones. They verify recovery from a graphics context loss; an operating system
terminating the entire browser process cannot be intercepted by this code.
