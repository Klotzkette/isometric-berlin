# Zoo West v276 — complete restaurants, aviaries and current wolves

This pass adds complete, bounded restaurant replacements and recognition details
to the existing Zoo model. The previous eighteen complete LoD2 parent families,
53 parts and 1,963 source surfaces, their terrain, paths, water, animal houses,
high aviaries, v255 recognition work and v256 hippo-house glass roof remain.
The earlier source and navigation files are byte-identical; their hashes are
recorded in `geo_data/regierungsviertel/zooWestV276Evidence.json.gz` and checked
against disk. This is not a claim to have newly surveyed every Zoo building.

## Primary references and locations

References were checked on 26 October 2026. The operator's photographs and map
establish identity, appearance and adjacency only. No map was traced, no image
or video is bundled, and no texture or animation was introduced.

* [Current European wolf page](https://www.zoo-berlin.de/de/zoo-erleben/tiere-erlebniswelten/europaeischer-wolf)
  identifies **Canis lupus lupus**. [The Zoo's 16 March 2023 announcement](https://www.zoo-berlin.de/de/aktuelles/news/artikel/die-rueckkehr-der-woelfe)
  places the European wolves beside the playground and Waldschänke. Earlier
  polar-wolf stock is not represented as today's stock. The three visible grey
  and buff wolves are illustrative individuals, not a current census.
* [Official gastronomy](https://www.zoo-berlin.de/de/zoo-erleben/gastronomie)
  identifies Zoo-Talia, Waldschänke and Café Kolibri in the bird house.
  [Waldschänke's official photograph](https://www.zoo-berlin.de/de/aktuelles/news/artikel/fruehstuecksangebot-in-der-waldschaenke-1)
  and [event photographs](https://www.zoo-berlin.de/de/zoo-erleben/ihr-event)
  support its timber character, warm window frames and sign. Window spacing,
  sign size and small fittings are estimates on the actual outside facets.
* [Current visitor plan](https://www.zoo-berlin.de/de/tickets-service/zoo-plan)
  and its [2026 PDF](https://www.zoo-berlin.de/fileadmin/zoo-berlin/Service/Zoo-Plan/Flyer/WEB_ZAB_Parkplan_2026_v2_DE.pdf)
  were used for orientation only. The [Adlerschlucht page](https://www.zoo-berlin.de/de/zoo-erleben/tiere-erlebniswelten/adlerschlucht)
  identifies the distinct large owl aviary; it is not substituted for the
  retained condor or marsh-bird aviaries.

The retained OSM inventory fixes wolf habitat way 48164524, condor aviary
way 32995989 (`Vultur gryphus`, alongside `Dendrocygna viduata`), neighbouring
marsh-bird aviary way 32995991, Waldschänke way 48126084 and Zoo-Talia way 25396899.
The two existing condor positions receive white wing panels, pale hooked bills,
head combs and feet. Three anatomically legible static wolves and twenty small
shrubs fit inside the exact wolf polygon, clear of existing paths, buildings
and water. Their exact positions and poses are estimates. Aviary roof bracing
follows the retained roof edges; it does not introduce a speculative new dome.

## Restaurant evidence, elevations and limitations

The evidence gzip retains four complete original official parents from the
already cached `LoD2_387_5818.zip` and `LoD2_387_5819.zip`, each with archive SHA256,
all original rings and surfaces, OSM tags, twelve prior presentation prisms,
49 bDOM responses and three DGM responses. Its SHA256 is
`09b50592ff8772fd20849629a55077322aee99788c57dcf00664662b606eefea`.

Three parents supply eleven Waldschänke parts:
`DEBE01YYK0002L18`, `DEBE01YYK0003Ucs`, `DEBE01YYK0003V9i`.
The fourth, `DEBE01YYK0002RFN`, is tree-obscured. Its six bDOM values range from
42.58 to 49.83 m NHN and do not distinguish roof from vegetation. It remains
unchanged and is explicitly excluded from replacement ownership.

All source X/Z coordinates, ring topology and source surface categories of the
eleven replaced official parts are retained. Only these five named vertical
profiles change. Values below are roof ranges **before** the common per-parent
translation onto the existing Zoo display ground at Y=5.2 m:

| Part | Original roof Y | Corrected roof Y | Independent evidence and confidence |
| --- | ---: | ---: | --- |
| DEBE3Dvqp4td5FVH | 15.283–22.679 | 7.80–9.20 | Eight bDOM points: 38.07–44.83 m NHN; lower interior roof cluster supports a low roof, higher branches remain ambiguous. Roof range is an approximation. |
| DEBE3DYGt4szGakz | 16.160–19.220 | 7.65–8.50 | Five points: 38.11–42.60 m NHN. Partly obscured transition roof; expressly an estimated shape. |
| DEBE3DI70n23Xdak | 10.965–23.345 | 7.65–8.15 | Seven interior points: 37.70–38.11 m NHN, incompatible with the old tall proxy. |
| DEBE3DqgzekHK7XE | 25.438 | 7.50 | Five points: 37.04–37.58 m NHN, supporting a low flat roof. |
| DEBE01YYK0003Ucs | 23.126–24.179 | 6.50–6.91 | Seven points: 36.50–36.91 m NHN; open canopy with separate posts. |

Raw source Y equals NHN minus 30 m. Original parent ground values are retained
in evidence; a per-parent translation places the finished model on Y=5.2.
The other six official parts retain their original vertical shape. The five
new ranges are bounded display corrections, not a claim to a complete new
roof survey. bDOM includes vegetation and its acquisition year was not
established. It must not be treated as vegetation-free roof data.

Zoo-Talia uses the exact retained OSM footprint. Five bDOM roof values are
39.54–39.97 m NHN. The DGM centre is 35.14 m NHN, giving the adopted flat roof
height 39.70−35.14=4.56 m, instead of the old 9 m fallback. Two nearby ground
samples show slope, so the single flat display roof is also an approximation.

The evidence stores every complete GetFeatureInfo URL, world point and original
JSON response. Requests use EPSG:25833, a one-metre BBOX, WIDTH=HEIGHT=1,
I=J=0. Sources are `https://gdi.berlin.de/services/wms/bdom`, layer `b_bdom`, and
`https://gdi.berlin.de/services/wms/dgm1`, layer `c_dgm1`. For example, the Talia
ground query is world(-2027,1293), EPSG centre(387473,5818707), returning 35.14 m
NHN on 2026-10-26. World mapping is X=easting−389500,
Z=5820000−northing. The raw responses preserve their timestamp and datum labels.

## Construction, ownership and navigation

`scripts/build_zoo_west_v276.py` deterministically emits twelve complete parts,
84 surfaces/220 triangles, 3,149 independent native body/roof rows and 71 bounded
facade fitting locations. Five open canopy parts remain roof slabs and separate
13 cm posts. Native roofs are independently sampled at one metre and rounded
upward to quarter-metre roof levels, with their exact occupied cell unions.
Drawn roofs preserve the continuous corrected triangles. Fittings are checked
against every actual replacement volume, including canopy lower surfaces.

`appendZooWestV276` appends to the existing Zoo's batches before the static
freeze. `zooWestSolidsV276(native)` supplies complete body profiles, native cell
unions, local canopy lower surfaces and distinct posts. The shared
`zooWestV276` option activates them in core navigation and source retirement.
`isZooWestSourceV276` accepts only the twelve exact original prism records.
`createZooWestColumnTesterV276` binds 87 exclusive old native column tuples;
17 shared columns remain, with 80 neighbour fingerprints protecting overlap.
Changed, missing, duplicate or newly overlapping owners fail closed. There is
no rectangle mask and no source-data deletion.

The existing first native batch is compressed by joining only exactly touching
same-colour boxes with identical X/Y/width/height. Resolution, roof samples and
occupied volume are unchanged. This takes 22,439 old rows to 17,053 and saves
409,336 buffer bytes. A cell-by-cell **multiset** comparison against the actual
submitted Float32 matrices proves every old volume, colour and duplicate;
the historical original matrix hash is also independently reconstructed.
Disjoint intervals, changed colours and nonorthogonal rows are tested.

## Validation and actual submitted cost

All earlier Zoo, recognition and hippo regressions pass alongside the new work:

* Python: 16 passed across `test_zoo_west_v276.py`, `test_zoo_grounds_v165.py`,
  `test_zoo_recognition_v255.py`, `test_zoo_hippo_v256.py`.
* Bun: 14 passed across the corresponding four files; 2,418,897 assertions.
  The actual shared navigation is exercised through day, native, night and day
  again. Three fixed restaurant witnesses lose the old high phantom collision,
  their ground bodies remain solid, an open shelter passage stays free and
  every canopy retains its local thin underside. Changed-source fallback is
  verified separately.
* Ruff passes for the two generators and new Python tests.

| Actual complete Zoo buffers | Before | After | Unchanged ceiling |
| --- | ---: | ---: | ---: |
| Drawn | 2,297,524 B | 2,491,692 B | 3,300,000 B |
| Native | 7,477,504 B | 7,348,608 B | 7,500,000 B |

Drawn retains 6 draws and has 10,527 instances/61,934 geometry vertices. Native
retains 3 draws and has 96,678 instances/72 shared-box geometry vertices.
There is no mobile reduction; the same complete static model is submitted.
New JSON sizes are 236,894 B plus 22,459 B ownership; evidence gzip is 10,508 B.
Focused logs are `~/.cache/codex-berlin-v276/pytest-zoo-west.log` and
`~/.cache/codex-berlin-v276/bun-zoo-west.log`. These source, geometry and
navigation tests do not claim browser endurance or whole-city performance;
the root task records integrated browser and release verification separately.
