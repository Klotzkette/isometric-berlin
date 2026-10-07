# Steglitz recognition supplement, v1.0.82

The owner's 7 October photographs guide a finite refinement of Steglitzer
Kreisel, its immediate surroundings and Schloßstraße. The surrounding packet
builder owns the street network, square paving and ordinary urban blocks.
`SteglitzV182.ts` owns only the named source buildings and memorial below.
The photographs remain reference-only. Photo 2 is an unrelated worksheet and
was not used. No photographic pixels or texture files are added.

## Metric sources and ownership

All six selected Berlin LoD2 parents retain their complete wall and roof
surfaces, not a bounding box. Ground datum translation is rigid per parent;
all original roof-height differences, setbacks and courtyard holes remain.
Source URLs, ZIP hashes, part counts and source-surface hashes are recorded in
`steglitzV182Evidence.json`. The 71 parts are:

| Building | LoD2 parent | Complete parts |
|---|---|---:|
| Gutshaus Steglitz / Wrangelschlösschen | DEBE06YYB0000Ele | 2 |
| Rathaus Steglitz | DEBE06YYB0000N1G | 7 |
| Das Schloss shopping centre | DEBE06YYB00001xV | 36 |
| Gymnasium Steglitz, main building and extension | DEBE06YYB0000AUq | 20 |
| Gymnasium sports hall | DEBE06YYB0000nL1 | 5 |
| Gymnasium service building | DEBE06YYB0000nx8 | 1 |

The three distinct Kreisel volumes retain their exact mapped OSM footprints
and explicit metric heights from the retained Geofabrik extract:

- `way/34782008`: stepped tower footprint, 118.5 m, 30 storeys.
- `way/34782007`: separate low podium, 6.5 m.
- `way/34782006`: separate Kreisel-Parkhaus, 28 m.

They are not confused with **Das Schloss** (`way/28504291`), **Rathaus Steglitz**
(`way/28504290`) or the historic **Gutshaus** (`way/35265860`). The school site is
`way/387263944` at Heesestraße 15; its four actual building owners are
`31544586`, `35607217`, `35607218`, `387263943`. The adjoining former post office
and office building merely touch the site boundary and are not school owners.

`geo_data/regierungsviertel/steglitz-v182-exclusions.geojson` records precisely
these full source owner footprints, their IDs and replacement policy. Only
corresponding new generic masses may be suppressed. Existing detailed city
assets are not altered by this module. Navigation uses the 71 original part
footprints with holes, the three Kreisel masses and the narrow memorial;
it does not block the whole square or school courtyard.

## Authored recognition and its limits

Thin floor bands, scaffold uprights and diagonals follow every stepped edge
of the Kreisel footprint. The muted dark shell, exposed grid, fixed lattice
crane and counterweight follow the owner's photos 1, 3, 4 and 5. Crane placement,
height, 62 m jib and framing subdivisions are explicitly visual estimates,
not a construction survey or a claim about the site's future appearance.

The Rathaus source stops at the broad gabled tower roof, 41.342 m above its
normalised ground. The narrow upper lantern and needle visible in the credited
reference are added without removing that roof. The 56 m overall height is
published in [Rathaus Steglitz](https://de.wikipedia.org/wiki/Rathaus_Steglitz);
the small upper subdivisions are photographic recognition estimates. This
source conflict remains explicit rather than scaling or distorting the whole
measured building.

Window rhythm, thin sills and subdued material colours are illustrative facade
subdivisions. They follow source wall planes and stop at their boundaries;
they are not claims of measured individual windows or current shop tenants.
The historic school and Gutshaus retain their real pitched roof silhouettes;
Das Schloss keeps all roof parts, recesses and its own building identity.

## Spiegelwand

The memorial stands at exact OSM way `775632534`. The nine 1 m wide mirror
panels, 3.5 m tall, follow the dimensions documented by Susanne Kähler / Rieke
Fender in [Spiegelwand, Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/spiegelwand-5559/),
accessed 7 October 2026. The mapped long-axis direction is retained, with the
published total width used around the mapped centre. Thin field marks indicate
etched inscriptions without inventing or reproducing names, texts or photos.
The polished-steel colour uses no reflection render target or extra city copy.

The [district's memorial account](https://www.berlin.de/ba-steglitz-zehlendorf/politik-und-verwaltung/beauftragte/antisemitismus/artikel.1587208.php)
identifies it as a memorial to deported Jewish people and the former synagogue;
it is not a generic sculpture or an imagined preserved synagogue building.

## Visual reference credit

Colin Smith, *Rathaus Steglitz (Steglitz Town Hall)*, 1 August 2012,
[Wikimedia Commons / Geograph Deutschland](https://commons.wikimedia.org/wiki/File:Rathaus_Steglitz_(Steglitz_Town_Hall)_-_geo.hlipp.de_-_26651.jpg),
[CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0/).
External visual QA for red brick, dark roof and narrow upper lantern/needle.
No pixels are bundled; independently authored geometry remains source-bound.

Other identity references:

- [Gymnasium Steglitz](https://gymnasiumsteglitz.de/kontakt-kollegium): Heesestraße 15.
- [Gutshaus Steglitz, district inventory](https://www.berlin.de/ba-steglitz-zehlendorf/ueber-den-bezirk/sehens-und-wissenswertes/bezirk-kompakt/index.php/detail/22).
- [Rathaus official monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065628).

## Runtime and validation

Drawn desktop and touch use identical arrays. Three renderables contain the
complete shells, source edges and one instanced facade/scaffold batch. Native
Minecraft uses one independent, axis-aligned exterior skin. Adjacent identical
unit cubes are merged along X, Z and Y without filling gaps or changing the
cube union; this avoids tens of thousands of unnecessary roof instances.
The final drawn model uses 812,424 geometry/instance bytes in three calls;
the native model uses 2,147,344 bytes in one call (28,246 merged boxes).
No hidden solid interiors, reference images, animated crane or mirrors are
allocated. Both variants are statically frozen and use the existing lazy
landmark-module lifecycle.

Tests cover exact source-owner exclusions, all 71 retained source parts,
separate Kreisel heights, memorial size, source roof queries, equal touch
detail, bounded buffers and native orthogonality. The native merge has an
independent exact occupied-cell-union test. Isolated Chrome previews check
both representations with no page errors. Three focused Python tests, two Bun
tests (113,015 assertions), TypeScript through Bun and scoped Ruff pass;
integration, full application tests and publishing
remain with the release owner.

Reproduce after the retained source caches are present:

```sh
uv run python scripts/build_steglitz_v182.py
uv run pytest tests/test_steglitz_v182.py
cd src/app
bun test tests/steglitz-v182.test.ts
```
