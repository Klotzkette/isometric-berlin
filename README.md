# Isometric Berlin – Regierungsviertel

## Web viewer & Downloads

| What | Link |
|---|---|
| **Open the hosted viewer** | https://klotzkette.github.io/isometric-berlin/ |
| **Download ZIP for Mac/Windows/Linux** | https://github.com/Klotzkette/isometric-berlin/releases/latest/download/isometric-berlin-regierungsviertel-local.zip |
| Versioned v0.72.32 ZIP | https://github.com/Klotzkette/isometric-berlin/releases/download/v0.72.32/isometric-berlin-regierungsviertel-local.zip |
| Latest release page | https://github.com/Klotzkette/isometric-berlin/releases/latest |
| **Public repository / öffentliches Repository** | **https://github.com/Klotzkette/isometric-berlin** |
| Local start instructions | [Run locally / Lokal starten](#run-locally) |
| Package manifest in the ZIP | `package-manifest.json` |

The downloadable viewer is the built React + Three.js/OpenSeadragon app from
`src/app/`. It defaults directly to the drawn isometric 3D view and works on modern
desktop, phone and tablet browsers. No AI model, Google key or paid service is
needed at runtime. The same functional viewer is deployed on GitHub Pages and
bundled with all required local assets in the release ZIP.

`START-HERE.html` is the zero-server **2D compatibility fallback**, not the
full model. For true 3D on Windows, double-click `start-windows.bat`. On macOS
or Linux, run `python3 serve-local.py` in the extracted folder; it opens the
3D viewer directly. The distinction is explicit in the package so the old
flat renderer cannot be mistaken for current 3D quality.

**Status:** Public open-data project · **Local v0.72.32** · hosted viewer and a
complete local package for macOS, Windows, and Linux.

## Screenshots

| Bundeskanzleramt (day) | Reichstag building (day) |
|---|---|
| ![Bundeskanzleramt in the isometric 3D viewer, day mode, showing the Chancellery's curved facade and the Spree river](docs/screenshots/kanzleramt-day.png) | ![Reichstag building in the isometric 3D viewer, day mode, showing the glass dome and the "Dem deutschen Volke" portico inscription](docs/screenshots/reichstag-day.png) |

![Regierungsviertel at night in the isometric 3D viewer, warm window lights across the government district](docs/screenshots/night.png)

## What this repository is / Was dieses Repository ist

| English | Deutsch |
|---|---|
| This public repository contains the complete React/Three.js viewer, Python geodata pipeline, bounded Regierungsviertel source manifests, tests, documentation, generated WebGL assets, and reproducible release tooling. | Dieses öffentliche Repository enthält den vollständigen React/Three.js-Viewer, die Python-Geodatenpipeline, begrenzte Quellenmanifeste des Regierungsviertels, Tests, Dokumentation, erzeugte WebGL-Dateien und reproduzierbare Release-Werkzeuge. |
| The live and downloaded viewers need no AI model, account, API key, or paid service. They render bundled static assets directly in a modern browser. | Der Live-Viewer und das Download-Paket benötigen weder KI-Modell noch Konto, API-Key oder Bezahldienst. Sie rendern die mitgelieferten statischen Dateien direkt im modernen Browser. |
| Metric placement comes from Berlin LoD2, official support layers, and OSM. Procedural recognition details are additive and explicitly documented; an approximation is never described as surveyed geometry. | Die metrische Lage stammt aus Berlin LoD2, amtlichen Zusatzebenen und OSM. Prozedurale Erkennungsdetails sind additiv und ausdrücklich dokumentiert; eine Annäherung wird niemals als vermessene Geometrie ausgegeben. |
| The browser UI contains a GitHub button. It shows this complete repository URL in German and English and provides a stable download action. | Die Browseroberfläche enthält einen GitHub-Knopf. Er zeigt diese vollständige Repository-Adresse auf Deutsch und Englisch und bietet einen stabilen Download an. |

The canonical source and issue history always live at
<https://github.com/Klotzkette/isometric-berlin>. Release archives are
reproducible outputs, not a separate hidden codebase.

## Current Viewer

The current public package is **v0.72.32**, built from `main`. Its full viewer
is a progressively loaded, freely orbitable 3D scene; the double-click HTML
remains a clearly labelled compatibility fallback for browsers that cannot run
local modules.

- **Five central public spaces now give every ordinary source building a more
  specific facade reading.** Pariser Platz, Leipziger Platz, Potsdamer Platz,
  Tilla-Durieux-Park and the Hauptbahnhof surroundings use place-bound floor,
  head-band and bay rhythms on their measured LoD2 shells. All 967 affected
  buildings receive exact desktop refinement inside the unchanged cap; hero
  models and non-public courtyard sides remain source-separated.

- **The added architecture does not add a texture, request or draw call.** Its
  lines join the existing `LoD2 facade axes` batch. The progressive benchmark
  remains at 199 draw calls and about 85.9 MiB of geometry, while the retained
  building allocation is 91,488 bytes smaller than the previous distance-only
  selection. Touch devices keep their compact exact limit and one instanced
  shell for every remaining source building.

- **Distant source buildings retain their colours during Worker transfer.**
  The compact instanced shell no longer multiplies its per-building colours by
  an absent vertex-colour attribute, and transferred matrix/colour buffers are
  explicitly uploaded. Progressive loading therefore keeps a continuous city
  instead of black remote blocks or empty-looking quarters.

- **Startup and mode switches keep a visible city plate instead of ever
  flashing black.** The viewer now keeps a tiny static Regierungsviertel
  reference map under both OpenSeadragon and Three.js, paints the loading
  curtain with the same source-derived backdrop, and clears WebGL directly to
  the active mode colour. This is a procedural/static fallback only; no retired
  photo world or texture surface is bundled or requested.

- **The progressive city is more liquid on desktop and touch devices.** The
  first exact building frame is smaller, park surface families stream in
  bounded chunks, and coarse-pointer shadow work is reduced while the stable
  1.75x desktop and 1.35x touch pixel-quality caps remain intact. All source
  buildings remain visible through the measured distant shell. In the warm
  production benchmark, exact refinement settles in about 4.87 seconds,
  repeated batch attachment stays around 2.5 ms p95, and steady geometry falls
  to about 85.9 MiB.

- **Walking starts at the exact place currently under the camera.** Activating
  pedestrian mode transfers the live orbit/free-camera focus, current heading,
  pitch and local ground height instead of returning to a fixed landmark. The
  camera ground point and then the established safe spawn remain bounded
  fallbacks only when the visible focus cannot be walked.

- **The Federal Ministry for Economic Affairs reads as the real canal-side
  Invalidenhaus ensemble.** Its five exact LoD2 parts remain authoritative.
  The long replacement wing along the Berlin-Spandauer Schifffahrtskanal gains
  44 facade bays and 220 windows, while the two historic wings gain warmer
  stone trim, red hipped roofs, 114 windows, courtyard grids, cornices and
  framed entrances. Minecraft adds 78 block-native facade cues inside the
  existing single Humboldthafen draw call.

- **The full progressive city is substantially lighter without losing a
  building.** Desktop transfers immutable asset URLs, shows all 29,818 source
  buildings through one permanent distant-shell batch plus three exact LoD2
  districts, and publishes the nearest exact district before terrain and road
  decoding. Raster streets replace duplicate asphalt, paving and kerb meshes;
  authored paths and source lane markings remain. In the cold production
  benchmark the complete silhouette appears after about 1.81 seconds, exact
  refinement finishes after about 7.0 seconds, and the largest repeated
  attachment is 4.1 ms,
  and steady geometry falls from 376.4 to 133.8 MiB.

- **Retired photo geometry no longer ships or loads.** Seventy-four unused
  GLBs, their hero crops and the redundant pretriangulated asphalt plate are
  removed from the repository, live viewer and offline package. The recovery
  path performs one clean procedural remount and then offers explicit Recovery
  and 2D-map actions; it never allocates a hidden photographic world.

- **Three quick presses add an explicit 8× pedestrian pace.** The same arrow
  or WASD key must be pressed three times inside the bounded activation window;
  repeating the gesture switches the fast run off. The established 4× sprint,
  Shift control, jumps and collision substeps remain intact, including at the
  higher speed.

- **Every source building becomes visible during the first progressive
  paint.** Six tiny instanced preview batches cover all 29,818 source
  buildings after about 1.9 seconds in the production benchmark. Each preview
  is disposed exactly when its corresponding exact LoD2 batch arrives. The
  final scene remains unchanged at 202 draw calls and 19,610,549 vertices;
  mobile starts this off-thread refinement after at most 600 ms of idle wait.

- **The Spreebogen now connects its landscape architecture to the river.**
  Exact OSM axes carry the Ludwig-Erhard-Ufer edge bands and the 2.4 m raised
  Panoramaweg, including its nine rectangular supports. Eighteen staggered
  Gartenspur slabs complete the documented park reading between the Swiss
  Embassy and Hauptbahnhof without loading a texture or animated asset.

- **Gustav-Heinemann-Brücke and Hugo-Preuß-Brücke keep their individual
  structures.** Gustav-Heinemann uses its published 87.76 m length, 4 m clear
  timber path and pale-sage 2.25 m Vierendeel frames. The curved 88.41 x
  23.56 m Hugo-Preuß bridge gains its deep pier-free box, 32 recessed fascia
  bays, limestone abutments, dense railing and `Hugo-Preuß-Brücke 2004` end
  plates.

- **Potsdamer Platz gains a present-day, source-anchored pedestrian room.**
  Twenty-eight official Berlin light positions define 14 paired anchors along
  Alte Potsdamer Straße. Bounded paving bands, benches, planters, bicycle
  racks, bollards and radial stone cues share one body and one ink batch; the
  official lamp layer is not duplicated and mobile reduces repeated furniture.

- **Desktop movement now follows the familiar WASD convention.** In free-camera
  3D, `W`/`A`/`S`/`D` fly relative to the current heading, `Space` rises,
  `Shift` descends and the wheel continues to zoom at the pointer. Walking uses
  the same WASD layout; one `Space` reaches the bounded 6.2 m presentation apex
  and a second press within 320 ms raises the same jump once to 10.5 m. Further
  airborne presses cannot stack height. The old `D` and `S` visual shortcuts
  remain available in the 2D detail map, where they do not conflict with
  movement.

- **Phones keep the complete building inventory visible without loading every
  distant facade.** The nearest 5,000 source buildings retain their exact
  progressive LoD2 geometry; every farther eligible building is represented by
  one measured, oriented, source-coloured instanced shell in a single draw call.
  The existing Web Worker fetches and constructs that layer off the main thread,
  so neither its measured 578 ms build nor the decoded 29k-building graph can
  stall input. Desktop applies the same strategy with the nearest 12,000
  buildings kept exact, Minecraft keeps every source building through its
  bounded block representation, and named hero architecture remains unchanged
  in every mode.

- **Six important Berlin squares now read as coherent street rooms instead of
  isolated landmark islands.** Front-facing LoD2 walls around Pariser Platz,
  Leipziger Platz, Breitscheidplatz, Platz der Republik, Europaplatz and
  Washingtonplatz receive source-height-aware paired window-head rhythms.
  Courtyard and rear walls are rejected by orientation and distance, and all
  764 qualifying facade fields join the existing line batch, so the refinement
  adds no draw call and remains present in Day, Night, Snowstorm and
  Schwellenraum.

- **Sandkrugbrücke and the Konrad-Adenauer-Haus have their characteristic
  structures back.** The bridge retains both mapped carriageway axes and the
  current 32.6 x 28.8 m inventory envelope, while its five-stem steel frame,
  21 m clear span, 18.7 m roadway, 1.28 m structural depth, fine three-level
  rail and four slender lamps follow published engineering data. There is no
  invented river-centre pier. At Tiergarten the generic opaque CDU shell is
  removed only for OSM way `25999445`; an exact rhomboid glass envelope now
  reveals the four-storey winter garden, six-storey elliptical timber body,
  paired upper decks and travertine plinth without political lettering.

- **The added city detail stays inside a smaller runtime envelope.** The
  production benchmark now measures **187 draw calls**, **7,304,079 vertices**
  and **133.8 MiB** of steady geometry; the largest repeated progressive
  main-thread attachment measured 4.1 ms. Repeated plaza, bridge and facade
  elements reuse
  merged or instanced materials.

- **All visual modes now keep a smaller, steadier browser footprint.** Desktop
  and touch use one zero-sample `UnsignedByte` composer followed by SMAA,
  avoiding duplicate renderer/MSAA and half-float buffers. Idle scenes skip
  full-scene work; weather and Minecraft mobs update at bounded 30/20 Hz while
  camera input remains display-rate. Completed and failed world constructors
  release decoded JSON graphs, hidden smooth worlds receive no Minecraft toon
  clones, and no legacy photo shell remains. OpenSeadragon also caps
  parallel image work at **3 / 6** loaders and retained decoded tiles at
  **32 / 64** on touch / desktop. Moving to the 2D map releases WebGL on every
  device; render targets stay within **1.35× / 3.2 MP** on touch and **1.75× /
  8.5 MP** on desktop, and only Safari/iOS retains the settled backbuffer.

- **Walking water is now a shoreline instead of a death/reset volume.** The
  pedestrian slides along mapped water but cannot cross it and is never sent
  back to the original spawn. Fresh browser loads rotate between Reichstag,
  Bundeskanzleramt, Hauptbahnhof and Siegessäule; explicit landmark links and
  the deterministic Reichstag Reset remain intact.

- **The Sozialgericht Berlin now follows the supplied facade photographs down
  to its architectural hierarchy.** OSM's 58.038 m street-side site boundary
  remains distinct from the actual 48.905 m LoD2 facade wall and its 15.392 m
  risalit. The latter carries the warm ochre 4 + 3 + 4 elevation: rusticated
  ground floor, arched and paired upper windows, correctly placed sills and
  pediments, three oculi, giant columns, layered cornices, dentils and the broad
  central gable. Portal 52 has its recessed dark doors, amber numbered transom,
  floral relief fields, fluted columns, six granite steps and handrails; three
  separate dark roof-sculpture groups and the bare mast complete the
  silhouette. The six photographs remain reference-only and are neither
  bundled nor loaded. A dedicated locally culled batch uses **3 renderables /
  30,005 vertices** in full quality and **3 / 19,338** on mobile. Minecraft
  retains the source building and adds a single block-native 11-axis front with
  a true 3 x 5-pixel `52`: **244 blocks** in full and **196** on mobile.

- **The Beethoven–Haydn–Mozart monument now reads as Siemering's ten-metre
  “Musikerofen”.** Its exact Tiergarten anchor carries a rounded granite
  understructure and a chamfered, three-sided pavilion in warm Pentelic marble,
  with three round-arched niches, differentiated white-marble half figures,
  pilasters, masks and instruments, lyre-bearing swans, a scaled gilded cupola,
  pinecones and three putti raising the laurel wreath. Published height,
  material and iconographic evidence remains explicit; unpublished local
  subdivisions are deterministic, texture-free recognition geometry. Its
  frozen budget is **30 renderables / 2,847 stored / 7,137 rendered vertices**;
  a dedicated elevated southern focus keeps the niches and cupola clear of the
  surrounding canopy.

- **Minecraft is lighter but a little livelier outside the Holocaust
  Memorial.** The protected field remains completely free of trees, Creepers,
  Zombies, Skeletons and loot. Elsewhere deterministic thinning keeps **2/3**
  of block trees on desktop and **1/3** on mobile without allocating the old
  25,000-tree expansion. The single-draw mob field uses **4 Creepers / 6
  Zombies / 3 Skeletons** on desktop (**158 parts**) and **3 / 5 / 2** on
  mobile (**120 parts**). Four or two rare loot boxes open once on pedestrian
  contact with a bounded 1.35-second instanced firework; chest and particles
  stay at two draw calls and use no independent animation loop.

- **City West now has a source-anchored architectural identity.** A batched,
  mobile-aware layer distinguishes Europa-Center, Allianz-Haus, the historic
  Café Kranzler and New Kranzler Eck, Bahnhof Zoologischer Garten,
  Kaiser-Wilhelm-Gedächtniskirche and Breitscheidplatz, plus Urania through
  their characteristic tower, roof, facade, rotunda, hall and podium forms.
  OSM and Berlin LoD2 remain the metric anchors; repeated fine elements are
  merged or instanced, and the touch profile receives a bounded detail level.
  The four merged ensembles use **11 renderables / 14,634 vertices** in full
  and **11 / 8,427** on mobile.

- **Friedrichstadt-Palast and Tränenpalast are now separate, recognisable
  buildings rather than generic shells.** The former follows the documented
  110 x 80 m theatre, taller stage tower, projecting foyer, broad steps,
  concrete fins and two-storey coloured glass-block fields. The latter keeps
  its exact OSM outline as a low, freestanding steel-and-glass pavilion with
  large windows, flat roof, aluminium framing and station link; the existing
  prism suppression still prevents Friedrichstraße station from swallowing
  it. Both use procedural, image-free full/mobile geometry. Together they use
  **8 renderables / 439 instances / 5,329 stored / 16,873 rendered vertices**
  in full and **8 / 393 / 3,477 / 13,365** on mobile.

- **FUNBOX now stays on the event lot instead of entering Heidestraße.** The
  complete procedural footprint is fitted between the delivered
  OSM-derived surface polygons for Heidestraße, Minna-Cauer-Straße and
  Döberitzer Straße. Drawn and Minecraft forms keep a tested **2.553 m**
  minimum road-surface clearance, clear the northern Tiergartentunnel portal
  and intersect no source voxel building. Its official
  [visitBerlin listing](https://www.visitberlin.de/de/event/funbox)
  still supplies the Heidestraße/Minna-Cauer location, 2026 dates,
  4,000-plus-square-metre scale and ten-zone programme; the fitted envelope is
  code-authored presentation geometry, not a surveyed event boundary. The
  frozen model uses **5 drawn renderables / 7,921 rendered vertices** and
  **62 Minecraft blocks**.

- **The Geschichtspark Zellengefängnis Moabit is now a granular present-day
  memorial park.** OSM park way `498278335` and all **19** wall segments fix
  its plan; the four segments from brick wall way `105495351` retain their
  explicit 4 m height while the other 15 use Berlin's published general 5 m
  height only as a display value. Red brick and mortar courses, exact
  Panoptikum way `195086492`, four interpretive wing traces, three yard
  readings, hedges, information points and the Klopfzeichen audio anchor make
  the site and its remembrance of opponents imprisoned during National
  Socialism legible without duplicating its mapped lawn, paths or trees. The
  exact Berlin LoD2 cell `DEBE01AL2yz00000` remains the cell geometry rather
  than being hidden by a replacement shell.

- **The prison-park detail is stable across every mode and mobile profile.**
  Day, Night, Snowstorm and Schwellenraum share its drawn root; Minecraft
  substitutes one block-native batch. Ordinary walking collision follows only
  represented walls, the retained cell and Panoptikum solids, so the three
  mapped entrance gaps and cell approach stay open; Schwellenraum preserves
  its existing whole-park protection. Full Smooth uses **5 renderables / 7,818
  rendered vertices** and mobile
  Smooth **5 / 5,448**. Minecraft uses **one batch / 3,882 blocks / 93,168
  rendered instance vertices** in full and **one / 2,093 / 50,232** on mobile.
  The official Berlin
  [park account](https://www.berlin.de/tourismus/parks-und-gaerten/4216129-1740419-geschichtspark-zellengefaengnis-moabit.html)
  and
  [monument record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050274)
  provide history and present-day programme facts; all fine interpretation
  geometry remains non-surveyed. No
  protected plan, photograph, canvas image or photographic texture is traced,
  bundled or loaded.

- **The Richard-Wagner-Denkmal is now exactly anchored and navigable as sight
  90.** OSM node `243487615` fixes the plan position and Landesdenkmalamt
  Berlin part object `09046318,T,041` fixes the official monument identity.
  The former closed LoD2 protective-shelter envelope `SR00009n` is removed
  from both the drawn building shell and its six-column voxel mass. Day,
  Night, Snowstorm and Schwellenraum instead share a dedicated open steel and
  translucent barrel-vault shelter around the six-metre marble ensemble;
  Minecraft substitutes one block-native counterpart. The smooth root is
  frozen at **6 renderables / 12,167 rendered vertices** and Minecraft at
  **one batch / 514 blocks**. Front, rear, side and high under-roof approaches
  remain open while authored granular collision follows only represented
  marble and canopy posts.

- **Sources and reconstruction remain deliberately separate.** The OSM point,
  monument-register identity and published overall/figure dimensions are
  source facts. Local sculptural segmentation, canopy section, component
  spacing and collision volumes are procedural display reconstructions, not a
  survey. No visual-reference photograph, thumbnail or photographic texture
  is bundled or loaded by the viewer.

- **Weidendammer Brücke is now navigable as sight 91 and recognisable at close
  range.** Exact OSM way `6228081` fixes its centre and bearing, Berlin's
  current bridge inventory fixes the **69.48 x 25.17 m** envelope, and
  [Landesdenkmalamt object `09030074`](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030074)
  fixes the protected three-opening and ornament system. One railing system
  carries exactly **two forged central eagle reliefs and eight lamp standards**;
  the old duplicate ornament is removed. Deterministic present-day love locks
  remain explicitly non-surveyed: **192** in full and **96** on mobile. Full
  Smooth uses **5 renderables / 46,568 stored vertices / 90,116 rendered
  vertices**; mobile uses **5 / 32,744 / 54,404**. Minecraft substitutes one
  batch with **344 / 224 blocks** and **8,256 / 5,376 rendered instance
  vertices** in full / mobile. The deck and approaches remain walkable.

- **The Prussian eagle's Biermann association is documented without copying
  the song.** The metadata records the cultural connection to Wolf Biermann's
  *Ballade vom preußischen Ikarus* but contains no lyric. The love-lock field is
  a current procedural display rather than a lock inventory, and no bridge
  photograph, plan, portrait or texture is shipped or loaded. Richard Wagner
  remains sight 90; the CSD memorial place remains a separate uncatalogued
  model outside the 93-place tour.

- **Goethe and Lessing now read as their real Tiergarten ensembles rather than
  generic monument blocks.** Exact OSM nodes `278738513` and `884700390` keep
  the two works independent. The Goethe model follows Fritz Schaper's
  Carrara-marble figure, articulated round pedestal, inscription, paired
  allegories and reconstructed iron enclosure. The Lessing model follows Otto
  Lessing's white-marble author with book, reddish-granite pedestal, front and
  rear bronze allegories, three portrait reliefs, side basins and present
  simplified fence. Its visible, Minecraft and collision forms share the same
  **28-field, eight-segment chamfered octagon**. Berlin's monument inventory
  and Bildhauerei in Berlin provide the factual and dimensional evidence; the
  photographs remain QA references rather than runtime assets. Without snow,
  Goethe is exactly
  **6.08 m** high and carries **42** fence fields plus all three paired
  allegories/six figures; Lessing is exactly **7.00 m** high with five steps,
  two basins and dolphin spouts, three portrait fields and both principal
  bronze allegories.

- **Both monuments are complete all-mode citizens.** Day, Night, Snowstorm and
  Schwellenraum share their source-bound drawn geometry, while Minecraft uses
  separate coarse block-native counterparts and never exposes a smooth double.
  Snow accumulation is reversible. Their combined Smooth Snowstorm profile is
  **8 renderables / 24,870 rendered vertices**; Minecraft is **one
  InstancedMesh / 557 blocks / 13,368 rendered vertices**, and both
  representations store **9 renderables** in total. Schwellenraum protection
  uses **4.3 m** and **2.95 m** radii for Goethe and Lessing. Walking collision
  follows only the represented core and fence-side solids, so the surrounding
  mapped park paths and all eight sampled approach directions remain usable.

- **Pariser Platz now distinguishes four major civic buildings at close
  range.** The Max-Liebermann-Haus, French Embassy, US Embassy and Akademie der
  Künste each receive a source-bounded, texture-free facade layer over their
  retained Berlin LoD2/OSM bodies: reconstructed Stüler cadence and cornices;
  roughened base, Bel Etage and Rue de France; limestone grid, cylindrical
  entrance and State Room lantern; and transparent circulation facade with its
  suspended historic trace. The drawn layer serves Day, Night, Snowstorm and
  Schwellenraum; one coarse opaque block batch gives all four a distinct
  Minecraft reading without copying the smooth geometry.

- **The Center / former Sony Center and TIPI am Kanzleramt have more complete
  silhouettes.** The Forum combines its 24-part plan with ring lattice,
  radial/stay cables, kingpost, seven supports, clamps, ridge/valley runs,
  soffit lights, six-register curved facades and a detailed pool/fountain. The
  TIPI keeps the published 32 x 26 m envelope but gains an eight-peak compound
  canvas, 48 seam ribs, entrance/foyer, side and rear pavilions, ticket booth,
  planters and restrained night light. Its fictional `PIGOR & EICHHORN`
  headline is explicitly viewer display text authored by the user/project
  owner—not by the venue—and stays legible in all five modes, including its
  separate block-native Minecraft version. The presentation-only `NUR HEUTE
  ABEND` line remains legible in the four drawn modes and is not duplicated in
  Minecraft.

- **The Berliner Ensemble sign and public art now follow the current reading;
  Brecht is selectable as sight 92.**
  Its open roof ring is a photo-bounded 4.8 m across and turns once per 120
  seconds in all five modes, with a bounded 12/8 Hz cadence and still poses for
  reduced-motion, hidden, distant, off-screen or underside views. Fritz
  [Cremer's slightly over-life-size seated Brecht](https://bildhauerei-in-berlin.de/bildwerk/bertolt-brecht-denkmal-5412/)
  now has a distinctly bald, articulated head with brow, eyes, ears, long
  angular nose, mouth and chin; a loose shirt collar and placket; overlapping
  hands with individually readable fingers; straight trouser folds, cuffs and
  shoes; and the deliberate empty place on the asymmetric open metal bench.
  The warm dark-brown bronze stays separate from the published six-metre
  circular sett platform and three cylindrical,
  horizontally jointed black-stone steles complete the installation. Credits
  distinguish Peter Flierl's installation design, Fritz Cremer's sculpture and
  Carlo Wloch's stonework/steles. The platform remains traversable outside the
  actual artwork solids. Full/mobile Smooth is **3 renderables / 38,400 stored
  and rendered vertices**; Minecraft uses one deterministic **4-batch /
  197-block / 4,728-rendered-vertex** counterpart over one shared 24-vertex cube
  and without a smooth double. Its
  14 m close camera and 34/105 m fine fade keep the granular anatomy bounded.
  `Eine Skulptur für Helene Weigel`, unveiled on 10 May 2026, now reads as the
  actual installation in the Helene-Weigel-Hof: a transparent glass cube on a
  white plinth contains the central red folding director's chair with both
  crossed scissor frames clearly visible, a folded red chair/object landscape,
  light/audio elements and cable runs. A large black procedural raster portrait
  sits on the glazing rather than being painted onto the objects.
  Both exact OSM nodes are protected from generic monument doubles; no press
  photograph or portrait texture ships in the viewer. The Brecht steles carry
  only non-legible incision cues: no copyrighted poem or quotation is
  reproduced.

- **Minecraft adds only a sparse complement of hostile staffage.** Four
  Creepers, three bow-carrying Skeletons and six Zombies share one instanced
  desktop draw call; mobile uses three, two and five. They follow deterministic
  tree-cleared, memorial-protected grass routes and disappear outside
  Minecraft, water and underside presentations.

- **Traffic-signal poles now stand at the roadside instead of in the modelled
  carriageway.** Schema 7 retains all **1,328** source OSM signal nodes and the
  backwards-compatible raw coordinates. Exactly **1,093** physical poles move
  to deterministic exterior verges: **1,092** carriageway nodes plus one
  decimetre-edge case; **227** already-safe poles stay put.
  Eight directly sourced refuge-island signals remain at their mapped
  positions on a small visible island base, while unverified road-union holes
  are never accepted as islands. Every moved pole is at least 0.5 m clear of
  the road after decimetre quantisation, and no signal is removed. A
  schema-specific cache-busting request prevents stale schema-6 data from
  masking the correction.

- **Nine official civic flags now flutter gently in all five visual modes.**
  The three German and one European Reichstag flags, the German and European
  Chancellery protocol flags, the Flag of Unity, the Swiss Embassy flag and the
  Federal President's standard share one deterministic wind field across 30
  cloth and emblem layers. Free-edge movement stays at or below 0.28 m and is
  limited to 12 Hz on non-touch devices or 8 Hz in the mobile-like touch
  profile. Reduced-motion, distant, underside and hidden-page presentations
  hold an authored pose. Snowstorm adds a reversible frost tint and exactly 27
  instanced icicles, which move with the same light wave. Minecraft retains
  coarse block masts but replaces their static block-cloth doubles with this
  narrow animated-cloth exception; the redundant older Flag-of-Unity monument
  copy is removed without dropping its OSM source identity.

- **Hotel Adlon and Starbucks now read from their real Pariser-Platz
  frontages.** Adlon follows OSM relation `4582978`, outer way `26041943` and
  LoD2 anchor `K00006ot`: its 68.78 m oblique public facade carries five tall
  arches, a rusticated stone base, wine-red entrance canopy, varied window and
  wrought-iron balcony registers, patinated stepped mansard, dormers, flags
  and open roof lettering. Starbucks follows OSM node `66917229` around the
  south-west corner of LoD2 body `K00005Hq`, with two shallow dark-glass
  storefronts, grey facade wordmarks and freestanding black terrace elements
  instead of the former diagonal green fascia. Both are static and source-bound
  in Day, Night, Snowstorm and Schwellenraum; Minecraft uses one shared,
  coarse, opaque block batch rather than either smooth model. The four pinned
  Wikimedia references are publicly attributed and are not projected or
  bundled as facade textures.

- **Mobile-like touch sessions retain one bounded world family at a time.** This
  profile applies when the primary or any pointer is coarse, or the browser
  reports `navigator.maxTouchPoints > 0`. Its nearest **5,000 LoD2 buildings**
  retain exact geometry. After the first 320-building frame, the delayed Worker
  fetches the source once from its URL, adds all eligible buildings beyond that
  near field as measured, oriented, source-coloured instance shells in one draw
  call, and then progressively builds the remaining 4,680 exact near-field
  records. The main thread sends no cloned city, ground or surface payload, and
  the Worker creates no exact `surface-*` batches.
  Raster ground, water and asphalt plus the complete authored park-path network
  retain the map reading. With the tunnel in production, park detail measures
  **107,199 instances and 11,639,110 bytes of geometry plus instance buffers**
  in the touch profile; non-touch settled production measures **499,952
  instances and 44,062,710 bytes**. The frozen no-tunnel/no-settled-detail
  comparison remains **107,237 / 72 drawables / 11,641,638 bytes** touch versus
  **450,029 / 1,478 / 40,221,966 bytes** full. Hidden tabs stop partial
  refinement and restart it cleanly
  when visible. A cold Minecraft start builds no ParkDetails in either profile
  and delays `surface-polygons.json` until an actual switch to a drawn mode or
  pedestrian water collision needs it. No mode or recovery path allocates the
  retired GLB world.
  Switching between
  drawn and voxel families remounts a single clean WebGL world on the touch
  profile. Independently of profile, a runtime failure gets one automatic clean
  remount, then visible Recovery and 2D-map choices. Non-touch desktop keeps the
  bounded exact building, procedural surface and park geometry. These
  are frozen production-profile budgets and automated contracts, not
  physical-device or iOS claims.

- **Minecraft and WebGL stay inside substantially smaller memory budgets.**
  The earlier pre-retention benchmark measured **845,561 instances / 63.265
  MiB of instance buffers** on touch and **3,419,412 / 249.815 MiB** in full.
  Current streamed 1/3 and 2/3 tree retention makes those figures conservative
  upper bounds; small mob and loot batches are separately fixed. Only the touch
  profile omits generic facade panes and meadow flowers and collapses non-Hero
  source columns; all Hero courses up to 8 m, block signatures and navigation
  stay intact. Every WebGL profile
  disables renderer MSAA and uses a 0x `UnsignedByte` composer with one final
  SMAA pass. Inactive world builds are canceled, failed
  voxel attachment rolls back, and the smooth park stays hidden without toon clones in voxel
  mode. This is benchmark- and browser-tested, not a claim of physical iOS
  device validation.

- **Minecraft's principal architecture is deliberately coarser and more
  block-like.** Fewer than 5,000 block-native signature blocks use an 8 m hero
  raster. Retained Reichstag, Federal Chancellery and parliamentary source
  bodies are split into vertical block courses no taller than 8 m, while their
  smooth architectural overlays remain hidden in Minecraft. Existing entrance
  portals, open passages and free orbit, pan, zoom, flight and pedestrian
  navigation remain available.

- **Invalidenfriedhof and the Günter Litfin memorial now have individual
  identities; Scharnhorst is selectable as sight 93.** Scharnhorst's monument
  at exact OSM node `273120316` now reaches
  its [published **5.60 m** overall silhouette](https://berlingeschichte.de/lexikon/mitte/i/invalidenfriedhof.htm):
  Schinkel's two-pier architecture
  and iron railing frame the Carrara-marble sarcophagus, Friedrich Tieck relief
  frieze and a recognisably reclining bronze lion rather than an ellipsoid.
  Christian Daniel Rauch modelled the lion and Theodor Kalide executed it; the
  [Schinkel portal](https://schinkel.smb.museum/image_orte.php?id=28) supplies
  form/material context and identifies the present sarcophagus and frieze as
  conservation copies. The
  characteristic Witzleben,
  Winterfeld, Kessel and Rauch grave monuments, the Auguste-Viktoria bell, the
  distinct canal and Hinterlandmauer layers, and the separate former GDR
  command post at Kieler Eck use official monument, OSM and LoD2 anchors. Open
  frames and paths stay walkable, the fine details are batched and static in
  every mode, and no supplied photograph is shipped as an image or texture.
  The structural lion remains legible after close-only mane/face/claw detail
  fades. Full/mobile Smooth is **8 renderables / 554 stored / 15,539 rendered
  vertices**; its Minecraft contribution is **4 batches / 566 blocks / 13,584
  rendered instance vertices** over one shared 24-vertex cube. The 18 m focus uses the exact anchor, collision
  leaves the centre between the two piers open, and Minecraft keeps a separate
  block-native signature.

- **All five Brandenburg Gate passages are open to pedestrians everywhere.**
  Day, Night, Minecraft, Snowstorm and Schwellenraum now share the same five
  source-scoped historic openings. They are walkable continuously from either
  side in warm and cold-start worlds, while all twelve columns, the lintel,
  upper masonry and both side pavilions remain solid. Other authored interior
  exceptions keep their existing mode boundaries.

- **The Berliner Ensemble now opens on its real public facade.** The theatre
  retains all four official LoD2 parts and their measured heights. A thin
  source-bound layer follows the actual stepped facade and corner entrance,
  using the present stripped warm-grey render, arched window rhythm, granite
  columns, truncated roof and a smaller open two-line roof sign instead of the
  former floating rectangular reconstruction. The camera now looks from
  Bertolt-Brecht-Platz, while the Brecht and Helene Weigel works remain
  separately owned public-art models at their committed OSM positions.
  Minecraft adds one source-bound instanced block signature with a taupe tower,
  stepped hipped roof, smaller open ring and restrained two-line lettering;
  none of the smooth facade or text geometry leaks into the voxel mode.

- **Schwellenraum and every other lazy 3D start recover across deployments.**
  If an already-open tab asks for a superseded hashed viewer chunk, it reloads
  once to obtain the current asset manifest. A repeated failure shows clear
  Reload and 2D-map actions instead of making the mode button appear inactive.
  The live deployment also retains hashed assets for the current and at least
  the previous two releases, so older open tabs remain compatible.

- **Schwellenraum water now glints and hazes very gently without moving.**
  A deterministic, texture-free light layer covers mapped rivers, ponds,
  basins and separately authored fountain tops at 3.75 Hz. Protected memorial
  volumes remain exact Day, reduced-motion stays static, and neither geometry,
  wakes nor boats animate.

- **The Reichstag portico now carries its missing crowned ornaments.** The
  paired pediment finials and two official Wappenbaum reliefs are separate
  static structures; the latter occupy clear outer column bays and carry 20
  shield cues. Minecraft receives its own pale marble/quartz block version
  without hiding columns or changing the four roof flags.

- **Tiergarten paths preserve more of their mapped geometry and material.**
  The park detail payload retains 13,400 committed OSM support points across
  3,467 ribbons, centimetre widths, nine close-view surfaces and every eligible
  park-clipped informal path in the bounded source snapshot. No guessed desire
  path is introduced.

- **The Siegessaeule now reads correctly from base to mosaic hall.** Four
  bronze reliefs sit on the red-granite base, while the polychrome
  von-Werner/Salviati mosaic is one level higher behind the 16-column hall.
  Drawn and Minecraft versions share the exact 67 m total height.

- **The Reichstag west front now has a more faithful classical hierarchy.**
  The measured shell, glass dome, flag masts and cloth dimensions stay fixed,
  while the four cloth fields use only their bounded wind deformation and the
  six-column portico gains 24-flute shafts, Corinthian leaves and volutes,
  profiled plinths, a central tympanum group, alternating triangular and
  segmental window crowns, keystones, sills, attic relief panels, rosettes and a
  neutral light-limestone palette. `DEM DEUTSCHEN VOLKE` remains physically
  separated from the stone band to prevent coplanar shimmer.

- **The Terrassenhaus at Hafenplatz now follows its official stepped massing.**
  All 26 Berlin LoD2 bodies retain their measured footprints and heights. A
  source-bounded recognition layer adds four descending terrace arms, the
  characteristic cross-shaped height cascade, long horizontal window bands,
  ochre frames and mullions, exposed-aggregate spandrels, courtyard loggias and
  segmented parapet rhythm. Hidden internal walls are omitted and no photo
  texture is bundled.

- **Potsdamer Platz now has its two separate original station entrance halls.**
  Their exact LoD2 footprints and heights anchor two semi-open steel-and-glass
  structures with gridded roofs, cross braces, open fronts and distinct stair
  and escalator pairs instead of one generic underground entrance cue.

- **The Moabit prison memorial no longer walls off the B96.** Its 22-point OSM
  park ring and four mapped wall ways / 19 exact segments replace the former
  enclosing rectangle. The three mapped entrance gaps and cell approach remain
  passable in normal pedestrian collision, while Schwellenraum keeps its
  existing whole-park protection. The red-brick walls stay west of Heidestraße;
  one explicitly tagged way renders at 4 m and the other source-height-free
  ways use Berlin's general 5 m description only as a display value.

- **The parliamentary Spree crossing is open again.** The false tall LoD2 wall
  and its 16 footprint-matched Minecraft columns are suppressed. The public lower
  Marie-Elisabeth-Lüders-Steg and the slender upper
  Jakob-Maria-Mierscheid-Steg are separate open structures; the MELH river
  front also gains its circular opening, columned canopy and mapped widening
  freitreppe. Day, Night, Snowstorm, Minecraft and Schwellenraum share the correction.

- **The pedestrian mouse wheel now walks instead of doing nothing.** Wheel up
  moves forward and wheel down moves backward along the current heading. A
  regular wheel notch gives a clear step, fine vertical trackpad deltas remain
  proportional, and pinch or horizontal gestures cannot move the walker. The
  motion uses the existing collision-aware pedestrian path, so buildings,
  trees, walls, tunnel geometry, terrain and water keep exactly the same solid
  behavior as keyboard and joystick travel.

- **The Deutsches Theater now reads as its real historic ensemble.** Its 15
  official Berlin LoD2 parts retain their measured footprints and heights,
  while a source-bounded recognition layer separates the ivory main theatre
  from the pale-sage Kammerspiele. The main entrance gains its shallow
  pediment, pilasters, tall arched windows, terrace and gold `DEUTSCHES
  THEATER` lettering; the Kammerspiele gain seven arched bays, shutters and
  their two-line historic name. A raised open-frame gold `DT` roof sign,
  restrained corten garden beds and paired period lanterns complete the
  Schumannstrasse frontage without replacing or moving official geometry.

- **The older Charite campus now reads as three real architectural periods.**
  The former Pathological Institute and today's Berlin Museum of Medical
  History use their exact 20-part Berlin LoD2 shell with red brickwork,
  sandstone/plaster dressings, segmental-arched mullioned windows, cornices
  and dark slate roofs. The 1901 Friedrich-Althoff-Haus entrance gains the
  same documented material language plus its measured-envelope stair-tower
  helm. The Institute of Virology in the 1956-60 Edmund-Lesser-Haus remains a
  distinct pale post-war building with white window frames and restrained
  ivy instead of being incorrectly historicised. Generic facade windows are
  suppressed on all 32 source parts, preventing duplicates and flicker; the
  added articulation is source-bounded and explicitly not survey geometry.

- **The Albrecht von Graefe memorial now faces the Schumannstrasse/
  Luisenstrasse corner.** Its OSM point stays fixed while the complete
  three-axis sandstone ensemble follows the local street approach. The
  1.66 m bronze now has a readable bearded portrait, hands, frock-coat folds
  and ophthalmological instrument; the shell niche, polychrome reliefs,
  curved forecourt rail and the tall Charite boundary fence behind it are
  separately drawn rather than collapsed into one block.

- **Pedestrian mode now treats the mapped city as a solid place.** Exact LoD2
  footprints, including real courtyard holes, stop the walker at building
  facades. Official and OSM tree trunks, shrubs, lamp posts, wall traces and
  fixed playground equipment share the same collision index. Thin objects
  remain solid even at 4x sprint speed, while wall sliding, tunnels, solid
  shorelines and the rotating civic start continue to work. Entering mapped
  water is rejected in place and never resets the walker.

- **The Berlin Pavillon now reads as the real glazed visitor and souvenir
  venue at the Reichstag forecourt.** Its landmark anchor is corrected to the
  four-part Berlin LoD2 shell at Scheidemannstrasse 1. A charcoal storefront,
  twenty stable glass panes, visible souvenir shelves and postcard stands,
  indoor cafe fittings, a shaded terrace, bollards and restrained facade
  lettering replace the former misplaced generic marker. Warm unlit interior
  materials keep the merchandise legible after dark; the recognition details
  are drawn geometry derived from attributed Commons references, not copied
  photo textures.

- **The Brandenburg Gate now follows its real five-passage Doric rhythm.** Two
  rows of six fluted columns use the published column and passage dimensions;
  the centre opening is visibly wider than the four side openings. Recessed
  gatehouse porticoes, pediments and roofs, the layered frieze and attic, and a
  centred Quadriga replace the former overlapping LoD2 boxes and blank slabs.

- **The Soviet War Memorial now matches its street-facing composition.** The
  broad granite forecourt rises through four shallow stair courses to two
  officers' sarcophagi, six open colonnade bays and the stepped central pylon.
  Its eight-metre bronze soldier, complete Russian dedication, gilded emblem,
  `1941`/`1945`, two numbered T-34s, two ML-20 howitzers, formal beds and twin
  fountains are drawn as deterministic geometry rather than photo textures.

- **The Reichstag now opens on a granular west elevation.** The default lawn
  camera presents the six-column portico, `DEM DEUTSCHEN VOLKE`, four corner
  pavilions and Foster dome together. Five bays per wing, arched reveals,
  fluted Corinthian columns, alternating window pediments, quoins, balusters,
  roof figures, rusticated basement openings and the recessed glass entrance
  reproduce the frontal reference as drawn geometry. Only the two closed LoD2
  portal boxes are replaced; the official main footprint, height, orientation
  and six courtyards remain unchanged.

- **Desktop navigation now lives in a compact lower-corner dock.** The button
  pad and analogue orbit control start together at the lower left instead of
  obscuring the upper city view. One icon moves the complete control dock to
  the right and back again, and the browser remembers that preference. The
  same choice moves the direct touch joystick on phones and tablets; wrapped
  attribution remains clear of the controls in shallow laptop windows.

- **Smaller places now retain their identity at close range.** Source-audited
  recognition layers refine Paris-Moskau, ALDI Invalidenstrasse, REWE
  Heidestrasse, Motel One, Tour TotalEnergies, the Sozialgericht,
  Hansabibliothek, Walter-Gropius-Haus, the oval Bundespraesidialamt,
  Adlerbruecke, Lutherbruecke, three Tiergarten memorials, Leipziger-Platz
  stair mouths and the current roofless Teehaus. Berlin LoD2 and OSM remain the
  metric anchors; the added facade and monument micro-detail is explicitly
  presentation geometry rather than a claimed 10 cm survey.

- **Minecraft is more deliberately built from blocks.** Its palette gains
  stable clinker, terracotta and timber families, tall buildings receive
  coherent plinth/body/cap layers, and the bounded full/mobile mob fields of
  thirteen/ten roaming Creepers, Zombies and bow-carrying Skeletons have clear
  faces and clothing without adding draw calls or flickering random roof
  patterns.

- **The civic skyline is now genuinely block-native in Minecraft.** Reichstag,
  Bundeskanzleramt, Hauptbahnhof, Brandenburger Tor, Paul-Löbe-Haus and
  Marie-Elisabeth-Lüders-Haus use five opaque instanced cube batches instead of
  the smooth Day models. Their porticos, stepped glass dome, semicircular
  Kanzleramt openings, crossed station halls, open Gate passages, committee
  rotundas, Spree bridges and widening stair remain recognisable. The 15,469
  blocks share one geometry/material; quartz and pale limestone dominate,
  while silver, lapis and gold stay below 1.2% and follow real architectural
  cues. Exact ownership masks remove only the 12 closed Reichstag-portico,
  188 Kanzleramt-cube, 1,284 Hauptbahnhof, 52 Gate, 149 Paul-Löbe rotunda,
  85 Lüders-Haus rotunda and 40 Lüders-Haus stair source records; complete
  block floors, facade shells, roofs and glazing replace them without erasing
  courts or neighbours. No texture, transparency, extra payload or idle
  animation is added.

- **Mobile controls now open ready to use.** Phone and tablet layouts always
  start with the flight/walking joystick and control chrome visible, even when
  an earlier desktop session stored a hidden-controls preference. Narrow
  layouts also keep the joystick available when a browser reports an attached
  stylus or trackpad as its primary pointer; deliberate hide/show still works.

- **The Bundestag Kita now stays clear of the diagonal cycle and foot path.**
  Its former oversized rectangular recognition shell is clipped inside the
  exact OSM building outline, preserving the official LoD2 anchor and the
  building's coloured facade details. A metric regression test enforces more
  than 2.3 m clearance from OSM way `912645859` for both body and roof.

- **The hosted viewer opens from a small procedural core and never downloads a
  hidden visual tier.** Day, Night, Snowstorm and Schwellenraum use the compact
  terrain context, LoD2 prisms and bounded OSM surface JSON; the Minecraft
  instance payload stays lazy until that mode is selected. The 183 MB of
  retired GLBs and the redundant road plate are absent, every underside view
  uses the authored tunnel/network cutaway, and JSON requests time out and
  retry rather than hanging forever. Browsers without WebGL 2 switch cleanly
  to the map fallback.

- **The Berliner Ensemble and Reichstag now carry a stronger architectural
  reading.** The theatre's circular sign sits on its western roof tower and
  uses the current bounded 120-second rotation contract; Bertolt Brecht
  occupies his surveyed turntable on the square and the 2026 Helene Weigel
  work stays in the theatre courtyard. The Reichstag's west entrance gains a
  deep recess, opaque limestone order, relief field and higher-contrast bronze
  dedication without changing the measured LoD2 envelope. The Quadriga uses a
  lighter green-bronze daylight register so its four horses, Victoria and
  standard remain legible against the Tiergarten.

- **Nordhafen is a canal basin again.** The OSM `pond` label no longer lifts it
  to Tiergarten pond height or produces a stepped northern continuation. The
  official east-to-west Panke mouth is marked with a restrained fish-pass
  register. The Konrad-Adenauer-Haus now follows its exact OSM glass plan and
  source-described elliptical inner body without political lettering; the
  temporary FUNBOX palette is quieter, TIPI has its projecting entrance and
  ticket booth, and the Carillon roof uses its dark patinated finish.

- **The Bundeskanzleramt forecourt no longer contains an invented white
  circular pavilion.** The unsupported drum, wraparound glazing and round roof
  are removed together, including their night and Minecraft representations;
  the measured building envelope, Eduardo Chillida sculpture, protocol flags,
  lamps and paved approach remain unchanged. The real slender security fence
  now spans the paved Ehrenhof between the two office wings with its central
  gate clearly modelled and metrically pinned to the forecourt axis.

- **The opening view now starts above the Platz der Republik lawn in front of
  the Reichstag.** The elevated camera frames the west facade, flags and glass
  dome immediately; Reset returns to the same view. The bootstrap camera and
  the final landmark focus share one pose, preventing a visible jump while the
  scene loads. The pedestrian mode remains at realistic eye height and is not
  affected.

- **The Sony Center Forum roof now reads as the light suspended structure it
  is, rather than a heavy generic slab.** Its 24 mapped roof panels follow the
  published 102 x 78 m elliptical ring, with alternating translucent
  membrane and glass, the open centre, radial cable net, tilted kingpost,
  seven supports and reflecting pool. Instanced steelwork and non-overlapping
  transparent sectors keep the reconstruction crisp while orbiting; the old
  generic city shell is suppressed only within this measured roof envelope.

- **The WELT balloon is now white with a crisp black wordmark, as requested.**
  The former beige ellipsoid, red panel, box gondola and single heavy cable are
  replaced by a 22.67 m spherical technical-fabric envelope, four curved
  mipmapped `WELT` inscriptions, a 5.90 m ring gondola, 24 suspension lines,
  tether, ground winch and boarding pad. The same white/black livery stays
  readable at night; no photograph is copied into its procedural texture.

- **The Tiergartentunnel now meets the surface through four real access
  sites.** Minna-Cauer-Straße, Invalidenstraße/Hauptbahnhof, Kemperplatz and
  Reichpietschufer use eight separate mapped carriageways, lane-derived widths
  and local official-mesh heights. Joined ramps, retaining and acoustic walls,
  portal frames, medians, railings, lane controls, signs and threshold lights
  stay coherent in Day, Night, Minecraft, Snowstorm and Schwellenraum. Narrow
  shared surface cuts stop
  the tunnel from bleeding through parks, water, buildings or the railway
  deck; buried helper bores remain occluded in every exterior view.

- **The Georg Elser memorial now follows its real steel silhouette instead of
  five generic rods.** It stands at exact OSM sculpture node `1986458966` with
  the published 17 m height, a continuous three-layer dark-steel profile and
  silver cut edges. The flush pavement plaque reproduces the complete wording
  `Ich habe den Krieg verhindern wollen. / Georg Elser, Ende November 1939`.
  Profile and plaque proportions are photograph-bounded reconstruction rather
  than surveyed geometry; a dedicated stable close view works in every mode.

- **The owner-supplied Ahornsteig point now carries a dedicated Queer Rainbow
  Memorial model.** Its exact position and official-mesh ground sample remain
  recorded, while the visible base follows the same continuous park surface as
  the viewer. A six-colour heart, tied fabric, flowers, candles, messages and
  small Pride flags reproduce the supplied field-view cues with deterministic
  procedural geometry; no screenshot or photo texture is bundled. The changing
  arrangement and tree dimensions are explicitly not surveyed. Night adds a
  restrained candle pool and Snowstorm adds crown snow. The direct viewer link
  is `#landmark=queer-rainbow-memorial-berlin`.

- **The newly established CSD memorial place nearby is a separate, additive
  ensemble.** Its source anchor is exact OSM node
  [`14076715427`](https://www.openstreetmap.org/node/14076715427), not the
  owner-supplied Queer Rainbow Memorial point 165 m farther east. A young
  French maple with an already leafed crown stands inside a round, segmented
  metal guard carrying a sparse, static selection of small Pride flags,
  wreaths and unlettered cards; a rainbow-slatted bench completes the place
  across the sett path. Day, Night, Minecraft, Snowstorm and Schwellenraum all
  retain the ensemble and keep it legible. The anchor and species are source
  facts; every local part dimension,
  orientation and offering placement is a photo-bounded, non-surveyed display
  estimate. No supplied or press photograph is bundled or projected as a
  texture.

- **Brandenburg Gate and Pariser Platz now carry a photograph-bounded close
  detail pass.** The published 62.5 x 11 x 26 m gate envelope and official
  placement remain fixed, while the 12 Doric columns receive 20-line fluting,
  three continuous stylobate courses, stepped plinths and necking; the five
  passages gain masonry divisions, medallions, relief panels and 25 ceiling
  coffers. Twelve projecting architrave courses, stepped cornices, a readable
  attic relief and four solid side-pavilion pediments replace distance-sensitive
  line work. Muted copper roofs and the detailed four-horse Quadriga retain
  their published overall dimensions.

- **The Pariser Platz foreground now follows its formal public-space
  hierarchy.** A cool-grey central sett field replaces the generic orange
  plaza fill without changing its footprint. The two mapped parterres now have
  continuous lawns, pale stone rims, flower borders, four clipped shrubs, low
  rails and two blue fountain basins with white jets. Eight historic twin
  lanterns, eight benches, 16 tree grates, six drainage bands and 192 permanent
  access bollards complete the square. Temporary barriers remain omitted and
  none of the six reference photographs is bundled or projected as a texture.
  The visible radius is **6,450 m**.

- **The current Federal Chancellery extension work is now visible across the
  Spree instead of leaving an obsolete park surface.** Current OSM construction
  ways fix the curved six-storey office shell, low service wing, complete site
  boundary and the South Bridge axis. The Federal Government's April 2026
  project update fixes the displayed stage as a largely completed shell under
  technical fit-out, while the published 180 m bridge length controls the
  installed crossing. Two restrained work aprons, partial scaffold, cranes,
  fencing, barriers and material stacks communicate that active phase without
  claiming temporary equipment as surveyed. Old trees and lamps are suppressed
  only within the mapped worksite; Day, Night, Minecraft, Snowstorm and
  Schwellenraum share the same metre-scale placement.

- **The original Federal Chancellery now has an exterior-visible interior.**
  Its official LoD2 position and published 55 x 55 x 36 m leadership-building
  envelope remain fixed. Six supplied exterior views bound split gallery
  plates around an open 14.4 m atrium, three cross-bridges, a two-flight stair,
  gallery rails, sparse generic meeting groups and planting. Cool transparent
  glazing now reveals those layers by day and night; only separate ceiling,
  lobby, linear gallery and roof-soffit lights glow warm after dark. The
  supplied photographs are not bundled or used as textures. Interior fixtures
  are an exterior-visible recognition reconstruction, not a surveyed or
  security-relevant floor plan.

- **The Swiss Embassy now has its photographed historic street front.** Its
  measured LoD2 envelope remains fixed, while the 1870/71 palace adds the
  nine-bay, three-storey window rhythm, pale stone surrounds, engaged columns,
  fine cornice work, warmer rusticated base and offset panelled entrance visible
  from Otto-von-Bismarck-Allee. A 104-member roof balustrade frames the smaller
  centred Swiss flag; the modern Diener & Diener wing remains architecturally
  distinct. The supplied photograph is not bundled or projected as a texture,
  and non-surveyed moulding and fixture dimensions remain documented visual
  estimates.

- **Adlerbrücke and Löwenbrücke now read as their actual historic park
  crossings.** The Adlerbrücke follows OSM way `28872983` and the official
  06/2025 inventory's 7.30 x 3.35 m structure, with yellow-brick abutments,
  fourteen wavy iron railing bays and the two large central cast-iron eagle
  reliefs visible in current photographs. The rebuilt Löwenbrücke follows OSM
  way `1411957328`, the inventory's 18.30 x 1.88 m deck and the engineers'
  complementary 26.80 m overall length, 17.60 m main span, 0.80 m timber depth
  and four 31.3 mm ropes. Longitudinal boards, nine timber truss bays, four
  inward-facing bronzed lions, suspension cables and the documented modern
  steel-rope handrails with mesh safety fields replace the grey generic slab.
  Photographs remain non-bundled visual references; sculptural, mesh and
  joinery dimensions not published by the sources remain explicit display
  reconstructions.

- **The Federal Chancellery now follows its measured and published hierarchy
  instead of reading as a pale glass block.** Berlin LoD2 retains the 18 m
  office bands; the fully reconstructed 36 m leadership cube alone replaces
  its 13 overlapping high-rise prisms. It now has open east/west elevations,
  thin side curtain walls, split gallery plates around an open atrium, the
  visible stair and bridges, the monumental semicircular
  halls, Schultes and Frank's concave roof shell, the lower tensile canopy,
  Ehrenhof glazing, ivy wings, protocol flags, entrance pavilion, lamps,
  security fence and the long paved approach. OSM node `4329873408` fixes
  Chillida's 5.5 m `Berlin` sculpture in the real eastern Ehrenhof. The owner
  photographs are visual references only: they are not bundled or projected
  as textures, and unsurveyed fixture dimensions remain presentation
  estimates.

- **The full 3D scene no longer aborts when drawing the Cube Berlin sign.** A
  missing geometric `Z` glyph previously made `GLEISS LUTZ` throw during scene
  construction and silently exposed the compatibility map. The shared drawn
  alphabet and its complete-scene contract now cover that lettering.

- **The completed Amtssitz am Spreebogen now matches its current restrained
  facade and carries the presidential standard.** Its exact 37-point OSM
  footprint remains the metre-scale anchor: the bent bar, rounded head and
  92.9 x 73.72 m envelope have not moved. Five staggered modular storeys now
  use the photographed silver-grey panel and window cadence, followed by the
  documented free-form top floor, parapet and four slim roof antennae. A small
  unfolded roof standard uses the official square gold field, 1:12 red border
  and mast-facing federal eagle. Its cloth shares the bounded official-civic
  wind field and freezes outside the visible motion budget. The supplied
  photographs are neither bundled nor used as textures; exact module spacing,
  mast position and flag size remain documented visual estimates.

- **Moltkebrücke now carries its documented historic sandstone ornament.**
  Its published 77.58 x 25.70 m envelope and OSM axis stay fixed while twelve
  alternating wall and open-baluster bays replace the former picket-like
  parapet. Four Carl Piper griffins with heraldic shields, eight pointed
  bronze candelabra with 24 small Roman-soldier figures, four pier trophies,
  six keystone heads, garland reliefs and warm night lanterns are reconstructed
  procedurally from the supplied and licensed reference views. Fine ornament
  uses a separate distance-hysteresis layer, so it remains crisp nearby and
  cannot flicker in the overview. Cube Berlin also gains the small white
  `GLEISS LUTZ` tenant lettering visible from the bridge; neither owner photo
  is bundled or projected as a texture, and unsurveyed micro-dimensions remain
  presentation estimates.

- **MEININGER Hotel at Hauptbahnhof now follows its measured shell and current
  street appearance.** The exact Berlin LoD2 footprint and 31.082 m height
  replace the generic prism; current OSM semantics retain ten storeys at
  Ella-Trebe-Strasse 9. The two owner photographs bound a procedural facade
  reconstruction with pale rendered upper walls, a smooth panelled podium,
  tall graphite-framed windows, sparse warm rooms, glazed entrance and shop,
  black illuminated canopy, rooftop lettering, roof frame and eight slim
  bollards. The photos are neither bundled nor projected as textures, and
  unsurveyed fixture positions remain explicitly documented estimates.

- **Grillstand HBF now sits in its real mapped position under the western
  rail approach.** The OSM node fixes the location, while the owner photographs
  guide a non-textured procedural reconstruction of the dark kiosk, projecting
  canopy, cream-and-red illuminated fascia, menu and food panels, service
  hatch, cooler doors, bollards, bins, two outdoor tables and patio light
  strings. Fixture dimensions remain documented estimates rather than
  surveyed geometry. The whole model clears the viaduct underside and uses
  static day/night materials so it does not shimmer while the view is still.

- **The Washingtonplatz DB tower and Cube Berlin now match their defining
  structures.** The former generic 34 m station pylon is now the documented
  60 m road-tunnel ventilation stack: a roughly 30 m² triangular section with
  three steel-and-glass walls, three-field cross bracing, antenna crown,
  perforated service plinth and correctly mounted DB signs. Cube Berlin keeps
  its LoD2/OSM footprint, which measures within centimetres of 3XN's published
  42.5 m envelope, and replaces the noisy cell-by-cell checkerboard with the
  building's large mirrored double-skin folds, calm curtain-wall grid and
  sparse warm night offices. Owner photographs remain non-bundled visual
  references; no photograph or external texture is copied into the model.

- **Berlin Hauptbahnhof now carries its recognisable current concourse.** The
  official five-level station structure is now one continuous vertical hall:
  the upper east-west rail deck, upper gallery, main concourse, lower gallery
  and deep north-south platforms retain separate elevations around the open
  daylight slot. Six narrow cross bridges, real glass balustrade panels,
  Y-branched deck supports, detailed escalator flights and blue/yellow
  wayfinding make those layers legible. Four cylindrical panoramic lifts run
  from the deep platforms past all five door stations to above the Stadtbahn
  level, with transparent cabins parked at different floors, eight vertical
  mullions and close metal ring frames per shaft. The stable blue departure
  board, Einstein Kaffee frontage, framed glass service pavilion, warm static
  ceiling lights and retail rhythm remain. Repeated details are instanced; the
  owner's photographs are visual references only and are not bundled, and
  exact fixture dimensions remain documented presentation estimates.

- **The Lehrter Campus construction site now matches the current scene west
  of Hauptbahnhof.** Its position is bounded by the surveyed EDGE Grand
  Central facade and Tiergartentunnel approach; the low frame, working deck,
  falsework, scaffold, hoarding and crane reproduce the supplied August 2026
  reference without embedding the photograph. The planned nine-storey
  building is documented but deliberately not shown as already complete.

- **The temporary 2026 FUNBOX now stays inside a tested event-lot display
  envelope north of Hauptbahnhof.** A procedural model recreates the published
  4,000-plus-square-metre, ten-zone inflatable park with its five-metre slide,
  entrance arch, ticket kiosk, turrets and obstacle course without copying
  photo textures. Day, Night and Snowstorm share the drawn form; Minecraft
  receives a separate block-native version. Both remain fully outside the
  delivered Heidestraße, Minna-Cauer-Straße and Döberitzer Straße surfaces;
  visitBerlin publishes the corner and programme, not a surveyed parcel.

- **KPMG/EINZ and Europaplatz Nord now follow the photographed current
  condition.** The 84 m, 22-storey LoD2 tower carries the published 1.35 m
  aluminium facade module, calm blue-grey glazing, small upper-corner KPMG
  signs and its six-storey base instead of the former pale folded screen and
  oversized billboard. The northern forecourt shows its temporary 2026
  paving, clear routes, young tree rows, slim lamps and red-white work-zone
  barriers; it does not pre-build the still-unrealised permanent competition
  design. Minecraft gets a deliberately block-native equivalent.

- **A ground-bound pedestrian mode adds a human-scale view.** The independent
  `Walk` / `Spaziergang` control works in Day, Night, Minecraft, Snowstorm and
  Schwellenraum, starts on the terrain directly below the current camera at a
  1.80 m eye
  height, and follows the existing smooth metric terrain without changing its
  source geometry. `W`/`S` or the up/down arrows walk, `A`/`D` strafe,
  left/right arrows or `Q`/`E` turn, mouse or touch drag looks around, and
  one `Space` jumps to a bounded 6.2 m apex; a second press within 320 ms raises
  that same jump once to 10.5 m. The mouse wheel also walks along the
  current view direction (up forward, down backward) without changing camera
  zoom. Holding `Shift` gives a four-times
  sprint; double-tapping forward, the forward control or the walking joystick
  latches the same fast mode until the next double action; a mouse double-click
  on the 3D view does the same. `Space`, the jump control or a touch double-tap
  on the free 3D view jumps; drags, pinches and long presses cannot trigger it.
  Flight, camera zoom and underside controls
  stay locked in this mode; mapped water acts as a solid shoreline, so the
  walker stays in place instead of dying or being reset. A dedicated 52 px
  jump control keeps the complete workflow usable on
  phones and tablets. All five historic passages through the Brandenburg Gate
  are walkable from either side in Day, Night, Minecraft, Snowstorm and
  Schwellenraum, while its twelve columns, upper masonry and side pavilions
  remain solid.

- **Schwellenraum is a fifth, eerie and melancholic spatial mode.** It keeps
  the full Day geometry, but a dusty mauve sky and a reversible
  material-integrated lavender split tone mute ordinary city surfaces without
  a post-process pass or extra draw call. Pastel light thresholds, elongated
  repeated frames and a few fixed pieces of everyday furniture remain sparse;
  the world geometry is completely still. Lower descending roots alternate
  minor and unresolved suspended harmonies. Only the explicitly
  identified German, EU, Swiss and Federal President flags and an extremely
  faint material-only veil over mapped water may change: fixed mist fields
  breathe slowly and rare deterministic glints fade softly, without moving a
  water vertex, ripple, vessel or wake. Reduced-motion freezes the veil at one
  dim sample. A separate very quiet,
  procedural two-bus sound layer provides soft air/rustle and sparse harmonic
  tones; the ordinary music layers crossfade out and resume on exit. It provides
  bounded presentation entrances and interiors for the Reichstag plenary
  chamber, Hauptbahnhof, Bundeskanzleramt, Potsdamer Platz station cellar and
  Charite. Walking and all flight controls use swept solid collision against
  terrain, roofs, buildings, trees, walls and the new interior furnishings;
  the Tiergartentunnel remains walkable. Seventeen persecution-, war- and
  violence-related memorial zones retain their exact Day transforms and
  materials, receive no added portal or light geometry and remain inaccessible.
  The complete mode is lazy: normal startup holds two empty roots, while first
  entry creates 24 batched threshold renderables instead of the former 128;
  fixed desktop/mobile geometry budgets keep it bounded.

- **Small memorials now keep their mapped identity.** The OSM extraction
  preserves `memorial` subtypes instead of turning every quiet memorial into
  the same upright grey block. It includes 232 mapped Stolpersteine as exact
  10 x 10 cm brass pavement inserts, plus restrained forms for plaques,
  stelae, busts, statues, stones, benches and ghost bikes. Unclassified points
  stay low and conservative rather than claiming invented architecture.

- **Minecraft keeps the Brandenburg Gate recognisable.** Its complete metric
  block model now replaces all 52 stacked LoD2 source records in the correctly
  oriented 11 × 62.5 m envelope, so the passages, columns, entablature and
  Quadriga are no longer
  buried inside a second block wall. A 50-point visual and accuracy audit
  covered five principal sights in Day, Night and Minecraft; settled scene
  pixels remained stable and the visible radius is **6,450 m**.

- **Tiergarten water now follows its mapped character.** The renderer keeps
  rivers, natural ponds, small streams/ditches and constructed basins separate;
  parkland can no longer cover Neuer See or Venusbassin. Natural water gains
  local banks, visible floors, islands and a restrained transparent surface in
  Day and Night, while Minecraft keeps ponds on their local terrain. Plan
  outlines are OSM-derived; illustrative depth is not claimed as bathymetry.
  Rousseau, Lortzing, Baumdank, Flora/Pomona and *Das deutsche Volkslied* also
  use individual documented monument forms instead of generic markers.

- **Europacity now uses its real silhouettes.** EINZ/KPMG retains the complete
  official LoD2 tower and base while adding its folded pale-aluminium facade
  screen. DKB Upbeat follows the current 61-point OSM footprint and its
  published 82 m, 5/11/19-storey stepped composition; 50Hertz carries its
  exposed structural net. The same Upbeat envelope is present as a deliberately
  blocky model in Minecraft, while Night uses individual warm office windows.
  Berlin DGM1 now also fixes their relative terrain levels: KPMG, 50Hertz and
  Upbeat no longer stand on one invented common platform, and the 50Hertz
  facade follows its official 13-storey high point instead of 16 generic rows.

- **Bridges now carry their real structural identities.** Loewenbruecke,
  Moltkebruecke,
  Kronprinzenbruecke, Sandkrugbruecke, Gustav-Heinemann-Bruecke,
  Hugo-Preuss-Bruecke, Weidendammer Bruecke, Golda-Meir-Steg and the Bundestag
  crossing each use a dedicated measured profile and recognisable construction
  language instead of sharing a generic deck.

- **Berlin Hauptbahnhof is recognisable from its architecture, not just its
  footprint.** The official 321 m rail roof and 46 m office bars now carry the
  paired raking crowns, dark external steel frame, complete glazed entrance
  gables, projecting canopies, station identity, rooftop articulation and the
  documented integrated photovoltaic field. Selecting it opens a useful
  Washingtonplatz facade view in every visual mode.

- **The complete bridge field is clearer at every scale.** Broad mapped road
  crossings separate carriageways, footways, joints and markings; named modern
  bridges gain bearings and coherent underside structure. Narrow rail and park
  crossings stay quiet, preserving performance and the bright architectural
  drawing style in Day, Night, Minecraft, Snowstorm and Schwellenraum.

- **Berlin's former Wall line is now legible where the official data places
  it.** The 1989 Vorderlandmauer WFS remains the plan anchor; its two rows of
  individually instanced dark granite setts now clear the drawn road and plaza
  plates instead of being buried below them. At Platz des 18. März this makes
  the documented semicircle immediately west of Brandenburger Tor visible,
  while one unlit, shadow-free draw call keeps the detail inexpensive and
  absolutely static.

- **The civic drawing is crisper without becoming harsh.** Slightly firmer
  warm-grey ink gives ivory silhouettes and facade grids more definition.
  Recessed water gains deterministic bowed engraving strokes rather than
  disconnected rectangles; every stroke stays inside its mapped water polygon
  and contains no animation phase. Controls add restrained tactile feedback,
  a clear keyboard focus ring and honest grab cursors without changing the 3D
  camera response.

- **Desktop navigation is continuous rather than stepwise.** Held arrows pan,
  WASD flies relative to the view heading, `Space` rises, `Shift` descends and
  `Alt`/`Option`+arrows orbit/tilt; the matching mouse buttons keep moving while
  held. A collision-free analogue orbit pad sits
  beside the desktop controls, while the existing compact touch controls stay
  unchanged on phones and tablets.

- **The underside now reveals Berlin's mapped passenger-rail structure as an
  architectural cutaway.** All 207 underground rail, S-Bahn and U-Bahn track
  parts, 40 platform shapes and 78 subway entrances retain their committed OSM
  plan geometry and source ids. U5 and the shared S1/S2/S25/S26 North-South
  corridor carry restrained route cues. Mapped platform rings now have crisp
  edge fascias and open sectional frames; entrance points become spatial shaft
  diagrams. Their thicknesses, heights and straight vertical connections are
  explicitly schematic, while the horizontal courses remain source geometry.
  No utility network, hidden passage or building service is invented. The
  dedicated underside control frames this network together with the
  Tiergartentunnel instead of forcing an extreme portal close-up.

- **Fresh browser sessions rotate their civic starting view.** Reichstag,
  Bundeskanzleramt, Hauptbahnhof and Siegessäule alternate without a large
  retained session object; Reset still returns to its deterministic Reichstag
  view and explicit shared links still win. Exterior Minecraft and snow haze
  is disabled below ground, and Minecraft's faded context shell stays quiet.

- **Transit and scale cues stay sparse and stable.** Tram contact wires follow
  all 49 mapped surface-tram parts while their height/mast rhythm is documented
  as approximate; lamp posts remain the official Berlin lighting extract.
  Eighteen static people, two yellow BVG buses, three cars, bikes, e-scooters
  and two strollers add scale without animation. Snowstorm gains one tiny ice
  fisher on a mapped Tiergarten pond alongside the existing snowploughs.

- **Kulturforum and Potsdamer Platz use stronger source-aligned recognition.**
  Gemäldegalerie, Kunstbibliothek/Kupferstichkabinett,
  Kunstgewerbemuseum/Piazzetta, Philharmonie, Kammermusiksaal and the
  Staatsbibliothek retain named LoD2 envelopes, receive source-described
  facade/roof cues and open with building-centred camera presets. The Mall
  passages now sit on the LoD2 south facade. At Potsdamer Platz, the two
  separate above-ground station halls follow their exact LoD2 footprints and
  heights with semi-open steel/glass grids, braces, stairs and escalators; the
  below-grade platforms and distribution passage remain explicitly schematic.

- **Charité Campus Mitte now carries its published renovated facade rhythm.**
  The exact 16-part Berlin LoD2 tower envelope remains the metric anchor; its
  21-storey, 82 m reading now distinguishes the dark four-storey aluminium
  base from the light upper facade and lays out the published 4.2 m / 3.3 m
  panel modules with more than 4,000 instanced panes. The existing LoD2
  steel-and-glass bridge remains source-aligned.

- **The Albrecht-von-Graefe monument is a dedicated OSM-positioned model.**
  Its three-axis sandstone screen, pedimented round-arch niche, documented
  1.66 m bronze figure, coloured majolica reliefs, two-line inscription,
  clipped hedge and curved iron enclosure replace the generic marker. Berlin
  Hauptbahnhof additionally has five ivory taxis and one clearly visible
  five-section yellow tram with doors, bogies and pantograph.

- **Walking and cycling detail now follows the complete bounded OSM network.**
  All 20,782 above-ground path line parts resolve through the same metric
  buffering and terrain sampling as the streets. Explicit OSM surfaces take
  precedence over context; 18,848 parts carry mapped surface evidence and
  2,574 carry an explicit `width` or `est_width`. The separate raised
  park-detail layer retains all 3,467 joined path ribbons and every vertex of
  the committed OSM source for close views. It distinguishes asphalt, regular
  paving, dressed setts/cobble, compacted aggregate, loose fine gravel, sand,
  open earth, timber and metal with small metre-scaled procedural grains and
  joints. Schema 7 retains centimetre widths (including values such as 3.75 m)
  instead of covering the network with a generic park colour.

- **Floraplatz, Hotel AMANO Grand Central and the former Moabit prison park
  gain source-bounded recognition detail.** Floraplatz now contains the eight
  documented life-size bronzes on granite plinths: paired deer, bison and elk,
  plus bear and bull, with one duplicate OSM bison suppressed only at its
  coincident plinth. AMANO keeps its OSM footprint and official 27.819 m LoD2
  height while adding the documented clinker, staggered-window, glazed-ground-
  floor and setback-storey reading. The prison park uses the exact 22-point OSM
  ring, four mapped wall ways / 19 segments and exact Panoptikum plan while
  retaining the existing Berlin LoD2 cell. Present-day wings, yards, hedges and
  information details are procedural recognition geometry; they add no second
  lawn or tree inventory and do not trace the protected landscape plan.

- **Central Berlin's civic and rail architecture has a finer recognition
  layer without moving its source geometry.** The Swiss Embassy now separates
  the historic palace from its modern extension and adds its rustication,
  entrance order, window rhythm and roof flag. Pariser Platz carries both
  formal gardens, flower borders, fountains, bollards and the U/S-Bahn
  entrance alongside restrained US and French embassy facades. Cube Berlin
  follows its LoD2/OSM envelope with a faceted glass skin; Hauptbahnhof gains
  concourse shopfronts, gallery balustrades, four cylindrical glass lift shafts
  and the rust-red steel supports on its eastern approach.

- **The eastern Spree crossings and Friedrichstraße read as distinct
  structures.** Kronprinzenbrücke uses its measured deck orientation with
  stepped road, cycle and pedestrian bands. Weidendammer Brücke has three iron
  arch openings, granite piers, exactly two forged central eagle reliefs, eight
  lamp standards, one neo-Baroque railing system and a bounded current love-lock
  field. Bahnhof
  Friedrichstraße uses two steel-and-glass train sheds above its brick base,
  while the separate Tränenpalast retains its exact low glass-pavilion outline;
  the Berliner Ensemble carries its circular red-and-white roof sign.

- **Futurium and the northern Spree crossings now use their metric source
  geometry.** Futurium follows Berlin LoD2 building `20g0005J` rather than a
  rotated box and adds its recessed foyer, fine cassette skin, 28 m panorama
  windows, bounded solar roof, Skywalk and source-positioned Drehmoment.
  Moltkebrücke follows its OSM diagonal and published 77.58 x 25.70 m envelope,
  with three finer sandstone arches, open balustrades, plinths and lamps.
  Detailed OSM path ribbons cover all bounded park polygons, including the
  Spreebogen approach to Gustav-Heinemann-Brücke, Futurium and Nordhafenpark;
  curves share joined vertices instead of breaking into rectangular strips.

- **Chrome gets the earliest browser-permitted music start.** Ambient audio
  and Dusk Republic request playback before the first painted frame and retry
  when a background-opened tab first becomes visible. Chrome still requires a
  real first click, tap, wheel or key gesture on fresh origins where audible
  autoplay is blocked; that gesture starts both enabled layers immediately.

- **The bright isometric pass now preserves real material identity.** Facade
  samples retain more of their source hue, mineral roofs stay light without
  turning neutral grey, and roads, lawns, paving and water use fresher but
  still flat drawn tones. The official Berlin tree catalogue now drives distinct
  oak, willow, pine/larch, fir/spruce, poplar, birch/robinia, lime/elm,
  maple/plane, beech/chestnut, orchard and shrub silhouettes, branching habits
  and bounded colour registers without moving a tree or sacrificing the
  instanced rendering budget. Exact OSM scrub and hedge outlines add varied
  clustered understorey without closing mapped paths. Hauptbahnhof keeps its measured 321 m curved
  glass envelope while a stronger pale-cyan skin and finer steel grid stop it
  reading as a wireframe at overview scale.

- **Music now starts reliably from an ordinary first interaction.** A pending
  `pointerdown`/`touchstart` audio request can be superseded by the completed
  click, touch or key gesture that the browser actually permits. A browser-
  suspended Web Audio context is resumed with a fresh scheduler instead of
  falsely reporting playback over silence. The persisted Ambient mute remains
  independent: it no longer suppresses `Dusk Republic`, which keeps its
  documented per-reload enabled intent and can still be turned off separately.

- `berlin modern` at the Kulturforum now uses the architects' published
  120 × 71 × 18 m planning envelope instead of a floating placeholder roof.
  The grounded mineral body, north entrance grid, east openings and dark
  photovoltaic gable roof are aligned to the OSM construction axis; Night has
  warm entrance glazing and Minecraft has a matching block-native model. Since
  completion is planned for 2030, this remains an explicitly labelled planning
  approximation rather than surveyed as-built geometry.

- **Curved roads now read as curves at close zoom.** A metric Hermite pass
  interpolates moderate OSM direction changes through every original mapped
  node, samples bends at no more than 2.5 m and keeps deliberate sharp corners
  hard. The drawn modes no longer expose the old 4 m asphalt cells or their
  square kerb ink beneath the continuous OSM road layer; Minecraft retains its
  intentionally block-native streets.

- Source-faithful facade refinement now draws the exact outer and courtyard
  wall topology from LoD2, adds the official ALKIS tent-roof form, and removes
  unsupported generic doors, roof boxes and skylights. Referenced civic models
  gain finer Reichstag dome/tower work, Kanzleramt hall structure,
  Hauptbahnhof end grids, Brandenburg Gate capitals and a corrected flat,
  balustraded Swiss Embassy roof.
- Generic LoD2 facades now combine solid bay axes with a 3.6 m dashed storey
  rhythm in every drawn mode. The dash is shader-driven from a compact `Uint16`
  distance attribute, so it clarifies window proportions without fabricated
  pane coordinates, extra head vertices or another draw call; the layer fades
  from 500 to 780 m to keep overview and mobile raster load quiet.
- The Soviet Memorial now faces its documented main entrance on Strasse des
  17. Juni. Its two T-34/76 tanks stand left and right on the road side,
  parallel to the street, with the two ML-20 guns diagonally behind them; the
  saved sight view approaches from that same public front.
- A hard still-frame contract prevents elapsed time from redrawing an unchanged
  scene. Transparent ink has a deterministic camera-independent order, while
  distance fades preserve their authored Day/Night opacity. Browser checks
  produced byte-identical settled frames in Day, Night and Minecraft.
- Procedural audio now supersedes a browser-blocked load attempt from the real
  click, and stale completions cannot stop a newer audible start. Hidden,
  frozen and back-forward-cache pages pause and resume cleanly, while real
  navigation still closes every scheduled voice. The connected
  Tiergartentunnel portals and directional bores remain available for direct,
  user-controlled travel without an automatic camera sequence.

- A cold start keeps the requested procedural world behind a fully opaque,
  mode-coloured loading curtain. Day, Night, Minecraft, Snowstorm and
  Schwellenraum reveal their first city frame only when that world is ready.
  Every device uses the authored tunnel/network geometry as its underground
  cutaway, and a failed world is cleanly remounted once without constructing a
  second hidden scene.

- The compact Sights rail now presents the five primary orientation points:
  Hauptbahnhof, Bundeskanzleramt, Reichstag, Brandenburg Gate and Siegessäule.
  All 93 catalogued sights remain available to tours, previous/next
  navigation and stable `#landmark=` links; the smaller rail is a usability
  choice, not a data deletion.
- Water bodies retain their mapped plan geometry and now read as recessed
  volumes with deterministic close-range ripples. Three tiny beavers are
  deliberately hidden as clearly labelled park Easter eggs. Boat wakes,
  bridge finishes and the Bundestag Kita recognition layer add visual context
  without claiming that unsurveyed staffage or pond bathymetry is official.

- Camera movement uses every available display frame on touch and desktop.
  Keyboard flight now reaches its distance-scaled speed on the first frame and
  stops on release without an acceleration tail. Mouse orbit, wheel/pinch zoom,
  two-finger pan and the 2D fallback use faster direct response curves without
  changing the scene's settled pixels.
  Day, Night, Minecraft, Snowstorm and Schwellenraum keep their contours in
  stable world-space geometry;
  no screen-space sharpen or edge detector changes line brightness while the
  view moves. Transparent ink cannot overwrite other ink in the depth buffer,
  and all civic, cultural, park, monument and tunnel detail roots share the
  same compact `UnsignedByte` render target plus final SMAA antialiasing policy
  in motion and at rest.

- Beside the Marie-Elisabeth-Lüders-Haus, four landward canopy supports replace
  the former invented line of pillars through the Spree. A geometry test now
  keeps every support outside the precise OSM water polygons while preserving
  the real two-level parliamentary bridge.

- Hamburger Bahnhof now follows the 30-degree entrance line fixed by its two
  official LoD2 tower parts instead of the hall's approximate sight point. Its
  flat late-Neoclassical front has two measured-height towers, six upper
  arcades, two lower hall arches, cornices, doors, steps and the axial Ehrenhof
  path with rondel. Minecraft receives a separate stepped voxel interpretation
  of the same hierarchy rather than generic office windows.

- The adjoining Rieckhallen now follow their single official 281.279 x 16.244
  m LoD2 envelope and 9.364 m measured height. Five false generic gables are
  gone; the long low hall instead carries three quiet longitudinal roof bands
  and its dark ribbed goods-shed elevations. Minecraft uses the same flat
  roof-top contract without losing its deliberately stepped 4 m footprint.

- The recognisable buildings and monuments carry their **documented**
  architectural apparatus as drawn flat elements with ink lines: the Reichstag
  portico order, tympanum relief field, rusticated base and corner-tower
  attics; the Kanzleramt's semicircular window tracery, winter-garden reveals
  and Ehrenhof colonnade; the eight Paul-Löbe committee rotundas; roof-light
  grids on the Lüders and Kaiser blocks; the Swiss Embassy's rustication,
  cornice profiles, attica and portico pediment; Siegessäule flutings with the
  Säulenhalle ring, the Bismarck-Nationaldenkmal, and the Kanzlergarten
  "Non-Violence" sculpture. Ordinary LoD2 blocks receive no invented window
  positions. Named recognition models may carry a source-informed bay rhythm;
  those thin presentation details are explicitly not claimed as a facade survey.
- The Siegessäule's 8.32 m Goldelse now preserves the bright leaf-gold reading
  and the photographed silhouette at close range: separate primary, secondary
  and covert feathers; visible face, hair and eagle helmet; a leafed raised
  laurel wreath; the ring-framed Iron Cross, pointed field-standard finial and
  three ribbons; 0.92 m shoes; and the asymmetrically wind-filled folded robe.
  The 45 authored parts and 7,758 vertices merge into one dedicated material
  draw, so the added detail does not add one draw call per feather or leaf and
  can retain warm leaf gold at night.
- The Reichstag carries the documented 16 m `DEM DEUTSCHEN VOLKE` inscription
  field, three German flags and one European flag at the Bundestag's published
  5 x 7 m size. The Swiss flag stands on the Embassy roof. At Charite, the
  official LoD2 tower parts keep their surveyed placement and receive a
  source-informed renovated facade rhythm, while the mapped campus bridge is
  visibly glazed. Robert-Koch-Platz carries a close-scale interpretation of
  Louis Tuaillon's seated marble monument at its official Berlin anchor.
- The corrected central crossings now keep distinct surveyed dimensions and
  construction character: the 4 m-wide yellow Golda-Meir-Steg; the 87.76 x
  4.00 m pale sage-green, timber-decked Vierendeel Gustav-Heinemann footbridge;
  the curved, single-span 88.41 x 23.56 m steel-box Hugo-Preuss road bridge;
  the broad Sandkrug road bridge; and the 25.7 m-wide red-sandstone
  Moltkebruecke; and the 17.3 x 2.0 m timber suspension Loewenbruecke with its
  four bronzed lions. The interim Bundespräsidialamt uses
  its current OSM bent-bar footprint instead of the former capsule/rectangle
  approximation. Topography of Terror carries a 200 m damaged Wall-fragment
  treatment aligned to the mapped trace, and Otto-Weidt-Platz keeps its actual
  fountain outline with a darker basin. These recognition details remain
  visible and co-located in Day, Night, Minecraft, Snowstorm and
  Schwellenraum.
- The versioned visible presentation radius is **6,450 m**. Task-13 adds a
  second exact 500 m EPSG:25833 buffer, this time around every task-12 edge,
  without moving existing metric geometry. The source hull reaches world
  x −3900…2420 and z −3620…2920. Its restrained 790 m paper margin yields
  envelope x −4690…3210 and z −4410…3710. Paper-only context is flat
  cartographic presentation and is never described as surveyed geometry. Day,
  Night, Minecraft, Snowstorm and Schwellenraum use the same envelope.
- **The OSM layer covers the complete task-13 source hull.** The current
  Geofabrik Berlin extract is clipped to `bounds.geojson`
  (E385602.60…391910.58 / N5817089.12…5823617.37), so the expanded extent
  carries bounded OSM streets,
  water, park polygons, paths and POIs. The resulting road,
  water and park surfaces are regenerated from the same bounded source;
  no replacement street or river geometry is invented.
- **The 2D overview and 3D scene share the same task-13 bounds.** The DZI,
  reference image and bundled landmark projection were regenerated together;
  all 93 checked sights use the same coordinate frame in both viewers. The
  embedded and public landmark payloads are byte-identical and enforced by
  release tests. The hosted viewer keeps the full 16384×11616 DZI pyramid; the
  compact overview fallback is capped at 4800 px, while the downloadable
  archive reuses its 8192×5808 lower levels to stay below the
  offline size ceiling. The retired GLB family is absent from both forms.
- Day and Night render with **no tone mapping at exposure 1**, so an authored
  paint tone reaches the screen bit-exact. The drawn city is a flat unlit
  drawing: plasticity comes from one constant brightness per face direction
  (`isoFaceShade`), never from a luminance curve. The previous filmic curve
  measurably rewrote the palette — ivory `#f8f3e6` arrived as a neutral grey
  `#e9e7e4`, a sage lawn `#a9c592` as a fluorescent `#d0fea1` — and no amount
  of repainting could compensate for it. Minecraft keeps ACES because it is a
  genuinely lit world of cubes, at a calibrated exposure that leaves pale
  facades pale.
- Streets, footways, cycleways, steps, tracks and desire paths are drawn as
  real surfaces buffered from OSM centrelines. Path material follows an
  explicit OSM `surface` first (asphalt, paving, setts/cobble, compacted
  aggregate, fine gravel, sand, earth, timber or metal), then a documented
  class/park fallback. Explicit OSM
  `width` and `est_width` values win; class widths remain presentation
  cross-sections where no measurement is mapped and are not claimed as
  surveyed kerb lines. The close-view ribbons retain every vertex of the
  committed 0.35 m source and encode resolved widths to the centimetre;
  natural bends are interpolated through those vertices without moving them,
  while engineered 90° corners remain sharp. The
  canonical source keeps topology-preserving geometry at 0.35 m, road curves at
  1.5 m and round joins at 16 segments per quadrant. Ground-bound surfaces
  follow a bilinear reading of the committed 16 m IDW terrain support, with
  bounded interior tessellation so rises do not flatten across long triangles.
  River coping follows the local landward grade. These heights remain an
  interpolation of the documented point support, not a new elevation survey.
- The refreshed OSM extract spans the full task-13 data hull. Großer Stern,
  Straße des 17. Juni, the Tiergarten paths, Spree and Landwehrkanal surfaces,
  Europacity and the southern extension are derived from that bounded source
  rather than presentation substitutes.
- A separate current OSM building sidecar supplies 12,856 non-overlapping
  context footprints where the committed official LoD2 package has no body.
  LoD2 remains authoritative wherever it exists; explicit OSM height wins,
  then mapped storeys, while 3,509 remaining display heights are clearly
  marked fallbacks. The same loader feeds overview, prisms and Minecraft.
- The metric building base comes from the committed Berlin LoD2 and bounded
  OSM sources in EPSG:25833 without changing horizontal or vertical scale.
  ALKIS, terrain and official point layers add documented context; explicitly
  labelled recognition geometry supplies only features absent from those
  sources.
- The production viewer carries no photo mesh, material crop or hidden
  interaction shell. LoD2 footprints, roof heights and source colours feed a
  bounded exact near field, while one oriented instance shell preserves every
  remaining source building at distance. The lighter ownership model retains
  hard facade and roof folds with 187 steady draw calls and 133.8 MiB of
  geometry in the production benchmark. Metric recognition models sharpen the
  principal silhouettes: the
  Reichstag has its 138 x 100 m body, west portico, four towers and 40 x 23.5 m
  24-sector dome at the official 24 m roof-terrace datum; its historic facade
  now separates tall arched bays, three-bay tower windows, upper windows and
  west-entrance glass instead of repeating one generic grid. The Chancellery separates its
  36 m cube and three LoD2-aligned 18 m
  office bands; Hauptbahnhof exposes its 321 m glass roof, 180 x 42 m hall and
  46 m frames; the 62.5 x 11 x 26 m Brandenburg Gate has all twelve columns and
  a bronze-green Quadriga. These code-native details remain bounded by their
  documented dimensions and do not restore the removed raster assets.
- Selecting one of the four hero buildings opens a building-specific,
  presentation-quality camera angle and distance before normal free orbiting.
  The Brandenburg Gate is no longer shown as a tiny object in a 250 m view.
- Recognition geometry now follows each building's measured LoD2 local axis,
  not the map's screen axes. This fixes the Hauptbahnhof overlay's former
  21.82° orientation error and moves its anchor from the OSM label point to the
  official hall centre. Camera targets use the model anchors; the Chancellery
  still centres its characteristic 36 m leadership cube rather than the full
  343 m ensemble.
- Model-railway detail is visible at normal viewing distances: Hauptbahnhof has
  four upper tracks, platforms, a stationary ICE and Berlin S-Bahn. Its 541 m
  approach deck now carries ballast, sleepers and viaduct piers beyond the
  321 m glass roof instead of leaving either train on visually floating track;
  the Gate
  has stepped side pavilions, five shaded passages and a more articulated
  Quadriga; the Chancellery has floor plates, facade mullions and its arched
  leadership-window grid; the Reichstag adds roof cornices, portico bases and
  capitals, entrances, three German flags and one EU flag around the official
  dome. Their thin cloth layers share the same low-amplitude, cadence-bounded
  wind field as the other official civic flags.
- The civic layer adds the LoD2-aligned Swiss Embassy with its historic palace,
  modern extension and Swiss flag, plus the Bundestag's official 28.5 m Unity
  Flag pole and 60 m² German flag. The TIPI uses its published 32 x 26 m
  ellipse and receives structural ribs, golden `PIGOR & EICHHORN` / `NUR HEUTE
  ABEND` bulb lines, 220 rib lights and night-only concert colour. The 42 m
  Carillon exposes all 68 bells below its shallow roof; two small security
  figures mark the Chancellery entrance. Two static passenger vessels use the
  [published](https://reederei-riedel.de/flotte?lang=en) 43.10 x 7.00 x 1.29 m
  and 29.55 x 6.98 x 1.20 m fleet envelopes,
  restrained type-level superstructures and committed OSM waterway axes. Their
  placements are display compositions rather than live vessel observations;
  wakes remain static in the normal drawn modes and disappear in Schwellenraum.
- Humboldthafen now separates its source-backed northern sloped bank and DGM
  crest from the remaining vertical quay walls. Hugo-Preuß-Brücke follows OSM
  way `26109166`; both independently mapped Sandkrugbrücke carriageways follow
  ways `36260393` and `248010193` instead of the former nearly transverse axis.
  The same harbour, vessel and railing identities have compact block-native
  recognition geometry in Minecraft without adding another data download.
- Close-up detail now stays sharp without multiplying draw calls: instanced
  roof ribs, sleepers, facade panes, train fittings and balustrade posts are
  combined with batched glass seams, masonry courses, column fluting and
  entablature profiles. All additions remain inside the published metric
  envelopes of the four hero landmarks.
- Day, Night, Minecraft, Snowstorm and Schwellenraum have separate direct
  controls. The true 3D scene
  changes sky, fog, directional light and exposure; only the Reichstag's tall
  arched occupied bays emit light at night, while its small upper and tower
  windows remain dark. A restrained cool light floor keeps official drawn
  facades legible without affecting terrain, vegetation or water, while the
  Brandenburg Gate receives warm floodlighting. The 2D fallback receives a
  restrained night treatment.
- Snowstorm adds a shared white ground mantle, 2,400 bounded desktop flakes
  (1,100 on touch devices), 168 wind-shaped drifts and three snowploughs while
  preserving the same buildings and metric anchors. The nine official civic
  flags receive reversible frost and 27 instanced icicles while their cloth
  continues its restrained motion. One contextual weather
  control toggles moderate rain in Day, Night and Minecraft, and toggles the
  falling flakes in Snowstorm without removing its settled snow.
  Schwellenraum keeps the stored rain preference but disables precipitation so
  its street, water geometry, vegetation and sparse-prop tableau stay still;
  only the bounded water-light veil and allowlisted civic flags may change.
- The `Minecraft` visual mode, also available with `M`,
  applies an original fixed 32-colour premium voxel palette,
  toon materials and restrained animated water/glass highlights without moving a
  single LoD2 anchor or changing camera framing. Deterministic villages,
  market tents, fields, tiny people, animals and boats appear progressively
  only after 20–75 seconds of uninterrupted dwell time and remain under a
  strict mobile density budget. Its distant haze now scales with the versioned
  visible radius, keeping the complete expanded model readable at overview
  distance instead of fading the outer ring. Its official metric voxel payload
  grows with the expanded bounds; the matching 6,450 m block surround is
  explicitly tagged as extrapolated presentation geometry.
- Four Creepers, six Zombies and three bow-carrying Skeletons walk on desktop;
  mobile uses three, five and two. Each profile shares one instanced rendering
  batch and disappears completely in Day, Night, Snowstorm, Schwellenraum,
  underwater and underside views.
- Eligible Minecraft trees are retained deterministically at two thirds on
  desktop and one third on mobile. Four desktop or two mobile loot boxes open
  once on pedestrian contact with a bounded instanced firework; trees, hostile
  mobs and loot remain excluded from the complete Holocaust Memorial field.
- Phones, tablets and compact laptop viewports up to 1024 px use a compact
  40 px sight status bar, a 56 px bottom action bar,
  a compass sheet and a separate action sheet. The chrome can be hidden with
  its chevron or a three-finger downward swipe; iPhone safe areas, landscape,
  44 px touch targets, reduced motion and momentum-rich pinch/pan/rotate are
  handled explicitly. Rotation, browser zoom and iPad Split View now update the
  compact React state live as well as the CSS, so desktop rails cannot remain
  stranded over a newly compact canvas.
- The old always-visible coloured landmark dots are gone. Selecting a landmark
  briefly shows a small ring, which fades after 2.4 seconds so roofs and
  facades remain unobstructed.
- Left mouse drag pans directly, the mouse wheel zooms at the pointer, right
  mouse drag orbits, and one finger orbits on touch. On a trackpad, two-finger
  scroll pans while pinch zooms at its midpoint. On touchscreens, a two-finger
  centre swipe pans with momentum while pinch zooms around the finger midpoint;
  three fingers carry the camera continuously through a genuine underside view.
  Orbit, direct touch and trackpad gestures keep one backing-store resolution
  and one device/mode surface tier throughout the complete gesture and momentum
  glide, so releasing an input cannot trigger a whole-frame resample or geometry
  replacement.
  Plain arrows translate in the visible screen plane. WASD flies
  forward/backward or strafes relative to the view heading, `Space` rises,
  `Shift` descends, and `Alt`/`Option` + arrows orbit and tilt. Every channel is
  continuous while held; the desktop
  arrow buttons behave the same way, and a separate mouse orbit pad provides
  analogue rotation and tilt. Camera and target move together, so flight never
  changes the orbit distance accidentally.
- Fullscreen works through the native browser API on desktop and a safe-area-
  aware pseudo-fullscreen fallback on iOS. Both connected Tiergartentunnel
  portals can be entered manually; the approximate traffic tubes expose road
  markings, ceiling lights and paired ventilation fans without taking camera
  control away from the visitor.
- A persistent DE/EN switch translates the application chrome and correctly
  calls the German list `Sehenswürdigkeiten`. Optional music (`B`) synthesizes
  seven original slow 8-bit ambient variations locally with Web Audio; no
  recording, stream or external asset is loaded. `Dusk Republic` (`T`) is a
  second procedural Web Audio layer with slow and motorik movements on one
  88 BPM grid. Browser autoplay policy is respected: its suspended graphs and
  procedural buffers are prepared at load, but audible playback begins only on
  the first allowed click, pointer movement, touch, wheel or key gesture (or a
  later focus/visibility retry). Both layers can be switched off for the
  current session and may run together within a fixed low-volume headroom
  budget. Schwellenraum replaces them with its own lower-ceiling procedural
  layer: the existing `B` and `T` controls independently fade the room-rustle
  and sparse-score buses, while mode changes crossfade without resetting the
  stored choices. Sight changes remain visually quiet and show no unsolicited
  slogans.
- A bounded sharpen/saturation pass runs only after camera motion stops, while
  movement keeps the cheaper direct pipeline. The Chancellery cloud is removed,
  and the Carillon's dedicated source-bounded layer carries one set of granite
  pylons instead of drawing a second tower over them.
- A settled Day, Night, Minecraft or Schwellenraum scene holds its framebuffer
  between genuine visual mutations rather than repainting at full rate.
  v0.66.1 also removes input-dependent DPR
  and surface-detail hysteresis: a viewport keeps one stable sampling grid and
  surface tier while moving and after release. Six-frame browser sequences in
  Day and Night record 0 changed pixels across every adjacent still-frame
  comparison before the bounded official-flag animation was introduced. The
  selected-sight marker is static rather than pulsing. In
  Minecraft, only the deliberately walking figures change pixels. In
  every above-ground mode the nine official flags request at most 12 Hz redraws
  on non-touch devices or 8 Hz in the mobile-like touch profile; Schwellenraum's
  light-only water veil separately requests at most 3.75 Hz. Reduced-motion,
  distant, underside and hidden-page views freeze the cloth, and the rest of
  the world remains bit-still. The committed measurement tool
  independently enforces a bounded perceptual-delta threshold for the rest of
  the frame.
- The two-tube Tiergartentunnel cutaway has lit fixtures and safety strips,
  road decks and lane marks, ventilation shafts and four-blade fan cues. It is
  hidden in ordinary exterior views and appears automatically only when an
  orbit crosses below ground; the underside control now frames the mapped
  passenger-rail network and Tiergartentunnel together. Visitors can instead
  enter either connected road portal under their own control. The underside no
  longer activates underwater fog, and its lamps,
  markings and ventilation cues preserve their drawing order instead of
  disappearing behind the road deck. Only the two open portal troughs are
  exterior geometry: the buried middle route and obsolete duplicate portal
  builder are absent from the isometric surface. Its route is explicitly
  labelled as an OSM-derived engineering approximation, not surveyed tunnel
  geometry. No route-spanning cover mesh is painted over the city: the short
  forced-depth bore interiors are hidden in every ordinary exterior view,
  revealed only by selecting a tunnel-mouth sight, and hidden again by the
  first free camera movement. Both canonical portal ramps remain visible.
- Source-bound memorials have close-range recognition geometry. The Holocaust
  field draws all 2,711 officially documented stelae in one instanced call with
  the published 0.95 x 2.38 m cross-section and height bands; the Soviet,
  Sinti/Roma, homosexual-victims, Goethe, Lessing, composer and 2026 Jehovah's
  Witnesses memorials, the Polish memorial, Georg Elser's steel profile and the
  owner-supplied Queer Rainbow Memorial preserve their defining
  source-documented or explicitly field-view-bounded forms while the metric
  LoD2/OSM city remains visible underneath. The Soviet memorial's two
  Berlin.de-identified T-34/76 vehicles now use longitudinal hulls, sloped
  glacis plates, ten road wheels each, turrets, hatches and 76 mm barrels rather
  than transverse generic boxes; their local spacing remains an approximation.
- Tiergarten detail is no longer only a coarse generic canopy. The
  expanded additive layer combines the official catalogues with unmatched OSM
  evidence into 45,540 individual trees across the task-13 envelope. The
  Großer Tiergarten contributes all 13,156 official tree points, including
  measured height, crown and trunk dimensions where published. Species evidence changes only the drawn
  silhouette: spreading oak lobes, drooping willow crowns, high pine canopies,
  tiered firs, columnar poplars, airy birches and denser beech groups retain
  their official point, height, crown and trunk measurements. The official
  `tree-21650` Trauben-Eiche near Carillon is the dedicated Lenné-Eiche model:
  its 23 m height, 9.5 m crown radius and 0.5 m trunk radius stay source-bound,
  while supplied photographs inform only its fissured root-flared trunk, high
  twin leaders, long horizontal limb, airy crown, exposed dead tips, lobed
  olive foliage and small green-rimmed tree plaque. No supplied photograph is
  bundled or loaded. Minecraft suppresses only the matching generic voxel tree
  and substitutes an opaque one-draw block model: 138 blocks in the full
  profile and 85 on mobile retain the same 23 m height, broad reach, twin
  leaders and open veteran crown. The nearby former Krolloper grounds now hold
  the complete 20-work **Skulpturen gegen Krieg und Gewalt** ensemble at its
  current individual OSM node anchors. Each work has a distinct code-native
  silhouette; Contact, Himmelsschlüssel, Große Knospe III/63 and Todes Mauer
  Bruch additionally preserve the photographed through-openings, cuts,
  proportions, paired steel walls and inscribed ground plates. Generic OSM
  monument placeholders are suppressed for the same source nodes, so no work
  is duplicated. Full and mobile rendering both keep all 20 works, while the
  mobile profile trims only bounded edge, groove and inscription detail. The
  supplied photographs are reference-only and are neither bundled nor loaded
  at runtime. Eighty-three
  exact OSM scrub polygons now carry 3,535 deterministic varied bush clusters;
  21 mapped hedge lines total 1,099.2 m and two mapped hedge areas total
  526.8 m². Their source courses remain exact, while unmapped plant placement
  and hedge height are explicitly display approximations. The layer also adds
  5,829 public-light positions
  with night cones, 12 mapped wall traces as granular dark red-brown setts,
  3,467 OSM park-path sections and 360 playground footprints. The complete
  bounded smooth-surface pass additionally records 20,782 walking/cycling path
  line parts and their source-resolved materials. The selectable
  Luiseninsel playground opposite the
  Philharmonie includes its mapped climbing frames, slide, swings, sandpit,
  water-play point and excavator. Its oblique focus view keeps those small
  devices readable above the surrounding tree canopy and restores the normal
  tree presentation as soon as another landmark is selected. Exactly three
  tiny coloured Easter eggs are deterministically hidden beside mapped trees.
- The southern edge now includes a small brick-built LEGO giraffe recognition
  model at the OSM LEGOLAND Discovery Centre point. Its position source and
  Commons visual reference are recorded; its footprint and dimensions are
  explicitly labelled as a display approximation, not a survey.
- The Spree carries a narrow translucent 3D wave surface aligned to the
  committed OSM centreline. Its 0.32 m relief and crest highlights are a
  procedural display treatment, not surveyed hydrodynamic data.
- The complete offline archive carries eight compact, source-derived world
  JSON files (26.34 MB decimal) and no GLB, source photograph, hero crop or
  pretriangulated road plate. Core data loads with bounded retries and a
  45-second ceiling; optional park detail waits until the first usable drawn
  city frame. A failed world gets exactly one clean procedural remount and
  never allocates a hidden photographic fallback.
- Every profile shows all 29,818 source buildings through one permanent distant
  instanced shell. Desktop upgrades the nearest 12,000 and mobile the nearest
  5,000 to exact LoD2 prisms. Evicted geometry and materials are explicitly
  released from GPU memory, and every device releases inactive 3D when
  switching to the 2D map. Touch devices cap environmental updates at 20 Hz;
  desktop retains warm visual-mode switches and 30 Hz environment updates
  inside display-rate camera interaction.
- Disposing the viewer cancels the remaining three-batch worker queue before
  another world batch can attach. Pointer capture loss and window blur also
  reset three-finger state; global pointer release, hidden-tab recovery and a
  ten-second watchdog prevent a permanently disabled orbit control. Invalid or
  out-of-bounds camera poses recover to the last finite, bounded view.
- 3D uses one ratio per viewport: up to 1.75x desktop device pixels under a
  fixed 8.5-megapixel budget, or 1.35x touch device pixels under 3.2
  megapixels. It
  never changes that ratio because a gesture starts or ends. Damping remains at
  the active frame rate until it has actually stopped; a static scene then
  holds its final framebuffer until a real mutation invalidates it.
- Repeated tunnel lamps, lane marks, ventilation shafts, fan rings and blades
  are instanced into five draw calls; each fan now has four distinct blades
  instead of two duplicated pairs.
- The local package server uses HTTP/1.1, correct JSON/DZI media types and
  immutable caching for hashed static assets. Reopening 3D reuses the compact
  local world payloads instead of decoding a separate photographic scene.
- Release QA verifies the exact inventory, byte length and SHA-256 of all eight
  scene JSON files in the source tree, extracted package, ZIP and static
  tarball, and rejects any retired GLB or `.plate.gz` file. Both archives also
  reject duplicate, linked, encrypted, hidden and oversized content. The local
  server repeats the same world-data verification before opening the browser.
- The 16384×11616, 15-level OpenSeadragon map remains available as a fast
  high-resolution fallback. Its marker layer also shows only the selection.
- The responsive controls were verified at 1280×720 and 390×844: no horizontal
  overflow, full-viewport canvas, 44 px touch targets and visible mobile
  orientation controls.
- LoD2, OSM, ALKIS/DOP/DGM inventories, 93 landmarks, 41 relative-placement
  checks, three established manual-review anchors and 112 accepted Wikimedia
  references remain part of the additive evidence pipeline and attribution
  chain.
- No Google, Apple, Bing, Amap, social-media or restricted-photo content is
  bundled. Those services may be inspected for QA, but are not copied.

## Inhalt & Links

| Area | What to open |
|---|---|
| Data policy and source ranking | [docs/data.md](docs/data.md) |
| External map / official-site QA notes | [docs/external-geolocation-qa.md](docs/external-geolocation-qa.md) |
| Landmark alignment report | [docs/landmark-alignment.md](docs/landmark-alignment.md) |
| Metric precision notes | [docs/metric-precision.md](docs/metric-precision.md) |
| Monument detail status and sources | [docs/monument-detail.md](docs/monument-detail.md) |
| Tiergartentunnel geometry notes | [docs/tiergartentunnel-geometry.md](docs/tiergartentunnel-geometry.md) |
| Viewer and app notes | [docs/app.md](docs/app.md) |
| Deployment and local package notes | [docs/deployment.md](docs/deployment.md) |
| Local package smoke test | [scripts/smoke_local_package.py](scripts/smoke_local_package.py) |
| Documentation index | [docs/README.md](docs/README.md) |
| Regierungsviertel data folder | [geo_data/regierungsviertel/README.md](geo_data/regierungsviertel/README.md) |
| Wikimedia attribution | [references/wikimedia/README.md](references/wikimedia/README.md) |
| Release history | [CHANGELOG.md](CHANGELOG.md) |

## Sehenswürdigkeiten im Paket

The machine-readable source list is
[`geo_data/regierungsviertel/landmarks.geojson`](geo_data/regierungsviertel/landmarks.geojson);
the packaged viewer projection is
[`src/app/public/dzi/regierungsviertel/landmarks.json`](src/app/public/dzi/regierungsviertel/landmarks.json).

| Group | Included landmarks |
|---|---|
| Federal government core | Reichstagsgebäude, Bundeskanzleramt, Paul-Löbe-Haus, Marie-Elisabeth-Lüders-Haus, Reichstagsvorfeld / Berlin-Pavillon, Platz der Republik Heckenbosquets, Kanzlergarten / Non-Violence-Skulptur |
| Hauptbahnhof / Spree / bridges | Berlin Hauptbahnhof, Humboldthafen, Hugo-Preuß-Brücke, Rahel-Hirsch-Straße, Moltkebrücke, Gustav-Heinemann-Brücke, Spreebogen, Zollpackhof |
| Pariser Platz and diplomatic edge | Brandenburger Tor, Quadriga mit Victoria, Pariser Platz, Starbucks Pariser Platz, Max-Liebermann-Haus, Botschaft der Vereinigten Staaten von Amerika |
| Spreebogen diplomacy / civic symbols | Schweizerische Botschaft, Fahne der Einheit |
| Memorials | Denkmal für die ermordeten Juden Europas, Denkmal für die im Nationalsozialismus verfolgten Homosexuellen, Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas, Sowjetisches Ehrenmal Tiergarten, Mahnmal für verfolgte Zeugen Jehovas, Gedenkort für Polen 1939-1945, Denkzeichen Georg Elser, Queer Rainbow Memorial Berlin am Ahornsteig |
| Tiergarten / culture / park details | Haus der Kulturen der Welt, Großer Tiergarten, Beethoven-Haydn-Mozart-Denkmal, Venusbassin / Goldfischteich, Goethe-Denkmal, Lessing-Denkmal, Richard-Wagner-Denkmal, TIPI am Kanzleramt, Eduardo-Chillida-Skulptur Berlin, Carillon im Tiergarten, 20 Skulpturen gegen Krieg und Gewalt am ehemaligen Krolloperplatz |
| Tunnel context | Kemperplatz / Tiergartentunnel, Tiergartentunnel Südeingang, approximate Tiergartentunnel underground reference route |
| Northern extension | Hamburger Bahnhof, Geschichtspark Ehemaliges Zellengefängnis Moabit, Rieckhallen, Sozialgericht Berlin, KPMG, DKB, Europacity |
| Kulturforum / Potsdamer Platz | Philharmonie, Kammermusiksaal, Staatsbibliothek, Neue Nationalgalerie, berlin modern, Henry-Moore-Plastik, Tilla-Durieux-Park, Kollhoff-Tower |
| Western and southern extension | Siegessäule, Luiseninsel, Rosengarten, Café am Neuen See, Spanische Botschaft, Charlottenburger Tor, Anhalter Bahnhof, WELT Balloon, Kochstraße |

---

## Credit / Dank

<table>
<tr>
<th width="50%">🇬🇧 English</th>
<th width="50%">🇩🇪 Deutsch</th>
</tr>
<tr>
<td valign="top">

Full credit to **[Andy Coenen](https://cannoneyed.com)**, who invented
this entire idea and executed it for New York City as
**[isometric.nyc](https://isometric.nyc)**.

His open-source codebase
([cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc),
MIT, © 2025 Andy Coenen) and his
[write-up](https://cannoneyed.com/projects/isometric-nyc)
are the basis on which this Berlin project is built. The directory
layout, agent guidance, docs structure, generation DB schema, and
isometric quadrant model are all directly inspired by his work.

This project would not exist without him.

</td>
<td valign="top">

Voller Dank an **[Andy Coenen](https://cannoneyed.com)**, der diese
gesamte Idee erfunden und für New York City als
**[isometric.nyc](https://isometric.nyc)** umgesetzt hat.

Sein Open-Source-Code
([cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc),
MIT, © 2025 Andy Coenen) und sein
[Werkstattbericht](https://cannoneyed.com/projects/isometric-nyc)
sind die Grundlage, auf der dieses Berliner Projekt aufbaut. Die
Verzeichnisstruktur, die Agenten-Anweisungen, die Dokumentation, das
Datenbankschema und das isometrische Quadrantenmodell sind allesamt
direkt von seiner Arbeit inspiriert.

Dieses Projekt würde ohne ihn nicht existieren.

</td>
</tr>
</table>

---

<table>
<tr>
<th width="50%">🇬🇧 English</th>
<th width="50%">🇩🇪 Deutsch</th>
</tr>

<tr>
<td valign="top">

## The Idea

The end goal is a giant, zoomable, SimCity-style isometric map
of Berlin. The current viewer runs from generated open-data map tiles,
Berlin LoD2 and bounded OSM geometry; the AI style pass is a later pipeline
step, not a runtime requirement.

This repository is an independent, derivative project inspired by
Andy Coenen's [isometric.nyc](https://isometric.nyc). The approach,
pipeline structure, and several scaffolding files follow Coenen's
[open-source NYC codebase](https://github.com/cannoneyed/isometric-nyc)
(MIT-licensed). All city data, model fine-tunes, and rendered tiles
for Berlin are produced from scratch.

</td>
<td valign="top">

## Die Idee

Das Ziel ist eine riesige, zoombare, isometrische Karte von
Berlin im Stil von SimCity. Der aktuelle Viewer läuft mit erzeugten
Open-Data-Kacheln, Berliner LoD2- und begrenzter OSM-Geometrie; der
KI-Stilschritt ist ein späterer Pipeline-Schritt und keine
Laufzeitvoraussetzung.

Dieses Repository ist ein eigenständiges, abgeleitetes Projekt, inspiriert
von Andy Coenens [isometric.nyc](https://isometric.nyc). Der Ansatz, die
Pipeline-Struktur und einige Gerüstdateien orientieren sich an Coenens
[Open-Source-NYC-Codebase](https://github.com/cannoneyed/isometric-nyc)
(MIT-lizenziert). Alle Stadtdaten, Modell-Finetunes und gerenderten
Kacheln für Berlin werden neu erzeugt.

</td>
</tr>

<tr>
<td valign="top">

## Current scope: central Berlin around the Regierungsviertel

The bounded release centres on the **Government Quarter of Berlin** and follows
a lobed central-Berlin polygon. The source polygon remains the hard spatial
limit so releases stay reproducible and locally downloadable.

**Bounding area (approximate):**

- **Brandenburger Tor** (south-east corner, Pariser Platz)
- **Reichstag** building
- **Bundeskanzleramt** (Federal Chancellery)
- **Paul-Löbe-Haus** and **Marie-Elisabeth-Lüders-Haus**
  (the "Band des Bundes" along the Spree)
- **Berlin Hauptbahnhof**, Hamburger Bahnhof and Europacity in the north
- **Kongresshalle / Haus der Kulturen der Welt** ("Schwangere Auster")
- The complete **Tiergarten** to Charlottenburger Tor in the west
- Kulturforum, Potsdamer/Leipziger Platz, Anhalter Bahnhof and Kochstraße
- Both **Tiergartentunnel** portals and the approximate underground route

The bounding box is roughly 4.3 × 4.5 km, while the lobed polygon excludes
unrequested surroundings. It remains far smaller than a whole-city build.

</td>
<td valign="top">

## Aktueller Umfang: Berliner Zentrum rund um das Regierungsviertel

Der begrenzte Release hat das **Regierungsviertel Berlin** als Mittelpunkt und
folgt einem gelappten Polygon im Berliner Zentrum. Das Quellpolygon bleibt die
feste räumliche Grenze, damit Releases reproduzierbar und lokal herunterladbar
bleiben.

**Ausschnitt (ungefähr):**

- **Brandenburger Tor** (Südost-Ecke, Pariser Platz)
- **Reichstagsgebäude**
- **Bundeskanzleramt**
- **Paul-Löbe-Haus** und **Marie-Elisabeth-Lüders-Haus**
  (das „Band des Bundes" entlang der Spree)
- **Berlin Hauptbahnhof**, Hamburger Bahnhof und Europacity im Norden
- **Kongresshalle / Haus der Kulturen der Welt** („Schwangere Auster")
- Der vollständige **Tiergarten** bis zum Charlottenburger Tor im Westen
- Kulturforum, Potsdamer/Leipziger Platz, Anhalter Bahnhof und Kochstraße
- Beide Portale des **Tiergartentunnels** und die angenäherte Untergrundroute

Die umschließende Box misst grob 4,3 × 4,5 km; das gelappte Polygon spart nicht
angeforderte Umgebung aus. Es bleibt deutlich kleiner als ein Stadtmodell für
ganz Berlin.

</td>
</tr>

<tr>
<td valign="top">

## Data Sources & Licensing

This project uses **additive data fusion** built on open data, with
Google Maps Platform as an **opt-in, additive** source (never a
replacement for Berlin open data or OSM):

| Dataset | Source | License |
|---|---|---|
| 3D building geometry (LoD2) | [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) (effectively public domain) |
| Streets, parks, water, POIs | [OpenStreetMap](https://www.openstreetmap.org) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Orthophotos / DOP, ALKIS, DGM (optional) | Geoportal Berlin | dl-de/zero-2-0 |
| Individual trees, public lighting, 1989 Wall route | [Geoportal Berlin](https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23) | dl-de/zero-2-0 |
| Landmark facade / material visual references | [Wikimedia Commons / Wikipedia](https://commons.wikimedia.org) | Per file: CC0, public domain, CC BY, CC BY-SA; see `geo_data/regierungsviertel/wikimedia_references.json` |
| Kindertransport memorial visual references | [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/denkmal-zur-erinnerung-an-die-kindertransporte-und-die-deportation-von-kindern-1938-1945-5234/) | Five photographs: © Pauline Ahrens, 2021, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); no photograph or texture is bundled |
| CSD memorial place at Ahornsteig | [Bezirksamt Mitte](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2026/pressemitteilung.1699951.php), [Berlin.de](https://www.berlin.de/aktuelles/10556192-958090-ahornbaum-und-regenbogenbank-erinnern-an.html), [rbb24](https://www.rbb24.de/panorama/beitrag/2026/08/berlin-anschlag-csd-baumpflanzung-gedenkort.html) and [OSM node 14076715427](https://www.openstreetmap.org/node/14076715427) | Position: OSM/ODbL; official and press pages are evidence only, with no photograph or page media bundled |
| Photorealistic 3D Tiles (opt-in) | [Google Maps Platform](https://developers.google.com/maps/documentation/tile/3d-tiles) | [Google Maps Platform ToS](https://cloud.google.com/maps-platform/terms) |

**Required attribution in the viewer:**

> © OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia · Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)

When Google-derived content is used, the required Google attribution
(e.g. *Imagery © Google · Google Maps Platform*) must additionally be
shown. OSM is share-alike for *derivative databases*, but rendered tile
images are *Produced Works* and may be released under any license, as
long as the attributions above are shown.
Per-file Wikimedia credits are stored in
`src/app/public/dzi/regierungsviertel/wikimedia_attribution.json` and
`references/wikimedia/README.md`.
The five Kindertransport reference-photo credits are stored in
`src/app/public/dzi/regierungsviertel/visual_reference_attribution.json`.

</td>
<td valign="top">

## Datenquellen & Lizenzen

Dieses Projekt nutzt **additive Datenfusion** auf Basis offener Daten,
mit Google Maps Platform als **optionaler, additiver** Quelle (niemals
als Ersatz für Berliner Open Data oder OSM):

| Datensatz | Quelle | Lizenz |
|---|---|---|
| 3D-Gebäudegeometrie (LoD2) | [Geoportal Berlin / FIS-Broker](https://daten.berlin.de/datensaetze/3d-gebaeudemodelle-lod2-berlin) | [dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0) (faktisch gemeinfrei) |
| Straßen, Parks, Wasser, POIs | [OpenStreetMap](https://www.openstreetmap.org) | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) |
| Orthophotos / DOP, ALKIS, DGM (optional) | Geoportal Berlin | dl-de/zero-2-0 |
| Einzelbäume, öffentliche Beleuchtung, Mauerverlauf 1989 | [Geoportal Berlin](https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23) | dl-de/zero-2-0 |
| Fassaden-/Material-Referenzen für Sehenswürdigkeiten | [Wikimedia Commons / Wikipedia](https://commons.wikimedia.org) | Je Datei: CC0, Public Domain, CC BY, CC BY-SA; siehe `geo_data/regierungsviertel/wikimedia_references.json` |
| Bildreferenzen zum Kindertransport-Denkmal | [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/denkmal-zur-erinnerung-an-die-kindertransporte-und-die-deportation-von-kindern-1938-1945-5234/) | Fünf Fotos: © Pauline Ahrens, 2021, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); weder Foto noch Textur wird gebündelt |
| CSD-Gedenkstelle am Ahornsteig | [Bezirksamt Mitte](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2026/pressemitteilung.1699951.php), [Berlin.de](https://www.berlin.de/aktuelles/10556192-958090-ahornbaum-und-regenbogenbank-erinnern-an.html), [rbb24](https://www.rbb24.de/panorama/beitrag/2026/08/berlin-anschlag-csd-baumpflanzung-gedenkort.html) und [OSM-Knoten 14076715427](https://www.openstreetmap.org/node/14076715427) | Position: OSM/ODbL; amtliche und journalistische Seiten dienen nur als Beleg, weder Foto noch Seitenmedium wird gebündelt |
| Photorealistic 3D Tiles (opt-in) | [Google Maps Platform](https://developers.google.com/maps/documentation/tile/3d-tiles) | [Google Maps Platform ToS](https://cloud.google.com/maps-platform/terms) |

**Pflicht-Attributionshinweis im Viewer:**

> © OpenStreetMap-Mitwirkende · 3D-Gebäudemodelle: Geoportal Berlin (dl-de/zero-2-0) · Visuelle Referenzen: Wikimedia Commons/Wikipedia · Kindertransport-Bildreferenzen: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)

Bei Verwendung von Google-Inhalten ist zusätzlich der erforderliche
Google-Hinweis (z. B. *Imagery © Google · Google Maps Platform*)
anzuzeigen. OSM hat eine Share-Alike-Klausel für *abgeleitete
Datenbanken*, gerenderte Kachelbilder sind aber *Produced Works* und
dürfen unter beliebiger Lizenz veröffentlicht werden, solange die
obigen Hinweise sichtbar sind.
Die Wikimedia-Credits pro Datei liegen in
`src/app/public/dzi/regierungsviertel/wikimedia_attribution.json` und
`references/wikimedia/README.md`.
Die Credits der fünf Kindertransport-Referenzfotos liegen in
`src/app/public/dzi/regierungsviertel/visual_reference_attribution.json`.

</td>
</tr>

<tr>
<td valign="top">

## Run locally

The committed viewer can run from your hard drive with the generated
open-data artefacts. It does **not** need an AI model at runtime. AI is
only needed later if you want to replace the deterministic local
pixel-art pass with a fine-tuned image model.

```bash
python3 scripts/serve_local_viewer.py
```

Open the printed local URL, usually:

```text
http://127.0.0.1:8766/
```

If port `8766` is already busy, the local server automatically uses
the next free port and prints that URL.

Current default data sources are free/open: Berlin LoD2, OSM, ALKIS, DOP
preview, and DGM preview. Google 3D Tiles remain wired as an
optional opt-in source, but are not required and are not fetched unless
you provide a local `.env` with a Maps API key and the opt-in flags.

Landmark placement is checked in
[`docs/landmark-alignment.md`](docs/landmark-alignment.md) against the
local OSM city-map layer and Berlin LoD2 building geometry. The viewer
starts in a north-up true 3D view. It supports free orbit, zoom, pan and a
physical underside camera with the Tiergartentunnel cutaway. Cardinal presets
and a top-down OSM/LoD2 reference map keep orientation reproducible; the static
Deep Zoom image remains available from the mode switch.

To create a downloadable folder and ZIP for another Mac or PC:

```bash
python3 scripts/package_static_site.py
```

The result is written to
`releases/isometric-berlin-regierungsviertel-local/` and
`releases/isometric-berlin-regierungsviertel-local.zip`. Unzip it on
the target computer and start:

- Mac and Windows zero-server fallback: double-click `START-HERE.html`.
- Full local 3D on macOS: open Terminal and run `python3 serve-local.py` from
  the unzipped folder; it opens the 3D viewer directly.
- Full local 3D on Windows: double-click `start-windows.bat`; it opens the 3D
  viewer directly.
- Linux fallback: `./start-linux.sh`.

There is intentionally no `start-mac.command` anymore: downloaded
`.command` files are unsigned executable scripts, so macOS Gatekeeper can
block them before the viewer starts.

</td>
<td valign="top">

## Lokal starten

Der committed Viewer läuft mit den erzeugten Open-Data-Artefakten
direkt von deiner Festplatte. Dafür brauchst du **kein KI-Modell** zur
Laufzeit. KI wird erst später relevant, wenn der deterministische
lokale Pixel-Art-Schritt durch ein feinabgestimmtes Bildmodell ersetzt
werden soll.

```bash
python3 scripts/serve_local_viewer.py
```

Öffne die ausgegebene lokale URL, normalerweise:

```text
http://127.0.0.1:8766/
```

Falls Port `8766` schon belegt ist, nutzt der lokale Server automatisch
den nächsten freien Port und gibt diese URL aus.

Der aktuelle Standard nutzt nur kostenlose/offene Quellen: Berlin LoD2, OSM,
ALKIS, DOP-Preview und DGM-Preview. Google 3D Tiles bleiben
als optionale Opt-in-Verbindung vorbereitet, werden aber nicht benötigt
und nicht abgerufen, solange keine lokale `.env` mit Maps-API-Key und
Opt-in-Flags vorhanden ist.

Die Lage der Sehenswürdigkeiten wird in
[`docs/landmark-alignment.md`](docs/landmark-alignment.md) gegen den
lokalen OSM-Stadtplan-Layer und die Berliner LoD2-Gebäudegeometrie
geprüft. Der Viewer startet mit geographisch Norden oben in echtem 3D. Freies
Drehen, Zoomen, Verschieben und die physische Untersicht mit
Tiergartentunnel-Cutaway sind direkt verfügbar. Kardinal-Presets und die
Top-down-Referenzkarte aus OSM/LoD2 machen den Stadtplan-Abgleich
reproduzierbar; die statische Deep-Zoom-Ansicht bleibt als Modus erhalten.

Ein herunterladbares Paket für einen anderen Mac oder PC erzeugst du so:

```bash
python3 scripts/package_static_site.py
```

Das Ergebnis liegt unter
`releases/isometric-berlin-regierungsviertel-local/` und
`releases/isometric-berlin-regierungsviertel-local.zip`. Auf dem
Zielrechner entpacken und starten:

- Mac und Windows ohne Server: Doppelklick auf `START-HERE.html` öffnet die
  robuste 2D-Fallbackansicht.
- Volles lokales 3D auf macOS: Terminal öffnen und im entpackten Ordner
  `python3 serve-local.py` ausführen; der 3D-Viewer öffnet sich direkt.
- Volles lokales 3D auf Windows: `start-windows.bat` doppelklicken; der
  3D-Viewer öffnet sich direkt.
- Linux-Fallback: `./start-linux.sh`.

Ein `start-mac.command` wird absichtlich nicht mehr ausgeliefert:
heruntergeladene `.command`-Dateien sind unsignierte ausführbare Skripte
und werden von macOS Gatekeeper oft blockiert, bevor der Viewer starten
kann.

</td>
</tr>

<tr>
<td valign="top">

## Pipeline (implemented)

1. **Bounds** — define the Regierungsviertel polygon
   (`geo_data/regierungsviertel/bounds.geojson`).
2. **Geometry** — clip official LoD2 and bounded OSM evidence to bounds; emit
   metric, progressively loaded procedural WebGL surfaces.
3. **OSM context** — extract streets, water, parks, rail (Hauptbahnhof
   tracks), POIs for the same bounds.
4. **Official detail** — clip Berlin tree, public-lighting and Wall-route WFS
   layers and additively fuse them with OSM.
5. **Quadrant grid** — define isometric quadrants
   (target 512×512 px tile quadrants, same as NYC) over the area.
6. **Render** — orthographic/isometric 3D render of each quadrant
   → "whitebox" / textured render PNG.
7. **AI tile generation** — optionally feed each render into a fine-tuned
   `Qwen/Image-Edit` model to produce the pixel-art tile.
8. **DZI export** — assemble tiles into a Deep Zoom pyramid
   (libvips / pyvips).
9. **Viewer** — React + Three.js/OpenSeadragon app for true 3D and the 2D
   compatibility view.

The NYC repo's `src/isometric_nyc/` layout is mirrored as
`src/isometric_berlin/`.

</td>
<td valign="top">

## Pipeline (umgesetzt)

1. **Bounds** — Polygon des Regierungsviertels definieren
   (`geo_data/regierungsviertel/bounds.geojson`).
2. **Geometrie** — amtliche LoD2- und begrenzte OSM-Evidenz auf das Polygon
   clippen und metrische, progressiv geladene prozedurale WebGL-Flächen
   erzeugen.
3. **OSM-Kontext** — Straßen, Wasser, Parks, Schienen (Hauptbahnhof),
   POIs für denselben Bereich extrahieren.
4. **Amtliche Details** — Berliner Baum-, Beleuchtungs- und
   Mauerverlaufs-WFS clippen und additiv mit OSM fusionieren.
5. **Quadrantenraster** — isometrische Quadranten (Ziel 512×512 px,
   wie bei NYC) über das Gebiet legen.
6. **Render** — orthographisch/isometrisches 3D-Rendering je Quadrant
   → „Whitebox"- bzw. texturiertes Render-PNG.
7. **KI-Kachelgenerierung** — optional jedes Render in ein feingetuntes
   `Qwen/Image-Edit`-Modell speisen, das die Pixel-Art-Kachel erzeugt.
8. **DZI-Export** — Kacheln zu einer Deep-Zoom-Pyramide zusammenbauen
   (libvips / pyvips).
9. **Viewer** — React + Three.js/OpenSeadragon für echtes 3D und die
   2D-Kompatibilitätsansicht.

Das Layout `src/isometric_nyc/` aus dem NYC-Repo wird hier als
`src/isometric_berlin/` gespiegelt.

</td>
</tr>

<tr>
<td valign="top">

## Project Structure

```
isometric-berlin/
├── docs/                    # Setup, data, generation, deployment docs
├── geo_data/
│   └── regierungsviertel/   # LoD2 + OSM data for the MVP area
├── generations/             # SQLite DBs of rendered/generated tiles
├── references/              # Style reference images
├── src/
│   ├── app/                 # React + OpenSeadragon viewer
│   └── isometric_berlin/    # Python pipeline
├── inference/               # Modal serving for fine-tuned model
├── pyproject.toml
├── LICENSE                  # MIT
└── README.md
```

## Quickstart

The local open-data viewer is ready to run. It does not need an AI
model or a Google key at runtime.

```bash
# Python env
uv sync

# Local viewer
python3 scripts/serve_local_viewer.py

# Downloadable Mac/Windows/Linux package
cd src/app && bun install && bun run build
cd ../..
python3 scripts/package_static_site.py
```

</td>
<td valign="top">

## Projektstruktur

```
isometric-berlin/
├── docs/                    # Setup, Daten, Generierung, Deployment
├── geo_data/
│   └── regierungsviertel/   # LoD2- und OSM-Daten des MVP-Gebiets
├── generations/             # SQLite-DBs der gerenderten/generierten Tiles
├── references/              # Stilreferenzbilder
├── src/
│   ├── app/                 # React + OpenSeadragon Viewer
│   └── isometric_berlin/    # Python-Pipeline
├── inference/               # Modal-Serving des feingetunten Modells
├── pyproject.toml
├── LICENSE                  # MIT
└── README.md
```

## Schnellstart

Der lokale Open-Data-Viewer ist startklar. Zur Laufzeit brauchst du
kein KI-Modell und keinen Google-Key.

```bash
# Python-Umgebung
uv sync

# Lokaler Viewer
python3 scripts/serve_local_viewer.py

# Download-Paket für Mac/Windows/Linux
cd src/app && bun install && bun run build
cd ../..
python3 scripts/package_static_site.py
```

</td>
</tr>

<tr>
<td valign="top">

## License & Attribution

- **Code:** [MIT License](LICENSE), © 2026 Klotzkette.
- **Inspired by and structurally derived from**
  [cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc)
  (MIT, © 2025 Andy Coenen). Where files retain meaningful portions of
  the original NYC code, the upstream copyright notice is preserved.
- **Geo data:** see *Data Sources & Licensing* above.
- **Generated tiles:** released as Produced Works; downstream license
  TBD per release.

</td>
<td valign="top">

## Lizenz & Namensnennung

- **Code:** [MIT-Lizenz](LICENSE), © 2026 Klotzkette.
- **Inspiriert von und strukturell abgeleitet aus**
  [cannoneyed/isometric-nyc](https://github.com/cannoneyed/isometric-nyc)
  (MIT, © 2025 Andy Coenen). Wo Dateien wesentliche Anteile des
  ursprünglichen NYC-Codes enthalten, bleibt der ursprüngliche
  Urheberrechtsvermerk erhalten.
- **Geodaten:** siehe *Datenquellen & Lizenzen* oben.
- **Generierte Kacheln:** als Produced Works veröffentlicht;
  nachgelagerte Lizenz wird pro Release festgelegt.

</td>
</tr>

</table>
