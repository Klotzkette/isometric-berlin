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
toolbar, or press `?`) listing the shortcuts: `←`/`→` previous/next
landmark, `Space` start/pause the tour, `+`/`=`/`−` zoom, `Home`/`0`
overview, `L` copy a view link, `Esc` close overlays.

In true 3D, left-drag or one finger orbits, the wheel zooms, right-drag pans,
and two fingers combine pinch and rotation. A three-finger gesture controls
azimuth and polar tilt continuously through 90 degrees into the real underside
camera. The underside fades surface materials and reveals the two-tube
Tiergartentunnel cutaway. The arrow keys rotate and tilt in 3D. In DZI mode,
ordinary drag pans and Shift-drag rotates. At phone widths the landmark rail
starts closed and leaves the safe-area-aware bottom controls accessible.

Only the selected landmark receives a focus ring. The former 39 permanently
visible coloured map dots were removed from the Three.js, DZI and zero-server
fallbacks because they obscured roofs and facades.

The Reichstag carries an explicit architectural signature over the official
photogrammetry: a transparent glass shell with 24 main ribs, 17 horizontal
rings, two counter-rotating ramps and a mirror cone. Its 40 m diameter and
23.5 m height come from the Bundestag's architecture page and are aligned to
the apex of the official Berlin mesh rather than positioned by eye.

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
distance from the selected landmark and loaded with bounded concurrency. Hero
texture crops load only when selected. A failed model request is retried once,
and one failed optional hero group reports a warning without closing the usable
base scene. Mobile/coarse-pointer devices retain one hero group, while desktop
retains the two most recently used groups; evicted geometry, materials and
textures are explicitly disposed to bound browser and GPU memory. A lost WebGL
context switches to the DZI fallback and a later 3D selection creates a fresh
context. On touch/coarse-pointer devices, switching to the 2D map unmounts the
inactive WebGL scene and active 3D rendering uses a 30 fps budget; desktop keeps
the loaded scene warm for rapid mode switching. Disposal also stops workers
before they start another queued GLB, closes decoded image resources where the
browser exposes them and resets custom touch state on lost pointer capture or
window blur.

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
