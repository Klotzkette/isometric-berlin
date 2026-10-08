# Tegeler See, Wannsee and Pfaueninsel — bounded v1.0.94 supplement

This supplement adds the complete mapped Tegeler See, the previously uncovered
southern tip of Kleiner Wannsee and the missing interior of Pfaueninsel. It adds
recognizable outline models of Schloss Tegel, Villa Borsig and Schloss Pfaueninsel.
It does not regenerate or replace any earlier packet, building, tree or shoreline.

## Source geometry and ownership

`west-lakes-v194-source.geojson` retains twelve complete OSM owners from the cached
Geofabrik Berlin extract dated 2026-09-29, including all original ring vertices
and holes. Its metadata includes the PBF SHA-256. Coordinates are CRS84; the
established renderer frame is EPSG:25833 east − 389500, 5820000 − north.

| Owner | Source area | Treatment |
| --- | ---: | --- |
| Tegeler See relation 451908 | 3,819,336.223 m² | Complete new water; all seven island holes remain dry |
| Großer Wannsee way 4436463 | 1,422,558 m² | Already present, retained without a second surface |
| Havel relation 4578498 | 7,629,621 m² | Entire source already present, including northern Wannsee |
| Havel relation 173239 | 3,377,555 m² | Entire source already present, including Pfaueninsel connection |
| Kleiner Wannsee way 4423275 | 191,545 m² | Only 7,643.540 m² outside the prior scope added |
| Pfaueninsel way 25179280 | 679,447 m² | Only 500,241.687 m² of previously absent island interior added |
| Humboldt-Schloss way 24448740 | exact source footprint | New named outline model |
| Villa Borsig way 22529932 | exact source footprint | New named outline model; open rear court retained |
| Schloss Pfaueninsel way 25014562 | exact source footprint | New named outline model; two rounded tower footprints retained |
| Pfaueninsel parts 1540816649 / 1543022894 / 1543260963 | 2.83 m² combined | Complete tagged white upper-wall polygons and sloped caps retained |

Großer Wannsee is not identical to one OSM water way. The official Berlin
[Stegkonzept report](https://www.berlin.de/ba-steglitz-zehlendorf/politik-und-verwaltung/aemter/umwelt-und-naturschutzamt/gewaesser/180926_stegkonzept_sz_erlaeuterungsbericht-zusammengefuegt.pdf?ts=1752674601)
records 277 ha. Its northern part belongs to the adjacent mapped Havel relation.
The audit checks that both complete related Havel polygons are already covered,
not merely the named 142 ha way. No line or bank is added across this artificial
source partition. `wannseePartitionAudit` records zero missing prior-scope area
for all three owners.

`bounds-west-lakes-v194.geojson` contains finite named geometry: Tegeler See and
its islands with a 22 m shore band, Pfaueninsel, the two named Wannsee water ways
(with 12 m Kleiner-Wannsee context), and 32 m context around the two Tegel houses.
These context distances are presentation limits, not surveyed property boundaries.
The existing v187 scope is subtracted before any new fill is triangulated.
No rectangular district fill or invented surrounding city is introduced.

## Height and recognition limits

The connected water plane remains at the existing renderer datum **−1.15 m**;
new land meets the existing **3 m** flat ground convention. These are display
datums, not surveyed terrain elevations. No artificial hill is introduced.
The new named footprints do not overlap the old scope or prior generic buildings.
No matching LoD2 owners or required LoD2 tiles were present in the retained local
cache, so the model does not claim a measured vertical envelope.

Schloss Tegel retains its OSM three-level semantic tag, four corner projections,
light walls and dark roofs. Villa Borsig retains its irregular open-court plan,
ochre walls, red hipped roof and restrained dormer/window rhythm. Pfaueninsel
retains its white rounded towers, connecting open iron bridge and small belvedere.
Roof pitches, vertical extents and facade subdivisions are explicitly estimated
recognition geometry informed by the permitted photographs. The Pfaueninsel
OSM height itself is an estimate; its source metadata is preserved. This is an
outline refinement, not a claim of architectural survey accuracy.

Factual primary sources:

- [Schloss Tegel, Bezirksamt Reinickendorf](https://www.berlin.de/ba-reinickendorf/ueber-den-bezirk/ortsteile/tegel/artikel.85006.php)
- [Schloss Tegel, Berlin](https://www.berlin.de/sehenswuerdigkeiten/3560321-3558930-schloss-tegel.html)
- [Villa Borsig, Landesdenkmalamt](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/frankreich/reinickendorf/villa-borsig-647667.php)
- [Schloss Pfaueninsel, SPSG](https://www.spsg.de/schloesser-gaerten/objekt/schloss-pfaueninsel/)

The three freely licensed visual references and full attribution are recorded in
`west-lakes-v194-visual-references.json`. They are reference-only; no bitmap or
photo texture is bundled. Official copyrighted photographs were not used as
visual references.

## Runtime and verification

`createWestLakesV194(minecraft = false)` creates one active representation, with
independently culled groups and frozen transforms. Ground/water triangles are
indexed offline. Native terrain has a separate 2 m orthogonal shore reading,
with collinear redundant derived vertices removed exactly; the complete original
rings remain retained. The three tagged Pfaueninsel upper-wall parts retain their min-height 9 m, total height 12 m and 0.3–0.6 m cap heights relative to local ground; the third untagged cap direction is a display inference. Native buildings use a separate 1 m exterior block skin,
without hidden solid infill. There is no runtime voxelization, large lake-cell
array, animation or texture. Touch and pointer receive identical static detail.

Current final attributes occupy **437,184 bytes in drawn mode / 1,885,634 bytes
in native mode**, with **11 / 8 draw calls**. Both JSON representations and both
GPU representations remain under 2 MiB. Existing city residency budgets are
unchanged. The 208 KiB navigation ring file is imported lazily with the outline
layer. `westLakesV194WaterAt(x, z, minecraft = false)` returns the matching water
datum or null, preserving all island holes. Landscape colours use the same 8-bit linear colour quantization as retained packets; native landscape materials use the same standard material convention. Hero source navigation rings are
also retained in that file. `westLakesV194SolidAt(x, y, z, radius = 0, minecraft = false)` provides source-footprint collision in drawn modes and exact final block collision in Minecraft; the open Borsig court remains passable.

Focused checks: `uv run pytest tests/test_west_lakes_v194.py -q` (5 passed) and
`bun test tests/west-lakes-v194.test.ts` (4 passed, 13,244 assertions). They check
source ownership, all island holes, retained full Wannsee partitions, old/new
seams and nonoverlap, native orthogonal geometry, bounded buffers, final instance
counts, finite constructors, material lifecycle handles and water containment.
Release publication and integrated browser/mobile QA belong to the release task.

Suggested world-space camera targets (metres):

- Tegeler See overview: `[-8060, 0, -6400]`, camera `[-10600, 2200, -3700]`.
- Schloss Tegel: `[-6251, 11, -8624]`, camera `[-6320, 53, -8542]`.
- Villa Borsig: `[-7364, 10, -7786]`, camera `[-7430, 57, -7705]`.
- Pfaueninsel palace: `[-17324, 11, 9369]`, camera `[-17382, 49, 9423]`.
