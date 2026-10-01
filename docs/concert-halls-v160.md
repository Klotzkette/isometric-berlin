# Philharmonie and Kammermusiksaal source-surface correction

Pipeline step 10, v1.0.60. The old renderer treated both main roof-code-5000
parts as constant-height extrusions with horizontal radial roof lines. That
lost their tent-roof silhouettes. Approximate gold bars and misplaced entrance
panels have now been replaced by details attached to the actual source surfaces.
Production review also exposed two open entrance canopies incorrectly rendered
as solid buildings, hiding their recessed doors.

## Complete source accounting

The correction exports every exterior wall and roof of both concert buildings
from the Berlin LoD2 tile `LoD2_389_5818.zip` (creation date 2026-03-02,
[official download](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5818.zip),
dl-de/zero-2-0). Its SHA-256 is
`827a94eda224f55ec638b1b4de8c440c80405ea6797068efe7558c83a4fd30c1`.
The separate Philharmonie entrance canopy comes from
[LoD2_389_5819.zip](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5819.zip),
SHA-256 `86084bf012830c373bbcb4ac1ca2814153430bb9a1eb6d8271b1f7fc8ccecd17`.

| Source | Parts | Footprint sum | Rendered polygons | Triangles |
|---|---:|---:|---:|---:|
| Philharmonie `DEBE01YYK0002ONo` | 7 | 6,277.355177 m² | 97 | 270 |
| Kammermusiksaal `DEBE01YYK0002KxN` | 18 | 4,048.775545 m² | 189 | 518 |
| Chamber entrance canopy `DEBE01YYK0003TqC` | 1 | 214.665143 m² | 1 roof | 51 |
| Philharmonie entrance canopy `DEBE01YYK0003U62` | 1 | 130.039547 m² | 1 roof | 7 |

Every triangle vertex retains an original source millimetre coordinate.
Triangulation preserves projected polygon area, including holes. Buried ground
faces and interior closure surfaces are not exposed. The common source floors
are translated onto each existing main-part ground level, 4.1 m and 4.0 m,
rather than independently moving adjoining surfaces by old terrain-sampling
variation. Exact main heights remain 35.665 m and 26.347 m; displayed peaks are
39.765 m and 30.347 m. Walking uses the actual roof planes or native cell tops.

All original city data remains intact. Only these 27 inaccurate generic
representations are replaced. The neighbouring Philharmonie wing `K0003VMd`
and Musikinstrumenten-Museum retain their separate ownership. A direct audit of
the existing voxel payload finds 665 owned legacy columns, all matched by the
source-height-aware replacement predicate, with zero unmatched owned columns.

## Source-proven open canopies and entrances

Both canopy records carry `bldg:function=51009_1610`, meaning Überdachung.
The official [ALKIS object catalogue](https://www.ldbv.bayern.de/mam/ldbv/dateien/alkis_ok_by_version_2_0_2.pdf)
defines 1610 as ordinarily open-sided. Their conversion to closed buildings was
therefore a semantic error, independently confirmed by the entrance photographs.
The complete source roof plans and heights remain. All 62 enclosing LoD2 wall
rings remain in `canopyWallEvidence`; they are not displayed as occupied walls.
Shallow 0.35 m fascias follow actual source roof-edge heights, with four narrow
support positions explicitly treated as photograph-bounded display estimates.

The chamber canopy top is 9.254 m, with a displayed underside at 8.904 m.
The Philharmonie canopy retains its source pitched roof from 7.319 to 8.211 m;
its minimum underside is 6.969 m. Native overhead blocks follow the same roof
with their independent 2 m grid. Navigation leaves the space below each roof
open and uses mode-appropriate underside heights.

The [official access guide](https://www.berliner-philharmoniker.de/ihr-besuch/anfahrt/)
and OSM main-entrance nodes `247854384` and `3100521550` locate the western
approaches. The Philharmonie node lies at the canopy's outside access, while
its actual recessed glass doors belong to measured foyer wall `rzUWjRbq`.
The chamber doors belong to `WjWjPODG`. Door frames, transoms, handles and labels
now sit on these supporting source walls. Door divisions are presentation
estimates, not a door-by-door survey.

## Materials and bounded façade detail

The [Philharmoniker architecture account](https://www.berliner-philharmoniker.de/ueber-uns/philharmonie-berlin/architektur/)
documents the anodised gold aluminium cladding. Five actually inspected free
Commons references establish silver-grey roofs, vertically jointed gold walls,
white low foyers, the open white canopies and framed glazing:

- [Aerial view](https://commons.wikimedia.org/wiki/File:Philharmonie_und_Kammermusiksaal_Berlin_-_von_oben.jpg), © Raimond Spekking, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- [Chamber façade detail](https://commons.wikimedia.org/wiki/File:Kammermusiksaal.Philharmonie.Berlin.Detail.Fassade.jpg), Membeth, [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- [Philharmonie southwest façade](https://commons.wikimedia.org/wiki/File:Philharmonie,_Berlin,_170518,_ako.jpg), Ansgar Koreng, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- [Chamber roof](https://commons.wikimedia.org/wiki/File:Kammermusiksaal.jpg), Renya66, [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- [Chamber west entrance](https://commons.wikimedia.org/wiki/File:Philharmonie_Berlin_Kammermusiksaal_2.jpg), Manfred Brückels, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).

These photographs remain reference-only; none is bundled or loaded. The 453
gold joints are clipped to exact source walls; their 1.6 m rhythm and shallow
relief are display estimates. The 92 framed glazing fields on the Philharmonie
foyer and chamber tower are likewise clipped inside their measured wall
polygons. The actual inclined foyer roof `MsvNJFg2` receives the photographed
blue-green glass material. Native source blocks carry matching glazing colours.
Small labels use the existing drawn alphabet, not external imagery.

## Budget and checks

Both device profiles and all four drawn modes share exactly the same detail:
6 renderables, 28,814 stored vertices, 506,314 geometry/index bytes before the
existing global interleaving. Minecraft uses one independent surface-only batch:
7,005 source blocks plus 92 entrance/support blocks, 7,097 total, and 539,732
geometry/index/instance bytes. There is no hidden solid interior block fill.

Focused checks pass: 4 Bun tests / 3,505 assertions, plus 2 Python tests that
compare all 288 rendered source polygons and 846 triangles to the original XML,
check non-flat source roof profiles and verify bounded geometry. The source
supplement is 358,018 bytes; the separate navigation supplement is 93,893 bytes.
Unused mesh data remains tree-shakeable out of the geometry worker. Neither
factory requires a network request or an external image loader.
