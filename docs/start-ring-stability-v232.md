# v1.0.132 — varied starts, Ringbahn and offscreen memory

Step 10, within retained coverage. Ordinary launches rotate through seven flight
views: Bundeskanzleramt, Brandenburger Tor, the established Berlin Junction /
Richard Serra approach, Hauptbahnhof, Gedächtniskirche, Rotes Rathaus and Neue
Nationalgalerie. Explicit place links take precedence; mode changes and graphics
recovery preserve the current place. Walking remains opt-in. See
[start selection](start-places-v232.md).

All 27 Ringbahn stations retain their existing mapped platforms. The five major
individually modeled nodes remain untouched. The bounded additional recognition
pass covers the other 22 stations, with reverse-side name lettering and Ring line
identity; source-clipped supports refine four existing canopy surfaces. See
[station audit](ring-stations-v232.md).

A material pass affects only positively matched ordinary outer buildings with
retained OSM material/colour evidence. It changes existing packed colour values,
adds no geometry, buffers or textures, and excludes individually authored fronts.
It does not claim a survey of every outer-city facade. See
[material evidence](outer-materials-v232.md).

## Wide-view stability

Geometry residency previously checked handle count only (6,000). A few large
city buffers could consume substantial memory without crossing that count.
Residency now also counts unique uploaded attribute bytes from lossless storage
metadata without inflating the CPU source. A 64 MiB offscreen retention target
and 16 MiB growth threshold supplement the unchanged handle policy. Under byte
pressure the safety margin around the camera is 18%, rather than twice the view
width/height. Neither policy limits actually visible objects.

The existing ownership protection, grace, bounded scans, context-loss reset,
unchanged-attribute checks and shared-owner rules remain. Immediate/growth sweeps
are rearmed only by additional pressure, avoiding full scans every frame in a
legitimately large visible view. Materials, CPU source, bounding volumes,
positions, indices, resolution, visible range and detail levels do not change.
Wireframe-derived private indices remain covered by handle accounting; the byte
counter describes authored unique attributes, not total driver or device memory.

Tests against Three's real WebGL attribute/disposal backend reproduce a small
handle count exceeding the byte target, reclaim offscreen storage, and compare
all re-uploaded bytes exactly. Visible/shared/edge-crossing objects stay intact;
ordinary byte-pressure cleanup respects grace and scan limits. The combined
storage/residency suite initially passes 37 tests, including three new cases.

## Production validation

The TypeScript/Vite production build passes. The targeted Bun run passes 137
checks across 12 files; an additional startup run passes 23 checks. All seven new
Python source/evidence checks pass. The full Python suite passes 1,403 tests with four skips; two existing
fixture CRS warnings remain. Ruff formatting/lint and the whitespace check pass.

The production build was exercised in Chromium desktop and WebKit's iPhone 13
profile. Each engine completed 28 wide-view samples, another 28 at the maximum
camera distance, and 14 with the wider 39-degree lens, covering all six modes and
a return to day. All 140 samples completed without page errors, renderer loss or
return to the entry screen. The seven-start rotation plus wraparound passed in
WebKit; mode changes and a forced graphics reset preserved the selected place.
The loading screen never exposed the scene HUD or minimap. Eight desktop detail
views checked Ringbahn boards/supports and source material colours in drawn and
native modes. An explicit flooded Rotes-Rathaus link retained its destination.

The packaged ZIP passed the release-readiness check including archive validation.
Both complete offline archives match their uploaded GitHub SHA-256 digests. The
tar archive's 4,368 members were validated byte-for-byte while streaming; this
avoided a second full archive copy after the development host ran low on disk.
The site's prepared publication preserves 1,530 older hashed assets for existing
browser sessions. Publication is checked against the staged asset hashes and
release digests, followed by a fresh public start in each browser engine.

Physical phone RAM limits are not simulated by desktop browser device profiles;
these checks do not establish an unconditional crash-free guarantee.
