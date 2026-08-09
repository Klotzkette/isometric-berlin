# Metric precision and surface-detail QA

This report documents what the current deterministic viewer can claim
from committed public/open data, including the official photogrammetric
surface, and which additions remain display approximations.

## Source hierarchy

- LoD2 geometry anchor: https://gdi.berlin.de/geonetwork/srv/api/records/3c7c49af-00a4-3bcd-bc00-20e7f0f1b7bf
  - Official metadata states that Berlin LoD2 footprints correspond to
    cadastral building outlines; roof forms are generalized standard
    roof forms.
- DOP orthophoto QA: https://gdi.berlin.de/geonetwork/srv/api/records/73a3de47-ab2a-4be2-ae5d-8d6f8fe5cc1c
  - Official DOP 2025 metadata gives 0.20 m ground resolution and
    approximately +/- 0.4 m positional accuracy.
- ALKIS parcel context: https://daten.berlin.de/datensaetze/alkis-berlin-flurstucke-wfs-1bc014d7
- Official textured surface: https://www.businesslocationcenter.de/en/economic-atlas/download-portal
  - The committed scene uses bounded geometry and aerial texture colour
    from the June 2025 Berlin survey.
- Official public-space details: https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23

## Committed LoD2 geometry statistics

- Buildings: 17091
- Polygon parts: 17108
- Total footprint area: 2540108.45 m²
- Footprint vertices rendered: 151548
- Median vertices per polygon: 5.0
- Interior rings / courtyards: 166
- Median segment length: 2.43 m
- Measured LoD2 heights: 17091 (100.0%)
- Explicit CityGML BuildingParts: 10626
- Segmented parent ensembles: 2012
- Latest source creation date: 2026-03-08

## Bundeskanzleramt scale check

- Official architecture reference: https://www.bundesregierung.de/breg-de/bundesregierung/bundeskanzleramt/geschichte-bundeskanzleramt-975040
- Rendered LoD2 parts: 31
- Measured part-height range: 6.85–41.277 m
- Measured median part height: 21.832 m
- Published nominal architecture: 18 m office rows; 36 m central cube.
- Rendering policy: preserve every LoD2 part and measured height; use
  published nominal dimensions as QA rather than flattening the ensemble.

## Landmark placement QA

- Status: review
- Landmarks checked: 87
- Relative relationships checked: 38
- Review count: 2

## Committed photogrammetric surface statistics

- Status: available
- Official source tiles: 26
- Interaction faces: 2599985
- Interaction vertices: 1377751
- Interaction GLB size: 29.9 MiB
- Settled desktop faces: 6623585
- Settled desktop vertices: 3464527
- Settled desktop GLB size: 79.1 MiB
- Settled per-tile target: 289797 faces
- Normal crease: 58.0°
- Simplification aggression: 5
- Separate high-detail hero groups: 4
- Complete scene: 74 GLBs / 174.3 MiB

## Current rendering claim

The viewer is metric in planimetric placement because it renders
EPSG:25833 LoD2/OSM/ALKIS geometries in metres. It now also renders
CityGML BuildingParts at their individual measured heights, LoD2
interior rings as visible courtyards/cut-outs, and uses denser
facade bays, roof ribs, and roof equipment marks from footprint size,
height, roof type, and landmark material cues. The official Berlin 3D
Mesh adds genuine photogrammetric roof, facade, ground and canopy relief
at unchanged EPSG:25833 scale, with a six-million-face settled tier.

Procedural monument, window, train, tunnel and architectural-signature
layers remain labelled display geometry. They are not surveyed facade,
interior or as-built detail and do not replace LoD2/official-mesh anchors.

## Tiergartentunnel precision claim

The Tiergartentunnel route is drawn as a visible underground
engineering cutaway using derived OpenStreetMap tunnel carriageway
geometry, public portal coordinates, public route descriptions and
published cross-section facts. Its rendered centreline and depth are
still an approximation, not official surveyed as-built geometry. See
[`tiergartentunnel-geometry.md`](tiergartentunnel-geometry.md).
