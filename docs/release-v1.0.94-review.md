# v1.0.94 — Kreuzberg, former airports and western lakes

## Scope

The owner requested Kreuzberg in Viktoriapark with the Nationaldenkmal, cascade
and real geographic elevation; the former Tempelhof and Tegel terminals and
Tegel runways; A111 through Tegel northwards; Tegeler See, Schloss Tegel and
Villa Borsig; complete Wannsee outlines and Pfaueninsel.

The named additions follow retained OpenStreetMap and official Berlin source
geometry. The established Kreuzberg elevation field remains. Architectural
fittings and unsurveyed heights/colours are documented display estimates,
separate from measured source shells, shorelines and road courses.

The finite geographic agreement is `bounds-named-v194.geojson`. Its component
evidence documents the airport owners, lake/island rings and
[A111 source course](tegel-motorway-v194.md). It does not authorize a rectangular
district rebuild. The original detailed-city bounds and 93-place tour remain.

## Preservation and resource use

Only explicitly documented coarse source owners and the incorrect cascade water
altitude may change in older packets. Their full measured sheets and source
inventories remain; the respective receipts prove unrelated geometry retained.
All other city packets, existing textures/detail settings, view distance and
CPU/GPU residency budgets remain unchanged. The new geometry is static and uses
bounded indexed/instanced batches with no new photographic textures or animation
callbacks. Drawn mobile and desktop retain the same detail. Minecraft uses the
separate native family and existing release/rebuild lifecycle.

## Verification

The full production build (`bun run build`) and repository-wide Ruff format/lint
passed. Ten focused Bun tests passed with 167,026 assertions. Four outline and
mode-family lifecycle tests passed with 282,559 assertions, including disposal
before reconstruction and preservation of shared map buffers.

Desktop Chrome views were checked at the Kreuzberg overview, cascade and crown,
Tempelhof overview and entrance, Tegel terminal and runways, northern A111,
Tegeler See, Schloss Tegel, Villa Borsig, Wannsee and Pfaueninsel. The waterfall
review caught exposed bank gaps after the height correction; additive banks now
connect the exact shoreline to the retained terrain without changing water XZ.

Mobile WebKit using the iPhone 13 profile completed Day → Night → Schwellenraum
→ Snowstorm → Flood → Minecraft → Day while moving between the new sites.
There were no browser errors or lost WebGL contexts. Tracked live GL buffer
storage peaked at 235,888,397 bytes (this excludes other browser/driver memory).
After returning to the initial Kreuzberg view it fell to 106,295,320 bytes,
compared with 106,598,848 bytes on the first visit. This is an emulated browser
compatibility check, not proof of physical iPhone memory usage or crash immunity.
The final Pfaueninsel source-part/material update received a separate focused
mobile Day/Minecraft/Day check.

All 519 earlier visual-reference records remain unchanged in each credit
manifest; ten new records bring each to 529. Photographs remain external QA
references, with no pixels bundled. The v194 packet receipt independently proves
all 18 exact old-packet changes against immutable v1.0.93, including unchanged
non-owner triangle multisets and water XZ geometry.

The static ZIP is 616,633,757 bytes and the hosting tarball 615,778,364 bytes.
Publication uses the complete local package and retains older hashed JavaScript
assets on Pages for already-open sessions. `check_release_readiness.py` and `smoke_local_package.py` both passed for the
actual extracted v1.0.94 package. The prepared Pages tree retains all 823 older
hashed assets byte-for-byte, alongside the new build. Full-suite results are
recorded below; publication is followed by SHA-256 checks against the public
host and fresh Chrome/WebKit startup checks.

The complete `uv run pytest` run plus its targeted historical-test rerun
establish **1,017 passed / 4 skipped**. The first run found one older relief
assertion comparing its original navigation directly with today's replaced
Tempelhof owners. That assertion now invokes the independent v194 receipt and
checks its altitude-only operation against the immutable v193 predecessor for
exactly the affected keys. All four tests in that file pass; earlier hashes and
unaffected current packets remain checked. No production geometry changed for
this adjustment. Final repository-wide Ruff passed again.
