# v1.0.149 — foreground recovery and GPU retention

Step 10. The owner requests improved runtime stability without reduced geometry,
visibility, resolution, mobile detail or changed residency budgets.

## Suspended graphics recovery

The earlier recovery controller started a twenty-second wall-clock timeout on
every WebGL context loss. The viewer paused rendering and worker activity on
`visibilitychange` and `pagehide`, but did not pause that timeout. A background
loss could therefore exhaust the clean-restart fallback before the browser had
an active foreground opportunity to restore the context. A later restored event
was ignored because the controller had already entered its failed state.

The same twenty-second recovery allowance now measures active foreground time.
Hidden documents and suspended pages cancel the scheduled timeout and retain its
remaining duration. Returning to an active visible page rearms only that remaining
duration. A loss that starts while hidden receives its first deadline on return.
Timer generations prevent a previously queued callback from expiring a later
active interval. Restoration and disposal cancel the timer, including while hidden.
An actual foreground failure still invokes the existing fallback exactly once.

The viewer feeds both page lifecycle and visibility into this controller. A
`pagehide` remains suspended until `pageshow`, even if visibility events arrive in
a different order. Context loss itself is not treated as background inactivity:
a visible lost context must still be allowed to reach the existing fallback.
Scene contents, camera/navigation snapshots, GPU/CPU residency and all rendering
budgets remain unchanged by this correction.

## Instance retention under byte pressure

The instance policy previously protected a frustum twice the visible width and
height, even above its existing 48 MiB target. Its separate geometry counterpart
already narrows this look-ahead to 18% under byte pressure. Instance retention
now uses the same 18% margin above the unchanged byte target; below that target
the original wider margin remains. This changes only when an offscreen uploaded
copy may be released. Original matrices, colours, scene membership, visibility,
crossing bounds, shared storage and the existing grace period are retained.
An object entering view uploads its exact original storage again.

At the failure camera, metadata from the v148 probe identifies the Kranzler,
Zoofenster/Upper West and City West facade batches outside both the actual and
18% frusta, but inside the former doubled frustum. Their instance storage totals
4,112,208 bytes. Other large central batches genuinely intersect the camera
frustum, so this small reduction must not be presented as a complete solution to
the foreground context loss.

## Suppressed ink and explicit preparation

Three.js checks object layers before uploading geometry, but checks material
visibility afterwards. The ink policy now gates its own exact no-op line leaves
at the layer test, so fully suppressed ink does not acquire an untracked GPU
copy during ordinary rendering. Authored visibility, layer masks, children,
custom callbacks and replacement materials keep their existing semantics.

The desktop preparation pass deliberately uploads with zero drawn vertices. Its
selection reads the original authored layer predicate, and its existing temporary
material visibility allows that explicit upload. The predicate and material
visibility return to their suppressed state in the preparation pass's cleanup.
This preserves ordinary upload suppression while allowing exact preparation
after GPU retirement or context restoration. Mobile preparation remains disabled.

## Preparation waits for initialized shadows

A desktop Chrome diagnostic also reproduced a pre-existing WebGL
`INVALID_OPERATION` in published v147 and the initial v149 build. Its first
zero-vertex preparation ran before the first complete scene render, with the
sun's shadow map still absent. The preparation deliberately suppresses shadow
updates so its temporary subset cannot replace the complete shadow atlas. Three's
uninitialized shadow-sampler fallback then bound a colour placeholder, which is
invalid even for a draw with zero vertices.

Preparation now waits while an active shadow-casting light has no atlas or the
renderer still requests its ordinary shadow update. The queue stays intact and
does not keep a preparation timer running while blocked. The normal scene render
initializes or refreshes the complete atlas before preparation resumes. Hidden,
detached and layer-excluded lights do not block it; parent layer masks are not
inherited. Context restoration and newly attached lights obey the same rule.
No shadow resolution, material, geometry, normal render or GL implementation is
changed.

## Validation and limits

The recovery, both GPU residency, ink and preparation suites pass 106 tests /
1,215 assertions.
Nine recovery tests cover repeated losses, ordinary timeout,
restoration, stale callbacks, unmount, a two-minute hidden interval, preserved
remaining foreground time, and the shipped visibility/page-event wiring. Two
new instance-policy tests verify pressure-only reclamation, preservation of
visible/crossing/shared storage, unchanged instance bytes and ordinary re-upload.
The preparation tests additionally verify suppressed ordinary renders perform no
upload, retired data re-upload unchanged, context restoration prepares the same
arrays, and failed preparation restores material and callback state.
Three additional tests cover first-atlas deferral without consuming the queue,
restoration/new-light readiness, and exact light ancestry/layer eligibility.

The complete Python suite passes 1,637 tests with four skips and two existing
CRS warnings. The final crossing correction additionally passes three focused
Python and three Bun tests (2,161 assertions), including actual top-surface ray
checks in both families. Six final drawn/native street and tram views pass
without page, graphics or context-loss errors.

The production build passes. A desktop Chrome run at 1440×1000, without GL
wrappers, passes 24 camera/mode samples through day, night, snowstorm,
Schwellenraum, flood, Minecraft and back to day. Every sample reports GL error
zero and no context loss; warning/error capture stays empty. An explicit context
loss during a 25-second page suspension then restores the same runtime, camera
and ready scene, again with GL error zero. A separate renderer-level diagnostic
confirms that the first complete scene render now initializes the atlas before
any preparation render; its former sampler warning is absent.

This addresses a verified controller restart path. It does not establish the
cause of every reported memory-pressure or browser-process failure. A separate
foreground WebKit failure at the Steglitz facade camera (eye `[-3525,25,6840]`,
target `[-3507,14,6806]`, FOV 50 degrees) must not be attributed to background
timeout handling. Captured GPU-process crash reports identify a native
`gl::Buffer::getMemorySize` failure during WebKit memory-cost accounting; the
app-side corrections above do not claim to repair that browser-driver failure.
No experimental WebGL buffer binding or upload-flush guard is shipped.

The same foreground failure was reproduced in the published v147 and local v148,
so it predates the v148 fountain and Albrechtstraße facade changes. Probe totals
that accumulate WebGL allocations across context restoration are not live GPU
totals: the browser destroys the old context resources while such a probe may
retain their earlier accounting. The reproducible loss event and pre-loss totals
remain the relevant evidence.
