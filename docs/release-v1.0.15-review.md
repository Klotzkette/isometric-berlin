# v1.0.15 review and verification

Pipeline step 10. Refine the source-bound Kulturforum entrances and separate
Richard Serra's *Berlin Junction* from the later T4 memorial without
perturbing the existing Spreebogen, Brandenburg Gate, Charité,
Ministergärten or Lessing geometry.

## Reproduced findings

OSM way `187360886` names both *Berlin Junction* and the Aktion T4 memorial.
The previous name-based dispatch consequently rendered Richard Serra's work
as another blue wall. OSM way `303577518` is the separate later memorial and
information site. Exact OSM-key dispatch now gives the former two curved,
walk-through Corten plates and the latter its 24 m transparent blue wall,
gently inclined anthracite field, information pult and bench.

The Philharmonie, Kammermusiksaal, Gemäldegalerie, Kunstgewerbemuseum and the
shared Kunstbibliothek / Kupferstichkabinett complex previously retained their
official LoD2 bodies but lacked readable public entrances in the isometric
view. Source-facing overlays now add framed glazing, transoms, shallow
canopies, steps and institution lettering at the existing facade registers.
The correct institution name is `Kupferstichkabinett`.

Published sculpture dimensions and official visitor/site plans are recorded
in [the source contract](kulturforum-memorial-entrances-v115.md). Curvature,
door widths and local subdivisions remain explicitly bounded presentation
fits rather than surveyed detail.

## Review scope

The existing specialised Spreebogen bank, Brandenburg Gate, historic Charité,
Ministergärten and Lessing models were rechecked through their source and
integration contracts. No generic overlay was added where it would reduce
accuracy. Orthographic geometry QA used actual Three.js triangles and caught
and corrected an initially mirrored Serra curve before the final test run.

- Complete frontend: all 1,820 tests passed across 230 files, with 7,030,525
  assertions (314.49 seconds). Progressive loading, both device profiles and
  all five visual modes remain inside their existing budgets.
- All 361 Python tests passed on the final package (33.93 seconds). Ruff
  formatting and lint passed.
- TypeScript, production build, release readiness and the local-package server
  smoke test passed.
- No source records, catalogue places or release bounds were removed.

The downloadable ZIP is 36,300,349 bytes; the viewer archive is 35,720,878
bytes. Their SHA-256 checksums are supplied in `SHA256SUMS-v1.0.15.txt` with
the GitHub release.
