# Kreuzberg, Friedrichshain, Steglitz A103 and old-Mitte pavements — v1.0.126

Step 10 follows the owner's bounded refinement request. Existing city coverage,
all original source packets, measured building envelopes, authored landmarks,
93 tour stops and memory/residency limits remain intact. Drawn geometry retains
the same detail on mobile and desktop; native interpretation stays independent.

## Houses

Kreuzberg and Friedrichshain reuse retained official ALKIS boundaries. The
existing roof and glass treatment now covers these two areas too, without new
geometry or renderables. Original source paint and authored facades retain
priority. Existing ordinary glazing is lightened; measured roof forms separate
more clearly from walls. This is a restrained graphic treatment, not a claim
that every individual facade has been newly surveyed.
See [house evidence and counts](district-houses-v226.md).

## Streets

The Steglitz A103 addition follows retained complete OSM carriageways through
the missing southern bridge section and connects them to the old projection.
Bridge grade and unmeasured structural dimensions remain explicitly documented
display estimates. Existing source surfaces are preserved.

The old-Mitte pavement pass checks explicitly mapped sidewalk widths against
delivered paving, carriageways, paths, buildings and water. Only proven missing
complements are added. The frozen pre-2001 selection excludes Wedding and
Tiergarten. Untagged widths do not justify speculative continuous pavement.

## Verification

- TypeScript project compilation and production Vite build pass.
- Full Python partition: 1,210 passed and four skipped. Two version checks
  initially saw the pre-bump module cached in that already-running process;
  both pass in a fresh process. Smoke/release/package partition: 105 passed.
  All 12 new scope, pavement and motorway tests pass separately.
- Repository-wide Ruff formatting and lint pass.
- Focused historical outline preservation: 22 tests, 736 assertions pass.
  Original preservation fixtures remain unchanged.
- Lifetime, startup, recovery, walking and house-colour regression batch:
  66 tests, 272,757 assertions pass. No residency budget is increased.
- Release readiness and the complete local HTTP package smoke pass.

See [pavement evidence](alt-mitte-sidewalks-v226.md) and
[A103 source and estimation limits](steglitz-motorway-v226.md).

Desktop Chrome completes 23 views over Day → Night → Snow → Schwellenraum →
Flood → Minecraft → Day, with zero page errors, crashes or spontaneous context
losses. The complete extracted package is 874,990,973 bytes (834.456 MiB),
under the unchanged 836 MiB ceiling.

WebKit with the iPhone 13 touch profile completes the same 23-view mode cycle
with zero page errors, crashes or spontaneous context losses. Two deliberately
forced GPU resets preserve runtime, scene, camera, world and pose, and resume
drawing. Peak sampled WebGL buffer storage is 187,832,548 bytes (179.13 MiB);
A103, Kronenstraße and the final Mitte view return to the identical byte counts
on the second Day pass. This measures submitted buffers, not total driver/heap
memory. Browser timings and touch profiles are local observations, not claims
of testing a physical phone or a guarantee against every browser termination.

Focused browser review confirms both new families exist and actually submit
render calls. The day underpass allows 10.83 m of continuous held-key walking
at foot y=3 / eye y=4.8. Descent above the bridge lands at y=9.4. A probe which
continued sideways across the narrow deck correctly stepped off its edge and
fell to ground; that test trajectory was corrected, with no production change. The initial
second baseline capture was interrupted by a full development-host disk
(`ENOSPC` in the local HTTP server), not a viewer exception. Already-published
local generated archives were reclaimed only after their hashes and sizes
matched their GitHub release assets; source files and installed assets remain.


The independent native family also submits both root families. Its underpass
walk covers 13.22 m at the same foot/eye heights, and descent lands on its actual
quarter-metre deck at y=9.5. Composed production navigation confirms clear
space below and a solid finite slab. No page error or crash occurs in either
focused walking run.

Cold startup passes in desktop Chrome (12.05 s, zero critical network/console
errors) and the WebKit touch profile (19.66 s on this host). The touch check
also confirms default flight height, hidden controls/minimap during loading,
smooth descent into Walking and return to flight. Its peak sampled buffer
storage is 259,740,804 bytes, with zero context losses.
