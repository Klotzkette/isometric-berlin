# Funkturm fittings and exact proxy repair — v1.0.99

This bounded addition refines the existing Funkturm at OSM way `30926247`,
world X/Z `(-6367.441, 1395.843)`. It adds four visible steel/porcelain foot
bearings, open repeated stair flights beside the retained lift, the restaurant's
lower kitchen band and inclined glazing, its pale cantilever canopy edge,
platform guardrails and small mast aerials. The existing lattice tower, elevator,
platforms and all previous source records remain unchanged.

## Evidence and limits

Messe Berlin's [operator facts](https://www.messe-berlin.de/de/veranstalter/locations/funkturm/fakten)
and [site page](https://www.messe-berlin.de/de/veranstalter/locations/funkturm)
provide the 147 m tower, restaurant at 55 m, observation platform at 126 m,
20 × 20 m base and 610 stairs. Those heights agree with the retained tower.
The new 30 repeated stair flights contain 600 displayed treads: an explicitly
illustrative outside reading, not a surveyed reconstruction of all 610 steps.
Local steel sections, foot hardware, kitchen dimensions, glazing splay and
canopy widths are photo-informed estimates. No survey accuracy is claimed for
those fittings, nor are existing approximate platform dimensions silently changed.

Six inspected, freely licensed Commons references are recorded individually in
`geo_data/regierungsviertel/funkturm-v199-visual-references.json`, with author,
license, exact file page, purpose and inspected-image hash. Photographs remain
external references; no pixels or textures enter the viewer. Four LarsMueller
images are CC0; the restaurant image is Schelbypicture's CC BY-SA 4.0 and the
bearing photograph is Denis Apel's CC BY-SA 2.0 DE. The references are distinct
from the retained OSM/official-LoD2 source geometry.

`funkturm-v199-evidence.json` retains hashes of all four earlier tower/source
files. The source-bound centre and earlier 3.55 m world ground datum are reused;
this addition introduces neither a new terrain field nor a second tower shaft.

## Two residual generic owners

The full former generic owners `DEBE04YY500006Zr` (shaft) and
`DEBE04YY50002bpq` (restaurant) already belong to the complete v187 named source
model. However, floating-point footprint subtraction left two effectively
zero-area restaurant slivers in `outer187--13_2`. Their walls still rose to
59.82 m, obscuring the open tower. This is not missing real surrounding fabric.

`repair_funkturm_packets_v199.py` removes exactly eight drawn triangles, six
roof-edge segments and two navigation slivers whose footprint and top height
match those owners. It leaves every mesh position/color attribute and every
unrelated triangle/index order unchanged. Native output is byte-identical.
Complete original packets are retained as compressed checkpoints, with hashes
and a face-by-face receipt in `funkturm-v199-packet-repair.json`. Their complete
original source sheets remain in `west-landmarks-v187-source.json`. The shared
v187 builder now excludes only these complete transferred owner IDs before
clipping, so reconstruction cannot resurrect the same degenerate slivers.
The separately documented ICC repair shares the publication operation but has
separate owners and receipts.

## Runtime and reproduction

`createFunkturmV199(minecraft = false)` in `FunkturmV199.ts` allocates only the
selected representation. Four spatially bounded groups use frozen transforms,
computed mesh and instance bounds, shared unit geometry, and tracked alternate
materials. Drawn form has 974 boxes, 505 small members and 800 skin triangles;
the independently generated Minecraft form has 4,186 orthogonal boxes and no
sloped skins or rotated rods. No textures, dynamic lights, timers, new city
residency limits or reduced mobile detail are introduced. The constructor-only
`groups` arrays are suitable for the existing weak decoded-data cache.

Reproduce the addition with `uv run python scripts/build_funkturm_v199.py`.
Reproduce the isolated packet repair from its retained checkpoint with
`uv run python scripts/repair_funkturm_packets_v199.py`; it stages a receipt and
single-chunk descriptor patch, rather than overwriting public manifests.
Focused checks are `uv run pytest tests/test_funkturm_v199.py
 tests/test_west_landmarks_v187.py -q` and, in `src/app`,
`bun test tests/funkturm-v199.test.ts`.

Useful world camera poses (position → target, FOV 45°):

- Whole tower: `[-6260,125,1560] → [-6367.441,75,1395.843]`.
- Restaurant: `[-6347,70,1420] → [-6367.441,60.5,1395.843]`.
- Northeast foot: `[-6352,6.2,1413] → [-6357.441,4.4,1405.843]`.
- Upper platform: `[-6353,143.4,1415.8] → [-6367.441,132,1395.843]`.

Visual QA uses both old named tower models plus the new fittings, in drawn and
native forms; full-city QA also checks the repaired generic packet. This document
records implementation and verification scope, not a claim of publication.
