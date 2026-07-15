# Web viewer

React + TypeScript + Vite with two complementary static engines, managed with
`bun`:

- **Three.js true 3D:** official Berlin 3D Mesh 2025, progressively loaded,
  freely orbitable from above and below.
- **OpenSeadragon detail map:** the 16384×11616 DZI remains the fast,
  high-resolution cartographic fallback.

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
`Home`/`0` overview, `D` switch Day/Night, `M` toggle Minecraft, `B` toggle
music, `L` copy a view link, and `Esc` close overlays.

In true 3D, left-drag or one finger orbits, the wheel zooms, and right-drag
pans. A two-finger centre swipe flies along the current camera heading, pinch
zooms and twist rotates. A three-finger gesture controls
azimuth and polar tilt continuously through 90 degrees into the real underside
camera. The underside fades surface materials and strengthens the two-tube
Tiergartentunnel cutaway; the tunnel is hidden in ordinary exterior views and
appears automatically after the camera crosses below ground **or flies into
the tunnel tube itself** — approaching a portal at street level and diving in
switches to the lit interior (safety-light strips, ceiling lights, ventilation
shafts and fans) and out the other end.
Arrow keys translate camera and target together in the visible screen plane.
`Shift` plus arrows flies forward/backward or strafes relative to the current
heading; `Alt`/`Option` plus left/right orbits and plus up/down tilts.

**Continuous flight:** holding `Space` in 3D arms a smooth, velocity-damped
flight mode — `Space`+`↑`/`↓` flies forward/backward along the current
heading, `Space`+`←`/`→` strafes, `Space`+`Shift`+`↑`/`↓` changes altitude. A
plain `Space` tap still toggles the sight tour. On coarse-pointer devices a
bottom-left thumb joystick provides the same continuous flight (drag up =
forward, sideways = strafe); the existing two-finger swipe remains. Flying
below the Spree surface (scene water level 1.31 m) switches to an underwater
presentation with deep-teal fog; it lifts as soon as the camera surfaces, and
the Tiergartentunnel interior — which passes under the river — is exempt.

In DZI mode, ordinary drag pans and Shift-drag rotates. On phones and
coarse-pointer tablets up to 1024 px, the sight rail starts closed and leaves
the safe-area-aware bottom controls accessible.

## Language, visual modes, and sound

The toolbar exposes direct Day, Night and Minecraft buttons. `D` remains the
fast Day/Night toggle and `M` enters or leaves Minecraft independently. A
persistent DE/EN control translates all viewer chrome; official German place
names remain unchanged, and the German UI uses `Sehenswürdigkeiten` rather than
the English false friend.

Music is off by default and cannot autoplay. The music button or `B` starts a
local Web Audio score with seven original 72 BPM variants built from triangle
bass, square/sine chimes, high-pass noise hats and quiet drones. It loads no
audio file and suspends when the tab is hidden. Short bilingual discovery notes
are tied to seven selected sights and appear only once per page session.

The ordinary Day/Night pipeline applies a bounded crisp/saturation pass only
after camera movement settles; direct rendering resumes during motion. Minecraft
uses its separate palette pass with reduced bloom and sparse shimmer. This keeps
controls responsive while improving stationary facade and roof definition.

Seven memorial recognition models supplement the official mesh at normal
selection distances. Repeated Holocaust stelae use GPU instancing, as do the
Soviet colonnade and fine folds of the 2026 Jehovah's Witnesses memorial; this
adds close-range granularity without loading another texture set or creating
thousands of draw calls. Evidence and approximation boundaries are documented
in [`monument-detail.md`](monument-detail.md).

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
mirror cone. The Chancellery separates its 36 m central cube, semicircular
windows and 18 m office bands and locates the 5.5 m Chillida sculpture from its
verified landmark point. Hauptbahnhof exposes the 321 m glass roof, 180 x 42 m
crossing hall and 46 m office bridges. The Brandenburg Gate keeps its published
62.5 x 11 x 26 m envelope, twelve Doric columns and articulated bronze-green
Quadriga. These models sharpen silhouettes without replacing the aligned
Berlin Mesh texture beneath them.

The cultural recognition layer keeps similarly small features readable without
altering the official base mesh. The 32 x 26 m TIPI has twenty structural ribs,
220 warm rib bulbs, a night-only four-colour show wash and the requested golden
`PIGOR & EICHHORN` and `NUR HEUTE ABEND` marquee lines. The 42 m Carillon lets
the official photogrammetric mesh carry its four granite pylons and adds 68
individually placed bells beneath a shallow roof cap. Two compact
uniformed figures mark the Chancellery entrance. Selecting `Spreebogen` opens
an unobstructed east-side view of the occupied excursion boat, its open deck,
wake and a 3D wave ribbon aligned to the committed OSM river centreline.

The optional OSM park-detail request is deliberately non-blocking: a failed
`park-details.json` request raises a warning but never delays or disables the
23 official base meshes. When present, seven path material classes are batched,
tree trunks, fork branches and five-part crowns are instanced, and only the
small number of mapped playground devices use individual geometry. The
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
`public/mesh/regierungsviertel/scene.json`; individual GLBs are ordered by
distance from the selected landmark and loaded with bounded concurrency. The
2.3M-face interaction tier opens first on every device. Desktop then loads the
6M-face settled surface serially in the background, shows it only while idle and
returns to the interaction tier for mouse, touch, keyboard or button movement.
The idle presentation also enables two extra 80-triangle microcrowns for each
of 6,893 official Berlin tree points, taking the displayed official-source
surface equivalents to 7,102,882. This is an instanced rendering count, not a
claim of seven million independently surveyed polygons. Touch/coarse-pointer
devices never request the settled tier or render those extra crowns. Hero
texture crops load only when selected. A failed model request is retried once,
and one failed optional hero group reports a warning without closing the usable
base scene. Mobile/coarse-pointer devices retain one hero group, while desktop
retains the two most recently used groups; evicted geometry, materials and
textures are explicitly disposed to bound browser and GPU memory. A lost WebGL
context switches to the DZI fallback and a later 3D selection creates a fresh
context. On touch/coarse-pointer devices, switching to the 2D map unmounts the
inactive WebGL scene and moving 3D rendering uses a 30 fps budget; desktop keeps
the loaded scene warm and interaction at 60 fps. Static scenes settle to 10 fps
on mobile and 12 fps on desktop. Existing GLB normals are reused, repeated
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
