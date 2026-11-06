# Youth theatres and Archenhold Observatory V322

This finite update checks the current operator addresses and improves five existing or explicitly requested named sites. It adds no surrounding district or street coverage, photographic textures, animation, media, or additional navigation stops. Full touch Drawn uses the same geometry as desktop. Native has independently constructed cardinal building, fitting and instrument geometry.

| Venue | Current public location | Treatment |
| --- | --- | --- |
| GRIPS Hansaplatz | Altonaer Straße22 | Retained: the complete V139 family, V272 entrance/stair and V274 folded panels/treads already identify this house. No second window grid or source replacement. |
| GRIPS Podewil | Klosterstraße68 | Retained: the V297 measured Podewil body and seven-by-three principal facade remain unchanged. |
| ATZE Musiktheater | Luxemburger Straße20 | Added the complete, previously missing official theatre parent, source-contained glazing and estimated V-shaped concrete supports. Adjacent BHT owners are preserved. |
| Theater an der Parkaue | Parkaue29 | Added three complete official parents,24 leaves, roofs and court air. Restrained ochre/plaster, red existing roofs and joinery refer to the public building/architectural context. |
| Theater Strahl Ostkreuz | Marktstraße11 | Added both complete official hall/foyer parents, four leaves, with the historic brick hall and dark foyer distinguished. |
| Theater Strahl Kulturhaus Schöneberg | Kyffhäuserstraße23 | Retained the actual delivered school body/roof/courts. Added one exact existing packet frontage with restrained brick colour, arched window heads, pale frames and horizontal bands; all mapped entrance apertures remain. |
| Archenhold Observatory | Alt-Treptow1 | Replaced exactly three old authored EastParks building records with the complete official family and an open, static interpretation of the great refractor. |

Schlosspark Theater is not identified as a current Theater Strahl venue. The two current Strahl venues above are confirmed by the operator. The Kulturhaus itself also confirms its continuing Strahl use.

## Sources and limits

Addresses and venue identity were checked on6November2026 against [GRIPS](https://www.grips-theater.de/ls/service/anreise), [ATZE](https://atzeberlin.de/besuchen/), [Parkaue](https://www.parkaue.de/service/kontakt/), [Theater Strahl](https://www.theater-strahl.de/spielorte/) and [Kulturhaus Schöneberg](https://kulturhaus-schoeneberg.de/). These contact pages establish identity; they are not measurements of walls.

The unmodified retained Geoportal Berlin LoD2 ZIPs supply every source sheet. `youth-theatres-v322-source.json.gz` retains archive hashes, full original leaves/rings/holes/surfaces, display offsets and references. The original sources are licensed dl-de/zero-2-0. Their source coordinates and surfaces are preserved; window spacing, colour and small fitting dimensions are display estimates.

ATZE is parent`DEBE01YYK0003uL0` (one leaf). The official source minimum5.693m in scene coordinates is translated by−0.493m to the actual existing5.2m ground sampler. All four complete neighbouring BHT families have zero positive-area intersection with ATZE. In particular, old owner92578126 is exclusively part of the separate university correction; ATZE does not retire it. The [theatre association's venue description](https://www.berlin-buehnen.de/en/theatres/atze-musiktheater/) supports the characteristic glazing and V-shaped concrete columns; the [Landesdenkmalamt](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09030302) and BHT's own history identify the former hall.

Parkaue parents are`DEBE11YYI00004aU`, `DEBE11YYI0000OfT` and`DEBE11YYI0000JiA`. Strahl Ost parents are`DEBE11YYI00001CB` and`DEBE11YYI0000DJN`. These exact named families were absent from current city-body packets at their location. They receive the existing outer display-ground datum3m; the rigid shifts preserve their source relative heights. This is not a new DGM terrain survey. The [Senate building report](https://www.berlin.de/sen/kultur/infrastruktur/theater-an-der-parkaue/), [LDA entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09040260) and [project architect](https://www.pinardi-architekten.de/Inhalt/Parkaue/P_3-Parkaue.html) identify the school/theatre ensemble and its modern annex. The [Strahl operator](https://www.theater-strahl.de/spielorte/) identifies the2023 dark foyer; its photographs and the [project structural engineer](https://eisat.de/en/projekte/theater-strahl-am-ostkreuz-berlin) support the exterior interpretation.

The Kulturhaus front belongs to actual owner`DEBE07YY900009Vl` in primary packet`-3_5`. The original V188/V230 generic companion inventories contain no facade grid for it. Its operator-published photograph supports brick arches, pale joinery and inter-storey bands. The new80Drawn/64Native openings are source-contained estimates, not an individual window survey. Every original packet, roof, court, colour stream, line and navigation record is retained. The actual raw and prepared predecessor guards are recorded in the evidence; any unknown or corrupted source stays unchanged.

No reference photograph pixels are distributed. Operator/architect photographs remain reference-only with the rights of their respective holders; an unstated photographer or free licence is not inferred.

## Archenhold: complete building and open instrument

Parent`DEBE09YYP00000z1` has eleven complete source leaves. Nine are rendered as the complete measured building. The central instrument/withdrawn-cover leaves`DEBE3DxoMbxaLcrN` and`DEBE3DlJR7clegG5` retain their measured roof and edge location as an explicitly open interpretation. Their original complete source sheets remain in the evidence. They do not produce invented solid walls beneath the visible open mounting.

The source ground2.653m is shifted by+0.347m to the old authored3m street datum. The actual OSM instrument point`node/1837936666` fixes the local anchor. The [Stiftung Planetarium Berlin instrument description](https://www.planetarium.berlin/archenhold-sternwarte/technik-und-instrumente) establishes the21m refractor and nominal680mm objective. The [LDA building entry](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020301), official DOP2025 and the operator's F.-M.Arndt photograph support the building, long hollow tube, collars, open side wheels, legs/ties, withdrawn cover and observation platform. The fixed20degree pose, pivot offset, structural diameters, railings and small joinery are proportional display estimates; the telescope is not animated.

The three exact old source buildings are`relation/2309788`, `way/142701798` and`way/1234312660`. All rings, centres, heights and native roof runs are bound, not merely their labels. `way/321379819` and all unrelated park content stay untouched. Existing source conflicts are retained as such; no source sheet is silently simplified to the old OSM outline.

## Atomic publication and navigation

`createYouthTheatresV322Steps(native,{sourcePrisms,mobileLike})` is closed by default and constructs ATZE, Parkaue and Strahl Ost only after the complete actual published source inventory and new data are verified. `requiredYouthTheatresNavigationV322` covers all three new envelopes with their source roofs/court holes.

`prepareYouthTheatresRuntimeV322(native,true)` prepares the actual Treptow source rows. `createYouthTheatresRuntimeV322Steps(oldEastRoot,native,actualEastData.buildings,{includeTreptow:true,...})` then constructs both new models, stages one exact shared EastParks transaction and publishes both synchronously. It returns`root`, `complete`, `release`, `solidAt`, `groundAt` and`previousOwnerRetired`. The runtime attaches its own root; it must not be attached a second time.

The shared V322 receipt composes Archenhold and Treptow retirements against the actual unmodified V198 constructor. Drawn retires101exact building triangles plus160relief instances in each of two round hosts. Native retires1066rows in host13:7 and640in host12:7;426of those rows belong to Archenhold. All unrelated indices, vertices, normals, colours, instances and source objects remain exact. There is one controller per shared host, rather than competing swaps. Commit revalidates the complete original source; cancellation, disposal or an invalid private replacement gate restores the originals. No general duplicate, Core or native-RLE exception is added.

Actual old-constructor captures under Bun/JSC and Node/V8 are byte-identical. Normal interleave, lossless storage parking, GPU/program retirement and warm mode lifetimes are supported by the existing private controller. Authored manual disposal remains invalidating. Hot source admission uses private descriptor/identity pins; navigation rejects points outside bounds derived from the actual complete model geometry before querying those gates.

The new data use the existing exact V309 UInt32 word-plane transport for new Float32 positions/indices. All original source bytes and historical fixtures remain unchanged. Focused Python tests check every source triangle, independent Native planes, court air, exact family/packet scope and BHT non-overlap. Bun tests exercise the actual old constructors, full/touch modes, staging, shared-host complement/rollback, private gates, parking and program retirement.
