# Charlottenburger Tor source alignment (Step 10, v1.0.101)

The two existing v116 wings were almost parallel to Straße des 17. Juni,
although the [Landesdenkmalamt description](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09096448)
explicitly describes transverse, slightly curved colonnades. The retained OSM
relation [13918836](https://www.openstreetmap.org/relation/13918836) has two
separate current rings. Their complete vertices are retained in
`charlottenburger-tor-v201-evidence.json`; their centroids and minimum-rectangle
major axes determine the correction, independently for each half.

| Wing | World X, Z centroid | Old yaw | Current yaw | Change |
| --- | --- | --- | --- | --- |
| North | −2733.549, 538.519 | 4.985° | 88.676° | +83.691° |
| South | −2728.776, 597.234 | 4.985° | 102.292° | +97.308° |

Three.js yaw is measured from world +X towards −Z. The requested visual
45-degree correction was checked against those source axes; it was not used
as a surveyed angle. Source centres move the north wing 9.59 m and south
wing 8.92 m outward. Rotating around the old centres would have narrowed the
published 34 m road opening to about 12 m. The mapped inward edges have
approximately 34.7 m north–south separation (35.07 m shortest planar distance). The source rings guide placement and retain
curvature in evidence; this bounded correction does not claim that the older
straight procedural colonnades now constitute an exact measured facade.

All 58 original authored primitives, 36 ink parts, colours, indices, heights,
columns, bases, cornices, attic relief cues and bronze groups survive. Each
complete wing receives one rigid transform. The only local placement repair
translates the entire southern principal bronze 6.9 m across its local front
axis to the documented east/Tiergarten face; its anatomy is not reflected.
Frozen pre-correction hashes were captured directly from the v1.0.100 function.
Tests inverse-transform every vertex and compare colours and indices exactly.
The [district history](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/bauwerke/artikel.1368662.php)
identifies the northern Sophie Charlotte and southern Friedrich I, the 1937
widening and the separate western candelabra. Their geometry, the bridge,
source roads/trees and the Großer Stern tunnel houses are untouched.

Minecraft previously hid the expanded drawn layer without an independently
named gate counterpart. Its new native reading includes every corrected
primitive as 0.5 m orthogonal surface cells, vertically coalesced without
hidden infill. Both wings use one final-capacity instance batch: 6,567 boxes,
18,064 source surface cells, 499,092 bytes of instance matrices/colours plus
the shared cube. Drawn geometry stays within the existing merged batch and
adds no draw calls. Neither mode uses image textures. The 290,405-byte native
constructor source is separate from 70,038-byte lightweight navigation data.
Native collision intervals exactly match the displayed surface cells;
drawn collision follows the individual original cuboids and cylindrical/conical
solids. The roadway and three sampled column gaps per wing remain passable.

`createMinecraftCharlottenburgerTorV201()` is native-only. Smooth production
uses `appendCharlottenburgerTorV201` inside the existing ExpandedCityDetails
batch. `charlottenburgerTorV201SolidAt(x,y,z,radius,native)` contains no ground
or water override. Source placement, procedural dimensions and the existing
8 m ground anchor remain explicit and distinct.

Regenerate with `uv run python scripts/build_charlottenburger_tor_v201.py`
and, from `src/app`, `bun scripts/build-charlottenburger-tor-v201.ts`.
Focused checks: `tests/test_charlottenburger_tor_v201.py`,
`src/app/tests/charlottenburger-tor-v201.test.ts`, and the existing expanded
city-detail tests. Evidence records three close/overview camera poses.
No photographic source or new photo-credit record is introduced.
