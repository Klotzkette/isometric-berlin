# Berliner Dom, Altes Museum and the granite bowl — v1.0.10

Pipeline step 10 adds procedural, texture-free recognition architecture within
the existing polygon. No bounds revision or additional tour stop is introduced.

## Evidence and retained records

`domAltesMuseumSource.json` is a 52,974-byte extraction from the official
[2 March 2026 LoD2 tile 391_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_391_5819.zip),
licensed dl-de/zero-2-0. Its archive SHA-256, date, parent identities, all original
wall/roof planes and prior OSM display records remain packaged as evidence.

- Berliner Dom: parent `DEBE01YYK000000D`, 149 original wall/roof surfaces,
  exact 5,100.6 m² ground plan. Semantic identity: OSM way `313670734`.
- Altes Museum: parent `DEBE01YYK00000kr`, all sixteen parts and their original
  planes. Semantic identity: OSM relation `3619`. Their union keeps both courts
  open. The additional portico parent `DEBE01YYK0001xI7` is also retained in the
  source record. It overlaps the museum's low front part `DEBE3DyLUEjxE0Jc`
  with the same 7.301 m top; it is not drawn a second time.
- The bowl is at exact OSM node `376689138`, world
  `[1880.092031, 5.2, 19.330824]`. Its plinth ground equals the committed smooth
  terrain sample, also checked at the museum's lowest approach step.
- All eighteen official source parts were checked against the actual committed
  EPSG:25833 polygon. No source record is moved or removed.

The [cathedral's architecture account](https://www.berlinerdom.de/besuchen-wissen/ueber-den-dom/architektur/)
provides the present 98 m total height, the two-storey west front, four-storey
Spree front and removed northern Denkmalskirche. The removed church is not
reconstructed. The
[SMB museum profile](https://www.smb.museum/en/museums-institutions/altes-museum/about-us/profile/)
provides the eighteen fluted Ionic columns, open atrium, broad staircase and
central rotunda. The
[Berlin monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09012501)
and [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/granitschale-7879/)
identify the bowl as red granite, rather than marble, and establish its 6.9 m
published diameter, three supporting blocks and access steps. Local member
sizes are display estimates, not measured fixture dimensions.

## Explicit source conflicts

The old Dom OSM display used a flat 98 m extrusion. Its official LoD2 source
instead uses one flat roof at viewer y=45.688 m, with ground y=2.270 m, omitting
all domes and the lantern. Neither coarse envelope describes the current
silhouette. The exact official plan is retained; body, tambour, copper main
cupola, two tall west turrets and smaller east roof cupolas are procedural
subdivisions supported by the inspected references and DOP. The 98 m complete
silhouette is measured from the retained source ground (top y=100.270 m).
Intermediate heights and the reduced east cupola scale are explicitly
photograph-based presentation estimates. The lantern is open: eight posts,
flared gilded ribs, a globe, stem and a long Latin cross. The secondary turrets
have gilt balls, not duplicate crosses.

The old Altes Museum OSM mass had only a generic 9 m height. All official wings,
roof slopes and courts replace that display envelope. Two approximately one
metre-wide source roof strips, `DEBE3DZGavw271ZU` and `DEBE3DMfhQc2wgOO`, have
asymmetric peaks at 33.323 m and 39.416 m. DOP shows a coherent low central
rotunda roof, without those isolated teeth. These two display strips are
bounded by the main rotunda's retained 32.211 m top. Their original higher
planes remain in the source JSON. The sixteen-part source roof otherwise
remains unchanged; a small circular glazed roof light is a display supplement.

The [DOP 2025 spring WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was inspected at EPSG:25833 bbox `[391280,5819900,391580,5820080]`, 1800×1080,
layer `dop_2025` (dl-de/zero-2-0). It supports the two courts, front terrace,
roof hierarchy and relative cupola sizes. Roof-image displacement is not used
as a new ground coordinate measurement.

## Presentation and physical access

The factory shares geometry among Day, Night, Snowstorm and Schwellenraum and
supplies explicit Day/Night/moonlit material variants. Minecraft uses its own
single instanced cube batch. It retains the same cross, bowl cavity, columns,
open courts and smaller eastern cupolas on mobile. Only microdetail and shell
sampling are reduced. Opaque facade planes, model coordinates, deterministic
materials and original source surfaces need no texture downloads.

Column bases, fluting, Ionic volutes, recessed red vestibule panels, the Latin
public-domain dedication, cornices, equestrian silhouettes and roof statues
are code-authored recognition details. The figures are simplified, not sculpture
scans. Exact OSM nodes `4353173360` and `4353173363` anchor the equestrian groups.

`domRoofAt` supplies cupola and cross landing heights. `altesRoofAt` follows the
actual displayed planar roof slopes. `domAltesExtraSolidAt` keeps eighteen
portico pillars and its entablature solid while leaving the intervals open;
`domAltesExtraGroundAt` supplies terrace, staircase, portico roof and bowl
plinth/cavity support. Source-scoped suppression removes old OSM masses and the
three duplicate generic public-art representations. Minecraft removal uses the
original OSM footprints and their own 4 m raster height envelopes, preserving
unrelated taller overlaps and neighbouring streets/water.

## Inspected visual references

Each is external, attribution-only and not bundled or loaded by the viewer:

- Alexander Hüsing, [Berliner Dom Kuppelkreuz.jpg](https://commons.wikimedia.org/wiki/File:Berliner_Dom_Kuppelkreuz.jpg),
  CC BY 2.0: restoration view of globe, long cross, faceted facing and flared
  gilt members; not a present-day location or scaffold claim.
- Chainwit., [2023 Berliner Dom - Westfassade -- 01.jpg](https://commons.wikimedia.org/wiki/File:2023_Berliner_Dom_-_Westfassade_--_01.jpg),
  CC BY 4.0: current rebuilt cupola form, oculi, west front and colour hierarchy.
- Ansgar Koreng, [Altes Museum, Berlin-Mitte, 170117, ako.jpg](https://commons.wikimedia.org/wiki/File:Altes_Museum,_Berlin-Mitte,_170117,_ako.jpg),
  CC BY 4.0: Ionic columns, recessed red panels, steps and dedicatory frieze.
- Janericloebe, [Berlin Lustgarten Granitschale 002.JPG](https://commons.wikimedia.org/wiki/File:Berlin_Lustgarten_Granitschale_002.JPG),
  public domain: plinth, three supports and separate access steps. Its seasonal
  cover is not treated as permanent bowl geometry.
- Times, [Riss der Granitschale im Lustgarten.JPG](https://commons.wikimedia.org/wiki/File:Riss_der_Granitschale_im_Lustgarten.JPG),
  CC BY-SA 3.0: granite material and the open curved basin, not a tracing of the
  individual crack pattern.

## Validation and cost

Six focused tests pass: retained evidence, open courts/portico, exact terrain
support, all four smooth/native desktop/mobile geometry profiles, downward
source/cupola/cross rays, exterior-facing facade rays, and removal of more than
500 old raster columns with unrelated-neighbour guards. TypeScript compilation
passes. Actual mesh/instance triangles were exported and inspected as software
orthographic views of the Dom, Altes Museum, bowl and Minecraft ensemble. These
are geometry QA images, not browser screenshots.

| Profile | Draw calls | Instances | Rendered vertices | Geometry + instance bytes |
|---|---:|---:|---:|---:|
| Smooth full | 14 | 6,505 | 222,212 | 825,112 |
| Smooth mobile | 14 | 3,273 | 109,396 | 447,480 |
| Minecraft full | 1 | 15,597 | 374,328 | 1,186,020 |
| Minecraft mobile | 1 | 9,635 | 231,240 | 732,908 |

A local Bun construction sample took 19/18 ms for smooth/native full and
7/6 ms for smooth/native mobile. This is CPU factory timing, not browser frame
rate or a guarantee on a particular phone. Minecraft models use exterior wall
strips and a thin roof course; there is no dense hidden voxel fill.
