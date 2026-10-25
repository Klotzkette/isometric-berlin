# Schlesisches Tor v267 — station silhouette and short western viaduct

The station now has separate hipped platform roofs, the curved west tower helm with its brick rear shaft and pierced stone crown, red-brick/sandstone exterior relief, paired portal archivolts, grouped upper windows and small geometric U signs. Short mapped western track excerpts receive dark-green lattice girders, rails, railings and slender supports. This is an additive exterior interpretation. The retained station remains closed for walking; decorative portals do not claim a new accessible interior.

## Sources and limits

- [Landesdenkmalamt Berlin, object 09031242](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031242): asymmetric red-brick and sandstone station, separate platform roofs, Grisebach & Dinklage, 1899–1901; sculptor Heinrich Giesecke.
- [BVG planning report, February 2018, p. 3](https://www.uvp-verbund.de/documents-ige-ng/igc_be/D96E3618-90A7-49B5-A3FF-D71D9DEE5284/S_PG_Erlaeuterungsbericht.pdf): two approximately 110 m outside platforms, hipped roofs, show facades northwest/southeast. Proposed lift alternatives are not treated as built geometry.
- [BVG station page](https://www.bvg.de/de/verbindungen/stationsuebersicht/u-schlesisches-tor): current U1/U3 identity.
- [Jörg Zägel exterior photograph, 4 May 2012](https://commons.wikimedia.org/wiki/File:Berlin,_Kreuzberg,_Skalitzer_Strasse,_Bahnhof_Schlesisches_Tor.jpg), [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/): visible roof subdivisions, curved tower helm with the tall straight brick rear face, pierced crown, sandstone portal/window arrangement and steel latticework. Reference only; no photograph or raster texture is distributed.
- Original Berlin LoD2 parent `DEBE02YY400009V1`, archive `LoD2_394_5817.zip`: complete 68 original surfaces retained in evidence, including 66 walls, flat roof and ground. Exact supplied outline and navigation owner remain unchanged.
- Frozen OpenStreetMap source: station way `738323475`, platforms `49038493` / `49038495`, U1 tracks `384345627` / `384345629`. Track gauge 1.435 m and mapped height 6 m are retained. Only the two western line excerpts at x4635..4686, z2105..2145 receive new steelwork. The existing eastern 223 m roof/viaduct owner is untouched.

Roof heights/subdivisions, shaft/crown dimensions, colours, window and portal fittings, support spacing and member sizes are photograph-based display estimates. No new elevator, park boundary, ground area, interior or transit operation is inferred. The ground is the existing v159 outer ground Y3, not the core Y5.2. Original drawn height10.71 gives capY13.71; native owner height10 gives capY13.0. Native walls follow the actual supplied orthogonal owner boundary, with only zero-distance collinear points omitted. The two portal details bind to separate actual 4 m native wall faces. Native roof cells extend to the native cap, avoiding open step seams.

The complete tower-roof plan (radius4.95 m) fits inside the original station footprint. Its straight brick rear shaft intentionally occludes one side, as the reference photograph shows.

## Ownership and resource contract

No prior owner, roof, wall, triangle, line or mesh is removed. No stream descriptor or coverage changes. The evidence records all original source/archive/9_4 packet SHA256 hashes; retired owners and removed triangles are both empty/zero. The existing east viaduct and original station envelope stay authoritative. No source packet rewrite or replacement receipt is needed.

`createSchlesischesTorV267(native=false, {mobileLike?, diagnostics?})` returns the required static group. Drawn: 14,561 instances + 609 roof triangles, 2 mesh calls. Native: 23,002 instances, 0 curved roof triangles, 1 mesh call. Every native box has zero rotation and independent orthogonal wall/roof interpretation. Desktop and mobile receive the same geometry; there is no mobile detail reduction or texture. Core residency, decode, prefetch, navigation coverage and catalogue counts are unchanged.

`schlesischesTorSolidsV267(native=false)` is a pure-data profile without Three imports. Drawn25 / native91 solids include elevated decks, their individual slender supports, the upper shaft and roof envelopes. Native decks analytically evaluate the exact union of the rendered local grid cells; the roof evaluates the same global0.6 m grid and0.2 m height quantisation. The native roof is one collider, not thousands. Both mode families must be registered once with live mode gates, using `topAt(x,z)`; no source-wall exception is introduced.

## Validation and QA

- `uv run --no-sync pytest -q tests/test_schlesisches_tor_v267.py`: 2 passed. Rebuild compares complete source evidence/runtime, verifies retained surfaces, exact native boundary, distinct native portal faces, three clipped hips, and unchanged source hashes.
- `uv run --no-sync ruff check scripts/build_schlesisches_tor_v267.py tests/test_schlesisches_tor_v267.py`: passed.
- From `src/app`: `bun test ./tests/schlesisches-tor-v267.test.ts`: 3 passed, 67 assertions. Checks independent axis-aligned native model, texture absence, identical mobile geometry, real native wall binding, all native roof-cell heights/closed bases, native deck coverage and the bounded collision count.
- Navigation test uses both complete immutable9_4 packets, actual terrain/road heights and all original station/neighbour obstacles. It walks [4668,2120]→[4668,2140], yawπ, in48 steps for drawn→native→drawn in one environment. No respawn, jump, or height discontinuity larger than0.09 m; deck collision and live native roof gates checked. Original station interior remains blocked. The route avoids the actual individual support positions.
- Portal camera: `[4740,27,2150]`→`[4716,10,2120]`; close portal: `[4725,19,2140]`→`[4716,10,2120]`; roof: `[4780,78,2200]`→`[4706,12,2116]`. These central rays avoid the46 local supplied neighbouring bodies. The earlier northwest camera crosses owner `DEBE02YY40000Anr` and is unsuitable.
- Browser/render QA is performed by the root agent using the real9_4 streamed tile and a single on-demand IAB render harness. This note records model/source/navigation checks, not a claim that browser QA has passed.

Root IAB review (25 October 2026): actual9_4 tile plus district188 context, front and elevated roof views in drawn/native. Native wall binding and closed roof steps now pass after correction; no captured warning/error. The wider portal view includes a legitimate foreground neighbouring roof; the elevated view confirms the full envelope and separate roofs. The harness intentionally loads bounded local context, not the complete production city.
