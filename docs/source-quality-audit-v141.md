# Source and presentation quality audit — v1.0.41

The Invalidenpark screenshot exposed a real, persistent mobile presentation
omission. It was not merely delayed building refinement, and preserving the
source files did not make the previous mobile result visually lossless.

## Historical findings

All eight committed runtime payload files in
`src/app/public/mesh/regierungsviertel/` are unchanged between v1.0.28 and
v1.0.40. The complete Sinkende Mauer data and detailed constructor remain
available. The missing result comes from which constructors the renderer runs.

| Change | Observed effect before this restoration |
| --- | --- |
| `5144490`, mobile residency | Mobile passed `smoothSurfaces: null` and its worker returned after buildings. Exact water, basin, sunken-wall, park, special road and lane-marking families were never installed. Coarse raster surfaces remained permanently. |
| `94c4268`, v0.72.29 | Both device profiles stopped constructing exact asphalt and paving. The renderer substituted raster roads and park paths. Later district street models repair bounded windows but do not cover every source polygon. |
| `94c4268`, then `a74015a` | Desktop exact building detail was capped at 12,000, then 9,000 source parts. In the current 29,818-part source, 20,818 parts remained permanently at envelope detail even when approached. |
| Existing mobile architecture and park profiles | Several facades had fewer windows or mullions; trees, playgrounds, wall traces and ornaments used simpler models. These are real presentation differences, not source deletion, and must not be described as pixel-identical quality. |

The v1.0.33 packed source/ground records and v1.0.36 exact geometry indexing
are different: those preserve source values and rendered vertex/triangle
attributes. The v1.0.40 zero-opacity ink suppression also removes only already
invisible draw work. Reverting those does not restore the omitted families.
The explicitly requested reduction of Minecraft tree population is separate
from these unintended losses.

## Delivered source inventory

The retained `surface-polygons.json` contains 175 water polygons: 76 rivers,
39 ponds, 37 basins and 23 streams; one sunken wall; 2,193 park polygons;
2,081 scrub points; 2,052 lane-marking records; and 3,158 road polygons
(948 asphalt, 1,483 paving, 439 sand, 207 earth, 56 metal, 25 wood).
These are source records, not independent rendered-object counts. Dedicated
models may intentionally replace a source surface, and neighboring water
polygons must retain shared-boundary context to avoid false quay walls.

## Building restoration contract

Both desktop and mobile now partition the entire source inventory into stable
spatial districts. No source part is permanently omitted from exact-detail
eligibility. All source envelopes remain available before refinement and are
restored before evicting a district, preserving roofs and open courts during
fast travel, pause/restart and mode changes.

Desktop uses 600-part construction batches and up to 15 requested districts,
with a 9,000-part exact-detail budget in addition to its initial 420 parts.
This retains at least the previous desktop detail capacity rather than
substituting the smaller phone budget. There is no additional desktop cache
of previously visited districts. Its view sampling extends to the published
6,450 m presentation radius. Mobile retains 240-part batches, up to 3,600
requested parts and its existing bounded 4,800-part return-trip cache.

This is a camera-following detail residency limit, not source deletion.
Envelopes outside the resident detail selection remain visible. It does not
mean every window in all 29,818 source parts is held in memory simultaneously,
nor does it guarantee zero refinement latency while crossing the entire city.
The worker and viewer use identical partitions and resume IDs; a settled
view keeps the worker available for the next requested location.

## Surface scheduling contract

Both device profiles now construct the retained park polygons, scrub points,
sand/earth/wood/metal roads and lane markings. Mobile installs the complete
exact water family before its initial curtain opens; desktop installs that
same globally aware family in the worker. Asphalt, paving and kerb batches
use the bounded road payload instead of the old disabled constructors.

Every surface packet is acknowledged after viewer attachment before the
worker constructs another surface packet. At most one surface and one
building packet coexist in flight. The worker reports a view as settled only
after all its surface families and the requested building revision finish;
a missing road attachment cannot prematurely start deferred park details.
Resume IDs cover buildings and each surface/road batch, so already attached
geometry is not rebuilt when returning from Minecraft or a paused tab.

Terrain and decoded surface data live in a separate construction scope that
ends after attachment. The worker stays available for later building views
without retaining those temporary terrain/surface object graphs.

## Regression checks

The building tests account for every actual delivered source ID, demonstrate
exact-detail eligibility for all 20,818 previously omitted desktop parts,
check deterministic resume partitions and enforce desktop/mobile residency
budgets. Production viewer functions are exercised for rapid travel,
restoring coverage before disposal, stale in-flight packets, warm return,
mode relighting and pause/restart. The complete envelope geometry remains
within the existing 32 MiB test budget on both profiles.

The worker tests exercise the production scheduler with isolated geometry
factories: every fixture surface source record is forwarded once, water is
not duplicated on mobile, and held surface/road acknowledgements block the
settled message. Both profiles are checked for partial and complete resume,
stale revisions and travel beyond the original detail selection without
refetching source data. Six focused progressive/building/lifecycle test files
pass 86 tests and 4,405 assertions; TypeScript checks pass.

The selected desktop exact-building constructor output at the standard
Hauptbahnhof view measured 59,267,028 bytes before transfer compaction. The
previous fixed selection measured 51,320,568 bytes. Selection now covers
different source parts and also allows the initial 420 parts outside the
9,000-part resident budget; this restoration is not a claimed desktop memory
reduction. The test bounds this constructor allocation at 64 MiB. It does
not measure browser-wide RAM or GPU allocation.

Surface and architecture restoration still needs independent rendered
geometry and visual checks in addition to scheduler tests. A passing test
that merely asserts a constructor is skipped cannot establish visual
quality. Full device and release validation belongs in the release review;
this audit alone is not a claim of physical iPhone crash immunity or global
visual equivalence.
