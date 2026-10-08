# Zionskirchplatz perimeter, v1.0.93

This bounded additive pass completes the directly square-facing facade inventory
around OSM way **50436070**. It adds differentiated muted plaster and ground-floor
colours, window frames/divisions, sills and doors. It does not modify or replace
the retained LoD2 building shells, roofs, courtyard holes, v175 four-house details,
v186 edge courses, church, park, paths, trees or terrain.

## Source scope and inventory

`scripts/build_zionskirchplatz_v193.py` reads the retained Berlin LoD2 source
`geo_data/regierungsviertel/alt-mitte-v169/source-391_5821-00.json.gz` and the small
`geo_data/regierungsviertel/zionskirchplatz-v193-source.json` reference profile.
The square polygon comes from the retained Geofabrik Berlin 2026-09-29 OSM
snapshot, projected to EPSG:25833 before conversion to the viewer's world frame.
No new city extraction or photographic texture is required.

The coverage audit identifies **20 source parents and 30 exposed wall planes**.
Two planes are already fully represented by v175 and remain untouched; the new
layer adds the other **28 planes**. All 11 previously authored v175 planes remain
present, including those outside the strict inward-facing selection. The receipt
stores each complete parent record's SHA-256, roof count, source wall polygon IDs,
original rings, exact local wall contour and selected frontage member ranges.

All parent IDs below have prefix `DEBE01YYK000`. Sides describe the source profile;
missing addresses are deliberately not inferred from neighbouring houses.

| Parent suffix | Square side | Address retained in source / previous authored profile |
| --- | --- | --- |
| 01cF | West | — |
| 02Ih | East | — |
| 02wP | East | — |
| 03cl | South | — |
| 04Ag | West | — |
| 04H7 | South | — |
| 05G6 | South | Kastanienallee 50; original v175 details retained |
| 05Nd | West | — |
| 063B | West | — |
| 07G1 | South | — |
| 07Mw | Northwest | Zionskirchstraße 23 |
| 07Vw | North | Zionskirchstraße 25 |
| 07yQ | North | Zionskirchstraße 27 |
| 08CV | West | Zionskirchstraße 22/24; selected plane already covered by v175 |
| 0BUt | South | — |
| 0Bri | North | Griebenowstraße 12 |
| 0C4w | Northwest | Zionskirchstraße 21; original v175 details retained |
| 0CIk | East corner, upper facade | Kastanienallee 49 / historical Café 103 |
| 0COw | East, low neighbour | — |
| 0DY3 | East | Zionskirchstraße 35 |

Selection uses outward rays from three positions on each source wall to the
square, requiring two to reach it. Obstructions are height-aware. The inward
Café 103 wall `UUID_eb77e031-e88b-4b97-b282-9526a2eba5b6` is visible above the low
neighbour: its new surface begins at local **6.30 m**, world **24.67 m**, with
**0.13 m** clearance above that neighbour's world roof at **24.54 m**. A purely
two-dimensional occlusion test would incorrectly lose this upper facade. Three
rear owners (`0DtA`, `05Gs`, `09Fq`) remain excluded behind tall existing fronts.

## Geometry, slope and preservation

Drawn plaster follows the complete measured wall polygon, including gables and
holes, at a shallow **0.21 m** outward offset. This covers the retained generic
v169 window rhythm (maximum 0.125 m offset), without deleting source detail.
New rectangular members must fit wholly within that clipped source wall; all
window/door ornament remains below the measured lowest eave. The native version
uses a separate orthogonal 0.5 m block reading and vertically coalesced runs.
Existing v186 base/cornice courses remain projecting architectural profiles;
the new facades have not been pushed metres into the street to hide them.

Every source parent is translated with its own
`buildingTerrainOffset(parentId, anchorX, anchorZ, groundY)`. All 20 owners have
exact retained `weinbergBuildingOffsetsV176.json` entries. The old nearest-four
v175 terrain lookup is never used for the new houses. Native and drawn models
share those parent datums and leave the hill unchanged.

## Reference evidence and limits

Existing credited references are reused:

- [Zionskirchplatz panorama, Ansgar Koreng, 28 March 2016](https://commons.wikimedia.org/wiki/File:Zionskirchplatz,_Berlin-Mitte,_160328,_ako.jpg), CC BY-SA 3.0 DE.
- [Bars Kastanienallee Berlin](https://commons.wikimedia.org/wiki/File:Bars_Kastanienallee_Berlin.jpg), retained v175 reference for the historical Café 103 frontage.

Three new credited photographs by **Fridolin freudenfett**, taken **18 October
2014**, are licensed **CC BY-SA 4.0**:

- [Mitte Zionskirchplatz-003](https://commons.wikimedia.org/wiki/File:Mitte_Zionskirchplatz-003.JPG)
- [Mitte Zionskirchplatz-004](https://commons.wikimedia.org/wiki/File:Mitte_Zionskirchplatz-004.JPG)
- [Mitte Zionskirchplatz](https://commons.wikimedia.org/wiki/File:Mitte_Zionskirchplatz.JPG)

Exact new credit records are in `zionskirchplatz-v193-credits.json`; root integration
mirrors them in both source and public credits. Retained raw reference hashes are
recorded, but no photograph pixels are bundled. The sources are partially
tree-obscured and dated. Colours, approximate levels and regularized window
divisions are visual interpretations, **not a surveyed window inventory or a
claim about current tenants/repainting**. Ground doors do not invent business
names. The profile's `approxBays` notes are qualitative reference notes; actual
member counts derive from the measured plane width and the documented regular
3.65 m approximate pitch, constrained to that source plane.

## Integration and budget

Factory: `createZionskirchplatzV193(native = false)` in
`src/app/src/ZionskirchplatzV193.ts`. Root adds this once to
`OutlineLandmarksV182`. It exposes ordinary day/night materials for the existing
theme/disposal lifecycle, freezes static transforms and retains complete detail
on mobile. No rendering or streaming budgets change.

| Representation | Draw calls | Instances | CPU/GPU attribute bytes |
| --- | ---: | ---: | ---: |
| Drawn | 2 | 2,114 | 173,192 |
| Native Minecraft | 1 | 7,006 | 533,104 |

The drawn paint has 110 triangles. The combined static JSON is 624,239 bytes.
Each representation stays below 1 MiB, with no textures or per-frame callbacks.

Focused validation: `tests/test_zionskirchplatz_v193.py` reproduces the payload,
checks exact source hashes and complete owner coverage, preserves historical v175
bytes, checks the exposed upper-wall clearance, validates all paint and members
against measured contours/eaves, and verifies mirrored photo licences.
`src/app/tests/zionskirchplatz-v193.test.ts` checks individual terrain lifts,
instance placement, orthogonal native transforms and actual buffer/draw counts.

For visual comparison, the square centre is approximately world
`[2233, 23, -1706]`. Useful ground targets are the northwest row
`[2205, 34, -1765]`, west row `[2182, 31, -1705]`, and Café 103 upper wall
`[2280, 32, -1664]`; camera views should be taken from inside the square facing
outward. Root retained the v192 overview/north/south/Café 103 before images and
captures matching v193 views in desktop and mobile browsers.
