# v272 core-native source retirement audit

The exact pre-v272 constructor is taken from commit
`931a33a0bd8fb615e900c9c012305e9a2ffb5747`; its source SHA-256 is
`f22faaa55ca9d771b7b82cc663fc075937ad6086800c3986ea2c9468d6b37df3`.
The generator copies only that constructor into a cache mirror and links the
unchanged inputs. It does not reset the working tree or replace historical
fixtures. Run `bun scripts/audit_core_native_retirement_v272.ts` from the repo.

The independent audit checks the old HAU and Press-quarter prism rings,
courtyard holes, base heights and 4 m quantized top heights against all source
voxel columns. Exactly 369 source columns belong to these transfers. Each
removed instance carries its full 16-float matrix, three colour floats, original
index, source column and exact owner IDs. Newly exposed window records also
identify the retired neighbouring column which previously occluded them.

| Buffer | Before | After | Removed | Added |
| --- | ---: | ---: | ---: | ---: |
| Full generic building layers | 1,196,893 | 1,195,814 | 1,079 | 0 |
| Full generic facade windows | 1,338,705 | 1,336,725 | 2,205 | 225 |
| Mobile generic building columns | 440,413 | 440,044 | 369 | 0 |

The window changes divide into Press: 1,891 removed / 79 exposed, and HAU:
314 removed / 146 exposed. Net removal is 1,980. The complete complement is
unchanged byte-for-byte and in original order. The test restores every removed
record, verifies every added record, and hashes all remaining matrix and colour
bytes back to the exact pre-v272 HEAD buffer. Deliberately moving one unrelated
window causes that complement check to reject the result.

This is a new, narrowly scoped receipt, not an update to the old v202/v237/v238
hash contracts. Those contracts already differed from HEAD: the old expected
window count was 1,339,220 (515 above HEAD), and the ground-run hash already was
`89a7f2b0b7ad08e62c070ced40a868ff76af0dfc8ad2e1c12bf777fc9d4860d7`
instead of the older `4cda6d0e0e1d9fd6bba3eed05bbc010f0cb74e0442f62a54f6caf9efa89ac15c`.
Those pre-existing discrepancies remain documented and unchanged.

## Other pre-existing packet and cache checks

The old tests and lossless transformer were also loaded from the same fixed
commit into the cache mirror. The relevant JSON inputs, surrounding-packet
decoder and allotment factory have no differences from that commit. These
failures reproduce with the same values as the current full-suite run:

| Existing test | Fixed-base failure |
| --- | --- |
| `construction-data-v269` | Initial JSON parses: expected 0, actual 2 |
| `source-cache-v264`, allotments | Initial JSON parses: expected 0, actual 1 |
| `source-cache-v264`, Prenzlberg | Initial JSON parses: expected 0, actual 1 |
| `city-coverage-v183` | Position values: expected 35,133, actual 44,502 |
| `outer-facades-v262` | Vertices: expected 3,001, actual 3,989 |
| `house-details-v233`, budget | `drawn:-10_-2`: expected 426,654 bytes, actual 601,614 |
| `house-details-v233`, source colour | `drawn:-11_3`, vertex 13,503 |

The cache cases predate v272: v270 already encodes eager `keys`, `profile` or
small native `sites` fields with one eager decode each. No old expectations or
hashes were changed in this audit. The v272 packed-string test separately
checks the three newly whitelisted fields below the existing 64 KiB threshold
as direct literals and verifies their exact decoded bytes.
