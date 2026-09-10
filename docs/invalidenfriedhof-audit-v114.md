# Invalidenfriedhof mapped-grave audit — v1.0.14

Pipeline step 10. The harbour correction prompted a second check of the
cemetery, especially the Scharnhorst lion monument and coverage of mapped
graves. No source record, monument anchor or tour record changes.

## Demonstrated correction

The drawn cemetery retained 34 OSM grave points. Five points belong to the
individually modelled monuments or the Rauch family ensemble, leaving 29
ordinary markers. Once Minecraft's native world became active, its visibility
policy hid the drawn cemetery; the native factory rebuilt the five detailed
monuments but omitted those 29 other markers.

Minecraft now also places a box-native marker at each of the 29 original
points, in both full and mobile profiles. Their small dimensions and rotation
are the existing drawn representation's procedural display estimates. The
five detailed tombs still own their source points, preventing duplicate markers
inside Scharnhorst, Witzleben, Winterfeld, Kessel and the Rauch family ensemble.
No unrecorded burial or speculative inscription is added; this is coverage of
the retained mapped points, not a claim to survey every burial in the cemetery.

The 29 boxes join existing opaque palette batches and add 1,856 buffer bytes
and 696 rendered instance vertices, with no additional draw call or texture.

| Minecraft profile | Draw calls | Instances | Rendered vertices | Unique buffer bytes |
| --- | ---: | ---: | ---: | ---: |
| Full | 11 | 9,519 | 228,456 | 699,504 |
| Mobile | 11 | 6,679 | 160,296 | 483,664 |

## Monument and evidence check

The [Landesdenkmalamt ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010206)
was rechecked on 10 September 2026. It confirms Scharnhorst's two-pier
sarcophagus, Tieck frieze, bronze lion and Schinkel railing, as well as
Witzleben's Renaissance canopy and four eagles, Winterfeld's granite/bronze
composition, and the Rauch family crosses. These existing recognition models
remain intact; no new photograph or external visual asset is used.

Scharnhorst remains at OSM node `273120316` and retains its published 5.60 m
overall height. The structural lion, mane, ears and railing remain outside its
near-only detail group; fading the facial and relief microdetail does not remove
the lion. Its current unchanged geometry measures 9 drawn renderables / 16,978
rendered vertices and 572 Minecraft blocks across four shared palette batches.
These values reflect the existing green-patina/ear refinement; earlier frozen
figures of 8 renderables and 566 blocks predate that refinement.

## Validation

Two new ray tests intersect actual Three.js box geometry above every ordinary
source point in full and mobile Minecraft. Both failed on the prior factory at
the first omitted grave and now pass for all 29 points. Together with the
existing cemetery, v1.0.9 and pedestrian-access suites, 20 tests / 1,431
assertions pass. Existing tests verify the source-bound Scharnhorst envelope,
unchanged detailed-monument budgets, open bell undercroft, wall gaps, static
presentation and texture-free geometry. This is geometry validation, not a new
physical iPhone or browser visual test.
