# v1.0.39 — GRIPS-Theater and Hansaplatz

Pipeline step 10. GRIPS-Theater now has its grey metal-panel hall, red
lettering, external spiral stair, glazed court entrance and elevated glazed
link. The adjacent low shop buildings, U9 reception wall, blue canopies and
two compact courts follow all 31 retained official parts.

The covered public routes and three mapped southern U9 approaches stay open.
The 93-place catalogue, movement, view distance, scene extent, mobile menus
and existing recovery policies remain unchanged.

## Evidence and representation

See [sources, local estimates and conflict resolution](grips-hansaplatz-v139.md).
Every original LoD2 surface and prior prism remains in the compact supplement.
All roof heights survive the explicit display translation. Five individually
credited external photographs bring both attribution manifests to 284 records.
No photograph, new texture, light or animation callback is bundled.

## Rendering budget

| Model | Renderables | Instances | Buffer bytes |
| --- | ---: | ---: | ---: |
| GRIPS drawn | 2 | 2,452 | 233,548 |
| GRIPS Minecraft | 1 | 4,540 | 345,688 |
| Complete Minecraft full | 116 | 3,839,770 | 292,839,305 |
| Complete Minecraft mobile | 114 | 1,056,438 | 80,856,617 |

Whole-world buffer increases over v1.0.38 are 285,724 bytes full and 324,484
bytes mobile, including exact removal of old generic columns. These are
geometry/instance buffers, not total browser memory or physical-phone results.

Synchronous reference fingerprints:

- Full: `8e4d91b7d0b6fc493ed7269a4c5907558ecb98ccda825d6a0aa75fc87f2d76fb`.
- Mobile: `43cb0219324ede35f426cdba84ca7188708f2459bbdb569f320650e7ba905635`.

## Verification

- The complete frontend suite passes all 2,075 tests across 268 files, with
  8,320,114 assertions and no failures.

- All 434 Python tests pass; Ruff format and lint, TypeScript, production build,
  release readiness and the freshly generated local-package HTTP/inventory check pass.
- The new source/model tests cover all retained roofs, prior prism identities,
  both compact courts, visible foyer glazing, finite static buffers and standing
  capsule access through covered paths and the three U9 approaches.
- Final model and construction lifecycle checks pass all nine tests. A separate
  review corrected exterior lettering direction and the local roof/fascia/post
  height relationship before final validation.
- Synchronous and cooperative Minecraft fingerprints agree in both profiles.
  Independently measured generic replacements remove 314 old windows and
  489 full / 279 mobile generic column instances from the payload-only fixture.
- Chrome visual inspection covers street, elevated and entrance views in the
  production viewer for both drawn and Minecraft representations.
- WebKit iPhone SE and Chrome Pixel 5 emulation each pass all five modes plus
  return to Day, with no page or console errors or context loss. WebKit retains
  its existing unsupported `interactive-widget` viewport advisory.
- The dedicated WebKit mobile-menu gate passes five viewport layouts and all
  five modes plus return to Day.
- Physical iPhone/Android hardware was not available; browser emulation does
  not certify device RAM, GPU limits or frame rates.

## Artifacts

- `isometric-berlin-regierungsviertel-local.zip`: 14,745,599 bytes; SHA-256
  `03e840a5f9c98f4eeeb47e39ecb5139e97dc17bf82ee9995ece98d7cc52e960f`.
- `isometric-berlin-viewer-v1.0.39.tar.gz`: 14,576,872 bytes; SHA-256
  `09ff94bc2dc9c9e5625f41465e814937658fe9a381414e8c10bb6efab7f39830`.
