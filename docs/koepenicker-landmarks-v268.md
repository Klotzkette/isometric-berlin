# Heeresbäckerei — v268

This bounded Köpenicker Straße continuation reconstructs the main Heeresbäckerei at **Köpenicker Straße 16–17**, exact LoD2 parent **DEBE02YY400000KE**, OSM **way/37544845**. Its complete footprint is `[4202.47,1610.51,4308.71,1663.32]`, within the existing **8_3** packet. No Späthhöfe, vanished grain store/mill or nearby Spindler/Klatt owner is included. Ordinary street refinements explicitly exclude this owner.

## Sources and recognition

The [Landesdenkmalamt entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031093,T) describes yellow clinker, red-clinker and sandstone cornices, the stepped three/four-storey wings, the hinge-like corner and the upper storage lunettes. [visitBerlin](https://www.visitberlin.de/de/heeresbaeckerei) corroborates the identity and materials; its illustrations are credited to **Helmchen Event + Location** and remain external references.

The independently viewed street photograph is [Jörg Zägel, Berlin-Kreuzberg, Koepenicker Strasse 16-17, Heeresbaeckerei](https://commons.wikimedia.org/wiki/File:Berlin-Kreuzberg,_Koepenicker_Strasse_16-17,_Heeresbaeckerei.jpg), **1 May 2012**, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). It informs the yellow/red masonry, small blind-arcade frieze, cornices, segmental windows and upper lunettes. No photograph pixels, signs, graffiti or people are bundled.

All **11 original LoD2 parts and 97 wall/roof sheets** are retained unchanged in the evidence. Every original triangulated sheet is present in the drawn replacement, including every measured roof and stepback. Source ground **4.193 m** is translated rigidly by **−1.193 m** to the delivered **y=3** ground shared by both immutable 8_3 packets; the site lies outside the resident terrain raster. XZ rings, holes and all relative heights remain exact. LoD2 is Land Berlin/Geoportal Berlin, **dl-de/zero-2-0**; retained OpenStreetMap identity is © OpenStreetMap contributors, **ODbL-1.0**.

The facade treatment follows **31 true exterior source sheets**. Clinker colours, bay layout, metal dividers, narrow cornices and shallow fittings are photo-guided display estimates, not measured facade openings. The model includes 206 segmental window units, 28 upper lunettes and 292 small blind-arcade units. It introduces no traversable entrance or interior. The four chimney stumps mentioned by the heritage source are not used to invent extra height beyond the complete measured massing.

## Exact replacement and navigation

The earlier source owner was a single flat prism reaching **y=23.27**. It concealed the actual roof hierarchy, whose parts range down to **y=12.541**. Exact position/colour reconstruction receipts retire only **184 drawn triangles and 65 top-ink segments**, or **514 native triangles**. Every original source buffer remains immutable; unrelated triangle/line complements and navigation owners remain unchanged. Prior appearance, facade, door and roof datasets were checked for the complete owner ID; no earlier authored owner was found.

The complete replacement is admitted before any source index yields. Source mesh, line, navigation and replacement fingerprints guard the transaction. A mismatch or unchanged budget limit rejects the whole operation. Existing packet cancellation, lifetime, disposal and eviction serve the replacement; it creates no independent scene root or coverage.

Drawn navigation contains **30 polygons**: flat roofs use exact measured heights, and sloped roofs use at most **0.10 m** height strips with the existing centimetre XZ packet rounding. Native is independently constructed on a global **0.5 m cardinal grid**, with **9,395 occupied cells** merged into roof plates and exposed wall strips. Its **86 navigation polygons** follow those represented heights exactly. Holes and stepbacks remain open; facade ornaments do not claim entrances through the solid owner.

The packed addition has **15,063 drawn triangles** or **24,062 native triangles**, including respectively **271** complete source-sheet triangles and **3,922** independent cardinal shell triangles. Both families together occupy **1,386,768 bytes** of runtime module data; one added mesh is decoded only for the selected family. Full drawn mobile detail is identical. Existing 16-mesh, 400,000-vertex, 2,400,000-index guards and all residency/decode/prefetch limits remain unchanged.

## Integration and checks

`KoepenickerLandmarksV268.ts` exports the packet preparer `prepareKoepenickerLandmarksV268`, exact decoded transfer hooks `applyKoepenickerLandmarksV268Triangles` / `applyKoepenickerLandmarksV268Lines`, and `koepenickerLandmarksNavigationV268`. Root integrates them in `SurroundingCityGeometry.ts`, after earlier immutable preparations. No shared file was edited by this subtask.

Four focused Python tests pass: all 97 source sheets and complete footprints, unchanged SHA256 inputs/exact receipts, independent cardinal native geometry and ground, plus measured roof-height and footprint agreement across both families. Three Bun tests pass (**77 assertions**), covering guarded atomic preparation, exact unrelated complements, both production decoder modes, and real streamed ground/roads/building navigation through a drawn → native → drawn mode change. The street route `[4224,1668] → [4252,1688]` remains walkable without respawn or an artificial height jump. Ruff passes. No browser or compiler was run by this subtask.

Numerical QA checked central eye-to-target rays against 41 actual nearby source owners; these views clear unrelated buildings. Root has additionally viewed drawn and native 8_3 plus district188-8_3 context in IAB and confirmed stepped roofs, arched facades and active 184/514 transfers. Final visual/release acceptance remains root-owned.

| View | Eye | Target |
|---|---|---|
| Corner | `[4294,37,1702]` | `[4258,12,1648]` |
| Near corner | `[4276,25,1679]` | `[4255,12,1650]` |
| Street front | `[4203,29,1682]` | `[4231,12,1640]` |
| Complete roof | `[4340,85,1730]` | `[4256,12,1637]` |

Reproduce with `uv run --no-sync python scripts/build_koepenicker_landmarks_v268.py`. Complete source, original-owner geometry, input hashes, exact receipts, fitting roles, source fronts, provenance and estimates are retained in `geo_data/regierungsviertel/koepenicker-landmarks-v268-evidence.json.gz`.
