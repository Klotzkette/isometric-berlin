# Geo data — Regierungsviertel

Derived, clipped geodata for the v0.1 Regierungsviertel area only. Raw
city-wide dumps do **not** belong here; raw downloads and large source
archives stay under gitignored `raw/` paths as described in
[`docs/data.md`](../../docs/data.md).

## Files

| File | Purpose |
|---|---|
| `bounds.geojson` | MVP polygon around the Regierungsviertel. |
| `landmarks.geojson` | QA/navigation landmarks used by the renderer and viewer. |
| `landmark_alignment.json` | Machine-readable landmark alignment report. |
| `metric_precision.json` | Metric precision / tolerance report. |
| `buildings.gpkg` | Berlin LoD2 buildings clipped to bounds. |
| `osm.gpkg` | OSM streets, water, parks, rail, paths, POIs and semantics clipped to bounds. |
| `alkis.gpkg` | ALKIS parcel/support layer for official alignment context. |
| `fused_sources.json` | Additive source-fusion manifest. |
| `wikimedia_references.json` | Free-license Wikimedia visual-reference manifest with per-file attribution metadata. |
| `tiergartentunnel.geojson` | Open-data engineered Tiergartentunnel approximation for the under-surface cutaway cue; not official surveyed as-built geometry. |
| `dop_preview.png` | Small DOP preview image for QA; not a raw orthophoto dump. |
| `dgm_preview.png` | Small DGM preview image for QA; not a raw terrain dump. |

## Viewer Links

| Viewer artefact | Location |
|---|---|
| Landmark projection used by the static viewer | `../../src/app/public/dzi/regierungsviertel/landmarks.json` |
| Tiergartentunnel overlay used by the static viewer | `../../src/app/public/dzi/regierungsviertel/tiergartentunnel.json` |
| Wikimedia attribution shipped with the viewer | `../../src/app/public/dzi/regierungsviertel/wikimedia_attribution.json` |

## Licensing

- LoD2 buildings: [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0)
  (Geoportal Berlin).
- OSM extracts: [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/),
  © OpenStreetMap contributors.
- ALKIS / DOP / DGM support data: dl-de/zero-2-0 where fetched from
  Geoportal Berlin.
- Wikimedia references: per-file licenses and credits in
  [`../../references/wikimedia/README.md`](../../references/wikimedia/README.md).
