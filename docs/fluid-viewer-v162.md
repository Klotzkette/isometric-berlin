# Lossless viewer performance, v1.0.62

Pipeline step 10. This release addresses movement and incremental-loading
stutters without removing authored geometry, facade detail, roads, shorelines,
monuments, animation, rendering distance or resolution. Source payload files,
the published bounds and all 93 tour records remain byte-identical to v1.0.61.

## Changes and preservation contracts

- Immutable park instances use 512 m spatial batches instead of 256 m batches.
  All 450,029 instances and 33,793,136 instance bytes remain exactly the same;
  source-independent matrix/colour hashes match. The number of instance batches
  falls from 5,373 to 1,722. Conservative boxes and spheres enclose every
  transformed primitive, including those crossing cell boundaries. Wider batches
  submit some additional offscreen instances; this is a CPU/GPU tradeoff, not a
  detail or viewing-distance change.
- Shared static park primitives use exact vertex indexing before publication.
  Expanded position, normal, UV and all other attribute bytes, triangle order,
  materials and instance bytes remain identical. Across the full instance set,
  stored vertex records fall from 64,044,252 to 20,437,149 while the same
  69,661,908 triangle corners remain. A common crown primitive uses 57 vertices
  and the original 240 triangle indices instead of 240 separate vertices.
  These are geometry counts, not a claimed FPS multiplier.
- Static landmark transforms are composed once; the fixed signature wrapper
  no longer forces a descendant world-matrix recomputation each render pass.
  Flag nodes remain dynamic, and normal transformed-parent propagation remains.
- Hauptbahnhof's 364 identical rail, platform and deck bodies use 26 submissions
  in station-local 48 m cells. All source geometry, materials and 76 original
  outline objects remain. Instance matrices retain ordinary Float32 GPU
  precision; this is not a claim of pixel-bit identity across shader evaluation.
- Desktop GPU preparation considers a margin around the view and waits for
  input pauses. Visible objects always upload through ordinary rendering;
  neither visibility nor source eligibility depends on preparation. The warmup
  shader-context check examines cached lights and their current ancestry rather
  than traversing the entire city every frame. Enqueue/release update ownership.
  Mobile GPU residency budgets and disposal policies remain unchanged.
- Surrounding-city construction yields after roughly 3 ms of accumulated work.
  Base64 decode, interleaving, indices and exact bounds share the same generator
  as the synchronous constructor. Abort, hidden views, mode revisions and
  obsolete camera requests cannot publish partial geometry. All ten refined
  avenue packets retain identical buffers and exact bounds.

- Deferred park-path construction yields within and between ribbons; its
  synchronous API drains the same generator. Materials are created only after
  geometry is ready, so cancellation cannot strand an unpublished texture.
  Exact district-scope queries use an edge index rather than rescanning the
  entire 1,777-edge boundary at every ribbon vertex. Neither boundary
  coordinates nor intersection arithmetic are simplified.

## Measurement method

`scripts/profile_viewer_motion.py` runs fresh Chrome contexts with fixed camera
poses, pointer trajectories and W flight. The desktop profile is 1440×900,
DPR 1. `--touch` uses 390×844, DPR 3 and the mobile viewer path. It runs on the
same desktop machine; it does not reproduce a physical phone's CPU, GPU,
thermal state or memory limit. The touch profile scales mouse orbit input and
uses W flight, so it is not a native-touch gesture benchmark.

All render passes contribute to reported draw counts. CPU renderer submission
time includes driver stalls but does not directly measure asynchronous GPU time.
Frame distributions retain outliers. One browser runs at a time. Warmup,
incremental loading and startup are kept visible in the measurements rather
than claiming universal frame rates from a geometry microbenchmark.

The initial wider-batch-only experiment reduced submissions but did not improve
panorama frame time on the test host. Exact primitive indexing was added after
that observation; draw-count reductions alone were not accepted as speed proof.

## Verification

The focused tests cover expanded attribute hashes, source-instance identity,
conservative bounds, full/mobile/cooperative geometry equality, unchanged
landmark world matrices, animated flags, cancelled chunk construction and
dynamic light visibility/ownership. The independent final code review found no
release blocker. `src/app/public/` and `geo_data/` have no changed files.

The fixed-camera comparison against v1.0.61 at 1440×900 covers Kanzleramt,
Washingtonplatz/Hauptbahnhof and a broad Tiergarten view. Only 26, 163 and 28
pixels respectively differ out of 1,296,000 pixels (at most 0.0126%); mean
absolute channel error is at most 0.00036 on a 0–255 scale. The images were also
visually inspected. No missing surfaces or altered silhouettes were observed.
These tiny rasterization differences complement, rather than replace, the
expanded-buffer and instance-identity tests.

The initial mobile profiles also exposed an approximately three-second
synchronous park-path task during deferred startup. CPU samples attributed
most of it to district-scope boundary tests. This prompted the exact edge
index and cooperative path generation described above; the task was not
silently discarded as an idle measurement outlier.

## Measured movement results

Measurements on macOS arm64, Chrome 154.0.8037.59; five seconds each, fixed
poses/input paths, five-second settle, fresh cache-disabled contexts, CPU
profiling enabled on both versions. Rates below are animation-frame cadence
(1,000 / mean rAF interval), not an assertion that every callback presents a new
GPU frame. CPU time includes all renderer passes and driver stalls.

| Profile / movement | v1.0.61 cadence → v1.0.62 (Hz) | Mean render submission (ms) | p95 frame interval (ms) |
| --- | ---: | ---: | ---: |
| Desktop, Kanzleramt orbit | 58.4 → 58.6 | 6.91 → 6.14 | 16.8 → 16.8 |
| Desktop, Kanzleramt flight | 56.0 → 59.4 | 7.29 → 5.65 | 33.3 → 16.8 |
| Desktop, panorama orbit | 23.9 → 43.6 | 38.09 → 18.79 | 66.7 → 33.4 |
| Desktop, panorama flight | 49.7 → 54.0 | 10.04 → 8.51 | 50.0 → 33.3 |
| Mobile profile, Kanzleramt orbit | 60.0 → 60.0 | 4.48 → 3.81 | 16.7 → 16.7 |
| Mobile profile, Kanzleramt flight | 60.0 → 60.0 | 5.50 → 4.56 | 16.8 → 16.7 |
| Mobile profile, panorama orbit | 58.2 → 60.0 | 8.94 → 8.02 | 16.8 → 16.7 |
| Mobile profile, panorama flight | 57.8 → 59.8 | 7.21 → 6.17 | 16.8 → 16.7 |

Panorama-orbit long tasks drop from 37 to 0 in the desktop sample; p95
submissions drop from 13,833 to 9,028. Isolated long tasks remain in other
phases, so this is an observed improvement, not a promise of stall-free 60 FPS
on all devices. [The compact measurement record](fluid-viewer-v162-metrics.json)
retains every phase, including idle outliers. After the park-path fix, the
longest mobile-profile idle task fell from 3,017 to 125 ms at Kanzleramt and
from 3,028 to 118 ms at the panorama pose. No three-second synchronous task
remained in these final samples. This does not claim all loading work is below
one display frame.

## Release checks

- Production TypeScript/Vite build passed.
- Ruff formatting and lint passed; all 569 Python tests passed.
- Exact park indexing/batching: 48 tests and 364,590 assertions passed.
- Landmark/Hauptbahnhof transforms, outlines and animation: 57 tests passed.
- Light-context/warmup checks: 35 tests passed.
- Surrounding-city construction, source buffers and cancellation: 26 tests passed.
- Exact district-scope and street checks: 8 tests / 858,773 assertions passed,
  including source vertices and their adjacent IEEE-754 values. A Bun-only
  microbenchmark of 40,200 actual path queries changed from 434.56 to 5.20 ms
  with identical results; this is not a browser FPS measurement.
- The final integration run passed 51 tests / 193,472 assertions, including
  path cancellation/lifecycle, spatial batching, mobile detail and visibility.
- The path-specific suite passed 39 tests / 451 assertions, including the exact
  pre-change hash of all 3,467 production paths (86,200 vertices) and materials.
- Final complete static package smoke and release-readiness checks passed.


The pre-path-scheduling WebKit iPhone 13 profile completed 28 far/near route
samples across Day and Schwellenraum, then 12 samples across all five modes
and back to Day, with no page errors or WebGL context losses. The same run
verified the rotating Europa-Center star and one owned tower model per mode.
Peak recorded vertex/instance buffers were 183.1 MB on the long route; this
excludes textures, driver memory and JavaScript and is not total phone RAM.

After the final path-scheduling change, the Tiergarten image comparison was
repeated with the same 28 changed pixels and identical error metrics. A fresh
WebKit iPhone 13 profile then passed 12 additional far/near/overview samples,
including repeated Day/Schwellenraum transitions, with no page errors or
context losses. Final Chrome desktop/mobile profiles used the final production
build; the table and compact JSON above record that build. Physical iPhones
and Android handsets were not available for these measurements.
