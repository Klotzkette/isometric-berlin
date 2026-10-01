# v1.0.58 — mobile travel and graphics-memory lifetime

Pipeline step 10. This release addresses repeated mobile failures in Day and
Schwellenraum. It changes resource lifetime and the worker import graph, not
city geometry, quality, viewing distance, resolution or navigation speed.

## Reproduction and correction

The v1.0.57 route held the opening view for 45 seconds, then visited ULAP from
far away, Moabit from far away and the close Moabit garden. WebKit 2359 with the
iPhone 13 profile lost its graphics context on the third pose. The instrumented
run reached 165,678,813 resident vertex/instance-buffer bytes before the GPU
process stopped responding. These counters exclude textures, shaders, render
targets and driver overhead.

Several failed runs shared a native WebKit GPU-process `EXC_BAD_ACCESS` stack:
`Buffer::getMemorySize → ResourceManager::getTotalMemorySize → Context::getMemoryUsage
→ GraphicsContextGLANGLE::estimatedMemoryCost`. This is a reproduced graphics
resource-accounting failure, not evidence of a specific RAM limit on a physical
iPhone. ANGLE's [resource map](https://github.com/google/angle/blob/main/src/libANGLE/ResourceMap.h)
uses a flat-resource threshold of 0x3000 (12,288), then a hashed map. The
[resource memory accounting](https://github.com/google/angle/blob/main/src/libANGLE/ResourceManager.h)
traverses resource pointers. The crash stack and resource count make reducing
live buffer handles a concrete mitigation; they do not prove every reported
phone crash has the same cause.

Mobile combines immutable Float32 vertex streams into one interleaved buffer
before their first upload. Integer bit copies preserve signed zero and NaN
payloads as well as all ordinary values. Indices, draw ranges, groups, bounds,
materials, instance matrices and instance colours are unchanged. Ownership is
restricted to already exact-indexed static geometry and audited stock box,
sphere, cylinder/cone, torus, plane, ring and circle constructors;
dynamic flags, morphs, custom uploads and mode-colour geometry are excluded.
A real Three backend fixture falls from five buffers to two at identical bytes.
Packing happens one geometry at a time with an 8 MiB scratch-allocation cap.

Mobile also uses ordinary full-detail rendering without speculative zero-draw
warmup passes. Such passes still invoke physical-glass transmission rendering,
multisample resolve and mipmap generation. Removing warmup alone did not
reliably fix the failing route; it is an additional reduction in driver work.
Desktop retains its existing preparation path.

## GPU residency

Two mobile observers track actual uploads. Soft instance-buffer budgets of
48 MiB and 2,500 handles retire at most 64 candidates per 100 ms after two seconds
outside an expanded frustum. Counting handles also catches many tiny allocations
that a byte-only budget would retain. Shared instance attributes and morph textures are excluded. A separate
6,000-buffer geometry budget tracks unique attribute storage, including shared
interleaved storage and indices. Its ordinary sweep examines at most 128
candidates per 100 ms. Large cumulative camera/projection changes additionally retire eligible
previous-view geometry and instance buffers before the next upload burst. Mode
changes trigger the same safe cleanup before new mode content is uploaded.

Visible objects, uncullable objects, geometry with a visible owner, and attribute
storage shared across different geometries are protected. The protection frustum
is twice the visible width/height. Public Three disposal APIs release only the
retired GPU allocations and VAOs; the same CPU arrays, geometry, materials and
scene objects remain eligible for exact immediate reupload. No source detail,
viewing distance, resolution or navigation speed is reduced. Attribute inspection
is outside the per-draw hot path. Observers and strong references are released
at district/world teardown and context loss.

These are working-set budgets, not hard total-memory or visibility limits.
A visible scene larger than a budget remains fully rendered. Buffer counters
exclude textures, render targets, shaders and driver overhead.

## Worker and framebuffer reductions

The worker now calls `createIsometricCityCore`; the public constructor retains
its unchanged recognition-context additions. DistrictStreets initialises its
source-backed membership Set only when needed. This allows the bundler to
omit the worker's unused district-street payload while the main scene retains
all those roads.

Worker bundle: 16,182,368 → 7,834,005 bytes, approximately 51.6% smaller. A fresh
Bun/JSC worker import reduced retained JS heap from 37.25 to 22.40 MB, external
storage from 24.47 to 13.86 MB, and object count from 331,830 to 206,222. RSS
samples varied, so they are not presented as a reliable savings measurement.

All 29,818 production building records produce identical pre-change/core/public
wrapper output: SHA-256
`1eaeb68874bb7c037b2f1c5be35f7e2bd84df90cd7e194a09c64641d80d734de`,
257,004,426 geometry bytes, 134,415 instances and 17,627,860 vertices.

The canvas no longer allocates a depth attachment: it receives only the final
SMAA fullscreen pass. The actual city/composer target retains depth. SMAA,
physical glass and render resolution remain unchanged. Teardown now includes
Points and all Line subclasses, releasing the snow geometry, texture and
materials explicitly instead of relying on final context destruction.

## Validation

The committed `scripts/smoke_mobile_memory.py` replays the former failing route
and further distant/whole-city views through Day → Schwellenraum → Day →
Schwellenraum (28 samples).
Its counter treats even an automatically recovered context loss as failure.
Browser emulation exercises engines and lifecycle; it cannot guarantee that an
operating system will never terminate a tab on a physical phone.

Automated validation includes 189 targeted viewer tests (4,039 assertions),
504 Python tests, TypeScript/Vite production build, Ruff formatting/lint, and
the versioned offline-package HTTP smoke check. Geometry tests verify raw-bit
preservation, actual Three buffer deletion/reupload, shared-storage protection,
mode lifecycle, and bounded scanning even when a fully visible scene exceeds
the soft budget.

Final production-build travel results (28 samples per engine, no context loss,
page crash or console error):

| Engine / emulated device | Peak live buffer handles | Peak vertex/instance bytes |
| --- | ---: | ---: |
| WebKit 2359 / iPhone 13 | 11,520 | 169,157,485 |
| Chrome / Pixel 5 | 11,239 | 167,783,027 |

These peaks cover a larger route than the original three-pose failure and
are not a physical-phone memory measurement. The wide-view mode switch that
failed an intermediate build is included in every completed final cycle.

WebKit/iPhone SE and Chrome/Pixel 5 also completed Day → Night → Snowstorm →
Schwellenraum → Minecraft → Day with visible mobile mode controls, joystick
movement and no unexpected context events. Two injected losses per engine
verified one clean pose-preserving recovery and prevention of an automatic
retry loop. Production screenshots of the close city and full overview were
inspected; source/model preservation tests remained unchanged.
