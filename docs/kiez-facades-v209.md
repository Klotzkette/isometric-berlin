# Moabit, named Prenzlauer frontages and Helmholtzplatz — v1.0.109

Pipeline step 10. The request covers all of Moabit and the named
Weinbergsweg/Kastanienallee, Kollwitzplatz/Kollwitzkiez and Helmholtzplatz
areas. Existing detailed core facades gain a restrained ink refinement; 14
independent companion packets add modest source-bound exterior details to
eligible ordinary outer-city walls. No coverage, navigation footprint, tour
stop, mobile quality tier or residency budget is added.

## Exact coverage

| Area | Ordinary house owners / street fronts | Treatment |
| --- | ---: | --- |
| Moabit | 264 | Keep every v188 pane and add small sills/crossbars |
| Weinbergsweg / Kastanienallee | 19, all on Kastanienallee | New estimated panes/sills/eave/base accents |
| Kollwitzkiez | 190 | Same modest new frontage recipe |
| Helmholtzplatz perimeter | 102 | Same modest new frontage recipe |
| Total | **575 distinct official source owners** | One selected exposed street frontage per owner |

The full exact ALKIS Moabit Ortsteil is searched, without a house quota.
Moabit's existing detailed core and Weinbergsweg already have facade-axis
geometry and receive only the separate material refinement. Consequently,
575 does **not** mean every building in the requested neighbourhoods has newly
surveyed window positions. Protected named/public owners, recorded material or
colour, short/oblique/occluded/elevated walls and courtyards keep their earlier
presentation. The frozen selection scans 2,129 navigation building records,
including source parts at tile boundaries; 858 are protected by source identity
or OSM semantics. The 264 Moabit frontages are exactly the earlier v188 set.

Some ordinary, unprotected street-facing walls also remain blank. Moabit
examples include `DEBE01YYK0002UmB` with street-facing source segments under
7 m, `DEBE01YYK0002T2M` with directional alignment 0.64 below the 0.80 threshold,
and `DEBE01YYK0002Q1G` with sampled walls over 30 m from eligible streets.
These conservative selection omissions remain visible: area-wide scanning does
not provide continuous facade coverage. Version 209 retains these walls'
earlier surfaces.

Moabit streets: Beusselstraße, Bredowstraße, Stromstraße, Emdener Straße,
Wilhelmshavener Straße, Wiclefstraße, Sickingenstraße, Siemensstraße,
Rostocker Straße, Ufnaustraße, Birkenstraße, Unionstraße, Putlitzstraße,
Berlichingenstraße, Oldenburger Straße, Waldstraße, Wittstocker Straße,
Bremer Straße, Huttenstraße and Quitzowstraße.

The finite Kollwitz selection uses Kollwitzstraße (45), Wörther Straße (26),
Rykestraße (29), Knaackstraße (23), Sredzkistraße (36), Husemannstraße (25)
and Diedenhofer Straße (6). The Helmholtz perimeter uses Lettestraße (6),
Dunckerstraße (22), Schliemannstraße (28), Raumerstraße (25) and Lychener
Straße (21). Versioned selection limits and every exact owner, source-wall
endpoint, road ID and omitted window column remain in the context/evidence.

Every ordinary frontage must match both original quantized wall triangles in
its unchanged city packet. A mapped named street must be 3–30 m away and face
the wall; five outward samples and the complete street sightline must be clear.
Every new sill/window column also receives a full-width 1.56 m outward clearance
test. Sills and crossbars protrude only 0.11 m. Old window rectangles are never
painted over. Missing openings, storeys and historical ornament are not inferred
as surveyed facts. The original OSM colours/materials remain untouched.

`kiezFacadePresentationV209.ts` affects only the existing generic `LoD2 facade
axes` shader. The four finite display rectangles enclose the requested areas;
they can touch adjoining existing blocks and are not administrative boundaries.
Previously stronger urban contrast wins. There are zero additional line
vertices, attributes, textures, draw calls or per-frame CPU work from this hook.

## The two houses at Helmholtzplatz

The [district's account](https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/ausstellung/artikel.1513033.php)
distinguishes **Kiezkind**, the family café in the former electrical transformer
house, from the **Platzhaus**, the neighbourhood meeting house. The
[Platzhaus operator](https://platzhaus-helmholtzplatz.de/die-idee/) confirms its
community role; [visitBerlin](https://www.visitberlin.de/de/kiezkind-im-prenzlauer-berg)
describes Kiezkind's family/play offering at Helmholtzplatz 1. Neither building
is labelled as a kindergarten. No toys, people, shop lettering or graffiti are
invented.

- Kiezkind: retained OSM **way/35605731**, official parents
  `DEBE03YY60001rGC` and `DEBE03YY6000002o`. All four original LoD2 parts and
  every wall/roof point remain, with their relative source-ground offsets.
  The complete measured shapes replace only their matching coarse packet
  envelopes. Pale eaves, glazing, narrow transoms, sills and orange fins are
  explicit appearance estimates guided by the freely licensed 2005 reference,
  not a claimed 2026 colour survey.
- Platzhaus: retained OSM **way/35605732**, exact official parent
  `DEBE03YY60000DEJ`. The LoD2 record has a 12.071 m asymmetric gable, with
  source ground 23.790 m, eaves 29.496–33.234 m and ridge 35.861 m in the
  viewer elevation convention. This is a real source conflict, not an origin
  conversion mistake. OSM records one storey; the free contextual photo shows
  the separate low, flat-roofed Platzhaus beside the transformer building.
  The bounded correction retains **every original source XZ point**, assigns
  a flat **3.4 m estimated height**, and retains all eight original wall/roof
  sheets unchanged in the source receipt. This is a documented interpretation,
  not a replacement height survey. Only the exact old owner is transferred.

`helmholtz-sites-v209-source.json` contains all **five original parts / 40
surfaces**, exact OSM polygons/tags, source archive hashes and the height
decision. `kiezSitesOwnershipV209.json` fingerprints the exact old position and
colour arrays, identifies **295 coarse triangles** across the two mode families
and **24 old roof-ink segments**, and preserves both original navigation records.
The runtime transfer must be guarded by those fingerprints. Only the
Platzhaus height changes in navigation; every ring/hole and unrelated owner
remains intact. No old packet file is rewritten.

The tiny shell factory `createHelmholtzEnvelopesV209(native)` is required before
the transferred packets become visible. The separate
`createKiezFacadesV209(native)` contains only additive facade fittings.
Minecraft uses an independent orthogonal surface skin and orthogonal facade
members, with no smooth double or filled interior volume.

## Sources and free-reference credits

Geometry uses retained Berlin LoD2 archive `LoD2_392_5822.zip`
(Geoportal Berlin, dl-de/zero-2-0). Generic walls remain the original immutable
city-packet geometry. Selection uses the retained Geofabrik Berlin extract
dated 29 September 2026 (OpenStreetMap contributors, ODbL-1.0) and the prior
official ALKIS Ortsteil geometry (dl-de/zero-2-0).

Two external images by **Mazbln**, both dated 19 August 2005 and licensed
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/):

- [Helmholtzplatz Trafohaus.jpg](https://commons.wikimedia.org/wiki/File:Helmholtzplatz_Trafohaus.jpg):
  low transformer/café shape, orange fins, pale eaves and glazing.
- [Helmholtzplatz Mitte.jpg](https://commons.wikimedia.org/wiki/File:Helmholtzplatz_Mitte.jpg):
  contextual view of both distinct houses and the low flat Platzhaus roof.

The photos were inspected externally and remain reference-only. No pixels,
protected graffiti, signs, image textures or artworks from them are distributed.
Per-file credits are retained in the source record for the shared attribution
manifests. The 2018 general park photo inspected during identification did not
resolve the houses and contributes no model appearance.

## Delivery, budgets and verification

The generic companion meshes contain 8,790 window locations with new detail,
including the retained v188 window locations, and 2,243 corresponding native
locations. The complete additional drawn family is **1,382,580 bytes** of
geometry and **563,110 compressed bytes**; the separate native family is
**201,120 geometry bytes / 73,499 compressed bytes**. They share the existing
serial fetch/decode/eviction queue and its unchanged **24 MiB** target. The
fourteen additions bring the descriptor inventory from 1,891 to **1,905**,
below the unchanged 2,048 limit. Companion navigation is empty.

The two tiny named models together use **2 draw calls / 19,120 bytes** drawn,
or **2 calls / 33,596 bytes** native. The drawn envelope has 88 triangles and
the additive detail 118 instances; native uses 115 exterior shell blocks and
310 detail instances. Both touch and pointer receive identical drawn detail.

Reproduce with `uv run python scripts/build_kiez_facades_v209.py` and
`uv run python scripts/build_helmholtz_sites_v209.py`. The former emits an
explicit manifest patch; neither script mutates an old city packet or the shared
manifest. Frozen context/source records avoid repeated raw-data extraction.

Focused checks: five Python tests verify all old descriptors, exact source
walls, bounded empty-navigation companions, orthogonal native faces, immutable
owner transfers, unchanged source XZ/complete Kiezkind geometry and the single
height correction. Four Bun tests verify static exact-capacity buffers, both
mode budgets, identity/height semantics and the finite idempotent shader hook.
Both focused suites pass; no full build or whole-city audit was run for this
bounded subtask. Integrated browser review is recorded by the release task.

Useful viewer-space targets (x, y, z):

| View | Target | Suggested camera |
| --- | --- | --- |
| Moabit western streets | -2650, 14, -1510 | -2470, 170, -1310 |
| Kastanienallee | 2637.3, 14, -2098.5 | 2570.7, 75, -2142.8 |
| Weinbergsweg | 2390, 14, -1180 | 2510, 110, -1040 |
| Kollwitzplatz | 3180, 14, -2080 | 3340, 150, -1910 |
| Helmholtzplatz houses | 3316, 5, -2573 | 3365, 45, -2514 |
