# Native core material preservation audit, v281

The final case in `core-material-v211.test.ts` still expected the v219 whole
factory aggregate (569 records / 174,560,518 bytes in full mode). That fixture
predates later released authored buildings. It remains unchanged, as does the
v211 original fixture. The new v281 receipt uses independently restored commit
`9fccfb0bfebf5c03a24bf2d3f30a63a16e203059` as the immediately preceding release.
This is an exact preservation audit, not an increased geometry or memory limit.

Four processes captured HEAD/full, current/full, HEAD/mobile and current/mobile
serially. Bun's `onLoad` hook restored **every transitive runtime TS/TSX/JSON
module** from that commit for HEAD, including the unchanged fixture helper.
The three public voxel/prism/scene payloads matched both their frozen v219
SHA-256 values and that Git commit before constructing any scene.

| Profile | Pre-v281 records / bytes | v281 records / bytes | Unchanged objects |
| --- | --- | --- | --- |
| Full | 577 / 182,283,346 | 579 / 182,464,874 | 345 |
| Mobile | 573 / 176,654,046 | 575 / 176,835,574 | 343 |

The earlier informal HEAD observation of 182,242,914 bytes was not substituted
for this complete transitive capture. Both profiles have exactly five modified
renderables, one added renderable and **no removed renderables**:

| Reviewed change | Instance delta | Byte delta | Bounded preservation evidence |
| --- | ---: | ---: | --- |
| Kanzleramt signature: 15 iron parts and 9 lawn tiles | +24 | +1,824 | Removing only indices 688–711 from the actual current matrix/colour arrays reproduces all 690 HEAD instances exactly, including the two final flagpoles. |
| BMF entrance screen: metal edges and small medallions | +99 | +7,524 | Exact planner-derived insertion indices are recorded; the remaining 17,206 full / 12,067 mobile actual rows reproduce HEAD matrix/colour hashes. |
| Friedrichstraße masonry/metal | −76 | −5,776 | Complete old planner remains byte-identical after its rename; `mitte-ensemble-v281.test.ts` checks only the two receipted generic frontage grids retire and all other owners remain equal. |
| Friedrichstraße glazing | −23 | −1,748 | Same exact owner/control receipt; the complete current result, colours and materials are also frozen separately. |
| Topography exhibition | +168 | +12,768 | Exactly 24 white proxy panels become 24 × 8 open frame/marker parts. `topography-exhibition-v281.test.ts` freezes all other plan rows, all 941 solids and the retained 72-part trench structures. |
| Weltkugelbrunnen | +2,188 | +166,936 | One independent native batch, two buffer records. The existing ownership tests retain the exact source-column transfer guard; this synthetic fixture supplies no affected source columns. |
| **Total, each profile** | **+2,380** | **+181,528** | **+2 buffer records** |

For every unchanged object the receipt hashes ordered full ancestor path, name
and occurrence within that path, followed by its complete record. The record
includes attributes/index buffers, local/world matrices, instance matrices and
colours, material parameters (including `vertexColors`), draw groups/range and
visibility. Matching by complete path avoids renumbering unrelated unnamed
meshes when the unnamed Weltkugel batch is inserted. Duplicate occurrences and
object order remain protected; names are never collapsed into a set.

The five changed objects' presentation hashes remained identical to HEAD.
The new test verifies their exact complete current records rather than merely
excluding them. It also performs the two additive row replays above and checks
exact inverse source hunks for all four modified older builders. Replaying those
hunks must recover their entire independently captured HEAD source bytes. This
preserves the complete old Friedrichstraße control planner and proves that the
Topography implementation changed only its documented panel expression/import.
The dedicated site tests continue to enforce the source/ownership and physical
opening details; this receipt does not replace them.

The original full-factory geometry assertion remains, now against the separately
named v281 fixture; colours are checked exactly as well. Existing per-owner body
colour tests are unchanged. Both capture and test resolve pending local/world
transforms with `updateMatrixWorld(true)` before taking either snapshot. No
broad owner exclusion, skipped test, production
change, memory threshold or runtime/package budget change was introduced.

This is the existing **synthetic core-material fixture**, with nine test columns
near scene coordinate 8000 and empty `ground_rows`, plus all context added by
the normal native factory. It does not claim to capture the real 185,228-row
ground field, streamed packet graph or required-site additions. Those retain
their separate ground/ownership/geometry tests.

The ignored `.cache/core-material-v281-audit/` contains the four full captures,
capture script, read-only comparison and receipt preparation script. The tracked
`core-material-native-v281-audit.json` records their pinned commit, capture-tool
hash, source-graph hashes, immutable payload/fixture hashes and exact reviewed
records. Capture wall times were 17.88 s, 7.01 s, 15.51 s and 6.68 s respectively;
maximum RSS was 3.17, 3.31, 3.39 and 3.02 GB. Each process exited before the next;
all reported zero process swaps. These measurements are not runtime budgets.

Validation: `bun test src/app/tests/core-material-v211.test.ts` completed with
**7 pass, 0 fail, 157 expectations**, 6.77 s wall time and 2,491,842,560 bytes
maximum RSS, with zero process swaps. The first run exposed only the test's
snapshot ordering (before versus after transform resolution); moving the
existing record capture ahead of the aggregate fixed that mismatch without
changing any fixture value. No other test/build was run in this audit slot.
