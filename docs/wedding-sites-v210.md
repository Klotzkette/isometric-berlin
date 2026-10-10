# Erika-Heß-Eisstadion and the retained Bayer/Schering campus — v210

Both requested sites already lie entirely within the retained v158 core. The
previous northern profile supplied metadata anchors only. The Bayer anchor
`node/9848575363` identifies the badge office, not the complete works. This
addition retains every prior runtime body and detail; no mesh packet, source
prism, native column, navigation owner, footprint or historical asset is removed.
There is no new ground, scope polygon, global bounds override or residency change.

| Exact retained source | World centre / extent | Existing core content |
| --- | --- | --- |
| Bayer works, OSM relation `6255291` | centroid x −342.62, z −2323.59; irregular bounds x [−661.32, −50.46], z [−2595.77, −2081.42] | 83 LoD2 parents, 214 parts, 2,357 original wall/roof sheets |
| Erika-Heß hall, OSM way `16183708` | centroid x −55.44, z −2067.02 | 3 parents/parts including a small annex and two coincident source hall records; 33 sheets |
| Outdoor rink, OSM way `32979869` | centroid x −106.82, z −2028.67 | Existing mapped open rink; added low outline boards only |

The mapped campus is 144,148.364 m². [Bayer's own site account](https://www.bayer.com/de-de/deutschland/standorte/berlin-startseite)
quotes 190,000 m² for its works. These are different source scopes; the quoted
area is not converted into an invented rectangle. Planned Nordhafen buildings
are not added. The retained boundary and all 217 unchanged runtime prism records
are in [the source receipt](../geo_data/regierungsviertel/wedding-sites-v210-source.json).

## Hall height conflict and additive construction

Official LoD2 parents `DEBE00YY2Vz000HH` and `DEBE01YYK0003xSI` each encode the
same full hall at only 3 m height: ground 34.6 and roof 37.6 m NHN. Both original
prisms remain unchanged, with viewer ground y 5.2 and roof y 8.2. Their complete
wall/roof rings, holes and original prism records remain in the receipt.

A finite grid of 216 official [Berlin bDOM 2025](https://gdi.berlin.de/services/wms/bdom)
one-pixel, one-metre GetFeatureInfo samples confirms a main roof around
43.36 m NHN and a lower strip around 39.71 m NHN. The native/core vertical shift
is **+0.6 m** relative to the source world datum NHN−30; the added viewer levels
are therefore y **13.96** and **10.31**, with sampled upper structure reaching
**22.37**. The [retained sample grid](../geo_data/regierungsviertel/wedding-v210-bdom-samples.json)
and exact selected samples in [the evidence](../geo_data/regierungsviertel/wedding-sites-v210-evidence.json)
make the calculation explicit.

The lower addition follows every original LoD2 ground-ring corner. The main
upper roof follows the DOP/bDOM break, clipped to that retained ring; it is a
reference-guided partition, not a newly surveyed LoD2 footprint. All added
surfaces begin at or above the old y 8.2 roof. No old shell yields, so no ownership
transfer receipt or source deletion is needed. The added upper volumes have
bounded exact-ring navigation and radius-to-edge tests.

[The district's 26 September 2025 structural account](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2025/pressemitteilung.1601945.php)
confirms five reinforced-concrete roof pylons and steel suspension rods. DOP
2025 and Angela Monika Arnold's [2005 exterior photograph](https://commons.wikimedia.org/wiki/File:2005_He%C3%9F-Eisstadion.jpg)
(CC BY-SA 2.0 DE) guide the five V-shaped supports. Their member widths, lean,
rod positions and glazing subdivisions are presentation estimates; the model
contains visible exterior members, not a reconstruction of hidden engineering.
No exterior-rink roof is invented.

## Bayer facade and perimeter work

The defining tower remains LoD2 parent `DEBE01YYK00042Xi`, including all eleven
source parts. Gunnar Klack's [2017 exterior photograph](https://commons.wikimedia.org/wiki/File:Bayer-Hochhaus-ehem-Schering-Muellerstr-Berlin-Wedding-08-2017.jpg)
(CC BY-SA 4.0) supports pale cores, muted blue-grey glazing, narrow mullions and
horizontal courses. Three source shaft parts stay blank rather than receiving
a generic glass grid. Other visible public-edge buildings receive source-clipped
window courses and roof copings. These opening rhythms and colors are declared
procedural estimates, not surveyed openings or an exhaustive campus survey.
Every aperture is checked against its original wall polygon and holes; window
rows hidden by sibling source parts are omitted.

Ten original OSM fence/wall ways and fifteen gate features are retained. Only
line segments within 2 m of the **actual mapped campus boundary** are added;
all mapped gate openings are subtracted. Original complete line geometry stays
in the source receipt. Missing heights, member sizes and gate widths use stated
presentation defaults (fence 1.5 m, wall 2 m, gate opening 3 m), overridden by
available OSM dimensions. Navigation uses exactly the rendered cut segments.
There are no security-system or non-public interior details.

All photos and DOP rasters remain external references. Per-file credits, licence
URLs, inspected-raster hashes and official source links are supplied separately
in [wedding-sites-v210-credits.json](wedding-sites-v210-credits.json) for the root
integrator to append to the two existing credit manifests.

## Runtime integration contract

`WeddingSitesV210.ts` exports:

- `createWeddingSitesEnvelopesV210(native = false)`: one required additive hall
  roof/wall batch. Construct before activating its navigation and publishing
  the city. Existing lower bodies remain present throughout.
- `createWeddingSitesV210(native = false)`: two optional site instance batches,
  one per site. No touch/mobile parameter or detail reduction exists.
- `WEDDING_SITES_V210_CAMERAS`: stadium camera `[65,125,-1910]`, target
  `[-56,12,-2070]`, span 215 m; campus camera `[125,230,-2020]`, target
  `[-285,21,-2320]`, span 700 m.

`weddingSitesV210Navigation.ts` exports `weddingSitesV210SolidAt(x,y,z,radius=0)`
for the upper hall and exact cut perimeter only. Existing core floor and building
collision remain authoritative. It rejects remote positions before testing two
volume bounds and indexed boundary segments. No broad site occupancy block is
created; the outdoor rink and campus courts stay open.

The explicit weak/lazy constructor keys are `weddingSitesV210.json`: `boxes`,
`blocks`; `weddingSitesV210Envelopes.json`: `surfaces`, `blocks`. Small `volumes`
and `barriers` navigation metadata must stay strongly available. Constructors
retain no input arrays on scene objects. Every world owns its geometry,
materials and matrix arrays. Day/night material pairs are texture-free; transforms
are frozen. Native uses independently generated orthogonal surface/member runs.
The full hall roof is a hollow block skin rather than filled internal blocks.

| Complete addition | Draw calls | GPU buffers | Geometry |
| --- | ---: | ---: | --- |
| Drawn, touch and desktop identical | 3 | 1,225,912 bytes | 16,039 instances + 47 upper-hall triangles |
| Independent native | 3 | 3,008,304 bytes | 38,873 detail runs + 673 upper-hall skin runs |

No existing detail count or constant residency budget was reduced or raised.

## Focused checks and reproduction

`uv run python -m scripts.build_wedding_sites_source_v210` refreshes source
receipts from the retained PBF and the two small official archives. The generator
is `uv run python -m scripts.build_wedding_sites_v210`; it performs no download.
The bDOM receipt records every sampled coordinate and query method. The DOP
reference queries and hashes are retained in the separate credits JSON.

`uv run pytest tests/test_wedding_sites_v210.py -q`: **7 passed**. It independently
matches every part, sheet and hole against the official XML archives, checks
217 unchanged core prisms, complete source-ring additions, all facade apertures,
real campus-bound perimeter/gate gaps and strict finite JSON.

`bun test --timeout 60000 tests/wedding-sites-v210.test.ts` from `src/app`:
**3 passed**. Actual buffer totals, full native axis alignment, texture absence,
frozen transforms, independent ownership, complete sheet submission and bounded
navigation/radius queries are checked. No full suite or production build was run
by this bounded subtask; parent integration and final visual QA remain separate.

Focused Ruff checks/formatting and an isolated TypeScript no-emit check of the
two new runtime modules also pass. Shared integration files were not edited.
