# v1.0.95 — Teufelsberg and Drachenberg

## Scope and source fidelity

The owner requested both hills with their actual terrain, the former American
listening station with its towers and radomes, and four people flying colourful
kites with long lines and moving tails on Drachenberg. This is a bounded
refinement inside the existing Grunewald coverage. The established detailed
city bounds and 93-place tour stay unchanged.

The official Berlin DGM1 supplies the finer hill surfaces: an 8 m display field
and a small 1 m crest retain the measured 120.07 m NHN Teufelsberg maximum.
Drachenberg's open plateau is approximately 99 m NHN. The field blends into
the existing Grunewald relief; it does not lift nearby lakes. Terrain sampling,
the rendered ground and the kite fliers use the same height model.

The station preserves all 31 official LoD2 source parts. Twenty-six retain
their measured surfaces; five cylindrical source placeholders receive bounded
radome/tower profiles within the measured anchors and height envelopes. Only
23 documented old OSM building proxies are removed. Original source sheets,
the intermediate terrain checkpoint and exact subtraction receipts remain
available for independent preservation checks.

## Resource use and preservation

The terrain revision reuses 24 existing chunk identities, including eight
existing companions. Existing compressed/decoded packet limits and resident
CPU/GPU budgets remain unchanged. Source XZ courses, paths, unrelated buildings
and trees survive the altitude refinement; no quality tier is reduced.

Six large station/terrain arrays use build-time gzip encoding of their exact
JSON values. Their existing lazy field readers decode them only on first access,
using the already bundled pure-JavaScript gzip implementation. Array ownership
and strong caches, including the frequently read collision and terrain arrays,
are unchanged. No coordinate quantization, geometry removal or quality fallback
is involved. The all-source round-trip test verifies every transformed payload;
production-bundler checks cover lazy access, named/default identity, retained
mutations and removal of unused data when only metadata is imported.

The four kite fliers use reusable buffers, six tether lines and the existing
viewer frame loop. Motion is bounded, visibility gated and disabled for reduced
motion; it does not invalidate the city shadow atlas. Drawn and Minecraft
representations are released before switching families. See
[the kite implementation notes](drachenberg-kites-v195.md).

All 529 previous Wikimedia visual-reference records remain unchanged in both
the source and public manifests. Three freely licensed station photographs
bring each to 532 records; no photograph pixels are shipped as textures.

## Verification

The production build and repository-wide Ruff lint/format checks passed.
Fourteen focused Bun tests passed with 74,349 assertions, covering geometry,
collision, kite attachment/motion, resource limits and full mode-family release
before reconstruction.
Nine additional lossless-encoding/cache tests passed with 305 assertions. The
production build retains the existing startup, worker and package size ceilings.

Desktop Chrome passed hill overview, plateau, kite and tower close views.
Mobile WebKit with the iPhone 13 profile completed Day → Night → Schwellenraum
→ Snowstorm → Flood → Minecraft → Day at the new sites without browser errors
or a lost WebGL context. The idle kite check observed 24 updates in 1.25 seconds
while retaining the same position buffers and presenting changing frames.
Tracked live GL buffer allocation peaked at 235,888,397 bytes; the final revisit
used 120,862,667 bytes, compared with 137,588,288 bytes initially. These figures
exclude other browser/driver memory and are not physical-iPhone crash guarantees.

The visual review identified an inherited pale opening where the older scope
omitted part of the mapped Drachenberg lawn. The exact 647.2579 m² missing area
is now filled, including 34.0041 m² of the retained crossing dirt path. Its
2.2 m width is the same documented class estimate as the previous path. No
existing face or source polygon is removed. Six additional focused Python
checks cover the exact difference, elevations, footprint and runtime batches.

A final mobile Day → Minecraft → Day visit confirmed the filled lawn, connected
path and animated kites in both representations. All position buffers remained
reused. Two previously uncovered ground queries through the actual pedestrian
environment returned the exact new source-field heights (67.6710 and 65.9787 m
in the model datum). The final small material-allocation cleanup received its
focused runtime checks and a fresh production build.

The full Python run initially passed 1,026 tests with four skipped. Its seven
failures/errors identified stale current-replay packet descriptors and the
release package needing rebuilding within its unchanged size limit. The exact
24 current-replay descriptors were synchronized with the verified terrain/station
chain; all 15 outskirts/Grunewald checks subsequently passed. No preservation
assertion or resource ceiling was relaxed.

The rebuilt release passed all 76 readiness tests and the local-launcher smoke
check. Across the full run and the necessary focused reruns, 1,039 Python tests
passed and four were skipped (including the six subsequently added lawn tests).
Ruff formatting/lint and `git diff --check` passed. The final codec build was
visited again in desktop Chrome at both hills/the station and in mobile WebKit
through Day → Minecraft → Day; no errors or WebGL context losses occurred.

The complete extracted package is 848,942,775 bytes, below the unchanged
849,346,560-byte (810 MiB) limit. The ZIP and static tarball carry identical
viewer content and their SHA-256 sums accompany the release. Pages publication
retains all 836 previously deployed hashed assets for still-open viewers;
completion requires live file-hash checks and fresh Chrome/WebKit startup.
