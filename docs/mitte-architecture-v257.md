# Mitte architecture, Columbiahalle and Invalidenpark — v1.0.157

Step 10 refines the named sites inside retained coverage. No new city district,
tour stop or animation loop is added. Full drawn mobile detail and independent
native geometry retain existing runtime limits. Columbiahalle adds an explicitly
requested temporary concert view, animated through the existing frame loop,
and an on-demand silent recording; its original reference photographs are not
bundled as textures.

## Scope and source interpretation

- The surviving courthouse on Littenstraße is distinct from the demolished
  Grunerstraße wing and its former towers. The existing source-height conflict
  and estimated upper building remain explicitly documented.
- Zur letzten Instanz is the historic restaurant at Waisenstraße 14–16.
- CUBIX is at Rathausstraße 1; the requested residential/commercial row is the
  Rathauspassagen. Deiters and BowlingCenter am Roten Rathaus identify their
  premises at Rathausstraße 5; the bowling venue is in the basement.
- Fernsehturm refinements concern its existing base and folded pavilions.
- Alte Münze / Palais Schwerin and selected Leipziger Straße fronts retain
  complete measured envelopes, roofs and previous authored architecture.
- Columbiahalle's facade follows the supplied photographs. Its interior light
  scene is illustrative; the actual supplied concert recording loads only on
  request as a compact silent loop. Both temporary views release their resources
  on exit, and neither introduces a second renderer or frame loop.
- The transport ministry at Invalidenpark preserves its historic building and
  both modern additions. The Scharnhorststraße heating plant receives two
  mapped 35 m steel stacks. The obsolete 150 m chimney is absent from the
  existing delivered local geometry, so no source deletion is needed.

## Site notes and validation

Building owners, architectural evidence, exact additions, display estimates
and focused checks are recorded in these five site notes:

- [Littenstraße courthouse and Zur letzten Instanz](litten-instanz-v257.md)
- [CUBIX, RathausPassagen and Fernsehturm base](alexander-recognition-v257.md)
- [Alte Münze, Palais Schwerin and Leipziger Straße](leipziger-muenze-v257.md)
- [Columbiahalle facade, light scene and recording](columbiahalle-v257.md)
- [Transport ministry and Scharnhorststraße heating plant](invaliden-civic-v257.md)

Focused source, preservation, geometry, navigation and lifetime checks are
documented per site. For the ministry/plant integration, 3 Python tests,
17 Bun tests across the affected Hbf/Reichstag suites, and the TypeScript build
passed. These are scoped results, not a claim that integrated visual review is
complete. Production browser QA is still in progress; its results belong in
the final release audit.

## Integrated release checks

The full Python suite passed on 21 October 2026: 1,719 passed, 4 skipped,
2 pre-existing temporary-fixture CRS warnings. The final focused source suite
passed all 11 v257 tests, including the later Columbiahalle and Invalidenpark
additions. The integrated Bun run passed 112 tests (655,037 assertions); the
later navigation/Columbiahalle run passed 50 tests (110,069 assertions).
The final warmup-race/disposal/input suite passed 9 tests (74 assertions).
Ruff format/check, the TypeScript production build and the local HTTP package
smoke test passed. Independent review findings on concert instance buffers,
reduced-motion redraw and double-click navigation were fixed before release.
A separately discovered asynchronous city warmup is paused during the concert.

Existing live packet, transfer, decode, resident geometry and prefetch ceilings
remain unchanged. The offline-package allowance alone rises from 889 to 891 MiB
for the named-site data and 1,244,331-byte, audio-free concert clip. Full drawn
mobile geometry and independent native geometry remain available.
