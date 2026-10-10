# Richardplatz, Hermannplatz and current Karstadt/Galeria, v210

This bounded supplement replaces seven exact coarse OSM building owners with six complete official LoD2 parents, then adds source-exposed facade recognition and mapped public-place furniture. It preserves the old packets, original source rings/holes, all 30 measured building parts and every original wall/roof sheet. Existing v185 street kerbs, neighbourhood profiles and park detail remain. The one obsolete church cornice is corrected through an exact reversible receipt described below.

## Scope and present-day interpretation

The current Galeria/Karstadt parent `DEBE02YY40001IT3` contains 23 parts. Its footprint covers OSM `way/24315001` and 99.1% of `way/26824425`, the surviving Hasenheide section. The Landesdenkmalamt describes the surviving three-axis historic section, the 1951–52 postwar reconstruction, and the 1998–2000 symmetrical Hermannplatz front. Current operation is independently confirmed by [Galeria’s store page](https://www.galeria.de/filialen/l/berlin/hermannplatz-5-10/001101). The source heights, roof steps, rear wings and technical roof bodies are retained. The separate garage owner `DEBE02YY400007x8` / OSM `way/24315047` remains untouched.

Recognition uses the extant limestone window courses, broad central glass front, lower glazing and vertical articulation of the surviving Hasenheide section. The [official heritage record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031163) supplies architectural context. No prewar twin towers, 1929 reconstruction, proposed redevelopment, advertisements or new signs are modelled. The free reference is dated 2011; material colours and opening dimensions are estimates, not a 2026 facade survey.

Richardplatz covers [Bethlehemskirche, heritage09090415](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090415), and four small parts of [Rixdorfer Schmiede, heritage09090419](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09090419). The museum identity is OSM `node/11787592208`; the nearby playground named “Schmiede” is a separate place. The four retained official parents are `DEBE08YYF00005wd`, `DEBE08YYF00006o6`, `DEBE08YYF00003et` and `DEBE08YYF00008Fc`. The separate open canopy `way/334062955` stays in its original model; it is not enclosed with invented walls. Cream plaster, red tiled source roofs, house shutters and modest workshop glazing follow the dated free reference.

The church parent `DEBE08YYF000005L` has three coarse roof strips, reaching13.224m above its source ground. It does not isolate the slate belfry seen in the 2012 and2020 photographs. All these measured sheets remain unchanged. A small **estimated** west belfry is added at worldXZ `[5060.45,5091.38]`, 4.2×4.2m, bodyY12.3–19.8m and roof peakY21.7m. Its footprint stays inside the church source footprint. The square clock marks and louvres are simplified recognition, not surveyed dimensions. Source ground is NHN−30, then one uniform parent datum places the church at scene groundY3; the four forge members retain their relative offsets with one shared datum.

## Public squares

The source retains full public-place polygons: Hermannplatz `relation/6888246` and Richardpark/Richardplatz `way/1267038130`. Forty mapped at-grade points are represented:21 directional wooden benches and17 bins at Richardplatz, plus2 bins at Hermannplatz. Bench direction/backrests come from OSM; dimensions are display estimates. Two exact pedestrian bicycle-parking polygons, `way/964322037` and `way/964322061`, supply14+24 bicycle capacity, interpreted as7+12 U-shaped stands. Their alignment follows the mapped rectangles. No road paint, kerbs, blanket paving overlay, paths, market stalls or underground stairs are added.

Hermannplatz’s mapped `node/1555473622`, **Das tanzende Paar**, is represented by a small simplified pedestal and gilded pair silhouette. [Bildhauerei in Berlin, Jörg Kuhn/Susanne Kähler](https://bildhauerei-in-berlin.de/bildwerk/tanzendes-paar-6645/) records Joachim Schmettau,1985, the brick/concrete pedestal and gilded bronze group. The Commons2005 image provides free visual context. Placement is source-bound; dimensions, pose and geometric abstraction are estimates. No inscriptions, detailed relief, faces or animation are reproduced.

## Ownership and old-detail preservation

`neukoellnPlacesV210Ownership.json` records exact coloured triangle/ink-segment multisets, packetSHA256, runtimeFNV1a guards and complete original navigation rows. Required source geometry must be created **before** transferring any packet owner. The seven owners are24315001,26824425,334062957,334062967,334062969,47023388 and88382458, each with prefix`OSM-way-`. Transfer affects1389 coarse drawn/native triangles and92 drawn ink segments. Old packet bytes remain unchanged. The nav helper retires only a complete identical source record and uses every new source roof triangle, including the separately identified estimated belfry.

The old church v185 north frontage is drawn rows2557–2559 and native rows9232–9249. All3/18 original rows and fileSHA256 remain in `legacyDetailRecords`. Only the upper cornice changes: drawnY27.35→11.02 and six native fragmentsY26.35→11.5. The two original low profiles remain byte-identical. The measured north eave is worldY11.184. The native centre accounts for the independent orthogonal shell skin. `transferNeukoellnLegacyV185V210(group,native,reverse)` verifies **every float32 matrix and colour value** for the full receipt before changing it. `reverse=true` regenerates the original float32 bytes for old outline-signature audits. Historical v185 JSON, generator and factories are unchanged.

## Runtime and integration

`NeukoellnPlacesV210.ts` exports required `createNeukoellnEnvelopesV210(native=false)` and lazy additive `createNeukoellnPlacesV210(native=false)`. `neukoellnPlacesV210Navigation.ts` exports `transferNeukoellnNavigationV210(tile,nav)`, `neukoellnV210RoofAt(x,z,native=false)` and `neukoellnV210SolidAt(x,y,z,radius=0,native=false)`. Wrap the existing v185 factory results with the legacy transfer helper. Register the receipt arrays with the existing exact triangle/line transfer mechanism. Do not change residency limits or historical generators.

There are229 sheets including8 estimated belfry sheets,598 triangles,1849 drawn accent/furniture boxes,2198 independent native shell runs and5715 native detail boxes. Both modes need two batches for this supplement. Approximate position/colour/instance buffers are184KB drawn and602KB native, excluding tiny shared unit-box geometry. Runtime JSON remains below0.9MB. Native facade details are built independently and shifted1.05m outward to clear the sampled one-metre shell, keeping the same recognition inventory. Drawn touch devices receive the same geometry as desktop. No textures or maximum-capacity allocations are introduced.

Suggested camera position/target pairs:

- Hermannplatz: `[3740,130,3750]` / `[3510,12,3598]`.
- Karstadt facade: `[3690,95,3690]` / `[3490,17,3585]`.
- Richardplatz: `[4870,110,4940]` / `[5018,9,5090]`.

The supplement is intentionally bounded. Rear/service faces receive no invented shopfronts, and the retained coarse church roof remains visible beside the estimated belfry. This is not an exact reconstruction of the church roof. The public square paving, existing trees, underground entrances and other unchanged buildings continue to come from earlier sources/models.

## Evidence and validation

`geo_data/regierungsviertel/neukoelln-places-v210-source.json` contains every original sheet, full source geometry, OSM tags, per-tile URL/SHA256 and factual/free-image references. `neukoelln-places-v210-evidence.json` contains exact selected faces, counts and transfer coverage. `docs/neukoelln-places-v210-credits.json` supplies separate integration-ready free-image credit receipts. Raw official ZIPs remain ignored; only three bounded tiles were fetched,14.3MB total, and no large archives were expanded. Two tiles supplied selected parents; the third was checked at the tile boundary.

Validation: four focused Python tests check sheet area/vertex preservation, unchanged packet hashes, exact ownership, bounded mapped furniture/native budgets and the precise legacy exception. Three focused Bun tests verify independent final-sized buffers, noUVs, reversible legacy byte equality, exact nav guards and roof/solid queries. No full suite, build, release or commit is performed by this subtask. Integrated camera review belongs to the parent task.
