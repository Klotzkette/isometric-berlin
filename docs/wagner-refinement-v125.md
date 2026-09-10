# Richard-Wagner-Denkmal refinement — step 10, v1.0.25

The dedicated monument already existed at the correct point; the main visual
error was its canopy. The previous model had a shallow barrel beginning 6.75 m
above the base, where the actual protective shell curves down beside the
sculpture to approximately pedestal height. The replacement is a deep barrel
vault with transparent glazing, nine curved ribs, eleven longitudinal bars and
eight slim side posts. Both ends and the ground-level side approaches stay open.

## Evidence and source separation

- Exact OSM node `243487615`, WGS84 `13.3618687, 52.5100656`, remains the plan
  anchor. The viewer anchor remains `[-672.0697082573897, 5.2,
  967.217096994631]`. Landesdenkmalamt part `09046318,T,041` binds identity.
- [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/wagnerdenkmal-5372/)
  records Gustav Eberlein's marble monument, a seated Wagner with cloak,
  sphinx armrests, a fist on music sheets, the romanising pedestal and the
  surrounding opera figures. Its published dimensions remain six metres for
  the ensemble and 2.70 m for Wagner.
- [Berlin's official information plaque, December 2016](https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-2518_wagner.pdf)
  independently confirms the 2.70 m Pentelic-marble figure and the shelter's
  conservation purpose, giving 1988 for the roof. BiB gives the construction interval
  `1987–1988`; the profile retains that interval and the plaque supplies the
  completion year. A single unqualified 1987 date would be misleading.
- The plaque calls Tannhäuser left and Brünnhilde/Siegfried right, whereas BiB
  reverses these directions. The inspected front-oblique photographs show
  Brünnhilde/Siegfried on the viewer's left of Wolfram. The current local
  arrangement follows that photographed viewpoint; these relative labels are
  not used as surveyed compass bearings.
- Two freely licensed photographs were inspected for silhouette and detail:
  [Flocci Nivis, *20220812 Richard-Wagner-Denkmal Berlin.jpg*](https://commons.wikimedia.org/wiki/File%3A20220812_Richard-Wagner-Denkmal_Berlin.jpg)
  ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)), and
  [Gunnar Klack, *2019-05-05-Richard-Wagner-Denkmal-1.jpg*](https://commons.wikimedia.org/wiki/File%3A2019-05-05-Richard-Wagner-Denkmal-1.jpg)
  ([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)). Neither
  image, crop nor texture is bundled or requested at runtime.

The 9.6 × 10.4 m canopy footprint, 3.1 m spring, 8.55 m ridge, member spacing,
local body proportions, pose and arcade subdivisions are procedural display
reconstructions, not measured architecture. The existing source LoD2 envelope
`DEBE00YYSR00009n` remains attributed footprint evidence and stays excluded as
an occupied solid. Its exact six false Minecraft source columns stay excluded.
No adjacent source buildings, roads, trees or park paths are removed.

## Representation

Wagner now has a connected fluted mantle across torso, lap and lower legs, a
turned forehead/nose/chin profile, ears and hair, hands on sphinx armrests and
stacked score sheets. The pedestal gains paired columns and round arcade
frames. Wolfram's raised arm and harp remain recognisable at the front; the
marble opera groups remain around the sides and rear. Rheingold is represented
as carved marble rather than an unsupported gold-coloured addition. Restrained
vertex tones make marble relief readable in the unlit Day material without a
photographic texture or extra renderable.

Day, Night and Schwellenraum share the drawn root. Snowstorm switches reversible
snow caps. Minecraft substitutes one block-native root, retaining the same
514-block budget; its connected stair-stepped barrel has alternating steel and
glass courses and eight low posts. The smooth root stays hidden in Minecraft,
so there is no duplicate sculpture or curved roof.

The new frozen smooth budget is six renderables and 26,304 stored vertices
(previously 12,167; the existing ceiling is 35,000). Minecraft remains one
InstancedMesh, 514 blocks, over one 24-vertex cube. Existing collision keeps
only the represented core, sculptural masses and new post positions solid;
front, rear, side and elevated open corridors remain traversable.

## Validation

Dedicated monument and pedestrian checks pass: 16 tests, including exact
anchor and source-column replacement, deep barrel dimensions, eight post
solids, both open gables, texture-free bounded marble shades, snow reversibility,
full capsule sweeps and foreign-prism rejection. Geometry was rendered in a
real Chrome WebGL context for front/isometric Day, Night, Snowstorm and
Minecraft inspection. Temporary reference photographs and QA captures remain
outside the release.

The selected landmark camera now uses the same low frontal aisle in every
mode: azimuth −6°, polar 82°, an explicit 39° lens, 31 m physical distance
and a 4 m target height. Specifying the lens is essential: without it the
ordinary 39°-to-16° dolly moves this camera back to about 78 m, behind full
scene tree crowns and into a neighbouring embassy building. The old steep
eastern view also looked through the roof lattice and cropped the canopy on
narrow screens. Actual desktop/touch viewer inspection checks the replacement
against the retained tree crowns; no source tree or building is removed to
obtain the view.

The two focused Minecraft integration checks also pass after the camera
change: exact six-column replacement in full/mobile and all 514 blocks'
centre/corner visibility samples against the retained voxel tree trunks and
crowns. TypeScript compilation passes.

The verified final physical camera is
`[-675.27855544, 13.51436613, 997.74723857]`, looking at
`[-672.06970826, 9.2, 967.21709699]`. Chrome desktop Day, touch Day and touch
Minecraft show the complete canopy and marble ensemble without an intervening
source building or crown. A shorter 28.5 m variant clipped the outer post on
a narrow portrait screen; 31 m provides the needed side margin.
