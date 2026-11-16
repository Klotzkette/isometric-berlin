# Hauptbahnhof north-side tower duplicate — V354

The user identified a second DB ventilation tower on Europaplatz. Only the real tower on the south side at Washingtonplatz should remain.

## Exact erroneous owner

The source was `ArchitecturalLandmarks.ts:addStationDbPylon`, instantiated once inside `hauptbahnhof-model`. Despite its Washingtonplatz labels, its centre was station-local **(-51, -97.4)**. Applying the unchanged station anchor **(-119.936, 4.575, -683.307)** and rotation **21.82°** placed it at world **(-203.485, -754.773)**. The scene declares world Z positive south: this was a false **north-side** copy. V349 improved its glass finish without noticing this pre-existing placement error.

V354 removes that one authored construction call and its wholly unused tower/DB-badge construction helpers. It removes the false copy's three infill walls, frames, braces, three logos, plinth and antenna together. It does not remove objects by a broad area, height, colour or name match at runtime. The historical official-dimension profile and independently tested V349 finish utility remain evidence; they no longer instantiate a tower. Their obsolete viewer-wide rebinding and automatic mode-inheritance hooks are removed, eliminating the redundant scene traversal. The DB-badge texture recipe is reused solely for three small signs attached to the real south source wall faces.

## Real south owner retained

The unchanged `src/app/public/mesh/regierungsviertel/lod2-prisms.json` record **dKfobOID** is the actual south tower. Its source ring spans X **-174.5 to -161.9 m**, Z **-632.0 to -620.1 m**, with base **5.0 m** and source height **62.2 m**. No source vertex, height, material class or roof code changes. Its corresponding existing Native source columns remain outside the station's replacement footprint. Native never constructed the erroneous additional pylon.

The [DB S-Bahn access record](https://sbahn.berlin/fahren/bahnhofsuebersicht/hauptbahnhof/) distinguishes Europaplatz/Nord from Washingtonplatz/Süd. The [structural engineer's account](https://www.sbp.de/projekt/berlin-hauptbahnhof-abluftkamin/) documents the real 60 m steel structure and triangular glass-block walls. The engineering height and the LoD2 total source height use different source descriptions; this correction does not alter either to force an artificial match.

## DB signs on the real tower

The existing source body has no lettering. Three small signs are therefore anchored to its exact long footprint edges (source edge indices 2, 7 and 12), with an outward 20 cm presentation offset. The former filled geometric DB glyph recipe is reused, preserving the white field/red frame and letters, including night presentation. Badge height 57.8 m and size 4.25 × 2.75 m are photo-informed display estimates. The source glass body is unchanged; it is not repainted as stone.

Native adds 84 independently constructed cardinal white/red badge blocks to its existing station batch. These attach to the exposed faces of the five retained source columns, rather than copying angled Drawn sign planes. The narrow western block face uses a proportionally narrower sign. This is an explicit Native presentation approximation, with no new tower, no altered source columns, no additional Native draw call and unchanged palette. All mobile and desktop variants retain the full badges.

## Preservation and checks

Both entrance openings, walking/flight routes, escalators, lifts, station halls, office bridges, rooftop panels, surrounding buildings and source data remain unchanged. The removal substantially reduces Drawn tower geometry; the retained sign texture now serves only three south-side sign planes. Native adds its bounded 84 badge instances to an existing batch. No additional fetch, controller, timer, residency allowance or startup gate is introduced. Existing budgets remain unchanged.

Focused checks verify that the station creates no authored pylon component, the complete south-source record remains byte-for-byte identical to its pinned record, Drawn still admits that source, Native replacement does not claim its footprint, and existing high Native source columns remain. Existing Hauptbahnhof construction checks continue to protect the station's other details.
