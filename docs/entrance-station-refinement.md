# Ehrenhof, Hauptbahnhof bearing frames and HumboldtHafenEins

Step 10, v1.0.5. These refinements use existing source geometry, public
terrain/orthophoto data and individually credited Commons photographs.

## Chancellery entrance

The previous recognition model used its lowest LoD2 anchor, world y=1.554 m,
for the entrance furniture. The shipped DGM gives 5.0–5.1 m along the fence;
the old 2.65 m bars therefore ended below the terrain. The entrance, paving,
sculpture and nearby furniture now use a 5.15 m finish level. Building source
anchors and maximum heights remain unchanged. Protocol flags share the
corrected finish level. The old floating street-pavilion canopy is removed:
the inspected exterior photograph and 2025 orthophoto show an open apron there.

The fence joins the inner faces of the two source office wings at local
x=170.429 m. Its approximately 55.3 m run has 3 m flat steel blades, narrow
gaps and two low horizontal ties. Blade spacing/depth and small gate details
are estimates from the credited 2013 exterior photograph, not surveyed
security construction data.

Ten visible lawn outlines were manually traced from the public
[Berlin DOP 2025 spring WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr),
layer `dop_2025`, EPSG:25833 bounds `[389330,5820080,389495,5820215]`,
1650×1350 pixels. The small plots intersect the fence as in the image.
The source profile stores the transform and an approximately 0.5–1 m reading
uncertainty; rounded vertex decimals do not imply survey accuracy. Smooth
modes round the outline corners. Minecraft uses a common 2 m block grid,
which prevents coincident lawn faces. Shadowed ground is not reconstructed
from guesses. The exact source building footprints remain intact.

## Eastern Hauptbahnhof supports

[Sven Okas's March 2023 photograph](https://commons.wikimedia.org/wiki/File:Hauptbahnhof-berlin-abstuetzung-humboldthafenbruecke-2023.jpg)
shows rust-coloured paired steel sections, transverse bearing heads with
stiffeners, base plates, a retained grey support stem and inspection
landings. These replace the previous schematic V-trestles.

The intervention uses four existing derived rail support stations:
`[-44.4,-719.9]`, `[-21.2,-719.8]`, `[-35.9,-660.2]`, `[-12,-663]`.
They remain on the western side of Humboldthafenbrücke immediately beside the
station; the former broad rust-colour classification over the whole harbour
approach is removed. Ground follows the DGM and the tops meet the existing
13.575 m deck underside. The support positions in the old rail payload are
schematic, not individually surveyed pier coordinates. Steel section sizes
are photo-guided estimates. The 2025 orthophoto confirms the station/bridge
relationship; the 2023 reference does not establish the current engineering
condition of temporary works. No technical safety assessment is represented.

Drawn modes share the railway's colour/material system. Minecraft uses one
instanced box batch. No support is added across the public water opening.

## SPIEGEL location and facade

The [SPIEGEL-Hauptstadtstudio is at Alexanderufer 5](https://www.berlin.de/tickets/suche/orte/spiegel-hauptstadtstudio-bdc53199-9a0f-4b6b-8e25-37db8cfd1d2d/).
Committed OSM office node `12121083184`, world `[151.1871244,-596.7039962]`,
lies in HumboldtHafenEins source part `tppqGxWH`. This is an office identity
point, not a surveyed entrance or a claim about the entire company's seat.

The existing ten-part HumboldtHafenEins source shell remains intact. Its
facades now show actual folded pilaster sections, varied sunblind positions,
a deeper articulated colonnade and a continuous arcade head. Facade rows
start above the 5.1 m promenade level instead of treating low source basement
parts as the visible ground. The two low wings retain two rows; upper parts
use seven/eight-storey readings. Heights and outline records are unchanged.

[KSP Engel's project account](https://www.ksp-engel.com/projekte/humboldt-hafen-eins)
and the already credited 2022 harbour view establish the building family and
waterfront articulation. The published public passage remains documented;
these shallow facade details do not invent a measured interior route.

## Verification

Tests check the real fence's height against DGM, its end coordinates, blade
hits and clear gaps, lawn/fence intersections, fixed Minecraft palette and
absence of coincident block tops. Support tests check exact reuse of the four
rail stations, member roles, ground contact and deck clearance. Facade rays
test actual combined source shells and details. Software orthographic renders
use actual Three.js triangles and instance matrices; they are not browser
screenshots or an iPhone interaction test.
