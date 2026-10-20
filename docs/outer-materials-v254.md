# Retained ordinary-house materials — v254 / Step 10

The v232 material reader selected only `outer187`, `north190`, `east200` and
`marzahn230` packets. The already delivered `ring182` and `city183` families
therefore still showed generic paint even where the same retained OSM extract
contained explicit facade and roof observations. This incremental pass closes
that source-selection gap without rebuilding a building or changing a roof form.

The finite result covers **191 additional ordinary owners in 32 existing tiles**:
**3,781 drawn and 7,678 native colour vertices**, with **24,015 bytes** of runtime
receipts for 31 drawn and 29 native packets. This adds no geometry or GPU bytes.

The existing `outer-materials-v232-context.json.gz` is the only material input.
It retains full source footprints and six colour/material tags from the existing
OpenStreetMap extract, without addresses or occupant data. No source is downloaded
or expanded. Each accepted ordinary unnamed owner requires a unique complete
footprint match with at least 97% intersection coverage in both directions.
Every prior individually authored, facade and v233 measured-roof owner is protected,
as are all 92 v232 material owners. The actual selected owners and their source
tags, coverage, original packet hashes and old receipt hash are retained in
`geo_data/regierungsviertel/outer-materials-v254-evidence.json.gz`.
The evidence separately retains hashes for all 34 complete drawn match inputs,
including seam complements and tiles whose generic paint survives only natively.

Single unambiguous explicit colour tags take priority. Otherwise only the
established material swatches are used. These material hues and the existing
height-relative wall wash are display estimates. Conflicting or unrecognised
colours remain unchanged; a material does not override an ambiguous colour tag.
No district palette, window arrangement, entrance location, roof pitch or
architectural style is inferred.

The compiler reuses v232's exact wall/cap test: source height, boundary/roof
coverage, original generic paint and every incident triangle's ownership must
agree. The runtime helper reuses the validated, yielded v213 colour writer
through the v232 adapter. Each receipt binds the original encoded positions,
colours and indices; changed source streams fail closed. The new pass writes
only existing colour cells in the existing destination buffer, with no retained
decoded geometry, new buffer, draw call, descriptor, texture or animation.
The drawn detail remains equal on mobile and desktop; native packets retain
their independent orthogonal geometry and flat material interpretation.
Source envelopes, open courts, all roof geometry, previous details, navigation,
resident budgets, six modes, seven starting views and the 93-stop tour remain.
Seven selected owners already carry mapped v233 doors; their independent door
meshes remain exact while the underlying generic walls receive the mapped paint.

Attribution continues to use © OpenStreetMap contributors (ODbL 1.0) and
Geoportal Berlin LoD2 (dl-de/zero-2-0). No photograph or new licence is involved.

The focused checks replay every published receipt against its actual packet,
independently verify full reciprocal footprints and old-owner exclusion, guard
against changed source streams, preserve positions and unselected colour cells,
and exercise both families through the integrated decoder.

Validation: three new Python source/replay checks and three new Bun checks pass;
the four existing v232 Python and three v232 Bun regression checks also pass.
Scoped Ruff format and lint are clean. The parent release task handles the
complete suite, production build and browser review.

Source-colour review cameras (`eye` / `target`, world coordinates):

- Pale facade / blue-grey roof, OSM way `108647326`:
  `[5461.34,60,4618.95]` / `[5526.34,9,4553.95]`.
- Explicit yellow plaster / rose roof, OSM way `117976076`:
  `[585.91,60,5323]` / `[650.91,9,5258]`.
- Explicit yellow plaster / dark green roof, OSM way `218798628`:
  `[4141.56,60,4656.53]` / `[4206.56,9,4591.53]`.
