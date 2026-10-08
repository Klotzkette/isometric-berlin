# Teufelsberg listening station — v1.0.95

The station now has its tall, open central tower with the large hexagonal-panel
radome, two lower roof radomes, the western search tower and the smaller
Jambalaya tower. The surrounding blocks come from complete official building
sheets. These replace 23 named coarse OSM building proxies in one packet family;
no surrounding buildings, roads, paths or vegetation are removed.

## Evidence and geometry

The [Berlin heritage office](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/usa/charlottenburg-wilmersdorf/abhoerstation-teufelsberg-1415079.php)
describes three towers with five antenna caps and the block-shaped buildings of
the former US/British listening station. The
[site's historical overview](https://www.teufelsberg-berlin.de/geschichte/geschichtlicher-ueberblick/)
places construction of the permanent complex in 1969–1971 and operation until
1992. These facts establish the complex's identity; current geometry comes from
the measured source and the freely licensed visual references below.

The retained source extract is
`geo_data/regierungsviertel/teufelsberg-station-v195-source.json.gz`.
It contains six complete parents, 31 leaf building parts and 528 original
polygons, including all ground surfaces and the five superseded coarse profiles.
The source is the small official
[LoD2 tile 380/5817](https://gdi.berlin.de/data/a_lod2/atom/LoD2_380_5817.zip),
licensed under `dl-de/zero-2-0`. The archive hash, original polygon identifiers,
rings, source URL and coordinate conversion remain in the extract.

The six parent IDs are `DEBE04YY50003LxK`, `DEBE04YY50003R0E`,
`DEBE04YY500039hM`, `DEBE04YY50003C8V`, `DEBE04YY50003EXf` and
`DEBE04YY50003TaW`. World coordinates are `x = easting − 389500`,
`z = 5820000 − northing`, `y = NHN − 30`. The measured building coordinates
receive **no additional hill offset**. The new DGM terrain is a separate layer.

For 26 parts, all non-ground sheets retain their measured vertices and original
polygon identity: an exact multiset test checks all 713 resulting triangles (665 unique coordinate triples, including shared
source boundaries).
Five official cylindrical envelopes have sloping roof caps instead of the
visible spherical radomes. Their complete originals remain in the source
extract, while the renderer explicitly substitutes the following profiles.
Horizontal centres, footprint radii and maximum heights remain source-bound.

| Profile / source part | Radius | Top, model y | Top, NHN | Cap base, model y |
| --- | ---: | ---: | ---: | ---: |
| Central / `DEBE3DmU6tU10EOy` | 8.3405 m | 141.730 m | 171.730 m | 129.200 m |
| Southwest roof / `DEBE3Do1612aobdn` | 8.3560 m | 116.522 m | 146.522 m | 101.763 m |
| Northeast roof / `DEBE3DG1NfRpQ1id` | 8.2965 m | 116.560 m | 146.560 m | 101.763 m |
| Search / `DEBE3Dzgko2S0Kvv` | 7.6260 m | 110.475 m | 140.475 m | 97.700 m |
| Jambalaya / `DEBE04YY50003LxK` | 2.6230 m | 97.530 m | 127.530 m | 93.300 m |

Panel topology, spherical curvature, the three non-roof cap-base elevations,
intermediate tower platforms, core/member sections, material shades and small
remnant cladding pieces are bounded display estimates. Roof cap bases use the
measured supporting hall height. The estimates reproduce the observed silhouette
without claiming a structural survey or an exact count of surviving panels.
The central upper tower has an exposed frame and stair core; it is not filled by
a duplicate opaque cylinder. No photographic textures, copied murals or invented
precise window patterns are used.

Three Commons images were inspected before creating the visual refinements:

- [Besserwisser123, abandoned station](https://commons.wikimedia.org/wiki/File:Aufgelassene_Station_am_Teufelsberg_in_Berlin.jpg), CC BY-SA 4.0: tower frame, caps and remaining cladding.
- [Matthias Süßen, station in 2023](https://commons.wikimedia.org/wiki/File:Teufelsberg-Berlin-msu-2023-0I9A-3442-.jpg), CC BY-SA 4.0: triangular roof-cap pattern and materials.
- [Leonhard Lenz, view from Drachenberg, 8 March 2024](https://commons.wikimedia.org/wiki/File:Teufelsberg_during_sunset_from_Drachenberg_in_Berlin_2024-03-08_01.jpg), CC0: central hexagonal cap and exposed frame.

Author, license, license URL and page metadata are retained in
`teufelsberg-station-v195-credits.json` for the shared attribution tables. No image
pixels are distributed with the model.

## Exact source-owner replacement

The old proxies are the 23 `OSM-way-…` owners listed in the source extract and
`teufelsberg-station-v195-packet-audit.json`. Each intersects the official complex
by more than 75% of its old footprint. Four nearby owners remain:
`132729016`, `269298201`, `165781444` and `837371912`. The first two are separate
annexes with only 1.7% and 0.4% overlap; the others lie outside the official
complex. The selection is by identity and footprint, not by a broad bounding box.

The family is `outer187--18_4`, including its existing Grunewald companion.
The integration order is v1.0.94 → finer terrain → station replacement.
`integrate_teufelsberg_station_v195.py` reconstructs the exact named old proxies
and their inherited rigid terrain offsets. Across the complete family it removes
913 drawn triangles, 2,478 native triangles and their exact drawn roof ink.
All remaining triangle/color multisets and unrelated navigation records are
identical. Existing native 2 m cells and overlap-selected historical offsets are
reconstructed exactly rather than approximated with footprint/height tolerances.

The full, bounded terrain checkpoint is committed as
`teufelsberg-station-v195-terrain-checkpoint.json.gz`. It contains all four
original family packets, their descriptors and hashes, allowing clean-checkout
rollback and chain tests without ignored caches. The station stage under
`raw/teufelsberg-v195/station-packets` never mutates the terrain stage. Root
integration publishes the final descriptors and bytes; tests require those public
bytes to match the receipt and do not fall back to staging.

## Runtime and checks

`createTeufelsbergStationV195(native = false)` returns a static, frozen group.
The drawn representation uses 5,866 triangles, 4,264 panel segments and 800
instanced structural boxes in three draws, with 899,648 attribute/index/instance
bytes. Native Minecraft uses 3,029 independently constructed axis-aligned blocks
in one draw and 230,852 bytes. It combines measured exterior sheets with stepped
spherical caps and structural members, rather than voxelizing the full drawn
triangle soup. Both representations are under the 1,800,000-byte budget and
retain full detail on mobile, existing culling and shared day/night materials.

`teufelsbergStationV195SolidAt(x, y, z, radius, native)` rejects distant queries
first, preserves holes/open courts and checks only the represented tower members
and cap membranes. Native collision follows the actual blocks. Regression points
check the open court and open space beside the central stair core.

The finite world footprint is `[-9026, 2092, -8866, 2291]`. Review cameras:

- Overview: position `[-8750, 190, 2340]`, target `[-8940, 108, 2175]`, span 360 m.
- Tower: position `[-8850, 145, 2050]`, target `[-8938.439, 122, 2115.111]`, span 135 m.

The integrated desktop close view was inspected and showed unobstructed caps,
the exposed main frame and the supporting source blocks. Focused checks cover
all source sheets, five cap profiles, native apex heights, static memory/batching,
collision openings, photo credits and the complete packet preservation chain.

Reproduction and verification:

```sh
uv run python scripts/build_teufelsberg_station_v195.py
uv run python scripts/integrate_teufelsberg_station_v195.py
uv run pytest tests/test_teufelsberg_station_v195.py -q
cd src/app
bun test tests/teufelsberg-station-v195.test.ts
bun --bun node_modules/typescript/bin/tsc --noEmit
```

The builder uses the committed complete source extract by default. Its optional
`--extract` step requires the named official archive and the retained OSM caches.
Packet reconstruction additionally uses the immutable v1.0.89 source packets and
the finer-terrain receipt. The root's shared preservation suite verifies the full
v1.0.94 → terrain → station chain.
