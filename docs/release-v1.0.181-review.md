# Step 10 — v1.0.181 review

## Scope

The source-bound refinements and their measured/estimated boundaries are listed
in [the v281 scope record](mitte-citywest-transit-v281.md). Existing coverage,
93 tour stops, six modes, full mobile detail and runtime budgets are preserved.
The separate Reuter-West coverage proposal remains pending.

## Completed checks

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

## Storage blocker and pending release gates

The final production build transformed 3,224 modules, then failed after 3m29s
with `ENOSPC` while writing the emitted output. No successful build receipt was
created. Its 50 partial output files (35,448,213 logical bytes) were individually
inventoried, hashed and checked before unlinking only those generated names.
The earlier v1.0.180 package was preserved; dist is empty. Only about 154 MiB
remained free afterward, so another full build was not attempted under the same
condition. The user has been asked to free at least 5 GB.

Production build/package sizes and validators, packaged whole-city internal-
browser inspection, remote publication and live byte verification remain pending.
No package, release or Pages update is claimed. The existing public version stays
v1.0.180. Logs and exact cleanup receipts are in the v281 local task cache.
