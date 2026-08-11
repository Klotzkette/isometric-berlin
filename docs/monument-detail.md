# Monument Detail And Evidence Status

The true-3D viewer adds small procedural recognition models for memorials
whose defining shapes are easily lost in aerial photogrammetry. These models
are additive cues over the official Berlin 3D Mesh, not replacements for it.
They use the committed landmark coordinates and do not claim surveyed site
geometry unless a dimension is explicitly listed below.

The manifest's landmark camera anchors all use a generic `38 m NHN` height.
Each procedural model is therefore grounded separately at the fifth-percentile
surface elevation sampled around its coordinate from the committed official
Berlin 3D Mesh. This prevents floating plinths without claiming a surveyed
monument foundation height.

## Evidence table

| Memorial | Retained recognition cues | Metric status |
|---|---|---|
| Memorial to the Murdered Jews of Europe | Complete field, depressed terrain cue, individually varied and slightly tilted stelae | The responsible foundation currently states 2,710 concrete stelae, 0.95 x 2.38 m each, 19,073 m² field area and four published height bands. Count, cross-section and height-band totals are exact; scene footprint/orientation is approximate. |
| Memorial to the Sinti and Roma murdered under National Socialism | Black reflecting pool in a dark-coated steel pan, retractable triangular granite stone with daily flower, German/English rim poem, broken-granite apron, 69 crime-site stones, segmented glass/Corten chronology and nine-biography 2022 exhibition cues | The responsible foundation publishes the approximately 12 m pool diameter and 69 named places; Dani Karavan's catalogue publishes a 2.5 x 60 x 60 m overall artwork extent. Those figures are exact model contracts; uncited stone, panel and local-spacing dimensions remain visual-reference approximations. |
| Memorial to Homosexuals Persecuted under Nazism | Tall concrete cuboid and inset viewing window | Characteristic form follows the responsible foundation and licensed reference images; uncited dimensions are approximate. |
| Soviet War Memorial Tiergarten | Street-facing forecourt, broad stair, six side pylons, central pylon, soldier, two T-34/76 tanks, two ML-20 gun-howitzers and rifle | Berlin's official pages document the south-facing entrance on Strasse des 17. Juni: tanks left and right at the road, guns diagonally behind at the first stair, and an 8 m soldier on a total height around 20 m. Local spacing and simplified vehicle dimensions are approximate. |
| Goethe Monument | Standing Goethe, cylindrical pedestal and three allegorical groups | Composition follows the Berlin monument inventory and licensed references; uncited dimensions are approximate. |
| Beethoven-Haydn-Mozart Monument | Three-sided marble stele, three busts, gilded dome, three putti and laurel wreath | Berlin's monument inventory states a 10 m monument and the characteristic three-composer, coloured-marble and gilded-crown composition. |
| Memorial to Jehovah's Witnesses persecuted and murdered under National Socialism | Slender folded column with a broad flared crown | The responsible foundation documents Matthias Leeck's bronze sculpture and its public opening on 24 June 2026. Shape follows the committed licensed 2026 references; height is not claimed as surveyed. |
| Rousseau Column | Three-zone sandstone/limestone column with spiral lower bossing, bowl-like middle and floral crown | Berlin's sculpture inventory documents the 2.2 m total height and three-zone carved composition; the OSM point fixes its position on Rousseau Island. |
| Lortzing Monument | Two-step marble platform, apsidal pedestal, five opera putti, standing Lortzing with pen and musical score | Berlin's sculpture inventory documents 6.5 m total height, marble material and the five-putti composition; local part proportions are reference-based. |
| Tree-donation memorial | Four-part shell-limestone pillar with inscription and incised-relief registers on three faces | Berlin's sculpture inventory documents material, four-part construction and relief/inscription programme; uncited section dimensions are approximate. |
| Flora/Pomona and *Das deutsche Volkslied* | Flora with fruit, tree support and putto; separate seated embracing pair with lyre | Berlin's sculpture inventory documents each composition and material family. OSM fixes position; uncited dimensions remain reference-based presentation geometry. |

## Primary sources

- Foundation Memorial to the Murdered Jews of Europe, Holocaust memorial facts:
  <https://www.stiftung-denkmal.de/denkmaeler/denkmal-fuer-die-ermordeten-juden-europas-mit-ausstellung-im-ort-der-information/>
- Foundation pages for the Sinti/Roma, homosexual-victims and Jehovah's
  Witnesses memorials:
  <https://www.stiftung-denkmal.de/denkmaeler/>
- Dani Karavan studio catalogue, Sinti & Roma Memorial materials and overall
  dimensions:
  <https://www.danikaravan.com/portfolio-item/germany-the-sinti-roma-memorial/>
- Berlin Senate, Soviet War Memorial Tiergarten:
  <https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/tiergarten/>
- Berlin monument inventory, Großer Tiergarten subobjects including Goethe and
  the Beethoven-Haydn-Mozart monument:
  <https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318>
- Berlin public-sculpture inventory, Rousseau, Lortzing, Baumdank, Flora and
  *Das deutsche Volkslied*:
  <https://bildhauerei-in-berlin.de/>
- Per-file licensed visual references and credits:
  [`../references/wikimedia/README.md`](../references/wikimedia/README.md)

No external photograph is copied into the WebGL scene. The procedural layer is
kept in source code, uses flat-shaded materials for a crisp model-railway read,
and batches the 2,710 Holocaust stelae into one draw call. That large instance
batch receives existing scene shadows but does not cast 2,710 additional
shadow objects, preserving responsive camera flight on mobile hardware.
