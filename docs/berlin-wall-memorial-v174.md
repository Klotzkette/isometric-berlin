# Bernauer Straße memorial — v1.0.74

This step-3/10 supplement represents the present-day Berlin Wall Memorial.
The inaccessible national monument near Ackerstraße is distinguished from the
open public memorial landscape toward Nordbahnhof and the Chapel of Reconciliation.
No demolished border wall, hypothetical death strip, minefield, vehicle obstacle
or intact electric fence is extended across the public grounds.

## Source contract

The retained Geofabrik Berlin extract is dated 2026-09-29T20:22:51Z, ODbL 1.0.
Exact current OSM courses and their tags are retained in
`geo_data/regierungsviertel/berlin-wall-memorial-v174.json`:

| Element | OSM identity | Evidence and treatment |
|---|---|---|
| Enclosed national monument | way `45664093` | Exact mapped sand/enclosure polygon; no site-wide replacement surface |
| Vorderlandmauer | ways `1504490315`, `1504490317` | Tagged 3.60 m height; concrete panels and rounded coping |
| Hinterlandmauer inside monument | way `129028211` | Tagged 3 m concrete wall |
| Other preserved rear-wall pieces | ways `446637390`, `446637389`, `446637038`, `1504490302`, `1504490305`, `1504490306` | Exact surviving courses; no linking through gaps |
| Signal fence remains | way `129029469` | Tagged 3 m and `ruins=yes`; upright remnants only |
| Contemporary steel endpoints | ways `53257439`, `126462918` | Tagged 7 m; weathering-steel exterior, stainless inward face |
| Preserved patrol track | way `446637042` | Exact course, explicitly `access=no`; procedural twin concrete tracks |
| Reconstructed BT9 | way `158945354` | Existing official LoD2 parent `DEBE01YYK0001yOL` retained; observation-window details added |
| Chapel | way `45664095` | Existing complete parent `DEBE01YYK000003x` retained; procedural timber lamellae outside its measured outline |
| Window of Remembrance | node `746066862` | Exact anchor, published 12 m width; schematic empty niches, no portraits or inscriptions |
| Symbolic wall bars | ways `1504490312`, `1504490313`, `1504490314`, `1080303188`, `1504490311`, `126462840` | Current mapped marker rows, with clearance at all intersecting public paths |

The documentation centre (`45664094`) and visitor centre (`53333454`) previously
used generic OSM fallback prisms, with estimated 12 m and 9 m heights. This
supplement replaces precisely those two display envelopes with every roof and
wall plane of eighteen official Berlin LoD2 parts from
[tile 390_5821](https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5821.zip)
(dl-de/zero-2-0). The four parents are `DEBE01YYK0003tZM`,
`DEBE01YYK0003tGE`, `DEBE00YY2hR0005R` and `DEBE01YYK0003yxD`.
All source polygons, parent/part identities, source datum and archive SHA-256
are retained in the evidence file. The legacy records remain there too.
Existing local ground y=5.2 is preserved, and the two viewing-tower parents
share the documentation building's NHN datum so that their relative levels
remain correct. The rest of the core, Alt-Mitte and outer city packets are
not edited by this generator.

## Official factual references, checked 2 October 2026

- The [Berlin Wall Foundation site guide](https://www.stiftung-berliner-mauer.de/en/berlin-wall-memorial/visit/map)
  identifies the closed monument, replaced inner-wall elements, reconstructed
  identical watchtower, museum, visitor centre, chapel, and public patrol path.
- The [Landesdenkmalamt Bernauer Straße account](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/bernauer-strasse-648145.php)
  identifies protected object `09040270,T,001`, surviving border-system layers,
  whip lights and the inward stainless-steel surfaces of the modern endpoints.
- [Berlin's memorial development account](https://www.berlin.de/sen/stadtentwicklung/staedtebau/einzelprojekte/gedenkstaette-berliner-mauer/)
  distinguishes the contemporary steel-bar landscape and existing public patrol
  path from the inaccessible national monument.
- [ZHN, the documentation-centre and viewing-tower architect](https://www.zhn-architekten.de/referenzen/nationale-gedenkstaette-berliner-mauer/)
  describes the steel structure, suspended platform and stainless mesh around
  the stair. The source tower envelope receives small mesh-like geometry bands.
- The [Reconciliation Parish chapel account](https://gemeinde-versoehnung.de/kapelle/)
  identifies the current chapel and its relationship to the demolished church.
- [ON Architektur's project publication](https://www.onarchitektur.de/gedenkstaette-berline-mauer.html?cid=77&file=files%2Fonarki%2FPDFs%2FMauer.pdf)
  supplies the 12 m length of the Window of Remembrance. Its design, portraits,
  niche count and lettering are not copied.
- [SINAI's project publication](https://sinai.de/sites/default/files/pdf/veroeffentlichung/1110_Deutsche_Bauzeitung_GBM.pdf)
  supports the visitor-centre weathering-steel material and memorial context.

These sources supply facts, not traced plans or photographic pixels. No new
photograph, portrait, protected landscape plan, canvas, image or text texture
is bundled or requested by the viewer. Existing visible OSM/Geoportal credits
continue to apply. No Wikimedia image was used in this supplement.

## Source conflicts and estimates

The LDA describes a 64 m preserved section; the Foundation describes a 70 m
enclosed monument. The mapped polygon and wall courses are retained without
stretching either to a round published length. OSM lists the BT9 as 10 m,
whereas the retained official envelope measures 9.278 m; the official geometry
wins. OSM lists the chapel as 8 m; its retained LoD2 height is 9.907 m. Added
7.6 m timber lamellae do not change that roof.

Wall thickness, coping radius, concrete joints, steel-bar spacing, facade
windows, mesh bands, lamella dimensions, patrol slab widths, remembrance niche
subdivisions and three whip-light positions are local display estimates.
Lamp positions are confined to the enclosed preserved system. They are not
asserted to be independently surveyed individual fixtures. The signal-fence
source says `ruins=yes`, so an intact electric fence is deliberately not inferred.

## Rendering and navigation

`BerlinWallMemorialV174.ts` is dynamically loaded by the existing world factory.
The source JSON uses the existing lossless lazy-array transform; neither mode
reads the other mode's render array at module initialization. Native construction
does not instantiate any smooth mesh. Repeated constructors work independently.

| Representation | Batches | Geometry |
|---|---:|---|
| Drawn, pointer and touch identically | 3 | 2,106 box instances, 4 twelve-sided coping cylinders, 500 source triangles |
| Minecraft, pointer and touch | 1 | 11,007 orthogonal blocks; building surfaces without hidden volume infill |

The shared runtime source is 758,324 bytes before the final newline, and 98,130
bytes with deterministic gzip. Direct `BufferAttribute`/`InstancedBufferAttribute`
construction avoids duplicate typed arrays. Shared unit geometry, exact-size
instance arrays and frozen static transforms bound GPU/CPU work. Native sand
remains a 6 cm surface with top y=5.32, not a raised block platform. Adjacent
sand and building surface cells are merged along rows without changing coverage.

`berlinWallMemorialV174Profile.ts` exports the two legacy prism IDs and an exact
native-column predicate, eighteen measured building footprints, source roof
triangles, physical wall solids, compact marker/post rows and the inaccessible
monument polygon. Public path way `116789573`, the accessible former patrol path,
Bernauer Straße sidewalks and the Ackerstraße approaches remain outside the
protected enclosed area. Collision follows individual solids and post footprints;
it does not close the memorial's entire grounds. Integration indexes these
obstacles spatially. The Window of Remembrance suppresses only generic artwork
node `746066862` to prevent a duplicate monument.

## Reproduction and verification

Run `uv run python scripts/build_berlin_wall_memorial_v174.py` with the existing
ignored raw OSM/LoD2 inputs. It writes only its dedicated source, navigation and
evidence files. Source tests verify all eighteen parts and every non-ground source
polygon, exact enclosed sand coverage, native ground level, limited replacement,
and three open public crossing points. Bun tests compare full/touch static arrays,
repeat native construction, verify one orthogonal native batch and exercise the
source-column, enclosure, solid and roof predicates.

`uv run pytest tests/test_berlin_wall_memorial_v174.py -q`: **4 passed**.
`bun test tests/berlin-wall-memorial-v174.test.ts`: **3 passed**.
Dedicated Ruff checks pass. The integrated Day capture at
`/tmp/north-mitte-v174-chrome/day-bernauer.png` was visually inspected: the two wall
layers, confined sand, contrasting modern endpoint faces, taller museum/viewing
tower and open public crossings are visible. Broader mode/browser checks belong
to the combined v1.0.74 release review.
