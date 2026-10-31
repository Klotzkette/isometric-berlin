# v1.0.187 release receipts

Scope: [city fidelity v288](city-fidelity-v288.md). The complete original source
geometry remains; photographic architectural subdivisions and the interstation
rail height fit are explicitly documented estimates.

## Validated candidate, 31 October 2026

- 58 focused Bun tests / 1,038,244 assertions; 101 Python release/package tests.
- TypeScript, lock consistency, generator Ruff/format and diff checks passed.
- Production build completed successfully in 3m30s.
- Startup dependency graph: 385,791 B under the unchanged 409,600 B cap.
- Worker `progressiveWorld.worker-B8aFO7l4.js`: 11,292,751 B under 16 MiB;
  SHA-256 `9677c10d031cd32dabfe3ca0a2ad3edb0b3d959370ca502cf52b3a55feec2b57`.
- Package: 4,754 files / 936,294,652 B; 83,716 B below the unchanged 893 MiB cap.
- Manifest SHA-256 `30dea9ab9bbc99aa30abb756e17cb7ed6b5b2c55c2b1a55ed1bebdfd018b28ce`.
- ZIP: 765,892,121 B; SHA-256
  `bea56dfb1696d959921bdc7574f514eaa171cf18d4d2b6920ebcf78433543bdf`.
- TAR.GZ: 765,118,413 B; SHA-256
  `31426050106b954f0e102deb23edf3add185bd3750377210503b29d523cd91fb`.
- Package HTTP smoke and ordinary production UI start passed; UI reports
  v1.0.187 and has no own console warnings/errors.
- 351 visual reference records, retaining all original 315 records and metadata;
  36 new records have `pixels_bundled:false`. No new photographic media ships.

## Audited Pages plan

Baseline commit `18ed98cd9ba32c5eaa3cc6e16d15c3eaa75b4b99`, tree
`8b60fb5b3df5f4cb22bea354aefb90c9a77e54d2`.
Prospective tree: 4,777 files / 1,030,779,233 B, leaving 42,962,591 B under 1 GiB.
Only nine exactly audited v184-exclusive assets (23,681,683 B) are removed.
All 327 protected assets from the actual v185/v186 dependency closures
(230,289,297 B) and all 4,436 baseline nonasset paths remain.
The exact plan has 18 changed paths, nine removals and 18 new unique blobs.
Plan SHA-256 `8009e7eb1d51d8c2d0f64b6940675b08e4b6017de51a9734b193c7e1b5691448`.

At this candidate commit, live deployment is still pending. Final remote
commit, deployment and release receipts are recorded after successful checks.
