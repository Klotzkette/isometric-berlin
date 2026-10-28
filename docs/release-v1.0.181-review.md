# Step 10 — v1.0.181 review

## Scope

The source-bound refinements and their measured/estimated boundaries are listed
in [the v281 scope record](mitte-citywest-transit-v281.md). Existing coverage,
93 tour stops, six modes, full mobile detail and runtime budgets are preserved.
The separate Reuter-West coverage proposal remains pending.

The continuation adds [zoo animal movement](zoo-animals-v282.md) in every
presentation and [Penguin World / Regenwaldhaus details](zoo-houses-v282.md).
Unverified animal locations and the upper tropical-hall roof remain explicit
limits, not claimed reconstructions.

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

## v282 continuation checks

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
