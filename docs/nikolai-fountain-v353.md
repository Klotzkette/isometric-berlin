# Wappenbrunnen at Nikolaikirchplatz

The existing public fountain inventory locates the single official record
`berlin:zierbrunnen:ZB-MI-17` at world XZ `[2398.37, 298.91]`. Its blank generic
model field remains unchanged. A dedicated model now supplies the recognisable
fountain body, without adding another inventory point or a surrounding plaza.

The photographic reference is Jörg Kuhn, **Wappenbrunnen**, Bildhauerei in Berlin,
https://bildhauerei-in-berlin.de/bildwerk/wappenbrunnen-7845/ (accessed 2026-11-15).
The pictured exterior is credited to Detlev J. Pietzsch, 2009, CC BY 4.0.
No image pixels are distributed or used as textures. The record gives a 6 m
overall height, 1.7 m basin height and 4 m diameter. It identifies three octagonal
steps, eight sandstone panels and bowl-bearing piers, the central column and
seated bear with shield, and an open iron canopy with scrollwork and lily finial.
Gerhard Thieme created the sculpture; Hans-Joachim Kunsch the ironwork, 1987.

These major features inform the model. Unmeasured proportions, scroll patterns,
bear anatomy and heraldic reliefs are simplified display interpretations;
individual inscriptions and heraldic emblems are not claimed as exact copies.
The reference photograph is from 2009, not evidence of current water operation.
There is no animation or assumed seasonal operating state. Nearby benches,
trees, bollards and chains are outside this bounded change.

`NikolaiFountainV353.ts` creates one merged mesh/material only within 180 m and
only when the exact unchanged `4_0` packet hash for the active renderer family is
resident. The current source and public encoded hashes are equal. Both actual
production-decoded packets support the complete sampled 4 m base. The actual
resident-ground callback returns Y=3 and Y=3.09 where an existing path finish
crosses it; this was confirmed at all 81 samples in the final browser candidate.
Their building and water polygons do not intersect it. The controller permits
only that bounded 0.090001 m finish range and seats the base at the lowest
supported sample. Its first 15 cm step remains above both floors, without a
floating underside or any terrain modification. Missing, nonfinite,
blocked, wet or discontinuous support rejects or releases the model. Eighty-one
samples cover the full base envelope, not just its centre. There is no guessed
ground fallback or extra ground geometry.

Drawn uses an octagonal basin and thin polygonal ironwork. Native is built
independently from cardinal boxes; its 0.16 m inscribed base steps stay inside
the source diameter. Native triangles are tested for cardinality. The open
canopy is checked by downward ray coverage, and all emitted triangles are
finite and non-degenerate. The resulting geometry has 14,040 Drawn vertices /
19,872 indices (545,184 buffer bytes), and 30,936 Native vertices / 46,404 indices
(1,206,504 buffer bytes). No photographs, fonts or other texture allocations are
needed.

The existing PublicAmenities controller owns updates, collision and disposal.
Its 260 ms cadence, movement shortcuts and high-altitude release remain in use;
fountain admission/release runs before the movement shortcut so host eviction
cannot leave it behind. Renderer changes replace the previous family. Existing
model solids cannot reject their own floor during admission. The fountain's
180 m admission disk is disjoint from the three existing named memorial disks,
so that path still admits at most one such local mesh at a time. No runtime,
prefetch, transfer or city descriptor budget is raised.

Validation from `src/app`:

```sh
bun test tests/nikolai-fountain-v353.test.ts tests/public-amenities-v332.test.ts tests/named-graves-v347.test.ts --timeout 60000
```

All 19 tests pass, including current production decoding with both new church
and quarter recipes, the actual 81 browser floor samples, independent Native
path finishes, rejection of a larger finish range, negative admission,
stationary host invalidation, repeated refresh, family switching, collision,
owner visibility, high-altitude release, and exactly-once geometry/material
disposal. The module also passes a standalone strict TypeScript check.
