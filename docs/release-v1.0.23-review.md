# v1.0.23 — Richard Serra's Berlin Junction

Pipeline step 10. Only the sculpture and its traversable passage change.
The former model had weakly curved, individually outlined boxes, the wrong
site orientation and a separate solid white LoD2 envelope through its centre.
Two continuous, inward-leaning steel plates now follow the retained source
course and the owner's four photographs, with a separate Minecraft reading.

Exactly LoD2 `K0003UOE` and one raw voxel column are replaced in display and
collision; their source records remain intact. Collision follows the steel,
leaving the intended passage open. T4's geometry and entire original protected
area, all other buildings, movement controls and rendering distance are unchanged.

The source inventory publishes 14 × 3.4 m per plate. Curvature, lean, passage
width, thin edges and patina remain documented display fits. The previous precise
dimension attribution is corrected, and the source's original 3.9 m envelope
height remains recorded. See [source evidence](berlin-junction-v123.md).
The supplied photographs are not bundled or used as textures.

## Verification

- Final sculpture, source replacement and protection suites: 45 tests,
  4,329 assertions, zero failures. Actual triangle rays and 111 standing-body
  positions cover the curved passage and both entrances in the full source index.
- An independent check against the actual 2,276 Minecraft instance boxes
  retains at least 0.584 m clearance for the 0.42 m body radius.
- Six affected source/Minecraft/progressive suites: 85 tests,
  5,940,414 assertions, zero failures. Independent synchronous builds confirm
  the exact removed-envelope delta: one voxel instance / 76 bytes per profile;
  the isolated generic LoD2 geometry accounts for 180 vertices / 2,536 bytes.
- All 375 Python tests pass. Ruff, TypeScript, production build, release
  readiness and local package HTTP/start-page checks pass.
- A real production Chrome touch viewer was inspected in all five modes.
  The four drawn modes retain the two smooth plates; Minecraft shows only its
  block batch. No page errors occurred. Temporary inspection scripts reacquire
  the active runtime when mobile mode changes rebuild the scene.
- Cold production startup passes in Chrome touch and WebKit touch with no
  runtime, audio-policy or critical network failures. WebKit emits only its
  existing `interactive-widget` viewport advisory. No physical iPhone was available.
- All 19 production entry/browser assets match the package byte for byte.

## Artifacts

- ZIP: 36,314,405 bytes; SHA-256
  `60524999a571afc528e73e01bedd0f36abe1b23ba094563ae9e4d7dbc229889b`.
- Static archive: 35,736,728 bytes; SHA-256
  `f3dac6e3168623527bb2b43a7453e6f6604fd114538b58e79149846c4ab5bb1d`.
