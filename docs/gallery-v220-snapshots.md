# Gallery support snapshot receipt — v1.0.120 / step 10

The v220 receipt accepts only the corrected vertical support of the existing
Neue Nationalgalerie stairs. The immutable comparison is release v1.0.119,
commit `54990de80b75317612b069f974ba753008b54b3d`. All historical fixtures remain
unchanged, including the v219 world/core fixtures and v217 outline audit.

## Independent comparison

Separate Bun processes construct the complete drawn and native outline trees
before and after the correction. A test-only loader reads changed modules from
the immutable commit for the old runs without rewriting working files. Of
417 loaded runtime modules, 414 retain identical source hashes; only the gallery
factory, its source-derived profile and its navigation module change. Tracked
mesh payloads and source-data files have no changes against that commit. The
exact gallery source JSON also has its own retained SHA-256.

The comparison preserves traversal order and duplicate occurrences. Every node
record hashes its full transform/header, all geometry attributes and indices,
and complete instance matrices and colours. All unchanged records are stored
in the new receipt, together with their ordered aggregate digest. A separate
gallery static digest additionally covers materials, visibility, draw ranges
and world transforms.

Exactly **one existing stone batch** changes in each representation. Its stair
instance Y positions and heights now carry the existing tread tops down to the
source ground. Instance counts, colours, XZ placement, terrace footprint,
glazing, roof, columns and Cattelan exhibition remain unchanged. The focused
walking/support tests independently verify the represented tread tops, support
surfaces and navigation; the snapshot receipt verifies the complete complement.

| Complete outline tree | Unchanged nodes | Total nodes | Root families | Traversal buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn | 836 | 837 | 69 | 53,771,479 |
| Native Minecraft | 697 | 698 | 72 | 94,345,868 |

All totals above are unchanged. Node totals include groups. Traversal byte
totals count each submitted buffer occurrence; the gallery budgets below use
the existing static audit's shared-buffer accounting.

| Complete gallery | Draws | Instances | Stored vertices | Buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Drawn | 17 | 1,817 | 4,333 | 309,908 |
| Native Minecraft | 11 | 9,043 | 216 | 693,100 |

These budgets also remain unchanged. The gallery factory has no reduced mobile
branch, so each representation uses the same complete geometry on both device
profiles. This correction changes no runtime residency allowance.

## Historical chain and current checks

The immutable v119 outline projection exactly reproduces the frozen v217
gallery, every separately recorded later addition and the full unrelated
v206 complement. The complete cooperative-construction test still referenced
a v210 synchronous fixture before this change; that fixture already differed
from immutable v119 because of the subsequently released additions. The new
v220 synchronous target is derived from the independently captured complete
current tree, with every v119 node accounted for.

A second control replaces only the gallery factory with its immutable
pre-v217 version from `6e58dc7a14780239b7dd2157203800deca2cce38`.
After the existing exact v210 test restoration, it reproduces both original
v206 signatures and both frozen v203 retained signatures exactly. It then
derives the historical complement excluding only the two stone/glass buffers
already changed by the accepted v217 doors and exhibition. Current construction
matches that complete complement, including the old gallery parent and terrace.
The current gallery is separately pinned in full by the v220 per-object and
static digests; no gallery branch is left untested.

The new machine-readable evidence is:

- `src/app/tests/fixtures/outline-preservation-v220-audit.json`: immutable base,
  source hashes, all unchanged object records, the one before/after stone
  record per mode, complete signatures, gallery budgets and historical controls.
- `src/app/tests/fixtures/outline-landmarks-v220-synchronous.json`: the current
  complete drawn/native signatures used by cooperative construction.

The separate core and synchronous Minecraft-world constructors do not include
the outline gallery. Their current v219 fixtures therefore remain the existing
targets; no world/core snapshot is regenerated or replaced for this correction.

Validation ran in two separate processes from `src/app`:

```sh
bun test tests/outline-preservation-v207.test.ts
bun test tests/outline-construction-v203.test.ts
```

Both passed: **5 tests / 70 assertions**, including complete current object
records, historical complements, cooperative equality and cancellation disposal.
`git diff --check` passed, and no historical fixture has a tracked diff. Browser,
device and full-release checks are documented separately.
