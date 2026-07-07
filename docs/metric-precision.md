# Metric precision and surface-detail QA

This report documents what the current deterministic viewer can claim
from committed public/open data, and where it still needs a future
photogrammetric mesh pass.

## Source hierarchy

- LoD2 geometry anchor: https://gdi.berlin.de/geonetwork/srv/api/records/3c7c49af-00a4-3bcd-bc00-20e7f0f1b7bf
  - Official metadata states that Berlin LoD2 footprints correspond to
    cadastral building outlines; roof forms are generalized standard
    roof forms.
- DOP orthophoto QA: https://gdi.berlin.de/geonetwork/srv/api/records/73a3de47-ab2a-4be2-ae5d-8d6f8fe5cc1c
  - Official DOP 2025 metadata gives 0.20 m ground resolution and
    approximately +/- 0.4 m positional accuracy.
- ALKIS parcel context: https://daten.berlin.de/datensaetze/alkis-berlin-flurstucke-wfs-1bc014d7
- Future textured mesh candidate: https://www.businesslocationcenter.de/en/economic-atlas/download-portal

## Committed LoD2 geometry statistics

- Buildings: 2614
- Polygon parts: 2620
- Total footprint area: 300614.67 m²
- Footprint vertices rendered: 17449
- Median vertices per polygon: 4.0
- Interior rings / courtyards: 48
- Median segment length: 1.42 m
- Measured LoD2 heights: 2472 (94.6%)

## Landmark placement QA

- Status: ok
- Landmarks checked: 26
- Relative relationships checked: 19
- Review count: 0

## Current rendering claim

The viewer is metric in planimetric placement because it renders
EPSG:25833 LoD2/OSM/ALKIS geometries in metres. It now also renders
LoD2 interior rings as visible courtyards/cut-outs and uses denser
facade bays, roof ribs, and roof equipment marks from footprint size,
height, roof type, and landmark material cues.

It does **not** yet claim true photogrammetric facade relief. For that,
the next major step should ingest the official Berlin 3D mesh/OBJ
texture tiles or another fully licensed textured 3D source, then render
from that mesh rather than stylising LoD2 footprints.

## Tiergartentunnel precision claim

The Tiergartentunnel route is now drawn as a visible underground
engineering cutaway using public portal coordinates, public route
descriptions, OSM context and published cross-section facts. Its
planimetric route and depth are still an approximation, not official
surveyed as-built geometry. See
[`tiergartentunnel-geometry.md`](tiergartentunnel-geometry.md).
