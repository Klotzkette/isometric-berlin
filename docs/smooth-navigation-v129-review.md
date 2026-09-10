# v1.0.29 movement, surface navigation and compact controls

Pipeline step 10. This release addresses two independent faults: unnecessary
GPU work during ordinary desktop motion, and losing the mobile controls or the
surface view during navigation. Source geometry and all visual modes are retained.

## Rendering

Large immutable opaque park instance batches are partitioned into 256 m cells.
Three can reject offscreen cells instead of submitting a citywide tree batch
whenever any of its bounds crosses the frustum. This is spatial rejection only:
no tree or source instance is removed, no triangle is simplified, and no distance,
resolution, antialiasing or movement-speed setting is reduced. Transparent,
animated and custom-callback instances retain their original batches. Cell boxes
and spheres include the complete transformed geometry at every boundary.

Geometry and materials remain shared. The complete canonical ParkDetails payload
was compared against source `8740ce5` after sorting by exact instance identity,
including geometry attributes, indices, groups, draw ranges, material values,
world matrices, instance matrices and colours, visibility and shadow flags:

| Profile | Instances | Instance bytes | Equal canonical SHA-256 |
| --- | ---: | ---: | --- |
| Full | 450,029 | 33,793,136 | `ff4dfd766aa6b29428ca467e7716c9b37d58a8795bc714c7ab32d13d9256b5c8` |
| Mobile | 107,237 | 8,001,332 | `12ed095c82fd3e02cfd593638159f821e939e35814ad1119687cc5186a8ff9b8` |

The full park now stores 5,373 instance batches and mobile 1,461; only intersecting
cells are drawn. These are stored counts, not per-frame draw calls. Repeated path
array spreads are replaced by ordered pushes. GPU preparation now amortizes its
scene traversal over up to 32 small objects while keeping the existing 2 MiB
per-task byte limit and one-indivisible-large-buffer exception.

Camera-only movement no longer invalidates the static light-space shadow atlas.
Actual geometry, light, focus and visibility mutations still invalidate it and
retain a refresh while the camera is moving. Shader diagnostics remain enabled. The remaining 167 ms cold-orbit long task
in the initial profile contained 129 ms in the first AudioContext constructor.
Mouse-down on the canvas/joystick now leaves audio startup to the completed
trusted click; touch completion and explicit sound buttons keep their activation
path. This avoids charging the first drag with device/audio-graph initialization.
It follows [Chrome's Web Audio activation policy](https://developer.chrome.com/blog/autoplay/)
and does not start audio from a timer before user activation.

## Camera and menu behavior

A close flight view keeps at least 1.2 m clearance over sampled terrain. Its orbit
stops three degrees above the horizon; near pinch zoom cannot cross the focal
point and reverse the camera beneath the model. The guard translates the rig
vertically when required without slowing horizontal motion or changing its
heading. Walking retains its separate ground solver. Surveyed tunnel interiors
and portal approaches remain exempt. A wide view with at least 250 m half-height
can still inspect the model from below; this threshold accounts for lens FOV.

The compact mode button is a direct viewport control outside the hideable header
and toolbar. It remains at bottom-left with chrome hidden and restores controls
when opened. The light toggle is pinned next to the five mode choices instead of
being buried in the scrolling action grid. Short landscape panels allow room for
both the pinned choices and usable scrolling actions.

## Reproducible checks

Use `scripts/profile_viewer_motion.py` against two locally served builds on the
same otherwise idle machine. It starts fresh Chrome contexts at 1440×900, DPR 1,
Day mode, with identical poses and pointer/keyboard trajectories. It reports all
RAF intervals, including stalls, and all renderer calls before compositor resets.
CPU submission timing is not asynchronous GPU timing. The three fixed images
from `scripts/compare_viewer_frames.py` include the canvas bounds and overlaid UI.

The local reference machine is Apple M4, Chrome 152.0.7977.83, ANGLE Metal.
The initial view submitted about 55.9 million triangles per rendered frame.
The unpartitioned park submits citywide crowns even when only some trees are in
view. The controlled pointer/flight comparisons below reproduce the expensive
active frames in fresh contexts, independently of accumulated browser memory.
An early exploratory keyboard probe exposed a separate input bug: the first
audio activation changed React callbacks, tearing down the keyboard listeners
and clearing the held key. Its 100 ms intervals therefore sampled idle flag
redraws, not continuous movement. The audio toggles now read current audibility
from stable refs, preserving held navigation across playback-state updates.
`scripts/smoke_keyboard_audio.py` tests fresh first-key orbit and flight, audio
activation, continued displacement and stopping on release. The performance
profiler also rejects active phases without measured camera displacement.

The three settled Day images at Kanzleramt, Washingtonplatz and Tiergarten were
visually reviewed. Pixel differences cover 0.287%, 0.309% and 0.293% respectively;
mean absolute channel error is below 0.0025/255. The remaining differences include
overlaid controls and tiny raster variations. No missing scene geometry was seen;
the complete canonical geometry comparison provides the stronger content check.

Physical iPhone and Windows GPU performance cannot be inferred from this local
machine. Chrome touch and WebKit checks establish input/layout behavior only.

## Comparative result and validation

The final spatial/shadow/32-object preparation build, before the last audio
completion adjustment, gives the following same-machine samples. Average FPS
is 1000 divided by the mean RAF interval, not an instantaneous peak.

| Place / input | v1.0.28 average FPS | v1.0.29 average FPS | p95 frame interval before → after |
| --- | ---: | ---: | ---: |
| Chancellery orbit | 42.1 | 57.3 | 50.1 → 16.8 ms |
| Chancellery flight | 28.3 | 55.5 | 66.7 → 33.3 ms |
| Washingtonplatz orbit | 43.9 | 59.7 | 50.0 → 16.8 ms |
| Washingtonplatz flight | 26.9 | 60.0 | 66.7 → 16.8 ms |

Neither final flight sample has a frame above 50 ms. The first Chancellery orbit
still includes the separately identified audio-initialization task (183.3 ms
maximum frame), which motivated the completion adjustment described above.
These are local samples, not a 60-FPS guarantee for every graphics device.

- All 410 Python tests and Ruff format/check pass.
- The focused spatial, terrain-camera, shadow, GPU-upload and audio checks pass.
- Actual desktop and Chrome touch inputs pass sustained upward/downward orbit,
  descent, repeated close pinch/wheel zoom and orange-joystick motion; sampled
  close cameras remain above terrain and never enter automatic underside mode.
- Compact menu checks cover five viewport sizes, five modes, native scrolling,
  first-visit attribution, hidden chrome recovery and reversible light toggles.

- Full frontend sweep: 1,973 cases across 248 files, with 1,952 initially
  passing. The 21 failures were two extraction harnesses missing the new
  production shadow invalidator, the former single-mesh shrub assertion, and
  the boundary-rest case loaded before its final tolerance update. Both harnesses
  now execute the real invalidator; the shrub check sums every retained cell.
  Final rerun of all affected suites: **95 cases / 2,725 assertions, all passing**.
- Desktop look/movement, walking jumps and 3D-only WebGL recovery pass through
  the production UI. The walk-entry fixture now starts above the new close-orbit
  limit instead of deliberately asking the surface camera for an out-of-range pose.
- Chrome verifies zero AudioContext constructions during the first mouse drag,
  followed by successful construction at release with no autoplay warning.
- WebKit verifies the pinned night-light toggle and scrollable actions at
  568×320, 320×568 and 844×390, in addition to the general compact-menu sweep.
- The eight source and packaged mesh files remain byte-identical to v1.0.28.

- The fresh first-key regression reproduces zero movement in v1.0.28. In the
  final build, both ArrowRight and W continue through four 800 ms samples
  while audio becomes audible, then have zero measured drift after release.
- An independent read-only review found no blocking camera/menu regression;
  all four authored tunnel-mouth cameras pass the physical interior tester.
