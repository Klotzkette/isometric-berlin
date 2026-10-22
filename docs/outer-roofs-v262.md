# Step 10 — v262 bounded outer-house roofs

The owner's continuation adds complete measured roofs to **24 existing ordinary
houses**: eight each in Spandau, Niederschönhausen and Adlershof. This is a finite
selection within existing coverage. It is not a district-wide roof reconstruction
or a claim that other roofs have been checked.

## Evidence and selection

Four already retained official Berlin LoD2 archives were inspected serially,
without downloading or unpacking another city dataset:

| Local archive | Bounded result |
| --- | --- |
| `raw/lod2/LoD2_378_5822.zip` | Eight Spandau houses in `outer187--22_-5` |
| `raw/east-city-v200/lod2/LoD2_391_5825.zip` | No eligible exact Pankow transfer |
| `raw/east-city-v200/lod2/LoD2_391_5827.zip` | Eight Niederschönhausen houses in `east200-4_-15` |
| `raw/east-city-v200/lod2/LoD2_401_5810.zip` | Eight Adlershof houses in `east200-23_17` and `east200-23_18` |

Archive URLs, hashes, complete selected wall/roof sheets, footprint holes,
original packet owners and source creation dates (1–2 March 2026) are retained in
`geo_data/regierungsviertel/outer-roofs-v262-source.json.gz` (32,162 bytes).
The source uses Geoportal Berlin's dl-de/zero-2-0 licence.

Only official residential functions `31001_1000` (Wohngebäude) and
`31001_1010` (Wohnhaus) qualify. These codes follow the
[AdV building-model validation specification](https://sgx.geodatenzentrum.de/public/gdz/dokumentation/deu/LoD2_Pruefplan_fuer_Gebaeudemodelle.pdf).
Named/non-residential/protected mapped footprints, earlier authored owners and
all previous v188/v209/v230 fitted owners and v233 roof owners are excluded.
The existing protected-source inventory is consulted; only the six declared
candidate packets and their immediately overlapping packet families are decoded.
The retained road distance is context, not a condition for a measured roof to be
valid. Selection spreads the chosen houses across each bounded candidate area.

Pankow's initially inspected `north190-4_-11` contains OSM owners. Two nearby
declared packets yielded no complete eligible official match in the one local
archive. Those packets are preserved. This limited negative result makes no
claim about all Pankow roofs.

Every accepted owner has a complete measured footprint matching its prior
envelope within max(0.2 m², 0.1%), source height agreement within 0.12 m, and a
measured roof height range between 1.2 and 12 m. Tile-cut owners and owners
appearing in multiple overlapping source families are excluded. No pitch,
dormer, extra storey or building footprint is inferred.

## Atomic rendering and preservation

`outerRoofsV262.ts` prepares one complete replacement in the already loaded
packet. It verifies the immutable encoded mesh fingerprints, packet origin and
all triangle/line indices before adding anything. Only successfully prepared
replacements can retire the exact old flat envelopes in the decoded buffers.
The complete original packed bytes, navigation, surrounding geometry and v233
recipes remain intact. Their hashes and per-family transfer counts are retained
in `outer-roofs-v262-evidence.json.gz` (2,115 bytes).

Drawn modes use every retained measured wall/roof plane with the existing full
mobile detail. Minecraft independently samples measured roofs over the existing
2 m native footprint and emits orthogonal stepped skin; every native cell must
be covered by a real source roof triangle. Gutters are small display estimates
along evidenced lower horizontal roof edges. Material tones are presentation
estimates; unique retained mapped roof colours/materials take precedence when
available (none matched this finite selection).

The runtime source is 254,312 bytes across eight family transactions in four
existing descriptors. Additions range from 172 to 1,924 stored vertices per
transaction. No public city packet, manifest, descriptor, coverage polygon,
resident-memory limit, transfer limit or tour stop changes. The integration uses
the existing cooperative packet preparation and disposal lifetime.

## Reproduction and verification

`uv run python scripts/build_outer_roofs_v262.py --extract` repeats the bounded
local selection; omit `--extract` to replay the frozen source. No source download
is performed. All three original v233 source/evidence/runtime hashes are checked
before replay.

Targeted tests verify complete residential sheets, original-source hashes,
protected-owner exclusion, exact triangle multisets, independent orthogonal
native geometry and unchanged packet budgets. Runtime tests cover every
transaction, source-byte preservation, exact flat-ink retirement, malformed and
stale receipts, idempotence and cancellation.

The integrated decoder test also builds all four new tiles in both families,
checks every retained position/index and line endpoint against the originals,
accounts for actual allocated buffer bytes and verifies disposal of geometry and
all day/night materials. A separate existing v233 family pair remains unchanged.
