# Berlin venues and press quarter — Step 10 v272 / v1.0.172

This release addresses the owner's requests for HAU1, HAU2, HAU3, GRIPS,
Technikmuseum and its outdoor rail heritage, Springer/taz, Friedrichstraße and
Kochstraße, and the north side of Alexanderplatz.

- [HAU1, HAU2, HAU3 and GRIPS](theatres-v272.md): complete 22-part HAU source replacement, including HAU3's distinct street-access house and rear third-floor venue. GRIPS retains its existing model and receives additional foyer, roof-edge and stair-landing details.
- [Technikmuseum, aircraft and railway grounds](technikmuseum-v272.md): retained source plans with separately documented height corrections, roof aircraft, 44 m Vestas V90 blade, both rail sheds and turntables, rail alignments and six illustrative historic locomotives behind glazed fronts.
- [Springer, taz, wall art and street fronts](press-quarter-v272.md): measured tower and taz envelopes, estimated facade details and an independently authored interpretation of Peter Lenk's wall relief.
- [Alexander north and the rotating publisher crown](alexander-north-v272.md): source-bound facade refinements, the current BERLINER VERLAG crown and separately identified historical newspaper lettering.

The live viewer keeps 93 tour stops and the same resident/decode/prefetch budgets.
All fine detail stays enabled on mobile. Native Minecraft surfaces remain
independently orthogonal. Exact source receipts govern replacement; no broader
radius masks or erased neighbourhoods are introduced. The old raw Columbiahalle
recordings remain removed.

The rotating BERLINER VERLAG crown uses the existing shared frame loop, updates
at 10 Hz only in a visible scene/frustum, pauses while hidden or reduced motion
is requested, and releases its callbacks with the world. The separate
BERLINER ZEITUNG lettering is an explicitly requested historical reinstatement.

Fine glazing, ribs, metalwork, sign strokes, shop colors and art details are
reference-based approximations. The model is not a claim of surveyed geometry
for every window or an exact reproduction of each sculpture.

## Validation

The internal app browser inspected the new venues in drawn and independent
native mode, including the museum's glazed locomotive fronts, outside-facing
HAU/taz lettering and moving publisher crown. The complete packaged viewer
started in flight mode, zoomed out and remounted into Minecraft without reported
runtime errors. No external browser was launched. These checks do not establish
long-duration stability on an iPhone.

The final focused v272 run passed 19 Bun tests / 504,595 assertions. A further
28 lifecycle/residency checks passed after correcting crown recovery: reusable
GPU eviction no longer permanently disables rotation; final root teardown still
stops it, including construction rollbacks. Additional focused ownership, storage
and material checks passed. TypeScript,
whole-repository Ruff formatting/lint and the complete production build passed.
The complete Python suite passed in bounded batches: **1,966 passed, 4 skipped**
(932 + 915 existing checks, 18 new checks and 101 package/release checks). An
initial run exhausted the host’s free disk space; after freeing only generated
task outputs, the affected file and entire remaining segment were rerun
successfully. Two existing temporary-geodata CRS warnings remain.

The attempted complete Bun run reached 2,354 passing checks and 34 failures
before the host terminated it with signal 9. This is not a completed, green full
suite. Existing keyboard-harness, static-frame, older outline/count/hash and
construction-cache failures reproduce against the fixed preceding source commit
or have identical complete input closures. Historical expected hashes were not
rewritten to hide those discrepancies. The new
[native retirement proof](core-native-retirement-v272.md) independently verifies
every retained matrix and colour byte against that fixed source: exactly 1,079
generic building layers and 2,205 windows retire for HAU/Press; 225 neighbouring
windows become visible. Museum source transfers have separate exact-tuple proofs.

The final production build completed in 16.59 seconds. Publication receipts
follow below after live and archive verification.
