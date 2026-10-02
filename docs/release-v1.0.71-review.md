# v1.0.71 — Runtime stability with unchanged detail

Step 10 addresses reported desktop and mobile failures, including Flooded
Berlin. The reported physical-device crashes were not reproduced on this
host; this release removes concrete avoidable allocation, GPU retention and
scene-processing work. It does not claim crash-proof operation on every device.

## Changes and preservation

- Both desktop and touch retire unused offscreen GPU instance/geometry copies.
  Authored CPU arrays remain intact for exact re-upload. Visible geometry is
  never capped by the working-set target. Observer installation/release order
  respects desktop warmup, and context loss resets instance accounting.
- Water exit restores the saved background, clear colour, fog, exposure and
  hemisphere intensity directly. It no longer relights/re-enqueues the whole
  city. Cutaway fog and real lighting-mode changes refresh that state correctly.
- Fixed surrounding, voxel and landmark containers no longer force descendant
  world-matrix multiplication each frame. These are shallow freezes: moving
  flags and other animated children keep updating.
- GPU preparation uses constant-time candidate removal/rotation instead of
  array searches/shifts. Draw observers avoid temporary rest-argument arrays.
- Mobile Day/Flood transitions keep their shared city shader programs. Water
  subdivision replaces temporary string edge keys with exact integer keys.

No source payload, model, street, shoreline, facade, monument, material, water
shader, animation cadence, draw distance or image-resolution setting changed.
No new data sources or licence changes. Water buffer hashing matches v1.0.70
exactly; the complete native Minecraft construction hashes also still match.

## Measurements

All measurements are from this development host. Browser device profiles
exercise engines and input/viewports, not the RAM limits of physical phones.
GPU buffer counters exclude textures, framebuffers and driver memory.

- WebKit/iPhone 13 profile: twenty complete submerge/surface cycles, zero
  runtime errors; all forty camera and appearance samples match v1.0.70.
  Main-city traversals fall from 480 to 80; whole-scene traversals from 80 to
  40 (the remaining forty are the test snapshots). Both runs finish with the
  same 6,749 meshes, 2,819 materials, 4,913 geometries, 11,023,630 stored
  vertices, 24,591,810 indices and 83 shader programs.
- Six-mode desktop route (28 samples, real menu transitions): GPU buffers
  end at **198,784,438 bytes instead of 705,503,352** after returning to Flood
  (71.82% less). Route peak falls from 739,448,788 to 502,870,391 bytes
  (31.99% less). The unchanged resident Alt-Mitte CPU geometry survives 425
  GPU-disposal events; eight route intervals demonstrate real GL deletion
  alongside exact source-array reuse. Both runs have zero browser errors and
  zero context losses. Counts cover buffers only, not total memory.
- Queue microbenchmark, 30,000 reverse-order removals: median 64.15 to 18.91 ms.
  This is bookkeeping cost, not a claim of a 70% frame-rate improvement.
- Water construction, twelve Bun runs: mean 8.36 to 5.09 ms; observed heap
  capacity 14.0 to 11.3 MB, with byte-identical output. Not total viewer memory.
- Chrome's repeated gate/panorama motion profile shows small and noisy changes,
  not a universal FPS improvement. Panorama flight render-CPU p95 improves
  from 35.4 to 31.2 ms, while orbit RAF p95 worsens from 50.1 to 66.7 ms in the
  single comparison. The geometry/draw work remains complete. These results
  do not justify claiming consistently smooth 60 FPS in every view.

## Verification

Independent code review found no correctness or visual-quality regression.
83 focused frontend tests pass (15,945 assertions), including GPU ownership,
queue ordering, context loss, exact geometry, static transforms and water
appearance. The full Minecraft construction/hash regression also passes.
Production TypeScript/Vite compilation passes.

- Complete Python suite: **730 passed**; the new smoke-test guard suite adds
  **16 passed** (746 distinct checks). Ruff format/check passes. The two existing
  fixture CRS warnings do not affect the viewer.
- Release readiness and the extracted local-package launch smoke pass for
  v1.0.71. Source payloads, geographic data and references are unchanged from
  v1.0.70. Both ZIP and TAR are complete, versioned and locally hashed.
- Desktop Chrome, WebKit/iPhone 13 profile and Chrome/Pixel 5 profile each pass
  28 travel samples and all six modes: **84 successful samples**, zero runtime
  errors, crashes or context losses. Desktop retains one runtime; touch performs
  exactly its expected Minecraft family remounts. Pose continuity, one reused
  water mesh and exact permanent source buffers are asserted.
- Mobile WebKit buffer peak/end: 240,800,612 / 134,761,701 bytes. Chrome/Pixel
  profile: 239,477,655 / 129,967,473 bytes. Each mobile route demonstrates
  fourteen intervals of real GPU retirement with unchanged resident source
  arrays. No physical-phone total-RAM guarantee is inferred from these counts.
- Desktop and mobile Flood/Day/Schwellenraum screenshots were inspected. The
  water surface, detailed gate, trees, surrounding facades and controls remain
  present. The reusable six-mode route is `scripts/smoke_runtime_stability.py`.

