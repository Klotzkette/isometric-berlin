# Native synchronous-world ownership receipt — v1.0.108

This test-only audit proves the production switches remove precisely two old
facade recipes before their replacements arrive through the v208 outer-detail
family. It does not change any production geometry or constructor.

The existing synchronous v200, v204 and v206 fixtures remain untouched. The
v206 fixture is also the complete synchronous v107 appearance: the independently
reconstructed v107 world reproduces both of its byte hashes exactly. The v206
Urania ownership assertions remain active against that historical fixture;
current cooperative construction now compares against a separate v208 fixture.

## Independent capture

`src/app/scripts/audit-native-v208-baselines.ts` pins released commit
`edcde0e7d05552d1e8900c9c87e1da9b40e02f76`. Every imported application TS/JSON
module is loaded directly from that immutable Git commit through a read-only
Bun hook. The three public world payloads are proved equal to their historical
Git blobs before the benchmark reads them. All 559 recorded source inputs have
SHA-256 receipts. No second mutable checkout or production option is used to
construct the reference.

The baseline capture changes no geometry. The independently derived complement
changes exactly one unique call and one explicit keyed entry in the historical
sources:

- Omit `addAeroflot(builder)` in `MinecraftUnterDenLindenDetails`.
- Skip only `building.key === "quartier206"` in
  `GendarmenmarktPerimeterFacades`.

It preserves the original MinecraftVoxelWorld constructor and every other
imported source. Each capture runs in a separate process, serially, to release
its scene buffers before the next capture. No browser is involved.

The collector refuses to write new fixtures unless both baseline hashes match
the untouched v206 fixture, all captures use exactly the same historical input
hashes, and the remaining ordered per-mesh byte hashes match. Mesh signatures
include names, transforms, indices, all geometry attributes, instance counts,
instance matrices and colours. The independent smaller facade receipt in
`frontage-preservation-v208.json` confirms the same removed instance count.

## Results

| Profile | Historical v107 instances | New synchronous instances | Unchanged meshes | New buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Full | 4,398,777 | 4,397,472 | 348 | 382,435,030 |
| Mobile | 2,033,082 | 2,031,777 | 346 | 202,192,754 |

Both profiles remove exactly 1,305 instances and 99,828 bytes, with two fewer
renderables. The only changed original mesh is the Linden facade batch,
636 → 581 instances (55 old Aeroflot members). The removed Quartier206 batches
contain 1,169 stone and 81 glass members. Every other mesh, including the
complete city source shells, roof geometry, voxel columns, trees, streets,
water and existing authored landmarks, has identical ordered buffer bytes.
The unchanged public source payloads are also checked directly by the test.

New full-world SHA-256:
`fbfc358bef2b7895afe2216ad09e1797026b372097751db181d6b5427a3233e7`.
New mobile-world SHA-256:
`9b6ed768e3817407394be835f701291378bc8126f3e257b600f865250038fd40`.

The new optional v208 detail layers are audited independently; their additions
are intentionally outside this unchanged synchronous-core benchmark. This is
an exact accounting of replaced recipes, not permission to lose their buildings
or unrelated detail.

## Reproduce serially

Run from `src/app`, with the pinned release available in local Git history:

```sh
bun scripts/audit-native-v208-baselines.ts > /tmp/v208-native-full-baseline.json
bun scripts/audit-native-v208-baselines.ts --complement > /tmp/v208-native-full-complement.json
bun scripts/audit-native-v208-baselines.ts --mobile > /tmp/v208-native-mobile-baseline.json
bun scripts/audit-native-v208-baselines.ts --mobile --complement > /tmp/v208-native-mobile-complement.json
bun scripts/collect-native-v208-audit.ts
bun test tests/minecraft-construction.test.ts
```

Only the collector writes `minecraft-world-synchronous-v208.json` and
`minecraft-world-v208-baseline-audit.json`; no older fixture is overwritten.
