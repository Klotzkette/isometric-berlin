# Weinbergspark and Zionskirche elevation evidence

Pipeline step 4, acquired 2026-10-03. `dgm-samples.json` is a 161 × 161
subset at 10 m spacing of the official Berlin ATKIS DGM1, covering viewer
x=1600.5–3200.5 and z=−2600.5–−1000.5. It is source evidence; no scene
transition or display exaggeration is applied. The intended terrain correction
centres on Weinbergsweg, Weinbergspark and Zionskirche. The wider evidence
apron also includes the beginning of Pappelallee.

Source: [Geoportal Berlin DGM1 ATOM](https://gdi.berlin.de/data/dgm1/atom/).
Four 2 km tiles, `390_5820`, `390_5822`, `392_5820`, `392_5822`, were fetched
as XYZ ZIP files (~72 MB total) into the ignored `raw/dgm/weinberg-v176/`
directory. The small derivative records the exact URLs, archive SHA-256s,
archive sizes and members. `scripts/build_weinberg_dgm_samples.py` checks
those hashes and all 16 million original coordinates before deriving the
subset. Raw archives are not published.

The [official dataset catalogue](https://daten.berlin.de/datensaetze/atkis-dgm-digitales-gelandemodell-wms-b0485f06)
licenses the bare-earth 1 m raster under **dl-de/zero-2-0**. The
[official technical description](https://www.berlin.de/sen/stadt/stadtdaten/geoinformation/landesvermessung/geotopographie-atkis/dgm-digitale-gelaendemodelle/)
specifies EPSG:25833 and **DHHN2016 / NHN (EPSG:7837)**. Source metadata lists
ALS acquisition on 24/25 February and 2 March 2021, with photogrammetric
updates from flights in March 2022, April 2023, March 2025 and August 2025.
These are dataset dates, not individual cell acquisition dates.

The original cell centres have half-metre coordinates. `heightsNHN[z][x]`
retains every tenth original sample, including the source's 0.01 m storage
precision, without interpolation. Viewer x=E−389500, z=5820000−N; absolute
terrain y=NHN−30. The centimetre storage precision is not a survey-accuracy
claim. A 10 m subset omits smaller steps and terrain detail. DGM values inside
buildings represent modelled bare-earth terrain, not measured floors.

Selected direct 1 m samples (nearest source centre to retained OSM/LoD2
anchors) establish the hill:

| Location | NHN, m | Viewer y at NHN−30, m |
|---|---:|---:|
| Rosenthaler Platz | 37.12 | 7.12 |
| Lower Weinbergsweg | 37.53 | 7.53 |
| Middle Weinbergsweg | 41.88 | 11.88 |
| Weinbergsweg / Kastanienallee | 48.50 | 18.50 |
| Weinbergspark centre | 44.38 | 14.38 |
| Blue playground | 50.62 | 20.62 |
| Zionskirche centroid | 53.52 | 23.52 |
| Former Café 103 building centroid | 51.50 | 21.50 |
| Beginning of Pappelallee | 49.41 | 19.41 |

Rosenthaler Platz to the church sample rises **16.40 m**. The retained LoD2
church ground is 53.332 m NHN; its 0.188 m difference from the centroid DGM
sample is retained as a source distinction. Keep rigid building geometry on
its own LoD2 ground datum. The road along the park is Weinbergsweg, continuing
north as Kastanienallee. Pappelallee begins beyond the Schönhauser
Allee / Eberswalder Straße / Danziger Straße crossing, as recorded by the
retained OSM road network. The data does not support a continuous uphill
slope from the church along the rest of Kastanienallee.

Validation: four focused tests cover tile-boundary ownership, reversed
northing/viewer-z orientation, half-metre sampling, datum/source hashes and
the measured park/church height contrast. The entire evidence rectangle is
inside the committed release bounds.

## Local model placement

The v176 runtime separately limits its terrain correction and transition to
the approved Weinbergspark/Zion support, preserving the original core.
V166 building skins and roof queries use the shared measured parent offsets;
unaffected parents retain their original data. The church's v174 detail group
receives the same rigid parent translation, preserving its 67 m silhouette.
The four v175 frontages use their retained official footprint owners. Their
source geometry arrays are unchanged; their evidence adds only ownership
footprints, NHN heights and query anchors.

Ground sheets retain their exact horizontal coverage and are subdivided onto
the common terrain planes. Native rows retain the original occupied area and
are split at the common 4 m terrace boundaries. Source native building runs
are split only where adjacent parent shifts differ. Trees and furniture move
as whole objects, and the original `p.y === 3` eligibility test for additional
OSM trees remains unchanged. Heine moves as a rigid monument; Jandorf's crown
and facade ornament use the shell's parent shift; Elisabeth stays unchanged.

The park pond and Plansche are horizontal water surfaces at viewer y=6.315 m
and 12.415 m in both representations. These are coordinated display levels,
not surveyed water levels. Existing mapped water footprints are preserved.
Seven additional Bun tests check every V166 source vertex, rendered roof/query
agreement, native occupied volume, playground area and terrain alignment,
church/frontage translation, and horizontal water in both representations.
The exact Plansche basin does not overlap any non-water drawn V166 ground
sheet. Its native raster boundary nevertheless overlaps 54 non-water source
rows by 9.4197 m². Only intersecting quarter-metre pieces are lowered so their
tops remain at or below the 12.40 m basin floor. Their full horizontal area,
colour and solid volume are retained; a boundary-probe regression prevents
native path/edging blocks from covering the water.
