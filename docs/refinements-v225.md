# v1.0.125 integration validation

The requested bounded refinements are documented in
[district house presentation](district-houses-v225.md) and
[Uber Arena / Warschauer Straße](arena-station-v225.md).
No coverage, tour stop, live residency limit or drawn mobile-detail rule changes.

## Automated and package checks

- TypeScript project compilation and production Vite build pass.
- Full Python suite partition: 1,209 passed, four skipped; release/package
  partition: 101 passed. Three new source/scope tests also pass separately.
- Ruff lint and formatting pass repository-wide.
- Focused source ownership, complete triangle retention, walking support,
  district colour, immutable historical outline and v124 memory-lifetime checks
  pass. Historical preservation fixtures remain unchanged; the exact obsolete
  station roof span has an independent receipt from `ee082a82`.
- Release readiness and the local HTTP package smoke pass. Complete extracted
  viewer: **874,690,314 bytes (834.17 MiB)**, below the unchanged 836 MiB limit.

## Browser review

Desktop Chrome completes 29 views over Day → Night → Snow → Schwellenraum →
Flood → Minecraft → Day, visiting all five requested house areas plus both
sites in the drawn/native cycles. No page error, crash or spontaneous context
loss occurred. Cold desktop startup also passes with no critical network or
console errors (11.71 seconds on this development host).

WebKit with the iPhone 13 touch profile completes the same 29-view sequence
without page errors, crashes or spontaneous context loss. Two deliberate GPU
context-loss/restore cycles preserve the same runtime, scene, camera and world,
retain the camera pose, and resume actual drawing. These intentional resets are
recorded separately from the zero-loss touring checks. Maximum sampled mobile
WebGL buffer storage on this tour is 180.9 MiB; the first and final Moabit Day sample both
retain exactly 110,583,790 bytes.

The separate mobile cold-start/control check passes in 12.03 seconds: flight
is the default, no minimap/control applet appears during loading, entering
Walking descends smoothly and returning to flight hides the minimap. That
startup/walking run peaks at 269.2 MiB of WebGL buffers, with zero context losses.

Visual review confirms the arena's curved front and full source roof, the
station's elevated hall and entrance, distinct roof/wall colours in the five
areas, and separate native geometry. These are source-based abstractions;
ordinary facade panes and structural details retain the estimation limits
described in the two source documents.

Browser timings are local observations, not physical-device guarantees.
