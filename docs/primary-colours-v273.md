# Existing primary city colours — Step 10 v273

The previous shared-corner repair covered nine example tiles. This pass audits
**all 1,635 retained primary tiles, independently in drawn and native mode**:
296 original numbered tiles, 150 Ringbahn, 67 southern-city, 822 outer-city,
84 northern, 199 eastern and 17 Marzahn tiles. A separate scan of every other
manifest descriptor found no additional `city` mesh outside that inventory.
No geographic boundary, public source packet or mesh encoding changes.

The retained exact-default wall and roof bytes remain the only eligible roles.
Unique source corners now use twelve restrained plaster estimates and eight
independent, darker roof estimates. Stable source IDs select shared immutable
palettes across packet boundaries. These colours are contextual estimates for
unknown paint, not observations of individual addresses or roof materials.
Existing measured roof geometry, known materials and authored details retain
precedence. The earlier v263 nine-tile receipts use the same new fallback palette
without being duplicated by the new receipts.

For formerly ambiguous centimetre corners, the offline audit requires complete
original wall quads or fully contained original roof triangles, with unanimous
source ownership across **every** incident triangle. It resolves **609,998 drawn
and 1,003,307 native colour vertices**, in addition to the prior 6,924/11,504
vertices. The new receipts touch 72,441 distinct drawn and 59,221 native source
identities before later explicit-material writers. These are source identities,
not a count of surveyed houses. Truly ambiguous corners remain unchanged.

Each construction checks exact origin, navigation fingerprint and every original
position/colour/index stream before writing. The entire recipe is validated
before any write. Rejected or cancelled construction adds nothing to the scene.
No position, index, normal, UV, source navigation or line is changed. Native
corners are proved against their own orthogonal geometry, not the drawn mesh.

## Bounded memory and verification

The 2,006 nonempty receipts are divided into 32 deterministic SHA-keyed shards.
Together they are 39,963,344 bytes of unencoded JSON; the largest is 1,817,999
bytes. The production lossless codec retains encoded strings and weakly holds
only a decoded shard while it is needed for yielded construction. Tiny eager
indices reject unrelated packets before opening a shard. Roots retain final
vertex colours, not the receipt graph; no per-frame work, renderable, GPU buffer,
texture or concurrent network request is added. Resident/decode/prefetch limits
and mobile detail are unchanged. The additional encoded receipts do increase
the lazily loaded geometry module's download size; this is not a zero-byte change.

The full inventory and independent source hashes are recorded in
`geo_data/regierungsviertel/primary-colours-v273-audit.json.gz`, with all incident
triangle proofs in its 32 companion files. Every actual runtime receipt is
replayed by `src/app/tests/primary-colours-v273.test.ts`, checking complete buffer
complements and immutable source objects. The Python suite independently
reconstructs all ownership proofs. Known v232/v254/v263/v271 material precedence,
source mutations and shared-ID stability have focused regression checks.

Sixteen actual previous/current factory comparisons cover Schöneberg, Steglitz,
Kreuzberg, Friedrichshain, City West, Mitte, the outer west and north in both
modes. Each has changed colour bytes and identical geometry/index digests and
GPU attribute byte counts. The core Moabit path has separate exact-part proofs.

Sources: retained Berlin LoD2/ALKIS (Geoportal Berlin, dl-de/zero-2-0) and
OpenStreetMap context (© OpenStreetMap contributors, ODbL-1.0). No new source
photographs, textures or geographic data are distributed.
