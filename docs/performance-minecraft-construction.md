# Minecraft construction, v0.72.42

Step 10 only. No source data, architecture, resolution, visibility distance,
shader or GPU geometry budget changes.

## Reproduce

Run from `src/app` with Bun:

```sh
bun run benchmark:minecraft-world
bun run benchmark:minecraft-world --mobile
bun run benchmark:minecraft-world --cooperative
```

The synchronous runner measures construction separately from tone-index setup,
file reads and verification. `--cooperative` exercises the production iterator
and 8 ms cooperative driver with a timer-based task yield. Browsers prefer
`scheduler.yield` when available, with a timer fallback. This harness does not
measure GPU upload, browser FPS or physical phone performance.

For historical comparison, export `src/app/src` from tag `v0.72.41` with
`git archive` into an ignored directory beneath the app's `node_modules` so
both implementations resolve the same installed Three.js version. Set
`MINECRAFT_REFERENCE_MODULE` to that snapshot's `MinecraftVoxelWorld.ts` file
URL. The benchmark still reads the same current committed payloads. Never
include that source snapshot in a release archive.

## Paired measurements

2026-09-05, this Windows workspace, three alternating fresh processes per
implementation/profile, without the full test suite or an active 3D tab.
Times are milliseconds; medians are intentionally more conservative than the
initial profiling samples.

| Profile | v0.72.41 samples | v0.72.42 samples | Median change |
| --- | --- | --- | --- |
| Full | 3379.83 / 4098.68 / 4130.70 | 2699.18 / 3446.18 / 3280.19 | 4098.68 to 3280.19, about 20% less construction time |
| Mobile-like | 2149.91 / 2025.28 / 2042.57 | 1815.87 / 1839.72 / 1905.34 | 2042.57 to 1839.72, about 10% less construction time |

Post-verification process RSS medians were 861.0 to 775.2 MiB (full) and
566.9 to 483.2 MiB (mobile-like). These are Bun process snapshots, not peak
heap, browser memory, VRAM or guaranteed savings on another device. The
removed transient window objects and decoded building copy reduce allocation
pressure; final GPU buffers are deliberately unchanged.

One final full cooperative sample took 4295.83 ms including task scheduling,
with 385 task yields, a 2.69 ms p95 iterator step and a 58.89 ms longest step.
The 8 ms budget is soft: individual constructor/allocation work can exceed
it. Timer overhead makes this result distinct from the synchronous build
measurement. Earlier concurrent browser/TypeScript workloads and the initial
CPU-profile run are not used for the paired comparison. This is not a
"never stalls" or universal FPS guarantee.

## Exact output contract

The production-payload checks hash every index, vertex attribute, colour and
instance-matrix buffer, including unused capacity, names and mesh matrices.
All compared runs match the previous release:

| Profile | Instances | Renderables | Buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 3,397,733 | 50 | 259,651,196 | `7d78410a4dfcbcf6b0f7eba285f082d3ac8a021d4a0d403b0fbff4834ca2a85f` |
| Mobile-like | 788,864 | 48 | 60,696,656 | `adc817fae08a55ccc0118619551b04f431691989f206b1ee45a94c7399adc675` |

The static voxel root excludes the separate fixed-capacity mob/loot fields.
Their budgets, proximity lifecycle and protected areas are unchanged.

## Safety checks

- The recognition index retains original first-match priority and applies the
  original rotated rectangle test after conservative bucket selection.
  Whole-area, rotated edge/corner and bucket-boundary tests compare directly
  against the original scan.
- The cooperative driver tests ordering, cancellation before allocation,
  cancellation mid-build, scheduler failures and constructor failures.
- The viewer owns every unpublished partial mesh before yielding. Existing
  rollback disposes it; a cancelled task never publishes a ready world.
- Complete full/mobile cooperative builds must match the frozen hashes above.
- Spare-capacity and zero-count meshes retain their original initialization.
- No source photograph, Worker clone or second screenshot surface is added.
