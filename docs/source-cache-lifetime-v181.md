# Step 10: audited construction-source cache ownership

The production JSON transform keeps ordinary mutable source arrays strongly
cached. The following exact filename/field pairs are exceptions: their only
production importers consume the arrays synchronously while constructing render
buffers, never mutate the source records and never attach those records to the
finished scene. Their parsed graphs may therefore use `WeakRef` caches. If a
later world construction needs them, the original JSON supplies identical values.
No source file, numeric value, rendered buffer, view distance or detail is removed.

| Source JSON | Fields permitted to use weak parsed caches | Audited production consumer |
| --- | --- | --- |
| `districtStreets.json` | `curbs_m`, `markings_m` | `DistrictStreets.ts` |
| `schlossEastStreets.json` | `curbs_m` | `SchlossEastStreets.ts`, then `createSourceStreetSurfaces` |
| `bndHeadquartersV174Source.json` | `surfaces`, `boxes`, `nativeBoxes` | `BndHeadquartersV174.ts` |
| `moabitJusticeV166Source.json` | `surfaces`, `facadeBoxes`, `nativeRuns`, `nativeBarWindows` | `MoabitJusticeV166.ts` |
| `tuWaterV168Source.json` | `surfaces`, `facadeBoxes`, `nativeRows`, `nativeDetailRows` | `TuWaterV168.ts` |
| `alexanderNorthV166Source.json` | `surfaces`, `facadeBoxes`, `nativeRuns` | `AlexanderNorthV166.ts` |
| `mitteHeritageV166Source.json` | `surfaces`, `facadeBoxes`, `nativeRows`, `groundSurfaces`, `groundRuns` | `MitteHeritageV166.ts` |
| `zooGroundsV165Source.json` | `surfaces`, `facadeBoxes`, `nativeRows`, `groundSurfaces`, `groundRuns` | `ZooGroundsV165.ts` |
| `hackescherMarktV163Source.json` | `surfaces`, `facadeBoxes`, `nativeBlocks` | `HackescherMarktV163.ts` |
| `cityWestCinemasV166Source.json` | `surfaces`, `facadeBoxes`, `nativeBlocks` | `CityWestCinemasV166.ts` |
| `neueSynagogeV167Source.json` | `detailRods`, `authoredSurfaces`, `nativeBlocks` | `NeueSynagogeV167.ts` |
| `zooStationV165Source.json` | `surfaces`, `beams`, `boxes`, `nativeBlocks` | `ZooStationV165.ts` |
| `zionskircheV174Drawn.json` | `surfaces`, `detailRods` | `ZionskircheV174.ts` |
| `breitscheidTowersSource.json` | `facadeBoxes`, `nativeBlocks` | `BreitscheidTowers.ts` |
| `kranzlerV165Source.json` | `facadeBoxes` | `KranzlerV165.ts` |
| `outerThinOutlines.json` | `positions` | `OuterThinOutlines.ts` |

Only fields above the existing 64 KiB lazy threshold are affected. Metadata,
navigation arrays, source parent/part inventories, small fields and every
unlisted file retain their previous ownership. Auditing includes helpers called
by these constructors: copied/mapped rows, temporary filtered surface lists,
Mitte terrain adaptations and Zoo roof sampling do not escape into callbacks or
scene metadata. Their final typed attributes own the constructed values.

The six final entries add only fields larger than 200,000 serialized bytes.
The Zionskirche native blocks are deliberately excluded: they are passed to
`registerZionskircheV174NativeRoof` and have an additional navigation owner.
The outer-outline `features` array is also excluded because the root retains it
in `userData`. Its `positions` array is only copied into a new typed attribute;
terrain adjustment mutates that copy, never the source numbers. Neue Synagoge
render-budget metadata retains scalar lengths and a source getter, not a source
array. Zoo station's extra accent rows are assembled in new arrays, and the
Breitscheid/Kranzler factories only copy source records into their final buffers.

The two street files' `surfaces` arrays contain five and two packed base64
records, respectively. They use direct literals, as the Alt-Mitte packets already
do. This avoids retaining the 6,090,180- and 1,126,990-character JSON encodings
alongside separate parsed base64 strings, without changing array identity or
the source strings. These sizes are serialized source lengths, not measured
end-to-end memory savings.

Compatibility and extension constraints:

- `WeakRef` is optional. A browser without it uses the original strong cache.
- A field assignment is explicit ownership transfer and pins its replacement
  strongly, including assignments after sealing. Frozen objects still reject
  assignments. Unlisted fields keep nested mutations and identity indefinitely.
- A genuinely imported named array remains strongly owned by that export, and
  shares the default field's value. Production tree shaking must remove unused
  named initializers so default imports do not retain construction graphs.
- Weak references retain a successfully dereferenced object for the current
  JavaScript job. The audited constructors are synchronous; repeated reads
  during a build therefore share the same graph.
- These exceptions are read-only contracts. If a new consumer mutates one of
  these graphs, remove that field from the allowlist or establish separate
  explicit ownership before adding the mutation. A weak cache alone cannot
  preserve unowned nested mutations across collection.
- Do not generalize this list to all source or navigation files. Matching uses
  exact filenames directly under `src/app/src/data`, not a basename pattern.

`lossless-source-cache.test.ts` runs the actual production bundler and tests
lazy default imports, exact reconstruction after a simulated collection,
strong mutation behavior for unlisted fields, named-export identity, explicit
replacement ownership, frozen assignment and the unsupported-WeakRef fallback.
The existing complete-source round-trip suite checks every transformed payload.
Actual reclamation and release-level memory changes require browser profiling;
the deterministic reference stub only tests cache behavior, not GC timing.
