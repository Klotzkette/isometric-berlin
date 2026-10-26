# Central theatre roofs and stage buildings — v274

The Friedrichstadt-Palast stage block had its long dimension aligned into the
building instead of along its frontage. Its front edge consequently covered an
area where the official surface-height samples show the lower roof. This pass
replaces only that precisely receipted authored stage recipe. The real high
block is represented by four walls and a closed thin roof, roof coping, panel
reveals and shallow roof hatches. The existing full main footprint, foyer,
windows, concrete-glass bands, lettering and all other details are retained.

The published LDA heights remain 20 m for the main building and 32 m for the
stage building (world roof 37.2 m above the existing 5.2 m base). The LDA's 23 m
short dimension remains. The interpreted long dimension is 31 m, parallel to
the frontage, with local centre `u=-0.5, out=-66.5`. That long dimension, setback
and small fittings are estimates from the official 2025 orthophoto and 56
bounded bDOM samples, **not surveyed facade or building-edge coordinates**.
Both runtime mesh and walking profile use the revised roof, hatch and coping
positions. No raw LoD2 sheet is discarded or rewritten.

Other additions are physical roof details attached to the existing buildings:

- Deutsches Theater: stage roof edge and four shallow smoke-monitor bodies on
  its retained 25.3 m stage building; all 27 DT/Kammerspiele source parts and
  all entrance, garden, facade and DT-lettering details remain.
- Berliner Ensemble: three shallow roof monitors along the existing fitted
  ridge. The four measured parts, roof cap, stripped present-day facade and
  existing independently moving sign remain unchanged.
- Heinrich-Böll-Stiftung: raised atrium-cover framing and beams plus the two
  service housings above the previous thin roof fields. The low cantilever and
  open space underneath remain untouched.
- Volksbühne: parapet and central roof monitor on the **stage tower**, and five
  small auditorium roof vents. This addresses the user's clarified
  “Bühnenturm und Bühnenaufbauten”. The complete v209 stage body at world
  42.254 m, auditorium at 28.889 m and rear pitched roof at 33.019 m remain.
  No bookshop is introduced. The existing entrance, columns and Räuberrad remain.

Those roof fitting dimensions and precise opening placement are bounded visual
interpretations. The source roofs and previously measured upper volumes remain
the height authority. This does not claim a complete new survey of the venues
or every adjacent building.

## Retained evidence and sources

`geo_data/regierungsviertel/central-theatres-v274-evidence.json.gz` retains all
46 parts of five complete LoD2 parent records, including original rings, holes,
wall and roof sheets; the raw ZIP's SHA-256; four full old Palast stage recipes;
56 bDOM request URLs and height results; three DOP request URLs, bounds and
image hashes; and exact relevant retained native columns. Bindings also protect
the unmodified DT, Böll and v209 Volksbühne sources. The official archive is
`geo_data/regierungsviertel/raw/lod2/LoD2_390_5820.zip`.

The generator normally replays that committed evidence offline. Explicit
`--refresh-source` re-extracts the original archive and retained local acquisition
records; it is deliberately separate from normal deterministic generation.
Cached orthophotos are QA references only and are not runtime assets.

Primary references:

- [Landesdenkmalamt, Friedrichstadt-Palast building description](https://www.berlin.de/landesdenkmalamt/_assets/pdf-und-zip/aktuelles/kurzmeldungen/efriedrichstrasse-107.pdf)
- [Friedrichstadt-Palast operator factsheet](https://www.palast.berlin/wp-content/uploads/2024/11/Der-Palast-in-Berlin-FactSheet_FF.pdf)
- [Deutsches Theater technical portal](https://www.deutschestheater.de/service/technikportal)
- [Ernst Architekten, Deutsches Theater refurbishment](https://www.ernst-architekten.de/portfolio-items/deutsches-theater-berlin/)
- [Berliner Ensemble, Theater am Schiffbauerdamm](https://www.berliner-ensemble.de/index.php/das-theater-am-schiffbauerdamm)
- [LDA, Theater am Schiffbauerdamm](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011192)
- [Heinrich-Böll-Stiftung, actual headquarters](https://www.boell.de/de/das-stiftungshaus-der-schumannstrasse)
- [LDA, Volksbühne](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080037)
- [Geoportal Berlin DOP 2025 service](https://gdi.berlin.de/services/wms/dop_2025_fruehjahr)
- [Geoportal Berlin bDOM service](https://gdi.berlin.de/services/wms/bdom)

Official Berlin geodata: `dl-de/zero-2-0`. Existing OSM main footprint and source
attribution remain unchanged. No photograph, video, new texture or font is added.

## Integration and resource bounds

At the end of `planFriedrichstadtPalast`, return
`replacePalastStageV274(p, detailProfile, minecraft)`. The transaction validates
all old `stage-*` positions, dimensions, rotations, colours and ordering in all
three buckets before returning a new plan; a mismatch or repeat application
throws before mutation. It cannot retire a changed or added authored detail.
The separate `palastStageV274TopAt` replaces the old stage rectangle branch;
the main-building owner and footprint guards stay in place.

Add `createCentralTheatresV274(native, {mobileLike})` once to the existing
required static landmark construction for each visual mode. It is an additive
roof group; do not suppress any DT, BE, Böll or Volksbühne source owner.

The new runtime JSON is 205,815 bytes. Drawn mode uses 53 replacement Palast
boxes plus 100 additive roof boxes; native mode uses 2,583 replacement Palast
cells plus 1,161 additive roof cells. The latter are independently axis-aligned
surface cells, not rotated smooth duplicates or a filled voxel volume. Closed
native roof cells meet without cracks; their edge interpretation is bounded
to half a 0.7 m cell. Existing native roof support is respected: DT 33.2 m,
BE 28/28.1 m, Volksbühne stage 43 m and auditorium 29 m, Böll 28.8 m.

The additive group has one final-sized instanced draw batch (7,600 bytes of
matrix/colour buffers drawn, 88,236 native, plus one shared unit-box geometry).
Palast replacements join its existing batches. Mobile receives identical full
static detail; no animation, per-frame decoding, descriptor rewriting, texture,
cache ceiling, tile residency or prefetch change is introduced. Decoded packed
rows live only during construction. Encoded source and the additional final
geometry do consume memory; this is not a claim of identical total heap usage
or a guarantee against operating-system memory termination.

## Checks

`tests/test_central_theatres_v274.py` checks deterministic replay, all 46 source
parts against the original archive, hash bindings, bDOM/footprint agreement,
owner containment, original v209 upper bodies, native support and finite bounds.
`src/app/tests/central-theatres-v274.test.ts` checks four profile transactions,
fail-closed source drift, unchanged unrelated object identity, full mobile
detail, orthogonal native matrices, actual mesh occlusion over retained roofs,
closed native Palast roof cells and integrated stage/navigation extents.
The earlier Palast facade and walking regression file is also run.

The frozen static-detail fingerprint was reconciled only for Friedrichstadt-Palast.
An independent execution of its pre-v274 Git source reproduced the original v141
full/mobile fingerprint exactly: 4 draws, 288 stored vertices, 4,801 instances,
370,876 bytes. The current model keeps 4 draws/288 vertices and has 4,824 instances,
372,624 bytes: exactly 53 new stage boxes minus the 19 old stone and 11 old glass
stage boxes, or 23 instances / 1,748 bytes. Every non-stage recipe row is identical
in all four full/mobile and drawn/native variants. The source revision, file
fingerprints, old/new stage counts and non-stage row hashes are retained in
`src/app/tests/fixtures/palast-static-stage-v274-audit.json`; the narrowly scoped
`static-model-full-overrides-v274.json` contains only FriedrichstadtPalast.
Both the independent receipt test and the existing Palast mobile/full fingerprint
test pass. No unrelated historical snapshot was updated.

No browser or real-device stability run is performed by this subtask. The root
integration is responsible for the production build and final whole-scene QA.
