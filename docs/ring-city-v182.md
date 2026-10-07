# Ringbahn and finite outer neighbourhood massing — v1.0.82

The owner explicitly requested the Ringbahn interior and roughly one block
(100 m) outside it on 7 October 2026, together with Steglitz, Theodor-Heuss-Platz
and Estrel surroundings. This is an independent, additive outline stage. The
81.457 km² detailed-city polygon, existing source buildings and the 93-place
tour remain unchanged.

## Exact finite scope

`bounds-ring-v182.geojson` retains all 1,182 vertices of the existing closed
OSM S41 course, using its 87.351 km² interior plus a 100 m EPSG:25833 buffer.
Three explicitly named presentation lobes complete the requested outer sites:

| Lobe | Longitude / latitude bounds |
|---|---|
| Schloßstraße, Kreisel and Gymnasium Steglitz | 13.312–13.340 / 52.451–52.471 |
| Theodor-Heuss-Platz and rbb | 13.269–13.277 / 52.505–52.512 |
| Estrel | 13.455–13.462 / 52.470–52.476 |

The independent scope totals 95.968 km². Subtracting the existing city leaves
**24.437 km²** of new geometry. These lobes are presentation boundaries, not
administrative boundaries. Actual parks, water, courtyards, rail yards and
unbuilt land remain open: no houses are invented to fill legitimate spaces.

## Sources and ownership

The unchanged [29 September Geofabrik Berlin extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf)
(OpenStreetMap, ODbL-1.0) supplies mapped building footprints and complete
road/path courses. The available local [official Berlin LoD2 tiles](https://gdi.berlin.de/data/a_lod2/atom/)
(dl-de/zero-2-0) supply 8,602 parent footprints and vertical envelopes from
34 intersecting source tiles. Another 8,900 OSM buildings contribute uncovered
source footprints, giving **17,502 source building records**. All per-tile
hashes and source URLs are in `ring-city-v182-manifest.json`.

For OSM additions, 224 explicit heights and 7,299 tagged floor/roof-level
records precede 1,377 clearly labelled class-height estimates. This quick
outline stage does not claim roof-plane detail or surveyed elevations where
official source coverage is absent. Every rendered building keeps its source
identity and height provenance. Ground outside independently surveyed hill
patches remains the existing y=3 m display datum; colours, missing road widths
and native two-metre subdivisions are display conventions.

The export also retains **24,012 mapped road/path records**, with 570 street
names, continuous rounded junctions and drawn kerb lines. All source vertices
are retained before centimetre storage; no new coarse raster substitute is used.

Steglitz's complete measured hero shells and photographed Kreisel frames own
the exact footprints in `steglitz-v182-exclusions.geojson`. Named official/OSM
parents are omitted only from the generic shell representation. For adjacent
nonmatching sources only the actual overlapping area is removed. Their full
source records remain in the prepared evidence and the specific replacement
policy is in the manifest. The final new generic packets retain 17,495 unique
building identities and 402 courtyard holes across chunk records; the hero
models supply their own complete geometry.

The three compound Kreisel parents `DEBE06YYB0000Xmt`, `DEBE00YY1so0004e`
and `DEBE00YY287000A4` retain 35 individually measured leaf-part envelopes in
`ring-kreisel-parts-v182.json`. Their low podium strips use their own 8–30 m
heights, rather than inheriting the 115 m tower maximum. Exact part footprints
are clipped against hero ownership; even narrow unowned source slivers remain.
Both the parent and part identities survive in navigation. This correction is
reproducible with `--repair-measured-parts --publish` and changes only the two
new tile pairs touching these parents.

## Bounded delivery and verification

- 150 new 512 m tiles; 300 distinct drawn/native gzip packets.
- 50,761,782 packet bytes; 50,942,796 bytes including the source inventory.
- Largest transfer 622,585 bytes; largest decoded JSON 2,510,139 bytes.
- A 22,395-byte independent scope permits safe ground before streaming.
- The complete v1.0.82 offline ZIP/static archive extracts to 542,897,262 bytes
  (517.75 MiB). The package-only ceiling is now 525 MiB, with 7.25 MiB headroom,
  to accommodate the 50,942,796-byte source-bound Ringbahn addition and the
  measured landmark/localized DGM additions. Individual transfers, decoded
  packets and resident CPU/GPU budgets are unchanged; no old assets are removed.
- All 330 previous manifest descriptors and all their packet hashes were
  verified unchanged by this additive merge, including concurrent localized
  terrain corrections. The original city bounds and old navigation scope
  are untouched.

The supplement joins the existing single serial fetch/decode/publication
queue. There is no additional background loader or eager city import.
Current cancellation, native/drawn family separation, frustum selection,
visible-detail preservation and offscreen retirement remain in force.

Thirty focused Python geometry/scope tests pass, as do thirty Bun runtime/
navigation tests. Every new packet family is decoded through the production
renderer; all stored position components survive exactly and each constructed
packet remains below 3 MiB of geometry. The complete surrounding-city release
asset validation passes. The existing immutable packet SHA-256 values were
rechecked after publication into the local public folder.

Reproduce with `uv run python scripts/build_ring_city_v182.py`; publish the
verified prepared packets with the same command plus `--publish-only`.
The retained PBF/GeoPackage and raw official archives remain gitignored.
