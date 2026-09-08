# Invalidenfriedhof refinement — v1.0.9

Pipeline step 10. Existing cemetery, grave, canal-wall and Hinterlandmauer
anchors remain unchanged. The 93-place catalogue and source payloads are
unchanged. No image, texture, new historical quotation or grave inscription
is bundled.

## Evidence and corrections

The [Landesdenkmalamt ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09010206)
identifies Witzleben's cast-iron Renaissance canopy, female genius and four
crowned eagles. It also identifies Winterfeld's granite monument with bronze
trophy and medallion, its Schinkel enclosure and Stüler's Rauch family
composition of marble crosses. These facts correct the old pointed Gothic
canopy, low Witzleben base and pale Winterfeld trophy. Scharnhorst retains
its previously reviewed exact OSM anchor, two piers, 5.60 m silhouette,
structural lion, iron fence, conservation context and render budget.

The [Landesdenkmalamt Wall account](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-berliner-mauer/mauer-denkmale/invalidenfriedhof-648151.php)
distinguishes the 1902 canal-side brick boundary from the preserved concrete
Hinterlandmauer. The latter's restored east face carries long white fields
within grey surrounds. The existing source traces and gaps remain unchanged.
New brick-pier caps and masonry joints supplement the retained wall body.
Minecraft now uses complete, thin wall slabs on the same traces: the old
1.1 m cubes widened the actual barrier and left small gaps between samples.

The bell retains exact OSM node `7430297888`, LoD2 part `K0001yqp`, its
5.01 × 5.00 m source footprint and 10.044 m measured envelope. Its published
1.60 m bell diameter remains separate from estimated structural subdivisions.
The actual silver steel frame is square and tapered; it carries three tiers
of folded sheet panels above an open bell bay and undercroft. The old
four-sided cylinder produced a misoriented diamond-shaped concrete body.
The replacement has four continuous legs, twelve folded metal panels,
horizontal rails, suspension braces and a permanently visible bell. Snow is
limited to top rails rather than an unsupported plate over the open casing.
The original LoD2 source remains present as evidence; the existing narrow
render/collision replacement remains restricted to that bell part.

## Inspected free visual references

All five files were retrieved through Wikimedia's imageinfo API and inspected
at useful resolution. They support visible forms and materials, not metric
survey. Their exact attribution records are mirrored in the canonical and
packaged Wikimedia manifests by the release integration.

| File | Creator | Selected licence | Visible evidence |
|---|---|---|---|
| [Bell frame close view](https://commons.wikimedia.org/wiki/File:Berlin-Mitte_Invalidenfriedhof_Glockenturm_mit_Auguste-Viktoria-Glocke_der_Gnadenkirche_Nahaufnahme.JPG) | Assenmacher | CC BY-SA 3.0 | Four continuous silver legs, three tiers of folded sheet panels, open bay and suspension braces |
| [Job von Witzleben](https://commons.wikimedia.org/wiki/File:Invalidenfriedhof,_Grabmal_Job_von_Witzleben.jpg) | Beek100 | CC BY-SA 4.0 | Tall patinated plinth, round arches, pediments, female genius, four eagles |
| [Hans Karl von Winterfeldt](https://commons.wikimedia.org/wiki/File:Invalidenfriedhof,_Grabmal_von_Winterfeldt.jpg) | Beek100 | CC BY-SA 4.0 | Brown granite, bronze cuirass and helmet trophy, black fence |
| [Rauch family](https://commons.wikimedia.org/wiki/File:Invalidenfriedhof,_Grab_von_Rauch.jpg) | Beek100 | Public domain | Ochre round-arched aedicule and neighbouring white crosses |
| [Historic cemetery wall](https://commons.wikimedia.org/wiki/File:Invalidenfriedhof,_Friedhofsmauer_mit_K%C3%B6nigslinde.jpg) | Beek100 | CC BY-SA 4.0 | Red brick, white inset fields, projecting pier crowns and dark coping |

All local grave proportions, repeated bay spacing, birds, figures, roof folds
and lettering-free relief marks remain bounded display estimates. The Rauch
crosses indicate the family ensemble within its existing ownership footprint;
they do not claim a new survey of every individual family burial. The distant
structural Witzleben figure/eagles, Winterfeld trophy and bell stay visible
when near-only detail fades.

## Modes, collision and validation

Day, Night, Snowstorm and Schwellenraum share the protected, static drawn
models. Minecraft uses separate box geometry; no smooth doubles are added.
The Günter-Litfin replacement is imported from
[`LitfinWatchtower.ts`](../src/app/src/LitfinWatchtower.ts); see its separate
[evidence record](litfin-watchtower-refinement.md). Both cemetery factories
accept `mobileLike` and forward it to that replacement.

Collision follows the taller Witzleben base and open canopy bays, Winterfeld
fence, Rauch crosses, bell legs and hollow sheet casing, and brick pier caps.
Existing paths and wall gaps remain open. The original bell coarse prism is
exempted only at positions where authored physical solids are absent.

Factory budgets include the separate Litfin model and hidden snow geometry:

| Profile | Renderables | Instances / meshes | Stored vertices | Rendered vertices | Unique buffer bytes |
|---|---:|---:|---:|---:|---:|
| Drawn full | 53 | 1,874 | 3,235 | 62,960 | 216,320 |
| Drawn mobile | 53 | 1,792 | 3,235 | 60,992 | 210,088 |
| Minecraft full | 11 | 9,490 | 264 | 227,760 | 697,648 |
| Minecraft mobile | 11 | 6,650 | 264 | 159,600 | 481,808 |

103 focused tests across the cemetery, Litfin, expanded-city, detail-fade and
static-frame suites passed. New ray tests intersect actual bell sheet faces,
verify the four round arches and confirm a clear bay above the solid plinth.
Actual Three.js triangles and instance matrices were exported and inspected
in orthographic software views of the bell, Witzleben, graves and both wall
systems. These are geometry QA views, not a browser or device test.
