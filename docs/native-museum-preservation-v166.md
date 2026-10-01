# Museum native preservation baseline — v1.0.66

The two `MuseumLenneArchitecture` static native preservation failures were
already present in v1.0.65. They are not caused by v1.0.66, Upbeat materials,
or a shared rendering helper. No production model is changed for this repair.

An isolated audit extracted the model and all eight runtime dependencies and
data files directly from Git at three historical revisions, then ran the
same `staticGeometryAudit` used by the test, with the installed Bun/Three
runtime and exactly the same full/mobile factory arguments:

- `ac87e85^`, before the v1.0.60 museum refinement, reproduces both historical
  fixture hashes and budgets exactly.
- `ac87e853e9004f29d2b4ed147208c0a09515a70a`, the released v1.0.60 refinement,
  reproduces both current hashes and budgets exactly.
- `v1.0.65` reproduces both current hashes and budgets exactly. All nine files
  are byte-identical to the working tree.

The v1.0.60 change added **59 native blocks** in both profiles: four door
leaf divisions, nine transom subdivisions, six handles and forty stepped
oval metal rim blocks. These account for the entire **4,484-byte** increase
(59 instances × 76 bytes). Their removal would undo released facade detail.
The existing drawn-model audit already recorded the same v1.0.60 work in
`static-model-full-overrides-v164.json`; its native counterpart was missing.

| Profile | Before v1.0.60 instances / bytes | v1.0.60 = v1.0.65 = current instances / bytes |
| --- | ---: | ---: |
| Full | 12,267 / 932,940 | 12,326 / 937,424 |
| Mobile | 12,227 / 929,900 | 12,286 / 934,384 |

All variants retain one draw call and 24 unit-cube vertices. Verified current
and v1.0.65 hashes:

- Full: `af7e8ee6ce344b3b5fd7380b30fd64f85948688edb766f8fd243ef998fc5f70c`
- Mobile: `f5df93b0c693d750a28318ff73eac0b344a58f645b6bdbef5c6b92d12f970b62`

`static-native-model-overrides-v166.json` therefore adds only those two
independently verified released baselines. The test reads it before prior
overrides; all historical fixtures remain intact, and every other native
model keeps its existing expectation. Audit extraction, exact source blob
comparisons, role counts and all four model results are retained during
this release session at `/tmp/v166-museum-native-baseline/`.

Focused verification:

```sh
cd src/app
bun test tests/static-native-model-preservation.test.ts --test-name-pattern MuseumLenneArchitecture
```
