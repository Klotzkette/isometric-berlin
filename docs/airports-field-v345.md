# Step 10 — existing airport exteriors and western Tempelhofer Feld

The v345 pass refines the retained airport facades and introduces measured local
relief in a finite western part of Tempelhofer Feld. It keeps the complete v194
airport geometry, v261 entrance and memorial, runways, courts and earlier details.
The original source JSON and city packets remain byte-identical.

## Airport details

263 existing facade hosts receive shallow, texture-free relief: 218 at Tegel's
Terminal A/main building and 45 on the retained Tempelhof hangar glazing. Tegel
gets pale lintels and sills plus dark glazing gaskets; Tempelhof gets horizontal
steel transoms, secondary mullions and lower metal door panels. The procedural
member dimensions and repeated subdivisions are display estimates anchored to
actual retained panes, not a measured facade survey. No replacement airport shell
or new terminal footprint is inferred from photographs.

The factory verifies every original position, normal, colour, index and instance
matrix buffer before attaching fittings. Invalid, partial, moved or changed
owners receive no addition. Drawn fittings use the measured facade normal. Native
fittings independently use the actual retained cardinal pane instances and their
outward cardinal faces, rather than rotating the Drawn decorations. Both full
mobile and desktop Drawn presentations receive the same detail.

2,247 Drawn / 7,444 Native members use two small site-local batches. Added GPU
geometry stays under 600 KB; old plus new airports stay below the existing
1.8 MB airport allowance. The unchanged v261 entrance is a separate existing
owner with its unchanged allowance. No runtime photographs or frame-loop work. New airport `boxes`/`blocks` and
terrain `plans` use the existing constructor-only gzip/WeakRef source policy;
ordinary navigation grids retain eager strong identity. The lossless transform
saves 879,578 bytes versus the two raw JSON sources without a new codec or fetch.

Tegel's current status was checked against the municipal announcement of the
27 July 2026 start of Terminal A conversion. The future BHT campus, future
restoration and future tenants are not depicted as already built. The existing
airport structure remains; the model is not a survey of a temporary construction
site.

## Measured Feld relief

The actual packet audit found western field ground completely flat at y=3.01 m,
with other retained ground/paving levels at 3.00/3.09/3.12 m. The correction owns
**38,176 m²** of the exact existing green grass faces in `ring182-2_9`, within
world X/Z `[1104,4800,1448,5104]`. Only four-metre cells fully inside the common
Drawn/Native grass footprint after a 12 m inward exclusion are included. Roads,
runways, aprons, buildings, their navigation and surrounding packets are intact.

Source: cached Geoportal Berlin DGM1 `DGM1_390_5814.zip`, dl-de/zero-2-0. Its XYZ
centres and EPSG:25833 placement are retained: world X=easting−389500,
Z=5820000−northing. The selected source heights range **42.39–44.53 m NHN**.
The local median **43.57 m NHN** is aligned to the existing grass y=3.01 m;
only measured relative relief is introduced. A 24 m smooth boundary transition
meets the unchanged surrounding ground. This explicit local display datum avoids
wrongly moving terminal foundations whose six earlier LoD2 parents use different
normalization datums. This is a bounded correction, not a claim that the whole
Tempelhofer Feld or airport now uses one absolute NHN reference.

The existing v307 terrain compiler preserves all original XZ vertices and
complete outside triangle complements, retaining the exact original grass colour.
Drawn uses four-metre NW/SE triangle planes. Native has independently cardinal
four-metre cell tops and vertical risers. Actual production-decoder raycasts at
216 locations in both modes agree with the matching walking sampler within 1 cm.
Ground and walking are admitted by one private packet transaction; failed source
or navigation checks keep the original flat surface and floor. No ground-floor
claim is made for an evicted/unloaded packet. The resulting entire source packet
stays below 700 KB of decoded render geometry, inside the unchanged resident limit.

## Audited existing details retained

* Tempelhof's front entrance already has the v261 projecting hall, doors,
  `ZENTRALFLUGHAFEN` lettering and Airlift Memorial; its source-ground and door
  raycast tests still pass. This pass does not place duplicate front doors.
* Columbiahalle already has its four measured exterior parts, owner-photo front,
  blue lettering, three double doors, entrance steps and KASSE treatment in
  v257/258. The operator's current venue page still describes the established
  hall and gallery. Existing exterior and illustrative concert room are retained;
  this pass makes no unsupported new building or interior-survey claim.
* Existing full Tempelhof roof sheets and Tegel's two-level tower cabins stay.
  The operator's current documentation of the 40 m cantilever and 15 m columns
  is useful architectural context, but this pass does not invent a new full
  cantilever structure over unverified roof/support coordinates.

## Sources and credits (checked 14 November 2026)

* [DGM1 source tile](https://gdi.berlin.de/data/dgm1/atom/DGM1_390_5814.zip):
  Geoportal Berlin, dl-de/zero-2-0. Original archive SHA-256, source packet hashes,
  source areas and complete outside-complement receipts are in
  `geo_data/regierungsviertel/tempelhofer-field-v345-evidence.json`.
* [Tegel monument and facade photograph](https://www.berlin.de/landesdenkmalamt/aktivitaeten/newsletter/newsletter.807995.php):
  Landesdenkmalamt Berlin / Anne Herdin, 2019; visual reference only. Architects:
  Meinhard von Gerkan, Volkwin Marg and Klaus Nickels (gmp).
* [Terminal A conversion status](https://www.berlin.de/ba-reinickendorf/aktuelles/pressemitteilungen/2026/pressemitteilung.1697743.php):
  Bezirksamt Reinickendorf, 27 July 2026; factual status reference.
* [Tempelhof covered apron photographs](https://www.thf-berlin.de/vermietung/eventlocation/vorfeld):
  Tempelhof Projekt GmbH; page also credits Claudius Pflug. The selected green
  steelwork and BERLIN-TEMPELHOF facade photographs credit Tempelhof Projekt GmbH.
  Visual reference only; no photographic assets are shipped.
* [Tempelhof structural documentation](https://www.thf-berlin.de/bau-sanierung/sanierung-des-stahltragwerks):
  Tempelhof Projekt GmbH; factual architectural context.
* [Columbiahalle operator](https://columbiahalle.berlin/ueber-uns.html) and
  [current venue specification link](https://www.columbiahalle.berlin/files/material/Downloads/venue-specs_columbiahalle_2023-de.pdf):
  Columbiahalle Gastro- und Betriebs GmbH, audit reference. Earlier owner-photo
  credits and v257/258 notices remain in force.
* Metric building/source owners remain Geoportal Berlin LoD2 (dl-de/zero-2-0)
  and © OpenStreetMap contributors (ODbL 1.0), with the existing v194 notices.

## Verification / reproduction

`uv run --no-sync python scripts/build_airport_exteriors_v345.py` and
`uv run --no-sync python scripts/build_tempelhofer_field_v345.py` produce the
finite source data. `bun scripts/capture-airport-guards-v345.ts` from `src/app`
records the unchanged existing render arrays after the source receipt check.

Python source/complement tests, actual decoder and walking ray tests, source
failure-path tests, native cardinal checks, texture/budget tests and retained
v194/v261 regression tests pass. Browser source inspection was unavailable in the
subagent (no available browsers); primary photographs were inspected as temporary
local reference images. Root release visual validation and publication remain
part of the combined release workflow.
