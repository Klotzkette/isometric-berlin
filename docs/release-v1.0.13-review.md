# v1.0.13 review and verification

Pipeline step 10. This release fixes delayed shape appearance while moving or
panning. The v1.0.12 startup coverage remains, while visibility, GPU preparation
and suspension now preserve already available detail.

## Reproduced findings

| Finding | Correction |
| --- | --- |
| Close-detail visibility depended on one orbit-target distance; a pan at the same radius reused a stale result | Evaluate cached object bounds against camera position in the current frame. |
| Complete Sony, Wilhelmstraße, Pariser Platz and other form/facade groups were in the tiny-detail hide list | Keep readable architectural forms, railings, catenary and furniture present. |
| Ready exact buildings could wait 900 ms during continuous input | Attach building packets and completion bookkeeping in their next separate tasks. |
| Offscreen attributes were first uploaded when the camera encountered them | Warm unchanged buffers in bounded zero-vertex render tasks before first visibility. |
| A 1 px warm pass could resize the live physical-glass target | Use a separate preparation camera, retaining the live transmission target. |
| Suspension discarded exact batches and rebuilt them on return | Retain their object/buffer identities and skip their constructors on restart. |

The visibility audit was independent of the loading audit. The GPU helper
received a separate review, which identified the physical-glass target issue
before release. Source data, all geometry constructors, material colours,
rendering resolution and joystick behaviour remain unchanged.

## Validation

- The old viewer fails five visibility regressions; the corrected viewer passes
  pan/orbit, nested/instanced bounds, real facade and Minecraft ownership checks.
- The actual Three buffer backend verifies one upload per geometry/index/instance
  buffer and no new uploads on the subsequent simulated first pan. Normal draws
  retain their vertices. Error restoration, deduplication, context loss, hidden
  modes and task budgets are checked separately.
- Production worker/attachment tests verify retained roofs across repeated
  suspensions, skipped constructors/transfers and exact-once final disposal.
- All 357 Python tests passed on the final package. Ruff format and lint passed.
- TypeScript, production build, release readiness and the local-package server
  smoke test passed. Every packaged hashed asset matches the final build.
- Final GPU and bridge regressions: 20 tests / 198 assertions passed.
- Complete frontend: all 1,798 tests passed across 224 files, with 6,852,173
  assertions (300.44 seconds). This final run used the frozen source and includes
  every unchanged full/mobile geometry budget and all five visual modes.

No physical iPhone/GPU frame-time measurement was possible. The Mac remained
locked, so direct browser interaction was also unavailable. The automated
regressions establish the corrected state and buffer-upload behaviour; they do
not establish a device-specific FPS guarantee. See
[implementation and reproduction](performance-progressive-loading.md).
