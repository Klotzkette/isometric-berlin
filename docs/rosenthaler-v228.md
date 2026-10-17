# Rosenthaler Platz recognition — Step 10, v1.0.128

This bounded addition attaches shopfront framing and original geometric lettering
to five retained Berlin LoD2 wall sheets. All eleven v163 source parents, their
roofs, court holes and existing windows remain unchanged, as do the v185 eaves
and v205 Circus rustication. There is no competing pane grid or facade repaint.

## Verified identities

| Site | Primary identity | Retained mapped/source anchor |
| --- | --- | --- |
| St. Oberholz / St. Rosenthaler | [Operator, Rosenthaler Straße 72a](https://sanktoberholz.de/locations/st-rosenthaler) | OSM node 330264334; LoD2 `DEBE01YYK0000Die` |
| Apotheke Rosenthaler Platz | [Operator, Weinbergsweg 1](https://apotheke-rosenthalerplatz.de/) | OSM node 3310052861; LoD2 parent `DEBE01YYK0000E7j`, part `DEBE3DQfwmzCiCK6` |
| U8 Rosenthaler Platz | [BVG station](https://www.bvg.de/de/verbindungen/stationsuebersicht/u-rosenthaler-platz); [Landesdenkmalamt, 09080134](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080134) | Four entrance nodes and four connected steps ways in retained Geofabrik PBF |

The pharmacy occupies the Circus Hostel's ground-floor corner, not the separate
Circus Hotel across the square. Its new members end below the hostel's upper
facade. The operator's Oberholz address includes **72a**; the retained café node
has house number **72**. The operator supplies identity, while the mapped point
and independently containing LoD2 parent supply placement. The difference is
retained explicitly rather than relocating the café to another parent.

The existing freely licensed street reference remains
[Mitte Rosenthaler Platz.jpg](https://commons.wikimedia.org/wiki/File:Mitte_Rosenthaler_Platz.jpg),
Fridolin freudenfett, 3 October 2016, CC BY-SA 4.0. Additional context:
[Sankt Oberholz Berlin.jpg](https://commons.wikimedia.org/wiki/File:Sankt_Oberholz_Berlin.jpg),
Thomas Angermann, 3 February 2006, CC BY-SA 2.0. These are reference-only;
no photograph, image crop, font asset or photographic texture ships. Identity
and current address are verified against the operators, not those dated images.

## Four finite stair entrances

| OSM steps way | Upper entrance node | Source step count |
| --- | --- | --- |
| 380361912 | 3836989071 | 16 |
| 380361914 | 3836989072 | 22 |
| 380361915 | 1389419275 | 16 |
| 380361919 | 3836989070 | 23 |

The original two-point axes and `incline=up` establish the upper end and direction
independently of the building geometry. Landesdenkmalamt also documents four
entrances leading to the distribution level. Treads, side walls, upper green
railings, descending handrails and blue U markers follow these axes. Each has a
finite 0.75 m lower landing and a represented back wall. No entire station or
unmapped underground passage is invented.

Clear width **2.5 m**, riser **0.17 m**, landing allocation, railing and sign
dimensions are explicitly **display estimates**, not measured BVG dimensions.
The resulting descents are 2.72/3.74/2.72/3.91 m. Upper heights reuse the existing
v176 terrain field, with its separate native sampling. Parent facades reuse their
exact retained rigid terrain offsets. Small frame/trim dimensions and material
tones remain recognition estimates following the existing pane register.

`rosenthalerV228Profile.ts` exports `ROSENTHALER_V228_OPENINGS`,
`rosenthalerV228FloorAt`, and `rosenthalerV228SolidAt` for the shared surface and
walking integration. The upper approach is open; only the represented sides and
back collide. The renderer itself neither deletes old arrays nor adds replacement
pavement. Shared integration cuts only these exact four openings, retaining the
outside complement and its attributes.

## Size and verification

The source extractor retains only the six identity/entrance nodes and four stair
ways, without unrelated POIs or network data. Runtime JSON is **39,747 bytes**;
source evidence is 2,992 bytes. Six exact-count instance batches per mode provide
equal full drawn detail on touch/desktop and separate orthogonal native blocks.
Drawn instance/color buffers total **55,708 bytes**; native buffers total **231,344 bytes**. Scene metadata stores no decoded source object or row arrays.
No new textures, lights, animations, tour stops, source coverage or residency
limits are introduced.

Reproduce with `uv run python scripts/build_rosenthaler_v228.py`.
`tests/test_rosenthaler_v228.py` independently checks containing owners, source-wall
attachment, preserved source hashes, mapped endpoints/counts and terrain datums.
`rosenthalerV228.test.ts` checks monotonic stair floors, open upper approaches,
side collision, finite transforms, native orthogonality and buffer limits.
`rosenthaler-apertures-v228.test.ts` independently checks removed area, affine
attribute interpolation, unchanged remote vertices/indices and slab instance
bytes, the native quarter-metre complement, and a complete descent/pause/ascent
through the actual pedestrian solver with the retained LoD2 obstacle index.
The late v226 sidewalk source has no intersection with these four openings;
its explicit production opt-in consequently retains its original arrays.
Late `restored-paving-*` and `restored-asphalt-*` source groups are eligible for
the same bounded cuts before attachment. Their actual production constructor
and worker transfer round trip are covered by a regression preserving remote
vertices and indices. The retained NDJSON currently contains no triangles at
these four mouths: absence of cut metadata is therefore expected, not proof of
an occluded stair. An initial browser assertion incorrectly required such
metadata; it was replaced with actual vertical ray hits and walking checks.
No old street outside the four exact mouth envelopes is changed.

Browser ray checks exposed a separate native stair problem: an axis-aligned
bounding box spanning a full rotated tread width overlapped several higher
steps. Native members now subdivide across the tread as well as along it,
retaining six batches and adding 70,756 instance/color bytes only in the native
branch. A direct Three.js raycast regression checks 168 positions across all
four drawn/native runs against the walking floor (at most one 0.17 m riser).

The outer-city packets supply the actual Rosenthaler pavement. Browser rays
identified two retained layers, `city` and `scheunenviertel-v168`, in `3_-3` and
`4_-3`; both are opened. `build_rosenthaler_ground_v228.py` records 73/28/156/57
exact low ground triangles (drawn/native by tile), source SHA-256, indices,
centimetre coordinates and original color bytes in a 35,004-byte receipt.
All four apertures and native quarter-metre expansions are disjoint from the
source building navigation polygons. The packed helper verifies each receipt,
preserves the entire original interleaved Uint16 vertex/color prefix and every
unaffected index triple, and appends only the outside polygon complements.
It runs cooperatively before the surrounding constructor computes buffer totals
or parks/publishes geometry. Superseded exclusive scratch arrays are detached
immediately through the existing release helper. Quantization remains centimetres; buildings, roofs,
other source meshes, navigation and original packet files remain unchanged.

The real-packet regression reconstructs all four published chunks, checks source
hashes, unchanged bytes/indices and exact buffer accounting, and raycasts through
both source layers onto all four staircases. Walking exit checks use the actual
outer ground datum, which can differ from the stair's upper endpoint on a native
terrain cell: tolerance is 1 cm against ground physics and 22 cm against visible
pavement (including the retained surface lift), not a constant stair-top height.


The targeted final regression set passed 73 Bun tests (1,232,035 assertions)
covering Rosenthaler geometry/apertures, actual surrounding chunks, decoded
ownership, pedestrian collision, Scheunenviertel streaming, static-buffer
parking, progressive attachment and the retained v226 sidewalks. After immediate
scratch-buffer release was added, the 37 affected packed-ground/surrounding
constructor tests passed again; `bun --bun tsc --noEmit` and all four Python
source/receipt tests passed. An independent read-only review additionally tested
720 rays against the four actual packet constructors before parking, while
parked and after restoration, all without a covering ground hit; it verified
557 orthogonal native hole-edge segments and 768 walking assertions. These
checks preserve the old interleaved prefix and every unaffected index span;
geometry grows only 5.9–13.9 kB per affected packet, with unchanged buffer count.


Final production-browser verification on 17 October 2026 passed after explicitly
waiting for **both** corrected surrounding packets to be visible. The running
Day scene reported 73/156 exact ground cuts and Minecraft 28/57 for 3_-3/4_-3.
All six Rosenthaler batches were actually drawn in each mode. Twenty-four
vertical ray checks hit the stair treads first; all four entrances were walked
down to their finite landings and back onto the independently sampled exterior
pavement in both modes. A fresh 390×844 touch context also drew all six native
batches, loaded both corrected ground packets and passed three additional tread
rays. No page error, browser crash or context loss occurred. The local report
and screenshots are in `/tmp/v228-rosenthaler-browser/`; this bounded run is a
regression check, not a guarantee against unrelated future device memory loss.
