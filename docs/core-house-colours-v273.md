# Existing core residential paint — Step 10 / v1.0.173

The citywide audit found a different remaining fallback from the northern
v271 measured-sheet layers. The core `tone` field is explicitly a median sample
of the **drawn overview at the ground footprint**, not a photographed facade.
Four repeated neutral registers alone occur in 14,187 source parts. The drawn
resolver lightly mixed those samples with generic paint and assigned selected
unknown roofs one uniform grey. Native columns snapped the same samples to a
few grey/stone blocks, without using the later ordinary-house palette at all.
The v269 Moabit fittings added frames and shops but deliberately retained that
older material path.

## Systematic selection and source protection

All **29,818 retained core parts** receive an explicit audit outcome. The new
receipt changes **7,174 source parts**, selected only by positive residential
identity: retained ALKIS residential functions `31001_1000`/`31001_1010`, or
explicit OSM apartments/residential/house/detached/semidetached/terrace/bungalow
use. Unknown use, industrial, commercial and civic buildings are not silently
treated as housing. Eligible parts are 5–45 m, non-glass, have a valid footprint
and a neutral overview sample (RGB spread below 24).

| Retained core area | Audited parts | Selected fallback parts |
| --- | ---: | ---: |
| Moabit | 5,578 | 2,599 |
| Kreuzberg | 3,142 | 1,063 |
| Schöneberg | 636 | 196 |
| Wedding | 2,391 | 1,265 |
| Tiergarten | 2,833 | 623 |
| Charlottenburg | 2,078 | 85 |
| Wilmersdorf | 126 | 0 |
| Remaining existing core | 13,034 | 1,343 |

Counts refer to source parts, not researched individual houses or households.
Friedrichshain and Steglitz are supplied by the independent streamed layers;
their citywide correction is accounted for separately. Exact administrative
rings come from the retained ALKIS boundary sources. The core audit adds no
coverage and uses the historical scope for accounting only.

Mapped facade colour/material, named buildings, exact authored IDs and complete
families containing such parts remain protected. The four resolved facade,
roof, glass and replacement registries contribute 7,118 authored source IDs,
including identities assembled through imports rather than local literals.
A direct test compares the frozen registry receipt to the actual exports and
requires its complete intersection with the new selection to be empty.
Complete Alt-Mitte v169
transferred owners are excluded because their newer measured layer is handled
independently. Existing coloured overview samples also retain their older paint.
Mapped roof material/colour remains unchanged even when the facade qualifies.
Every receipt binds the exact short source ID, two independent 32-bit hashes of
all original ring/hole coordinates, height, base, roof code, class and old sample.
Changed, incomplete or unknown inputs return no override.

Source parents share one repeatable plaster tone, so multiple source parts of a
house do not become unrelated colours. Twelve restrained ivory, sand, ochre,
rose, sage and blue-grey families and six roof tones reuse the documented v271
illustration swatches. **Unmapped paint is a contextual display estimate, not a
claim that each facade was photographed or its roof material surveyed.**

## Independent native treatment and memory

Native bodies use their own fixed architectural block-palette entries. Only
already existing full-profile caps receive the separate estimated cap colour.
The existing `roofToneAt` source-evidence lookup is unchanged: putting an unknown
roof estimate there would create an additional mobile cap and alter geometry.
The new `illustrationRoofToneAt` does not participate in allocation, height,
navigation or mobile cap creation. Full and mobile matrices, counts, source
ownership and all previous window/roof/line geometry remain unchanged.

The drawn early and detailed factories use the same source-guarded wall/roof
resolver. There are zero new renderables, vertices, indices, instance matrices,
GPU attribute bytes, textures, requests or per-frame operations. Resident,
decode and prefetch limits, the 93-place tour and full drawn mobile detail are
unchanged. Unencoded receipt JSON is 508,407 bytes; source IDs and metadata are
construction-only, with no second city geometry copy.

## Preservation evidence and checks

The frozen before fixture was captured from source commit
`25904a12b2487fc1008a4c766ef19f0b0980cc16`. Thirteen actual retained source parts
cover seven corrected areas and six mapped/authored controls. Both real early
and detailed factories retain every non-colour attribute, index, matrix,
renderable inventory and buffer size. The six controls retain every colour too.
Early wall shades remain in the detailed shells alongside their older additional
recess/junction shading.

All 29,818 native sample queries retain their source IDs and original mapped
roof result; the entire unselected colour complement is unchanged. A frozen
SHA-256 check covers the complete actual native constructor after normalizing
only the one allowed existing-cap colour expression. Thus full/mobile control
flow, allocation, every matrix/size write, windows, trees and all later authored
construction remain byte-identical; this proof does not require allocating the
complete city on this memory-constrained host. Actual core factories verify the
drawn geometry separately.

The focused tests are `tests/test_core_house_colours_v273.py` and
`src/app/tests/core-house-colours-v273.test.ts`. Existing v211 mapped-material,
authored-colour, continuous neutral-sample and courtyard checks also pass.
The historical full-city v211 snapshot is intentionally not regenerated.
Integrated browser checks and release-wide status belong to the parent audit.

Final focused validation on 26 October 2026 passes all four Python receipt tests,
all five new Bun tests (157,036 assertions), the five existing lightweight v211
material tests, all four Moabit core v269 tests and all six v225 district tests.
The final combined v273/v225 run passes 11 tests with 157,239 assertions. Ruff
check and format-check pass for the core compiler and Python tests; all 641
protected-source file receipts still match their current SHA-256 values.

The v225 test for source parts `78474603` and `78474607` now separates the old
roof-only fallback from the newly intended source-bound facade paint. Its old
expectation that artificially moving a real house preserves its facade colour
is no longer valid: relocation must reject the exact v273 receipt. The test
asserts that rejection, verifies unchanged geometry and buffers at the actual
location, and still exercises the earlier roof-only/facade-preserving path with
the same deliberately unreceipted sample at both positions. No source data or
historical snapshot is rewritten. The expensive historical full native v211
factory snapshot remains excluded here; the exact constructor-normalization
proof and all 29,818 native sample queries are exercised by the new suite.

Reproduce the resolved authored protection receipt with
`bun src/app/scripts/audit-core-house-protection-v273.ts`, then the colour receipt with
`uv run --no-sync python -m scripts.build_core_house_colours_v273`.
Complete input/protection SHA-256 receipts, all selected source identities,
omission counts and region accounting are retained in
`geo_data/regierungsviertel/core-house-colours-v273-evidence.json.gz`.
No original source file or public geometry packet is rewritten.

Sources remain Berlin LoD2/ALKIS (Geoportal Berlin, dl-de/zero-2-0) and retained
OpenStreetMap context/attributes (© OpenStreetMap contributors, ODbL-1.0).
No new photo or geographic source, photograph pixels or texture is introduced.
