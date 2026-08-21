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

Pedestrian mode is an independent navigation layer over all five visual modes.
It starts directly below the current camera at a 1.80 m eye height above the
existing smooth metric terrain, and disables
flight, camera zoom and underside controls. `W`/`S` or up/down walk,
`A`/`D` strafe, left/right or `Q`/`E` turn, and mouse or one-finger drag moves
the head with an 80-degree vertical limit. Scrolling the mouse wheel up walks
forward and scrolling down walks backward; fine vertical trackpad deltas are
proportional, while pinch and horizontal gestures do not move the walker. All
wheel travel passes through the same solid-object, terrain, tunnel and water
checks as keyboard movement. Hold `Shift` for a four-times sprint,
or double-tap `W`/up, the forward button or the walking joystick to latch and
unlatch the same sprint on keyboard, mouse and touch; a mouse double-click on
the 3D view does the same. The normal
6.4 m/s rate remains available for precise inspection, and both speeds pass
through the same terrain, tunnel and water checks. `Space`, the touch-safe jump
button and a double-tap on the free 3D view produce a single ground-only jump
with a 6.2 m apex; the relaxed mobile double-tap still rejects drags, pinches
and long presses, and there is no double jump. Entering a mapped OSM water
polygon after landing respawns at Pariser Platz. Islands encoded as water
holes remain walkable. The mode does not move source geometry. The five
historic Brandenburg Gate passages are explicit, source-scoped voids in Day,
Night, Minecraft, Snowstorm and Schwellenraum; all twelve columns, the lintel
and both side pavilions remain solid. Schwellenraum adds only its further
bounded doorway, interior-wall and floor collision contracts; every other
building remains the same closed solid.

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

The toolbar exposes direct Day, Night, Minecraft, Snowstorm and Schwellenraum
buttons. `D`
remains the fast Day/Night toggle, `M` enters or leaves Minecraft independently
and `S` enters or leaves Snowstorm. A fullscreen control uses the native API on
desktop and a safe-area-aware pseudo-fullscreen fallback on iOS.
A separate weather button adds moderate rain without changing Day, Night or
Minecraft. In Snowstorm the same button becomes a snowfall
control: it pauses
or resumes falling flakes while the settled snow, drifts and snowploughs remain
in place. True 3D renders precipitation as one camera-following field, with a
lower particle budget on coarse pointers; the DZI fallback uses a lightweight
screen layer. Precipitation is hidden automatically in underwater and underside
views. Schwellenraum preserves the visitor's rain preference but disables the
weather control and precipitation so its geometry remains still.

Across Day, Night, Minecraft, Snowstorm and Schwellenraum, exactly nine
official civic flags use one deterministic, low-amplitude wind field: three
German and one European flag on the Reichstag, German and European protocol
flags at the Chancellery, the Flag of Unity, the Swiss Embassy flag and the
Federal President's standard. Their 30 coordinated cloth/emblem layers move no
more than 0.28 m at the free edge. The renderer requests flag frames at a
bounded 12 Hz on non-touch devices and 8 Hz in the mobile-like touch profile;
reduced-motion, distant, underside and hidden-page views retain one authored
pose. Decorative hotel flags and the small static Pride memorial offerings are
outside this allowlist.

Schwellenraum reuses the complete Day city and crossfades the two normal audio
layers into a dedicated, very quiet procedural soundscape. Its two existing
audio controls independently fade a soft room-rustle bus and a sparse harmonic
bus; leaving the mode restores the standard layers without losing either user
choice. Its warm pearlescent sky, pastel light thresholds, fixed sparse
furnishings and elongated repeated frames are additive; buildings are never
globally warped or recoloured. It shares the all-mode official-civic flag
field: the explicitly identified German, EU, Swiss and Federal President
flags advance at no more than 12 Hz on non-touch devices or 8 Hz in the
mobile-like touch profile. The only additional changing element is a
texture-free light veil over the source water. Its fixed
mist fields breathe at 3.75 Hz and a sparse deterministic subset may show a
slow, faint glint; water vertices, ripples, vessels and wakes never move.
Reduced-motion preference freezes both cloth and veil; distant, underside and
hidden-page views likewise hold the cloth at one authored pose. The mode opens
in true 3D and adds
explicit entrances, ramps, stairs and bounded presentation interiors for the
Reichstag plenary chamber, Hauptbahnhof concourse and deep platforms,
Bundeskanzleramt, Potsdamer Platz station cellar and the historic Charite
entrance. Walking and every flight input use swept solid collision in this
mode, while the Tiergartentunnel remains walkable through its mapped portals.
Seventeen persecution-, war- and violence-related memorial volumes override
all access rules; those models keep their exact Day materials and transforms,
receive no threshold geometry and cannot be entered.

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
The nine official civic flags keep the same gentle wind field while a
reversible cool frost tint covers their 30 cloth/emblem layers. Two shared
instanced batches add exactly 27 lower-edge icicles, three per physical flag;
the icicles follow the same deformation and disappear completely outside
Snowstorm.

A fresh session and the Reset command both focus the Reichstag from an elevated
camera over the Platz der Republik lawn in Day mode. Explicit landmark deep
links still override that default. The zero-server fallback uses the same
start landmark.

**Day is a drawn isometric city**: the lumpy photogrammetry buildings are
replaced by prisms extruded from authoritative LoD2 footprint polygons plus a
non-overlapping OSM context-building sidecar where LoD2 is absent
(`lod2-prisms.json`, built by
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

The ordinary Day/Night/Snow/Schwellenraum cold start does not request the
photographic GLBs
or the complete Minecraft instances. It reads `ground-context.json`, a
2.33 MB terrain-only sibling for the expanded bounds, while the losslessly
row-compressed full voxel payload stays lazy.
The first HTML response contains a small attributed startup plate. React then
loads the requested Three.js viewer as a separate chunk, while OpenSeadragon
stays entirely dormant until the visitor chooses the 2D map. A
production-build guard caps the synchronous JavaScript graph at 400 KiB
uncompressed. Since v0.72.3, a version-scoped preload listener is registered
before React can request that lazy chunk. If an already-open tab references a
hashed viewer file removed by a newer deployment, it requests exactly one
reload to obtain the current HTML manifest. The guard clears only after the
Three.js module loads successfully. A repeated module or render failure reaches
a visible error boundary with explicit Reload and 2D-map actions instead of
leaving a blank surface or an apparently inactive 3D mode button. Once the
3D runtime exists, the small scene manifest starts first and the immutable
payloads for the requested world transfer in parallel with manifest-driven
recognition-detail construction. Procedural audio graph preparation and its
autoplay attempt run only after the first app-shell paint.

The drawn city itself is progressive. Non-touch desktop constructs the nearest
exact 700 LoD2/OSM buildings on the main thread, then completes the source
inventory in near-to-far, material-merged Worker groups. The mobile-like touch
profile applies when the primary or any pointer is coarse, or the browser
reports `navigator.maxTouchPoints > 0`; it constructs an initial 320-building frame and stops
after the nearest **5,000 LoD2 buildings**. This is the complete bounded touch
near-field profile, not a reduction of the non-touch desktop inventory. Both
profiles retain the complete ground and every one-off recognition model.
Non-touch desktop's Worker supplies all eight exact surface families. The touch
profile's delayed Worker receives only the 4,680 remaining building records,
without a second copy of the ground/surface payload, and creates no exact
`surface-*` batches; the preview's raster ground, water and
asphalt plus the complete ParkDetails path network retain the context. Park
construction starts only after that Worker completes or fails. Hiding the page
stops the Worker, disposes partial follow-up groups and restarts deterministically
when visible. Every transferred typed geometry buffer changes ownership rather
than being JSON-serialised, and each batch receives the active Day, Night, Snow
or Schwellenraum materials before attachment. Entering Minecraft likewise stops
the hidden Worker and disposes its completed follow-up groups. A Worker or asset
failure never invokes the old synchronous full-city build.

On non-touch desktop, the pathological 2,566-hole asphalt union uses the
lossless, source-hash-bound
`surface-pretriangulation.json` / `surface-asphalt-*.plate.gz` Earcut result.
Terrain tessellation still uses the committed ground samples; paving polygons
and asphalt triangles are processed in bounded Worker partitions and merged
back to the historical single material meshes before transfer. Thus the final
asphalt buffer hash, vertex count and steady surface draw calls match the
one-shot path. The touch profile deliberately does not allocate either heavy
road plate;
its raster asphalt and full ParkDetails path ribbons preserve road context and
every authored park route. Regenerate the non-touch desktop plate after any
`surface-polygons.json` change with `bun run build:surface-plates` from
`src/app`. The touch profile deliberately creates none of the eight exact
Worker surface families; its raster surfaces and full ParkDetails path ribbons preserve the
bounded context without duplicating the surface payload into a second realm.
On the v0.72.2 benchmark
payload retained for v0.72.3, the reproducible Bun benchmark records a 0.76 s
preview build and a 1.9 ms maximum main-thread batch attachment, versus a
17.08 s synchronous
one-shot build; exact settle is 11.51 s. Whole-process peak RSS falls from
5.44 GiB to 3.55 GiB, while steady geometry remains 576.5 MiB and the complete
scene uses 188 estimated draw calls versus 150 in the monolithic reference.

Non-touch desktop photo geometry remains available for the designed underside
cutaway and for failure recovery. Mobile-like touch sessions keep the authored
tunnel/network view and never allocate the legacy photogrammetric shell for
underside or failure presentation. Optional park details wait until the first
usable city frame in a drawn presentation. Core JSON transfers have a finite
timeout, one retry and unmount cancellation.

**Minecraft is a true voxel world**: switching in lazily loads
`mesh/regierungsviertel/minecraft-voxels.json` — generated by
`isometric_berlin.generation.build_minecraft_voxels` from authoritative LoD2
footprints plus the non-overlapping OSM context sidecar (533,329 logical
building columns on a 4 m grid, stepped roofs for gabled/hipped roof forms),
OSM water/roads/plazas as
run-length ground slabs, and the official tree points as trunk+crown cubes.
The block world replaces the photogrammetry surfaces and hero crops while
active. Outside the official payload grid, an explicitly marked extrapolated
block surround carries the same versioned 6,450 m envelope, park bands, tree
and lamp positions as Day and Night; it does not claim new surveyed geometry.
GPU instancing keeps the complete world to a handful of draw calls. An opaque
mode-coloured curtain stays in place until the block world is usable. On
non-touch desktop, only an actual payload failure starts the photographic
fallback; touch-profile failure remains on the authored recovery presentation.
Leaving
Minecraft restores the drawn LoD2 scene losslessly. Reichstag, Bundeskanzleramt,
Hauptbahnhof, Brandenburger Tor and the parliamentary band receive shared,
opaque `InstancedMesh<BoxGeometry>` recognition batches over the same metric
voxel mass. Fewer than 5,000 signature blocks use a deliberately coarse 8 m
hero raster. Retained Reichstag, Chancellery and parliamentary source bodies
are divided vertically into block courses no taller than 8 m. Their stepped
dome, portals, glass halls, rotundas and open Spree bridges replace the smooth
hero meshes atomically once the block payload is ready, and every other smooth
architectural overlay with a block replacement stays hidden in Minecraft. The
official cloth is the narrow exception: Reichstag and Chancellery keep their
coarse block masts, but no longer carry duplicate static block cloth. Their
German/EU cloth layers remain visible and share the same bounded wind field as
the Flag of Unity, Swiss flag and Federal President's standard over the voxel
city. The older generic Tiergarten-monument rendering of the Flag of Unity is
suppressed while its OSM source key remains retained by the dedicated model.
The light limestone/quartz palette remains inside the fixed 32-colour world
palette; silver, lapis and gold are sparse architectural cues rather than
random decoration. The batches share one cube geometry and material, add no
network asset and contain no transparent or coplanar faces. Existing entrance
portals, open passages and orbit, pan, zoom, flight and pedestrian navigation
remain unchanged. Component-exact masks replace 12 closed Reichstag-portico
records, 188 Kanzleramt leadership-cube records, 1,284 Hauptbahnhof
hall/office records, 52 Gate records, 149 Paul-Löbe rotunda records, 85
Lüders-Haus rotunda records and 40 Lüders-Haus stair records while retaining
courts and neighbours; the new batches therefore include their own rear walls,
floors, facade shells, roofs, glazing and open block railings. Three Creepers,
two bow-carrying Skeletons and three Zombies roam deterministic, tree-cleared
grass routes while Minecraft is active. All eight figures share one instanced
draw call, and the group is removed from Day, Night, Snowstorm,
Schwellenraum, water and underside presentations. A persistent DE/EN control
translates all viewer
chrome; official German place names remain unchanged, and the German UI uses
`Sehenswürdigkeiten` rather than the English false friend.

Minecraft cold start reads the voxel and recognition-prism payloads but not
`surface-polygons.json`. That surface file remains deferred until an actual
transition to a drawn mode or until pedestrian mode requires its water-collision
polygons. A cold Minecraft start also neither constructs nor loads ParkDetails
in either full or touch profile; the first actual switch to any drawn mode
starts their idempotent deferred construction.

In mobile-like touch sessions, the bounded Minecraft profile produces
**845,561 instances / 63.265 MiB of instance buffers** in the committed
benchmark, versus the unchanged full profile's **3,419,412 / 249.815 MiB**.
Only that touch profile omits generic facade panes and meadow flowers and
collapses non-Hero source columns to one body block; all Hero courses no taller
than 8 m, block-native signatures and navigation contracts remain. Its WebGL
renderer has no MSAA and its composer uses zero samples plus `UnsignedByte`
targets and SMAA. Non-touch desktop retains the 4x `HalfFloat` composer. A mode
change before voxel construction cancels the inactive build; any failed attach rolls
back partial roots. Smooth park details stay hidden in voxel mode and therefore
do not receive Minecraft toon-material clones. These are benchmark and
automated-browser contracts, not physical iOS-device validation.

With the tunnel in the production scene, the mobile-like touch ParkDetails
profile keeps every mapped path, official tree and playground anchor in
**107,201 instances and 11,422,846 bytes of geometry plus instance buffers**.
The non-touch settled production profile uses **499,963 instances and
42,937,418 bytes**. The frozen comparison contract excludes both tunnel and
settled detail: its touch fixture is **107,239 instances, 66 drawables and
11,425,374 bytes**, versus the full fixture's **450,038 instances, 1,471
drawables and 39,096,522 bytes**. The touch profile drops texture maps, derived
micro-vegetation and other non-source micro-detail; it does not drop a path or
source anchor.

Mobile-like touch sessions use family-keyed single-world residency: drawn modes
share one family and Minecraft uses another, so a family transition unmounts
the previous scene, parsed payload ownership and WebGL context before mounting
the next. Non-touch desktop retains its warm complete scene. Runtime recovery is
not touch-gated: every profile gets exactly one clean automatic WebGL remount;
a repeated failure exposes the Recovery and 2D-map actions instead of creating
another hidden renderer.

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

Dedicated memorial recognition models supplement the official mesh at normal
selection distances. Repeated Holocaust stelae use GPU instancing, as do the
Soviet colonnade and fine folds of the 2026 Jehovah's Witnesses memorial; this
adds close-range granularity without loading another texture set or creating
thousands of draw calls. Evidence and approximation boundaries are documented
in [`monument-detail.md`](monument-detail.md).

The Goethe- and Lessing-Denkmal are independent source-bound detail roots at
OSM nodes `278738513` and `884700390`. Berlin monument-register parts
`09046318,T,028` and `09046318,T,027`, together with the corresponding
Bildhauerei in Berlin inventories, bind their scale, materials and documented
sculptural programmes; mapped approaches and the current QA views bind their
presentation orientation. Goethe retains the articulated round
Carrara-marble pedestal, east inscription, court-dress figure, the paired
allegories of lyric poetry, drama and scholarship, and the reconstructed iron
enclosure. Its snow-free height is exactly 6.08 m; the detail root includes all
three paired allegory groups/six figures and 42 fence fields. Lessing retains
the white-marble author with book, reddish-granite pedestal, front Genius of
Humanity, rear Allegory of Criticism, Mendelssohn/Kleist/Nicolai reliefs, side
basins and the present simplified protective fence. Drawn geometry, Minecraft
blocks and physical fence collision share one chamfered-octagon outline with
28 visible fields across eight exact segments. Its snow-free height is exactly
7.00 m; the detail root retains five steps, two basins with dolphin spouts,
three portrait fields and both principal bronze allegories. The three
existing Goethe Commons records remain unchanged;
three Lessing front/side/rear files are attribution-only QA evidence with
`photo_bundled:false` and no thumbnail or runtime image path.

Day, Night, Snowstorm and Schwellenraum share the drawn monument models;
Minecraft substitutes separate block-native counterparts and suppresses the
smooth roots. Snow caps are reversible and do not alter the
source anchors. Across Goethe and Lessing, the Smooth Snowstorm model is frozen
at exactly 8 renderables and 24,870 rendered vertices. Minecraft uses one
InstancedMesh containing 557 blocks and 13,368 rendered vertices; the two
representations store 9 renderables together. Schwellenraum protection keeps
the enclosed memorials non-enterable with radii of 4.3 m for Goethe and 2.95 m
for Lessing, while normal pedestrian collision follows each represented core
and its fence-side solids rather than blocking the mapped park paths or any of
the eight sampled approach directions.

The Georg Elser memorial at Wilhelmstrasse is an additional independent
recognition model at OSM sculpture node `1986458966`. Its published 17 m height,
steel material and exact point anchor are source facts; the continuous profile,
three visible steel laminae and pavement-plaque proportions are a
photograph-bounded reconstruction rather than a survey. The inset carries the
complete documented quotation and attribution. A dedicated close camera keeps
the profile and plaque together in frame, while mipmapped lettering disappears
before it can shimmer at overview distance. The model lives in the shared
memorial layer, so Day, Night, Minecraft, Snowstorm and Schwellenraum all
retain it.

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

The newly established CSD memorial place near Bellevueallee and Ahornsteig is
an additional street/monument-detail root, not a replacement for that
owner-supplied model and not a 90th tour sight. Its separate source anchor is
exact OSM node [`14076715427`](https://www.openstreetmap.org/node/14076715427),
about 165 m west of the older point. Bezirksamt Mitte documents the French
maple, protective metal grid and rainbow-coloured bench; current reference
views bound the already leafed young crown, the guard's round segmented form
and a sparse arrangement of small Pride flags, wreaths and cards. These small
offerings remain static. Day, Night, Minecraft, Snowstorm and Schwellenraum all
retain the place and keep it legible. Only the OSM anchor and published
descriptive facts are source-fixed: tree and guard
dimensions, bench offset/orientation and offering placement are local,
photo-bounded display estimates rather than survey measurements. No supplied
or press photograph is bundled, projected or converted into a texture.

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
altering the official base mesh. The TIPI am Kanzleramt retains the published
32 x 26 m auditorium envelope but now uses a photo-bounded eight-peak compound
canvas, 48 batched seam ribs, low dark-timber entrance hall, paired entrance
gables, raised foyer, projecting canopy, ticket booth, planters and distinct
side and rear pavilions. Its 144 warm rib bulbs and restrained night-only
four-colour show wash remain code-native. The fictional golden
`PIGOR & EICHHORN` headline is viewer display text authored by the user/project
owner, not by the venue; its accompanying `NUR HEUTE ABEND` line is likewise
display text, not a claimed current programme. Both lines stay legible in Day,
Night, Snowstorm and Schwellenraum. Minecraft replaces the smooth tent with a
separate coarse block tent and block-letter display for the owner-authored
`PIGOR & EICHHORN` line only, so that line remains present in all five modes
without duplicating `NUR HEUTE ABEND` or the smooth shell. The 42 m Carillon lets
the official photogrammetric mesh carry its four granite pylons and adds 68
individually placed bells beneath a shallow roof cap. Two compact
uniformed figures mark the Chancellery entrance. Selecting `Spreebogen` opens
an unobstructed view of two static, source-bound Berlin passenger-vessel types.
Their 43.10 x 7.00 x 1.29 m and 29.55 x 6.98 x 1.20 m envelopes come from the
operator's fleet data; restrained superstructures sit on committed OSM
waterway axes. These are display placements, not live vessel observations.
Their wakes are static outside Schwellenraum and hidden inside its still scene.
At Humboldthafen the northern OSM bank and DGM crest form a separate sloped
shore instead of a duplicated vertical quay. Hugo-Preuß-Brücke follows OSM way
`26109166`, while the two Sandkrugbrücke carriageways preserve ways `36260393`
and `248010193`. Minecraft carries the same harbour, vessel and railing
identities as one compact block-native instance layer.

Invalidenfriedhof uses a dedicated close-detail layer over the committed
cemetery, terrain and wall evidence. Berlin's monument inventory object
`09010206`, OSM cemetery/path/grave features and the existing official-mesh
ground frame fix the ensemble context. Schinkel's Scharnhorst monument keeps
its pale reliefed sarcophagus, resting bronze lion and open black enclosure;
Job von Witzleben's memorial keeps its green Gothic Revival tabernacle;
Hans Carl von Winterfeld's monument at OSM node `279219439` keeps a pale
rectangular pedestal, unlettered laurel portrait medallion, trophy mantle and
plumed helmet;
Gustav Friedrich von Kessel's low dark grave remains inside a compact Gothic
fence; and the von Rauch family grave retains its ochre four-support arcade and
white cross. These are characteristic procedural recognition forms rather
than replacement survey meshes. Repeated fence bars, relief cues and grave
details share batches and the normal close-detail fade.

The Auguste-Viktoria bell is a separate open structure at OSM node
`7430297888`, associated with official LoD2 building
`DEBE01YYK0001yqp`; its measured building height is 10.044 m. The documented
1.60 m bell diameter and 1.8 t mass control the bell itself; frame, hood and
local-spacing values that lack a published dimension remain reference-bounded
display geometry. The model preserves the open lower steel bays instead of
filling them with a collision box. The
canal-side brick cemetery boundary and the surviving concrete
Hinterlandmauer fragments likewise remain separate structures rather than one
generic perimeter wall.

The Gedenkstätte Günter Litfin is independent of the cemetery group. OSM way
`31347999`, Berlin monument object `09040270,T,010`, LoD2 object
`DEBE01AL1pC0000R` and the responsible foundation's documentation anchor the
former Führungsstelle Kieler Eck. LoD2 supplies the 8.946 m measured building
height. Its procedural signature includes the square concrete shaft, small
lower wall openings, upper window band, projecting slab roof and guard rail;
uncited opening, plaque and information-board proportions remain
visual-reference estimates. Collision is attached only to represented solid
parts, so adjacent public paths and the information area stay open.

All of these details remain static in Day, Night, Minecraft, Snowstorm and
Schwellenraum. Minecraft uses separate block-native replacements for the bell,
tower, graves and wall signatures rather than leaking the smooth close layer.
Repeated members are instanced or consolidated, and the fine layer fades
before sub-pixel shimmer can appear. Supplied photographs only bound
recognisable proportions and materials: no photograph is bundled, projected
or converted into a texture.

The Berliner Ensemble retains the complete four-part Berlin LoD2 parent
`DEBE01YYK00004vY`; the measured shells remain visible and authoritative. Its
dedicated drawn layer is limited to thin overlays on the exact exposed wall
runs: current stripped warm-grey plaster, lower and upper arched opening
rhythms, the shallow corner entrance with polished-granite columns, the
truncated dark roof cap and a photo-bounded open two-line roof ring reduced
from 7 m to 4.8 m diameter. It neither adds a replacement envelope nor
reconstructs the exterior ornament removed in 1953–54. The sign completes one
slow rotation every 120 seconds in Day, Night, Snowstorm, Minecraft and
Schwellenraum. One shared bounded update gate caps motion at 12 Hz without
touch or 8 Hz in the mobile-like touch profile; reduced-motion, hidden,
distant, off-screen and underside views hold it still without accumulating a
different transform. The focus preset faces the public elevation from
Bertolt-Brecht-Platz.

Dedicated public-art geometry owns OSM nodes `988668382` (Bertolt Brecht) and
`13841652635` (Helene Weigel), so the generic monument layer cannot duplicate
either work. Fritz Cremer's seated bronze Brecht is now read as a complete
body on an open metal chair at the centre of the documented six-metre circular
sett platform, with three segmented dark steles around it. The current
`Eine Skulptur für Helene Weigel`, unveiled on 10 May 2026 in the
Helene-Weigel-Hof, is represented as a non-classical accessible glass vitrine:
red director's chair and object field, white light/audio bars, a procedural
black halftone-glass portrait and plinth grilles. These are code-native,
source-bounded recognition forms rather than surveyed sculpture meshes; the
Berliner Ensemble press photographs are reference-only and no photograph or
portrait texture is bundled. Snow is limited to separate upper accents.
Minecraft adds one instanced draw-call building signature bound to the same
four LoD2 parts: a block-native taupe tower, stepped hipped roof and the same
smaller rotating open red ring with restrained two-line lettering cues. The
smooth facade, torus and texture-backed text remain outside that mode.

The task-10 recognition layer covers the expanded edges without pretending to
be survey geometry: Hamburger Bahnhof/Rieckhallen and the historic
Landessozialgericht; Europacity/KPMG and an explicitly approximate DKB project
massing; Kulturforum, `berlin modern`, the Henry Moore sculpture and
Tilla-Durieux-Park; Anhalter Bahnhof, Charlottenburger Tor, the Spanish Embassy,
Café am Neuen See and the WELT balloon. All placement anchors come from the
committed LoD2/OSM/landmark frame. Drawn labels and silhouette accents remain
supplements to that evidence, never substitutes for it.

The Pariser-Platz and Potsdamer-Platz architecture keeps the same boundary.
Four civic frontages now receive separate code-native recognition facades
without replacing the measured LoD2 bodies or their navigation collision. The
Max-Liebermann-Haus follows LoD2 parent `DEBE01YYK0000765` and OSM way
`131487807`: its calm three-storey critical reconstruction adds narrow punched
windows, restrained ashlar/cornice courses, one small balcony and an attic
register. The French Embassy follows LoD2 parent `DEBE01YYK00009wl` and OSM
relation `3203772`, with a roughened base, double-height Bel Etage, layered
upper register and 6.15 m covered Rue de France. The US Embassy follows LoD2
parent `DEBE01YYK00000k5` and OSM way `195257482`, distinguishing the deep-set
limestone grid, cylindrical entrance niche, shallow glass canopy and softly
lit rooftop State Room lantern. The Akademie der Künste follows LoD2 parent
`DEBE01YYK00007H6` and OSM way `237816189`, using a transparent glass curtain
wall, visible circulation, suspended 0.4 m facade-trace frame and leaf-toned
roof glazing. These four static close overlays share twelve batched body,
lamp and ink drawables, fade before overview shimmer and carry no photographic
maps. Day, Night, Snowstorm and Schwellenraum use the drawn layer; Minecraft
uses one opaque, texture-free block batch over the retained source voxel
masses.

The Center / former Sony Center retains its LoD2 glass-and-steel envelopes.
The Forum roof follows the 24-part OSM plan and Arup's published ring/support
dimensions: translucent membrane/glass fields meet an oval lattice truss,
central opening ring, radial cables, lower stays, tilted kingpost and seven
supports. Close granularity adds 97 field clamps, twelve upper ridge and
twelve upper valley cable runs, 48 junction nodes and 24 restrained soffit
lights. Around it, 28 curved facade bays carry six glazing registers, 196
horizontal stainless rails, 84 vertical mullions, 28 full-height entrance
fields, 28 parapet caps and 28 warm-red fins. A separate reflecting pool adds
a 48-piece fountain rim and twelve restrained jets. Membrane curvature and
uncited local spacing remain bounded presentation reconstruction rather than
a survey, and no reference photograph is bundled.

Hotel Adlon remains bound
to Berlin LoD2 building `K00006ot`, while OSM relation `4582978` and outer way
`26041943` fix its real 68.78 m, 5.07-degree Pariser-Platz frontage. Its
source-bounded recognition layer distinguishes five high ground-floor arches,
rustication, the central wine-red entrance canopy, varied window registers,
wrought-iron balcony bands, a patinated stepped mansard with dormers and flags,
and open `HOTEL ADLON` roof lettering. Starbucks Pariser Platz remains a tenant
detail rather than a second building shell: OSM node `66917229` binds two
shallow dark-glass storefront overlays to the south-west corner of LoD2 body
`K00005Hq`, each with a restrained grey facade wordmark. Freestanding black
umbrellas, furniture and planters replace the former invented green fascia and
attached awning. Day, Night, Snowstorm and Schwellenraum share static geometry;
Minecraft uses one additional coarse, opaque block batch for both identities.
Four openly licensed Wikimedia reference files are pinned and publicly
attributed, but no photograph is bundled or projected as a facade texture. The
French, British and Hungarian embassy overlays are
anchored to their respective LoD2 buildings and add only their defining public
facade features: French Bel-Etage openings and Rue de France, the British
screen/collage and green roof, and the Hungarian glazed base, stone wings and
roof flag. No photograph is projected or bundled as a texture.

Hafenplatz 6–10 uses all 26 official LoD2 bodies as the metric envelope. Its
dedicated Terrassenhaus layer then adds four descending terrace arms, long
horizontal bands of individually varied glazing, ochre frames/mullions/sills,
exposed-aggregate spandrels, courtyard loggias, louvres and segmented parapets.
The same deterministic material and night-window logic is shared by Day,
Night and Snow rather than baking the owner photographs into a texture.

At Potsdamer Platz, the two station entrance halls remain separate structures
on their exact LoD2 footprints and official heights. Each is a semi-open
steel/glass hall with a 10 × 6 roof grid, cross braces, open fronts and its own
stair/escalator pair; only the subterranean distribution geometry remains
explicitly schematic.

Between Paul-Löbe-Haus and Marie-Elisabeth-Lüders-Haus, LoD2 part
`DEBE01YYK0001zDa` no longer renders as a closed river wall. The lower public
Marie-Elisabeth-Lüders-Steg follows OSM way `30596778` over its full route with
a photo-bounded shallow bow. The upper Jakob-Maria-Mierscheid-Steg follows the
62.606 m LoD2 envelope and the Bundestag's published approximately 62 × 3 × 10
m dimensions as a slender open frame. The MELH river front adds its circular
opening, canopy on slim supports and the widening 48-step stair from OSM way
`1393129898`. Minecraft suppresses only the 16 false bridge-prism columns and
eleven coarse ground-deck cells; adjoining building columns remain intact.

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
labelled as surviving prison survey geometry. The visible boundary itself uses
the exact 22-point OSM ring and four mapped polygonal wall traces with openings;
it stays entirely west of Heidestraße, at least 17.29 m from the mapped B96
centreline. At Floraplatz, exactly eight
OSM-positioned granite plinths carry differentiated bronze deer, bison, elk,
bear and bull silhouettes. The duplicate generic Bison node at the same
eastern plinth as `Liegender Bison II` is the only suppressed record.

The Adlerbrücke and Löwenbrücke are dedicated metre-scale recognition models,
replacing their former generic park-bridge marks rather than overdrawing them.
For the Adlerbrücke, OSM way `28872983` fixes the centre and bearing while the
official Masterplan Brücken Berlin inventory (data status 06/2025) controls the
7.30 x 3.35 m structure. Its flat steel span, yellow-brick abutments, fourteen
wavy railing bays and two large central cast-iron eagle reliefs follow the
current CC BY-SA reference views; older conflicting dimensions are retained in
the model metadata but do not control the drawing.

For the rebuilt Löwenbrücke, OSM way `1411957328` fixes the plan alignment. The
same inventory records the 2025 structure at 18.30 x 1.88 m, while the engineers
publish the complementary 26.80 m overall length, 17.60 m main span, 0.80 m
timber-superstructure depth and four 31.3 mm open spiral ropes. The official
monument record controls the pale-yellow longitudinal timber deck, bronzed
lions and pale sandstone bases. Nine truss bays, the four inward-facing lions,
suspension cables and hangers are joined by the documented modern steel-rope
handrails and mesh safety fields. Exact sculpture, mesh pitch, railing and
joinery dimensions remain labelled photo-bounded reconstruction, not survey
geometry. Both silhouettes remain visible at distance; only their fine ink,
posts and wire mesh use the shared hysteretic fade.

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

The optional fused park-detail request is deliberately non-blocking: a failed
`park-details.json` request raises a warning but never delays or disables the
23 official base meshes. When present, schema 7 batches park paths into nine
source-resolved material groups while retaining every committed OSM vertex and
an individual centimetre width per way. Small deterministic metre-scale tiles
show setts, paving joints, loose fine gravel, compacted aggregate, sand, earth,
timber, metal and asphalt without adding or moving a route; Minecraft reuses
the same maps on its toon materials and a mode round-trip restores the exact
Day material. Tree trunks, fork branches and species-resolved crowns are
instanced. The current
task-13 payload additively fuses 25,305 official catalogue trees with unmatched
OSM evidence into 45,540 visible trees. In the Großer Tiergarten, all 13,156
official tree points retain their published height, crown and trunk dimensions
where present, including the measured 35 m height, 12.5 m crown-radius and
1.426 m trunk-radius extremes. Oaks,
willows, pines/larches, firs/spruces, poplars, birches/robinias, limes/elms,
maples/planes, beeches/chestnuts, orchard trees and shrubs receive distinct
profiles, branching habits and bounded species-informed colour registers while
their published positions and dimensions remain unchanged. In addition, 83
mapped Tiergarten scrub polygons carry 3,535 deterministic bush clusters and
23 mapped hedge objects preserve 1,099.2 m of line courses plus 526.8 m² of
area hedges. These exact OSM outlines remain source geometry; the individual
foliage clumps and missing hedge dimensions are marked display approximations.
The always-loaded
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
full Minecraft instances during Day/Night/Snow/Schwellenraum startup. Neither the 2.6M-face
interaction GLBs, the 6.6M-face archival surface nor hero crops are requested
for normal drawn navigation. On non-touch desktop, the interaction shell is
ordered by distance and loaded with bounded concurrency only when an underside
cutaway needs context or the requested drawn world has failed. Mobile-like touch
sessions never load that legacy photogrammetric shell for underside or failure;
they keep the authored cutaway/network presentation and explicit recovery UI
instead.
Model requests retry once, while JSON requests additionally have a finite
timeout. The settled tier and all hero assets remain in the reproducible local
archive but do not consume normal live bandwidth or GPU memory.

A WebGL runtime failure in any profile releases the canvas and active world,
then performs exactly one clean automatic remount for that world family. A
repeated failure exposes the Recovery and 2D-map actions instead of allocating
another hidden renderer or selecting 2D implicitly. In mobile-like touch
sessions, both a drawn/Minecraft family transition and an explicit move to the 2D map unmount the
inactive WebGL world; non-touch desktop keeps its complete scene warm. Static
scenes hold the final framebuffer without a periodic redraw. Existing GLB normals are
reused, repeated tunnel fixtures are instanced, and a stale mobile hero queue is
stopped and disposed after a new landmark selection. Disposal also stops
workers before they start another queued GLB, closes decoded image resources
where the browser exposes them and resets custom touch state on lost pointer
capture, global pointer release, window blur or tab hiding. A watchdog restores
controls after a stale three-finger sequence, while finite camera bounds recover
a lost pose.

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
