# Moabit memorial-park refinement — v1.0.57

Step 10 refines the present-day park; it does not reconstruct the demolished
prison. The separate guard-house refinement belongs to its own source-bound
building module.

## Sources and distinction from display geometry

The [Berlin park account](https://www.berlin.de/tourismus/parks-und-gaerten/4216129-1740419-geschichtspark-zellengefaengnis-moabit.html)
identifies hornbeam cell markers, blood-beech planting for the administration
building, the circular Panoptikum court, three entrances and three exercise-yard
readings. The earlier A-wing model incorrectly used the administration's
blood-beech colour and lacked the planted cell divisions. These are now green
hornbeam divisions around an open central passage. Their twelve display
intervals are not an inventory or measurement of surviving historic cells.

The [Landesdenkmalamt ensemble 09050274](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050274)
remains the monument identity. Berlin's [explanatory text](https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2459_zellengefaengnis-erlaeuterung.pdf)
credits Glaßer und Dagenbach with the park design. The protected landscape plan
is not traced, copied or bundled.

The court fill uses the 16 existing, DGM-draped vertices of OSM path
[`4676004`](https://www.openstreetmap.org/way/4676004), from the delivered
`park-details.json`. It fills only the circular interior with a thin compacted
surface, leaving the surrounding path and the rest of the park's existing
source-owned ground intact. The exact Panoptikum artwork remains unchanged.
Its finish is 0.12 m above the greater of the source vertex height and the
delivered smoothed terrain plateau (6.5 m). This clears the existing lawn's
0.06 m surface offset; the initial uncorrected fill was partly buried by it.
The triangles face upward, with the exact source X/Z boundary retained.

The continuous wall way `53178124` includes two current entrance nodes without
breaking its polyline. Previously its geometry and collision closed both
accesses. The crossing paths prove the openings:

| Entrance | Crossing OSM paths | World X / Y / Z |
|---|---|---|
| Invalidenstraße | `418943514`, `418943516` | −314.456 / 6.208 / −799.185 |
| Minna-Cauer-Straße | `1395160076`, `4676002` | −271.402 / 5.189 / −924.456 |

The wall source remains complete; the display now cuts 2.8 m access openings.
Local portal width, member sizes and height are non-surveyed display estimates.
Concrete frames use the photographed cantilever/lower-jamb motif; their gates
are presented open. Rendered solids and navigation use the same opening.
Only the two closed source envelopes `pF0000BJ` and `pF0000BI` are replaced
by this open gate in near/distant drawing and navigation. Their raw records
remain unchanged. The Minecraft replacement excludes only the one existing
coarse column whose centre is inside those exact source footprints; adjacent
columns and the retained cell are preserved.

Three freely licensed photographs by **Singlespeedfahrer**, taken 27 February
2023, are external visual references only, all under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/):

- [Berlin 14](https://commons.wikimedia.org/wiki/File:Geschichtspark_Ehemaliges_Zellengef%C3%A4ngnis_Moabit_Berlin_14.jpg): concrete entrance-frame form.
- [Berlin 17](https://commons.wikimedia.org/wiki/File:Geschichtspark_Ehemaliges_Zellengef%C3%A4ngnis_Moabit_Berlin_17.jpg): brick and inward whitewashed memorial band.
- [Berlin 18](https://commons.wikimedia.org/wiki/File:Geschichtspark_Ehemaliges_Zellengef%C3%A4ngnis_Moabit_Berlin_18.jpg): opposing wall view and park/guard-house relationship.

No photograph, text image, quotation or texture is reproduced. Sparse mortar
head joints improve the existing red-brick wall reading. The whitewash is an
inward-facing skin, not a replacement wall.

## Preservation and resource cost

The original `MOABIT_PRISON_PARK_SOURCE_PROFILE` is byte-identical to v1.0.56:
SHA-256 `4e3c04a812bca83ab2f9cd053a231702783f31676d02cb37bec2d0481a8ffdb8`.
It retains the complete park polygon and all 19 source wall segments, including
the explicit 4 m height for way `105495351`. The other 15 segments continue to
use the labelled 5 m display height. Gate clipping is cached once, so navigation
does not allocate or rebuild clipped wall segments while moving.

The retained cell `DEBE01AL2yz00000`, mapped paths, 175 existing source trees,
lights and playground remain owned by their prior layers. No source dataset,
catalogue, terrain file, camera, controller or loading policy changes here.
Snow adds reversible caps; drawn detail is identical on touch and pointer.
Schwellenraum protection and static presentation remain intact.

| Representation | Stored geometry bytes | Draw calls | Stored vertices / instances |
|---|---:|---:|---:|
| Drawn full and touch | 364,110 | 5 | 20,466 vertices |
| Native Minecraft full | 307,880 | 1 | 24 vertices / 4,040 instances |
| Native Minecraft mobile | 173,588 | 1 | 24 vertices / 2,273 instances |

Both native variants remain below the existing 4,200-block ceiling. There are
no per-frame allocations, textures, timers or added materials in this model.
The intentional geometry changes have v157 parity fixtures; older fixtures
remain frozen and every unrelated model must continue matching its prior hash.

## Validation

Seventeen focused tests cover source identities and all mapped wall anchors,
the unchanged source cell, snow reversibility, profile budgets, planted-cell
clearance and the exact circular court. New tests walk and ray-cast through
both corrected portals at three lateral positions in drawn and both native
models, then check that their overhead beams remain solid. The static parity
suite checks all vertices, colours, transforms and full/mobile equality.
Production-path regressions also include the actual delivered gate prisms,
coarse voxel payload and smoothed terrain: the old solid cannot close the
passage, and the upward-facing court stays above the existing lawn in all
four drawn/native profile combinations.
Whole-viewer screenshots and release checks are recorded in the release review.
