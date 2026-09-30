# Leipziger Platz perimeter, v1.0.51

Pipeline step 10. `LeipzigerPerimeterFacades.ts` adds distinct square-facing
window, reveal and frame relief to the twelve perimeter source profiles that are separate
from the Mall/Voss detail module. `leipzigerPerimeterProfile.ts` derives each run
from an actual retained LoD2 WallSurface; no new façade bounding rectangles,
solid courts, terraces or replacement roofs are created.

The source module retains all 64 parts in these twelve profiles, including the two
southern parents that were previously absent from the detailed supplement. The
87 eligible wall runs have their original metric endpoints and one rigid
parent ground translation. Two separately identified official LP7 façade strips, `DEBE01YYK0001yp5` and
`DEBE00YY1Yq0005f`, remain complete and carry their own frontmost window relief.
A browser raycast identified these projecting planes over the main LP7 parent;
they are retained source data, not discarded duplicate boxes.
The roof-only canopy `DEBE3DP5ii5cXk3Q` receives no
opaque wall. Windows hidden behind another retained solid are excluded from
this additive relief pass; the underlying complete source solids are unchanged.

## Appearance and evidence

The modern Mosse-Palais keeps warm stone bands, grouped glazed openings, thin
mullions and its retained curved central source roof. LP1–3 are distinguished
as a vertical Torhaus, a limestone Stadtpalais with wide reveals and a narrow
Kontorhaus with bronze/dark-glass fields. TRION receives a deep grid and tall
base glazing. Classicon is assigned to the correct southern-eastern parent,
verified using the official Spionagemuseum address at Leipziger Platz 9. Its
horizontal glass/bronze reading is separate from the southern stone façades.
The eastern corner has pale stone frames, broad lower windows and narrower
upper bays; the adjacent chamfer receives projecting rectangular frames.

Published material/building facts are distinguished from estimated visual
subdivisions. Window sizes, floor pitches and exact colours are conservative
procedural interpretation, not a survey. Unverified tenants are left unnamed;
no invented signs, transient adverts or seasonal lighting are added. Primary
links and all four licensed reference photographs are recorded in
`leipziger-perimeter-v151-sources.json`. Photos are external-only references.

## Performance and preservation

All four drawn modes and both device classes share this full static detail.
Minecraft has its own chunky, box-native relief over the retained native source
body. Neither representation changes source shell or road coverage. Each uses
one instanced draw call, 8,802 cubes and 668,952 bytes of instance matrices and
colours, plus one 24-vertex cube. There are no textures, animated allocations,
per-frame geometry rebuilds or new light sources. Static transforms are frozen.
The native layer has a small outward relief offset to clear voxel cell edges;
it does not move the underlying metric source body.

Focused validation: `bun test src/app/tests/leipziger-perimeter-v151.test.ts`
checks every run's endpoint against its exact source wall, twelve-profile coverage,
canopy exclusion, source immutability, finite frozen transforms, a sub-950-KB
instance budget and separate native flags. The complete TypeScript project
passes `bun --bun tsc -b`. Root integration supplies viewer screenshot QA and
repository-wide checks before release.
