# Theatre corner snapshot receipt — v1.0.119 / step 10

The v219 snapshot updates accept only the bounded Albrechtstraße 12 corner
in `FriedrichstrasseArchitecture` and the Mori-Ôgai corner in
`LuisenCorridorArchitecture`. The immutable comparison release is v1.0.118,
commit `c6f7f9d4937d7689ef5b44aa98c98ab80121e96e`. Every historical fixture,
including the v218 whole-world, native-core and static-model fixtures, remains
unchanged.

## Independent capture and preservation

Eight separate Bun processes captured synchronous full/mobile world and core
factories for the old and current code. A test-only `onLoad` interceptor reads
the four changed runtime modules from `git show` for the old run; it does not
rewrite working files. These are the two architecture modules and their two
profile helpers. All other runtime modules and source payloads are identical.
Two further independent processes captured the affected static drawn/native
factories in both profiles. Every old result exactly reproduces its frozen
v218 fixture, including hashes, counts and buffer sizes.

The receipt compares objects in traversal order, checks their identity and
preserves duplicate occurrences. Each object hash includes its name and
matrix, every geometry attribute and index, and complete instance matrices
and colours. Separate geometry/colour hashes and byte counts are retained.
The hashes of the full ordered unchanged-object records agree before and
after. Static factory hashes additionally cover material properties, visibility,
draw ranges and world transforms.

The complete world retains **354 / 352** byte-identical objects in full/mobile;
the separate core context retains **341 / 339**. The only four changed objects
and their per-profile native differences are:

| Existing object | Instance difference | Buffer-byte difference |
| --- | ---: | ---: |
| Luisen corridor masonry and metal details | +1 | +76 |
| Luisen corridor framed glazing | −3 | −228 |
| Friedrichstrasse masonry and metal | +58 | +4,408 |
| Friedrichstrasse facade glazing | 0 | 0 |
| Total | **+56** | **+4,256** |

The Friedrichstraße glazing retains its instance count but changes the bounded
corner arrangement. Luisen's three removed panes are the specifically corrected
false upper corner windows; the source-bound brick fields replace their earlier
generic fittings. The Kalkscheune batch and every other world object are exact.
No object or shared geometry is added. Both drawn modes' device profiles remain
identical for the affected factories.

## Current measured totals

| Context | Profile | Instances | Renderables | Buffer bytes |
| --- | --- | ---: | ---: | ---: |
| Complete synchronous world | Full | 4,407,963 | 357 | 383,471,044 |
| Complete synchronous world | Mobile | 2,042,268 | 355 | 203,228,768 |

The native-core fixture contains 174,560,518 bytes / 569 buffer records for
full and 168,931,218 bytes / 565 records for mobile. Both world and core gain
exactly 4,256 bytes; world renderables and core buffer records are unchanged.

These static audits use each factory's complete default data context. The
deployed world and dedicated edge tests pass their bounded source selections,
so their absolute Luisen instance totals differ while the correction's delta
is identical.

| Static factory | Profile | Instances | Buffer bytes | Difference in instances / bytes |
| --- | --- | ---: | ---: | ---: |
| Friedrichstraße drawn | Full = mobile | 21,578 | 1,694,360 | +38 / +2,888 |
| Luisen drawn | Full = mobile | 28,336 | 2,154,184 | +5 / +380 |
| Friedrichstraße native | Full | 23,568 | 1,791,816 | +58 / +4,408 |
| Friedrichstraße native | Mobile | 20,222 | 1,537,520 | +58 / +4,408 |
| Luisen native | Full = mobile | 15,787 | 1,200,460 | −2 / −152 |

Drawn Friedrichstraße retains three draws and 1,518 stored vertices; the other
listed static factories retain two draws and one shared 24-vertex cube. The
differences consist only of existing instance buffers, at 76 bytes per instance.
These measured totals do not change any runtime residency allowance.

## Retained fixtures and regressions

The machine-readable evidence lives in:

- `src/app/tests/fixtures/minecraft-world-v219-baseline-audit.json`: immutable
  base, before/current source hashes, world/core object receipts and static
  before/current snapshots.
- `minecraft-world-synchronous-v219.json` and `core-material-native-v219.json`
  in the same fixture directory: current whole-world and core signatures.
- `static-model-full-overrides-v219.json` and
  `static-native-model-overrides-v219.json`: only the two affected factories.

The v218 regression continues to assert its own v117-to-v118 receipt against
the frozen v218 snapshots. The additional v219 regression links every changed
before-object directly to v218's recorded after-object, matches old/current
summaries, verifies the exact four-object difference, and checks equal hashes
for all unaffected objects. All unrelated static factories continue to match
their earlier snapshots. Cooperative construction must reproduce the new
synchronous whole-world hashes in both profiles.

Validation is run as four separate processes to avoid the known memory pressure
of combining the complete Bun suite in one process:

```sh
bun test tests/static-model-detail-parity.test.ts
bun test tests/static-native-model-preservation.test.ts
bun test tests/core-material-v211.test.ts
bun test tests/minecraft-construction.test.ts
```

The commands run from `src/app`. All four processes passed: 36 drawn-detail,
51 native-preservation, six core-material and ten construction tests, for
**103 tests / 574 assertions**, with no failures. `git diff --check` also passed,
and no tracked historical fixture has a diff. This snapshot receipt does not
claim a complete Bun-suite, browser or physical-device endurance result; those
are separate release checks.
