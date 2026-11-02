# Exact v299 / v193 historical preservation replay

`scripts/integrate_fidelity_v299.py` is a read-only adapter for historical
preservation checks. It writes no manifest, geometry, source or reconstructed
gzip file. The immutable predecessor is Git commit
`0f6174362de87d785f6e6f5b864d05e5efa973fc`; its original manifest bytes and full
canonical JSON each have an independent SHA-256 pin. No duplicate historical
manifest is committed.

The adapter first verifies the frozen Stralau supplement and integration
receipt, complete retained source, source inventory, all eighteen drawn/native
payloads, nine exact descriptor identities and the four exact footprint and
boundary additions. Its finite scope is the requested peninsula and evidenced
Hauptstraße 15 parcel. It reconstructs the entire permitted current manifest
from the old Git object, preserving all old descriptor fields and their order,
all earlier footprint/boundary entries, metadata and bounds. An unrecognised
field, extra coverage, removed marker, changed source, changed old descriptor
or changed payload fails the proof. The marker alone grants no exception.

Separately, the twenty-four files in `lossless-packets-v193.json` are bound to
the original source pins in `src/app/losslessSurroundingV193Sources.json`.
Only their reviewed compressed byte sizes and gzip hashes can change; the
decoded byte length and SHA-256 remain identical. The saved size is exactly
4,940,271 bytes. The receipt's `applied` boolean records execution state and
does not authorise different data.

When a historical check needs an original compressed packet, the adapter
verifies the current full gzip hash and decoded hash, loads that exact original
gzip blob from the immutable Git commit, verifies its original gzip hash and
length, and compares both entire decoded byte streams. It returns those
original Git bytes. Recompressing the JSON would produce another gzip and is
never used to reconstruct historical identity.

The existing EUREF v262 manifest normaliser and Spree v242 packet normaliser
call this adapter before their own independent older proofs. The historical
district-facade digest used by StreetCurves also uses its narrowly bounded byte
reader. Every unregistered source is still read byte-for-byte. Earlier release
proofs continue to validate their own exact predecessors after this new layer;
no previous hash or expected release is loosened.

`tests/test_fidelity_lineage_v299.py` exercises whole-predecessor equality,
non-mutation, all twenty-four old/new gzip pairs, and rejection of unknown
metadata, new coverage, corrupt sources/receipts/payloads, forged gzip receipts,
equal decoded JSON in an unregistered gzip form, and corrupt old Git blobs.
Runtime, worker, decode, source, residency, prefetch and the 894 MiB offline
package ceiling remain unchanged.

The separate Bun helpers `sourceHistoryV299`, `nativeHistoryV299Replay` and
`familyHistoryV299Replay` preserve the frozen v281 tests through that same
published v192 anchor. `captureNativeHistoryV299.ts` and
`captureFamilyHistoryV299.ts` construct each immutable Git revision in isolated
processes by substituting its complete transitive module graph; they never
check out or mutate production files. The resulting compact test receipt is
built by `scripts/build_native_history_v299_replay.py`.

Every new root renderable is counted and hashed individually, all retained
records are hashed together, and each changed matrix/colour row or geometry
attribute is inverted from its exact live bytes. The complete prior world
must then reproduce its unchanged original full/mobile snapshot. The adapter
accounts separately for the two new v297/v298 renderables and thirty already
published later renderables, restores the source-bound HBF circulation and
Reichstag changes in the seven native architectural batches, and preserves
all prior assertions and ceilings. Native ground has 185,274 rows in the
published v192 control and current production, versus 185,228 in v281; its
exact inverse is the later complete HBF interior terrain ownership, before
the independent old nineteen tint/U6 changes are replayed.

The old expanded-city control also records exactly three later Potsdamer Platz
lettering/glass additions and four changed old source hall/facade records,
including the old fascia transform and paint. For the 1989 cartographic wall
line, only eighteen Y coordinates respond to the new measured Mauerpark hill;
all XZ positions, indices, other points and the complete old record hash stay
fixed. These projections exist only in tests, restore every live resource
on completion or failure, and reject unknown changes. No old fixture, package
limit, production detail, ground count expectation or retained source is
weakened.
