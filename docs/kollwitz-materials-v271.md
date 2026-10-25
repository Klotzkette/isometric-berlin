# Step 10 — Kollwitz and northern Kastanienallee house materials

This is the complementary Kollwitzkiez part of the owner's v271 request. The
supplied densely detailed dark screenshots primarily show the older Weinberg,
Zion and Arkonaplatz source layer; that layer is handled independently by the
north-Mitte correction. This file addresses the additionally named Kollwitzplatz
surroundings and does not claim those screenshots depict Kollwitzplatz.

The retained OSM park way **24638848** places Kollwitzplatz at viewer centroid
**[3138.632, -1862.148]**, with bounds
**[3076.018, -1905.899, 3201.619, -1791.616]**. Its real existing streets, trees,
park, sculpture and earlier public-space details remain untouched.

## Diagnosis and finite scope

The ordinary `city` shell already receives v262's restrained palette, but that
runtime lookup needs a unique owner at each centimetre XZ corner. In these six
legacy packets, **2,110 drawn and 2,559 native** vertices can be attributed to
complete original source faces but cannot be attributed by that corner-only
lookup. They therefore retained the old generic wall/cap paint. None of these
six packets has a v263 corner-repair recipe.

The finite correction stays inside the existing v209 Kollwitzkiez rectangle
`[2850, -2450, 3700, -1610]` and a narrow source-bound northern Kastanienallee
corridor, in original packets `5_-5`, `5_-4`, `6_-5`, `6_-4`,
`7_-5` and `7_-4`. **433 ordinary source owners** receive coherent per-owner
fallback wall/cap colours. Independent post-rejection face ownership recounting
confirms these are changed owners rather than preliminary candidates.

**421** have a unique reciprocal **97% or greater** complete footprint match to
retained unnamed ordinary OSM housing. The other **12** use an already verified
ordinary v188/v209 street-front identity. Complete owner unions must remain
inside the finite scope; no rectangle is filled with new geometry. Any meaningful
intersection with a non-ordinary or material-tagged source building is excluded.

The twelve light plaster swatches and eight darker roof/cap swatches are
**display estimates for unknown paint**, not a claim that the individual houses
were surveyed or repainted in those exact colours. Ivory, ochre, muted rose,
sage and cool stone distinguish existing buildings without bright rainbow paint.
Source IDs choose the same colour across packet boundaries. No pitched roof,
roof covering, new window or storey is inferred from its colour.

## Northern Kastanienallee gap

The completeness check found that the northern street changes from the detailed
`alt-mitte-v169` layer into original `city` bodies in `5_-4` / `5_-5`, outside
the former Kollwitz rectangle. Nine exact retained named OSM ways describe
**478.839 m** of this course, from the x=2560 source boundary to the
Eberswalder/Oderberger junction. Their IDs and complete clipped courses are
retained in the context/evidence.

The addition admits complete ordinary owners approaching that road within
**25 m**, provided the whole source owner stays within **75 m** of the course.
This is a building selection, not a new rectangular area or clipped wall paint.
The original **408 Kollwitzkiez owners** remain; **25 northern Kastanienallee
owners** are added, including all **19** existing verified v209 street fronts.
These are drawn-mode changes. The independent native proof changes **204**
owners overall, including **9** of the 25 northern additions; the other 16
native owners remain unchanged where the primitive ownership proof is ambiguous.

Seventeen of those fronts were also mentioned by the v254 shop-window recipes.
Those recipes own only glazing, frame and sill geometry, not the generic house
paint. Their Kastanienallee IDs therefore do not alone protect the body paint;
any independent authored or mapped-material evidence still does. All v254 shop
fittings and the four drawn/native kiez209 packets remain hash-identical, with
explicit preservation receipts. The new road-gap test verifies all nine source
courses and all nineteen preserved front identities.

## Preservation and implementation

Exact original generic wall/cap triangles are joined to complete source navigation
owners. All incident triangles must agree; the existing connected-face rejection
keeps unsafe shared faces unchanged. Authored owners, named landmarks and recorded
v232/v254/v263 materials remain protected. This includes the existing Wasserturm,
Rykestraße synagogue, Kulturbrauerei and other dedicated models. **166** changed
ordinary owners have earlier v188/v209 facade fittings: those fittings remain
byte-for-byte intact, while only the underlying generic shell paint changes.

`applyKollwitzMaterialsV271` uses the existing bounded v213/v232 destination-colour
writer. It changes **8,274 drawn / 9,060 independently native colour vertices**.
All original source positions, indices, lines, colours, navigation and public
packet bytes remain immutable. Runtime source fingerprints reject changed inputs;
complete bounds and palette validation occurs before the first write. A tiny eager
twelve-key index rejects unrelated packets before reading the receipt graph.

The runtime recipe is **24,954 bytes** plus its tiny index. It adds no geometry,
GPU buffer, draw call, texture, descriptor, animation or residency allowance.
Full drawn desktop/mobile detail is identical. Native geometry and its flat
material reading remain independent; drawn walls retain the existing grounding
wash. All previous roofs, openings, public-space voids and collision remain.

The committed bounded context and evidence contain the complete source matches,
packet hashes, changed-owner inventory, exclusion inventory, palette estimates,
source-role receipts and corner diagnosis. Retained OSM (ODbL-1.0) and Berlin LoD2
(dl-de/zero-2-0) notices continue to apply; no external photograph is bundled or
sampled as paint.

## Checks

Four focused Python checks pass: complete ordinary-owner evidence and exclusions,
all original packet hashes and exact source-face receipt replay, disjointness
from every prior explicit material receipt, and the exact northern street course
with its nineteen preserved facade owners. Four focused Bun checks pass for
all twelve packet families: every position and non-receipted colour cell is
unchanged; source/navigation immutability; repeated application; rejection of
changed geometry, foreign tiles, wrong family and old facade companions;
atomic failure of an invalid final range; and an unrelated-tile check that never
reads the receipt graph. Scoped Ruff format and lint pass.
The parent task performs integrated browser and release checks.

Suggested internal-browser framing: eye `[3300, 160, -1490]`, target
`[3139, 12, -1862]`. Include the retained main-world park/trees as well as the
primary packet family and `kiez209` companions. Danziger front companions lie
on the northern edge, not at the park's southern frontage.
