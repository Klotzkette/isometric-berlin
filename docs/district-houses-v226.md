# Kreuzberg and Friedrichshain houses — v1.0.126 / Step 10

The existing v225 house presentation now also selects **Kreuzberg and
Friedrichshain**. Generic source-owned roofs gain the same restrained neutral
separation from plaster walls. Existing estimated street-window panes gain the
same lighter upper reflection and denser lower glass; native panes retain flat
block paint. Earlier house treatments, measured envelopes and detailed source
or authored materials keep their previous values and priority.

## Scope and evidence

The two complete official ALKIS Ortsteil boundaries already reside in
`geo_data/regierungsviertel/district-facades-v188-boundaries.geojson`, retrieved
8 October 2026 from [Geoportal Berlin's ALKIS WFS](https://gdi.berlin.de/services/wfs/alkis_ortsteile)
in EPSG:25833, dl-de/zero-2-0. Existing Berlin LoD2 and OpenStreetMap attribution
and source roles are unchanged. No new geographic or photographic source,
city packet or coverage is introduced.

`scripts/build_district_house_scope_v226.py` reuses the v225 exact 128 m cell
compiler. The added selector is **82,292 bytes**, containing only these two
regions; the five prior selectors remain byte-identical. Boundary fragments
retain all source bends and holes. Their reconstructed union differs from the
original by less than **0.0002 m²** per district, due solely to the existing
0.1-micrometre serialization rounding. This metadata selects already delivered
geometry and does not replace building or administrative geometry.

The v226 wrapper supplies the extended selector to the unchanged v225 colour
recipe. Original v225 functions still default to the frozen five-region scope.
Whole ordinary footprints, unique source-corner ownership and exact original
generic roof colours remain mandatory. Dedicated school IDs, ambiguous corners,
split boundary owners and all explicit/authored paint retain their protection.
Core early/detailed roofs retain the shared resolver and its existing higher
priority for recorded roof materials, pinned colours, hero and glass owners.

Only existing v188/v209 panes with their exact original dimensions, topology
and colour registers qualify. Sills, cornices, frames, authored glass and all
other existing detail remain unchanged. The v188 companions contain estimated
glass and base/eave paint, not a hidden inventory of surveyed facade materials;
their original selection excludes mapped facade-colour/material owners. Existing
core material priorities and generic wall families already apply and are retained.
No individual facade paint, window placement or slate roof material is claimed
as surveyed; no new window grid or ornamental detail is inferred.

## Actual packet results

The read-only audit examines **1,088** relevant drawn/native packets and checks
their SHA-256 hashes against the retained manifest. It reproduces all five
previous region rows exactly and verifies all **791** previous input hashes.
The new receipt stores only the additional 297 input hashes and references the
unchanged v225 receipt, avoiding duplicate source data.

| Added region | Drawn roof owners | Native roof owners | Drawn panes | Native panes |
| --- | ---: | ---: | ---: | ---: |
| Kreuzberg | 6,388 | 6,590 | 28,696 | 10,005 |
| Friedrichshain | 4,740 | 4,817 | 31,336 | 8,407 |
| Added total | **11,128** | **11,407** | **60,032** | **18,412** |

Owners are distinct retained source IDs with actual changed streamed roof colour
cells, not households or individually researched facades. Existing core roofs
are additional and are not included. Exact counts and timing are retained in
`geo_data/regierungsviertel/district-houses-v226-audit.json`.

Representative viewer XZ targets are Kreuzberg **3331.66, 2087.46** and
Friedrichshain **5500, 500**. Actual `6_4` / `district188-6_4` and `10_0` /
`district188-10_0` packets contain changed source-owned roofs and known panes
in both families. These are presentation review anchors, not surveyed facades.

## Cost and verification

All corrections reuse existing final colour cells: **zero new vertices,
geometry buffers, renderables, shader attributes, textures or city requests**.
There is no per-frame scope calculation or persistent ownership cache. Drawn
mobile detail, independent native geometry, coverage, residency limits, serial
decode and the v124 lossless upload/parking lifecycle remain unchanged.

On the development host, the largest affected packet by vertex count,
`8_-2.minecraft` (143,168 vertices; 64 source parts), took **0.178 ms before /
0.273 ms after** median owner work across 30 warmed alternating passes; its
worst new cooperative slice was **0.288 ms**. The full read-only audit measured
298 ms total owner work and 20 ms pane work across 1,088 packets. These are local
measurements, not a guarantee for physical phones.

- 17 focused Bun tests / 745 assertions pass across v225, v226 and the shared
  colour tests. Eight real new-area packets verify exact positions/indices,
  buffer sizes, renderables, immutable input/navigation and actual colour-only
  changes in both independent families. Ten real old-area packets retain every
  source-owner palette and height. Existing authored-colour, school, shared-corner,
  cooperative and core-roof checks remain passing.
- Three focused Python tests verify exact/reproducible source selection, no
  overlap with the previous scopes and the frozen v225 selector fingerprint.
  Ruff format/check passes for the touched Python files.
- No heavy full build or full-world constructor was needed for this bounded
  house subtask. Integrated browser/release validation is reported separately.

Reproduce with `uv run python scripts/build_district_house_scope_v226.py`,
`uv run pytest tests/test_district_house_scope_v225.py tests/test_district_house_scope_v226.py`,
and, from `src/app`, `bun scripts/audit-district-houses-v226.ts` and
`bun test tests/district-houses-v225.test.ts tests/district-houses-v226.test.ts tests/surrounding-city-colour-v184.test.ts`.
