# Mierendorffplatz and adjoining island fronts — v269

The user's Step10 continuation covers the existing **Mierendorffplatz in Charlottenburg**, separate from Moabit. This bounded addition improves the formal northern square, four mapped U7 stair entrances and 37 existing street fronts. It adds no district, descriptor, permanent root, tour stop, photographic texture, animation or runtime budget. Both drawn mobile and desktop receive identical detail; native geometry is independently orthogonal.

## Retained source and bounded scope

The complete existing v159 bodies, roof envelopes, roads, park paths, navigation owners, source lines and v188 windows remain. Thirty-seven existing v188 front records are selected only on Mierendorffplatz, Mierendorffstraße, Brahestraße, Osnabrücker Straße, Sömmeringstraße and Kaiserin-Augusta-Allee within world bounds `[-4770,-1060,-4260,-620]`. Exact complete records, native spans and all 37 owner IDs are in the evidence and runtime profile. Ordinary geometry joins the original `-10_-3`, `-10_-2` and `-9_-2` packets. It does not alter the neighbouring Moabit work.

The original v188 window grids remain visible. Every new projecting sill/upper reveal first matches an actual delivered old pane and its complete original wall plane. No new window grid, building paint, lower shopfront or doorway is inferred. Drawn adds relief to865 retained panes on all37 selected fronts. Native independently matches242 retained panes on18 fronts; the other19 lack a complete matching exposed native pane/wall span and keep their existing geometry unchanged. Native details follow its own retained cardinal panes. These small sections and neutral finishes are display estimates, not measured facade openings. Existing lower entrances and shops are avoided by keeping these additions above the ground-floor band.

Public identity and recognition references are in [the reference ledger](mierendorff-v269-references.json). The district documents Erwin Barth's garden and the distinct southern market area. A dated district exterior photograph was visually inspected for the low granite basin, static central jet and pale benches. Its 2012 date is retained; it is not a 2026 appearance survey. No photograph, protected garden plan or market stall layout is bundled.

## Fountain, furniture and delivered ground

The basin follows the complete mapped perimeter **OSM way4763943**, with a 0.38m estimated granite rim, recessed water and one static jet. The bowl's interior remains open in collision; only the represented rim is solid. All14 added benches follow actual retained bench nodes inside **park way4763942**. Bench dimensions and orientation are labelled display estimates. The playground and southern market remain unchanged; no speculative hedge outline or invented plant bed is added.

The original packet ground datum is **y=3**, outside the resident core terrain. Delivered park/path surfaces reach **y=3.12**; the fittings enter those surfaces. Stair heads use y3.12, with the existing source ground and roads left unchanged around their mouths. This datum is tested against actual decoded source triangles, not a guessed core height.

## Four open U7 stair mouths

The exact entrance/first-flight pairs are:

| Stair way | Entrance node | Retained step count |
|---|---|---:|
| 516635740 | 496396432 | untagged; display estimate 24 |
| 516635754 | 437301322 | 28 |
| 767953643 | 496396431 | 24 |
| 516635753 | 437301323 | untagged; display estimate 24 |

Every complete mapped axis remains in the context. Clear width2.5m, step rise0.16m, terminal landing1.1m, retaining-wall sections and the simple blue U markers are explicit display estimates. Both families have actual descending treads, a bottom landing and three retaining sides; their upper approaches remain open. Native uses independent 0.25m occupied-cell footprints. No underground platform, tunnel connection, elevator or claimed complete historical portal reconstruction is added. The BVG's current staged renovation is recorded without inventing temporary construction barriers.

Each actual tread carries a coplanar3.5cm dark edge accent and contrasting vertical sheets. These neutral tones are display conventions, not surveyed stair paint. They keep the descending rhythm legible in the unlit drawn material: the initial near-identical wall/tread tones visually merged into a closed grey block despite correct open geometry. Both original overlapping packets were rechecked for a higher entrance proxy; none exists, so no additional source object is retired. The closer axis-aligned QA view sees26 of29 drawn and25 of29 native tread centres directly through both real packets.

All delivered horizontal source triangles crossing the four openings are identified by exact original mesh fingerprint and triangle index. Their **complete outside complements retain the same height and encoded colour**. The only retiring triangles are these receipted ground fragments. The complete original mesh and individual original triangles remain evidence; unrelated triangles, all source buildings and every line survive unchanged. Both actual overlapping descriptors, `-9_-2` and `district188--9_-2`, were checked in each representation. No second ground layer remains across an opening. The final mouth follows the centimetre-quantized union of actual tread edges to avoid rounding gaps along oblique drawn stair sides.

## Integration, lifetime and memory

`src/app/src/MierendorffV269.ts` exports four packet-bound hooks:

1. `prepareMierendorffV269(chunk,id,native)` runs after previous immutable preparers. It checks original mesh/nav guards, complete required structure fingerprints, bounds and unchanged packet limits, preserving prior additive meshes by identity.
2. `applyMierendorffTrianglesV269(chunk,meshIndex,indices,indexOffset)` retires only the exact original ground indices after their complete required complement has been admitted. It never edits source encoded streams.
3. `mierendorffNavigationV269(chunk,nav)` appends represented rim/retaining-wall solids and local tread polygons. Original source owners and ground-membership polygons remain unchanged.
4. `mierendorffFloorAtV269(nav,localX,localZ)` belongs in `SurroundingCity.groundAt` before the existing bridge-floor query. It returns only represented local tread heights; ordinary source-ground membership still selects the same resident tile.

There is no new global stair index or permanent scene group. Packet publication, cancellation, eviction and mode changes own both geometry and navigation. Runtime data remains encoded recipes/source structures; only a resident selected packet decodes geometry. Existing16-mesh,400,000-vertex and2,400,000-index limits are unchanged. New detail counts: **1,806 drawn boxes /560 native boxes**, plus **2,547 drawn /12,811 native structural triangles**. The four openings transfer117 original ground triangles across both families. Runtime JSON is704,696bytes; frozen OSM context is2,186bytes compressed.

## Checks and QA

Five focused Python tests verify immutable packet hashes, complete original wall records, narrow ground transfers and their full same-height/same-colour outside areas, actual horizontal tread support, complete mouth coverage, orthogonal native geometry and unchanged packet limits. Four Bun tests (3,162 assertions) use the integrated production decoder and rendered ray hits at every tread. The additional perspective test loads both real packets, checks direct oblique visibility of at least24 tread centres in each mode and verifies contrasting coplanar edges at every tread level. The actual `createSurroundingCity` loader loads both overlapping descriptors in both manifest orders and both modes. All four stairs descend to their bottom landing and return to the pavement using the real movement controller at16/50/100ms frames. Disposal returns geometry bytes and navigation residency to zero.

Camera eye-to-target checks use actual nearby building rings/heights in both families. Review full context with base packets `-9_-2`, `-10_-2`, `-9_-3`, `-10_-3` and their existing district companions. Generated `cameraQA` in the evidence gives exact tested cameras. Root owns browser inspection, shared compiler/build and release; this subtask launches no browser or compiler.

Reproduce the frozen receipt with `uv run --no-sync python -m scripts.build_mierendorff_v269`. Add `--extract` only to reread the narrowly selected retained PBF source. Test with `uv run --no-sync pytest tests/test_mierendorff_v269.py -q` and `bun test src/app/tests/mierendorff-v269.test.ts`.
