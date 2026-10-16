# v1.0.123 — flight entry, quiet loading and bounded source lifetimes

Step 10. The owner corrects the automatic walking arrival, reports continued
early resets and slow loading, and asks that the minimap not appear while loading.

Ordinary entry keeps the requested Neue Nationalgalerie area, using its existing
catalogue flight focus: target [-305.13579248450696, 8, 1322.372333274223], the
normal orbit direction, equivalent 190 m framing and the established 16° lens.
The camera starts about 102 m above local ground. Walking is optional; explicit
place/theme links and restored navigation retain priority. The real gallery
must be present before the loading curtain opens. The separate Reichstag reset
view, gallery podium and walking controls are unchanged.

App does not mount navigation controls or the pedestrian minimap until actual
presentation readiness. This also applies while a mobile mode-family remount
recovers its pose. Walking subsequently mounts the same full minimap normally.

Repeated lossless parking formerly accessed already-parked geometry arrays before
recognizing that no work was needed. It now skips them before reads and checks
shared-buffer ownership by metadata. Alias protection and exact restored bytes
remain intact. A same-machine synthetic repeat over 32 parked 1 MiB arrays went
from 32 inflations (33,554,432 decoded bytes, 156.67 ms) to zero (2.79 ms). This is
a helper benchmark, not a physical-phone RAM or startup-time guarantee.

The progressive surface worker now drops its own unused `ground_rows` immediately
after parsing, before parsing the next surface graph or waiting for upload ACKs.
The shipped ground payload has 173,973 such row arrays / 517,017 numbers. Surface
and restored-road construction use the retained height grid. Production-function
probes for full/mobile and fresh/resumed construction require zero raster reads,
identical terrain samples, source IDs and batch IDs, and unchanged caller data.

Shared terrain helpers are separated from the Minecraft city constructor. All
32 moved declarations retain their exact released source hashes; native full and
mobile world fingerprints are unchanged. Ordinary entry no longer imports the
native constructor eagerly. The built viewer's static module graph decreases
from 54,165,412 to 49,467,534 bytes (4,697,878 bytes / 8.67% deferred). These are
uncompressed production JavaScript bytes, not an equivalent network-time claim.
The native builder is loaded only after confirmed mode intent, with cancellation
checks after its import as well as its required source/site preloads.

All source geometry, materials, resolution, view distances and residency budgets
remain intact. Temporary WebGL recovery continues in-place as in v1.0.122; a
browser process killed by the operating system cannot be certified away by an
emulated phone profile.

Validation on the production build:

- Six actual chooser starts each in desktop Chromium and iPhone-profile WebKit:
  identical gallery flight pose, gallery present before readiness, no minimap or
  navigation HUD while busy, no initial pedestrian-map image request, no page
  errors or spontaneous graphics resets. Optional walking descends from the
  existing height, reveals the map, and returns to flight without a map.
  A local WebKit timing sample is 13.98 s to readiness versus 11.95 s for v122;
  camera framing and concurrent test load differ, so this does not establish a
  latency improvement. The verified improvement is fewer initial code bytes and
  avoided transient allocations. The final Normal resource trace contains no
  MinecraftVoxelWorld constructor request.
- iPhone-profile WebKit: real double/triple taps, held movement over a hurdle,
  gentle descent, a deliberately wedged rescue, and two forced WebGL losses all
  pass. Recovery preserves the same runtime, scene, world and camera.
- A 28-view iPhone-profile WebKit tour with four Normal/Schwellenraum visits
  completes without errors or spontaneous WebGL loss. GPU buffers peak at
  266,565,241 bytes and end at 244,665,813 bytes; allocations are released between
  locations. These are GPU buffer counts, not total browser or device memory.
- Full Python partition: 1,225 pass, four skip, one stale immutable-source import
  receipt fails. Its narrowly updated import-line projection passes all four
  tests in that file, without changing the original fixture or geometry checks.
  The 90 release/launcher/recovery validation tests pass (six overlap the full
  partition). Release-readiness and the packaged local launch both pass v1.0.123.
- The complete isolated Bun suite passes 3,425 tests across 523 files, with no
  failures; the new builder-import cancellation matrix also passes all 15 tests.
  The production build, TypeScript check, repository Ruff checks and diff checks
  pass. No source geometry or original immutable source fixtures were changed.
