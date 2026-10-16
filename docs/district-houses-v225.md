# District house presentation — v1.0.125 / Step 10

This bounded colour refinement covers already delivered buildings in Moabit,
Prenzlauer Berg, Schöneberg and Wilmersdorf, plus the immediate Gymnasium
Steglitz neighbourhood. It distinguishes existing roof forms from plaster walls
and gives existing estimated window panes a lighter upper sky reflection over
denser lower glass. The source envelopes, windows, sills, crossbars, cornices,
courts and roof geometry remain complete. No facade is claimed as individually
surveyed and no new windows, ornament or photographic textures are invented.

## Selection and sources

Moabit, Prenzlauer Berg and Schöneberg reuse their complete retained official
ALKIS Ortsteil boundaries. Wilmersdorf uses the same
[Geoportal Berlin ALKIS WFS](https://gdi.berlin.de/services/wfs/alkis_ortsteile),
retrieved 16 October 2026 with `nam='Wilmersdorf'`, EPSG:25833, dl-de/zero-2-0.
The full response and provenance are retained in
`geo_data/regierungsviertel/wilmersdorf-boundary-v225.geojson`.
This boundary selects existing buildings only; it adds no coverage.

The school margin is an explicitly illustrative **900 × 900 m square** centred
on the retained main school owner `DEBE06YYB0000AUq`, viewer XZ
**−3235.395, 6831.491**. Its source comes from the existing
`steglitz-v182-exclusions.geojson`; the complete school, hall and service models
and their source IDs remain protected. The square is a presentation scope, not
the school site or a new district boundary. The documented existing Berlin LoD2
(dl-de/zero-2-0) and OpenStreetMap (ODbL-1.0) source notices remain applicable.

`build_district_house_scope_v225.py` compiles 128 m selection cells. Interior
and exterior cells resolve immediately; boundary cells retain clipped exact
source-ring fragments and holes. Coordinates are stored to 0.1 micrometre only
to remove binary floating-point serialization noise, far below source precision.
The union test differs from each original selection by less than 0.0001 m².
This 169,780-byte selector is metadata, not new geometry or a district copy.

## Appearance and protection

Only original generic wall/roof paint on uniquely source-owned `city` corners
can receive the streamed correction. Whole footprint rings must lie in one
selected region. Shared or unowned corners and conflicting/outside source parts
retain their previous colours. Generic roof grey is a **graphic separation**,
not evidence that the actual roof is slate. Original source and authored paint
are never classified merely because they look grey.

The core drawn early-envelope and detailed factories use their existing shared
roof-colour resolver. Pinned roof colours, mapped roof materials, authored hero
and panorama palettes and glass owners retain priority. Existing source-code
roof slopes use the same selected cap tone. Core native columns are unchanged;
the independently delivered native outer-city geometry keeps flat block paint.

Window adjustment is restricted to the original `district-facades-v188` and
`kiez-facades-v209` mesh kinds, their exact four-vertex/six-index recipes,
1.32 × 1.80 m drawn panes or 1.15 × 1.40 m native panes, and both original
colour registers. The full pane span must be within the selected region.
Sills, crossbars, cornices, authored glazing and malformed/clipped quads are
untouched. No existing generic axis geometry or material is replaced.

## Actual packet audit

The read-only audit examines 791 relevant immutable drawn/native packets and
records their SHA-256 fingerprints, checked against the retained manifest.
Counts below are distinct generic **source owner IDs with actual changed roof
colour cells**, not household counts or a count of individually researched
facades. Core buildings are additional and are not included in these streamed
counts. Native and drawn ownership differs because their retained source
representations and exact corner eligibility differ.

| Existing region | Drawn roof owners | Native roof owners | Drawn panes | Native panes |
| --- | ---: | ---: | ---: | ---: |
| Moabit | 1,106 | 1,090 | 3,949 | 1,134 |
| Prenzlauer Berg | 8,037 | 8,234 | 4,841 | 1,109 |
| Schöneberg | 4,963 | 4,999 | 34,938 | 10,500 |
| Wilmersdorf | 4,738 | 4,811 | 0 | 0 |
| Gymnasium Steglitz surroundings | 771 | 806 | 0 | 0 |
| Total | **19,615** | **19,940** | **43,728** | **12,743** |

Wilmersdorf and the school surroundings receive roof/wall separation only;
their absent v188/v209 panes are not filled with a speculative new window grid.
The audit is `geo_data/regierungsviertel/district-houses-v225-audit.json`.

## Cost and verification

All changes reuse existing colour cells. There are **zero additional vertices,
geometry buffers, renderables, textures, city requests or shader attributes**.
No view distance, residency limit, resolution, tour stop or mobile detail rule
changes. Existing serial decoding, cooperative yields, original encoded source
receipts and the v124 lossless upload/parking lifecycle remain intact. Static
selection metadata is retained; no new per-frame work or persistent owner cache
is added.

- 13 focused Bun tests / 635 assertions pass, plus one exact-scope Python test.
  Ruff formatting/lint pass for the two new Python files.
- Actual streamed decoder tests verify both families, original positions and
  indices, equal buffer sizes/renderables, immutable input/navigation, authored
  paint rejection, protected school IDs and synchronous/cooperative agreement.
- A before/after audit on actual Moabit core owners `78474603` and `78474607`
  exercised both early and detailed factories. Every position, normal, other
  non-colour attribute and index byte remained exact. Each factory changed only
  its one existing building colour buffer; early output retained one renderable
  and detailed output four. Original input records were unchanged.
- Thirty warmed passes on actual packet `-5_4.minecraft` (199 source parts)
  measured median owner work **0.90 ms before / 1.20 ms after**, worst new
  cooperative slice **1.39 ms** on this development host. The final whole-region
  read-only audit measured 249 ms total owner work and 11 ms pane work across
  all 791 packets. These are local timings, not a physical-phone guarantee.

Reproduce the small selector with
`uv run python scripts/build_district_house_scope_v225.py`, test it with
`uv run pytest tests/test_district_house_scope_v225.py`, and run the colour audit
with `bun scripts/audit-district-houses-v225.ts` from `src/app`.
Focused frontend tests are `district-houses-v225.test.ts` and
`surrounding-city-colour-v184.test.ts`. No full build or full-world constructor
was needed for this subtask; integrated browser review belongs to the release.

Representative viewer XZ targets: Moabit **−2358, −911**, Prenzlauer Berg
**3229, −1921**, Schöneberg **−1178, 3578**, Wilmersdorf **−3299, 3084**, and
Gymnasium surroundings **−3200, 6818**. All lie inside the audited scopes.
