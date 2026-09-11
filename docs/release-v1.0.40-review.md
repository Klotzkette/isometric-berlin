# v1.0.40 review — Gymnasium Tiergarten, streets and browser controls

Step 10 refines the Gymnasium Tiergarten Neubau and Hand mit Uhr, completes
the nearby school/GRIPS streets and makes desktop movement clearer. The school
retains all 13 official LoD2 parts, roof steps and footprints, with white/red
facades, the blue Aula and glazed entrance. The sculpture uses its exact OSM
anchor, an upward wrist, down-curved fingers, watch face and offset plinth.
Source facts, conflicting published dimensions and procedural approximations
are recorded in [the school review](gymnasium-tiergarten-v140.md).

Altonaer Straße, Lessingstraße and Bartningallee receive source-bound asphalt,
paving and open kerbs. Two ground-level Altonaer segments beneath the railway
no longer disappear because of their `covered` tag. Added paving avoids the
school stairs, original GRIPS courts, arcades and U9 approaches. The
[street review](hansaplatz-streets-v140.md) records exact source identities and
the bounded 310 × 300 m presentation window.

School and sculpture use 549,320 static buffer bytes in four drawn batches,
or 255,136 bytes in two Minecraft batches. Native street paving adds one batch
with 6,188 cuboids / 471,128 bytes, storing exposed cells without hidden fill.
The new architecture and street geometry is identical on full/mobile profiles.
Minecraft construction yields after GRIPS, school and street construction;
cancelled construction releases the already-owned provisional root.

Browser controls now explain WASD movement, arrow-key looking,
left-drag looking and Minecraft-style held Space/Shift ascent/descent directly
in the dock. Vertical flight remains independent of WASD and arrow inputs.
Walking retains its established jump and sprint. See
[browser controls](browser-controls-v140.md) for the mapping and official source.

## Rendering change

The existing projection fade already makes subpixel ink fully transparent in
far views. Three still submits those zero-alpha lines. The viewer now skips only
exactly zero-opacity, normally blended transparent ink with no depth/stencil
writes and known alpha-preserving shader hooks. Positive opacity, including tiny
nonzero values, custom shaders and authored render callbacks retain their draws.
The optimization owns material visibility only; it does not hide objects,
children, geometry, facades, trees or buildings. Mode transitions release that
ownership before recolouring or replacing materials.

Constant-radius pan/orbit reuses the ink fade calculation. Fine ornaments still
resolve their actual camera-to-bounds distance on every changed camera position.
No projected-size threshold, detail range, source geometry, resolution, camera
range, shadow setting, antialiasing or movement speed is reduced.

GPU preparation treats suppressed ink as authored-visible. Its existing bounded
zero-vertex upload pass temporarily enables those materials, then restores their
visibility in `finally`. Prepared buffers remain resident, including for future
close views, and visibility suppression alone does not requeue their upload.
Known temporary residency observers preserve eligibility; authored callbacks do
not. Disposal remains weak-reference based for the new tracking sets.

Civic flag animation also uses its existing collected target list rather than
scanning unrelated scene geometry on each wind tick. Exact flag vertex and
instance arrays match the previous updater; detached targets stop updating.

## Controls and rendering validation

- The final complete frontend suite passes **2,116 tests across 272 files**,
  with **8,387,706 assertions and zero failures**.
- Chrome keyboard checks pass 16 Space/Shift with movement/look combinations
  across fine and coarse pointer profiles. Key releases have 0 m measured drift.
- Six German/English dock layouts pass at 1280 px (fine/coarse) and 1440 px
  (fine), including button, legend, attribution and selection-card bounds.
- A 1440 × 900, DPR 1, reduced-motion Day panorama compares the same complete
  runtime synchronously with the skipped draws re-enabled and disabled. All
  **1,296,000 pixels are identical**, including a repeated optimized render.
  Calls fall from **13,187 to 12,546** (641 / 4.86% fewer); both render exactly
  **50,509,461 triangles**. All 720 collected ink materials have zero opacity
  at this pose. This is a framebuffer-equivalence check, not a simplification.
- Paired Chrome/ANGLE Metal Apple M4 motion profiles of the controls/rendering
  revision, before the school/street additions, use the same 1440 × 900,
  DPR 1 Day panorama, five seconds per phase, and CPU profiling in both runs.
  Mean orbit RAF interval changes from 22.97 to 21.89 ms (about 43.5 to 45.7
  observed RAF/s); mean renderer CPU submission per RAF changes from 16.20 to
  14.86 ms. Orbit p95 remains 50 ms. Flight mean interval changes only from
  20.48 to 20.32 ms. These are modest measured gains on this machine, not a
  universal 60 fps guarantee; CPU profiling and input delivery affect timings.
  Reproduce with `scripts/profile_viewer_motion.py --locations panorama`.

- The focused controls/rendering group passes 150 tests and 5,213 assertions.
- The complete 440-test Python suite and Ruff format/lint pass. TypeScript,
  production build, static packaging, release readiness and local package HTTP
  inventory checks pass for the final v1.0.40 build.
- WebKit's injected WebGL context-loss test preserves the camera through one
  recovery and stops after a repeated loss instead of starting a reload loop.
- Chrome Pixel 5 emulation passes Day, Night, Snowstorm, Schwellenraum,
  Minecraft and return to Day, including the mobile menu and joystick, with no
  page/console errors or context loss. Physical phone hardware is not available.

## Final architecture validation

Production Chrome views of the school, Aula, hand, streets and GRIPS entrance
were inspected in Day and Minecraft, with school/Aula/hand also checked in Night.
All 13 poses complete without page errors. The final hand has a paved connection
to the retained footway and no fingernail/finger surface intersections.

Independent synchronous Minecraft builds match the cooperative construction
byte for byte, including the added geometry and all instance capacities:

| Profile | Instances | Renderables | Buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 3,848,744 | 119 | 293,523,465 | `1faae9cbc20975af16d328b73338433fa5f124c32c0efcb8add1ff9954d74048` |
| Mobile | 1,065,880 | 117 | 81,576,345 | `ada8090508de99f3f5589bceada55e612288b5ddc5ce9a3d5724a69df5428992` |

The construction lifecycle tests also exercise cancellation immediately after
school allocation, disposal of every unpublished buffer exactly once, current
camera continuity and rollback without removing independently loaded siblings.

The final packaged viewer passes a fresh desktop Chrome start and a fresh
touch WebKit start with no page/console errors or critical request failures.
WebKit reports only its existing ignored `interactive-widget` viewport advisory.
Both engines pass the real mobile-menu gate across five portrait, landscape
and tablet layouts, hidden chrome, first-visit landmark navigation and all five
visual modes. These are automated browser checks on this Mac, not physical
older-iPhone memory or frame-rate measurements.

## Release artifacts

The static package contains only the current build. Pages deployment retains
previous hashed assets for already-open visitors. Download verification:

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| Local ZIP | 15,024,692 | `3a2e6aeb8b3cd9026f46ea8ab104b245188920d662cd9b28fca7a70a993fa2ad` |
| Static viewer tar.gz | 14,852,933 | `b6a67f0a1e7b3e4b31eeb5b5c0d679ffdfe00d33032c0b04557c9535cdcebb29` |
