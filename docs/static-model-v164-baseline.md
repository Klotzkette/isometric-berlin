# Static-model baseline reconciliation in v1.0.64

The integration audit found two stale baselines in
`src/app/tests/static-model-detail-parity.test.ts`. This release does not alter
either production model. The separate
`static-model-full-overrides-v164.json` records these already-released models
without rewriting any earlier fixture:

| Model | Last production change | Draws | Instances | Stored vertices | Audited attribute bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| CityWestDetails | `f7e7dd1`, v1.0.61, City West and Karl-Marx-Allee refinement | 13 | 0 | 115,250 | 2,469,414 |
| MuseumLenneArchitecture | `ac87e85`, v1.0.60, Kulturforum and north Hauptbahnhof refinement | 2 | 11,262 | 2,568 | 900,924 |

Both factories, their local runtime dependencies and imported source JSON were
compared byte-for-byte with `git show HEAD:<path>` before accepting these
measurements. The type-only `PrismBuilding` import does not execute or affect
the audit. File SHA-256 values at that check were:

- `CityWestDetails.ts`: `77329e6a21d47386b4489b4df614ca19da9144bd70eaf6e4043118d6e6ad118f`
- `MuseumLenneArchitecture.ts`: `4d107a545c5d2485b39d59663295c778fff611d9b89071cd57255317251b0101`

The existing `staticGeometryAudit` helper independently constructed each full
and mobile profile. It hashes submitted geometry, indices, instance matrices,
colours, materials and world transforms. The complete profile audits matched
exactly for both models:

- CityWestDetails geometry signature:
  `978b7f1d77809f2a4ac206d727f26439a0c33b9f2304578644270e04318c3591`
- MuseumLenneArchitecture geometry signature:
  `64a8b7bfecf5b09c5e76efe59ddb7b735da44715a153de53f5055be6cb32d0d5`

These are cumulative baselines of the current complete factories, not the
isolated cost of the v1.0.64 café, embassy or gatehouse additions. Matching
touch and pointer geometry alone would not establish source preservation;
the unchanged production bytes and separately frozen previous fixtures are
also part of the check. These CPU measurements do not measure frame rate,
browser memory overhead or physical-device stability.
