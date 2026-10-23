# Step 10 — Charité and Scheunenviertel (v265)

Release 1.0.165 refines the requested existing Campus Mitte and Scheunenviertel
coverage. The historic virology/museum ensemble is beside Humboldthafen and the
Stadtbahn; the separate RKI campus at Nordufer is not relocated or invented.

## Changes

- [Museum and virology](charite-campus-v265.md): seven bronze vitrines, revised
  upper triple-window groups, projecting bronze museum entrance, basement
  windows, grilles, blinds, pipes and cornice details. Only nineteen specifically
  disproved old opening groups yield. Every original source part, roof and
  unrelated fitting remains.
- The [elevated Luisenstraße and Hufelandweg connections](charite-bridges-v265.md) use their identified
  exact source footprints. Their earlier ground-closing volumes yield to
  elevated glazed models and matching walking clearances. Original sheets and
  exact source/native-column receipts remain available. The distinct eastern
  connector is retained. Clearances and small fittings are documented display
  estimates; a photographic interpretation is not a measured building survey.
- [Scheunenviertel](scheunen-v265.md): 20 mapped entrance details and measured roof-edge fittings fill
  gaps in two already streamed packets. Existing complete LoD2 geometry, windows,
  navigation, courtyards, streets and older facade treatments remain.

## Delivery and verification

The replacement facade is attached before the old opening guard is applied.
Bridge source transfers are enabled only in the required world transaction;
failed or cancelled construction does not publish a partial world. Source
fingerprints prevent changes from claiming unrelated geometry. The streamed
Scheunenviertel additions share existing packet lifetimes and bounded delivery.

No new coverage, textures, animation, tour stops, external browser or enlarged
live residency/decode/prefetch allowance is introduced. Mobile retains full
visible detail; new native geometry is constructed independently and orthogonally.

## Completed checks before publication

- 115 targeted Bun tests across the existing Charité/Scheunenviertel baselines,
  new models, exact transfers, real walking routes, and runtime residency and
  attachment lifetime: 618,949 assertions, no failures.
- 49 targeted Python checks passed, one optional source-archive check skipped.
  This includes the unchanged-source receipts and packaging behavior. The full
  repository suite was not repeated because the earlier v263 run exceeded 2 GiB
  RSS; these focused checks cover the changed geometry and runtime paths.
- TypeScript build, scoped Ruff formatting/lint and `git diff --check` passed.
- Production Vite build passed. Existing large-chunk warnings remain; no live
  budget was increased to silence them.
- Internal in-app browser review of museum, virology and both bridge locations
  in drawn/native modes, plus the actual Mulackstraße streamed packets. Temporary
  QA page/server/tab were removed; no external browser was opened.
- The three under-bridge routes were exercised over the real core terrain and
  full prism set in both day/native navigation without blockage, respawn or
  snapping to the bridge roof. Supports and upper rooms remain collidable.
- Source, built viewer and staged-package readiness checks passed. Exact hosted
  preflight retains the previous two complete asset graphs and stays below 1 GiB:
  1,059,967,400 bytes, with 13,774,424 bytes headroom.

The native startup test fixture now supplies the existing public Spree-bridge
factory dependency; production startup behavior is unchanged by that fixture fix.
The complete ZIP/TAR archive validators and publication receipts follow below.

## Release artifacts

- Source commit `a164b7a9`, tag `v1.0.165`.
- [Published release](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.165), ID `422157961`.
- Complete staged viewer: 4,747 files, 927,961,505 bytes (884.973 MiB).
- ZIP: 757,154,384 bytes; SHA-256 `2a01f1958e334c200d09fca8fe14377a64599dfc576b42479cde610cf9dbd90f`.
- TAR: 756,359,755 bytes; SHA-256 `5cc0acbb1a3892c08b58605d638eb47abcadee5e17c420be331f22519a12a5c0`.

Both archives were built sequentially in RAM because local disk space was scarce.
The unmodified complete archive validators passed before upload. GitHub returned
the same byte sizes and SHA-256 digests. This does not claim that physical local
ZIP/TAR files exist; the complete unpacked viewer remains staged locally.

Pages commit `4843955be01f4943b8999bdd01b7e08f27fad541` contains the complete
new package and the exact v163/v164 asset graphs: 327 retained hashed assets,
of which 31 (132,005,895 bytes) are previous-version-only. Fourteen older stale
hashed assets yield; no current or retained previous-version asset is dropped.

[Pages workflow 40000688160](https://github.com/Klotzkette/isometric-berlin/actions/runs/40000688160)
completed successfully. After deployment, ten live files (entry HTML, package and
city manifests, credits, main entry/viewer, required sites, streamed decoder,
outline and progressive-worker bundles) matched the staged bytes exactly. Both
released archive sizes/digests were rechecked. All three withdrawn Columbiahalle
recording URLs continue to return HTTP 404. The working tree was then closed
with this verification receipt and the final archive checksums.
