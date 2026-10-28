# Bounded historical-test replays in v281

No production geometry, old fixture, residency budget or release limit changes
in this repair. Old tests had stopped at counts from earlier releases, so their
unchanged fingerprints now run against narrow historical projections. Actual
retained buffers, their ordering, materials and transforms remain protected.

## Alexander

Four separate small-site captures use complete Git-restored runtime graphs:
pre-v274 North / pinned HEAD, and pre-v260 PublicRealm / pinned HEAD. The pinned
HEAD is `9fccfb0bfebf5c03a24bf2d3f30a63a16e203059`. The predecessor commits are
recorded with each complete source graph in
`src/app/tests/fixtures/alexander-retention-v281.json`. The assembler rejects any
changed common runtime source except the single proved builder import/append.

- North: every older object remains identical; only the final named
  Schoenhauser Tor mesh was appended in `154466d6`. Drawn: 89 instances / 7,412 B;
  native: 2,107 instances / 160,780 B. Prior totals remain 4/3 draws and
  3,563,436/1,585,100 B.
- PublicRealm: `323d85f8` appended exactly 596 box, 887 rod and one sphere
  instances (112,784 B), or 8,675 native boxes (659,300 B). Prefixes remain the
  complete old model; untouched objects remain identical. Each added matrix and
  colour suffix has its own frozen SHA-256.
- Tests verify both complete current audits and historical retained audits.
  Projections use immutable traversal/prefix views. The original draw counts,
  713,024/1,026,900 B old residual baselines and retained byte ceilings remain.
  Full/mobile equality still compares actual complete current models.

Capture tooling and four logs are in `.cache/alexander-v281-audit/`. Captures
used at most 201 MB RSS and less than one second each. The three test files
passed all 12 tests / 290,682 assertions in 0.99 s, 822 MB RSS, zero swaps.

## Leipziger / Alte Muenze

The failed old prefix came from the already-released v260 cinema recess, not
from the v281 BMF work. Only cell `6:-1`, row 49, full original fingerprint
`[3520.206,3.3,-111.545,37.243,.25,.16,-2.047788,11644834,-1]`, is shortened.
The test independently intersects that original segment with the source
cinema's nine-metre canopy depth. It asserts the full original row, source
anchor and inward vector, preserves the rear endpoint, removes less than one
metre and compares every remaining matrix and colour byte. All original v257
count, draw and byte deltas remain unchanged. Both tests passed, 135,154
assertions, 0.10 s / 138 MB RSS / zero swaps.

## Prepared facade containment

The v176 fixture remains frozen. Rohwedder's exact entrance-fence source owner
adds 348 drawn / 99 native rows with the two v281 metal-edge/medallion roles.
The complete source inverse is reused from the independently captured core
material audit. The old planner complement must reproduce its complete old
block hash. The geometry check compacts only the actual retained matrix/colour
rows, preserving all old material and geometry bytes; it does not regenerate
them from the planner. Europacity is unchanged. All 11 tests passed, 18,497
assertions, 1.56 s / 676 MB RSS / zero swaps.

## Static model audits

The test-only replays do not replace historical snapshots:

- Rohwedder validates every added rendered matrix/colour row, then exposes the
  live retained rows. The complete source inverse pins the exact older builder.
- Topography removes exactly 192 new rendered panel-part rows and reinserts the
  24 prior white panels using their complete original source-ring/ground-height
  formula. Every other live row, including public paths, remains in place.
- Friedrichstrasse restores only the 145 drawn / 99 native generic rows of its
  two documented source owners, extending the existing native replay.
- CityWest freezes the exact inverse of its six v281 source hunks. The actual
  current model without the one named new fountain must equal the `omit`
  control in every audited byte. The unchanged `legacy` control is then checked
  against the still-frozen whole-model fingerprint; equality over the remaining
  actual geometry is therefore transitive. Both factory controls pre-existed
  this test repair.
- Diplomatic uses the independently captured pre-v246 complete module graph
  and the two exact changed-object receipts in `expanded-retention-v281.json`.
  The shared `auditDiplomaticBeforeV246` helper restores the original v141 hash
  from actual current unrelated buffers, including original materials.

Complete current drawn/mobile equality remains separate from these historical
projections. The complete drawn parity file passed 37 tests / 4,399 assertions
in 2.39 s, 776 MB RSS; the complete native preservation file passed 51 tests /
36,714 assertions in 0.96 s, 438 MB RSS. Both ran serially with zero swaps.
All seven repaired files therefore passed 113 tests / 485,446 assertions.

## Expanded details and Tiergarten

`expandedRetentionV281.ts` retains the original pre-v221 Expanded audit and
pre-v246 Diplomatic audit. Four independent captures reconstruct the complete
runtime module graphs from their recorded Git commits. Every common source
change was reviewed against the narrow documented model edits. Current source
hashes and complete current rendered buffers are pinned before any replay.
Expanded has 189 objects: 182 are byte-identical; the seven changed objects are
the architecture body/ink, Diplomatic body/ink, City West body/ink and WELT
gondola. The test temporarily restores the historical attributes of those seven
merged objects, not individually isolated component spans. The complete current
buffer pins and reviewed source diffs provide the complementary change evidence.
All original audit hashes, byte totals, materials and transforms remain checked;
`finally` restores the exact current attribute objects.

Tiergarten uses a separate exact contribution replay. It restores only the
source-identified Robert-Koch v246, taz v272 and 17-June v281 contributions.
Each body/ink insertion is anchored independently to the first subsequent source
contribution that actually has geometry in that stream. Unrelated rendered bytes
remain live. All three Nationalgalerie preservation tests pass (4,939 assertions),
including the unchanged old whole-model hashes.

## Justice / northern park / BER outline migration

`justicePankeBerPreviousV281.ts` performs no whole-outline reconstruction. Its
independent source-only receipt resolves all 18 pre-v205 and 27 current runtime
imports from commit `8838ad4862941a6e09d8180066e1a68330029f06` and the working tree.
The complete four builder texts replay exactly through stored inverse hunks;
all original raw geometry packets are unchanged. The additional changed
navigation module does not generate the model buffers. The original v220
ledger supplies every final historical family/object hash.

- Justice retains actual old instance prefixes: 15,407 drawn / 51,588 native
  rows. It validates all 3,681/7,172 v257 and 244/1,100 v281 suffix rows before
  exposing the prefixes. All three six-triangle basin suffix attributes are
  checked before projecting the old live roof prefixes. Cupola and contour
  objects remain untouched and are included in the old whole-family check.
- The NorthParks family changes only cell `0:-7`, the Schönholzer Heide terrain
  correction. Its complete current correction is independently reconstructed
  from the unchanged cell and explicit v229 receipt. Projection retains actual
  old XZ/colour data, reverses only receipted Y values, reinserts the exact old
  removed triangle indices and recomputes their normals. Only the 33/99 listed
  fitting heights change in the live instance matrices. Other park cells,
  including Panke geometry, remain live and must match the old ledger.
- BER identifies only `way/1083495102` (Pier Nord). It replaces the unique
  matching corrected roof contribution and its edge/native-cap instance span,
  retaining actual surrounding vertex/index/instance data. The observed row
  differences are exactly six drawn and 173 native instances. Glass halls,
  other roofs, runway markings and materials are retained.

All three complete projected families must reproduce the unmodified v220
individual-object ledger. Cleanup restores the same original geometry and
attribute objects; normalized layout, instance divisors, usage, groups and draw
ranges are checked or retained. The combined Outline migration owns the serial
integration tests; this helper starts no additional factory in parallel.
