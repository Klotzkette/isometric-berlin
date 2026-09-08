# Topographie des Terrors — v1.0.7 evidence and limits

Step 10 improves the present-day documentation centre and its public grounds.
The model is procedural, texture-free architecture, without copied exhibition
photographs, documents, quotations, historical insignia or a reconstruction of
the demolished headquarters.

## Metric sources

`topographyTerrorSource.json` retains five unmodified delivered Berlin LoD2
prisms from the 2 March 2026 source tile `390_5818` (Geoportal Berlin,
dl-de/zero-2-0). Museum `DEBE02YY400002h6` / viewer `400002h6` has an approximately
55 m square outline, an approximately 17 m open court, base 3.4 m and roof
13.2 m in the viewer's local vertical frame. These source coordinates, court
and maximum main roof height remain fixed.

The other four prisms belong to site parent `DEBE02YY4000056X`, not four
occupied exhibition buildings: `EruJoJLU`, `ZdDl61l8`, `fxtMHxUV`, `G4JuQSIz`.
Their top surfaces remain at 3.9, 3.5, 4.4 and 5.6 m respectively. Five thin
surface pieces preserve their source plans and heights, excluding the museum
outline and mapped exposed cellar. All original records remain in the source
supplement. The source site cap must not close the museum courtyard or turn
public paths into building interiors.

OpenStreetMap anchors, © OpenStreetMap contributors, ODbL-1.0:

- Site: way `24368681`.
- Archaeological trench: way `281621233`; its measured source length is about
  182 m and its width about 7.1 m.
- Preserved Wall: way `591200192`.
- Exposed western cellar: way `639831712`; separate memorial ground patch:
  way `639831711`.
- Northern entry stairs and switchback ramp: ways `409575371`, `409575376`.
- Public paths and the separate covered trench route retain 22 exact source
  axes, including `449361871`, `252953367` and `252953365`.

For the Wall, official Vorderlandmauer record `85` remains the alignment
priority. The display clips its polyline between the nearest projected
stations of the OSM endpoints. Both original paths remain recorded: OSM is
195.806 m long; the clipped official line is 195.800 m. This is compatible
with the foundation's rounded description of approximately 200 m. The two
routes differ locally by roughly 1 m; they are not silently substituted or
stretched to an artificial exact 200 m. Individual panel divisions and damage
holes are procedural, not surveyed locations of specific chips.

`groundGrid` is a bounded, frozen 4 m sample grid from the committed city
terrain payload. Wall panels, protection rails and trench roof supports follow
this local ground; the former constant elevated base floated above the west
end. This is the existing tree/lighting-derived terrain interpolation, not a
new archaeological excavation survey.

## Architectural evidence

The [architect's project account](https://www.heinlewischer.de/projekte/detail/topographie-des-terrors-berlin-neubau-dokumentations-und-besucherzentrum-und-gestaltung-des-historischen-gelaendes/)
identifies Ursula Wilms / Heinle, Wischer und Partner and landscape architect
Heinz W. Hallmann, and describes the detached square building, screened
transparent/opaque envelope and central courtyard. The
[foundation's history](https://www.topographie.de/ueber-den-ort/geschichte-nach-1945)
records the opening on 6 May 2010 and preservation of the Wall in its damaged
1989/90 state. The [site circuit](https://www.topographie.de/ausstellungen/gelaenderundgang)
distinguishes protected underground foundations, exposed remains and the
surviving Wall. The model does not invent exposed ruins over every buried
foundation.

The museum has fine silver screen frames and horizontal mesh readings, a
recessed glazed lower band, broad northern entrance, seven display stair
subdivisions, the mapped switchback ramp, roof copings, water mirror and roof
service strip. Facade pitches, local heights, material swatches and step counts
are photo-proportioned display estimates, not measured construction drawings.
Both full and mobile retain every exterior elevation and court elevation.
Minecraft uses its own coarser cuboid frame and mesh reading.

The [Geoportal DOP 2025 spring service](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
was inspected at EPSG:25833 bbox `390180,5818500,390480,5818730`, 1600 × 1227 px.
It supplies the current photovoltaic group arrangement, absent from the 2011
free aerial reference. Fifteen procedural array groups and the southern
service strip remain in all four detail/profile combinations. Panel counts,
subdivisions and tiny roof offsets are display estimates. The original LoD2
13.2 m roof remains the main envelope; roof seam detail adds under 0.04 m.

## Free visual references actually inspected

Raw photographs and full metadata stay in the ignored
`geo_data/regierungsviertel/raw/topography_v107/`; metadata is
`photo-metadata.json`. The six files require per-file credits in both release
manifests. No photograph or derivative raster is loaded or packaged by the
viewer.

| File | Author | License | Use |
| --- | --- | --- | --- |
| [Dokumentationszentrum Topographie des Terrors.jpg](https://commons.wikimedia.org/wiki/File:Dokumentationszentrum_Topographie_des_Terrors.jpg) | Josef Streichholz | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 26 September 2022 facade and raised ground reading |
| [Exterior of the Topography of Terror building GLAM.jpg](https://commons.wikimedia.org/wiki/File:Exterior_of_the_Topography_of_Terror_building_GLAM.jpg) | Moleskine | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | 26 April 2026 screen and side entrance |
| [Topographie des Terrors Aerial view.JPG](https://commons.wikimedia.org/wiki/File:Topographie_des_Terrors_Aerial_view.JPG) | Hans G. Oberlack | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | 31 October 2011 courtyard, entrance, service strip and screen; not current roof equipment |
| [Topographie des Terrors 0206.jpg](https://commons.wikimedia.org/wiki/File:Topographie_des_Terrors_0206.jpg) | Dosseman | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 24 September 2021 close screen-wire structure |
| [BERLIN WALL (TOPOGRAPHIE DES TERRORS).jpg](https://commons.wikimedia.org/wiki/File:BERLIN_WALL_(TOPOGRAPHIE_DES_TERRORS).jpg) | Vedha242424 | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | 18 July 2024 concrete damage, surviving cap, protective rail and trench canopy |
| [Topo 1285w.jpg](https://commons.wikimedia.org/wiki/File:Topo_1285w.jpg) | Marco van Oel | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | 6 August 2019 exposed west cellar, brickwork and steel braces |

## Explicit conflicts and representation limits

The old landmark-offset 59 × 58 m dark pavilion did not match the delivered
museum footprint or its open court. It is replaced by the complete exact-plan
shell. The old 20-piece Wall treatment had two fabricated approximately 10 m
gaps, changing the overall survival pattern. The new continuous source line
has bounded small procedural holes, a weathered concrete palette and retained
crown; invented colourful graffiti strokes are removed.

Source site solids previously became four-metre-tall Minecraft buildings,
including over the public paths and courtyard. Those five precise source
footprints now have authored replacements. Voxelisation rebases source heights
on interpolated local ground, so suppression matches the quantised height
**span**, with a bounded 0.65 m terrain reconciliation tolerance, rather than
comparing to the absolute LoD2 top. Taller unrelated source columns survive.

Thin site surfaces preserve the source tops and supply walkable heights.
Underlying city terrain is unchanged. The west cellar's dark ground relief,
retaining walls and braces occupy only its mapped footprint; exact excavation
depths and cellar room subdivisions are not surveyed. The long trench canopy,
plain exhibition-board fields and lower wall relief are procedural present-day
recognition details. No protected exhibition text or imagery is transcribed.

The court water is at display Y 3.43 m, just above the actual ground-slab mesh
at Y 3.40 m. Its 42 sampled downward rays remain unobstructed by roof, site cap
or ground. The navigation height sampler interpolates independently, so its
centre height need not equal the rendering grid exactly.

## Verification and integration

`tests/topography-terror-architecture.test.ts` verifies unchanged LoD2 records,
outward normals at all eight source walls, independent OSM/official routes,
actual local terrain samples, all retained scene columns in the five source
footprints, open-court roof rays, visible photovoltaic arrays, full/mobile
Minecraft facade rays against retained coarse columns, finite texture-free
geometry and granular authored collision. Public approach samples remain free.

The two scene factories, site-surface sampler, exact column filter and physical
solid helpers are shared across presentation modes. The protected memorial
volume follows the exact OSM site polygon; no gameplay objects are introduced.
Separate actual-Three.js software projections inspect the museum, entry and
whole site. They are geometry QA, not a claim of a browser or iPhone test.

Frozen local budgets (shared cube storage counted once):

| Profile | Renderables | Instances | Rendered vertices | Geometry/instance bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn full | 11 | 9,849 | 236,432 | 750,768 |
| Drawn mobile | 11 | 6,850 | 164,456 | 522,844 |
| Minecraft full | 11 | 4,406 | 105,800 | 337,100 |
| Minecraft mobile | 11 | 4,394 | 105,512 | 336,188 |

All four profiles retain the same 941 authored physical solids; mobile reduces
screen-wire or reinforcement microdetail, not public route geometry. Fourteen
focused tests passed with 2,682 assertions, including the actual ground-slab
ray regression and source-column suppression audit.
