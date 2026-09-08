# Schloss Bellevue and the permanent presidential office — v1.0.8

Pipeline step 10. The palace and neighbouring permanent Bundespräsidialamt
receive separate source-bound architecture. The existing interim Amtssitz am
Spreebogen and its presidential standard remain separate models.

## Source geometry

`bellevueSource.json` contains all fourteen original palace parts under
`DEBE01YYK0002NGR`, the permanent office `DEBE01YYK0002RpF`, and thirteen
neighbouring LoD2 records used solely to avoid windows on concealed walls.
The source is the official [LoD2 tile 388/5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5819.zip),
created 2 March 2026, SHA-256
`b47e056da0a6211110188c5589f3d60cf2cb2ec0a0fd4b5ebd22b786a3b97dfa`,
under dl-de/zero-2-0. OSM identities are
[palace way 1034456118](https://www.openstreetmap.org/way/1034456118) and
[office way 226371533](https://www.openstreetmap.org/way/226371533).
Original source records remain unchanged in the data pipeline.

The palace uses its original planar walls and hipped roofs, replacing the
coarse maximum-height display prisms. Coordinates follow the existing world
origin E389500/N5820000/H30. Raw palace ground 2.444 m is shifted by 2.756 m
to the committed DGM-aligned 5.2 m base; office ground 0.938 m is shifted by
4.262 m. The main palace roof reaches 27.125 m in that frame, preserving the
original millimetres rather than the prism's rounded 27.1 m top. Entire-ring
Newell normals avoid unstable roof planes at near-collinear survey vertices.
Roof sampling remains clamped to each original face's vertical extent.

The office retains its exact ellipse-like footprint and 21.087 m source
height. Its coarse conical LoD2 roof conflicts with the photographed building.
DOP 2025 and the references below support an outer photovoltaic rim, raised
elliptical glazed lantern, white roof lattice and central service strip.
Those subdivisions and facade bays are display estimates inside the source
building envelope; rooftop service details are also procedural estimates.
The old synthetic 13.2 m grey ellipse overlay is removed.

## Architectural and current-state evidence

The Federal President's [palace account](https://www.bundespraesident.de/DE/amt-und-aufgaben/amtssitze/schloss-bellevue/schloss-bellevue_node.html),
[office account](https://www.bundespraesident.de/DE/amt-und-aufgaben/bundespraesidialamt/gebaeude/gebaeude_node.html)
and [renovation information](https://www.bundespraesident.de/DE/amt-und-aufgaben/amtssitze/baumassnahmen-am-berliner-amtssitz/baumassnahmen-am-berliner-amtssitz_node.html)
were checked on 8 September 2026. The [palace monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050346)
and [Museum der 1000 Orte office record](https://www.museum-der-1000-orte.de/bauwerke/bauwerk/bundesprasidialamt)
support identity and architecture. Gruber + Kleine-Kraneburg designed the
1996–1998 permanent office. Its three office levels and polished dark stone
facade remain distinct from the palace's light plaster and stone detailing.

The palace keeps nineteen principal front axes, two main window levels with
small upper oval windows, three-level wings, the central entrance and stair,
profiled surrounds, pediment and three allegorical roof figures. Ridge
chimneys and flush roof lights follow the inspected views. No unsupported
array of dormers is invented. Detail subdivisions and sculpture proportions
are not facade or sculpture surveys.

The official 2026 account confirms refurbishment and the move to the interim
site. It does not establish a precise current scaffold layout. The viewer
therefore shows the established architectural fabric, without copying old
scaffolding or a future competition design.

The [DOP 2025 WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was inspected with EPSG:25833 bounds `[388020,5819670,388330,5819960]`,
1860 × 1740 pixels. The image remains outside the runtime package.

## Inspected free visual references

| File | Author | Licence |
|---|---|---|
| [Schloss Bellevue Berlin with snow 2025-02-15 01.jpg](https://commons.wikimedia.org/wiki/File:Schloss_Bellevue_Berlin_with_snow_2025-02-15_01.jpg) | GPSLeo | CC0 |
| [Schloss Bellevue Berlin with snow 2025-02-15 03.jpg](https://commons.wikimedia.org/wiki/File:Schloss_Bellevue_Berlin_with_snow_2025-02-15_03.jpg) | GPSLeo | CC0 |
| [Bellevue Palace (Berlin), 2024 (01).jpg](https://commons.wikimedia.org/wiki/File:Bellevue_Palace_(Berlin),_2024_(01).jpg) | Bahnfrend | CC BY-SA 4.0 |
| [2004-12 Berlin Bundespraesidialamt.JPG](https://commons.wikimedia.org/wiki/File:2004-12_Berlin_Bundespraesidialamt.JPG) | Sir James | CC BY 3.0 |
| [Siegessäule TopView6.JPG](https://commons.wikimedia.org/wiki/File:Siegess%C3%A4ule_TopView6.JPG) | Achim Raschka | CC BY-SA 3.0 |

The last file's author is identified on its Commons page and upload history;
the API's Artist field is absent. Its historical palace scaffolding is not
used. Every photograph is credited in the canonical and viewer manifests.
No photograph, crop, bitmap logo or external font enters the runtime.

## Modes, collision and verification

Drawn modes use exact source surfaces and shared instanced details. Minecraft
uses only box geometry, thin facade assemblies and stepped roof blocks.
Existing coarse source columns are clipped to bounded roof profiles; roof
courses whose clipped top falls below their base are omitted, not inverted.
Facade groups share their source-cell clearance. The thirteen neighbouring
parts remain intact, and concealed palace window rows are suppressed rather
than projecting through adjacent annexes.

Pedestrian obstacles retain the exact footprint and query the same source
roof planes. Courtyards remain open. Initial partial loading still constructs
all fifteen authored parts, so a deferred generic building batch cannot leave
one wing absent. Night materials use the existing world presentation hooks.

| Representation | Draw calls | Instances | Geometry/instance bytes |
|---|---:|---:|---:|
| Drawn full | 3 | 6,724 | 635,440 |
| Drawn mobile | 3 | 3,755 | 383,012 |
| Minecraft full | 1 | 8,752 | 665,800 |
| Minecraft mobile | 1 | 4,728 | 359,976 |

Twelve focused checks cover exact source and neighbour identities, partial
startup completeness, finite bounded geometry, no runtime textures, actual
pane rays against exact source surfaces and retained 4 m cells in all four
profiles, original roof height bands and actual downward roof rays. Software
plates render the actual Three.js triangles and instance matrices. These are
geometry checks; direct browser and iPhone visual inspection remains unavailable
while the host Mac is locked.
