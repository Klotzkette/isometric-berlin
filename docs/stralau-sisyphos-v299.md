# Stralau, Osthafen and Sisyphos — v299

The update adds the actual Stralau peninsula and its western neck, a finite band of mapped shoreline water and marina piers, and the separate Sisyphos site at Hauptstraße 15 in Rummelsburg. The new-only area is 533,761.173 m² across nine 512 m streaming tile pairs. Sisyphos is not relocated to Stralau. No surrounding Rummelsburg neighbourhood, artificial waterfront subdivision, tour stop or animation timer is introduced.

## Source preservation

`stralau-sisyphos-v299-source.json.gz` retains 347 complete official LoD2 parent buildings, 1,065 original leaf parts, their measured wall/roof sheets, original part rings and eight courtyard holes. Six official archive hashes and the three OSM input receipts are included. Of these source parts, 1,015 intersect the new-only scope; several additional western owners supply details for already published Stralauer Allee/Osthafen bodies. The exact new area subtracts the first 335 previous outer-city footprint records and the separately owned core. The new bounds are recorded independently in `bounds-stralau-v299.geojson`.

The drawn new packets triangulate the retained measured roof and wall sheets offline, including exact clipping at earlier owners. A complete parent receives one rigid vertical alignment to the existing outer-city display ground at y=3. The source's original heights and sheets remain in evidence. This datum is an unsurveyed display level, not a newly surveyed terrain claim. Source water remains at y=-1.15; park, road, path and rail surfaces retain their OSM geometries and actual open gaps.

The independent native family uses the established two-metre outer-city footprint cells and height reading. Where an exact earlier-coverage or club-parcel boundary cuts one of these cells, only the affected building seam uses fully covered 0.1 m cardinal cells. This stays inside the actual owner boundary; it introduces no diagonal native sides or overlap with previous owners. Original LoD2 curves, inclined roofs and fine boundary geometry remain in source evidence and the drawn interpretation. This is a native architectural interpretation, not a claim that every native roof reproduces every measured slope.

The seam correction changes geometry in two new native tiles. Regenerating the complete finite supplement also produces tiny native serialization changes in six other new tiles. All eighteen final asset hashes and descriptors are therefore taken from the regenerated supplement, rather than assuming that only the two larger file changes need copying. The four previously published tile pairs are outside this regeneration and remain byte-identical.

## Recognisable details

Source-bound facade plans cover the Palmkernölspeicher, Flaschenturm, Dorfkirche, Glashütte and eight mapped Osthafen/Stralauer Allee owners. Windows fit the individual measured wall profiles rather than an invented full-height rectangular curtain. The model includes Palmkern arched heads, the Flaschenturm's concrete courses, Glashütte frame members and the church tower's clock and bell louvres. Bay subdivisions, colour readings and small fittings are explicitly estimated from references; they are not survey measurements.

Sisyphos uses its exact mapped gate node `11100819930`, at world XZ `[8054.054, 3046.112]`, and the actual OSM site `148829988`. The existing industrial source roofs and open court remain. The street frontage gains the red/cream rhythm, arched name banner, radial gate ironwork and two opposing duck silhouettes built from geometry. The official operator is Sisyphos Event GmbH. Programme-dependent opening is described without a permanent 24/7 claim.

Citymarina's mapped piers and posts are placed on the actual water. Three small floating-apartment interpretations correspond to the operator-confirmed public fleet; their individual berth offsets and shapes are estimates from its public plan and the 2025 aerial reference. No private resident or permanent individual berth occupancy is asserted. A separate mapped public barge, OSM `1312237093`, remains unnamed because a current tenant could not be independently confirmed. Its hull, deck, cabin, glazing and rails follow the mapped barge axis. No boats are distributed arbitrarily across the river.

Visible timber deck tops are y=-0.42 and mapped marina pier deck tops y=-0.49, above source water y=-1.15. The same offline slab footprints produce navigation floors. Hulls, cabins, roofs, rails, gate members and pier posts produce matching solid intervals. Existing ground, water, roads, source buildings and previous navigation complements remain intact. The old Glashütte passage interpretation is retained; this update does not claim to reconstruct an additional walk-through passage beneath it.

## Bounded runtime integration

The nine static base pairs total 1,704,202 bytes, plus the 5,260-byte source inventory. The additive recipe has 18 finite plans: five new tile pairs need details, while four previously published tile pairs receive only source-owned facade additions. Those four existing pairs are never rewritten. The complete authoring models have 13,203 drawn and 31,674 independent native rows, identical on touch and desktop.

Production imports only `StralauSisyphosV299Packets.ts`. Its `packets` construction field uses the existing weak construction-data policy; the authoring factory and source facade JSON must not be imported into the main or worker runtime graph. The final recipe is 4,567,135 JSON bytes / 445,038 gzip bytes. Centres and dimensions were shortened only when all eight encoded centimetre corners stayed byte-identical; each plan includes an independent SHA-256 corner proof in the integration receipt. Edge complements are already triangulated offline. There is no runtime voxelization or triangulation.

Integration has two phases, deliberately separated around retained preparers:

1. `captureStralauSisyphosV299(rawChunk, id, native, true)` validates the complete original navigation, all encoded source meshes, line data and exact origin, without mutation. Its returned finite private closure owns one admitted recipe only during that serial tile preparation.
2. After every earlier preparer, `prepareStralauSisyphosV299(preparedChunk, ticket)` verifies that every admitted original mesh still remains and appends the full detail complement and its matching navigation. Missing/foreign/changed input, missing ticket or repeated preparation leaves the existing prepared object intact.

Hashing, validation and box decoding yield in bounded batches. Existing limits remain 20,000 recipe boxes per plan, 400,000 vertices, 2,400,000 indices and 16 meshes per decoded packet. Scratch typed buffers are released after encoding; no global receipt cache or persistent second city model is added. Construction and publication use the existing tile admission, decode, cancellation and disposal lifetime.

## Regeneration and verification

Run `uv run python scripts/build_stralau_sisyphos_v299.py` against the ignored frozen pre-v299 `raw/stralau-v299/baseline-manifest.json`, the six named official archives and exact OSM extracts. Never use an already integrated manifest as a fresh baseline: that would subtract the supplement from itself. The builder freezes the pre-integration manifest on its first run. Then, from `src/app`, export the authoring rows with `bun run scripts/export_stralau_v299.ts`; prepare recipes from the repository root with `uv run python scripts/build_stralau_sisyphos_v299.py --prepare-recipes`; finally run `bun run scripts/export_stralau_v299.ts --hash-recipes` once to hash the original navigation in JavaScript's exact JSON representation and remove that temporary construction copy.

Root-owned integration copies the finite base assets, appends the isolated manifest/scope delta, and installs the two runtime hooks. No shared manifest, coverage, runtime limits or public assets are changed by the builder itself. `--bake-details` is an authoring comparison path only and is not used for production publication.

`src/app/tests/stralau-sisyphos-v299.test.ts` checks complete touch parity, native matrices, all 18 admission receipts, retained preparer complements, invalid-source rejection, exact centimetre corner identity, current decoder caps and represented boat/pier floor heights. `tests/test_stralau_sisyphos_v299.py` checks exact old/new separation, complete original parent/part/wall ownership, all nine published packet receipts and every native base triangle. Full build, browser and release checks remain root-owned.

Sources and image credits are listed in [the reference ledger](stralau-sisyphos-v299-references.json). Photos and plans are inspection references only; no external photo, plan pixels, logos or new textures are packaged.
