# v1.0.56 — mobile startup memory

Pipeline step 10. The reported failure shortly after mobile startup could be
reproduced in the production v1.0.55 build with Playwright 1.63.0 / WebKit 2359,
using its iPhone 13 profile. The page crashed at approximately 18 seconds,
shortly after the deferred park layer attached. This is a host WebKit
reproduction, not a diagnosis of the physical iPhone's process termination.

## Changes

Mobile GPU preparation now follows a conservative camera frustum twice the
visible width and height, with the same near and far planes. It examines at most
128 candidates per task and keeps the existing upload limits. Distant entries
remain dormant until the camera changes; they do not keep a timer spinning.
Ordinary rendering remains independent and can upload any visible object
immediately. No scene object, source envelope or level of detail is removed.
This avoids uploading the entire offscreen city during the opening seconds;
it does not promise a fixed GPU-memory ceiling after visiting the whole city.

Mobile park construction now uses exact Float64 scratch pages instead of
retaining hundreds of thousands of nested transform objects. Pages are released
as each family becomes final instance buffers. The spatial partitioner releases
each detached original before yielding. Construction runs in cooperative steps,
with cancellation on backgrounding, disposal, context loss or a world-family
change. The complete park is published together; incomplete work remains
unpublished and is disposed. Cancellation is checked again after the promise
boundary before scene/collision publication.

Desktop retains its synchronous park construction and whole-scene GPU
preparation. Geometry, materials, resolution, antialiasing, viewing distance,
navigation speeds and the 93-place catalogue are unchanged.

## Measurements

Fresh Chrome contexts, iPhone 13 profile, identical first Reichstag arrival,
60 seconds stationary on the local production build. A pre-context probe
accounts for WebGL bufferData/deleteBuffer allocations; CDP samples JavaScript
heap separately. The GPU figures exclude textures, render targets, shaders and
driver overhead. They must not be described as total device memory.

| Measurement | v1.0.55 | v1.0.56 |
|---|---:|---:|
| Resident WebGL geometry/instance buffer bytes | 259,797,249 | 104,491,483 |
| Used JS heap after requested collection | 200,350,756 | 168,826,068 |
| Sampled peak used JS heap (2-second intervals) | 440,904,384 | 272,172,096 |
| Backing storage after collection | 299,541,717 | 299,490,939 |

The first row is a 59.8% reduction at this opening view. The almost unchanged
backing storage is expected: exact CPU geometry remains available for immediate
rendering and recovery. Sampling does not establish the absolute peak.

An isolated production-park benchmark in fresh Bun/JSC processes measured
454,656,000 bytes maximum RSS for synchronous construction and 354,615,296 bytes
for cooperative packed construction (22% lower). Build time was 528 ms versus
535 ms with 30 yielded tasks. These are host-process figures, not iPhone limits.

The same WebKit 2359 startup scenario completed 45 seconds after the correction,
with no page errors or context loss and 105,217,505 resident geometry-buffer
bytes. Before the correction, the last sample before its crash already held
220,984,199 bytes. Real iPhone testing remains necessary; no browser-side change
can guarantee that an operating system will never terminate a tab.

## Preservation and checks

The full production park's geometry/material audit and metadata match between
synchronous and cooperative construction, including all 450,029 instances and
438 root children. Existing spatial-partition and source-detail budgets remain
unchanged. Tests cover pre-start/mid-build cancellation, expanded-frustum
preparation, ordinary rendering of deferred entries, bounded scanning,
projection changes, disposal, material retirement and context restoration.

The production park audit also matches the implementation loaded directly from
tag v1.0.55: SHA-256
`95176364da7aaaa9a6a8d9cffcb26a677be8764cdb40de6154869c1060c6d763`,
40,236,942 stored buffer bytes, 6,785 renderables, 45,421 trees, 3,467 paths,
360 playgrounds, 5,808 street lights and 41,354 individual wall setts.

Validation completed for this release:

- TypeScript and production build; Ruff format/lint; all 501 Python tests.
- 64 targeted construction/worker/warmup tests, followed by 78 lifecycle,
  exact-buffer and static-detail preservation checks (overlapping suites).
- WebKit 2359 with iPhone 13 profile: cold startup plus five drawn-mode visits
  across four camera locations, without errors or context loss.
- WebKit 2359/iPhone SE and Chrome/Pixel 5: all five modes, mobile menu and
  joystick motion, six visits per engine, no runtime or console errors.
- Forced WebKit context loss: one pose-preserving recovery; a repeated loss
  stops at explicit recovery instead of looping renderer allocations.
- Release readiness and extracted local-package smoke passed.

Release archive SHA-256 values:

- ZIP, 35,786,291 bytes:
  `fa64822185495a14c663fb08811152fc9a59d82b6f373bfe5563d6d2a9d26fda`.
- TAR.GZ, 35,669,849 bytes:
  `a12dfe83f75ce95a8163ea10bd7351ec5b5db33cda97360d2e8fda7fe8522c55`.
