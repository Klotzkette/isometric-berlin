# Five eastern/northern district outlines — v1.0.100

The owner's explicit clarification adds exactly these OSM Ortsteile, not the
surrounding Bezirke:

| Ortsteil | OSM relation |
| --- | --- |
| Adlershof | 55756 |
| Niederschönhausen | 407652 |
| Alt-Hohenschönhausen | 409203 |
| Neu-Hohenschönhausen | 413420 |
| Oberschöneweide | 413421 |

The complete administrative source rings are retained in
`east-city-v200-districts.geojson`. Their union is 35.275521 km². Subtracting all
seven earlier documented scopes **and every actual v1.0.99 manifest footprint**
leaves 33.100176 km². The exact subtraction mask is committed separately as
`bounds-east-city-v200-retained.geojson`; the evidence records its predecessor
scope hashes and baseline manifest hash. Invalid centimetre-rounded historical
navigation rings are repaired with `make_valid` only for this subtraction union;
no older geometry, navigation, descriptor or source file is rewritten.

## Source and representation

- Berlin's complete intersecting LoD2 tile envelopes anchor 22,979 buildings.
  All 69 relevant archives have individual official download URLs and SHA-256
  hashes in the supplement's `source.lod2.tiles` receipt. Source:
  `https://gdi.berlin.de/data/a_lod2/atom/LoD2_<east>_<north>.zip`,
  Geoportal Berlin, dl-de/zero-2-0. Six archives reuse previous local caches;
  the remaining bounded archives were fetched without a citywide download.
- The retained Geofabrik Berlin PBF dated 2026-09-29 supplies full road courses,
  waters, parks, rails and 3,038 additional OSM building footprints where no
  official parent owns the area. OSM contributors, ODbL-1.0. Its existing
  source-priority rule prevents cadastral registration slivers from becoming
  invented extra houses.
- All 26,017 resolved source owners keep their complete rings and courtyard
  holes. LoD2 heights use the full parent vertical envelope. The 435 OSM
  additions with tagged height or levels retain that evidence; the remaining
  2,603 use explicitly recorded class estimates, mostly small sheds/outbuildings.
- Ordinary new outline terrain remains at viewer y=3 m, water at the retained
  outline datum −1.15 m. This is **not** a new districtwide elevation survey.
  The previously measured Schönhausen/Panke and other named park terrain is
  excluded intact; this change does not interpolate its relief into new streets.
- The drawn reading keeps original mapped courses and centimetre-serialized
  outline vertices. Minecraft is generated separately on the established 2 m
  orthogonal grid. No facade ornament, photo texture or detailed roof shape is
  inferred. Existing colours and untagged road widths are display estimates.
- The non-runtime `east-city-v200-source-owners.json.gz` and
  `east-city-v200-source-surfaces.json.gz` preserve complete double-precision WKB
  geometry before cell clipping. Their hashes are in `completeRingsReceipt`.
  The public source inventory additionally retains all 20,253 mapped road
  records, names and width evidence. No large source arrays enter app imports.

## Delivery and preservation

199 primary 512 m cells produce 398 separate drawn/native files with the
`east200-` prefix. No geometry companion is needed. Totals for both readings:

| Measure | Result |
| --- | ---: |
| Compressed runtime packet bytes | 57,070,292 |
| Largest compressed packet | 544,032 |
| Largest decoded packet | 2,124,836 |
| New-only navigation footprint pieces | 83 |

The existing 650,000-byte compressed / 2,600,000-byte decoded packet ceilings,
serial loading, resident budgets, full mobile geometry and 93-stop tour remain
unchanged. Buildings, parks, courtyards, water and railway voids are never filled
with invented blocks. This supplement is independent of the separately authored
A10/BER/Grünheide thin regional layer.

`scripts/build_east_city_v200.py` prepares source-derived packets and supports:

```sh
uv run python scripts/build_east_city_v200.py --scope
uv run python scripts/build_east_city_v200.py --build
uv run python scripts/build_east_city_v200.py --receipt --copy-assets
uv run pytest -q tests/test_east_city_v200.py
```

The retained PBF and the 69 hash-listed archives must be present under the
ignored raw cache. `--scope` runs against the retained pre-v200 manifest and
refuses an already integrated v200 base. `--copy-assets` validates and copies
only new packet assets; it never updates the master manifest. The root publisher
uses `merge_manifest(previous, supplement)` to append descriptors and footprint
parts while preserving every existing descriptor. The function refuses a
second append. Its input is `east-city-v200-manifest.json`.

## Validation and viewing

Focused tests independently compare every delivered drawn owner/height against
the complete pre-clipping source rings, and compare delivered water, roads,
bridges and total ground with their full resolved source polygons. Tolerances
account only for the existing centimetre serialization, not missing buildings.
They also verify exact five-relation scope, non-overlap, append-only integration,
all packet hashes/byte ceilings, separate native representation and named road
inventory. All old global preservation tests remain the publisher's independent
gate.

`east-city-v200-cameras.json` provides five source-interior street targets and
overview cameras, one per requested Ortsteil. Targets are verified against the
delivered new road navigation. These are QA poses, not additional tour stops.
The overview cameras intentionally show the requested coarse district reading;
they do not imply landmark-level detail or surveyed facade colour.
