# Native construction audit, v1.0.100

The versioned `minecraft-world-synchronous-v200.json` fixture comes from an
independent **synchronous** constructor capture. The production cooperative
iterator is tested against it. The v192 and all older fixtures remain unchanged.
No measured source payload, runtime allocation limit or mobile profile is edited
by this audit.

The two new core-column predicates were examined in separate phases. Disabling
the new station predicate in memory reproduced both complete v192 snapshots,
including every byte hashed by the existing benchmark. The station-only capture
was frozen before the Heckmann replacement predicate was introduced. The final
capture includes both predicates. The companion
`minecraft-world-v200-correction-delta.json` retains all three phase snapshots,
the exact removed/added instance records, source digests and per-batch hashes.

| Correction phase | Full building instances | Full window instances | Mobile instances |
|---|---:|---:|---:|
| Underground station: 29 exact raw columns | −87 | −102 | −29 |
| Five complete Heckmann source families: 99 exact raw columns | −275 | −336 + 189 = −147 | −99 |
| Total change from v192 | −362 | −249 | −128 |

The station's 12 m columns each have a plinth, body and cap in Full mode, hence
29 × 3 = 87 removed building instances. Its raster has exactly 34 exposed sides,
with panes at y=8, 12 and 16 m: 34 × 3 = 102 panes. Every removed building/pane
record maps back to one of the frozen 29 source cells. No neighbouring pane is
added or changed in this phase.

For the five Heckmann owners, 77 tall columns have three layers and 22 columns
have two, producing 275 removed building instances. The 336 removed panes belong
only to those replaced source columns. Removing the coarse mass exposes 189
existing-neighbour panes at 33 retained source-cell centres. Each added pane
faces an immediately adjacent removed cell; none attaches to an unrecorded
new building. This is a bounded adjacency consequence of the existing generic
window algorithm, separately recorded from the complete replacement model.

The two affected Full meshes are `Voxel building columns` and
`Voxel facade windows`; **all 348 other meshes are byte-identical** in each phase.
Mobile changes only its building batch, preserving **347 other meshes**. The
changed batches retain identical geometry/index buffers, and every surviving
16-float matrix plus 3-float colour record is byte-identical and in the original
order after the explicitly listed additions/removals. No comparison rounds world
positions or substitutes counts for a buffer comparison.

| Profile | Final instances | Renderables | Buffer bytes | Net bytes versus v192 |
|---|---:|---:|---:|---:|
| Full | 4,404,273 | 350 | 382,952,554 | −46,436 |
| Mobile | 2,033,897 | 348 | 202,354,522 | −9,728 |

Each removed net instance accounts for 76 bytes: 64 matrix bytes and 12 colour
bytes. Renderable counts remain unchanged. Ground, tree, park and unrelated
architectural batches retain their exact hashes. The separate lazy
`CentralSitesV200` root supplies the complete replacement walls, roofs and native
surface blocks and has its own factory/preservation tests; it is not counted
twice in this core-constructor fixture.

Reproduce any synchronous phase from `src/app`:

```sh
bun scripts/audit-central-sites-v200-construction.ts --phase=legacy
bun scripts/audit-central-sites-v200-construction.ts --phase=station
bun scripts/audit-central-sites-v200-construction.ts --phase=current
```

Repeat with `--mobile` for the other profile. Run them sequentially: the audit
builds the complete native world. The read-only Bun loader disables only the
specified predicate lines in memory; it never rewrites production files.
Results go to stdout, with small per-object hash receipts under
`/tmp/v200-native-<phase>-<profile>*`. Add `--write-buffers` only when reproducing
the byte-record comparison; it writes approximately 200 MiB of disposable binary
buffers per Full capture. The completed compact delta receipt preserves the
relevant instance differences. Raw full-world buffers are not committed.

Validation:

```sh
bun test tests/central-sites-v200-correction.test.ts tests/minecraft-construction.test.ts
```

The bounded regression independently checks source-cell membership, summed layer
heights, all 102 station pane positions, adjacency of every exposed Heckmann
neighbour pane and byte-accounting. The construction regression compares the
cooperative path against the new synchronous fixture. These are CPU geometry
checks; they make no device-FPS or peak-browser-memory claim.

## Payload-only regression chain (completed during v201 validation)

The historical `minecraft-voxel-world.test.ts` also constructs the world without
the optional tone lookup, tunnel or source-prism inputs. Its independent v192
baseline had not been linked to the v200 correction. Isolated counterfactual
captures now reproduce that frozen baseline exactly with only the two v200
predicates disabled. No old fixture or production geometry is changed.

For this constructor, independent enumeration of the same six retained source
footprints gives 128 replaced columns, 362 full / 128 mobile layer instances,
424 removed panes and 154 newly exposed neighbour panes (net −270). The pane
counts differ from the source-prism-assisted constructor above because their
storey spacing differs; neither fixture substitutes for the other.

`minecraft-payload-only-v200-delta.json` stores only those changed records with
their original indices and exact Float32 bits. The regression reconstructs the
**unchanged v192 SHA256** directly from live buffers and these source-checked
records, preserving every retained matrix/color byte and its order without
constructing another world. The current snapshot is checked separately. The
seven later distant-shell owners are similarly linked individually: the v192
Zoo canopy, one v200 underground-station correction and five complete Heckmann
models. The earlier envelope and courtyard totals remain the asserted baseline.

To reproduce the compact receipt, capture `legacy` and `current` for both
profiles with `--payload-only --write-buffers`, setting `V200_AUDIT_PREFIX` to
`/tmp/v200-payload-<phase>-<profile>` for each run, then execute:

```sh
bun scripts/audit-central-sites-v200-payload.ts /tmp/v200-payload
bun run test tests/minecraft-voxel-world.test.ts tests/distant-building-envelopes.test.ts
```
