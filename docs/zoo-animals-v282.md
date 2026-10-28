# Zoo and Tierpark animal routes v282

## Scope

`scripts/build_zoo_animals_v282.py` generates the small shared placement file
`src/app/src/data/zooAnimalsV282.json` offline from retained local sources. It
does not rebuild city packets or reconstruct animal houses. Normal, night, snow,
underwater and Minecraft rendering consume the same animal locations; appearance
and animation are renderer responsibilities.

New figure counts are sparse illustrations, not live-stock declarations. Separate
`retainedRoutes` transfer motion ownership for the existing 47 eastern v276 figures
and three western wolves, without creating duplicates. Existing condors and mountain
ungulates remain under their separate perch/terrain-specific owners.

## Contract and verification

Schema 1 contains `sites`, deduplicated `habitats`, new `animals`, `retainedRoutes`
and explicit `unresolved` entries. Each habitat carries its original source
component's `ringXZ` and `holesXZ`, `sourceId`, `siteId`, `label`, `routeSurface`
and original component count. Each animal carries its own ID, habitat ID, species,
variant, source ID, horizontal `bodyRadius`, four `routeXZ` corners, `groundY`,
speed in metres/second and a phase normalized to `[0,1)`. Rectangles close
implicitly; no repeated fifth corner is emitted. Zoo feet use y=5.32 above the
retained 5.2 floor; Tierpark feet use y=3.12 above its 3.0 floor.

Every whole route rectangle, inflated by the model radius plus 0.4 m, must be
covered by the original habitat polygon with all holes intact. Solid buildings
and buffered mapped paths are excluded. Land routes exclude water; pelican and
sea-lion routes must be wholly inside mapped water. These checks cover the complete
body sweep and turns, not just endpoints or bounding-box overlap. They are repeated
against the rounded serialized polygon. Lemur clearance is 1.3 m, exceeding the
measured atlas radius 1.239 m. Water routes do not invent measured basin depths.

The ordinary building-classification exception is a mapped wire aviary, where both
wall and roof materials explicitly say `wire_fence`: the visible birds occupy
the enclosed floor rather than walking on a solid roof. Tierpark ibis way
`122451065` uses this rule and a genus-level illustrative ibis, without inventing
a narrower taxon. The distinct solid-roof Waldrapp building `217186470` is excluded.
One separately evidenced LoD2 rear aviary at the historic Hühnerhaus is represented
as an open wire cage in the required house module. Its complete source planes,
material interpretation and retained coarse neighbours are documented in the
[house evidence](zoo-houses-v282.md). The small chicken route additionally excludes
those actual retained prism/native footprints and uses a 1.0 × 0.6 m circuit;
only this small-species case enables the compact route search.

The Katta route in Tierpark way `36737079` fails the full-body exclusions and is
rejected. Other verified lemur habitats are used: `220264684` contains *Varecia
rubra* and *Varecia variegata*, represented by `red-ruffed` and
`black-and-white-ruffed`; `278262271` contains *Eulemur collaris*, represented by
`collared`, without a ring-tailed coat.

Run `uv run --offline --no-sync python -B scripts/build_zoo_animals_v282.py --check`
to regenerate entirely in memory, repeat the geometry checks and require exact
agreement with the checked-in JSON. This also verifies finite coordinates, unique
IDs, orthogonal implicit closure, floors, at most 60 new figures and JSON below
100,000 bytes. It neither writes nor accesses the network.

## Runtime and focused verification

`ZooAnimalsV282.ts` registers bounded animal batches when their owning world or
Tierpark packet is published. The existing viewer loop uses one shared clock per
zoo across drawn and native presentation. Visible batches update at most 10 Hz;
each clock advance is capped at 0.1 seconds. Hidden pages, lost graphics contexts,
reduced motion and the Columbiahalle interior suspend movement. A site's clock
also pauses when no eligible batch is visible, without accumulating catch-up time.
The loop visits registered batches, not the whole city scene.

Visibility tests the complete batch sphere against the camera frustum and a
bounded distance. Testing only its centre previously missed visible animals in
close views; a regression covers that case. Retained source headings are removed
before applying route turns, so existing animals face their direction of travel.
Native bodies retain cardinal orientation. Ground heights remain source-bound,
with at most 0.04 m walking bob; snow and flood do not lift animals onto a new
surface. Existing terrain/perch owners without verified routes retain only their
bounded idle movement.

New drawn limbs now have a small height-dependent gait: their upper attachment
stays fixed while the feet move by at most 0.05 m. All members of one limb share
the same shear, keeping feet, hands and legs connected. Sparse vertex ranges
reuse the existing dynamic position buffer; retained source members stay rigid
and unchanged. A family switch during reduced motion publishes the destination's
shared pose once without advancing its clock or starting continuous rendering.

Moving position and instance buffers remain separate from static geometry
parking/interleaving. Frames invalidate presentation only, not the static shadow
atlas. Drawn night rendering uses the alternate lit material; the same geometry
and normal depth handling remain available in other drawn themes. Cancellation,
rollback, packet eviction and final disposal unregister owners and release their
buffers; geometry-only GPU retirement does not destroy animation ownership.
Stream accounting includes the animal buffers and separate Brehm-house fittings
without increasing the existing residency budgets.

Focused checks completed on 2026-10-28:

- Earlier follow-up scene/transfer/stream checks: 21 passing tests, 76,136 assertions.
  All 50 new drawn figures remain connected during a substantial stride in all
  four route headings; feet move relative to the rigid body. Suspended family
  changes synchronize once while hidden/distant owners remain untouched, and
  disposed owners cannot re-register. Exact retained ownership and GPU-buffer
  accounting still pass.

- `tests/test_zoo_animals_v282.py`: 19 passing tests, including incomplete OSM
  relations, holes, disconnected components, full-body collisions despite clear
  route centres, land/water separation, solid versus wire roofs, and retained IDs.
  Targeted Ruff formatting/lint passed. The offline generator `--check` matched
  all 67,227 bytes: 51 new figures, 50 retained routes and 37 habitats. The added
  chicken test checks complete body clearance against the measured aviary,
  retained main house and native corner block, including a failing control route.
- Current combined house/animal Python suites: 24 passing tests. Current
  house/shape/motion/scene runtime suites: 27 passing tests, 234,410 assertions,
  covering all 51 new figures, including the chicken's drawn gait and native body.
- `tierpark-animal-transfer-v282.test.ts`: exact removal of only the 47 transferred
  animal owners, unchanged remaining indices and coordinates/colours in both
  families, source immutability and fail-closed receipt guards.
- `zoo-animal-motion-v282.test.ts`: deterministic shared poses, speed and closed
  routes, bounded gait, pause/resume without catch-up and invalid route rejection.
- `tierpark-animal-stream-v282.test.ts` and `surrounding-stream-v255.test.ts`:
  12 passing tests, 327 assertions. Complete retained static geometry still
  matches explicit decoding; instance matrices/colours, world coordinates,
  exact GPU byte/buffer counts, family changes and abort/disposal are checked.
- Native and drawn constructor lifecycle suites: 53 passing tests, 4,721
  assertions, using the real animal registry without weakening prior ownership,
  publication-order or rollback checks.

These are source, CPU geometry and lifecycle checks. Whole-city visual review in
the internal browser was blocked by its security rejection. No completed browser
visual review, endurance run or physical-phone validation is claimed here.
Unlocated and historical species listed below remain unresolved; these checks do
not establish present-day animal stock or supply missing enclosure evidence.

## Retained sources and ownership

Zoo: `geo_data/regierungsviertel/raw/zoo-v165/osm-map.xml`, originally from the
[OSM map API](https://api.openstreetmap.org/api/0.6/map?bbox=13.329,52.503,13.345,52.517).
The original elephant `relation/2701739` and pelican `relation/382771` outer/inner
members are assembled; the older v165 derived habitat list omitted relations.

Tierpark: a spatially bounded read of
`geo_data/regierungsviertel/raw/east-v187/candidate.gpkg`, never a whole-city load.
Coordinates use EPSG:25833, x=easting−389500 and z=5820000−northing. Existing eastern
animal records come from `geo_data/regierungsviertel/tierpark-v276-evidence.json.gz`.
Retained route IDs match original per-species record order:

- `zoo-v276-wolf-0..2`
- `tierpark-v276-wood-bison-0..6`
- `tierpark-v276-bactrian-camel-0..5`
- `tierpark-v276-dromedary-0..5`
- `tierpark-v276-flamingo-0..27`

## Animal evidence

The operator's current [Zoo species overview](https://www.zoo-berlin.de/de/zoo-erleben/tiere-erlebniswelten)
and [Tierpark overview](https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten)
support the selected elephants, big cats, bears, apes, lemurs, ungulates, hippos,
penguins and waterbirds. [Elephant return in June 2026](https://www.tierpark-berlin.de/de/aktuelles/news/artikel/die-giganten-kehren-zurueck-in-den-tierpark-berlin)
confirms African elephants outdoors; it does not imply that the new indoor visitor
hall is already open. [Brillenbär/Waldhund](https://www.tierpark-berlin.de/de/aktuelles/news/artikel/baerenstarke-wohngemeinschaft)
supports the spectacled-bear habitat. The [official rabbit rally](https://www.zoo-berlin.de/fileadmin/tierpark/Tierpark_erleben/Angebote_fuer_Kinder/Rallyes/Kita-Hort-Rallye_Haustiere_Baeren_ab_5_Jahren.pdf)
supports the Tierpark rabbit locations.

[Robben & Pinguine](https://www.zoo-berlin.de/de/zoo-erleben/tiere-erlebniswelten/robben-pinguine)
and [Humboldt penguins](https://www.zoo-berlin.de/de/artenschutz/weltweit/humboldt-pinguin)
support the distinct outdoor penguin variants. Indoor king/rockhopper penguins
are not placed in the unrelated outdoor habitats. The [June 2026 aviary report](https://www.tierpark-berlin.de/de/aktuelles/news/artikel/neues-zuhause-fuer-pelikan-flamingo-co)
supports the waterbirds; starred future occupants are not silently treated as
present animals.

Specific versus generic bird labels are handled transparently:

- Zoo Marabu node `13901500128` in the retained 2026 extract lies inside
  `618256710`, still generically labelled birds of prey. The specific animal POI
  supplies the illustrative identity; the full polygon supplies the safe movement
  boundary. This does not assert the stock of the entire aviary.
- The [operator's 2022 report](https://www.zoo-berlin.de/fileadmin/zoo-berlin/downloads/Investor_Relations/Geschaeftsberichte/Geschaeftsbericht_AG_2022.pdf)
  places white storks in the aviary beside the ape house and black storks in the
  Landwehrkanal marsh-bird aviary. These locations spatially match retained
  `48374319` and named `32995991`, respectively. The present-day illustrative
  placement is an interpretation of those exact locations and the user's request,
  not a fresh animal census; `identityEvidence` preserves this distinction.

## Explicit limits

Walrus and manatee placements remain pending an explicit choice about fictional
animals: [Hagenbeck](https://www.hagenbeck.de/de/tierpark/tierpark/10_jahre_eismeer.php)
identifies Germany's only walruses, and the [2019 Tierpark report](https://www.tierpark-berlin.de/fileadmin/zoo-berlin/downloads/Investor_Relations/Geschaeftsberichte/Geschaeftsbericht_AG_2019.pdf)
records the end of manatee keeping and the last two animals' move to Beauval.

Current snakes belong in Aquarium/Regenwaldhaus, but exact terrarium geometry is
unresolved; the closed old snake farm is excluded. No current alligator location
is verified, and gavials are not relabelled alligators. The
[Aquarium's August 2026 operator account](https://www.aquarium-berlin.de/de/aktuelles/news/artikel/113-dinge-die-du-noch-nicht-ueber-das-aquarium-berlin-wusstest)
confirms current snakes and reptiles on the first upper floor, but does not
provide a terrarium layout. The [Tierpark's 2021 relocation account](https://www.tierpark-berlin.de/de/aktuelles/news/artikel/von-berlin-nach-budapest)
records the American alligator's transfer to Budapest. Neither the former
snake farm nor the old crocodile house supports a current invented route.
Zoo Waldrapp has a specific point but no verified movement polygon. Tierpark stork way `36770071`
has a conflicting Goliath-heron species tag. The Tierpark Marabu savanna records
do not establish a precise current motion polygon. These cases remain explicit
rather than being placed at invented coordinates.

Domestic chicken is now represented by one generic figure in the exact measured
western rear aviary `lod2/DEBE01YYK0003Uqa`; the current breed identity of that
individual compartment is not asserted. This source addition supersedes the
earlier unresolved chicken entry. See the [complete aviary evidence](zoo-houses-v282.md).

## House identities and separate reconstruction

Zoo Pinguinwelt POI `9558385246` lies inside building `16967250`, approximately
(-2154.03,1054.98); Affenhaus POI `9558385251` lies inside building `35287467`,
approximately (-2351.51,1326.19). Neither building is in the curated v165 parent
list. The animal-placement data does not assign a new LoD2 owner. The separate
[house reconstruction](zoo-houses-v282.md) identifies the Penguin building's
complete retained source parts, exact old owners and height correction; the ape
house is not reconstructed by this update.

Tierpark Alfred-Brehm-Haus is way `11269594`, existing LoD2 owner
`DEBE11YYI0000Nxm`, approximately (11012.95,2375.62). It is now the
[Regenwaldhaus](https://www.tierpark-berlin.de/de/tierpark-erleben/tiere-erlebniswelten/regenwaldhaus),
with Sumatran tigers, Java leopards, sun bears and Sunda gavials. The historical
lion-house description does not justify a present lion population there.
