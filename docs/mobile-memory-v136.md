# Mobile memory corrections — v1.0.36

The reported iPhone reload / “can't open the page” remains a device report,
not a locally reproduced iOS process termination. This release addresses two
measured memory costs without changing source data or visible quality.

## Terrain lifetime

`createSpreebogenLawnGroundAt` and `createPedestrianBridgeGround` previously
created temporary source-sampling callbacks in the same lexical scope as their
persistent navigation callbacks. JavaScriptCore retained the decoded ground
payload through those shared closure environments even after the fetch promise
was released. Clearing either promise alone could not resolve this retention.

Compilation now has a separate function scope. The returned queries retain
only compiled lawn triangles or bridge deck profiles. A standalone JavaScriptCore
benchmark uses the actual delivered payload, WeakRefs and completed GC turns
to verify release while both queries remain callable. Sampled heights remain
identical across 18,291 lawn positions and 14,625 bridge/mode positions.
Combined retained query heap fell from **15.61 MB to 0.83 MB** in the JSC
harness. The viewer still needs 1.29 MB of height samples elsewhere; accounting
for those gives an estimated net viewer saving of **13.49 MB** for this fix.

## Exact geometry storage

Only explicitly opted-in immutable geometry is compacted before first upload:
finished drawn accessory bodies/lamps/contours, the static city core and the
manually merged bridge batches. Worker batches are compacted before transfer.
Source constructors retain their existing layout until publication, so derived
Minecraft conversions and authored geometry contracts retain their inputs.

The indexer merges only byte-identical vertices across **every** attribute.
It preserves triangle/line order, colours, normals, UV seams, line distances,
material groups, draw ranges and bounds. A typed open-address table avoids
per-vertex strings; the vertex cap bounds integer scratch space to 12 MiB.
There is no output allocation when indexing would increase storage. The
publication marker prevents repeat allocation after upload or on mode changes.

Animated cloth, Quadriga palette buffers, dynamic attributes, morph targets,
custom upload callbacks and unmarked authored layouts are excluded. CPU
positions remain available for raycasting and clean context-loss rebuilding.
No geometry, resolution, building coverage or draw distance is reduced.

## Browser measurement

The same fresh Chrome/iPhone-13-emulation route was measured before and after:

| Retained scene quantity | v1.0.35 | v1.0.36 |
| --- | ---: | ---: |
| Unique geometry/instance backing buffers | 178,171,337 bytes | 156,918,428 bytes |
| Scene objects | 5,712 | 5,712 |
| Instances | 509,347 | 509,347 |

The deterministic scene-buffer reduction is **21,252,909 bytes (11.9%)**.
Corresponding uploaded attributes also become smaller, but this measurement
does not report total driver/GPU process memory.

In the sampled cold-load traces, peak main-thread JS heap was 336.2 MB before
and 290.6 MB after; external backing storage peaked at 226.6 / 194.9 MB.
GC timing varies, these are observations from individual host runs, and the
figures must not be added together as an iPhone process-memory measurement.

## Verification

Exact-byte tests cover existing and new indices, UV/colour seams, signed zero,
NaN bit patterns, 16-bit primitive restart limits, dashed lines, groups and
bounds. Publication tests also compare raycast intersections and transferred
geometry and verify that subsequent mode passes leave buffers intact.

```sh
cd src/app
bun scripts/benchmark-navigation-source-memory.ts
bun test tests/exact-geometry-index.test.ts tests/compact-static-geometry.test.ts
```

Production WebKit/iPhone-SE and Chrome/Pixel-5 emulation exercise cold loading,
all five modes, movement and bounded context-loss recovery. These engine tests
do not establish that a physical older iPhone will remain within its OS memory
limit; the reported phone needs to retest the published build.

Release checks passed: production build, Ruff, 424 Python tests, 56 focused
frontend tests, the navigation-memory harness, six mode checks per browser
engine, both context-loss recovery checks, package readiness and local-package
startup. Chrome screenshots at Potsdamer Platz, Europacity and Charité retain
the existing presentation without JavaScript errors.
