# Step 10 — Moabit and Mierendorffplatz (v269)

Release 1.0.169 addresses all Moabit and the Mierendorffplatz surroundings in Charlottenburg within existing coverage. The official Moabit boundary and twelve current LOR quarters define the audit, rather than a rectangular selection. This is a source-bound recognition refinement, not a claim that every house has been individually surveyed.

## Moabit ordinary houses

The audit covers 5,564 valid core source parts and 1,268 stream navigation records (1,151 distinct owners). The actual drawn core factory emits 4,167 additional window-head lines on 1,220 source parts, with additions in all twelve inhabited quarters. The source-guarded native candidates use the same existing pane placement and neighbouring-column guards. Stream additions contain 3,507 drawn and 955 native window-surround groups, plus seventeen mapped-use lower fronts. Previous source colours, roof sheets, window grids, sill/crossbar treatments and non-facade geometry remain intact.

See [house audit and limitations](moabit-houses-v269.md). Ordinary fitting dimensions remain display estimates; this pass does not assign invented surveyed paint colours or shop names. The LOR 2021 polygons are credited to Amt für Statistik Berlin-Brandenburg under CC BY 3.0 DE, separately from Berlin LoD2/ALKIS and OSM.

## Two church silhouettes

Sankt Paulus and Heilandskirche replace only their exact inaccurate fallback owners, with all eleven measured source parts and 530 source sheets retained. Sankt Paulus receives the documented 45 m twin-tower silhouette. Heilandskirche follows the parish's 87 m tower figure; the competing official-area 88 m figure and estimated nave roof dimensions are explicitly documented. Both independent representations have complete required models and matching source-specific walking surfaces. Native transfer touches only 134 unchanged exclusive old columns; shared neighbours survive.

See [church evidence and uncertainty](moabit-landmarks-v269.md) and its linked references.

## Mierendorffplatz

Thirty-seven existing fronts receive retained-pane details; the native representation adds only where its own exposed panes can be identified safely. The mapped square, fountain and fourteen benches are clarified. Four mapped U7 entrances have open stair geometry, local tread floors, blue U signs and return routes. Exact ground fragments crossing their mouths yield to same-colour, same-height outside complements; other ground and line geometry is retained, including overlapping delivery packets.

See [Mierendorffplatz source and walking verification](mierendorff-v269.md). No underground station interior or unverified lift is invented.

## Delivery and verification

The six immutable v268/v269 construction payloads use the existing audited lossless gzip/lazy decoder. This changes storage and lifetime, not model geometry. A production-bundle test verifies zero eager parses, unchanged keys and byte-identical reconstruction after weak-cache expiry. Navigation and core profiles remain strong. Full mobile quality, independent orthogonal native geometry, 93 tour stops and all residency, decode and prefetch limits remain unchanged.

Targeted checks: 104 Bun tests / 24,114 assertions passed across thirteen geometry, streaming, navigation, construction-data and lifetime suites. New Python tests cover Moabit source preservation, core output, church replacement and Mierendorff geometry. Independent cross-reviews found no remaining integration defects. After visual QA, an additional perspective-ray test and contrasting stair edges resolved the initially closed-looking unlit drawn stairs without changing their floors or ownership. All four entrances descend and return at 16/50/100 ms movement steps in both modes and both overlapping packet orders. Fourteen Moabit Python tests and five Mierendorff Python tests passed; Ruff and TypeScript passed.

Internal-browser-only visual QA covered Birkenstraße in both modes, actual Stephankiez core, both complete church silhouettes, Mierendorffplatz and its western fronts, and the eastern stairs in both modes. Bounded checks use production source factories and real stream packets; the church/core fixture intentionally omits landscaping and the rest of the full city. No external browser was started; the temporary tab and server were closed. No console warning/error remained in the final tab. This is bounded verification, not an exhaustive mobile endurance or crash-free guarantee.

Final targeted rerun after the visual correction: five tests / 3,218 assertions (Mierendorff plus lossless production reconstruction), all passed. The earlier 104-test integrated run also passed. Production TypeScript and Vite build succeeded; the known large-chunk/plugin-time warnings remain. Complete release-readiness collection returned zero failures.

The prospective Pages tree is 1,073,218,411 bytes, 523,413 bytes below 1 GiB, retaining the exact two previous live hashed-asset sets (325 distinct files) and the entire new package. No hosted geometry overrides or reduced mobile model were used. Publication receipts follow below. The repository-wide Python run completed in 1,861.80 s: 1,908 passed, four skipped and five initial failures. One v269 camera check had imported its earlier camera before the final visual correction; all five Mierendorff tests passed in a fresh isolated process. The other four comparisons exposed historical test-lineage mismatches: three compared pre-v242 manifests to current v261 Adlershof descriptors, and the playground test compared its v255 checkpoint directly to later v259/v261/v262 replacements. Test-only corrections now use the existing exact reversible receipt chain, preserving the full old-descriptor comparisons and independently verifying source/payload hashes. No production data or rendered geometry changed. Final affected-test results are recorded below; this is not described as a fresh all-green full-suite run.


Final affected-test verification: the three historical preservation tests and unchanged v200 contract audit passed together (four tests, 265.16 s). Fourteen v261 receipt-replay, mutation and asset checks and one v242 lineage negative test also passed. The playground comparison and its two integration checks passed (three tests), and the five Mierendorff checks passed in a fresh process. Ruff and whitespace checks passed. These are targeted reruns of every initial failure and the relevant preservation contracts; the full 31-minute suite was not repeated after these test-only repairs.

## Publication receipt — 25 October 2026

- Complete source tag: `v1.0.169` / `651fd11456699c61cf7d10221ae5c02db1c619db`. An omitted source-profile file was added before release publication; the newly created unpublished tag was corrected under an exact ref lease.
- [Published release](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.169), release ID `423490141`.
- Pages commit `18782cfa8be86f4fa751d245bac89fe6724bf848`; [deployment 40208041003](https://github.com/Klotzkette/isometric-berlin/actions/runs/40208041003) succeeded.
- Package: 4,747 files / 933,331,389 bytes, including all public city assets. Inventory SHA-256 `798f80b84866add4758f8a81fe7f5250b8cc3cd61d034c764eda98baaae52fc8`.
- ZIP: 759,810,293 bytes; SHA-256 `b91f483bb68f48363d31bdcdb25afe60264e97f45f0087309b96af38c11ee12d`.
- Tarball: 759,002,682 bytes; SHA-256 `8ca16c238e4572f31e65c3273148df7c499ac4df67e866c48756f8ed6a08ef02`.
- Both archives passed their unchanged complete validators and remote size/digest checks. Built and uploaded sequentially in RAM to avoid disk duplication; checksums are attached to the release.
- Ten hosted files, including the HTML, package/city manifests, visual credits and six key application/worker bundles, match the verified package byte for byte. All three previously withdrawn Columbiahalle recordings still return HTTP 404. Live URL: https://klotzkette.github.io/isometric-berlin/ .
