# v1.0.124 — lower transient memory during travel and recovery

Step 10. The owner reports repeated returns to the start screen even with few
mobile browser tabs and requests greater running stability without quality loss.

Exclusive, immutable CPU geometry is stored losslessly and reconstructed when
needed. Previously every reconstructed GPU-upload buffer remained alive until
the next timer job; a frame restoring many buffers therefore accumulated their
combined decoded size. The successful Three.js upload callback now immediately
retires only explicitly exclusive backing buffers after WebGL has copied them.
Ordinary CPU reads keep their end-of-job lifetime. Borrowed storage, custom upload
callbacks and mutable attributes retain their existing behavior. Explicit writes
restore the original callback and ordinary writable storage. Failed uploads do
not discard their backing before retry. Uploaded values are byte-identical.

An accepted, current-view settled worker receipt now records that all surfaces
have been acknowledged and belong to this retained world. After pausing that
worker, a replacement skips re-fetching/parsing those completed ground, surface
and road sources. Building selection and missing building construction continue
normally. An unfinished initial surface lane still reconstructs missing batches;
stale view receipts cannot assert completion. New/rebuilt worlds get a new input.
No rendered surface is evicted by this flag.

Native startup now finishes required-site matrix corrections and the existing
lossless parking pass before allocating mobs, navigation and bridges. The same
single parking pass and final geometry are retained. A production-function test
with real Three matrices/scheduler confirms 1,441,792 owned decoded bytes before
parking and zero before navigation, exact final hashes, and rollback during
mode switches, disposal and scheduler failure. This avoids overlap between the
large finished native matrix storage and navigation construction.

No geometry, materials, textures, resolution, visible distance, city coverage,
source files or residency budgets change. These are memory-lifetime changes,
not a lighter visual preset. Existing in-place graphics recovery stays enabled.

Validation:

- Three.js real WebGLAttributes backend, 16 exclusive parked 4 MiB attributes:
  retained decoded upload peak falls from 67,108,864 to 4,194,304 bytes (93.75%).
  Immediately after the upload loop: zero instead of 67,108,864 bytes.
  This is a controlled transient-backing test, not total browser memory.
- Storage/residency/warmup tests cover exact upload bytes, shared and interleaved
  storage, custom callbacks, mutations, repeated evictions and failed upload retry.
- Full/mobile worker production-function tests check no completed surface reload,
  identical missing building source/order, and settlement only after all ACKs.
  The production view handler rejects stale completion receipts.

- Production Chromium with the Pixel 5 input profile: 28 views, repeated
  Normal/Schwellenraum/Flooded/Normal visits, zero page errors, zero spontaneous
  context losses. Retained main-thread heap after explicit test-only collection
  is 252,533,488 / 255,174,416 / 256,484,564 / 258,405,500 bytes; corresponding
  backing storage is 454,271,119 / 454,437,941 / 455,313,852 / 457,967,640 bytes.
  GPU buffer peak is 308,673,736 bytes. These separate counters are not total
  process/device memory. Collection is measurement instrumentation only; the
  application never calls it. The v123 comparison also levels off after warmup,
  so this tour does not prove a general leak was fixed or a lower overall peak.
  The measured improvement is the bounded synchronous upload peak above.

- iPhone-profile WebKit: trusted double/triple joystick gestures reach 6.20 m
  and 10.50 m, held movement crosses the hurdle, release stops, elevated walking
  descends smoothly, wedged recovery preserves walking. Two forced graphics
  resets preserve the same runtime, scene, world and camera, with no page errors.
- Release-readiness and the complete local package launch pass v1.0.124; all
  90 release/launcher/recovery validation tests pass.

- The five drawn-mode chooser starts pass in iPhone-profile WebKit, keeping the
  gallery flight pose and hiding all HUD/minimap controls while loading. A first
  sequential six-mode test then hit a JavaScriptCore SIGBUS during Minecraft
  startup; its cause is unproven. A fresh Minecraft retry passed in 19.34 s.
  After the native ordering change, final real-UI Minecraft → Day → Minecraft →
  Day transitions pass in 21.25 / 16.52 / 18.93 / 15.93 s without page errors.
  Two further forced graphics resets preserve the same scene/camera/world; the
  restored gallery flight view was visually inspected. The earlier engine crash
  is not claimed to be explained or universally fixed by the ordering change.
- Full Python partition: 1,211 pass, four skip; 15 temporary-directory setup errors
  occurred while the local build filled disk space. After releasing generated
  artifacts, all 15 rerun successfully. The final 90 release/launcher/recovery
  tests pass again, six overlapping the main partition: 1,310 unique passes.
- TypeScript and the final production build pass. Build/public and package copies
  use filesystem clones of the same original bytes to conserve local disk space.
  Repository Ruff and diff checks pass.

- Complete Bun inventory: 3,440 tests across 525 files pass. An initial
  aggregate runner was killed under local memory pressure, and its continuation
  timed out while the host was paging; every unfinished file was rerun in a
  fresh process with test-only collection between tests. The complete file
  inventory was reconciled, including both new lifetime regression files.
  No production collection hook or visual-quality downgrade is introduced.
Physical phones and their operating-system memory limits are not emulated by
browser device profiles; an unconditional no-crash guarantee is not established.
