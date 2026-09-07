# Riverside architecture refinements — v1.0.3

Step 10 improves Zollpackhof, Sandkrugbrücke and the Federal Ministry for
Economic Affairs without expanding the project bounds or landmark catalogue.
Day, Night, Snowstorm and Schwellenraum share the drawn architecture;
Minecraft uses block-native counterparts. Photographs remain non-bundled
visual references; the viewer adds no photographic texture or image request.

## Zollpackhof: retain the plan, disclose the height conflict

The two restaurant parts retain every vertex of committed Berlin LoD2
`RVRCWHeT` and `FqL2azIz`, under parent `DEBE01YYK0002Tak`. The current
[official source tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5820.zip)
was created on 2026-03-02; its checked SHA-256 is recorded in
`zollpackhofProfile.ts`. Restaurant node `269676264` and beer-garden way
`422205278` retain their OSM identities.

The raw LoD2 heights, 26.046 m and 17.639 m, conflict with the low restaurant
visible in the licensed references. They remain recorded as source evidence.
The display uses 4.2 m walls with 8.4 m and 7.7 m overall heights. These are
**photo-based, non-surveyed estimates**, not corrected official measurements.
Only the old rendered shells and their matching Minecraft columns are
replaced; the source data stays intact. Pedestrian roof support follows the
represented roof instead of the conflicting tall source envelope.

The [operator's restaurant account](https://www.zollpackhof.de/the-restaurant.html)
distinguishes the restaurant and adjacent remise. The documented reference
reading adds pale plaster, red hipped roofs, arched glazing, a broad entrance,
three dormers, wall lamps and low approach steps. Local widths, bay counts
and roof subdivisions remain authored approximations. The earlier detached
generic tap-house box is removed. The garden keeps its mapped chestnut and
seating with a clear central passage. The former 1555 tree-date claim is not
retained as fact; source identity and source height remain separate from age.

## Sandkrugbrücke: inventory envelope and engineer section

OSM carriageways `36260393` and `248010193` determine the bearing and centre.
Berlin's June-2025 bridge inventory fixes the current 32.6 × 28.8 m deck
envelope, `BW 3446035`. The
[GRASSL engineering record](https://www.grassl-ing.de/projekt/sandkrugbruecke_42.html),
checked on 2026-09-07, supplies 34.10 m overall length, 32.60 m span,
29.52 m construction width, 1.10 m structural depth and five rows of
two-hinged frames. The construction width and inventory deck width are
distinct source measurements; neither silently overwrites the other.

The former 1.28 m depth is retained only as a legacy conflict value. The
21 m clear opening, 4.93 m clearance and 18.7 m roadway division are retained
**display assumptions**, not measurements from the current engineer page.
Licensed reference photographs inform the lower railing bars and four
paired lamp masts; member dimensions and spacing are procedural.

Minecraft now has a complete deck, raised footways, five underframe rows,
railings and four lamps. Its separately named smooth Sandkrug group is hidden
in Minecraft, and the represented deck replaces only its matching source
bridge raster cells. Both presentations keep a traversable surface; see
[pedestrian mobility](pedestrian-mobility.md) for route and water limits.

## Ministry: main house and historic wings

Six LoD2 parts remain the authoritative body envelopes. Main house
`K00008CN` on Invalidenstraße is distinguished from the two older
Invalidenhaus wings. It keeps its 18.1 m source height, all eleven source
courts and existing roof cap. This revision does **not** reconstruct its
complete mansard or roof lantern.

Selected street walls gain 60 framed main-house windows, three risalit
readings with paired pilasters and segmental pediments, stone bands and
rustication. Other walls retain generic source facade detail. The two
historic wings gain 240 framed windows across exterior, court and end walls,
plus the north entrance's round window; the modern canal facade retains
44 bays and 220 panes. Only the two historic wings retain the previously
documented hipped-roof correction. The ministry
[architecture account](https://www.bundeswirtschaftsministerium.de/Redaktion/DE/Textsammlungen/Ministerium/architektur.html)
and credited Commons references supply recognition context; local decoration
is not a surveyed facade model.

## Bounded cost and regression evidence

| Layer | Renderables | Measured geometry and instance bytes | Guard |
|---|---:|---:|---:|
| Zollpackhof drawn | 2 | 242,154 | <260,000 |
| Zollpackhof Minecraft | 1, 660 blocks | 51,000 | <55,000; <700 blocks |
| Ministry drawn overlay | 3 | 1,206,636 | <1,300,000 |
| Complete Humboldthafen Minecraft layer | 1, 1,762 blocks | 134,752 | <150,000 instance bytes; <1,950 blocks |

The last row includes the existing bank, paths and two vessels as well as
the new bridge and facade details. No additional Minecraft draw call is
opened for the ministry.

Tests retain the exact source plans, verify finite geometry and budgets,
raycast exterior window panes to catch wall occlusion, and sample actual
roof triangles across both interiors to catch missing or downward-facing
roof surfaces. Bridge tests compare navigation heights against the actual
drawn and Minecraft meshes. Offline orthographic geometry renders provide
visual QA; these checks do not replace a physical iPhone usability test.
