# Walking jump controls — step 10

In walking mode, one short touch/pen tap on the orange joystick requests the
normal jump. A mouse needs two completed nearby clicks. Space also jumps.
Day, Night, Snowstorm, Minecraft and Schwellenraum share the same handler and
normal jump physics. Dragging continues to move the person; the joystick no
longer toggles mouse sprint. Shift, the forward-button/double-W shortcut and
the existing sprint/fast-run controls remain available.

Activation happens on pointer-up. A tap lasts at most 320 ms and travels no
farther than 14 CSS pixels. Mouse clicks must finish within 480 ms and 32 CSS
pixels of each other. Maximum travel is retained for the entire gesture, so
an outward-and-returning drag cannot count as a click. Long holds, secondary
mouse buttons, additional pointers, outside interactions, cancellation and
lost capture clear the pending sequence. Leaving walking, changing visual
mode, hiding the controls/page or losing focus stops held movement.

The normal jump retains its 6.2 m apex and cannot stack height while airborne.
A second Space press within 320 ms retains the existing bounded 10.5 m higher
jump. Keyboard repeats cannot retrigger jumping. Entering walking mode and
selecting a world returns focus to the canvas; touching/clicking the joystick
focuses that control. Space therefore reaches navigation after those actions,
while text fields, dialogs and separately focused buttons keep their normal
keyboard behavior.

The actual component-handler tests in `iphone-joystick.test.ts` cover single
touch/pen taps, completed mouse double-clicks, rejected drags/holds, input
release and the v1.0.2 camera-event isolation. `pedestrian-jump-controls.test.ts`
executes the real keyboard and viewer-handle adapters for all five worlds,
including focus transfer, repeat suppression and normal/higher Space jumps.
The gesture and pedestrian physics suites check release thresholds and airborne
height guards. Physical-device/browser QA remains separate from these tests.
