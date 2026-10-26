# Tiergarten Werkhof — source and geometry correction v275

The work compound at **Straße des 17. Juni 31**, OSM way **118034165**, is
represented as nine enclosed buildings and eleven open shelters, with its open
working yard retained. The former office-glass treatment and three implausible
source heights are retired only for the exact twenty receipted original owners.

## Evidence and its limits

The immutable evidence is
`geo_data/regierungsviertel/tiergarten-werkhof-v275-source.json.gz`
(SHA-256 `ffa49c4e836e72ca417cf4be727917a0e5546b6b35520b7f9f7c6be2c48fc583`).
It contains all **20 original complete LoD2 parents, 20 parts and 160 original
wall/roof surfaces**, the original measured heights and archive hashes, the exact
OSM compound, retained road/water exclusion features, the ALKIS function lookup,
and all **108 bDOM point queries with coordinates, complete URLs and returned
NHN values**. No original source polygon is overwritten.

Primary sources, retrieved 26 October 2026:

- [District SGA, Grünflächen](https://www.berlin.de/ba-mitte/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/), linked by the site's address record.
- [OSM way 118034165 full source](https://api.openstreetmap.org/api/0.6/way/118034165/full.json), version 9: exact fenced compound and public administration address.
- [Official LoD2 tile 388_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_388_5819.zip) and [389_5819](https://gdi.berlin.de/data/a_lod2/atom/LoD2_389_5819.zip), already retained locally. The selected parents report source creation 2 March 2026.
- [DOP 2025 spring WMS](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr): original 1,200 × 1,200 image over EPSG:25833 box `388920,5819420,389080,5819580`, layer `dop_2025`. Its exact request and image checksum are in the evidence. It shows low service/garage wings, red pitched roofs and surrounding woodland; it does not show office towers. The image is used as evidence, never as a runtime texture.
- [Official bDOM WMS](https://gdi.berlin.de/services/wms/bdom), `b_bdom`, `GetFeatureInfo`, EPSG:25833, 1 × 1 pixel/one-metre query. This is a surface model **including vegetation**, not a ground-only elevation survey. No acquisition year is inferred from its retrieval date.
- Retained `geo_data/regierungsviertel/buildings.gpkg`, SHA-256 `03d6c43bf4351728dc29ebcdb86b43c6f434df95e3c55615e4ad5e4de5e39573`: original `building_id`, `function`, `roof_type` and `measured_height_m` rows. Function **51009_1610 (Überdachung)** identifies eleven open shelters. Their LoD2 vertical closure faces must not be treated as opaque walls.

The world datum is **EPSG:25833 / metres NHN**:
`x = easting − 389500`, `z = 5820000 − northing`, `y = NHN − 30`.
The compound centre is `(389006.7399839343, 5819504.682049615)` UTM;
its exact mapped area is approximately 13,525.69 m².

## Three vertical corrections

All twenty original X/Z rings and roof plans are retained. Only the following
three owners receive a piecewise vertical remapping of their original surfaces;
the ground ordinate stays unchanged. Other seventeen original roof elevations,
including the large pitched-roof building and the complete south house roof,
remain unchanged.

| Full owner (prefix `DEBE01YY`) | Original height | Source ground NHN | Display roof NHN | Status |
|---|---:|---:|---:|---|
| K0002L8a | 21.060 m | 33.140 m | 35.850–35.950 m | Low roof supported by repeated bDOM interior samples. The exact 0.10 m shallow roof rise is a bounded rendering approximation. |
| K0003Txs | 24.015 m | 33.005 m | 35.200–35.340 m | Ten interior samples span 35.20–35.33 m. Shallow roof retains its source plan. |
| K0003VMG | 16.998 m | 32.712 m | 35.262–35.712 m | **Occluded height estimate**, 3.0 m overall. bDOM reads tree crowns; there is no claimed surveyed roof height here. ALKIS identifies an open shelter. |

Representative exact sample centres:

| Owner | Easting | Northing | Returned NHN | Interpretation |
|---|---:|---:|---:|---|
| K0002L8a | 389046.2845 | 5819481.0160 | 35.91 m | Roof centre, only 2.77 m above the source ground. Nearby roof-interior values are 35.85, 35.89 and 35.92 m. Higher edge samples are not averaged into roof height. |
| K0003Txs | 389047.46886273444 | 5819553.935181544 | 35.24 m | Low shelter, not the original 57.02 m NHN apex. |
| K0003VMG | 388938.79800687643 | 5819533.219670054 | 41.50 m | Tree-covered point. Other queries read 38.35–43.46 m; these do **not** establish the shelter height. |
| K0002KS2 | 388998.8260 | 5819485.7865 | 44.40 m | Large pitched roof is real and remains at original 44.842 m NHN ridge. |

Each sample's reproducible `GetFeatureInfo` request is stored beside its value.
The original source heights are therefore distinguishable from observed surface
samples and from the one explicit low-shelter estimate.

### Unresolved differences on retained small shelters

“Retained” does not mean every original height is independently confirmed.
Three unchanged small shelter owners have differences between the original
roof-plane interpolation and individual bDOM samples:

| Owner | Original roof interpolation NHN | bDOM NHN | Difference / location |
|---|---:|---:|---|
| K0003V9x | 39.798 m | 38.52 m | 1.278 m lower bDOM at footprint centre |
| K0003U1j | 40.350 m | 39.68 m | 0.670 m lower bDOM at footprint centre |
| K0003U1j | 39.758 m | 34.54 m | 5.218 m lower bDOM at the western roof-interior query |
| K0003UrX | 42.920 m | 39.79 m | 3.130 m lower bDOM at footprint centre; other queries differ by 0.365–3.463 m |

These are unresolved source differences, **not evidence that the original
heights are correct**. The bDOM acquisition date is not established here; its
one-metre sample support also matters at narrow projections and edges. The
points do not yet establish a reliable replacement roof plane. No additional
height is inferred: the original geometry of these three owners remains intact
and their uncertainty stays visible in the evidence and this note.

## Complete owner inventory

Every suffix below uses the full prefix `DEBE01YY`. Ground values are scene Y;
add 30 for NHN. “Open” means roof and separate posts, with a clear underside,
not an invented ground-to-roof wall.

| Owner | Ground Y | Original overall height | Representation |
|---|---:|---:|---|
| K0002Q8X | 3.520 | 8.756 | Enclosed, full pitched roof retained |
| K0002KS2 | 3.382 | 11.460 | Enclosed, large pitched roof retained |
| K0003V9x | 3.432 | 6.657 | Open |
| K0003U3m | 3.013 | 2.967 | Open |
| K0002RLM | 3.307 | 10.838 | Enclosed, full pitched roof retained |
| K0002QXE | 3.229 | 8.526 | Enclosed, full roof retained |
| K0003VKP | 2.668 | 3.337 | Open |
| K0003VMG | 2.712 | 16.998 | Open; corrected estimated height 3.000 m |
| K0002OAo | 3.005 | 2.370 | Enclosed |
| K0002L8a | 3.140 | 21.060 | Enclosed; corrected maximum height 2.810 m |
| K0002LWR | 2.996 | 2.890 | Enclosed |
| K0002MKq | 3.045 | 2.961 | Enclosed |
| K0003Txs | 3.005 | 24.015 | Open; corrected maximum height 2.335 m |
| K0003V3I | 3.045 | 2.689 | Open |
| K0002PgY | 2.827 | 4.303 | Enclosed |
| K0003U1j | 3.341 | 7.009 | Open |
| K0003V4T | 3.179 | 1.288 | Open |
| K0003U3h | 3.070 | 3.096 | Open |
| K0003UrX | 3.387 | 9.533 | Open |
| K0003Uow | 3.070 | 1.260 | Open |

## Fine details and plant cover

Small divided windows, modest garage doors, roof-edge gutters, 0.22 m posts,
roof skin thickness, wall paint and individual shrub shape are **recognition
estimates**, not photogrammetric facade measurements. Roof colours follow the
DOP's red versus muted service-roof families. Four proposed fitting elements
are explicitly omitted when their native geometry cannot clear the actual
stepped facade within the bounded 1.9 m limit; no source shell is omitted.

The 107 low shrub sites are inside the exact compound, within approximately
2 m of its boundary, outside building buffers and retained road/path/water
exclusions. The open working yard receives no vegetation cover. Road exclusion
widths are conservative display masks (3 m for paths, 5 m for other mapped
roads, plus one metre clearance); they are not claimed surveyed carriageways.
There is no attempt to conceal the old tall geometry with bushes.

The final drawn shrubs are procedural twenty-face crowns, merged into the
existing shell mesh. Native shrubs use three small orthogonal boxes wholly
inside each existing 1.7 m footprint and height. The shrub-only revision preserves
all prior architectural triangle bytes, every fitting, all navigation geometry,
and every clipped shrub centre/footprint/height. `architecturalTriangles` and
`estimatedShrubTriangles` are separately receipted.

### Final compound-wide native fitting clearance

The independent final review found 34 native gutter subsegments overlapping
neighbouring buildings because the first placement pass considered only the
current parent's native cells. The final generator pass now checks **all twenty
actual native volumes**, with the true underside of open roof slabs and all
81 post volumes. Native fitting rows are tested after their Float32 conversion,
with 0.15 mm additional arithmetic clearance.

Within the existing maximum 1.9 m outward fitting bound, 21 subsegments are
repositioned; 19 still-occluded estimate subsegments are omitted. This includes
six conservative near-boundary cases in addition to the 34 observed overlaps.
All other 2,129 native detail rows are byte-identical. The complete measured
source, every drawn position/colour/fitting array, all twenty part records,
native body/roof cells, post profiles, shrub sites and exclusion masks are
byte-identical to the pre-fix model. In particular an invalid short native
subsegment does not remove a whole visible gutter or its drawn counterpart.

The exact before/after replay proof is
`/Users/klotzkette/.cache/codex-berlin-v275/werkhof-global-clearance-delta.json`;
`nativeFittingRepairs` in the generated data retains the individual bounded
repair receipts. Runtime SHA-256 changes from
`fcb1fb21f1f05846adf20d891352ee1ca3df9c36a803296d23eafed84a881c75` to
`25f95c3912836b3f148232fce23f0ad4091d7bba63dbe935924361704e98651d`.
The new independent regression was observed failing before the fix with
34 unique boxes / 39 cell overlaps; its log is
`/Users/klotzkette/.cache/codex-berlin-v275/pytest-werkhof-clearance-before.log`.

## Runtime, navigation and bounded cost

- `TiergartenWerkhofV275.ts`: `createTiergartenWerkhofV275(native, options?)`.
- `tiergartenWerkhofV275Profile.ts`: `tiergartenWerkhofSolidsV275(native)`.
- `TiergartenWerkhofV275Data.ts`: finite data and counts only.
- Required-site construction attaches the complete compound as its **first
  atomic group before yielding**. Mobile receives identical detail.
- Drawn uses the retained triangles and two batches. Native is independently
  orthogonal: occupied one-metre roof-plan cells, 0.25 m roof stepping, separate
  surface fittings and posts, one batch.
- Navigation uses actual triangular roof height in drawn mode and exact occupied
  native cells in native mode. Cell-union holes remain empty; no bounding-box
  infill substitutes for roofs. The eleven open shelters use **local**
  `bottomAt(x,z) = topAt(x,z) − 0.22 m` drawn, or `−0.25 m` native, with 81
  separate post solids. Sloping roof airspace is not filled by a thick wedge.
- No textures, animation, per-frame geometry, new geographic coverage or lower
  mobile detail are introduced.

Final counts: **20 parents, 160 original source surfaces; 369 architectural
triangles plus 2,140 estimated shrub triangles; 520 drawn detail boxes; 2,987
native roof/body cells; 2,150 native detail boxes; 7,171 native instances**.
Actual allocated geometry, index, colour, normal and instance buffers total
**311,140 bytes drawn / 545,644 bytes native**. Runtime
JSON is 370,014 bytes (73,145 bytes gzip); immutable source gzip is 14,161 bytes.
The model's scene bounds are approximately X −579.55…−421.07, Z 431.46…575.82,
Y 2.668…14.842 (drawn) / 15.0 (native).

The four packed mesh-string fields use the existing finite lossless build
encoder. The two fields below 64 KiB (`drawnColors`, `drawnDetails`) remain
direct literals; larger fields decode once into strongly retained strings.
The unchanged full JSON, every decoded mesh byte and navigation object identity
are verified. No geometry, colour, detail or mobile quality is reduced to save
download space.

Reproduction is offline:

```sh
uv run --no-sync python -m scripts.build_tiergarten_werkhof_v275
```

The final independent focused validation passed after the compound-wide
gutter clearance fix:

- `tests/test_tiergarten_werkhof_v275.py`: **6 passed in 0.88 s**, including all
  twenty full official ZIP parents, ALKIS function replay, 108 bDOM receipts,
  unchanged house roofs, native coverage, planting masks, deterministic rebuild
  and independent all-owner fitting clearance.
  Log: `/Users/klotzkette/.cache/codex-berlin-v275/pytest-werkhof-clearance-followup.log`.
- `src/app/tests/tiergarten-werkhof-v275.test.ts`: **7 passed, 0 failed,
  289,135 assertions in 6.86 s**, including real required-owner construction,
  local canopy undersides, actual native matrices, and identical full mobile
  geometry/material hashes.
  Log: `/Users/klotzkette/.cache/codex-berlin-v275/bun-werkhof-clearance-followup.log`.

These tests cover this model family; they are not browser endurance evidence.
Exact ownership retirement has separate tests. Overall build, full-suite and
release verification are recorded by the release coordinator. The actual model
was inspected in the internal browser; no external Safari process was opened.

## Existing generic paint ownership

`K0002RLM` is the **only** owner removed from the previous 7,174 generic core
colour receipts, because its complete architecture now belongs to this named
compound. The other **7,173 rows remain byte-equivalent**. Historical constructor
hashes remain preserved; replay tests normalize exactly the two added retirement
hooks. The before/after proof is
`~/.cache/codex-berlin-v275/core-v273-retirement-v275.json`:

- Previous runtime SHA-256: `1ed91298a40445767a37972f870a8dfa1f87b5b28053eec63ab68778452a630d`.
- New runtime SHA-256: `4f6384565300fbc08a4c1333d3300fd9fedd0b93532c545b225530ad6a8f5461`.
- Final refreshed evidence SHA-256: `cdb3c5f88f149d662ae9bd37c9146a5e49fdc2abd62f2926b017dffeaab4297c`.
  The proof retains the original baselines and final authored-protection file
  hashes, including the bounded shrub and final compound-wide gutter revisions.
  The earlier shrub-freeze evidence hash is preserved in the replay proof.

This is a finite ownership correction, not a city-wide relaxation of authored
building protection or a recolouring of neighbouring houses.

## Publication verification

Version **1.0.175** is published from source commit
`e704caa7f472826677015d345a35bb5f7b4d6a4c`, with Pages commit
`d060a48b4ac3c020d7ae95d20a8ad61d92573291`. The completed Pages workflow and
ten exact hosted-file checks passed. Both downloadable archives passed the
complete existing validators and their uploaded sizes and SHA-256 digests match.
The extracted package is 931,672,320 bytes; the deployed tree, including both
previous live asset closures, is 1,040,525,287 bytes, below the unchanged limits.

The main Python collection completed with 1,978 passed, four skipped and one
model-replay failure from the concurrent final model correction. The complete
affected six-test file then passed against the frozen model; the separate
80-test release-readiness file also passed. These overlapping runs are not
summed or presented as a single green full-suite run. Final TypeScript, Ruff,
production build and local-package HTTP checks passed. Earlier failures and
their explicit rechecks are retained in
[`tiergarten-werkhof-v275-verification.json`](tiergarten-werkhof-v275-verification.json).
Browser evidence covers the isolated actual model in both render modes, not a
whole-city or iPhone endurance test.
