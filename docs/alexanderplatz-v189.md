# Alexanderplatz recognition — v1.0.89

Step 10 adds a small Haus des Reisens facade supplement at Alexanderstraße 7.
The initial audit found dedicated models already covering the Fernsehturm,
Rathaus, Marienkirche, Marx–Engels ensemble, Neptunbrunnen, Weltzeituhr,
Völkerfreundschaft fountain, Park Inn, Pressehaus, Behrens pair, Haus des Lehrers,
Alexa and Alexanderplatz station. Their complete models remain unchanged.
Haus des Reisens previously had the complete generic v169 source body and
facades; the missing recognition cues are its aluminium grid and curved podium
eaves. No larger square reconstruction is implied.

## Evidence and scope

OSM way [`24273225`](https://www.openstreetmap.org/way/24273225), retained in the
29 September 2026 Geofabrik extract, identifies Haus des Reisens and tags its
17 storeys. Geoportal Berlin LoD2 parent `DEBE01YYK000079q`, tile `392_5820`,
supplies all six parts and every wall, roof, ground and closure surface.
The existing v169 source packet and its world transform are reused exactly:
`x=easting−389500`, `z=5820000−northing`, existing outer ground `y=3`.
The isolated evidence JSON retains the complete original building, exact
source SHA-256 and the nine selected source wall sheets. Licences remain
ODbL 1.0 and dl-de/zero-2-0.

The [Landesdenkmalamt entry 09020852](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020852)
identifies the 1969–71 building by Roland Korn, Johannes Brieske and Roland
Steiger. The [BBR Museum der 1000 Orte](https://www.museum-der-1000-orte.de/kunstwerke/kunstwerk/der-mensch-uberwindet-zeit-und-raum)
describes the 17-storey tower, two-storey podium, aluminium curtain wall and
curved concrete shell elements. This supports fifteen upper window rows above
the podium. The model adds thin blue-grey glazing bands, pale aluminium
spandrels, sills, upper frames and continuous mullions on seven tall source
walls. Seven thin, source-contained backing planes sit outside the old generic
window trim and behind the new glazing. They mask the earlier generic window
rhythm only within the new upper curtain-wall rectangles, preventing two
different window grids from showing through each other. Original geometry
remains retained; the podium and other source planes are untouched.
Two exposed long podium edges receive thirty repeated concave eave
members, each sampled in eight short segments. Fine dimensions, row/bay pitch,
curvature and colours are explicit display estimates.

The measured main tower eave at `y=69.542` remains unchanged, as do the higher
source roof/service parts reaching `y=74.432`. OSM's nominal 67 m height is
not used to flatten or rescale the complete LoD2 envelope. The additions stay
below `y=70` and above `y=12.5`; they create no ground surface, stair blocker,
road encroachment, courtyard closure or new navigation footprint.

The freely licensed [Haus des Reisens, 2024 (01).jpg](https://commons.wikimedia.org/wiki/File:Haus_des_Reisens,_2024_(01).jpg),
photographed by **Bahnfrend on 3 August 2024**, **CC BY-SA 4.0**, was downloaded
only to `/tmp` and visually inspected. It confirms the recessed glazing,
projecting spandrels, thin vertical aluminium fins and shell-shaped podium
eaves. The photo remains reference-only. No tenant logo, photographic pixel,
font or Womacka relief tracing is included. Its isolated merge-ready credit is
`geo_data/regierungsviertel/alexanderplatz-v189-credits.json`.

## Preservation and cost

`scripts/build_alexanderplatz_v189.py` only writes its three new files. Every
old source and rendered packet remains byte-for-byte intact. All existing
dedicated Alexanderplatz models, generic source body/facades, roads, trees,
terrain, pedestrian navigation and 93 tour stops remain present. There is no
current construction-site claim or added fountain jet.

`createAlexanderplatzV189(minecraft=false, mobileLike=false)` returns one
immutable instanced batch. Drawn geometry is identical on pointer and touch.
Minecraft independently uses orthogonal surface accents over the retained
native building, with wider placement clearance for its existing two-metre
envelope. It retains spandrel rows, vertical fins and stepped podium curves;
the smooth window bands and sloped eaves are absent in Minecraft. Neither
representation contains hidden solid infill, animation or external requests.
No global CPU/GPU residency, loading or drawing-distance limit is raised.

| Representation | Draw calls | Instances | Geometry and instance bytes |
|---|---:|---:|---:|
| Drawn, same full touch geometry | 1 | 732 | 56,280 |
| Independent native Minecraft | 1 | 1,520 | 116,168 |

## Reproduction and checks

```sh
uv run python scripts/build_alexanderplatz_v189.py
uv run pytest tests/test_alexanderplatz_v189.py
cd src/app
bun test tests/alexanderplatz-v189.test.ts
```

Three Python tests verify deterministic output, complete equality of the retained
six-part source, exact selected sheets, heights, bounded placement and fixed
counts. The backing regression checks source-wall containment, placement outside
old trim and a positive gap behind every new glazing band.
One Bun test (9,142 assertions) verifies exact touch parity, finite
texture-free matrices, orthogonal native geometry and the measured byte caps.
Scoped Ruff formatting and lint pass. Integrated viewer and full-suite checks
belong to the parent release review.

Suggested review target: `[3074, 37, -394]`, distance `150`, looking northeast
from Alexanderplatz for the tower and southwest podium; the opposite side
checks the second eave edge. The earlier whole-square camera remains useful
for confirming that the prior monuments, station and public voids are intact.
