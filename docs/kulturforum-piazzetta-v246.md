# Gemäldegalerie and Piazzetta, v1.0.146

The Piazzetta no longer floats above its surroundings. The former 82 × 38 m
presentation wedge rose from world Y8.08 to Y13.48 in the wrong direction.
An unrelated generic extrusion also represented almost the whole square as a
closed 3 m building. Only that wedge and exact old prism `26444282` are replaced.
The complete forty-point source boundary (6,949.77 m²) remains in the new
surface, boundary walls and underground underside. The immutable source prism,
its hash and all 422 old native cell/low/high receipts are retained in the
v246 evidence record; higher café and museum columns are never claimed.

The official one-metre DGM supplies the actual relief. New paving is fused
upwards with the unchanged, coarser city terrain and raised by 9 cm to avoid
interpenetrating retained surfaces. Its drawn heights range from Y3.390 to
Y5.511. This is explicitly a conservative data fusion, not a claim that every
step tread or paving joint has been surveyed. Muted grey, warm grey and beige
granite fields recall the photographed square. Existing shared-foyer entrances,
all 234 official museum polygons, their rooflights, glazing, blind windows,
rusticated bases and prior details remain intact. The Gemäldegalerie gains
shallow pale sills under its 82 existing blind bays, emphasizing the quiet
stone facade without inventing new openings.

Both viewer navigation factories query the exact newly rendered top surface.
The parking footprint no longer becomes a solid obstacle. Nearby café and
museum footprints retain their obstacles. Drawn queries use the rendered
triangle planes; native queries use independently orthogonal two-metre cells,
rounded up to quarter-metre terrace heights. Equal-height adjacent cells are
losslessly merged into 329 runs. Native coverage conservatively keeps whole
cells inside the original boundary (6,376 m²); unclaimed thin boundary strips
retain the original terrain rather than introducing diagonal block faces.
No mobile detail reduction or new streaming descriptor is introduced.

## Evidence and credits

- [SMB, Gemäldegalerie profile](https://www.smb.museum/museen-einrichtungen/gemaeldegalerie/ueber-uns/profil/): Hilmer & Sattler's restrained, classically proportioned building above the rising Piazzetta.
- [BBR, Museum der 1000 Orte, Piazzetta](https://www.museum-der-1000-orte.de/bauwerke/bauwerk/piazzetta): Rolf Gutbrod, Heinz Mack's plaza treatment, multiple plateaus and stairs over underground parking, varied granite. Photograph © BBR / Cordia Schlegelmilch, 2012, visual reference only.
- [SMB, Kulturforum site plan](https://www.smb.museum/museen-einrichtungen/kulturforum/besuch-planen/lageplan/): the inspected exterior photograph `KF_Aussenansicht_03.jpg`, © Staatliche Museen zu Berlin / Maximilian Meisse, shows the inclined granite forecourt and common entrance. It was used as visual reference only, not traced as metric geometry.
- [SMB, Gemäldegalerie visitor plan](https://www.smb.museum/museen-einrichtungen/gemaeldegalerie/besuch-planen/lageplan/): explicitly identifies the Sigismundstraße entrance. The retained shared-foyer entrance is not mislabelled as that separate street entrance; no new street doorway is invented in this pass.
- [Official DGM1 tile 388_5818](https://gdi.berlin.de/data/dgm1/atom/DGM1_388_5818.zip): Geoportal Berlin, dl-de/zero-2-0, archive SHA256 `c70b223f4602baf5f4283e03e6c4d12948dcb7d4098754abc4d1ac08b1a1273e`. Only the bounded samples used by this square are retained. Coordinates use EPSG:25833 and world origin `[389500,5820000,30]`.
- [Official DOP 2025 spring service](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr): inspected at `[389080,5818820,389245,5818980]` for the square's relation to museums, stairs and café. No imagery is bundled. Existing OSM/LoD2 records and their attribution remain unchanged.
- The already credited Peter Kuley / Fridolin freudenfett photograph `TiergartenSigismundstraße-2.jpg` remains the reference for the gallery's blind stone bays and rusticated facade; sill dimensions are modest display estimates, not survey measurements.

Rebuild the bounded height/geometry data with
`uv run python scripts/build_kulturforum_piazzetta_v246.py`. The script requires
the retained DGM ZIP under the ignored raw directory and edits only the new
evidence/data files. It does not rewrite any source city packet or manifest.

## Validation and resource accounting

| Complete museum plus square layer | Draw calls | Instances | Geometry/instance bytes |
|---|---:|---:|---:|
| Drawn, desktop and mobile | 2 | 2,808 | 333,714 |
| Native, desktop and mobile | 1 | 19,636 | 1,492,696 |

The existing 700,000 / 1,500,000 byte test caps remain unchanged. Static runtime
JSON file is 49,057 bytes, including the exact old native receipts; no textures,
network request, extra draw call or manifest entry is added.

The three Python checks replay every new height against the retained official
samples and unchanged terrain, verify the full original boundary and museum
prisms, and replay all old native receipts against the actual voxel payload.
The four focused Bun checks compare more than 450 downward mesh rays with
walking heights in both representations, reject modified old-cell receipts,
and confirm the square is passable while both café obstacles remain. All eleven
existing museum tests and twenty-five expanded-city tests also pass unchanged.
Browser/release testing is handled by the combined v246 release review.

Useful review camera: eye `[-278,12,1110]`, target `[-348,4.7,1097]` from the
eastern street toward the shared entrance. Gallery facade: eye
`[-552,17,1137]`, target `[-525,11,1144]`.
