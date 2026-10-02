# Alt-Mitte v1.0.69 source inventory

`scripts/build_alt_mitte_sources_v169.py` extracts complete official building
families. It does not write public packets or runtime code. Its frozen input is
v1.0.68; the source catalogue is
`geo_data/regierungsviertel/alt-mitte-v169/source-manifest.json`.

## Scope and source provenance

The scope uses the unsimplified official ALKIS Mitte district polygon, reconciled
with the pre-2001 Altbezirk. The documented 2008 change added a 310 m² unbuilt
embankment strip. Keeping that strip makes this building selection conservative;
it does not omit historical Mitte. See `alt-mitte-v169-boundary-audit.json` and
`docs/alt-mitte-v169-scope.md`. The frozen boundary SHA256 is
`41584f41bdd3f884b3015808697a1847e3a734f3f07cfff7298e113afdcf0ca9`.

Geometry comes from Berlin LoD2 CityGML, Geoportal Berlin, **dl-de/zero-2-0**.
The manifest records each bounded source archive's official URL and SHA256.
Original polygon IDs, rings, holes and all deepest source leaves are retained.
The single family datum is `y = NHN − groundNHN + groundY`; x and z use the
existing EPSG:25833 origin. Matching original prism y0 values anchor core
families. New core sources without old prisms use the original v168 terrain
sampler. Outer families retain y=3. Original datum candidates and every shift
are recorded; disconnected parts are not individually flattened.

OpenStreetMap contributes independent residual footprints, heights and semantic
tags (**© OpenStreetMap contributors, ODbL 1.0**). Overlap tags are context only,
not an identity or geometry replacement. A building-height fallback remains
labelled as an estimate. No photo, texture or new road geometry is introduced
by this extraction.

## Frozen inventory

| Official family treatment | Families | Deepest leaves | Source polygons |
| --- | ---: | ---: | ---: |
| New measured core | 3,983 | 9,111 | 130,066 |
| New measured outer | 4,391 | 7,597 | 100,558 |
| Retained existing representation | 5,171 | 10,060 | 139,065 |
| Total | **13,545** | **26,768** | **369,689** |

All 35 district-boundary straddlers remain whole. No source footprint extends
outside the approved release polygon. Every selected official core leaf in the
existing GeoPackage occurs in the catalogue. There are zero unclassified old
core prisms and zero outer families without exact old outer owners. Ten old
prisms intersect the district only because of their earlier simplification and
decimetre coordinates; their actual source footprints are outside or touch the
line numerically, so these owners remain unchanged.

The complete catalogue has 15,914 records in 45 gzip chunks, each below 5 MiB.
In addition to official families, it records 2,245 core OSM residuals (585 facade
fallbacks and 1,660 retained/transferred/fused records) and 124 outer OSM
residuals (122 new facade additions, two retained). These are separate sources,
not extra counts of independent physical buildings.

## Ownership and existing appearance

The immutable runtime suppression list, actual authored source records, prior
streamed owners, exact IDs in v168 facade code, and the independently evaluated
appearance snapshot control retention. Reference-only lists such as explicitly
preserved neighbours do not establish ownership. `appearance-baseline.json.gz`
records 96 evaluated special-ID sets and the HERO material/window maps.
All previous explicit overrides and transparent glass shells remain retained,
including 86 glass families which would otherwise have become opaque source
replacements. The authored Holocaust stele field also remains intact.

Of the 5,171 retained official families, 3,812 retain authored/glass appearance;
1,359 belong to unresolved source-overlap groups. Their raw source geometry is
kept as evidence, while existing mass remains visible. They must not be described
as newly rebuilt measured shells.

New source IDs inside the core are not treated as automatically additive. The
extractor builds complete connected groups of official families and original
OSM prism owners. Replacement requires at least 99% mutual footprint coverage
after a 0.25 m allowance for old quantization, and no reserved owner. The audit
contains 911 accepted atomic groups, replacing 1,028 old prism IDs; 770 groups
retain old mass because coverage or ownership is ambiguous. Another 887 core
families have no old intersecting mass and are added with an explicit terrain
datum. Across all measured core replacements, 5,426 unique original prism IDs
are bound. Every stored legacy prism is an unchanged v168 record, including its
height, y0 and courtyard rings.

## Topology and small source discrepancies

`source-topology-audit.json` records 23 raw self-intersections. The renderer uses
`make_valid`, recursively retains all polygonal pieces and lifts introduced
intersection points along original source edges. The source dictionaries remain
unchanged. One nested `GeometryCollection(MultiPolygon, LineString)` initially
failed; recursive extraction now preserves its 5.287654 m² of positive-area
geometry as three triangles. The zero-area line remains source/ink evidence.

All 213,916 final selected wall, roof and closure surfaces belong to a successful
validation sweep of 221,529 surfaces. The larger sweep includes glass families
subsequently retained; it is explicitly a validation superset. There are zero
remaining triangulation errors. Independent streamed GML checks matched all
13,545 families, 26,768 leaves and 369,689 polygon/ring structures, with no omitted
ancestor surfaces.

Family `DEBE01YYK00002R5`, part `DEBE3Dy2xBqvh1Ba`, has a separate source
closure anomaly. The original `LoD2_33_390_5819_1_BE.xml` (created 2026-03-08)
contains 32 low ClosureSurface polygons: 16 identical curtains in opposite
orientations, extending from NHN −22.763 to 34.665. Its sole GroundSurface is
entirely NHN 34.665; ordinary walls begin there, and the roof reaches NHN 58.850,
consistent with the recorded 24.185 m building height. The low closures become
world y=−52.228 under the unchanged family datum. This is a source closure
anomaly, not evidence of a physical 57.428 m basement. A lower packet origin
preserves every closure triangle. Navigation ground and window floor spacing
use the actual GroundSurface at world y=5.2, while all source rings remain
unchanged.

Two OSM residuals had never produced legacy prisms because they were below the
old footprint cutoff. `OSM-way-1030739581` keeps its exact 0.016984 m² triangle;
`needsResidualShell` requests a bounded 9 m shell at ground y=5.2. Its 9 m height
is the existing `building=yes` display fallback, not a measured or mapped height.
`OSM-way-390739569` is 99.4550401% covered by new official family
`DEBE01YYK0000BVr`; the remaining 0.003204858 m² disagreement is recorded and the
residual is source-fused under the stated 99% rule, avoiding duplicate mass.

Forty-four nearby official objects without GroundSurface are archived separately
as structural/transport evidence: 36 bridges, two Mühlendammschleuse parts, five
other structural objects and one utility object. Their original rings remain
available; the building task does not invent closed building bodies from them.

Run the bounded checks with:

```sh
uv run pytest tests/test_alt_mitte_sources_v169.py
```
