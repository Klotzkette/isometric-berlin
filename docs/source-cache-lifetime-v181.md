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

## v196: newer outer-landmark construction graphs

The following additional exact fields were audited across all production
importers and their batch helpers. They contain 16,992,963 compact JSON bytes,
484,003 arrays and 25,022 objects in the current sources. These are source-graph
sizes, not a claim about browser memory savings. They were already lazy, but
previously stayed strongly cached after their first construction read. Switching
between drawn and native styles could therefore retain both parsed graphs after
the old render buffers had been released.

| Source JSON | Newly weak constructor fields | Audited production consumers |
| --- | --- | --- |
| `westLandmarksV187.json` | `groups` | `WesternLandmarksV187.ts` |
| `eastLandmarksV187.json`, `eastLandmarksV187Native.json` | `cells` | `EastLandmarksV187.ts`, `MinecraftEastLandmarksV187.ts`, `eastLandmarksV187Batches.ts` |
| `southWestLandmarksV187.json`, `southWestLandmarksV187Native.json` | `sites` | `SouthWestLandmarksV187.ts` |
| `northSitesV190.json`, `northSitesV190Native.json` | `cells` | `NorthSitesV190.ts`, `MinecraftNorthSitesV190.ts`, `eastLandmarksV187Batches.ts` |
| `airportsV194.json` | `surfaces`, `boxes` | `AirportsV194.ts` |
| `teufelsbergStationV195.json` | `surfaces`, `lines` | `TeufelsbergStationV195.ts` |
| `westLakesV194.json` | `sites` | `WestLakesV194.ts` |

The factories and `justicePalaceV183Boxes` copy positions, colours, indices,
normals and instance transforms into final typed attributes. Filtered lists and
construction loops do not escape through callbacks. Western scene metadata
retains only each small `anchor` array; Southwest and drawn West Lakes retain
only small `owners` arrays. Those arrays have no parent back-reference and do
not keep their site's geometry or the top-level field alive. North-site owner
metadata is a separate top-level field and keeps its original ownership.

The exclusions are intentional. `teufelsbergStationV195Navigation.ts` reads
`boxes` and `blocks` for live collision queries; `airportsV194Navigation.ts`
indexes and reads `navigation` and `blocks`. `westLakesV194Navigation.ts`
retains native building boxes from `westLakesV194Native.json.sites` after an
actual nearby Minecraft collision query. Those
fields, terrain profiles, source inventories and every other unlisted field
keep strong caches. Geometry reconstruction must never make a navigation
query repeatedly decompress a source graph.

West Lakes previously read the whole native sites array at module import,
including its water positions, indices and colours, merely to prepare collision
boxes. The native building lookup now initializes on the first nearby native
collision query; Day, drawn water and distant native queries do not read that
array. The same original boxes and height extrema are cached, with no copies or
new approximation. `west-lakes-navigation-lazy.test.ts` checks zero native-site
decodes for those earlier queries and collision at all 1,793 original box
centres, plus retained opening/outside checks.

`outer-source-cache-v196.test.ts` bundles these real factories with the
production transform. It compares complete geometry attributes, indices,
instance matrices/colours, transforms, materials and culling bounds against
the strong-cache fallback through drawn/native/drawn construction, with
deterministic collection between builds. It also verifies exact field
reconstruction and the explicit live-navigation exclusions. No source data,
draw count, render distance, representation or model detail changes.

## v198: park refinements and exact roof-coordinate storage

The following constructor-only fields use the same audited weak-cache contract:

| Source JSON | Fields | Consumer |
| --- | --- | --- |
| `tegelSpandauV198.json`, `tegelSpandauV198Native.json` | `sites` | `TegelSpandauV198.ts` |
| `northParksV198Drawn0.json`, `northParksV198Drawn1.json`, `northParksV198Native0.json`, `northParksV198Native1.json` | `cells` | `NorthParksV198.ts` |
| `eastParksV198.json` | `grounds`, `trees`, `paths`, `facades`, `buildings` | `EastParksV198.ts` |

Only fields over the existing 64 KiB threshold participate. Navigation imports
separate compact terrain, footprint, collision and water payloads. Factories
copy all positions, colours and instance transforms into typed buffers; no
large source graph is retained in scene callbacks. The production cache test
reconstructs drawn/native/drawn styles and compares complete buffer/material
fingerprints after simulated collection.

Root-array JSON modules may now retain gzip/base64 source instead of the raw
JSON string when that encoding is smaller. Their eager parsing, strong mutable
array identity and every numeric value are unchanged. The Alt-Mitte roof
navigation arrays have an independent Float64 encoding and typed spatial index;
see `viewer-stability-v198.md`. Neither optimization alters render geometry.
