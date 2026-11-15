# Kladow and the former airfields — V346

This pass fills a real coverage gap: the exact current Kladow Ortsteil boundary
(OSM relation 409216), minus every ground footprint already delivered in v225.
It adds 9,775,055 m² rather than another cosmetic layer over existing districts.
The existing Havel, western landscape, all previous buildings and all earlier
packets remain unchanged.

## Kladow, Landstadt Gatow and the museum airfield

- 12,399 complete official Berlin LoD2 building families examined, 15,299 leaf parts and
  137,744 original wall/roof sheets. All 22 intersecting source tiles were read;
  no requested family failed extraction. 12,360 families have a visible new Drawn
  footprint; boundary-only contacts remain with their old owner. Actual pitched roofs, differing heights,
  additions, courtyards and measured footprints replace absent coverage.
- Current OpenStreetMap streets, footpaths, green areas and water. LoD2 has
  priority; OSM contributes only genuinely uncovered building area.
- Both present Gatow runway remnants, their tagged 46 m width, eight mapped apron
  polygons, connecting taxiways and the museum hangar buildings. The old runway
  does not extend through the present Landstadt housing.
- Separate Drawn and Native geometry: Drawn retains measured planar sheets;
  Native samples those roof planes on the existing two-metre outer-city lattice,
  joins only equivalent cardinal faces and keeps courtyard holes open. Its grid
  admits 12,021 official families; sub-cell sheds and narrow remnants along old
  coverage seams do not acquire invented oversized replacement blocks. Navigation
  uses the actual Drawn roof planes and independently merged Native roof caps.

The official museum describes the remaining two runways as about 830 m; the
current mapped centreline geometries are approximately 845/868 m. Their measured
geometry is preserved instead of shortening it to a rounded prose description.
Nine hangars, tower and fire station are part of the historical site; OSM names
eight hangars explicitly, while the complete official building sheets also cover
unnamed buildings. No aircraft operation, unverified future development or
invented detailed aircraft collection is asserted.

The established outer-city ground datum remains y=3. This pass does **not** claim
new surveyed Kladow terrain, facade openings, paint or interiors. The restrained
plaster/roof materials and untagged OSM heights/road widths are display estimates.
The complete source sheets and every retained older detail remain available.

## Tegel and Tempelhof

Tegel gains 607,940 m² of previously absent mapped apron/taxiway paving. The
original terminal bodies and five runway sections, and every already delivered
ground footprint, are subtracted. Closed apron ways are interpreted as areas,
not as narrow boundary lines. Untagged taxiways use an explicit 18 m width
estimate. The operator's 2026 Terminal A work is under construction; the future
campus is not shown as completed.

At Tempelhof, current OSM apron way 181407909 covers 227,378 m², consistent with
the operator's rounded 220,000 m² description of the open apron. Sixteen guarded
Drawn/Native packet repairs turn only wrong basic ground inside that measured
polygon into concrete. Every outside triangle complement, original road, path,
runway, building, earlier DGM relief and navigation record is retained. Heights
stay exactly on their existing planes; no second coplanar paving overlay is
added. Raw and fully prepared predecessor meshes, navigation and lines are
fingerprinted before an old triangle can retire.

## Delivery and limits

| Output | Count | Compressed packet bytes |
| --- | ---: | ---: |
| Kladow base tiles, both modes | 62 / 124 files | 18,922,605 |
| Tegel paving tiles, both modes | 21 / 42 files | 258,495 |
| Tempelhof lazy recipe | 16 guarded keys | approximately 44 KB gzip |

Largest Kladow packet: 608,592 compressed bytes / 2,266,587 decoded bytes. No new
queue, resident-tile, worker, decode or mobile-quality budget is introduced. Both
modes use the existing bounded stream. Geodata archives and source photos are not
shipped and the viewer makes no runtime requests to GitHub or geodata providers.

The audit-only LoD2/OSM source is losslessly stored as 18 independently valid
gzip JSON parts under `kladow-airfield-v346-source-parts`, plus the 5,761-byte
`kladow-airfield-v346-source-index.json`. The largest compressed part is 648,044
bytes, within the unchanged 5 MiB repository binary limit. Reassembly preserves
all 32,334,078 original decoded bytes and their SHA-256
`4902f6d40e1fe5bfb8d3ccc53dcc84c6a2983ea32b1b72cc2217f657ab28d9b4`.
Part hashes, byte lengths, record offsets and the final decoded hash are checked
before the source is used. This packaging change does not alter any render
packet and does not add viewer downloads.

The two supplement manifests are independent integration inputs:

- `geo_data/regierungsviertel/kladow-airfield-v346-manifest.json`
- `geo_data/regierungsviertel/tegel-airfield-v346-manifest.json`

Their staged packet directories are respectively `raw/kladow-v346/packets` and
`raw/airfields-v346/packets`. The root release merges their exact footprints and
descriptors and copies those bytes. `AirfieldSurfacesV346` is the last ordinary
source-quarter catalogue entry after the V346 main-road fronts, before deferred
green/path/crossing overlays. Its preparation includes all preceding ordinary
quarter recipes; the overlay pipeline remains unchanged.

Validation: Python source/geometry checks cover real pitched roofs, an open
Native courtyard, exact source cut planes, both complete bounded packet families,
valid indices/navigation and preserved apron area. Sixteen Bun transaction tests
exercise the actual current predecessors, exact outside-index preservation,
unchanged navigation and wrong-owner rejection. Visual review points in viewer
coordinates: Gatow hangars `[-15504.7,4599.7]`, Kladow village
`[-15619.6,6956.1]`, Landstadt `[-16861.5,5032.1]`, Tegel apron
`[-5495.8,-4256.3]`, Tempelhof apron `[1229,4411.2]`.

## Sources

- [Geoportal Berlin LoD2](https://gdi.berlin.de/data/a_lod2/atom/), dl-de/zero-2-0;
  individual URLs and SHA-256 digests are frozen with the bounded source.
- [OpenStreetMap / Geofabrik Berlin](https://download.geofabrik.de/europe/germany/berlin.html),
  ODbL-1.0; snapshot 2026-11-13T21:22:20Z, SHA-256
  `228890fba84d33cf51231a08425cc58683fe327b9cbe1e7a746fa1c4a1360e50`.
- [Bezirksamt Spandau: Kladow](https://www.berlin.de/ba-spandau/ueber-den-bezirk/ortsteile/kladow/artikel.190076.php).
- [MHM Gatow: Flugplatz und Museumsgeschichte](https://gatow.mhmbw.de/de/flugplatz-museumsgeschichte).
- [Bundeswehr museum description](https://zms.bundeswehr.de/de/zmsbw-kanal-forschung-und-bildung/museums-und-sammlungsverbund-der-bundeswehr/militaerhistorisches-museum-der-bundeswehr-flugplatz-gatow-5656684).
- [Tempelhof operator: Vorfeld](https://www.thf-berlin.de/vermietung/eventlocation/vorfeld).
- [Tempelhofer Feld visitor information](https://www.tempelhoferfeld.de/service-infos/besuch-planen/).
- [Bezirksamt Reinickendorf: Terminal A construction, July 2026](https://www.berlin.de/ba-reinickendorf/aktuelles/pressemitteilungen/2026/pressemitteilung.1697743.php).
