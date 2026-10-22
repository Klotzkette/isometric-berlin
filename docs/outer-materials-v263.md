# Legacy-city ordinary-house materials — v263 / Step 10

The earlier v232 material pass covered `outer187`, `north190`, `east200` and
`marzahn230`; v254 added `ring182` and `city183`. Ordinary houses in older numeric
city packets could still carry the same generic paint despite retained mapped
facade and roof observations. This bounded pass closes that selection gap in
sixteen existing 512 m packets, without changing the fallback palette.

**449 additional ordinary owners in 15 packets** receive source-supported
materials. Their 30 drawn/native receipts occupy **25,536 bytes**, changing
**8,539 drawn and 12,399 native colour vertices** in existing buffers. The
sixteenth inspected packet has no eligible exact colour receipt. There are no
new geometric vertices, indices, GPU buffers, draw calls, textures, descriptors,
frame work, tour stops, coverage or residency allowance.

The fixed tile list is in `scripts/build_outer_materials_v263.py`; it samples
material-rich existing clusters in the Friedrichshain/Prenzlauer Berg and
Charlottenburg/Wilmersdorf/Schöneberg/Kreuzberg portions of the retained city.
Only `outer-materials-v232-context.json.gz` supplies the material observations:
complete mapped footprints and six colour/material tags, with no addresses or
occupant data. No new source fetch or citywide mesh rebuild is involved.

Every accepted source owner requires one unique reciprocal footprint match of
at least 97%, and exact original generic source wall/cap geometry. The compiler
must establish unanimous ownership for every incident triangle of a painted
vertex. Shared or uncertain vertices remain untouched. Original encoded
positions, colours and indices guard each runtime receipt, failing closed on a
changed packet. Complete matching packet hashes, OSM identifiers, original tags,
coverage ratios and protection receipts are retained in
`geo_data/regierungsviertel/outer-materials-v263-evidence.json.gz`.

Explicit unambiguous source colours win. Uncoloured material tags use the prior
documented material swatches; these tones and the inherited height-relative
wall wash are display estimates. Source-tagged grey facades stay grey, while
their mapped red/brown roofs and individual neighbouring cream, blue, rose,
ochre and brick surfaces no longer share generic paint. The retained mapped
observations are not a fresh photographic survey of all 449 houses. Conflicting
or unrecognised colour tags are never replaced with an inferred material colour.

The frozen v254 protected-owner audit is extended with all bounded intervening
v255–v262 runtime source records and v262 facade/roof evidence. Every earlier
material owner and authored facade/roof remains protected. Original packets,
source navigation, measured envelopes and open courts remain byte-identical.
The yielded existing v213/v232 writer changes only existing colour cells after
ordinary presentation paint; the native packets keep their independent geometry
and flat material reading. Full mobile detail is identical to desktop.

Attribution remains © OpenStreetMap contributors (ODbL 1.0) and Geoportal Berlin
LoD2 (dl-de/zero-2-0); no new photographic material or licence is involved.

The focused Python checks independently replay every surface receipt and full
footprint match, verify source hashes and colour priority, and exclude all prior
protected owners. Bun checks replay every drawn/native receipt, preserve source
and unrelated buffer cells, verify failure on changed source streams and replay
both families through the integrated production decoder. The release task runs
the final build, integration regressions and internal-browser review.

Validation: all three v263 Python checks pass; all nine Bun checks across
v232/v254/v263 pass, including the integrated decoder in both families. Scoped
Ruff format and lint are clean.

Source-colour review cameras (`eye` / `target`, world coordinates):

- Blue, cream and brick street fronts in packet `2_6`, including OSM ways
  `106765699`, `106765701` and `59464616`:
  `[1060,80,3345]` / `[1195,12,3245]`, span 220.
- Mapped rose/ochre and roof variation in packet `-3_6`, including OSM ways
  `147150019`, `145801566` and `31131433`:
  `[-1405,76,3315]` / `[-1285,12,3205]`, span 200.
- Retained warm facade and blue-grey roof at OSM way `24273521`, packet `7_-2`:
  `[3600,64,-660]` / `[3688.4,12,-754.51]`, span 150.
