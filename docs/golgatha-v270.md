# Tacheles church skyline / Golgathakirche v270

The user's ten Tacheles photographs were checked against existing complete
models, the source footprints and public primary photographs. Photos 1/2 show
the Sophienkirche's green Baroque tower next to the Neue Synagoge. Photos 4/6
show the more distant Zionskirche. The nearby red-brick, long-pointed tower in
photos 5/6 is **Golgathakirche, Borsigstraße 6**, LDA 09080455. It is not the
St.-Adalbert church at Torstraße 168 or a hospital tower. The separately visible
very distant thin red tower is not confidently identified and receives no edit.

The established Zion v174 (67m), Sophien v228 (69m), Neue Synagoge v167 and every
other complete previous model remain unchanged. Golgatha alone has a confirmed
gap: the retained LoD2 tower ends at world Y51.336 in a broad two-plane gable,
while the photographs show a much taller steep slate helm, four small corner
pinnacles, clock gables and paired belfry arches. The new geometry represents
those specific visible forms. No historical destroyed nave gable is recreated.

## Evidence and limits

* [Landesdenkmalamt, Golgathakirche 09080455](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080455): address, architects, 1898–1900, brick Gothic church and lateral tower.
* [LDA exterior photograph, marked LDA 1998](https://denkmaldatenbank.berlin.de/media/uploads/Mit/03/09080455.jpg): inspected directly; paired arched bell openings, clock gables, corner pinnacles and steep main helm. Credit **Landesdenkmalamt Berlin, 1998; individual photographer not specified on image**. Reference only, no photograph bundled or used as texture.
* [Kultur Büro Elisabeth, Golgathakirche](https://neu.elisabeth.berlin/de/kulturorte/golgathakirche): primary operator identity and current use. The page credits the exterior views to **Maschalsky**; none is redistributed.
* [Berliner Architekturwelt 3 (1901), p.349ff., ZLB](https://digital.zlb.de/viewer/fulltext/14192916_1901/360/): contemporary description and illustrations, with side tower and red Rathenow brick. Historical documentation supports identity/material only; the current photographs govern exterior form.
* [Berlin.de Sophienkirche](https://www.berlin.de/sehenswuerdigkeiten/3559916-3558930-sophienkirche.html) and [Berlin.de Zionskirche](https://www.berlin.de/sehenswuerdigkeiten/3561891-3558930-zionskirche.html): existing 69m/67m profiles confirmed.
* The widely published 61m Golgatha overall height is a contextual cross-check, e.g. [Entwicklungsstadt, 19 August 2026](https://www.entwicklungsstadt.de/historische-golgathakirche-umbau-soll-neue-nutzungen-ermoeglichen/), **not a newly verified primary survey**. The modeled upper levels (belfry 33.2–39.4, clock gables to 43.6, corner pinnacles 47.1, helm/terminal 66.2 world Y) are explicitly photo estimates. Original ground Y5.2 and original lower sheets are measured-source values. Reference review: 2026-10-25.

## Exact source preservation

Owner `DEBE01YYK000002g`, original core prism `69726934`, has eight measured
parts / 112 retained source surfaces. Only tower leaf `DEBE3Dwcdzr9GoF6` has any
source geometry above world Y33.2; all seven other parts top out below this cut.
The exact triangle receipt covers 21 drawn shell triangles, 28 streamed facade
triangles, 294 native triangles and 17 ink segments. Each crossing triangle's
lower complement is republished in the same world coordinates. Its masonry
color follows the separately receipted brick correction; other colors retain
the exact original linear bytes. Crossing ink gets its unchanged lower segment.
All unselected triangles and source archive/packet bytes remain unchanged and
are SHA-256 checked. This is an upper proxy correction, not deletion of a
church, roof family, source owner or neighboring building.

`build_golgatha_v270.py` reproduces the complete original native owner before
matching; original 2m native merging therefore cannot accidentally select a
different representation of the tower. New native geometry is generated on an
independent 0.5m world-cardinal grid; openings and clocks lie on its actual
cardinal wall planes. Source fragments are preserved on their original grid.
There is no diagonal mesh, texture, image, animation, light or frame callback in
native mode. Both modes carry the same detail on touch/mobile.

## Integration and navigation

Required factory `createGolgathaV270(native=false)` must finish before enabling
`golgathaV270` packet ownership. `golgathaV270Ownership.ts` exposes the bounded
exact fingerprint transfers `transferGolgathaTrianglesV270` and
`transferGolgathaLinesV270`. Changed payload fingerprints retain their old
geometry. Enable the flag consistently in drawn core, native core and stream
builder. No source-prism/voxel suppression or new stream package is required.

Only `isGolgathaPreviousPartV270(part)` may replace the corresponding exact
Alt-Mitte navigation leaf. `golgathaSolidsV270(native)` returns lower source
shaft and upper roof solids, each with ring/holes/minY/maxY/sourceId; the upper
solid has `topAt`. Register both modes with live visual-mode gates. The new
roof uses the same triangles or native column heights as rendering. There is
no newly claimed pedestrian entrance, and ground surfaces remain untouched.

## Sight axes and bounded QA

Approximate photo-origin camera: eye `[1139.55,33,-709.5]`. It is an estimated
Tacheles viewing position, not extracted photo GPS. Bearings/distances in the
world frame are Golgatha 26.19° / 422.5m, Zion 48.44° / 1466.7m and
Sophien 91.21° / 806m. This left-to-right ordering matches the supplied photographs.
Suggested target for the nearby red spire: `[1326.05,54,-1088.60]`.

Local church camera: eye `[1277,52,-1059]`, target
`[1326.05,43,-1088.60]`. Both church sight lines were checked against every
retained source footprint/top in 390_5821; no neighbor blocks the line. QA must
include actual Alt-Mitte cell 2_-3 core and stream facade packets, both modes,
and the required transfer flag. Root owns IAB screenshots and release checks.

Current model: 1536 drawn / 2351 native triangles, 3 drawn / 2 native draw calls,
approximately 115KB runtime geometry JSON. Existing residency, decode, prefetch
and coverage budgets, mobile quality and 93 tour identities are unchanged.

Focused verification: `tests/test_golgatha_v270.py` checks immutable complete
owner, every unowned triangle, lower source colors, exact masonry-color ownership and orthogonality;
`src/app/tests/golgatha-v270.test.ts` checks construction, exact fail-closed
transfers and roof navigation in both modes.

The additional `golgatha-navigation-v270.test.ts` uses full original voxel/prism inputs and preloaded Alt-Mitte navigation. Borsigstraße `[1310,-1094]` → `[1321,-1076]` passes without respawn, jump or ground-height discontinuity in day → native → day. The new helm blocks at 60m and clears at 66.3m; an off-centre 65m summit probe distinguishes the two live roof profiles. Final focused result: 5 Python tests + 6 Bun tests passed; Python formatting/lint passed.

## Final material correction after contextual IAB review

The old lower tower and church masonry was pale in the inherited source palette. The photographed red brick now continues through that unchanged lower geometry. `applyGolgathaColoursV270` uses immutable packet fingerprints and precise source-material incident-face receipts through the existing bounded appearance decoder. It changes only RGB cells, after generic appearance recipes. Every vertex incident to a foreign or non-masonry triangle is excluded. Roof and window colors, all positions, indices, original source files and all eight source parts remain unchanged. This adds no draw calls or geometry. The copied lower tower fragments use the same corrected masonry color. Original generic lower windows remain present; no unproven new portal or opening is introduced.

Color audit `(mode, source masonry triangles, repainted vertices, excluded shared vertices)`: [('drawn', 196, 235, 1), ('minecraft', 1078, 835, 0)].
