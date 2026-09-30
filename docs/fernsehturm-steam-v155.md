# Rose and blue Fernsehturm vapour — v1.0.55

Pipeline step 10. The authored Schwellenraum effect now has 96 steady wisps
and 48 burst wisps, distributed over eight vents and four intermittent fountain
origins. The jets are staggered within a 23-second episode. Two slow curls and
a small opacity oscillation create gentle drifting motion; a minority of wisps
are pale blue, fading through lavender toward the existing pale rose tint.
This is a fictional mode effect, not a depiction of real tower emissions.

The effect remains one draw call and 144 fixed quads. Its position, UV, index
and particle buffers occupy 2,396 bytes. Only the time uniform changes during
animation: no textures, new per-frame geometry or expanding particle pools.
The previous 30 Hz cap, offscreen and hidden-page pause, reduced-motion pause,
mode gating and lifecycle disposal remain unchanged. Larger conservative
bounds cover the taller jets, drift and every rotated billboard corner.

The focused tests check buffer identity, finite time, mode visibility, all
four burst origins, blue seed coverage and extreme displacement bounds.
Production browser validation is recorded in the release review.
