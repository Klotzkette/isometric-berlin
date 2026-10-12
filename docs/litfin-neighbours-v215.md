# Kieler Eck neighbours · v215

This bounded correction covers the **three numbered residential neighbours of the
Günter Litfin memorial**, not the watchtower, hospital, canal, adjoining streets or
other Europacity blocks. All original LoD2 geometry and previous models remain.
No source owner, building part or courtyard is replaced or removed.

| House | Retained LoD2 owner | OSM way | Parts | Visible correction |
|---|---|---|---:|---|
| Kieler Straße 3 | `DEBE01YYK0000AUT` | `51801913` | 3 | Red plaster; the two separately measured projecting oriels; tall paired openings with three thin horizontal rails; roof gallery; open rear balconies with red parapets and alternating side screens. |
| Kieler Straße 2 | `DEBE01YYK0000E2h` | `51801914` | 2 | Blue-grey plaster and the existing angular bay facing the memorial, expressed as dark glazing with pale mullions and floor divisions. |
| Kieler Straße 2a | `DEBE01YYK0000B3h` | `51801915` | 2 | Salmon courtyard frontage; paired pale window frames, light attic band and thin terrace rails. |

## Evidence and limits

- The architect's primary [Kieler Straße 3 project](http://www.maedebach-redeleit.de/projekt.jsp?projId=337)
  identifies Maedebach & Redeleit and the exact address, 14 flats, one office floor
  and two shop units. Its three project photographs show the sharp red projecting
  oriels, elongated openings, sloped roof and rear balcony boxes. They were
  inspected only; no copyrighted photograph is bundled, traced as texture or
  reproduced in the app.
- [Stiftung Berliner Mauer: Gedenkstätte Günter Litfin](https://www.stiftung-berliner-mauer.de/de/gedenkstaette-guenter-litfin)
  confirms the memorial and canal context.
- [Gedenkstätte Günter Litfin, Kieler Straße 2, Berlin-Mitte.jpg](https://commons.wikimedia.org/wiki/File:Gedenkst%C3%A4tte_G%C3%BCnter_Litfin,_Kieler_Stra%C3%9Fe_2,_Berlin-Mitte.jpg),
  **Neuköllner**, 15 July 2024, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):
  courtyard material relationships and attic terrace. Already in the project's
  reference manifests; source photograph not bundled.
- [Gedenkstätte Günter Litfin Berlin.jpg](https://commons.wikimedia.org/wiki/File:Gedenkst%C3%A4tte_G%C3%BCnter_Litfin_Berlin.jpg),
  **Singlespeedfahrer**, 10 December 2021, [CC0](https://creativecommons.org/publicdomain/zero/1.0/):
  grey angular glazed bay with pale framing and salmon neighbour. Already in the
  project's reference manifests; source photograph not bundled.

The photographs establish public exterior recognition, not a measured facade
survey or current ownership. Window counts, rails, member sections and colours
are small display fits. Exact parent IDs, all seven original part IDs, exterior
wall vertices and heights come from the retained official source packet. Party
walls are excluded using occupancy of **all** packet buildings. There are no
invented shop signs or changes to hidden interiors.

## Geometry and runtime

`scripts/build_litfin_neighbours_v215.py` reproducibly extracts 54 exterior wall
planes from `alt-mitte-v169/source-389_5821-00.json.gz`. The source receipt records
its SHA-256. Gables use their actual polygon, so no rectangular cap covers the
pitched silhouette. The two oriel masses belong to the original LoD2 parts and
are **not** doubled by this model.

Drawn modes use a texture-free triangle skin 0.205 m outside the original wall
plane, clearing the v169 generic detail's maximum 0.125 m offset. New windows and
balcony members sit farther out. This replaces the generic *visible reading* on
only these three named houses while retaining its data and every measured shell.
The original roofs remain intact. Drawn mobile and desktop use identical buffers.

Minecraft uses an independent orthogonal 0.5 m surface-cell model. The surfaces
sit beyond the retained coarse native shell; no filled building volumes are
allocated. Per-cell writes resolve overlapping features once, and same-colour
adjacent cells are merged along a row. No duplicate smooth mesh is used.

| Model | Instances | GPU attribute/index bytes | Draw calls |
|---|---:|---:|---:|
| Drawn | 1,621 detail members plus exact polygon skins | 136,264 | 2 |
| Native | 13,377 merged surface rows | 1,017,300 | 1 |

No textures, extra render targets, animation, background fetches, deferred
building rebuilds or mobile quality reduction are introduced. Factory:
`createLitfinNeighboursV215(minecraft, { mobileLike })`. Reference camera:
position `[-145,39,-1690]`, target `[-87,17,-1649]`.

Focused validation: 2 Python source-integrity/reproducibility tests and 3 Bun
recognition, exact-budget, mobile-parity and native-uniqueness tests pass. Root
integration provides full-scene visual and release validation.
