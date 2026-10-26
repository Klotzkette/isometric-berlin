# Existing Berlin houses and Steglitz school — v1.0.173

The owner reported that monotonous grey houses remained in Moabit, Schöneberg,
Steglitz, Kreuzberg, Friedrichshain and other existing parts of the city. The
complete coverage audit found distinct missed paths: old overview-image samples
in core housing, exact default paint in primary packets, welded legacy frontage
surfaces, and the older Alt-Mitte measured sheets outside the v271 correction.

- [Primary city packets](primary-colours-v273.md): all 1,635 existing tiles in both
  modes; separate restrained wall/roof palettes and source-proved shared-corner
  repair. Known material writers retain precedence.
- [Core housing](core-house-colours-v273.md): all 29,818 source parts audited;
  7,174 positively identified ordinary residential parts replace obsolete neutral
  overview-image samples. Authored and mapped families remain protected.
- [Legacy street-front shells](legacy-house-materials-v273.md): complete four-family
  inventory, including safe shared-wall components with an all-neighbour veto.
- [Remaining Alt-Mitte](remaining-alt-mitte-colours-v273.md): complete 8,374-family
  inventory plus the independently blocked OSM remainder. Earlier v271 and authored
  families remain intact.

These colour passes preserve every original public source packet, source ring,
roof form, window, line and independent native mesh. They add no GPU attributes,
renderables or frame-loop operations. Full mobile detail, 93 stops and the existing
residency/decode/prefetch budgets remain unchanged. Construction-only colour
receipts add bounded encoded source data; weak decoding avoids retaining a second
citywide object graph.

Unknown paint is a restrained contextual estimate. Protected grey buildings and
truly ambiguous source corners intentionally remain unchanged; this is not a
claim that every facade has been individually surveyed or that no grey remains.

The follow-up corrects the remaining old-style generic windows on historic
Gymnasium Steglitz wings using the owner's street/courtyard photographs. The
modern extension, Aula and courtyard gym retain their separate architecture.
School-specific preservation and validation are documented in
[Steglitz windows](steglitz-windows-v273.md). The
[model comparison](steglitz-windows-v273-comparison.png) is an orthographic drawing
from the actual coordinates and material colours, not a browser screenshot.

## Validation and publication

The focused checks pass for primary packet receipts (34 Python tests and all
2,006 actual recipes), legacy/Alt-Mitte (14 Python and 11 Bun tests), core housing
(4 Python and 20 distinct Bun tests including related regressions), and the
Steglitz windows (5 Python and 15 Bun tests including both real factories).
The combined primary/v263/v262 suite passes 13 Bun tests; seven lifecycle,
cooperative decoding and residency suites pass 43 further Bun tests.

Sixteen real before/after packet constructions cover inner and outer districts
in both modes. Their geometry/index hashes and GPU attribute byte counts are
identical; see [comparison receipts](city-house-colours-v273-geometry.json).
This zero-geometry claim applies to colour changes, not the separately documented
additional school fittings. The full TypeScript check runs successfully under
Bun; invoking it through Node's default 4-GiB heap exhausted that tooling limit.
Ruff format/check pass for all 881 Python files. The production build passes.

A bounded internal-browser Moabit before/after check retained four draw calls
and 8,526 triangles. Further internal-browser navigation was blocked by the
browser tool's security policy after session reset; no external browser was
launched. The school comparison is generated from final actual model data;
it is not a live browser view. No exhaustive visual survey or physical-device
crash-immunity claim is made.

The 32 primary banks occupy 39,963,344 bytes of raw JSON and 6,763,647 bytes of
encoded strings in the production transform. Each decoded bank is weakly held,
with an eager packet-key rejection index. The added encoded strings do increase
the download and JavaScript source footprint; identical overall heap usage is
not claimed. No live residency limit is raised and no visible detail is dropped.

The complete project test and publication results are recorded in the final
machine-readable verification receipt after completion.

The finite Base85 extension covers exactly 35 new construction-data files and
saves 475,024 bytes of transformed source without changing their gzip-decoded
values or weak lifetime. The core hot owner map uses the established eager
encoding instead: one parse, strong identity and ordinary data properties. Its
isolated production module saves another 316,272 bytes. Exact-value, production
retention and tree-shaking tests pass; the existing package ceiling is unchanged.

The complete Python run finished with 2020 passed, 3 failed and 4 skipped out of 2027 collected tests. Its original failures were:

- `tests/test_grey_facades_v263.py::test_exact_existing_street_walls_and_all_previous_fitting_owners_are_protected`
- `tests/test_outer_facades_v262.py::test_exact_existing_street_walls_and_all_previous_fitting_owners_are_protected`
- `tests/test_outer_materials_v254.py::test_no_receipt_can_override_an_earlier_material_vertex`

After correcting the offline generator protection inventories, all 17 tests in the affected test files passed in a separate targeted follow-up. The protection-inventory repair changed offline generator classification, with no runtime or model-byte change. The complete suite was not rerun after these repairs; the follow-up count is not added to the full-run count as if it were a distinct set of passing tests.
Both offline archives and the hosted version are verified byte-for-byte;
see [publication receipt](city-house-colours-v273-verification.json).
