# Step 10 v281 — Charlottenburg parterre and Chancellery Ehrenhof

This bounded continuation remains inside existing coverage. No original building,
roof, park, path, tree or water packet is changed. Full drawn/mobile detail is
identical; Minecraft uses its own cardinal geometry. No new root, descriptor,
texture, frame loop or city residency allowance is introduced.

## Schlossgarten Charlottenburg

The existing v183 site already carries its full OSM ground/path/water courses
and measured palace/cupola. The ordinary outer exporter does not submit
`barrier=hedge` lines; the core ParkDetails inventory has none of the nine
Charlottenburg hedge IDs below. The addition therefore fills a proved missing
layer without covering the park with a generic formal-garden rectangle.

The retained `raw/city-v183/candidate.gpkg`, prepared from the 29 September 2026
Berlin Geofabrik extract, supplies these complete lines:
`18116333`, `18116334`, `18116335`, `18116336`, `18116343`, `18116348`,
`18116350`, `18116351`, `18116352`. All nine explicitly carry `height=0.3`.
The fountain is the distinct water polygon **way/18116338**, not nearby garden
way/18116353. The compact runtime source retains all **249 vertices** across
these ten features, projected to EPSG:25833 and rounded to 1 mm for stable
transforms. It also records each original WKB SHA-256 and vertex count. This
numerical precision does not claim millimetre OSM accuracy.

Hedge widths (0.48 m), basin coping (0.38 m wide / 0.24 m high), the static
central 5.4 m jet and four smaller 3.5 m jets are explicit display estimates.
No seasonal flower scheme or unmapped individual tree is invented. Ground
remains at the existing v183 presentation Y=3.0, with hedge feet at the
delivered park surface Y=3.01. This is not a new DGM survey.

The generic outer exporter places all water at Y=-1.15. For this exact small
ornamental fountain that would be 4.15 m below its surrounding garden. A shallow
water interpretation at Y=3.06 uses **six triangles on the complete mapped
octagon** in the existing opaque surface batch. The original source water sheet
remains unchanged; this interpretation does not apply to Karpfenteich or Spree.
The independent native water uses only wholly contained 2 m cells. Water level,
rim size and jet height are estimates; no dynamic fountain simulation is claimed.

The drawn addition has **244 instances + 6 triangles**. Native has **1,100
cardinal instances**, including independent short hedge strips, coping, jets and
the shallow basin. These append to the existing `JusticePalaceV183` and
`MinecraftJusticePalaceV183` batches; there is no additional draw call. All older
source arrays, including previous Littenstraße fittings, remain byte-for-byte.

Sources checked 28 October 2026:

- [SPSG garden account](https://www.spsg.de/schloesser-gaerten/objekt/schlossgarten-charlottenburg/): baroque garden beside the palace, retained English landscape garden and distinct garden buildings.
- [SPSG accessible route](https://www.spsg.de/schloesser-gaerten/blinde-sehbehinderte-schlossgarten-charlottenburg/): actual hedges, parterre, paths and Karpfenteich relationship.
- [Berlin district/public garden account](https://www.berlin.de/tourismus/parks-und-gaerten/3560428-1740419-schlosspark-charlottenburg.html): central axis, low hedge broderies and fountain.
- [OSM hedge way/18116333](https://www.openstreetmap.org/way/18116333), [basin way/18116338](https://www.openstreetmap.org/way/18116338). Public web retrieval was unavailable; metric evidence comes from the already retained extract, not an invented current OSM response.

No SPSG map, protected garden plan or photograph is traced or bundled.

## Bundeskanzleramt entrance

The earlier `ChancelleryEntranceProfile` already has a DGM-grounded 3 m grille
between the source office wings, flat steel blades, open gaps and ten DOP-derived
lawn outlines. The run at local X=170.429 crosses several of those grass islands,
as requested. These details and all source architecture remain unchanged.

The definite error was the artwork: two straight posts and four crossbars sat
on a large invented stone plinth. Stored credited reference photographs show
curved square-section iron arms directly on a lobed grass island. The native
building batch previously contained no Chillida sculpture at all.

`ChancelleryForecourtV281` replaces only these exact authored names:

- `Eduardo Chillida Berlin sculpture plinth`
- `Eduardo Chillida Berlin vertical steel body` (two)
- `Eduardo Chillida Berlin interlocking arm` (four)

Retirement is guarded by the exact delivered model anchor
`[-220.236,1.554,-145.806]`, rotation -1.337°, artwork offset
`[158.413,0,-7.51]` and published height 5.5 m. Any changed signature retains
the old complete fallback. No measured source owner or source sheet is retired.
OSM **node/4329873408** remains the metric artwork anchor.

The independent procedural sculpture keeps two grounded feet, bent arms,
open central/lower spaces and an overall height of **5.5 m**, without an extra
stone plinth. Width, depth, arm curves, colour and the small missing grass island
are photo-guided estimates, not a scan or an exact reproduction. A new 650×550
official DOP reference at `[389400,5820115,389465,5820170]` confirmed the site,
but lean/shadow from the building obscures the sculpture island. The island is
therefore explicitly **not** labelled as a DOP trace. Its two small lobes follow
the inspected photographs around the unchanged OSM anchor.

Native adds **15 separately authored cardinal iron blocks and 9 lawn strips**,
with the final refinement narrowing the crossbars while retaining those counts.
Three front-view rays at local `(u,y)` = `(-.75,4.25)`, `(1.05,4.25)` and
`(.4,2.95)` remain clear through every depth course, verified by the focused test.
The sculpture remains centred at the same world anchor. It neither samples the drawn mesh nor rotates
boxes with the building. Total architectural instances remain **5,494**, below
the unchanged **5,500** limit. There are no coplanar top-face overlaps. Full and
mobile use identical additions. No walking controller or source collision is
changed by this visual refinement.

Sources checked 28 October 2026:

- [BBR Museum der 1000 Orte — Eduardo Chillida: Berlin](https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/berlin): 5.5 m iron sculpture, paired piers/arms, moved to its grass island in 2002. Artwork © Eduardo Chillida / rights holders. This is an independently authored simplified recognition model.
- [Bundesregierung — Ehrenhof](https://www.bundesregierung.de/breg-de/bundesregierung/bundeskanzleramt/bundeskanzleramt-mit-ehrenhof-975026): site/public reference, photograph credited RegierungOnline/Krünkelfeld.
- Existing inspected [Sebastian Bergmann, Bundeskanzleramt Berlin 3](https://commons.wikimedia.org/wiki/File:Bundeskanzleramt_Berlin_3.jpg), CC BY-SA 2.0, and [Norbert Nagel, Bundeskanzleramt … 08](https://commons.wikimedia.org/wiki/File:Bundeskanzleramt_-_Berlin_-_Deutschland_-_Germany_-_08.jpg), CC BY-SA 3.0. Both already have packaged per-file attribution; no new photograph or texture is distributed.
- [Official Berlin DOP spring 2025](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr), layer `dop_2025`, dl-de/zero-2-0, reference only. The old lawn source and DGM evidence are documented in `entrance-station-refinement.md`.

## Checks and limits

`bun test src/app/tests/park-chancellery-v281.test.ts src/app/tests/minecraft-architectural-landmarks.test.ts src/app/tests/entrance-bearing-refinement.test.ts`:
**22 tests pass**, including exact replacement guard/fallback, sculpture height,
retained lawns/fence, palette, native cardinality, all 5,494 instances and no
coplanar top overlaps. All ten stored source WKB hashes and 249 projected
vertices were independently replayed against the retained GeoPackage.

`justice-palace-v183.test.ts` now separates the independently checked v257 and
v281 appendages before enforcing the unchanged original v183 instance/byte
limits. It subtracts exactly 3,681/7,172 v257 and 244/1,100 v281 drawn/native
instances, plus the six new drawn basin triangles, rather than raising a budget.
The complete release checks remain with the integrator. The updated sculpture
was also inspected in the internal browser as an isolated component in both
families; that check does not substitute for the complete built-city inspection.
