# Shared desktop and mobile joystick — step 10

The orange joystick now uses the same movement input on desktop, phone and
tablet. Drag up/down to move forward/backward along the view heading; drag
left/right to strafe. It flies in camera mode and walks in pedestrian mode.
Walking retains the existing terrain, water and solid-object checks in every
visual mode.
Mouse double-click still toggles walking sprint; touch/pen double-tap requests
the normal jump with the guards described in [mobile-joystick-jump.md](mobile-joystick-jump.md).

There is one joystick component. CSS places its 82 px desktop pad beside the
control panel, its 108 px compact pad near the bottom edge, and its 128 px touch
pad in the existing safe-area-aware location. The chosen left/right dock side
is preserved, including large touch displays. Canvas dragging, arrow buttons
and keyboard orbit controls remain available for looking and rotating.

Releasing, cancelling or losing the active pointer stops movement. Changing
visual mode, switching walking/flight, disabling the control, hiding the chrome,
leaving 3D, losing page focus or hiding the page also clears held input and
pending gestures. Normal pointer-up capture loss preserves a completed first
touch tap for its double-tap pair.

In v1.0.2, pad pointer events stop before reaching the document listeners used
by an active OrbitControls canvas gesture. The dependency accepts moves from
untracked touch IDs: holding one finger on the map and moving a second on the
pad previously changed both movement and camera rotation. A subsequent tiny
map-finger move could flip the camera toward the sky. Each finger now stays in
its own control; the map finger can still deliberately look while moving.

The pad centre is sampled once at pointer-down, so browser chrome or safe-area
layout changes cannot reverse an ongoing drag. A 4 CSS px radial neutral zone
filters thumb wobble and scales continuously to full speed at the existing
44 px radius. The knob updates directly without a layout read or React render
on every move. Capture rejection cancels the gesture and clears input.

`desktop-joystick.test.ts` executes the actual App-to-viewer input adapters and
checks movement without orbit/look input, walking direction, release-to-zero,
mode resets and layout rules. The gesture suite retains touch jump and physics
coverage. Browser QA checks mouse dragging in flight and walking plus the
compact/touch and mirrored desktop layouts.

`iphone-joystick.test.ts` executes the actual component handlers with the real
OrbitControls dependency and synthetic event targets. It reproduces the old
foreign-pointer camera flip and checks event isolation, a moving pad rectangle,
neutral/full input, pointer lifecycle and double-tap behavior. This is an
automated touch-event regression test, not validation on physical iPhone hardware.
