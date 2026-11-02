# Strict source history before the v299 controls

The published v193 commit is
`ac0e16fb2f0ed8fdb63e62d52e7d00c4340d8a37`. Its complete bytes reproduce every
one of the 1,139 existing `native-history-v299-replay.json` current-graph pins.
That original fixture, its immutable 0f/v281 controls, source inverses, geometry
receipts and Golden snapshots remain unchanged. Its whole-file SHA256 remains
`d31c70dc72db806999785e02991eb468ee7ee5404333b488ecabe98eaf7d8b4e`.

The v300 layer first validates the entire additional current production source
set, including all newly imported modules and JSON which remain disabled in
historical default constructors. Every changed existing full file has a finite
inverse independently compared with its actual published Git blob. A hunk must
occur exactly once; the input hash, resulting full complement hash and the
published source graph must all match. A matching filename cannot substitute
mutated content. Newly added sources have complete current hashes but no fake
historical replacement.

The final layer pins 1,829 current files against 1,809 published Git controls,
with 20 completely new production modules/JSON files and ten exact changed-file
inverse receipts. All 1,139 earlier graph pins remain unchanged.

Only after that current→published-v193 projection does the unchanged v299
source chain reach its existing 0f and v281 controls. Geometry history remains
separate: these controls do not remove any actual new production detail, relax
assertions, re-sign old graph pins or replace any Golden hash.

`scripts/build_native_history_v300_source.py --frozen-product-sources` captures
only after root confirms the shared product source freeze. It reads actual
Git blobs through `git cat-file --batch`, checks the old fixture against the
published commit, and verifies the complete current file set and hashes again
before writing the separate test-only fixture. It never imports or edits a
production module. Any later product-source edit requires an explicit new
capture of this additional layer; it cannot be ignored by the old controls.

Synthetic Bun tests cover complete graph verification, newly imported JSON,
immutable old pins, ambiguous inverses, unknown source bytes, missing inverses,
and the complete retained source complement. Product construction and existing
Golden suites then independently verify their original runtime outputs.
