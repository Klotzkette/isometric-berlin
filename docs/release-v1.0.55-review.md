# v1.0.55 — eastern Charité, Fernsehturm surroundings and fine detail

Pipeline step 10. This release extends the historic campus treatment east of
Luisenstraße and fills the previously missing entrance-pavilion group at the
Fernsehturm. It also refines the Memorial Church and the fictional Schwellenraum
vapour requested by the owner.

## Architectural scope

The [campus source review](charite-east-v155.md) covers six eastern families: the I. and II. Anatomisches Institut,
Humboldt Graduate School, Tieranatomisches Theater, Tieranatomie and
Ostertaghaus. Their 35 additional source parts are bound to the existing metric
prisms. Every earlier family and roof record remains. The theatre's coarse
3 m lower source envelope is retained as evidence; a separate source-outline
interpretation supplies its two-storey body, round lecture hall and green dome.
Other mapped campus footprints and roofs remain authoritative.

The HU reference identifies the temporary lecture tent as Audimax II / Haus 33
on the Philippstraße campus. The user reports ongoing dismantling; no invented
temporary demolition frame is added without a reliable current outline.

At Alexanderplatz, [complete official pavilion source sheets](fernsehturm-pavilions-v155.md) locate the paired
glazed wings, folded overhanging roofs, gallery and stair approaches. Fine
facade spacing is a display interpretation of official descriptions and
licensed photographs. The older tower, monuments, fountain and mapped trees
remain in place. Stair and gallery support are shared by both viewer worlds.

The [church finish](gedaechtniskirche-fine-detail-v155.md) adds Roman clock
numerals, belfry capitals and copper-sheet joints. The corrected v154 ruin,
71 m maximum, different openings and retained low wings remain unchanged.

The [vapour effect](fernsehturm-steam-v155.md) adds pale blue accents and slow
curling movement to predominantly rose wisps, with four intermittent fountains.
It remains exclusive to Schwellenraum and is explicitly fictional.

## Preservation and resources

Full drawn detail is identical on touch and desktop; Minecraft remains a
separate native model. Previous preservation fixtures are frozen and only
explicitly changed families receive new baselines. No existing street, boundary,
landmark, catalogue entry or photographic asset is removed.

The church adds 25,272 geometry bytes to the drawn City West group, still at
12 draw calls; its native model remains one batch. The animated steam uses one
draw call and 2,396 fixed buffer bytes, without textures or per-frame particle
allocation. Existing animation pause, cancellation and disposal rules remain.

## Validation

- Ruff formatting and lint passed; all 501 Python tests passed after packaging.
- 85 focused building, walking, presentation and steam tests passed, followed by
  two additional theatre-render regressions and four complete native-world
  construction checks. The measured synchronous and cooperative hashes match.
- 78 isometric-city/construction-lifecycle tests passed, as did the 35 full/mobile
  static-detail preservation checks and 50 earlier native-model preservation checks.
- An independent source audit confirmed all 11 earlier Charité families, 146
  facade parts, 152 roof records and raw prism/voxel/building payloads unchanged.
  The 39,067 earlier western facade detail records retain their exact hash.
- Final stored native-world buffers total 320,524,054 bytes on full and
  111,195,666 bytes on mobile. These are geometry/instance figures, not a claim
  about total browser memory.
- TypeScript and the production Vite build passed. The existing large-chunk
  advisory remains. Release readiness and extracted local-package smoke passed.
- Production Chrome and Playwright 1.62.0 / WebKit 2336 with the iPhone 13 profile
  each passed 22 checks: all five modes, camera continuity, one active theatre
  representation, repeated movement and no runtime or HTTP errors. Screenshots
  at the church, eastern campus and tower pavilions were inspected.
- The steam-specific runtime probe passed separately on both engines, covering
  immutable buffers, visible animation, reduced-motion pause, offscreen pause,
  resume without catch-up, and visibility through all mode switches.
- ZIP: 35,785,353 bytes, SHA-256
  `8948790ffbb7e12978c56399a27199901401c36c90e37df57cc5fac8fd8a6291`.
  Static TAR.GZ: 35,669,462 bytes, SHA-256
  `b74ab79e947591b65248035aa4ad24e6002c8dfb15e6f04a46119389bd1001e9`.
- Pages staging preserves all 1,386 previously hosted paths and verifies all
  59 current build files byte-for-byte. Old hashed modules remain available to
  already-open tabs.

The known WebKit 2359 context-loss finding from the
[v153 review](release-v1.0.53-review.md) is not claimed to be resolved by these
architectural additions. Browser emulation does not establish compatibility
with a physical iPhone's memory and GPU limits.
