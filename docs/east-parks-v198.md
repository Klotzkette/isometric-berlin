# Eastern parks and Köpenick, v1.0.98

This additive pass preserves every v1.0.87 Köpenick/Tierpark source payload byte for byte. It introduces the exact named Treptower Park boundary (OSM way/4685998), subtracting the already published city scopes before adding ordinary ground/building context. The new scope is stored as CRS84 in `geo_data/regierungsviertel/east-parks-v198-scope.geojson`. No unrelated city coverage is regenerated.

## Source and interpretation

`build_east_parks_v198.py` reads the retained `berlin-260929.osm.pbf` extraction (2026-09-29, ODbL 1.0), transforms WGS84 through EPSG:25833 into the established viewer frame, and retains source vertices, holes, owner IDs and relevant tags in `east-parks-v198-evidence.json`. Rounded viewer payload coordinates retain millimetre precision. The receipt includes the retained PBF SHA256 and hashes of all three unchanged v187 model/navigation payloads. Prior Köpenick wall faces originate from the official LoD2 source documented in `east-landmarks-v187.md` (dl-de/zero-2-0).

The memorial uses its mapped grounds (way/442879072), sixteen distinct source cenotaph footprints (way/352057084 and way/352058802–352058816), two lowered red-granite banners (way/142701792 and way/1002636043), two open entrance arches (way/44387292 and way/142701801), and the source mausoleum footprint (way/142701713). The five green symbolic burial fields remain holes in the mapped paving rather than becoming solid pavement. Paths use their source courses; absent width tags receive documented display widths of 3 m for paths and 5 m for service routes.

The soldier anchor is node/9255913447; Mother Heimat is node/1561640301; the two kneeling figures are node/9256186730 and node/9256186731. The main figure faces Mother Heimat along the mapped ceremonial axis. Its left arm carries the child, its right hand lowers the sword. Small separated dark fragments under the boots indicate the shattered Nazi symbol solely as part of the historical memorial. There are no added ideological inscriptions. Sculpture bodies and relief rhythm are modest procedural recognition silhouettes, not scans or claims of sculptural replicas.

The district art catalogue gives the principal figure as 13 m; other official descriptions give 11–12 m, and the retained OSM node says 15 m. This disagreement is recorded. The model uses the district's 13 m figure and 30 m total ensemble, with the mapped 9 m mausoleum and an explicitly illustrative 8 m mound subdivision. Banner height is the mapped 14 m; cenotaphs use the mapped 2.5 m. The mound radius, steps, arch stone subdivisions, tree crown sizes and bench headings are display interpretations, not surveyed dimensions. Ordinary park buildings lacking heights use a labelled 7 m envelope. The 877 crowns are at mapped tree anchors or confined to mapped woodland, avoiding source paths/water/buildings and the ceremonial clearing.

Köpenick adds sparse masonry divisions only on retained, complete rectangular source wall planes. Sloped gables keep the prior detailed geometry without unsupported horizontal framing. No prior facade, aperture, roof or collision owner is replaced.

Primary references consulted 2026-10-09 (written descriptions; no photograph was copied into a texture or traced):

- [Berlin Senate: Treptower Park Soviet Memorial](https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/treptower-park/)
- [District: memorial history](https://www.berlin.de/ba-treptow-koepenick/ueber-den-bezirk/treptower-park/artikel.541822.php)
- [District: park art catalogue](https://www.berlin.de/ba-treptow-koepenick/ueber-den-bezirk/treptower-park/artikel.541823.php)
- [Berlin heritage office: Soviet Memorial](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/udssr/treptow-koepenick/sowjetisches-ehrenmal-im-treptower-park-648099.php)
- [District: Köpenick](https://www.berlin.de/ba-treptow-koepenick/ueber-den-bezirk/artikel.9466.php)
- [State Museums: Schloss Köpenick](https://www.smb.museum/museen-einrichtungen/schloss-koepenick/ueber-uns/profil/)

## Runtime and navigation

`createEastParksV198(native = false)` constructs independent texture-free drawn and native-block representations. Static geometry is partitioned into 512 m cells, frozen and frustum culled. Day/night material pairs share geometry. Drawn triangles are indexed without rounding; native adjacent equal cuboids join only when their exterior is identical. No new animation, render target or image texture is introduced. Native ground uses documented source-contained orthogonal runs; this is its block interpretation, not a reduction of the retained drawn source.

Actual complete GPU attributes, indices and instance buffers measured after QA: drawn **994,112 bytes / 30 draw calls**, native **1,686,096 bytes / 11 draw calls**. These are the complete new park plus Köpenick framing, not an entire city memory claim. JSON data is approximately 694 kB. Source triangles/payloads remain available unchanged.

`eastParksV198GroundAt(x, z)` is a tiny independent import that returns null outside the memorial's 29 m mound radius and a floor height within it. The centre is `[6740.976, 3791.879]`; ground rises from y=3 to y=11. The axis-facing 8 m wide stair strip matches all 36 actual tread tops. Integration should take the maximum applicable terrain height and use the new park's y=3 fallback outside this small mound. The helper imports no large park JSON.

`eastParksV198Navigation.json` contains exact `ring`/`holes` footprints and `{id, owner, groundY, topY}` for new building bodies, cenotaphs and banners. The mausoleum has groundY=11, topY=20. Whole gatehouse collision boxes are deliberately omitted so the authored entrance arches remain passable. The mound uses the dedicated ground helper rather than a solid circular wall.

`eastParksV198Navigation.ts` exports `eastParksV198SolidAt(x, y, z, radius = 0, native = false)` against those source owners, respecting courtyard holes, vertical extents and the fourteen banner taper levels. `eastParksV198WaterAt(x, z, native = false)` returns the actual surface y or null, using a separate small three-polygon water payload (and its visible native runs). Neither helper imports the large geometry payload.

## Checks

Three Python tests verify retained hashes, distinct memorial owners/heights, scoped ground/holes and source footprint precision. Four Bun tests inspect actual triangulated paving (including all five green-field holes), finite/frozen and orthogonal native geometry, spatial bounds/buffer budgets, and every stair tread against the independent ground helper. All pass.

Standalone headless Chrome screenshots inspected the memorial, whole park, native style and retained Köpenick with new details; there were no page errors. Front and rear figure checks confirmed the child's anatomical left side, lowered sword on the right, cape behind, and broken fragments below the boots. The lawn-hole regression found during this QA was fixed by flattening contours after Three's triangulator removes repeated closing vertices. Screenshots are local review artifacts, not retained source imagery. Physical iPhone hardware was not tested in this subtask.
