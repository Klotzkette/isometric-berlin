# v1.0.73 — Selectable flood depth

Step 10 adds 3 m, 6 m and 21 m buttons to Flooded Berlin, in the desktop
controls and mobile mode sheet. Three metres remains the default. The choice
persists across visual-mode changes in the same session. On mobile, selecting
Flooded Berlin keeps the menu open so the level controls are immediately
available. Button labels and group names are localized in German and English.

## Rendering and preservation

The existing single water mesh moves vertically; it is never rebuilt on a
level change. World levels are 7.2, 10.2 and 25.2 m above the viewer datum,
corresponding to depths above the approximate 4.2 m central street level.
Actual local depth varies with terrain; this fictional mode is not a flood
prediction. Shader view vectors and underwater presentation use the raised
world level. Existing wave amplitude, motion, foam, coverage and tessellation
remain unchanged. Reduced-motion mode repaints on a button press.

Camera, pedestrian position and movement mode are preserved. No additional
city, water mesh, shader program, texture or geometry buffer is created by
changing depth. The full source city, all materials and the v1.0.72 mobile
startup optimizations are preserved. No source, geographic or licence change.

## Verification

- Production TypeScript/Vite build, release readiness and extracted local
  package launch pass.
- 22 focused frontend tests pass, including the unchanged water geometry hash,
  retained attributes/arrays/material, world-space height and wave bounds,
  underwater appearance, visual-mode defaults and localized copy.
- Desktop Chrome and WebKit with the iPhone 13 profile each pass 35 samples,
  17 real depth selections, six submerged/surfaced checks and flight/walking
  roundtrips through the drawn modes, with zero runtime errors or context loss.
  Water GPU handles remain unchanged during depth selection. Compact desktop
  and mobile landscape controls fit; screenshots including 21 m were inspected.
- All 787 Python tests pass; Ruff format/check passes. The two existing CRS
  fixture warnings are unrelated. All 674 packaged city/map assets match
  v1.0.72 byte-for-byte.
- Independent review finds no runtime or UI blocker and confirms all five
  version sources agree on 1.0.73.

The browser regression clicks/taps the real depth buttons during flight and
walking, checks position continuity and actual CPU/GPU buffer identities,
verifies submerged/surfaced transitions at two fixed camera heights, and
checks compact controls. Browser profiles do not certify physical-device RAM.
