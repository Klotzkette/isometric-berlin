# Museum Island open colonnades — v231

This finite correction concerns the historic galleries around the Alte
Nationalgalerie courtyard, including their curved northern head. It does not
replace the museum, its existing entrance portico, the James-Simon-Galerie, or
the adjacent modern colonnade.

## Evidence and geometry

The [SPK restoration announcement of 29 August 2024](https://www.preussischer-kulturbesitz.de/pressemitteilung/artikel/2024/08/29/kolonnaden-der-museumsinsel-berlin-fertiggestellt.html)
confirms the reopened northern pavilion and gallery, removal of the later
two-storey infill, and three domed pavilions along the Spree. The
[SPK interview with the restoration architect](https://www.spkmagazin.de/2024/hoechste-kunst-im-schoensten-mondlicht.html)
describes the restored coffered ceilings, existing and replacement stone, and
unobstructed northern route. The
[2010 SMB restoration dossier](https://www.smb.museum/fileadmin/website/Presse/Pressematerial/2010/06/100604_2_Kolonnadenhof.pdf)
places the three pavilions at the two ends and midpoint of the Spree gallery.
No reference photographs are bundled or used as textures.

The retained source file is
`geo_data/regierungsviertel/colonnades-v231-source.json`. It contains all 113
original LoD2 sheets from `DEBE00YYkm000061` and `DEBE01YYK00004G1`, tile
`391_5820`, and both complete OSM roof outlines, ways `133885752` and
`133887411`. Their source versions, URLs and hashes are recorded there.

Every measured roof triangle remains at its original horizontal coordinates.
One common vertical translation of +0.819 m aligns the source with the existing
city datum: roof tops are 13.459 m and 13.350 m. Complete original lower wall
sheets remain in the evidence, but their closed LoD2 interpretation is not
rendered below the gallery. Only their upper 0.66 m fascia is displayed. The
documented open column construction replaces the false infill. The additional
western OSM roof outline and the small differences between the two source
outlines are retained as a thin roof complement rather than discarded.

Column spacing and section, fluting, cushion capitals, abaci, coffer dimensions,
the uniform 5.22 m display floor, stone tones, pavilion cap rise and the fine
placement of those details are explicitly estimated source-bound recognition
details. They are not survey measurements. The result has 280 separate columns
and six open gallery routes. The native version uses independent axis-aligned
blocks, including stepped pavilion caps; it does not reuse rotated drawn
members or smooth columns.

## Exact replacement and navigation

Only complete original core rows **33885752** and **33887411** may transfer.
`colonnadesCorePreviousV231.json` retains those original rows and the signatures
of 200 uncontested native columns. Full recursive row equality is required;
changing even a height or colour disables that owner's transfer. Native row
replacement also protects subsequently introduced overlapping neighbours.
Adjacent core owner **42698898** is expressly untouched. There are no
surrounding-packet transfers for this change.

The required replacement must be available before enabling any old-owner
filter. Both closed core collision bodies, including their false 8.2 m roofs,
must then be excluded using the same exact predicate. The new collision consists
of individual columns, paving and thin overhead roofs. `GroundAt` only returns
supports at or below the pedestrian's feet plus 0.45 m, so entering a gallery
does not move a walker to its roof. The independent native collision index
contains typed box bounds and local spatial buckets, not retained renderer rows.

Integration APIs:

- `createMuseumColonnadesV231(native = false)` from `MuseumColonnadesV231.ts`.
- `isColonnadesCorePrismV231(prism)` and
  `createColonnadesCoreColumnTesterV231(prisms, cellM)` from
  `colonnadesCorePreviousV231.ts`; contracts match the v227 townhall helpers.
- `museumColonnadesV231GroundAt(x, z, feet, native = false)`,
  `museumColonnadesV231RoofAt(x, z, native = false)` and
  `museumColonnadesV231SolidAt(x, y, z, radius = 0, native = false)` from
  `museumColonnadesV231Navigation.ts`.
- Register only the construction JSON `colonnadesV231.json` field `sites` as
  a weak/lossless field. Navigation and exact original-row receipts remain small
  independently retained records. No module captures a decoded construction site.

## Cost and verification

Drawn has three static draw calls; native has one, with 5,406 final-sized
instances. Both have bounded frustum culling and under 600 KB of static geometry
and instance buffers in the regression audit. No textures, update callbacks,
runtime budget increases, mobile detail reductions, or source tile changes are
introduced. The three runtime records total 464,859 bytes uncompressed and
84,783 bytes with individual gzip compression at the audited revision.

Replay with `uv run python scripts/build_colonnades_v231.py` and
`uv run python scripts/build_colonnades_core_previous_v231.py`.
The three Python tests verify deterministic replay, complete source roofs and
mapped complements, finite scope, and absence of lower infill. Five Bun tests
verify actual geometry buffers and ray intersections, six open walking routes
in both modes, support without upward teleport, and exact owner/native transfer
with preservation of changed and unrelated neighbours. Ruff passes for the
new Python files. Three additional integration tests exercise the real core and
distant constructors, preview hide/restore lifecycle and collision compiler;
the retained complement is byte-equivalent, including an altered original and
the neighbouring modern colonnade. Parent integration owns the final full build and real browser
views.

World horizontal bounds: `[1736.042, -250.940, 1927.675, -46.428]`.
Suggested actual browser cameras (`eye`, `target`):

- Overview: `[2000, 105, -40]`, `[1842, 9, -142]`.
- Courtyard close view: `[1868, 10, -101]`, `[1890, 9, -153]`.
- Curved northern head: `[1850, 13, -270]`, `[1810, 9, -239]`.

Walkable route samples are recorded in `colonnadesV231Navigation.json`; they
are QA reference positions, not new selectable destinations or UI labels.
