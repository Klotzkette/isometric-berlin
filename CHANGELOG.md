# Changelog

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
