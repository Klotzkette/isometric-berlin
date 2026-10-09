# Northern parks, Schönhausen and Panke, v1.0.98

The addition follows the complete retained OSM polygons for Schlosspark Niederschönhausen (relation947050), Volkspark Schönholzer Heide (relation946980), and the Soviet cemetery (way28104405). It adds only their finite approach streets, nearby complete building footprints, and the mapped Panke corridor. There is no rectangular district fill and no extension to Bernau. “Oberschönhausen” remains unresolved and is not silently interpreted as another district.

`bounds-north-parks-v198.geojson` is the full requested source union. The runtime ground footprint is its exact difference from all six previous scope files, adding960,129.75m². Old source packets, roofs, roads, water, terrain and trees are untouched. A small set of individually mapped barrier accents also follows the already covered Panke; it does not cover old surfaces.

## Sources and what is measured

* Retained Geofabrik Berlin2026-09-29 OSM: original park/building/water polygons, road/path axes, walls, fences and408 individually mapped tree nodes. All source records and unclipped original building footprints are in `north-parks-v198-source.json`.
* Berlin official LoD2: full palace parent `DEBE03YY70003qcl` and gatehouse parents `DEBE03YY700040j1`, `DEBE03YY700041ZP`; every source roof/wall sheet is triangulated, not replaced by a generic volume. The two gatehouses correspond to four OSM parts. Their central passage remains open.
* Berlin DGM1, six local2km tiles: documented hashes and URLs are in evidence. A32m piecewise planar field uses worldY=NHN−30; native terrain is independently built on16m terraces. The old city has its existing display datum: a46m new-side seam margin and64m transition retain old groundY3 and old waterY−1.15 exactly. No existing data is moved to force a new datum.
* [SPSG Schönhausen](https://www.spsg.de/schloesser-gaerten/objekt/schloss-schoenhausen/) confirms the palace identity and historic use. Wall/roof mass is measured; facade colours and small bay rhythm remain explicitly schematic. No photograph is shipped or applied as a texture.
* [Pankow Schlosspark](https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/ausstellung/artikel.1510628.php) supports the park and its Panke setting. [SenUVK Panke](https://www.berlin.de/sen/uvk/umwelt/wasser-und-geologie/europaeische-wasserrahmenrichtlinie/berlin/panke/) provides river context. The currently documented [SchlossparkbrückeIII construction](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/brueckenbau/schlossparkbruecke-iii/) may differ from the retained OSM survey: the model does not invent a detailed construction site.
* [SenUVK Schönholzer Heide memorial](https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/schoenholzer-heide/) establishes two gatehouses,16 burial chambers, the33.5m grey syenite obelisk and the mourning Mother sculpture. The obelisk has that total height, not that height plus a second pedestal. The Mother is at its mapped node2274670443. Its small bronze silhouette is an approximation; no invented names or inscriptions appear. Mapped lawns and paths preserve the real layout, but unlabeled grass polygons are not falsely presented as individually surveyed graves.

## Panke and limits

The retained centreline within this named request is4.959km, approximately2.486km already covered and2.473km newly covered.29 original mapped water polygons supply the course and width. The added water surface is recessed0.60m below the local bank field away from the seam; this is a visual channel depth, not a measured hydrological water level. Earth edges are distinct from mapped retaining walls. Brick is used only where the source identifies brick; natural park sections are not universally lined in masonry. Already covered sections receive only finite mapped fence/wall accents where the old outline generator had no barrier layer.

386 new/context building footprints are retained. Ordinary context uses tagged heights/levels where present and modest, explicitly estimated heights otherwise. Only the palace and gatehouses use complete measured LoD2 geometry. Context facade marks and forest-canopy positions are illustrative; all individually mapped tree nodes remain and illustrative trees exclude paths, buildings and water.

## Runtime integration

`createNorthParksV198(native=false)` is in `NorthParksV198.ts`. Construction arrays are split into two drawn and two native JSON files, each below5MiB. The factory has no animation, textures, lights, new global budgets or device-specific detail removal. Fourteen cells allow spatial culling; matrices and bounds are finalized once.

`northParksV198Navigation.ts` imports only compact terrain/footprints and building collision metadata, never either render representation. It exports:

* `northParksV198GroundAt(x,z,native=false): number|null`
* `northParksV198WaterAt(x,z,native=false): number|null`
* `northParksV198SolidAt(x,y,z,radius=0,native=false): boolean`

Ground returns null outside the exact new footprint. Water has its own continuous field. Source context solids preserve courtyard holes; native context collision follows the actual2m occupied cells. Palace collision respects measured roof planes. Native hero collision boxes are first read only for an actual nearby native query.

## Review cameras (world coordinates)

| View | Camera | Target |
|---|---|---|
| Palace and garden | `[2390,105,-6370]` | `[2470,23,-6560]` |
| Panke in Schlosspark | `[2730,78,-6230]` | `[2650,13,-6367]` |
| Memorial axis and both gates | `[435,90,-6750]` | `[290,27,-6910]` |
| Obelisk and Mother | `[340,72,-6870]` | `[241,34,-6956]` |
| Schönholzer Heide context | `[1080,160,-6020]` | `[760,23,-6590]` |

The primary scope/owner tests verify old-boundary preservation and every measured wall/roof triangle. Runtime tests check independent native matrices, matching ground/water/solid navigation, open entrance passage, compact buffers and material ownership. This is a bounded reconstruction, not a claim of an exhaustive contemporary survey of northern Berlin.

## Narrow full-view correction

The first full-scene review revealed hairline pale gaps at raised path edges. Their tops stay at the same source coordinates and elevations; vertical side faces now close only the existing0.035/0.05/0.07m pavement risers. Draw calls remain28.

Full-view pixels also matched manually linearised byte values directly (e.g. grass42/77/39 instead of authored113/149/109). This layer now follows the retained city's display-RGB buffer convention, including its instance colours. This is a local compatibility adjustment; it makes no global claim about the renderer pipeline and changes no global material or lighting settings.
