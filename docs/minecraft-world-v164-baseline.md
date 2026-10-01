# Native world construction baseline — v1.0.64

`src/app/tests/fixtures/minecraft-world-synchronous-v164.json` records the complete
native-world synchronous constructor after the v164 café, embassy and gatehouse
integration, including the final café garden floors/furniture heights and gatehouse
retaining-face correction. The cooperative constructor must produce exactly the same mesh
names, transforms, geometry/index attributes, instance transforms and colours.
The fixture stores the deterministic SHA-256 digest and buffer/renderable counts;
machine-dependent timing and process memory are not asserted.

The previous v157 fixture remains unchanged. This is a cumulative update from
that fixture, including the intervening Kulturforum concert halls/museums, north
rail approach, Breitscheid towers, western/eastern squares and Hackescher Markt
work. The measured difference must not be described as v164's isolated cost.
The three v164 families also retire precisely matched generic source owners;
the full source evidence remains in their dedicated payloads.

| Profile | Instances | Mesh renderables | Unique geometry/instance attribute bytes |
|---|---:|---:|---:|
| Full | 4,311,046 | 218 | 336,034,586 |
| Mobile | 1,580,429 | 216 | 128,058,238 |

Compared with the frozen v157 baseline, full increases by 187,452 instances,
24 renderables and 14,890,704 attribute bytes; mobile increases by 203,379
instances, 24 renderables and 16,101,156 attribute bytes. Existing profile
differences predate this baseline. The v164 building/monument component checks
independently require identical static detail between touch and pointer builds.

Both synchronous profiles were measured in separate Bun processes. The two
cooperative construction tests subsequently matched their entire deterministic
fixtures. The viewer ownership check also now extracts the actual TypeScript
function declaration: its former fixed 12,000-character slice truncated the
growing loader before its existing rollback branch. Production ownership and
disposal logic were not changed for that test correction.

This test proves equality between synchronous and cooperative native-world
construction. It does not by itself prove historical visual preservation,
whole-viewer browser memory consumption, frame rate, or physical-phone stability.
Source preservation, new static model detail and visual inspection are separate
release checks.

Reproduction from `src/app`, running each command sequentially:

```sh
bun scripts/benchmark-minecraft-world.ts
bun scripts/benchmark-minecraft-world.ts --mobile
bun test tests/minecraft-construction.test.ts
```
