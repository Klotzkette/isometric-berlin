# Deutsches Theater and Kammerspiele refinement (step 10, v1.0.6)

The front of the Deutsches Theater now sits at the rear of its courtyard,
next to the real Kammerspiele. The former rendering put the theatre portico
on the street end of the eastern courtyard wing and mistook parts of the
main theatre for the Kammerspiele. This was a recognition-layer identity
error, not a discrepancy in the retained building survey.

## Evidence and source conflict

The committed Berlin LoD2 `buildings.gpkg` explicitly names two parents:

- `DEBE01YYK00002VR`: Deutsches Theater, 15 parts.
- `DEBE01YYK000037b`: Kammerspiele, 12 parts.

`deutschesTheaterPrisms.json` copies their 27 already-delivered prism records,
adding only each parent identifier. Every footprint, source height, base,
roof code and existing colour sample stays unchanged. No source is removed.
The earlier four-member “Kammerspiele” set (`TVjCvFcI`, `w0A6rPvQ`,
`KeeAYa8r`, `ixchshjg`) is part of the main-theatre parent. The 12-part
Kammerspiele parent had been left out of the recognition model entirely.

The [Landesdenkmalamt inventory, object 09011193](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011193)
documents the surviving 1850 core, the 1906 facade changes and the separate
1961 eastern cloakroom wing. The theatre's [current profile](https://www.deutschestheater.de/das-deutsche-theater/profil)
and [technical portal](https://www.deutschestheater.de/service/technikportal)
confirm the venue and current stage identities. They do not establish
surveyed exterior window dimensions.

For plan alignment, the official
[Berlin DOP 2025 spring orthophoto](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was downloaded and inspected, using layer `dop_2025`, EPSG:25833 and bounding
box `390180,5820540,390320,5820640` (1,800 × 1,286 pixels). It confirms the
courtyard and side-wing arrangement. This reference remains under `/tmp`;
no orthophoto is bundled or projected into the viewer.

Two directly inspected, freely licensed facade references are credited in
both Wikimedia manifests:

- Leonhard Lenz, [*Deutsches Theater Berlin 2024-05-09 01.jpg*](https://commons.wikimedia.org/wiki/File:Deutsches_Theater_Berlin_2024-05-09_01.jpg), 9 May 2024, [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- Leonhard Lenz, [*Deutsches Theater Berlin 2024-05-09 03.jpg*](https://commons.wikimedia.org/wiki/File:Deutsches_Theater_Berlin_2024-05-09_03.jpg), 9 May 2024, [CC0](https://creativecommons.org/publicdomain/zero/1.0/).

The intermediate second photograph in the same series was also inspected;
the first and third supply the retained references. Photographs are dated
visual evidence, not a claim to a September 2026 condition survey.

## Reconstructed visible architecture

The main portico follows the actual southern edge of `KeeAYa8r`, a 17.79 m
source strip. Its two tall arched openings, two smaller side bays, three
pilasters, layered entablature and triangular pediment are now ivory. The
right-hand two-storey annex is part of `TVjCvFcI`. `wZRgel5C` remains the
eastern courtyard/street wing and no longer carries a false main entrance
or theatre sign.

The real Kammerspiele has eight upper arched bays, with a four-bay central
risalit and two bays on either side. They occupy the eastern 23.15 m of
`yMkbzxqy`'s long southern source edge. This local width is a DOP/photo-guided
display subdivision, not an additional surveyed facade measurement. Its
shallow source risalit `Ns58PVF3` remains present; glazing and trim are
outside that retained solid. The pale sage wall, open lower shutters,
fanlights, individual iron balconies, three-line inscription and shallow
central gable follow the inspected photographs. The shallow entrance canopy
belongs to the Kammerspiele.

The built roof logo is a gold open **D enclosing T**, held by two vertical
posts, a horizontal tie and a diagonal brace. The main pediment retains the
distinct thin historic **DT ligature**. Both logos and the four inscription
lines are actual procedural stroke geometry, readable from outside the
courtyard. No canvas, image, font file, website campaign mark or facade
texture is loaded. The actual roof sign is not replaced with the theatre's
current promotional graphic identity.

The repeated exposed side windows, roof-edge brackets, twin courtyard
lanterns, four low corten planting beds and open gaps give the surrounding
parts a restrained continuation. Their subdivision, colour shades and small
projections are procedural display estimates. Existing source bodies retain
their measured sizes. The courtyard side-wing roof material is distinguished
from the main slate roofs.

## Modes, bounded geometry and validation

Day, Night, Snowstorm and Schwellenraum use the same drawn root and the
existing presentation material hooks. Mobile retains every facade bay and
all inscriptions, reducing shutter slats, railing diagonals, fanlight spokes
and curve subdivisions. Minecraft gets a separate single InstancedMesh with
stepped arches and contiguous block-stroke lettering. It retains the source
voxel bodies, projecting facade fragments to the outer skin of the actual
coarse cells, with a bounded 5.8 m search for their diagonal extent. All
fragments on each source wall move by the same offset, preserving the depth
order of painted wall, glazing and trim. It does
not attach a smooth facade double to the Minecraft scene.

Measured signature costs (source bodies excluded):

| Profile | Draw calls | Cube instances | Rendered vertices | Geometry/instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn full | 4 | 4,568 | 110,338 | 363,026 |
| Drawn mobile | 4 | 3,226 | 77,810 | 254,314 |
| Minecraft full | 1 | 3,340 | 80,160 | 254,488 |
| Minecraft mobile | 1 | 3,284 | 78,816 | 250,232 |

Ten focused tests check source equality and the two parents, the corrected
courtyard assignment, all four signature budgets, texture absence, logo
orientation, real outward triangle winding and the visibility of the ten
arched glazing fields against the retained LoD2 bodies. Twelve main/court
rectangular Minecraft panes are ray-tested against the actual retained
source cubes, together with all ten Minecraft arched glazing fields. The
first visible triangle must be glazing rather than the underlying painted
wall or source cube. The tests deliberately do not require rear windows to remain
visible through adjoining buildings. Source records are checked for mutation.

Actual Three.js triangles, instance matrices and colours were exported and
inspected in orthographic software renders from the courtyard and an
isometric angle. This is geometry QA, not a substitute for browser/device
interaction testing. `bun test tests/deutsches-theater.test.ts` passes all ten
tests (357 assertions); TypeScript compilation passes.
