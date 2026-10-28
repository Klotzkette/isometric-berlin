# Moabit coal unloading and travelling bridge — v281

This additive exterior scene connects the waterside unloading portal to the
quay conveyor, the elevated crossing of Friedrich-Krause-Ufer, the north-yard
conveyor and the open coal yard. The travelling bridge has two rails, four
splayed legs and bogies, open lattice sides, maintenance railings, trolley,
cab, suspension ropes and a two-jaw grab. It is a fixed illustrative pose;
neither machinery position nor stockpile volume is a current operational claim.

## Evidence and bounds

The source receipt `geo_data/regierungsviertel/moabit-coal-v281-source.json`
retains the original nodes, longitude/latitude coordinates, tags, versions and
timestamps of five complete OSM ways, retrieved on 28 October 2026. Coordinates
use EPSG:25833 and the existing world origin. The receipt also records hashes
of the unchanged core presentation prisms and the complete v277 source,
construction data and ownership records. No building owner is retired.

| Feature | Source | Interpretation |
| --- | --- | --- |
| Coal yard | OSM 26624547 | Exact mapped heap boundary; six estimated faceted piles remain inside it. |
| Waterside unloading portal | OSM 896589831 | Separate narrow mapped gantry; estimated boom, ropes, grab and receiving hopper. |
| Travelling bridge | OSM 896589832 | The roughly 98 × 73 m polygon is a travel area, never a solid roof or crane body. One narrow bridge spans its two travel rails. |
| Road and quay conveyors | OSM 1124344230 and 1124344231 | Complete mapped plan rings; elevated belts and open frames. The road crossing has supports only at its ends. |
| North-yard continuation | Geoportal DOP 2025 spring | Separately labelled approximate centreline, absent from the selected OSM ways; 3.2 m width is estimated. |

Ground y=5.2 is the retained local display datum. All crane heights, steel member
sizes, cable positions, belt levels, cab dimensions, pile heights and colours
are display estimates. The bridge lower chord is estimated at 15 m above
ground, with a 4.2 m truss depth. The belts use world y=13.0. These values are
not official machinery measurements. No plant interiors are added.

[Berlin's heritage record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050441)
and [industrial heritage account](https://industriekultur.berlin/ort/kraftwerk-moabit/)
establish the plant and coal delivery by canal and railway. The
[BEW July 2026 announcement](https://www.bew.berlin/aktuelles-und-presse/2026/bauma%C3%9Fnahme-putlitzbruecke/)
provides modernization context, but is not evidence to remove any existing
source body or add an unevidenced completed chimney. The full v277 buildings,
roofs, voids, facades and previous details remain unchanged.

The inspected [Denis Apel photograph, 22 March 2005](https://commons.wikimedia.org/wiki/File:HWK_Moabit_Berlin_2.JPG),
CC BY-SA 3.0 Germany, supports the grey-green lattice, walkway, cab and open
coal-yard recognition. It is historical appearance evidence, not a current
inventory. DOP 2025 confirms the open yard, thin bridge and conveyor course.
No photograph or orthophoto pixels are bundled. Exact credits and licence
links are in `docs/moabit-coal-v281-references.json`.

## Integration contract

- Drawn: add `createMoabitCoalV281(false, { mobileLike })` once to the required
  exterior scene. Native: add `createMoabitCoalV281(true, { mobileLike })` once
  to its independent required scene. The returned roots already freeze their
  transforms and expose day/night materials.
- Add `moabitCoalBodyBlockedV281(x, z, bottomY, topY, radius, native)` to body
  collision. It checks actual slender members and piles. The coarse early
  rejection box is never used as a solid obstacle.
- Add `moabitCoalFloorV281At(x, z, native)` to support-height resolution. It
  returns null outside the represented heap; it never flattens the public road.
- Do not retire owners, prune core prisms, replace navigation source sheets or
  add loader descriptors. No residency/prefetch/visibility limits change.

Native geometry is constructed independently as cardinal cuboids, including
stepped trusses and pile cells. It does not rotate the drawn group. Touch and
desktop receive identical geometry in each style. Adjacent native pile cells
merge only where height and colour match exactly. Native collision uses those
same cardinal cells; drawn pile support follows the actual triangles.

The implementation adds 20,220 bytes of runtime TypeScript/JSON. The receipt is
7,751 bytes. Submitted geometry measured by the focused static audit is:

| Style | Geometry/instance bytes | Draw calls | Instances | Base vertices |
| --- | ---: | ---: | ---: | ---: |
| Drawn | 37,636 | 2 | 409 | 282 |
| Native | 331,796 | 1 | 4,361 | 24 |

`bun test tests/moabit-coal-v281.test.ts` passes 3 tests and 62,469 assertions.
It checks retained source hashes, exact OSM rings, mobile parity, positive
determinants, cardinal native matrices, finite geometry, pile support,
granular collision, open travel space and the clear road crossing. No full
suite, bundle build or browser visual acceptance is claimed by this module's
focused test. Final integration and browser acceptance remain with v281.

The separate “Pickingplatz” request is implemented as Pekinger Platz on
Nordufer after the district's triangular-square description and nearby Deichgraf
address resolved the site. The interpretation was stated to the owner; nearby
Sprengelpark remains distinct. See `pekinger-platz-v281.md` for the bounded
playground, table-tennis and shrub additions.
