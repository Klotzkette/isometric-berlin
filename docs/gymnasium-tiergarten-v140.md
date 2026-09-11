# Gymnasium Tiergarten Neubau and Hand mit Uhr

Pipeline step 10, v1.0.40. The bounded refinement covers the 1970s school
extension and its existing hand sculpture. The GRIPS courts and the school's
older brick building retain their separate models.

## Evidence and source preservation

- The [school's building account](https://gymnasium-tiergarten.de/schule/gebaeude/)
  identifies the 2009–2011 refurbishment, the projecting **blue Aula** and
  Joachim Schmettau's hand, restored in 2012.
- The [school's architectural history](https://gymnasium-tiergarten.de/schulleben/veranstaltungen/krankenhaus-oder-schule/)
  dates the extension to 1971–1975. The [official school inspection](https://gymnasium-tiergarten.de/site/assets/files/1027/01y12_b_20200201_909.pdf)
  describes its six-storey organisation.
- Original Geoportal Berlin LoD2 parent `DEBE01YYK0002KxL`, tile
  `LoD2_387_5820.zip`, creation date 2026-03-01, retains all **13 parts**,
  source sheets, archive SHA-256 and earlier display prisms in
  `src/app/src/gymnasiumTiergartenSource.json` (17,764 bytes).
  Regenerate with `uv run python -m scripts.build_gymnasium_tiergarten_source`.
- The original ground is 4.332 m in viewer coordinates. A rigid 0.868 m
  display translation puts it on the existing 5.2 m street datum. All source
  footprints, roof steps and height differences remain intact. The source's
  rounded surface extrema and measured-height attributes differ by up to 1 mm;
  neither is overwritten. Three low parts identify the projecting Aula.
- Four freely licensed photographs are individually credited below and in
  both packaged/reference manifests. They establish white render, red vertical
  window strips, glazed lower fronts, narrow stairwell windows, blue Aula and
  upper service volume. Window pitches, frame sizes, entrance lettering and
  local door members are procedural recognition fits, not a facade survey.
  Windows are clipped to the source roofs and covered inner walls are omitted
  from the added facade layer. No photograph becomes a texture or runtime asset.

## Hand identification and uncertainty

The work is **Hand mit Uhr**, Joachim Schmettau, 1975, at retained OSM node
`5140418371`, viewer `[-2147.5, 5.2, -78.7]`. The
[Hansaviertel association](https://hansaviertel.berlin/interbau-1957/kunst/)
also identifies its appearance in Depeche Mode's 1983 music video;
this is factual identification only, without music, lyrics or video imagery.

The wrist points upwards. Four fingers and the separate thumb curve **down**
around the offset orange cube. The lower pedestal is white concrete and the
black watch face carries geometric red digits. The old generic abstract marker
is suppressed only at this exact OSM node. Smooth and block-native forms have
separate, static geometry; the clock uses a fixed illustrative display, with no
timer, animation callback, texture or additional light.
Static vertex shading makes the palm and curved digits readable in daylight.
The hand stands on a small, approximately 3.6 × 3.6 m tiled apron, with a
1.8 m pedestrian connection to retained OSM footway `1104087086` at
`[-2151.634,-72.277]`. The photographed paving establishes the material, but
the apron outline and connecting width are explicit display estimates. They
do not assert a mapped road or enlarge the source campus. The new paving
stays clear of school stairs and the roadways.

Published height/material descriptions conflict: the association gives 5.50 m
and Neusilber, while the Berlin-Mitte lexicon as quoted in the
[encyclopaedia entry](https://de.wikipedia.org/wiki/Hand_mit_Uhr) gives 4.5 m
including the pedestal; the school calls the metal bronze. The model uses a
**4.5 m display height**, recorded as non-surveyed, with the photographed dark
silver-grey surface. Both reported heights remain in the profile and conflict
ledger. Anatomy, tilt and local member proportions remain procedural estimates.

## External photograph credits

All four use [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
and remain unbundled references:

- Fridolin freudenfett, [Hansaviertel Altonaer Straße Gymnasium Tiergarten.JPG](https://commons.wikimedia.org/wiki/File:Hansaviertel_Altonaer_Stra%C3%9Fe_Gymnasium_Tiergarten.JPG), 9 April 2016.
- Fridolin freudenfett, [Hansaviertel Lessingstraße Gymnasium Tiergarten-001.JPG](https://commons.wikimedia.org/wiki/File:Hansaviertel_Lessingstra%C3%9Fe_Gymnasium_Tiergarten-001.JPG), 9 April 2016.
- Michael T Alemu, [Gymnasium Tiergarten.jpg](https://commons.wikimedia.org/wiki/File:Gymnasium_Tiergarten.jpg), 31 August 2015.
- Rlbberlin, [Joachim Schmettau – Hand mit Uhr 2013.jpg](https://commons.wikimedia.org/wiki/File:Joachim_Schmettau_-_Hand_mit_Uhr_2013.jpg), after the 2012 restoration.

## Rendering and validation

Full and mobile profiles retain the same geometry. Smooth uses four draws
for school source sheets, instanced facade members, the hand and its plinth;
Minecraft uses two native box batches with exposed building envelopes and no
hidden solid infill. Both source and instance buffers are finite and static.
The combined final buffers occupy **549,320 bytes** in Smooth (2,105 cube
instances plus the retained source/hand sheets) and **255,136 bytes** in
Minecraft (3,340 cube instances). Mobile uses exactly the same detail.
The source shell and roof-aware pedestrian obstacles share the same parts;
the hand blocks only its narrow represented core, leaving the forecourt open.

Focused tests cover retained source planes, exact regeneration, all 13 source
IDs, the three Aula parts, hand identity and five digits, static/buffer budgets,
and free approaches around the pedestal. The existing GRIPS roof, courtyard,
covered-passage and U9 approach regression tests also pass.

Recommended QA poses (world metres, FOV 39°): school camera
`[-2100,42,-42]`, target `[-2153,20,-115]`; Aula camera `[-2127,14,-59]`,
target `[-2148,11,-96]`; hand camera `[-2143,8,-71]`, target
`[-2147.5,7.65,-78.7]`. Final production screenshots and release checks are
recorded in the release review.
