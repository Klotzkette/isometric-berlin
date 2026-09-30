# Schwellenraum resource lifetime — v1.0.52

Pipeline step 10. The reported intermittent crash was not reproduced as a
browser-process termination. This correction addresses measured memory retention
and unnecessary per-frame work; it does not remove city data or simplify effects.

## Changes

On a real mobile drawn-mode transition, the renderer's material programs are
retired through Three's public `Material.dispose()` lifecycle. The material
objects, authored callbacks, uniforms, textures and geometry remain intact.
The target mode recompiles through the existing bounded warmup/render path.
This trades some mode-switch compilation work for a smaller retained cache.
Ordinary lighting refreshes and animation ticks do not retire programs.
Desktop mode-switch caching remains unchanged.

The warmup queue now reinstalls resource-disposal observers even for objects
already queued. This prevents a later retirement from being missed after an
earlier disposal removed its one-shot observer.

Schwellenraum water ticks use weak root/overlay references refreshed at existing
publication/presentation boundaries. They update the same uniforms at the same
cadence without a whole-city traversal or new material Set. Detached targets
are pruned; caches do not keep released batches alive. Shader code is unchanged.

The final SMAA pass writes directly to the screen and no longer swaps the
composer's city buffers afterward. Consequently only one city colour/depth
target becomes GPU-resident. SMAA's own precision and processing remain intact.
Canvas dimensions and device pixel ratio now change in one public
`setDrawingBufferSize` call. Composer stays at its initial pixel ratio of one
and receives the same physical dimensions once per resize. Geometry detail,
view distance, image resolution, glass transmission and all effects are retained.

## Measured route

Chrome with an iPhone 13 profile visited four city positions after each of 12
Day/Schwellenraum/Night/Snow transitions. The final Schwellenraum observation:

| Quantity | v1.0.51 | v1.0.52 |
| --- | ---: | ---: |
| Retained compiled programs | 334 | 113 |
| JavaScript used heap after requested collection | 247,399,388 B | 208,306,208 B |
| Scene objects | 13,305 | 13,305 |
| Unique scene geometries | 6,277 | 6,277 |

The roughly 39.1 MB heap reduction is one host-browser observation, not a total
GPU/process-memory estimate or an iPhone memory-limit guarantee. Background
streaming/animation and collection timing make transient counters variable.
Both Chrome and WebKit completed the 12-visit route without page errors or
unrequested context loss.

## Verification

- 139 focused frontend tests passed, covering material/program disposal,
  queued-resource epochs, actual Three composer/SMAA buffer use, water targets,
  forced-GC retention, drawn construction, render quality and Schwellenraum.
- The complete Python run passed 497 tests while the new version still had an
  old built package; its remaining readiness check then passed with all 65
  readiness tests after packaging v1.0.52. The updated stability probe's four
  validation tests also passed. Ruff, TypeScript and production build passed.
- A real WebGL pixel comparison of Day and Schwellenraum compared 1,885,184
  channels per view before/after terminal-swap suppression and forced program
  recompilation: zero changed channels and zero GL errors in both views.
- Forced WebGL context loss in Schwellenraum recovered the same pose in Chrome
  (including walking) and WebKit; a second loss stopped at explicit recovery,
  rather than starting a reload loop.
- Desktop Chrome and touch WebKit navigation/resize probes passed with 509 and
  558 rendered frames respectively, no erroneous blue/underside frame and four
  atomic repaints per browser. The keyboard probe now re-centres after its
  earlier journeys so reaching the real map boundary cannot mimic stuck input.
- Release readiness and the local downloadable package startup passed.

Browser profiles exercise engine/lifecycle behavior, not a physical iPhone's
RAM or GPU. No landmark constructors, source meshes, streets, park details,
tour catalogue or bounds were changed.
