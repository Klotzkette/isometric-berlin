# Berliner Ensemble neighbours — step 10, v1.0.118

This bounded pass refines the existing Schiffbauerdamm 5, 6–7, 8 and 12
frontages, the Albrechtstraße wing of number 8 and the Neues Haus courtyard
facade. The main theatre, neighbouring landmarks, streets and all 52 measured
LoD2 records, holes, heights and roofs remain unchanged. No source JSON or
city packet is regenerated. Other building groups keep every earlier detail.

## Visible changes and evidence

- Number 5 and the plain 6–7 front retain their restrained plaster reading,
  with a clearer shop lintel and dark shopfront frames/fanlights. The existing
  number 5 arched upper openings remain. Reference: [Jörg Zägel, 2010,
  CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Schiffbauerdamm_5,_Mietshaus.jpg)
  and [Dguendel, 2015, CC BY 4.0](https://commons.wikimedia.org/wiki/File:Berlin-Mitte,_H%C3%A4user_Schiffbauerdamm_6-8.JPG).
- Number 8 keeps its stone balustrades and gains clearer horizontal stone
  bands. Its Albrechtstraße face additionally has red brick fields and
  triangular window hoods, distinct from the paler river front. The latter
  features were checked against [Molgreen's 30 June 2023 photograph,
  CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:20230630_xl_0818-Koepjohannsche_Stiftung,_Wohn-und_Gesch%C3%A4ftshaus_Schiffbauerdamm_8,_Albrechtstra%C3%9Fe_13-14.jpg).
  They are restricted to street-facing walls of the existing number 8 owner
  with westward normals; no other Albrechtstraße house inherits the pattern.
- Number 12 receives ochre stringcourses, small outlined stucco panels and
  brown shopfront framing, following [Ansgar Koreng, 2014,
  CC BY 3.0 DE](https://commons.wikimedia.org/wiki/File:141209_Schiffbauerdamm_12_Berlin-Mitte.jpg).
  Existing balconies and the original roof remain.
- The [operator's current courtyard photograph](https://www.berliner-ensemble.de/node/386)
  (Dronebrothers, `Drohne_Hofe_01-web.jpg`) shows the Neues Haus golden screen,
  modular joints, lower glazing and stacked white name. This corrects the
  old invented punched-window grid on **one face only**: owner `YCHo1QS2`,
  edge `(974.6, -373.6)` to `(953.2, -363.5)`. Its 114 old facade-grid blocks
  yield to this source-supported recognition layer; other faces, complete
  building envelope and roof stay untouched. The courtyard remains unfilled.
  The operator identifies the venue as the converted workshop/rehearsal
  building opened in 2019. The screen is an opaque, coloured glazing reading
  with coarse ribs, without transparency overdraw or a mesh texture.

The photographs are external references only. The three older Commons credits
already exist in both attribution manifests; the Molgreen reference is the
one additional credit. The operator photograph is not copied or distributed.
No current shop advertisements or promotional artwork are reproduced.
Member widths, window relationships, screen subdivisions, colour shades and
sign placement are bounded photo-based display estimates, not new surveys.
The golden screen does not claim a measured wire gauge or precise material
specification. No additional roof volume is invented.

## Preservation and performance

All additions share the existing two instanced facade batches. Day, Night and
moonlit materials remain; snow uses the existing scene presentation. Drawn
touch and pointer plans are identical, and the separate native construction
keeps every new recognition feature. There are no textures, external runtime
assets, loops, new residency budgets or tour stops.

With the actual delivered source prisms and native voxel payload:

| Profile | Draw calls | Instances | Geometry/instance bytes |
| --- | ---: | ---: | ---: |
| Drawn, full and mobile | 3 | 19,514 | 1,537,496 |
| Native, full | 2 | 22,911 | 1,741,884 |
| Native, mobile | 2 | 19,565 | 1,487,588 |

The no-context planner grows from 21,082 to 21,540 blocks. Its full earlier
plan was captured before editing: every previous block outside `YCHo1QS2`
remains byte-for-byte identical; the only removed blocks are the 114 inaccurate
Neues Haus front-grid blocks noted above. An independent regression digest
locks the untouched earlier plan. Existing source-preservation, facade
raycasts, roof support and two-/three-draw-call budget tests remain applicable.

Verified: 11 focused tests / 520 assertions pass across
`friedrichstrasse-architecture.test.ts` and `ensemble-neighbours-v218.test.ts`;
`bun --bun tsc -b --pretty false` and `git diff --check` pass. The original
source JSON retains SHA-256
`a65b4fee9af1ba0b21539a10a5a3bd25f10caf41a71220eada69217af04e405a`.
These are source/geometry checks, not a real-phone performance measurement.
