# v1.0.72 — Mobile cold-start memory

Step 10 addresses another reported phone reload/crash in Day shortly after
opening the viewer. The preceding GPU-residency changes did not sufficiently
address CPU memory during the initial load. This release targets redundant
source parsing, navigation indexes and construction buffers. It does not
claim to reproduce the physical phone's process-memory limit on this host.

## Changes and preservation

- Large committed source JSON arrays are decoded on first field access and
  cached. Day does not instantiate unused native geometry arrays simply because
  their module also contains the drawn model. Named exports and source values
  remain intact. The build plugin is scoped to application source data and
  installed in both the main and worker builds; raw/URL assets are unaffected.
- The worker can discard unused source-dependent model metadata. A 16 MiB
  compiled-worker budget prevents the previous 27 MB dependency graph from
  returning unnoticed.
- Alt-Mitte Day navigation omits three native-only packets (5,135,987 source
  bytes). Native preload prepares its exact navigation before publication.
  TU roof and native collision indexes also initialize only when needed.
- Walking queries follow the world actually published during a pending,
  cancelled or rejected Minecraft load; they cannot access unprepared native
  navigation while the complete drawn world is still active.
- Streets decode directly into final typed buffers. Four model factories
  reuse their completed Float32 arrays, avoiding 3,197,448 bytes of duplicate
  buffers per drawn construction. Native-only metadata counts are lazy too.

No geographic data, model source payload, position, index, material, facade,
road, path, shoreline, monument, view distance, resolution or visual-mode
effect has been removed or reduced. No source or licence change. The ordinary
read-only source consumers do not inspect property descriptors; lazy JSON
fields are accessors, so this is not a general-purpose replacement for mutable
application JSON with descriptor-dependent freeze/seal semantics.

## Reproducible checks

`scripts/smoke_cold_start.py` observes 45 seconds from a fresh document with
Chrome/Pixel 5 or WebKit/iPhone 13 browser profiles. It fails on reloads,
runtime rebuilds, context loss (even recovered), errors, or incomplete final
city layers. Optional GC runs only after the normal observation window.
Memory totals are same-sample main-realm JS heap plus backing storage; they
exclude workers, textures, framebuffers, driver memory and total process RAM.
Browser profiles do not reproduce a physical iPhone's available RAM.

The source round-trip test covers every transformed committed JSON payload.
Geometry digests retain all eight street batches and twelve full/mobile/native
model outputs exactly. Navigation fingerprints retain 28,037 Alt-Mitte and
68,060 TU roof, column and boundary queries. A production-bundler fixture
verifies that unused arrays really remain undecoded, with stable identity when
read, and that unused named exports can be removed.

## Paired cold-start measurements

Fresh Chrome/Pixel 5 contexts, identical 45-second script and local built
assets, v1.0.71 versus v1.0.72. No explicit GC occurs during these windows.
Values are decimal MB; garbage-collection timing makes individual runs noisy.

| Main-realm measurement | v1.0.71 | v1.0.72 |
| --- | ---: | ---: |
| Sampled heap + backing peak | 1,444.065 MB | 1,212.734 MB |
| Heap + backing at end of 45 seconds | 1,428.024 MB | 828.100 MB |
| Retained heap + backing after end-only GC | 900.485 MB | 825.838 MB |
| WebGL buffer peak | 183.872 MB | 183.872 MB |
| Decoded resources loaded | 168.971 MB | 150.991 MB |
| Progressive worker JavaScript | 27.436 MB | 13.690 MB |
| First ready sample | 5.899 s | 5.864 s |

The observed peak falls 16.0%; retained main-realm memory after GC falls 8.3%.
The larger 42.0% difference at 45 seconds also includes earlier collection of
construction buffers, so it is not presented as a 42% retained-memory saving.
All 452 progressive batches and 66 surrounding chunks finish in both runs,
with identical GPU buffer bytes and no errors, reloads or context recovery.
No general frame-rate or physical-phone memory guarantee follows from this.

A separate paired run with a synthetic 512 MiB V8 old-space limit also passes
both versions. Peak heap + backing falls from 973.725 to 894.494 MB, and
post-GC totals from 899.944 to 827.055 MB. The baseline also passes this test;
it does not reproduce the reported physical-device crash.

## Verification

- 62 focused frontend tests pass (412,440 assertions), including the exact
  source/geometry/query hashes, lazy decoding and pending native-import race.
  The complete full/mobile Minecraft construction matches its existing frozen
  appearance baseline too.
- Production TypeScript/Vite compilation, Ruff format/check, release readiness
  and extracted local-package launch smoke pass for v1.0.72.
- WebKit/iPhone 13 profile passes a 45-second Day cold start with complete
  requested layers, one runtime/context and no errors or recovery. Its WebGL
  buffer peak is 185.563 MB; JavaScript memory metrics are unavailable there.
- The Day cold-start screenshots retain the glass dome, dense source facades,
  waterways, vegetation and mobile mode controls.

- Chrome/Pixel 5 and WebKit/iPhone 13 profiles each pass the full six-mode route:
  28 travel samples, six transitions, fourteen intervals of real GPU retirement
  with unchanged resident source arrays, and preserved camera position. No
  crashes, context losses or runtime errors. The Chrome buffer peak is
  244.466 MB; WebKit is 234.725 MB. Final mode screenshots were inspected.
- Desktop Chrome also passes all six modes and 28 travel samples in one
  retained runtime, with eight intervals of source-preserving GPU retirement,
  zero errors/context losses and unchanged pose continuity. Its observed GPU
  buffer peak/end are 478.900 / 198.955 MB. Day/Flood views were inspected.
- Complete Python suite: **773 passed** in 463.89 seconds. The two existing
  fixture CRS warnings are unrelated to the viewer. All committed geographic,
  source JSON, public mesh and reference payloads are unchanged from v1.0.71.
