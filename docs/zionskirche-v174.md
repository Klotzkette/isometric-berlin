# Zionskirche: retained survey and missing 67 m silhouette

Step 10 adds a texture-free recognition overlay for Zionskirche, OSM way
`27685450`, Berlin heritage object `09011312`. The complete existing Alt-Mitte
v169 source owner stays unchanged. No road, terrain, source building packet,
roof, source colour, courtyard or navigation polygon is removed.

## Source contract

The retained Berlin LoD2 parent is `DEBE01YYK0000014`, tile `391_5821`.
Its four parts are `DEBE3DMTn7l5hBAe`, `DEBE3DbSb0cJwbVg`,
`DEBE3DwWmZ1lKvwB` (nave and apse) and `DEBE3Dj5UEZckkkC` (tower).
They retain all 228 source boundary polygons, including all eight roof
polygons, and their 1,113.259 m² source footprint. The official download is
[LoD2_391_5821.zip](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5821.zip),
licensed dl-de/zero-2-0. OSM identity remains ODbL 1.0 context.

The already-published source record is in
`geo_data/regierungsviertel/alt-mitte-v169/source-391_5821-00.json.gz`.
It uses a ground of 53.332 m NHN and the existing outer-city display ground
`y=3 m`, through an offset of `-50.332 m`. This overlay reads that transform;
it does not introduce another terrain datum. Source archive and record
SHA-256 hashes are recorded in
`src/app/src/data/zionskircheV174Evidence.json`.

The LoD2 tower ends at 48.126 m above ground (`y=51.126`), whereas the
[church operator](https://www.elisabeth.berlin/de/kulturorte/zionskirche)
publishes a 67 m overall tower height. The missing upper silhouette is
therefore added to world `y=70 m`, with a slender octagonal masonry spire,
blind panels, ribs, base roundels and a small cross. The existing roof remains
behind the added upper cornice. The displayed 18.874 m difference is not a
new survey of the spire alone.

The [Berlin heritage entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011312)
documents the compact Latin-cross plan, front tower, large semicircular apse,
Lombard Romanesque portal and dwarf galleries, and open upper stages beneath
an octagonal crown. The
[Deutsche Stiftung Denkmalschutz](https://www.denkmalschutz.de/denkmal/zionskirche.html)
describes the light-banded brick, galleries above round-arched tracery windows,
square lower tower and octagonal belfry. The complete surveyed nave, transept,
apse and roof form remain the geometric anchor.

## Visual interpretation and licensing

Two inspected external photographs guide independently authored recognition
detail. Neither image nor a crop, texture, pixel atlas or font is bundled or
loaded by the viewer:

| Reference | Credit and licence | Used cues |
|---|---|---|
| [Zionskirche, Berlin-Mitte, Kirchturm](https://commons.wikimedia.org/wiki/File:Zionskirche,_Berlin-Mitte,_Kirchturm.jpg) | Ansgar Koreng, [CC BY 3.0 DE](https://creativecommons.org/licenses/by/3.0/de/) | Masonry spire, ribs, blind panels, roundels, paired belfry openings, triple upper arcades and finial |
| [Zionskirche in Berlin-Mitte](https://commons.wikimedia.org/wiki/File:Zionskirche_in_Berlin-Mitte.jpg) | Roland Arhelger, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Clocks, entrance, pale bands, galleries, arched glazing and column groups |

Published facts and source coordinates are distinct from unsurveyed detail:
exact window, gallery and clock subdivisions, cornice levels, clock hands,
decorative radii, material swatches and finial branches are procedural
approximations. This is a source-bound recognition model, not a measured
architectural restoration model. The current source roof and complete city
remain intact; no unpublished historical roof is invented.

## Additive construction and runtime

The earlier generic Alt-Mitte facade details reach at most 0.125 m beyond a
source plane. The new brick backing is 0.22 m outward, with the documented
round arches, tracery, portals, pale bands and galleries above it. This covers
generic rectangular window marks without deleting their source packet or
replacing a measured shell. A thin upper fascia covers the visibly oblique
coarse terminal tower roof beneath the continuous cornice. It preserves that
roof and removes the artificial gap below the spire.

`ZionskircheV174.ts` exposes `createZionskircheV174` and
`createMinecraftZionskircheV174`. Both accept the optional `mobileLike` flag
but keep the complete same static detail for touch and pointer. The drawn
model is three batches: merged coloured surface panels, box instances and
rod instances. The existing Vite lossless JSON transform keeps large fields
lazy; the render budget reads only scalar evidence metadata.

`zionskircheV174Profile.ts` is a small eager contract with no geometry JSON
import. `zionskircheV174RoofAt(x,z,minecraft)` contributes only the new upper
spire roof. Existing source building collision and roof navigation remain
authoritative below it. Minecraft construction registers exact quarter-metre
roof cells for the authored upper native solids, including the cross.

Minecraft uses separate orthogonal facade cells and a stepped spire. One
0.5 m grid avoids coplanar colour conflicts; the small cross uses 0.25 m cells.
Adjacent equal-colour cubes in the same vertical column are coalesced into
rectangular native runs. This preserves the exact occupied-cell union and
does not bridge gaps or create hidden solid infill. Existing Alt-Mitte native
source geometry remains beneath the overlay. No smooth addition is displayed
in Minecraft.

Measured additional budgets:

| Representation | Batches | Geometry | GPU attribute/index/instance bytes |
|---|---:|---|---:|
| Drawn, touch and pointer | 3 | 4,212 triangles; 950 boxes; 11,106 rods | 1,372,904 |
| Minecraft, touch and pointer | 1 | 44,298 occupied native cells compressed to 5,677 vertical runs | 432,100 |

The source data additions are approximately 1.67 MB drawn JSON, 270 KB native
JSON and 3.5 KB evidence before static-host compression. No eager navigation
copy of these arrays is introduced.

## Reproduction and verification

Run `uv run python scripts/build_zionskirche_v174.py`, using the committed
Alt-Mitte source record and ignored official archive. Only the three
`zionskircheV174*` data payloads are written. The generator never edits shared
source packets, attribution files, the tour catalogue or bounds.

The focused TypeScript tests check the exact datum/IDs, source ownership,
67 m silhouette, texture absence, identical mobile geometry, allocation
budgets, orthogonal native matrices, distinct occupied cells after run
compression and roof-query agreement with every upper native solid. Python
tests verify the unchanged source record hash, deterministic regeneration,
explicit source conflict and both visual-reference licences.

Standalone front, rear and tower views were inspected against the references;
the integrated release review additionally checks the assembled Day and
Minecraft city. Remaining limitations are the official coarse roof geometry
and explicitly estimated fine proportions, not missing source geometry.
