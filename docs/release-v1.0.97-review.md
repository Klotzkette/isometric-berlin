# v1.0.97 — Faster exact assembly and Linden corridor frontages

Pipeline step 10. The owner requests faster city assembly with no quality loss,
and more differentiated previously generic building fronts between Brandenburg
Gate, Dussmann and Friedrichstraße.

## Exact assembly, without reduced detail

A production Chrome profile of v1.0.96 found 425 small restored street packets
waiting an average of 18.19 ms between arrival and acknowledgement. Most of this
was the deliberate 16 ms attachment timer. An idle viewer now attaches the next
packet in its own cancellable browser task without that extra frame delay.
Busy-input deferral, the maximum deferral deadline and spacing after an exhausted
busy deadline remain unchanged. No synchronous queue drain was introduced.

The worker's building and surface producers previously waited on every pending
acknowledgement, including the other producer. Each now waits on its own packet.
There is still at most one building and one surface packet outstanding. The
final all-packet barrier, matching view-revision check, stale-view rejection,
cancellation, and explicit attachment acknowledgement remain in place.

Charité and Humboldthafen facade construction now prepares exact polygon
coordinates, bounds, height ranges and conservative wall-local candidate lists
once. Lists expand before queries outside the wall region. Hole tests, boundary
and upper/lower height decisions retain their earlier arithmetic. Caches are
constructor-local and are not retained by the rendered object. The new Linden
wall/instance construction arrays also use the existing audited weak-cache
lifetime, with exact restoration after collection; navigation ownership stays
unchanged.

No existing model, source vertex, road, path, shoreline, detail, material,
resolution, view distance, movement speed, residency allowance or tour stop is
removed or reduced. The new corridor frontages are a separate additive layer.

## Measurements

Fresh Chrome contexts, empty HTTP cache, Reichstag opening view, same local
static server, CPU sampling enabled, 38-second observation. The final build
already includes all thirteen new corridor owners. These are local observations,
not physical phone or public-network guarantees.

| Measurement (Pixel 5 touch profile) | v1.0.96 | Final v1.0.97 |
| --- | ---: | ---: |
| Preview commit after launch | 5.146 s | 5.005 s |
| Exact city completion after launch | 16.903 s | 9.614 s |
| Restored street packets attached | 425 | 425 |
| Mean street arrival → acknowledgement | 18.19 ms | 0.17 ms |
| Resident WebGL vertex/instance bytes | 235,262,165 | 236,055,989 |
| Peak WebGL vertex/instance bytes | 235,262,165 | 236,055,989 |
| Used JS heap after requested collection | 247,973,760 B | 247,897,556 B |
| Backing storage after requested collection | 543,038,702 B | 544,169,267 B |

Exact assembly completed about 43% earlier in the touch-profile observation.
The 793,824-byte GPU increase is exactly the complete new drawn facade layer.
Before adding this new layer, the optimized pipeline retained the identical
235,262,165-byte GPU inventory. The initial preview is essentially unchanged;
this improvement primarily eliminates waiting for full street/building detail.
GPU accounting excludes textures, driver memory and other processes.

A desktop comparison without a concurrent Python test suite completed exact
assembly in 22.045 s on v1.0.96 and 10.964 s on the final build; previews took
5.691 s and 4.876 s. An earlier baseline taken during the Python suite was slower
(29.641 s) and is not used for this comparison. Both final profiles reported no
page errors or context loss. These timings are individual measurements, not an
FPS benchmark or a universal device guarantee.

A separate Bun full-source constructor benchmark used two warmups and nine
measured runs. Median Charité construction fell from 291.64 to 23.00 ms (drawn)
and 305.19 to 66.45 ms (native); Humboldthafen planning from 27.32 to 2.46 ms and
25.97 to 4.52 ms. All eight combinations (two models × two styles × two device
profiles) retained identical full record, geometry, material and instance hashes
against the committed v1.0.96 implementation, using all 29,818 source parts.

## Corridor evidence and limits

The [corridor review](linden-corridor-v197.md) records all thirteen owners,
125 source-clipped presentation intervals, bay evidence and bounded costs.
The new facade source register is
[`linden-corridor-v197-source.json`](../geo_data/regierungsviertel/linden-corridor-v197-source.json).
Berlin LoD2 supplies full wall contours and heights; retained OpenStreetMap
street courses constrain which faces may receive frontage detail. Public
heritage, parliamentary and architectural descriptions guide materials and
facade composition. Exact published bay counts are distinguished from unsurveyed
window dimensions and profile thicknesses. No photograph or photographic
texture is included, and no new imagery was used as a visual reference.

Previously detailed landmarks remain protected. Obsolete demolished buildings
and fronts without sufficient current evidence are not assigned invented
historic facades. Roofs, courtyards, navigation and existing city packets remain
unchanged. This is a bounded selection of additional frontages, not a claim of
surveying every building or every window in the corridor.

## Final verification

- Production TypeScript/Vite build passed; only the existing bundle-size and
  runtime-resolved startup image advisories remain. Ruff check and format passed.
- Python coverage was split to let package-dependent checks inspect final
  archives: 965 existing tests passed (4 existing skips), 9 new corridor tests
  passed, and all 76 release-readiness tests passed — 1,050 passing tests total.
  Two existing pyogrio fixture CRS warnings remain.
- The root targeted Bun pipeline/geometry suite passed 127 tests with 268,617
  assertions. The final corridor plus real bundled weak-cache replay passed
  4 tests with 109,812 assertions. Independent complete constructor hash checks
  cover all eight old-model style/device combinations. These suites overlap
  with the independent worker and facade reviews; their totals are not added.
- Chrome desktop and touch WebKit each completed all six modes, 28 near/far
  view samples and six transitions, with no page errors or context loss. Camera
  continuity, single-owner mode lifecycles, actual GPU deletion and byte-identical
  retained source arrays were checked. Routes took 81.46 s and 93.93 s.
- Actual Viewer before/after views cover Otto-Wels/Wagon-Lit, Zollernhof through
  Haus Schweiz, the south-side frontage and Westin corner. A close-view check
  confirms the new separated frame/glass/mullion layers remain readable.
- The longer touch WebKit run completed 28 visits alternating day and
  Schwellenraum after a 45-second startup hold. There were no page/console
  errors, page crashes, lost contexts or speculative mobile GPU warmup. Peak
  measured vertex/instance buffers were 300,949,238 bytes.
- Release readiness and HTTP local-package smoke passed for v1.0.97. Extracted
  package size is 781,103,714 bytes, below the unchanged 810 MiB ceiling.

Browser emulation cannot establish the RAM or thermal behaviour of every real
iPhone/Android device. No crash-free hardware guarantee is made.
