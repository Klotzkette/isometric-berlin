# v1.0.26 — source-bound streets and park-path visibility

## Requested result and scope

The Tiergartenstraße between Philharmonie and the CDU approach was reduced to
coarse raster patches by the mobile-safe progressive surface policy. The owner
then explicitly added roads around Hauptbahnhof, Chancellery, Brandenburg Gate,
Potsdamer Platz, Europacity and Charité. This change belongs to pipeline step 10.
It adds continuous carriageways, mapped roadside paving, 22 cm wide / 14 cm high
display kerbs and lane-divider markings to the drawn city in those areas.

The six polygons of OSM relation 7643526 plus a 45 m immediate street margin
bound the Tiergarten work. A narrow Klingelhöferstraße continuation reaches the
requested CDU frontage: Tiergartenstraße itself terminates north of the CDU
headquarters at the Stülerstraße junction. Six overlapping display windows
cover the additionally requested districts. These windows are rendering masks,
not claimed administrative or surveyed neighbourhood boundaries. All output is
clipped to the existing published city bounds, and open tunnel ramps are removed.

## Evidence and limits

- Retained `geo_data/regierungsviertel/osm.gpkg`, linked by SHA-256 in the new
  source supplement: original road axes, surface tags, source IDs, widths,
  lane counts, path connections and bridge/tunnel/covered classification.
- [Großer Tiergarten, OSM relation 7643526](https://www.openstreetmap.org/relation/7643526).
- [Official Berlin DOP 2025 spring orthophoto service](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr):
  visual check of Tiergartenstraße beside Philharmonie, its sidewalks and park edge.
  Reference imagery is neither committed nor requested by the viewer.
- [Berlin Senate: inauguration of Helmut-Kohl-Allee](https://www.berlin.de/rbmskzl/aktuelles/media/einweihung-der-helmut-kohl-allee-1669992.php):
  the former Hofjägerallee was renamed on 9 May 2026. The retained OSM snapshot
  already uses Helmut-Kohl-Allee; no invented Hindenburgallee is introduced.

1799 motor-road parts are included: 153 have explicit widths, 665 use mapped
lane counts and 981 use the repository's documented highway-class width fallback.
Missing dimensions are not represented as measured facts. Source width tags take
precedence over lane inference. Kerb height/width and the 4 m on / 6 m off dash
rhythm are isometric display reconstruction, not a traffic-paint or kerb survey.
Mapped foot/cycle ribbons supply roadside paving; a blanket sidewalk ring is not
invented. Existing park sand/gravel/earth paths retain their materials and widths.

The generator unions road bands before extracting kerbs. Open intersections,
source foot/cycle approaches and scope cuts receive no transverse kerb.
Lane dividers stop before source graph junctions, including turning approaches.
Bridges, covered streets, underground roads and source steps retain their prior
structures/levels. Only buried nonbridge/nonstep park ribbon vertices inside the
requested scope may rise to the existing terrain sampler. Their X/Z geometry,
source width, source data and already higher vertices remain unchanged. This
corrects the locally buried Bellevueallee path `359234589:0`.

## Implementation and performance

`scripts/build_district_streets.py` produces the checked-in `districtStreets.json`
and the small separate scope module. The supplement contains 188028 surface
triangles, with maximum terrain-sampling edges of 16 m. Surface coordinates use
indexed little-endian centimetre integers in base64, decoded without a library
or network dependency. The original union/triangulation runs offline.

`DistrictStreets.ts` constructs five static batches with identical desktop/touch
geometry: asphalt, mapped roadside paving, raised kerbs, kerb ink and markings.
It costs 13463244 geometry bytes; local Bun construction measured 61.5 ms.
The payload is not duplicated in the background Worker's code. The Worker skips
its legacy lane dashes in the new region, preventing two overlapping paint sets.
All five batches exist with the first isometric city and remain resident during
camera movement. No buildings, textures, geometry LOD or movement speeds are
reduced. Day/night/snow/Schwellenraum share these street shapes; the established
block-native Minecraft terrain remains unchanged.

## Verification

- Four Python source/geometry tests validate all requested districts, explicit
  width provenance, source checksum, maximum triangle edges, area preservation,
  scope bounds and uncapped/unblocked tunnel ramps.
- Five frontend street tests validate terrain draping, real kerb upstands,
  day/night materials, five-draw memory bound and the Bellevueallee correction,
  including preservation of X/Z/source data and source elevated-path exclusions.
- Initial production-build Chrome touch startup: 7.4 s, visible 3D canvas,
  zero page errors, console errors, audio advisories or failed critical requests.
- Actual city views are inspected at Tiergartenstraße east/west, Großer Stern,
  Hauptbahnhof, Chancellery, Brandenburg Gate, Potsdamer Platz, Europacity and
  Charité on desktop and touch. The tests assert the district asphalt batch
  remains effectively visible at every camera position.

- Production build, package generator, release-readiness check and local package
  smoke check passed for v1.0.26.
- Ruff format/check passed; all 391 Python tests passed in 45.85 s.
- Production-package WebKit startup passed in 13.34 s. Its only advisory was the
  pre-existing ignored `interactive-widget` viewport attribute; there were no
  application errors or failed critical requests.

- All 1939 frontend tests across 242 files passed (360.38 s); the ten affected
  street/path tests also passed after the final continuous-divider adjustment.
- Final production views passed in night, snowstorm and Schwellenraum on desktop
  and touch, with the street layer visible and no page errors.
- ZIP SHA-256: `2b111101ef49ca8bc8f2ef95c53241bf15f7ba0c36c192536774e2f0d655d96c`.
- Static tarball SHA-256: `7e30d8245f51a2ba604b5efccd2096b352d883842fce95101868071c7e20e133`.

Public deployment completion, source/Pages commits and live byte/browser checks
are recorded in the v1.0.26 GitHub release notes. Hosting stays on the existing
public GitHub Pages viewer and preserves hashed assets for older open tabs.
