# Schools and courtyards v274

Seven explicitly requested places receive bounded architectural corrections.
The largest change is the missing copper upper envelope at Berlin Metropolitan
School. All five measured parts and every measured roof sheet above the existing
23.2 m display roof are included, with their pitches, setbacks and holes. This is
an upper-envelope addition; the earlier ground-floor prism and its details are
retained. The source footprint is 1,595.872 m² versus the retained coarse
footprint's 1,583.680 m²: 20.188 m² is source-only and 7.996 m² legacy-only. No
claim is made that the older lower shell is now a surveyed reconstruction.

| Place | Actual change | Protected / limits |
| --- | --- | --- |
| Berlin Metropolitan School | Five measured upper parts, 206 triangles, copper envelope and standing seams | Earlier lower floors and windows retained; seams/material hue are display estimates |
| Kastanienbaumgrundschule | Curved glazing completes the already modelled segmental heads; brick reveal edges on the main and front house openings | Existing four-level main register, three-level front register, doors and passage unchanged; unresolved coarse front-house height is not silently replaced |
| John-Lennon-Gymnasium | Missing shallow curved glass above the rectangular lower panes | Existing v250 complete four-level facade, round upper heads and three portals remain unchanged; no second window grid |
| Be Smart Academy, Torstraße 134 | Industrial opening lights, deeper jambs and projecting sills on the existing factory openings | Same window centres and levels, original brick frame, rooftop addition and lettering retained |
| Gymnasium Tiergarten | Window reveal edges and sill shadows across eligible measured modern facade sheets | Every sheet is selected from the complete thirteen-part source. Drawn and native use their own existing window spacing. Blue Aula, bronze Hand, old building and roof bodies unchanged |
| Choriner Höfe / Zehdenicker Straße | End supports and lower edges complete existing balcony/guardrail readings | Exact v250 rail members determine placement; all six source owners, authored windows, sculptural frames, historic neighbours and roof details remain |
| Kita Fürstenberger Straße 4/5 | Timber/glass upper group-room fronts and railing readings at the three measured recessed terraces; retained older wing gains floor edges | Complete L-shaped body remains. Four precise upper faces cover only 104 receipted earlier generic window-detail triangles; no new ground infill or replacement lower window grid |

## Identity and primary references

The requested daycare is **Kindergärten City, Fürstenberger Straße 4/5**. The
retained OSM context is way `28417249`; both measured parents
`DEBE01YYK000016B` and `DEBE01YYK00003HT` carry that exact address/context. The
[operator](https://www.kindergaertencity.de/fuerstenberger-str-4) identifies the
2011 extension and three terraces. The
[architect's project](https://anderhalten.com/projekte/kindertagesstatte-berlin-mitte)
describes the L-shaped composition, projecting entrance volume and alternating
upper group rooms/terraces. Timber cladding is additionally described by the
[published project captions](https://www.baunetzwissen.de/bauen-im-bestand/objekte/oeffentliche-gebaeude/kindertagesstaette-in-berlin-mitte-2559545/gallery-1/2).

The existing terrain offsets are **+10.31 m** for the long extension and
**+6.31 m** for the older transverse wing. New members follow those currently
delivered parent datums, with displayed bases 13.31 and 9.31 m respectively.
This difference has not been concealed or treated as a new surveyed floor
relationship. A separate terrain/placement correction would need to reconcile
the two parents with the surrounding existing ground.

Other references:

- [Sauerbruch Hutton: BMS](https://www.sauerbruchhutton.de/en/project/bms): copper-clad timber roof additions and courtyard composition.
- [TGW: Gymnasium Tiergarten](https://tgw-architekten.de/menzel-oberschule/): 2012 facade/window refurbishment.
- [Landesdenkmalamt: Kastanienbaum school](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035166): four-storey main school, separate three-storey director house and segmental window heads.
- [Landesdenkmalamt: John-Lennon school](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080444): exact school identity. The complete existing v250 facade/reference register is reused.
- [Be Smart Academy](https://besmartacademy.com/alte-seifenfabrik/ueberblick/): restored factory and rooftop addition.
- [Collignon: Choriner Höfe](https://www.collignonarchitektur.com/de/projekte/choriner-hoefe): layered street composition. The v250 Schiffer/HAAS/7A references and complete individual models continue unchanged.

Measured source vertices and identities determine placement. Small dimensions,
colours, mullion spacing and joinery remain proportional estimates. No photo,
video or texture is shipped. The internal browser was unavailable during this
pass; these checks are source/model checks, not a claim of browser visual QA.

## Construction and integration

`scripts/build_schools_courts_v274.py` reads immutable retained files and writes
only its dedicated runtime data, navigation and evidence. Runtime is
`SchoolsCourtsV274.ts`; call `appendSchoolsCourtsV274(root, native)` once at the
end of the existing `createSchoolsV185` factory, before its final freeze. There
are no new descriptors, animation callbacks, material textures or residency
settings. Seven site batches cull independently; the BMS measured drawn upper
shell has one additional mesh. Repeated append calls do not duplicate detail.

`schoolsCourtsV274Navigation.ts` exposes `SCHOOLS_COURTS_V274_UPPER_PARTS` and
`schoolsCourtsV274RoofAt`. Only the BMS upper parts affect navigation, beginning
at 23.2 m in the drawn model. `pedestrianNavigation.ts` now adds their five exact
source rings when the retained BMS prism `98765758` is present; **the old BMS
ground-floor prism is not suppressed**. Native navigation uses the exact union
of all 496 occupied roof-cell footprints and their independent 2 m cell tops,
including the block-stepped outer edges. Its existing constructed shell spans
22–32 m, while drawn sheets span 23.2–30.349 m. The live mode getter activates
only the corresponding upper representation. Both retain the open courtyard.
No filter changes are needed in IsometricCityWorld or MinecraftVoxelWorld;
the geometry is appended through the existing school factory. Other school
detail changes add no blockers.

Lennon and Choriner additions fail open when their existing v250 receipt fails.
All construction rows are local to the factory; no decoded arrays are attached
to the scene. The nested `boxes`/`nativeRows` construction fields and
`bmsUpperPositions` may use the existing weak JSON construction-field handling.
Navigation roof fields remain separately lazy as appropriate to the existing
navigation loader.

## Resource and verification result

- Runtime JSON: **297,963 bytes**, gzip **49,115 bytes**; navigation **15,345 bytes**.
- Drawn: **2,321** detail instances plus **206** measured upper triangles.
- Native: **5,371** independent orthogonal instances, including **1,052** BMS surface cells.
- Added geometry/instance attribute arrays: approximately **191,228 bytes drawn** / **408,196 bytes native**, before small shared box geometry/material overhead. No new budget ceiling is requested.
- Seven targeted Python tests passed: reproducible outputs, exact previous-file hashes, source-wall clipping, complete measured upper roofs, daycare identity and exact old-proxy receipts, preserved opening registers, native surface-only geometry and exact cell-union navigation.
- Nine Bun tests passed: exact factory counts, all native transforms orthogonal, full identical mobile detail, idempotent integration through both delivered school factories, measured/native roof queries and actual pedestrian compilation preserving the ground floor and open court across mode changes. Every native roof-cell centre was checked just below and above its represented top.
- Earlier school, city packet, source and model files remain byte-identical to the recorded receipts. No source geometry was removed.

Regenerate with `uv run --no-sync python scripts/build_schools_courts_v274.py`.
The scoped checks are `uv run --no-sync pytest tests/test_schools_courts_v274.py`
and, from `src/app`, `bun test tests/schools-courts-v274.test.ts tests/schools-courts-v274-navigation.test.ts`.
