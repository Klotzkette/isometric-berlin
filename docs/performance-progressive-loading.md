# Progressive scene loading, v1.0.10

Pipeline step 10. Geometry is preserved; this change removes avoidable waiting
between already computed geometry and its attachment to the scene.

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
