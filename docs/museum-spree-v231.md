# Museumsinsel, Monbijou and public street fronts — v1.0.131

Step 10, within existing coverage. The requested corridor runs between Berliner Ensemble, Museumsinsel/Berliner Dom and Hackescher Markt. Existing source envelopes, roads, water, park paths, prior individual architecture and the 93-stop catalogue remain authoritative. Residential buildings are modeled as public streetscape, without identifying occupants or their private homes.

The historic Alte Nationalgalerie colonnades are distinct from the James-Simon-Galerie. The northern Monbijou crossing uses its pier-free modern steel structure with sandstone facing, while the southern crossing retains its historic masonry arch. Exact replacement receipts protect unrelated construction. New public-space and facade details use compact static geometry, equal drawn mobile detail and independent native blocks; unmeasured dimensions are explicitly estimates.

## Sources and changes

- [Historic colonnades](museum-colonnades-v231.md): retained source roofs, 280 open columns, coffer hints and the three documented pavilion caps. Two exact closed core proxies, including their erroneous low collision roofs, yield to the complete source-bound construction. The neighbouring modern colonnade remains intact.
- [Monbijou bridges and park](monbijou-v231.md): both complete mapped crossings, their distinct structure, balustrades and restrained joints. Seventeen existing mapped benches receive slats and correctly oriented supports. Existing trees, paths, lawns and the children's bath remain unchanged.
- [Public Spree facades](spree-facades-v231.md): fifteen building families and thirty public wall planes, including Haus Bastian, Magnushaus and Simon-Palais. Ordinary fronts keep their existing opening centres and gain fitted frames, sills and courses. These are bounded recognition refinements, not a claim that every building in the corridor has a surveyed facade.

All original city packets remain byte-identical. Exact full-row or immutable mesh receipts guard every substitution and fail closed if the original changes. The new models join the required scene transaction before navigation becomes available. Construction-only arrays use the existing lossless weak JSON mechanism; no new animation, texture, network fetch or resident-budget increase is introduced.

## Validation

- TypeScript and the production build pass; Ruff formatting and lint pass.
- The full pre-existing Python suite completed with 1,388 passing tests and four skips. Its two failures were the obsolete heritage source assertion and the still-v1.0.130 local package manifest; both affected checks pass after the assertion update and package regeneration. Nine new Python tests also pass, giving 1,399 covered passing cases and four skips across the full run and targeted reruns. The new checks verify reproducible generation, retained source geometry, exact ownership and actual bridge ray intersections, including after lossless parking.
- The focused Bun run passes 238 tests with 1,173,686 assertions. Three further colonnade integration tests exercise the actual core, distant preview, preview restoration and navigation compiler with twelve assertions. An obsolete no-argument source assertion in the existing heritage test was updated to the explicit, backwards-compatible replacement flag; all three heritage tests pass.
- Actual production browsers: Chromium at 1280 × 900 and iPhone 13-profile WebKit, 36 visits each across normal, night, snowstorm, Schwellenraum, flood and native Minecraft, followed by a return to normal. Each visit verifies new geometry actually reached rendering. All 72 visits passed without page errors or spontaneous context loss.
- Peak tracked GPU buffer storage during those paths was 392.73 MiB on desktop and 221.15 MiB in mobile WebKit. These are observed test peaks, not a device-wide memory guarantee. Two forced mobile graphics-context losses restored the same scene, camera and world.
- Screenshot review covers open colonnades, both connected bridge arms, park furniture and the named street fronts in drawn and independent native interpretations. Walking geometry is checked against the visible construction rather than a separate coarse footprint.

The unpacked v1.0.131 release is 884,155,514 bytes (843.20 MiB), inside the unchanged 844 MiB archive guard. The archives are verified sequentially against this same package to avoid retaining two large temporary archives on the nearly full development disk. Browser emulation cannot establish that every physical phone will never exhaust memory.
