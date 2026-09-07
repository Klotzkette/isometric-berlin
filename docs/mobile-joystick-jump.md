# Mobile walking joystick jump — step 10

In walking mode, double-tapping the orange joystick with a finger or pen now
requests the same normal jump as the jump button. The gesture applies in Day,
Night, Snowstorm, Minecraft and Schwellenraum through the existing pedestrian
jump handle. Dragging the joystick still moves the person continuously. Desktop
mouse double activation retains its previous sprint action.

A jump is requested only after both pointers have been released. Each tap must
last at most 320 ms and travel no farther than 14 CSS pixels; the two releases
must be within 480 ms and 32 CSS pixels. Maximum travel is retained throughout
the gesture, so dragging out and back to the orange centre cannot count as a
tap. A long hold, extra finger, outside touch, cancellation or lost capture
clears the sequence. Disabled controls, leaving walking mode, page blur and
hidden-page transitions reset the gesture and release movement input. Ordinary
capture release after a completed tap preserves the first tap for its pair.

The shortcut uses normal jump physics (6.2 m apex), does not request the higher
keyboard jump and cannot stack another jump while airborne. Existing Shift,
forward double activation and the mouse view double-click still provide sprint.
The joystick's accessible DE/EN label and control help now describe jumping.

`joystick-gestures.test.ts` covers touch/pen completion, thumb wobble, drag return,
timing and distance guards, cancellation and multiple pointers. It also drives
the real pedestrian jump/step functions through takeoff, rejected airborne
retrigger and landing. Browser QA should double-tap and drag the orange walking
pad on a mobile viewport, then verify that flight and canvas look dragging remain
unchanged.
