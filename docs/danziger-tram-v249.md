# Danziger Straße tram pilot — v249

Step 10 adds four visible railheads along both complete retained M10 through
courses on Danziger Straße: **19 OSM ways, 5,942.543 metres of track axes**.
All original axis vertices remain in the source receipt. The older brown rail
surfaces, every street/building packet and the Hauptbahnhof tram stay unchanged.
Crossing M2/M4 courses and turning connectors are not claimed as new M10 track.

The two Husemannstraße platform lines are ways **96351862** and **96351856**.
Their full 74.1m and 68.0m courses anchor the two modest platforms. Source tags
record shelter, bench, bin, lighting, passenger information and tactile paving.
The 1.7m width, 24cm platform thickness, individual furniture positions, shelter
sizes and simple H-signs are **display estimates**, not surveyed installations.
Their source course stays intact; open ends and pedestrian circulation remain.

One static yellow double-ended Flexity interpretation stands alongside the first
platform, anchored to way **323881804** at approximately **[3229.05, -2290.51]**.
It has seven articulated sections, distinct glazing/doors, four bogies, end lamps
and a compact pantograph. The manufacturer's data establishes 40m body length,
2.4m width, 3.45m height, 1.435m gauge and 1.3m door openings. Its diagram labels
40.55m overall while the table gives a 40m body; this model uses the latter and
scales module proportions accordingly. Fitting layout is simplified, not a
technical reconstruction or a claim about a real vehicle's current position.
There is no animation or extra frame loop.

## Independent native construction and walking

Drawn railheads follow exact offset curves, 0.7175m to either side of each source
axis. Native uses separate world-axis blocks over complete source spans of at
most 1.5m. Only potentially touching blocks are subdivided further: all four
native railheads remain distinct, continuous and never create false crossings.
No rotated smooth instance is retained in native. Native platforms, carriage,
doors, glazing and stop furniture use separate orthogonal slices.

At Husemannstraße the existing ground is 3.00m and outer rail surfaces top out
at 3.15m; new railheads occupy 3.16–3.24m and platforms top out at 3.40m.
The eastern courses cross the existing Friedrichshain DGM height field. Drawn
rail spans are split at its exact 10m triangle edges and pitched to both endpoint
heights in the same existing batch. Native blocks sample the existing independent
4m terrain cells and remain axis-aligned. No old street or terrain is changed.
The stationary tram and both platforms remain on their verified flat 3m datum.
These rail/platform offsets are display estimates, not survey readings.
Walking queries use the actual platform
polygons/independent native blocks and only represented vehicle/furniture solids.
Approaches and surrounding streets stay open. Contact wires elsewhere remain
untouched; this pilot does not claim a complete Danziger catenary installation.

## Lifetime and costs

`appendDanzigerTramV249` appends to the existing NorthV185 Hagenauer instance
batch within the existing cancellable outline family. There are **zero new draw
calls, materials, textures, streaming descriptors or per-frame allocations**.
No city residency/transfer/prefetch limit changes. Touch and pointer receive the
same complete drawn detail. Native and drawn families retain the existing
replace-and-dispose lifecycle; they are not simultaneously constructed.

- Data: **275,856 bytes**.
- Drawn: **981 added rows / 74,556 instance-buffer bytes**.
- Native: **9,131 added rows / 693,956 instance-buffer bytes**.
- No additional permanent GPU geometry; the pre-existing unit cube is reused.

## Sources and credit

- **© OpenStreetMap contributors, ODbL 1.0**: retained
  `geo_data/regierungsviertel/raw/outer-v159/candidate.gpkg`. Exact feature IDs,
  complete transformed axes/tags and its immutable hash are in
  `geo_data/regierungsviertel/danziger-tram-v249-source.json`.
- **Land Berlin, DGM, dl-de/zero-2-0**: the already retained
  `src/app/src/data/parkReliefV182.json` height field and unchanged existing
  `terrainGroundAt` sampler; its exact hash is recorded alongside the OSM receipt.
- [BVG M10 line overview](https://www.bvg.de/de/verbindungen/linienuebersicht/m10):
  primary confirmation of Husemannstraße and the Danziger through route.
- [Bombardier Transportation, FLEXITY Berlin data sheet, 2008](https://trampicturebook.de/tram/download/bombadier/Flexity-Berlin.pdf):
  ©2007–2008 Bombardier Inc., mirrored by trampicturebook.de. Primary manufacturer
  dimensions/module count; reference only. No brochure image, plan or texture
  is copied into the model or bundle. No additional photograph was used.

Suggested review frame: eye **[3265, 38, -2338]**, target
**[3240, 4, -2285]**. Source/raster replay and four-family rail separation are
checked in Python; Bun checks additive batch retention, independently orthogonal
matrices, all rail endpoint heights, physical support rays and matching walking
obstacles. A direct ray against the published source triangles also confirms
3.00m at camera [3292,-2224], 3.15m on the Husemann tracks, and 15.3896m on the
eastern track at [4991.5115,-1031.78425].
