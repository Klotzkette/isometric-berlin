# Venusbassin location audit — v1.0.25

Pipeline step 10, checked 2026-09-10. The owner's “Venusplatz” is interpreted as
catalogue sight 35, **Venusbassin / Goldfischteich**, beside the Tiergartentunnel
in the eastern Großer Tiergarten. No separate Venusplatz is in this catalogue.

## Evidence and result

- [Bezirksamt Mitte's surface-water inventory](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/umwelt-und-naturschutzamt/naturschutz/oberflaechengewaesser-1463692.php)
  confirms the identity **Goldfischteich (Venusbassin)** and eastern Tiergarten
  location. The [Steppengarten history](https://www.steppengarten.de/home/geschichte)
  confirms the adjoining garden and retained historic basin location.
- The current [OSM way 28873112](https://www.openstreetmap.org/way/28873112),
  version 19 dated 2024-11-15, was fetched through the public OSM API. Its
  EPSG:25833 outline is identical to the retained `osm.gpkg` water feature
  (Hausdorff distance **0.000 m**). No map imagery or third-party geometry
  replaces the attributed OSM source.
- The rendered water ring in `surface-polygons.json`, converted from decimetres
  using the scene origin `[389500, 5820000, 30]`, differs from the OSM outline by
  at most **0.107 m**. This is the existing bounded simplification/quantisation.
- The navigation coordinate **13.370688333 E, 52.514502778 N** maps exactly to
  the existing scene point **[-62.426983, 8, 487.254631]**. Its plan position is
  inside both the source water polygon and the rendered ring, 9.097 m from the
  source polygon's centroid. A navigation point need not be the area centroid.
- The official [DOP 2025 spring WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
  was inspected at EPSG:25833 bbox `389315,5819360,389650,5819695`. It confirms
  the north–south basin south of Straße des 17. Juni, with its widened centre
  and ends, the composer monument to its south and the Steppengarten to its
  east. The aerial is external QA only, never a bundled or runtime image.
- The actual Day viewer deep link was opened in desktop Chrome and inspected:
  the basin is visible at that location, without page errors.

The location is correct; **no geometry or landmark coordinate is moved**.
The official inventory's 2,740 m² area and OSM's 3,145.078 m² polygon area are
not equivalent survey measurements. Their date/edge definition is unresolved;
this area discrepancy does not justify translating or rescaling the basin.

## Reproduction

Read OSM API `/api/0.6/way/28873112/full.json`, project the node ring from
EPSG:4326 to EPSG:25833, and compare with water feature `id=28873112` in
`geo_data/regierungsviertel/osm.gpkg`. Reconstruct the runtime ring as
`(389500 + x/10, 5820000 - z/10)` and check both Hausdorff distance and
containment of the catalogue point. Open `#landmark=venusbassin-goldfischteich`
in the viewer to inspect the real presentation.
