# v1.0.81: construction memory and sustained joystick movement

Step 10 targets early browser memory pressure and fast, continuously held
joystick movement. Source geometry, building and street detail, materials,
output resolution, view distance and all six modes stay unchanged.

## Changes

- Audited read-only construction arrays can be collected after their complete
  render buffers have been built. Exact original values remain available for
  a later construction. Mutable, navigation and scene-owned source fields
  keep strong ownership; browsers without WeakRef retain the previous cache.
  See [ownership audit](source-cache-lifetime-v181.md).
- Already-packed street surfaces use direct string literals, avoiding the
  additional JSON-encoded copy of the same base64 content.
- Interleaving the large unpublished city now cooperates with the existing
  construction scheduler. It preserves all attribute bits and yields in
  bounded batches; this creates task/GC opportunities, not a forced-GC promise.
- Holding the orange joystick within its outer 10% starts a smooth acceleration
  after 250 ms and reaches 3x at one second. The held value remains active
  without more pointer movement. Release, cancellation, hiding and mode changes
  reset the acceleration. Inner travel retains precise analog control.
  Walking reaches 39 m/s instead of 13 m/s; existing explicit sprint/fast-run
  controls remain 52/104 m/s. Look controls and collision/surface guards remain.

An experiment using tighter surrounding-district height boxes did not save
memory in the measured opening view and was discarded. Neither the surrounding
manifest nor its source packets changed.

## Validation

Cold Chrome / Pixel 5 browser-profile measurement, fresh cache and the same
Reichstag opening pose (one run each):

| Measurement | v1.0.80 | v1.0.81 |
| --- | ---: | ---: |
| Post-GC JavaScript heap | 335,032,036 B | 265,082,164 B |
| Backing storage (ArrayBuffers and external strings) | 490,319,902 B | 497,542,084 B |
| Sampled peak JS + backing storage | 1,145,797,717 B | 1,081,518,766 B |
| Live WebGL vertex/index/instance buffers | 185,746,108 B | 185,746,108 B |

Retained JavaScript heap falls by 69,949,872 bytes (20.9%); combined retained
heap/backing storage falls by 62,727,690 bytes. The instrumented GC verifies
ownership only; production does not request or rely on forced collection.
Sampled peak reduction is a single-run observation sensitive to GC timing.
These figures exclude driver allocations and do not establish a device RAM ceiling.
Readiness samples were 6.09 / 6.37 seconds and largest observed long tasks
2,054 / 2,237 ms; no faster-startup or FPS claim follows from these runs.

The pre-build packaging attempt and a browser probe launched while the local
build directory was being replaced were discarded after missing-file errors.
All recorded final results use the completed build.

Completed checks:

- 144 focused Bun tests, 263,537 assertions, including exact source values,
  cache ownership/reconstruction, bit-preserving interleaving/cancellation,
  held input and collision, source decoding and GPU residency.
- Additional joystick/localization/gesture checks, TypeScript and production build.
- WebKit iPhone 13 profile: 28 near/far samples through all six modes and return,
  85.1 seconds, no errors or context loss; peak tracked GPU buffers 241,310,586 B.
  Source array identity and complete source coverage remain intact across
  reclamation and mode changes (new family runtimes are checked separately).
- Actual captured stationary-touch input in Chrome and captured mouse input in
  WebKit's iPhone layout: sustained target speed around 545 m/s at the seeded
  67.3 m camera distance, no additional pointermove events, full stop on release.
- Ruff format/check, release-readiness and complete local-package HTTP smoke.

- Desktop Chrome: 28 near/far samples through all six modes and return, no
  errors or context loss; original source-array identity remains intact.
  Peak tracked GPU buffers: 509,226,355 B. This desktop number is not a mobile
  allocation estimate.

- Fresh WebKit iPhone-profile starts in Day, Schwellenraum and Flood, including
  reload gates and narrow-layout checks: all passed without runtime errors or
  context loss. Aborted background requests from explicitly reloaded documents
  are separated from errors in the newly started document.

- Full Python suite: **852 passed**, two pre-existing CRS fixture warnings,
  508.10 seconds. No production edits followed this final run.
Browser phone profiles exercise engines and input; they do not certify physical
iPhone RAM limits or establish that crashes are impossible on every device.
