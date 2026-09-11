# Drawn-world construction and eviction stability — v1.0.37

Pipeline step 10. The reported occasional Schwellenraum crash has not been
reproduced as an iOS browser-process termination. The changes address measured
resource retention and uninterrupted construction work; they do not lower
geometry detail, view distance, resolution or movement speed.

## Baseline investigation

The v1.0.36 production build was inspected in Chrome with an iPhone 13 profile:

- Cold Schwellenraum retained **157.704 MB** of unique scene buffers, compared
  with **156.918 MB** in Day. Its dedicated presentation/interior roots account
  for only **238,700 + 274,036 bytes**. They are already created once, lazily.
- Ten Day/Schwellenraum switches, with five camera journeys per mode, settled
  from the second switch at **173,097,019 scene-buffer bytes**, **3,633 renderer
  geometries** and **81 textures**. Browser backing storage was **193,842,613
  bytes** and JavaScript heap approximately **118 MB** in that run.

That route showed no continuing growth from mode switching. These counters
describe selected browser resources, not total GPU-driver or iPhone RAM.

## Construction changes

The drawn core and its following recognition layers are now prepared through
the existing cooperative construction scheduler. Exact static indexing runs
before publication and between preparation tasks, reducing the lifetime of
uncompacted buffers and giving the browser opportunities to collect temporary
constructor storage and deliver input/context-loss events.

The scheduler checks its 8 ms budget between indivisible construction/indexing
steps; a single model constructor can still take longer. Retirement, an aborted
load or a change to the Minecraft family cancels the remaining steps. The
transaction owns every returned core/addon root before yielding, so cancellation
disposes completed partial work without allocating the later layers.

Shared signature, staffage, underground and catenary additions stay detached
until one synchronous commit. Existing geometry remains intact during
preparation. Camera, navigation and mutable-root snapshots are captured at
commit time, preserving movement and independently arriving scene details if
that commit must roll back. The existing finite context-loss recovery remains
unchanged.

## Evicted GPU-preparation work

Previously, disposal freed GPU resources but left an evicted mesh in the
preparation queue until another warmup task examined it. A suspended queue
could therefore retain the mesh and its CPU attribute arrays. Disposal now
first removes the subtree's queued objects, residency snapshots and temporary
render hooks. Unrelated queued objects remain scheduled.

The standalone JavaScriptCore probe constructs and evicts sixteen real
240-building source slices across Day, Night, Snowstorm and Schwellenraum,
without executing another preparation task. In the measured run:

| Quantity after collection | Former integration | Explicit subtree release |
| --- | ---: | ---: |
| Reachable evicted renderable objects | 78 | 0 |
| Reachable tracked backing-buffer bytes | 11,869,127 | 12,912 |
| Preparation still pending | yes | no |

One 12,912-byte buffer remained visible to the probe's WeakRef observation even
after all tracked renderables were collected; the measurement does not claim
that all process memory is released. The fixed queue no longer owns any of the
evicted renderables. Minecraft's separate cooperative constructor and the
shared disposal path retain their existing geometry and recovery policy.

## Focused verification

Twenty-eight focused tests pass. They execute the production drawn transaction
with bounded model fixtures, checking complete publication, cancellation before
and during allocation, family changes, exact-once disposal, and commit rollback
that preserves concurrent siblings and the latest camera pose. Geometry tests
compare every rendered attribute/primitive and ray intersection through exact
compaction, including interruption/resumption. Warmup tests use Three's actual
buffer backend to verify uploads, queue release and render-hook ownership.

```sh
cd src/app
bun scripts/benchmark-gpu-warmup-memory.ts --retain-queue
bun scripts/benchmark-gpu-warmup-memory.ts
bun test tests/isometric-construction-lifecycle.test.ts \
  tests/compact-static-geometry.test.ts tests/scene-gpu-warmup.test.ts \
  tests/cooperative-work.test.ts
```

No physical iPhone was available. These results do not establish an operating
system memory limit or guarantee that iOS cannot terminate the page.

Release validation passed: production build, Ruff and 427 Python tests;
focused lifecycle, worker-resume, exact-geometry, source and rendering checks;
independently measured synchronous/cooperative Minecraft equality. WebKit with
an iPhone-SE profile and Chrome with a Pixel-5 profile completed six mode checks
each without page/console errors. Forced context-loss tests recovered position
and prevented retry loops in both engines. Final direct Schwellenraum cold
starts passed in WebKit (8.70 s) and Chrome (7.35 s) touch profiles. These are
individual host observations, not physical-phone speed guarantees. Browser
visual QA checked Schloss, Naturkunde, Dussmann and Spree railings; it caught and
corrected the Naturkunde risalit occlusion and oversized native cornice boxes.
