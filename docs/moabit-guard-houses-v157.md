# Surviving Moabit prison officers' houses (step 10)

The three surviving houses stand on the northern boundary of the present
memorial park. They are not a restored prison complex. The public park, its
walls, trees, paths, cell and entrances remain separate, unchanged source owners.

## Evidence and retained geometry

[Landesdenkmalamt object 09050274](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050274)
identifies the original corner house 5D (1842–49), house 5C (1888) and house
5B (1897). It specifically describes the windowless prison-facing walls and
console-supported projecting attic/parapet. That primary account is the basis
for keeping the park-facing elevations blank rather than adding generic windows.

| House | OSM identity | LoD2 parent | Retained display parts |
| --- | --- | --- | --- |
| Lehrter Straße 5B | way 157673512 | DEBE01YYK0002T9T | WhPZcY83, qH5ZODlA |
| Lehrter Straße 5C | way 157673507 | DEBE01YYK0002LHa | Ef78aGXl, cdPTILfN |
| Lehrter Straße 5D | way 157673508 | DEBE01YYK0002Sjv | K0002Sjv |

OSM address, apartment use and four-storey tags were checked on 1 October 2026
against the bounded API map response. Original Berlin LoD2 creation date is
2 March 2026, tile `389_5820`. All five original public prism records are retained
verbatim in `moabitGuardHouseSource.json` and remain in the runtime payload.
The source JSON additionally retains the exact original roof sheets with a
vertical translation to each existing viewer ground. No footprint or source
height is enlarged or reduced.

5D's source roof code `5000` previously fell back to a flat cap although its
actual retained LoD2 roof sheets show hips. Its drawn interpretation changes
only that code to hipped `3200`; it still uses the viewer's existing fitted-roof
algorithm and full envelope. That fitted eave is not represented as a survey.
The separate Minecraft roof samples the retained source planes into bounded
stepped blocks and replaces only the five source building footprints.

## Visual references and limits

- [Berlin Brewer, *Lehrter Gefängnis Häuser.jpg*](https://commons.wikimedia.org/wiki/File:Lehrter_Gef%C3%A4ngnis_H%C3%A4user.jpg),
  photographed 5 February 2014, CC BY-SA 4.0. Inspected for red/brown brick,
  slender exterior windows, central stair risalit, corbels and shallow roofs.
- [Assenmacher, *Geschichtspark Blick von der Zelle auf Beamtenhaus.JPG*](https://commons.wikimedia.org/wiki/File:Geschichtspark_Blick_von_der_Zelle_auf_Beamtenhaus.JPG),
  photographed 30 June 2013, CC BY-SA 3.0. Inspected for the blank prison-side
  brick face and its relationship to the retained park wall.

Photographs are external references only: no image, crop or texture is bundled
or fetched by the viewer. There is no tracing of the protected landscape plan.
Local window dimensions, bay subdivisions, mortar courses, corbel sizes,
rainwater pipes and colours are procedural display approximations. No current
interior or temporary construction condition is claimed.

## Representation and budgets

Drawn modes retain the existing building bodies and add one instanced batch
of thin brick surfaces, interrupted mortar lines, four-storey exterior window
rhythms, window reveals/sills, attic corbels and zinc roof edges. Brick surfaces
cover prior generic strokes on the deliberately blank park-facing walls.
Adjacent source stair volumes suppress details at their occupied joints.

Minecraft substitutes one independent cuboid batch for the coarse building
columns, retaining the same five source footprints. Its walls and stepped roofs
are surface shells with no hidden solid interior fill. There is no smooth-model
double. Existing source-building collision remains responsible for these private
houses; no new barrier is introduced in the memorial park.

| Representation | Draw calls | Instances | Stored geometry + instance bytes |
| --- | ---: | ---: | ---: |
| Drawn | 1 | 2,439 | 186,012 |
| Minecraft | 1 | 1,420 | 108,568 |

Both touch and pointer profiles produce identical buffers within each style.
Diagnostic facade records are opt-in and are not retained in production.
The focused tests check five-source preservation, exact masks, three identities,
blank park faces, four window levels, finite buffers, no textures, bounded roof
heights, no hidden fill and full/mobile equality. TypeScript compilation passed.
