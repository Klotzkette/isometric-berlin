# Exact source encoding — V346

The first V346 build exceeded the unchanged 1,000,000,000-byte static-site limit.
No building, triangle, texture, navigation profile, mode or mobile detail is removed
to meet that limit. The existing gzip/Base85 codec is applied to **106 explicitly
listed source modules** in `src/app/losslessBase85SourcesV346.ts`:

- 43 existing V326 network recipe modules;
- 30 V346 main-road facade recipe modules;
- 33 further measured existing gzip sources, including the Schwanenwerder recipe,
  northeastern public-site recipes, district-road surfaces, water/ground profiles
  and existing architectural construction fields.

Only the encoded representation changes. Each byte of the already selected gzip
buffer, decoded JSON value, key order, negative zero, packed geometry string and
ownership receipt remains exact. The compression admission threshold continues to
use the original Base64 length. Strong/eager/weak cache policy, setter behavior,
per-tile construction boundaries and the independent Drawn/Native payloads are
unchanged. The source JSON files themselves are unchanged and their exact hashes
are recorded in `src/app/tests/fixtures/lossless-source-v346.json`.

The complete previous codec registry is preserved separately as
`LOSSLESS_BASE85_BEFORE_V346`. New module names are literal finite entries, not
filename patterns or an extension of the general admission rule. Runtime reads use
the existing `losslessGzipBase85.ts` implementation. There is no new decoder,
request, asset-loading layer or external service in this encoding change.

An audit of the actual first V346 bundle measured **16,127,259 bytes** of encoded
string savings for this selection before final rebundling: 11,056,049 bytes in
network recipes, 2,269,787 in main-road recipes and 2,801,423 in the remaining
sources. These are the actual old strings versus their exact Base85 encodings,
including observed worker copies. Final release sizing is measured on the rebuilt
complete static tree. The separate bounded road-line transport change is documented
by its own tests and is additional to this saving.

Validation checks all 106 complete original source hashes and every decoded module,
including all emitted gzip fields. Focused lifecycle checks preserve lazy per-tile
reads, weak reconstruction, live identity, explicit assignment ownership and the
strong fallback when WeakRef is unavailable. Codec-level canonical and malformed
input tests remain in `lossless-base85-v263.test.ts`.
