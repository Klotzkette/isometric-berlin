# Wilhelmstraße: finite street furniture V325

The current public OSM centreline runs from Reichstagufer/Marschallbrücke to
Hallesches Ufer/Mehringbrücke. The externally retained connected main chain is
2,407.235 m long (59 ordered ways); the 71 named road ways also include branches.
This is not the earlier Alt-Mitte-clipped 1.3 km course.

This small companion preserves the original public-lighting source. It replaces
only fourteen exactly admitted municipal records: 181253/181254 at the northern
end; 96375–96381 beside the photographed Elser section; 96310–96314 near the
photographed Kochstraße section. All 89 original Wilhelmstraße records must match
in Drawn before these fourteen IDs can yield; the other 75 retain their original
presentation. Each ID, complete XYZ, height, type, street and rotation is pinned.
No source array is edited or retained wholesale.

Thirteen separately mapped lamps at the southern end have explicit OSM
`straight_mast`/`bent_mast` provenance. Their anchors were checked against **all
5,829** old municipal records, not only the Wilhelmstraße selection: the nearest
municipal lamp is more than 335 m away. Drawn repeats the neighbourhood rejection
against the actual complete input. The compiled Native interpretation fetches
no ParkDetails payload. Three mapped `backrest=no` bench nodes and two individual
`capacity=2` U-stand nodes are small estimated shapes at their exact mapped points.
There are no new trees, history boards or Elser stele here.

## Architectural references and limits

- [Marschallbrücke/ARD, Bärbel Miemietz, 1 December 2024](https://commons.wikimedia.org/wiki/File:2024-12-01_ARD_Hauptstadtstudio_1080537.JPG),
  CC BY-SA 4.0: angular grey Y-shaped arms at the northern crossing.
- [Georg Elser Denkzeichen, Zitadelle, 2019](https://bildhauerei-in-berlin.de/bildwerk/georg-elser-denkzeichen-8683/),
  CC BY 4.0: dark green arched arms, shallow rectangular heads, grey paving and bollards.
- [Wilhelmstraße/Kochstraße, Gunnar Klack, 6 March 2025](https://commons.wikimedia.org/wiki/File:2025-03-06-IBA-87-Berlin-076-Wohnbebauung-Wilhemstr.jpg),
  CC BY-SA 4.0: green single arched mast and flat head.
- [Hallesches Ufer/Wilhelmstraße, Gunnar Klack, 30 August 2019](https://commons.wikimedia.org/wiki/File:Wohnbebauung-Hallesches-Ufer-Berlin-Kreuzberg-Fehling-Gogel-August-2019-Aufnahme_01.jpg),
  CC BY-SA 4.0: straight/leaning slender masts with long dark heads.

The municipal 6.8/8.2 m heights are inherited display fallbacks, not surveyed
heights. Arm reaches, Y split, pole sections, head dimensions, bench/stand
proportions and colours are photo-based display estimates. Their application
is finite; unknown lamp types are not guessed from nearby photographs.
Every new ground anchor goes through the supplied actual terrain callback,
which returns an absolute ground height. The compiled 5.245 m OSM datum is
only its fallback input and is not added to the sampled height.

No reference pixels, images, textures, media requests or timers are shipped.
Complete original source records and the all-municipal distance proof are in
`geo_data/regierungsviertel/wilhelm-street-furniture-v325-evidence.json.gz`.

## Integration and validation

`createWilhelmStreetFurnitureV325(native, sourceLights?, terrainAt?)` returns
`Group | null`. Drawn requires the actual complete `park.street_lights` array;
Native uses its independent compiled anchors and cardinal box construction.
Both require a finite actual terrain callback. Missing, changed, duplicated,
accessor-based or foreign source data closes admission. Only
`wilhelmStreetFurnitureReplacementSourceIdsV325(root)` authorizes the fourteen
old generic poles/heads to yield after full construction. Public `userData`
is not a receipt. `hasCompleteWilhelmStreetFurnitureV325(root,native?)` validates
private source/metadata, all live buffer words, shape, pose, materials and
resource lifetime. `disposeWilhelmStreetFurnitureV325(root)` revokes and frees
only this authored family.

Normal static freeze, interleave, lossless/GPU parking, private Toon/grade
presentation and real material-program retirement retain admission. Manual
resource disposal, foreign material/pose, unversioned buffer edits or selected
source edits revoke it. Ordinary Drawn and touch deliver identical detail.

Focused tests: 5 pass, 0 fail, including real complete old municipal input,
strict negative source cases, independent Native cardinal words, source-byte
preservation, actual parking/program-retirement and ordinary disposal.
A small local Bun/JSC factory measurement produced 284 members/3 draws/25,520
attribute bytes in Drawn and 410 members/2 draws/33,032 bytes in Native.
Construction measured 15.9/1.4 ms; these are bounded factory checks, not full-city
startup or GPU performance claims. Existing archive, bootstrap and Worker caps
are unchanged.
