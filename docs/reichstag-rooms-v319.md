# Furnished Reichstag section

Step 10, v1.0.199. The reversible longitudinal section gains 28 open room bays
across its five existing exhibit levels. Offices have desks, separate seats,
keyboards and visible monitor faces. Meeting and briefing rooms have tables,
six chairs, papers and presentation boards. Reading rooms have reference books
and shelving; reception areas have sofas, low tables and rugs. Press workspaces,
records storage, rear cabinets, corridor runners and open doorways distinguish
the other uses. Warm wood, cloth, book and wall colours remain visible without
textures, labels or an additional lighting pass.

## Public evidence and interpretation

Checked 6 November 2026:

- [Bundestag: architecture of the Reichstag](https://www.bundestag.de/besuche/architektur/reichstag/architektur/)
  describes the reference library and social spaces on the plenary level,
  visitor information and press facilities, presidial offices and reception
  rooms, and parliamentary-group meeting spaces. Its public photographs inform
  the restrained material palette. Photographic credits remain with the
  Bundestag and the photographers named on that page; no image pixels are
  downloaded or redistributed.
- [Bundestag: use of the building](https://www.bundestag.de/besuche/architektur/reichstag/nutzung)
  distinguishes office, reception, administration, visitor and parliamentary
  meeting functions. It does not supply a surveyed plan for individual rooms.
- The complete main-building source footprint and all six original courtyard
  rings remain those retained in `ParliamentRetainedEnvelopeV295.ts`. Existing
  public circulation and chamber, foyer, stair and dome air volumes remain
  those in `parliamentInteriorsV295Profile.ts`.

The individual bay dimensions, partitions, level heights, furniture quantities
and furniture positions are an **illustrative section layout**, not a measured
private office plan or an inventory of occupied rooms. No individual member of
parliament, private occupant, current group allocation or restricted circulation
is represented. The service-level storage is similarly an explanatory fitting.
The existing public interior, chamber chairs, dome mirrors, ramps and routes
remain intact. Functional wing rooms gain no new pedestrian navigation route.

## Geometry and integration contract

`ReichstagRoomsV319.ts` exports:

- `createReichstagSectionFurnishingsV319(native = false)`: an additive,
  texture-free section-only group; the parent section controller owns its
  visibility, mode selection, material presentation and disposal.
- `REICHSTAG_SECTION_LAYOUT_V319`: room types, IDs, floors, heights, local
  bounds and open-door centres, using the existing v295 Reichstag frame.
- `reichstagSectionMembersV319(native = false)`: the finite semantic box
  inventory, including positions, sizes, colours and room association.
- `reichstagSectionFootprintContainsV319(orderedConvexWorldXZPolygon)`:
  complete source-plan containment, with boundary crossings and wholly enclosed
  courtyard holes checked. Invalid, degenerate and nonconvex input is rejected.
  The predicate is independent of exhibit height and can bound basement panels.
- `reichstagSectionBoxFitsV319(localCentre, size, native = false)`: checks the
  actual family footprint, cut-side clearance and complete public-air volume
  exclusion. Walls and furniture are checked as volumes, not just centres.

All bays lie in the far north/south wing strips, absolute local v 44.4–63.1 m.
Their western face is absent. New member footprints stay east of local u -7.6 m,
clear of the actual -8 m section plane; rear walls stand at u 12.4 m. A separate
partition at u 3.8 m has a genuine 1.30 m doorway into the rear corridor. Side
partitions, coloured jambs and lintels expose room volumes without covering the
foreground desks or chairs. Shelves, cabinets and seat backs use separate boxes;
there is no opaque furniture billboard.

The drawn family follows the existing building yaw. The native family is built
independently from axis-aligned cuboids at the transformed centres, and every
resulting world footprint is checked separately against the complete source
plan. Neither source surfaces nor older floor, decoration, geometry, navigation
or collision arrays are altered. `ReichstagRoomsV318.ts` is unchanged.

## Finite counts and rendering

| Retained or added layer | Drawn instances | Native instances |
| --- | ---: | ---: |
| Persistent public v295 interior including v318 public-room refinements | 4,799 | 7,378 |
| Existing v318 section floor edges and decoration | 421 | 1,844 |
| New v319 furnished section | 1,060 | 1,060 |

The persistent public room budgets remain 6,500 / 15,000. The existing section
instance check remains below 2,200, and this additional exhibit is independently
bounded at 1,060 members. Even the combined counts are 6,280 / 10,282. The
drawn v318 polygon floor is an additional retained mesh, not an instance.

The new layer uses one stock-box geometry, one instance batch and one day/night
material pair per active family. It contains 8 monitor screens, 10 conference
tables, 76 chairs, 14 bookcases with 84 book groups, 8 sofa seats and 28 open
doorways. Fine face shading gives each cuboid depth in the unlit presentation.
Touch and desktop use the identical complete inventory. Normal night,
Schwellenraum and native material presentation use the existing pipeline.
No texture, source packet, request, animation, per-frame task or budget increase
is introduced.

## Verification

`bun test tests/reichstag-rooms-v319.test.ts` passes 9 cases / 69,311 assertions.
It checks actual instance corners against the complete outer ring, six courts,
all public-air volumes and the finite cut; enclosed-hole and crossing-edge
negative cases; all native off-axis matrix entries; monitor visibility above
chair backs; chair/desk clearance and genuine open doorways; complete mobile
storage and lighting-mode words; and section mount, family switch, close,
reopen and disposal while original source arrays retain their identity.

A geometric preview of the generated presidial bays was inspected separately:
the office monitor, distinct seat, six-seat meeting table, shelves, sofas and
open western faces are legible. This is a local model inspection, not a claim
that the final browser integration or total city rendering has been verified.
