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
| Queer Rainbow Memorial Berlin | Living broadleaf tree, six-colour heart and tied fabric, dense flowers, candles, messages and small Pride flags | The owner-supplied Ahornsteig place point fixes the position. The 4.057 m official-mesh point sample remains recorded; the visible base follows the 4.479 m continuous terrain surface used by the drawn park. The current bounded OSM extract has no corresponding named object. Tree dimensions, species and the changing offering arrangement remain explicitly unverified, field-view-bounded display estimates. |
| CSD memorial place at Ahornsteig (French maple and rainbow bench) | Already leafed young crown, pale protected trunk, round segmented metal tree guard, sparse static small Pride flags, wreaths and unlettered cards, and rainbow-slatted bench | OSM node `14076715427` fixes the separate ensemble anchor; Bezirksamt Mitte documents the French maple, protective grid and rainbow bench. The displayed tree is 5.30 m high with a 2.60 m crown diameter and 0.12 m trunk diameter; its square planting pit is 1.55 m wide, the guard is 1.50 m in diameter and 2.10 m high, and the bench is 2.05 m wide and 0.82 m high. These local model values, bench offset/orientation and offering placement are current-view-bounded design dimensions only, not survey measurements or official dimensions. |

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
- Bezirksamt Mitte, establishment and intended use of the CSD memorial place:
  <https://www.berlin.de/ba-mitte/aktuelles/pressemitteilungen/2026/pressemitteilung.1699951.php>
- Berlin.de summary and rbb24 report on the French maple, protective grid and
  rainbow-coloured bench:
  <https://www.berlin.de/aktuelles/10556192-958090-ahornbaum-und-regenbogenbank-erinnern-an.html>
  <https://www.rbb24.de/panorama/beitrag/2026/08/berlin-anschlag-csd-baumpflanzung-gedenkort.html>
- OpenStreetMap, exact separate ensemble anchor:
  <https://www.openstreetmap.org/node/14076715427>
- Per-file licensed visual references and credits:
  [`../references/wikimedia/README.md`](../references/wikimedia/README.md)

No external photograph is copied into the WebGL scene. The procedural layer is
kept in source code, uses flat-shaded materials for a crisp model-railway read,
and batches the 2,710 Holocaust stelae into one draw call. That large instance
batch receives existing scene shadows but does not cast 2,710 additional
shadow objects, preserving responsive camera flight on mobile hardware.

The Queer Rainbow Memorial is likewise generated entirely from procedural
geometry. The supplied photographs are not bundled or projected as textures;
they only bound the recognisable arrangement. Its 132 flower stems, petals and
centres, 30 candles, 24 messages and five small flags are rendered as bounded
instance batches so close inspection does not turn into hundreds of draw calls.

The separate CSD memorial place is also generated entirely from procedural
geometry and stays present in all five visual modes. Its young French maple,
round tree guard, restrained static Pride offerings and rainbow bench use
source-bound placement plus explicitly non-surveyed local display dimensions.
Supplied screenshots and press photographs are visual evidence only: none is
bundled, copied,
projected or converted into a texture, and the small cards carry no reproduced
personal text.
