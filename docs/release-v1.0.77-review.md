# v1.0.77: lossless startup and memory lifetime fixes

Step 10 addresses repeated startup work and retained loading data in the desktop
and touch viewer. No source geometry, building/facade detail, road, shoreline,
material, mode, output resolution or view distance is removed or simplified.

## Diagnosed causes and changes

- Packed Alt-Mitte packets were retained as both JSON text and parsed base64
  strings. Direct literals avoid this duplicate representation. Their values,
  all 179 packets and final drawn/native buffers remain exact.
- The binary decoder copied complete positions, colours and indices before
  constructing final buffers. It now writes bounded 48 KiB slices into the same
  final buffers, with a native decoder and an older-browser `atob` fallback.
- Navigation callbacks shared the asynchronous world-construction context and
  pinned consumed ground, surface, street, rail and prism JSON. Module-level
  factories separate their lifetimes. Deferred Minecraft shoreline loading
  keeps its existing lazy behaviour; the completed drawn path uses a shared
  no-op. A later desktop family switch can read the HTTP-cached prism source
  again instead of retaining its parsed graph throughout the visit.
- Minecraft mob walkability retains only compiled occupancy grids and grid
  dimensions, rather than the entire voxel payload.
- Desktop GPU preparation previously visited the whole city for each small
  upload batch. Only selected mesh/light ancestor paths are now traversed in
  that temporary pass; all state restores synchronously even on failure.
- Desktop park construction uses the same bounded scratch and cooperative
  builder as touch, with its original full detail and settled-detail options.

- Europacity and Rohwedder-Haus facade occlusion prepares exact outline bounds
  and shares each horizontal sample across the original three height tests.
  All sample locations, boundary predicates and output blocks stay exact.
  Five-run Bun medians: drawn Europacity 196 to 111 ms, Rohwedder 374 to 77 ms;
  full native 151 to 94 / 232 to 52 ms. Eight full plan/render-buffer audits
  cover both buildings and both input profiles in drawn/native representation.

## Verification

`scripts/smoke_startup_memory.py` measures cold startup, long tasks, WebGL
buffers and consumed-source lifetime; `--expect-released-core` verifies
reclamation after Chrome GC. The GC operation is instrumentation only, never
a production memory-management dependency.

Local installed Chrome measurements, one fresh context each:

| Profile / mode | v1.0.76 post-GC JS heap | v1.0.77 post-GC JS heap |
| --- | ---: | ---: |
| Desktop / Day | 384,459,136 B | 343,260,692 B |
| Pixel 5 browser profile / Day | 364,313,312 B | 328,426,120 B |
| Pixel 5 browser profile / Minecraft | 409,310,324 B | 335,848,556 B |

All consumed core JSON payload roots are collectible after construction. The
small scene manifest remains intentionally owned. Mobile Day and Minecraft
retain exactly the same observed live WebGL buffer totals as the baseline:
184,962,180 B and 169,699,098 B respectively. Geometry backing storage remains
substantial because the exact source models are preserved; this change targets
unnecessary copies and owners, not removal of required model buffers.

The largest measured Day startup long task fell from 2,758 to 2,063 ms on
desktop and 2,749 to 2,061 ms in the touch profile. One-second readiness samples
were 5.69 to 4.94 s on desktop and 5.87 to 5.98 s on touch; the latter does not
establish an end-to-end mobile load-time improvement. Sampled transient heap
peaks vary with GC timing (touch Day 505 to 533 MB in these individual runs),
so the reproducible benefit is lower retained heap and bounded decoder scratch,
not a universal peak-RAM or FPS claim.

The final nearby-source filtering refinement only avoids preparing unused
facade predicates; its full eight output hashes were rechecked afterward.

Isolated Chrome measurements of the 179 actual packed packets, across three
fresh launches: retained JavaScript heap 155,228,596 to 78,846,504 bytes;
local evaluation median 449 to 253 ms. Drawn-only savings: 13,150,156 bytes;
native-only savings: 63,227,384 bytes. These are packet benchmarks, not a claim
about end-to-end loading time or network speed.

The full real-packet position/colour/index/transform/material hashes are:

- Drawn: `70a340a9ea8d767bb0751ddb5aef0a565a58d45dc057a471f834c260a8d9e6bd`
- Native: `97b7e562294437bb483d90895438ca63e43b3869e0a6a09ea42926d743aac967`

Browser phone profiles do not impose physical iPhone RAM limits. GPU counters
measure tracked vertex/index/instance buffers, excluding textures and driver
allocations. Passing bounded routes does not establish that crashes are
impossible on every device.

## Checks

- Ruff formatting/lint, TypeScript and production build: passed.
- Root focused Bun run: 163 tests, 24,486 assertions, all passed.
- Additional facade geometry/raycast suite: 26 tests passed; final refinement
  preservation rerun: 10 tests passed.
- Navigation/access/lifecycle fixture and behavioral suites: passed.
- Independent read-only production review: no actionable findings.
- Release-readiness and downloadable local HTTP package smoke: passed.
- WebKit iPhone 13 profile: 28 far/near samples through all six modes and return,
  80.6 s, no page error/crash/context loss; 14 observed GPU reclamations with
  exactly retained source buffers. Buffer peak 246,924,462 B.

The all-mode smoke installs the flood object/buffer probe required by its shared
reader. An initial instrumentation-only run stopped on that missing probe while
the viewer remained ready; the corrected complete route passed.

- Desktop Chrome: 28 samples, 76.5 s, all six modes and return, no errors,
  crashes or context loss; buffer peak 515,491,303 B, 8 exact-source reclamations.
- Chrome Pixel 5 profile: 28 samples, 78.5 s, all six modes and return, no errors,
  crashes or context loss; buffer peak 249,125,261 B.
- These three routes total 84 samples and verify camera continuity, a single
  flood surface, unchanged resident source-array identity and actual GPU reuse.

- Touch rapid walking-mode changes with a deliberately delayed Minecraft
  request: passed, 141 continuity samples; stale construction does not replace
  the active world or move the player.

- Full Python suite: **846 passed**, two pre-existing CRS fixture warnings,
  482.43 seconds. No production edits followed this run.
