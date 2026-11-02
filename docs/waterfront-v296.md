# Source-bound waterfront approaches, v296

The Gustav-Heinemann-Brücke now meets its mapped southern footways and the
existing Panoramaweg. The Alexanderufer quay and its two mapped ascending
connections have complete paving and matching walking support. All original
source records, other riverbanks, lower-promenade heights and park details remain.

## Evidence and uncertainty

`src/app/src/data/waterfrontV296.json` retains every original route coordinate.
The committed `geo_data/regierungsviertel/osm.gpkg` supplies these attributes:

| Way | Retained evidence | Representation |
| --- | --- | --- |
| 15405394 | Gustav-Heinemann-Brücke, bridge=yes, layer=1, width=4 | Existing complete Vierendeel model, corrected centre/axis |
| 50071662 / 1127988519 | Footway, asphalt, width=5 | Five-metre southern approach on the actual axis |
| 4592740 | Alexanderufer, footway, paving_stones | Lower quay, exact source nodes |
| 1348082755 | Alexanderufer, footway, paving_stones | Transverse ascending connection, exact source nodes |
| 497648062 | Footway, paving_stones | Ascending connection to the existing Hugo-Preuß deck |

[Max Dudler's project record](https://www.maxdudler.de/de/projekte/gustav-heinemann-bruecke/?cid=4)
and its project photographs support the wooden deck, Vierendeel structure and
park/station connection. The architect describes the overall bridge as 88 by
5 metres; the retained bridge inventory supplies the existing 87.76 by 4 metre
deck dimensions. No photographed pixels are bundled. The exact OSM bridge
centreline is 89.3119823591 metres; the small difference receives short terminal
joints, preserving both original references.

[JUCA's Futurium landscape account](https://juca.berlin/portfolio/futurium)
distinguishes the entrance-level southern forecourt and steeper northern access;
it does not establish surveyed ramp dimensions. The
[Futurium access information](https://futurium.de/de/barrierefreiheit)
identifies the Kapelle-Ufer entrance, northern access and Hugo-Preuß approach.
The represented gradients, unsourced 3.4/3.1 metre widths, absolute route heights,
small portal sections and intermediate grades are display estimates. They are
not a survey of accessibility slopes, fixtures or stair risers.

The formerly blocked northern connection runs beneath the actual
HumboldtHafenEins source owner `eGZXjFeA`.
[KSP Engel](https://www.ksp-engel.com/projekte/humboldt-hafen-eins) documents its
public promenade, passage and large external stair connection.
[KVL](https://www.kvlgroup.com/referenzen/humboldthafen-eins) identifies the
two-storey waterfront arcade and raised public connections. The
[Implenia project record](https://implenia.com/de-de/referenzen/detail/ref/humboldthafeneins/)
corroborates the projecting building structure. The narrow admitted path is a
subset of this public space. Its ceiling at 9.99 metres, eight metres above the
represented quay datum, is an explicitly estimated fit; it is not a measured
internal height. No plan, photograph or texture is shipped.

## Corrected overlaps and complete complements

The bridge centre is `[-37.2488275, -445.165166]`, with axis
`[-0.0180091065, 0.9998378229]`. The existing displayed southern deck top is
4.2502466133 metres. A 26 metre local Panoramaweg height fit meets that top;
all original XZ nodes, the outer height complement and the complete lower route
remain unchanged. Only the railing across the actual five-metre junction opens.

Testing the actual source ground runs revealed misleading representative
heights: some quay runs rendered at 3.9 metres while the local point sampler
returned 1.9 metres. They buried the new lower route. The original southern
approach also descended to 3.45 metres beneath the existing 6.16 metre lawn.
Its narrow source-bound grade now meets that lawn at 6.185 metres. The northern
Alexanderufer connection meets the existing Hugo-Preuß deck at 5.4078888893
metres. These match actual retained geometry; no canonical terrain value changes.

Shared full-width sections join the drawn ribbons without disconnected corner
rectangles. Every exact source node remains represented. A one-millimetre end
overlap absorbs Float32 endpoint rounding. Independent native paving admits
every half-metre cell with positive-area triangle coverage, including endpoints;
its cached flat tops also supply navigation. Its small cardinal steps are bounded
by the represented slope and cell diagonal.

`WATERFRONT_GROUND_OPENINGS_V296` contains 60 finite, slope-aware triangle
prisms and matching native cell boxes. They remove only air above complete new
paving. Root's `FidelityGroundOpeningsV296` retains exact source outside triangles
in the drawn family and exact cardinal outside boxes in the native family.
`applyWaterfrontParkOpeningsV296` is default-off and recognises only the old
park terrain, western rising lawn, local Panoramaweg and its ink, or the named
native park batch. Other lawns, Corten walls, garden slabs and the entire lower
promenade retain their original geometry. Native unaffected matrices and paint
retain their bytes; 53 overlapping instances yield 178 outside fragments.

`WATERFRONT_ARCADE_RECEIPT_V296` retains the complete original `eGZXjFeA`
record, both input-file SHA-256 values and eight original native column tuples.
All eight cells lie completely inside that source footprint and have no foreign
owner. Default-off source/column guards require all original fields and tuples,
the four-metre cell size and exclusive ownership; new foreign overlap rejects
admission. `waterfrontSourceOpeningsV296` never accepts a transformed display copy.
The source inventory and its height, roof, tone, ring and holes remain unchanged.

The public-air opening includes a bounded 65-centimetre northern mouth onto
the existing bridge support, allowing the complete 42-centimetre pedestrian
capsule through the endpoint. `applyWaterfrontAuthoredOpeningsV296` opens only
the two recognised old harbour-architecture groups. It preserves all outside
fittings and native instance paint, including cloned day/night colour handles.
A source-intersected ceiling underside and small portal jamb/head sections close
the exposed opening. The new native ceiling, paving and portal sections are
independently cardinal. Old oblique outside facade fragments retain their shapes.

## Integration and verification

Attach `createWaterfrontFidelityV296(native)` before enabling any complement.
Enable the park helper on the constructed park and the harbour helper after the
old harbour architecture is attached. Source extrusion and original column loops
use the matching source/column guards. Root aggregates the ground cuts and binds
`waterfrontGroundAtV296`, source-ID-bound `waterfrontOpeningContainsV296` and
`waterfrontArcadeSolidAtV296` to the active family. Unknown owners remain physical.

The complete native addition has 3,259 paving cells, 285 ceiling cells and three
portal sections: 3,547 instances, one batch and 269,572 matrix/colour bytes.
The full drawn and mobile addition share all geometry. No textures, timers,
source downloads at runtime, tour stops, coverage or live budget increases occur.

`tests/waterfront-v296.test.ts` uses actual park and bridge factories, original
ground-context runs and the actual draped OSM surface constructor. Source polygon
rings and holes are constructed completely, including the large asphalt union;
only complete resulting triangles intersecting the finite QA window are selected
for combined local rays. Before/after tests prove actual terrain and old arcade
occlusion, open endpoints, capsule headroom, matching ceilings and continuous
walking in both families. The pedestrian controller walks every route in both
directions without jumping. Preservation checks compare unrelated geometry,
native outside matrices/colours, source guards and every lower-promenade ordinate.
These are geometry/navigation checks, not browser or device performance timings.
