# Spandau, Zitadelle and northern botanical park — v230

The northern site is **Botanischer Volkspark Blankenfelde-Pankow**, not the
Botanischer Garten in Dahlem. The new scope is only mapped OSM way/26633037:
319,059.748 m² (31.91 ha). The district describes the larger institution as 34 ha;
the implementation does not enlarge the mapped park to force those figures to
agree. `bounds-botanical-v230.geojson` supplies its complete source polygon for
the world-bounds union. World extent is x1340.811…2244.393,
z−9852.423…−9253.444. No former district is generated around it.

## Sources and retained geometry

- [Pankow district: Botanischer Volkspark](https://www.berlin.de/ba-pankow/politik-und-verwaltung/aemter/strassen-und-gruenflaechenamt/gruenflaechen/artikel.1315492.php): identity, greenhouse ensemble, geological wall, arboretum and botanical grounds.
- [Berlin: park history](https://www.berlin.de/tourismus/parks-und-gaerten/10497754-1740419-botanischer-volkspark-blankenfeldepankow.html): protected greenhouse ensemble of 1928–29.
- [Zitadelle operator: architecture](https://www.zitadelle-berlin.de/festung/architektur-2/): medieval Palas/Juliusturm and Schinkel's later crenellated crown.
- [Spandau district: Juliusturm](https://www.berlin.de/ba-spandau/ueber-den-bezirk/tourismus/sehenswertes/artikel.288536.php) and [Altstadt](https://www.berlin.de/ba-spandau/ueber-den-bezirk/tourismus/sehenswertes/artikel.288600.php): tower identity and varied historic townscape.
- Retained OSM Berlin PBF `berlin-260929.osm.pbf`, ODbL-1.0. Exact named park,
  greenhouse way/26633360, geological wall way/82889487, Waldteich
  way/40864004 and Großer Zingerteich way/225049450; mapped paths, planting beds,
  woods and 25 tree points.
- Official Berlin LoD2 tiles **390_5829 and 391_5829**, dl-de/zero-2-0. Every
  complete parent mostly inside the park is retained: 21 parents, 27 leaf bodies,
  all measured wall/roof sheets and courtyard holes. SHA-256s and source URLs
  are in `spandau-botanical-v230-source.json`.

The park has separate source-shaped ground, two water polygons, paths, planting
beds, woodland, complete measured greenhouse/service envelopes, greenhouse
framing and the geological wall. The OSM greenhouse access restriction is not
reinterpreted as an open interior attraction.

Twenty-four retained ordinary building owners along Breite Straße,
Carl-Schurz-Straße, Markt and Reformationsplatz receive shallow cornice/shopfront
bands on their actual street-facing edges. Their existing source bodies and
window grids stay unchanged. The Palas receives bounded pointed-window frames
on its measured walls. These details supplement the existing v187/v198 work.

## Juliusturm crown correction

The old complete source shaft ends in a smooth cap at y35.275. The new crown
stays below that same measured maximum. A small receipt independently records
the exact old owner, original dataset hash, 294 position vertices and 21 native
instances. `applyCitadelCrownV230` validates every recorded old value before
lowering only the smooth cap to y34.175. Native thin cap rows move intact;
tall shaft rows retain their original bottom. Twelve alternating merlons give
the documented crenellated silhouette. The operation is idempotent and refuses
changed source rows. Other landmark vertices and instance matrices are byte
identical. The original source JSON files remain byte identical.

The 1.10 m crown depth and twelve-sector spacing are explicit display estimates,
not measured crenel dimensions. The old LoD2 XY envelope and maximum tower
height are preserved. No tower is invented or duplicated.

## Abstraction, navigation and memory

The newly introduced park uses the existing outer-city display datum y3 m;
this is **not a terrain survey**. Each measured building parent is rigidly
shifted to y3.2, preserving its complete relative elevations. Untagged path
widths use 2.2 m. Tree heights/crowns and 247 additional woodland trees are
illustrative, constrained to mapped woods away from buildings, paths and water.
Facade bands, window frames and geological-wall height are abstract fittings.

Drawn and touch use identical geometry. Native terrain uses independent
orthogonal four-metre ground/water rows and one-metre paths; the coincident
ground/water grid prevents a land overlay across the ponds. Native measured
buildings use 1.5 m surface cells, not rotated smooth meshes. Native collision
and roof support use those exact delivered cells. Drawn roof support uses the
actual measured roof triangles. Roof floors are height-gated so a walker below
a roof does not snap onto it. Both APIs return no result outside the finite park.

Construction input is an ordinary JSON import registered by the root integration
in the existing lossless weak field cache. The renderer stores no decoded source
arrays on render objects. Final-size static buffers use no textures, added
lights or changed live-residency budgets. Trees have separate 192 m culling
groups. Measured live attributes: **240,270 bytes drawn; 1,530,588 bytes native**.
The new geometry JSON is about 146 KB gzip; collision/support data is separate
from construction-only arrays.

## Integration and checks

- `createSpandauBotanicalV230(native=false)` creates the additive static family.
- `applyCitadelCrownV230(westernLandmarksRoot,native)` runs immediately after
  the existing v187 constructor, before upload/parking.
- `botanicalV230GroundAt`, `botanicalV230WaterAt` and
  `botanicalV230SolidAt(x,y,z,radius,native)` serve only the new park.
- `botanicalV230FloorAt(x,z,feet,native)` supports landing on delivered roofs.
- The exact new scope file joins the global boundary union; no old scope narrows.

`scripts/build_spandau_botanical_v230.py --extract` reads retained OSM/official
archives; without `--extract` it replays the checked-in source receipt offline.
No photographs or third-party meshes are bundled.

Focused validation: **5 Bun tests, 45,995 assertions; 2 Python tests; Ruff clean**.
Raycasts against constructed meshes verify 158 drawn and 200 native roof points,
195 ground points per mode, and four pond samples per mode. Native matrices are
orthogonal and finite, body-cell collisions match actual cells, and old source
hashes plus unrelated render bytes are preserved. Crown-owner mismatch is tested
to fail closed. Full production build and browser integration belong to the root
release checks; this subtask does not claim those independently.

Browser targets: Zitadelle `[-10773,18,-2632]`; Altstadt `[-11255,10,-2295]`;
greenhouses `[1995,8,-9422]`; park overview `[1845,5,-9534]`.
