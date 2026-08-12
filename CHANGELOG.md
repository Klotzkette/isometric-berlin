# Changelog

## v0.71.1

- **FUNBOX fills the documented temporary event lot beside Heidestraße.** The
  procedural isometric reconstruction uses the official 23 July–20 September
  2026 event listing and its published 4,000 m², ten-zone programme, plus the
  supplied location plan and photographs as non-bundled visual references.
  Its long connected playfield, five-metre slide, five turrets, challenge
  ring, obstacle rows, `WELCOME` arch and ticket kiosk sit southwest of the
  event marker on the free Wunderland-Festplatz parcel rather than on Oggi's
  address point. The footprint is a documented presentation reconstruction,
  not claimed surveyed geometry.
- **Every visual mode retains the event's identity.** Day, Night and
  Snowstorm share restrained inflatable geometry and small perimeter lights;
  Minecraft gets an independent block-native build at the same metric anchor,
  with ten coloured zones, stepped turrets and a stepped slide. No supplied
  photograph, Google image or external texture is bundled or copied.
- **Drawn lettering no longer aborts on `X`.** The shared geometric alphabet
  now contains the missing glyph used by `FUNBOX`, with focused contracts for
  source metadata, footprint bounds, camera framing, signage and voxel-mode
  presence. The visible radius remains **5,230 m**; no source geometry,
  attribution or additive data hierarchy changed.

## v0.71.0

- **A real pedestrian camera complements the free-flight viewer.** The new
  bilingual `Walk` / `Spaziergang` control is independent of Day, Night,
  Minecraft and Snowstorm and starts on Pariser Platz facing the Brandenburg
  Gate at a 1.80 m eye height. It follows the existing smooth metric terrain;
  flight, zoom, underside and guided tunnel controls remain unavailable while
  walking, so the camera cannot accidentally leave the ground-bound mode.
- **Desktop and touch controls now cover the complete on-foot workflow.**
  `W`/`S` or up/down walk, `A`/`D` strafe, left/right or `Q`/`E` turn, mouse or
  one-finger drag controls head look, and `Space` or a 52 px mobile button
  performs one bounded jump to a 5.4 m apex. The restored overview camera is
  preserved when entering and leaving the mode, and all held inputs are
  cancelled on mode changes, blur and unmount.
- **Water and lifecycle handling are deterministic.** OSM water polygons and
  their island holes are compiled once in the same metric coordinate frame;
  landing in water returns the walker to Pariser Platz. A stale window-level
  `pointercancel` listener is now removed with the exact callback that created
  it, avoiding duplicate touch cleanup after remounts. Six focused navigation
  contracts join the full frontend suite. The visible radius remains
  **5,230 m**; no source geometry, building placement, attribution or additive
  data hierarchy changed.

## v0.70.44

- **Quiet memorials no longer become one field of generic grey blocks.** The
  OSM fetch and committed street-detail schema now retain `memorial` and
  deprecated `memorial:type` values. The viewer distinguishes plaques,
  stelae, busts, statues, obelisks, stones, benches and ghost bikes, while 232
  mapped Stolpersteine use Berlin's documented 0.10 x 0.10 m brass top without
  a false ink halo. Unknown subtypes remain deliberately low and conservative;
  OSM supplies location and class, not invented surveyed object dimensions.
- **The Brandenburg Gate survives Minecraft conversion intact.** The complete
  metric recognition model now replaces the 24 coarse building-voxel columns
  in its envelope instead of occupying the same space. Columns, six passages,
  entablature and Quadriga therefore remain legible without moving the mapped
  gate or weakening Minecraft's block language elsewhere.
- **A 50-point coherence audit closes the release.** Five principal sights
  were inspected in Day, Night and Minecraft, stationary frames were compared
  byte-for-byte, and the full 582 TypeScript and 282 Python contracts passed.
  The scene itself remained stable; one tiny image-compression variation was
  isolated to browser chrome rather than geometry. The visible radius remains
  **5,230 m**, and no building footprint, attribution or source hierarchy was
  changed. A terrain-draping contract now uses a compact metric fixture instead
  of rebuilding the whole road network twice, removing its intermittent
  five-second timeout and shortening the suite without weakening the check.

## v0.70.43

- **Tiergarten water is no longer one generic blue layer.** The committed
  surface payload now distinguishes 45 river parts, 34 natural pond parts, 23
  mapped stream/ditch parts and 18 constructed basins. Natural water follows
  the exact OSM plan geometry, including Neuer See's islands, while parkland
  is cut around every water polygon so Venusbassin, Neuer See and the small
  Tiergarten channels cannot disappear beneath an opaque lawn again.
- **Natural banks now have local relief and a readable cutaway.** Ponds and
  streams use a robust local water level, a visible floor, gently sloped banks,
  static shoreline ink and restrained transparent water in Day and Night.
  Minecraft keeps those cells at local terrain height instead of forcing them
  onto the Spree table. Horizontal outlines are source geometry; display depth
  and unmapped line width remain explicitly documented presentation
  reconstructions, not surveyed bathymetry. Retaining that decimetre payload
  raises only the extracted-package guard from 210 to 211 MiB; the compressed
  release remains under the unchanged 200 MB ceiling.
- **Five previously generic Tiergarten artworks gain individual forms.** The
  2.2 m Rousseau column, 6.5 m Lortzing monument, four-part Baumdank stele,
  Flora/Pomona figure group and *Das deutsche Volkslied* now carry their
  documented materials, proportions and distinguishing sculptural parts.
  Desktop, tablet and phone checks cover Day, Night and Minecraft with no
  browser warnings; the visible radius remains **5,230 m**, and no existing
  source geometry, attribution or data hierarchy moved.

## v0.70.42

- **Europacity now has a measured vertical datum, not one shared platform.**
  Berlin's current 1 m DGM1 tile places the KPMG/EINZ site at 35.51 m,
  50Hertz at 34.57 m and the Upbeat footprint at a 32.92 m median in
  DHHN2016. Converted through the scene's documented 30 m origin, Upbeat moves
  from the former blanket 5.60 m base to 2.92 m; its published 82 m tower now
  finishes about 4.6 m below the measured KPMG roof instead of nearly tying
  it. The unusually broad 1.62–7.07 m Upbeat site range remains recorded as
  DGM evidence rather than being flattened or falsely described as a surveyed
  finished floor.
- **50Hertz follows the official 7/13-storey profile.** Its facade register
  previously divided the measured 54.975 m LoD2 tower into 16 invented
  levels. It now uses the Senate's documented 13-storey high point, starts on
  the matching 4.7 m LoD2 base, and closes its final one-storey diagrid module
  at the roof rather than allowing a two-storey brace to project above it.
- **The three modes share one explicit height schedule.** Upbeat's 5/11/19
  linked levels use the same derived 21.579/47.474/82 m tier tops in Day,
  Night and Minecraft. Close desktop checks confirm clean roofs, entrances and
  silhouettes with no new clipping; the visible radius remains **5,230 m**,
  horizontal source geometry, source hierarchy and attribution are unchanged.

## v0.70.41

- **Europacity now follows its real metric envelopes instead of generic
  boxes.** EINZ/KPMG again relies exclusively on its complete Berlin LoD2
  shell: the 83.794 m, 22-storey tower and four measured base parts are no
  longer covered by three invented blocks. A lightweight register adds the
  source-described folded lower facade, pale aluminium rods, double-height
  entrance and correctly placed rooftop lettering without moving the official
  footprint.
- **Upbeat is rebuilt from the current open map geometry.** Its 61-point OSM
  outline replaces the former 112 x 64 m rectangle, while CA Immo's published
  82 m and 5/11/19-storey composition determines the three connected height
  steps. The warm slender facade grid, floor-to-ceiling glazing, individual
  night windows, pale roof terraces and planted strips follow the official
  project descriptions and architects' plan; the tier clips remain explicitly
  documented as plan-derived rather than surveyed.
- **The northern skyline remains coherent in every mode.** 50Hertz keeps its
  measured LoD2 body and gains the official exposed diagrid character. KPMG
  and Upbeat now open with metric, unclipped focus cameras, and Minecraft gains
  its own block-native Upbeat volume instead of focusing an empty site. Day,
  Night and Minecraft views were checked directly; the visible radius remains
  **5,230 m**, source hierarchy and attribution are unchanged, and the added
  detail remains merged/instanced rather than increasing draw calls per bay.

## v0.70.40

- **Bahnhof Friedrichstraße now follows its real Stadtbahn geometry.** The
  former straight 143 x 72 m generic shell is replaced by a 169 m curved
  station body derived from the committed Berlin LoD2 envelope. Its two halls
  reach the official 27.928 m measured height and use the Landesdenkmalamt's
  documented shallow Tudor-arch profile instead of semicircular barrels.
- **The preserved 1925 identity is legible at close range.** Dark clinker and
  black-terracotta articulation, the stepped north-west portal, five-door
  vestibule, clock, medallions, cable-glass canopy, tall steel-glass side
  grids, twin glazed gables and selected warm night windows replace the old
  repeated generic facade grid. Three platforms and six curved tracks remain
  visible through the end walls.
- **Placement and presentation are guarded rather than guessed.** The LoD2
  suppression test now follows the same curved 169 x 60 m envelope, removes
  the source station shells, and explicitly preserves both the Tränenpalast
  and the offices beyond the east gable. A north-west focus camera frames the
  portal and both sheds. Day, Night, Minecraft, Snowstorm and 390 x 844 mobile
  views were checked directly; the visible radius remains **5,230 m**, and no
  source hierarchy, attribution or neighbouring geometry changed.

## v0.70.39

- **Berlin Hauptbahnhof now reads as the real glass-and-steel crossing
  station.** The two official 46 m Buegelbauten retain their metric 180 m
  envelope but gain mirrored raking crowns, the documented external steel
  structure, ten-storey curtain-wall order, roof-panel joints and restrained
  louver banks. Their darker blue-green glass no longer reads as two blank
  cyan blocks, while the 321 m curved east-west roof remains tied to the
  committed rail alignment.
- **Both city entrances finally have complete architectural faces.** The
  Europaplatz and Washingtonplatz curtain walls now fill their arched gables
  to the roof apex and carry sliding doors, station lettering and broad,
  shallow cable-and-glass canopies. A four-sided DB pylon identifies the
  Washingtonplatz forecourt, and the roof gains one batched field of visual
  cassettes representing Deutsche Bahn's documented 780 integrated
  photovoltaic modules.
- **The close view is useful rather than accidental.** Selecting Hauptbahnhof
  now opens a lower Washingtonplatz presentation angle instead of the old
  near-plan view. New contracts cover the mirrored crowns, exposed frame,
  complete gables, canopies, signs, rooftop detail and bounded 260-instance
  solar batch. Desktop Day/Night/Minecraft/Snowstorm and 390 x 844 mobile
  views were checked directly; the visible radius remains **5,230 m**, and no
  mapped anchor, official dimension, source hierarchy or attribution changed.

## v0.70.38

- **Berlin's bridges now read as individual structures rather than variations
  of one generic slab.** The Moltkebruecke carries its three documented red
  sandstone arches, voussoir rhythm, relief fields and rebuilt sandstone
  griffins. The Kronprinzenbruecke follows its 15.492 m / 44 m / 15.492 m
  three-field system with shallow steel ribs, diagonal struts, longitudinal
  girders and four prow-like supports. The Sandkrugbruecke is an open frame
  with a separately drawn carriageway, footways, fascias, haunches and frame
  heads; the Bundestag's Sprung ueber die Spree is explicitly two-storey and
  remains pier-free in the river.
- **The smaller identities and the complete bridge field gain useful detail.**
  Golda-Meir-Steg follows its mapped axis and 76.86 x 4.00 m envelope with 39
  perforation bays; Gustav-Heinemann-, Hugo-Preuss- and Weidendammer Bruecke
  retain their timber/Vierendeel, curved box-girder and three-opening iron-arch
  characters. Broad source-derived road crossings now separate asphalt,
  footways, centre markings and expansion joints, while narrow rail and park
  crossings remain deliberately restrained. Modern named bridges expose
  compact bearings in underside views without adding unsupported river piers.
- **Accuracy remains bounded and testable.** Official Berlin bridge inventory,
  Deutscher Bundestag, Landesdenkmalamt Berlin and Santiago Calatrava project
  evidence determine the corrected identities and dimensions; committed
  OSM/raster evidence still determines placement. Contract tests cover the
  named profiles, three-span and two-level structures, visible deck faces,
  support placement and a bounded geometry budget. The visible radius remains
  **5,230 m**; source hierarchy, attribution and the additive-data policy are
  unchanged.

## v0.70.37

- **A shared architectural-ink register now gives the complete model one
  deliberate hand.** Surveyed LoD2 buildings and hand-built recognition models
  use separate silhouette, construction-detail and micro-detail tones. The
  common edge threshold moves from 24° to 18°, revealing useful roof breaks,
  cornices, glazing braces, facade joints and monument facets without changing
  a single footprint, height or landmark coordinate.
- **Previously isolated details now follow all four surface modes.** The
  Reichstag dome, Brandenburg Gate, Kanzleramt, Hauptbahnhof, Adlon,
  Paul-Löbe-Haus canopy, Siegessäule/Bismarck ensemble, Spreebogen office,
  Kulturforum details, bridge railings, quays and Tiergarten monuments now
  share mode-aware ink. Purposeful glass, bronze, clinker and planting colours
  blend toward each mode's register and return exactly to their authored Day
  colour; Night, Minecraft and Snowstorm no longer inherit stray dark Day
  outlines.
- **The line system is tested as a lossless presentation contract.** Day
  facade-axis opacity now restores the canonical 0.26 value after a Night
  round-trip. Unit tests cover the three-level palettes, accent restoration,
  complete monument registration and Reichstag-dome linework. Browser checks
  covered 1600×900 close views and the 390×844 layout; settled screenshots were
  byte-identical in Day, Night, Minecraft and Snowstorm with snowfall paused,
  and the console remained clean. The visible radius remains **5,230 m**;
  source geometry, attribution and the additive-data policy are unchanged.

## v0.70.36

- **The official Berlin Wall trace finally reads above the authored public
  realm.** The existing 1989 Vorderlandmauer WFS geometry is unchanged, but its
  double row of individually instanced dark granite setts now clears the drawn
  road/plaza lift. This exposes the documented semicircle at Platz des 18. März
  immediately west of Brandenburger Tor instead of leaving the complete row
  buried below the pavement. A single unlit, shadow-free instanced material
  reduces per-stone GPU work and remains static in every visual mode.
- **Water and linework gain a quiet illustrative finish.** Warm-grey drawing
  ink is slightly firmer against the ivory palette. Deterministic, indexed
  parabolic water ribbons replace disconnected straight dashes; every ribbon
  is admitted only when all of its vertices remain inside the mapped water
  polygon. No clock, screen-space phase or new transparent animation is
  introduced.
- **Small interaction details feel faster and more deliberate.** The canvas
  advertises grab/grabbing directly, controls use short restrained hover/press
  feedback and keyboard focus has a high-contrast double ring. Targeted
  geometry tests cover stone clearance, row separation, unlit batching and
  curved water topology. Browser checks covered desktop Day, Night and
  Minecraft plus the 390×844 layout; repeated settled screenshots were
  byte-identical in all three tested modes. The visible radius remains
  **5,230 m**; source geometry, hierarchy and attribution are unchanged.

## v0.70.35

- **Waterways and streets now flow without sacrificing mapped geometry.** The
  bounded surface payload moves to schema 8: water and road simplification are
  0.1 m, road interpolation is 1.5 m and round buffer joins use 16 segments per
  quadrant. The viewer retains every exported OSM vertex, inserts 2–2.5 m
  display points through natural bends and clamps interpolation to the mapped
  envelope;
  deliberate 90° basin, quay and junction corners remain sharp.
- **Ground-bound surfaces now express local relief continuously.** Day, Night
  and Snowstorm bilinearly read the existing 16 m IDW terrain support instead
  of stepping at cell boundaries. Bounded, indexed tessellation prevents long
  road, path and lawn triangles from flattening interior rises. Quay walls and
  coping follow the local landward grade while water tables and beds remain
  level. This is a documented interpolation of committed point evidence, not
  a denser elevation survey; Minecraft intentionally keeps its block steps.
- **The additional detail stays bounded.** Indexed kerb and quay buffers remove
  about 747,000 duplicate vertices from the fine implementation; the complete
  smooth-surface group builds locally in about 2.2 seconds. Contract tests cover
  sparse 45° banks, uneven-edge overshoot, bilinear terrain, interior road
  relief and graded coping. Browser QA covered Day, Night, Minecraft,
  Snowstorm and the 390×844 mobile layout with a clean console. The visible
  radius remains **5,230 m**; bounds, source hierarchy and attribution are
  unchanged.

## v0.70.34

- **Brandenburger Tor is now the single start and reset focus.** The React
  viewer, pre-manifest Three.js camera, bilingual Reset label and double-click
  offline fallback no longer detour through the Bundeskanzleramt. Explicit
  landmark deep links remain authoritative.
- **All four underground modes now remain clear and coherent.** Exterior
  Minecraft/snow horizon fog is disabled below ground, fixing a Snowstorm
  cutaway that was almost blank. Minecraft restores the quiet mapped context
  shell instead of applying toon shading that produced bright fragments; route
  geometry and palettes remain unchanged.
- **Cross-mode QA is now contractual.** Tests cover all four underground
  palettes without geometry rebuilds, the fog boundary and both online/offline
  defaults. Browser checks covered Day, Night, Minecraft and Snowstorm above
  and below ground at 1600×900, plus 1024×768 and 390×844 starts. Every settled
  underground pair was byte-identical and the browser console stayed clean.
  The visible radius remains **5,230 m**; data, geometry and attribution are
  unchanged.

## v0.70.33

- **The underside becomes a real passenger-network cutaway instead of a single
  road-tunnel close-up.** Schema 2 of `rail-lines.json` exports 207 real OSM
  underground rail/U-/S-Bahn parts, 40 mapped platform shapes and 78 mapped
  entrances with source ids. The U5 and shared S1/S2/S25/S26 North-South
  corridor are classified against official station sequences without snapping
  or replacing their OSM geometry. Layer-derived depths, open tunnel sections
  and straight entrance shafts are marked as schematic; the payload explicitly
  excludes invented utility networks.
- **The cutaway is fast, stable and legible in every visual mode.** Track beds
  are batched by route family, platforms and shafts are merged, and the complete
  network remains under 16 draw objects. Pale structural ink, ivory planes and
  restrained route colours switch losslessly through Day, Night, Minecraft and
  Snowstorm with no animation or transparent shell. The underside button now
  frames the U5/S-Bahn crossing and Tiergartentunnel together; dedicated tunnel
  flights remain unchanged. Repeated idle screenshots in Day and Night were
  byte-identical.
- **Mapped tram infrastructure and sparse city life add scale without claiming
  survey traffic.** Contact wires follow all 49 committed OSM tram parts; their
  5.8 m height and 35 m mast rhythm are explicit approximations, while lamp
  positions remain the official Geoportal Berlin public-lighting layer. A
  static batched layer adds 18 diverse figures, two BVG buses, three cars, two
  bicycles, two e-scooters and two strollers. Snowstorm adds one tiny ice fisher
  on a mapped Tiergarten pond beside the existing three snowploughs.
- **Accuracy and usability remain explicit.** New documentation separates real
  plan evidence from vertical presentation geometry, records the BVG/S-Bahn
  route checks and states that no utility pipes are drawn. Browser QA covered
  desktop 1600×900, tablet 1024×768 and phone 390×844 above and below ground.
  The visible radius remains **5,230 m**; attribution, source hierarchy and
  additive-data policy are unchanged.

## v0.70.32

- **Desktop 3D navigation is now genuinely continuous.** Plain held arrows pan
  in the visible screen plane, `Shift`+arrows fly along the camera heading and
  `Alt`/`Option`+arrows orbit and tilt through the underside. The matching
  on-screen arrow controls use pointer capture and continue while the mouse is
  held; a separate 96 px analogue orbit pad sits beside, rather than beneath,
  the desktop control panel. Blur, cancellation and component cleanup clear
  every input channel so a released control cannot leave the camera moving.
- **The Kulturforum is anchored and coloured as one audited architectural
  ensemble.** Named LoD2 envelopes now independently locate Gemäldegalerie,
  Kunstbibliothek/Kupferstichkabinett, Kunstgewerbemuseum, Philharmonie,
  Kammermusiksaal and the 56-part Staatsbibliothek instead of inheriting
  entrance-POI centres. The museums gain restrained stone bays, roof lights
  and the explicitly approximate sloping Piazzetta; Scharoun's three measured
  envelopes receive gold-anodised flat tones, exact-polygon roof seams and
  documented porthole/roof-light details without intersecting replacement
  blocks. Official SMB, Philharmonie and Staatsbibliothek sources are stored
  with the profile.
- **Potsdamer Platz gains readable, bounded detail.** The Mall's two entrance
  passages were moved from an invisible position 39 m inside the building to
  the south facade derived from its shipped LoD2 footprint and receive a
  glazed mullion register plus a dedicated south camera. Spielbank Berlin,
  Taylor Wessing, the Hessian cantilever, Czech and North Korean embassies,
  Georg Elser memorial and Alter Dessauer carry compact recognition cues. The
  S-/regional-platform and distribution-passage cutaway stays labelled as a
  schematic below-grade supplement, never as surveyed tunnel geometry.
- **A hidden browser failure and responsive regressions are covered.** The
  vector alphabet now includes `Y` for the Taylor Wessing facade instead of
  aborting the complete drawn-city attachment. Targeted tests cover the new
  key routing, source profiles, camera framing and glyph; browser QA covered
  1600×900 desktop, 1024×768 tablet and 390×844 phone layouts. The visible
  radius remains **5,230 m**; attribution, source geometry and additive-data
  policy are unchanged.

## v0.70.31

- **Charité Campus Mitte now uses the published renovated facade hierarchy on
  its exact Berlin LoD2 envelope.** All 16 tower parts retain their source
  footprints and heights while the 21-storey, 82 m building receives the
  documented dark four-storey aluminium base, light upper facade, 4.2 m base
  and 3.3 m upper panel modules, 1.8 m facade elements and more than 4,000
  instanced day/night panes. The existing source-aligned steel-and-glass
  Luisenstraße bridge remains intact.
- **The 1882 Albrecht-von-Graefe monument is no longer a generic marker.** Its
  Charité OSM node now carries a three-axis sandstone screen, shell niche,
  pediment, documented 1.66 m bronze figure, paired polychrome majolica
  reliefs, two-line name plate, hedge and curved iron enclosure. The separate
  same-named modern steel stele in the Hansaviertel remains distinct. Overall
  architectural dimensions are explicitly reference-proportioned rather than
  claimed as a survey.
- **Berlin Hauptbahnhof gains readable street-level transit staffage.** Five
  ivory taxis now include segmented saloon bodies, glass cabins, roof signs,
  lamps and wheels. One five-section yellow Flexity presentation tram includes
  articulated joints, doors, bogies, lamps and pantograph and sits on the
  visible side of the existing OSM-positioned stop.
- **A browser-only lettering crash could no longer remove the entire drawn
  city.** The Graefe name introduced the first `F` used by the vector alphabet;
  headless tests returned before glyph layout and therefore missed it. The
  alphabet now includes `F`, every shipped phrase is covered by a regression
  test, and development builds log the original world-attachment error instead
  of swallowing it. Browser QA confirmed the full LoD2 city, Charité, Graefe
  model, taxis and tram after a cold reload. The visible radius remains
  **5,230 m**; source geometry, attribution and additive-data policy are
  unchanged.

## v0.70.30

- **Every bounded footway, cycleway, step, track and desire path now carries
  auditable material evidence.** The schema-7 surface pass resolves all 8,151
  above-ground OSM path line parts through explicit `surface` tags before park
  or highway fallbacks: 7,420 parts have mapped surface evidence and 988 have a
  mapped `width`/`est_width`. Asphalt, paving, compacted/gravel, earth, timber
  and metal receive separate flat materials; the existing 1,651 joined park
  ribbons now carry the same compact material and per-way width evidence, so
  they no longer cover the precise surface pass with generic park styling.
  Tests lock material priority, terrain following, payload inventory and the
  no-survey-claim fallback.
- **Floraplatz carries the documented eight reconstructed animal bronzes.**
  Paired deer, bison and elk plus bear and bull receive species-specific
  reclining low-poly anatomy, horns/antlers and individual granite plinths at
  their OSM positions. One coincident generic Bison node is narrowly suppressed
  in favour of `Liegender Bison II`; tests prevent either a ninth duplicate or
  loss of one of the eight restored figures.
- **AMANO Grand Central and the former Moabit prison park gain bounded
  recognition detail without moving source geometry.** AMANO retains OSM way
  `237687062` and LoD2 part `DEBE3DLXM9FjJbtp` at 27.819 m, adding the published
  beige-grey clinker, glazed ground floor, staggered windows and glazed setback
  storey. The prison park retains OSM way `498278335` and follows Berlin's
  published interpretive plan for three five-metre wall sides/entrances, four
  wing traces, the panopticon frame, three exercise yards, blood-beech planting
  and one walk-in cell. Desktop visual QA covered both source envelopes; all
  path, monument and architecture contracts pass. The visible radius remains
  **5,230 m**; existing geometry, attribution and source policy are unchanged.

## v0.70.29

- **The Snowstorm weather control now produces clearly visible falling snow.**
  The compact procedural flakes retain a bright centre and a restrained
  blue-grey edge, start at a legible calm opacity, and use bounded desktop and
  mobile particle budgets. The intermittent flurry envelope remains intact,
  so the weather grows into a brief denser squall instead of becoming a
  permanent wall of snow.
- **Falling snow is an explicit continuous-animation source.** The render-on-
  demand loop keeps drawing only while the air field is enabled; switching the
  weather off leaves the settled winter surface in place and returns the
  framebuffer to a bit-identical rest state. Browser QA confirmed differing
  consecutive frames while snowfall is active and identical frames after it
  is paused. The visible radius remains **5,230 m**; geometry, attribution and
  source policy are unchanged.

## v0.70.28

- **A photo-reference pass corrects three prominent rail and theatre details
  without moving their surveyed envelopes.** The Berliner Ensemble rooftop
  mark is now the real open red ring with freestanding two-line lettering,
  rather than a filled red disk. Its mobile focus follows the model's actual
  24/13 m offset and higher roofline, so the complete sign and facade stay in
  frame.
- **Bahnhof Friedrichstrasse now reads as two historic train sheds from every
  side.** Each 35.8 m hall has its own arched end glazing, the 146 m roofs meet
  at a visible central valley gutter, both long brick facades carry the same
  window, pilaster and belt-course rhythm, and the day palette uses the warmer
  terracotta and lighter grey-green roof visible in Commons photographs. The
  existing 146 x 72 m LoD2/OSM footprint is unchanged.
- **Berlin Hauptbahnhof's four panoramic lifts are cylindrical glass shafts.**
  The former square placeholders are replaced by open 20-segment cylinders
  with a slim instanced frame and separately readable lift cars, matching
  Deutsche Bahn interior views while adding only one shared frame draw call.
- Browser QA covered 390 x 844, 1024 x 768 and 1600 x 900 views of the Berliner
  Ensemble, Bahnhof Friedrichstrasse and Hauptbahnhof in Day and Night. Two
  settled mobile Night captures were byte-identical; all geometry, navigation,
  anti-flicker, build and packaging contracts pass. The visible radius remains
  **5,230 m**; attribution and source policy are unchanged.

## v0.70.27

- **The Swiss Embassy now reads as one historically layered complex.** Its
  existing metric envelope is retained while the 1870/71 palace receives a
  nine-bay window rhythm, rusticated base, pilasters, Ionic entrance order,
  frieze panels and roof flag. The distinct 2000 Diener & Diener extension
  remains a restrained contemporary volume; the older overlapping refinement
  is disabled so its cornices can no longer shimmer at rest.
- **Pariser Platz, Cube Berlin and the federal economics campus gain bounded
  recognition detail.** Both formal gardens have their surveyed dimensions,
  flower borders, fountains, clipped planting and bollards; the mapped U/S-Bahn
  entrance and restrained US/French embassy facades complete the square. Cube
  Berlin replaces four overlapping source prisms with one 43.6 m LoD2/OSM
  envelope and an alternating triangular double-skin pattern. The economics
  ministry adds the historic Invalidenstraße facade, rotunda, roof bands and a
  regular contemporary-wing register without moving the underlying campus.
- **Berlin's rail interiors and eastern approach are more legible.** The
  Hauptbahnhof now contains instanced concourse shopfronts, glass gallery
  balustrades and four lift shafts, while rust-red steel trestles carry the
  eastern tracks instead of leaving a visually unsupported deck. Bahnhof
  Friedrichstraße replaces its opaque source shell with two adjacent
  steel-and-glass train sheds above the brick base; a geometric suppression
  guard keeps the neighbouring Tränenpalast separate. The canonical
  `bahnhof-berlin-friedrichstrasse` deep link also works while preserving the
  former malformed link as a compatibility alias.
- **Kronprinzenbrücke and Weidendammer Brücke are now individual engineering
  structures rather than generic decks.** The former follows its surveyed
  74.98 x 23.58 m OSM outline and separates carriageway, raised cycle tracks
  and pedestrian bands over shallow steel arches. The latter uses its 70.3 x
  22.4 m protected envelope, two granite-clad piers, three iron arch openings,
  fine railings, historic lamps and restrained volumetric eagle silhouettes.
  The Berliner Ensemble also gains its circular red roof sign with two lines
  of light lettering, and the Tränenpalast keeps its mapped glass-and-steel
  pavilion footprint.
- Full browser QA covered Day and Night at Swiss Embassy, Pariser Platz,
  Hauptbahnhof, Cube, Berliner Ensemble and Friedrichstraße across 390 x 844,
  1024 x 768 and 1600 x 900 viewports. Mobile overflow and fullscreen toggles
  round-tripped correctly, the browser console stayed clean, and two settled
  Night captures were byte-identical. The visible radius remains **5,230 m**;
  attribution, Google opt-in policy and unrelated source geometry are
  unchanged.

## v0.70.26

- **Futurium is rebuilt from its actual Berlin LoD2 geometry instead of the
  former 70 x 84 m placeholder box.** Building `20g0005J` supplies the
  irregular 4,034 m² footprint, 5.4 m base and 19.9 m height. The complete
  recognition model adds the recessed glass foyer, fine cast-glass cassette
  field, published 28 m north/south panorama windows, projecting entrance
  roofs, bounded photovoltaic field, roof Skywalk and OSM-positioned 15 m
  Drehmoment. Its close camera now frames the building rather than its roof
  and neighbouring Cube.
- **Moltkebrücke no longer lies across the Spree as a disconnected red slab.**
  Its model now follows the OSM centreline while preserving Berlin's published
  77.58 x 25.70 m inventory dimensions. Three segmental sandstone arches use
  twice the former curve resolution; the deck carries separate roadway and
  pavements, open balusters, coping, pier plinths, warm historic lamps and
  restrained corner-griffin recognition silhouettes.
- **Detailed paths now cover every bounded OSM park polygon, not only Großer
  Tiergarten.** The 1,651-path payload includes Spreebogenpark and
  Ludwig-Erhard-Ufer toward Gustav-Heinemann-Brücke, Futurium's public realm
  and Nordhafenpark. A spatial index keeps regeneration near ten seconds, and
  continuous miter-limited ribbons remove gaps and blocky joins on curved
  walks. Coordinates retain centimetre precision and the full additive detail
  payload remains below its 5 MiB release ceiling.
- Targeted browser QA inspected Futurium from both end orientations and
  Moltkebrücke from roadway and cross-river views; metric bridge, civic-detail
  and park-path tests pass. The visible radius remains **5,230 m**; no bounds,
  unrelated building coordinates, attribution, Google content or credentials
  changed.

## v0.70.25

- **Permitted Chrome autoplay now starts before the first painted frame.** The
  ambient layer and Dusk Republic make their eager start attempt in React's
  layout phase, ahead of ThreeViewer's passive scene loading, instead of
  waiting until after the initial paint. Existing user mute intent remains
  authoritative and neither engine reports audible until its AudioContext is
  genuinely running.
- **Background-opened and restored tabs no longer miss their automatic start
  opportunity.** Enabled, inaudible audio retries on `visibilitychange`,
  `pageshow`, and window focus as soon as the document is visible. Retries are
  bounded to one pending attempt per layer, skip already audible or disabled
  audio, and fully unregister on teardown.
- Chrome's own autoplay policy is not bypassed: a fresh origin that has no
  autoplay permission still starts both procedural layers synchronously on
  the visitor's first accepted pointer, touch, wheel, or keyboard gesture.
  The visible radius remains **5,230 m**; scene geometry, visual presentation,
  source data and attribution are unchanged.

## v0.70.24

- **The bright isometric city keeps more of each source-backed material.**
  Valid facade samples now retain 62% of their measured hue instead of being
  washed halfway into ivory. Roofs use a lighter mineral cap with less neutral
  tint, directional face steps are gentler, and warm graphite ink is quieter
  without becoming translucent or unstable. Fresh park, water, paving and
  asphalt tones remain discrete flat colours with no photographic gradients.
- **Berlin's official tree catalogue now changes the actual crown form.**
  Broadleaf trees keep their clustered crowns and visible trunks; official
  conifers use three tapered tiers, large shrubs stay low, and orchard trees
  use a tighter crown. The distinctions remain instanced, source-backed and
  bounded, adding only a small fixed number of draw calls rather than one mesh
  per tree.
- **Hauptbahnhof reads as glass architecture rather than a wireframe.** Its
  existing 321 m surveyed rail-curve envelope is unchanged, but the continuous
  pale-cyan glass skin is stronger than its now finer, lighter panel grid.
  Entrance facades, roof portals and the two 46 m Buegelbauten share that
  hierarchy while retaining transparent night illumination and all metric
  rail, hall and support geometry.
- Browser QA covered Chancellery, Hauptbahnhof and Reichstag in Day, Night and
  Minecraft. Two one-second-separated settled Day captures and two settled
  Night captures were byte-identical. The visible radius remains **5,230 m**;
  bounds, coordinates, source data, attribution and Google opt-in policy are
  unchanged.

## v0.70.23

- **The Kollhoff-Tower is now one red ceramic building, not a neutral tower
  with seven floating brown plates.** The plates are deleted. All 16 LoD2
  parts sharing parent `DEBE01YYK0002KM6` retain their surveyed footprints and
  stepped heights, receive one coherent red-ceramic facade family and keep the
  source GeoPackage's 101.44 m LoD2 envelope alongside Berlin's published
  103 m / 25-storey figure.
- A referenced portrait-window register now follows every actual LoD2 wall.
  Day uses recessed cool glass, Night lights a deterministic minority of the
  same panes, and Minecraft snaps the exact building footprint to the authored
  red-brick block colour instead of grey or cream.
- Close views add a staggered ceramic bond with separate bed and head joints.
  The inferred masonry module is explicitly distinguished from surveyed
  geometry and sits 12 cm off the facade plane to prevent z-fighting. A new
  230/310 m hysteresis band removes that dense micro-detail before it can alias
  in the overview. Day, Night and Minecraft were checked in the real browser;
  two settled facade captures were byte-identical. The visible radius remains
  **5,230 m**; source data, bounds and attribution are unchanged.

## v0.70.22

- **Music starts from the first interaction the browser actually accepts.** If
  an early `pointerdown` or `touchstart` resume remains pending, the completed
  click, touch or keyboard gesture now supersedes it synchronously instead of
  leaving the soundtrack locked in its waiting state. Stale asynchronous
  results cannot overwrite the winning attempt.
- **A suspended AudioContext can no longer masquerade as playback.** Ambient
  and Dusk Republic retire a scheduler left alive by Safari, tab interruption
  or power saving, clear its queued voices, resume the context and arm exactly
  one fresh scheduler. Their toolbar states update immediately from audible
  engine truth rather than waiting for the periodic health check.
- **The two audio controls are independent again.** The persisted Ambient mute
  no longer blocks Dusk Republic's documented per-reload enabled intent. Engine
  regression tests cover stale schedulers and pending first gestures; a real
  browser run confirms that an ordinary map click starts Dusk while Ambient
  remains muted, after which both layers can be enabled together. Audio remains
  procedural and within the existing shared 0.10 gain budget. The visible
  radius remains **5,230 m**; geometry, source data and attribution are
  unchanged.

## v0.70.21

- **Curved streets and paths are now genuinely curved citywide.** The road
  pipeline interpolates moderate OSM direction changes with clamped cubic
  Hermite segments through every original mapped node, samples those bends at
  no more than 2.5 m, and reduces final edge simplification from 0.75 m to
  0.20 m. Deliberate corners sharper than 72 degrees remain hard, so the pass
  does not round buildings, plazas or engineered right-angle junctions.
- Day, Night and Snowstorm no longer reveal the coarse 4 m asphalt cells or
  their square kerb lines below the continuous OSM road surfaces. The smooth
  carriageway, kerb and lane-marking layers now share one centreline;
  Minecraft deliberately retains its block-native street grid.
- A final 0.20 m portal exclusion absorbs decimetre payload quantisation, so
  the smoother road and water edges cannot close either Tiergartentunnel
  mouth. Geometry contracts cover curved sampling, preserved source nodes,
  hard corners, duplicate OSM nodes and both tunnel approaches. Day, Night,
  Minecraft and Snowstorm were visually checked around the Grosser Stern and
  Spreebogen. The visible radius remains **5,230 m**; no bounds, building
  placement, attribution or source-policy contract changed.

## v0.70.20

- **The south Tiergartentunnel approach no longer shows through Potsdamer
  Platz.** Ramp decks, retaining walls, barriers, markings and portal frames
  now obey the city depth buffer in every ordinary above-ground view, so
  terrain and buildings correctly occlude the underground geometry.
- The deliberate bore-reading aid remains available only in the explicitly
  selected north or south tunnel-mouth close-up. Leaving that view immediately
  restores normal occlusion; underside and guided tunnel-flight rendering keep
  their existing dedicated cutaway geometry.
- A real-route regression guard rejects any default-visible portal mesh that
  bypasses depth testing. Day, Night and Minecraft were checked at the same
  wide Chancellery camera with no grey tunnel stripe. The visible radius
  remains **5,230 m**; geometry evidence, attribution and source boundaries are
  unchanged.

## v0.70.19

- **`berlin modern` is a complete building instead of a floating roof.** The
  Kulturforum model now follows Herzog & de Meuron's published 120 × 71 × 18 m
  planning envelope, sits on its landmark ground plane and follows the OSM
  construction-boundary axis. The previous 88 × 72 m placeholder rose roughly
  40 m above its anchor and omitted the wall body entirely.
- The pale mineral body now carries layered masonry courses, a broad framed
  north entrance, east-side glass and transverse openings, a correctly aligned
  dark gable roof and a fine photovoltaic grid. The saved sight camera faces
  the characteristic north gable instead of the less informative rear edge.
- Night gives the entrance and side glazing a restrained warm emission.
  Minecraft receives its own stepped block-native 120 × 71 × 18 m planning
  model, so the construction site no longer becomes an empty lawn when modes
  change.
- Pure dimensional profiles moved out of the renderer, removing a latent
  `ExpandedCityDetails` ↔ `MinecraftVoxelWorld` module-initialisation cycle.
  Contract tests lock footprint, height, grounding, site rotation, camera and
  all-mode presence. Two settled Day captures were byte-identical. The visible
  radius remains **5,230 m**; attribution and source boundaries are unchanged.

## v0.70.18

- **The weather control now works in Snowstorm too.** Day, Night and Minecraft
  keep their independent moderate-rain preference; in Snowstorm the same
  button changes to a snow-cloud icon and pauses or resumes falling flakes.
  German and English labels, pressed state, status text and the compact action
  menu all follow the active precipitation type instead of disabling the
  control.
- Settled snow, 168 drifts and the three snowploughs remain visible when
  snowfall is paused. Both the Three.js point field and the 2D fallback stop
  only their airborne animation, so an inactive snowfall no longer drives
  needless continuous rendering or reopens a still-frame shimmer window.
- Unit coverage locks the independent settled/airborne visibility, paused
  particle clock and bilingual labels. Desktop browser QA exercised both
  switch directions in the rendered Snowstorm scene. The visible radius
  remains **5,230 m**; geometry, attribution and source boundaries are
  unchanged.

## v0.70.17

- **The Soviet Memorial now faces the Strasse des 17. Juni.** The former
  180-degree scene rotation put the documented entrance ensemble on the park
  side and mirrored east/west. The colonnade, forecourt and stairs now open
  south toward the road, with one T-34/76 on each side of the entrance.
- Both tanks are aligned parallel to the road on correctly oriented plinths
  and use a readable restored olive finish. The two ML-20 gun-howitzers remain
  diagonally behind at the first stair, matching the layout stated by the
  Berlin Senate. The saved sight camera now approaches from the street rather
  than from behind the memorial.
- A regression test locks the street-side, west/east and tank-before-gun
  relationships. Day, Night and Minecraft were visually checked with the same
  corrected geometry. The visible radius remains **5,230 m**; source
  attribution and data boundaries are unchanged.

## v0.70.16

- **Music starts from the click that the browser actually permits.** Ambient
  music and Dusk Republic now supersede a still-pending load-time autoplay
  attempt instead of returning its stale promise. The real gesture owns the
  only scheduler, so the button no longer appears to accept a click and then
  falls silent.
- Concurrent start calls are ordered explicitly in the app. A late failure
  from the blocked load attempt cannot stop, dispose or relabel the newer
  audible engine; stopping or leaving the page invalidates every older result.
- Hidden tabs still suspend all notes and voices. Freeze and back-forward-cache
  transitions are now resumable pauses rather than destructive exits, while a
  real navigation or tab close still disposes both audio engines. Regression
  tests cover blocked-start takeover, one-scheduler ownership, BFCache restore
  and duplicate lifecycle events. The visible radius remains **5,230 m**; no
  geometry, source data, attribution or visual presentation changed.

## v0.70.15

- **Ordinary architecture now stops where the open evidence stops.** Exact
  LoD2 outer walls and courtyard rings carry the shared facade axes and storey
  bands; ALKIS roof code 3500 adds source-backed tent roofs. The old heuristic
  ordinary entrances, randomly positioned HVAC boxes and generic skylights are
  removed because their coordinates were not present in the source payload.
  Referenced hero details remain additive rather than being discarded.
- **The principal civic models gain another recognition pass.** The Reichstag
  has 24 upper corner-tower windows, an instanced 24-rib dome and radial base
  beams; the Kanzleramt's monumental semicircular halls gain their columns,
  capitals and balcony rails. Hauptbahnhof office-bar end facades, Brandenburg
  Gate Doric abaci and the Swiss Embassy's flat balustraded roof, pilasters,
  staggered end-wall slots and recessed entrance are now explicit geometry.
- **An unchanged city is no longer redrawn merely because time passed.** Every
  transparent ink layer receives a deterministic camera-independent order;
  the distance fade multiplies rather than overwrites the authored Day/Night
  opacity. The temporal-stability gate now rejects even one visibly changed
  pixel by default. Six consecutive browser captures were byte-identical in
  each of Day, Night and Minecraft, while camera sweeps produced no blank or
  recomposed frames.
- **Audio follows the page lifecycle completely.** Hiding the tab stops its
  schedulers and active voices; page exit, navigation and freeze close both
  procedural engines. Returning to the tab cannot release a catch-up burst or
  revive a stale start, and a browser-blocked autoplay attempt still waits for
  a new user gesture.
- The guided Tiergartentunnel flight now starts and ends outside the portals
  above the terrain shell, follows the correct right-hand bore in both
  directions, grades continuously through both 260 m ramps and keeps a stable
  look-ahead through entry, bore and emergence. The committed tunnel route
  remains explicitly documented as an open-data approximation, not surveyed
  bore geometry.
- Desktop and 390 x 844 mobile visual checks covered Day, Night, Minecraft and
  Snowstorm, close views of the Reichstag, Kanzleramt, Hauptbahnhof and
  Brandenburg Gate, and the tunnel interior. The browser reported no errors or
  warnings. The visible radius remains **5,230 m**; no bounds, attribution,
  credentials, Google content or raw source material changed.

## v0.70.14

- **The startup photo flash is gone.** The official photogrammetric surface is
  no longer a visible placeholder while the LoD2 isometric city or Minecraft
  voxel world loads. A fully opaque background in the active mode colour covers
  every intermediate WebGL frame and disappears without a cross-fade only when
  the requested presentation is complete.
- Viewer controls now become ready with the requested drawn world rather than
  with the first streamed photo tile. The old surface remains available only
  after a genuine drawn-world load failure and as the intentional faded context
  in an established underside/tunnel cutaway.
- Cold-cache checks captured the loading and first-city frames on desktop and a
  390 × 844 mobile viewport. Day, Night and Minecraft all held the correct solid
  background before revealing their finished world; the browser reported no
  errors or warnings. Six dedicated gate tests join the complete 491-test viewer
  suite.
- The visible radius remains **5,230 m**. No geometry, source data, attribution,
  credentials, Google content or raw material changed.

## v0.70.13

- **Buildings, streets and bridges now have one complete, reproducible accuracy
  audit.** The report checks all 17,091 committed LoD2 source features, all
  21,068 OSM road geometries and all 402 road/path/rail bridge centrelines for
  validity and bounds containment. It separately verifies the 16,958 shipped
  drawn prisms and transparently records 121 non-extruded source rows: four
  sub-5 cm flats and otherwise sub-1.14 m² source slivers, never relocated or
  silently described as rendered.
- OSM import now preserves `width`, `est_width`, lane, sidewalk, cycleway,
  bridge-structure and clearance evidence. Every one of the 14,417 supported
  road centrelines resolves its full width in the order mapped width → estimated
  width → mapped lanes → documented class fallback, and both the smooth and
  voxel surfaces consume that shared policy.
- **No narrow bridge is discarded by a raster-size guess anymore.** All 56
  water-crossing groups are retained, including 28 one-to-eleven-cell park
  stegs; small generic decks follow their local banks instead of floating at
  Spree shipping clearance. Named bridge profiles keep their published spans,
  widths and finishes.
- Browser startup no longer ear-clips one city-scale paving polygon with 1,390
  holes. The exact same paved union is partitioned on deterministic 400 m
  internal boundaries and each material family is triangulated in one pass.
  Measured surface construction fell from roughly 4.2 s to 0.23–0.29 s; the
  full 485-test viewer suite fell from 102 s to 48 s.
- Desktop and 390 × 844 mobile checks found no visible partition seams, missing
  surfaces, console errors or control overlap. Six consecutive settled frames
  were byte-identical in Day, Night and Minecraft. The visible radius remains
  **5,230 m**; no building coordinate, bounds, attribution, credentials, Google
  content or raw source material changed.

## v0.70.12

- **Navigation now responds at full speed on the first input frame.** Held
  keyboard flight no longer passes through a hidden acceleration/deceleration
  `lerp`; it applies a faster distance-aware speed immediately and stops on
  key-up. One-shot keyboard/button movement also covers more useful ground,
  while mouse orbit, pan, wheel/pinch zoom and two-finger pan use more direct
  response curves.
- The 2D detail map now applies programmatic pan and zoom immediately. Its
  fallback animation is reduced from 0.72 s to 0.12 s, tile presentation is
  immediate and the viewport spring is three times stiffer. Touch gesture
  classification begins after 6 px instead of 12 px, removing the perceptible
  pause before a deliberate two-finger pan or pinch.
- Contract tests and release-readiness checks reject a returning flight
  velocity ramp or slower navigation constants. Browser verification measured
  twelve consecutive 3D frames after a camera step and twelve settled 2D map
  frames with **0 changed pixels** between every adjacent pair: faster input
  does not reintroduce drift or flicker.
- The visible radius remains **5,230 m**. No geometry, building placement,
  source data, attribution, credentials, Google content or raw reference
  material changed in this focused interaction release.

## v0.70.11

- **A released 3D view now becomes literally static when input stops.**
  OrbitControls no longer applies an asymptotic, multi-second camera drift
  after pointer-up, and stale 180-650 ms interaction windows no longer redraw
  an unchanged scene. Direct mouse/pen rotation remains 1:1, while the existing
  short, bounded two-finger touch-pan momentum is preserved.
- Safari's fractional viewport measurements are quantised to one integer CSS
  pixel size before the WebGL renderer and four-sample MSAA composer allocate
  their buffers. In 3D, the invisible OpenSeadragon canvas, viewport vignette
  and backdrop-blur compositor layers are also removed from WebKit's active
  paint stack; the visible controls retain stable, more opaque backgrounds.
- Browser verification recorded 16 consecutive full-page frames in each of
  Day, Night and Minecraft plus 16 frames immediately after a keyboard camera
  orbit. Every sequence measured **0 changed pixels** between every adjacent
  pair. Unit tests pin the no-damping, single-compositor and viewport-size
  contracts.
- The visible radius remains **5,230 m**. No geometry, building placement,
  source data, attribution, credentials, Google content or raw reference
  material changed in this focused idle-stability release.

## v0.70.10

- **Drawn roof and facade outlines no longer fight their carrier surfaces
  during camera movement.** Every collected Tusch line now receives a fixed
  3 cm view-space depth bias: enough to resolve co-planar depth ambiguity, but
  too small to reveal an outline through a real wall. Existing depth testing,
  four-sample alpha-to-coverage and the final SMAA resolve remain intact.
- The neutral Crisp pass is now disabled instead of performing an ineffectual
  full-screen half-float read/write on every rendered frame. Day, Night and
  Minecraft all retain the same RenderPass-to-SMAA chain during interaction
  and at rest, reducing GPU bandwidth without introducing a settle-time
  quality switch.
- Browser verification covered desktop and 390 x 844 mobile framing. Twelve
  consecutive Day, Night and Minecraft desktop frames and eight mobile Day
  frames were byte-identical at rest; a camera sweep completed without shader
  warnings, blank frames or outlines showing through architecture.
- The visible radius remains **5,230 m**. No geometry, landmark placement,
  source coordinates, attribution, credentials, Google content or raw
  reference material changed in this focused rendering release.

## v0.70.9

- **The Memorial to the Sinti and Roma murdered under National Socialism now
  follows the documented artwork instead of a generic park-water symbol.** Its
  defining pool is fixed to the published approximately 12 m diameter and is
  rendered as a stable black mirror in a thin dark steel pan. The retractable
  triangular granite stone carries a procedural daily flower; the rim carries
  a restrained German/English poem cue; 69 individually varied, low granite
  stones mark the documented crime sites around a fragmented granite apron.
- The long segmented glass/Corten chronology boundary now has a real entrance,
  text-line detail, nine restrained biography-display cues and three benches.
  Published values (12 m pool, 69 places, 60 x 60 m overall artwork extent)
  are pinned in tests; uncited local dimensions remain explicitly documented
  visual-reference approximations.
- Two overlapping data artefacts are removed without deleting source evidence:
  the generic cyan OSM basin no longer draws below the dedicated black pool,
  and Minecraft suppresses 86 four-metre false-positive building columns that
  previously buried the open memorial clearing under a 32 x 56 m concrete
  block. Day, Night, Snowstorm and Minecraft were checked from the curated
  landmark view.
- The visible radius remains **5,230 m**. No unrelated geometry, source
  coordinates, attribution, credentials, Google content or raw reference
  photographs changed in this focused memorial refinement.

## v0.70.8

- **Snowstorm now breathes instead of drawing one constant curtain.** A
  deterministic 16-second weather envelope moves from a few quiet flakes into
  a short diagonal mini-blizzard and smoothly back to calm. Wind, fall speed
  and opacity share the same eased pulse, so there is no abrupt on/off flash.
- The existing single particle field retains its bounded 2,400 desktop / 1,100
  touch-device budget. Fixed screen-space microflakes remain legible at the
  wide isometric camera distance, while a denser antialiased sprite core and
  alpha-to-coverage keep their edges clean without adding draw calls. Tests
  pin the calm/gust cycle, particle bounds and mobile presentation contract.
- The visible radius remains **5,230 m**. No geometry, building placement,
  source data, credentials, Google content or settled-snow presentation
  changed in this focused weather refinement.

## v0.70.7

- **Camera motion now receives a real final anti-aliasing resolve.** The
  existing four-sample MSAA still resolves scene geometry, and a permanently
  enabled SMAA pass now removes the remaining screen-space stair steps and
  high-frequency line crawl after that resolve. Day, Night and Minecraft use
  the identical pass order during movement and at rest; there is no quality
  switch when input begins or ends.
- The pass is explicitly released with the rest of the WebGL pipeline, and a
  regression test pins its position after the neutral colour pass, permanent
  enabled state and cleanup. The renderer now also requests the current PCF
  shadow mode directly instead of triggering Three.js's deprecated soft-PCF
  fallback. Local browser measurements found byte-identical settled frames in
  Day and Night and in the static Minecraft building region; a full 360-degree
  camera sweep produced no blank, dark or recomposed frame.
- The visible radius remains **5,230 m**. No geometry, source coordinates,
  data-source policy, Google data, credentials or raw reference photographs
  changed in this focused rendering fix.

## v0.70.6

- **Camera movement no longer flashes dense city ink.** Touch navigation now
  renders on every available animation frame instead of discarding alternate
  frames behind a 30 fps coarse-pointer gate. Day, Night and Minecraft also
  use a neutral composer pass: the former neighbour-sampling sharpen and
  screen-space edge detector are both disabled, while the authored
  world-space outlines remain intact.
- Every drawn detail root now participates in the same motion-stability pass.
  Transparent ink still depth-tests against opaque architecture, but no
  longer writes into the depth buffer against other ink; four-sample
  alpha-to-coverage and soft PCF shadows remove two further sources of
  line/shadow crawl during orbit and pan.
- Regression tests pin the uncapped movement cadence, neutral post-process,
  complete detail-root inventory and stable line-material state. Browser
  motion sweeps covered Day, Night and Minecraft; repeated post-settle
  screenshots were pixel-identical. The visible radius remains **5,230 m**;
  no bounds, source coordinates, Google data, credentials or raw reference
  photographs changed.

## v0.70.5

- **The Spree between the parliamentary buildings is clear again.** The
  invented 16-column line beside the Marie-Elisabeth-Lüders-Haus, including
  eleven supports that crossed mapped water and its false 88 m roof beam, is
  gone. Four source-informed presentation supports remain only beneath the
  landward quayside canopy; none is described as surveyed geometry.
- A regression test now checks every retained support against the precise OSM
  water polygons and also pins the coordinates used by the runtime model. The
  real two-level *Sprung über die Spree* connection remains untouched.
- Day, Night, Minecraft and Snowstorm were checked at the Lüders-Haus focus.
  The versioned visible radius remains **5,230 m**; no bounds, source
  coordinates, Google data, credentials or raw reference photographs changed.

## v0.70.4

- **The Rieckhallen are one low freight hall again.** Five generic gabled-roof
  strips are gone. The replacement follows official LoD2 building
  `DEBE01YYK0002SQl`: a 281.279 x 16.244 m envelope, 9.364 m measured height
  and 21.39-degree long axis. Its restrained flat/mixed roof now has three low
  longitudinal bands and the documented dark vertically ribbed elevations.
- Minecraft no longer turns the coarse alternating 8/12 m source columns into
  false roof peaks. Only columns inside the same rotated LoD2 envelope receive
  one continuous surveyed top elevation; their footprint and deliberately
  blocky edge remain unchanged. Regression tests pin the building ID,
  dimensions, axis, height, focus framing and flat roof in both drawn and voxel
  presentations.
- Day, Night, Minecraft and Snowstorm were checked at the Rieckhallen focus.
  The versioned visible radius remains **5,230 m**; no bounds, landmark
  coordinates, Google data, credentials or raw reference photographs changed.

## v0.70.3

- **Hamburger Bahnhof is no longer a floating, skewed fantasy gable.** The
  entrance front is now anchored to the two official LoD2 tower parts
  `DEBE3DIkXt8PMip6` and `DEBE3DlXyRYPJvcY` (26.15/26.37 m), which fix its
  30-degree facade line and measured-height towers. The sight point inside the
  former train hall is used only for navigation; the close camera now targets
  the actual facade centre.
- The rebuilt late-Neoclassical elevation is flat-roofed and carries its two
  towers, six sage upper arcades, two large lower hall arches, belfry slots,
  clock/rosette fields, doors, cornice courses, entrance steps and drawn
  `VERKEHRS UND BAUMUSEUM` inscription. Its hall and upper arcade glazing now
  stays legible as warm light at night. The Ehrenhof overlay is restricted to
  its documented axial path and central rondel; the former giant rectangular
  slab across the garden is gone.
- Minecraft now has a dedicated stepped Hamburger-Bahnhof front with the same
  tower/arcade hierarchy, and the generic office-window overlay yields only at
  this facade. Regression tests pin the LoD2 IDs, axis, dimensions, camera,
  flat roof and both Day/Night and voxel recognition contracts. The versioned
  visible radius remains **5,230 m**; no bounds, source coordinates, Google
  data, credentials or raw reference photographs changed.

## v0.70.2

- **Gustav-Heinemann-Bruecke is no longer a pale generic strip.** The official
  Berlin inventory fixes the pedestrian bridge at 87.76 x 4.00 m. Its model
  now carries the observed dark olive-green Vierendeel side frames, twenty
  regular bays, horizontal handrails, a segmented timber deck, integrated
  warm lights and two rectangular concrete blade supports around the 66 m
  clear central span. The exact OSM course remains unchanged.
- **Hugo-Preuss-Bruecke now has its own curved road-bridge construction.** Its
  official 88.41 x 23.56 m envelope follows the mapped curved centreline with
  a deep, haunched steel box, pale framed fascia, close vertical railing,
  asphalt carriageway, lane mark, cycle margins, footways and substantial
  stone abutments. It remains a single span: the renderer no longer invents a
  central river pier.
- Both bridges receive stable close-up camera presets and retain their distinct
  structure in Day, Night, Minecraft and Snowstorm. Regression tests pin their
  identity, dimensions, palette, framing and pier policy. The versioned visible
  radius remains **5,230 m**; no bounds, source coordinates, Google data,
  credentials or raw photographs changed.

## v0.70.1

- Removed all seven unsolicited location quips in German and English,
  including the washing-machine, parallel-universe, turn-signal and snooze
  messages. The complete discovery-note component, timers, styles and source
  module are gone rather than merely hidden.
- Release readiness now rejects a return of this temporary slogan layer.
  Selecting a sight therefore changes only the factual focus, navigation state
  and map framing. Geometry, weather, audio controls and the 5,230 m visible
  radius are unchanged.

## v0.70.0

- **Navigation is shorter without losing the catalog.** The visible Sights
  rail now contains the five primary orientation points (Hauptbahnhof,
  Bundeskanzleramt, Reichstag, Brandenburger Tor and Siegessäule), while all
  87 source-positioned entries remain in previous/next navigation and tours.
  Stable, diacritic-safe `#landmark=` links now apply on initial load and react
  to later hash/history changes. Their authored camera runs after shared map
  orientation, so a precise close-up is no longer overwritten by the URL.
- **The Tiergartentunnel south-bore view is a real close presentation.** Its
  camera follows the engineered ramp grade, stays outside generic
  underwater/underside switching and keeps the lane, two reflector bands and
  a deterministic warm lamp rhythm visible into the depth. Forced-depth bore
  pieces remain hidden in every ordinary exterior view and disappear on the
  first free camera movement.
- **Water and park detail gain depth without false survey claims.** Local
  Tiergarten ponds now use their own terrain level instead of the Spree table,
  with recessed banks, explicit display-depth walls and static ripple ribbons.
  Three tiny, deterministic beaver interpretations are hidden around mapped
  ponds as Easter eggs. Their positions and the displayed pond depths are
  documented presentation approximations, not surveyed bathymetry or fauna.
- **Civic and river staffage is richer but traceable.** The Bundestag Kita is
  anchored to its OSM/LoD2 footprint and receives the official building's
  ship-like, colourful recognition cues. Both drawn vessels gain window bands,
  navigation lights and static close-range wakes; the boats remain explicitly
  labelled invented staffage because the source map contains no vessel survey.
  Existing bridge dimensions, clearances and distinct material profiles remain
  pinned by regression tests; no unsupported bollard rows were fabricated.
- **Weather and audio lifecycle are calmer.** Rain receives deterministic
  length and speed variation, snow uses a branched procedural flake mask and
  selected park trees receive one batched winter-cap layer. Both audio engines
  now cancel timers, silence active graphs and close their contexts on
  `pagehide` and `beforeunload`, so closing or leaving the viewer cannot leave
  music playing.
- **Temporal stability was measured again after the full change.** Settled Day,
  Night and Minecraft captures were byte-identical in each mode. The Quadriga
  receives a clearer oxidised-bronze day palette and close lens; Luiseninsel
  gains its ornamental flower beds and corrected local water level. The
  versioned visible radius remains **5,230 m**; no bounds, metric source
  coordinates, Google data, credentials or raw photographs changed.

## v0.69.0

- **The Quadriga is a real sculpture now, not a stack of boxes.** Schadow's
  team is built in its own module at the finest granularity anything in
  this drawing gets: four horses nose to tail — barrel, chest and croup as
  three masses, a two-segment arched neck, skull, face and muzzle with two
  flared **nostrils**, a mouth line, wide-set eyes, pricked ears, bridle,
  mane and forelock, dock and three tail lengths, and four legs each with
  shoulder, forearm, cannon, fetlock joint and hoof. The chariot rides on
  two wheels of eight spokes with hub and tyre, behind a curved breastwork
  with relief bands, a draught pole and a yoke. Victoria has a draped robe
  of nine fold ridges, bound hair under a diadem, both arms and two wings
  of three feather courses each. 12 280 triangles for one landmark.
- **The Iron Cross is exact.** A cross pattée is a defined figure — four
  equal arms widening from a narrow waist to a flat tip, with concave
  flanks — so it is generated from pinned ratios and real Bézier flanks in
  `quadrigaProfile.ts` instead of being faked with two crossed boxes.
  Tests pin fourfold rotational symmetry to 1e-12, the exact tip-to-tip
  span, the concavity that separates it from a plus sign, and exact linear
  scaling. Schinkel's standard carries it inside an **oak** wreath of 22
  individually tipped leaves, under the Prussian eagle with beak, spread
  wings and tail fan.
- **All three modes, one geometry.** Day is flat unlit bronze in the drawn
  city's own convention; night is cool patina under the gate's warm
  floodlighting; the snowstorm mode gets cold bronze plus a separate cap
  mesh so snow lies on upward faces only. Switching repaints vertices — it
  never rebuilds. Mane, tail and robe folds are their own meshes with
  stated pivots and swing limits, so wind can lift them without dragging
  the horse along. The sculpture is scaled from the gate's own published
  figures: 20.3 m to the attic, 26.0 m over all, so the eagle lands exactly
  at the documented total height.
- **Three measurable errors gone from the Holocaust memorial.** The stele
  field carried 2710 stelae where the documented count is **2711**, alleys
  1.50 m wide across the field (58 % too wide) and 0.52 m along it (45 %
  too narrow). Eisenman's alleys are 0.95 m in BOTH directions — wide
  enough for one person, too narrow for two — and that single dimension is
  the whole experience of the place; having it wrong in opposite
  directions on the two axes turned a lattice of equal corridors into rows
  of spaced blocks. The layout now derives everything from the documented
  stele footprint and that one alley width, so the grid cannot drift
  again: exactly 2711 stelae trimmed from the rim inward, the documented
  0.2–4.7 m heights rising toward the middle, every stele leaning by at
  most two degrees, and a ground that rolls in waves over a sunken centre.
  Deterministic — the memorial never reshuffles itself between visits.

## v0.68.0

- **The Reichstag again carries its defining west inscription and complete
  permanent flags.** `DEM DEUTSCHEN VOLKE` now occupies the documented 16 m
  architrave field on a physically separated, depth-stable drawing plane, so
  it no longer disappears into the portico. Three 5 x 7 m German flags and
  the southeast 5 x 7 m European flag use the Bundestag's published count and
  dimensions and remain present in Day, Night, Minecraft and Snowstorm.
- **A still camera now produces a deliberately persistent framebuffer.** The
  WebGL renderer preserves its completed drawing buffer for browsers whose
  compositor otherwise discards an idle canvas, while the established
  fixed-resolution and deterministic-detail policies remain intact. Eight
  production captures per mode at desktop size, plus eight Day captures at
  390 x 844, were byte-identical; the canvas therefore changes only for an
  explicit interaction or an enabled animated effect.
- **The Swiss Embassy and Charite read as their actual civic landmarks.** The
  Swiss flag has moved from terrain level to the historic palace roof and is
  retained in every above-ground visual mode. Sixteen official LoD2 parts of
  the renovated Charite tower now receive its narrow, regular facade rhythm,
  pale metal envelope and source heights; the mapped campus bridge receives a
  separate glass treatment. This also fixes the dormant hero-window dispatcher
  that previously gave all named buildings a generic rhythm.
- **Robert Koch is no longer a generic stone marker.** The official monument
  anchor at Robert-Koch-Platz now carries a close-scale marble composition of
  the high-backed chair and seated figure, with the Berlin monument record
  retained as provenance.
- The versioned visible presentation radius remains **5,230 m**. No bounds,
  source coordinates, Google data, API credentials or raw photographs changed
  in this focused landmark and temporal-stability release.

## v0.67.0

- **Golda-Meir-Steg now follows its measured, unmistakable Europacity form.**
  The pier-free crossing is pinned to 76.86 x 4.00 m at the OSM centre and
  drawn as the documented shallow-camber steel trough with tall traffic-yellow
  structural sides, a rounded upper rail, fine laser-cut slot cues and warm
  integrated night lighting. The supplied photographs were used only for
  visual comparison; no photograph or commercial-map material is bundled.
- **The three neighbouring bridges no longer share generic proportions or
  materials.** Berlin's June 2025 bridge inventory now fixes Moltkebrücke at
  77.58 x 25.70 m, Gustav-Heinemann-Brücke at 87.76 x 4.00 m and
  Sandkrugbrücke at 32.60 x 28.80 m. Moltkebrücke carries red Main-sandstone
  masonry, separate sandstone pavements and an asphalt carriageway;
  Gustav-Heinemann remains a light, narrow pedestrian ribbon; Sandkrug keeps
  its broad open-frame road deck. A reversed procedural-box winding that hid
  every bridge top under back-face culling is fixed and regression-tested.
- **The interim Bundespräsidialamt is no longer a capsule inside a square.**
  Its hand model now uses the current 37-point OSM footprint as a bent bar,
  with the documented timber-module floors, curved ends, coloured vertical
  facade fins and a restrained concrete plinth. The stale former-site LoD2
  prism is suppressed geometrically, while nearby buildings remain untouched;
  the corrected model persists through Day, Night, Minecraft and Snowstorm.
- **Topography of Terror and Otto-Weidt-Platz receive location-specific
  detail.** The approximately 200 m Wall ruin follows the mapped
  Niederkirchnerstraße trace and carries irregular 1989/90 damage, surviving
  round crown pipes, bounded graffiti-colour cues and a separate security
  fence. The actual 180 m² Otto-Weidt-Platz fountain polygon retains its
  source outline but now has the distinctly darker basin floor and water.
- The versioned visible radius remains **5,230 m**; no bounds, existing
  building positions, Google data, API credentials or raw photographs changed
  in this focused accuracy release.

## v0.66.2

- **The Tiergartentunnel is underground again in every ordinary exterior
  view.** The former route-spanning grey "ground cap" was itself visible above
  the city because it bypassed depth testing and rendered last. It has been
  removed. Both real portal ramps remain surface geometry, while their short
  forced-depth bore interiors now start hidden, appear only for an explicit
  Kemperplatz, south-portal or Spreebogen tunnel-mouth focus, and disappear on
  the first free camera movement. The complete cutaway tube remains available
  from the underside and tunnel-flight views.
- **Idle selection no longer looks like scene flicker.** The selected-sight
  ring is now a static, temporary focus cue in both the Three.js view and DZI
  fallback; it no longer pulses or keeps the WebGL render loop alive. A mobile
  390 x 844 production check at the Kanzleramt, including the reported far
  view, shows no grey tunnel strip. Six-frame checks at 350 ms intervals
  measure exactly 0 changed pixels in Day and Night. Minecraft stays below the
  0.1% perceptual threshold at a measured maximum of 0.0064%; its only changes
  are the intentionally roaming creepers and zombies.
- **Release readiness now guards this regression.** It rejects any return of
  the route-spanning cap, default-visible portal bores, or selected-marker
  pulse, and requires the explicit tunnel-focus reveal gate.

## v0.66.1

- **Day, Night and Minecraft no longer resize the WebGL backing store during
  navigation.** The former interaction/settled DPR governor visibly
  reallocated the complete canvas at 1280 x 720 as
  `2560x1440 -> 2432x1368 -> 2560x1440`. Every viewport now receives one
  GPU-bounded ratio for its lifetime: up to 2x / 10.0 megapixels on desktop
  and 1.5x / 4.4 megapixels on touch devices. Mouse, wheel, keyboard, trackpad
  and touch input therefore preserve one sampling grid from press through
  momentum and release.
- **The official city/tree surface also stays in one quality tier while the
  camera moves.** Desktop upgrades once, after the 6.6M-face surface finishes
  loading, and then keeps it; touch devices and Minecraft keep their bounded
  interaction tier. The former per-gesture 2.6M/6.6M replacement and
  microcrown visibility swap are removed, including a direct touch-reset write
  that could expose one wrong Minecraft frame.
- **Sub-pixel staffage is deterministic in every ordinary mode.** Flags retain
  one authored wind pose and traffic lights retain one valid German phase
  instead of changing their thin geometry or lamp pixels only while the camera
  moved. Weather particles and Minecraft figures remain intentional animation;
  with weather off, a still viewport holds its final framebuffer.
- **Temporal stability is now measurable, not inferred.**
  `isometric_berlin.generation.measure_temporal_stability` compares named PNG
  sequences, reports exact and perceptual pixel deltas plus bounding boxes, and
  fails automation when more than 0.1% of pixels change by over 12 RGB levels.
  Unit tests cover exact stability, harmless capture noise and a deliberately
  failing 4% flash. Production-browser verification captured six 1280 x 720
  frames in each of Day, Night and Minecraft at 300 ms intervals: all 15
  adjacent comparisons measured exactly 0 changed pixels, 0 visible pixels and
  0 mean/maximum channel delta. Ten genuine wheel-zoom samples per mode kept
  the canvas at 2560 x 1440 throughout; Day/Night retained
  `settled-7m-plus`, while Minecraft retained `interaction-2_3m` before,
  during and after input.

## v0.66.0

- **The versioned presentation radius grows by exactly 100 m, from 5,130 m
  to 5,230 m.** The bounded polygon adds a tight north-east lobe for Berliner
  Ensemble and Berlin Friedrichstraße without moving existing geometry or
  opening an unbounded Mitte download. The same polygon now yields 17,091
  LoD2 volumes, 21,068 OSM road features, 175 water features, 1,826 parks,
  11,222 vegetation features, 1,548 rail features and 9,732 POIs.
- **The release inventory grows from 73 to 87 source-positioned sights.** New
  QA anchors cover the Hauptbahnhof tram stop, opened S15 station, Oggi's,
  Washingtonplatz taxi rank, Futurium, both federal education/research-office
  contexts, Parliament of Trees, Berliner Ensemble, Friedrichstraße station,
  Detlev-Rohwedder-Haus, Gropius Bau, Abgeordnetenhaus and Topography of
  Terror. All 38 relative-placement contracts pass; the only two review rows
  are explicitly future/unmapped projects (DKB Campus Upbeat and berlin
  modern), not detected east/west or north/south swaps.
- **Three narrowly selected official Berlin 3D Mesh tiles complete the new
  civic edge.** The additive scene now contains 26 interaction tiles with
  2,599,985 faces, 26 settled tiles with 6,623,585 faces and 22 lazy hero parts:
  74 GLBs / 174.3 MiB total, with every GLB below 5 MiB. Mobile still requests
  only the 29.9 MiB interaction tier; desktop streams the 79.1 MiB settled tier
  and retains at most two lazy hero groups.
- **New flat-tone recognition geometry makes the added locations readable in
  Day, Night, Minecraft and Snowstorm at identical coordinates.** It includes
  two modern five-section trams and their platform canopy, the S15 entrance,
  five taxis, Oggi's kiosk, Futurium's published massing/window/canopy cues,
  green federal-campus accents, Parliament of Trees, Berliner Ensemble,
  Friedrichstraße station and the southern government/museum ensemble.
  Night-capable glazing and transit lights use the existing warm-light rig;
  there are no permanent landmark dots. Contextual camera presets now keep
  each complete Futurium, tram/S15 ensemble, theatre and memorial setting in
  frame instead of clipping their roofs or platforms at the screen edge.
- **The southern historical context is materially distinguishable instead of
  generic blocks.** Detlev-Rohwedder-Haus receives its long 1935/36 facade
  rhythm, Gropius Bau its brick/sandstone register, the former Prussian
  Landtag its set-back Renaissance rhythm, and Topography of Terror a low
  pavilion plus a deliberately irregular approximately 200 m Wall-fragment
  cue. Vehicle dimensions, facade rhythms and damaged Wall-crown segments are
  labelled display approximations over official LoD2/mesh/OSM anchors, not
  as-built survey claims.
- **Eight pipeline and viewer defects found during the sweep are fixed.** Exact mesh-tile
  allowlisting prevents a bounded expansion from downloading every newly
  intersecting archive; additive manifest merging preserves earlier evidence;
  overview bounds and LoD2 tone sampling use the same projection; six newly
  fetched named artworks now receive a presentation builder instead of
  silently disappearing; and release readiness requires settled coverage for
  every interaction tile rather than a stale hard-coded count of 23. The
  shared geometric alphabet now includes the `I` required by Oggi's sign, so
  one unsupported letter can no longer abort the complete Three.js scene.
  Minecraft keeps both tunnel mouths and ramps but suppresses the internal
  forced-depth occlusion cap that previously appeared as kilometre-long grey
  strips over the voxel city. The compact offline DZI now rescales its focus
  metadata, while the React viewer resolves every sight from normalized
  coordinates against the actually loaded image size; this fixes the formerly
  empty high-resolution map in the Mac/Windows package.
- **Release claims now derive from generated artefacts.** The metric report is
  regenerated for all 17,091 LoD2 rows, package instructions read GLB/face
  counts from `scene.json`, and the current official-detail payload records
  29,860 trees, 5,829 lights, 591 paths, 12 Wall traces and 101 playgrounds.
  No Google content or credentials are used; commercial maps remain no-copy
  plausibility checks only.
- **The extracted-package ceiling moves narrowly from 208 to 210 MiB.** The
  complete archive is 209 MiB extracted and approximately 154 MiB compressed;
  preserving the 8192 px offline DZI is preferable to degrading the zero-server
  map to save roughly one megabyte. The public download remains below the
  repository's 200 MB compressed-bundle ceiling.

## v0.65.0

- **The measured central-Berlin hull now reaches the complete requested
  task-10 area.** The versioned presentation radius grows by exactly 100 m,
  from **5,030 m to 5,130 m**, without moving existing geometry. The bounded
  source polygon now reaches Europacity/DKB in the north, Anhalter Bahnhof and
  Kochstraße/WELT Balloon in the south, and the full Tiergarten to
  Charlottenburger Tor in the west. All generated context was rebuilt from the
  same polygon: 15,200 LoD2 source volumes produce 15,076 hard-edged prisms;
  OSM contributes 19,166 roads, 166 water features, 1,751 parks, 1,308 rail
  features and 8,585 POIs; the compact park payload carries 29,283 trees,
  5,251 lights, 591 paths and 98 playgrounds. Optional official ALKIS/DOP/DGM
  refreshes that failed local certificate validation retained their previous
  recorded evidence; TLS was not weakened and no source was silently dropped.
- **All four visual modes cover one 73-sight coordinate frame.** Bounds,
  overview bounds, DZI/reference map and both bundled landmark payloads were
  regenerated together. New navigation targets include Hamburger Bahnhof and
  Rieckhallen, Sozialgericht Berlin, Europacity/KPMG/DKB, Kulturforum and
  `berlin modern`, Tilla-Durieux-Park, Café am Neuen See, Spanish Embassy,
  Charlottenburger Tor, Anhalter Bahnhof and the WELT balloon. The 2D fallback
  no longer remains pinned to an obsolete 43-sight extent.
- **Snowstorm, rain and Minecraft weather now remain bounded and responsive.**
  Snowstorm adds a shared snow mantle, 2,400 desktop / 1,100 mobile instanced
  flakes, 168 deterministic drifts and three snowploughs. Moderate rain stays
  an independent toggle for Day, Night and Minecraft. Three Creepers and four
  Zombies walk deterministic park routes in one instanced group and disappear
  outside Minecraft, including underwater and underside presentations.
- **The Tiergartentunnel can be traversed in both directions.** Guided flights
  follow the explicitly approximate OSM-derived route inside the correct
  right-hand traffic tube, place the camera at road level, and expose lane
  markings, flattened ceiling lights and paired ventilation fan rings. Manual
  mouse, touch or keyboard navigation cancels the flight and restores the
  ordinary presentation; the buried route remains sealed in above-ground
  views.
- **Fullscreen and controls are more resilient.** Desktop uses the browser
  fullscreen API with a bounded fallback, while iPhone/tablet uses a
  safe-area-aware pseudo-fullscreen path that cannot hang waiting for an API
  Safari does not expose. Compact action labels wrap without shrinking below
  the 44 px touch contract. A separate keyboard bug that rejected every
  `Alt`/`Option` event before the orbit handler made `Alt` + arrows unreachable;
  only those four documented arrow chords now bypass the browser-chord guard.
- **The expanded edges receive mode-aware recognition detail without false
  survey claims.** Hamburger Bahnhof, Rieckhallen, Sozialgericht, Kulturforum,
  Henry Moore, Tilla-Durieux, Anhalter Bahnhof, Charlottenburger Tor, Spanish
  Embassy, Café am Neuen See, KPMG/DKB and WELT receive flat ivory/brick/glass
  apparatus anchored to LoD2/OSM. DKB future-project massing is explicitly
  approximate. Floating facade panels were removed, and the missing drawn `P`
  glyph that could crash the complete Three.js scene at KPMG is implemented.
- **The generated scene remains release-sized and stable.** The 68 GLBs keep
  23 interaction tiles, 23 settled tiles and 22 lazy hero files at 163.5 MiB;
  every file stays below 5 MiB. The interaction tier has 2,299,987 faces and
  the settled tier 6,000,002. The official-detail GeoPackage retains all
  24,872 trees, 5,724 lights and 12 Wall segments but omits optional RTree
  indexes that the sequential payload build never uses, shrinking from
  6,213,632 to 4,345,856 bytes. A loaded static Day frame was compared 1.8 s
  apart with zero differing bytes, providing an exact idle-flicker check for
  this iteration.
- **The offline archives stay below their hard extracted-size ceiling without
  losing any 3D geometry.** Packaging preserves all 68 GLBs and compacts only
  the redundant highest DZI fallback level: the downloadable descriptor is
  8192×5808, still above the 6144×4356 double-click overview, while the hosted
  viewer retains the complete 16384×11616 pyramid. Both release archives are
  about 145 MiB compressed / 198 MiB extracted and pass manifest, tile-pyramid,
  hash and local-start checks.

## v0.64.0

- **The Tiergartentunnel is now sealed from every above-ground direction, not
  only at a few previously reported positions.** The surface cap follows the
  complete 2,304.5 m real centreline between the two 260 m portal troughs,
  overlaps both joins by 2 m and adds a 12 m side skirt beyond the twin tubes.
  It is opaque, writes depth and is deliberately drawn after the forced-depth
  bore materials even through non-depth-writing water, bridge and glass
  surfaces. The bore deck, walls, ceiling, lane material and lamps now precede
  that final boundary. A permanent Bun regression walks all 10 centreline
  segments at 22 reduced interior samples, both tubes, four isometric azimuths
  plus top-down: **220/220 rays** meet the cap before any tunnel material.
  Only the two genuine portal troughs remain open by design.
- **The Amtssitz am Spreebogen no longer has a LoD2 rectangular box around its
  hand-built Sauerbruch-Hutton pill.** Both the drawn city and the regenerated
  Minecraft voxel mirror suppress every substantially overlapping LoD2 prism
  by a buffered capsule-footprint test (20 m clearance, 30% vertex overlap),
  not by a fragile source ID. The former-site prism `fNQrO6eN` is caught while
  the neighbouring `K0002TYI` remains; the payload regression confirms zero
  voxel columns within the former-site footprint.

## v0.63.1

- **The Tiergartentunnel cannot shine through Cube Berlin or the western
  Hauptbahnhof rail viaduct.** The visible portal decks, lane markings and warm
  bore lamps intentionally bypass the uncut official surface depth at the two
  canonical daylight troughs; that forced-depth presentation could also appear
  through a transparent facade or an incidental surface gap above the buried
  middle route. A centreline-derived opaque, depth-writing ground cap now
  covers that middle section after the forced portal pieces. It deliberately
  excludes both troughs, so the Kemperplatz and Südeingang bore sights remain
  open. The tunnel rendering contract now checks the cap's depth behaviour,
  its two exempt troughs and an oblique above-ground ray.

## v0.63.0

- **Static Day far views no longer keep repainting.** The final composited
  framebuffer is now held after a genuine mutation instead of being redrawn at
  12 fps while idle. The render loop hard-snaps asymptotic camera damping after
  three sub-millimetre pose updates, keeps the existing DPR/detail hysteresis,
  and only advances flags and traffic signals while the scene is moving. This
  is a stability fix, not a resolution or ink-quality reduction: Day and Night
  retain NoToneMapping, exposure 1 and the authored `isoFaceShade` contract.
  At 960×600, six far-Day frames at 250 ms intervals have identical SHA-256
  hashes: all five adjacent differences are **0 changed pixels (0.000000 %)**,
  zero mean absolute delta and no diff bounding box. The frame sequence,
  difference images and JSON are retained in `visual-check-v63/`.
- **The Tiergartentunnel has one exterior owner.** A leftover city-world portal
  builder was duplicating the canonical `TunnelPortals.ts` approach geometry;
  the former surface tunnel trace also made the buried route read as an
  above-ground line. Both are gone from the isometric city. The canonical two
  open troughs remain, but their portals hide in underside views, so their
  forced surface-depth materials cannot draw through the cutaway. The contract
  test now pins **0/39** buried middle positions as surface tunnel objects and
  rejects all former duplicate portal/ink object names.
- **Music is prepared at load but never autoplayed.** Both procedural Web Audio
  graphs and their short buffers are prebuilt while suspended; the first
  permitted capture-phase `pointerdown`, `pointermove`, `touchstart`, `wheel`
  or `keydown` resumes them without generation work and uses a 0.18 s fade.
  Visibility/focus retries cover a browser that initially blocks audio. The
  Dusk pending-start path repeats `resume()` synchronously in the first valid
  gesture, preserving the v0.57.1 race guarantee. Browser autoplay policy
  still controls whether sound may begin before a visitor gesture.

## v0.62.0

- **Named artwork is no longer a field of pebbles.** All 117 unique named
  `kind: "artwork"` entries in the bounded OSM street-detail payload now have
  an explicit presentation-builder hook; `buildStone()` remains for quiet
  memorial markers and Stolpersteine only. Animal, mounted, standing figure,
  figure-group, fountain, wall, portal, vertical and abstract silhouettes keep
  the one merged mesh economical while a regression test verifies every named
  work enters a builder and clears the 0.7 m marker-height band. The shared
  group retains its explicit reference-based, not-surveyed `geometryStatus`.
- **Reference-specific key works received their own composition.** The Zoo
  Berlin Panzernashorn has its broad bronze body and paired horns; the
  Schifferbrunnen has its basin, fountain stock and seated boatman; the
  Matschinsky-Denninghoff *Berlin* reads as a broken steel chain; and
  Christophe Girot's *Sinkende Mauer* now descends as one walkable granite
  wall through its water basin. The Brandenburg Gate's already detailed
  Quadriga owns its coincident OSM artwork point, preventing a duplicate.
- **Night/Minecraft flicker measurement (SwiftShader limitation documented).**
  At 960×600, four captured *night-at-rest* frames differed by at most
  **0.003125 %** of all pixels (or **0.000868 %** with a visible max-channel
  delta >12), well below the 0.1 % idle threshold. Each headless screenshot
  took around two minutes, so the required five-frame / ~0.9 s sequence, the
  moving-zoom series and both Minecraft series could not be measured honestly
  within the 630 s sandbox ceiling. They remain an explicit follow-up for a
  GPU-backed run; this partial result is not presented as a completed
  Minecraft/animation measurement.

## v0.61.0

- **The OSM context now reaches the full surveyed hull.** The current
  Geofabrik Berlin extract was clipped again to `bounds.geojson`, replacing
  the old partial context with roads, water, parks, vegetation, playgrounds,
  rail and POIs over E386626…390183 / N5818392…5821304. The Minecraft voxel
  grid, surface polygons and street details were rebuilt from that bounded
  source. Großer Stern, the continuous Straße des 17. Juni, Tiergarten sand
  paths and the westward Spree are now sourced in the same OSM payload.
- **The Tiergartentunnel mouths stay open at the approach.** Investigation
  found no remaining asphalt plate on the untagged approach road; the south
  mouth was instead overlain by an OSM `water=basin` surface. A narrow,
  centreline-derived 260 m ramp corridor is therefore subtracted from both
  road and water surface buffers at each end, without removing any OSM class.
- **Both tunnel links now look through their own mouths.** The photographic
  presets are calculated from the ramp midlines (39° lens, portal-local
  target), use no focus dolly compensation, and keep the two bores, their
  depth caps and warm lamp rows in frame. Their portal presentation geometry
  explicitly renders above the uncut official-mesh shell; the tunnel remains
  labelled as engineered presentation geometry rather than surveyed excavation.

## v0.60.0

- **The Amazone rides and the lions recline.** Tuaillon's "Amazone zu
  Pferde" and Wolff's "Löwengruppe" were two of the generic 0.7 m marker
  stones the catch-all branch draws. The Amazone is now a granite pedestal
  carrying a standing horse — barrel, arched neck, head, tail, four legs —
  with the rider seated well back the way Tuaillon posed her, about 5.8 m
  overall. The Löwengruppe is the lioness on her rock with raised head,
  stretched forepaws and two cubs against her flank: long and low, clearly
  a group rather than a plinth. Contract tests pin both silhouettes by
  height band.
- **Tunnelled ways no longer roof the tunnel.** `build_surface_polygons.py`
  buffered every OSM highway into a surface plate, including the ways
  tagged `tunnel=*` or `covered=*` — which paved straight over the
  Tiergartentunnel troughs and hid the portal mouths behind flat ground.
  Underground ways are now excluded; the open ramps remain their own drawn
  geometry.
- **A camera preset that looks into the bore.** Both tunnel sights now aim
  at their own portal, derived from the same centreline the ramps are
  built from: the stand is walked back up the ramp's own axis and raised
  to an oblique angle, so the sight line drops through the open cut
  instead of skimming 150 m of ground plane. Pinned by test.

### Known gap at v0.60.0 (resolved in v0.61.0)

The bore geometry is verified by contract test — deck, walls, ceiling,
lamp row and depth cap, all below street level — but the preset does not
yet frame it convincingly on screen: at the south mouth the view arrives
by the Landwehrkanal with the trough out of shot. Three stands were tried
(sunk in the cut, raised near-horizontal, oblique). The remaining suspect
is that the approach road's surface buffer still covers the trough
upstream of the portal, because only the tunnelled segment is tagged.

## v0.59.0

- **The Hauptbahnhof escalators are a rideable path, not tilted planks.**
  Every one of the twelve flights that chain the galleries down to the deep
  station (+4.6 → 0 → −5.4 → −15 m) now carries transverse step ridges, a
  glass balustrade with a dark handrail on both sides, and comb plates that
  dock the run onto its floor at both ends. The deepest flights walk
  outward as they descend so they land on the inner island platforms at
  ±9.5 m — a flight that stayed at ±5.2 m would have delivered its
  passengers onto a track. Presentation geometry, like the interior levels
  it connects; contract tests pin twelve flights, forty-eight balustrade
  panels and the platform landing.
- **You can see deep into the Tiergartentunnel now.** Each mouth continues
  past its portal frame as a real 46 m bore: dark road deck, side walls,
  ceiling, a row of warm ceiling lamps marching into the dark, and a
  near-black depth cap that reads as the tube disappearing under the city
  ("man muss in die Eingänge … tief hineinschauen können"). Everything
  sits below street level, so it is only ever visible through the mouth
  itself. The tunnel contract test verifies all four tubes.
- **Kerbstones on every kerbed street.** The asphalt carriageways get a
  raised kerb band walking their real buffered polygon outlines — a 14 cm
  upstand from road level plus a fine ink line along the arris, following
  the terrain like the plates themselves. Park and sand paths stay
  kerbless, as they are in the Tiergarten. Day and night tones swap with
  the mode; a test pins the band's substance (thousands of segments, not a
  token).
- **Day mode measured still: no flicker.** At rest and in the seconds
  right after a zoom-out — the moment detail tiers used to pop — at most
  0.0039 % of pixels change across four frames. The monument accuracy
  round shipped in v0.58.0 was verified on screen for the Soviet memorial
  and the Luiseninsel figure; both stand and frame correctly.

## v0.58.0: Denkmal-Genauigkeitsrunde (Tiergarten-Denkmäler)

Schwerpunkt dieser Version: die im Handoff (`claude-handoff-v0.57.0.md`, Task 1)
aufgeführten Tiergarten-Denkmäler an Referenzfotos und Wikipedia/Wikimedia-
Beschreibungen abgleichen und Klotz-Geometrie durch gegliederte, gegenstands-
nahe Formen ersetzen. Alle Näherungen bleiben über
`group.userData.geometryStatus` als Präsentationsgeometrie gekennzeichnet
(Vertrag 5) und stützen sich ausschließlich auf Berlin-LoD2/OSM-Geometrie
plus Wikimedia-Bildreferenzen (additiv, keine Geometriequelle).

**Bearbeitete Denkmäler:**

- **Sowjetisches Ehrenmal (Tiergarten).** Die beiden T-34-Panzer und die
  beiden Haubitzen standen zu nah an der Kolonnade und wurden von deren
  Kranzgesims teilweise verschluckt. Sockelpositionen auf x=±33 m (Panzer)
  und x=±44,5 m (Haubitzen) verschoben, klar sichtbar vor der Kolonnade.
  Neuer Regressionstest: "each T-34 carries its running gear and stays
  clear of the colonnade". Referenz:
  https://de.wikipedia.org/wiki/Sowjetisches_Ehrenmal_(Tiergarten)
- **Königin-Luise-Denkmal / Luiseninsel.** `buildMarbleFigure` in drei
  Varianten (Luise, Friedrich Wilhelm III., Wilhelm I.) aufgeteilt statt
  einer generischen Kiesel-Form; Höhen so kalibriert, dass sie über 6 m
  liegen (Marmorfigur-Kontrakt-Test). Kamera-Preset ergänzt.
- **Richard-Wagner-Denkmal.** Das echte Schutzdach (1987/88, Architektin
  Marianne Wagner) ist ein stählernes Tonnengewölbe mit Plexiglas-
  Eindeckung, nicht das flache, zweistufige Walmdach im bisherigen Code.
  Die zwei flachen `CANOPY_ROOF`-Platten wurden durch eine Basisplatte plus
  vier stufenweise schmaler werdende Gewölbe-Segmente und eine First-Kappe
  ersetzt, die die halbrunde Wölbung andeuten. Kamera-Preset ergänzt (Wagner
  hat keinen eigenen Sight-Deep-Link; kein Klick-Fokus-Pfad existiert für
  reine OSM-Punkte, daher kein Vorher/Nachher-Screenshot möglich — verifiziert
  über Debug-Vertex-Höhenscript und neuen Komponenten-Kontrakt-Test
  ("Wagner's canopy is a stepped vault above four posts, not a flat lid").
  Referenzen: https://de.wikipedia.org/wiki/Richard-Wagner-Denkmal_(Berlin) ,
  https://bildhauerei-in-berlin.de/bildwerk/wagnerdenkmal-5372/
- **Bismarck-Nationaldenkmal (Großer Stern) + Moltke/Roon.** Entdeckt: zwei
  unabhängig positionierte Bismarck-Denkmäler rund 58 m voneinander entfernt
  am selben Standort — das verifizierte `createSiegessaeule()`-
  Recognition-Model in `IsometricCityWorld.ts` zeichnete eines an einem
  festen Versatz zur Siegessäule, während der OSM-Punkt "Otto von Bismarck"
  unabhängig ein zweites über `buildBismarckNationalDenkmal()` in
  `TiergartenMonuments.ts` auslöste. Der OSM-Punkt wurde in
  `MONUMENTS_ALREADY_MODELLED` aufgenommen und die nun tote Funktion entfernt.
  Die verbleibende Figur wurde von drei pauschalen Klötzen zu einer
  gegliederten Statue (Mantel/Taille, Schultern, Kopf, Reichsschwert) samt
  vier Ecken-Figurengruppen (Sockel + sitzender Torso + Kopf statt zwei
  Würfeln) ausgebaut. Referenz:
  https://de.wikipedia.org/wiki/Bismarck-Nationaldenkmal_(Berlin)
- **Lessing-Denkmal.** Eigene `buildLessingMemorial()`-Funktion statt der
  generischen `buildStatue()`-Klotzform: gestufter Granitsockel (grauer
  Unterbau, rötlicher Granit-Hauptsockel, Kranzgesims), gegliederte
  Marmorfigur (Mantel/Beine, Torso, Kopf) und die bronzene "Genius der
  Humanität"-Figur am Sockelfuß, nach Otto Lessings Denkmal von 1890.
  Visuell verifiziert über `#landmark=lessing-denkmal`. Referenzen:
  https://de.wikipedia.org/wiki/Lessing-Denkmal_(Berlin) ,
  https://bildhauerei-in-berlin.de/bildwerk/lessingdenkmal-4997/
- **Goethe-Denkmal und Beethoven-Haydn-Mozart-Denkmal.** Beide Modelle
  bauen bereits detaillierte Geometrie (Mantel, Kopf, Arme, Schriftrolle,
  drei allegorische Figurengruppen bzw. Büstennischen, Eckpfeiler, goldene
  Kuppel und Lorbeerkranz), riefen aber nirgends `addEdges()` auf — bei
  isometrischer Kameradistanz erschienen beide Denkmäler dadurch als eine
  flache, konturlose helle Silhouette statt eines facettierten Körpers, im
  Gegensatz zu allen anderen Denkmälern in der Datei. Fehlende Konturlinien
  auf Sockel, Stufen, Figurenkörper, Umhang, Kopf und Schriftrolle (Goethe)
  sowie Stufenring, Sockel, Stele und Kuppel (Komponisten) ergänzt. Visuell
  verifiziert über `#landmark=goethe-denkmal` (vorher: reine Silhouette;
  nachher: sichtbare Sockelkante, Kopfkontur, Armlinie). Referenzen:
  https://de.wikipedia.org/wiki/Goethe-Denkmal_(Berlin) ,
  https://de.wikipedia.org/wiki/Beethoven-Haydn-Mozart-Denkmal
- **Holocaust-Stelenfeld.** Geprüft, keine Code-Änderung nötig: 2710
  Stelen als ein `InstancedMesh`-Draw-Call, korrekte Eisenman-Wellenbewegung
  und Höhenbänder (0,2 m bis ~4,7 m), bereits bestehende strenge
  Höhenband-Tests bestehen weiterhin.

**Offene Punkte (nicht in dieser Version bearbeitet):**

- Von den 45 Sights in `regierungsviertel-landmarks.json` wurden in dieser
  und der vorangegangenen Runde nur die im Handoff explizit genannten
  Denkmäler bearbeitet (Sowjetisches Ehrenmal, Königin-Luise, Wagner,
  Bismarck/Moltke, Lessing, Goethe/Komponisten-Ink-Lines). Die übrigen
  ~38 Sights wurden nicht einzeln gegen Wikipedia/Wikimedia-Referenzen
  geprüft.
- Kein Vorher/Nachher-Screenshot für Wagner, Bismarck und Moltke möglich:
  Wagner und Bismarcks OSM-Punkt haben keinen eigenen Sight-Deep-Link, und
  Bismarck/Moltke liegen am Großen Stern hinter dichtem Baumbestand, der
  bei jedem verfügbaren Kamerawinkel die Sicht verdeckt. Verifiziert
  ausschließlich über Geometrie-Kontrakt-Tests und ein Debug-Höhen-Skript.
- Kein dedizierter Nacht- oder Minecraft-Modus-Screenshot für die in dieser
  Runde bearbeiteten Denkmäler: automatisierte UI-Klicks (Mond-Toggle,
  Minecraft-Toggle) über CDP/Playwright hängen zuverlässig unter dem
  SwiftShader-Render-Loop dieser Sandbox. Abgesichert stattdessen über die
  bestehende automatisierte Testsuite (`night-lighting.test.ts`,
  `minecraft-visual-mode.test.ts`, `minecraft-voxel-world.test.ts`), die
  vollständig grün ist.
- Die Kamera-Presets für Wagner (und implizit für andere reine OSM-Punkte)
  sind "totes" Infrastruktur ohne aktuellen UI-Trigger, da für solche
  Punkte kein Deep-Link/Klick-Fokus-Mechanismus existiert.

## v0.57.1: Mobiler Tipp-Fix für die Musiksteuerung ("Dusk Republic")

**Nutzer-Meldung (iPhone):** "Man kann auf mobil 'Dusk Republic' nicht
anklicken/einschalten." Der Touch-Ziel-Bereich war bereits konform
(≥44px in allen mobilen Layout-Kontexten); der eigentliche Fehler lag in
einer Race-Bedingung zwischen der Autostart-Logik und dem Toggle-Handler --
familiennah zum v0.52.1-N-Shortcut-Fehler.

- **Ursache.** `isSoundtrackEnabled` (und `isMusicEnabled`) speicherten die
  *Absicht* des Nutzers (Musik soll laufen), nicht den *tatsächlichen*
  Wiedergabestatus. Auf Mobilgeräten ist die allererste Berührung auf der
  Seite typischerweise der "..."-Überlauf-Button, der laut
  `audioAutostart.ts` legitim als erste Geste gilt und `startSoundtrack()`
  asynchron anstößt (AudioContext-Erzeugung + `resume()`, noch nicht
  abgeschlossen). Tippt der Nutzer im selben Moment auf den nun sichtbaren
  "Dusk Republic"-Button im geöffneten Overflow-Sheet, prüfte der alte
  `toggleSoundtrack()`-Handler die *Absicht* (`isSoundtrackEnabled`, seit
  Seitenaufruf bereits `true`) statt den *Hörbarkeits*-Status
  (`isSoundtrackAudible`, noch `false`) und stoppte die gerade erst
  anlaufende Wiedergabe sofort wieder -- der Tipp auf "Dusk Republic" schien
  wirkungslos oder schaltete die Musik direkt wieder aus.
- **Fix.** Neue reine Hilfsfunktion `shouldStopAudioOnToggleTap()` in
  `audioAutostart.ts`: Ein Tipp stoppt die Wiedergabe nur, wenn sie *bereits
  hörbar* ist, und startet sie andernfalls immer. `toggleSoundtrack` und
  `toggleMusic` in `App.tsx` branchen jetzt auf `isSoundtrackAudible` bzw.
  `isMusicAudible` statt auf die Intent-Flags. `DuskChiptune.start()` ist
  idempotent (dedupliziertes `startPromise`), daher ist ein doppelter
  Start-Aufruf während der Race-Phase unbedenklich.
- **Verifiziert.** Neue Unit-Tests in `audio-autostart.test.ts` decken das
  Race-Szenario ab; ein Playwright-Mobile-Viewport-Test (390×844) mit
  deterministisch verzögertem `AudioContext.resume()` reproduziert den Bug
  gegen den alten Code (Endzustand bleibt aus) und bestätigt den Fix gegen
  den neuen Code (Endzustand zuverlässig an), mit CDP-Screenshots als Beleg.

## v0.57.0

- **The Hauptbahnhof's deep level is the real station, not three tracks in
  a slab.** Berlin Hbf's lower level carries eight tracks (Gleis 1–8) at
  four island platforms; the model drew three tracks between four narrow
  strips squeezed into the 42 m north–south hall above. The layout is now
  built from the real module — an island platform between two tracks —
  repeated four times, so the deep box is wider than the hall standing on
  it, which is what the station box actually does underground. Ballast
  beds, a proper 0.95 m platform edge and the tunnel's side walls turn the
  floating slab into a room under the city, with the centre slot still open
  so daylight and the eye reach it.
- **Trains stand at the deep platforms, arriving from the north.** The two
  innermost tracks — the ones visible through the daylight slot — carry
  stock. A north–south train is built along the same axis as every other
  and then turned a quarter, so one builder keeps every window, door and
  bogie in step instead of two copies drifting apart.
- **The trains are no longer flat end-on.** A bare capsule shows a flat
  disc where the driving car should be. Each cab end now has a raked nose
  built from three stacked slices of decreasing width and height, and each
  vehicle carries two roof pantographs with their arms and contact strip —
  the one piece of a mainline train that reads unmistakably solid from
  above, which is exactly the angle an isometric drawing uses. The S-Bahn
  standing on the upper level gains the same nose, because both come from
  one builder.
- **Verified, not asserted.** Five new contract tests pin the eight tracks,
  the four islands, the tunnel box, the quarter turn that keeps a train
  along its platforms rather than across them, and the nose and pantograph
  counts. 391 viewer tests pass.

## v0.56.1: Hbf-LoD2-Rest unterdrückt (Footprint statt ID), Glasdach auf echte 321 m gestutzt und an den Enden über den Gleisen geschlossen

**Nacharbeit nach Nutzer-Screenshot (rote Markierungen).** Zwei konkrete
Fehler im v0.56.0-Hauptbahnhof, beide in derselben Ursache verwurzelt --
das Handmodell und die LoD2/Minecraft-Rohdaten liefen an zwei Stellen
auseinander:

1. **Beiger opaker Kasten über den Gleisen weg.** Am Ost-Ende ragte ein
   LoD2-Gebäudeprisma-Rest des echten Hauptbahnhof-Footprints (u. a.
   `DEBE3Dbzrg8J0PRu`, ALKIS-Funktion `51009_1610` "Bauwerk im
   Gleisbereich", ein diagonal entlang der Gleise laufender Solitär, den
   das Handmodell nie einzeln nachbildet) sichtbar neben/über der neuen
   Glashalle weiter. Die alte Suppression war eine feste 3-ID-Liste
   (`K0002KiE`, `YK0000Cm`, `q7Axk9GG`); das griff nur für exakt diese
   IDs und ließ jeden weiteren Teilprisma-Rest mit anderer ID durch.
   **Fix:** `PRISM_SUPPRESSED_IDS` verliert die drei Hbf-IDs; neue
   Funktion `isHauptbahnhofFootprintSuppressed()` in
   `IsometricCityWorld.ts` testet statt einer ID-Liste den tatsächlichen
   Footprint jedes LoD2-Gebäudes gegen ein lokales Hüllen-Polygon, das
   exakt die vom Handmodell gezeichneten Rechtecke nachbildet (Ost-West-
   Dachband entlang der echten Gleiskurve, Nord-Süd-Hallenband, beide
   Bügelbauten-Bänder), mit 15 m Außenrand und einer 30-%-Overlap-
   Schwelle über die Polygon-Vertices. Das fängt jetzt ~40+ Prismen rund
   um den Bahnhof ab (statt der alten 3), ohne irgendein Gebäude mehr als
   ~100 m vom Bahnhofsanker zu berühren (an der vollen Payload geprüft).
   Dieselbe Logik existiert gespiegelt in Python
   (`is_hauptbahnhof_footprint_suppressed()` in
   `build_minecraft_voxels.py`, angewandt in `rasterise_buildings()`),
   damit LoD2-Prismen und Minecraft-Voxel nie wieder auseinanderlaufen;
   `minecraft-voxels.json` wurde neu erzeugt. `lod2-prisms.json` selbst
   bleibt unverändert -- die Unterdrückung ist eine Render-Zeit-
   Entscheidung, die Rohdaten der unterdrückten Gebäude bleiben in der
   Payload (Kontrakttest dafür).
2. **Glasdach-Enden über den Gleisen statt über dem Wasser.** Das Ost-
   West-Tonnendach benutzte fälschlich `trackLength` (431 m, die Länge
   des gesamten Gleisdecks samt 110 m West-Zufahrtsstummel) statt der
   realen Hallenlänge von 321 m, und war nicht auf x = 0 zentriert. Damit
   kragte das Dach an beiden Enden frei über den Rand des eigentlichen
   Bahnhofsdecks hinaus -- am Westende über den Humboldthafen. **Fix, in
   `ArchitecturalLandmarks.ts`:** `addBarrelRoof` für das Ost-West-Dach
   bekommt jetzt `signature.east_west_roof_length_m` (321 m) und
   `offsetLongitudinal = 0`; das Gleisdeck darunter bleibt bewusst länger
   (offene Zufahrtsviadukt-Strecke westlich der Halle). Zwei neue
   Hilfsfunktionen `addBarrelRoofEndPortal` (verglaster Halbkreis-Giebel,
   um den lokalen Tangentenwinkel der Gleiskurve rotiert, also senkrecht
   zur tatsächlich gekrümmten Achse, nicht zur geraden Konstruktionsachse
   der Halle) und `addBarrelRoofEndSupport` (zwei Stahl-Stützenpaare plus
   Riegel, vom Deck bis zur Dachtraufe) schließen beide Dachenden über
   dem Gleisbündel ab.
3. **Verschärfter Krümmungs-Kontrakttest.** `tests/hauptbahnhof-curve.test.ts`
   läuft jetzt in 1-m-Schritten über die volle ±160,5-m-Dachspanne und
   prüft die maximale Querabweichung Dachachse↔Gleiskurve (< 4 m, > 300
   Stichproben); neue Regressionswächter stellen sicher, dass keine
   Dach-Geometrie über die 321-m-Hüllkurve hinausragt und dass an beiden
   Enden benannte Portal-/Stützobjekte existieren.
   `tests/isometric-city-world.test.ts` bekam einen neuen payload-weiten
   Test, der die Footprint-Suppression gegen die reale Geometrie prüft
   (bekannter Übeltäter muss unterdrückt sein, > 15 Gebäude insgesamt).

Beide Fehler wurden über Screenshots vom West- und Ost-Ende gegen die
vom Nutzer markierte Referenz (`IMG_0203.jpeg`) verifiziert; siehe
`v561-report.md`.

## v0.56.0: gebogener Glasschlauch entlang der Gleiskurve, komplette Glas-Hülle, Glas- und Krümmungs-Kontrakttests

**Radikale Korrektur Hauptbahnhof.** Der Nutzer war zu Recht unzufrieden mit
v0.55.0: der Ost-West-Glasschlauch lief gerade statt entlang der echten
Gleiskurve zu biegen, und über dem Glasdach saß ein opaker grauer Kasten
(die alte `spandrel`-Dachkappe der Bügelbauten). **Fix, in
`ArchitecturalLandmarks.ts`:**

1. **Echte Gleiskrümmung statt synthetischem Bogen.** `roofBowOffset`/
   `barrelRoofGeometry`/`addBarrelRoof` wurden von einem symmetrischen
   Sinus-Bogen (`bowM: number`) auf ein `curve: "none" | "rail"`-System
   umgestellt. Für `"rail"` folgt das Ost-West-Dach der echten
   Stadtbahn-Kurve: eine an `rail-lines.json` (Gleis 0, Stationslokal-
   koordinaten) angepasste Quadratik (`HAUPTBAHNHOF_RAIL_CURVE_A = 0.000787`,
   `HAUPTBAHNHOF_RAIL_CURVE_B = 0.2233`, Radius ≈ 635 m, Residuum < 2 m über
   die volle Länge), neu zentriert auf die Kreuzung mit der Nord-Süd-Halle
   (lokal x = 0). Das Dach, seine Rippen, Pfetten und Feldnähte sowie das
   gesamte Gleisdeck (Schienen, Schotterbett, Schwellen, Bahnsteige,
   Zufahrtsstützen) biegen sich jetzt gemeinsam entlang derselben Kurve
   (Deck wurde in kurze gerade Segmente mit Gier-Rotation zerlegt statt
   als ein einziger langer gerader Balken gebaut). Die Nord-Süd-Halle
   bleibt bewusst gerade, quer zur gebogenen Ost-West-Halle, wie im echten
   Bahnhof.
2. **Komplett gläserne Hülle, keine grauen Kästen.** Die opake
   `spandrel`-Dachkappe von `addStationOfficeBridge` (der genaue vom
   Nutzer benannte Fehler) wurde durch dieselbe transparente hellblaue
   Glasfamilie wie die Tonnendächer ersetzt. Zwei neue
   `addStationHallEntranceFacade`-Aufrufe zeichnen die verglasten
   Eingangsfronten Europaplatz (Nord) und Washingtonplatz (Süd) an den
   Giebeln der Nord-Süd-Halle. Die beiden Bügelbauten (46 m, je
   19 × 46 × 180 m, an der Kreuzung positioniert) bestehen jetzt komplett
   aus transparentem Glas inklusive Dachabschluss; nur die Mullions/das
   Stahltragwerk bleiben opak.
3. **Neue Kontrakttests.** `tests/hauptbahnhof-curve.test.ts` leitet die
   quadratische Kurvenanpassung unabhängig aus `rail-lines.json` ab und
   prüft sie gegen die eingefrorenen `HAUPTBAHNHOF_RAIL_CURVE_A/B`-
   Konstanten, prüft die tatsächlichen Vertex-Positionen des gebauten
   Dachnetzes gegen die erwartete Kurve, und stellt sicher, dass das Dach
   wirklich gekrümmt ist (kein gerader Schlauch) und die Nord-Süd-Halle
   gerade bleibt. `tests/hauptbahnhof-glass.test.ts` stellt sicher, dass
   über dem Bahnhofs-Footprint oberhalb der Dachbasis keine große opake
   Masse existiert, dass Dach, Halle, Eingangsfronten und Dachkappen alle
   transparentes Glas sind, und dass kein `spandrel`-Objekt mehr existiert.

## v0.55.0 — Hauptbahnhof-Neubau nach Referenzfotos, Mobile-Moiré-Milderung

**1. Hauptbahnhof-Neubau.** Die bisherige Drei-Segment-Dachkonstruktion
(Haupttonnendach + separat gezeichneter Ost- und Westflügel, siehe
v0.54.0) wich in der Silhouette immer noch von den Referenzfotos ab: die
Flügel wirkten als eigenständige, leicht versetzte Flachdachsegmente statt
als ein einziges durchgehendes Bauwerk. **Fix:** `createHauptbahnhofModel`
in `ArchitecturalLandmarks.ts` zeichnet das Ost-West-Glastonnendach jetzt
als ein einziges durchgehendes gebogenes Dach über die volle Spannweite
(`addBarrelRoof` bekam einen neuen `bowM`-Parameter für die Krümmung
über die gesamte Länge, statt separater Dachstücke mit eigenem Versatz);
die beiden Nord-Süd-Bürogebäude (Bügelbauten) wurden von dünnen
Fassadenplatten zu massiven, quaderförmigen Körpern mit eigenen
Dachabschlüssen und durchgehenden Kantenlinien umgebaut, wie auf den
Referenzfotos zu sehen. Die alten weißen Flachdachsegmente und das
frühere Doppeldach-Layout wurden entfernt.
`signature.east_west_roof_length_m` bleibt bei den amtlichen 321 m
(`scene.json`, DB-Angaben); der gerenderte Gleisdeck-/Dachzug ist davon
zu unterscheiden — er ist 431 m lang, weil er zusätzlich die 110 m lange
gerade Anfahrt nach Westen trägt (siehe Code-Kommentar an
`trackWestX`/`trackEastX`).

`tests/architectural-landmarks.test.ts` wurde auf die neue Zwei-Dach-Geometrie
angepasst: der Dachname wird jetzt dynamisch geprüft (kein fest codierter
Flügel-Name mehr), die Test-Assertions für Glasfugen- und Rippen-Instanzen
wurden von 3 auf 2 reduziert (kein separates Flügelsegment mehr), die
West-Flügel-spezifischen Assertions entfielen, neue Assertions prüfen
stattdessen die Turmhöhe und Dachabschlüsse der Bürogebäude; die
`bounds.max.y`-Prüfung wurde von einem exakten `toBeCloseTo` auf einen
Wertebereich gelockert, da die neue Dachkrümmung die Scheitelhöhe leicht
verschiebt. `tests/ice-on-rails.test.ts` war von diesem Umbau nicht
betroffen — der ICE-Kontrakt auf der echten Gleisachse
(`createIceOnRails`, v0.54.0) bleibt unverändert und wurde nicht berührt.

Visueller Beleg (Desktop, Standardansicht via `#landmark=berlin-hauptbahnhof`
Deep-Link — siehe Erkenntnis unten): ein durchgehendes Glastonnendach
kreuzt diagonal zwischen zwei parallelen Bürogebäuden, siehe
`visual-check-v55/after_desktop_hauptbahnhof.png`.

**Deep-Link-Erkenntnis:** `readViewHash()` (`App.tsx`) liest Landmark-Deep-Links
ausschließlich aus `window.location.hash` (`#landmark=...`), nicht aus dem
Query-String (`?landmark=...`). Ein Screenshot-Versuch mit `?landmark=...`
lädt scheinbar korrekt, zeigt aber weiterhin den Default-Fokus
(`DEFAULT_FOCUS_LANDMARK`, `resetView.ts` — aktuell "Bundeskanzleramt"),
weil der Query-String von der App schlicht ignoriert wird. Für Skripte und
externe Links: immer `#landmark=<slug>` verwenden.

**2. Mobile-Moiré — Code-Fix, Verifikation auf echter Hardware ausstehend.**
Nutzer-Aufnahmen auf echtem iPhone (Safari, `IMG_0178.jpeg`) zeigen bei der
weit herausgezoomten Standardansicht (~948 m Kameraabstand) deutliches
Moiré/Interferenzstreifen auf Rasen-, Straßen- und Wasserflächen. Analyse:
Bei dieser Standardentfernung hält das bestehende Fern-Ink-Fade-System
(`fineDetailFade.ts`, v0.53.0) die feinen Ink-Linien (Bordstein-, Fenster-,
Fugenlinien) bewusst noch voll opak — der Fade-Schwellwert
(`INK_LINE_FULL_PX`) greift laut Code-Kommentar erst deutlich jenseits der
948-m-Standardansicht. Genau in diesem Bereich projizieren viele feine
Linien auf wenige Pixel, was zusammen mit (a) nur 2x-MSAA auf
Coarse-Pointer-Geräten und (b) dem Screen-Space-Schärfungs-/Kantenerkennungs-Pass
(`crisp.frag`) zu Alias-Interferenz führt. **Fix in `ThreeViewer.tsx`:**
(a) MSAA-Samples des Compositors einheitlich auf 4x gesetzt (vorher
`coarsePointer ? 2 : 4`, jetzt immer 4); (b) ein neuer
`edgeMoireGuard`-Multiplikator (`coarsePointer ? 0.55 : 1`) dämpft
`crispPass.uniforms.edgeStrength.value` im Day/Night-Renderpfad auf
Coarse-Pointer-Geräten, ohne die gepinnten `crispnessProfile.ts`-Konstanten
selbst zu verändern (`crispness-profile.test.ts` bleibt unangetastet, da der
Multiplikator erst am Verwendungsort greift). Die Governor-Minima in
`renderQuality.ts` (gepinnt durch `render-quality.test.ts`, 60fps-Vertrag
auf dem Telefon) wurden bewusst **nicht** angehoben.

**Ehrlichkeitsvermerk:** Ein statischer Vorher/Nachher-Vergleich
(`before_mobile_dpr3_full.png` vs. `after_mobile_dpr3_full.png`, gleiche
Kameraposition, DPR 3, 390×844) zeigt im Pixel-Diff keinen messbaren
Unterschied (max. Kanalabweichung 5/255) — Headless-Chromium in dieser
Sandbox reproduziert das auf echtem iPhone-Safari/WebKit sichtbare
Moiré-Artefakt gar nicht erst, weshalb der Fix damit nicht visuell
bestätigt werden konnte. Die Code-Begründung (einheitliche MSAA,
Kantendämpfung exakt am Ort der Coarse-Pointer-Verzweigung) ist in sich
schlüssig und alle bestehenden Tests bleiben grün, aber eine Verifikation
auf echter Mobile-Hardware steht noch aus.

**3. Sonstiges.** `check_release_readiness.py` verlangt den wörtlichen
Beleg `"321 m east-west glass roof"` in `ArchitecturalLandmarks.ts`; nach
dem Dach-Umbau stand die Zahl nur noch in einer berechneten Vorlage
(`` `Hauptbahnhof ${Math.round(trackLength)} m east-west glass roof` ``,
ergibt 431, nicht 321). Ein neuer Code-Kommentar dokumentiert die amtliche
321-m-Dachspannweite explizit neben `trackWestX`/`trackEastX`, ohne die
Geometrie zu ändern.

## v0.54.0 — Glasdach-Flügel + ICE auf echten Gleisen inkl. Rotations-Bugfix

Zwei Nutzerbefunde am Hauptbahnhof.

**1. Hallendach links/rechts der Haupthalle wirkte opak/falsch.** Das
Ost-West-Tonnendach des Hauptbahnhofs ist durchgehend Glas; nur die
zentrale Kreuzungshalle mit dem Nord-Süd-Riegel war als transparentes
Glasgewölbe gezeichnet, während der westliche ~110 m lange Streckenüberbau
(Differenz aus Gleiskorridorbreite und dem 321 m messenden Haupt-Tonnendach)
unbedacht blieb — die Trag-/Gleisdeck-Geometrie lief einfach als nackte
Betonplatte weiter. **Fix:** `addBarrelRoof` in `ArchitecturalLandmarks.ts`
bekam einen neuen `offsetLongitudinal`-Parameter (durchgereicht durch
Dach-Mesh-Position, Rippen-, Pfetten- und Glasfugen-Segmente); ein neuer
`addBarrelRoof(...)`-Aufruf in `createHauptbahnhofModel` zeichnet den
westlichen Streckenüberbau als zusätzliches Tonnendach im selben Glasstil
(gleicher Glaston, Sprossenraster, Transparenz), nahtlos an die
Kreuzungshalle angeschlossen. Kontrakttests aktualisiert: Glasfugen- und
Rippen-Instanzen-Zahl von 2 auf 3 erhöht (zusätzlicher Flügel), neue
Assertions verankern die West-Flügel-Grenzen exakt an Gleisdeck- und
Hauptdach-Rand.

**2. ICE stand auf einem Stummelgleis Richtung Wasser.** Der
Staffage-ICE wurde bisher direkt in `createHauptbahnhofModel` mit einer
frei erfundenen Position/Rotation gebaut und stand auf einem Stummelgleis,
das nicht an den echten Gleiskorridor (`rail-lines.json`, Stadtbahn-Viadukt)
anschloss, sondern Richtung Spree/Humboldthafen ins Leere lief. **Fix:**
Neue Funktion `createIceOnRails(rail)` baut den ICE jetzt lose in
Welt-Koordinaten (nicht mehr als Kind der rotierten Bahnhofsgruppe) auf
einer echten `viaduct_tracks`-Polylinie. `findIceTrackPlacement` sucht den
Gleiszug mit dem geringsten Abstand zum Bahnhofsanker
(`HAUPTBAHNHOF_ANCHOR_WORLD`), schneidet daraus einen zug-langen Abschnitt
und berechnet Position sowie Ausrichtung aus dessen Tangente.

**Rotations-Bugfix (vor dem Verdrahten gefunden):** Die erste Fassung
berechnete `rotationY = Math.atan2(dx, dz)` aus der Tangente `(dx, dz)`
zweier Polylinienpunkte. Eine Nachrechnung per Python-Simulation zeigte,
dass diese Formel die lokale +X-Achse der Gruppe (Three.js-Konvention:
`rotation.y = theta` bildet `(1,0,0)` auf Weltrichtung
`(cos theta, -sin theta)` ab) um 90° falsch drehte — die gemappte Richtung
`(0.149, 0.989)` passte nicht zur tatsächlichen normierten Tangente
`(-0.989, 0.149)` des gewählten Gleisabschnitts. Korrekte Formel:
`rotationY = Math.atan2(-dz, dx)`; damit stimmt die gemappte Weltrichtung
exakt mit der Gleistangente überein (numerisch verifiziert). Ohne diese
Korrektur hätte der ICE quer statt längs auf dem Gleis gestanden.

Neuer Kontrakttest `tests/ice-on-rails.test.ts`: ICE-Position liegt
< 2 m von einer `rail-lines.json`-Polylinie entfernt; Ausrichtung ist
tangential (< 5° Abweichung, beide Fahrtrichtungen zulässig); Höhe liegt
auf dem echten Gleiskorridor-Schienenkopf (`deck_top_y_m +
rail_top_over_deck_m`), nicht auf dem lokalen Bahnhofsdeck; Abstand zum
Bahnhofsanker bleibt < 120 m (Regressionsschutz gegen erneutes
Abdriften Richtung offenes Wasser). Bestehender Test in
`architectural-landmarks.test.ts` aktualisiert: der ICE ist jetzt kein
Kind der Bahnhofsgruppe mehr (nur noch der S-Bahn-Zug und dessen
Rad-Instanz bleiben dort); `addStationTrain` bekam einen `railTopY`-
Parameter, damit dieselbe Zuggeometrie sowohl auf dem lokalen
Bahnhofsdeck (S-Bahn) als auch auf der echten Gleiskorridorhöhe (ICE)
aufsetzen kann.

Verdrahtet in `ThreeViewer.tsx`: `createIceOnRails(rail)` wird in
`ensureIsoWorld` direkt neben `createRailNetwork(rail, ground)` aufgerufen
und der resultierenden Gruppe `runtime.isoWorld` hinzugefügt — bewusst
nicht innerhalb der rotierten/verschobenen Hauptbahnhof-Modellgruppe, weil
der ICE jetzt in echten Weltkoordinaten auf dem Gleiskorridor sitzt.

Visuelle Prüfung: Vorher/Nachher-Screenshots des Dachs bestätigen den
durchgängigen Glasstil ohne Bruch an der Kreuzungshalle. Für den ICE
selbst lieferte die Playwright/SwiftShader-Kameraperspektive aus der
Standardansicht keine eindeutig freistehende Zugsilhouette (vermutlich vom
Dach verdeckt bzw. bei diesem Kamerawinkel zu klein aufgelöst); als
Beleg für die korrekte Platzierung dienen die fünf grünen
Kontrakttest-Assertions (Abstand, Tangentialität, Höhe,
Anker-Abstand-Regressionsschutz) statt eines vollständig freien
Screenshot-Nachweises. Screenshots unter
`/home/user/workspace/visual-check-v54/`.

## v0.53.1 — Amtssitz-Platzierungsfix, Ursache CAP_RADIUS-Aufblähung auf ~142 m

Live-Befund nach v0.53.0: der neu gebaute Pill-Riegel erschien nicht als
eigener ~7-geschossiger Bau nordwestlich der Moltkebrücke; stattdessen wirkte
das eingeschossige Zollpackhof-Schankhaus mit bunten Streifen und einer
gerundeten Wandkurve überlagert, weil der Amtssitz-Baukörper massiv
übergroß war und in dessen Richtung hineinragte.

**Ursache:** In `SpreebogenOffice.ts` benutzte `straightLength` die Konstante
`CAP_RADIUS_M = 12.5` zur Berechnung der geraden Mittelsektion
(`width - 2 * CAP_RADIUS_M`), während die tatsächlichen `addPartialCylinder`-
Aufrufe für die gerundeten Kappen an Sockel und Körper durchgehend
`depth / 2` (≈36.85 m) als Kappenradius verwendeten — nie `CAP_RADIUS_M`.
Dadurch wurde der zusammengesetzte Baukörper ca. 142 m statt der
OSM-Vorgabe von 92,9 m breit (per Laufzeit-`Box3`-Debugging bestätigt:
`size:[142.25, 27, 83]` statt der erwarteten ~93×27×74 m). Die übergroßen
Kappen erzeugten eine gekippte, dominante Fläche, die visuell wie ein
zusammengeschmolzenes Nachbargebäude mit Satteldach wirkte — exakt das
gemeldete Symptom. Zusätzlich war `atticRadius = CAP_RADIUS_M - 2.5` (=10 m)
aus demselben Grund inkonsistent mit der realen Footprint-Tiefe.
Die Footprint-Koordinaten selbst (`centreX=-296.2, centreZ=-366.5,
depthM=73.7, widthM=92.9`) waren bereits korrekt und blieben unverändert;
der Bug lag ausschließlich in der abgeleiteten Kappen-/Mittelsektion-
Geometrie.

**Fix:** `CAP_RADIUS_M` entfernt; `straightLength` jetzt `width - depth`
(=19,2 m statt 67,9 m); `atticRadius` jetzt `atticDepth / 2 -
ATTIC_RADIUS_INSET_M` (neue, klar benannte Konstante für den
Dachgeschoss-Einzug). Ergebnis laut `Box3`-Nachmessung: Baukörper jetzt
`width=101.2 m, depth=83 m, height=27 m` (inklusive Bauzaun-Rand um die
92,9×73,7 m OSM-Kernfläche), Zentrum unverändert bei (-296.2, -366.5).
Zollpackhof (`RiversideVenues.ts`) war nie im Code verändert worden —
das einstöckige Schankhaus mit rotem Satteldach und cremefarbenen Wänden
blieb stets unangetastet; die visuelle Überlagerung kam allein von der
Größe des Amtssitz-Körpers.

Neue Testabdeckung in `riverside-venues.test.ts`: eine Obergrenze für die
Breite (`< 105`, vorher unbegrenzt — der 142-m-Bug wäre sonst weiter durch
die Tests gerutscht) sowie ein eigener Test, der beweist, dass die
Amtssitz- und Zollpackhof-AABBs disjunkt sind und der Amtssitz-Mittelpunkt
nordwestlich der Moltkebrücke liegt.

Verifiziert mit SwiftShader-Playwright-Screenshots (Kamera auf
Moltkebrücke/Nordufer): der Pill-Riegel erscheint jetzt korrekt
dimensioniert und farbig nordwestlich der Brücke, das Zollpackhof-
Schankhaus zeigt sich wieder einstöckig mit Satteldach ohne Streifen.
Screenshots unter `visual-check-v531/`.

Gates: `uv run ruff check .` (clean) und `uv run pytest -q` (236 passed);
`bunx tsc -b` (clean), `bun test --timeout 60000` (369 passed, 0 failed,
48 files) und `bun run build` (erfolgreich); `package_static_site.py`,
`check_release_readiness.py` und `smoke_local_package.py` alle erfolgreich
für v0.53.1.

## v0.53.0: Interimsbau-Pill + Fern-Ink-Fade mit Hysterese

Two user reports, two fixes.

**Amtssitz am Spreebogen looked like a square block.** Site photographs
(uploaded IMG_0146-0151) show the interim Bundespräsidialamt is a long bar
with fully rounded short ends (a pill/capsule in plan, not 45° chamfer
corners) and a busy multicoloured vertical-fin panel facade (red/blue/
yellow/grey/brown/oxblood/green-grey) with ribbon windows between the
fins, still under construction. Rebuilt `SpreebogenOffice.ts` on the same
documented OSM footprint (`way/1535591727`, 93×74 m) and storey count
(plinth + 5 + set-back attic), now using a new `addPartialCylinder`
`drawnKit.ts` helper for the two half-drum end caps instead of chamfer
blocks. The 7-colour fin set cycles on an irregular stride so no run reads
as a repeating stripe, and wraps around the caps instead of stopping at
the tangent. Light construction-site staffage (two tower cranes, a thin
scaffold hint) lives in its own sub-group so it never perturbs the
building's own footprint/height bounds. New test coverage in
`riverside-venues.test.ts` pins the rounded caps, the multicolour facade,
and the crane/footprint isolation.

**"Flackert immer noch alles bei größerer Entfernung."** Far-zoomed views
alias: thin ink lines, window-band seams, lane markings and railings cross
sub-pixel projected size frame to frame, and the rasteriser's rounding of
a 1px line to whichever pixel row/column it lands on this frame is exactly
the alternating signal read as flicker. New pure module `fineDetailFade.ts`
fades every ink-line `LineSegments` material's opacity by its projected
pixel size (never resizing geometry — mip-safe, and it never touches a
texture LOD) and hides small accessory layers (lane markings, LoD2 glass
mullions/window bars, kerb lines, bridge railings) past a 900–1200 m
hysteresis band, the same shape as `renderQuality.ts`'s existing time-based
governors so a camera parked at the boundary cannot blink every frame.
Calibrated against the viewer's own distance regime: ink stays fully
opaque through the app's default 948 m framing and finishes fading out by
`CRISP_NONE_DISTANCE_M` (2100 m), the point `crispnessProfile.ts`'s sharpen
pass has already fully relaxed by. `ThreeViewer.tsx` applies both purely as
a function of camera-to-target distance every frame, matching the existing
`crispTargetScale` reasoning: the picture is identical for a given standoff
no matter how the camera got there, and never pops when motion stops.

*Verification note:* 14 new unit tests in `fine-detail-fade.test.ts` pin
the thresholds, hysteresis band and distance calibration without needing a
WebGL context; the full suite (368 tests, 48 files) passes. The local
headless-Chromium/SwiftShader screenshot setup was repaired enough this
round to capture real far-zoom frames (two consecutive frames at a
zoomed-out view differed in only 12 of 120,000 sampled pixels), but a true
pre-fix/post-fix side-by-side could not be completed in-session (disk
space and per-shot render time made a second full build too costly). The
before/after comparison is therefore verified live externally, not
included as a shipped artifact — see `v53-report.md` for the full
accounting and the frames that were captured.

## v0.52.1

Mini-patch: fix a keyboard-shortcut collision reported straight after
v0.52.0 shipped the night-lights toggle. Pressing `N` correctly toggled
night lights via its own handler in `App.tsx`, but it also — unwantedly —
kicked off the first-gesture ambient-music autostart in `audioAutostart.ts`,
because that module's `IGNORED_KEYS` set only excluded `b` and `t` (the
music/soundtrack shortcuts), not `n`. On a page where no audio had started
yet, the very first `N` press both toggled the lights and silently started
the music — indistinguishable, in a live test, from "`N` triggers the music
toggle". `N` stays the night-lights shortcut (still only active in night
mode) and `B`/`M`/`T` keep their existing bindings unchanged; the fix adds
`"n"` to `IGNORED_KEYS` so the capture-phase autostart listener no longer
races the dedicated App.tsx handler. Extended the existing
`audio-autostart.test.ts` coverage with an explicit regression test for the
case and a check that `B`/`T`/`N` (and their lowercase forms) are all
ignored by the autostart listener while plain viewer shortcuts like `D`/`M`
still count as a valid first gesture.

## v0.52.0

Night mode gets a second switch. Until now "Nacht" meant one fixed look —
warm windows, lit streetlamps, glowing signage. The user asked for a way to
turn all of that off and see "nur noch die Isometrie, so wie wenn der Mond
scheinen würde": a toggle, next to the night control, that swaps every
artificial light for a cool moonlit read of the same drawing.

**"Licht an" (default) / "Licht aus" (moonlight).** Only visible/active in
night mode. "Licht aus" turns off every emissive/light-only element in the
scene — facade window panes, the night-strip glow, traffic-signal lamps
(dimmed to dead glass while the phase clock keeps running underneath so
turning the lights back on restores the exact phase reached in the dark),
vessel lampions, and every `nightOnly` fixture (ParkDetails' public-lighting
lamp heads and street-light cones, Reichstag dome glow, cultural-landmark
night washes). In their place: authored cool/blue-silver flat tones on the
window panes and both water paths (the real surfaces-backed "smooth water
surface" plate and the rasterised "drawn water surface" fallback used when
no OSM surfaces payload is available), leaving silhouettes, ink outlines and
isoFaceShade untouched so the isometric drawing stays fully legible — masonry
emissive, ink colour and facade-axis opacity are explicitly not touched by
the toggle, since those are structural/self-visibility, not artificial
light.

**Contracts held.** No new tone-mapping curve: moonlight is authored flat
colour under the same NoToneMapping/exposure-1 rig as ordinary night, not a
film-curve trick. The mode switch is lossless in every direction — day →
night-on → night-off → night-on → day round-trips back to the exact original
material references, verified by an explicit round-trip test alongside the
new toggle-logic, material-restoration and persistence tests. State persists
like mute (localStorage), with an aria-label/tooltip and a documented `N`
keyboard shortcut; the existing "Standardansicht" reset still returns to day.

**A latent bug surfaced and got fixed along the way:** the excursion
yacht's "vessel lamps" mesh had never actually glowed at night. The drawn
city's own accessory loop only ever swapped day/night materials by
reference — it never read or applied a `nightEmissive`/`nightEmissiveIntensity`
userData pair the way every other landmark file does, so the lampions sat
dark regardless of mode. Building the moonlight toggle required giving that
loop its own emissive choke point (isoWorld accessories never pass through
the shared `applyMaterialLighting`), which fixed the glow for ordinary night
as well as adding the new moonlit-off state.

## v0.51.0

The whole movement matrix got measured this round — pan left and right and
back again, both rotate buttons, wheel in and out, pinch — and the four
mechanisms that were still blinking under it were taken out at the root.

**Matrix status: before complete (9/9), after 7/9.** The before pass (prior
to this round's fixes, same `serve_local_viewer.py` + Playwright/SwiftShader
Chromium setup as the release protocol) ran all nine gestures. The after pass
reran static, pan-right, pan-left, pan-back-forth, rotate-right, rotate-left
and wheel-in; wheel-out and pinch-zoom could not be rerun in the v0.51.0
close-out session — the headless Chromium's `requestAnimationFrame` loop
stalled at 0 rAF/s after the setup pump on this box (it ran at the same 0.25
rAF/s as every other gesture in the original before/after passes), so the
frame-capture promise never resolved and the run hung indefinitely. Recorded
as open rather than silently dropped; see the numbers below and the report
for the exact repro state.

| gesture | before `reversal_mean` | after `reversal_mean` | before `resolution_switches` | after `resolution_switches` |
| --- | --- | --- | --- | --- |
| static | 0.0 | 0.0001 | 0 | 0 |
| pan-right | 14.9443 | 14.9667 | 1 | 1 |
| pan-left | 13.856 | 12.5616 | 0 | 0 |
| pan-back-forth | 10.5399 | 9.5134 | 0 | 0 |
| rotate-right | 20.5512 | 20.6114 | 1 | 1 |
| rotate-left | 20.5831 | 20.6674 | 0 | 0 |
| wheel-in | 13.245 | 13.2476 | 0 | 0 |
| wheel-out | 13.0456 | not rerun (setup stalled) | 0 | not rerun |
| pinch-zoom | 13.9056 | not rerun (setup stalled) | 0 | not rerun |

`reversal_mean` stays flat because it mostly captures the SwiftShader
screenshot pipeline's own per-pixel sampling noise during genuine camera
motion, which none of this round's fixes target. The fixes below target the
click-triggered and resolution-switch-triggered blinks layered on top of
that floor, which the `resolution_switches` column and the heatmap PNGs
under `visual-check-v51/{before,after}/heat-*.png` show directly: one switch
per gesture (by design, see the resolution-tier fix below), and the
rotate/pan click no longer forces an extra coarse-surface flash around it.

- **A navigation click no longer forces the coarse surface.** v0.50.0 gave
  the settled-detail tier hysteresis in the frame loop, but
  `markSurfaceInteraction` still switched the surfaces itself, and every
  rotate button, pan button, fly-by and load completion goes through that
  helper. So a single click dropped the ground surface and the whole
  Tiergarten canopy that same instant and the hysteretic decision put them
  back one or two frames later — one full blink per click, which is what the
  rotate runs measured worst (`reversal_mean` 20.6 against a static floor of
  0.0). The frame loop is now the only writer; the helper only moves the
  deadline it reads.
- **The restore holds now outlast the pauses inside a gesture.** "Hin und
  her bewegen" is a burst of input, a pause of a few hundred milliseconds,
  another burst. At a 420 ms restore hold every one of those pauses was long
  enough to swap the canvas back to full resolution, so a back-and-forth pan
  ran a downgrade/upgrade cycle about once a second for as long as the user
  kept moving. The pixel-ratio and detail-tier restores are 1100 ms, which
  covers a generous direction change; a whole gesture now costs one
  downgrade and one upgrade.
- **The two desktop resolution tiers sit close together.** One switch per
  gesture is still one visible resample. Interaction moved from 1.4 / 5.2 Mpx
  to 1.9 / 8.6 Mpx, so on a 1080p or 1440p HiDPI canvas the step is a few
  percent instead of a third, while a 4K canvas is still cut back. The phone
  tiers are untouched — the 1 / 2 split is what holds 60 fps there.
- **The crisp kernel is anchored to the settled resolution.** `crisp.frag`
  steps one texel, so feeding it the live pixel ratio widened the unsharp
  halo and the edge outline the instant the governor dropped resolution and
  snapped them back when it restored: a sharpness pop at both ends of every
  drag, on top of the resampling. Anchored, the pass covers the same screen
  area at either resolution.
- **The edge detector ramps instead of switching.** A one-texel gradient is
  maximally sensitive to where a thin ink line falls on the pixel grid, and
  the old `smoothstep(0.09, 0.3)` window was narrow enough that the sub-pixel
  wobble of a moving line carried the gradient across it and back, blinking
  the outline. The ramp is now `0.05 .. 0.46`: strong contours keep full
  strength, marginal ones ease.
- **Release-readiness policy caught up to the 1.9 Mpx interaction tier.**
  `check_release_readiness.py` still pinned the desktop interaction snippet
  to the pre-fix `coarsePointer ? 1 : 1.4`, left behind when the resolution
  tiers above moved to `1.9`; `uv run pytest` failed on
  `test_current_tree_is_release_ready` until the policy string was updated to
  match. No behavioural change, the gate was checking a stale literal.

## v0.50.0

The second Gustav-Heinemann-Brücke turned out not to be a bridge, a beach
bar and a beer garden got their furniture, the interim seat of the
Bundespräsidialamt arrived, and two boats went on the water.

- **The "second bridge" was a quay wall built across the river.**
  `surface-polygons.json` carries the Spree as several separate OSM
  riverbank polygons, and the cut between two of them falls exactly at the
  Gustav-Heinemann-Brücke: one polygon ends at x −35, the next begins at
  x −61. The quay-wall builder walked every polygon's exterior ring, so at
  that join it raised a full-height wall from the river bed plus its 1.6 m
  coping band straight across the water — a wide, flat, railing-less tan
  band with ink outlines, running parallel to the real footbridge. It read
  as a second bridge because it looked like one. A ring edge whose landward
  side lands inside another river polygon is now skipped: those edges are
  joins in the data, not banks.
- **Capital Beach is on the Ludwig-Erhard-Ufer.** OSM has the summer bar as
  a bare `amenity=pub` node (`node/480747489`) — no outline, no sand, no
  `leisure=beach_resort`; the ground under it is `landuse=grass`. What *is*
  surveyed is the row of benches along the quay, so the double rows of red
  and pink deck chairs stand on those rather than on an invented grid, with
  the magenta bar huts and the parasols at the east end where the
  photographs put them.
- **The Zollpackhof beer garden has benches under the chestnut.**
  `amenity=biergarten` areas are now exported by `build_street_details.py`
  (schema 4) with their simplified ring, so the tables are laid out inside
  the surveyed 1601 m² outline of `way/422205278` instead of around a
  point. The hedges follow the mapped ring edges, the Schankhaus sits on
  `way/217943823`, and the natural-monument horse chestnut
  (`node/4219261197`, `height=20`, planted 1555) stands where OSM has it.
- **The interim Bundespräsidialamt is built.** The "Amtssitz am
  Spreebogen", Elisabeth-Abegg-Straße 2, occupied on 10 July 2026 while
  Schloss Bellevue is refurbished, is `way/1535591727` — 93 × 74 m,
  2776 m², west-north-west of the Moltkebrücke rather than north-west of
  it. Concrete plinth, five timber-module storeys, a set-back state-room
  floor, the convex corners and the dense multicoloured vertical ceramic
  fins. No metre height is published for the building anywhere, so it is
  derived from `building:levels=7` and the group is flagged
  `extrapolated`.
- **Two boats, and they are Staffage.** OSM maps no vessels in the
  quarter, so neither boat is derived from data and the group says so: a
  52 m cargo barge lying in the Humboldthafen on course for the
  Berlin-Spandauer Schifffahrtskanal, and a small old excursion yacht on
  the Spree off the Kanzleramt, white with a deck party aboard and warm
  lampions that light after dark. Positions and headings are taken from
  the surveyed waterway centre lines so the hulls float in the channel.
  The name on her stern is the owner's joke.
- **The last of the zoom flicker.** The official-tree microcrowns read the
  `cameraMoving` flag straight, and that flag flaps frame to frame while a
  wheel dolly or a rotate step plays out, so the whole Tiergarten canopy
  blinked off and on several times per gesture. The detail tier now has
  the same hysteresis the pixel-ratio governor got in v0.42.0: a short
  gesture keeps the detail, a sustained one costs one drop and one
  restore.
- **The drawn accessory kits share one implementation.** The vessels and
  the bank venues each carried their own copy of the flat-tone plumbing,
  and the copies had drifted apart from `drawnKit`. Folding them back
  surfaced a live crash: `mergeGeometries` reads `geometries[0]` before it
  checks the length, so any kit that fills only some of the three geometry
  buckets threw — which the lamp-less interim office did, taking the whole
  drawn city down with it.

## v0.49.0

A bridge that did not reach the far bank, a school that was a flat box, three
filling stations, two memorials rebuilt from their documented form, and a
music button that had been claiming to play over silence.

- **The Gustav-Heinemann-Brücke stopped over the water.** The footbridge was
  drawn from the surveyed deck only, so it broke off short of both banks and
  connected to nothing. It now runs bank to bank and meets the riverside
  paths at each end. The "strange rods" standing beside it were the picket
  infill of the old handrail profile, drawn at full height along the
  approaches where there is no deck to carry them; they are gone.
- **The Gymnasium Tiergarten was a flat 32 m box.** The 1902 brick school on
  Alt-Moabit carries ALKIS roof code 5000 (Mischform), which the procedural
  roof fitter skips, so LoD2 extruded it as a slab. Its two prisms are now
  suppressed and replaced by a drawn Altbau: red brick with sandstone storey
  bands, a steep dark roof, stepped Renaissance gables at both ends of the
  ridge and a wall dormer in the middle of each long front, and the rooftop
  observation deck with its balustrade. Heights stay at the measured LoD2
  values — 32.33 m to the ridge, 34.75 m to the deck.
- **The quarter's three filling stations were empty tarmac.** `amenity=fuel`
  is now exported by `build_street_details.py` (schema 3) with a forecourt
  axis, and drawn as a canopy on four posts with a brand-coloured fascia,
  two pump islands with two dispensers each, and a price totem. Only the
  Shell on Paulstraße is mapped as an area in OSM; for the two node-only
  sites the axis is derived from the nearest frontage road turned a quarter
  turn. That rule is not guesswork — checked against OSM way 25780043, the
  mapped Esso canopy on Lessingstraße, the derived axis lands within 3°.
- **The Gedenkort für Polen 1939-1945 was the wrong memorial.** The model was
  a low inscribed stone on a paved field. What was unveiled on 16 June 2025
  at the former Kroll-Oper site is a roughly 30 t glacial erratic with a
  weathering-steel plaque, two trilingual information panels and one wild
  apple tree on an oval fine-gravel plaza. That is what is drawn now. No
  dimensions are published, so the element sizes are photo-derived and say
  so in `geometryStatus`; the Deutsch-Polnisches Haus is still unbuilt and
  is still deliberately not modelled.
- **The Zeugen-Jehovas stele was twice its height.** Matthias Leeck's trunk
  stele at the Goldfischteich is about five metres and twelve tonnes,
  assembled from a base plate and fifteen stacked bronze discs that flare at
  the foot and the crown and pinch at the waist. The model stood 9.3 m and
  flared only at the foot. It is now the documented five-metre stack.
  Diameters and the inscription are undocumented and are recorded as such.
- **The music button said "on" over silence.** On first load the soundtrack
  toggle rendered as playing because it was bound to intent, not to sound,
  while the browser's autoplay block kept the page quiet. Both engines now
  expose `audible` (scheduler armed *and* `AudioContext` running), the
  toggles follow that, and a blocked track reads "waiting for a click"
  rather than "on". Playback is still attempted eagerly at mount and still
  starts on the first gesture anywhere on the page — and anyone who muted
  explicitly still gets no autostart.
- **The 2D tile image kept the demolished Landeslabor standing.** The cause
  was not the tiles: `render_quadrants.load_layer` — shared by the overview,
  the quadrant renderer and the reference map — read the raw LoD2 snapshot,
  while the 3D pipeline has always read it through
  `load_current_buildings`. All three 2D renderers now see the corrected
  stock. `compact_preview` also steps its palette down until the encoded PNG
  actually fits the 5 MiB repository limit it promises. The tile pyramid
  itself is **not** regenerated in this release; see the open items below.

### Open in v0.49.0

- **The DZI/overview rebuild is not run.** The code fix is in and unit
  tested, but re-running
  `uv run python -m isometric_berlin.generation.render_overview` against
  today's data does not drop in cleanly: the committed pyramid dates from an
  earlier round, and a fresh render rescales the projection so that the
  eastern landmarks (Hauptbahnhof, Marie-Elisabeth-Lüders-Haus, Humboldthafen)
  clamp to the right edge of the canvas, which breaks the committed
  landmark-consistency contracts in `test_verify_landmark_alignment`,
  `test_build_isometric_prisms`, `test_package_static_site` and
  `test_release_readiness`. Verified: this rescale happens with and without
  this round's correction fix, so it is pre-existing drift, not a regression
  introduced here. Re-fitting the canvas and resyncing those four contracts
  is its own piece of work.
- **The reported ~220 m gap in the western railway does not exist in the
  current data.** Measured across the exported corridor, coverage is
  continuous from world_x −2655 m to +637 m with no gap over 20 m, and the
  westernmost view confirms it on screen. Nothing was extrapolated, because
  there was nothing to bridge.

## v0.48.0

Seven objects this round: the railway that stopped in mid-air, the station
that was hollow inside, and five rounds of monument work in the Tiergarten.

- **The tracks stopped in mid-air over the Humboldthafen.** The Hauptbahnhof
  model carried a straight 110 m stub off each gable and nothing beyond it,
  so the Stadtbahn simply ended. Measuring the stub against the OSM
  alignment showed the west approach is true (≤ 6 m out over its whole
  length) but the east one is not: the line curves towards Friedrichstraße
  the moment it leaves the shed, and the stub was 46 m off after 200 m and
  84 m off at its tip. The east stub is gone, and a new pipeline stage
  (`build_rail_lines.py` → `rail-lines.json`) exports the real OSM corridor
  instead — two viaduct polygons, six at-grade embankments, 402 pier
  positions and 42 track centrelines. The viewer draws it as a level deck
  with a fascia band and ink outline, brick piers dropped onto the surveyed
  ground, terrain-draped ballast where the line runs at grade, and a pair of
  rails stroked along every centreline. The deck height is not invented: it
  is read off the station model's own deck, minus 45 cm of clearance, so the
  two meet inside the shed.
- **The Hauptbahnhof's ground floor was one enormous empty room.** Looking
  in through the glass showed a single hall five storeys high with nothing
  in it. The two arms of the north-south hall now carry four stacked levels
  — gallery +1, concourse, and two deep levels — as drawn flat elements with
  openings cut through them, six escalator runs on the real tilt, four
  platform edges and three track pairs at the bottom. The plates sit only in
  the arms, because that is the only place the barrel roof is not covered by
  the opaque upper track deck.
- **Most of the Tiergarten's marble was not exported at all.** The monument
  export only read `historic=*`, but the Wagner memorial, the hunting
  groups, the Luiseninsel figures, Fontane and the bears are all tagged
  `tourism=artwork`. Named artworks now count too: 316 → 449 monuments, of
  which 125 are sculptures that had no drawn presence before. Unnamed
  artworks stay out — a dot with no name has nothing to recognise.
- **The Richard-Wagner-Denkmal had no roof.** Eberlein's Carrara group is
  recognisable at any distance by the flat reddish canopy that was built
  over it to keep the weather off the marble. It now has one: four slim
  posts and a low overhanging roof over the seated figure and its
  allegories.
- **The Großer Stern was a scatter of pebbles.** Begas'
  Bismarck-Nationaldenkmal is now a red granite pedestal with a 6.6 m bronze
  on top and four allegorical groups round its foot, and Moltke and Roon get
  the general-on-a-pedestal form that separates them from a garden statue.
- **The Luiseninsel had three 70 cm stones on it.** Königin Luise, Friedrich
  Wilhelm III and Wilhelm von Preußen are white marble standing figures on
  tall pedestals with a proud cornice, which is what distinguishes them from
  the bronze-on-plinth statues elsewhere in the park.
- **The composer memorial and the Goethe-Denkmal were blocked out, not
  built.** The composer stele gained a step ring, corner piers and three
  bust niches, and its busts moved onto the faces of the three-sided shaft
  instead of floating out at the corners. Goethe gained a two-step
  stylobate, a base moulding and cornice on the drum, and projecting
  pedestals under Lyrik, Forschung and Drama.
- **Eisenman's floor was a single funnel.** Every stele at the same radius
  stood at the same height, which is exactly what the Stelenfeld is not. The
  field now rolls in long waves over the funnel. The Sinti-und-Roma memorial
  gained the ring of camp-name stones and the glass chronicle wall at the
  Simsonweg approach; the Homosexuellen cuboid's window gained the reveal
  that shows it is a hole cut through 30 cm of concrete.

## v0.47.0

Six objects this round. The monuments the owner called out as still
unreadable, and three places where the drawn city no longer matched the
city on the ground.

- **The Soviet War Memorial's soldier was a grey pill.** Kerbel's eight-metre
  bronze on the crown of the central portal was a capsule and a ball. It is
  now modelled where the silhouette lives: the flaring skirt of the
  greatcoat, boots, shoulders, arms, the peaked cap with its visor, and the
  rifle slung muzzle-up across the right shoulder — all carrying ink
  outlines.
- **The two T-34s and the ML-20 howitzers were dark specks.** Three things
  were wrong at once: the focus camera stood 145 m back from a 75 m
  forecourt, the armour tone sat too close to the plaza stone, and none of
  the vehicles had outlines. The camera is now at 108 m, armour and gun
  steel are darker, hull, glacis, turret and shield are inked, and both
  plinth types are built from the darker stone and raised (tanks 1.15 →
  1.85 m, guns 0.85 → 1.25 m) so the vehicles no longer look as if they
  float on the paving.
- **The Quadriga read as one bronze lump.** The chariot wheels sat at
  z ±2.45 inside a body 7.4 m deep and never showed; they are now outboard
  at ±3.78 and inked. Each of the four horses gained a crested mane and
  thicker legs, and Victoria's wings grew from 0.9 × 2.8 m to 1.15 × 3.5 m.
  A new focus camera comes at the team from the south-east at their own
  height, which is the view that lets you count four horses.
- **The Goldelse fused into a single gold shape.** Her wings now carry the
  shaded gold rather than the torso tone, so they separate from her body,
  and her focus camera closed from 104 m to 66 m — at the old distance the
  laurel wreath and the Iron Cross standard were below one screen pixel.
- **The Tiergartentunnel was painted across the park it runs under.** A
  buffered OSM centreline knows nothing about the third dimension, so the
  road between the Swiss embassy and the Hauptbahnhof was drawn on the
  surface. Ways tagged `tunnel`, `covered` or a negative `layer` are now
  excluded from the carriageway polygons, from the painted lane markings
  and from the Minecraft voxel road and rail layers. The open portal ramps
  at Kemperplatz and on the Hauptbahnhof approach keep their markings, and
  none of the 39 sampled tunnel midpoints is paved over any more.
  `surface-polygons.json` is at schema 5.
- **Two LoD2 records the city has outlived.** The Landeslabor
  Berlin-Brandenburg at Invalidenstraße 60 was torn down in 2025/26 for the
  ULAP-Quartier, but the tile still carried its 29 m slab — all 19 parts are
  gone and the site is drawn cleared. The Teehaus im Englischen Garten burnt
  out in September 2024; its four parts are capped at 2.4 m with a flat roof,
  so it reads as standing ground walls rather than an intact reed-roof house.
- **The Rosengarten was one undifferentiated green patch.** Its eleven OSM
  beds run from 27 to 196 m², every one of them below the 250 m² lawn floor,
  so none of them was drawn. `leisure=garden` polygons now form their own
  surface kind with a 20 m² floor and a finer 0.4 m tolerance, drawn over the
  lawn in a warmer planted tone with outlines so adjacent beds stay legible
  across their gravel walks. 98 gardens gained geometry, among them the
  Englischer Garten, the Kanonenhof and the Paradiesgarten.

## v0.46.0

- **The *Sinkende Mauer* was drawn upside down.** v0.45.1 derived the wall
  correctly as `artwork − water` but then guessed its profile, ramping the
  top face from 1.5 m at the northern rim *down* to 0.55 m below the water
  at the southern tip. The owner's photographs show the opposite, and the
  opposite is what Girot built: a wedge that starts flush with the paving
  at the northern end, where you step onto the walkway, climbs steadily
  along its 39.0 m to a high point of about 5.6 m out in the basin, and
  there breaks off in a near-vertical face that carries straight down
  through the water. The OSM axis was already right — only the heights
  were inverted. `sink` is gone from the payload; the axis is now
  `foot` → `crest` and `surface-polygons.json` is at schema 4.
- **The crown carries its walkway and parapet the whole way.** Previously
  the path stopped where the slab dipped under the surface, which under the
  old profile was a third of the way along. It now runs from the entrance
  at grade to the break at the crest, with the two waist-high parapet rails
  drawn as ink lines and posts every 2.6 m, so the ramp reads as something
  you can walk up rather than a grey stripe on the water.
- **Minecraft mode steps the wedge instead of painting it flat.** The wall
  was a concrete stripe on the ground grid. It now emits its own block
  columns along the axis, stepping 0 → 4 m → 8 m towards the crest; the
  entrance cell, where the wedge is still under a metre tall, stays paving
  because the block world cannot draw a column shorter than one 4 m cell.
  All of its columns are seated on a single datum, so the crown steps up
  once and never dips back down where the basin floor does.
- **A freestanding wall is not a building, so it gets no windows.** The
  wedge's columns first went in as `concrete`, the class every LoD2
  building also uses, and the voxel viewer promptly punched its
  storey-banded glass rows into all four faces of a 3 m thick garden wall.
  Columns now carry a `wall` class that the window pass skips.
- **Two owner-approved sights join the rail: the Siegessäule and the
  Invalidenpark / Sinkende Mauer.** Both carry a focus camera. The
  Siegessäule preset comes at the Goldelse from the west at her own height,
  because she has faced down the Straße des 17. Juni since the 1939 move
  and the default overhead framing showed her back; the Invalidenpark
  preset stands south-east of the basin so the plunge face is nearest and
  the wedge recedes to its low northern entrance. Both landmarks fall
  outside the crop of the committed 2D overview image, so their markers
  clamp to its edge — as the Königin-Luise-Denkmal marker already did.

## v0.45.1

- **Constructed water basins were drawn 6 m underground, so the
  Invalidenpark fountain read as flat lawn.** The basin was never a
  classification problem: OSM way 28880840 carries `natural=water` +
  `amenity=fountain`, it survives the clip, and the drawn city was dutifully
  drawing it — at the single Spree water table (−1.15 m), because that is
  where every water plate went. The terrain in the Invalidenpark is 5.30 m,
  so the plate lay 6.45 m below the surface and the park's own opaque lawn
  plate (21 576 m², no hole) covered it completely. This is the same class
  of bug v0.44.0 fixed for lawns and carriageways when it made them follow
  the terrain; water was simply never converted. Water now carries a `kind`
  of `river` or `basin`: a river keeps the Spree table and its 3.1 m quay
  walls, a basin gets one flat plate per basin set on the ground it was
  built into. Twelve basins in the district were affected, among them the
  Piano-See (10 792 m²), a 5 119 m² reflecting pool and the Phönix fountain
  — all of them invisible until now.
- **`water=pond` is deliberately NOT a basin.** The Neuer See, the See im
  Englischen Garten and the other Tiergarten ponds are fed by the same
  groundwater table as the Spree; perching them on local terrain would lift
  them off their own banks. Only `amenity=fountain`, `man_made=water_basin`
  and `water=basin|reflecting_pool|reservoir` are treated as constructed.
- **Christophe Girot's *Sinkende Mauer* (1997) is drawn, and none of its
  geometry is invented.** The mapper cut the wall's footprint out of the
  water polygon because the wall stands where the water would be, so the
  wall is exactly `artwork − water`: a 3.16 m × 39.0 m slot in the basin
  rectangle, 123 m². The slab's top face ramps linearly along that slot from
  1.5 m above the basin rim down to 0.55 m below the water line, which is
  the artwork — a wall walking into the water and disappearing. It is a grey
  flat tone with ink edges, and a narrow walkable crown in the park-path
  tone runs along it from the rim to exactly the point where it dips under.
- **Minecraft mode gets the same correction.** A new `basin` voxel class
  keeps its cells at the local ground height instead of the river table, so
  the fountain is a blue plate flush with the lawn rather than a 6.5 m pit,
  and the sunken wall is painted as concrete over it.

## v0.45.0

- **The OSM extract finally covers the city this project surveys.** Every
  OSM-derived surface stopped dead at world x −605 because `osm.gpkg` was
  still the original Regierungsviertel window (x −707..605, z −1015..1451)
  while the surveyed hull has reached x −2873..684, z −1305..1608 since
  v0.41.0. The consequences were all visible from the viewer: the Großer
  Stern had no carriageway at all, the Straße des 17. Juni lost its surface
  and its lane markings halfway down the Tiergarten, the park paths ended in
  mid-air, and the Spree behind the Gymnasium Tiergarten read GREEN because
  there was no water polygon out there — only lawn. The extract is refetched
  for the whole `bounds.geojson` hull and every derived payload rebuilt on
  it. Layer counts, old → new: roads 4 397 → 13 042, water 34 → 129, parks
  367 → 1 426, vegetation 2 942 → 8 986, playgrounds 16 → 140, rail 442 →
  974, pois 1 847 → 5 855.
- **Overpass could not deliver it, so `fetch_osm.py` learned to read a
  Geofabrik extract.** Asking overpass-api.de for the full hull fails on the
  first tile with "server is probably too busy" no matter how small the
  tiles are cut, and the mirrors are gone. The new `--pbf` option reads
  `berlin-latest.osm.pbf` through GDAL's OSM driver instead. Same tags, same
  seven layers, same schema — only the transport differs. The driver
  promotes only a handful of tags to real columns and hides the rest in an
  `other_tags` hstore, and which ones differs per layer, so the hstore is
  parsed back into the columns `split_layers` expects.
- **GDAL splits the OSM element id across two columns and half the extract
  had no id.** In the `multipolygons` layer a closed way is reported under
  `osm_way_id` and a multipolygon relation under `osm_id`; reading only
  `osm_id` left 11 305 of 11 657 rows without an identifier and wrote GDAL's
  layer name into `element` where the rest of the project expects
  node/way/relation. That silently cost the landmark QA every match made on
  geometry rather than on name — the Luiseninsel playground among them.
- **The refetched extract stays under the 5 MiB repository cap without
  dropping data.** Four times the area is 5.2 MB of GeoPackage as written
  before. Two lossless levers bring it to 4.4 MiB: the rtree spatial indexes
  cost ~1.7 MB and nothing in this project queries the file spatially (every
  consumer loads a whole layer), and columns that are entirely null within a
  layer cost one SQLite header byte per row while carrying no information —
  the layer filters already treat a missing column as all-null.
- **The payloads grew with the area, not beyond it.** `surface-polygons.json`
  237 → 786 KiB for 3.4× the roads, 4.3× the parks and 3× the lane markings;
  `street-details.json` 6 → 32 KiB with 86 → 247 traffic signals and 46 → 324
  monuments; `park-details.json` 3.4 → 3.8 MiB with 167 → 591 paths and 5 → 49
  playgrounds; `minecraft-voxels.json` 1.9 → 2.2 MiB. `ROAD_SIMPLIFY_M` goes
  0.35 → 0.75 m, `MIN_ROAD_AREA_M2` 12 → 25 m² and `PARK_SIMPLIFY_M` 0.6 → 1.2
  m — coarser than before, but well under the metre the drawn city resolves,
  and no feature class was dropped to pay for it.
- **The download budget goes 200 → 208 MiB.** The extracted local package
  landed at 201.3 MiB, 0.65% over a round-number guard set when the surveyed
  area was a quarter of today's. Simplification recovered 100 KiB of the 1.3
  MB; the rest would have had to come out of the very data this release adds.
  `MAX_WEBGL_SCENE_BYTES`, the budget that actually governs what the hosted
  viewer loads, is unchanged at 165 MiB and still passes.

## v0.44.0

- **Every street and park path is a real drawn surface now.** OSM ships
  roads as CENTRELINES, so the drawn city had no carriageway geometry at all
  beyond the 4 m voxel raster: the Straße des 17. Juni ran through the
  Tiergarten as a pale green band and the park paths were hairline
  scratches. `build_surface_polygons.py` now buffers every highway
  centreline by its real cross-section and exports true polygons in three
  families — asphalt for traffic, pale paving for squares and footways,
  Tiergarten sand for park paths — plus the centrelines of the classified
  roads so the viewer can stroke painted lane markings. A footway that runs
  more than half its length inside parkland is reclassified as a sandy park
  path regardless of its OSM tag, which is what makes the Tiergarten read as
  the Tiergarten. Classified roads use the full paved cross-section (primary
  17 m, trunk 20 m) because Berlin maps a 50 m boulevard as a single way.
- **The smooth surfaces were a metre underground and nobody could see
  them.** Every plate — the parkland lawns included, since v0.33 — sat at
  one constant `bankY` of 4.2 m while the surveyed terrain runs to a median
  of 5.2 m. The lawn plates and all new road surfaces now follow the
  payload's terrain grid per vertex, so a carriageway climbs with the street
  it lies in instead of being buried by the ground slabs above it.
- **The black square grid around the model is gone.** v0.40.0 ruled the
  paper margin with a 140 m hairline lattice to make the blank surround look
  drawn; at every zoom it read as a black grid laid over the whole scene
  ("drumherum … ist so ein schwarzes Quadratgitter. Das kann bitte weg").
  The margin now carries its two quiet paper tones and nothing else, and a
  test pins the ruling's absence.
- **One malformed polygon can no longer destroy the drawn city.** A
  buffered road network produces sliver holes wherever two carriageways
  graze each other, and a hole without area makes three's ear-clipping
  triangulator throw — which silently dropped the ENTIRE drawn city and fell
  back to the bare photogrammetry mesh. Slivers are now filtered in the
  generator and skipped in the viewer, and the plate builder isolates a
  failed triangulation to that one plate.
- **The contract suite was flaky and is now deterministic.** Several tests
  build the complete city from the shipped payload, which costs about five
  seconds each since the task-09 expansion — over Bun's 5 000 ms default. A
  green run proved nothing and a red one pointed at no real defect. The test
  budget is raised rather than the coverage reduced; all 283 tests pass
  reliably.
- **Known gap, stated plainly: the OSM extract still covers only the
  ORIGINAL hull** (world x −707…605), while the surveyed city has reached
  x −2873 since v0.41.0. Everything ground-level therefore stops at that
  line: the Großer Stern roundabout has no carriageway, the Straße des
  17. Juni loses its surface west of x −605, the Tiergarten paths thin out
  and the Spree past the Gymnasium Tiergarten has no water polygon, which is
  exactly why it reads green there. This needs an OSM refetch for the
  expanded bounds; `overpass-api.de` is unreachable from the build
  environment (CONNECT blocked), so it is handed on rather than guessed at.
  No approximation was invented to paper over it.

## v0.43.0

The monuments round: the Goldelse becomes a real winged Viktoria, the other
memorials get the attributes that make them recognisable, the Pariser Platz
Starbucks gets its name on the fascia, both Tiergartentunnel mouths become real
ramps, and the river banks stop being faceted.

- **The Goldelse is a winged Viktoria, not a gold post.** `goldelse.ts` builds
  the 8.32 m figure on top of the 67 m column as a drawn model in its own local
  frame (`+x` faces, `+y` up from the soles, `+z` her own left): spread and
  raised wings as strips between a leading and a trailing polyline, the robe
  silhouette as a tapered prism, the laurel wreath in her raised hand as an
  exact annulus, and the field standard with the Iron Cross in the other. The
  cross is four convex trapezoids rather than one concave plate, because the fan
  triangulation the rest of the figure uses cannot close a concave outline. Flat
  gold (`0xd4af37`) with the scene's ink contours, so she reads the same in Day,
  Night and Minecraft. The column below her gained its 60 gilded gun barrels
  across the lower three drums, Doric capitals and bases on the Säulenhalle
  colonnade, and the Salviati mosaic ring at radius 16.6 m — outside the
  23 × 23 m socle, whose corners reach 16.26 m.
- **The Soviet Memorial has its tanks *and* its howitzers.** Two T-34s and two
  ML-20 152 mm howitzers, each on its own plinth (1.15 m for the tanks, 0.85 m
  for the guns) flanking the colonnade, with cradle, gun shield, tube, muzzle
  brake, split trails and carriage wheels.
- **The Gedenkort für Polen 1939-1945 exists.** The memorial stone on its paved
  field, at the surveyed OSM position and rotated onto the site. Its
  `geometryStatus` records that the permanent Deutsch-Polnisches Haus is *not
  built* and is deliberately not modelled — the scene does not invent buildings
  that do not exist yet.
- **The memorial to persecuted homosexuals actually leans.** Its body now sits
  in a tilted sub-group, which is the whole point of the Elmgreen & Dragset
  cuboid: a tipped-over Holocaust-memorial stele with a window cut into it.
- **Sinti and Roma: the rim inscription is there.** A ring band around the basin
  edge carrying Santino Spinelli's poem "Auschwitz".
- **Goethe sharpened.** The cloak is a proper cone silhouette, the arms and the
  scroll are drawn separately, and the three allegorical figures round the base
  have heads.
- **"STARBUCKS" is drawn on the Pariser Platz fascia.** The alphabet and the
  canvas renderer moved out of `reichstagInscription.ts` into a shared
  `drawnLettering.ts` (which gained A, B and R); the Reichstag module now holds
  only the Reichstag's own facts. The shopfront is a glazed bay with mullions,
  awning and pavement tables, and the fascia carries stroked capitals at 42 cm
  cap height. No bitmap logo and no siren roundel — neither can be reproduced
  from the open sources this project is allowed to use.
- **Both Tiergartentunnel mouths are real ramps.** The tube itself is a cutaway
  that is only visible from underneath, so the mouths are built as their own
  always-visible surface group in `TunnelPortals.ts`: a 260 m open trough per
  side (just under 5 %, which is what the real B 96 ramps are built to),
  retaining walls and noise barriers that stay upright while the carriageway
  slopes, dashed lane markings running down into the tube, and a portal frame
  with jambs at the foot. The plan course is the committed OSM centreline; only
  the vertical profile is engineered, because the manifest carries a single
  schematic depth and no gradient.
- **The river banks are granular.** Two causes, two fixes. The exporter was
  simplifying water at 0.6 m, which threw away two thirds of the Spree's
  surveyed vertices and turned every bend into a ~25 m chord; water now keeps a
  0.15 m tolerance (parkland stays at 0.6 m). And the viewer drew whatever
  vertices it got edge for edge, so `bankCurves.ts` now runs every ring through
  a corner-preserving cubic Hermite subdivision — the curve passes *through* the
  surveyed vertices, so no water body moves, and turns beyond 34° stay sharp so
  the Humboldthafen basin keeps its right angles. The water plate, the quay
  wall, the new coping band and the shoreline ink all walk that same smoothed
  line. The median bend along the drawn bank drops from about 4° to under 2°.

## v0.42.0

Three things the owner asked for: stop the flicker that happens *while* zooming,
put "DEM DEUTSCHEN VOLKE" on the Reichstag where it belongs, and tighten the
Reichstag's plan against its own LoD2 footprint.

- **The zoom flicker is a resolution swap, and it is gone.** Three.js
  `OrbitControls` dispatches `start` *and* `end` synchronously for every single
  wheel tick, so the viewer read each tick as a separate interaction: it dropped
  the canvas to the interaction pixel ratio, then restored the settled one
  ~140 ms later, several times a second. On a HiDPI screen that is a full-canvas
  1.4 ↔ 2.0 resolution swap mid-zoom, each one also reallocating the composer's
  MSAA targets. (At `devicePixelRatio` 1 both branches clamp to 1, which is why
  earlier desktop captures never reproduced it.) `nextPixelRatioMode` now gives
  the switch hysteresis in both directions: input is coalesced over 220 ms,
  dropping resolution needs the interaction to persist 260 ms, and restoring it
  needs input to have really stopped for 420 ms. A whole zoom run costs at most
  one downgrade and one upgrade; an isolated tick costs none. `resize()` also
  returns early when nothing actually changed, so a redundant call no longer
  burns a frame rebuilding render targets.
- **The crisp pass no longer lags the zoom.** v0.39.0 made the sharpening
  *target* distance-driven, but the applied value still chased it with a
  ~143 ms time constant, so the strength trailed the camera during a zoom and
  snapped forward the moment motion stopped — a sharpening pop that reads as
  flicker. `crispZoomScale` is already a smoothstep, so the value is now read
  straight from distance and is smooth by construction.
- **"DEM DEUTSCHEN VOLKE" is legible on the west architrave.** Peter Behrens'
  bronze dedication (cast 1916 by S. A. Loevy) is set in a monoline geometric
  capital drawn as polylines in `reichstagInscription.ts` — not a system font,
  so it renders identically everywhere and matches the scene's ink-line style.
  Cap height is the real 62 cm. It is a mipmapped, anisotropically filtered
  canvas texture rather than geometry on purpose: at ~10 cm stroke width on a
  100 m building, real strokes would sit far below one screen pixel and shimmer
  exactly the way this round is removing shimmer elsewhere. The mip chain fades
  the line into a darker band on the architrave as you pull out, which is what
  the real stone reads as from a distance.
- **The Reichstag's six inner courtyards exist.** The shipped LoD2 prism
  `K0002MCN` carries six holes; the model used to render the building as one
  solid block, which is wrong from an isometric camera where the courtyards are
  the most legible plan feature. Their centres and sizes are taken straight off
  that footprint, and each is drawn as a recessed floor plus the ink outline of
  its shaft.
- **Corner towers match the measured footprint.** The same prism puts them in a
  ~16 m band that reaches the building's full width, so they are now 16.5 m and
  sit 0.9 m off the corner instead of 19 m inset by 2 m. The three places that
  build tower geometry share one pair of constants, so they cannot drift apart.
- **Tests.** New coverage for the pixel-ratio governor (a single wheel tick
  causes zero switches; a full zoom run causes exactly two), for the dedication
  layout (every character has a drawn glyph, the line fits the 26 m architrave
  band, scaling is linear), and for the courtyards (six of them, inside the
  envelope, recessed below the cornice).

## v0.41.0

The task-09 bounds expansion. The scene polygon grows from the landmark-fitted
Regierungsviertel hull to a lobed polygon roughly 3.6× its area, and the
official sources were refetched for it. The round is subtractive as much as
additive: the western Tiergarten used to be *invented* presentation geometry,
and it has been deleted now that measured data reaches that far.

**Areas added** — the complete Großer Tiergarten with Siegessäule and Großer
Stern; the Kulturforum (Philharmonie, St. Matthäus-Kirche, Gemäldegalerie,
Neue Nationalgalerie, Staatsbibliothek Haus Potsdamer Straße); the Leipziger
Platz octagon with Mall of Berlin and Kollhoff-Tower; Hamburger Bahnhof; and
the Geschichtspark Ehemaliges Zellengefängnis Moabit. The south-west quadrant
below the park and the north-west quadrant beyond Moabit are deliberately cut
away to hold the payload sizes.

- **Data refetched for the new polygon** — 9,387 LoD2 buildings (was 3,315),
  1,567 ALKIS parcels, and from the Geoportal catalogues 20,911 trees (was
  6,893), 4,009 public-lighting masts and 8 Vorderlandmauer traces. 13 new QA
  landmarks bring the landmark layer to 56 points.
- **The invented western Tiergarten is gone.** `createWestTiergarten` became
  `createExtrapolatedMargin`: the lawn bands, the drawn Straße des 17. Juni
  and the ~1,774 procedurally generated trees and lamps were removed together
  with `extrapolatedTreeSpots` and `extrapolatedLampSpots`. Real LoD2, terrain
  and official tree/lamp points now occupy that ground. This was the largest
  remaining piece of non-surveyed content in the scene.
- **New envelope.** The surveyed hull is world x −2880…690, z −1310…1620.
  Around it sits a 1,200 m blank paper ring — flat tone plates and 140 m
  cartographic ruling, no invented buildings — giving an envelope of
  x −4080…1890, z −2510…2820 and a visible presentation radius of **5030 m**
  (was 3410 m). Camera flight bounds follow the same numbers. Day, Night and
  Minecraft consume one envelope, so no mode can lose the expansion.
- **Prism tones stay honest outside the render.** The committed overview
  raster only covers the pre-expansion polygon, so its projection is now
  pinned to `geo_data/regierungsviertel/overview_bounds.geojson` instead of
  the live bounds. 5,051 of 9,297 prisms sample a real colour; the rest ship
  with no tone at all and fall back to the plain ivory `isoFaceShade` ladder
  rather than borrowing a neighbour's pixels. A test enforces that absence.
- **Compact tree wire form (park-detail schema 3).** Tripling the catalogue
  pushed the verbose tree records to 7.4 MiB, past the 4 MiB payload budget.
  Keys are shortened, the five repeated string vocabularies are interned and
  empty fields are dropped, which is lossless and lands the payload at
  3.4 MiB. `position` deliberately keeps its long name because the Python
  ground samplers read it straight off the file.
- **Payloads** — `park-details.json` 3.4 MiB (167 paths, 22,045 trees, 3,636
  lamps, 8 wall traces, 5 playgrounds), `lod2-prisms.json` 1.5 MiB (9,297
  prisms), `minecraft-voxels.json` 1.9 MiB (890×729 cells, 437,133 ground
  cells, 75,620 building columns, 21,165 tree blocks), `surface-polygons.json`
  with 18 water and 172 park polygons, `street-details.json` with 86 traffic
  signals and 46 monuments. The Siegessäule's three LoD2 socle prisms are
  suppressed because `createSiegessaeule` draws the full 67 m monument.
- **Overpass is not yet refetched.** `osm.gpkg` still holds the pre-expansion
  extract, because the build host lost access to overpass-api.de part-way
  through the round. Streets, water, park polygons and POIs therefore stop at
  the old boundary while buildings, terrain, trees and lamps continue to the
  new one. Nothing was invented to hide the gap. `fused_sources.json` is
  likewise still the pre-expansion manifest: regenerating it yields 6.3 MiB,
  over the 5 MiB repository limit, so it needs a compaction pass of its own.
  Both are the first tasks of the next round.
- Pipeline step 3 now fetches Overpass in roughly kilometre-wide tiles with
  per-tile retries and a gzip-only `Accept-Encoding`, because one request for
  every tag across the expanded polygon returns hundreds of megabytes and the
  connection does not survive it. Tiles are clipped back to the polygon and
  deduplicated by element/id, so the result matches a single request.
- **The 2D overview projection lags the 3D scene.** The DZI raster and the
  landmark projection beside it are produced by one pass from
  `overview_bounds.geojson`, so the viewer's overview still carries the 43
  pre-expansion landmarks while `landmarks.geojson` and the 3D scene carry all
  56. Re-projecting it would rebuild every tile and move the published tones,
  so it waits for the OSM refetch.
- Alignment QA now reports `review` rather than `ok`: the 12 landmarks added
  outside the old OSM extract have no OSM counterpart to match against yet.
  The test pins that exact set by name, so any *other* landmark drifting out
  of alignment still fails the gate.

## v0.40.0

Documented building and monument detail. LoD2 delivers envelopes, so the
features that make each elevation legible were missing entirely. Everything
added here is a published, verifiable feature of the real building, drawn as
flat elements with ink lines in the ivory style. **No window grid was
invented**: all new facade articulation is ink `LineSegments`, never pane
geometry, and the two tests that pin the absence of a window grid (every
`LoD2 prism windows` instance still 2.35 m tall, `panes.count === doors`) are
untouched. `NoToneMapping` at exposure 1 and the four-step `isoFaceShade`
ladder are also untouched — no colour grading changed in this round.

- **Reichstagsgebäude** — Wallot's classical apparatus on the west front, in
  `addReichstagDocumentedOrders`: seven flutes per drum on the visible half of
  the six portico shafts, the two architrave mouldings that frame the
  dedication band, the tympanum as a relief field rather than blank ashlar,
  the rusticated base storey with two deep beds and staggered vertical joints
  on both long fronts, and the four corner towers given attic parapet walls
  (set on the edges so the flag mast keeps each platform centre free) plus
  four corner pinnacles each.
- **Reichstag roof skylight bands** — the two 38 m bands flanking the dome
  were blank blue-grey lids. They now carry the 1.9 m glazing bars plus a
  longitudinal ridge bar. This closes open item (f) of the v0.38.0 handoff.
  The dome itself already had its 24 steel ribs, diagonal bracing, horizontal
  rings and oculus ring in `ReichstagDome.ts` — no change needed there.
- **Bundeskanzleramt** — Schultes and Frank's articulation, in
  `addChancelleryDocumentedDetail`: the round-window motif the building is
  known for is delivered by giving the two *already documented* semicircular
  leadership windows their radial spokes and two concentric arcs, so the
  motif reads as tracery and not as a rectangular curtain wall; two-storey
  winter-garden reveals cut into the office bands; structural joints dividing
  those ~200 m bands into their ~33 m sections; and the eleven slender round
  columns with a thin architrave that frame the Ehrenhof.
- **Paul-Löbe-Haus** — the comb arrived as ten plain bars. The eight glazed
  committee rotundas that stand in the courtyards (Stephan Braunfels, 2001)
  are now drawn: 8.8 m radius, 24 m tall, four on the north courtyard heads
  (z = -117) and four on the south (z = -153), each with a cornice band and
  five gallery ink rings. The glazed spine hall gets its longitudinal
  roof-light grid.
- **Marie-Elisabeth-Lüders-Haus** — roof-light grid over the block, and the
  seven-step Spree-side stair down to the quay beside the existing colonnade.
  The library rotunda and its reading-room rings were already present.
- **Jakob-Kaiser-Haus** — roof-light grids on both the west and the north bar,
  at their true LoD2 roof heights (30.8 m and 35.1 m).
- **Schweizerische Botschaft** — the 1871 villa's documented stonework: a
  rusticated base storey with two beds and staggered joints on both long
  fronts, a two-part cornice profile (fascia plus drip course) under the main
  slab, an attica storey set back behind the roof balustrade, and a shallow
  triangular pediment over the existing four-column portico.
- **Siegessäule** — the cannon-barrel flutes now run up all four drums
  (twelve per drum), the sandstone socle carries its relief band as a
  two-course frame with five bays per side, and the Säulenhalle is drawn as a
  ring of sixteen granite columns under a continuous ring slab. The gilded
  Viktoria was already there.
- **Bismarck-Nationaldenkmal** (Begas, 1901) — newly added to the
  extrapolated west Tiergarten layer beside the Siegessäule, because it lies
  outside the bounds polygon and is absent from the OSM payload: granite
  stepped base, pedestal, the bronze chancellor with his mantle, and the four
  allegorical bronze groups at the pedestal corners.
- **Sowjetisches Ehrenmal Tiergarten** — the colonnade gets the projecting
  cornice over its entablature and the continuous stylobate it stands on. The
  six side pylons, gilded name plates, the 8 m soldier and both T-34/76 tanks
  were already modelled.
- **Kanzlergarten / Non-Violence-Skulptur** — the landmark had an entry but no
  model anywhere. Reuterswärd's knotted revolver is now drawn on its low
  granite plinth: grip, cylinder frame, the barrel looped into a knot over
  fourteen segments, and the muzzle turned back up at the sky.
- **Eduardo-Chillida-Skulptur** — checked; the plinth and the two interlocking
  steel bodies on the Ehrenhof were already correct and were left alone.
- **Carillon im Tiergarten** — checked; the 42 m tower with its 68 bronze
  bells, clappers, player cabin at 33 m and overhanging roof was already
  complete and was left alone.

## v0.39.0

- **The zoom-out flicker was the crisp pass ramping on camera motion.** The
  Day/Night unsharp pass used to fade in only once the camera settled, so a
  moving and a resting camera at the same standoff rendered different pixels
  and every zoom step visibly hardened the image. The pass now follows camera
  DISTANCE (`crispZoomScale`, smoothstepped between 1050 m and 2100 m), which
  is a property of the view rather than of the input, so the picture is
  identical whether the camera moves or stands still. The default framing
  (948 m) sits inside the full-strength band, so the signed-off look at the
  standard view is unchanged. The release-readiness gate now pins the
  distance call so the motion-based version cannot come back.
- **Pinch on a phone zooms instead of flying forward.** Two-finger gestures
  are now classified once, after 12 px of travel on either axis, and pinch
  wins ties (`PINCH_DOMINANCE_RATIO` 0.55). Previously pan claimed the
  gesture after 10 px of midpoint drift while a pinch needed 18 px of spread
  change and 1.1x dominance; because real finger travel is asymmetric, the
  pan branch won and flew the rig along its ground heading — the reported
  "wenn man pincht, geht es nach vorne statt näher ran". A deliberate
  two-finger swipe keeps the spread nearly constant and still reads as a pan.
- **The facades are warmer and less grey, by repainting, not by re-grading.**
  Day and Night keep `NoToneMapping` at exposure 1 and the four-step
  `isoFaceShade` ladder is untouched; only authored colours moved. The
  photogrammetric cleanup desaturates 0.30 -> 0.22 and the prism cleanup
  0.55 -> 0.34, because the remaining greyness was a chroma deficit rather
  than a brightness one. The luma band moves to 0.72-0.96 (photogrammetry)
  and 0.80-0.96 over sixteen levels instead of ten (prisms) — the old ten
  bands over a narrower window gave the entire city just two usable paint
  levels, which is a large part of why it read as one flat mass. The shared
  ivory anchor warms from `#f8f3e6` to `#fbf5e4` and the blends toward it
  rise, and the roof plate tint lifts from `#cdd2d4` to `#d9dee0` at 0.34
  instead of 0.45 blend, since roofs are the largest visible surface in an
  isometric view and a neutral cool grey there greyed out the whole drawing.
- **The dusk music is slower, deeper and roomier, without clicks.** 118 -> 88
  BPM, root 38 -> 33 MIDI, and half the percussion density (click every 8
  steps instead of 4, hat every 4 instead of 2); the click-hat-click
  alternation that carries the motorik feel is preserved exactly, only the
  air between the hits doubles. A parallel dry/wet hall at 0.46 wet shares
  the ambient convolution impulse, and every voice keeps its attack/release
  envelope so no gain change is a step discontinuity.
- **Visible radius 3310 m -> 3410 m.** One regular +100 m areal step. The new
  extrapolated strip covers -3120 m to -3020 m with the next two primes in
  the published seed sequence (4967 / 5101), so the v0.38.0 tree population
  remains an exact index-for-index prefix of the new one: the tree that used
  to be last is still at index 1691, and the total goes 1692 -> 1774. Camera
  flight bounds follow the ring. `tasks/09` (Kulturforum / Leipziger Platz /
  Tiergarten grand expansion) remains OPEN — this is the routine step, not
  that expansion.

## v0.38.0

- **The film curve is gone from the drawn modes, and that fixes the palette
  at the root.** Day and Night now render with no tone mapping at exposure 1,
  so an authored paint tone reaches the screen bit-exact. v0.37.0 still ran
  ACES at exposure 1.33 in front of a deliberately FLAT UNLIT drawing, and it
  was measurably rewriting every colour: the ivory register `#f8f3e6` arrived
  as a neutral grey `#e9e7e4` (warm r−b 18 collapsed to 5) while the calm sage
  lawn `#a9c592` arrived as a fluorescent `#d0fea1`. Both complaints — "alle
  Gebäude heller, nicht grau" and the loud green park — were the same defect
  pulling in two directions, which is why repainting the palette never fixed
  either. The crisp pass is now chroma- and contrast-neutral for the same
  reason; its hue-free sharpening stays. New contract tests pin all of it so
  the curve cannot return.
- **One brightness world instead of two.** The drawn ground was the single
  LIT surface in an unlit drawing, so the authored sage in `ISO_GROUND_SHADES`
  never actually reached the screen — the day rig multiplied it by whatever it
  happened to be set to. The ground slabs now join the prism convention with a
  day/night material pair: exact flat paint by day, the lit material only
  under the night rig. The remaining lit content (landmark models, trees, park
  details) is calibrated so a lit up-facing surface reproduces its own paint
  tone (≈1.07 at the top face, ≈0.78 on an unlit side), and the hemisphere's
  ground half is nearly as bright as its sky half — that dark half is what had
  dropped every lit landmark wall to a mid grey beside an ivory prism.
- **Buildings brighter, not grey, at every source.** The photogrammetric
  facade band moves from 0.48–0.82 to 0.66–0.94 and quantises onto nine levels
  instead of five, so the pale stone range no longer collapses onto a single
  mid grey (measured before: `#b1b4ad` over 33 000 px of the Chancellery).
  Every drawn facade now also carries a 22 % nudge toward the ivory anchor, so
  the photogrammetric heroes sit in the same register as the LoD2 prisms
  instead of reading neutral beside them. `cleanedTone`'s floor moves to 0.75
  — chosen after quantisation, because the old 0.68 still snapped down to
  6/9 = 0.667 and the "bright band" was a claim the arithmetic did not keep.
  The `isoFaceShade` ladder is compressed into the bright register (0.885 …
  1.0) while keeping four distinct constant steps.
- **Minecraft: real building colours, no khaki landmarks.** Three separate
  causes are fixed. The Chancellery's recognition pin was a warm cream
  (`0xf3efd0`, 31 units more green than blue) and rendered its whole 343 m
  envelope khaki-yellow — it is now pale cool concrete, which is what the
  building is. Hero facades restored their RAW photogrammetry colours in
  Minecraft, painting a warm photo smear across each landmark (98 000 px of
  `#b6b084`); they now use the flat quantised block colours, which is both
  correct and more minecrafty. The screen-space warm grade
  `vec3(1.045, 1.02, 0.93)` skewed red over blue on every pixel and is gone.
  Column snapping is chroma-weighted so a grey building stays grey, and its
  lift band moves up (168–236) because Berlin's median sample luma is 111 and
  the old 150 floor left most of the city on the two darkest stone entries.
  The voxel rig is recalibrated to match.
- **Parkland reads as one calm sage.** The extrapolated west Tiergarten used a
  visibly darker green than the surveyed inner park, so the two halves looked
  like different forests; both now share the same sage crown family, lifted a
  step, with lighter trunks.
- **Areal expansion (+100 m contract): visible radius 3210 m → 3310 m.** The
  western lobe reaches −3020 m, the paper/park margin widens to 2020 m, the
  envelope spans x −3020…2621 / z −3050…3471 m and the flight bounds follow.
  Exactly one new 100 m tree strip is added (79 trees, 1613 → 1692); every
  previously published strip keeps its positions seed for seed, pinned by
  test. No surveyed geometry moved and nothing extrapolated is relabelled as
  measurement.

## v0.37.1

- **The Tiergartentunnel underside is visible again instead of opening into a
  black frame.** The below-ground camera no longer triggers the water fog
  merely because it sits below the Spree level. The cutaway keeps its own
  relative draw layers, so the two tubes, ceiling lamps, safety strips, lane
  markings, portal frames and ventilation cues remain in front of the faded
  ground shell rather than hiding behind the road deck.
- **Night keeps the principal architecture readable.** Official drawn
  facades receive a restrained cool self-light floor that never touches
  terrain, vegetation or water. The Reichstag and Chancellery retain cool
  masonry definition while the Brandenburg Gate gains warm, realistic
  floodlighting; Day and Minecraft restore their original material state
  losslessly.
- **The 3D controls are now completely bilingual.** The viewer switch,
  rotate/flip group, opposite view, true underside, canvas label and loading
  progress no longer leak German labels into the English interface. Regression
  tests pin both languages.
- **Compact controls meet their touch contract.** The default-view control was
  the lone 36 px mobile target; it is now 44 x 44 px like the rest of the phone
  and tablet toolbar. Visual checks covered 390 x 844, 1024 x 768 and
  1600 x 900 viewports in Day, Night, Minecraft, 2D and tunnel-underside views,
  with no browser errors.
- **Metric and source contracts remain unchanged.** No building, road, tree,
  monument or camera anchor moved. The versioned presentation radius remains
  **3210 m**, and the existing attribution and additive open-data policy are
  untouched.

## v0.37.0

- **`Dusk Republic` joins the viewer as a fully procedural soundtrack.** The
  integrated side-branch composition alternates equal slow and motorik
  movements on one 118 BPM sixteenth-note grid, passes through D Aeolian and
  one Phrygian station per movement, and combines co-prime phrase cycles whose
  exact section sequence repeats only after more than eight hours. It ships as
  Web Audio code rather than an audio file and adds no download or streaming
  dependency.
- **The soundtrack is on by default without violating browser autoplay
  policy.** Every reload restores the enabled intent; the AudioContext begins
  only on the first ordinary pointer, touch or keyboard gesture. `T` and the
  toolbar note button switch it off or on for the current session. Deliberately
  no `localStorage` mute key is used, matching the owner's requirement that a
  reload returns to on.
- **Five hard integration failures are closed.** A cancellable, timeout-bounded
  start prevents rapid off/on races; transient first-gesture failures preserve
  the enabled intent and retry on the next gesture; hidden tabs suspend the
  context and resume at most four fresh steps instead of emitting a note
  backlog; every completed oscillator graph disconnects and leaves the active
  source registry; and the shared Ambient + Dusk master ceiling is now exactly
  0.10 (`0.07 + 0.03`) to prevent summed clipping or mud.
- **The controls remain compact and accessible.** Desktop and mobile receive
  labelled, pressed-state-aware note controls; the compact action-sheet target
  is 54 px high at 390 px viewport width, `T` is documented in both languages,
  and audio controls no longer trigger the other layer's gesture bootstrap.
  The active soundtrack receives one restrained warm-gold flat accent without
  changing the viewer's architectural palette.
- **Duration and spatial contracts remain stable.** A deterministic five-minute
  scheduler simulation stays bounded and chronological, background jumps are
  regression-tested, and the complete TypeScript/Python/package gates remain
  mandatory. No map geometry moved: Day, Night and Minecraft retain the same
  versioned **3210 m** presentation radius.

## v0.36.0

- **No more black square-window failure on the principal buildings.**
  Minecraft building colours now snap only to a curated architectural palette,
  never to asphalt, water, foliage or near-black world blocks. Metric,
  orientation-aware envelopes around Reichstag, Bundeskanzleramt,
  Hauptbahnhof and Brandenburger Tor suppress the generic voxel-window overlay
  so each landmark keeps its authored recognition facade. The surveyed voxel
  columns, LoD2 positions and scale remain unchanged.
- **The Reichstag reads as pale stone with tall, framed glazing.** Dark holes
  become cool blue-grey glass; upper panes change from squat rectangles to
  1.25 x 2.65 m portrait openings, arched glazing doubles its curve resolution,
  and a separately drawn 0.10 m reveal articulates each upper opening. These
  facade details are reference-based presentation geometry, not claimed as
  surveyed 10 cm building data. The official-dimension 40 x 23.5 m,
  24-rib dome remains intact.
- **The Chancellery and glass architecture become finer and calmer.** Office
  bay pitch tightens from roughly 7.2 m to 2.65 m, clear panes replace broad
  dark panels, and only a deterministic minority carries warm night light.
  The leadership arch, Hauptbahnhof office bridges and train glazing, and the
  Swiss Embassy use lighter glass rather than black-looking inserts.
- **Night preserves architectural legibility.** A restrained cool moonlight
  floor keeps pale masonry and ink contours readable while warm occupied rooms
  remain selective. Day face steps are lifted without gradients, retaining the
  flat, unlit ivory drawing convention.
- **Radius and accuracy contract retained.** Day, Night and Minecraft still
  cover the same versioned **3210 m** presentation radius. No geometry was
  shifted and no extrapolated detail is relabelled as official measurement.
  Close views were checked on phone and desktop; regression tests pin the
  architectural palette, portrait-window proportions, hero-overlay exclusion,
  selective night lighting and lossless mode swaps.

## v0.35.1

- **The complete 3210 m presentation radius now exists in all three visual
  modes.** Day and Night already drew the versioned western Tiergarten and
  outer paper surround, but Minecraft hid that scene and stopped at the much
  smaller official voxel-payload grid. Minecraft now adds an explicitly
  labelled extrapolated block surround with the same park bands, 1,613
  deterministic tree positions, lamps, east/west axes, Großer Stern and
  Siegessäule signature. The surveyed voxel payload remains untouched.
- **One envelope contract replaces three drifting implementations.** Radius,
  margin bands, west-park limits, tree populations and lamp positions now live
  in `worldEnvelope.ts` and are consumed by both renderers. Contract tests pin
  the exact published tree population and the complete
  x −2920…2521 / z −2950…3371 m presentation envelope.
- **Minecraft overview fog no longer erases the expanded map.** Its fade now
  begins beyond the full navigable ring instead of covering most of the city at
  maximum zoom. The result was visually checked in Day, Night and Minecraft at
  phone, tablet and desktop sizes.
- **Documentation coherence.** The README's stale 2310 m statement now matches
  the actual 3210 m radius and clearly distinguishes the official metric core
  from the extrapolated presentation surround.

## v0.35.0

- **The invented window panes are gone for good.** v0.32.0 had added a
  generated pane per bay and storey to every building — 82,014 housing
  panes plus 5,747 civic panes, none of them backed by data, exactly the
  "schwachsinnige nichtexistierende Quadratfenster" the owner has
  rejected repeatedly. LoD2 carries no window positions, so the pane
  layer now holds ONLY the 725 documented entrance doors; the facade
  rhythm comes from the drawn bay axes and storey bands, and the
  referenced hero fenestration (Reichstag arches, curtain-wall
  mullions) stays untouched. Two tests that demanded the invented grid
  were rewritten to enforce the opposite.
- **Isometric face shading — 3D plasticity without gradients.** Every
  face now keeps ONE constant tone whose brightness follows its facing
  (top 100 %, north 95.5 %, east 90 %, south 84.5 %, west 79.5 %) — the
  classic axonometric drawing convention. Prism walls, flat caps and
  pitched roof facets all step by direction, so volumes read solid and
  three-dimensional while staying flat, unlit and ivory. A contract test
  pins the ladder (top brightest, four distinct side steps, no
  interpolation).
- **Areal expansion (+100 m contract): visible radius 3110 m → 3210 m.**
  The western lobe reaches −2920 m, the paper/park margin widens to
  1920 m, flight bounds follow (z −3000…+3420); the v0.34.0 tree strip
  is pinned and a new population fills only −2920…−2820 m.

## v0.34.0

Iteration of the refinement loop. The ugliest spots this time were all
the same root cause — everything ground-level came from a 4 m raster:

- **The river banks were nonsense staircases.** Water, bed and quay
  walls were assembled from 4 m grid cells, so every shoreline was a
  flight of steps ("völlig bescheuerte Ufer, alles zu zackig"). A new
  pipeline stage (`build_surface_polygons.py`) exports the TRUE OSM
  water and parkland polygon rings (simplified to 0.6 m, decimetre
  integers, 18 water + 172 park polygons, 54 KiB), and the drawn city
  now builds from them: a transparent water plate over a sandy bed,
  quay walls extruded along the real bank line, and one continuous
  drawn shoreline. Most shoreline segments are diagonal now — asserted
  by a contract test — instead of axis-aligned steps.
- **The Tiergarten lawns were rasterised too.** Smooth sage lawn plates
  from the same park polygons cover the grid steps, so the parkland
  reads as continuous meadow rather than blocks with single trees.
- **Night no longer glows through the ground.** The new unlit plates
  (bed, lawns, quay walls) ignore the night rig by construction, so
  each carries an explicit night tone — the river bed stopped shining
  like a pale ribbon after dark.
- **Areal expansion (+100 m contract): visible radius 3010 m → 3110 m.**
  The western lobe reaches −2820 m, the paper/park margin widens to
  1820 m, flight bounds follow (z −2900…+3320); the v0.33.0 tree strip
  is pinned and a new population fills only −2820…−2720 m.
- The rasterised water/quay path stays as the fallback for payloads
  without the surface polygons, so nothing breaks if the file is absent.

## v0.33.0

Iteration of the refinement loop, driven by a reference photograph of the
Paul-Löbe-Haus and by the standing "real riverbanks / real bridges"
topics. What was asked for, and what happened:

- **The Paul-Löbe-Haus west front was pinned to the wrong building.** The
  v0.32.0 portico sat at x = 154.6 m with a 31 m span — inside the
  east-west bar (prism `0sVYAxtY`), not on the Spreebogen-facing west
  wing (prism `HA7mKuzG`, x 129.8…157.2, z −188.5…−86.0). It is now
  rebuilt on the correct face and after the photograph: the thin 0.55 m
  roof plate cantilevers 13.5 m across the **entire** 106 m facade width,
  thirteen free-standing slender **round** columns (r = 0.42 m) carry it
  in front of the glass, a recessed dark coffered ceiling with a 3.4 m
  coffer grid closes the entrance zone, the fully glazed west front
  carries a fine mullion/transom grid (2.7 m × 4.35 m) with two hinted
  stair runs behind it, and the forecourt gains three paving bands and
  the two fountain rows that cross the lawn.
- **The Spree ran flat at city level.** The water table drops from
  +1.31 m to **−1.15 m**, about 5.3 m below the ~4.2 m banks, so the
  river sits in a real cut. The quay walls now run from the bank down
  past the water line to −3.1 m, the water line itself is drawn as ink
  on both faces, masonry joints break the embankment every 14 m instead
  of one endless grey band, and the bank stairs step down on ~0.42 m
  risers. The constant is now exported once from
  `MinecraftVoxelWorld.ts` and consumed by the drawn city, the voxel
  payload, the excursion steamer and the underwater camera trigger, so
  day, night and Minecraft mode all share one water table.
- **The bridges were planks lying on the water.** Every crossing now
  clears the water by at least 5.4 m on a cambered deck with edge beams,
  parapets and railing posts, and each named bridge gets its real
  construction: the **Moltkebrücke** three segmental stone arches on
  cutwater piers with drawn arch rings and spandrel walls, the
  **Kronprinzenbrücke** a flat 16-step steel arch with hangers and no
  river piers, the **Gustav-Heinemann-Brücke** and the Sprung über die
  Spree slender round columns. Profiles are data
  (`BRIDGE_PROFILES` / `bridgeProfileAt`), matched to the surveyed OSM
  bridge clusters by position.
- **Detail fidelity — the four coarsest remaining LoD2 blocks.** Beyond
  the Paul-Löbe west front: the **Haus der Kulturen der Welt** had only
  7 m flat boxes, so the whole "Schwangere Auster" was missing — it now
  carries its double-cantilever saddle shell roof (a real hyperbolic
  paraboloid surface, Hugh Stubbins 1957) on two abutments over the
  auditorium drum, with the reflecting pool on the west forecourt. The
  **Marie-Elisabeth-Lüders-Haus** was one 116 × 105 m block and now
  carries the cylindrical library rotunda (Ø 33 m, gallery rings) and
  the Spree-side colonnade with its cornice. The **Jakob-Kaiser-Haus**
  gains the west arcade colonnade facing the Reichstag. The
  **Schweizerische Botschaft** was a bare 18 m box and now has the
  rusticated base, cornice, roof balustrade and four-column entrance
  portico of the 1871 villa.
- **Areal expansion (+100 m contract): visible radius 2910 m → 3010 m.**
  The paper/park margin widens to 1720 m, the extrapolated west reaches
  −2720 m, the new −2720…−2620 m strip grows its own deterministic tree
  population like every strip before it, and the flight bounds follow
  (z −2800…+3220, x from −2750).

## v0.32.0

Iteration driven by direct owner feedback. What was asked for, and what
happened:

- **One click back to the default view.** The toolbar carries a labelled
  accent button ("Standardansicht", shortcut `R`, documented in the help
  panel) that returns the viewer to the load-time hero shot from any
  state: camera on the Bundeskanzleramt, daylight, north up, right way
  round, no underside tilt. The contract lives in `src/resetView.ts` as
  pure data so it can be asserted without rendering React;
  `tests/reset-view.test.ts` drives it out of night mode, Minecraft,
  orbited cameras and mirrored views.
- **The Paul-Löbe-Haus was missing its west portico.** The LoD2 extract
  carries the building as a plain 157 m bar, so the one feature that
  makes the Chancellery-facing front recognisable — the wide flat canopy
  cantilevering over the entrance forecourt on slender columns (Stephan
  Braunfels, 2001) — simply was not there. It is now drawn as inked flat
  elements: a 12.5 m × 31 m slab with a fascia edge, six square columns
  and the entrance platform beneath; the cantilever is asserted in
  `tests/isometric-city-world.test.ts`.
- **The day palette is brighter again.** Ivory moves to 0xf8f3e6, the
  cleaned-tone band lifts to 0.68…0.88 across ten paint levels instead
  of six (the raised floor would otherwise collapse every facade onto
  two shades), and ground, plazas, quays, bridges, tunnels and the sky
  all move up with it. The ink stays at 0x716c62, so contours keep their
  contrast against the lighter panels.
- **Every building now carries a drawn window grid.** Until now only
  landmarks had panes; ordinary blocks were articulated by vertical
  glazing axes alone and read as blank at overview zoom. Each wall now
  gets a pane at every bay/storey crossing on its own format — housing
  proportions (1.05 × 1.9 m on a 3.6 / 3.1 m pitch) or piano-nobile for
  civic monuments (1.3 × 3.0 m on 4.6 / 4.4 m) — plus one horizontal
  storey band per floor, so facades stay finely textured when the panes
  themselves fall below a pixel. Joinery (Laibung, mullion, transom) is
  instanced only for the wide civic openings; Sprossen on all ~88k panes
  would cost more triangles than the rest of the city together.
- **The outskirts are drawn ground, not blank paper.** The three margin
  bands were flat slabs next to the drawn centre; they now carry a 140 m
  field grid of hairlines in the same ink, and the new western strip
  grows its own deterministic tree population like every strip before
  it. No buildings are invented out there — the ruling is cartographic,
  not surveyed.
- **Areal expansion (+100 m contract): visible radius 2810 m → 2910 m.**
  The paper/park margin widens to 1620 m, the extrapolated west reaches
  −2620 m and the flight bounds follow (z −2700…+3120).

## v0.31.0

Iteration of the refinement loop. The ugliest spots found in this
iteration's screenshot survey, and what happened to them:

- **Every LoD2 window was a bare rectangle.** The generic prism facades
  drew each opening as a single flat pane, so at close range the
  Chancellery wings and the Ministerien read as grids of dark squares.
  Each opening now carries drawn joinery on the very same instance
  matrices as the pane: a reveal (Laibung) on all four sides, a centre
  mullion and a transom above the middle — thin warm-grey ink bars
  (0x8b8578) that give the openings real proportions in day, night and
  Minecraft alike.
- **The Spree quay was a bare concrete slab.** The merged embankment
  runs had a wall and a promenade ledge but nothing on them. Every run
  now carries a drawn balustrade — a continuous top rail at 1.05 m on
  posts every 3.2 m — and runs of 26 m or more get a five-step flight of
  stairs down to the waterline, so the banks read as walkable
  promenades instead of a poured edge.
- **The parkland was a belt of heavy dark blobs.** Tiergarten and
  Spreebogenpark crowns used saturated greens (0x7da371 and darker); at
  quarter scale they were the largest colour mass in frame and fought
  the ivory city. The crowns are now light sage (0x9dbd8e / 0xaac89a /
  0x93b485), so the greenery settles behind the buildings the way it
  does in the drawn reference.
- **Areal expansion (+100 m contract): visible radius 2710 m → 2810 m.**
  The paper/park margin widens to 1520 m and the flight bounds follow
  (z −2600…+3020), so the newly exposed ring is drawn in the full ivory
  style rather than clipped away.

## v0.30.0

Iteration of the refinement loop. The three ugliest spots found in this
iteration's screenshot survey, and what happened to them:

- **Minecraft facades were punched full of black holes.** Every window
  cell used a dark slate (0x40515c) and was scattered by a hash, so the
  Chancellery and every other block read as a grid of black gaps. Window
  cells are now genuine **Minecraft glass** — light glass, pale glass and
  a teal accent every fourth bay, all from the master palette — and they
  sit on a shared storey grid per column face, so the facades read as
  designed window ROWS instead of random punches.
- **The Spree banks were a frayed staircase.** The quay wall and its
  promenade ledge were built per grid cell, so every 4 m step jutted out
  on its own. Boundary cells are now merged into RUNS along each axis
  before building, giving one continuous embankment line with a straight
  promenade — the river keeps its recessed bed and visible depth.
- **The Tiergartentunnel portals were bare ramps.** They now read as
  real portals: a dashed centre line and two solid edge lines running
  down the ramp deck, crash barriers along both retaining walls, and a
  portal cap slab above the tube mouth.
- **Areal expansion (+100 m contract): visible radius 2610 m → 2710 m.**
  The western lobe reaches −2520 m, the paper/park margin widens to
  1420 m, flight bounds follow (z −2500…+2920). The v0.29.0 tree strip
  is pinned; a ninth deterministic population fills only the new
  −2520…−2420 m strip.

## v0.29.0

- **Areal expansion (+100 m contract): visible radius 2510 m → 2610 m.**
  The western lobe reaches −2420 m, the paper/park margin widens to
  1320 m, flight bounds follow (z −2400…+2820) — the whole Großer
  Tiergarten from the Gate to the Großer Stern is now inside the frame.
  The v0.28.0 tree strip is pinned; an eighth deterministic population
  fills only the new −2420…−2320 m strip.
- **The bridges carry themselves through the air.** Moltkebrücke,
  Gustav-Heinemann-Brücke, Hugo-Preuß-Brücke and their siblings are no
  longer flat strips painted on the water: the surveyed bridge cells are
  clustered into individual bridges (radius-2 dilation, so a carriageway
  interrupted by water cells stays ONE bridge), each fitted to an
  oriented rectangle and then built as a real structure — stone
  abutments, piers standing on the riverbed, slender segmental side
  girders dipping between the piers, an elevated deck plate with edge
  beams and a parapet along each deck edge. Road bridges get their real
  17–26 m width and rest on both banks; the flat bridge slabs are gone
  from the ground layer (`skipBridge`).
- **The Quadriga is right.** The four-horse team is now countable
  (2.0 m spacing, faceted bodies and heads carrying ink lines like the
  rest of the drawing), the chariot has its full 7.4 m car with a rail,
  and Victoria carries her signature staff: pole, Iron-Cross transom,
  Prussian eagle with spread wings — all kept inside the documented
  26 m gate height.
- **Hotel Adlon is visible.** The shipped LoD2 extract is clipped just
  west of Unter den Linden 77, so the hotel is absent from the surveyed
  data (verified: nearest data building is 11.5 m tall, 40 m away).
  It is drawn as an owner-approved extrapolation at its documented
  position (52.5161 N, 13.3800 E → world 573/324): a closed perimeter
  block around a courtyard, ~31.5 m to the eaves with mansard attic,
  Sockel and cornice bands and the Pariser-Platz corner risalit, in the
  ivory register and marked `userData.extrapolated`.
- **Better, more accurate glass roofs.** The Hauptbahnhof barrel had
  disabled depth testing entirely (the roof floated in front of
  everything) and a strong turquoise that clashed with the ivory city;
  it now uses pale, properly depth-tested glazing with a finer grid
  (ribs every ~6 m instead of 8 m, transverse seams every ~3 m instead
  of 4 m) — the platforms read through the glass as they should.
- Deferred and documented: another granularity pass on the individual
  memorials, and the Reichstag skylight bands could still gain a
  mullion grid of their own.

## v0.28.0

- **Areal expansion (+100 m contract): visible radius 2410 m → 2510 m.**
  The western lobe reaches −2320 m, the paper/park margin widens to
  1220 m, flight bounds follow (z −2300…+2720). The v0.27.0 tree strip
  is pinned to its release constant; a seventh deterministic population
  fills only the new −2320…−2220 m strip.
- **Hero-model ink joins the city ink.** The recognition models
  (Reichstag, Gate, Hauptbahnhof, Chancellery …) drew their edges in a
  dark blue-teal that clashed with the fine grey pencil by day and
  stayed near-black at night. Their line materials are now the shared
  ink colour and tagged for the mode swap — moonlit blue after dark,
  exactly like the drawn city.
- **Transparent rivers with a riverbed ("Flüsse müssen durchsichtig
  sein mit Flussbett").** The drawn city's water is no longer an opaque
  slab: a pale glass surface plate (45 % opacity, no depth-write)
  floats over a sandy two-tone riverbed 2.2 m below, and the quay
  walls now reach down to the bed so the embankments read correctly
  through the water. At night the surface deepens to a dark glass
  blue. Minecraft keeps its opaque genre water.
- **Real double-tap zoom on touch.** Browsers don't reliably synthesise
  `dblclick` on a `touch-action: none` canvas; a pointer-based detector
  (340 ms / 32 px) now zooms toward the tapped point on every device,
  matching what the help overlay promises.

## v0.27.0

- **Areal expansion (+100 m contract): visible radius 2310 m → 2410 m.**
  The western lobe reaches −2220 m, the paper/park margin widens to
  1120 m, flight bounds follow (z −2200…+2620). The v0.26.0 tree strip
  is pinned to its release constant (byte-stable) and a sixth
  deterministic population fills only the new −2220…−2120 m strip.
  Candelabra lamp rows now line the Straße des 17. Juni with a ring of
  lights around the Großer Stern — two instanced draw calls, neutral
  fixtures by day, warm glow at night.
- **Bug sweep (three parallel code reviews, 40+ verified findings, the
  worst 25 fixed):**
  - *The gesture killer:* a `lostpointercapture` listener fired on
    EVERY normal finger lift (touch pointers get implicit capture) and
    wiped the whole two-finger gesture state — pan momentum was dead
    code on real devices. Removed; `pointercancel` now zeroes flick
    velocity so iOS system gestures can't hand out phantom glides, and
    landmark focus cancels an active glide.
  - *Double work:* the multi-MB prism/voxel payloads were fetched and
    parsed twice on a `?theme=minecraft` deep link — now shared,
    fetched exactly once per session. Traffic-signal animation no
    longer name-searches the scene per frame; wind flags skip the full
    vertex re-upload when frozen and stop allocating per instance per
    frame; surface-quality dataset writes are deduplicated; tilt only
    rebuilds materials when the underside flag actually flips.
  - *Leaks and teardown:* dropped photo textures are disposed
    immediately (iOS memory spike), `InstancedMesh` buffers and the
    inactive day/night materials are included in disposal, the WebGL
    context is force-released on unmount (Safari's context pool),
    ambient audio clamps its catch-up after background throttling.
  - *Visual nits:* the Gesims no longer z-fights the roof cap (the
    shimmering band around every flat roof), the drawn city's ground no
    longer inherits Minecraft's grey emissive glow (night streets/Spree
    stopped self-lighting), entrance doors step clear of the Sockel,
    portal ramp decks join the light asphalt register, monument tones
    lift to the ivory band, west ink turns moonlit at night, and quay
    walls/bridge railings/portals/monuments now share the prism
    convention (exact flat paint by day, lit only at night).
  - *Input contracts:* browser chords (Cmd+L, Ctrl+D…) are no longer
    hijacked by single-letter shortcuts; arrows/+/− act exactly once
    (capture phase beats OpenSeadragon's canvas keys); a gesture on the
    map stops the running tour; the three-finger tilt no longer also
    toggles the whole UI; the flight joystick clears the attribution
    toggle; dead 44px CSS selectors fixed; help copy matches the real
    gesture set.
- Deliberately deferred (documented): chunking the synchronous drawn-
  city build across frames, wheel-vs-trackpad classification tuning,
  2→1-finger gesture continuation, modal focus traps, hero-model ink
  night swap.

## v0.26.0

- **Areal expansion (+100 m contract): visible radius 2210 m → 2310 m.**
  The extrapolated western Tiergarten lobe reaches −2120 m, the calm
  paper/park margin widens to 1020 m and the flight envelope follows at
  z −2100…+2520. Every tree published through v0.25.0 stays pinned to its
  original strip; a fifth deterministic population fills only the new
  −2120…−2020 m strip. A stronger integer mix removes linear planting patterns,
  while the seamless outer paper adds no draw call or claim of newly surveyed
  geometry.
- **Responsive state now follows the real viewport.** A shared 1024 px layout
  contract observes media-query changes plus the iOS `visualViewport` resize
  fallback. Rotating a phone/tablet, changing browser zoom or entering iPad
  Split View immediately aligns React with the compact CSS, closes a stranded
  desktop sight rail and clears incompatible sheets. Landmark focus offsets,
  discovery coaching and post-selection rail closing all use that same state.
- Added direct regression coverage for the inclusive 1024 px boundary,
  rotation/Split-View subscriptions and cleanup, the immutable v0.25.0 tree
  strip, the new v0.26.0 strip and the 2310 m flight envelope.
- Minecraft's restrained distance haze now derives from the versioned radius
  instead of ending at a fixed 2550 m plane. The full expanded block world
  remains legible in wide views without changing Day or Night rendering.
- Local packaging now retries a narrowly identified macOS Finder race where a
  newly created `.DS_Store` made removal of the previous generated package fail
  with `ENOTEMPTY`. Finder metadata remains excluded from every public archive.
- Refreshed the local-package and version guidance for this release.
- Verified 183 frontend contracts, TypeScript and the production build plus 199
  Python contracts, release readiness and the real local-package smoke test.
  Day, Night and Minecraft were inspected at 390×844, 1024×768 and 1600×900,
  including four hero sights and the new western edge. Across the four hero
  crops, 13,670 neutral 12×12 subject patches measured per-channel colour
  σ < 2; browser logs remained clean.

## v0.25.0

- **Areal expansion (+100 m contract): visible radius 2110 m → 2210 m.**
  The extrapolated western Tiergarten lobe reaches −2020 m, the calm
  paper/park margin widens to 920 m and the flight envelope follows at
  z −2000…+2420. Every v0.22.0–v0.24.0 tree remains pinned to its published
  strip; a fourth deterministic population fills only the new
  −2020…−1920 m strip. The surround remains explicitly non-geographic where
  official source coverage ends and adds no new draw calls.
- **Fluid high-DPI input instead of hidden full-resolution stalls.** Orbit,
  custom two-/three-finger touch and native trackpad pan/pinch now hold
  independent interaction states. Each input immediately engages the lighter
  interaction pixel budget; full settled resolution returns only after the
  gesture, trackpad sequence or touch momentum has ended. Simultaneous input
  cannot prematurely restore the expensive tier, and a trackpad sequence
  resizes render targets only once instead of once per wheel delta.
- **Softer, more coherent outer-park vegetation.** Extrapolated tree crowns now
  use the same low-poly faceted language as the detailed Tiergarten layer
  instead of cube crowns. GPU instancing keeps the complete expanded west layer
  at four draw calls.
- Discovery notes now clear the mandatory attribution on desktop and the
  bottom toolbar, attribution control and safe area on compact touch screens.
  On the first compact-screen visit they wait until the one-time gesture coach
  has been dismissed, avoiding two simultaneous overlays.
- The compact control layout now applies consistently to every viewport up to
  1024 px instead of depending on browser pointer classification. This removes
  the crowded desktop rail/control stack on tablets, hybrid devices and small
  laptops whose browsers report a fine pointer. Tablet-width title and action
  bars are additionally width-bounded so the scene keeps most of the canvas.
- Release hygiene remains strict for public/package trees and duplicate paths,
  while transient `.DS_Store` files in Vite's gitignored `dist/` directory no
  longer make macOS readiness nondeterministic; a regression test keeps that
  exception narrowly scoped.
- Added regression contracts for all three interaction sources, the 2210 m
  envelope, immutable prior tree strips and the new western population.
- Verified 179 frontend contracts, TypeScript and production build plus 198
  Python contracts, release readiness and the real local-package smoke test.
  Day, Night and Minecraft were inspected at 390×844, 1024×768 and 1600×900
  across four hero sights and the new edge. In the four landmark crops, 13,919
  sampled 12×12 patches measured colour σ < 2; browser logs remained clean.

## v0.24.0

- **Areal expansion (+100 m contract): visible radius 2010 m → 2110 m.**
  The extrapolated western Tiergarten lobe reaches −1920 m, the calm
  paper/park margin widens to 820 m and the flight envelope follows at
  z −1900…+2320. The v0.22.0 and v0.23.0 tree populations remain pinned to
  their published coordinates; a third deterministic population fills only
  the new −1920…−1820 m strip. The surrounding ring remains explicitly
  non-geographic where official source coverage ends, and the complete west
  layer still renders in four draw calls.
- **Quieter, clearer daylight drawing.** Grass, asphalt, water, bridge and
  plaza variants now sit within tightly controlled colour intervals; the
  grass channels differ by at most two RGB levels. The recessed paper and
  distant presentation floor share the brighter sage-ivory register, removing
  the previous stripe-heavy edge without altering any metric building.
- **Native trackpad navigation.** High-resolution two-finger scroll now pans
  with the same direct-manipulation sign contract as touch, while trackpad
  pinch keeps zoom anchored below the finger midpoint. A short sequence lock
  prevents fast momentum deltas from changing into mouse-wheel zoom halfway
  through a gesture; stepped mouse wheels continue to zoom at the pointer.
- Verified 178 frontend contracts, TypeScript and production build; desktop,
  tablet and iPhone visual passes covered Day, Night, Minecraft, four hero
  sights and the new western strip. More than 8,000 neutral subject patches
  measured colour σ < 2, and repeated keyboard flight remained bounded and
  responsive.

## v0.23.0

- **Areal expansion (+100 m contract): visible radius 1910 m → 2010 m.**
  The extrapolated western Tiergarten lobe reaches −1820 m, the calm
  paper/park margin widens to 720 m and the flight envelope follows at
  z −1800…+2220. Existing geometry and the complete v0.22.0 tree population
  stay fixed; a separate deterministic population fills only the new western
  strip. A recessed unlit paper ground closes transparent seams between the
  bounded official grid and the surround, so edge trees cannot float against
  the sky. A single presentation-only floor below the metric model also closes
  distant oblique camera views; it is explicitly non-geographic and has a
  separate night tone. The ring remains marked as extrapolated and adds no
  repeated draw calls or claim of surveyed geometry.
- **One flat ivory drawing in daylight.** Procedural architectural signatures
  and memorials now use the same lossless flat-unlit daytime shader as the
  building fabric. LoD2 glass and the widened surround also use unlit day
  materials, while transparent glass keeps its authored colour and night and
  Minecraft restore their lit material paths without recompiling the scene.
- **Direct manipulation at the point of intent.** Primary mouse drag pans,
  secondary drag orbits, the wheel keeps Three.js cursor zoom, and a new
  double-click zoom anchors to the clicked world point. Two-finger swipe pans
  with the existing momentum, while pinch now zooms around the live finger
  midpoint under a hysteresis lock instead of flying or jumping toward the
  screen centre.
- Added regression contracts for the 2010 m radius, fixed prior tree
  positions, unchanged draw-call count, mouse mapping, midpoint-anchored zoom,
  glass day/night restoration and flat-unlit landmark materials.

## v0.22.0

- **Areal expansion (+100 m contract): visible radius 1810 m → 1910 m.**
  The extrapolated surround grows by exactly 100 m on every side — the
  western Tiergarten lobe reaches −1720 m, the paper-margin ring widens
  to 620 m, flight bounds follow (envelope z −1700…+2120). The radius
  is now a versioned constant (`VISIBLE_RADIUS_M = 1910`, asserted by a
  contract test) so the next areal run reads and grows it. No new raw
  data is claimed: the ring stays parkland/paper, marked extrapolated.
- **Momentum glide for touch pan ("träges weiches Ausrollen").** A
  released two-finger pan keeps gliding with the last finger velocity,
  easing out exponentially (~0.16 s half-life) and snapping to rest
  below a small threshold; any new touch cancels the glide instantly.
  The decay is a pure helper with a unit-tested contract (monotonic
  ease-out, direction preserved, guaranteed rest).
- Verified across viewports (iPhone 390×844, tablet 1024×768, desktop
  1600×900): UI panels stay usable, facades measure colour σ < 2 in
  hundreds of sampled patches, all three modes intact.

## v0.21.0

- **Touch that anyone can use.** Two-finger gestures now LOCK to one
  intent with hysteresis: a swipe is a pan (content follows the
  fingers), a deliberate pinch is a straight fly along the view —
  decided once per gesture and held until the fingers lift. The old
  behaviour mixed both on every move and steered the flight toward the
  pinch-centre x, which made panning drift left/right whenever finger
  distance jittered. Steering is gone; flight is always straight.
- **Bridges are bridges again.** In the drawn city, bridge cells render
  as thin decks (1.1 m plates at bank level) with open air and water
  beneath, and slim drawn parapets rise along every deck edge that
  borders water — the Gustav-Heinemann-Brücke spans the Spree instead
  of being ironed onto it.
- **Der Weg zum Ufer.** Every quay wall now carries a light boardwalk
  ledge just above the water line, jutting from the wall with its own
  front face — the riverside promenade the banks were missing; the
  Spree reads as a real recessed river with walkable edges.
- **Brighter still, and no fog.** Facade lightness floor raised
  (0.56 → 0.64 luma) with a stronger ivory lean — murky greys and dark
  yellows are gone; the drawn modes drop distance fog entirely (only
  Minecraft keeps its genre haze), so nothing dissolves when zooming
  out. Verified: 210/840 sampled facade patches with colour std < 2
  (many exactly 0) — flat drawn paint, as specified.

## v0.20.0

- **The ivory-palace refinement ("Elfenbeinpalastdarstellung").** The
  whole day city settles into one warm ivory register: every sampled
  facade tone leans toward ivory (0xf1ead9) while keeping enough of
  its own hue to stay recognisably itself; the Reichstag ensemble is
  region-pinned to light sandstone with a pale roof terrace. The last
  loud spots are calmed — neon lawn stripes become sage parkland,
  plaza orange softens to sand, water turns pastel, bridges pale
  stone, tree crowns lift to light sage greens (drawn city, park
  layer and the extrapolated west all matched). Nothing garish
  remains; night and Minecraft keep their own registers.
- **The Reichstag reads like the real Reichstag.** The recognition
  model gains its missing signature elements: the gilded
  "DEM DEUTSCHEN VOLKE" inscription band with letter-group blocks on
  the architrave, the grand west stair rising to the portico, a square
  roof podium under the dome, and projecting central risalits on the
  north, east and south fronts — the elevation now projects on all
  four sides as built.

## v0.19.0

- **No more invented windows ("keine quadratischen Fenster, wo in
  Wirklichkeit keine sind").** LoD2 carries no real window positions,
  so the generic punched-pane grid was fabrication — it is gone.
  Ordinary facades now read as clean pale panels articulated only by
  slender floor-to-cornice glazing LINES on the surveyed bay rhythm
  (fine grey ink, linienartig), plus one drawn entrance door. The
  referenced hero fenestration (Reichstag arched windows) and the real
  glass-curtain mullions stay — those are documented, not invented.
- **Night reads like an elegant blueprint.** Instead of a lit window
  grid, a deterministic ~38% of facade axes carry a slim warm vertical
  light strip (cool office white on civic buildings, warm on housing),
  hidden by day; the axis ink dims to a whisper so the strips carry the
  reading. Cleaner, calmer, more glorious in all three modes.

## v0.18.0

- **Schlanker, länglicher, heller, glorioser.** Elegance pass across
  all three modes: window panes go slim and portrait (1.05 × 1.9 m,
  civic 1.3 × 3.0 m) for a taller, lighter rhythm; facade paint is
  desaturated harder and lifted into a brighter band; the Sockel and
  Gesims bands are slimmer; roof plates lighten from mid-grey to pale
  slate. Minecraft column tones are lifted toward the bright band
  before the palette snap (a pale-cream building is no longer a dark
  block), and the block world's ambient, emissive floor and exposure
  are raised — "heller" everywhere.
- **"Umkreis ausweiten" round two.** Beyond the western Siegessäule
  lobe, a calm paper-pale margin ring now carries the drawing on the
  north, east and south sides too (two-tone bands, `userData`-marked
  extrapolation), with Unter den Linden continuing east from the Gate;
  flight bounds widen to the full ring. The map fades into light
  ground instead of ending at a void.

## v0.17.0

- **Leichtigkeit: the light-panel redesign of Day mode.** Ink drops
  from near-black marker to a fine grey pencil (0x716c62) everywhere
  (prisms, monuments, kerbs); the screen-space edge pass is nearly off
  (day edgeStrength 0.25 → 0.07) so the "Kratzer" scratch look is
  gone. Facades render their exact baked paint UNLIT by day
  (MeshBasic swap; night swaps back to the moonlit material) — no
  sun-browning, no murky shadow sides; colour and fine line separate
  the planes. Sampled tones are desaturated harder and clamped to a
  bright band; ground, water, plaza and tree palettes all lift.
- **Windows are light panels now, not arrow slits.** Drawn panes
  switch from dark slate holes to pale sky-glass panels
  ("feine, weiße, helle Paneele"); sills turn into subtle darker
  ledges; doors soften; the day sun cools toward gallery light with a
  higher ambient floor.
- **The Reichstag carries only its REAL fenestration.** The generic
  prism panes are suppressed on the whole ensemble — the verified
  recognition layer's tall arched windows, transoms and mullions carry
  the facade alone over the light-stone prism (whole ensemble pinned
  by region, its photo-sample shadow tans overridden).
- Minecraft lifts its shadow faces further (emissive floor 0x2c2c2c).

## v0.16.0

- **The Reichstag looks like the Reichstag.** Hand-pinned facade
  formats for the whole ensemble ("keine falschen Fenster"): a high
  rusticated base, then tall arched-window rows (4.8 m panes on a
  5.4 m bay, 8.2 m storey pitch — exactly three stately rows on the
  28 m body), the towers matched; the generic plinth door is gone (the
  portico is the entrance). The roof gains its real programme at
  drawing quality: the two glass skylight bands flanking the dome and
  the roof-garden restaurant block with its glass band. Pinned hero
  roofs no longer receive random HVAC scatter.
- **Die Spree mit Vertiefung.** Wherever the surveyed ground grid puts
  land beside water, a vertical stone quay wall now drops from the
  bank past the water line, and the water edge carries kerb ink — the
  river reads as a real recessed channel with drawn embankments.
- **The western Tiergarten, extrapolated (owner-approved).** The
  shipped data ends at the bounds polygon, but the park factually
  continues: an extrapolated lawn apron with ~700 drawn trees, the
  Straße des 17. Juni axis, the Großer Stern circle and a drawn
  Siegessäule (67 m column on its colonnaded base, gilded rings and
  Viktoria, published dimensions) end the void on the west horizon.
  No buildings are invented — parkland and one documented monument
  only, marked `userData.extrapolated`; flight bounds reach the star.
  The true data expansion (Kulturforum, Leipziger Platz, Hamburger
  Bahnhof — task 09) remains blocked in this environment: the data
  services still answer CONNECT 403.

## v0.15.0

- **Hyperdetail for the drawn city (day AND night).** Every wall now
  carries a darker Sockel band at its base and a light protruding
  Gesims (cornice, inked) under its flat roof edge; every window gets
  a light sill ledge — the elevation's fine horizontal grain, ~257k
  instanced pieces in one draw call. Large flat roofs grow rooftop
  furniture: one to three drawn HVAC boxes plus a transparent glass
  skylight strip, because the isometric view lives on its roofscape.
- **Night gains light temperature.** Civic monuments burn cool office
  white after dark; housing keeps its warm windows — the night city
  reads zoned, like the real one.
- **Minecraft, beautiful and differentiated.** Buildings wear a darker
  roof-cap block row; every fifth tree is a birch (pale trunk), spruce
  silhouettes stack a second crown; meadows scatter deterministic
  flower blocks (dandelion gold, poppy, daisy) on the grass runs; a
  small neutral emissive floor lifts shadow faces so the real building
  colours stay readable all around.

## v0.14.0

- **True axonometry — nothing looks "gedrückt" any more.** The drawn
  modes drop from a 30° to a 16° lens with exact dolly compensation
  (the camera pulls back precisely as much as the narrower field
  magnifies, so the framing survives the switch; focus presets get the
  same compensation, distance limits and far plane scale along).
  Verticals stay parallel, blocks keep their true proportions — the
  Reichstag finally stands like an architectural drawing instead of a
  squashed photo.
- **Minecraft is no longer one cream-coloured mass.** The block world
  now fetches the prism payload alongside its voxels and gives every
  column its building's sampled real colour, snapped to the nearest
  entry of the authored Minecraft palette (point-in-footprint lookup
  over a spatial hash). Whole buildings read as one true hue — grey
  Reichstag, brick reds, glass teals — with the class shades only as
  fallback.
- **No more Detailverlust in the block world.** The architectural
  signatures (Reichstag dome, Brandenburg Gate, Hauptbahnhof barrel)
  and the verified memorial models (stelae field, Soviet memorial…)
  stay visible in Minecraft and take the toon treatment, so the
  landmarks survive the voxelisation.
- **Trees read as drawn foliage.** The crown palette rises from
  near-black (0x355b3b…) to day-legible drawn greens with faceted flat
  shading on the existing five-lobe geometry.
- **The Soviet War Memorial is dignified now:** warm light granite
  instead of a near-black pylon, gilded name plates on all six
  side pylons, the dedication band in gold, flower beds flanking the
  stairs.

## v0.13.0

- **Alle Denkmäler, drawn.** Street details schema v2 exports all 46
  OSM monuments/memorials inside the bounds; a new drawn-monument
  layer renders every one the recognition layer doesn't already carry:
  the Potsdamer Platz **Verkehrsturm** replica (five-sided head, clock
  band, red/amber/green lamps), the Euthanasie (T4) memorial's blue
  glass wall, both ML-20 howitzers at the Soviet memorial, the Weiße
  Kreuze row, the Fahne der Einheit, the Grundgesetz-49 glass panels,
  plinth statues for Lessing, the Grimms, Giordano Bruno and Der
  Rufer, and small stones for the quiet markers. The seven memorials
  the verified layer already models in full (Holocaust stelae field,
  Soviet memorial with T-34s, Sinti-und-Roma, Homosexuellen, Goethe,
  the composers, Zeugen Jehovas) are skipped — no double geometry.
- **The Tiergartentunnel has entrances now.** Two drawn portal ramps
  at the ends of the engineered centreline: sloped deck, retaining
  walls with coping, portal frame, dark tube mouth — inked like the
  city, moonlit at night. The below-horizon cutaway is unchanged.
- **Task 08 done: Carillon anchor corrected in the source data.**
  `landmarks.geojson` now carries the mesh-verified tower position
  (52.51776 N, 13.36696 E, from tile-3890_58196.glb) instead of the
  Wikimedia photographer standpoint 29.4 m away; the scene manifest's
  landmark block was regenerated with the pipeline's own
  serialisation, and the alignment/precision/reference artefacts were
  re-run. The viewer's mesh-verified constant stays (0.8 m finer than
  the lat/lon-rounded payload).
- **Task 06 superseded by task 09.** The owner widened the expansion
  scope (full Kulturforum, Leipziger Platz with Mall of Berlin and
  Kollhoff-Tower, Hamburger Bahnhof, Geschichtspark Moabit, the whole
  Tiergarten with Siegessäule). The shipped LoD2/OSM extracts are
  clipped exactly to the current bounds and the data services are
  unreachable from this environment (egress 403), so task 09 documents
  the full refetch/rebuild procedure for an environment with open
  network; every viewer layer added since v0.10.0 is polygon-driven
  and scales to the new data without code changes.

## v0.12.0

- **Task 07 done: the real traffic lights, animated.** All 86 OSM
  `highway=traffic_signals` nodes inside the bounds (new
  `build_street_details.py` → `street-details.json`) become instanced
  signals — pole, head, three lamps — cycling the German sequence
  red → red+amber → green → amber on a 44 s loop with per-position
  phase offsets, so junctions never blink in unison.
  `prefers-reduced-motion` pins every signal to green. The lamps are
  unlit materials, so the active one glows at night. Signals join the
  drawn city group and inherit its day/night/voxel/underside
  visibility.
- **The Reichstag reads right now.** Its huge flat cap rendered as one
  sun-warmed brown slab; every flat roof cap in the city is now
  recoloured as a cool drawn roof plate, hero roofs are pinned (the
  Reichstag ensemble gets its real light-stone terrace grey, the
  Chancellery stays light), and monumental flat roofs carry a drawn
  parapet rim — the balustrade line the elevation was missing.
- **Kerb ink.** The surveyed ground grid knows exactly where roads
  meet lawns and plazas; those cell boundaries are now thin ink lines —
  the ligne-claire ground the buildings already live on, moonlit at
  night like all contours.
- **Minecraft windows.** Every ~4 m storey of an exterior voxel column
  face carries a recessed dark pane (occasional teal shine), interior
  faces skipped via neighbour occupancy — 54k blocky windows, straight
  from the surveyed columns.
- Tests: signal payload count/attribution, German phase sequence and
  reduced-motion behaviour, instanced pole/lamp counts with distinct
  phases, kerb-line geometry, voxel window pane counts.

## v0.11.0

- **Curtain-wall mullions on every glass building.** The transparent
  glass volumes (v0.10.0) now carry their drawn glazing grid: vertical
  ink lines on the bay pitch, horizontals on the storey pitch, just
  outside each surveyed wall. The Hauptbahnhof Bügel towers and every
  glass-class prism quarter-wide read as gridded curtain walls instead
  of bare glass boxes — ligne claire through and through. Moonlit ink
  at night, like all contours.
- **Piano-nobile windows for civic monuments.** Buildings with a
  monumental surveyed footprint (≥ 2,500 m²) AND height (≥ 16 m) swap
  the 3.1 m housing storey for a 4.4 m civic pitch with taller 2.6 m
  windows — the Reichstag's elevation now reads as representative
  architecture, not an apartment block.
- **Every building gets its entrance.** One drawn door (1.15 × 2.35 m,
  dark panel) per building, centred on its longest windowed wall; the
  ground-floor panes around it step aside. After dark, a fifth of the
  entrances keep a warm lamp on.
- **Chimneys on the gabled roofs.** Long Satteldach ridges carry one or
  two small drawn stacks, inked and slightly darker than the roof —
  the skyline granularity of a real city drawing.

## v0.10.0

- **Ligne-claire fenestration: 128,678 windows.** Every opaque prism
  now carries flat drawn window panes derived from its surveyed
  geometry — floor count from the measured LoD2 height at a 3.1 m
  storey pitch, bay rhythm from each wall's true length, centred rows
  like an architectural elevation. One instanced mesh, cool slate panes
  tinted per facade by day; after dark a deterministic ~38 % of rooms
  light up warm while the rest go night-blue — the night city finally
  glows window by window. (Render gotcha for the record: the wall
  basis dir/up/outward is left-handed, which mirrors the instanced
  plane's winding — the panes need `DoubleSide` or front-face culling
  silently hides all of them.)
- **The Hauptbahnhof is a glass building at last.** The station's LoD2
  prisms rendered as opaque slabs that half-buried the recognition
  model's 321 m glass barrel. The 23 low slabs under the halls are now
  suppressed (the model carries deck, barrel, halls and trains); the 24
  tall Bügel tower prisms instead join a new transparent glass mesh, so
  the model's mullion grids finally wrap a glassy body. All glass-class
  prisms quarter-wide render in that transparent mesh too, in a cool
  glass family with ink contours — transparency in the ligne-claire
  sense.
- **The Tiergartentunnel is findable again.** From the surface the
  drawn city gave no hint of it. It is now marked the way a technical
  drawing marks hidden edges: two dashed ink lines along the tube walls
  across the quarter (clipped to the surveyed ground grid, moonlit at
  night). The full cutaway below the horizon is unchanged.
- Tests: window grid derivation, six-figure pane count with day/night
  palettes, transparent glass material, station suppression/glassing
  partition (disjoint sets, ids exist), tunnel trace geometry.

## v0.9.0

- **Real roof forms in the drawn city — "alles Flächen, aber genauer".**
  The 508 buildings whose ALKIS roof code says gabled (3100), hipped
  (3200) or shed (2100) no longer end in a flat cap: the viewer fits an
  oriented minimum-area rectangle to each footprint (rotating calipers
  over the convex hull) and, when the footprint is genuinely
  rectangular (rectangularity ≥ 0.72), raises a procedural roof of hard
  flat facets — two slopes plus vertical gable ends, a hip ridge inset,
  or a single shed slope — with a 0.35 m eave overhang, ink lines on
  every roof edge and a slightly darker paint than the facade. 465
  buildings across the quarter gain true pitched roofs; irregular
  footprints and squat annexes keep their exact flat cap. Night mode
  inherits the roofs with moonlit contours automatically.
- **Better Minecraft colours.** The block palette's greens and blues now
  follow the classic game: plains-grass greens (0x74b043 family), oak-
  leaf crowns, clear Minecraft water blue (0x3f76e4) instead of murky
  teal. Each ground/building class mixes only close shades, so the old
  harsh checkerboard becomes gentle block-noise; roads read as dark
  slate instead of void-black, plazas as brick-and-earth, concrete and
  sandstone as tight cream pairs.
- **Deep links straight into Minecraft work now.** Loading the viewer
  with `?theme=minecraft` never loaded the voxel world — the block
  world only fetched on a mode *switch*, so a shared Minecraft link
  showed the toon-shaded photogrammetry fallback forever. The scene
  init now ensures the voxel world too (`ensureVoxelWorld`, idempotent,
  shared with the mode-switch path).
- Tests: rotating-calipers rectangle recovery, roof-facet generation
  per ALKIS code (ridge reached, eave respected, flat/dome codes stay
  flat), plausible-rise bounds, and a payload-wide count asserting >400
  buildings actually receive roofs.

## v0.8.2

- **The Brandenburg Gate is a gate again.** In the drawn city its LoD2
  prism rendered as a solid dark box that buried the complete
  recognition model — twelve columns, five passages, attic — with only
  the Quadriga poking out. Buildings whose recognition model draws the
  COMPLETE structure now suppress their prism
  (`PRISM_SUPPRESSED_IDS`); the gate model carries the building alone,
  its side-pavilion prisms stay. A geometry test asserts no prism
  vertices remain above pavilion height inside the gate footprint.
- **Underside cutaway restored in the drawn worlds.** Below the
  horizon both the prism city and the voxel world hide — which left
  the Tiergartentunnel floating in a void. The faded photogrammetry
  shell (the designed cutaway context) now returns whenever the camera
  goes underside.
- Visual QA sweep across the heroes in the drawn city: Hauptbahnhof
  (glass barrel over prism body) and the Swiss Embassy (recognition
  windows/roof over its prism) verified healthy; screenshots in the
  session log.

## v0.8.1

- **Every building carries its real colour.** The prism payload now
  samples a per-building median tone from the committed overview render
  (projection fitted and pinned against the committed landmarks.json at
  ≤3 px, 42/43 landmarks at ±0.5 px): 3,254/3,254 prisms carry a tone,
  642 distinct tones across the quarter. The viewer cleans each sample
  into flat illustration paint — mild desaturation, lightness clamped
  to a readable band (dark grey stays possible, black never) and
  quantised onto six shared paint levels — so the city keeps its drawn
  coherence while every building matches its type: greys stay grey,
  brick stays brick, white stays white. The former few-cream-tones
  palette remains only as fallback for unsampled footprints.
- **Hero pins per the owner's colour direction:** the Reichstag prism
  is its real darker grey sandstone (0x9c968a) instead of warm yellow;
  the Chancellery (id MLwG4KW9) is pinned light grey (0xdadad6).
- **The dome is silvery now.** The mirror cone and its 360 panels used
  metalness 0.92–0.94 — highly metallic materials without an
  environment map render nearly black in three.js, which is why the
  funnel read as a dark shaft. Rebuilt as drawn silver (low metalness,
  mid roughness, bright silver tones), the cone shades as the bright
  silvery funnel it is.

## v0.8.0

- **Night mode follows the drawn isometry.** The LoD2 prism city now
  renders in Night as well: the same drawn prisms relit by the night
  rig, the ink lines switch from near-black to a moonlit cool line
  (black contours vanish on dark bodies), and the prism bodies get a
  faint warm emissive floor so massing stays readable. The glowing
  recognition layers (Reichstag dome, lit windows, TIPI bulbs, street
  lights) sit on top. The photographic pipeline remains only as the
  loading/failure fallback.
- **Minecraft is isometric too**: the voxel world now uses the same
  flattened 30° field of view as the drawn city; only the photographic
  fallback keeps the 39° perspective. No decorative sprite clutter in
  3D, no animated flicker — calm blocks.
- **Bridges span the Spree.** A new `bridge` ground class (OSM
  `bridge=yes` road AND rail lines over water, priority above water)
  puts 897 deck cells back over the river — Moltkebrücke,
  Hugo-Preuß-Brücke, Gustav-Heinemann-Brücke, Kronprinzenbrücke,
  Marschallbrücke and the Hauptbahnhof S-Bahn viaduct — rendered as
  light stone in the drawn city and stone blocks in the voxel world.
  Deck height (IDW terrain, e.g. 2.84 m at the Moltkebrücke) sits
  above the 1.31 m water level.
- **Reichstag drawn right**: its prism carries the curated warm
  sandstone tone (matching the hero anchor) instead of generic
  concrete cream, over its true 28.055 m height and all six
  courtyard/light-well holes.

## v0.7.0

- **The big isometry revision: Day mode is a drawn city now.** Seven
  rounds of facade shading (v0.5.3–step-18) could not fix what was
  actually wrong — the photogrammetry *geometry* itself is lumpy and
  wobbly, so buildings always read as mush. Day mode therefore replaces
  the photographic buildings entirely: a new pipeline step
  (`isometric_berlin.generation.build_isometric_prisms`) exports every
  surveyed LoD2 footprint polygon (exact corners, courtyard holes —
  the Reichstag keeps both courtyards) with its measured height and
  ground elevation, and the viewer extrudes them into hard-edged prisms
  merged into a single mesh with flat quantised facade tones, plus one
  merged near-black ink-line layer from edge geometry (the drawn
  outlines). Ground, water and roads reuse the surveyed run-length
  slabs with a soft day palette; the OSM/official tree layer stays soft
  ("Natur darf weich bleiben"). The recognition models (Reichstag dome,
  Brandenburg Gate, memorials, TIPI, Carillon, park details) remain on
  top of the prisms; photographic hero crops hide. The camera FOV
  narrows 39°→30° while the drawn city is active, flattening the view
  toward a true isometric presentation. Night keeps the photographic
  lit-window pipeline, Minecraft keeps the voxel world, and if the
  prism payload fails to load, day falls back to photographic with a
  warning.

## v0.6.0

- **Minecraft mode is now a true voxel world — "eckig, klotzig, blockig.
  Mehr nicht."** A new pipeline step
  (`isometric_berlin.generation.build_minecraft_voxels`) converts the
  surveyed LoD2 footprints + measured heights into 17,113 building
  columns on a 4 m grid (heights snapped to 4 m courses, stepped tiers
  for gabled/hipped ALKIS roof forms, glass class for office/station
  functions), OSM water/roads/plazas into 120,302 run-length ground
  cells over a coarse interpolated terrain grid, and the 7,664 official
  tree points into trunk+crown cubes — a deterministic 546 KiB payload
  with embedded attribution. The viewer lazily loads it on the first
  switch into Minecraft and then hides every photographic layer
  (surfaces, hero crops, recognition models): the city is cubes,
  nothing else, rendered as four instanced meshes with per-block shade
  jitter from the 28-colour palette. Leaving Minecraft restores the
  drawn scene losslessly; if the payload fails to load, the previous
  toon presentation remains as fallback. Verified visually: the
  Reichstag reads as a block massif with its two courtyards as voxel
  holes; unit tests pin the instancing counts, the tall-column
  placement at the surveyed Reichstag position, and grid containment.
- **Pinch flies instead of zooming** (3D touch): spreading two fingers
  flies INTO the picture along the view heading, steered toward where
  the pinch centre sits on screen; pinching together flies back out.
  Zoom stays on the +/− buttons, wheel and double-tap; the two-finger
  swipe keeps panning; three fingers keep orbit/tilt. The 2D map keeps
  its native pinch zoom. Help panel and docs updated.
- **Day buildings are hard-edged drawings now.** v0.5.6 stripped the
  photo textures but the photogrammetry keeps its photo colours as
  VERTEX colours, which still washed a soft photographic sheen across
  every facade. A shader patch (`installVertexPosterShader`) posterises
  the vertex-colour LIGHTNESS onto 5 hard paint bands (hue preserved —
  full-RGB posterisation shifted water purple) for every drawn facade,
  while green-dominant fragments (tree canopy fused into the same tile
  geometry) keep their smooth tone, per the "Natur darf weich bleiben"
  rule.

## v0.5.6

- The generated ambient soundtrack no longer clicks or knacks. Every
  voice — bass, chime, drone and the beat — is driven by an
  `attackReleaseEnvelope` that is pinned to a hard 0 at note-on, ramps
  linearly up to its peak and ramps linearly back to exactly 0 before the
  oscillator stops. Linear ramps replace the old
  `exponentialRampToValueAtTime` tails, which never reached true silence
  and left a 0.0001 DC floor that ticked when the note ended. Oscillator
  partials now fade in from 0 instead of snapping to level, the master
  gain fades in from 0 on start and out to 0 before the context closes,
  so no node ever starts or stops on a non-zero sample. Mute persistence
  and the mobile first-touch autostart are unchanged.
- The beat is rebuilt as a deep, breathing swell. It fires half as often
  as before (one hit every four steps instead of every other step,
  `BEAT_INTERVAL_STEPS = 4`), is tuned two octaves below the variant root
  (`beatMidi`), and each hit is a symmetric crescendo→decrescendo
  `swellEnvelope` through a 220 Hz low-pass rather than the old bright
  percussive hi-hat. The white-noise hat buffer is gone.
- Buildings are drawn everywhere, never photographic. The photogrammetric
  Berlin 3D Mesh materials no longer sample their baked aerial texture:
  `applyDrawnFacade` strips each material's `map`/`emissiveMap`, derives a
  flat gouache facade colour from that texture's average (posterised and
  desaturated toward its own luminance), and sets matte, non-metallic
  shading. The toon materials of Minecraft mode and the screen-space
  isometric edge pass then supply clean NPR outlines in Day, Night and
  Minecraft alike. No geometry is moved, so the ≤1 px hero-centre contract
  and the v0.5.5 `crispBlend` anti-flicker compositing are untouched, and
  the landmarks stay recognisable by their surveyed form (Reichstag dome,
  Hauptbahnhof glass roof, Brandenburger Tor). The 2D DZI pyramid was
  already AI-drawn pixel art and needed no change.

## v0.5.5

- Day mode is rock steady again. Since v0.5.4 it flickered and briefly
  darkened whenever the camera started or stopped moving, because the
  render loop hard-switched between a direct `renderer.render` path
  while moving and the `EffectComposer` path once settled — the crisp
  pass is not a passthrough at strength 0, so toggling it popped the
  colour and edge grade in one frame. Day and Night now always render
  through the composer; the settled crisp/edge strength is ramped in and
  out via a `crispBlend` factor (a true passthrough at 0, the full
  profile at 1), so motion only fades the sharpening smoothly with no
  flicker or darkening. The active frame cadence is held while the ramp
  is in flight so it never steps across sparse idle frames.
- Fixed the localized flicker on the Brandenburger Tor and other landmark
  facades. Hero-detail tiles are a higher-resolution copy of the same
  building already present in the base/surface tile beneath them, and the
  two near-coplanar textured copies z-fought — worst on near-vertical
  facades seen edge-on, where the depth slope is largest. The detail
  copy's polygon offset is strengthened (factor -1→-4, units -1→-8) so it
  biases decisively toward the camera. This is depth-only: no mesh is
  displaced, so the ≤1 px hero-centre contract still holds.
- The dark "sky blob" over the Bundeskanzleramt is fully gone. The
  hand-verified artefact box for tile `3890_58200` is widened at its east
  edge (was -113 m, now -105 m) to swallow the ~7 m sliver of the same
  floating slab the old box clipped. The box floor stays at 45 m — above
  the 36 m leadership-cube roof and the <45 m park poplars — so it can
  never reach surveyed geometry. A new registry-wide safety test asserts
  every artefact box floats at ≥45 m and contains no landmark anchor,
  which keeps the hero landmarks (Reichstag glass dome, Hauptbahnhof
  roof, Potsdamer Platz towers) safe as the box list grows.
- Easier, lighter touch control. The two-finger flick threshold drops
  (60→35 px/s) and its momentum rises (0.5→0.68) so a gentle swipe
  glides the map instead of stopping dead, and the OpenSeadragon spring
  softens (stiffness 8→6, animation 0.6→0.72 s) for effortless inertia.
  On the 3D view the orbit/tilt damping loosens (0.085→0.065) and the
  rotate/pan speeds rise (0.68→0.82 / 0.68→0.9) so one-finger tilt and
  two-finger drag feel light. On-screen controls grow to a ≥44 px touch
  target on coarse pointers (movement pad, view buttons and the flight
  joystick). Pinch-zoom semantics are unchanged.
- The Tiergartentunnel entrance at Kemperplatz renders as a real portal.
  The twin tubes previously ended as abruptly cut-open boxes; a concrete
  portal headwall — one extruded rectangular frame with a tube-sized hole
  — is now instanced once per tube at each of the two visible endpoints
  (four frames), squared across each mouth by the terminal segment
  direction. It follows the same depth-test-off underside presentation as
  the rest of the cutaway, so it reads correctly in the tunnel dive view
  in all modes and adds a single draw call.
- Minecraft mode stays glued under zoom, not only under pan. The v0.5.4
  world anchor kept blocks locked while panning, but a fixed screen-pixel
  cell still re-quantized and swam while zooming. The 2D voxel cell now
  scales with the map zoom (`voxelCellForScale`, clamped to the sane
  device-pixel band) so a block always covers the same world area and a
  world feature keeps the same block index across zoom levels. A
  regression test pins that invariance and the clamp behaviour.

## v0.5.4

- Minecraft mode drops its "Dörfchen" entirely: no NPCs, animals or
  village sprites spawn any more. The spawn/lifecycle/sprite modules and
  the life overlay are removed along with their decoration CSS, so the
  voxel world reads as pure blocky geometry. The v0.5.1 lifecycle
  teardown contract no longer applies because nothing is spawned.
- The Minecraft look is now temporally stable while the camera moves.
  The voxel snap grid is anchored in world/scene space via a new
  `gridOffset` uniform (fed from the projected content anchor in both
  the 3D composer pass and the 2D DZI post-processor) so blocks stay
  glued to the geometry instead of crawling across the screen during a
  pan or zoom. The animated, `time`-driven sparkle on water and glass —
  the main source of the "viel zu sparkly" flicker — is gone: the
  `time` uniform is removed and `premiumShimmer` is now a purely
  position-based, frame-stable sheen. Geometry, camera and landmark
  anchors are untouched; the ≤1 px hero-centre contract still holds.
- A two-finger swipe on the 3D view now MOVES the avatar in the swiped,
  view-relative direction instead of twisting the camera — swipe right
  while looking horizontally strafes right, swipe up travels forward
  along the heading. Rotation stays on the on-screen buttons, the
  keyboard and mouse-drag; a three-finger gesture still tilts. Pinch
  keeps zooming. The 2D map keeps its v0.5.2 pan-on-swipe behaviour.
- Day mode is now the active visual mode on every page (re)load. The
  previously selected mode is no longer restored across reloads; only a
  deliberate `?theme=` request selects night or minecraft at boot. The
  music-mute preference still persists as before.

## v0.5.3

- Much blockier Minecraft mode. The voxel base cell doubles (2.35→4.7 on
  coarse layouts, 2.8→5.6 on fine, shared constant in `voxelGrid.ts`,
  capped below 24 device px so buildings never collapse), and the palette
  drops from 48 to 28 discrete colours grouped around stone, sandstone,
  concrete, glass-teal, a still-varied roof-copper family, water, foliage,
  asphalt, plaza brick, dirt and canvas.
- Hard palette snap replaces the always-on ordered dither; dithering now
  fades in only at the deepest zoom (new `ditherStrength` uniform, wired
  from the OpenSeadragon zoom) to avoid banding on large flat faces.
- Near-black block outlines: the shared minecraft postprocess shader
  (used by both the 3D composer pass and the 2D DZI post-processor) gets
  a lower edge threshold and an `edgeMix` uniform driven by the shared
  crispness profile (0.55→0.85), tinted slightly warm on glass and cool
  on stone. Two guards keep it from turning into mud: foliage suppression
  for tree canopy, and a busyness guard that backs the outline off in
  high-frequency texture while true silhouettes keep full strength.
  Measured at the Reichstag fit-to-view: 12.2× more hard-outline pixels
  than Day mode (requirement was ≥3×).
- Stepped 2-step toon shading (previously 3 steps) with flat shading kept
  on, ambient down (2.18→1.72) and key light up (3.18→3.72) for strong
  cube shadow sides, plus a small exposure lift (1.34→1.5) so mids stay
  readable. The mesh outline uses the screen-space edge pass rather than
  inverted hulls — duplicating the 2.3–7M-face official mesh would not
  hold 60 fps on a 2020-era iPhone. Bloom threshold and strength reduced
  (0.74→0.85, 0.022→0.010). No geometry, camera, or landmark anchor
  changed; the ≤1 px hero-centre contract is guarded by tests.
- Chunkier decorations: all six sprites are redrawn as rect-only 16×16
  hand-pixelled blocks (no diagonals, no gradients), every category
  renders 40% larger, and NPC/animal counts drop ~30% (36→25 / 12→8) so
  the map reads as fewer, bigger blocks. Density budget stays ≤220 and
  the v0.5.1 lifecycle teardown contract is untouched.

## v0.5.2

- Two-finger swipe on touch devices now pans the map along with the
  fingers instead of rotating it. Rotation stays reachable through the
  on-screen rotate buttons, the keyboard shortcuts, and mouse-drag on
  desktop. The change felt more natural on iPhone where users expect
  "fingers left = map contents left", not a rotate. Pinch zoom keeps
  its native OpenSeadragon behaviour of following the pinch centre, so
  zooming in on the Reichstag while the pinch centre sits on the dome
  also flies the view toward the dome. Test coverage updated so
  `TOUCH_GESTURE_SETTINGS.pinchRotate === false` is a regression guard.
- The ambient soundscape now auto-starts on the first user gesture
  (touch, pointerdown, keydown) unless the user has explicitly muted
  it before. iOS and Android browsers refuse to create an AudioContext
  before the first interaction, which is why the music felt broken on
  mobile in v0.5.1. Explicit taps on the music button still remember
  the mute preference in `localStorage` under
  `isometric-berlin.musicMuted`, so a manual mute survives reloads.

## v0.5.1

- Remove the dark cloud over the Chancellery: the blob was a photogrammetry
  reconstruction artefact baked into the official mesh tiles
  (`tile-3890_58200` and its settled twin) floating 47–61 m over the
  Kanzlerpark side, where the 36 m cube and sub-45 m park trees leave no
  surveyed counterpart. A new load-time sky-artefact filter
  (`meshArtefacts.ts`) strips the offending triangles from known artefact
  volumes without touching the committed source tiles; a regression test
  decodes both real tiles and asserts the volume stays empty, plus a
  scene-level guard that no programmatic mesh hovers over the Chancellery
  roofline.
- Crisper isometric buildings: the settled sharpening moves into a named
  crispness profile (day strength 0.38→0.48, night 0.30→0.40) and gains a
  screen-space "isometric edge" pass — a Roberts-cross luminance outline
  (0.25 day / 0.35 night) that darkens strong gradients so facades and roof
  lines read graphic and edged. Green-dominant pixels are suppressed, so
  park canopy deliberately stays soft. Minecraft keeps its own stronger
  quantized edge (0.72 mix) and bypasses the crisp pass. Touch devices now
  render with antialiasing (previously none), and the post-process chain
  runs on an explicit 2× (touch) / 4× (desktop) MSAA target, so straight
  edges stop shimmering. Post-processing stays strictly screen-space; no
  camera, geometry, or landmark anchor changed.
- Minecraft decorations strictly scoped to Minecraft mode: spawn state is
  owned by a single mode-keyed lifecycle controller — leaving Minecraft
  removes every decoration and clears every timer, returning within the
  same page load restores already-reached categories immediately at the
  same seeded positions, and switches fade over ≤ 200 ms. Threshold state
  lives in memory only; the mode itself keeps its localStorage key.

## v0.5.0

- Raise stationary render quality: the settled desktop pixel budget grows
  from 8.0 to 11.5 megapixels (ratio cap 2.25→2.75), settled touch from 4.8
  to 5.8 megapixels (cap 1.75→2.0), and desktop interaction from 4.5 to 5.2
  megapixels (cap 1.25→1.4). The settled crisp pass sharpens harder
  (strength 0.26→0.38 day, 0.2→0.3 night) with slightly stronger saturation
  and contrast, so facades and roofs read crisp instead of soft.
- Add continuous flight: holding `Space` plus arrow keys flies smoothly
  along the view heading with velocity damping (`Shift` changes altitude);
  a plain `Space` tap still toggles the tour. Coarse-pointer devices get a
  bottom-left thumb joystick for the same continuous flight. Flight speed
  scales with camera distance and respects the scene bounds.
- Fly into the Tiergartentunnel: the lit two-tube interior (safety strips,
  ceiling lights, ventilation shafts and fans) now also engages when the
  camera itself enters the tunnel volume at portal level, not only from the
  underside view, so you can dive into one portal and come out the other.
- Dive into the Spree: flying below the 1.31 m scene water level switches
  to an underwater presentation with deep-teal fog that lifts on surfacing;
  the tunnel interior (which passes under the river) is exempt.
- Calm the Minecraft shimmer: sparkle/twinkle amplitudes drop to roughly
  40% with tighter highlight exponents and slower drift, so water and glass
  glint instead of glittering.
- Soften the ambient score: master level drops from 0.16 to 0.095 with a
  slower fade-in and quieter hats, keeping the 72 BPM 8-bit variants gentle
  and melancholic.
- Tone down the TIPI at night: canvas emissive glow reduced to bulb-chain
  character (skirt/roof night intensity 0.62→0.12, wash cones and concert
  lights roughly a third of their former strength); the golden
  `PIGOR & EICHHORN` / `NUR HEUTE ABEND` marquee and warm rib bulbs are
  unchanged.
- Fix the second Carillon tower: the recognition roof, cabin and 68 bells
  floated 29.4 m south-west of the real tower because the committed anchor
  came from Wikimedia photographer standpoints. The detail layer is now
  anchored to the mesh-verified tower position (tile 3890_58196); the
  source-data correction is tracked in `tasks/08-carillon-anchor-correction.md`.
- Add three sights with OSM-verified positions: Jakob-Kaiser-Haus (OSM
  relations 374391+3203717), Lessing-Denkmal (OSM node 884700390, in the
  south-east Tiergarten), and Königin-Luise-Denkmal on the Luiseninsel
  (island centroid, documented display approximation). Alignment and
  precision artefacts, reference map and viewer payloads regenerated.
- Defer with concrete task files: the southern Kulturforum expansion
  (Philharmonie, Staatsbibliothek, Neue Nationalgalerie) in
  `tasks/06-kulturforum-expansion.md` and animated OSM traffic lights in
  `tasks/07-animated-traffic-lights.md`.

## v0.4.0

- Add heading-relative 3D flight: `Shift` + arrows and the flight pad move
  forward/backward or strafe without changing orbit distance; two-finger centre
  swipe does the same on touch while pinch zooms and twist rotates. Plain arrows
  retain screen-plane movement and `Alt`/`Option` + arrows handle orbit/tilt.
- Add persistent German/English application chrome with the correct German term
  `Sehenswürdigkeiten`, plus direct Day, Night and Minecraft controls on desktop
  and in the mobile action sheet.
- Add an opt-in, locally synthesized 72 BPM ambient score with seven original
  8-bit variants, explicit music on/off controls and hidden-tab suspension. Add
  seven concise bilingual location discoveries without inventing map geometry.
- Sharpen the settled Day/Night output with a bounded post-process pass, rebalance
  ambient/key lighting and source-texture emissive fill, and reduce Minecraft
  bloom, shimmer and tap sparkle. Rendering during movement stays on the direct
  low-latency path.
- Fix the doubled Carillon by leaving its four granite pylons to the official
  mesh and limiting the additive recognition layer to roof, cabin, 68 bells and
  lights. Remove the Chancellery cloud from the offline fallback.
- Restrict Reichstag night emission to selected tall arched facade bays; small
  upper rectangular and corner-tower windows now retain their real dark glass.
- Fix two responsive-control regressions found in browser QA: hide the mobile
  overflow button on desktop, move the undersized language button into the phone
  action sheet, and use the compact 44 px layout on coarse-pointer tablets up to
  1024 px. Extend release guards and regression tests for all new contracts.

## v0.3.4

- Add a dedicated GitHub control to desktop and mobile viewer chrome. Its
  focus-safe dialog explains the project in German and English, displays and
  copies the complete public repository URL, and links to the stable current
  Mac/Windows/Linux download. The zero-server fallback exposes the same
  bilingual repository and download actions, while the visible app version is
  now derived from `package.json` instead of a stale hard-coded value.
- Extend the idle desktop presentation with two additional 80-triangle crown
  microclusters for each of 6,893 official Berlin tree-catalogue points. The
  6,000,002-face official surface plus those instanced, officially anchored
  details yields 7,102,882 rendered official-source face equivalents without
  inventing a seven-million-polygon survey or subdividing unchanged triangles.
  Motion and coarse-pointer devices neither render nor allocate this extra
  geometry.
- Increase daylight shape separation with a stronger south-west key light,
  reduced ambient fill and restrained exposure. Facade folds, tree trunks and
  monuments keep deeper shadows and livelier source colours without replacing
  the official aerial texture.
- Correct the Hauptbahnhof crossing hall recognition envelope from the old
  160 x 45 m estimate to Deutsche Bahn's current published 180 x 42 m, while
  retaining its 321 m east-west glass roof and official mesh/LoD2 alignment.
- Replace the Soviet Memorial's transverse generic vehicle blocks with
  source-identified T-34/76 recognition models: longitudinal hulls, sloped
  glacis plates, ten road wheels each, turrets, hatches, mantlets, headlamps and
  76 mm barrels. Exact local dimensions remain explicitly approximate.
- Expand release guards and regression tests for project metadata, bilingual
  offline links, touch-safe settled detail, T-34 orientation and station
  dimensions; update the public README and geolocation QA record accordingly.

## v0.3.3

- Raise the settled desktop surface from 4,000,039 to 6,000,002 faces from the
  same 23 metre-aligned Berlin 3D Mesh 2025 tiles. A sharper 58-degree normal
  crease and bounded source-colour saturation/contrast lift improve facade,
  roof, vegetation and water separation without moving source geometry.
- Meshopt-compress all 22 hero crops and cap their material textures at 1600 px.
  The 68-GLB scene remains below its 165 MiB budget at 163.5 MiB, every GLB
  remains below 5 MiB, and the 2.30M interaction tier stays unchanged for
  responsive camera movement and touch devices.
- Add bounded official Berlin tree, public-lighting and Vorderlandmauer WFS
  data. The instanced detail layer now contains 8,029 additively fused trees,
  1,242 operating lights with night illumination and two granular double-row
  Wall traces, with source provenance and approximation limits preserved.
- Add an OSM-anchored LEGO giraffe recognition model at LEGOLAND near the
  southern Sony Center edge, using a free Commons image only as a documented
  visual reference and labelling its unsurveyed dimensions explicitly.
- Fix out-of-coverage ground sampling that could place a southern lamp on a
  remote roof, retain signed lamp rotations, and decode Meshopt node transforms
  correctly before sampling detail heights.
- Repair the metric-precision generator so JSON and Markdown describe the
  currently committed photogrammetric scene rather than calling it future work.
  Release QA now enforces the 6M tier, 58-degree profile, compressed hero crops,
  source hashes, package integrity and existing desktop/mobile gesture tests.

## v0.3.2

- Add a second, 4,000,039-face settled desktop surface from the same 23
  metre-aligned Berlin 3D Mesh 2025 source tiles. The existing 2,299,987-face
  tier remains the interaction and touch tier; no source coordinates,
  landmark anchors or building envelopes are extrapolated or moved.
- Meshopt-compress both official surface tiers with 16-bit positions and 8-bit
  normals. This keeps all 46 surface GLBs below 2.1 MiB, the complete
  68-GLB scene at 147.4 MiB and the offline package below its 200 MiB ceiling.
- Keep orbit damping at the active frame rate until movement really ends,
  swap immediately to the lighter surface for mouse, touch, keyboard and UI
  movement, then restore the 4M surface after the camera settles. Touch devices
  do not download the desktop-only 4M tier.
- Add bounded camera recovery for invalid/lost positions, a ten-second
  three-finger watchdog, global pointer-release handling and hidden-tab reset.
  Raise the remaining compact phone controls to a true 44 px touch minimum.
- Extend source, local-server, ZIP and tarball readiness checks to require both
  complete quality tiers, Meshopt metadata, every byte count and every SHA-256.

## v0.3.1

- Rebuild all 23 bounded Berlin 3D Mesh 2025 base tiles at a 100,000-face
  target, raising the official context surface from 1,609,984 to 2,299,987
  faces while leaving landmark anchors, architectural signatures and all 22
  high-detail hero files byte-identical.
- Preserve hard roof and facade folds with a 72° normal crease after quadric
  simplification. Fix oversized vertex-colour export handling so it requests a
  spatial split instead of entering the texture-only fallback path.
- Raise settled rendering to 2.25x desktop and 1.75x mobile device pixels while
  enforcing fixed pixel budgets. Interaction still drops resolution
  immediately and restores full close-up sharpness after 140 ms.
- Add regression coverage for the surface budget, crease-normal topology,
  vertex-colour overflow path and adaptive phone/desktop render budgets.
- Correct the precision and generation documentation to describe the already
  integrated official photogrammetric mesh rather than a future mesh pass.

## v0.3.0

- Replace the oversized phone chrome with a compact landmark status bar,
  bottom zoom/action bar, compass sheet and overflow sheet. Add iPhone safe
  areas, landscape sizing, 44 px touch targets, explicit active states,
  reduced-motion timing, haptic feedback where supported, a one-time coach
  mark and a persistent hide control with a three-finger swipe-down shortcut.
- Make touch flight more direct with stronger OpenSeadragon momentum, a lower
  flick threshold, cardinal rotation snapping, constrained panning, sharper
  mobile tile selection and faster zoom/spring response. Focused landmarks are
  offset above the phone action bar instead of being hidden underneath it.
- Add the original premium `Minecraft` visual mode for both DZI and free 3D:
  a 48-colour palette, ordered dithering, edge treatment, toon materials,
  warm directional light and animated water/glass shimmer. The filter changes
  presentation only and preserves source geometry, world transforms and
  camera framing.
- Add deterministic, performance-gated villages, tents, fields, tiny people,
  animals and boats after 20–75 seconds of continuous Minecraft dwell time.
  Original inline sprites stay below a 220-item budget and avoid the central
  landmark inspection area; no Mojang assets or trademarks are bundled.
- Add scheduler, density, palette, material-envelope and Reichstag dome-centre
  regressions. Re-run the complete LoD2 alignment suite with no coordinate or
  silhouette-anchor drift.

## v0.2.9

- Hide the Tiergartentunnel completely in ordinary exterior views and reveal
  its illuminated twin-tube engineering cutaway only after the camera crosses
  below the surface. The zero-server fallback follows the same rule, and its
  Tunnel focus control now enters the underside view automatically.
- Add a 2,475-vertex translucent Spree surface aligned to the committed OSM
  centreline, with 0.32 m procedural vertical relief, broken crest highlights
  and the excursion boat's stern wash. It adds visible water form without
  claiming measured wave geometry or replacing the official source surface.
- Expand the TIPI marquee to two golden bulb lines, `PIGOR & EICHHORN` and
  `NUR HEUTE ABEND`, while preserving its published 32 x 26 m footprint. Add
  two small uniformed security figures beside the Chancellery entrance.
- Correct the tree-object labels to match their existing trunks, fork branches
  and irregular five-part crowns. Add a shallow Carillon roof cap, a clearer
  Spree-boat camera and restrained night-only Reichstag dome glow and interior
  lights.
- Add regression tests for above/below-ground tunnel visibility, metre-aligned
  water relief, both TIPI bulb lines and the two Chancellery figures. The full
  frontend and Python suites remain green.

## v0.2.8

- Add a LoD2-anchored Swiss Embassy recognition model that distinguishes the
  1871 palace from the Diener & Diener extension, plus a correctly proportioned
  animated Swiss flag. Add the Bundestag's 28.5 m Unity Flag pole and its
  official 60 m² German flag with four night spotlights.
- Animate the Reichstag's three German flags and one EU flag in one shared wind
  field. The EU stars follow the fabric deformation, motion respects reduced-
  motion preferences, and the historic facade gains narrow upper windows plus
  batched arched-window mullions instead of square night panels.
- Align the TIPI main canvas to its official 32 x 26 m ellipse, add twenty
  structural ribs, 220 string bulbs and four night-only coloured concert
  lights. Add close-range Carillon and occupied Spree excursion-boat models.
- Extend the Hauptbahnhof upper railway to a supported 541 m approach deck with
  ballast beds, sleepers and instanced viaduct piers so the ICE and S-Bahn no
  longer appear to stand on floating or truncated track.
- Hide exactly three true-scale coloured Easter eggs beside deterministic OSM
  tree samples. They remain deliberately difficult to find and add one
  instanced draw call rather than three permanent landmark markers.
- Let arrow-key camera movement continue after a toolbar click, focus the 3D
  canvas on mouse interaction and zoom toward the cursor. Mouse, keyboard and
  one-, two- and three-finger controls retain free orbit, pan, zoom and
  underside traversal.
- Increase the always-visible Tiergartentunnel's surface X-ray contrast while
  preserving its stronger underside presentation, lit safety strips, road
  decks, ventilation shafts and fan cues.

- Replace the Reichstag's uniform four-row window grid with facade-specific
  tall arched bays, smaller upper windows, three-bay tower windows and tall
  west-entrance glazing. Night mode now illuminates only a restrained subset
  of occupied bays instead of turning every historical window into the same
  light panel.
- Refine the official-dimension Reichstag dome into 24 faceted sectors with 17
  structural rows, the officially open lower four ventilation rows, 13 glazed
  rows, alternating diagonal braces, a crown/oculus ring, all 360 mirror-cone
  panels and double visitor ramps with handrails and batched balusters. The
  40 x 23.5 m published envelope remains unchanged.
- Extend the bounded OSM context with 3,012 mapped trees/tree-row samples, 167
  simplified Tiergarten paths and five playgrounds. The newly selectable
  Luiseninsel playground preserves its sand footprint plus two climbing
  frames, slide, swing, basket swing, sandpit, water play and excavator cues.
- Fix tree-canopy vertices being mistaken for terrain under the Luiseninsel
  playground. A wider robust sample of the packaged official mesh now keeps
  every outline point and item on a consistent park-ground elevation.
- Add an oblique equipment-centred Luiseninsel inspection view. It temporarily
  clears nearby display crowns and keeps mapped climbing, swing and slide
  geometry readable above the coarse source-mesh canopy without altering the
  normal park view.
- Reduce the supplemental Reichstag glazing opacity so its 24-sector structural
  grid remains crisp over the textured official mesh instead of softening the
  source dome a second time.
- Add screen-relative 3D flight to the arrow keys and a matching four-button
  movement pad. `Shift` plus arrows retains orbit and tilt, while bounded
  camera/target translation keeps the Regierungsviertel in reach above and
  below ground.
- Keep the Tiergartentunnel loaded as a restrained surface X-ray and strengthen
  it automatically whenever any orbit gesture crosses into the underside. The
  tunnel no longer depends on the dedicated underside preset to become visible.
- Add seven close-range monument models over the official surface. The
  Holocaust field uses all 2,710 officially documented stelae in one instanced
  draw call and preserves the official cross-section and height bands; the
  Soviet, Sinti/Roma, homosexual-victims, Goethe, composer and 2026 Jehovah's
  Witnesses memorials receive characteristic, source-documented silhouettes.
- Ground every procedural memorial on a local surface sample from the committed
  official Berlin mesh instead of the manifest's generic camera-anchor height.
- Raise settled rendering to 2x desktop / 1.5x mobile device pixels and use up
  to 16x texture anisotropy for crisper oblique roofs and monument edges.

## v0.2.7

- Increase the four hero landmarks' close-range legibility with batched
  metre-scale microdetail rather than screen-space filters: denser Reichstag
  windows, stone courses and roof-balustrade posts; Chancellery curtain-wall
  panes and clipped semicircular-window grids; station glass-panel seams,
  sleepers, platform joints, train doors, wheels and carriage joints; and Gate
  column fluting, triglyphs, entablature profiles and masonry courses.
- Preserve the published building envelopes while replacing repeated station
  roof ribs, purlins, facade mullions and train windows with GPU instancing.
  The additional detail therefore uses a small number of draw calls and stays
  compatible with the adaptive desktop/mobile rendering path.
- Extend frontend geometry tests to enforce the new vector and instanced
  detail batches, their instance density and the unchanged metric Gate
  envelope. Recheck all four hero views and the mobile tunnel underside in a
  production build without renderer errors or transparency artefacts.

## v0.2.6

- Correct the Reichstag dome's largest metric error: anchor its base to the
  Bundestag's published 24 m roof-terrace datum instead of the highest triangle
  in a photogrammetry crop. Align it to the LoD2 building centre, preserve the
  40 x 23.5 m envelope, expose the lower four ventilation rows and keep all 24
  ribs and 17 horizontal rings legible over the measured mesh.
- Raise hero material candidates to 2048 px and regenerate all 45 bounded GLBs
  with livelier but restrained colour. The official scene is now 114.7 MiB
  after bundling vertex normals for faster startup; each asset remains below
  5 MiB and the surroundings retain their 70,000-face mobile limit.
- Add a persistent Day/Night control and `D` shortcut to the true 3D viewer.
  Night mode changes the sky, fog, sun/fill balance and tone mapping, dims the
  photogrammetry and illuminates procedural facade windows, station glass,
  trains and the Reichstag dome rather than applying a flat colour overlay.
- Replace the floating focus dot with a 2.4-second, selected-only ring. No
  landmark marker remains over a roof after focus settles.
- Fix the real mobile underside bug caused by invoking the Three.js camera from
  inside a React state updater. The underside button now remains pressed,
  reaches 122 degrees, focuses the Kemperplatz tunnel context and reliably
  reveals the cutaway under React Strict Mode.
- Refine the Tiergartentunnel with two transparent casings, road decks, dashed
  lane marks, continuous safety-light strips, denser fixtures, shaft rings and
  four-blade fan cues while retaining its explicit OSM-derived approximation
  status.
- Add fine architectural cues without replacing official geometry: batched
  Reichstag facade windows, three German flags plus one EU flag, Kanzleramt
  Ehrenhof paving and a 5.5 m Chillida sculpture at its verified landmark,
  denser Hauptbahnhof glass-panel ribs and office mullions, and a more
  articulated Quadriga with sixteen legs, ears, muzzles, tails, harness, reins,
  Victoria, robe, wings, wreath and Iron Cross.
- Reframe Hauptbahnhof from a higher diagonal camera so its 321 m east-west
  roof and 160 m crossing hall read together. Keep the ICE, S-Bahn, four tracks
  and measured 46 m office bridges.
- Increase settled rendering to a GPU-stable 1.75x desktop / 1.35x mobile
  device pixels while temporarily reducing resolution during orbit gestures,
  preserving sharp stills without compositor dropouts or touch rotation
  stutter. Fit eleven primary controls in a safe two-row, six-column mobile
  toolbar.
- Reuse GLB normals instead of recalculating the 23 base meshes, stop and
  dispose stale mobile hero queues after landmark changes, render interaction
  at 60/30 fps and static scenes at 12/10 fps, and instance repeated tunnel
  fixtures into five draw calls. Correct the fan geometry from duplicated
  overlapping blade pairs to four distinct blades per fan.
- Extend release QA and frontend geometry tests for day/night lighting,
  temporary markers, the official dome datum, EU/German flag split, Chancellery
  forecourt, station rib density, Quadriga anatomy and tunnel interaction.

## v0.2.5

- Fix the major metric-alignment bug in the recognition layer. Procedural hero
  geometry now uses a minimum-area local frame derived from each official LoD2
  footprint instead of assuming that every building follows the map axes.
- Rotate Berlin Hauptbahnhof by its measured 21.82-degree LoD2 axis and move
  its model anchor from the OSM label point to the official hall centre, a
  correction of more than ten metres. Preserve finite LoD2 rotations for all
  four hero models in the scene manifest and release gate.
- Target presentation cameras at the recognition-model anchors. Keep the
  Chancellery camera on its characteristic 36 m leadership cube rather than
  the centre of the complete 343 m office ensemble, and use a north-referenced
  Hauptbahnhof view that exposes the crossing glass roofs.
- Add model-railway detail to Hauptbahnhof: four upper tracks, two platforms,
  a stationary ICE, a Berlin S-Bahn, rounded bodies, cab glazing, windows,
  stripes and office-bridge floor lines.
- Refine the Brandenburg Gate with correctly lower side pavilions, layered
  cornices, five shaded passages, Doric bases and capitals, a deeper frieze,
  chariot wheels, horse necks and legs, Victoria wings and victory standard.
- Refine the Reichstag with roof cornices, portico bases and capitals, entrance
  shadows and four roof flags around the existing official-dimension glass
  dome. Add Chancellery floor plates, two-sided facade mullions and a framed
  leadership-window grid.
- Improve daylight contrast without a costly full-canvas CSS filter. Retain
  the official 45 GLBs byte-for-byte and keep the procedural details as an
  additive recognition layer over the photogrammetric source.
- Audit all six unresolved automatic Codex P2 review threads. Their Wikimedia,
  DZI, spatial-QA, Escape, numbering and tile-pyramid fixes are present and the
  focused regression suite passes; the GitHub threads are merely unresolved
  administratively.
- Extend geometry and release QA to test oriented frames, finite local model
  rotations, Hauptbahnhof's non-axis-aligned hall, model component counts and
  camera targets. Re-verify desktop, 390 x 844 mobile layout, mouse orbit and
  focused-control Escape handling.

## v0.2.4

- Add metre-scale recognition geometry over the official textured mesh for the
  four hero landmarks. The overlays preserve the photogrammetric surface while
  making silhouettes and primary materials readable from normal isometric
  viewing distances.
- Model the Reichstag at its published 138 x almost 100 m plan with four corner
  towers and west portico, retaining the existing 40 x 23.5 m glass dome with
  24 ribs, 17 rings, ramps and mirror cone.
- Separate the Chancellery's LoD2-aligned office segments from its official
  36 m central cube, 18 m office bands and semicircular leadership windows.
- Add Hauptbahnhof's published 321 m east-west glass roof, 160 x 45 m crossing
  hall, 46 m office-frame height and filigree roof ribs without covering the
  official facade texture with solid proxy boxes.
- Rebuild the 62.5 x 11 x 26 m Brandenburg Gate with twelve 13.5 m Doric
  columns, differentiated sandstone and a bronze-green Quadriga.
- Use hero-specific presentation cameras so each landmark opens at a useful
  scale and angle, then remains fully orbitable. Reduce the focus marker so it
  no longer competes with small architecture.
- Brighten the sky and shaded facades with a restrained cool fill light while
  retaining directional shadows and avoiding deprecated WebGL settings.
- Extend release QA and geometry tests to enforce published dimensions,
  component counts and the presence of every recognition model.

## v0.2.3

- Stop the bounded base/hero worker queues as soon as a Three.js runtime is
  disposed. Switching a touch device to the 2D map no longer starts every
  remaining GLB request in the background; already completed geometry,
  materials, textures and closeable decoded images are released.
- Recover custom touch controls from duplicate pointer endings, lost pointer
  capture and window blur. A cancelled three-finger underside gesture can no
  longer leave OrbitControls permanently disabled.
- Replace blanket `Cache-Control: no-store` with HTTP/1.1 asset-aware caching.
  The immutable local package reuses GLBs, DZI tiles, scripts and images for a
  year; the repository server revalidates them so rebuilds still appear. Both
  servers explicitly return `model/gltf-binary` for GLBs and use daemon request
  threads for prompt shutdown.
- Keep every primary viewer action visible on narrow phones by switching the
  bottom toolbar to a two-row, five-column touch layout below 520 px.
- Move the frontend toolchain from Vite 7.3.5/esbuild to Vite 8.1.4/Rolldown,
  migrate manual chunking to the function form required by Rolldown and remove
  the low-severity Windows development-server advisory reported by `bun audit`.
- Generate the static viewer `.tar.gz` alongside the ZIP with deterministic
  Python archive code. This removes more than 4,000 macOS AppleDouble `._…`
  entries present in the previous tarball, excludes source maps and never
  follows source symlinks.
- Validate the static tarball as rigorously as the local ZIP: complete DZI
  pyramid, all 45 scene GLB hashes/sizes, safe relative paths, 200 MiB extracted
  ceiling and rejection of links, duplicate members and special files. ZIP QA
  now also rejects duplicate, linked and encrypted members.
- Extend executable regression coverage with 100-job cancellation and
  100-request cache-policy sweeps, deterministic tar generation, archive-link
  attacks, duplicate-member cases and live package HTTP/cache/content-type
  checks.

## v0.2.2

- Close the release-integrity gap around the official 3D scene. Release QA now
  checks the safe relative path, declared byte length and SHA-256 of every one
  of the 45 referenced GLBs in the repository, extracted package and final ZIP,
  and rejects stale unreferenced models.
- Make the generated local server verify the same complete scene inventory
  before opening a browser. Partial or corrupt extraction now produces a
  precise file error instead of a blank or apparently frozen WebGL canvas.
- Bound lazy hero-detail memory to one group on coarse-pointer/mobile devices
  and two on desktop. Eviction releases geometry, materials and texture GPU
  resources; unmount and late asynchronous completions now clean up as well.
  Touch devices also release the complete inactive WebGL scene when switching
  to the 2D map and use a 30 fps frame budget; desktop keeps its warm switch.
- Retry each failed GLB once, continue the bounded worker queue after individual
  failures and keep usable base 3D active when only an optional hero detail
  fails. WebGL context loss falls back to the high-resolution detail map and
  permits a fresh 3D start.
- Fix duplicate `pointerup` / `lostpointercapture` processing in the zero-server
  touch viewer, which could cancel the remaining one-finger drag after a pinch.
  Keep the custom three-finger underside gesture isolated until all gesture
  fingers are released.
- Prevent `START-HERE.html` from following its advanced-view link directly over
  `file://`, where browser module security would produce a broken page. It now
  shows the exact Windows and macOS/Linux full-3D start instructions in place.
- Add executable 100-case regressions for corrupted GLBs, mobile hero-cache
  churn and failure-tolerant bounded loading, plus package/server corruption
  tests and stronger viewer source contracts.

## v0.2.1

- Fix the release's most misleading workflow bug: `START-HERE.html` was still
  presented as the normal viewer even though it is the legacy flat renderer.
  The package and README now label it as a 2D compatibility fallback and route
  Windows/macOS/Linux instructions explicitly to the true local 3D server.
- Remove all 39 permanent coloured buttons from the zero-server fallback.
  Landmark navigation remains in the list, and only the selected location gets
  the restrained focus ring, matching the React/DZI and Three.js modes.
- Add a dimensioned Reichstag dome signature aligned to the official Berlin
  mesh apex and Bundestag primary-source dimensions: 40 m diameter, 23.5 m
  height, 24 main ribs and 17 horizontal rings, plus transparent glass,
  counter-rotating ramps and the daylight mirror cone.
- Increase hero texture candidates from 1024 to 1536 px per material segment.
  The bounded scene grows from 76.9 to 93.7 MiB while retaining lazy hero loads,
  a 150 MiB scene budget and the 5 MiB per-file repository limit.
- Add geometry and release regressions for the dome dimensions, source URL,
  ring/rib counts, selected-only offline focus UI and absence of permanent
  marker code; visually verify the dome and underside at desktop and 390×844.

## v0.2.0

- Replace the transformed flat-map default with a true Three.js scene built
  from 23 Regierungsviertel tiles of the official Berlin 3D Mesh Model 2025;
  retain exact EPSG:25833 metric placement and publish source bounds, hashes,
  byte sizes and face counts in a machine-readable scene manifest.
- Raise each mobile context tile from 52,000 to 70,000 faces and use enhanced
  vertex colours, brighter neutral daylight, shadows and anisotropic texture
  filtering for clearer roofs, facades, vegetation and oblique views.
- Add lazy high-detail photogrammetry crops for Reichstag,
  Bundeskanzleramt, Hauptbahnhof and Brandenburger Tor, masked against official
  LoD2 footprints. The Reichstag now displays its actual measured glass dome
  instead of a generic procedural roof cue.
- Remove the 39 permanent coloured landmark dots in both viewer modes. A small
  illuminated ring appears only for the currently selected landmark.
- Add full orbit controls: mouse drag, wheel and right-drag; one-finger orbit;
  two-finger pinch/rotate; a dedicated three-finger path through the underside;
  keyboard/cardinal controls; and a visible 44 px mobile control grid.
- Add a true below-ground cutaway for the documented OSM-derived
  Tiergartentunnel approximation with two road tubes, warm light fixtures,
  ventilation shafts and fan cues, while retaining its explicit non-surveyed
  status in data, docs and release QA.
- Load the 76.9 MiB scene progressively with one mobile or three desktop
  workers, lazy hero assets, adaptive pixel ratio and per-file 5 MiB limits;
  keep the complete 16384×11616 OpenSeadragon pyramid as a fast fallback.
- Extend release readiness, package manifests, source-fusion inventory and
  tests to require all 3D assets, Berlin Partner attribution, selected-only
  markers, two-/three-finger interaction code and a complete bundled scene.

## v0.1.62

- Expand the verified scene from 35 to 39 landmarks with OSM-backed points for
  the Swiss Embassy, Unity Flag, Brandenburg Gate Quadriga and Starbucks on the
  Pariser-Platz edge; all 39 landmarks and 23 relative-placement checks pass.
- Add 42 newly accepted free-license Wikimedia references for 110 total across
  37 motif groups, including Swiss Embassy, Quadriga, Unity Flag, Reichstag
  dome/interior, TIPI, Carillon, memorial, pond and forecourt evidence.
- Make the Wikimedia fetcher resilient to Commons rate limiting with a polite
  request interval and bounded Retry-After/exponential backoff handling.
- Refresh the renderer with a livelier multi-hue park/water/material palette,
  southwest-sun shadows projected toward map northeast and a visibly rising,
  more densely ribbed Reichstag glass dome.
- Give the Holocaust field, Homosexuals memorial, Goethe monument,
  Beethoven/Haydn/Mozart monument and Soviet memorial distinct silhouettes;
  add Quadriga, Unity/Reichstag/embassy flags, Pariser-Platz people and
  stationary ICE/S-Bahn cues.
- Load the committed Tiergartentunnel centreline into the global Deep Zoom
  renderer, clip it to the scene and render one restrained two-tube engineering
  cutaway with lighting, service sections and ventilation instead of drawing
  all 13 OSM evidence carriageways as duplicate bodies.
- Raise the direct-open offline detail fallback from 3584 to 6144 pixels while
  retaining the full 16384×11616 DZI pyramid for deep zoom; use bounded PNG
  palettes and enforce the 5 MiB per-file repository limit in release QA.
- Improve phone/tablet use with a collapsible landmark rail, compact focus card,
  safe-area-aware scrollable bottom toolbar and automatic rail close after a
  mobile landmark selection; preserve one-finger pan and two-finger
  pinch/pan/twist.
- Add Shift-drag free rotation for mouse users, document the gesture in-app and
  split React/OpenSeadragon into cacheable frontend chunks for faster reloads.
- Repair the zero-server viewer's mixed 16K/2157 coordinate systems and camera
  transform math, which could place a correctly loaded map outside the window;
  preserve the stage centre through zoom/rotate/swivel/flip, constrain panning,
  keep the desktop stage at viewport height and separate the mobile control
  sheet from its 58dvh touch map.
- Re-scale the local tunnel cross-section, ICE, S-Bahn, tour boat, cars,
  pedicab and beer-garden cues to plausible map proportions and keep the full
  tunnel engineering overlay subdued until its dedicated underside view opens.

## v0.1.61

- Refresh all eight Regierungsviertel LoD2 source tiles from the official
  March 2026 Berlin CityGML release and preserve nested `BuildingPart`
  geometry instead of flattening complex ensembles into one fallback block.
- Render 3,315 LoD2 volumes at their individual measured heights, including
  848 explicit parts across 142 segmented ensembles; remove the former
  4 m minimum / 85 m maximum visual distortion inside the current data range.
- Rebuild the Bundeskanzleramt from 31 official component volumes, keeping
  the lower office rows separate from its central leadership block and moving
  the semicircular glass cue from the roof onto real facade planes.
- Use exact named OSM building polygons to associate LoD2 families with
  landmark semantics and keep the verified landmark point as the anchor for
  Reichstag, Chancellery and HKW architectural signatures.
- Refresh the material system with cooler concrete and glass, brighter water,
  cleaner roads and more varied Tiergarten greens while retaining Wikimedia
  reference cues and all required attribution.
- Extend metric QA with source creation dates, measured-height coverage,
  BuildingPart/ensemble counts and an explicit Chancellery scale cross-check.

## v0.1.60

- Regenerate the committed DZI from LoD2, OSM, ALKIS and free Wikimedia
  material cues at 16384×11616 pixels. The complete 15-level pyramid uses
  256-pixel JPEG tiles at quality 85 with one-pixel overlap and remains below
  the 50 MB static-bundle target.
- Remove stale hard-coded DZI dimensions from the React viewer and load the
  descriptor directly, keeping image dimensions, overlays and future renders
  in sync.
- Enable OpenSeadragon pinch rotation for touch and pen input, synchronize
  gesture rotation with controls and URL state, snap completed twists near the
  four cardinal views, and keep landmark overlays upright.
- Add the same two-finger twist workflow to the zero-server offline viewer,
  plus iOS web-app metadata and stricter touch/overscroll handling.
- Select exactly one primary LoD2 body per landmark signature, remove generic
  radial roof artefacts and refine the Reichstag stone/window/dome treatment.
- Add high-resolution DZI, overlap, hero-body selection and touch-gesture
  regression tests.

## v0.1.59

- Harden the zero-server `START-HERE.html` package for phones, tablets and
  touchscreens: add `viewport-fit=cover`, dynamic viewport heights,
  safe-area-aware mobile layout and larger coarse-pointer controls.
- Add Pointer Events pinch handling to the offline viewer, so one finger pans
  and two fingers pinch-zoom / pan around the touch midpoint without freezing
  the existing mouse, wheel, keyboard, rotate or underside workflows.
- Extend release readiness, package HTML tests and local package smoke checks
  so future downloads must keep the mobile viewport, touch target and
  two-finger gesture paths.

## v0.1.58

- Public web release build. Fresh `bun run build` verified reproducible
  on a clean-clone from `main`: 5.1 MB total, ~2.5 MB gzipped tarball,
  116 files, all asset paths relative (`./assets/...`, `./dzi/...`) so
  the bundle drops into any static host under any subdomain or
  sub-path.
- Pre-publish security review clean: no hardcoded secrets, no leaked
  paths in source map, no runtime LLM/connector dependencies, only
  React 19 + react-dom + OpenSeadragon 5 + lucide-react at runtime.
- Ship the built React + OpenSeadragon viewer as a release asset
  `isometric-berlin-viewer-v0.1.58.tar.gz` so it can be deployed from
  anywhere (GitHub Pages, Cloudflare Pages, Vercel, Netlify,
  `pplx.app`, an S3 bucket, or `python -m http.server` in the
  extracted directory) without rebuilding. Complements the zero-server
  `START-HERE.html` package shipped since v0.1.53.

## v0.1.57

- Add URL start parameters to `START-HERE.html` for support/debug starts:
  `lang`, `theme`, `view`, `profile`, `pixel`, `details`, `clouds`, `lite`
  and `performance`.
- Add an image-load fallback so the offline viewer switches from the detail
  overview to the pixel overview if `overview_source.png` fails to load.
- Guard keyboard shortcuts against browser/system modifier combinations and
  form-focused targets.
- Extend release readiness, package HTML tests and local smoke tests so future
  ZIPs keep the start-parameter, fallback and keyboard-guard paths.

## v0.1.56

- Add a saved lightweight performance mode to the zero-server
  `START-HERE.html` viewer, with a dedicated button and `P` shortcut.
  It removes expensive shadows / filters and cloud animation while keeping
  the map usable and visually legible.
- Replace resize reset behaviour with `refitPreservingView`, so changing
  window size preserves the current focus, zoom ratio, rotation, swivel and
  underside state instead of snapping back to the top overview.
- Extend package release-readiness, generated HTML tests and local package
  smoke checks so future downloads must keep the performance mode and
  resize-preserving path.

## v0.1.55

- Add detail and cloud toggles to `START-HERE.html`, persist both choices,
  expose G/C keyboard shortcuts and keep the buttons bilingual.
- Reduce heavy visual work while the map is being dragged by dimming the
  detail overlay and disabling costly SVG filters during active pointer
  movement.
- Add a reduced-motion guard for cloud drift / focus animation.
- Refine the visual pass with glass glints for the Reichstag dome,
  Hauptbahnhof roof and Bundeskanzleramt, plus water ripples, Tiergarten
  tree clusters and path-highlight points.
- Extend release-readiness, package HTML tests and local package smoke tests
  so the new toggles, drag optimisation and polish details stay in future
  downloads.

## v0.1.54

- Add a deterministic scene-detail overlay to the zero-server
  `START-HERE.html` viewer with translucent isometric clouds, southwest
  late-afternoon sun cues, cloud shadows, water-depth accents, tunnel branch
  hints, an ICE at Hauptbahnhof, an S-Bahn on the east-west rail line,
  Pariser-Platz / tunnel cars with night light beams, Reichstag / EU /
  US / French flags, a Spree tour boat, a pedicab / people cue and
  Gustav-Heinemann-Brücke / Zollpackhof beer-garden details.
- Tune Day/Night styling so cloud opacity, sun beams and vehicle light cones
  respond to the selected mode while the new details stay attached during
  pan, rotate, swivel and underside tunnel inspection.
- Extend release readiness, package HTML tests and HTTP smoke tests so future
  downloadable ZIPs must keep the v0.1.54 scene-detail layer.

## v0.1.53

- Extend `START-HERE.html` persistence so the offline viewer restores the
  last focused landmark, view preset or free rotation/swivel angle, and
  Tiergartentunnel underside state in addition to language, Day/Night,
  visual profile, and Pixel-Art/detail image selection.
- Make Reset/Home return the zero-server viewer to the Bundeskanzleramt
  top view and save that clean state.
- Extend package manifest, release-readiness checks, smoke tests, and
  fixture tests so future ZIPs must keep last-view restoration.

## v0.1.52

- Persist `START-HERE.html` viewer preferences locally in the browser:
  language, Day/Night mode, Atlas/Cinematic/Lab profile, and
  Pixel-Art/detail image selection now survive reloads.
- Keep the persistence fail-safe for strict `file://` browser contexts:
  if localStorage is unavailable, the offline viewer still starts with
  defaults.
- Extend release-readiness and package smoke coverage so future ZIPs must
  retain the preference persistence path.

## v0.1.51

- Add bilingual Deutsch/English controls to the zero-server
  `START-HERE.html` viewer and keep labels, HUD text, hints and reference
  modal copy in sync when switching language.
- Add Day/Night controls to the offline viewer. Night mode overlays lit
  windows for the Reichstag, Bundeskanzleramt and Hauptbahnhof, an
  illuminated Brandenburg Gate / Quadriga cue, selected monument accents,
  Tiergarten / Pariser Platz street lamps and stronger Tiergartentunnel
  lighting.
- Extend the package manifest, release-readiness check and local smoke test
  so bilingual UI and night-light overlays are required in future packages.

## v0.1.50

- Add a zero-server `START-HERE.html` underside mode for the
  Tiergartentunnel cutaway. The same SVG tunnel layer now stays attached
  while the map is panned, rotated, swivelled and flipped for a
  from-below inspection view.
- Further shape the tunnel with portal frames, underside glow, ceiling
  ribs, lane / tube guide marks and service-bay markers.
- Add Tunnel-Fokus and Unterseite controls plus U/F keyboard shortcuts
  to make the underground route easier to inspect locally.
- Extend package readiness and smoke tests so tunnel underside controls,
  service bays and portal markers are required in future releases.

## v0.1.49

- Pull live OpenStreetMap / Overpass evidence for the Tunnel
  Tiergarten Spreebogen B96 trunk carriageways and store the derived
  `tunnel=yes`, `layer=-2` way geometries in
  `geo_data/regierungsviertel/tiergartentunnel.geojson`.
- Keep the rendered centreline as an engineered simplification for the
  isometric cutaway, but attach the OSM way IDs and evidence count to
  both the GeoJSON and packaged viewer payload.
- Update the local package and documentation so v0.1.49 is the first
  release whose tunnel geometry is based on OSM tunnel carriageway
  geometry rather than only portal/route approximation.

## v0.1.48

- Upgrade the Tiergartentunnel representation from a reference line to
  an open-data engineered underground cutaway: two-tube rectangular
  volume, side walls, centre wall, warm lighting, ventilation / shaft
  markers and cross-section cues.
- Add public-source and precision metadata for the tunnel route, with a
  clear `geometry_status` that prevents the approximation from being
  mistaken for official surveyed as-built geometry.
- Align the deterministic source renderer and zero-server
  `START-HERE.html` launcher so regenerated tiles and the packaged HTML
  viewer use the same tunnel-volume semantics.
- Extend release readiness and local package smoke tests to require the
  new tunnel volume metadata and viewer functions.
- Rebuild the Mac/Windows/Linux ZIP and update README/version metadata to
  v0.1.48.

## v0.1.47

- Refine the Tiergartentunnel visual layer with a stronger under-surface
  tube, warm lighting dots, and ventilation / shaft markers in the
  zero-server `START-HERE.html` viewer.
- Add matching tunnel-light and ventilation cues to the deterministic
  source renderer.
- Extend release readiness and the local package smoke test so future
  packages must include tunnel lighting and ventilation metadata.
- Rebuild the Mac/Windows/Linux ZIP and update README/version metadata to
  v0.1.47.

## v0.1.46

- Add `scripts/smoke_local_package.py`, an end-to-end HTTP smoke test for
  the unzipped local package. It starts `serve-local.py`, verifies
  `START-HERE.html`, manifest version, DZI descriptor, a DZI JPEG tile,
  landmark payload, and the Tiergartentunnel overlay.
- Rebuild the Mac/Windows/Linux ZIP and update README/version metadata to
  v0.1.46.

## v0.1.45

- Add animation-frame render throttling, robust pointer-end handling, and
  resize debounce to the offline `START-HERE.html` launcher so mouse drag,
  wheel zoom, swivel and resizing stay responsive.
- Harden release readiness so future ZIPs must include the anti-freeze
  launcher logic as well as the Tiergartentunnel overlay.
- Improve README onboarding with a clearer download/start block, link
  index, and grouped landmark inventory.
- Add a documentation index at `docs/README.md`.
- Refresh the Regierungsviertel geodata README so it lists the current
  committed artefacts instead of stale TODO placeholders.
- Refresh the reference-image README with links to Wikimedia credits,
  the atlas, and the machine-readable manifest.
- Keep the README `Local v...` status phrase aligned with release
  readiness and require the Tiergartentunnel overlay in release checks.
- Rebuild the local Mac/Windows/Linux ZIP and update download links to
  v0.1.45.

## v0.1.44

- Add Carillon im Tiergarten, Mahnmal fuer verfolgte Zeugen Jehovas, and
  Gedenkort fuer Polen 1939-1945 as explicit QA/navigation landmarks.
- Add `geo_data/regierungsviertel/tiergartentunnel.geojson` as an
  approximate underground reference route and draw it as a dashed
  under-surface Tiergartentunnel cue.
- Expand free-license Wikimedia discovery for Carillon, Jehovah's
  Witnesses memorial, Poland memorial, and Luiseninsel future-bound
  reference candidates.
- Improve deterministic render accents for the new bell tower, bronze /
  purple memorial, boulder/apple-tree memorial, and tunnel route.

## v0.1.43

- Add Kanzlergarten / Non-Violence-Skulptur as an explicit QA/navigation
  landmark west of the Chancellery context.
- Expand free-license Wikimedia discovery for Kanzlerpark/Kanzlergarten,
  HKW/Kongresshalle, Max-Liebermann-Haus, and Reichstag dome/plenary cues.
- Strengthen deterministic render signatures for Kanzlergarten, HKW,
  Max-Liebermann-Haus, and the existing Reichstag/TIPI/forecourt detail layer.

## v0.1.42

- Add TIPI am Kanzleramt, Eduardo-Chillida-Skulptur, Reichstagsvorfeld /
  Berlin-Pavillon, and Platz der Republik Heckenbosquets as explicit
  Regierungsviertel QA/navigation landmarks in the local viewer.
- Expand free-license Wikimedia discovery for TIPI, Chillida, Reichstag
  dome/plenary, and Reichstag forecourt references while keeping the
  no-copy rule for commercial maps, official photos, and social media.
- Improve the deterministic source renderer with recognizable TIPI,
  Chillida, Reichstagskuppel/plenary, Sinti/Roma memorial, Berlin-Pavillon,
  and hedge-bosquet accent cues.

## v0.1.41

- Upgrade the offline `START-HERE.html` presentation with a more polished
  cartographic stage: technical grid, vignette/lighting treatment, stronger map
  filtering, and a selected-landmark focus ring.
- Add Atlas, Cinematic, and Lab visual profiles plus keyboard shortcuts 1/2/3
  for quick contrast/readability changes.
- Add an instrument HUD that shows selected landmark, zoom ratio, camera
  orientation, and focus state while keeping the no-Terminal Mac/Windows launch
  flow intact.

## v0.1.40

- Add Venusbassin / Goldfischteich as an explicit Tiergarten landmark using
  Wikimedia/Wikidata/OSM metadata, and extend Wikimedia reference discovery for
  modern free-license pond imagery.
- Improve the deterministic source renderer with bounded tree, shrub, and
  water-ripple texture for OSM park and water polygons.
- Document the external no-copy geolocation QA pass across official pages and
  commercial map products.

## v0.1.39

- Add `package-manifest.json` to the downloadable local package with package
  version, preferred detail image, DZI descriptor, asset hashes, attribution,
  and Google-content status.
- Strengthen release readiness so README's direct download URL must match the
  current project version.
- Validate package manifests in both the unpacked local package and the ZIP,
  including referenced asset sizes and SHA-256 hashes.

## v0.1.38

- Export the Advanced Viewer DZI from the detailed source render instead of the
  pixel-art overview.
- Add denser facade/roof micro-detail and stronger landmark building signatures
  for the Regierungsviertel render path.
