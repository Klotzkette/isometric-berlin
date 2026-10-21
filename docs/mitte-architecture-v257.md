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
passed. Integrated production-browser results are recorded below.

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

## Concert runtime checks

Desktop Chrome and iPhone-13-emulated WebKit passed the complete concert flow
in drawn day and independent native mode. Each combination entered and left
four times. All concert GPU buffers were deleted after each visit, no city
warmup buffers were allocated while inside, and no page, context-loss or GL
error was recorded. The recording stayed muted, looped after its end, and
manual pause survived background/resume. Exit restored the exact outside
camera and retained the prior audio intent. Keyboard/double-click navigation
did not move the hidden city. Mobile controls were inspected for obstruction.
These are browser/emulation checks, not a physical-iPhone endurance guarantee.

## Final package and visual audit

The final production build passed 48 site views: all twelve named camera
positions in desktop Chrome and iPhone-13-emulated WebKit, each in drawn day
and independent native mode. All views were ready, without page/crash events,
context loss or GL errors. Screenshots were inspected. The courthouse's
restored curved frontage is closed and its new fittings now follow that curve.
Some older generic window strips remain at Zur letzten Instanz, and a short
retained source structure remains near one plant stack; neither is claimed as
a fully surveyed reconstruction. The two 35 m stacks are visible and no old
150 m stack appears.

The complete package contains 4,727 files / 933,413,287 bytes (890.172 MiB),
within the 891 MiB offline allowance. Both deterministic archives passed the
original complete archive validators; GitHub's remote sizes and SHA-256 digests
match `releases/SHA256SUMS-v1.0.157.txt`. With local disk space limited, each
archive was built, validated and uploaded sequentially in memory; no source
geometry was removed to make room. The non-archive release-readiness checks
also passed.

The prospective Pages tree contains 1,057,789,877 bytes, leaving 15,951,947
bytes below 1 GiB. It retains all 317 hashed assets referenced by the two
preceding live releases; 92 of these are no longer in the current package.

## Publication

Published on 21 October 2026. Release/tag `v1.0.157` points to source commit
`9b73b95dd2df1b8af7f59b5aaecdbb0b2249b314`. Pages commit
`1ba55fab172dc17be2f583bf1cadd85e27c901c4` was deployed successfully by
[run 39664750173](https://github.com/Klotzkette/isometric-berlin/actions/runs/39664750173).
Fifteen hosted files, including the entry page, package and city manifests,
prior playground packets, source credits, silent recording and eight affected
application bundles, matched the final package byte-for-byte. Both published
archive sizes/digests match the committed versioned checksum receipt.

Viewer: <https://klotzkette.github.io/isometric-berlin/>.
Downloads: <https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.157>.

Eight additional public-site views passed for the ministry and plant across
Chrome/WebKit and drawn/native modes, with no page/crash events, context loss
or GL errors. The hosted concert also passed its full WebKit-day entry, silent
recording/loop/pause, background-resume and repeated-exit checks, again with zero
remaining concert buffers. Public ministry/plant screenshots were spot-checked.
