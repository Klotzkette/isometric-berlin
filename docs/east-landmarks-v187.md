# Tierpark and Köpenick — v1.0.87

This is the explicitly requested eastern extension, separate from the earlier
central Berlin detail and from the 93-place tour. The broad new coverage owns
ordinary roads, paths, park areas, ponds and remaining buildings. This small
supplement adds the following recognition structures and mapped zoo details.

## Sources and ownership

The retained [29 September 2026 Berlin OSM extract](https://download.geofabrik.de/europe/germany/berlin-260929.osm.pbf)
supplies Tierpark way `356446013`, animal enclosures, actual fence/wall ways,
gate nodes and named-building identities. No proprietary visitor map is traced.
The [Tierpark's current visitor page](https://www.tierpark-berlin.de/de/tickets-service/tierpark-plan)
and [history](https://www.tierpark-berlin.de/de/ueber-uns/historie) verify the named
exhibits, historic Alfred-Brehm-Haus and Friedrichsfelde palace. The retained
OSM source date can precede subsequent zoo construction or animal moves.

Complete measured walls, roofs, courtyard holes and individual parts come from
five [Berlin LoD2 kilometre tiles](https://gdi.berlin.de/data/a_lod2/atom/):
`399_5818`, `400_5817`, `400_5818`, `402_5811` and `403_5811`. The nine official
parents have 27 parts and 725 wall/roof polygons, all retained. Individual
source profiles, archive fingerprints and semantic links are preserved in
`east-landmarks-v187-evidence.json`.

| Site | Source identity |
|---|---|
| Schloss Friedrichsfelde | OSM way 11269749; LoD2 DEBE11YYI00009hE |
| Alfred-Brehm-Haus | OSM way 11269594; LoD2 DEBE11YYI0000Nxm |
| Giraffenhaus | OSM way 11643292; LoD2 DEBE11YYI0000GSB |
| Schloss Köpenick | OSM way 137219848; LoD2 DEBE09YYP00036uB |
| St. Laurentius | OSM way 27058690; LoD2 DEBE09YYP0002bXT |
| Rathaus Köpenick | OSM relation 57493; four named LoD2 parents in the evidence |
| Rathaus upper tower | OSM way 180315073, explicit 54 m height and 10 m roof |

The official Rathaus envelope stops below the upper tower. The exact OSM
building-part footprint therefore adds the absent upper shaft and pyramidal
roof. The [published 54 m overall height](https://www.visitberlin.de/de/rathaus-koepenick)
includes the roof: with the existing display ground at y=3, the shaft reaches
y=47 and the roof y=57. The original LoD2 surfaces remain present. Small clock
and belfry cues are labelled procedural proportions, not survey measurements.
The [district heritage description](https://www.berlin.de/ba-treptow-koepenick/politik-und-verwaltung/aemter/stadtentwicklungsamt/denkmalschutz/artikel.41403.php)
also supports the palace, church and Rathaus architectural character.

`east-landmarks-v187-exclusions.geojson` supplies only the ten exact owner
footprints in CRS84. These specific complete source models replace matching
new generic masses; there is no broad rectangular building exclusion.
`eastLandmarksV187Navigation.json` supplies all 28 part/tower footprints and
heights so the same physical envelopes remain available to navigation.

## Zoo presentation and honest limits

134 mapped animal-enclosure ground patches supplement the broad park colour.
Their true source outlines and holes remain intact, minus intersecting mapped
water, buildings and buffered paths. The 143 mapped fence, wall and retaining
wall records retain their courses. Mapped gates cut small open gaps through
their corresponding barriers. Untagged heights and the 1.25 m gate half-width
are explicitly display estimates. The model does not invent free-standing
fences around every enclosure; moats remain distinguishable from fences.

Building silhouettes and roof subdivisions are measured. Restrained glazing,
sills and warm masonry colours are illustrative, source-face-bounded detail;
they do not claim a photographic inventory of every opening. Ground retains
the existing flat outline-layer datum, with one rigid translation per named
building group, keeping adjacent Rathaus parents aligned. This pass introduces
no surveyed hill model, speculative new animal houses or future-plan buildings.

## Runtime and verification

Twelve independent 512 m cells contain 4,579 drawn triangles plus finite
instanced facade/barrier members. The native interpretation has its own
orthogonal surface skins, flat two-metre ground runs and block barrier members.
Only the selected representation creates GPU geometry. The shared lazy bundle
contains both small prepared datasets; these are not separate network loads.
All transforms are frozen and cell bounds are frustum culled. No texture,
per-frame animation, hidden solid voxel interior or additional loader is used.
Desktop and touch use identical drawn geometry.

Enclosure floors use separate, gently depth-biased material batches in both
representations. This prevents interference with the underlying generic park
surface while preserving every source vertex and ground height; building
faces and barrier members receive no depth bias.

Source-area tests independently verify preservation of every official wall
and roof, exact exclusions, open mapped gates and the 54 m tower height.
Runtime tests check mode separation, finite exact-sized buffers, bounded cell
spheres, orthogonal native matrices and the absence of texture coordinates.
Reproduce with:

```bash
uv run python scripts/build_east_landmarks_v187.py
uv run pytest tests/test_east_landmarks_v187.py -q
cd src/app && bun test tests/east-landmarks-v187.test.ts
```

The ignored `raw/east-v187/candidate.gpkg` is a bounded extraction of the
retained PBF's `multipolygons`, `lines` and `points` layers. Source licences
remain ODbL-1.0 for OSM and dl-de/zero-2-0 for Berlin LoD2. No reference photo,
protected visitor-plan graphic or image texture is bundled.
