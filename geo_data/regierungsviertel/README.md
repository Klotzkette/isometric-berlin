# Geo data — Regierungsviertel

Derived, clipped geodata for the v0.1 Regierungsviertel area only. Raw
city-wide dumps do **not** belong here; raw downloads and large source
archives stay under gitignored `raw/` paths as described in
[`docs/data.md`](../../docs/data.md).

The current landmark layer contains 56 OSM/LoD2-checked points. The task-09
bounds expansion adds 13 of them — Siegessäule, Großer Stern,
Bismarck-Nationaldenkmal, the five Kulturforum buildings, Leipziger Platz with
Mall of Berlin and Kollhoff-Tower, Hamburger Bahnhof and the Geschichtspark
Ehemaliges Zellengefängnis Moabit. The
Wikimedia manifest contains 110 freely licensed visual references across 37
motif groups; geometry still comes from Berlin LoD2/OSM/official support data.

## Files

| File | Purpose |
|---|---|
| `bounds.geojson` | Scene polygon: Regierungsviertel core plus the task-09 expansion. |
| `overview_bounds.geojson` | The polygon the committed overview raster was projected from. Pinned so published prism tones stay stable when `bounds.geojson` grows. |
| `landmarks.geojson` | QA/navigation landmarks used by the renderer and viewer. |
| `landmark_alignment.json` | Machine-readable landmark alignment report. |
| `metric_precision.json` | Metric precision / tolerance report. |
| `buildings.gpkg` | Berlin LoD2 buildings clipped to bounds. |
| `osm.gpkg` | OSM streets, water, parks, rail, paths, POIs and semantics. Still the **pre-task-09 extract** (E388785…390105 / N5818554…5821015): Overpass was unreachable when the bounds were expanded, so this layer does not yet cover the new areas. |
| `fused_sources.json` | Additive source-fusion manifest, still describing the pre-task-09 bounds. Regenerating it for the expanded area produces 6.3 MiB, over the 5 MiB repository limit, so it needs a compaction pass first. |
| `alkis.gpkg` | ALKIS parcel/support layer for official alignment context. |
| `official_details.gpkg` | Bounded official Berlin tree, public-lighting and Vorderlandmauer WFS layers. |
| `wikimedia_references.json` | Free-license Wikimedia visual-reference manifest with per-file attribution metadata. |
| `tiergartentunnel.geojson` | Open-data engineered Tiergartentunnel approximation with derived OSM B96 tunnel carriageway evidence for the under-surface cutaway cue; not official surveyed as-built geometry. |
| `dop_preview.png` | Small DOP preview image for QA; not a raw orthophoto dump. |
| `dgm_preview.png` | Small DGM preview image for QA; not a raw terrain dump. |

## Viewer Links

| Viewer artefact | Location |
|---|---|
| Landmark projection used by the static viewer | `../../src/app/public/dzi/regierungsviertel/landmarks.json` — projected from `overview_bounds.geojson` together with the DZI raster, so it still carries the 43 pre-expansion landmarks. |
| Tiergartentunnel overlay used by the static viewer | `../../src/app/public/dzi/regierungsviertel/tiergartentunnel.json` |
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
