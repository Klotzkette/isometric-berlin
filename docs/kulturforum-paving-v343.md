# Philharmonie-West paving joints

This bounded addition places fine slab joints on **918.276367 m² of already
rendered source paving**, west of the Philharmonie and between the two halls.
It adds no continuous surface, no generic plaza rectangle and no new collision
volume. It does not move any road node, curb, entrance, sculpture or memorial.

## Evidence and present-day limits

The [Grün Berlin completion report](https://gruen-berlin.de/pressemitteilung/freianlagen-des-kulturforums-eroeffnet)
records the narrowed Herbert-von-Karajan-Straße and western Philharmonie entrance
as completed in August 2019. Scharounplatz followed in December 2019. Consequently
the available Straßenbefahrung **2014** geometry cannot establish today's
forecourt or the narrowed carriageway. The later
[masterplan record](https://gruen-berlin.de/projekte/urbane-freiraeume/freiraum-kulturforum/daten-fakten)
separates that completed work from subsequent planning; proposed works are not
introduced here.

[GODELMANN's own project record](https://www.godelmann.de/de/referenzen/kulturforum-am-scharounplatz)
identifies the Philharmonie-West paving as **Kies-Braun, finerro**, with 35 × 35 ×
12 cm slabs, 75 × 35 × 12 cm slabs and a specified edge piece. Its inspected
photograph shows a restrained grey-beige finish with fine regular joints. The
model uses the published 75 × 35 cm module. The laying origin, 18° orientation,
alternating bond and 14 mm joint width remain explicit visual estimates, not an
individual-stone survey. Official DOP2025 imagery was inspected for context and
the retained north-end road bend. Both photographs remain outside the repository
and published viewer; no photographic texture is used.

The current [Philharmoniker access guide](https://www.berliner-philharmoniker.de/ihr-besuch/anfahrt/)
confirms the separate hall entrances and present access context. It does not
supply metric paving coordinates.

## Exact ownership

The rectangle x = −280…−175 m, z = 954…1085 m is only a selection window.
The actual accent footprint is the intersection with existing `district-paving`
and `restored-paving--1-1` / `restored-paving--1-2` triangles. Existing carriageway
surfaces plus a 12 cm margin and all intersecting LoD2 building rings are removed
from that footprint. The complete authored T4 field and Serra context receive
additional exclusions. The selected source triangles and their original ordinal
identities are recorded in
`geo_data/regierungsviertel/kulturforum-paving-v343-evidence.json.gz`.

No original source file is modified by the builder. In particular, the OSM north
Herbert-von-Karajan-Straße way `531952547` retains its real bend. It runs through
world X/Z points approximately (−223.641,908.870), (−222.002,916.563),
(−221.640,924.572), (−221.750,933.049), (−223.556,946.283).
Berlin Junction remains owned by OSM `187360886` and LoD2 `K0003UOE`; T4 remains
owned by OSM `303577518`.

Each drawn joint is inset from its exact supporting triangle. Its height is
barycentrically interpolated from that triangle's sampled vertices, avoiding a
second independently fitted terrain surface. Its geometry has a real 14 mm
width and a low-contrast colour; no one-pixel black line grid or transparency
layer is introduced. The 7 mm separation above the existing paving prevents
depth competition. Near-point QA targets are (−220,982) toward the western
entrance at (−195,976), and the southern forecourt near (−244,1042).

## Independent native support

Native joints are authored as cardinal slab edges, independently from the rotated
drawn joint layout. They are clipped again to the source `plazaBrick` ground
runs. At runtime the full X/Z rectangle of each such run must match an actual
ground instance. The existing instance matrix supplies the true block top;
neither smooth DGM sampling nor the drawn 10 cm lift is used. Each 14 mm high
accent is sunk 12 mm into that actual top and projects only 2 mm above it.
Missing or altered supports omit only their accents and report the supported
and omitted counts in `nativeGroundSupport`. There is no floating fallback.

The compact static sidecar is 269,999 bytes before transfer compression. Drawn
uses one mesh with 12,850 narrow joint strips; native uses at most one instanced
mesh with 6,495 shallow cardinal accents. All drawn device profiles share the
same detail. No texture, animation, new streaming descriptor or live-budget
relaxation is added.

## Verification

- Four Bun tests verify interpolation on sloping existing triangles, finite
  bounded geometry, independent cardinal native construction, actual native
  support heights and omission when support is absent (18,821 assertions).
- The Python geometry check verifies every complete strip is inside retained
  paving and outside building/carriageway/memorial exclusions, with native
  strips also inside their exact original ground-run rectangles.
- Public-viewer integration, complete release validation and visual QA belong
  to the root task. No claim of reconstructing the entire Kulturforum is made.

The separate broad peach-coloured raster problem was traced to the existing
`ISO_GROUND_SHADES.plazaBrick` palette (`#f0d6bb`, `#edcfb2`) on `Drawn ground slabs`.
This accent layer does not conceal or recolour those unrelated source owners.

## Complete west plaza, after visual QA

The close west view still showed wide alternating peach terraces after the first
joint pass. This was a distinct original owner: OSM **relation 9976187**, tagged
`highway=footway`, `surface=paving_stones`. Its complete 5,181.55 m² polygon and
three holes are retained in `kulturforum-plaza-v343-evidence.json.gz`. The source
voxel generator had rasterized this polygon into `plazaBrick`, while the smooth
road cache represented only narrow buffered paths across it. The alternating
`0xf0d6bb`/`0xedcfb2` paint and midpoint-height 4 m runs caused the peach strips.
The original fine-joint addition had never owned those intervening surfaces.

The completed 2019 Philharmonie-West works and the 2025 municipal orthophoto
support the current continuous paved area. The new separate owner is precisely
the source relation minus all pre-existing smooth road/paving/sidewalk/gravel
faces, source building envelopes, overlapping mapped grass polygons and the
complete retained Serra/T4 contexts. It preserves all three source holes. Six mapped street trees also retain the previous ground in conservative 1 m twelve-sided surrounds; these small protective margins are explicitly estimated, not surveyed tree-pit outlines. A seventh mapped point already lies inside the retained Serra exclusion. Its
3,581.982352 m² footprint is the union of the **actual Float32 render faces**, not
a selection rectangle. No photo is shipped. There are 1,097 vertices and 1,311
triangles; the source payload is 68,562 bytes. Coordinate quantization accounts
for only 0.00310 m² at the original source boundary (micrometre scale).

Four-metre subdivisions are invisible terrain tessellation. Heights use the
same retained smooth ground field and 0.10 m paving lift as the neighbouring
walkways. At 479 shared boundary vertices the new face uses the exact already
rendered neighbouring paving triangle plane. A single restrained `0xd4d0c3`
warm grey-beige material matches the existing District paving; the supplier's
Kies-Braun name does not imply the old peach display palette. The 75×35 cm joint
module is documented by the supplier. The 18° orientation, half-offset bond,
phase and 14 mm joint width remain explicitly illustrative. Fragment derivatives
anti-alias and fade the joints when their modules become subpixel, preventing a
dense flickering distant grid. No texture, extra pass, object-per-slab or timer
is used. Day/night materials retain the pattern, and the material subclass
survives the actual Schwellenraum `clone()` factory.

`createKulturforumPlazaV343(ground)` constructs a complete Drawn-only replacement
and validates the real ground grid plus the complete measured height-field hash.
Its private receipt verifies mesh/geometry/material identity, unmodified complete
buffers, visibility, transforms and disposal. `restoreRoadGroundV343` receives
that actual prepared root, preflights the original hosts and performs both the
full-footprint raster retirement and root attachment in one transaction. Missing
or invalid support leaves the previous ground intact. The original top, bottom,
paint and complete outside complement remain with their old owner. The new
surface is not attached by any separate decorative path. Native retains the
independent cardinal source ground and the already support-checked native joints.

Targeted verification: exact rendered-face/retirement-footprint union, exclusion
of original holes and prior owners, finite measured heights, closed admission
for altered/disposed/missing products and altered height fields, and real
Day/Night/Schwellenraum material-hook retention. Camera for visual QA:
`[-285,42,1055]` looking toward `[-225,5,981]`.
