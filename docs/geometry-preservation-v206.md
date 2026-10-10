# Step 10 v206 geometry preservation

The immutable comparison is release v1.0.105, commit
`8838ad4862941a6e09d8180066e1a68330029f06`. Before the v206 edits,
`src/app/scripts/audit-preservation-v206.ts --baseline` independently loaded the
affected constructors and Urania source data from that commit. Both complete
Outline signatures exactly reproduce the unchanged v205 synchronous fixture:

| Representation | Objects | Attribute bytes | SHA-256 |
| --- | ---: | ---: | --- |
| Drawn | 671 | 42,783,555 | `294133db8ac507a35908f6fc1ab49da67441ca139644c7c7f5c66500c4944123` |
| Minecraft | 538 | 73,356,948 | `680eabf4b7a6446cb863dfd59d53038ec7c4c608a590c3e3b27c1d4d75604a94` |

The separate City West constructor contains 18 objects, 11 draw calls,
109,458 vertices and 2,365,830 attribute bytes. Its existing static audit is
`0bd241b9e4f3eab0c14c420dcffca5d439454aabac54f44a77714ba438f7e671`.

`geometry-v205-preservation-v206.json` records each old object's stable hierarchy
key and digest. A digest includes the local transform, visibility, render order,
frustum policy, instance count, complete attribute inventory, every typed buffer
byte and its shape. Every old object can therefore be checked individually,
including Lützowplatz garden edges and the exact Urania roof. The fixture stores
no alternate render geometry. New construction is tested against an independently
captured synchronous result, separately from the old-object preservation checks.

The v203, v204 and v205 reference fixtures stay unchanged. Their full historical
hashes remain the audit starting point. The separate
`outline-landmarks-v203-retained-v206.json` receipt is derived from the immutable
constructor and the old v204 layout. It first reproduces both complete v203
hashes, then records the complement of the exact two drawn / one native Urania
objects. No entire city family is excluded.

The legacy `Urania mirrored entrance ensemble` has exactly four hierarchy records
and 13,392 attribute bytes. The explicit constructor opt-out removes only these
records. All 14 other City West records, including church glass and the rotating
Europa-Center star's initial transform, remain byte-identical on both full and
mobile profiles. The original proxy recipe remains available through the default
constructor for historical checks.

The v188 complement retains its parent and complete Lützowplatz garden batch in
both representations. Its old Urania mesh contains 26,716 drawn bytes or 146,644
native bytes; the 318-byte source roof is transferred into the new Urania group.
An independent test compares that roof with the pre-edit v205 digest, including
every position, normal, index and local transform. Thus its changed hierarchy
location does not authorize any source-roof change. Historical default v188
construction continues to reproduce all original records.

## Final integrated construction

After the two new factories and their data were frozen, independent synchronous
captures produced `outline-landmarks-v206-synchronous.json`:

| Representation | Families | Objects | Attribute bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Drawn | 52 | 726 | 44,241,335 | `2a07968f35992e9f8ad82c67e1e695dd9e45ecc0d52d19d8fca90dacce9ac01a` |
| Minecraft | 55 | 598 | 76,218,612 | `d33925740c2def0459c2ec6bb970aa551501e31dffd5049e6ecf7d83309c3158` |

The cooperative constructor matches those complete results exactly in both
modes. Its old-byte comparison also matches the independently captured v203
complement; a second regression checks every retained complete v205 object,
including the later v205 additions, by its individual digest. Partial-construction
cancellation still disposes completed families and their unique resources.
The new street-paint and Urania factories have their own source, bounds, native
layout, navigation and exact-owner tests; their additions are not folded into a
blanket historical exclusion.

Validation: 14 Bun tests passed across `outline-construction-v203.test.ts`,
`urania-preservation-v206.test.ts` and `urania-arc-v206.test.ts`, including the
exact 86-column Urania replacement and the migrated roof. The separate traffic
signal review passed 10 tests. Its identified native phase-change redraw race
was corrected by retaining render invalidation across skipped frames, without
marking shadows dirty or treating kite motion as signal changes.

Reproduce the constructor captures from `src/app` with
`bun scripts/audit-preservation-v206.ts` and the `--minecraft` variant.
`--baseline` selects the immutable released constructor recipes and verifies the
complete old v203 signature before deriving its exact substitution complement.

## Coarse Urania owner and historical Minecraft chain

The new source model also replaces precisely prism `11687794` and its 86 old
four-metre source columns. `minecraft-payload-only-v206-delta.json` adds a narrow
stage in front of the frozen v202 → v200 → v192 buffer-replay chain. No older
fixture or expected hash changes. Independent source-ring selection reproduces
the exact 86 five-value tuples; the adjacent owner `33654713` is retained.

`audit-urania-payload-v206.ts` captures each profile twice. `--before` disables
only the uniquely matched new Urania source-column guard in an in-memory Bun
loader. Every resulting named payload buffer reproduces the frozen v202 count
and SHA-256. Ordinary invocation captures the actual new constructor. Each
capture keeps only a complete buffer digest plus the records in the 86-column
footprint and its immediate neighbour cells; it does not write a second world
or large render-buffer dump. `--mobile` selects the second profile.

Comparing those bounded local records yields exactly:

| Buffer | Removed | Added | Retained from the old buffer |
| --- | ---: | ---: | ---: |
| Full building layers | 258 | 0 | 1,199,196 |
| Mobile building columns | 86 | 0 | 441,484 |
| Full facade panes | 144 | 12 | 1,339,466 |

The 12 additions are newly exposed faces of adjacent retained columns. Tests
independently enumerate the affected source faces, constrain every removed
matrix to the exact owner and height range, constrain every added face to a
retained neighbour facing that owner, and sum each column's layers to its full
12 m source height. Replay combines the live new buffers with only these
audited records, preserving order, and recovers every old matrix/color hash.
The complete `minecraft-voxel-world.test.ts` passes 36 tests.

The distant-envelope test restores the same complete retained prism record to
its ownership accounting. Its original total of 23,576 and 496 courtyards stays
fixed. The exact transferred-owner set grows from 17 to 18; a foreign-ID copy
of identical geometry still renders, excluding an accidental area-wide mask.
All 10 distant-envelope tests pass.
