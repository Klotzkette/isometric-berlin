# BER architecture v236 — Step 10

The airport supplement turns the retained mapped airport outlines into source-bound building volumes. Its 259 replayable OSM records include all 165 earlier regional building identities, all 25 earlier v205 parts, previously omitted exterior parts and 13 explicit landside records. The original source files and `berAirportV205.json` remain byte-identical. The compressed new replay archive is 24,189 bytes; ignored raw XML is not copied into the release.

## What is represented

- Main terminal: the mapped main-pier body and hall podium support the existing glass hall, 18 columns and large projecting roof. Restrained horizontal cable-grid cues and an open canopy underside supplement the retained architecture.
- T2: the mapped silver metal volume has two source-tagged storeys and two individually mapped elevated connecting bridges (`999966725`/`999966726`), with the actual source interval 5–9 m above the established airport datum. They are glass bridges in the architect's account.
- North and south piers: source footprints, wall/glass bands and mapped upper sections. The elevated part `519141133` retains its 24–28 m interval; upper glass parts retain their 6–18 m intervals. Complete XYZ containment, not merely overlapping footprints, determines whether another already represented owner contains a part.
- DFS tower: a narrow, explicitly estimated concrete shaft sits inside the measured crown footprint, below the retained angular glass crown. The mapped outline is compatible with the two perpendicular steel-frame cuboids described by the tower architect; no circular crown is invented.
- P1/P2/P3/P7/P8, their mapped connector, Cargo Center, Bundespolizei, four station entrances and a height-tagged forecourt roof join the previously retained hangars and service buildings. Tagged storeys drive facade bands; mapped courtyards and roof holes stay open.

There are **210 new building-body contributions**: 204 with roofs and six supporting old caps/glass. They contain **30,596 drawn triangles** and **139,672 independently constructed native triangles** before the shared packet compiler clips them at tile boundaries. No additional permanent building group is created. Both complete families use the normal streamed packet lifetime; phones use the complete drawn family. The existing small v205 group remains.

Eighteen records remain outlines rather than speculative finished buildings: coarse whole-terminal envelopes, underground pump works, ruins, buildings under construction and elevated roofs/bridges without a supported height interval. Nineteen already complete roof/column parts are not duplicated. Twelve subsidiary parts are archived and accounted for under complete existing XYZ owners. The coarse 81,384 m² main-pier envelope `193677374` never becomes a ground-level block obstructing the raised bridges.

## Exact two-bridge correction

The earlier north-pier owner `1083495102` also included the two T2 bridges in its broad 15 m cap. Those bridges have explicit 5–9 m part heights. The user's request for a correctly complete BER authorizes a correction restricted to those two mapped bridge footprints.

`berAirportRoofPatchV236.json` records the original source/file hashes and the two bridge IDs. It replaces only that owner's rendered cap and its edge profiles with the exact remainder after subtraction: **183.314358568 m²** removed from the drawn cap. The native correction follows the independent 2 m bridge cells inside the pre-existing 2.5 m roof runs, removing **47.007895 m²**. Every untouched native roof row remains identical. All other v205 roof/column/glass data is used unchanged. The original source evidence is never rewritten.

The new north-pier wall fill uses the same remaining footprint. The bridges receive separate 5–9 m bodies and undersides, preserving their underpasses. A runtime source-hash guard and tests prevent accidentally applying this cap correction to another source revision. Raycaster regressions verify that neither family leaves the old high cap over either bridge.

## Evidence and display estimates

The source archive retains complete rings, holes, tags and input hashes. It reuses the existing local `ber-map.osm`, `ber-west.osm` and `ber-north.osm` snapshots; OpenStreetMap attribution and ODbL continue to apply.

Primary references checked during implementation:

- [gmp project account](https://www.gmp.de/de/aktuelles/41/presse/8766/ready-for-take-off-flugbetrieb-am-ber-startet): cantilevered roof, strict structural grid, horizontal cable-facade profiles and vertically separated passenger levels.
- [FBB airport facts, June 2025](https://corporate.berlin-airport.de/content/dam/corporate/de/unternehmen-presse/ber/flughafenanlagen-ber.pdf): T1 220 × 180 × 32 m, main pier 715 m, north/south piers 350 m each; T2 240 × 40 × 15 m. Its 25 passenger bridges comprise 16 at the main pier and nine south; the north pier has ten walk-boarding positions. No extra northern jet bridges are invented.
- [ATP T2](https://www.atp.ag/de/projekte/terminal-2-flughafen-berlin-brandenburg/): two-storey industrial architecture and two glass connections to the north pier.
- [Imhof tower project](https://www.imhof-architektur.de/tower-ber): approximately 72 m, concrete shaft and two perpendicular steel-frame crown volumes.

The existing cartographic ground remains y=3 m; terrain elevation above sea level is not silently added again. The retained OSM tower height is 70 m and stays so; the approximate 72 m published figure is recorded as a source discrepancy. Likewise the source T1 aggregate and explicit upper-roof heights are retained rather than collapsing all parts to one height.

Window dimensions, facade-band widths, slab/profile thicknesses, material swatches, canopy underside and the narrow shaft cross-section are **display estimates**, not surveyed facade details. When a reliable numeric building height is absent, the earlier outline height rule remains the estimate. Tagged storey counts are honored; body and opening geometry is never advertised as a photographically exact facade survey.

## Replay and checks

`uv run python scripts/build_ber_airport_buildings_v236.py` rebuilds the evidence and tiny cap patch from the committed replay archive. `--refresh-source` is only needed to extract again from the existing ignored XML. The shared `build_ber_airport_v236.py` consumes world-coordinate triangles and navigation geometry, splits complete surfaces into ordinary bounded packets and accounts for their final buffers.

Focused checks: four Python tests cover all retained source hashes/identities, exact landside scope, bridge clearances, high parts, source storeys, exclusions, complete cap-area preservation, unchanged native rows, finite drawn geometry and orthogonal native faces. Two new Bun tests raycast both bridge gaps in both modes. The four existing v205 transport/resource tests remain green; the small retained airport group uses 180,712 bytes drawn and 1,078,636 bytes native, with four/one draw calls respectively.
