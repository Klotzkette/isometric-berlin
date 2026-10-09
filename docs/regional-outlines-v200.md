# v200 — BER, Grünheide and the complete A10

This is an additive, thin cartographic outline layer. It does not replace any
existing building, packet, terrain, water or landmark. No photographs, textures,
facade guesses, animation, lights or full metropolitan fill were added.

## Retained sources and finite extent

`geo_data/regierungsviertel/region-outlines-v200-source.json.gz` retains complete
selected OSM feature geometries, IDs and tags in CRS84. It also retains the A10
node topology and all 15 route-relation membership lists. The source receipt is
`region-outlines-v200-evidence.json`, including source/output SHA256 and exact
GPU buffer counts. OSM contributors, ODbL 1.0; retrieved 9 October 2026.

The bounded official API requests were:

- https://api.openstreetmap.org/api/0.6/relation/21105/full.json
- The recursively referenced route relations 1514309, 1514310, 1494164,
  1494170, 1494166, 1494165, 1494174, 1494171, 1494167, 1494168, 1494169,
  1494172, 1494175 and 1494173, each at the same `/relation/{id}/full.json` API.
- https://api.openstreetmap.org/api/0.6/map?bbox=13.48,52.34,13.55,52.385
- https://api.openstreetmap.org/api/0.6/map?bbox=13.45,52.34,13.48,52.391
- https://api.openstreetmap.org/api/0.6/map?bbox=13.48,52.385,13.54,52.392
- https://api.openstreetmap.org/api/0.6/map?bbox=13.799,52.408,13.855,52.438
- https://api.openstreetmap.org/api/0.6/relation/57592/full

These are small saved extracts, not a Brandenburg-wide download. The runtime
scope consists of the exact BER aerodrome way 859790021, exact current terminal/
airport-center owners, the mapped Grünheide residential clusters with Werlsee
and Peetzsee, and narrow road corridors. It does not mean the entire 126 km²
Grünheide municipality or the land enclosed by the A10.

The airport's airside outline omits Terminal 2 and some landside buildings. The
explicit additional owners are ways 1132137322, 700218390, 193676334, 1083495102 and
relations 2118408, 2119133, 2119185. All selected building footprints and holes are
retained. Existing city coverage, including the separate v200 eastern district
scope, is subtracted before output. Invalid old scope rings are interpreted with
`make_valid` read-only; no old data is rewritten. Output uses centimetre rounding.

## Complete motorway, current airport and lake holes

The two OSM A10 directional relations had eight omitted connecting ways. Exact
endpoint-node `/node/{id}/ways.json` queries, followed by official
`/way/{id}/full.json` responses, recovered only tagged `highway=motorway`,
`ref=A 10`, `oneway=yes` ways 259531987, 1010526736, 1010910778, 1010910780,
1152641131, 1505010875, 1505010876, 1505010877. No gap was joined by a guessed line.
The final 1001 ways form exactly two closed directed cycles of 497 and 504 members,
with one incoming and one outgoing way at every junction endpoint. Their combined
projected carriageway length is 390085.72 m. Tests check original route membership,
all recovered IDs, closure and every rendered source vertex.

The [airport operator's facilities description](https://corporate.berlin-airport.de/de/unternehmen-presse/ber/flughafenanlagen.html)
confirms T1/T2 between the parallel runways. The
[operator's October 2024 renaming notice](https://corporate.berlin-airport.de/de/unternehmen-presse/presseportal/pressemitteilungen/2024-10-01-slb-umbenennung.html)
confirms current labels 06L/24R and06R/24L, which are retained from OSM ways 4645618
and 95201688. T1 height 32 m, T2 height 15 m and DFS-tower height 70 m are the mapped
OSM envelopes. The tower's nominal 72 m operator reference differs; this modest
outline does not invent a further 2 m structure to reconcile it.

Grünheide uses the [municipality's named Ortsteil](https://www.gruenheide-mark.de/verzeichnis/objekt.php?mandat=15232),
not its wider municipal boundary. Werlsee relation 79250 keeps its island holes;
Peetzsee way 156443053 and the other selected mapped water polygons keep all
shore vertices. No image referenced by an OSM tag was downloaded or rendered.

## Display interpretation and runtime budget

All projected geometry uses the existing EPSG:25833 viewer frame. Ground 3 m is an
unsurveyed cartographic datum. Motorway crossings are not asserted to be surveyed
bridge elevations. Tagged building height includes the roof; roofs are not added
twice. Missing heights use explicitly recorded OSM storeys × 3 m or 4/8/15 m envelope
estimates. Tagged road widths are retained; otherwise 8 m for airport/motorway and
4 m for local-road navigation are display estimates. A 20 m scope buffer is a finite
navigation margin, not a claim about legal road boundaries.

Drawn outlines keep all source corners. The independent native interpretation
orthogonalizes building edge runs while preserving their endpoints. Shared
cartographic road/water lines match the established Ringbahn convention.
Collision uses the original source building envelope in both outline readings;
these are open line sketches, not a newly surveyed solid native building model.

There are 3889 source features and 14 geographic LineSegments batches per style.
The selected family alone is decoded, from little-endian signed-centimetre
positions and normalized byte colors. No source array is captured by scene data
or closures. The existing family manager owns lighting, lifetime, disposal and
weak construction-cache reconstruction. Stable navigation tiles borrow their
rings; the eager scope contains no building navigation payload.

- Drawn: 124828 vertices; 1872420 GPU bytes; 3042831 stored JSON bytes.
- Native: 164756 vertices; 2471340 GPU bytes; 3841641 stored JSON bytes.
- Scope: 143 polygons, 152580 bytes. Navigation: 131 tiles, 1225465 bytes.

Rebuild deterministically from the retained source:
`uv run python scripts/build_region_outlines_v200.py`.
`--extract` is optional and requires the ignored raw API receipts described above.

Validation: five focused Python checks and two Bun tests pass; no full build is
needed for these tests. `/tmp/v200-regional-source-plans.png` was inspected for
A10 closure, airport layout/current terminals and Grünheide's source shore/island
layout. The parent task owns the integrated browser view and release checks.
