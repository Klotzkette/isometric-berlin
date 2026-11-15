# V351 finite public gzip offset

Exactly 18 existing city packets save **1,277,409 packet bytes**, with every decompressed byte preserved. The manifest becomes one byte smaller: **1,277,410 bytes net**. From the previous public tree of 999,940,316 bytes, this provides 1,337,094 bytes of headroom before V351 additions. The complete new tree must still remain strictly below 1,000,000,000 bytes.

The literal `src/app/publicLosslessV351Sources.json` records the old/new full gzip SHA-256 and sizes, decoded SHA-256 and sizes, full original descriptors and bounds. Its own SHA-256 is `c562fd0803e51223845166937f616729c7601d7fd6f47c11eeaa635911a0d26d`, also pinned by the portable verifier. Baselines: public `90fa791f977dd3de1ac237bed7f5bd1fa8bdbbdb`, source `33941dd9a2f144c06c4529fe35b19f3d2e1bb931`.

| Packet | Published bytes | New bytes | Saved bytes |
| --- | ---: | ---: | ---: |
| `northEast326--7_-5.drawn.json.gz` | 1,127,223 | 1,003,221 | 124,002 |
| `northEast326--7_-5.minecraft.json.gz` | 1,099,149 | 986,829 | 112,320 |
| `tegeler-forst--15_-17.minecraft.json.gz` | 777,949 | 695,129 | 82,820 |
| `britzer342-5_19.minecraft.json.gz` | 643,190 | 562,560 | 80,630 |
| `britzer342-4_18-p1.minecraft.json.gz` | 618,497 | 540,817 | 77,680 |
| `kladow346--33_9.minecraft.json.gz` | 608,592 | 538,803 | 69,789 |
| `hansa237--4_-1.minecraft.json.gz` | 582,710 | 508,169 | 74,541 |
| `britzer342-4_18-p1.drawn.json.gz` | 492,009 | 423,405 | 68,604 |
| `britzer342-7_19-p1.minecraft.json.gz` | 534,753 | 467,792 | 66,961 |
| `kladow346--33_14.minecraft.json.gz` | 587,027 | 523,104 | 63,923 |
| `britzer342-6_19-p1.minecraft.json.gz` | 541,146 | 478,250 | 62,896 |
| `northfront239-4_-2.minecraft.json.gz` | 560,433 | 501,432 | 59,001 |
| `torfront244-4_-3.minecraft.json.gz` | 541,248 | 482,610 | 58,638 |
| `kladow346--33_12.minecraft.json.gz` | 526,356 | 468,439 | 57,917 |
| `britzer342-4_19-p2.minecraft.json.gz` | 542,395 | 485,173 | 57,222 |
| `hansa237--4_-1.drawn.json.gz` | 519,337 | 464,183 | 55,154 |
| `southrail238--1_4.minecraft.json.gz` | 491,353 | 437,631 | 53,722 |
| `britzer342-4_19-p1.minecraft.json.gz` | 537,223 | 485,634 | 51,589 |

From `src/app`, run the existing pinned compressor offline:

```sh
bun scripts/reproduce-public-gzip-v351.ts --out /absolute/detached/output
bun scripts/reproduce-public-gzip-v351.ts --verify-dir /absolute/detached/output
bun scripts/reproduce-public-gzip-v351.ts --reproduce-check /absolute/detached/output
```

`--out` uses `@gfx/zopfli` 1.0.15 with one iteration and writes only outside the repository. `--verify-dir` checks already-generated candidate bytes. `--reproduce-check` recompresses into memory, checks literal output hashes and writes nothing. The tool verifies current source bytes and both immutable Git baselines, descriptors, bounds, decoded hashes and full-buffer equality. No candidate gzip copies are added to the repository.

The repository source packets and old source-history fixtures remain byte-identical. Public staging applies the initial six-file and subsequent twelve-file overlays only to detached staging, changes only descriptor `bytes`/`sha256`, recomputes the package-manifest reference and includes all 18 paths in HTTP verification. Each overlay validates its entire input set before the first write. Hardlinked staging files require atomic replacement. Full public-tree and archive inventories remain mandatory.

All geometry, navigation, modes, chunk bounds, codecs, decoded-byte limits, startup order, residency lifetimes, Worker rules and prefetch remain identical. `SurroundingCity.ts` appends the compressed SHA to the URL for fresh cache keys. The twelve supplementary old hashes do not occur in runtime source. The initial six only reference two NorthEast hashes in an offline index. The `hasResidentChunk(id, sha)` caller used by Naunyn Späti references none of these packets, so companion admission remains unchanged.

Two Gärten der Welt candidates were excluded because their already-published decoded forms differ from source. Three ring packets with ownership-index hash references were also left unchanged. This finite selection authorizes no content removal, geometry reduction, codec change or public-ceiling increase.

Offline packages may retain the original gzip while public Pages uses the new encoding. Each archive still needs an exact complete inventory, plus the decoded-equivalence proof connecting the representations. The task's two packaging helpers additionally verify offline package equivalence and reject changed staged hashes, bounds or descriptors before mutation.


The V351 source manifest also spells 24,301 integral floating-point values as
integers, saving 48,602 bytes without changing any decoded IEEE-754 number.
Negative zero, fractional and large values, strings, member order and all other
values are preserved. `scripts/compact_manifest_numbers_v351.py` implements
this representation-only transformation; the production manifest is compared
recursively down to every double's bits. This keeps both source and hosted
manifest inside the unchanged runtime byte limits.
