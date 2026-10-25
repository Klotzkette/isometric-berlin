# Gymnasium Steglitz: finish the old-building window correction

The owner reports a remaining inconsistent window side and asks that all old
school wings follow the supplied photographs, excluding the modern wing.

The complete inventory finds the cause: v250 replaced three Heesestraße fronts
and the sports hall, and v251 corrected the selected courtyard fronts. Thirteen
other historic wall sheets still carried 328 original v182 pane/sill rows. Those
estimates repeated 1.70 m windows through five floors regardless of the actual
historic three-storey reading. All twenty school parts and all wall sheets are
audited; nine modern/connecting/rounded-annex parts remain unchanged.

The remaining historic fronts now have 85 tall white/cream framed openings at
the three established floor elevations. Each opening has a vertical mullion,
upper transom, actual segmented arch glazing and a brick arch above. Basement
openings, dark horizontal brick courses and restrained green/cream diamond
spandrels follow the supplied street and courtyard references. The blank
terminal return beside the Heesestraße front has brick courses instead of the
old generic window grid. Existing lateral bay positions on unphotographed sides
remain explicit display estimates; this is not a measured aperture survey.

Complete source wall and roof coordinates, all original native occupied cells,
navigation, open courtyard, sports hall and modern wing remain unchanged. The
v250/v251 Aula triplets, oculi, clock gable, entrances and front lettering stay
exact earlier batch prefixes. The photographic reference assets are not shipped.

`steglitzWindowsV273.ts` verifies the complete original boxes, surfaces, native
rows and both previous photographic model payloads before any replacement. Any
changed receipt keeps the previous rendering and suppresses the new details.
Only the boolean verification result is cached. Native members are independently
placed against the outer orthogonal source-cell envelope. They retain separate
glazing and frame depths, without copying rotated drawn members.

Integration composes v251: `steglitzWindowsV273SourceBoxes`,
`steglitzWindowsV273NativeRows` and `steglitzWindowsV273SurfaceColor` receive
the original indexed v182 inputs. `appendSteglitzWindowsV273` follows the
complete v250/v251 school batch. The new data's `boxes`, `rods` and `nativeRows`
use the existing weak lossless constructor transform. No new render root,
texture, animation, coverage, tour stop or mobile quality tier is introduced.

Payload: 208,094 bytes before the lossless transform and **124,737 bytes** as
the actual transformed module; 997 drawn boxes, 1,614 small line members and
3,854 independent native rows. Six newly generated sub-centimetre ornament
splinters are omitted before quantisation because they would become zero-width
boxes. No original source cell is removed. Added instance attributes
are 198,436 bytes drawn or 292,904 bytes native before the obsolete 328 drawn
rows are removed. All live residency and packet limits remain unchanged.

Review the previously inconsistent outer wing from eye `[-3230,14,6879]` toward
`[-3230,14,6853]`, and the street terminal return from `[-3179,15,6775]` toward
`[-3205,15,6785]`. The root task owns bounded visual integration and release.

Five new Python tests and fifteen Bun tests across the new helper and retained
v182/v250/v251 contracts pass, as does scoped Ruff. They cover deterministic
generation, every previous payload hash, the
complete wall inventory, unchanged modern parts, exact obsolete-row ownership,
three tall historic window registers, the blank end, complete measured wall
attachment, native source-cell clearance, batch-prefix preservation and atomic
fallback after altered earlier data. Both actual drawn/native factories and
the actual v205 school batch are tested: the old panes are absent and each new
tall aperture appears once. The bounded orthographic comparison PNG is drawn
from the original and new model coordinates/materials; it confirms the changed
proportions, arch framing and blank return but is not a full 3D browser render.
