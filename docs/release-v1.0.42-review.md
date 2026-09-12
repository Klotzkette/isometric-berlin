# v1.0.42 — stable camera presentation and atomic viewport resize

Step 10 fixes whole-frame blue flashes and accidental city disappearance during
ordinary movement. Geometry, materials, source layers, resolution, view distance
and speed constants are unchanged from v1.0.41.

## Reproduced failure and correction

A production Chrome probe placed the wide camera at `[400, -5, 500]`, looking
toward `[400, -110, -1500]`. The previous wide-view exemption skipped the terrain
floor, enabling underwater fog with a 240 m far distance even over dry land.
The corrected camera retains its complete horizontal translation and viewing
vector while raising the rig above the sampled terrain. The same source pose
now settles at y=5.775 with the city visible and underwater fog disabled.

Looking upward could also cross the orbit's 90-degree threshold and hide every
surface world, even though the user had not requested a cutaway. Ordinary
navigation no longer activates that mode. The explicit underground control
still opens its wide inspection camera; actual tunnel traversal remains exempt
from the surface floor. Small ground-plane hysteresis prevents visibility
chatter when returning from a deliberately chosen cutaway.

Two-finger glide previously changed the camera after stabilization, visibility
and fog decisions. It now runs before the final controls update and terrain
checks. Every presented frame therefore uses the pose those checks validated.
No speed, sensitivity or damping constants were reduced.

Viewport resize callbacks previously cleared the live WebGL canvas immediately,
then waited for a later animation frame to replace its image. New dimensions
are queued and applied in the same JavaScript task as the replacement render.
Unchanged dimensions cancel a pending redundant resize. This retains the same
pixel ratio, SMAA and full-size render targets.

## Validation

The production stability probe captures every composer frame during forward/
backward travel, looking up/down, ascent/descent and viewport changes. It rejects
unrequested underwater fog, cutaway activation, invisible city roots and any
canvas resize whose task ends without a replacement frame. Desktop Chrome also
enters and exits the cutaway through its actual UI button. Mobile Chromium
exercises trusted two-finger input and release through the browser input path.

The final frozen-source frontend suite passes all 2,242 tests across 277 files
with 8,508,205 assertions. The focused camera, tunnel and rendering suite passes
77 tests. All 459 Python
tests, TypeScript, Ruff, release readiness and the local package HTTP smoke pass.
Browser checks use desktop Chrome and touch profiles in Chrome and WebKit.
The final movement probes observed 167 desktop Chrome frames, 368 touch Chrome
frames and 259 touch-WebKit frames without an invalid presentation state; each
run exercised eight renderer resize calls without an unpainted task. The
touch-WebKit menu gate also passes five layouts and all five visual modes.
They do not constitute physical older-iPhone hardware validation or a guarantee
against unrelated graphics-driver failures.

The published ZIP is 33,985,319 bytes with SHA-256
`b0f1c2c6d4f38d85bc9112bec6aff3aa37a697151e2a86a21747f9bf5b10e9a2`.
The static tarball is 33,866,533 bytes with SHA-256
`10c3af044723661485b376e83b3d025b5f768ccd4563922d1560204eb5250943`.
GitHub Pages retains older hashed assets for already-open tabs.
