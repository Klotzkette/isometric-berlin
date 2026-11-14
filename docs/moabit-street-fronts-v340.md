# Moabit street fronts

The viewer adds address-specific facade details to eight retained buildings on
five Moabit streets. Each front uses selected edges from its exact current
prism and the mapped adjacent street. The block rendering independently uses
cardinal faces on the corresponding retained four-metre columns.

| Address | Building in current viewer | Distinguishing details |
| --- | --- | --- |
| Gotzkowskystraße 14 | `95383510` | Genähr pair, broad central stucco field, shallow blind-gable motif and stronger lower ornament |
| Gotzkowskystraße 15 | `95383506` | Related Genähr house with smaller hoods, cornices and a differentiated centre |
| Gotzkowskystraße 16 and 17 | `95383504`, `95383501` | Müller pair with matching window ornament, brackets and open iron railings |
| Thomasiusstraße 4 | `45170950` | Brick surrounds against light panels, symmetrical bay articulation, loggia rails and stepped-gable relief |
| Thomasiusstraße 5 | `45170943` | Projecting oriel fittings, dark basalt-like base, a central ornamental relief and muted bronze accents |
| Kirchstraße 24 | `45170952` | Restrained facade with iron balcony and loggia railings |
| Perleberger Straße 57 and Rathenower Straße 49 | `21453614` | Two street fronts and chamfer with rusticated joints, mixed window hoods and bracketed cornices |

The landmark register describes documented architecture. Facade finishes,
individual opening widths and heights, rail dimensions and component positions
are display estimates. No reference photography is embedded. The present pass
retains all existing bodies, roofs, courtyard geometry, facade batches and
navigation. The Gotzkowskystraße 16 and 17 Drawn shells are each 10 m in the
shipped viewer. Their matching Berlin LoD2 parents are about 23.65 m and
23.07 m, respectively. This pass fits visible features to the shipped walls.
The higher silhouettes require a complete measured replacement.

A source sheet in `src/app/src/data/moabitStreetFrontsV340.json` retains the
eight complete current prism records, mapped OSM addresses and street ways,
the matching official Berlin LoD2 IDs and archive digests, and each qualified
native column tuple and exposure direction. Its 22 Drawn edge strips and 39
Native column faces exclude other buildings. Native admission also checks the
retained native class/grid and the adjacent uncovered cell. Two static instance
batches use the same full Drawn detail for both screen sizes.

Sources checked 14 November 2026. The mapping source is the Geofabrik Berlin
snapshot of 29 September 2026. Berlin LoD2 comes from the official Berlin ZIP
tiles `386_5820`, `388_5820` and `388_5821` (dl-de/zero-2-0).

- [Landesdenkmalamt, Gotzkowskystraße 14–17 ensemble](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050395)
- [Landesdenkmalamt, Gotzkowskystraße 14](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050396)
- [Landesdenkmalamt, Gotzkowskystraße 15](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050397)
- [Landesdenkmalamt, Gotzkowskystraße 16](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050398)
- [Landesdenkmalamt, Thomasiusstraße 4](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050240)
- [Landesdenkmalamt, Thomasiusstraße 5](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050290)
- [Landesdenkmalamt, Kirchstraße 24](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050321)
- [Landesdenkmalamt, Perleberger Straße 57](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050308)
- [Geoportal Berlin, LoD2 archives](https://gdi.berlin.de/data/a_lod2/atom/)
- [OpenStreetMap contributors and ODbL terms](https://www.openstreetmap.org/copyright)
