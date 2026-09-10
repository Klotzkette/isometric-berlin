# v1.0.24 — Six arrivals and a refined Goldelse

Pipeline step 10. Fresh viewer visits rotate through six framed views:
Reichstag, Chancellery, Hauptbahnhof from Washingtonplatz, Goldelse at the
top of the Siegessäule, Brandenburg Gate from Pariser Platz and Richard
Serra's Berlin Junction beside the Philharmonie. Explicit landmark links
retain their normal focus and do not advance the rotation.

The opening camera is applied before construction, with an explicit lens
that keeps its physical position over the intended approach. Mobile scene
remounts preserve the opening; deliberate sight selection clears it. Late
details do not reset a visitor who has already started moving. The Serra
opening waits for the actual sculpture, and uses the existing Philharmonie
catalogue entry with a dedicated label. The catalogue remains at 93.
The unclear “Richard-Strauss” name is provisionally interpreted as Serra
from the immediately preceding owner photographs, as communicated during work.
See [arrival contract](simulation-start-views-v124.md).

Goldelse gains fuller chest/hips, gathered bodice and waist fabric, curved
robe folds, finer face/limbs and outward/downward feather fans. Her 8.32 m
height, west-facing anchor, shoes, wreath and standard remain intact. The
figure has 21,828 vertices in one gold material draw; the complete monument
retains five renderables. Minecraft changes 42 existing transforms and
keeps every global instance/draw/buffer count. See [sources and budgets](goldelse-v124.md).

## Verification

- Complete frontend run: 1,926 tests exercised. Two outdated source-contract
  assertions were corrected; the final affected suites below pass.
- All 387 Python tests pass; Ruff formatting and lint pass.
- The final 50 focused figure, source-credit and static-frame tests pass
  with 66,357 assertions. Independent synchronous Minecraft builds match
  cooperative construction, with unchanged counts and buffer sizes.
- TypeScript, production build, release readiness and local package HTTP
  checks pass. All newly added reference photographs remain external-only.
- Production Chrome desktop and touch gates verify all six actual camera
  poses before/after readiness, seven successive loads, explicit-link
  precedence and manual same-name focus. Touch additionally verifies
  Minecraft/Day remounts both before and after clearing the opening.
- Cold Chrome touch and WebKit touch startup pass without runtime, audio
  policy or critical network errors. WebKit retains only its pre-existing
  `interactive-widget` viewport advisory. No physical iPhone was available.
- All five visual modes retain the Goldelse arrival pose and the intended
  drawn or block-native world, with no page errors.
- Four orthographic views of the real Goldelse geometry and actual desktop/
  portrait arrival screenshots were visually inspected.

## Artifacts

- `isometric-berlin-regierungsviertel-local.zip`: 36,316,636 bytes; SHA-256
  `4f4d378c8c5df80629f789c9201afc36f4afd8cff4ec604cd8e80e86a12d95f4`.
- `isometric-berlin-viewer-v1.0.24.tar.gz`: 35,739,358 bytes; SHA-256
  `1e92d49b48ca8f12bc94de482af4c5bc85e2e16a3aea3dde0ebc4423548da67c`.
