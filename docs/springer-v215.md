# Zentrales Springergebäude — v215

The additional modern building is interpreted as **Zentrales Springergebäude**,
OSM way `1282540270`, about 104 m northeast of Golda-Meir-Steg. The owner was
told this interpretation; the clarification had no answer. This is a single
building correction, without additional district coverage or a tour stop.

The current named OSM footprint has two wide projecting stair cores. The older
LoD2 parent `DEBE01YYK0000Eik`, prism `K0000Eik`, has a footprint date of
11 October 2017 and smaller projections. Their overlap does not make them the
same current envelope. The new body uses the complete current OSM polygon,
833.221 m², rather than retaining the predecessor's narrower cores.

## Sources and limits

- OpenStreetMap way [1282540270](https://www.openstreetmap.org/way/1282540270),
  from the retained 29 September 2026 Geofabrik extract and its indexed
  `outer-v159/candidate.gpkg` cache: current footprint, name, office use and six
  levels. © OpenStreetMap contributors, ODbL 1.0.
- The complete earlier Geoportal Berlin LoD2 source record, including all 24
  surfaces (ground included), vertical registration, source polygon IDs and
  legacy prism, remains in `springer-v215-source.json.gz`. Its original source
  sheet and every original drawn/native packet are unchanged. dl-de/zero-2-0.
- [Official Berlin bDOM](https://gdi.berlin.de/services/wms/bdom), layer `b_bdom`:
  nine bounded one-metre GetFeatureInfo samples are retained separately in
  `springer-v215-bdom.json`. Five main-roof samples range from 59.08 to 59.28 m
  NHN, with median 59.25. Applying the retained local datum gives display
  `y=27.52 m`. This is an upper-roof reference level, not a new parapet survey.
- [Official spring 2025 orthophoto](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr),
  layer `dop_2025`, inspected extent EPSG:25833
  `[389340,5821650,389650,5821900]`: current footprint, flat roof and photovoltaic
  fields. Geoportal Berlin, dl-de/zero-2-0. No raster ships.
- [Kalzip's project article, 21 February 2025](https://www.kalzip.com/news/baustelle-der-woche-springergebaeude-bundeswehrkrankenhaus-berlin/)
  identifies the temporary administration/archive/training building and aluminium
  FC facade. Its [4 November 2024 construction photograph](https://www.kalzip.com/wp-content/uploads/2025/02/YDRAY-20241104_091742-scaled-3.jpeg)
  was inspected: white horizontal metal bands, anthracite window ribbons and
  projecting stair cores, paired lime-green stair-window surrounds and entrance
  accents. Credit Kalzip GmbH; photographer not stated. Copyrighted reference
  only: the photograph is neither bundled nor used as a texture.

Opening counts, pane spacing, metal seams, colour swatches and PV field
boundaries are reference-based presentation estimates. The metric footprint,
six tagged levels and roof-height evidence stay separate from those estimates.
No hidden interiors, additional hospital equipment or signs are invented.

## Exact ownership and runtime

The complete obsolete owner is transferred by immutable packet fingerprints
and exact indices: 3,140 triangles across the prior shell, generic facade and
native representation, plus 60 ink segments. Six shared edge signatures remain
available to unchanged neighbours. The original data are not rewritten.

The replacement packet is required in the Alt-Mitte publication transaction.
It is not also added to OutlineLandmarks. The existing coarse-voxel removal
predicate keeps the predecessor's prism footprint, so removed coarse columns
cannot reappear. The physical collision part instead receives the current OSM
footprint. Drawn roof queries include the low PV fields; native queries use only
compact actual roof-cell metadata, including removed predecessor-only cells.

| Representation | Triangles | Meshes | GPU attributes and indices |
|---|---:|---:|---:|
| Drawn | 1,206 | 1 | 36,084 bytes |
| Minecraft | 9,206 | 1 | 178,248 bytes |

All drawn input profiles use identical buffers. Minecraft is an independent
one-metre surface-cell model with orthogonal faces and no solid interior fill.
Both modes are texture-free. Runtime construction uses the existing bounded
packet decoder and its cancellation/disposal path.

The standalone inspection factory is `createSpringerV215(native = false)`.
Production uses the identical `springerV215Drawn.json` or
`springerV215Minecraft.json` packet. Navigation exports are
`correctedSpringerPartsV215(parts)` and
`correctedSpringerRoofAtV215(x, z, native, original)`.
The anchor is approximately `[-92.859, 5.2, -1716.260]`.
Suggested facade camera: position `[-160,43,-1795]`, target `[-94,16,-1717]`.

## Focused verification

Six Python tests and three Bun tests verify source hashes, exact scope, both
full-width stair fronts, exterior-fitting placement, preserved neighbour ink,
actual native roof faces, removal/addition of collision areas, reproducible
buffers and exact GPU budgets. Geometry, ownership and navigation generation
reproduce byte for byte. Root supplies full-scene visual and release checks.

```sh
PYTHONPATH=scripts:. uv run python scripts/build_springer_v215.py
uv run ruff check scripts/build_springer_v215.py tests/test_springer_v215.py
uv run pytest tests/test_springer_v215.py -q
cd src/app
bun test tests/springer-v215.test.ts
```
