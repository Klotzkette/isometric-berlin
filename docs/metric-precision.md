# Metric precision and surface-detail QA

This report documents what the current deterministic viewer can claim
from committed public/open data and how its metric recognition models
complement the official photogrammetric surface.

## Source hierarchy

- LoD2 geometry anchor: https://gdi.berlin.de/geonetwork/srv/api/records/3c7c49af-00a4-3bcd-bc00-20e7f0f1b7bf
  - Official metadata states that Berlin LoD2 footprints correspond to
    cadastral building outlines; roof forms are generalized standard
    roof forms.
- DOP orthophoto QA: https://gdi.berlin.de/geonetwork/srv/api/records/73a3de47-ab2a-4be2-ae5d-8d6f8fe5cc1c
  - Official DOP 2025 metadata gives 0.20 m ground resolution and
    approximately +/- 0.4 m positional accuracy.
- ALKIS parcel context: https://daten.berlin.de/datensaetze/alkis-berlin-flurstucke-wfs-1bc014d7
- Current textured surface: Berlin 3D Mesh Model 2025,
  https://www.businesslocationcenter.de/en/economic-atlas/download-portal
  - The bounded viewer keeps one Three.js unit equal to one metre and does not
    rescale the official EPSG:25833 source coordinates.

## Committed LoD2 geometry statistics

- Buildings: 3315
- Polygon parts: 3318
- Total footprint area: 307467.91 m²
- Footprint vertices rendered: 23555
- Median vertices per polygon: 4.0
- Interior rings / courtyards: 30
- Median segment length: 1.57 m
- Measured LoD2 heights: 3315 (100.0%)
- Explicit CityGML BuildingParts: 848
- Segmented parent ensembles: 142
- Latest source creation date: 2026-03-08

## Bundeskanzleramt scale check

- Official architecture reference: https://www.bundesregierung.de/breg-de/bundesregierung/bundeskanzleramt/geschichte-bundeskanzleramt-975040
- Rendered LoD2 parts: 31
- Measured part-height range: 6.85–41.277 m
- Measured median part height: 21.832 m
- Published nominal architecture: 18 m office rows; 36 m central cube.
- Rendering policy: preserve every LoD2 part and measured height; use
  published nominal dimensions as QA rather than flattening the ensemble.

## Hero recognition dimensions

The photogrammetric surface remains the visual evidence layer. Four small
procedural overlays add only the architectural dimensions and silhouettes that
are easily lost in aerial photogrammetry:

| Landmark | Metric recognition evidence |
| --- | --- |
| Reichstagsgebäude | 138 m by almost 100 m official plan dimensions, LoD2 body height and -1.676° local footprint axis, four corner towers and west portico; separate 40 m by 23.5 m Bundestag dome signature |
| Bundeskanzleramt | 342.676 x 102.074 m oriented LoD2 ensemble, -1.337° local axis and cube position; official 36 m central cube and 18 m office bands |
| Berlin Hauptbahnhof | LoD2 hall-centre anchor and 21.82° local track axis; Deutsche Bahn 321 m glass roof, 160 x 45 m crossing hall and 46 m office bridges |
| Brandenburger Tor | LoD2-derived 5.083° local axis; Berlin/visitBerlin 62.5 x 11 m plan, 20.3 m gate body, 26 m total height, 13.5 m columns in two rows of six |

These overlays are not substitutes for the source mesh. Their anchors and
local axes come from committed LoD2 geometry, they use metre units, and they
retain the photogrammetric texture beneath them. Presentation cameras target
the model anchors; the Chancellery target is offset to its central leadership
cube because the complete office ensemble is much wider than the recognisable
main building.

## Landmark placement QA

- Status: ok
- Landmarks checked: 39
- Relative relationships checked: 23
- Review count: 0

## Current rendering claim

The viewer is metric in planimetric placement because it renders EPSG:25833
LoD2/OSM/ALKIS geometries and the official Berlin 3D Mesh in metres. It renders
CityGML BuildingParts at individual measured heights, LoD2 interior rings as
visible courtyards/cut-outs, and preserves the official 2025 aerial texture and
surface relief. The recognition overlays above sharpen important forms but do
not claim surveyed facade details beyond their cited dimensions.

## Tiergartentunnel precision claim

The Tiergartentunnel route is drawn as a visible underground
engineering cutaway using derived OpenStreetMap tunnel carriageway
geometry, public portal coordinates, public route descriptions and
published cross-section facts. Its rendered centreline and depth are
still an approximation, not official surveyed as-built geometry. See
[`tiergartentunnel-geometry.md`](tiergartentunnel-geometry.md).
