# Principal-road housing and nearby streets

This pass refines **3,503 existing houses in 473 streamed tiles**, across eleven
boroughs: 2,150 houses within 55 m of the principal-road network and 1,353 nearby
side-street houses. It adds 62,720 Drawn and 44,517 independently cardinal Native
window groups, with framed glazing, reveals, sills and restrained joinery. All
source walls, roofs, courtyards, previous colour work and navigation remain.
It is a finite building-detail pass, **not a claim that every Berlin building
or every frontage has been photographically surveyed**. The existing Reinickendorf
coverage yielded no new unprotected eligible wall pair in this pass.

The search uses the complete 9,363-feature **official Berlin principal-road
network**, [Geoportal WFS `strnetz:uebergeordnetes_strnetz`](https://gdi.berlin.de/services/wfs/strnetz),
retrieved on 15 November 2026 (EPSG:25833, dl-de-zero-2.0), and the
[Geofabrik Berlin extract](https://download.geofabrik.de/europe/germany/berlin.html)
with OSM data through 13 November 2026, 21:22:20 UTC (ODbL-1.0).
The complete road network, selected building footprints/tags, actual selected
street lines, source hashes and fitting receipts are retained in `geo_data`.
No network query, map/photo download or dependency on GitHub raw content occurs
in the viewer.

Only positively mapped ordinary residential buildings with a current integral
storey count qualify. Their mapped footprint must overlap the retained source
footprint by at least 97%; named/institutional/shop buildings, known material
owners, previously authored fronts and protected footprints are excluded.
The complete original Drawn wall triangles and independent Native wall spans
must exist, with an unobstructed approach toward an actual named street. Nearby
retained houses reject party-wall and obstructed courtyard fittings. The
source wall's own vertical interval, divided by its mapped storeys, determines
the floor rhythm. Aperture widths, subdivisions and joinery colours are explicit
presentation estimates; they are not asserted as measured windows.

The new fitting joins the original tile transaction. Every raw mesh, line and
navigation record is fingerprinted; its actual production predecessor has been
replayed for **all 946 mode/tile plans**. Missing or changed source geometry
suppresses the addition. No source triangle, roof, navigation record or prior
fitting is retired. The five separately detailed Wollank/Rettigweg owners are
excluded from this pass, and all selected footprints lie in Berlin.

Thirty lazy modules each cover at most sixteen tiles. The established
lossless per-packet weak decoder inflates only the requested plan. There are at
most sixteen new house fronts per tile, including near side-street candidates;
the existing 400,000-vertex, 2,400,000-index and sixteen-part limits remain
unchanged. Mobile receives the identical Drawn source and fitting geometry.

Reproduction: `uv run python -m scripts.build_main_road_fronts_v346` after
restoring the hashed raw OSM extract, principal-road source and derived eligible
housing snapshot. The checked-in receipt preserves every selected building and
street independently of those ignored citywide caches. The compiler finalizes
against the actual production predecessor before splitting its immutable lazy
recipes.
