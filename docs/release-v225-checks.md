# v1.0.225 / V345 release checks

This records the **local release candidate**. Public deployment and public-viewer
verification are not claimed here. Evidence is retained in
`/Users/klotzkette/Documents/Codex/2026-10-29/find-isometric-berlin/city-v345/`.

## Completed checks

- Production build and final TypeScript check passed (`build.log`,
  `typecheck-final.log`). The production build completed in 3m 45s.
- **90 focused Python checks passed**; release readiness reported
  `Release readiness OK for v1.0.225` (`focused-python-final.log`,
  `readiness-final.log`).
- The final V345 source-history test passed, including its predecessor chain:
  1 test, 98 assertions (`source-final.log`).
- The local candidate was visually checked in all six modes: **Day, Native,
  Night, Snow, Schwellenraum and Versunken**, plus a **390 × 844** mobile viewport.
  Candidate screenshots include `estrel-candidate.png`,
  `estrel-native-candidate.png`, `estrel-mobile-candidate.png` and
  `tiergarten-candidate.png`. These are local visual checks, not a benchmark or
  a claim of exhaustive photographic accuracy across Berlin.
- Both complete download archives passed exact inventory verification against
  the local package: every path, byte count and SHA-256 matched; inputs remained
  stable during verification (`archive-proof.json`, `archives-verified.log`).

## Exact package measurements

The package contains **6,387 files**, totaling **1,193,314,546 uncompressed
bytes**. The measured increase over v1.0.224's 1,188,242,150 bytes is
**5,072,396 bytes** (`package-size.json`).

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| `isometric-berlin-regierungsviertel-local.zip` | 940,699,483 | `2883131ae902eb0ebd0ce28f88ad81b34909795ad6f3f3b54fd09b85c2b36b72` |
| `isometric-berlin-viewer-v1.0.225.tar.gz` | 939,497,745 | `b461ebae8ed9b947f43ed5e80dfd4d61cabc1e3436ec3c43a4ad02befd1fac05` |

The verified inventory SHA-256 is
`b0036c5ec15a04603ee17a5beaf757296ca5a6c0e3c96201ac448e4c6248a4d5`.

## Known wider-suite limitations

The full repository pytest run was attempted and stopped after **72 passed and
14 setup errors**. The historical `test_adlershof_kuehn_v261` fixture fails in
its predecessor reconstruction at `integrate_lossless_v196.py:110`, where
current and expected manifest chunk counts differ (`pytest-all.log`,
`pytest-first-failure.log`). The test and all scripts in that failing historical
stack are unchanged from the v1.0.224 baseline `2efa9ad2`. The full suite is
therefore **not reported as passing**.

Repository-wide Ruff reports **three pre-existing diagnostics** in
`build_bus_stops_v334.py` and `build_rail_access_v334.py`; its formatting check
lists **31 older files**. Those historical files were left unchanged. Changed
V345 Python files pass their targeted Ruff and formatting checks
(`ruff-all.log`, `ruff-format-all.log`).
