# Hauptbahnhof public entrances — step 10

The Europaplatz and Washingtonplatz entrances now admit a walking player in
Day, Night, Snowstorm, Minecraft and Schwellenraum. Desktop and mobile use the
same metric collision policy. The two public exits and the five-level station
arrangement are documented in [DB's station plan](https://www.bahnhof.de/downloads/station-plans/1071.pdf).
The committed LoD2/signature anchor, 180 × 42 m hall, 321 m curved rail hall,
office bridges and five interior elevations are unchanged.

The drawn gables have six open sliding-door pairs each. Their openings are cut
through the glass and mullion geometry; the leaves are retracted to either
side. Minecraft retains its existing broad block-gable opening and raised
floor. `HauptbahnhofAccessProfile.ts` shares the drawn door, foyer and guard
dimensions with `HauptbahnhofNavigation.ts`. Door subdivisions and the small
entrance foyers are procedural display dimensions, not measured door surveys.

Each drawn foyer joins the two ground-level side galleries before the daylight
slot. Ground-gallery slabs meet the foyer edge without overlapping coplanar
tops. A transverse glass guard joins the existing gallery balustrades at the
slot end. The upper gallery, lower gallery, six cross bridges, four full-height
panoramic lift shafts and deep platforms remain distinct; the foyer does not
fill the central atrium. Lift shafts, service pavilion, gallery guards, hall
sides, columns and closed entrance bays remain solid.

Only the explicitly identified station source prisms may have their coarse
solid envelope replaced inside the bounded public main hall. Unknown overlapping
buildings, neighbouring offices, source columns and memorial protection retain
their collision. Both warm drawn-world loading and a cold Minecraft start
install the same source, physical-solid and floor hooks. The floor hook keeps
Schwellenraum visitors on the gallery until its existing inner ramp footprint;
it does not snap upper/deep-level visitors back to the concourse.

## Reproduction

Select **Berlin Hauptbahnhof**, approach either short glass end from its square,
then enter walking mode. Aim through one of the visible open doors immediately
beside the central mullion. Walk into the foyer, turn toward a side gallery,
then follow the gallery beside the atrium. Return through the same door.
Desktop uses the walking controls; mobile uses the orange joystick. No jump
is required for the entrance threshold.

For deterministic QA, coordinates below use the station's unchanged local
frame: world anchor `[-119.936, 4.575, -683.307]`, rotation `21.82°`.
The regression route is local `(x,z)`:

1. `(1.745, ±96)` outside the entrance, with negative z for Europaplatz.
2. `(1.745, ±85)` inside the foyer.
3. `(12, ±85)` on the side-gallery approach.
4. `(12, ±60)` alongside the atrium, then reverse the same points to exit.

World outside points are approximately `[-153.998, -773.078]` at the north
entrance and `[-82.634, -594.833]` at the south entrance (`x,z`; local ground
is sampled). The constant main-concourse floor is world y `4.825` in drawn
modes and `5.895` in Minecraft. The x=12 m gallery route keeps the existing
source pillar `YK0000Cu` solid farther outward.

## Verification and limits

`hauptbahnhof-pedestrian-access.test.ts` loads the complete committed source
prism payload and terrain. It walks both routes in both directions for all
five modes using full keyboard input and partial analog joystick input,
checks the floor datum and retained solids, and raycasts the complete drawn
station plus the actual Minecraft block gables to verify visible openings.
The existing glass, curve, vertical-hall and lift tests remain in force.
An integrated spawn/mode-switch regression also checks that the drawn daylight
void resolves to an actual lower slab or deep floor, rather than falling back
to an invisible canonical terrain surface across the atrium.

This change provides ground-level entry and gallery access. It does not add
working lifts or a new five-level pedestrian stair simulation to every mode.
Schwellenraum keeps its existing authored ramps and deep-platform navigation;
the other levels remain represented by their existing geometry.
Minecraft's existing north-south side-glazing blocks remain physical walls,
including where they meet its east-west hall. This change does not introduce
new side openings through those represented blocks.
