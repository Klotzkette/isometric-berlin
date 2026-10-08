# Restrained city colour pass — v1.0.84

This owner-requested Step 10 pass changes presentation only. Eight muted plaster
and stone swatches (cream, sand, ochre, warm rose, sage and blue-grey families)
give generic buildings more distinction. They are plausible display colours,
not newly surveyed paint colours. Recorded source colours/materials and authored
landmarks keep their previous treatment.

Core distant and detailed shells share the same palette. Only neutral unmeasured
illustration samples receive a 38% tint; coloured samples remain unchanged.
Existing generic facade strokes use a softer blue-grey accent, handled by the
existing Day/Flood/Night/Snow/Schwellenraum material policy.

Outer packets retain their original bytes. During their existing bounded decode,
only `city` meshes with the exact generic wall/roof RGB values are recoloured.
Original source IDs choose the same family across packet boundaries. Quantized
footprint/courtyard corners supply ownership; ambiguous corners keep their old
colour. Roofs receive a restrained 12% blend. Minecraft uses the same generic
family without changing any individually authored native model.

No positions, indices, navigation, meshes, render distance, texture, GPU buffer
size or per-frame work is added or removed. The temporary corner lookup is
released after decoding; the existing yield/cancellation path remains intact.

Validation: focused decoder, streaming, palette, source-colour and core-geometry
checks, production build and a mobile WebKit mode/visual check. Four historical
urban-facade tests already fail on unchanged v1.0.83 because their old buildings
now belong to the separate Alt-Mitte models; the unchanged baseline was checked
independently. Only the obsolete outside-neighbourhood colour freeze changes to
reflect the user's explicitly citywide colour request; hero colour hashes remain.

Focused verification: 32 surrounding decode/streaming tests, seven core/ink
tests and ten building-attribute tests passed. Core geometry/indices/draw counts
were compared with the unchanged v1.0.83 worktree; source/hero paint stayed
byte-identical. Mobile WebKit passed 11 views across all six modes and the Day
round trip without page errors or context loss. Package readiness/local HTTP
launch, TypeScript and the production build passed.
The complete Python suite passed (891 passed, four skipped); Ruff lint/format
checks and `git diff --check` also passed.
