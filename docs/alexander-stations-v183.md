# Alexanderplatz architecture and three station halls — v1.0.83

Step 10 retains original measured LoD2 sources and adds texture-free recognition
geometry. Two Fred Romero photographs (CC BY 2.0) were inspected externally;
[`alexander-stations-v183-references.json`](../geo_data/regierungsviertel/alexander-stations-v183-references.json)
contains records for both credit manifests. No photograph, font, texture, Google
data or textured city mesh is bundled.

| Building | Source | Recognition and conflict resolution |
|---|---|---|
| Alexa | OSM way 258898047; LoD2 DEBE01YYK00001Xy | Complete 143-vertex footprint, rounded source corners, rose exterior, relief bands and geometric ALEXA letters. The [operator](https://www.alexacentre.com/en/about-us/) documents the pink Art Deco exterior. Separate Alexander Tower construction and service-body sources remain untouched. |
| Haus des Lehrers | OSM way 24273222; LoD2 DEBE01YYK00003SW | White/mint curtain wall, lower glazing and eight-metre colour wrap. [Landesdenkmalamt](https://www.berlin.de/landesdenkmalamt/denkmale/aus-der-praxis-erkennen-und-erhalten/oeffentliche-anlagen/haus-des-lehrers-und-kongresshalle-641041.php) documents the 13-storey skeleton and Womacka frieze. The [Berlin history walk](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/en/history-walk/artikel.1604336.en.php) gives 54 m. The false LoD2 hip is retained as evidence and displayed as a flat roof at its measured 54.844 m eaves. |
| Alexanderhaus | OSM way 376362563; LoD2 DEBE01YYK00002iS | All seven original parts, stepped L-shaped mass, two glazed base storeys and six paired-window office rows. |
| Berolinahaus | OSM way 23723113; LoD2 DEBE01YYK00001QK | Facade-only addition over the complete existing v169 core shell and native body, at their y=5.2 datum. Paired office openings, limestone grid, gallery glazing and open roof rail. |
| Alexanderplatz station | OSM way 20144781; retained DEBE01YYK0001z5U hall | The [heritage record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011324) documents a round-arched hall, two islands, four tracks and glazed end aprons. Measured footprint, eaves and summit govern a sampled barrel; glazing has 0.17 opacity and depthWrite=false. Existing stationBase remains. |
| Jannowitzbrücke | OSM way 20144739; LoD2 DEBE00YY1TF0003o | The [heritage record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011326) documents glazed long sides and a raised basilical monitor. Measured eave/summit envelope governs the shoulder and monitor roof; single island, two tracks, piers and open approaches replace the closed hall proxy. |
| Friedrichstraße | Existing catalogue coordinate and earlier complete model | The [heritage record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080415) and existing source frame govern added recessed Tudor ribs/open diagonals. Earlier curved twin halls, tracks, platforms, entrance, clock and facade details remain. |

The [Berlin description of the Behrens ensemble](https://www.berlin.de/sehenswuerdigkeiten/3560681-3558930-berolinahaus.html)
identifies Alexanderhaus and Berolinahaus as eight-storey modernist buildings
from the 1929–32 redevelopment. They are not Jugendstil or nineteenth-century
buildings. Facade spacing, fine frames, colour fields and rails remain procedural
visual estimates, separated from measured geometry.

`build_alexander_stations_v183.py` reads only retained source ZIPs. Its source
JSON keeps every original leaf and sheet, display transforms and eight explicit
conflicts. Navigation JSON holds IDs, rings, heights, hall frames and the exact
existing Friedrichstraße anchor. Berolinahaus retains its complete earlier shell.
Alexanderhaus explicitly retains all 50 original `ClosureSurface` polygons
between its seven source components, alongside walls and roofs. A test compares
the complete surface multiset, original footprints, heights and navigation
against the earlier v169 inventory, independently of the new extractor.

Four outer owners already belonged to the complete v169 Alt-Mitte model.
`integrate_alexander_stations_v183.py` reconstructs their exact existing source
and facade signatures and subtracts only those from existing bounded packets.
Unrelated triangle multisets and ground/water/road/bridge/navigation entries
are asserted equal before writes. The original source inventory remains.
[`alexander-stations-v183-audit.json`](../geo_data/regierungsviertel/alexander-stations-v183-audit.json)
records old/new hashes for each altered descriptor/mode. There is no unbounded
packet rebuild or inferred exclusion area.
The tests replay all 13 changed packets from the immutable v182 release in a
temporary directory and require byte-identical results. Historical v169/v176
source proofs follow that verified intermediate stage for these packets only;
all unrelated live packets remain subject to their original checks.

`SchlossEastOutlines` filters only `stationHall`; `stationBase` remains.
`MinecraftVoxelWorld` has the narrow old-owner column check.
`pedestrianNavigation` registers new civic footprints and station platform,
deck and pier solids. It omits the old full-hall blocker. Rail mouths and
transverse approaches remain open. Berolinahaus keeps earlier navigation.

The release manager adds `createAlexanderStationsV183()` in drawn modes and
`createMinecraftAlexanderStationsV183()` in Minecraft through the existing
mode-switched factory. `IsometricCityWorld` has no outer packet ID filter;
source ownership integration is the exact offline packet subtraction above.

The supplement uses six drawn meshes: three source shells, roof sheets,
transparent glass and one repeated-detail batch. Minecraft uses two orthogonal
surface batches, opaque and transparent. Full/mobile drawn detail is identical.
Tests cover original sheet retention, exact owners/anchors, open station
collision, transparent glass, no UVs, finite orthogonal native matrices and
bounded draw/instance counts. Integrated visual QA is part of root release checks.

Final integration checks exercise the compiled pedestrian index, including open
rail mouths, walkable platform tops and collidable platform/deck/pier solids.
The former Alexanderplatz hall is excluded in both families while its low
station base remains. Old source-column masking requires an exact footprint and
vertical envelope match, preserving a different-height overlapping owner.
The preservation tests replay all 13 modified mode packets from the v1.0.82
bytes in a temporary directory, requiring exact audit, descriptor and output
bytes for the fixed four-owner/nine-descriptor scope.
`alexanderStationsV183Source.json.profiles` is a read-only constructor field with
weak cache ownership; each mode change can reconstruct it exactly after garbage
collection. The separate navigation payload remains strongly referenced because
collision continues using it. Six drawn meshes contain 13,759 detail instances;
the two native batches contain 66,438 orthogonal surface instances.
