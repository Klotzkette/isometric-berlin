# Monument Detail And Evidence Status

The true-3D viewer adds small procedural recognition models for seven memorials
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
| Memorial to the Sinti and Roma murdered under National Socialism | Dark circular reflecting basin, central triangular stone, surrounding remembrance path | Characteristic form follows the responsible foundation and licensed reference images; uncited radii are approximate. |
| Memorial to Homosexuals Persecuted under Nazism | Tall concrete cuboid and inset viewing window | Characteristic form follows the responsible foundation and licensed reference images; uncited dimensions are approximate. |
| Soviet War Memorial Tiergarten | Broad stair, six side pylons, central pylon, soldier, two T-34 silhouettes and rifle | Berlin's official pages document the composition and an 8 m soldier on a total height around 20 m. Local spacing and simplified vehicle dimensions are approximate. |
| Goethe Monument | Standing Goethe, cylindrical pedestal and three allegorical groups | Composition follows the Berlin monument inventory and licensed references; uncited dimensions are approximate. |
| Beethoven-Haydn-Mozart Monument | Three-sided marble stele, three busts, gilded dome, three putti and laurel wreath | Berlin's monument inventory states a 10 m monument and the characteristic three-composer, coloured-marble and gilded-crown composition. |
| Memorial to Jehovah's Witnesses persecuted and murdered under National Socialism | Slender folded column with a broad flared crown | The responsible foundation documents Matthias Leeck's bronze sculpture and its public opening on 24 June 2026. Shape follows the committed licensed 2026 references; height is not claimed as surveyed. |

## Primary sources

- Foundation Memorial to the Murdered Jews of Europe, Holocaust memorial facts:
  <https://www.stiftung-denkmal.de/denkmaeler/denkmal-fuer-die-ermordeten-juden-europas-mit-ausstellung-im-ort-der-information/>
- Foundation pages for the Sinti/Roma, homosexual-victims and Jehovah's
  Witnesses memorials:
  <https://www.stiftung-denkmal.de/denkmaeler/>
- Berlin Senate, Soviet War Memorial Tiergarten:
  <https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/friedhoefe-und-begraebnisstaetten/sowjetische-ehrenmale/tiergarten/>
- Berlin monument inventory, Großer Tiergarten subobjects including Goethe and
  the Beethoven-Haydn-Mozart monument:
  <https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318>
- Per-file licensed visual references and credits:
  [`../references/wikimedia/README.md`](../references/wikimedia/README.md)

No external photograph is copied into the WebGL scene. The procedural layer is
kept in source code, uses flat-shaded materials for a crisp model-railway read,
and batches the 2,710 Holocaust stelae into one draw call. That large instance
batch receives existing scene shadows but does not cast 2,710 additional
shadow objects, preserving responsive camera flight on mobile hardware.
