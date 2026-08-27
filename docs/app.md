# Web viewer

React + TypeScript + Vite with two complementary static engines, managed with
`bun`:

- **Three.js true 3D:** procedural Berlin LoD2/OSM geometry, progressively
  loaded and freely orbitable from above and below.
- **OpenSeadragon detail map:** the 16384×11616 DZI remains the fast,
  high-resolution cartographic fallback.

The hosted build keeps that full pyramid. Release archives intentionally omit
only its redundant top level and ship an 8192×5808 DZI fallback alongside the
6144×4356 double-click overview. Both forms carry the same compact procedural
JSON scene and no retired GLB or road-plate assets.

Required attribution overlay in the viewer chrome. The viewer ships the
required minimum (OSM + Geoportal Berlin) **plus** the Wikimedia visual-
reference clause, because the bundled tiles use Wikimedia references
(see `NOTICE.md`). This is the exact string in `src/app/src/App.tsx`
(`ATTRIBUTION`); keep the two in sync, and never drop the leading
OSM + Geoportal Berlin minimum:

```
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia
```

When Google Photorealistic 3D Tiles are enabled (opt-in), additionally
show the Google attribution required by the Google Maps Platform Terms.

## Keyboard shortcuts & help

The viewer has a built-in help panel (the keyboard button in the top
toolbar, or press `?`) listing the shortcuts: `PageUp`/`PageDown`
previous/next sight, `+`/`=`/`−` zoom, `Home`/`0` overview, `M` toggle
Minecraft, `P` toggle pedestrian mode, `N` toggle night lights, `F` fullscreen,
`R` reset, `B` ambient
music, `T` Dusk Republic, `L` copy
a view link, and `Esc` close overlays. In the 2D detail map, `Space` controls
the tour and `D`/`S` switch Day/Night and Snowstorm; those keys become movement
controls in 3D. `Alt`/`Option` plus arrows remains a
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
`W`/`A`/`S`/`D` flies forward/left/back/right relative to the current heading,
`Space` rises and `Shift` descends. The mouse wheel zooms at the pointer.
`Alt`/`Option` plus left/right orbits and plus up/down tilts. The
lit Tiergartentunnel is entered manually through either connected road portal;
there is no scripted tunnel ride competing with direct camera control.
Pedestrian mode keeps both complete tunnel tubes and all eight mapped portal
courses continuously open in Day, Night, Minecraft, Snowstorm and Schwellenraum.
The rendered tube shells have open longitudinal ends, and the exterior mouth
shadow is removed as soon as the pedestrian enters, so neither a segment joint
nor a portal can become a transverse wall on the route.

Pedestrian mode is an independent navigation layer over all five visual modes.
It starts at a 1.80 m eye height above the exact walkable point currently under
the orbit/free-camera focus and keeps the live heading and pitch. If that focus
is outside the world, the camera ground point is tried; the established default
spawn is used only when neither live point is valid. The focus height is kept
as a tunnel-aware ground hint, so switching modes inside a tunnel does not lift
the walker to the road above. Pedestrian mode disables
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
through the same terrain, tunnel and water checks. One `Space`, the touch-safe
jump button or a double-tap on the free 3D view produces the normal ground jump
with a 6.2 m apex. A second `Space` within 320 ms raises that same jump once to
a bounded 10.5 m apex; further airborne presses cannot stack height. The relaxed
mobile double-tap still rejects drags, pinches and long presses. A mapped OSM
water polygon is a
solid shoreline: movement slides along it and never teleports or resets the
pedestrian. Islands encoded as water holes remain walkable. The mode does not
move source geometry. The five
historic Brandenburg Gate passages are explicit, source-scoped voids in Day,
Night, Minecraft, Snowstorm and Schwellenraum; all twelve columns, the lintel
and both side pavilions remain solid. Schwellenraum adds only its further
bounded doorway, interior-wall and floor collision contracts; every other
building remains the same closed solid.

**Continuous navigation:** held plain arrows pan in screen space; held WASD
flies along the current heading, `Space` rises, `Shift` descends, and held
`Alt`/`Option`+arrows orbit and tilt. The matching on-screen arrow controls also move continuously while
the primary mouse button stays down, and desktop layouts expose an analogue
orbit pad beside the control panel. In the 2D detail map, a plain `Space` tap
still toggles the sight tour.
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

Schwellenraum reuses the complete Day geometry and crossfades the two normal
audio layers into a dedicated, very quiet procedural soundscape. Its two
existing audio controls independently fade a soft room-rustle bus and a sparse
harmonic bus; leaving the mode restores the standard layers without losing
either user choice. Lower descending roots alternate minor and unresolved
suspended intervals. A dusty mauve sky and a material-integrated lavender
split tone desaturate ordinary city surfaces without a render target,
full-screen pass or extra draw call. The grade is a lazily cached material
variant: leaving the mode restores the exact Day material and protected
memorial subtrees never receive it. Buildings are never warped. It shares the
all-mode official-civic flag
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

Ordinary startup now installs only two empty Schwellenraum roots. The mode's
interiors, furnishings and eight light thresholds are constructed on first
entry; the former 128 threshold renderables are consolidated into 24 using
three shared materials. The full layer stays below 3,000 source vertices and
the coarse-pointer profile below 1,800. Static motes use one instanced mesh per
site, while frames and veils are each batched, so richer atmosphere does not
turn into hidden startup residency or hundreds of draw calls.

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

A fresh browser load advances between Reichstag, Bundeskanzleramt,
Hauptbahnhof and Siegessäule. The Reset command still focuses the Reichstag
from an elevated camera over the Platz der Republik lawn in Day mode. Explicit
landmark deep links override the rotating startup choice. The zero-server
fallback keeps its static default.

**Day is a drawn isometric city**: prisms are extruded from authoritative LoD2
footprint polygons plus a
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
Gate, memorials, TIPI, Carillon…) remain visible on top of the prisms. The
camera FOV narrows from 39°
to 30° in this mode to flatten the view toward a true isometric look.
Night and Snow relight the same drawn city; Minecraft uses its separate voxel
world. If the requested world fails, the viewer performs one clean procedural
remount and then exposes Recovery and 2D-map actions.

The Sozialgericht Berlin is a dedicated source-bound recognition group rather
than part of the kilometre-wide expanded-city batch. OSM way `423490503`
anchors its 58.038 m public street-side site boundary; the parallel 48.905 m
facade wall, 15.392 m risalit, body and collision authority come from LoD2
object `DEBE01YYK0002Qys`. Six supplied facade photographs guide only
procedural proportions and ornament: no photo, canvas, derived crop or texture
is bundled or requested at runtime. Its full and touch profiles retain the
same footprint, 11-axis order, roof silhouette and focus target while reducing
repeated masonry detail. Minecraft keeps the complete source mass and applies
its block-native front only inside a shallow wall-edge recognition strip,
preserving the courtyards and rear wings.

The ordinary Day/Night/Snow/Schwellenraum cold start reads only the procedural
LoD2, terrain and bounded surface JSON needed by that world; the complete
Minecraft instances remain lazy. Retired GLBs and the pretriangulated road
plate are absent from the repository, build and offline package.
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
exact 420 LoD2/OSM buildings on the main thread. Its Worker retains exact
geometry for the nearest 9,000 source buildings and represents every farther
building as one measured, oriented, source-coloured instance shell. The desktop Worker
receives immutable URLs for the prism, ground and surface assets instead of a
second structured clone of three decoded world graphs. It fetches and parses
those assets off the main thread, sends the permanent distant shell followed
by two compact near-field previews, and then replaces those previews with
bounded spatially partitioned exact districts.
Their transferred bounding spheres avoid a fresh main-thread geometry scan and
allow Three.js to cull off-camera districts as units. The nearest deferred exact
district is posted before terrain and surface decoding. The mobile-like touch
profile applies when the primary or any pointer is coarse, or the browser
reports `navigator.maxTouchPoints > 0`; it constructs an initial 160-building frame and stops
after exact geometry for the nearest **3,600 LoD2 buildings**. Every eligible
source building beyond that near field remains visible as a measured, oriented,
source-coloured instance shell. Both profiles retain the complete ground, the
complete building inventory and every one-off recognition model.
Non-touch desktop's Worker supplies all eight exact surface families. The touch
profile's delayed Worker receives only the source URL and initial count. It
fetches the source directly, transfers the single-draw-call distant shell first,
then the 4,680 remaining exact near-field records, without a second copy of the
city/ground/surface payload, and creates no exact `surface-*` batches; the
preview's raster ground, water and
asphalt plus the complete ParkDetails path network retain the context. Park
construction starts only after that Worker completes or fails. Hiding the page
stops the Worker, disposes partial follow-up groups and restarts deterministically
when visible. Every transferred typed geometry buffer changes ownership rather
than being JSON-serialised, and each batch receives the active Day, Night, Snow
or Schwellenraum materials before attachment. Entering Minecraft likewise stops
the hidden Worker and disposes its completed follow-up groups. A Worker or asset
failure never invokes the old synchronous full-city build.

Both profiles retain raster asphalt rather than duplicating the OSM road union
as paving, asphalt and kerb meshes. The Worker transfers water, park, sand,
earth, wood, metal and source lane-marking families, splitting large park
families into bounded chunks; ParkDetails supplies the complete authored path
network. On the warm v0.72.31 production benchmark, every source-building
silhouette is present after about 1.6 seconds, exact refinement settles after
about 4.87 seconds, repeated main-thread attachment is about 2.5 ms p95,
conservative peak RSS is 971.3 MiB and steady geometry is 85.9 MiB across 199
estimated draw calls and 5,778,033 vertices. The v0.72.30 baseline measured
1,134.1 MiB peak RSS and 106.8 MiB geometry with the same complete building
inventory.

Every underside view keeps the authored tunnel/network geometry. Optional park details wait until the first
usable city frame in a drawn presentation. Core JSON transfers have a finite
timeout, one retry and unmount cancellation.

**Minecraft is a true voxel world**: switching in lazily loads
`mesh/regierungsviertel/minecraft-voxels.json` — generated by
`isometric_berlin.generation.build_minecraft_voxels` from authoritative LoD2
footprints plus the non-overlapping OSM context sidecar (533,329 logical
building columns on a 4 m grid, stepped roofs for gabled/hipped roof forms),
OSM water/roads/plazas as
run-length ground slabs, and the official tree points as trunk+crown cubes.
The block world replaces the drawn LoD2/OSM city while active. Outside the
official payload grid, an explicitly marked extrapolated
block surround carries the same versioned 6,450 m envelope, park bands, tree
and lamp positions as Day and Night; it does not claim new surveyed geometry.
GPU instancing keeps the complete world to a handful of draw calls. An opaque
mode-coloured curtain stays in place until the block world is usable. A failed
payload uses the same single-remount recovery contract as the drawn world. Leaving
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
floors, facade shells, roofs, glazing and open block railings. Four Creepers,
three bow-carrying Skeletons and six Zombies roam deterministic, tree-cleared
grass routes on desktop while Minecraft is active; the mobile profile uses
three, two and five respectively. A shared rotated protection envelope
rejects voxel trees and every mob spawn or movement cell throughout the
Holocaust Memorial, including a conservative edge clearance. The same
walkability keeps four desktop or two mobile loot boxes out of the protected
field. Each box opens once on pedestrian contact with a fixed 1.35-second,
instanced firework and no private animation loop. Each mob profile remains one
instanced draw call, and both groups are removed from Day, Night, Snowstorm,
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

The source-anchored recognition layer now distinguishes the western presentation
area as architecture rather than generic LoD2 mass. Europa-Center,
Allianz-Haus, the historic Café Kranzler and New Kranzler Eck, Bahnhof
Zoologischer Garten, Kaiser-Wilhelm-Gedächtniskirche/Breitscheidplatz and
Urania retain their OSM/LoD2 footprints while procedural, texture-free batches
add the characteristic facade, tower, roof, rotunda, hall and podium cues.
The Europa-Center's 86 m office slab now carries all four dark curtain-wall
faces with equal grey spandrel courses, dense aluminium mullions, a recessed
entrance base and the adjacent mast. Its ten-metre Mercedes star has one hub
and exactly three radial spokes and reaches the documented 103 m overall
height. OSM part `26408381` anchors the separate 69.41 x 18.30 m
Breitscheidplatz frontage: two opaque base storeys support three turquoise
glass office storeys, cantilevered edges and code-built red `RBB` / `94.3`
roof signs. The two supplied photographs bound colour, facade hierarchy,
sign position and the static star pose only; no photograph, logo file, font or
texture is bundled or loaded.
The Gedächtniskirche ruin now reads as weathered masonry rather than a generic
tower block: a genuinely empty lower arch crosses the complete footprint, the
gold clock has twelve marks and two hands, three tall belfry arches sit between
corner turrets, and the 71 m silhouette ends in an asymmetric green-grey broken
crown. The supplied portrait photograph bounds those recognition proportions
only; the official ensemble description supplies the surviving 71 m height
from the original 113 m tower, and no photograph, crop or texture is bundled.
The neighbouring 53.3 m, six-sided bell tower keeps its 12 m diameter, dense
blue concrete-glass grid, broad bell-chamber band and gold 5.3 m pole / 1.8 m
cross hierarchy from the official building description. The four merged City
West groups use 11 renderables / 25,816 vertices in full and 11 / 16,739 in the
coarse-pointer mobile profile, within fixed 26,100 / 16,900-vertex caps. Mobile
retains 17 rows on the principal Europa-Center facades while coarsening
secondary faces and mullions.
Friedrichstadt-Palast likewise receives its documented main body, taller stage
tower, projecting foyer, broad stairs, concrete fins and two-storey coloured
concrete-glass fields. The exact Tränenpalast outline remains separate from the
station as a low steel-and-glass pavilion; its three false opaque source prisms
stay suppressed. Full and coarse-pointer paths choose distinct bounded detail
profiles, and no photograph or canvas texture is constructed or fetched.
Together the two buildings use 8 renderables / 439 instances / 5,329 stored /
16,873 rendered vertices in full and 8 / 393 / 3,477 / 13,365 in the
coarse-pointer mobile profile.

The ten-metre Beethoven-Haydn-Mozart monument keeps its exact Tiergarten anchor
but now uses the documented rounded granite base, three-sided corner-chamfered
Pentelic-marble pavilion, three 1.56–1.70 m white-marble half figures in
round-arched niches, pilasters, masks and instruments, lyre-bearing swans,
scaled gilded cupola, pinecones and three putti carrying a laurel wreath.
Published dimensions and iconography remain explicit metadata; uncited local
subdivision is labelled procedural recognition geometry.
The complete monument is exactly 10.00 m high and stays at 30 renderables /
2,847 stored / 7,137 rendered vertices. Its dedicated elevated southern focus
keeps the niches, figures and cupola clear of the dense Tiergarten canopy. The
shared protection excludes every tree, mob and loot spawn from the field.
Outside it, deterministic retention keeps two thirds of eligible voxel trees
in full and one third on mobile; the single mob draw call uses 158 parts for
the 4/6/3 full field or 120 parts for the 3/5/2 mobile field.

The earlier pre-retention Minecraft benchmark measured **845,561 instances /
63.265 MiB of instance buffers** on mobile and **3,419,412 / 249.815 MiB** in
full. The current streamed 1/3 and 2/3 tree retention makes those figures
conservative upper bounds; the small mob and loot batches remain separately
fixed.
Only that touch profile omits generic facade panes and meadow flowers and
collapses non-Hero source columns to one body block; all Hero courses no taller
than 8 m, block-native signatures and navigation contracts remain. Every WebGL
profile has no renderer MSAA and uses zero-sample `UnsignedByte` targets plus
one final SMAA pass. A mode
change before voxel construction cancels the inactive build; any failed attach rolls
back partial roots. Smooth park details stay hidden in voxel mode and therefore
do not receive Minecraft toon-material clones. These are benchmark and
automated-browser contracts, not physical iOS-device validation.

With the tunnel in the production scene, the mobile-like touch ParkDetails
profile keeps every mapped path, official tree and playground anchor in
**107,199 instances and 11,639,110 bytes of geometry plus instance buffers**.
The non-touch settled production profile uses **499,952 instances and
44,062,710 bytes**. The frozen comparison contract excludes both tunnel and
settled detail: its touch fixture is **107,237 instances, 72 drawables and
11,641,638 bytes**, versus the full fixture's **450,029 instances, 1,478
drawables and 40,221,966 bytes**. The touch profile drops texture maps, derived
micro-vegetation and other non-source micro-detail; it does not drop a path or
source anchor.

Mobile-like touch sessions use family-keyed single-world residency: drawn modes
share one family and Minecraft uses another, so a family transition unmounts
the previous scene, parsed payload ownership and WebGL context before mounting
the next. Non-touch desktop retains its warm complete scene while it remains
inside live 3D; switching to the DZI map releases WebGL on every device. Runtime recovery is
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
suppressed and stays soft. Minecraft
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

The Richard-Wagner-Denkmal is a third independent Tiergarten detail root and
the 90th navigable sight. OSM node `243487615` is the exact plan anchor;
Landesdenkmalamt Berlin part object `09046318,T,041` binds the official
monument identity. The corresponding LoD2 object `DEBE00YYSR00009n` /
`SR00009n` is interpreted as evidence for the protective-shelter footprint,
not as a closed occupied building. Its prism is therefore excluded from the
drawn city and its six false solid voxel columns are excluded from Minecraft.
The dedicated recognition layer instead keeps the front, rear and side
approaches and the space below the shelter open while granular collision is
limited to its authored marble masses and steel canopy posts.

Day, Night, Snowstorm and Schwellenraum share the texture-free smooth Wagner
root; Minecraft hides it and substitutes one block-native root. Reversible
snow affects only the smooth exposed surfaces. The frozen smooth budget is
exactly 6 renderables and 12,167 rendered vertices; Minecraft is exactly one
batch containing 514 blocks. The OSM position, official register identity and
published six-metre overall / 2.7-metre seated-figure dimensions are source
facts. The local sculptural segmentation, canopy section, component spacing,
presentation orientation and collision volumes are code-authored display
reconstructions rather than surveyed geometry. The Commons category remains
visual QA evidence only: no photograph, thumbnail, crop, tracing or
photographic texture is bundled or loaded by the viewer.

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
owner-supplied model and not a catalogued tour sight. Its separate source anchor is
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

The four hero landmarks carry metre-scale recognition models over their exact
LoD2/OSM anchors. The Reichstag combines its four corner towers and west portico
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
references rather than surveyed fixture measurements. Hauptbahnhof exposes the
321 m glass roof, 180 x 42 m crossing hall and 46 m office bridges. Inside the
crossing hall, one shared five-level contract ties the upper Stadtbahn deck,
upper gallery, main concourse, lower gallery and deep north-south platforms to
their visible elevations around the daylight slot. Six cross bridges, panelled
glass rails and Y-shaped supports clarify the section. Four cylindrical glass
lift shafts span every level and carry repeated ring frames, five landing-door
sets and transparent cabins at different floors. These repeated details are
instanced, and the supplied interior photographs remain non-bundled visual
references rather than textures or surveyed plans. The Brandenburg Gate keeps its published
62.5 x 11 x 26 m envelope, twelve Doric columns and articulated bronze-green
Quadriga. These models sharpen silhouettes without replacing or moving the
aligned metric building bodies beneath them.

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
altering the metric base city. The TIPI am Kanzleramt retains the published
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
without duplicating `NUR HEUTE ABEND` or the smooth shell. The 42 m Carillon
keeps four granite pylons and adds 68 individually placed bells beneath a
shallow roof cap. Two compact
uniformed figures mark the Chancellery entrance. Selecting `Spreebogen` opens
an unobstructed view of two static, source-bound Berlin passenger-vessel types.
Their 43.10 x 7.00 x 1.29 m and 29.55 x 6.98 x 1.20 m envelopes come from the
operator's fleet data; restrained superstructures sit on committed OSM
waterway axes. These are display placements, not live vessel observations.
Their wakes are static outside Schwellenraum and hidden inside its still scene.
At Humboldthafen the northern OSM bank and DGM crest form a separate sloped
shore instead of a duplicated vertical quay. Hugo-Preuß-Brücke follows OSM way
`26109166` and the official 88.41 x 23.56 m inventory envelope. Its curved,
single-span steel box now carries 32 recessed pale fascia fields, a 3.3-4.1 m
dark structural depth, limestone-clad end walls, 60 railing pickets and four
`Hugo-Preuß-Brücke 2004` end plates while remaining free of any river pier.
Gustav-Heinemann-Brücke follows OSM way `15405394` and its official 87.76 m
length. Max Dudler's published 5 m overall width and 2.25 m height control two
pale-sage Vierendeel frames around the 4 m timber path and two rectangular
bank supports. The two Sandkrugbrücke carriageways preserve ways `36260393`
and `248010193`. Berlin's June-2025 bridge inventory fixes its current 32.6 x
28.8 m envelope and identifier `BW 3446035`; the engineer's published design
dimensions fix the recognisable five-stem steel frame, 21 m clear span, 18.7 m
roadway, 1.28 m structural depth and four lamp masts. The authored frame spans
the water without a centre pier and adds cross girders, abutments and a fine
three-level rail inside the existing merged bridge layer. Minecraft carries
the same harbour, vessel and railing identities as one compact block-native
instance layer.

Immediately north of Sandkrugbrücke, the Federal Ministry for Economic Affairs
keeps five exact LoD2 source parts. Prism `yAAWS2KQ` is the long replacement
wing parallel to the Berlin-Spandauer Schifffahrtskanal; prisms `K0000EU2` and
`K0000B4S` are the two retained Invalidenhaus side wings. The dedicated layer
does not replace those envelopes. It adds a five-storey canal grid with 44 bays
and 220 panes, court-side ribbon grids, two framed east-end entrances, warmer
historic stone bands, cornices and 114 historic windows. Only the two retained
wings change from the undifferentiated LoD2 roof code to the OSM-supported red
hipped-roof reading. Bodies, emissive panes and ink are merged into three
renderables. Minecraft adds 78 pale-mullion/glass cues to the existing single
Humboldthafen instance mesh rather than opening a new draw call.

Six bounded facade-detail zones strengthen the street walls at Pariser Platz,
Leipziger Platz, Breitscheidplatz, Platz der Republik, Europaplatz and
Washingtonplatz. Exact LoD2 wall midpoints, heights and outward normals select
only nearby front-facing walls; distance and orientation reject courtyard and
rear elevations. The current source data yields 128, 292, 156, 74, 107 and 7
qualifying wall fields respectively. Their paired window-head lines share the
existing facade line batch, add no renderable and inherit every drawn visual
mode rather than spawning six new landmark systems.

At Tiergarten, OSM way `25999445` remains the exact rhomboid plan of the
Konrad-Adenauer-Haus. Its former opaque generic prism is suppressed only for
that source key. A transparent four-storey climate-buffer envelope now reveals
the source-described six-storey elliptical ship-like timber body, 18 m glass
eaves, two stepped upper decks and a 0.65 m travertine plinth. The published
6,300 m² usable area remains metadata; inner subdivisions are bounded
recognition geometry, not a surveyed interior, and no political lettering is
rendered.

Weidendammer Brücke is centred and aligned on exact OSM bridge way `6228081`.
Berlin's June-2025 bridge inventory controls the current 69.48 x 25.17 m
envelope; Landesdenkmalamt object `09030074` controls the three openings, two
granite-clad river piers and protected ornamental system. The close layer owns
exactly one neo-Baroque railing system, two forged midspan eagle reliefs and
eight lamp standards instead of stacking another ornament set over the older
bridge. The railing also carries a deterministic present-day love-lock field:
192 instances in the full profile and 96 on mobile, explicitly not a current
lock-by-lock survey.

Day, Night, Snowstorm and Schwellenraum share five smooth renderables; full
uses 46,568 stored / 90,116 rendered vertices and mobile 32,744 / 54,404.
Minecraft hides the smooth ornament and substitutes one batch with 344 blocks
/ 8,256 rendered instance vertices in full or 224 / 5,376 on mobile. The close
camera uses 82 m. Fine locks fade before overview scale; the deck, pavements
and approaches stay walkable while represented rails, lamps and eagles remain
solid. Biermann's cultural association with the bridge eagle is retained only
as metadata: the viewer reproduces no song lyric, photograph, plan or texture.

Invalidenfriedhof uses a dedicated close-detail layer over the committed
cemetery, terrain and wall evidence. Berlin's monument inventory object
`09010206`, OSM cemetery/path/grave features and the existing official-mesh
ground frame fix the ensemble context. Exact OSM node `273120316` anchors
Scharnhorst's monument. The Berlin-Lexikon supplies its published 5.60 m
overall height; the Schinkel portal supplies the form/material, authorship and
conservation-copy context. The refined composition now separates Schinkel's
two substantial architectural piers and iron enclosure, the high
Carrara-marble sarcophagus, Friedrich Tieck's relief frieze and the reclining
bronze lion modelled by Christian Daniel Rauch and executed by Theodor Kalide.
The current sarcophagus and relief frieze are identified as conservation
copies. The lion has a persistent reclining body/head/paw silhouette, while
its raised head, full faceted mane, pointed ears, split muzzle, paired
forepaws, curled tail and green-patinated bronze top plate remain legible at
the landmark focus. Close-only mane tufts, face and claw cues fade at 62/155 m
instead of reducing the whole sculpture to an ellipsoid. Job von Witzleben's
memorial keeps its green Gothic Revival tabernacle;
Hans Carl von Winterfeld's monument at OSM node `279219439` keeps a pale
rectangular pedestal, unlettered laurel portrait medallion, trophy mantle and
plumed helmet;
Gustav Friedrich von Kessel's low dark grave remains inside a compact Gothic
fence; and the von Rauch family grave retains its ochre four-support arcade and
white cross. These are characteristic procedural recognition forms rather
than replacement survey meshes. Repeated fence bars, relief cues and grave
details share batches and the normal close-detail fade.

Scharnhorst's full and mobile smooth profiles are identical: 9 renderables /
698 stored vertices / 16,978 rendered vertices. Its Minecraft contribution is
4 palette batches / 572 blocks / 13,728 rendered instance vertices, within the
complete 10-batch / 1,999-block Invalidenfriedhof voxel root and over one
shared 24-vertex cube. The 18 m focus
targets the exact OSM anchor at 2.8 m local height. Collision follows the
foundation, two piers, sarcophagus, reclining lion and railing: the centre
between the piers stays open, the lion is solid at 5.4 m and clear again above
the published 5.60 m silhouette.

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
either work. Fritz Cremer's slightly over-life-size seated bronze Brecht now
has a distinctly bald articulated head with brow ridges, eyes, inner ears,
long angular nose, mouth and chin; a loose shirt collar, placket, buttons and
folds; overlapping hands with ten fingers and thumbs; straight trouser creases,
cuffs and shoes on the asymmetric open metal bench, including its deliberate
empty place. The warm dark-brown bronze remains separate from the
documented six-metre circular sett platform and three cylindrical,
horizontally jointed black-stone steles complete the installation. Credits
distinguish Peter Flierl's installation design, Fritz Cremer's sculpture and
Carlo Wloch's stonework/steles. The platform remains traversable outside the
figure/bench and stele solids; Minecraft replaces the smooth memorial with a
deterministic four-batch, 197-block signature shared by full and mobile. The
steles use non-legible incision cues only; the copyrighted poem and quotations
are not reproduced. Full and mobile Smooth are identical at 3 renderables /
38,400 stored and rendered vertices. Minecraft is 4 palette batches / 197
blocks / 4,728 rendered instance vertices over one shared 24-vertex cube. The
14 m close focus targets the exact Brecht anchor at 1.25 m local height, while
the fine anatomy layer fades at 34/105 m. The current `Eine Skulptur für Helene
Weigel`, unveiled on 10 May 2026 in the Helene-Weigel-Hof, is represented as
its recognisable installation rather than a generic vitrine: a transparent
glass cube stands on a white plinth. The central red folding director's chair
retains two clearly visible crossed scissor frames, surrounded by a folded red
chair/object landscape, light/audio elements and visible cable runs. A large
black procedural raster portrait is carried by the glazing. These are
code-native, source-bounded recognition forms rather than surveyed sculpture
meshes; the Berliner Ensemble press photographs are reference-only and no
photograph, portrait crop or portrait texture is bundled or loaded. Snow is
limited to separate upper accents.
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
explicitly schematic. The current pedestrian corridor along Alte Potsdamer
Straße is independently anchored by 28 records from Berlin's public-lighting
WFS, paired into 14 cross-street positions and 13 centreline segments. Its
paving bands, movable seating, planters, bicycle racks and bollards are bounded
public-realm recognition details rather than a fixture survey. Existing
official lamp geometry is deliberately not duplicated, and the mobile profile
reduces furniture while keeping the complete corridor.

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
`1128036906` and now carry continuous stone edge bands. Panoramaweg way
`4395332` is reconstructed as a 2.4 m raised route with 16 connected spans,
nine rectangular supports and fine edge rails; 18 staggered Gartenspur slabs
retain the landscape design's long concrete rhythm. The lawn rise and wall
treatment follow the published Berlin and
landscape-architect descriptions and remain explicitly source-described
recognition geometry rather than a claimed fixture survey.

Three smaller places carry the same evidence boundary. Hotel AMANO Grand
Central retains OSM way `237687062` and Berlin LoD2 building part
`DEBE3DLXM9FjJbtp` (27.819 m), with a thin source-described clinker, glazing
and setback-storey overlay. At Floraplatz, exactly eight OSM-positioned granite
plinths carry differentiated bronze deer, bison, elk, bear and bull silhouettes.
The duplicate generic Bison node at the same eastern plinth as `Liegender Bison
II` is the only suppressed record.

The Geschichtspark Ehemaliges Zellengefängnis Moabit now has its own
source-scoped detail root. OSM park way `498278335` retains the exact 22-point
ring. Wall ways `53178124`, `105495351`, `498279237` and `498279239` yield 19
exact plan segments: the four segments of way `105495351` keep its explicit
brick / 4 m tags, while the remaining 15 use the official Berlin account's
general 5 m red-brick wall height only as a display value. That source conflict
is intentional and does not turn the 5 m general description into a
per-segment survey.

Exact Panoptikum way `195086492`, Klopfzeichen node `2310445137`, information
node `5772396362`, three entrances, four present-day interpretive wing traces,
three yard readings and hedges make the memorial programme legible. The
existing Berlin LoD2 cell `DEBE01AL2yz00000` / prism `2yz00000` remains the
walk-in cell; the procedural layer does not cover it with another shell. It
retains the sourced remembrance context for opponents of National Socialism
imprisoned at the site, including Albrecht Haushofer, without rebuilding the
demolished historic prison. It
also creates no park plate and does not replace the existing mapped lawn,
paths, playground detail or 175 source trees inside the park. Generic copies
of the exact Panoptikum and Klopfzeichen records are suppressed, while the
outside plaque at OSM node `3841135547` remains an independent street detail.

Day, Night, Snowstorm and Schwellenraum share the texture-free drawn root;
Minecraft hides it and uses one block-native batch. Full Smooth is fixed at 5
renderables / 7,818 rendered vertices and mobile Smooth at 5 / 5,448.
Minecraft uses one batch with 3,882 blocks / 93,168 rendered instance vertices
in full and 2,093 / 50,232 on mobile. Snow changes only exposed caps. Ordinary
walking collision uses seven ±0.42 m body samples with the analytical memorial
test at zero added radius; it follows the represented wall, retained-cell and
Panoptikum solids while leaving the three mapped entrance gaps and cell
approach open. Schwellenraum retains its existing whole-park protection. The
close cameras use 128 m in the drawn modes and 142 m
in Minecraft. Mortar courses, local interpretive trace widths, information
board dimensions and planting intervals are procedural, non-surveyed
recognition geometry. The protected landscape plan is not traced or bundled;
no photograph, canvas image, thumbnail or photographic texture is loaded.

The Heidestraße / B96 corner keeps its committed metric anchors while three
owner-supplied August 2026 street views sharpen only its recognition layer. The
KPMG/EINZ tower retains its 42.59 x 24.77 m LoD2 shell, 83.794 m measured
height and 22-storey / 32-by-18-bay facade contract; stronger four-bay fins, a
dark double-height recess, six pilotis and a projecting canopy now resolve the
street-level entrance. Oggi's retains its existing OSM-positioned landmark
anchor but reads as a separate timber-and-ivory kebab counter beside the red,
white and blue Mubis City Imbiss, under one planted low roof edge. A shared
focus target keeps both stalls and the nearby FUNBOX entrance legible. These
subdivisions and signs are local display estimates, not surveyed additions.

The temporary 2026 FUNBOX remains a procedural event reading rather than a
surveyed parcel. Its unchanged drawn and Minecraft envelopes stay fitted
between the delivered OSM-derived Heidestraße, Minna-Cauer-Straße and
Döberitzer Straße surface polygons, with a measured 2.553 m minimum clearance
from those surfaces. The street entrance now uses the observed low green
inflated dome, dark windows, six pale/coloured hoarding fields, narrow gate and
separate ticket container in both Smooth and Minecraft. It stays clear of the
northern Tiergartentunnel portal and all source voxel buildings; full and
mobile Minecraft remain byte-identical. visitBerlin supplies the official
corner, 2026 dates, 4,000-plus-square-metre scale, ten-zone programme and
five-metre slide. The supplied photographs remain reference-only: no photo,
crop, artwork, tracing or external texture is bundled or copied.

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
their published positions and dimensions remain unchanged. One exact source
fingerprint is promoted from those shared instances: official Trauben-Eiche
`tree-21650` at `[-274.82, 3.787, 154.97]` is the Lenné-Eiche near Carillon.
Its published 23 m height, 9.5 m crown radius and 0.5 m trunk radius anchor a
dedicated seven-renderable full model and six-renderable mobile model. Supplied
photographs inform the root flare, deep bark fissures, high twin leaders, long
horizontal limb, airy asymmetric crown, exposed dead tips, lobed olive leaves
and botanical plaque only; no photograph is bundled or loaded. Minecraft
replaces the matching generic source cell with one opaque instanced block
model: 138 full-profile blocks or 85 mobile blocks preserve the 23 m silhouette,
high fork, lateral reach and open crown in one draw call. The adjoining former
Krolloper grounds use a dedicated 20-work recognition layer for the
**Skulpturen gegen Krieg und Gewalt**. All 20 current OSM node anchors remain
exact and each node receives a distinct procedural form rather than a shared
placeholder. Contact, Himmelsschlüssel, Große Knospe III/63 and Todes Mauer
Bruch preserve the supplied close-view evidence for true openings, diagonal
bindings, rough cubist lobes, paired jagged steel walls and four inscribed
ground plates. The exact source keys are excluded from the generic OSM
monument builder to prevent duplicates. No supplied photograph is bundled or
fetched at runtime. Full and mobile profiles both preserve all 20 works;
mobile reduces only bounded edge, groove and lettering subdivisions (114
versus 91 renderables in the current implementation). In addition, 83
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

Generic LoD2 buildings retain the same consolidated facade line object in all
drawn modes. Solid bay axes cross one storey-sill segment per height-derived
floor; a 2.35 m / 1.25 m shader dash rhythm makes those sills read as window
bays without adding pane or head vertices unsupported by the source. A compact
centimetre `Uint16` distance attribute costs about 3.1 MiB for the complete
desktop city, preserves the v0.72.22 202-draw-call / 19,593,753-vertex steady
state, and fades the micro-detail between 500 and 780 m. The one-draw increase
over v0.72.21 is the dedicated merged Goldelse material, not one draw per new
feather, fold or laurel leaf.

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

The committed payload contains 93 records. Richard Wagner remains record 90;
Weidendammer Brücke, Bertolt Brecht and Scharnhorst follow as records 91, 92
and 93 at exact OSM way/node anchors `6228081`, `988668382` and `273120316`.
The separately modelled CSD memorial place at OSM node `14076715427` is
intentionally not a 94th tour entry.

For local download reliability, the same landmark payload is also bundled
into the React app at `src/app/src/data/regierungsviertel-landmarks.json`.
Keep it byte-identical to
`src/app/public/dzi/regierungsviertel/landmarks.json`; the package tests
enforce this. Bundling avoids `fetch()` for downloaded `file://` starts.

## Remote DZI hosting

By default the viewer loads the world manifest from
`public/mesh/regierungsviertel/scene.json` and the compact procedural JSON
layers needed by the selected world. `ground-context.json` supplies terrain
during Day/Night/Snow/Schwellenraum startup, while Minecraft stays lazy. No
GLB, hero-crop or pretriangulated road-plate inventory remains to request.
Every underside view stays on the authored cutaway/network presentation and
every profile keeps the explicit recovery UI. JSON requests use a finite
timeout, one retry and cancellation on unmount.

A WebGL runtime failure in any profile releases the canvas and active world,
then performs exactly one clean automatic remount for that world family. A
repeated failure exposes the Recovery and 2D-map actions instead of allocating
another hidden renderer or selecting 2D implicitly. In mobile-like touch
sessions, a drawn/Minecraft family transition unmounts the inactive WebGL
world. Moving to the 2D map unmounts WebGL on every device; non-touch desktop
keeps its complete scene warm only across visual modes inside the live viewer.
Static scenes hold the final framebuffer without a periodic redraw. Repeated
tunnel fixtures are instanced, and only three compact progressive world batches
can be pending. Disposal stops workers before another batch can attach, closes
decoded image resources where the browser exposes them and resets custom touch
state on lost pointer capture, global pointer release, window blur or tab
hiding. A watchdog restores controls after a stale three-finger sequence, while
finite camera bounds recover a lost pose.

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

The packaged HTTP server uses HTTP/1.1. Immutable procedural JSON, DZI images,
JavaScript and CSS receive a one-year cache policy, while HTML and the small
scene manifest revalidate. The repository development server uses revalidation
so a rebuilt file with the same name is not hidden by cache.
