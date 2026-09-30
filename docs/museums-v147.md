# Museum Island refinements — v1.0.47

Pipeline step 10. This owner-requested pass extends the existing Altes Museum,
Alte Nationalgalerie, Pergamonmuseum and Bode-Museum detail models and adds the
complete source-bound James-Simon-Galerie. It does not add a tour stop or change
the release polygon. Original Dom/Altes, museum-triad and Spree source JSON is
unchanged. The Dom, Neues Museum and Grill Royal keep their existing geometry.

## Source geometry and explicit display subdivisions

The existing model retains all sixteen Altes Museum parts and two courts, all
twelve Pergamon parts, the Nationalgalerie's complete apsis/roof/portico and the
Bode-Museum's four official parts, five open courts and both dome envelopes.
The v1.0.10 source conflicts and historical display adjustments are documented in
[Dom/Altes](dom-altes-museum-refinement.md) and
[museum triad](museum-triad-refinement.md). This pass does not create new changes
to their footprints or principal roof forms.

`jamesSimonSource.json` adds all **eight** original parts of LoD2 parent
`DEBE01AL3jA00008` from the official [Berlin tile 391_5820](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5820.zip),
created 2 March 2026, under dl-de/zero-2-0. Every wall/roof ring retains source
millimetres. The archive SHA-256 is
`ed927ae9ab86d06815eaa9e95e4a7abf328a876e7e680986192314155e203a08`.
The complete previous OSM way `194422265`, runtime prism `94422265`, remains in
that evidence file. Its generic six-metre mass alone is suppressed. Regenerate
with `uv run python scripts/build_james_simon_source.py`; extraction checks the
actual approved bounds. No raw archive is added to the release.

The source principal roof reaches viewer y=18.950 m, the west plinth y=10.410 m,
and the lower strips approximately 10.46–11.25 m. The narrow north-end part
`DEBE3DFKoaFpFUPa` retains its original 26.661 m top. Its isolated height is not
silently flattened or called a measured architectural detail. All eight parts
remain represented; the new model does not turn them into a generic box.

The [architect's completed-building record](https://davidchipperfield.com/projects/james-simon-galerie)
confirms a high stone plinth, slender colonnades, an open terrace, a lower
colonnaded court and three broad stair flights. The high canal-facing LoD2 wall
is therefore subdivided above the terrace into 41 slender rectangular columns
and glazing set back behind them. Four low roof strips keep their source roof
surfaces over open posts. Only the bounded authored stair footprint is cut from
the coarse plinth's upper surface; source walls below its rise remain. Original
polygons remain packaged. Stair count, subdivisions, precise post spacing,
glazing setback and member dimensions are procedural display fits, not surveys.
No new future extension or temporary construction equipment is inferred.

Navigation shares exact column coordinates and tread heights with the model.
Roof support interpolates retained planar source surfaces. Capsule voids open
only the represented upper terrace, lower colonnades and stair aperture;
post solids remain separate. Minecraft replaces the same old OSM footprint,
keeps a surface-only native shell and excludes source roof cells over the
stairs. It adds no smooth duplicate or dense hidden fill.

## Recognition refinements

- **Altes Museum:** eighteen Ionic columns, broad steps, rotunda and roofs remain.
  Framed red vestibule fields, underside coffers and a continuous dentil rhythm
  sharpen the existing facade. The [SMB profile](https://www.smb.museum/en/museums-institutions/altes-museum/about-us/profile/)
  confirms the order and eighteen-column composition.
- **Granite bowl:** the exact OSM node `376689138` stays at world
  `[1880.092031, 5.2, 19.330824]`. The 6.9 m diameter, three supports and three
  separate viewing steps remain. A rounded rim and muted red-granite vertex
  colour variation replace the former uniform material; the smooth night
  material has 0.24 roughness. Its cavity remains open. The
  [Bildhauerei in Berlin inventory](https://bildhauerei-in-berlin.de/bildwerk/granitschale-7879/)
  supports polished red granite and this arrangement. Variation is procedural;
  no photograph, crack pattern or stone texture is copied.
- **Alte Nationalgalerie:** added fluting and Corinthian leaf silhouettes follow
  the existing front/side/apsis columns. Podium courses and carved stair-cheek
  panels preserve both stair runs, the mounted king, front pediment and roof
  silhouette. [Landesdenkmalamt](https://www.berlin.de/landesdenkmalamt/welterbe/museumsinsel-berlin/alte-nationalgalerie-654560.php)
  provides the factual architectural composition.
- **Pergamonmuseum:** the two existing western pavilion fronts receive round
  Ionic volutes, framed upper blind fields and dentils; all source wings and
  roof planes remain. The [Landesdenkmalamt account](https://www.berlin.de/landesdenkmalamt/welterbe/museumsinsel-berlin/pergamonmuseum-654567.php)
  supports the classical orders. Construction works and a future fourth wing
  are not modelled from historical photographs.
- **Bode-Museum:** entrance cartouches, Corinthian leaf clusters and projecting
  dentils refine the curved entrance facade. Native Minecraft gains separate
  facade openings, sill/cornice and parapet accents. The
  [Landesdenkmalamt account](https://www.berlin.de/landesdenkmalamt/welterbe/museumsinsel-berlin/bode-museum-654566.php)
  supports the neo-Baroque composition. Both domes and five courts remain.

All four drawn modes share the same full geometry on desktop and touch devices.
Minecraft is a distinct bounded instanced reading. The original native sampling
profiles remain; James-Simon uses 2,499 full / 1,640 mobile blocks. There are no
new runtime image requests, animation buffers or unbounded caches.

## Inspected freely licensed images

All six actual photographs were inspected locally on 30 September 2026. They
remain external, attribution-only references. Five existing records are reused;
the James-Simon record is new. No photograph or crop is bundled.

| File | Author | Licence | Observed features |
| --- | --- | --- | --- |
| [Altes Museum, Berlin-Mitte, 170117, ako.jpg](https://commons.wikimedia.org/wiki/File:Altes_Museum,_Berlin-Mitte,_170117,_ako.jpg) | Ansgar Koreng | CC BY 4.0 | Ionic fluting, panel framing and coffers |
| [Riss der Granitschale im Lustgarten.JPG](https://commons.wikimedia.org/wiki/File:Riss_der_Granitschale_im_Lustgarten.JPG) | Times | CC BY-SA 3.0 | Polished reddish granite and curved open basin; no copied crack |
| [Alte Nationalgalerie, 2024 (02).jpg](https://commons.wikimedia.org/wiki/File:Alte_Nationalgalerie,_2024_(02).jpg) | Bahnfrend | CC BY-SA 4.0 | Fluted order, carved stair cheeks, podium stonework |
| [Berlin, Pergamonmuseum 2014-07.jpg](https://commons.wikimedia.org/wiki/File:Berlin,_Pergamonmuseum_2014-07.jpg) | HerrAdams | CC BY-SA 4.0 | Volutes, framed blind fields, dentils; crane excluded |
| [Bode-Museum front detail.jpg](https://commons.wikimedia.org/wiki/File:Bode-Museum_front_detail.jpg) | Till Niermann | CC BY-SA 3.0 | Cartouches, capitals, dentils and balustrade |
| [James-Simon-Galerie Berlin 2021-03-13 02.jpg](https://commons.wikimedia.org/wiki/File:James-Simon-Galerie_Berlin_2021-03-13_02.jpg) | Leonhard Lenz | CC0 | Slender white columns, recessed glass, plinth joints, open terrace |

## Ground ownership at James-Simon

Close browser views exposed coarse ground cells through the plinth and under
its upper colonnade. A continuous floor at the retained 10.41 m terrace level
now fills the exact main source footprint, and all three stair flights have
solid foundations down to the source base at 0.808 m. These are procedural
structural subdivisions, not additional surveyed parts.

The small offline `jamesSimonTerrainBoundary.json` table subtracts only the
four closed official source footprints and the exact authored stair rectangle
from intersecting ground cells. The already retained shoreline complement is
composed first. `restoreJamesSimonGroundOwnership` reuses the existing exact
land writer, preserving the original run height, thickness and paint for every
remaining piece. It runs before the ordinary water-boundary restoration in the
drawn world and on the native ground runs. The four low open colonnade strips
are excluded from ownership. No broad bounding-box cut, ground resampling or
runtime polygon operation is introduced. The 18,295-byte table handles 184
cells, including 18 prior shoreline cells: it preserves 425.459 m² of exterior
land and 44.538 m² of existing water exclusion while removing 2,474.003 m²
beneath represented foundations. Its single additional terrain draw stores
92,880 geometry bytes (2,580 vertices), separate from the model budgets below;
shared ground-run instance counts are measured separately after splitting.

Four preserved land slivers project 0.21–0.43 m in front of the short plinth
source wall. Only this native face and its positive-v tapered continuation through u78
use a 1.1 m block thickness, centred on
the unchanged source wall plane (0.55 m exterior half-block). Its existing
window/joint boxes shift 0.65 m outward to remain visible. This is below the
1.6 m native grid step and changes no drawn geometry, source coordinate,
land complement, instance count or buffer budget. Six ray regressions
cover the measured sliver positions and tapered wall continuation.

## Explicit v1.0.47 budget override

The owner requested new detail and permitted increasing former frozen budgets.
`museumsV147Profile.ts` retains the measured v1.0.46 baseline and the new exact
geometry/instance-buffer totals. No prior baseline is rewritten. Draw calls for
all established museum groups remain unchanged.

| Group | Old bytes | v1.0.47 bytes | Delta bytes | Draws | Instances |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dom / Altes / bowl, drawn | 825,112 | 876,008 | +50,896 | 14 | 6,830 |
| Dom / Altes / bowl, native | 1,186,020 | 1,210,720 | +24,700 | 1 | 15,922 |
| Triad, drawn | 585,836 | 732,060 | +146,224 | 3 | 8,256 |
| Triad, native | 1,464,028 | 1,581,676 | +117,648 | 1 | 20,803 |
| Bode / Grill, drawn | 589,228 | 602,604 | +13,376 | 14 | 6,297 |
| Bode / Grill, native | 353,136 | 372,288 | +19,152 | 1 | 4,890 |
| James-Simon, drawn | — | 49,128 | +49,128 | 2 | 348 |
| James-Simon, native | — | 190,572 | +190,572 | 1 | 2,499 |

This accounts for 259,624 additional drawn buffer bytes and 352,072 additional
native buffer bytes; it does not claim total browser-process memory or FPS.

## Validation

`bun test --isolate --max-concurrency 1 tests/museums-v147.test.ts
tests/dom-altes-museum.test.ts tests/museum-triad-architecture.test.ts
tests/spree-museum-details.test.ts` passes all **30** focused tests.
`bun --bun tsc -b` passes. `uv run pytest -q tests/test_museums_v147.py`
passes the raw-source identity/bounds regression.
`uv run pytest -q tests/test_james_simon_terrain.py` checks exact exterior-land
retention, shared native/drawn grids, reproducibility and shoreline composition.
Focused Ruff checks pass.
Checks cover complete source parts, unchanged heights,
open courts, exposed upper glazing, low colonnade clearance, exact bowl anchor,
real raycasts of all three stairs in drawn/native builds, full-index capsule
clearance and exact foot heights through all flights and upper landings, source-scoped old-mass
suppression, texture-free buffers and exact historical/current budgets.

Local software orthographic plates exported actual Three.js geometry and
instance matrices for the five museums, bowl and native James-Simon. They were
inspected for overall source form and detail. These are geometry QA images,
not browser or physical-phone screenshots; browser release QA is separate.
