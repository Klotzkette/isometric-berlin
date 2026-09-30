# Fernsehturm rose vapour — v1.0.50

Pipeline step 10. The owner requested pale pink vapour and occasional smoke
fountains from the tower sphere in Schwellenraum. This is an authored dream
motif, not a representation of real emissions. “Fontänen” is implemented as
higher smoke plumes from the sphere; no unrelated fountains are changed.

## Construction and preservation

A single transparent instanced mesh sits at the retained tower sphere anchor.
Six upper shoulder sources emit 72 staggered soft puffs. Three alternating
sources add 36 taller puffs in an intermittent 29-second cycle. Analytic cloud
lobes, slow drift, expansion and smooth birth/death fades avoid visible square
cards or recycling jumps. The material is pale rose fading toward white; opaque
tower surfaces occlude smoke behind them.

The buffer contains 108 fixed quads: under 2 KiB of vertex/index/instance data,
one draw call when visible, no texture, no per-frame particle creation or
buffer uploads. Time is the only changing shader uniform. A conservative bound
includes the full displaced plume and billboard corners.

Only Schwellenraum presents this mesh. Its elapsed clock pauses outside the
view, in hidden tabs, in other modes and for the reduced-motion preference.
The idle renderer schedules visible steam at at most 30 updates per second.
World cancellation, failed publication and normal disposal release its buffers
and material, and clear the runtime reference.

No architecture, mapped surface, source record, native Minecraft model,
landmark inventory, navigation speed, rendering resolution or view distance is
changed. Day, Night, Snowstorm and Minecraft retain their previous appearance.
Existing tower-source credits continue to apply; this procedural effect adds
no photographic reference or runtime image.

## Validation

- 66 focused frontend tests / 2,296 assertions pass: fixed buffer and bound
  contracts, real mode presentation, frustum culling, motion cadence and pauses,
  construction cancellation/rollback and actual production resource disposal.
  Existing tower and sunlight presentation tests also pass.
- TypeScript and the production build pass.
- Built-viewer desktop Chrome and WebKit with the iPhone 13 viewport pass the
  runtime checks: one visible fixed batch, advancing animation with identical
  buffers, reduced-motion pause at startup, offscreen pause, gentle resume and
  all five mode transitions. No page, shader or HTTP errors. WebKit reports its
  existing ignored `interactive-widget` viewport metadata warning; this is
  separate from application errors. Close, distant, steady and burst views
  were inspected visually.
- Browser QA caught and corrected a GLSL reserved-word compile error before
  release. The offscreen mobile fixture was corrected so its widened camera
  actually points away from the tower.
- `uv run ruff format .`, `uv run ruff check .` and all 493 Python tests pass.
  Static packaging, release readiness and local-package HTTP smoke checks pass.
- Source datasets, delivered mesh assets and all architectural model files are
  byte-unchanged relative to v1.0.49. Only the additive effect and runtime
  integration are new. Physical iPhone hardware was not available for testing.
