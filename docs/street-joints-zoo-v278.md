# Repeated curb nodes and native Zoo wolf — v278

This continuation corrects two existing presentation defects. It does not claim
new building reconstructions, surveyed road alignment, animal locations or
complete new Zoo coverage. Original Berlin LoD2 and OSM source attribution remains.

## Repeated curb source points

The real retained street line `districtStreets.curbs_m[1980]` repeats
`[-208.05, -668.83]` at indices 11 and 12, between `[-208.14, -661.77]`
and `[-209.51, -668.61]`. The previous helper treated each duplicate as a
one-sided endpoint. It produced offsets `[0.109991, 0.001402]` and
`[-0.016390, -0.108772]`, so the renderer triangulated a twisted top across
a zero-length source edge. The correction uses the nearest distinct neighbours
for every member of the same run, including a closed contour's repeated seam.
All original route points, true corners, widths, heights and mesh/index counts remain.
Zero-length segments become truly degenerate rather than overlapping positive
area. Independent orthogonal native street construction is unchanged.

Both actual helper sources contain 3,707 lines and 86,638 points. Their 1,725
zero-length edges previously contained 3,065 positive-area Float32 top triangles
(total absolute triangle area 0.374011393 m²); the corrected count is zero.
Only 3,056 duplicate-point cross-sections change; all nonduplicate offsets are
bit-identical. Both complete source files remain byte-identical. The longest
identical run is two points, including cyclic seams. The helper is terminating
on wholly degenerate lines; hypothetical much longer repeated runs would have
quadratic total scan cost, unlike the current bounded source inventory.

## Native Zoo wolf

The third Zoo wolf's illustrative 0.4-radian pose rotated component centres
without independently changing the axis-aligned native component extents.
Consequently a rear leg and paw and one eye became disconnected. Native wolves
use coherent quarter-turn poses; the drawn animals remain unchanged. Body,
head, legs, paws, ears, eyes and tail remain, at the existing anchored position
and within the existing enclosure. This is a display correction, not a new
species or live animal census. Existing current European wolves remain distinct
from historical polar-wolf stock.

## Verification

The focused street checks pass all 16 tests (1,316,790 assertions). Zoo checks
pass all 15 tests (2,420,181 assertions). The complete Zoo keeps its original
2,491,692-byte drawn and 7,348,608-byte native submissions; all 63 native wolf
components remain. Drawn Zoo geometry is byte-identical to the preceding release.
An independent reviewer checked 145,636 helper calls over exhaustive small point
sequences and the actual native wolf Float32 connectivity, with no finding.

Type checking, Ruff formatting/lint, the production build and the local package
HTTP check pass. Both deterministic archives pass the complete original
ZIP/tar validators while held sequentially in RAM; no duplicate archive files
were written to the nearly full local disk. Their final upload digests must
match these prepublication receipts.

Internal-IAB comparison used the real before/after Float32 curb buffers and
all 21 real native wolf matrices, under identical camera/colour settings. The
packaged city reached Brandenburger Tor, accepted two zoom-outs, switched from
Day to Minecraft and returned to Day without captured console warnings/errors.
This is bounded desktop smoke testing, not physical-phone or endurance testing.
The temporary comparison page/data were removed; the internal tab and local
servers were closed. Local screenshots are hashed in the verification receipt.

The Pages preflight retains both preceding live asset closures and stays at
1,010,685,474 bytes, 63,056,350 bytes below 1 GiB. Final full-suite and publication
results are recorded in `street-joints-zoo-v278-verification.json`.

The full Python suite passes: **2,107 passed, 4 skipped**, in 2,501.56 seconds.
Two pyogrio CRS warnings originate in the existing elevated-road fixture test.
Both final archives match their prepublication SHA-256 digests and GitHub
asset digests. Release v1.0.178 and Pages commit
`3157543c926d017334277481231009b3736536c9` are public. Live HTTP byte checks
match the prepared package, including both changed street chunks and the Zoo
chunk. The three withdrawn Columbiahalle recording URLs still return 404.

The additional public IAB start reached the active v1.0.178 scene without
captured console warnings/errors. It selected Richard Serra (47/93), where a
large grey surface obscured much of the opening view. This is recorded as a
**separate unresolved framing finding**, not a successful visual framing check.
No camera/startup or nearby building geometry was edited in v278. The existing
source-bound curb and wolf before/after checks remain independently verified.
Read-only geometric diagnosis finds the intended 16-degree startup camera's
target ray intersects Philharmonie roof part `XzEkeXsu` after 3.323 metres
(surface group 71, triangle 1, colour `#c2c8c8`). The original 39-degree pose
has no intersection with the concert-hall source triangles on its target ray.
All ten inspected startup/viewer/junction/concert-hall files are byte-identical
to v1.0.177. The existing camera dolly is therefore the likely cause; the
precise screenshot-pixel attribution remains an inference without a live raycast.

## Research boundaries

Small official bDOM/DGM readings suggest that source parent `DEBE11YYI0000Nwj`
by the Tierpark flamingos may be too tall. One interior point is much higher
than the other six; the actual roof profile and vegetation separation have not
been established. `DEBE11YYI0000Lb6` has still more mixed readings. Neither
original building is shortened or concealed in this continuation.

Two Berlin Decks bridge footprints, OSM `1564406051` and `1564406052`, and their
upper elevations are retained in the v277 source evidence but excluded from
its active building contract. Their lower clearance and railing profile need
further reference verification before any complete independent model is added.
The existing complete v277 buildings and their navigation remain unchanged.
