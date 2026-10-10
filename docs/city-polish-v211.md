# Citywide material polish — v1.0.111 / Step 10

The owner requested a restrained general beauty pass across the entire existing
city. This is a presentation refinement of the retained buildings, not a new
geographic footprint or an opening-by-opening architectural survey. The baseline
is v1.0.110 (`563028bdb0bc0e22a789edc5c3fa59f21028b1c9`).

## What changes

- The eight existing generic plaster/stone families have slightly clearer warm
  sand, cream, ochre, rose, sage and blue-grey separation. Their ordering and
  deterministic source-ID assignment remain unchanged. Explicit source and
  individually authored material decisions take precedence.
- Drawn outer-city generic walls receive a small static height-relative light
  wash: 88% of their linear paint at the base through 101% at the top. The
  actual retained ground, terrain offset and elevated part bounds determine the
  height; this adds no windows, floor bands, wall joints or fake building parts.
  Roof colours keep the existing restrained palette blend. Native Minecraft
  keeps flat block colours rather than this continuous wash.
- [Core building colour resolution](core-material-v211.md) uses unambiguous retained CSS colour names
  and recorded facade materials consistently beyond the earlier urban colour
  zones. Previously, an overview illustration sample could override a mapped
  material outside those zones. All earlier authored priorities remain first.
- Neutral unmeasured core illustration samples outside those zones have a
  continuous, less washed-out tone. Coloured illustration samples keep their
  earlier path. Early complete shells and detailed buildings use the same
  material function, so loading detail does not change the building's identity.

Existing window geometry, lines, sills, cornices, landmark models, source roofs,
courtyards, terrain, streets and shorelines remain intact. No geographic facade
switch is globalised: those switches also control geometry. The shared facade
ink shader and its earlier regional emphasis remain unchanged.

## Sources and interpretation

No new geographic or photographic source is introduced. Retained Berlin LoD2
(dl-de/zero-2-0) provides source envelopes, while the existing OpenStreetMap
attribute snapshot (ODbL-1.0) supplies recorded colour/material tags. Strict
single colour names or hexadecimal values are resolved; mixed or ambiguous
strings remain unresolved. A material-only swatch is still an illustration of
that material, not a measured paint observation.

The generic palette and height wash are explicitly display choices. The pass
makes ordinary blocks more legible but does not certify each building's current
paint colour or window arrangement. Individually researched landmarks retain
higher priority.

## Preservation and cost

The streamed change is restricted to `city` mesh parts with the exact original
generic wall/roof RGB values and an unambiguous source-corner owner. Other mesh
kinds, authored colours, unowned vertices, water, roads and shared corners keep
their existing values. Where one source ID has conflicting vertical parts, the
entire source owner keeps flat paint rather than choosing an arbitrary height.
This includes partially shared rings, so a single wall cannot receive a diagonal
wash simply because one of its ends is shared by a different-height part.

Colour computation stays inside the existing bounded decode loop. One reused
scratch RGB tuple avoids allocations per vertex. A temporary source-ID map
shares owners across their corners; its two small height scalars per owner and
both temporary maps are discarded after decoding. No texture,
shader, geometry attribute, draw call or per-frame CPU work is added. Packet
bytes, source navigation, buffer sizes and the city residency target remain
unchanged. Native roof selection and cap counts remain unchanged.

## Verification

- Full Python suite: 1,267 passed and four skipped.
- Production TypeScript/Vite build passed. Ruff formatting and lint passed.
- 85 focused frontend tests passed: 38 streamed colour/decode/residency/navigation
  checks and 47 core material, source attribute, architecture preservation and
  Minecraft construction checks. Partial shared-corner ambiguity is covered in
  multiple source orders, as are terrain/origin offsets and cooperative decode.
- An independent before/after run reproduced the released full and mobile
  native-world appearance hashes before applying this change. All non-colour
  hashes, matrices, instances, byte counts and renderable counts stay exact.
  Only the existing building-column colour buffer changes; the other 348/346
  meshes stay exact. Historical fixtures remain frozen.
- The production release-readiness gate passed with the complete ZIP and tarball.
  The extracted package is 873,299,702 bytes (832.843496 MiB), 790 bytes above
  v1.0.110 and below the unchanged 833 MiB ceiling.
- The installed Chrome browser passed 24 city/mode views: ten existing districts
  in Day and Minecraft, plus central Night, Snow, Schwellenraum and Flood views.
  All mode switches preserved their camera pose. No browser error, page crash or
  WebGL context loss was reported. The v1.0.110 baseline passed the same twenty
  Day/Minecraft poses. Matched Moabit, Neukölln, Steglitz and Mitte screenshots
  were inspected; bespoke models and existing building silhouettes remain.

- WebKit with the automated iPhone 13 touch profile passed the same 24 views
  and five mode transitions with no reported page errors, crashes or context
  losses. Mobile Neukölln and Mitte screenshots were also inspected, including
  the visible mode menu and joystick.

Browser automation is a bounded check, not an assertion that every physical
phone is crash-proof. No device-memory or lifetime guarantee is inferred from
these runs.
