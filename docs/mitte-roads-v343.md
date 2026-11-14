# Surveyed street edges beside the Bundeskanzleramt

The finite Drawn correction covers Heinrich-von-Gagern-Straße and its northern
junction with the western Paul-Löbe-Allee. It replaces inferred road widths
with municipal carriageway boundaries, including the curved junction and
pedestrian median. It does not claim a citywide street survey or change Native.

## Sources and present-day comparison

* [Berlin street-survey WFS](https://gdi.berlin.de/services/wfs/strassenbefahrung):
  carriageway owners `cm_fahrbahn.24972`, `.25080`, `.25145`, and their adjacent
  surveyed sidewalk parts; 39 admitted feature records in total.
* [Official 2025 spring orthophoto](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
  compared with the survey and the owner's v286/v287 street photographs.
  The former street north of the Swiss embassy (`cm_fahrbahn.24862`) now crosses
  lawn in the photograph and is explicitly excluded. The survey date remains
  2014–2015; this is not described as a new engineering survey.
* [Official material dictionary](https://gdi.berlin.de/data/strassenbefahrung/docs/Datenformatbeschreibung_Stra%C3%9Fenbefahrung_2014.pdf):
  02 asphalt, 04 small stone paving, 08 natural-stone slabs, 13 bound gravel.
  Slab seams occur only on admitted material-08 polygons; their spacing is an
  explicit visual estimate. There is no grid across asphalt or cobbles.

The two three-metre strips beside Heinrich-von-Gagern-Straße are municipal
green-verge owners `ce_gruenflaeche.21337` and `.41415`. The cycleway layer does
not claim them. Their boundaries were compared with the 2025 orthophoto; the
existing green strips are preserved, rather than filled with invented paving.
Their carriageway borders are raised municipal curb owners
`bd_bordstein.237701` and `.468448` (`BOR=1`, raised above 3 cm). These explicit
line owners supply the borders that a sidewalk-only selection would miss.

The retained evidence includes full original survey geometries and request
hashes. Neither orthophoto nor user-photograph pixels are shipped. The runtime
data is 379,982 raw bytes (122,861 bytes with ordinary gzip), with no new network
texture request.

## Ownership and preservation

The new surface is 4,763.77 m² of road and 4,673.51 m² of surveyed pedestrian
ground. It supplies 812.15 m of curbs, 459 stone-slab seam runs and 366 curb
joint marks. Street trees, the sculptural lights, signs, fountain strips,
building geometry, axes and road markings remain unchanged.

Only 417 indexed old asphalt faces and 1,035 indexed old paving faces yield.
The runtime guard checks every original face index and every original position,
plus each complete replaced curb and kerb-joint record. Each removed face's
outside complement is compiled separately at its original material and height:
134.28 m² of asphalt and 119.91 m² of paving are retained. Geometry tests compare
the actual emitted complements, allowing only the existing centimetre encoding
precision (under 15 mm Hausdorff distance and under 0.8 m² aggregate symmetric
difference per material).

The Hbf public-space batch and DistrictStreets use one canonical admission
decision. Exactly 126 wholly contained old v256 kerb-joint boxes yield to the
new kerb course. All 20 fountain strips, every outside/partial joint and all
Native rows remain complete. A rejected transaction retains the original
streets and all original v256 details. The old data files are unchanged.

Navigation continues to use the same continuous DGM ground. No building,
water, bridge or pedestrian blocker is added; curb height remains the existing
14 cm display convention. The separate v343 road-ground correction uses the
emitted surveyed triangles when removing proven overlapping raster ground.

## Reproduction and checks

`scripts/build_mitte_roads_v343.py` compiles from the retained compressed source
and verifies the original district payload SHA before writing its own output.
The finite extraction window is X/Z `[-225, -92, 46, 117]` and never acts as a
blanket visibility mask: only the admitted surveyed polygons claim ground.

Validation: six focused runtime tests, the two existing Reichstag public-realm
tests and eight Hbf approach tests pass; three independent geometry tests verify
the emitted outside complements, material-specific seam containment and the
preserved grass-verge / raised-curb cross-section. Shared
renderer integration, complete build and browser checks belong to the release
validation rather than this source-only report.
