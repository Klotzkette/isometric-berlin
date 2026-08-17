# Geo data — Regierungsviertel

Derived, clipped geodata for the task-13 Berlin scene. Raw
city-wide dumps do **not** belong here; raw downloads and large source
archives stay under gitignored `raw/` paths as described in
[`docs/data.md`](../../docs/data.md).

The current landmark layer contains 89 OSM/LoD2-checked points. The exact
task-13 source hull is an additional 500 m EPSG:25833 buffer around every
task-12 edge (E385602.60…391910.58 / N5817089.12…5823617.37). The Wikimedia manifest
contains 113 freely licensed visual references for 38 landmarks; geometry
still comes from Berlin LoD2, current OSM and official support data.

## Files

| File | Purpose |
|---|---|
| `bounds.geojson` | Exact task-13 scene polygon: an additional 500 m projected buffer around the task-12 source hull. |
| `overview_bounds.geojson` | Matching task-13 polygon used for the regenerated overview, DZI and prism-tone projection. |
| `landmarks.geojson` | QA/navigation landmarks used by the renderer and viewer. |
| `landmark_alignment.json` | Machine-readable landmark alignment report. |
| `metric_precision.json` | Metric precision / tolerance report. |
| `buildings.gpkg` | Canonical Berlin LoD2 package: 17,091 official volumes. It remains authoritative and was not rewritten while the official endpoint was in maintenance. |
| `osm_context_buildings.gpkg` | 12,856 current OSM fallback footprints only where no LoD2 body exists; every height records whether it is explicit, storey-derived or a display fallback. |
| `osm.gpkg` | Current Geofabrik/OSM task-13 extract: 41,886 roads, 257 water features, 4,222 parks, 27,312 vegetation features, 865 playground features, 1,906 rail features and 10,644 relevant POIs. |
| `fused_sources.json` | Canonical additive manifest for the official LoD2 package. The shared runtime/generation loader appends the OSM sidecar before applying corrections. |
| `alkis.gpkg` | ALKIS parcel/support layer for official alignment context. |
| `official_details.gpkg` | Bounded official Berlin tree, public-lighting and Vorderlandmauer WFS layers. |
| `tiergarten-vegetation.geojson` | Small reproducible OSM sidecar for 83 `natural=scrub` polygons and 23 `barrier=hedge` line/area objects clipped to Großer Tiergarten relation `7643526`; source IDs and URLs are retained. |
| `wikimedia_references.json` | Free-license Wikimedia visual-reference manifest with per-file attribution metadata. |
| `tiergartentunnel.geojson` | Open-data engineered Tiergartentunnel approximation with derived OSM B96 tunnel carriageway evidence for the under-surface cutaway cue; not official surveyed as-built geometry. |
| `dop_preview.png` | Small DOP preview image for QA; not a raw orthophoto dump. |
| `dgm_preview.png` | Small DGM preview image for QA; not a raw terrain dump. |

## Viewer Links

| Viewer artefact | Location |
|---|---|
| Landmark projection used by the static viewer | `../../src/app/public/dzi/regierungsviertel/landmarks.json` — all 89 landmarks projected from task-13 `overview_bounds.geojson` together with the regenerated DZI raster. |
| Tiergartentunnel overlay used by the static viewer | `../../src/app/public/dzi/regierungsviertel/tiergartentunnel.json` — reprojected with task-13 through the Reichpietschufer portal. |
| Wikimedia attribution shipped with the viewer | `../../src/app/public/dzi/regierungsviertel/wikimedia_attribution.json` |

## Licensing

- LoD2 buildings: [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0)
  (Geoportal Berlin).
- OSM extracts: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/),
  © OpenStreetMap contributors.
- ALKIS / DOP / DGM support data: dl-de/zero-2-0 where fetched from
  Geoportal Berlin.
- Official tree, public-lighting and Wall-route details: dl-de/zero-2-0
  (Geoportal Berlin).
- Wikimedia references: per-file licenses and credits in
  [`../../references/wikimedia/README.md`](../../references/wikimedia/README.md).
