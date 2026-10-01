# v1.0.59 — mapped surrounding Berlin outlines

Pipeline steps 1, 3 and 10. The owner explicitly requested a larger city with
rudimentary buildings and correct street courses, preserving the existing
detailed city and mobile safeguards.

## Scope and source separation

The approved polygon grows from 31.285 to 81.457 km². It contains the complete
official ALKIS districts Moabit and Prenzlauer Berg, including Knaackstraße,
plus finite lobes through Joachim-Friedrich-Straße in City West/Wilmersdorf,
Schöneberg, Karl-Marx-Allee through Frankfurter Tor, and Schlesisches Tor.
The explicit lobes and reproducible boundary sources are in [bounds.md](bounds.md).
“Stalinallee” is interpreted here as Karl-Marx-Allee through Frankfurter Tor;
this release does not claim the whole subsequent Frankfurter Allee.

`bounds-v158.geojson` is the exact previous polygon. The outer layer subtracts
it before export. Original detailed building, road, terrain, landmark, facade
and monument sources are unchanged. The original overview projection and
93-place navigation catalogue remain intact.

Outer buildings use Berlin LoD2 footprints and vertical envelopes, augmented
by OSM buildings where the official source has no corresponding footprint.
Roads, paths, rails, water and park courses come from the dated Geofabrik/OSM
extract. Official district boundaries and building data use dl-de/zero-2-0;
OSM uses ODbL. See [data.md](data.md) and the shipped source inventory.

The new outer representation deliberately shows simple extruded massing, roof
outlines, continuous street surfaces and kerb lines. Outer terrain, neutral
paint colours and widths/heights absent from source tags are display estimates,
not surveyed measurements. No detailed facade or roof form is invented.
Minecraft uses separately generated block-native outlines on a two-metre grid.
The retained central city keeps its existing full detail in every drawn mode.

## Loading and navigation

The outer layer starts after the core opening view is ready. A small manifest
selects external 512 m chunks by an expanded camera frustum and nearby position.
Only one chunk is fetched, decoded and published at a time. Gzip compression is
lossless; bounded native stream decompression has a lazy bundled fallback.
No source JSON is imported into the main or worker startup bundles.

Each drawn chunk uses one merged surface mesh and optional ink, at most three
GPU buffers. Centimetre coordinates remain packed Uint16; colours share the
same interleaved vertex stream. Native Minecraft requires at most two buffers.
Previously visited offscreen chunks are disposed after a short reversal grace;
there is no unbounded visited-city geometry cache. The 24 MiB residency target
is soft: visible chunks remain eligible regardless of budget. Drawn/native
families never coexist in this outer layer. Existing core GPU residency,
resolution, movement speed and full-detail policies are retained.

Walking bounds expand in all four directions. Loaded source footprints and
courtyard holes supply building collision; mapped water and bridges supply
water exclusion. The minimap draws nearby resident source outlines directly,
without another large image or a duplicate network queue. Flight and mode
changes preserve the current position. The expanded presentation envelope is
9,250 m; the far plane is derived from it, with the existing near plane intact.

The extracted package guard rises from 120 to 215 MiB for the explicitly
approved additional 50.172 km². Chunk compression, individual asset checks and
the rejection of retired photographic payloads remain enforced. Both hosted
and downloadable viewers carry all external chunks locally.

## Verification

Source checks cover scope containment, unchanged core ownership, named streets,
courtyard triangulation, native block edges and chunk-boundary continuity.
Navigation checks preserve the original ground and tunnel behavior while
allowing safe outer spawns. Runtime checks cover serial requests, cancellation,
mode-family replacement, disposal, gzip fallback and malformed size limits.

The final export contains 40,773 building records (37,556 official footprints
plus 3,217 additive OSM outlines), 54,347 mapped road/path records and 260 tiles.
All 520 final drawn/native packets were decoded through the actual runtime:
positions, linear colours and indices match every source entry. The independent
geospatial audit found no old-core intrusion or out-of-scope geometry beyond
the 2 cm storage tolerance, and retained 1,449 building-courtyard holes and
13 water-island holes. Full named street coverage has zero missing metres:
Joachim-Friedrich-Straße 22 ways, Karl-Marx-Allee 71, Knaackstraße 18 highway ways.

All new public assets total 120,710,344 bytes; the largest individual asset is
607,174 bytes. Removing the native family's unused ink field reduced transfer
and parse memory without changing any rendered mesh or navigation field.
The complete ZIP is 147,545,107 bytes, below the 200 MB download target.

`uv run pytest`: 547 passed. Ruff format/check, production TypeScript/Vite
build, release readiness and local-package HTTP smoke pass. The focused Bun
runtime/navigation/envelope suite passes 95 tests / 609 assertions.
Two unrelated stale constructor-count assertions reproduce on unchanged
`fb88b73`: generic voxel facade windows are 1,558,081, and the full Moabit
memorial is 4,040 blocks. Both current/baseline geometry hashes match; these
assertions were not weakened or used to change the existing geometry.

The final production WebKit iPhone-13 profile passed 18 travel samples across
all five modes, plus outer-area walking and walking mode restoration. It had
zero page errors and zero context losses; measured peak live GL buffer storage
was 151,179,556 bytes / 9,464 handles. These are GL allocations, not total RAM.
An additional daytime geography route checked all newly requested lobes.
Chrome's mobile profile also passed the 18-sample route and walking mode
restoration with zero errors/context losses: peak tracked GL allocations were
148,962,831 bytes / 8,802 handles. Outer near views used at most 6,075,474 bytes
of resident geometry on this route; returning to the original core retired
all outer geometry. Disposal also clears minimap references to the previous
world family before the next core is built.
Chrome desktop passed the same 18 travel samples and walking restoration,
with zero page errors/context losses. Its widest tested outer view retained
41 tiles / 12,813,696 bytes; a core-only view again retired all outer chunks.
Desktop intentionally retains its existing complete core world families;
the whole-scene peak was 635,959,928 tracked GL bytes / 30,814 handles.
Cold-start gates passed in Chrome desktop (15.23 s), Chrome touch (12.34 s)
and WebKit touch (14.41 s), with no page/console errors, blocked-audio warnings
or failed critical requests on the test host.
Both browser engines also passed the mobile-menu gate across five viewport
layouts and all five modes, including touch scrolling, light controls,
hidden chrome and the source-credit panel.
Browser checks use `scripts/smoke_surrounding_city.py`.
Phone profiles exercise browser engines and resource lifetime; they do not
measure the RAM limit of a physical iPhone or promise that an operating system
can never terminate a browser tab.
