# Web viewer

React + TypeScript + Vite with two complementary static engines, managed with
`bun`:

- **Three.js true 3D:** official Berlin 3D Mesh 2025, progressively loaded,
  freely orbitable from above and below.
- **OpenSeadragon detail map:** the 16384×11616 DZI remains the fast,
  high-resolution cartographic fallback.

The hosted build keeps that full pyramid. Release archives intentionally omit
only its redundant top level and ship an 8192×5808 DZI fallback alongside the
6144×4356 double-click overview; their complete 74-file 3D scene is unchanged.

Required attribution overlay in the viewer chrome. The viewer ships the
required minimum (OSM + Geoportal Berlin) **plus** the Wikimedia visual-
reference clause, because the bundled tiles use Wikimedia references
(see `NOTICE.md`). This is the exact string in `src/app/src/App.tsx`
(`ATTRIBUTION`); keep the two in sync, and never drop the leading
OSM + Geoportal Berlin minimum:

```
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia
```

The true 3D mode appends:

```
3D mesh: Berlin Partner für Wirtschaft und Technologie GmbH
```

When Google Photorealistic 3D Tiles are enabled (opt-in), additionally
show the Google attribution required by the Google Maps Platform Terms.

## Keyboard shortcuts & help

The viewer has a built-in help panel (the keyboard button in the top
toolbar, or press `?`) listing the shortcuts: `PageUp`/`PageDown`
previous/next sight, `Space` start/pause the tour, `+`/`=`/`−` zoom,
`Home`/`0` overview, `D` switch Day/Night, `M` toggle Minecraft, `S` toggle
Snowstorm, `P` toggle pedestrian mode, `N` toggle night lights, `F` fullscreen, `R` reset, `B` ambient
music, `T` Dusk Republic, `L` copy
a view link, and `Esc` close overlays. `Alt`/`Option` plus arrows remains a
viewer chord and is deliberately exempt from the browser-shortcut guard.

In true 3D, left-drag pans with direct manipulation, the wheel zooms at the
pointer, right-drag orbits, and one finger orbits on touch. A two-finger centre
swipe pans with direct manipulation; pinch zooms around the finger midpoint,
and double-tap zooms around the tapped world point. A three-finger gesture controls
azimuth and polar tilt continuously through 90 degrees into the real underside
camera. The underside fades surface materials and strengthens the two-tube
Tiergartentunnel cutaway; the tunnel is hidden in ordinary exterior views and
appears automatically after the camera crosses below ground **or flies into
the tunnel tube itself** — approaching a portal at street level and diving in
switches to the lit interior (safety-light strips, ceiling lights, ventilation
shafts and fans) and out the other end.
Arrow keys translate camera and target together in the visible screen plane.
`Shift` plus arrows flies forward/backward or strafes relative to the current
heading; `Alt`/`Option` plus left/right orbits and plus up/down tilts. The
lit Tiergartentunnel is entered manually through either connected road portal;
there is no scripted tunnel ride competing with direct camera control.

Pedestrian mode is an independent navigation layer over all four visual modes.
It starts directly below the current camera at a 1.80 m eye height above the
existing smooth metric terrain, and disables
flight, zoom and underside controls. `W`/`S` or up/down walk,
`A`/`D` strafe, left/right or `Q`/`E` turn, and mouse or one-finger drag moves
the head with an 80-degree vertical limit. Hold `Shift` for a four-times sprint,
or double-tap `W`/up, the 3D canvas, the forward button or the walking joystick
to latch and unlatch the same sprint on keyboard, mouse and touch. The normal
6.4 m/s rate remains available for precise inspection, and both speeds pass
through the same terrain, tunnel and water checks. `Space` and the touch-safe jump
button produce a single ground-only jump with a 5.4 m apex; there is no double
jump. Entering a mapped OSM water polygon after landing respawns at Pariser
Platz. Islands encoded as water holes remain walkable. The mode neither moves
source geometry nor invents collision envelopes for buildings.

**Continuous navigation:** held plain arrows pan in screen space; held
`Shift`+arrows fly along the current heading; held `Alt`/`Option`+arrows orbit
and tilt. The matching on-screen arrow controls also move continuously while
the primary mouse button stays down, and desktop layouts expose an analogue
orbit pad beside the control panel. A plain `Space` tap toggles the sight tour.
On coarse-pointer devices a bottom-left thumb joystick provides continuous
flight (drag up = forward, sideways = strafe); the existing two-finger swipe
remains. Flying below the Spree surface (scene water level 1.31 m) switches to
an underwater presentation with deep-teal fog; it lifts as soon as the camera
surfaces, and the Tiergartentunnel interior — which passes under the river — is
exempt.

In DZI mode, ordinary drag pans and Shift-drag rotates. On phones and
coarse-pointer tablets up to 1024 px, the sight rail starts closed and leaves
the safe-area-aware bottom controls accessible.

## Language, visual modes, and sound

The toolbar exposes direct Day, Night, Minecraft and Snowstorm buttons. `D`
remains the fast Day/Night toggle, `M` enters or leaves Minecraft independently
and `S` enters or leaves Snowstorm. A fullscreen control uses the native API on
desktop and a safe-area-aware pseudo-fullscreen fallback on iOS.
A separate weather button adds moderate rain without changing Day, Night or
Minecraft. In Snowstorm the same button becomes a snowfall control: it pauses
or resumes falling flakes while the settled snow, drifts and snowploughs remain
in place. True 3D renders precipitation as one camera-following field, with a
lower particle budget on coarse pointers; the DZI fallback uses a lightweight
screen layer. Precipitation is hidden automatically in underwater and underside
views.

## Underground passenger cutaway

Crossing below the surface reveals a separate, stable passenger-rail cutaway:
real committed OSM courses for underground mainline, S-Bahn and U-Bahn tracks,
real platform plan shapes and mapped subway entrances. U5 and the shared
S1/S2/S25/S26 North-South corridor receive restrained route-colour cues. OSM
does not carry surveyed depths or tunnel sections, so vertical levels, open
frames and straight entrance shafts are explicitly schematic and contain no
invented utility pipes. The layer is fully hidden from every above-ground
camera and is documented in
[`underground-network.md`](underground-network.md).

Above ground, tram contact wires follow the mapped OSM tram courses; wire
height and mast rhythm are presentation approximations. Existing lamp posts
remain anchored to the official Geoportal Berlin public-lighting extract.
Eighteen static, diverse figures, two BVG buses, three cars, two bicycles, two
e-scooters and two strollers provide sparse scale cues without animation or
survey claims. Snowstorm adds one tiny ice fisher on a mapped Tiergarten pond;
the existing three snowploughs remain the only winter service vehicles.

Snowstorm reuses the same measured geometry under a broad white mantle and
adds a bounded camera-following field (2,400 flakes on desktop, 1,100 on touch
devices), 168 deterministic drifts and three snowploughs. It never moves a
building anchor and does not cover the tunnel interior or underside cutaway.

A fresh session and the Reset command both focus the Reichstag from an elevated
camera over the Platz der Republik lawn in Day mode. Explicit landmark deep
links still override that default. The zero-server fallback uses the same
start landmark.

**Day is a drawn isometric city**: the lumpy photogrammetry
buildings are replaced by prisms extruded from the surveyed LoD2 footprint
polygons (`lod2-prisms.json`, built by
`isometric_berlin.generation.build_isometric_prisms`) — exact corners,
planar walls, courtyard holes (the Reichstag keeps its two courtyards) —
with hard near-black ink lines from edge geometry and flat quantised
facade tones. Water, roads and paths use the bounded OSM polygons and retain
every exported mapped vertex; natural bends receive 2–2.5 m display
subdivisions while engineered corners stay sharp. Ground-bound plates
interpolate the committed
16 m IDW terrain support and bounded interior tessellation carries broad rises
through long polygons; quay coping follows the local landward grade. These are
presentation interpolations, not new survey observations. The OSM/official
tree layer stays soft ("Natur darf weich bleiben"). The recognition models
(Reichstag dome, Brandenburg
Gate, memorials, TIPI, Carillon…) remain visible on top of the prisms;
the photographic hero crops are hidden. The camera FOV narrows from 39°
to 30° in this mode to flatten the view toward a true isometric look.
Night and Snow relight the same drawn city; Minecraft uses its separate voxel
world. If the requested world fails, the viewer loads the photographic base
shell as a bounded fallback rather than leaving the curtain open forever.

The ordinary Day/Night/Snow cold start does not request the photographic GLBs
or the complete Minecraft instances. It reads `ground-context.json`, a
terrain-only sibling below 1 MiB, while the full voxel payload stays lazy.
Photo geometry remains available for the designed underside cutaway and for
failure recovery. Optional park details wait until the first usable city frame.
Core JSON transfers have a finite timeout, one retry and unmount cancellation.

**Minecraft is a true voxel world**: switching in lazily loads
`mesh/regierungsviertel/minecraft-voxels.json` — generated by
`isometric_berlin.generation.build_minecraft_voxels` from the surveyed LoD2
footprints + measured heights (153,151 building columns on a 4 m grid, stepped
roofs for gabled/hipped ALKIS roof forms), OSM water/roads/plazas as
run-length ground slabs, and the official tree points as trunk+crown cubes.
The block world replaces the photogrammetry surfaces and hero crops while
active. Outside the official payload grid, an explicitly marked extrapolated
block surround carries the same versioned 5,230 m envelope, park bands, tree
and lamp positions as Day and Night; it does not claim new surveyed geometry.
GPU instancing keeps the complete world to a handful of draw calls. An opaque
mode-coloured curtain stays in place until the block world is usable; only an
actual payload failure starts the photographic fallback. Leaving Minecraft
restores the drawn LoD2 scene losslessly. Three Creepers and four Zombies roam deterministic, tree-cleared
park routes while Minecraft is active. All of their block parts share one
instanced draw call, and the group is removed from Day, Night, underwater and
underside presentations. A persistent DE/EN control translates all viewer
chrome; official German place names remain unchanged, and the German UI uses
`Sehenswürdigkeiten` rather than the English false friend.

Both music layers are generated locally with Web Audio and load no recording,
stream or external audio asset. The music button or `B` controls seven original
54 BPM ambient variants; an explicit Ambient mute persists across reloads. The
note button or `T` independently controls `Dusk Republic`, whose enabled intent
resets on each reload. Browser autoplay rules still require the first permitted
click, touch, wheel or key gesture before sound becomes audible. A suspended
context is recovered on the next gesture, and both layers pause while the page
is hidden and dispose on a real page exit. Selecting a sight does not add
temporary slogans or commentary over the map.

The ordinary Day/Night pipeline applies a bounded crisp/saturation pass only
after camera movement settles; direct rendering resumes during motion. The
settled pass now includes an "isometric edge" outline (Roberts-cross on
luminance, strengths in `crispnessProfile.ts`) that darkens strong gradients so
buildings read graphic and edge-defined, while green-dominant vegetation is
suppressed and stays soft. Known photogrammetry sky artefacts are removed at
tile load via `meshArtefacts.ts` (evidence notes inline). Minecraft
uses its separate palette pass with reduced bloom and sparse shimmer. This keeps
controls responsive while improving stationary facade and roof definition.

Nine memorial recognition models supplement the official mesh at normal
selection distances. Repeated Holocaust stelae use GPU instancing, as do the
Soviet colonnade and fine folds of the 2026 Jehovah's Witnesses memorial; this
adds close-range granularity without loading another texture set or creating
thousands of draw calls. Evidence and approximation boundaries are documented
in [`monument-detail.md`](monument-detail.md).

The Georg Elser memorial at Wilhelmstrasse is an additional independent
recognition model at OSM sculpture node `1986458966`. Its published 17 m height,
steel material and exact point anchor are source facts; the continuous profile,
three visible steel laminae and pavement-plaque proportions are a
photograph-bounded reconstruction rather than a survey. The inset carries the
complete documented quotation and attribution. A dedicated close camera keeps
the profile and plaque together in frame, while mipmapped lettering disappears
before it can shimmer at overview distance. The model lives in the shared
memorial layer, so Day, Night, Minecraft and Snowstorm all retain it.

The Queer Rainbow Memorial at Ahornsteig is another independent recognition
model. Its WGS84 point was supplied by the owner and is transformed into the
same EPSG:25833 / official-mesh ground frame as the rest of the scene. The
4.057 m point sample remains recorded, while the visible base follows the
4.479 m continuous terrain surface used by the drawn park, preventing the
ground-level offerings from being buried by the smoothing layer. The
living tree, six-colour heart, tied fabric, dense flower and message field,
small Pride flags and candle arrangement are bounded by the supplied current
field views; neither the tree dimensions nor the offering layout are described
as surveyed. Flowers, cards, candles and flags are instanced and deterministic,
the close-detail root uses the shared distance-hysteresis fade, candle flames
appear only with Night lights, and static crown snow appears only in
Snowstorm. The compact rail remains limited to five principal orientation
points, while
`#landmark=queer-rainbow-memorial-berlin` provides a stable direct close view.

Only the selected landmark receives a small focus ring, and that ring fades
again after 2.4 seconds. Permanently visible coloured map dots
were removed from the Three.js, DZI and zero-server fallbacks because they
obscured roofs and facades.

Day/Night is a real scene-lighting mode rather than a CSS tint. It changes the
sun, hemisphere and fill lighting, fog, background and tone mapping; tagged
windows, station glass, street/tunnel fixtures and monument lighting become
emissive at night. The selected lighting mode is restored locally and can be
overridden with `?theme=day` or `?theme=night` for deterministic QA.

The four hero landmarks carry metre-scale recognition models over the official
photogrammetry. The Reichstag combines its four corner towers and west portico
with a transparent 40 m by 23.5 m dome anchored to the published 24 m terrace
datum, 24 main ribs, 17 horizontal rings, two counter-rotating ramps and a
mirror cone. The Chancellery keeps the published 36 m by 55 m leadership
building and 18 m office bands, but opens the central east/west elevations into
their concrete frame, semicircular halls, split gallery plates around a 14.4 m
open atrium, three bridges, a visible two-flight stair, concave roof shell and
lower tensile canopy. Separate sparse furnishings, planting, gallery rails and
warm night luminaires remain visible through cool transparent glazing instead
of making the glass itself glow. These interior cues are bounded to what the
six supplied public exterior views reveal; they are not a surveyed or
security-relevant floor plan. Its 5.5 m Chillida sculpture is fixed by OSM
artwork node `4329873408` in the eastern Ehrenhof; the entrance glazing, ivy
wings, protocol flags, lamps, gate, fence and landscaped
approach are bounded recognition details derived from supplied visual
references rather than surveyed fixture measurements. Hauptbahnhof exposes the 321 m glass roof, 180 x 42 m
crossing hall and 46 m office bridges. The Brandenburg Gate keeps its published
62.5 x 11 x 26 m envelope, twelve Doric columns and articulated bronze-green
Quadriga. These models sharpen silhouettes without replacing the aligned
Berlin Mesh texture beneath them.

Across the Spree, the Chancellery extension is a separate present-day
construction layer. OSM construction ways `1434663371`, `1315319770` and
`1357789475` fix the two shell footprints and complete worksite boundary; OSM
way `1357796197` fixes the South Bridge axis. The Federal Government's published
six-storey programme and 10 April 2026 update fix the represented stage as a
largely completed shell in technical fit-out, and the official 180 m bridge
length controls the displayed crossing. Storey rhythm, sparse lit fit-out
panes, partial scaffold, cranes, fencing, barriers, gravel aprons and stored
materials are bounded recognition details rather than surveyed temporary
positions. Trees and street lamps from older source snapshots are suppressed
only inside the current construction polygon.

The cultural recognition layer keeps similarly small features readable without
altering the official base mesh. The 32 x 26 m TIPI has twenty structural ribs,
220 warm rib bulbs, a night-only four-colour show wash and the requested golden
`PIGOR & EICHHORN` and `NUR HEUTE ABEND` marquee lines. The 42 m Carillon lets
the official photogrammetric mesh carry its four granite pylons and adds 68
individually placed bells beneath a shallow roof cap. Two compact
uniformed figures mark the Chancellery entrance. Selecting `Spreebogen` opens
an unobstructed east-side view of the occupied excursion boat, its open deck,
wake and a 3D wave ribbon aligned to the committed OSM river centreline.

The task-10 recognition layer covers the expanded edges without pretending to
be survey geometry: Hamburger Bahnhof/Rieckhallen and the historic
Landessozialgericht; Europacity/KPMG and an explicitly approximate DKB project
massing; Kulturforum, `berlin modern`, the Henry Moore sculpture and
Tilla-Durieux-Park; Anhalter Bahnhof, Charlottenburger Tor, the Spanish Embassy,
Café am Neuen See and the WELT balloon. All placement anchors come from the
committed LoD2/OSM/landmark frame. Drawn labels and silhouette accents remain
supplements to that evidence, never substitutes for it.

The Pariser-Platz and Potsdamer-Platz architecture keeps the same boundary.
The Center / former Sony Center retains its LoD2 glass-and-steel envelopes;
the Forum now carries 24 translucent membrane fields, seven supports, cable
geometry, 28 curved glass bays, 168 horizontal stainless rails and 28 red
vertical fins instead of an opaque dark roof plate. Hotel Adlon remains on
Berlin LoD2 building `K00006ot`; its pale stone body receives the characteristic
patinated green mansard, dormers, facade rhythm, awnings and portico as a
recognition layer. The French, British and Hungarian embassy overlays are
anchored to their respective LoD2 buildings and add only their defining public
facade features: French Bel-Etage openings and Rue de France, the British
screen/collage and green roof, and the Hungarian glazed base, stone wings and
roof flag. No photograph is projected or bundled as a texture.

Spreebogenpark keeps OSM park way `737280675` and the committed terrain grid as
its plan and height anchors. Two rising circle-segment lawns frame the surviving
Alsenstrasse axis with a 17 m landscape window and dark Corten walls; the
exact mapped Ludwig-Erhard-Ufer paths remain OSM ways `34834265` and
`1128036906`. The lawn rise and wall treatment follow the published Berlin and
landscape-architect descriptions and remain explicitly source-described
recognition geometry rather than a claimed fixture survey.

Three smaller places carry the same evidence boundary. Hotel AMANO Grand
Central retains OSM way `237687062` and Berlin LoD2 building part
`DEBE3DLXM9FjJbtp` (27.819 m), with a thin source-described clinker, glazing
and setback-storey overlay. The Geschichtspark Ehemaliges Zellengefaengnis
Moabit retains OSM park way `498278335`; its brick walls, three entrances, four
wing traces, panopticon frame, three circular yards, blood-beech planting and
one walk-in cell follow the published Berlin interpretive plan and are not
labelled as surviving prison survey geometry. At Floraplatz, exactly eight
OSM-positioned granite plinths carry differentiated bronze deer, bison, elk,
bear and bull silhouettes. The duplicate generic Bison node at the same
eastern plinth as `Liegender Bison II` is the only suppressed record.

The Löwenbrücke is a dedicated metre-scale recognition model at OSM way
`1411957328`, replacing the former four-cell generic bridge raster rather than
overdrawing it. Its published 17.3 m length and 2.0 m timber-deck width control
the envelope; the official Berlin monument record controls the 1838 suspension
principle, light-yellow timber, bronzed lions and pale sandstone bases. Nine
lattice bays, ten longitudinal board runs, paired cables, 22 hangers and the
four inward-facing lions reproduce the supplied current views. Exact lion,
cable, railing and joinery dimensions remain labelled photo-bounded
reconstruction, not survey geometry. The fine members use the shared
distance-hysteresis and ink fade so the close view stays intricate without
shimmering in the overview.

The Swiss Embassy recognition model preserves its Berlin LoD2 50.927 x 22.804 m
envelope and the 21.05 m historic roof datum. The official EDA building history
identifies the 1870/71 Friedrich Hitzig / Paul Baumgarten palace and the 2000
Diener & Diener extension as the two architectural layers. The supplied current
street photograph bounds the old palace's nine-bay, three-storey facade rhythm,
offset timber entrance, warmer rusticated base, fine cornices, balustrade and
centred roof flag. Those small profiles, sash widths, fixture positions and the
2.2 m display flag remain recognition estimates rather than claimed survey
observations; no photograph is bundled or projected onto the geometry. The
street-front and 104 fine balusters use the shared hysteretic detail layer so
they disappear before becoming unstable sub-pixel marks in an overview.

`berlin modern` is handled as planning geometry because the museum is still
under construction and therefore absent from the completed-building LoD2
inventory. The model follows the architects' published 120 m length, 71 m
width, 18 m height and three-level envelope, while the committed OSM
construction boundary supplies the local site axis. It includes a grounded
mineral masonry body, broad north glazing, east-side openings and a dark
photovoltaic gable roof. The Day/Night drawing and block-native Minecraft model
share that same contract. Sources: [Herzog & de Meuron project data](https://www.herzogdemeuron.com/projects/469-museum-der-moderne-berlin-modern/)
and [Bundesbau project information](https://bundesbau.de/projekte/berlin-modern).

The optional OSM park-detail request is deliberately non-blocking: a failed
`park-details.json` request raises a warning but never delays or disables the
23 official base meshes. When present, schema 4 batches park paths into six
material groups while retaining an individual resolved width per way; tree
trunks, fork branches and five-part crowns are instanced, and only the small
number of mapped playground devices use individual geometry. The always-loaded
smooth surface pass uses those same six families across the complete bounded
walking and cycling network. Curved bridleways, cycleways, footways and paths
receive deterministic centripetal interpolation at runtime: every OSM source
vertex and both endpoints remain exact, while only the drawn intervals between
them are densified. Steps remain unsmoothed, and the committed payload size does
not increase. The
Luiseninsel landmark
opens from an 82 m oblique camera preset centred on the main equipment cluster.
Nearby OSM crowns step aside and only the mapped equipment receives a temporary
focus reveal above the coarse official canopy; the sourced footprint and the
normal Tiergarten depth presentation remain unchanged outside that selection.
Three true-scale 6.7 cm eggs are placed deterministically beside mapped trees;
they are decorative discoveries, not landmark markers.

Every recognition group is now rotated into the minimum-area local frame of
its official LoD2 footprint. In particular, the Hauptbahnhof track roof follows
the measured 21.82-degree local axis and is anchored at the LoD2 hall centre
rather than the OSM label point. Its four upper tracks carry a stationary ICE
and Berlin S-Bahn with ends visible outside the glass roof. Reichstag cornices,
portico capitals and flags, Chancellery floor plates and facade mullions, and
the Gate's five passages and articulated Quadriga provide model-railway scale
cues while retaining the official textured surface as the visual evidence
layer.

Close-range facade articulation is deliberately batched. Reichstag windows,
stone courses and balustrade posts, Chancellery curtain-wall panes and arched
window grids, Hauptbahnhof roof-panel seams, sleepers, platform joints and
train fittings, and Brandenburg Gate fluting, triglyphs and masonry joints use
instanced meshes or consolidated vector segments. This keeps the published
metric envelopes unchanged and avoids turning hundreds of small visual cues
into hundreds of draw calls on phones and tablets.

Selecting one of these four heroes applies a documented presentation angle and
building-specific camera distance and targets the recognition-model anchor.
The Chancellery camera deliberately targets its leadership cube rather than the
centre of the complete office ensemble. The model remains freely orbitable
immediately afterward; the preset only prevents small landmarks such as the
Brandenburg Gate from opening as an unrecognisable object in a 250 m-wide view.

The downloadable `START-HERE.html` is explicitly a 2D compatibility fallback,
not the full viewer. It uses a separate zero-server camera and
normalizes the 16384×11616 landmark payload into the 2157×1529 SVG overlay
coordinate system, applies an invertible pan/scale/skew/rotate transform, keeps
the stage centre stable through zoom and swivel, and constrains the transformed
corners so the map cannot be lost completely outside the viewport. Desktop
stage height is fixed to the viewport; below 850 px the map uses 58dvh and the
controls scroll independently in the remaining 42dvh. The local server opens
`index.html` directly so users do not mistake this fallback for the true 3D
scene.

## Shareable view links

The link button in the top toolbar copies the current landmark,
orientation, and mirror state into the URL hash. Opening that URL restores
the same landmark focus and view orientation, which makes local QA notes
and screenshot handoff easier without needing server-side routes.

## Landmark tour order

The viewer sorts `landmarks.json` into a north-to-south Regierungsviertel
walk before rendering the rail and tour. The source coordinates are not
moved; only the user-facing order changes. See
[`correctness-crosscheck.md`](correctness-crosscheck.md).

For local download reliability, the same landmark payload is also bundled
into the React app at `src/app/src/data/regierungsviertel-landmarks.json`.
Keep it byte-identical to
`src/app/public/dzi/regierungsviertel/landmarks.json`; the package tests
enforce this. Bundling avoids `fetch()` for downloaded `file://` starts.

## Remote DZI hosting

By default the viewer loads the mesh scene from
`public/mesh/regierungsviertel/scene.json` and the five compact JSON layers
needed by the drawn city. The terrain-only `ground-context.json` replaces the
full Minecraft instances during Day/Night/Snow startup. Neither the 2.6M-face
interaction GLBs, the 6.6M-face archival surface nor hero crops are requested
for normal drawn navigation. The interaction shell is ordered by distance and
loaded with bounded concurrency only when an underside cutaway needs context
or the requested drawn world has failed. Its model requests retry once; JSON
requests additionally have a finite timeout. The settled tier and all hero
assets remain in the reproducible local archive but do not consume normal live
bandwidth or GPU memory. A lost WebGL
context switches to the DZI fallback and a later 3D selection creates a fresh
context. On touch/coarse-pointer devices, switching to the 2D map unmounts the
inactive WebGL scene and moving 3D rendering uses a 30 fps budget; desktop keeps
the loaded scene warm and interaction at 60 fps. Static scenes hold the final
framebuffer without a periodic redraw. Existing GLB normals are reused, repeated
tunnel fixtures are instanced, and a stale mobile hero queue is stopped and
disposed after a new landmark selection. Disposal also stops workers before
they start another queued GLB, closes decoded image resources where the browser
exposes them and resets custom touch state on lost pointer capture, global
pointer release, window blur or tab hiding. A watchdog restores controls after
a stale three-finger sequence, while finite camera bounds recover a lost pose.

The DZI tile pyramid and reference map
load from `public/dzi/regierungsviertel/`, while the DZI landmark navigation is
bundled into the app to support double-click local starts. Set
`VITE_DZI_BASE_URL` at build time to load the tile
pyramid and reference map from a remote host (e.g. a Cloudflare R2
bucket) instead — see
[`perplexity-hosting.md`](perplexity-hosting.md).

`START-HERE.html` intentionally remains a zero-server 2D compatibility view.
When opened over `file://`, its full-3D link now displays the platform-specific
server command instead of navigating to a module page that browsers cannot load
reliably from local files.

The packaged HTTP server uses HTTP/1.1 and serves GLBs as
`model/gltf-binary`. Heavy immutable assets (`.glb`, DZI images, JavaScript and
CSS) receive a one-year immutable cache policy, while HTML and scene metadata
revalidate. The repository development server uses revalidation rather than an
immutable policy so a rebuilt file with the same name is not hidden by cache.
