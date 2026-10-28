# Step 10 — v1.0.181 review

## Scope

The source-bound refinements and their measured/estimated boundaries are listed
in [the v281 scope record](mitte-citywest-transit-v281.md). Existing coverage,
93 tour stops, six modes, full mobile detail and runtime budgets are preserved.
The separate Reuter-West coverage proposal remains pending.

The continuation adds [zoo animal movement](zoo-animals-v282.md) in every
presentation and [Penguin World / Regenwaldhaus details](zoo-houses-v282.md).
Unverified animal locations remain explicit limits. The further continuation
adds one measured rear aviary with an illustrative chicken, connected drawn
leg movement, paused-family pose continuity and the source-supported upper
tropical-hall roof. Its interpolated roof surface and eave estimate are
distinguished from the retained footprint and official elevation samples.

## Completed v281 checks before the animal continuation

- Complete Python run: 2,123 passed, four skipped. The single initial failure
  was release readiness while the new dist/package was not yet built.
- Ruff formatting/lint and production TypeScript checks passed.
- All 745 Bun test files ran serially in separate processes. The 37 initial
  failures were inspected individually. Exact later-owner migrations are replayed
  only in historical tests, preserving frozen baselines and byte ceilings; see
  [the replay evidence](static-preservation-replays-v281.md).
- Full drawn-city test: 67 passed / 1,183 assertions. Two earlier attempts were
  killed under host memory pressure. Test-only lifetime changes reuse an identical
  complete fixture and reclaim temporary worlds; no production model was reduced.
- Full native-world test: 39 passed / 5,371,853 assertions. Complete native
  synchronous/cooperative construction: 10 passed / 222 assertions.
- Nationalgalerie historical preservation: three passed / 4,939 assertions.
- Final outline/Urania/civic rechecks: 20 passed / 153,710 assertions across
  seven files, plus nine passed across the three earlier outline/ring files.
  Every frozen v220 object and its order match in both families; restoration
  recreates the complete actual current object manifest. All 37 files that
  initially failed now have successful targeted rechecks.
- Independent source review found no new integration-order or navigation-presence
  issue in the required v281 sites. Drawn WELT remains in CulturalDetails; its
  native counterpart is required-site geometry.
- Internal-browser isolated previews checked the new components in both families.
  They exposed and led to fixing a missing vertex-colour attribute on instanced
  materials. This is component QA, not packaged whole-city QA.

## Earlier storage failure

The final production build transformed 3,224 modules, then failed after 3m29s
with `ENOSPC` while writing the emitted output. No successful build receipt was
created. Its 50 partial output files (35,448,213 logical bytes) were individually
inventoried, hashed and checked before unlinking only those generated names.
The earlier v1.0.180 package was preserved; dist is empty. Only about 154 MiB
remained free afterward, so another full build was not attempted under the same
condition. The user has been asked to free at least 5 GB.

At that earlier checkpoint, production build/package validation, browser checks
and publication were pending. The continuation below supersedes the build and
package blocker. Earlier logs and cleanup receipts remain in the v281 task cache.

## Earlier v282 package checks, before the aviary and upper-roof continuation

- Production TypeScript passed. The focused application run passed all 145 tests
  in 18 files, with 3,493,163 assertions. It includes both constructor lifecycles,
  source-preserving animal transfers, routes, heading, frustum visibility,
  streamed buffer accounting/disposal, independent shapes, house ownership and
  navigation. Historical hashes and storage ceilings remain unchanged.
- Both new Python suites passed all 22 tests with `PYTHONPATH` removed. Both
  generators' `--check` modes reproduce their checked-in outputs exactly. Ruff
  checked 933 formatted files without errors.
- Additional native-preload, mobile park lifecycle and static-frame checks passed
  all 46 tests / 687 assertions in three files. The finite source-encoding tests
  and nearby regressions passed another 10 tests / 345 assertions.
- The first complete v282 build succeeded in 3m29s, with 3,235 modules and 317
  emitted files. All emitted bytes were verified, then all 4,426 public files
  were linked unchanged. Its 937,206,583-byte dist exceeded the unchanged
  893 MiB package limit before launcher/manifest extras. No package was made.
- That first build was freshly inventoried and removed only after every exact
  generated file and protected hardlink source was rechecked. All 4,743 output
  names were unlinked; the previous v1.0.180 package and source files remained
  unchanged. The guarded cleanup has a one-use receipt in the v282 task cache.
- [Six finite eager source fields](lossless-eager-v282.md) were losslessly
  encoded. No source geometry, value, eager/strong lifetime or release ceiling
  changed. The final full build passed in 3m25s, producing 317 emitted files
  whose complete bytes were verified. Original startup and worker budgets passed.
- Final extracted package: 4,752 files / 935,159,860 bytes / 891.838 MiB,
  with 1,218,508 bytes below the unchanged 893 MiB ceiling. Source, built assets
  and extracted-package readiness returned no failures. The packaged local HTTP
  startup smoke test passed for v1.0.181 without opening a browser.
- Complete deterministic archives were built and validated sequentially in RAM,
  avoiding another disk copy. ZIP: 765,461,023 bytes, SHA-256
  `9bd539dec5551cf0f0cabd5e83be7e0fa68dd953c9a4a919ba0807258158a456`.
  TAR.GZ: 764,673,496 bytes, SHA-256
  `51eef1b82f98a0aaf41d730ffe7d846e3b29e364233a90dbfaa93af44af5e53e`.
  Both complete archive validators passed; neither archive was uploaded.
- Read-only Pages preflight passed against the unchanged v180 parent
  `7c971b2a3537f14312e8ebed864dae73bfff444c`. The prospective package plus both
  preceding complete live asset sets is 1,021,966,423 bytes, 51,775,401 bytes
  below 1 GiB. Only seven exactly receipted obsolete assets would be removed.
  No Pages mutation was requested or performed.

The internal-browser security check rejected access to the existing preview tab,
reporting a URL-protocol restriction. The rejected action was not retried through
another browser, tab, CDP connection or external Safari. The explicit
[browser startup and mobile interaction gates](deployment.md#browser-startup-gate)
in `docs/deployment.md:39–80` remain unsatisfied. HTTP smoke and source tests do
not prove real canvas readiness or touch/mode interactions. No general whole-city
visual review, endurance or physical-phone check is claimed either. Publication
remains pending; no v181 release or tag was created and the live viewer is still
v1.0.180. Technical implementation and the complete local package are ready for
those remaining browser checks once permitted access is restored.

## Further v282 continuation: aviary, upper hall and motion

This section supersedes the earlier package measurements. The final checks
below refer to this further continuation. At that local checkpoint the live viewer
was still v1.0.180; the publication record below supersedes that status.

- The new animal inventory has 51 illustrative figures, 37 habitats and 50
  retained movement routes. One chicken occupies the complete measured low
  western rear aviary; the main Hühnerhaus and its retained native corner column
  remain unchanged. All five aviary planes survive as an open wire model.
- New drawn limb vertices move around fixed body attachments. Connected feet,
  legs and hands are checked for every new figure and all four headings. Mode
  changes under paused/reduced motion synchronize the destination pose once,
  without restarting continuous rendering or advancing the shared clock.
- The Regenwaldhaus gains its complete mapped upper roof, using 199 retained
  official elevation queries and the exact 16-corner OSM ring. All 125 original
  lower sheets and both packet source hashes remain unchanged. The added model
  uses 250 roof triangles or 1,275 independent native columns; its runtime data
  is 18,252 bytes. Interpolation and the eave estimate are explicitly documented.
- House/animal Python checks passed 24 tests; the new roof derivation passed
  four further tests. All three offline generators reproduce their outputs.
  The house/shape/motion/scene Bun group passed 27 tests / 234,410 assertions.
  The roof geometry, streamed-lifetime and existing-house group passed 14 tests /
  169,294 assertions, with the existing-house checks intentionally overlapping.
  Independent review checked source ownership, full-body route clearance,
  material disposal, resident-only collision, abort and mode-change behavior.
- Production TypeScript passed. Global Ruff formatting/lint passed with all
  935 Python files already formatted. No previous full-suite result is presented
  as a rerun against this continuation.
- A fresh complete inventory guarded removal of exactly 4,743 old generated
  dist names. The retained v181 package and every protected source hardlink were
  verified unchanged before and after cleanup. The new storage adapter retains
  the original Vite plugins and budgets and verifies every final emitted byte.
- The new production build passed in 3m25s: 3,238 modules, 317 emitted files,
  206,373,316 emitted bytes. Exactly identical bytes reused 182,042,570 bytes;
  24,330,746 bytes were written as new output. All 4,426 public files were linked
  unchanged, and the original startup and worker budgets passed.
- Final package: **4,752 files / 935,187,547 bytes / 891.864 MiB**, leaving
  1,190,821 bytes under 893 MiB. Manifest SHA-256:
  `bcba824c17a07b9662fa2e6ed75737e3d35cf1fac4b4250784855fa3902f789e`.
  Source/build/extracted-package readiness returned no failures. The local
  HTTP startup smoke passed for v1.0.181; this is not a real-browser test.
- Both full archives were independently generated and validated sequentially
  in RAM, without a duplicate disk archive or upload. ZIP: 765,469,289 bytes,
  SHA-256 `7ce9e338b5dd644ae980b6b3880c6a43f0849539704f462137fa24e3b619b8e5`.
  TAR.GZ: 764,700,171 bytes, SHA-256
  `6b142e0678ba88eae514028d8b40d1cc73f964e8ea4f9f86fa20b740c7161bf7`.
- Read-only Pages preflight passed against the unchanged v180 parent. The
  proposed complete package and both preceding live asset closures total
  1,021,994,110 bytes, leaving 51,747,714 bytes under 1 GiB. No remote writes,
  new tag, release, upload or Pages publication occurred.

Fresh build, package and archive receipts are in the local
`codex-berlin-v282-continuation` task cache. All cleanup snapshots are consumed;
they must not be reused on this new dist. The browser restriction and unpublished
status described above were the state at that earlier checkpoint; the following
record supersedes them.

## Browser continuation and publication — 2026-10-28

The owner explicitly authorized continuing the internal-browser check and
publication. The local production package was served from a fresh local-port
origin in the Codex in-app browser. Actual UI clicks reached a nonzero,
presentation-ready city canvas on first startup and after reload, with no startup
curtain or recovery panel. The captured proof shows the rendered Brandenburger
Tor view; no external Safari was needed.

The mode menu's visible targets and hit areas were checked at 390×664, 320×568,
844×390, 568×320 and 1024×768. Recorded mode transitions selected Nacht,
Schneesturm, Schwellenraum and Minecraft and closed their sheet. Versunken kept
its sheet open while the 6 m → 21 m → 3 m sequence selected exactly one depth.
Day was the recorded initial selection. The inspected console warning/error log
was empty. Two automation-command timeouts during a heavy transition and reload
were followed by a ready DOM without application warnings or errors; these are
recorded rather than described as a wholly timeout-free run.

These checks used real UI clicks, not injected touch events. The available
embedded-browser API did not provide strict-autoplay emulation. They therefore
do not claim the separate Playwright touch/autoplay profiles, a physical iPhone,
a city-wide visual audit or an endurance run. In particular, the zoo geometry and
animal-route tests above are not being presented as a direct visual inspection
of every zoo enclosure. Local evidence is in `browser-qa.json` and
`local-browser-proof.png` in the continuation cache.

The v1.0.181 release and matching GitHub Pages deployment are now published.
The two published archive formats and hosted bytes are checked against the
prepared package; see the final `package-verification.json` and
`live-verification.json` receipts in the same continuation cache. Existing
unverified species/enclosure locations and the separate Reuter-West coverage gap
remain explicit limits. This publication does not claim that every earlier
requested geographic refinement is complete.

Pages commit `60eaee29f0ecf6675757d5bb2d654f64f177d98c` deployed successfully
in GitHub run `40657684073`. The live manifest matches SHA-256
`bcba824c17a07b9662fa2e6ed75737e3d35cf1fac4b4250784855fa3902f789e`.
Release `426415023` has both remotely verified archives and checksum files.
The independent HTTP check passed for current owning chunks and confirms the
three withdrawn Columbiahalle recordings remain unavailable (404).

The same internal-browser startup, reload, five viewport checks, mode transitions
and 6 m → 21 m → 3 m controls also passed on the public site. The console log
was empty. One browser-command timeout during Minecraft construction recovered
before the next successful interaction. `live-browser-qa.json` and
`live-browser-proof.png` record that separate public check with the same
click-only, device and endurance limits stated above. Both test city tabs were
closed afterward to free memory. Safari was not opened.
