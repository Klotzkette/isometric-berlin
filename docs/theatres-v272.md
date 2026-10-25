# HAU1, HAU2, HAU3 and GRIPS — v272

The three HAU venues have complete measured building envelopes instead of short generic prisms. HAU3 is a third-floor venue in the rear building at Tempelhofer Ufer 10. Its street passage is a separate front house, not the theatre auditorium. GRIPS retains its existing complete v139 source family, courtyard, arcades, glazed link, exterior stair, entrance, signs and surrounding Hansaplatz buildings.

## Survey and exact ownership

All 22 leaf parts of four official parents are preserved, including every original roof and wall ring and all ground footprints. `LoD2_390_5817.zip` is the retained Geoportal Berlin source (dl-de/zero-2-0). Positions and relative heights are unchanged; measured ground is translated to the established 5.2 m display street datum. Independent tests compare the generated surfaces directly against CityGML.

| Place | Official parent | Parts | Measured height | Exact old display owners |
| --- | --- | ---: | ---: | --- |
| HAU1 / Hebbel-Theater, Stresemannstraße 29 | DEBE02YY4000027E | 15 | 25.306 m | 81194038 |
| HAU2, Hallesches Ufer 34 | DEBE02YY4000019p | 3 | 15.652 m | 65780505 |
| HAU3 rear venue and low eastern wing | DEBE02YY400007Do | 2 | 20.789 m | 59291480, 81646698 |
| HAU3 street-access house, Tempelhofer Ufer 10 | DEBE02YY40000CoB | 2 | 27.111 m | 75846696 |

The exact original five prism records, hashes and footprint intersections remain in `theatres-v272-source.json.gz`. Required replacement loading gates their suppression. For HAU2, 35.26 m² of the old broad OSM footprint lies outside the measured outline, while 1.06 m² of the measured outline lies outside the old footprint. The old record is retained in evidence, and all three measured parts are drawn. No adjacent source family is removed. The HAU3 low wing overlaps 233.93 m² of its separately mapped 233.94 m² old owner, so that duplicate is also explicitly receipted.

## Recognition work

HAU1 receives limestone courses, three framed portals, the long dark HAU1 sign and narrow colour rule, the tall faceted foyer glazing, balustrade, stone cornices, narrow side windows and a shallow curved front gable. HAU2 receives its modern glazed bands, level entrance, WAU identity and three gold line panels. HAU3 receives courtyard/street window rhythms and the cream portal, white arched fanlight and blue HAU3 lettering at mapped entrance node 3848188241. The rear venue's floor and separate access are recorded explicitly.

These fine divisions, colours, sign sizes and ornamental profiles are restrained visual estimates from references, not a measured facade survey or a claim of exact reconstruction. No interior or passable portal was invented. The full source envelope remains behind the fittings. The curved HAU1 gable stays below the measured roof summit.

GRIPS improvements are additive: folded roof-edge caps, additional metal-panel joints, two shallow foyer display cases, and a landing/guardrail connection between the retained spiral stair and its retained upper door. The original three v139 GRIPS source/profile/implementation files are pinned unchanged by hash tests. No future renovation is represented as existing.

## References

- [HAU operator: venues and access](https://www.hebbel-am-ufer.de/service/anfahrt-besuch): all three addresses, HAU3 rear third-floor identity and operator photographs.
- [HAU operator: accessibility](https://www.hebbel-am-ufer.de/service/barrierefreiheit/): HAU1 stair entrance, HAU2 level access and HAU3 third-floor access.
- [HAU operator: technical venue information](https://www.hebbel-am-ufer.de/ueber-uns/technik): venue identities and architecture reference.
- [Berlin monument record 09031244](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031244): Oskar Kaufmann's 1907–08 Hebbel-Theater, limestone rustication, convex window field and pediment.
- [GRIPS operator: arrival](https://www.grips-theater.de/de/service/anreise): Altonaer Straße 22 at Hansaplatz, distinct from Podewil.

The three HAU photographs by Jürgen Fehrmann were consulted as visual references only; no photo, video, poster or texture pixels enter the repository or runtime. Ground identities and entrance node are retained OSM data (ODbL-1.0).

## Runtime and verification

`createTheatresV272(native, options)` supplies two drawn batches or one independently constructed orthogonal native batch. `createGripsDetailsV272(native, options)` adds one separately bounded batch at Hansaplatz. Both retain identical full detail on touch devices. Native shells contain 3,971 surface cells and no hidden solid fill. All 582 measured triangles remain in the drawn model. Navigation uses the full measured roof triangles and independent native roof cells.

`native_facade_clearance_v272.py` places fine native fittings outside their actual measured source-cell envelope. At return-wall corners it resolves intersections locally along the source normal or the same facade, choosing the nearest free interval. Native text has separate visible anchors; drawn lettering and ribs remain unchanged. The same fix is used for v272 Springer/taz recognition. Street-front fittings on unchanged legacy owners retain their previous native offset.

No new stops, texture loads, animation, dynamic lights or live budgets are introduced. There is no claim of zero browser crashes. Focused Python checks cover complete raw survey preservation, exact old owners, native source coverage, correct separate HAU3 access, original GRIPS preservation and actual source-cube occlusion. Bun checks cover desktop/touch parity, draw-call/array bounds, orthogonality, precise native substitution and roof navigation. Integrated internal-browser review belongs to the main release validation.
