# Browser controls — step 10, v1.0.40

The desktop dock now shows its actual W/A/S/D movement keys, beside a compact
German/English guide: W forward, S backward, A/D strafe, up/down arrows look
up/down, left/right arrows turn the view, and left mouse drag looks around.
The former N/E/S/W compass presets are removed from this movement dock. The
orientation reset remains an explicit compass action, and the dock-side toggle
remains available. The dedicated mobile compass sheet, touch gestures, orange
joystick and jump button retain their existing layout.

In hover mode, hold Space to rise and Shift to descend. Both height controls
work while moving with WASD and while looking with arrows, including Alt/Option
arrow chords. Shift+A/D now descends while strafing; it no longer converts
flight strafe into rotation. Opposed Space/Shift inputs cancel vertically, and
releasing either resumes the remaining height direction without cancelling
horizontal movement or looking.

The height mapping follows Mojang's official
[Minecraft controls guide](https://www.minecraft.net/en-us/article/minecraft-controls),
which documents held Space for ascent and Shift for descent while flying.
Only that height mapping is adopted: walking still uses Space to jump, a quick
second Space for the existing higher jump, and Shift to sprint. P and the
walk/hover button still select walking or hover; no new double-Space flight
toggle is introduced.

The visible dock legend, control tooltips, keyboard help and app documentation
now describe the same mapping. Keyboard input, touch movement, scene data,
rendering budgets and camera continuity use their existing adapters.

Focused validation covers all WASD × arrow × height combinations, opposed
height keys and key releases, plus the actual App keyboard handlers. The
handler check exercises uppercase movement while Shift is held, repeats,
Space/Shift cancellation, resumed ascent/descent, final zero input and absence
of a reset. Existing walking jump/focus, movement, startup and dock tests remain
part of the focused suite.

Result: 82 tests / 535 assertions pass across `camera-navigation`,
`keyboard-shortcuts`, `navigation-input`, `pedestrian-jump-controls`,
`pedestrian-navigation`, `startup-loading` and `control-dock`. TypeScript
project checking (`bun --bun tsc -b`) and `git diff --check` also pass.

Browser QA uses real Chrome keyboard events at 1280 px with both fine and
coarse pointer profiles. Sixteen Space/Shift + movement/look combinations
produce the expected signed height change and keep moving/looking; every
release settles with 0 m measured drift. German and English layout checks at
1280 px (fine/coarse) and 1440 px (fine) inspect button contents and bounds.
A wrapped attribution footer exposed a pre-existing 10 px overlap with the
bottom command row; the desktop-only dock, joystick and selection card now sit
16 px higher. Final visual QA injects the exact source CSS into the candidate
build; compact mobile styles below 1025 px are unaffected.
