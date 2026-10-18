# Fritz-Schloß-Park and Schönholzer Heide, v1.0.129

The audit separates the existing rendered ground from the source-height samplers. Fritz already has its measured hill: the retained v183 source reaches NHN53.29m; the actual drawn sixteen-metre ground interpolation reaches about worldY23.1m. Its late core lawn triangles are locally refined to four-metre edges, and its split ground backing stays below those lawns. That terrain is retained rather than exaggerated.

The existing Schönholzer Heide is wholly inside the v198 source addition; it is not an old flat district covered by a new proxy. Its thirty-two-metre terrain sampling nevertheless smooths the actual summit. At worldXZ[832,-6704], the retained official DGM1 records NHN54.84m. The old delivered field gives worldY22.345m; this update gives worldY24.84m. The correction is limited to the224m square[704,-6784,928,-6560] around this summit, further constrained by the complete original park boundary. A sixteen-metre transition retains the old terrain on the local boundary. Existing building footprints plus a sixteen-metre exclusion remain at exactly their old datum, and the cemetery, obelisk, palace, Panke and all other districts remain unchanged.

The eight-metre correction profile comes from the already retained official `DGM1_390_5826.zip`, not an invented hill. Source samples, weights, packet SHA256 receipts and counts are in `park-terrain-v229-evidence.json`. The old v183/v198 source files and construction packets remain byte-identical. `build_park_terrain_v229.py` replays the field and only the approved terrain changes. It keeps every original XZ vertex and all unrelated triangle indices/colors; source-selected ground/path faces receive additional sampling, never a second cover sheet. Thirty-three complete trees move rigidly with their ground anchor. Buildings are not bent, rescaled or replaced.

Native terrain retains its independently horizontal sixteen-metre terraces. Their heights, existing terrace skirts and tree anchors use the corrected field; the drawn renderer receives the finer eight-metre slopes. Full static detail is identical on touch devices. Changes apply inside `createNorthParksV198` before typed buffers, bounds, parking and upload. The existing compact navigation sampler uses the same correction. There are no new terrain draw calls or global budget changes. The construction patch is a weak local `cells` field; navigation retains only the5.3KiB height profile.

## Rodelbahn

The new visible grass slope uses exact OSM way121068797 (`name=Rodelbahn`, `piste:type=sled`, `surface=grass`). Its original polygon and tags are retained in `fritz-rodelbahn-v229-source.json`. It follows the long curve from the upper slope near[-1000,-1200] down towards[-1184,-1365]. There are no invented rails, concrete channel or artificial winter surface. The muted grass color is an illustrative recognition cue.

`build_fritz_rodelbahn_v229.py` retains a compact exact excerpt of the delivered ground-context samples. Drawn geometry preserves the complete mapped polygon with1021 terrain-following triangles. Native construction independently samples377 orthogonal four-metre cells. Its grass face has the normal small display lift used to keep overlapping source surfaces legible:0.15m drawn,0.09m native. Actual rendered-ground ray tests verify the slope stays above the existing lawn and backing, with more than12m of visible descent. Geometry/compact navigation together use46.1KiB JSON. The construction `models` field is weak and is not retained by navigation.

Factories and navigation:

- `createFritzRodelbahnV229(native=false)` adds the required full-detail grass slope.
- `fritzRodelbahnGroundAtV229(x,z,native=false)` returns its exact source-limited floor, otherwise null.
- `parkTerrainOffsetV229(x,z,native=false)` returns the finite summit correction, otherwise zero.

Tests cover the authoritative source replay, all retained building foundations, unchanged packet hashes and XZ/attributes, projected area conservation, source-exact piste footprint, actual drawn/native ground intersections, terrace slopes, and the unchanged memorial/outer boundaries. Browser inspection is coordinated by the release parent; no additional browser or build was launched by this subtask.
