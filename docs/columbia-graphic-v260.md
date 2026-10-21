# Columbiahalle graphic loop — v260

The user's correction replaces the recording viewer with one silent procedural
concert scene. The controller creates no video/audio element, recording selector,
media URL, decoder, preload or network request. Enter, Pause/Play, Leave and Escape
remain accessible in German and English. Reduced-motion preference starts paused;
the user can explicitly start the animation. Pause preserves the current frame
across suspension, document hiding and offscreen recovery.

The retained room, trusses, ventilation duct, open balconies, three anonymous
performers and all 330 audience figures remain. The 24-second seamless graphic
loop combines eight soft moving beams, five broad rear-stage colour fields,
55 gently swaying foreground spectators, nine small raised-phone silhouettes
and six slowly moving performer arms. These are anonymous illustrative geometry,
not a reconstruction of identifiable people in the supplied reference recordings.
No recording or reference-image pixels are displayed or textured.

The existing renderer and shared update call drive the scene, capped at 30 fps.
The controller does no render/animation work while hidden, offscreen, suspended
or disposed; a paused room redraws only for explicit view/recovery changes.
Geometry and typed arrays are allocated once; dynamic matrices reuse the existing
two audience/structure buffers and bounded upload ranges. Both independent drawn
and orthogonal native families retain complete mobile detail. Scene disposal
releases each geometry, material and instance buffer exactly once.

Measured local cost: **11 renderable objects**, **75,044 bytes / 959 instances** drawn,
**96,188 bytes / 1,277 instances** native. This remains below the prior 100,000-byte
local scene limit; the city residency policy does not change. The new colour
wash adds one draw call. All previous room recognition remains rendered.

Fourteen focused Bun tests pass, including no-media/no-extra-scheduler guards,
pause/recovery/leave behavior, reduced-motion opt-in, language and keyboard
accessibility, exact 24-second pose closure, stable buffer identity, unchanged
photo-supported architecture, native orthogonality and complete GPU disposal.
The TypeScript project check passes.

Browser verification (Chrome desktop and WebKit iPhone, drawn and native):
all four combinations passed with zero media requests/elements and WebGL errors.
The renderer submits 20 actual WebGL draws for the 11 objects because transparent
double-sided surfaces use two passes. GPU buffers remain stable during playback
and are completely deleted after Leave/Escape, including 12 repeated cycles.
Pause, paused-scene hidden/offscreen recovery, DE/EN and reduced-motion opt-in passed. Active-loop suspension is additionally covered by the controller unit tests.
