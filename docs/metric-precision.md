# Metric precision and surface-detail QA

This report documents what the current deterministic viewer can claim
from committed public/open data and which additions remain display
approximations.

## Source hierarchy

- LoD2 geometry anchor: https://gdi.berlin.de/geonetwork/srv/api/records/3c7c49af-00a4-3bcd-bc00-20e7f0f1b7bf
  - Official metadata states that Berlin LoD2 footprints correspond to
    cadastral building outlines; roof forms are generalized standard
    roof forms.
- DOP orthophoto QA: https://gdi.berlin.de/geonetwork/srv/api/records/73a3de47-ab2a-4be2-ae5d-8d6f8fe5cc1c
  - Official DOP 2025 metadata gives 0.20 m ground resolution and
    approximately +/- 0.4 m positional accuracy.
- ALKIS parcel context: https://daten.berlin.de/datensaetze/alkis-berlin-flurstucke-wfs-1bc014d7
- Optional archival textured-surface QA: https://www.businesslocationcenter.de/en/economic-atlas/download-portal
  - The current release does not bundle or render this legacy surface.
- Official public-space details: https://daten.berlin.de/datensaetze/baumbestand-berlin-wfs-48ad3a23

## Committed LoD2 geometry statistics

- Official source building features audited: 17091
- Current source features after documented corrections: 29928
- Documented historical/demolished features excluded: 0
- Polygon parts: 29969
- Total footprint area: 8535780.71 m²
- Current source footprint vertices audited: 323472
- Median vertices per polygon: 7
- Interior rings / courtyards: 676
- Median segment length: 3.24 m
- Measured LoD2 heights: 29928 (100.0%)
- Explicit CityGML BuildingParts: 10607
- Segmented parent ensembles: 2011
- Latest source creation date: 2026-03-08
- Invalid / empty / outside-bounds geometries: 0 / 0 / 0
- Full source invalid / empty / outside-bounds geometries: 0 / 0 / 0
- Drawn-prism coverage status: ok
- Drawn LoD2 prisms: 29818 parts from 29797 current source rows
- Non-extruded source rows / parts: 131 / 151
  - Sub-5 cm flat rows: 4
  - Degenerate non-flat parts: 147 (maximum footprint 1.132 m²)

## Complete street and bridge geometry audit

- Status: ok
- OSM road features audited: 41886
- Supported road centrelines rendered: 39581
- Resolved full widths: 39581
- Width evidence: {'width': 4603, 'est_width': 13, 'lanes': 4151, 'class_fallback': 30814}
- OSM bridge centrelines audited: 785
  - Road/path bridges: 431
  - Rail bridges/viaduct lines: 354
- Named bridge centrelines: 374
- Rendered water-crossing groups: 123 (64 narrow groups retained)
- Road invalid / empty / outside-bounds geometries: 0 / 0 / 0
- Bridge invalid / empty / outside-bounds geometries: 0 / 0 / 0
- Width policy: width > est_width > mapped lanes > highway-class fallback

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
- Landmarks checked: 93
- Relative relationships checked: 41
- Review count: 3

## Retired photogrammetric surface inventory

- Status: unavailable
- Reason: retired_from_release
- Official source tiles: n/a
- Interaction faces: n/a
- Interaction vertices: n/a
- Interaction GLB size: 0.0 MiB
- Settled desktop faces: n/a
- Settled desktop vertices: n/a
- Settled desktop GLB size: 0.0 MiB
- Settled per-tile target: n/a faces
- Normal crease: n/a°
- Simplification aggression: n/a
- Separate high-detail hero groups: n/a
- Complete scene: 0 GLBs / 0.0 MiB

## Current rendering claim

The viewer is metric in planimetric placement because it renders
EPSG:25833 LoD2/OSM/ALKIS geometries in metres. It now also renders
all drawable CityGML BuildingParts at their individual measured
heights, while the report above exposes sub-5 cm flats and tiny
degenerate source slivers that are retained in the GeoPackage but not
extruded. It preserves LoD2 interior rings as visible
courtyards/cut-outs and uses denser
facade bays, roof ribs, and roof equipment marks from footprint size,
height, roof type, and landmark material cues. The lightweight current
scene is derived from retained LoD2, OSM and Geoportal source payloads;
the former Berlin 3D Mesh files are not shipped or decoded at runtime.

Procedural monument, window, train, tunnel and architectural-signature
layers remain labelled display geometry. They are not surveyed facade,
interior or as-built detail and do not replace the LoD2 geometry anchor.

## Tiergartentunnel precision claim

The Tiergartentunnel route is drawn as a visible underground
engineering cutaway using derived OpenStreetMap tunnel carriageway
geometry, public portal coordinates, public route descriptions and
published cross-section facts. Its rendered centreline and depth are
still an approximation, not official surveyed as-built geometry. See
[`tiergartentunnel-geometry.md`](tiergartentunnel-geometry.md).
