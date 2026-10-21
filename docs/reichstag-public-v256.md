# Reichstag public realm — v256

This bounded step-10 addition retains the mapped streets, paths, trees, terrain,
LoD2 buildings and all earlier furnishings. It adds fittings to the twenty narrow
mapped fountain strips in the Forum am Kanzleramt and sparse stone joints on
existing kerbs along Paul-Löbe-Allee, Scheidemannstraße and Ebertstraße.

## Place and evidence

The spoken name “Elisabeth-Julia-Haus” probably refers to the
Marie-Elisabeth-Lüders-Haus, which the Bundestag locates east of the Spree.
The verified fountains are farther west, between Paul-Löbe-Haus and the
Bundeskanzleramt. No fountain is invented in the gap beside the Reichstag.

- The [Berlin Senate Spreeweg leaflet](https://www.berlin.de/sen/uvk/_assets/natur-gruen/landschaftsplanung/20-gruene-hauptwege/weg-1/flyer_flanieren_entlang_der_stadtspree.pdf),
  section 19, describes the Forum's ground-panel fountains, alternating stone and
  grass bands and red maples, designed by Lützow 7.
- [Bezirksamt Mitte's 2021 fountain-season announcement](https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2021/pressemitteilung.1070989.php)
  identifies the operating fountain installation as “Forum Kanzleramt”.
- The [contractor's refurbishment record](https://combe.de/portfolio-items/erneuerung-des-wasserspiels-forum-am-kanzleramt-in-berlin/)
  describes its water walls and replaced water/pump infrastructure.
- The [Bundestag's Marie-Elisabeth-Lüders-Haus page](https://www.bundestag.de/besuche/architektur/luedershaus/luedershaus-198920)
  supplies the building-name and east-bank distinction.

References were checked on 20 October 2026. Only factual text was used; no image
or photograph was copied into the project. Procedural fittings are original
display geometry.

The retained Geofabrik Berlin extract dated 29 September 2026 supplies the exact
twenty OSM `amenity=fountain`, `fountain=splash_pad` rings: ways
505646043–505646056 and 1226582739–1226582744. Their complete five-coordinate
quadrilaterals are retained in
`geo_data/regierungsviertel/reichstag-public-v256-source.json`, with source URL,
ODbL attribution, extract hash and hashes of the unchanged streets, surfaces,
OSM and official building-detail files. Coordinates use EPSG:25833, with scene
`x = easting − 389500`, `z = 5820000 − northing`.

## Geometry and preservation

Each source ring contains one narrow grate, two thin edging strips and several
static nozzle/water cues. All member footprints are tested against their exact
source owner. The 134 nozzle positions and water heights, grate sections and
metal tones are illustrative display dimensions; they are not a surveyed
nozzle inventory or a claim that pumps currently operate. The model adds no
round basin, raised platform, broad paving overlay or underground machinery.

The 874 sparse joints follow 53 retained kerb segments, approximately 1,936 m in
total. Selection uses the existing `districtStreets.json` centre courses near
the three source roads, excludes road ends and mapped walking approaches, and
never creates or moves a road. Joint footprints stay within the existing 22 cm
kerb tops at terrain + 0.32 m.

Native mode has an independent orthogonal fountain representation. It also
rebuilds just those selected kerb portions from complete 10 cm cells inside the
same source-supported 22 cm strip, as native mode does not carry the drawn
DistrictStreets kerb mesh. Adjacent full cells are merged without expanding
their occupied area; 679 rectangles suffice. The kerb base and top remain at
terrain + 0.18 / 0.32 m. Native nozzles and water columns use independent square
tiers. No smooth fountain duplicate is retained.

Existing source-positioned trees and park surfaces remain intact. There is no
documented new tree inventory in this addition, so it does not introduce guessed
tree positions, paving courses, signals or future construction.

## Integration and budget

`ReichstagPublicRealmV256.ts` appends the precomputed rows through
`HbfNorthApproach.ts` to the existing terrain-aware public-space instance batch.
The same full drawn rows render on desktop and touch. Existing batch materials,
day/night handling, static transforms and disposal remain responsible for the
added instances; no additional draw, geometry allocation, material, texture,
animation, tour stop, descriptor or live-memory limit is introduced.

| Addition | Drawn | Native |
| --- | ---: | ---: |
| Fountain members | 328 | 800 |
| Kerb support rectangles | 0 | 679 |
| Kerb joints | 874 | 874 |
| Total instances | 1,202 | 2,353 |
| Matrix and colour bytes | 91,352 | 178,828 |

The integrated public-space batch, including the concurrently added unity flag
plaque and visitor-container details, measured 2 draws / 462,956 attribute bytes
drawn and 1 draw / 3,072,112 bytes native after the source-column visitor correction. The existing
5,000,000-byte batch guard is unchanged.

Review cameras, in world metres:

| View | Eye | Target |
| --- | --- | --- |
| Forum fountains | `[-17, 22, -96]` | `[42, 3.8, -139]` |
| Reichstag south kerbs | `[178, 25, 191]` | `[242, 3.5, 130]` |
| Reichstag north kerbs | `[197, 24, -14]` | `[237, 3.5, -61]` |

Rebuild with `uv run python -m scripts.build_reichstag_public_v256`; pass
`--extract` only to reproduce the small source subset from the retained local
Geofabrik GeoPackage. The runtime never reads that GeoPackage.
`tests/test_reichstag_public_v256.py` checks replay, preservation hashes,
owner containment, kerb support, disjoint native cell merging and fixed budgets.
`src/app/tests/reichstag-public-v256.test.ts` checks terrain-relative placement,
orthogonal native transforms, unchanged draw count, texture-free static batches
and integration. Existing Hbf approach/details tests remain unchanged.
