# v1.0.22 fluid movement, distant detail and TIPI site

Pipeline step 10. Mobile v1.0.21 repeatedly rebuilt/uploaded recently visited
building districts and scanned the whole scene on district changes. Its radial
selection ignored the actual lens, leaving visible distant buildings without
fine detail. Around the TIPI, generic nine-metre context prisms misrepresented
small mapped tents and low connecting structures.

## Changes

- Increase horizontal joystick/held-flight and pan speed by about 15 percent.
  Mouse/touch share the same input curve; vertical speed and level heading stay
  unchanged, along with all source data, resolution and anti-aliasing settings.
- Allocate the existing 15-district/3,600-part active budget across the local
  ground focus, five lens/viewport samples reaching up to 2,400 m, and up to
  900 m along travel. A 120 m retention preference reduces boundary churn.
- Retain up to five recent districts for returns, reserving space for pending
  wanted districts. The fixed maximum is 4,800 streamed parts plus 160 startup
  parts. This increases possible resident detail compared with v1.0.21 while
  bounding memory independently of journey length.
- Register and retire only the affected district's ink/detail references.
  Reuse untouched bounds and restore source coverage before eviction. Do not
  scan/enqueue the whole city on each district change or settled message.
- Observe actual completed ordinary draws, preserving authored callbacks and
  requiring every active material group. Already uploaded geometry skips a
  redundant GPU preparation pass; offscreen preparation and context recovery
  remain available with unchanged geometry/shadow/transmission behavior.
- Replace exactly twenty TIPI fallback display masses with source-bound
  pavilions/service wings; retain the source records, real containers and
  Carillon. Keep the main eight-peak canvas, align its north/south axis and
  northern entrance, and provide the corresponding single-batch Minecraft
  reading. Roof curvature/heights are labelled display estimates; see
  [source evidence](tipi-site-v122.md).

## Verification

- Chrome touch: the same timed eight-leg joystick input sequence produced
  70 district builds rather than 107; repeat builds fell from 64 to 34.
  Geometry uploads fell from 171.940 to 157.724 MiB, despite the increased
  configured flight speed and view-aware far detail. Main-frame callback p95
  fell from 6.0 to 4.6 ms; RAF p95 remained 16.7–16.8 ms. The fixed run had no
  long tasks or frames over 50 ms. These are host observations, not a physical
  phone benchmark or a guarantee across routes and hardware.
- WebKit touch completed the same input sequence with 68 district arrivals,
  22 ms RAF p95, one 53 ms frame and none over 100 ms. No Worker, network or
  WebGL context-loss errors occurred. The known viewport advisory remained.
- Source/frustum tests at three portrait views put more than half of the
  visible distant (>800 m) source parts into exact selection at the unchanged
  active budget. The initial portrait sample improved from 54% to 92% overall.
  A wide overview deliberately distributes more of that budget toward the
  horizon; complete source envelopes remain present everywhere.
- The actual production viewer's cache/attachment tests cover quick return
  without reupload, bounded long travel, stale messages and preview restoration
  before eviction. Incremental registration/removal performs zero whole-city
  scans or GPU enqueues and preserves unrelated detail visibility.
- All five TIPI modes reached a ready production canvas with no page errors;
  screenshots were visually inspected. Source-ring, height-provenance, pointed
  roof, open-gap, retained-neighbour and Minecraft tests pass.
- Chrome and WebKit touch cold startup pass (8.06/7.45 s), as does desktop
  Chrome (8.35 s). No runtime, audio-policy or critical network failures.
- The production mobile menu gate passes five viewport sizes and all five
  modes, native scrolling and first-visit attribution/navigation behavior.
- All 375 Python tests pass (38.63 s); Ruff, TypeScript, production build,
  release readiness and local package HTTP/start-page checks pass.
- The complete frontend run covered 1,903 tests. Its four old TIPI geometry
  snapshots were updated from the unchanged-source replacement and independently
  measured synchronous full/mobile builds, then the affected files were rerun.
  The corrected files pass: 67 tests, zero failures, 5,937,192 assertions
  (24.76 s). The remaining 1,836 tests passed in the complete run.
- All 19 production entry/browser assets match the release package byte for byte.

Physical iPhone testing was not available. The mapped boundary and intentional
outer paper margin remain unchanged. The distant refinement is a bounded
selection within the view, not a promise that every fine ornament out to 2.4 km
is simultaneously resident.

## Artifacts

- ZIP: 36,312,684 bytes, SHA-256
  `62e914b01f39a68979485ad9376ddd3602c105613c0b7f53ce8f38f8cb94b240`.
- Static viewer archive: 35,734,500 bytes, SHA-256
  `f0b3e1dfc4931b10dfa5bfa76549c137392af9b7d184df6e7c75f9658dc44544`.
