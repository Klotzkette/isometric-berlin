# Step 10 — Reichstag and Brandenburg Gate refinement

The v1.0 viewer retains the committed LoD2/OSM anchors, Reichstag building
envelope, Gate column axes and five passage widths. Day, Night, Snowstorm and
Schwellenraum use the same drawn geometry and existing material/ink system.
Minecraft substitutes its own opaque, fixed-palette cube batches.

## Evidence and representation

The [Bundestag's detailed dome description](https://www.bundestag.de/besuche/architektur/reichstag/kuppel)
specifies 30 rows of 12 mirrors, two 230 m ramps starting 180° apart, an
observation platform at 40.7 m above ground, a 24 m terrace and 200 m² platform
area. It describes the moving aluminium-louvre sunshade and a 10 m crown
opening. The model now uses those mirror counts, flat paired ramp decks,
the corresponding 16.7 m platform elevation and open crown. The existing
40 m diameter, 23.5 m dome height, 24 ribs and 17 rings remain.

There are conflicts within the official descriptions: the
[general architecture page](https://www.bundestag.de/besuche/architektur/reichstag/architektur)
calls the crown opening 8 m; the detailed dome page says 10 m. We use the
specific technical description. Its prose rounds platform elevation to 40 m,
while its table gives 40.7 m; the table governs. Its 8% ramp grade cannot be
reconciled exactly with both the stated ramp length and endpoint elevations.
The render retains the length and endpoints; it does not claim a surveyed
grade, curvature or ramp cross-section.

The annular platform plan, 1.8 m deck width, rail subdivision, mirror tilt and
30 displayed sunshade louvres are procedural choices. The shade shows one
static pose; it does not simulate the real tracking mechanism. Mirror layout
is corrected from 15 × 24 to 30 × 12 without adding more mirrors. The paired
helices share a winding direction and start half a turn apart, avoiding the
previous crossing paths. `MinecraftHeroNavigation` imports the same
`domeRadius` helper, so the crown change is not a separate collision shape.

[Bildhauerei in Berlin's metope inventory](https://bildhauerei-in-berlin.de/bildwerk/metopen-triglyphenfries-10441/)
records 32 roughly 1 × 1 m sandstone reliefs on the two long faces, depicting
Lapith/centaur scenes. The viewer replaces its former 48-panel rhythm with
32 panels and puts the shallow reliefs beyond the opaque frieze face so they
are visible. Triglyph grooves reuse the existing line batch. The 34 separating
triglyphs, 204 guttae and relief poses are display subdivisions, not individual
survey records.

Pauline Ahrens's [*Zug der Friedensgöttin* inventory](https://bildhauerei-in-berlin.de/bildwerk/zug-der-friedensgoettin-10442/)
places the executed attic relief on the east side and gives 7.63 × 1.51 m.
The planned western counterpart was never executed. The viewer now has one
field of those dimensions on the east; the 18 simplified figure marks are
not a claim about the number of people in the historical composition.
Credits: Bernhard Rode, design; Johann Gottfried Schadow, model; Conrad
Nicolas Boy and Georg Christian Unger, execution. Sources accessed 2026-09-07.
No source photograph, scanned carving, plan or texture is copied or loaded.

## Minecraft reading

The Reichstag gains stepped paired ramps, an open platform, a widening
four-tier silver cone and a stepped sunshade. Its broader intermediate dome
courses contain those additions; the final ring retains a 10 m square opening.
All courses remain aligned to the building's local axes. The Gate uses six
shaft courses within the actual 1.73 m column diameter instead of the former
2.8 m blocks, preserving the five clear passage widths. It gains the 32-panel
frieze and eastern attic field. Four smaller horses now face east toward
Pariser Platz, with separated legs, necks, reins, open chariot wheels, wings
and an eagle-topped standard. The smooth Quadriga is not duplicated.

## Bounded geometry budget

Reproduce with `cd src/app && bun scripts/audit-hero-refinements.ts`.
These are stored renderables and geometry/index/instance buffer bytes per
root, before distance/visibility culling. They include the normally hidden
night-glow mesh, and are not a live frame-rate claim. Shared resources are
counted once within each root; resource sharing between roots is not deducted.
Full and mobile use these same hero shapes.

| Root | Renderables before → after | Rendered vertices before → after | Buffer bytes before → after |
| --- | ---: | ---: | ---: |
| Reichstag dome | 35 → 37 | 37,437 → 37,829 | 1,065,644 → 1,011,188 |
| Reichstag building | 234 → 234 | 60,511 → 60,511 | 497,316 → 497,316 |
| Brandenburg Gate | 178 → 176 | 128,056 → 126,438 | 2,106,796 → 2,104,788 |
| Minecraft Reichstag | 1 → 1 | 7,848 → 11,736 | 25,692 → 38,004 |
| Minecraft Gate | 1 → 1 | 3,216 → 8,376 | 11,024 → 27,364 |

Together the drawn refinements add no stored renderables and remove 56,464
buffer bytes. Minecraft adds 377 blocks and 28,652 instance-buffer bytes,
while retaining one batch per landmark. Reichstag has 489 blocks and Gate
349. All seven civic signatures together have 5,184 blocks, under the
updated 5,500 limit, and still share one cube geometry and one material.
The fixed-palette and restrained-metal budgets pass.

## Verification

The 36 focused tests cover the source mirror arrangement, noncrossing flat
ramp geometry and length, envelope containment, eastern-only attic relief,
visible metope placement, block horse direction, measured column clearance,
all five Gate navigation passages, deterministic positive transforms,
quarter-turn block alignment, and absence of coplanar top overlaps. TypeScript
compilation passes. Whole-world baselines and browser review belong to the
v1.0 integration checks.
