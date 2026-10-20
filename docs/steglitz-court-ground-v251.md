# Gymnasium Steglitz: photographed sports courtyard, v251

The two red courts use the retained OSM handball polygon `way/1107082380`
and basketball polygon `way/1107082381` (the latter explicitly records two
hoops). They occupy the open courtyard between the measured Aula, sports hall
and southern five-storey school wing. The school parcel is `way/387263944`.
The clock-gabled Aula entry and its forecourt stay free.

The five user photographs in attachment `62908D5D-235A-461D-AD29-0109F5E52649`
are reference only. They supply the red surface, white handball markings and
ticks, yellow basketball markings, blue inset lines, two metal basketball
supports, small black grid goal and three pale concrete table-tennis tables.
Paint radii, widths, furniture dimensions and exact positions are visual
estimates, not a survey or claim of regulation court dimensions.

Six existing mapped tree anchors (`node/11394188656`, `57`, `60`–`63`) fill the
previously absent school-courtyard planting. They distinguish the larger Aula
and eastern trees from young trees beside the hall. Crown sizes/heights are
photo-led estimates. The complete old sources and mapped anchor data remain
unchanged; there is no old court row to remove and no source filter is added.

The slab tops are at **y=3.55**, matching the school ground datum. Drawn slabs
are inset within their mapped polygons by approximately 4 cm. Native slabs
are an independent axis-aligned staircase; paint, goals and furniture likewise
use orthogonal native members. All detail goes into the existing school
instance batch, equally on desktop and mobile. There is no new render batch,
texture, streamed descriptor, animation or residency-budget change.

`appendSteglitzCourtGroundV251` is called after the v250 front/hall and v251 Aula
append. An exact receipt on the existing school/hall/service navigation parts
disables the addition if those sources change. Only a boolean is cached.
Navigation imports `steglitzCourtGroundV251Floor` separately: its small data
contain only the actual drawn/native slab footprints. It returns 3.55 only
on these surfaces, leaves higher existing ground intact and creates **no
whole-courtyard collider**. The goal is visibly open metal lattice; its posts
and the two hoop supports remain local physical details.

The generated detail contains **52 drawn boxes + 146 rods / 467 native boxes**,
**27,060 bytes** plus **2,333 bytes** of floor profiles. Measured walls, roofs,
the v250 Heesestraße facade, hall and all unrelated geometry are preserved.
Tests rebuild from the retained sources, verify original-source hashes,
mapped containment and absence of building intersection, both rendered floor
heights, exact-owner append behavior and changed-source fallback.

A useful court overview is eye `[-3231,21,6840]` toward `[-3252,4,6819]`.
For the entry-facing courtyard, eye `[-3274,18,6821]` toward
`[-3216,13,6824]` shows the courts and Aula within downward-looking flight controls.
