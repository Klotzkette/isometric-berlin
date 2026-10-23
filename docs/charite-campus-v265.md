# Charité museum and Virology — v265

Step 10 refines the existing Campus Mitte beside Humboldthafen/Stadtbahn. It
neither relocates the campus to Nordhafen nor invents extra institute buildings.
The 32 complete retained LoD2 parts remain unchanged, including museum/pathology,
Ruska and Althoff context. The distinct Edmund-Lesser-Haus and all earlier v261
oriels, glazing, roofs and terrace railings remain.

## Museum correction

The [architect's published account](https://www.ak-berlin.de/baukultur/da-architektur-in-und-aus-berlin/projekte-da-2024/projekte-detailseite/berliner-medizinhistorisches-museum/)
and [museum's current exterior](https://bmm-charite.de/museum), photographs by
Marcus Ebener, show the renovated bronze vitrines and three upper storeys with
triple windows. They disprove the previous single upper row of paired openings
on the main facade. The vitrines' six-metre height is explicitly published;
small widths, spacings, colour and projection dimensions remain photographic
estimates.

Only the nineteen old opening groups on `gwXjAt32` source edges 14 and 16 and
their derived spandrel/window fittings yield. Their complete immutable records
are in `charite-campus-v265-preservation.json`. Every other window, source wall,
roof, courtyard, cornice, masonry course and navigation solid stays. Optional
`includeLegacyMuseumFront:false` guards keep both legacy constructors unchanged
by default. Production must construct the new model before enabling the guard.

The new front contains seven bronze vitrines, 21 triple-window groups / 63 upper
panes, pale spandrels, white frames, the projecting bronze entrance and small
geometric `MUSEUM` letters. The narrower secondary section uses its lower storey
rhythm. The layer keeps all source heights rather than inventing a new roof.

## Ruska

The already credited [Schibo southwest photograph](https://commons.wikimedia.org/wiki/File:Charit%C3%A9_CCM,_Rahel-Hirsch-Weg_3_S%C3%BCdwestansicht,_2024.jpg)
(CC BY-SA 4.0) supports arched basement lights/grilles, partly lowered blinds,
slender rainwater pipes and discrete eaves brackets. These supplement the
existing tall openings and v261 projecting bays. Individual blind positions and
small fitting dimensions are illustrative. The institute remains identified as
[Helmut-Ruska-Haus / Rahel-Hirsch-Weg 3](https://virologie-ccm.charite.de/).

All external photographs remain reference-only; no pixels, plans or textures
are bundled. The source and attribution ledger is
`geo_data/regierungsviertel/charite-campus-v265-evidence.json`.

## Construction and validation

`createChariteCampusV265(native)` adds one frozen instanced batch in either
family. Drawn: 3,158 instances / 240,008 instance-attribute bytes. Independent
orthogonal native: 3,031 blocks / 230,356 bytes. A single 24-vertex cube contributes
648 further geometry bytes. Both device profiles use identical full geometry.
No animation, navigation expansion, streaming descriptor, source deletion or
live memory budget changes occur. Construction-local records are not retained
unless explicit diagnostics are requested.

Two Python tests check exact repeatable source snapshots and immutable correction
scope. Four Bun tests cover all 19 old groups and their unchanged complement,
new facade completeness, source-plane exposure, finite bounded geometry,
orthogonal native construction, fixed transforms and full/mobile equality.
TypeScript and focused Ruff checks pass. Browser integration checks are recorded
in the combined release note rather than claimed as physical-phone testing here.

QA cameras: museum `[296,38,-844]` toward `[230,15,-795]`; Ruska
`[403,28,-858]` toward `[454,15,-905]`.
