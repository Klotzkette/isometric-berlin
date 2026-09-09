# Progressive scene loading

Pipeline step 10. Geometry is preserved; this change removes avoidable waiting
between already computed geometry and its attachment to the scene.

## Complete startup coverage, v1.0.12

The previous main-thread preview contained only 160 exact source building parts
on mobile (420 on desktop), plus the authored landmark models. The other source
parts depended on a second LoD2 fetch/parse and worker transfer. The completed
worker eventually covered the entire city, but its absence or suspension left
large gaps. Camera movement did not itself trigger loading or hide city bodies.

The main preview now publishes the complete source city before the first
interactive frame. One permanent instanced shell batch represents far buildings;
one mobile or two desktop fallback batches cover the later exact refinement.
All 29,818 original source records stay retained and partitioned exactly once.
Existing explicit hero replacements remain suppressed in generic geometry.
Shell geometry, colours, the exact-building caps and the control scheme are
unchanged. The representation is a compact oriented envelope, not full facade
detail for every remote building.

The fallback groups belong to the main world. A successfully decoded, relit and
attached exact batch hides only its own fallback in the same browser task.
Pausing restores those small buffers before disposing partial worker geometry.
Worker unavailability, decode failure or acknowledgement failure preserves the
still-needed coverage. The worker no longer constructs or transfers duplicate
preview shells: mobile sends one exact building batch; desktop sends two and
thirteen surface batches. The existing bounded input-aware scheduler remains.

| Coverage | Mobile | Desktop |
| --- | ---: | ---: |
| Initial shell draw calls | 2 | 3 |
| Initial rendered shell instances | 29,439 | 29,187 |
| Total shell buffers | 2,239,044 B | 2,220,732 B |
| Retained restart fallback buffers after exact replacement | 260,684 B | 640,460 B |

Permanent distant coverage already existed after the old worker completed.
Only the small hidden restart fallback remains additional after completion;
hidden batches incur no draw calls. Bounds are computed once, and none of these
building bodies participates in the detail-distance fade.

An unrelated but exposed hot path tested every city point against all 37 edges
of one local office footprint. A conservative bounds rejection now avoids that
work for distant points. All complete-city instance matrix/colour bytes stayed
identical (SHA256 `46720a5a2160da649d096a992a8690b00484494a35f77933932f9a72b050fabc`).
One same-machine CPU sample fell from 213 ms to 51 ms for all source shells.
This is not an iPhone timing or FPS claim.

The far clipping plane now derives from the presentation envelope diagonal,
existing maximum orbit and a conservative vertical allowance. The current
16-degree isometric view uses 18 km instead of 16 km. A real opposite-edge
building at a permitted high-zoom camera position previously lay beyond the
plane; source-corner tests cover every extreme navigation target. The near
plane and permitted movement are unchanged.

Regression tests execute the actual attachment, pause and failure functions,
ray-test roofs through lifecycle transitions, check source coverage and buffer
budgets for both profiles, and verify camera clipping. The worker benchmark now
supports `--mobile` and starts after the complete preview, matching production
ordering. It counts instance buffers and only visible draw calls. Browser/GPU
upload and physical iPhone interaction remain separate validation.

## Earlier scheduling correction, v1.0.10

## Reproduced issue

The old attachment scheduler gave every retry a fresh 900 ms idle timeout,
even when the head of the queue had already reached its original deadline.
While continuous input prevented idle callbacks, 18 ready batches could wait
18 separate timeouts. It also rejected usable idle time solely because the
joystick was held. Worker backpressure permits four transferred batches at a
time, making delayed acknowledgements delay further construction as well.

The scheduler now subtracts the time since arrival from the deadline. An
overdue packet receives its own 16 ms timer task, without another idle timeout.
Available idle time of at least 4 ms can attach a batch while moving, provided
no input event is pending. Actual pending input retains priority up to the
existing 900 ms maximum. One packet per task, four-buffer backpressure,
cancellation, hidden-tab suspension and mode-aware materials are retained.
See the browser APIs for
[idle callbacks](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback).

The worker now finishes both exact building batches before optional water and
park surface refinement. A slow surface transfer no longer delays the second
half of the buildings. Deferred park objects keep their existing mobile
memory gate, but the subsequent timer fallback is 32 ms instead of 1,200 ms;
the idle timeout is 500 ms instead of 3,000 ms.

## Reproduction and limits

From the repository root:

```sh
git show v1.0.9:src/app/src/ThreeViewer.tsx > /tmp/isometric-v109-viewer.tsx
```

From `src/app`:

```sh
PROGRESSIVE_ATTACHMENT_REFERENCE=/tmp/isometric-v109-viewer.tsx bun scripts/benchmark-progressive-attachment.ts
bun run test tests/progressive-attachment.test.ts
bun scripts/benchmark-progressive-world.ts
```

The first harness executes the actual old/new scheduler with a deterministic
task clock, 18 batches and the production four-buffer backpressure. Input is
held continuously. It measures scheduling only, excluding network, constructor
time and GPU upload:

| Available idle budget | v1.0.9 final attachment | v1.0.10 final attachment |
| --- | ---: | ---: |
| None, pending input throughout | 16,200 ms | 4,516 ms |
| 8 ms between input events | 4,576 ms | 288 ms |

These are reproduced scheduling delays, not device load-time or FPS claims.
The worker harness additionally constructs the real committed city, records
batch order, bytes and the time all exact buildings are received. It starts
the worker beside the preview constructor and acknowledges immediately, so it
does not represent the browser's serial preview startup or busy-input queue.
Run a local Vite server on port 4175 before that harness. Direct browser and
physical-device testing remain separate from the headless geometry tests.

The final v1.0.10 local worker sample received all exact building batches at
2,391 ms, before its first surface batch at 2,643 ms. It retained 18 batches
(3 permanent building batches and 13 surface batches plus 2 temporary previews).
The final drawn city uses 259 renderables and 89.9 MiB of geometry, versus
239 / 89.7 MiB before the new architecture; the source-bound models add detail
rather than reducing scene coverage. These single CPU observations were taken
alongside the test suite and are not a comparative browser speed measurement.
