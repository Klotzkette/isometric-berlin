# v282: finite lossless eager source encoding

Six existing fields in five JSON sources now use the existing eager gzip/base64
encoding. Every selected field was an eager, strongly owned literal before this
change. Its module still evaluates it eagerly, exposes an ordinary enumerable,
writable and configurable data property, and shares the same initial object with
its named export. Mutating the object remains visible through both references;
reassigning the default object's property does not rebind the named export.

No raw JSON, coordinates, triangles, indices, colours, independent native geometry,
navigation or source lifetime changes. Existing lazy/weak fields are not selected.
In particular, RKI `parts` and `fittingReceipts` remain strong lazy fields.

The codec, exact-number serialization, gzip level 9, base64 encoding, original
80% admission rule and per-field pure tree shaking are unchanged. No Zopfli
selection or global threshold was added or widened. The five finite paths are
listed in `src/app/losslessEagerFieldsV282.ts`; unrelated prior eager precedence
is unchanged.

## Exact source receipts

Paths are relative to `src/app/src`. These SHA-256 values describe the unchanged
raw UTF-8 source files.

| Source | SHA-256 |
| --- | --- |
| `data/citywestTransportV281.json` | `096ca0fd5151730b90eb392b07f9bccda26d763bbc106fc5c0b0b06e36c4bbaf` |
| `data/mitteEnsembleV281.json` | `751f6f67065b148f32a6771f3c55074f2fd77f9cadeb4d6fda1655c0cbf43a5a` |
| `data/tramRailsV281.json` | `a5264cbf7d3ee5e023866c8953e7e1dfd39f8d92a7cbf4bbf4d1ed435ca1d365` |
| `gendarmenmarktPerimeterSource.json` | `0e188b948c08a1fa16b48baf5dc11af6ac65b574fd702730cd9ab7ba9d785615` |
| `eastOutlineVoxelData.json` | `6bceecb6359087263ef72afa31d1fb78d6279154bf9f15939f55d879dc03f57e` |

The following field hashes cover exact serialized decoded values. Current fields
contain no negative zero or non-finite values; separate adversarial fixtures verify
that the existing exact serializer preserves those cases too.

| Source field | Exact JSON bytes | SHA-256 | Estimated saved bytes |
| --- | ---: | --- | ---: |
| `citywestTransportV281.json:packets` | 1,044,377 | `58e97215684e4c8a307923a9376906bb15be109acdd5fc7da6c71579be49f846` | 655,969 |
| `mitteEnsembleV281.json:drawn` | 109,963 | `5c857965a92cec26b7843972f3bd02339983c3c1d7fa40f695ff1e3adfbd9f80` | 59,165 |
| `mitteEnsembleV281.json:minecraft` | 139,967 | `c390a135efda372a9fe3c5a440519f65b4329854d0b06ac1faf5ac55c6f5b19a` | 84,581 |
| `tramRailsV281.json:ground` | 47,304 | `815323053d307cbd193e8bbdca411c493d78286a3096868144be3dd218d166ee` | 38,924 |
| `gendarmenmarktPerimeterSource.json:buildings` | 455,273 | `d7036a68a111dc585a42c54bbef35e8e2cdf728caea9b78992a7d19557054bcd` | 344,143 |
| `eastOutlineVoxelData.json:cells_i32` | 293,268 | `65e2eedea7b09be74664b8236532107995283090581c5ff96550c1d72be3a36a` | 224,654 |

## Scope and verification

The prior module receipt places these sources in the deferred 3D modules
`SurroundingCityGeometry`, `RequiredSiteEnvelopesV209`,
`gendarmenmarktPerimeterProfile` and `SchlossEastOutlines`, not the initial entry.
The startup landmark catalogue remains untouched. A production-bundler fixture
verifies that importing metadata alone eliminates the compressed field and its
decoder; a combined default/named import performs exactly one eager decode.

`tests/lossless-eager-v282.test.ts` verifies all source and field hashes, exact
decoded values, property descriptors, shared identity, mutations, negative zero,
extreme numbers, own `__proto__` keys, exact path scope and RKI's retained lazy
classification. It also executes the real CityWest transport consumer against
existing drawn and native packets, matching the complete prepared results and
replacement buffer bytes while preserving input packets.

Validation: the new file passes 4 tests / 175 assertions. Existing v274 eager,
v275 Werkhof and v277 site packing tests pass another 6 tests / 170 assertions.
All commands used `BUN_RUNTIME_TRANSPILER_CACHE_PATH=0`.

Per-field minifier measurement estimates **1,407,436 bytes** saved before small
module-wrapper effects. This is an estimate, not a whole-package measurement.

The final full build completed in 3m25s with 3,235 modules and 317 emitted files.
Its complete emitted output is **206,348,571 bytes**, down from 208,419,234 in the
first build: **2,070,663 bytes saved** across all chunks, including repeated
compiled occurrences. Existing startup and worker budgets passed unchanged.
After linking complete public assets and adding launchers/manifest, the extracted
package is **935,159,860 bytes (891.838 MiB)**, with 1,218,508 bytes remaining below
the unchanged 893 MiB limit. No geometry or quality was removed to meet it.
This is local build/package evidence, not publication or browser visual QA.
