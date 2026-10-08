# Alexanderplatz and Bahnhof Zoo — v1.0.92

Step 10 makes three bounded refinements around Alexanderplatz and one at
Hardenbergplatz. The previous measured hall, civic-building, platform, track,
roof and glazing payloads remain byte-identical. There is no packet regeneration.

At Alexanderplatz the retained barrel receives thin longitudinal members and
small suspended luminaires, following the inspected 2023 platform photograph.
The previous blue sign boards now carry `ALEXANDERPLATZ` in texture-free geometry
on both faces. Their placement is unchanged. Member and lamp counts are display
estimates; the round-arched measured envelope remains the geometry anchor.
The nearby ALEXA inscription is also corrected: the shared stroke coordinates
were already centred, but the old helper subtracted another quarter-width and
chose facing by east/west direction. Labels now centre on each existing facade
run and use its outward normal to determine reader-right. No wall, window or
source polygon changes.

At Zoo, OSM roof way `157658318`, entrance node `1223731363` (O), and stairs way
`274269257` identify the small glass canopy at Hardenbergplatz. Its current core
owner `57658318` was a solid three-metre prism. Exactly that owner becomes an
open gabled glass roof on six stone supports, with narrow framing, visible
stair guards and separate U, U2 and U9 plaques. The complete source ring and
tagged three-metre envelope are retained. The 2.35 m eave, post/member dimensions,
guard width and plaque sizes are photographic display estimates. Original
prism bytes remain in the core payload and the new compact source receipt.
Neighbouring source owners, including `-3652421`, remain untouched.

The existing Zoo integration hooks filter that one additional drawn owner and
its exact matching native columns (footprint, base and quantized height). The
existing Zoo collision callbacks know the thin canopy roof and six posts.
No camera/controller or global navigation file changes. The underground route
and terrain remain unchanged; this addition depicts the visible entrance
canopy and guards and does not claim a navigable underground station.

Sources and per-file free-photo credits are in
[`station-details-v192-evidence.json`](../geo_data/regierungsviertel/station-details-v192-evidence.json)
and [`station-details-v192-credits.json`](../geo_data/regierungsviertel/station-details-v192-credits.json).
The official [Alexanderplatz heritage record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011324)
and [S-Bahn station inventory](https://sbahn.berlin/fahren/bahnhofsuebersicht/zoologischer-garten/)
provide the architectural and transport identities. Both Commons images were
downloaded only to ignored raw reference storage and visually inspected.
No photographs, fonts or image textures ship.

The additions cost three submissions in either representation: Alex one;
Zoo members plus transparent glass. Drawn adds 91,400 attribute/index/instance
bytes; separate orthogonal Minecraft adds 217,784 bytes. These are added
component allocations, not the full pre-existing station budgets. All drawn
modes retain identical full geometry on desktop and mobile. Materials use the
existing day/night and transparent-glass conventions; no runtime budgets change.

Checks: 18 focused Bun tests cover all lettering, full/mobile parity, complete
old part/owner preservation, exact new owner/native mask, mapped roof coverage,
open interior/solid posts, translucent glass, finite orthogonal native matrices,
frozen transforms, bounded buffers and front-most ray hits for all 39 plaque
glyph segments in each representation. Three Python checks reproduce the saved
OSM receipt and original prism, hash the four unchanged payloads and verify
the photo credits. TypeScript and Ruff are also checked. Integrated visual QA
belongs to the release review.

Useful before/after cameras, world metres:

- Alex exterior: `[2735,31,-166]` → `[2698.97,21,-235.62]`.
- Alex geometry-only interior: `[2675,16.7,-259]` → `[2720,19,-213]`.
  The existing viewer camera collision can lift this seed; it is not changed.
- Zoo canopy high: `[-2620,26,1328]` → `[-2639.44,7.3,1341.54]`.
- Zoo canopy near the photograph: `[-2629.64,8.5,1346.89]` → `[-2640,7.3,1341]`.

Reproduce with `uv run python scripts/build_station_details_v192.py`,
`uv run pytest -q tests/test_station_details_v192.py`, and the four Bun files
`station-details-v192`, `zoo-station-v165`, `zoo-station-v165-navigation`, and
`alexander-stations-v183` under `src/app/tests`.
