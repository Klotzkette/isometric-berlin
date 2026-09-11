# Bebelplatz and Humboldt source supplement

Pipeline step 10. The requested historic Humboldt main entrance, Alte Bibliothek,
Hotel de Rome and St Hedwig's Cathedral lie inside the existing release polygon.
No bounds expansion or extra tour stop is introduced.

The previous scene had only OSM context prisms in this bounded window: the
canonical `buildings.gpkg` contained no LoD2 buildings here. HU's 9 m and Hotel de
Rome's 12/9/18 m envelopes came from OSM tags or display fallbacks; Hedwig's 18 m
was explicitly a building-type display fallback. Those are not measured building
heights. The original OSM records remain retained for identity and provenance.

`scripts/build_bebelplatz_building_source.py` extracts only these four parents
from the official Berlin LoD2 archives. The compact
`src/app/src/bebelplatzBuildingSource.json` retains all thirteen source parts,
their ground rings, holes, wall/roof polygons, creation dates, archive SHA-256
digests and URLs. Runtime replaces only the six identified fallback prisms;
neighbouring structures and HU's separate courtyard canopy prisms are retained.

The same supplement records the exact 8,299.218 m² Bebelplatz sett polygon,
OSM way `205728152`. The prior raster class `plazaBrick` colored this entire
stone-paved square orange. Its corrected local paving follows this mapped
boundary and has an opening for the separately modeled library memorial;
neighbouring ground classes and streets remain unchanged. Polygon coordinates
are retained to the nearest millimetre, with the source digest and ODbL license.

| Recognition building | Official parent | Creation date | World base / highest roof, m | Retained OSM identity |
| --- | --- | --- | --- | --- |
| Humboldt main building | `DEBE01YYK0000Cm9` | 2026-03-08 | -1.245 / 25.018 | relation 6647 |
| Alte Bibliothek | `DEBE01YYK00000v2` | 2026-03-08 | 1.609 / 27.148 | way 24247456 |
| Hotel de Rome | `DEBE01YYK00002GD` | 2026-03-08 | 3.821 / 34.166 | node 1598987141; ways 29982781, 28248337, 29982783 |
| St Hedwig's Cathedral | `DEBE01YYK00000AQ` | 2026-03-02 | 4.107 / 39.727 | way 58608090 |

World coordinates use EPSG:25833 with x = easting − 389500,
z = 5820000 − northing and y = source height − 30. Source base elevations can
include basements; they are not street levels and must not be replaced with the
generic 5.2 m terrain value. The hotel's front main body has a 30.747 m world
roof top, while the higher rear parts reach the listed 34.166 m.

The main entrance faces south across its U-shaped forecourt. The library retains
its source-measured bowed Bebelplatz facade. Hedwig's generalized LoD2 roof planes
remain stored as source evidence; smooth copper-dome interpretation and facade
orders, windows, door leaves and signage are separate procedural recognition
geometry, not additional official measurements.

Sources: Geoportal Berlin
[LoD2 tile 390_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5819.zip)
and [tile 391_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip),
licensed [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0). OSM semantic
identities and footprints retain [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Raw ZIPs remain ignored; no photograph, texture or whole-tile export is bundled.
