# City West street detail v235

Step 10, additive street-space refinement. The audit retains every named Kurfürstendamm course from v163 (Breitscheidplatz to Rathenauplatz) and every Tauentzienstraße course from v165. Their junction shares exact source vertices. The 176 at-grade Ku’damm ways already receive v210 markings; v163/v165/v188 pavements, curbs, islands and asphalt remain unchanged.

Tauentzien was not among v210’s four marked boulevards. The retained local Geofabrik Berlin source identifies four dashed crossing owners and five striped restriction polygons on its delivered asphalt. These yield 117 paint segments, with no inferred zebra, lane count or new signal location. Unknown crossing types remain unpainted. Unspecified crossing width, hatch direction and dash phase are cartographic estimates, as in v206/v210.

`scripts/build_citywest_streets_v235.py` freezes the complete two-street audit axis and 141 relevant local OSM features. It uses the established v206 positive-tag compiler, subtracts previous v206/v210 paint and retained general lane axes, then appends one texture-free packed part per family to existing `-5_3`. No road/pavement replacement, new manifest entry, navigation mutation or residency budget change occurs. Existing packet lifetime owns upload, parking and disposal; unrelated packets avoid decoding the weak payload.

Paint follows the actual v188 surface: drawn asphalt 5.54m → paint 5.55m; native asphalt blocks top 5.60m → paint 5.61m. Native quarter-metre pixels are checked against the full existing orthogonal road tiles before union/triangulation; they cannot spill onto smooth-only road edges. Drawn uses the exact source-derived paint shapes equally on mobile and desktop. The additions cost 8,535 decoded bytes drawn and 3,198 native, 16,158 bytes compact runtime JSON.

Source receipts, unchanged packet hashes, original full named courses and every resulting owner/paint footprint are retained in `geo_data/regierungsviertel/citywest-streets-v235-{source,evidence}.json`. This is a targeted source-supported refinement, not a claim that every current marking or curb height has been surveyed. No additional trees are asserted by this paint pass.

The three officially recorded Tauentzien trees in `raw/kudamm-v205/trees.json` already match delivered `park-details.json` trees: GIS IDs `00008100_000cb47e`, `00008100_000cb47f`, `00008100_000cb480` match positions `[-2435.26,1582.55]`, `[-2444.03,1577.98]`, `[-2461.04,1588.56]` within 0.303m, 0.322m and 0.028m. These are retained without adding duplicate canopies. Earlier catalogue-based height interpretations are not reclassified as new surveyed dimensions.

Checks: `uv run pytest tests/test_citywest_streets_v235.py`; `bun test tests/citywest-streets-v235.test.ts` from `src/app`. They cover positive source semantics, retained complete axes and packet identity, asphalt support, old-paint separation, native grid, safe packet guards and cancellation.
