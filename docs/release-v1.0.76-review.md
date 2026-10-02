# v1.0.76: Weinbergspark and Zionskirche terrain

Step 10 replaces the flat outer-district ground around Weinbergsweg,
Weinbergspark and Zionskirche with the locally sampled official Berlin DGM1.
The source samples rise from 37.12 m NHN at Rosenthaler Platz to 53.52 m NHN
at the church: a 16.40 m difference. This rise is not visually exaggerated.

[Source acquisition, datum, licence and exact sample evidence](../geo_data/regierungsviertel/weinberg-v176/README.md).

## Placement contract

The scene uses NHN minus 30 m. The bounded 10 m terrain grid retains the
source values in the central rectangle x=1950–2410, z=−1880–−1150. A smooth
transition apron ends at x=1830–2550, z=−2040–−1030. That apron is a display
transition to the existing flat surrounding districts, not a survey claim
about their terrain. The original measured core remains unchanged.

Ground and paths use the same piecewise planar grid as pedestrian navigation,
including before the streamed city has loaded. Buildings keep a single rigid
vertical translation per source parent. Their wall, roof, courtyard, window,
material and ink geometry must remain intact. The church's LoD2 ground datum
of 53.332 m NHN remains distinct from the nearby DGM sample. Both drawn and
native modes retain that building placement. Minecraft terrain uses separate
4 m horizontal terraces, with matching walking heights.

The park pond and Plansche retain their mapped footprints and horizontal
water surfaces. The Plansche floor stays below the water; the native reading
uses bounded orthogonal edge subdivisions. Mutable manifests revalidate, and
content hashes in packet URLs separate new terrain assets from older caches.

The Heine monument, playground, local park trees and the four v1.0.75
frontages move with their respective anchors. No new city bounds or tour
stops are introduced. Flood mode keeps its deliberately horizontal water
table; it does not lift the water with the hill.

## Verification

The v169 historical flat-ground replacement accounting is checked against its
last flat release, v175. Current v176 geometry is independently checked against
all original packet faces, their colours and ink through source-to-output
receipts. The live v169 source-leaf check still examines the shipped packets,
using each whole parent's vertical offset, including cross-packet buildings.
Ground subdivisions preserve horizontal coverage; source architectural faces
remain exact rigid translations. Unrelated packet blobs remain byte-identical.


The final packet audit covers **49 source packets**, retaining all **3,616,210
source triangles**. Ground subdivision and native terrace sides produce
**4,262,729 triangles** without reducing source architecture. The original
packet transfer, decoded-memory, vertex and index ceilings remain enforced;
a geometry-only companion handles the one native overflow. The eager building
offset map is 87,830 bytes.

- `uv run ruff format .` and `uv run ruff check .`: passed.
- Six affected Bun test files: **51 tests passed**.
- Terrain-packet fixtures and live preservation checks: **38 tests passed**.
- Complete live v169 leaf/appearance/navigation proof: passed.
- `bun run build`: passed.
- Release-readiness and offline-package launch checks: passed.
- Desktop Chrome: six final samples (three views in Day and Minecraft), no
  page errors, crashes or context loss; instrumented buffer peak 324,449,078 B.
- WebKit with an iPhone 13 profile: fourteen final samples across Day,
  Schwellenraum, Minecraft, Night, Snowstorm, Flood and return to Day; no page
  errors, crashes or context loss; instrumented buffer peak 114,116,346 B.

These counters measure tracked WebGL buffers, not total device RAM. Browser
phone profiles do not constitute a physical iPhone memory-limit guarantee.
All sampled modes expose the same approximately 16.4 m ground-height rise;
walking terrain is available before the surrounding geometry finishes loading.
The full Python run completed with **845 passed** and one obsolete v167
assertion requiring the V166 renderer file itself to stay byte-identical.
The renderer must change for this terrain work. That assertion now continues
to require byte-identical V166 source data and bounds, while the Bun suite
checks the actual unchanged ground outside the hill, including Monbijou.
The corrected Python check passed separately. No production code or asset
changed after the full run.
