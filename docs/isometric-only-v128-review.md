# v1.0.28 isometric viewer and controls review

The viewer now opens only the existing Three.js scene. The retired 2D switch,
OpenSeadragon runtime, flat-map presentation and duplicated download renderer
are removed. Legacy view=map links still reach the 3D scene; there is no hidden
2D engine or automatic fallback. A failed 3D load retains explicit recovery.

## Input contract

Arrow keys look up/down/left/right in both flight and walking. WASD moves;
Space retains flight ascent or a walking jump. The orange joystick retains
camera-relative horizontal movement without introducing pitch. Primary mouse
drag now rotates the view like one-finger touch; dragging upward raises the
view. Secondary or Shift drag preserves deliberate panning in flight.

The pitch convention is positive-up across held input, tap/hold buttons and
walking. Azimuth commands use the matching right-positive convention; the
runtime converts to Three.js orbit angles once. The HUD no longer adds its
own duplicate rotation after receiving the camera's update.

## Removed baggage and preserved data

All eight source mesh JSON payloads (26,300,880 bytes total) match their v1.0.27
SHA-256 hashes. Building and monument geometry, render distance, material detail,
movement speeds and the worker remain unchanged. The walking minimap remains.
The startup backdrop is an exact copy of the previously used 21 KiB image.

The full 3,945-image flat-map pyramid, overview plates and obsolete preview are
removed from source/public and fresh builds. The archival generator remains,
with isolated temporary fixtures for its tests. OpenSeadragon and its type package
are removed from dependencies. START-HERE.html now gives bilingual local 3D
launcher instructions under file:// and redirects into the 3D app under HTTP,
keeping query/hash navigation. Package checks reject the retired map exports.

Existing versioned public assets are retained on GitHub Pages for already-open
older clients; only the new viewer and downloads stop shipping/requesting them.
This avoids broken old sessions while keeping the current package smaller.

## Verification

- The fresh build falls from 109,023,764 to 40,123,796 bytes (63.2% smaller).
  The unpacked download falls from 68,694,054 to 40,144,619 bytes (41.6%).
  ZIP transfer size falls from 39,017,983 to 10,747,981 bytes (72.5%).
- The former 275,980-byte map-engine JavaScript chunk is absent; entry JavaScript
  falls from 181,522 to 153,504 bytes and CSS from 42,616 to 37,920 bytes.
  These are download/parse savings, not a measured scene-frame-rate claim.
- Retained source mesh, walking minimap, metadata and credit files were compared
  byte-for-byte against v1.0.27 and against the release package. The initial
  backdrop also matches its original pyramid image exactly.
- TypeScript, production build and local-package smoke checks pass.
- Desktop Chrome verifies upward/downward arrows and mouse drag, tap/hold look
  buttons, left/right arrows and buttons in walking and flight; W/S movement,
  horizontal orange joystick, five visual modes preserving pose, legacy map
  links opening 3D, and forced WebGL failure presenting reload-only recovery.
  No application errors or retired map requests were observed.
- Local launch-guide checks pass at 1280×800 and 390×844: file:// instructions
  fit, HTTP navigation retains query/hash, and no page errors occur.

Additional final test totals are recorded below. Public deployment evidence
is recorded in the GitHub release notes.

- Full frontend sweep: 1,957 cases across 245 files, 1,956 initially passing.
  Its sole failure expected the retired setViewerMode map branch. That obsolete
  contract was corrected; the final run of every changed frontend test passes:
  163 cases / 1,173 assertions across 15 files. The Schwellenraum motion and
  source-geometry protections remain covered.
- Ruff format/check and all 402 Python tests pass (41.90 s), including archive,
  fresh package, retired-asset exclusion and all five desktop/mobile mode buttons.
- Chrome touch also passes the complete controls/legacy-link/error scenarios,
  using actual touch input. This is touch emulation, not an iPhone FPS measurement.
- The production download starts in WebKit in 9.15 s with no application errors
  or failed critical requests. Its only advisory is the existing ignored
  interactive-widget viewport setting.
- ZIP SHA-256: `e1b174015fdd0ccf82e8da4ee52eeb77c9497c3bf9772743214b1a4dc7c5852b`.
- Static tarball SHA-256: `68f346df520bd00f264248fb2d0861a8b72e6c8cab737af52627dff317d9429d`.

- Explicit reset, local recovery and walk-to-flight restoration pass through the
  production UI on desktop and touch. Saved position, target, FOV and near plane
  survive the subsequent Minecraft/Night/Day switches (35 desktop and 47 touch
  presented samples; no page errors).
