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

`desktop-joystick.test.ts` executes the actual App-to-viewer input adapters and
checks movement without orbit/look input, walking direction, release-to-zero,
mode resets and layout rules. The gesture suite retains touch jump and physics
coverage. Browser QA checks mouse dragging in flight and walking plus the
compact/touch and mirrored desktop layouts.
