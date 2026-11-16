# Grunewald: measured excursion venues and retained lake geography

V354 replaces three individually matched fallback building bodies at the
Schlachtensee and Grunewaldsee: Fischerhütte, Alte Fischerhütte, and the main
Villa Paulsborn / Locanda 12 Apostoli. Their former uniform 9 m Drawn prisms
(8 m Native prisms) give way to the official multi-part roof and wall surfaces.
This is a local architectural correction, not a reconstruction of every business
or a new version of the entire forest terrain.

The complete official source parents are retained in
`geo_data/regierungsviertel/grunewald-venues-v354-source.json.gz`. The Fischerhütte
parent `DEBE06YYA000044F` contains four leaves: only `DEBE3DX5V7WQi7xu` and
`DEBE3DhoByTOHyrA`, each independently matching its named OSM building with over
99% footprint overlap, replace their old owners. Its service annexes remain
unchanged. Paulsborn uses all seven leaves of `DEBE06YYA0000LNp` plus the measured
chimney `DEBE06YYA000377J`. All 276 official wall/roof triangles
survive in Drawn with one disclosed vertical translation per matched building.

The vertical anchor is the existing V190 terrain anchor, not a new invented
height. Exact relative LoD2 heights are preserved. Narrow foundation walls on
the exact building footprint extend below the minimum of the existing DGM
surface; they do not flatten the ground or create an apron. The minimum is
computed from actual intersections with the piecewise-linear field, or every
intersecting eight-metre Native terrain cell. Existing raised ground remains
visible where it meets a building. The two modes have independent geometry and
roof-aware navigation. Native uses one-metre cardinal source surface cells;
its roof caps describe the rendered roof cells.

## Geography

`grunewald-geography-v354-audit.json.gz` preserves the full original geometry,
holes and level of all five V190 main lakes and 32 additional mapped water
owners. Schlachtensee, Krumme Lanke, Grunewaldsee, Hundekehlesee and Teufelssee
remain distinct. Pechsee, Barssee and the smaller retained ponds also remain.
Koenigssee, Dianasee and Nikolassee are distinguished from the five-lake DGM
subset, district boundaries and station polygons.

The official water profile identifies the Wolfsschluchtkanal and Fenngraben
connections. The retained source also distinguishes the culverted section from
open water. Riemeisterfenn, Langes Luch and Hundekehlefenn are wetlands or nature
reserve boundaries, not permission to fill their complete outlines with water.
The audit retains 23 source records making these distinctions. No lake ring,
water height, terrain vertex, shore wall, path or road is changed by this pass.

## Sources and limits

- [Official Berlin Grunewald Natura 2000 maps](https://www.berlin.de/sen/uvk/natur-und-gruen/naturschutz/natura-2000/natura-gebiete/grunewald/)
- [Official Schlachtensee water profile](https://www.berlin.de/lageso/gesundheit/gesundheitsschutz/badegewaesser/badegewaesserprofile/artikel.339152.php)
- [Official Hundekehlegraben documentation](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/wasserbau/entschlammungsprogramm/hundekehlegraben/)
- [Fischerhütte operator](https://fischerhuette-berlin.de/), including the terrace photograph of the old ochre house with green frames and tiled roof.
- [Locanda 12 Apostoli operator](https://www.locanda-12apostoli.de/), including its garden-facing pale plaster, large windows and portal photographs.
- [Landesdenkmalamt: Forsthaus Paulsborn](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075450), including the LDA archive photograph from 2008 and the description of the two-storey, roofed ensemble.
- Geoportal Berlin LoD2 tiles `379_5812` and `381_5814`, retained URL and SHA-256 per full source parent; `dl-de/zero-2-0`.
- Existing OSM building and water outlines, ODbL-1.0; original owners and complete old production receipts retained.

These photographs inform material families and window treatment. The 107 window
openings use conservative estimated spacing clipped to actual source walls;
they are not a measured facade survey. Window frames, glazing and mullions are
disjoint pieces. The source does not justify invented interiors, new restaurants,
seasonal kiosks, boats, tables, doors or new shore paths, so none are introduced.
Photographs are references only and are not bundled as textures.

## Runtime and proof

`GrunewaldVenuesV354.ts` supplies six exact source-quarter keys over two existing
primary hosts and their existing Native V190 companions. No descriptor, live
budget, timer, resident cache or GPU lifetime is added. Two compressed recipe
files total **112,557 bytes**; decoded sizes are 151,161 and 204,354 bytes.
The gzip wrappers enforce the existing 512 KiB / 2 MiB bounds, use weak decoded
ownership and release decoding scratch memory.

The old Native bodies continue in V190 geometry-only companions. Complete
combined roof coverage and every full-height outward wall are checked before
their exact triangle ordinals can be retired. A shared V190 wall can use the
earlier touching neighbour's altitude; the compiler reproduces that exact
lookup and distinguishes the opposite-facing neighbour wall. Unrelated geometry
never yields. Navigation replaces exactly three old owners per mode.

`prove-grunewald-venues-v354.ts` runs all six through the real production decoder.
It checks all unretired original positions/colors/indices, old line words outside
the explicit roof-edge list, material/shader hooks, source-kind ordering, and all
navigation outside the three owner transfers. Original ground, roads, water,
bridges and trees remain byte-identical. Changed or incomplete input closes the
entire source transfer.

Reproduction, from the repository root (raw LoD2 tiles and retained OSM snapshot
are ignored local inputs with recorded official URLs/hashes):

```sh
uv run python -m scripts.audit_grunewald_lakes_v354
bun src/app/scripts/capture-grunewald-venues-v354.ts TASK < TASK/capture-input.json
bun src/app/scripts/capture-grunewald-venues-v354.ts TASK < TASK/capture-companions.json
uv run python -m scripts.build_grunewald_venues_v354 TASK
uv run pytest -q tests/test_grunewald_venues_v354.py
bun test src/app/tests/grunewald-venues-v354.test.ts
```

`TASK` is a local output directory. Capture input rows list the two named primary
packets in both modes and the two existing Native companions; they do not change
the packets. The focused checks pass: two Python tests and two Bun tests, including
six complete production decodes and negative guard cases. Visual release checks
remain the separate final publication step.
