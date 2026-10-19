# Staatsbibliothek, Quartier 207, IHZ surroundings and AEG campus — v1.0.141 / Step 10

This revision refines the named existing buildings and the owner’s subsequent
IHZ and AEG-campus additions. The historic
Staatsbibliothek Unter den Linden is distinct from the Alte Bibliothek at
Bebelplatz; Jean Nouvel’s former Galeries Lafayette is Quartier 207, not 206.
Existing courts, previous city coverage, six modes, seven flight starts and the
93-stop tour remain authoritative. The library's inaccurate generalized portal
cap and narrow front roof band are corrected with exact replacement receipts;
the complete original source remains archived.

- [Staatsbibliothek: sources, roof corrections and preservation](staatsbibliothek-v241.md)
  describes the restored slate roof, Lindenkuppel, three arched gates, columns,
  pediment, balustrades and differentiated historic windows.
- [Quartier 207: sources, measured glass fronts and preservation](lafayette-v241.md)
  describes the continuous glazing, paired metal bands, rounded corner and
  separately fitted native fronts. No active department store or speculative
  future renovation is claimed.
- [IHZ surroundings: sources and exact decoration ownership](ihz-v241.md)
  describes the two annexes and Dorotheenstraße 33, including its retained
  transparent glass. The main IHZ tower is unchanged.
- [AEG campus: measured buildings, sources and navigation](aeg-campus-v241.md)
  covers Merantix ENTER, Phorms Ackerstraße and Deutsche Welle Voltastraße.
  Six exact coarse proxies yield to 47 complete LoD2 parts, with original
  records retained and courtyard holes preserved in rendering and navigation.

Facade fittings and material hues remain procedural recognition estimates.
Full drawn detail is identical on mobile and desktop, with a separate native
interpretation and unchanged live residency limits. No photographic textures
or new runtime network dependency are introduced.

The library and Quartier 207 each use one bounded mesh per profile. Exact old generic
window recipes yield only when their complete replacements are required by the
city construction transaction. Retained library detail moves into that same
transaction; standalone factories preserve their legacy defaults.

The complete offline package measures 921,563,887 bytes (878.872 MiB). Its finite archive-only
ceiling rises from 875 to 880 MiB to retain every asset. This is not a live memory
allowance: per-packet, decode, GPU residency, resolution and mobile detail limits
remain unchanged.

## Validation

- Final focused runs: 26 Python tests and 20 Bun tests for the four architectural
  changes and their exact ownership/navigation integration pass. Another 24
  production-worker tests pass, including resumed mobile and desktop loads.
- Independent integration review caught a missing replacement flag in the
  deferred building worker. Correcting it prevents the six obsolete AEG
  envelopes from reappearing when returning to the district; the worker
  regression checks exercise this production path.
- Repository Ruff formatting/checks and the production TypeScript/Vite build
  pass. The earlier broad Python run passed 1,451 tests (four skipped) with
  release-readiness tests run separately; final campus additions are covered
  by the focused runs above.
- The exploratory full Bun run was not clean: historical native factory/count
  and rail baselines disagree with earlier v219/v229/v233/v237/v238 changes.
  Those unrelated snapshots were not rewritten. Relevant v241 tests pass.
- Mobile WebKit with iPhone 13 emulation completes 42 views across day, night,
  snow, flood, Schwellenraum, native and back to day, visiting all four
  architectural areas and wide zoom. Zero JavaScript errors, graphics-context
  losses or resets; peak measured GPU-buffer allocation is 271,725,342 bytes.
  This measures buffers, not whole-browser memory or every physical phone.
- Close integrated views confirm retained Dorotheenstraße glass and the new
  campus shells; both drawn and native previews were visually inspected.
- Final release readiness, all 80 release-readiness tests and the complete
  local-package smoke check pass against the v1.0.141 archives.
- Desktop Chrome completes the same 42-view sweep through all six modes and
  back to day without errors, context losses or resets. Its peak measured
  GPU-buffer allocation is 602,605,714 bytes in the independent native world;
  returning to drawn releases that world. Together the two browser runs cover
  84 integrated views of the final production build.

Both downloadable archives were uploaded and their GitHub-reported SHA-256
digests match `releases/SHA256SUMS-v1.0.141.txt`.
