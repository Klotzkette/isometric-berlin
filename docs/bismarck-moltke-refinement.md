# Bismarck and Moltke at the Großer Stern — v1.0.8

Pipeline step 10. These two existing public monuments remain recognition
details within the committed bounds; the 93-place tour catalogue is unchanged.

## Metric evidence and conflicts

| Work | Exact OSM identity | Viewer anchor, metres | Retained source records |
|---|---|---|---|
| Bismarck-Nationaldenkmal | [node 270687313](https://www.openstreetmap.org/node/270687313) | `[-1479.688344, 5.2, 300.736640]` | `DEBE00YY2iy0007y`, `DEBE00YYMo00007F` |
| Moltke-Denkmal | [node 278706862](https://www.openstreetmap.org/node/278706862) | `[-1420.113409, 5.2, 351.650691]` | `DEBE00YYMo00007J` |

The small `bismarckMoltkeSource.json` retains the original LoD2 rings, heights,
colours and five intersecting occupied voxel columns. The two Bismarck records
have the same footprint and a 3 m envelope; they describe the base poorly and
must not become two inhabited building masses. Moltke's 6.9 m prism does not
represent the full sculptural silhouette. Both ground anchors are 5.2 m in the
committed DGM-derived voxel grid. The source footprints supply plan scale and
orientation, while OSM supplies placement. Rounded apses, step projections and
all local sculpture shapes are explicit display reconstructions, not surveys.

The previous Bismarck accessory used an offset from the Siegessäule, roughly
58 m from the mapped work, and a 22 m square base. That accessory is removed;
the OSM point now owns the model. The old generic Moltke figure incorrectly
used bronze and red granite. Only its matching OSM work is replaced; the nearby
Roon monument is untouched. The three old prisms are suppressed in ordinary
building geometry and collision. Minecraft removes only the five committed
Bismarck cells at their exact coordinates and 5.2–9.2 m source height band.

## Present-day sculptural evidence

[Bildhauerei in Berlin's Bismarck record](https://bildhauerei-in-berlin.de/bildwerk/bismarck-denkmal-4617/),
by Jörg Kuhn, Marc Wellmann and Layla Fetzer, documents Reinhold Begas's 15 m
ensemble and 6.6 m principal figure. Green-patinated bronze sits above red
granite. The four distinct supporting groups are Atlas with a globe in front,
Siegfried forging a sword behind, the reading Sibyl on a sphinx to the left,
and state power with August Gaul's panther to the right. The coat, helmet,
sabre and document support are separately articulated. The six removed lower
reliefs and lost flank fountains are not reconstructed. Their absence is
represented by quiet stone fields with sparse fixing cues. Fine inscription,
cloth folds, face, globe, book, hammer and animal subdivisions are procedural.

[The Moltke record](https://bildhauerei-in-berlin.de/bildwerk/moltke-denkmal-5323/),
by Jörg Kuhn and Marc Wellmann, identifies Joseph Uphues's Laas-marble figure
as 5.5 m high. Moltke wears a peaked cap, crosses his legs and clasps his hands
in front of a support with two Doric-style columns. The low present base keeps
scrolled corners, profiled caps, a shallow shield cue and gilt name. Its former
large stair and inscription substructure were omitted during the 1938 move.
The inventory's 11.5 m overall height explicitly describes the 1905 arrangement;
this renderer instead uses a **9.2 m present-day display estimate**, comprising
the published 5.5 m figure and a 3.7 m photo-proportioned base. This is not a new
survey claim. No unmeasured perimeter wall is introduced across the approaches.

The [Landesdenkmalamt ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050419)
independently identifies both works and their relocation to the Großer Stern.
The institutional records were consulted on 8 September 2026. Their facts are
architectural evidence; no web photograph, plan or protected text is embedded
in the viewer.

## Inspected free visual references

| Reference | Author | Licence |
|---|---|---|
| [Bismarck Memorial in Berlin.JPG](https://commons.wikimedia.org/wiki/File:Bismarck_Memorial_in_Berlin.JPG), May 2012 | Pudelek / Marcin Szala | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| [Germania - Bismarck Memorial in Berlin.JPG](https://commons.wikimedia.org/wiki/File:Germania_-_Bismarck_Memorial_in_Berlin.JPG), May 2012 | Pudelek / Marcin Szala | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) |
| [Moltke front, IMG 5599](https://commons.wikimedia.org/wiki/File:Berlin-Tiergarten,_standbeeld_van_Helmuth_Karl_Bernhard_von_Moltke_Dm09050419_IMG_5599_2024-09-06_15.39.jpg), 6 September 2024 | Michielverbeek | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) |

The first two images establish the cast-metal patina, base hierarchy and the
distinct standing/seated/kneeling figures. The 2024 photograph checks Moltke's
present material, leg crossing, clasped hands, support and reduced pedestal.
Old photographs are not evidence of current renovation status. Per-file notices
are mirrored in the canonical and viewer Wikimedia manifests. Downloads and
software QA remain local; no reference image, crop, texture or external font
enters the runtime package.

## Implementation and verification

`BismarckMoltkeMonuments.ts` shares one bounded procedural solid list between
the drawn geometry, its separate surface-voxel Minecraft counterpart and
pedestrian collision. Both mobile models preserve every major figure and pose;
only small subdivisions and block resolution change. A 0.26 m collision margin
includes raster boundary faces. Nearby paths and Moltke's forecourt stay open.
Night materials use the existing viewer hooks, and separate snow caps toggle
reversibly without rebuilding the sculptures or moving their anchors.

| Stored representation, both works | Full | Mobile |
|---|---:|---:|
| Drawn renderables, including hidden snow | 6 | 6 |
| Drawn position vertices | 33,393 | 17,234 |
| Drawn geometry buffer bytes | 687,015 | 335,622 |
| Minecraft batches | 2 | 2 |
| Minecraft boundary blocks | 5,997 | 3,077 |
| Minecraft rendered instance vertices | 143,928 | 73,848 |
| Minecraft geometry and instance buffer bytes | 457,452 | 235,532 |

The five focused tests check retained source records, exact anchors and source
column filtering, actual triangle heights and rays through all four Bismarck
groups, Moltke's leg/support geometry, all eight free approach directions,
sampled block/collision agreement, material hooks and reversible snow. Actual
Three.js triangles and instance matrices were rendered for full/mobile and
drawn/Minecraft geometry QA. The software plates are explicitly not browser or
iPhone screenshots.
