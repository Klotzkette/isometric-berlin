# v1.0.27 navigation and startup review

Step 10 continues in the existing React/Three.js viewer and GitHub Pages release.
This change is limited to visual-mode continuity, Minecraft tree density, local
escape and the opening presentation. Architecture, street data and movement
speeds are unchanged.

## Mode continuity

Desktop keeps its existing renderer. Mobile still disposes the drawn world when
entering Minecraft and vice versa; only a small, plain numeric snapshot crosses
that boundary. It includes camera and target, lens and clip distances, underside,
walk/flight intent, pedestrian heading, floor, jump state, saved orbit pose and
the bounded recovery trail. It contains no scene, buffers or collision environment.
The new environment is built for the selected mode.

Restore occurs before construction and streaming select their visible districts.
Startup focus and later landmark framing cannot overwrite that restored pose.
The walking attachment is idempotent, the lens does not change with lighting,
and idle feet keep their existing floor. A restored jump pauses while the mobile
replacement is hidden. Rapid mode switches retain the last valid snapshot.
Snapshots are consumed when ready; explicit reset, 2D visits and error recovery
invalidate them rather than reviving an old walking state.

## Trees, escape and loading

Ordinary Minecraft tree retention falls from five secondary buckets to four.
Visible totals including the protected Lenné oak are 19,721 full and 9,901 mobile,
down from 24,585 and 12,274. All 44,222 source records remain; drawn modes and the
protected oak are unchanged. Both walking and flight use the same tree policy.
Instance buffers decrease by 1,108,992 full / 541,044 mobile bytes, without extra
draw calls. Construction byte snapshots and deterministic subset tests cover it.

The bilingual Get unstuck/Freikommen button uses the bounded recovery described
in [pedestrian-recovery-v127.md](pedestrian-recovery-v127.md). It retains heading
and a selected walking speed. Its last resort enters flight above an obstacle
at the same X/Z, translating camera and target together. Recovery is explicit;
ordinary movement and visual changes do not invoke it. Expanded mobile credits
take priority over this button. Pathological columns blocked up to the flight
ceiling return no unchecked destination.

First HTML and React share a quiet title plate with a small native isometric SVG
over the existing marker-free map. Mobile startup progress remains visible;
the percentage still comes from actual loading and no delay is added. The 21 KiB
backdrop is reused; no external fonts, images or requests are introduced.

## Verification

- Eight snapshot tests / 171 assertions cover flight, pending walk, ground,
  ascending and descending jumps, tunnels, saved orbit, recovery history, fresh
  viewport aspect, independent copies and 20 drift-free round trips.
- Real-source Hauptbahnhof gallery and Tiergartentunnel recovery pass in all
  five modes; ordinary wall, bridge, monument and shoreline access remains tested.
- New recovery tests cover stale checkpoints, enclosed cavities, water, protected
  volumes, repeated recovery, a 120 m solid and an empty room below a solid roof.
- Startup screenshots checked in Chrome at 1440×900, 390×844 and 844×390,
  including first HTML, night, Minecraft and reduced motion. No page errors.
- `scripts/smoke_mode_continuity.py` exercises actual UI controls on desktop
  and touch. A test-only runtime probe reads numeric state without a production
  debug API. Touch emulation validates lifecycle behavior, not iPhone performance.

Final automated results and production-package checks are recorded below.
Public deployment evidence is recorded in the GitHub release notes.

- Full frontend sweep: 1,964 cases across 245 files; 1,962 initially passed.
  The two obsolete expectations required automatic Wagner refocusing and an
  idle 7 cm bridge-height change. Both now reflect the requested continuity.
  Final reruns: 42 snapshot/static/recovery cases and 128 bridge/access/recovery
  cases all pass. Bridge checks cover nine source profiles × five mode changes
  × keyboard/partial joystick, including first-step active-deck alignment.
- Ruff format/check and all 391 Python tests pass (58.45 s).
- Desktop and touch mode/rapid-switch checks: 803 presented samples, no reset
  or page errors. Explicit reset, map round trip and local recovery pass in
  production on both profiles.
- Real UI recovery fallback preserves X/Z/view vector, rises 8.75 m above the
  injected QA obstacle and updates the walking UI/controls consistently. A
  deliberately blocked column preserves state and reports no available exit.
- Final production package starts in Chrome touch (7.79 s) and WebKit (7.81 s),
  with no application errors or failed critical requests. WebKit only reports
  the existing ignored `interactive-widget` viewport advisory.
- Build, release-readiness and local-package smoke checks pass for v1.0.27.
- ZIP SHA-256: `2fd22977c6d69284c02dbc83159e15aa8aab953c4d3ef37c9b9718e3bf89bb55`.
- Static tarball SHA-256: `340efa2ae67a59c00644f940cea8d89475130b7bdeec9de972a89aba00619cc2`.
