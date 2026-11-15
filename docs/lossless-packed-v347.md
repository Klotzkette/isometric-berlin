# V347 finite lossless storage offset

The complete viewer needs space for the requested V347 source additions while
keeping its existing 1,000,000,000-byte publication ceiling. Eleven explicitly
pinned fields use the existing gzip/Base85 JSON decoder. No source JSON,
geometry, coordinate, palette, index, navigation record or packet disappears.

The ten existing fields are `meshes` in
`data/altMitteV169Native/packet-{007,008,046,048,058,063,064,066,068,070}.json`.
They were ordinary eager, strongly retained packed objects. They stay ordinary
eager, strongly retained objects after decoding; the named export and default
object field still refer to the same value. This is the same finite pattern
already applied to packets 041/042/043/071 in V322 and 062 in V325. None of those
historical registrations or source hashes changes.

The additional new field is `namedGravesV347.json:sites`. It is permanently
retained by `NAMED_GRAVE_SITES_V347`, so it deliberately uses eager strong
ownership. It does not acquire a weak constructor getter. The university profile
stays unchanged, and Clayallee retains its existing per-packet recipe encoding.

`losslessPackedFieldsV347.ts` freezes the exact file and field hash registry.
The build transformer rejects a changed file, changed field or wrong field
under any selected path. Other paths do not acquire this permission. The only
shared build integration is the import, field selection, eager branch exclusion,
Base85 decoder selection and field assertion in `losslessJsonData.ts`.
No new runtime codec, cache, lifetime, live limit or Worker limit is introduced.

The isolated actual Vite build of the eleven complete modules measured:

| Representation | Minified JavaScript bytes |
| --- | ---: |
| Original direct literals | 9,017,577 |
| Exact gzip/Base85 fields, including decoder | 3,501,625 |
| Saved | **5,515,952** |

The test executes the built result, compares every complete source object,
checks named/default identity and ordinary writable field descriptors, and
checks that an alias remains stable after replacing the default field.
Metadata-only imports omit the encoded field and decoder entirely.
The ten old Native JSON files themselves remain byte-identical.

Run `bun test tests/lossless-packed-fields-v347.test.ts` from `src/app`.
Setting `V347_SIZE_PROOF` writes a compact size receipt outside the sources.
The checked receipt is `geo_data/regierungsviertel/lossless-packed-v347-evidence.json`.
This is an isolated size proof; the complete release still receives its normal
full build, byte-cap check and viewer validation.
