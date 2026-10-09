# v1.0.98 — exact navigation storage

Step 10. The owner still reports returns to the startup chooser, especially on
phones. This revision reduces measured memory overhead while retaining rendering
precision and the existing recovery path. It does not identify every physical
phone process termination or claim that crashes have become impossible.

The drawn Alt-Mitte navigation used 75,029 roof triangles held as 300,116 nested
triangle/vertex arrays, plus 75,029 derived index records. The production source
now uses one contiguous IEEE-754 Float64 coordinate buffer. A second Float64
buffer holds the same denominator and bounds used by the existing 16 m spatial
index. Interpolation retains its original arithmetic order and tolerances.
All 675,261 coordinate values are bit-identical to the original JSON numbers.
Original navigation packets remain committed and authoritative; the generated
compressed storage includes their source hashes and its uncompressed checksum.

This is navigation storage, not a replacement roof model. The entire scene's
render-buffer bytes, vertex counts and object counts were unchanged in the
isolated before/after build. No source triangle, window, road, shore, visible
distance, resolution, speed or residency budget was reduced. Root-array JSON
modules also retain eager import and mutation identity while storing their
source literals with lossless gzip when that is smaller. The codec already
supports WebKit without relying on CompressionStream.

## Controlled local comparison

Fresh Chrome with a Pixel 5 touch profile, empty HTTP cache, same opening pose,
and 25 seconds after presentation; CDP requests garbage collection before the
final sample. These are host-browser measurements, not total physical-phone or
GPU-driver memory. Content additions were excluded from this isolated comparison.

| Post-collection storage | v1.0.97 | storage fix alone |
| --- | ---: | ---: |
| JavaScript heap |246,247,340 B|215,895,876 B|
| Backing storage |544,169,473 B|549,470,111 B|
| Combined |790,416,813 B|765,365,987 B|
| Scene render buffers |459,009,008 B|459,009,008 B|
| Scene vertices |15,593,629|15,593,629|
| Scene objects |9,993|9,993|
| Resident vertex/index/instance GPU buffers |236,055,989 B|236,055,989 B|

Net reduction: 25,050,826 bytes, about 25 MB. Presentation occurred at 5.20 s versus
5.30 s in this run; this is not a claimed startup-speed improvement. Coarse
one-second startup sampling is sensitive to GC timing and does not establish
an absolute peak or a peak-memory reduction.

The final combined release, including all new parks and the closed path sides,
measured 219,333,736 B heap plus 563,151,029 B backing storage: 782,484,765 B total,
7,932,048 B below the baseline in the same post-collection pose. Its scene now
contains 464,911,283 B of render buffers, 15,724,217 vertices and 10,063 objects,
reflecting the added content. Visible-pose resident GPU buffers remain 236,055,989 B.
The isolated 25 MB improvement must therefore not be advertised as the net saving
of the expanded final city. No page error or context loss occurred in this run.

A separate forced WEBGL_lose_context test in Chrome recovered to a new runtime
at the same camera/target/FOV. Weak references confirmed the old runtime and
scene were collected. Backing storage after recovery was effectively unchanged
(549,469,862 to 549,469,906 B); no page error occurred. This validates the existing
bounded recovery/disposal path, not an actual iOS operating-system memory kill.

## Verification

- Every packed coordinate and original source checksum compared, plus 150,058
  vertex/centroid roof queries across all original triangles.
- The retained 28,037-query fingerprint still matches the published v1.0.71
  roof, column, overlap and negative/native-boundary behavior.
- Complete committed JSON transform round-trips and eager/lazy/weak/strong
  import semantics passed, including the installed production bundler.
- 212 navigation, recovery and residency tests passed (832,242 assertions).
- Final combined content/browser/package checks are in the release review.

Regenerate with `uv run python scripts/pack_navigation_roofs_v198.py`.
