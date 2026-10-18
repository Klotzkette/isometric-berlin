# Step 10 — parks, Panke, Wedding and district courts (v1.0.129)

This release refines the named locations without extending the general city fill or changing resolution, residency, visibility or mobile-detail budgets. The 93-stop catalogue and previous architectural details are retained. New static geometry is spatially culled, texture-free and equally detailed on touch devices; Minecraft retains independently orthogonal construction.

## Changes and evidence

- [Terrain and Rodelbahn](park-terrain-v229.md): Fritz-Schloß-Park already has its measured hill; its mapped grass sled slope is now visible and walkable. A source-limited DGM1 correction restores the summit of Schönholzer Heide, retaining surrounding foundations and memorials.
- [Wedding and Moabit](wedding-moabit-v229.md): the elevated Wedding station and mapped access stairs, Stadtbad Tiergarten facade, fourteen sports fields, and the circular fountain on today's Martha-Ndumbe-Platz. The nineteen mapped prison-park wall segments and all three entrances are retained. The ambiguous request was interpreted as enclosure, not a request for new audio.
- [Lower Panke](panke-banks-v229.md) and [native bank alignment](panke-native-banks-v229.md): narrow recessed bank faces, restrained brick courses and original abstract graffiti cues, following the existing rendered water edges. Open tunnels, bridges, mouth and the existing fish pass remain clear. Material variation is illustrative, not a facade survey. The separate Südpanke is unchanged.
- [Courts](district-courts-v229.md): all eleven current Amtsgerichte across twenty service-building groups, plus the separate Landgericht Berlin II extension at Tegeler Weg. Exact-owner replacements restore measured roof/wall geometry at Wedding, Charlottenburg and the north annex; three missing courthouse envelopes are added only at their mapped sites. Other existing buildings are retained and receive restrained source-bound entrances, ledges and recognition cues.

The complete extracted archive grows by about 1 MiB to 836.66 MiB (877,297,770 bytes); its offline-only ceiling is 837 MiB. Live memory budgets are unchanged.

Official LoD2/DGM1 and retained OSM records control geometry; unresolved heights, facade subdivisions and artistic poses are documented as estimates. No photograph or copyrighted plan is bundled. Detailed source receipts and validation are linked above.

## Validation

- Production TypeScript/Vite build and repository-wide Ruff format/check pass.
- The full Python run completed with 1,354 passes and four skips. One Wedding replay used the generator imported before the subsequent mapped-landing update; its fresh replay passed. The subsequent affected-source and release-readiness run passed all 83 tests.
- All 97 final Bun regressions pass: 39 source/geometry/access checks and 58 existing movement, recovery, navigation-continuity and native-loading checks (1,082,831 assertions). These cover exact ownership, actual terrain intersections, stairs, native orthogonality, disposal and bounded buffers.
- Chromium: 71 actual-render views cover all 21 court locations and named parks/river/station/pool/sports, both geometry families and all six modes; no page errors or context losses.
- iPhone 13 WebKit profile: 29 actual-render views across all six modes, no page errors/context losses and two successful forced GPU recovery cycles. Peak measured active buffer allocation among these views was 215,609,699 bytes. This is a browser profile check, not a guarantee for every physical device.
- Mobile startup: normal flight view, no minimap during loading, gentle walking descent and return to flight pass. Initial readiness was 12.787 seconds on this local test; it is not a network/device benchmark.
- Real keyboard walking exposed three obsolete low canopy prisms at Wedding. Their exact source owners transfer to complete thin elevated canopies; unchanged neighbouring geometry remains protected. Both full access routes are also tested against the complete retained core obstacle index, rather than an isolated station fixture.
- Access movement also passes at 16, 33, 50 and 100 ms per frame. A local one-micrometre endpoint tolerance and bounded stair-height allowance prevent precision gaps and descent failures at low frame rates; global roof/support priority and geometry are unchanged.
- Final production Chromium keyboard walking passes both complete stair ascents/descents and the mapped eastern ground-level underpass in Day and Minecraft, without jumps, page errors or context loss. Test input is released in the browser at each endpoint to exclude automation round-trip overshoot.
- Final ZIP/tar archive readiness passes, preserving all prior shipped public source bytes and the 93-place tour. Publication retains 1,485 prior hashed assets for existing sessions; live release checks compare current assets and archive digests with the local package.
