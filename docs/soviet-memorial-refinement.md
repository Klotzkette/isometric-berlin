# Soviet War Memorial Tiergarten refinement

Step 10 retains the catalogue camera point and all attributed OSM/LoD2 source
records, while resolving the separate components against their own source
positions. The four drawn modes share the corrected procedural memorial;
Minecraft uses an independent opaque block model with the same site layout.

## Evidence and corrected placement

The committed `osm.gpkg` POIs and a bounded Overpass check on 2026-09-08 agree
on the following EPSG:25833-derived viewer positions. `x = E - 389500` and
`z = 5820000 - N`; local ground remains the previously recorded 4.79 m datum.

| Component | OSM identity | Viewer x / z in metres |
| --- | --- | --- |
| Soviet soldier | node/278740616 | 27.439235 / 253.760733 |
| West T-34, number **200** | node/489762789 | -7.916797 / 307.389060 |
| East T-34, number **300** | node/489764929 | 69.888956 / 300.976056 |
| West ML-20 | node/489765078 | 7.795022 / 287.390837 |
| East ML-20 | node/489766052 | 50.841102 / 282.575251 |

The old display reversed the tank numbers, used approximate ±33 m tank offsets
and placed them only 11.5 m in front of the catalogue target. That target is
8.48 m north of the soldier and is not a statue survey point. The actual tank
nodes stand 78.07 m apart and roughly 50.54 m in front of the soldier along the
site axis. Both tanks face the street, with the long axes of their hulls and plinths
perpendicular to the entrance frontage. The former outward/road-parallel
interpretation was incorrect and is corrected in v1.0.34. The site angle of
0.082237 radians follows the two exact tank nodes rather than an assumed
east-west axis.
The two guns retain their independently mapped positions and point south toward
the street, correcting the former north-pointing barrels.

The [Berlin Senate's memorial account](https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/tiergarten/)
establishes two tanks at the main entrance, guns diagonally behind at the first
stair, two officers' sarcophagi halfway up the stair arrangement, six side
pylons and the eight-metre bronze soldier, with two fountains behind the
colonnade. The [official 2025 spring DOP](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was inspected in the bounded EPSG:25833 rectangle
`389477,5819683,389580,5819780` (1545 × 1455 pixels). It confirms the long
forecourt, narrower curved colonnade, street-side lawns and flower strips,
south-facing guns and rear fountains. A second v1.0.34 inspection at
`389477,5819674,389580,5819733` explicitly resolves the tank and plinth long
axes towards the street; the 2024 BugWarp images corroborate the hull/barrel
alignment. No aerial image is shipped in the viewer.

The freely licensed photographs actually inspected for vehicle form and street
context are BugWarp's [Berlín en agosto de 2024 - BugWarp (15).jpg](https://commons.wikimedia.org/wiki/File:Berl%C3%ADn_en_agosto_de_2024_-_BugWarp_(15).jpg)
and [Berlín en agosto de 2024 - BugWarp (9).jpg](https://commons.wikimedia.org/wiki/File:Berl%C3%ADn_en_agosto_de_2024_-_BugWarp_(9).jpg),
both taken 11 August 2024 and licensed
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
Both show the eastern number-300 tank. The existing credited *Sowjetisches
Ehrenmal (Berlin-Tiergarten) Totale.jpg* and the two 2013 memorial views were
also inspected. Photographs provide visual cues, not new survey geometry;
no photographic texture, crop or additional photo asset is bundled or loaded.

## Geometry and explicit source conflicts

`SovietMemorialSource.ts` retains all four original decimetre LoD2 rings:

- `WJ00005g` and `WJ00005h` bound the curved colonnade plan. The generic solid
  prism interpretation closes its open bays. Six separated procedural piers
  and articulated spans now follow that approximately 40 m envelope instead
  of the previous approximately 58 m display width.
- `K0002Kle` is the exact centre footprint, but its 3 m reported height does
  not describe the complete pylon and eight-metre bronze statue. The existing
  approximately 20.85 m overall recognition silhouette remains an explicitly
  non-surveyed display estimate; the eight-metre soldier is the published fact.
- `FubIvyI4` is an approximately 86 × 90 m low envelope. Rendering its 1.8 m
  height as a solid building buries the real forecourt and creates an invisible
  floor after visual suppression. It is resolved as articulated paving,
  terrace and stairs; its original source record is not deleted or rewritten.

The drawn and voxel prism passes suppress exactly these four source bodies.
Minecraft filters their bounded source footprint, including the half-cell
projection margin; surrounding buildings, source trees and paths remain.
All four are also excluded from the generic pedestrian building/roof index.
Their replacement is the same granular solid and support-surface description
in every visual mode. The walking override rejects unrelated source IDs.

The old side-colonnade display height was reduced with its width. Individual
pier sections, 8.65 m cornice display top, cap courses, local stair risers,
vehicle/plinth dimensions, flower spacing, fountain diameters and sculpture
subdivisions remain procedural display estimates. They are not presented as
additional LoD2 or OSM measurements. The 2025 DOP determines composition and
bearing, while the retained LoD2 parts determine plan scope.

The tanks now have sloping hull sides, compact hexagonal turrets, lowered
vehicle proportions, paired end sprocket/idler wheels, five road wheels per
side, hubs and wheel fasteners, and stepped masonry plinths. Their separate
block-native forms retain the corrected numbers and bearings. The generic
monument layer delegates the two exact ML-20 source nodes to this model,
preventing duplicate cannon geometry while preserving source accounting and
memorial protection.

## Interaction, budgets and checks

The existing conservative Schwellenraum memorial volume still encloses the
entire corrected site, including both tanks and guns. Its extent is unchanged.
Ordinary walking collides with the pylon, individual piers, vehicle/plinth and
sarcophagus solids, leaving the forecourt and open bays accessible. Ground
support follows the rendered pavement, eight lower risers, intermediate
terrace and four upper risers. Each stair rise is 0.18 m. No old slab roof can
win ahead of those support surfaces.

| Representation | Renderables | Stored vertices | Rendered vertices | Geometry and instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn, full/mobile | 282 | 11,896 | 27,576 | 422,428 |
| Minecraft full | 1 | 24 | 16,632 | 53,508 |
| Minecraft mobile | 1 | 24 | 15,096 | 48,644 |

Minecraft uses 693 / 629 fixed block instances. Mobile preserves the whole
site and all four vehicles; only member segmentation and track-shoe repetition
are reduced. The existing drawn inscription canvases remain procedural local
lettering, not photographic imagery. Stored/rendered vertex counts include
ink lines and repeated instances; runtime canvas memory is not included above.

Eight dedicated regression tests check exact component positions, correct
number identities and barrel directions, unchanged source rings, absence of
the four generic bodies and roof obstacles, open-bay and solid-pier raycasts
in drawn/full/mobile geometry, actual stair surface support, source-scoped
walking overrides, retained protection and reversible five-mode visibility.
Software orthographic QA additionally inspected actual Three.js triangles and
instance matrices for an overview, the eastern tank and the Minecraft model.
These checks are not a browser/WebGL or physical-device inspection.

The v1.0.34 tank correction also rotates both cap courses and the matching
pedestrian collision footprint. The barrel uses olive armour paint around
a dark bore, with a small mantlet shield and six fasteners. These dimensions
remain photo-guided display estimates. The Minecraft version adds one dark
muzzle block per tank, with no extra draw call or smooth-geometry duplicate.
