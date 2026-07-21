# Changelog

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
