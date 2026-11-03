# Finite v196 lossless packet encoding

The release re-encodes 1,280 existing gzip assets and saves exactly
**27,748,130 bytes (26.463 MiB)**. Their 927,171,901 complete decompressed bytes
remain identical to immutable Git commit
`9727870f79db9c6a6e9d6437668e5ac13229522f`. This includes every source coordinate,
colour word, triangle index, navigation record, JSON property and whitespace
byte. No geometry, material, detail, runtime cache or packet budget changes.

The finite selection comprises 768 ordinary `outer187` files with tile X ≥ 12
or ≤ −14, plus 512 high-byte ordinary base/ring/district files. Previous
v193/v194/v195 sets are excluded. Every selected asset has the ordinary exact
`<chunkId>.<mode>.json.gz` name; renamed hero assets are excluded. Complete
303/304/305 recipe tile IDs and all known final 306/307/308 tile IDs, including
the CBF tiles `outer187--8_16` and `outer187--7_16`, are excluded. Selecting either
mode for a new recipe excludes that entire chunk ID.

`losslessSurroundingV196Sources.json` is the exact immutable original-source
whitelist. `lossless-packets-v196.json` records original/current gzip sizes and
SHA-256 digests, decoded size/digest, chunk identity, mode and per-file savings.
Its strict helper uses these fixed controls:

| Control | SHA-256 |
| --- | --- |
| Original published manifest | e604a386661943d66c0789db1ff6fb9dbfa12d2ad5068a5699b6be0270ed2ad4 |
| v196 source pins | 509b0d1325c5b827663a332a0fab4e78bfb59698b0a3f2c0d3e11eb027bcb318 |
| Applied v196 receipt | a86ac4b5949c066e18c23b80e96836cfb1138fa6c08ca6abde51d06532e9fef8 |
| Wire-only resulting manifest | a0e6feb92ff3624360b207472c27b0d5006d389688ba1c78415af32746ba2d0e |

The manifest changes only the 1,280 registered `bytes` and `sha256` fields.
Decoded size, filenames, source bounds, all other descriptors and the complete
manifest complement remain identical. Wire size falls from 270,622,137 to
242,874,007 bytes for the selected set. The codec remains ordinary gzip, using
Zopfli with one iteration; the viewer needs no new decoder or processing step.

Preparation and recompression write only external alternatives. Every live
original is checked against its full Git blob before preparation, after each
dry run, and again after all staging but before the first authorised mutation.
Every alternative fully decompresses to those original bytes. The application
stages the entire set, replaces its assets, publishes the manifest last and
checks all resulting live bytes. Any exception rolls back the complete original
set and manifest. Re-running the application against changed or already updated
live originals fails its original-source preflight.

The new Python `integrate_lossless_v196.py` and test-only TypeScript
`losslessPacketsV196.ts` prove registered current/original wire alternatives.
Unknown gzip encodings with the same decoded JSON, modified headers, changed
lengths/digests and same-name files outside the exact public directory do not
acquire an old fingerprint. The Python manifest reader proves the whole
complement before recovering the original manifest. Its finite validated-row
cache is keyed by the complete immutable receipt/source bytes and exposes no
mutable cached row objects.

The v195 Python and TypeScript readers delegate through this new stage; the
v194 Python manifest path reaches v195 → v196 before checking its existing full
complement. The historical asset reader also recognises the v196 stage. All
older anchors, receipt/source hashes and control fixtures retain their exact
previous values.

Verification covers every selected original Git blob and its full decoded
equivalence, all whitelist exclusions, full manifest recovery, earlier-reader
lineage, malformed controls, altered wire bytes and wrong-directory paths.
Existing transport, cancellation, native-family and lazy-recipe tests continue
to check the unchanged streaming geometry path. No photographic assets or new
city coverage are introduced by this encoding step.
