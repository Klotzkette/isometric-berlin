# v1.0.96 — Viewer stability without reduced detail

Pipeline step 10. The owner reports frequent crashes and returns to the startup
chooser. This revision addresses a reproduced document-reload bug and measured
source-memory overhead. It does not claim to reproduce every physical-phone
process termination.

## Reproduced return to the start screen

The production v1.0.95 viewer was launched in a fresh browser context and its
`OuterThinOutlines` module request deliberately aborted. Although that optional
module already had a local error handler, the global Vite preload-error handler
reloaded the entire document. The browser navigated twice and returned to the
mode chooser with no canvas. Successful early imports also erased the persistent
recovery guard, allowing later failures to repeat this cycle.

Automatic deployment recovery is now limited to transport errors during the
initial ThreeViewer import. It is allowed at most once per release and tab
session, with a persistent URL fallback when session storage is unavailable.
Later module failures reach their existing local handlers and preserve the active
viewer. Runtime/evaluation errors do not request a document reload. Existing
pose-preserving one-shot WebGL recovery remains independent.

## Lossless source lifetime

Large arrays already handled by the lazy source-data transform are gzip-encoded
at build time when base64 output is at least 20% smaller. The browser decodes
only a requested field; its existing strong/weak ownership, mutation and named
export semantics remain unchanged. Already packed packet/street fields retain
their direct-literal path. No coordinate, colour, geometry or material is removed
or quantized. Complete-source round trips verify exact payload equivalence.

The explicitly audited constructor-only fields listed in
[the ownership register](source-cache-lifetime-v181.md) may release their parsed
object graphs after construction. Final typed render buffers remain intact.
Navigation, terrain, collision and mutable inputs keep strong ownership. Native
West Lakes collision data is deferred until an actual native collision query
needs it; ordinary drawn navigation no longer parses the native lake geometry.

Tunnel portals now register their final interleaved storage with GPU residency,
preventing offscreen entries from holding obsolete pre-interleaving arrays.

Resolution, viewing distance, navigation speed, model detail and GPU residency
budgets are unchanged. Existing roads, shores, buildings and all model sources
remain in place.

## Measurements and validation

Cold-start comparison uses fresh Chrome contexts with the Pixel 5 touch profile,
the same opening view and 25 seconds after presentation. CDP reports JavaScript
heap and backing storage after requested collection; WebGL instrumentation counts
vertex/instance buffers only. These are host-browser measurements, excluding
other process/driver allocations, not physical iPhone memory or crash guarantees.

The final combined build produced the following post-collection measurements:

| Measured storage | v1.0.95 | v1.0.96 |
| --- | ---: | ---: |
| Used JavaScript heap | 326,575,328 B | 246,511,864 B |
| Backing storage | 596,842,492 B | 543,038,873 B |
| Scene CPU buffers | 458,215,184 B | 458,215,184 B |
| Resident WebGL vertex/instance buffers | 235,262,165 B | 235,262,165 B |

Combined JavaScript heap and backing storage fell by 133,867,083 bytes (about
134 MB). The largest sampled combined value during startup fell from
1,246,480,891 to 1,165,248,943 bytes; sampling does not establish the absolute
peak or total process memory. Final presentation was ready at approximately
6 seconds versus 5.2 seconds in the baseline on this host. This is a memory and
reload-stability improvement, not a measured startup-speed improvement.

The late-chunk failure was reproduced before the change in Chrome. After the
change, the same injected failure passed in Chrome and touch-profile WebKit:
one document navigation, an active viewer and canvas, and no page error. The
optional outer module can report its local download failure without restarting
the application.

Targeted production-transform, ownership, navigation, reload-recovery and GPU
residency tests passed: **56 tests, 3,170 assertions**. They include exact-source
round trips, complete render-buffer equality across collected source caches and
Day → Minecraft → Day reconstruction, and all 1,793 original native West Lakes
collision boxes. The production build, version/package readiness checks and
local package HTTP smoke also passed.

Longer Day/Schwellenraum travel passed with 28 viewpoints each in fresh mobile
Chrome and mobile WebKit profiles, including city-wide and near views: no page
errors, crashes, WebGL losses or unexpected runtime replacements. Desktop Chrome
also passed all six modes and return transitions (28 viewpoints, six mode
transitions); source-buffer identity remained intact during observed GPU
retirement. These are automated browser runs, not tests on physical phones.

The six-mode route also passed in mobile WebKit: 28 viewpoints, six transitions,
14 verified GPU retirements, zero page errors or context losses, and only the
expected drawn → native → drawn runtime replacements. The camera-seeding smoke
helper now observes the existing initial-focus and presentation commits before
seeding; its earlier fixed wait could race with the App's initial focus effect.
The test neither retries camera placement nor changes production behavior.
All 92 related Python smoke-helper tests passed after this test correction.

The full Python suite passed **1,039 tests with four skips**; the two subsequently
added focus-probe regressions passed within the 92-test helper rerun. Ruff format
and lint checks passed across all 396 Python files. Production TypeScript build,
package readiness, local HTTP package smoke and exact release-version checks
passed. The release retains previously published hashed assets for open tabs.
