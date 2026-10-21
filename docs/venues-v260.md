# Six theatres/cinemas and Columbiahalle — v1.0.160

Step 10, within existing Berlin coverage. No new tour stop, photograph texture,
streaming descriptor or live residency allowance. Drawn geometry is identical
on desktop and touch; native construction remains separately orthogonal.

| Site | Changes | Evidence |
| --- | --- | --- |
| Ludwig-Erhard-Haus / IHK | Full measured metal roof and 15 structural rib sections; complete 77-part owner replaces 11 m proxy | [West source notes](west-venues-v260.md) |
| Renaissance-Theater | Complete measured two-part building, rounded blue-glazed entrance, facade and lettering | [West source notes](west-venues-v260.md) |
| Delphi Filmpalast | Complete nine-part building, entrance, columns and lettering | [West source notes](west-venues-v260.md) |
| Zoo Palast | Ceramic grid, brass studs, three side portholes, canopy, entrance and abstract programme cases | [Zoo source notes](zoo-palast-v260.md) |
| Kino International | Exact source-aligned open 9 m cantilever, glazed front, lettering and abstract relief cues | [East source notes](east-cinemas-v260.md) |
| Café Moskau | Retained six-part atrium building, glazing/columns, diamond screens, rooftop name and Sputnik | [East source notes](east-cinemas-v260.md) |

The unnamed nearby old cinema is interpreted as Delphi Filmpalast; the IHK
identity is Ludwig-Erhard-Haus. No claim of exact photographic reconstruction
is made: measured source shapes take priority, while small fittings and colours
are display estimates. Renaissance's measured upper roof differs from the
reference photograph's steep gable; this conflict remains documented rather
than silently deleting measured geometry. Native detail follows stepped surfaces.

## Columbiahalle follow-up

The owner withdrew the recordings during this release. All three MP4 files,
the recording player/selector and transcoding scripts are removed from the
current product. The replacement is a silent procedural graphic loop with
stage silhouettes and lighting; no video decoder, recording fetch or audio.
The cream/red concert board and blue entrance lettering follow the supplied
Sisters of Mercy photograph. It depicts the supplied photographed programme,
not a live listing. Historical release descriptions are labelled superseded.

Old GitHub history and older bundled releases require a separate precise cleanup
scope; the owner was asked because that changes existing tags/downloads. Current
code, the new download and the current Pages publication contain no MP4.

## Preservation and checks

All old city packet bytes remain unchanged. Western source substitution uses
three exact OSM IDs and complete measured replacement owners. International's
old coarse closure transfers only by full encoded mesh fingerprint and exact
triangle indices; its original roof and neighbouring geometry remain. Its lower
and upper navigation solids match the visible undercroft. A single earlier
facade edge crossing the recess is clipped by exact full-row match.

- Ruff format/check, TypeScript and Vite build passed.
- 95 targeted Bun tests passed initially; after the lettering fix, all 23 venue/Columbia tests passed with 462,346 assertions. Navigation, source transfer and residency checks also passed in the initial run.
- Fresh Python runs passed all 20 focused site tests and all 80 release-readiness tests. The broad run was interrupted after 357 passes: a large historical source replay exhausted host disk space; two facade assertions had imported the generator before its final edits. The latter pass with frozen sources. This is not reported as a passing full suite.
- Release readiness and the local HTTP package smoke test passed.
- Chrome desktop and WebKit iPhone emulation completed 24 venue/family views and four wide-view transitions with no JavaScript or WebGL error. Subsequent front views corrected test camera positions at Renaissance-Theater and Zoo Palast and exposed/fixed mirrored Moskau lettering.
- Columbiahalle: all four browser/family combinations passed entry, Pause/Play, Leave/Escape, paused-scene hidden/offscreen recovery, reduced-motion opt-in and repeated disposal. No recording request or media element occurred. GPU buffers remained constant during playback and returned to zero after leaving in all 12 repeated entry/exit cycles. No operating-system memory-pressure guarantee is implied.

Publication receipts follow after upload.
