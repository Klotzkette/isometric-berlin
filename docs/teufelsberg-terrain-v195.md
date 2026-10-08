# Teufelsberg and Drachenberg terrain — v1.0.95

This step-10 terrain-packet refinement stays inside existing Grunewald coverage.
It replaces only the local elevation reading in world XZ
`[-9248, 1248, -7936, 2688]`. A separate, explicitly bounded source repair adds
647.26 m² of previously omitted mapped Drachenberg lawn and its crossing dirt
path; it does not enlarge the terrain packet scope or change old ground geometry.
Earlier source XZ courses, lake datums, unrelated terrain and the 93-place tour
remain retained. The original `grunewaldTerrainV190.json` is unchanged, with
SHA-256 `7e18c957243303e8c1ece2c990ed119192182164efa1c5b9fbe6f52b320d4902`.
Tests also retain independent old-height checkpoints around the local support,
at Karlsberg and near the Brücke-Museum.

## Measured field and display interpretation

The retained Geoportal Berlin ATKIS DGM1 archives
[DGM1_380_5816.zip](https://gdi.berlin.de/data/dgm1/atom/DGM1_380_5816.zip) and
[DGM1_380_5818.zip](https://gdi.berlin.de/data/dgm1/atom/DGM1_380_5818.zip)
provide official one-metre samples, licensed under
[dl-de/zero-2-0](https://www.govdata.de/dl-de/zero-2-0).
Their source URLs, XYZ members and SHA-256 digests are retained in
[`teufelsberg-terrain-v195.json`](../geo_data/regierungsviertel/teufelsberg-terrain-v195.json),
together with the derived field hash and measured eight-metre grid samples.
They are the same two archives already recorded by the v1.0.90 Grunewald evidence.
Raw archives remain gitignored reproduction inputs, not viewer assets.

The wider field uses eight-metre spacing. A 32 × 32 m crest window at
`[-8800, 2140, -8768, 2172]` uses one-metre spacing to retain the measured
Teufelsberg highpoint. Drawn surfaces use piecewise planar triangles with the
NW–SE diagonal. A 64 m transition apron joins the old field; the crest has its
own 8 m transition to the surrounding eight-metre field. These blended aprons
and interpolation between retained samples are display geometry, not additional
survey observations. Four-decimal stored offsets introduce at most 0.00005 m
rounding at the profile joins.

The world coordinate conversion is `easting = 389500 + x`,
`northing = 5820000 − z` in EPSG:25833. Display Y is NHN minus 30 m. Ground
offsets are NHN minus 33 m because the existing ground baseline is Y = 3 m.
The existing `terrainGroundAt` entry point reaches this local field through
the Grunewald sampler. Native mode samples each fixed eight-metre cell at its
centre and retains horizontal terraces; it does not claim one-metre summit
resolution.

| Location | Retained DGM evidence, NHN | Display field, NHN |
|---|---:|---:|
| Teufelsberg sampled highpoint, XZ `[-8783, 2157]` | 120.07 m | 120.07 m drawn; 118.79 m in its native cell |
| Teufelsberg OSM peak label, node `156850034` | 115.27 m at its source sample | 114.4961 m |
| Drachenberg OSM peak label, node `353075536` | 98.57 m at its source sample | 98.5492 m |
| Drachenberg nearby eight-metre sampled highpoint, XZ `[-8432, 1672]` | 98.72 m | 98.72 m |

The mapped labels and the sampled highpoints have different coordinates.
The retained source record distinguishes the district's published
[Teufelsberg height](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/berge/artikel.177406.php)
of 120.1 m and
[Drachenberg height](https://www.berlin.de/ba-charlottenburg-wilmersdorf/ueber-den-bezirk/freiflaechen/berge/artikel.1173608.php)
of 99 m from both label samples and interpolated display heights. No artificial
height boost is applied at either label. The local one-metre maximum is a
retained sampled highpoint, not a new geodetic determination of the entire hill.

## Delivery and preservation

Sixteen existing primary packet families are replayed with their eight retained
companions; no additional companion is introduced. The largest delivered asset
is 642,445 bytes compressed, and the largest decoded asset is 2,048,148 bytes,
below the existing 650,000 / 2,600,000 byte limits. Source triangles are
subdivided where the finer height planes require it. Source courses, colours,
rigid building and tree geometry and horizontal water levels remain represented;
terrain refinement does not change residency budgets or mobile quality.
The separate packet audit records preservation and allocation of every family.

This terrain pass uses no photographs, image textures or photographic meshes.
Listening-station recognition and illustrative kite fliers are separate models;
their architectural and animated display details are not DGM measurements.

## Exact omitted lawn and path repair

The older Grunewald scope selected mapped woodland and water with narrow
buffers. It left a 647.2579066 m² hole inside the complete 18,280.9811 m² mapped
Drachenberg lawn, [OSM way 15700939](https://www.openstreetmap.org/way/15700939).
The resulting pale wedge was recessed background paper, not an undraped terrain
face. This omission existed in both v1.0.89 and v1.0.94 source packets; one of
the four flier positions lay over it.

`build_drachenberg_lawn_v195.py` restores only that lawn polygon minus the exact
union of six earlier detailed coverage scopes. The patch has world bounds
`[-8414.441395, 1629.460599, -8345.525263, 1651.421131]`. Its complete source
rings, source/patch GeoJSON coordinates, old scope hashes and output/field hashes
are retained in
[`drachenberg-lawn-v195-evidence.json`](../geo_data/regierungsviertel/drachenberg-lawn-v195-evidence.json).
No old packet, surface or source scope is rewritten.

The retained crossing dirt path,
[OSM way 185585685](https://www.openstreetmap.org/way/185585685), contributes only
its 34.0040886 m² portion inside the missing polygon. Its source has no width
tag: the same inherited outline-generator rule supplies the explicitly estimated
2.2 m width and preserves the complete alignment. Lawn and path occupy separate
surface regions, at the existing Y = 3.01 and Y = 3.12 base levels respectively.
They follow the same measured field. Native mode uses matching eight-metre
terraces and vertical grid risers. The exact footprint also supplies walking
heights; points outside it receive no new navigation fallback.

The independent factory uses one static, texture-free mesh per mode: 104 vertices
and 107 triangles drawn, or 133 vertices and 145 triangles native, including
risers. Its local bounds are computed and transforms are frozen. The supplied
QA pose for the Drachenberg/kite view is camera `[-8318, 105, 1578]`, target
`[-8390, 86, 1632]`.

## Focused verification

```sh
uv run pytest tests/test_teufelsberg_field_v195.py
uv run pytest tests/test_drachenberg_lawn_v195.py
cd src/app && bun test tests/teufelsberg-terrain-v195.test.ts
```

The Python checks verify the field/evidence hashes, pinned source archive hashes,
unchanged earlier field, support bounds, datum, every profile-edge sample,
sampled highpoints, independent old-height checkpoints and native terraces.
Raw-archive checks skip only when the optional local source archives are absent;
the committed source-evidence and field-hash checks always run. The TypeScript
checks exercise the existing walking-height entry point, both planar grid
resolutions, joins between grid vertices, fixed native cells and old checkpoints.
Packet geometry and allocation have separate preservation tests.
The lawn tests additionally reconstruct the exact difference from retained source
rings and scope hashes, verify the inherited path width and alignment, compare
drawn/native coverage and heights, and exercise the actual static factory and
navigation helper through Bun.

An independent review identified that reusing the packet cache could read an
already split primary as an unsplit source and lose companion geometry. The
repaired generator keeps immutable inputs in `raw/teufelsberg-v195/unsplit-packets`
and verifies every compressed input hash and the field hash before reusing them.
A complete repeat replay produced identical output hashes. Packet replay safety
is checked separately from the field tests above.
