# Siegessäule architecture refinement

Step 10, 2026-09-07. The monument keeps its committed Großer Stern anchor,
67 m overall silhouette, 8.32 m Viktoria, 25.3 m square base and sixteen-column
hall. The shaft now reads as four slender, physically fluted sandstone drums
that become taller upwards. Short gilded cannon profiles occupy the lower
three registers; the upper register has laurel festoons. Stone annulets replace
the former thick gold rings. A moulded foot, capital with eagle-frieze cues and an
open octagonal viewing rail complete the shaft. Five square approach steps and
granite cornices improve the base silhouette.

## Evidence and limits

- [Landesdenkmalamt Berlin, object 09050419](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050419)
  identifies the sandstone shaft, trophies in the lower drums and octagonal
  observation platform. The relief and mosaic registers retain their existing
  source contract.
- [Berlin's historical information panel](https://www.berlin.de/kunst-und-kultur-mitte/geschichte/erinnerungskultur/gedenktafel-datenbank/id-1084_geschichte-der-siegessaeule.pdf)
  documents three groups of twenty cannon trophies, upper laurel and the
  eagle frieze. Eight procedural eagle cues suggest its carving; that sampling
  is not an asserted inventory count.
- [Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/siegessaeule-4706/)
  describes the upward-growing, slimming drum sequence and laurel on the upper
  drum; its inventory supplies the retained overall, base, hall and figure
  dimensions. The official panel identifies Obernkirchner sandstone.
- The already pinned [BugWarp full-height photograph](https://commons.wikimedia.org/wiki/File%3ABerlin_Victory_Column_-_BugWarp_01.jpg),
  CC0, supplies proportional and material QA. The source photograph remains
  reference-only; no image texture or new image asset is loaded.

Drum radii, relative heights, short cannon proportions, five-step subdivision,
capital carving and railing spacing are explicitly procedural display
approximations, not measured architecture. Published overall figures are not
fully consistent: the current Berlin.de visitor text states 69 m, while the
specialist inventory and visitBerlin state 67 m. The established 67 m contract
is retained. This refinement does not assert a surveyed observation-floor
elevation or reconstruct individual historical battle scenes.

## Representation and bounded cost

Day, Night, Snowstorm and Schwellenraum reuse the same merged architecture.
Small baked face-tone variations reveal the flutes in the unlit Day material.
The v1.0.24 [Goldelse refinement](goldelse-v124.md) retains west orientation,
helm, layered wings, raised wreath and standard while refining body, face and
drapery. No mode rebuild is introduced.

The architecture helper supplies 365 parts / 26,784 vertices, merged into the
existing bodies mesh. The complete Siegessäule/Bismarck root remains five
renderables / 62,776 stored vertices, including ink. No new draw call is added.

Minecraft uses the same four-drum stack, replaces the old wide shaft slab with
stepped octagonal sections, and retains the 67 m top. Its 304-block main batch
now includes short trophies, an open viewing rail and a west-facing figure with
two stepped feather fans, drapery, open wreath, helmet and standard. The hall
columns now share the drawn 4.7 m height and floor/roof levels. Reliefs and
mosaic remain separate batches in their correct architectural registers. All
four existing monument batches total 340 blocks; no smooth ornament double is
added.

The exact source socle footprint and vertical fingerprints of LoD2 parts
`3wUufHpn`, `iHbVUwP0` and `xzlowEa3` suppress their 37 coarse Minecraft
columns before generic bodies or windows are emitted. This removes the grey
building shell that previously covered the red base and lower shaft. The
predicate uses the committed source outline and cell-rounded heights; it does
not clear a surrounding landmark radius or change the source collision data.

Focused tests cover the retained total heights, increasing/slimming drum
sequence, sixty short lower trophies, upper laurel, eight-sided open rail,
Minecraft figure attributes and draw/vertex limits. Existing tests continue to
cover attribution, texture-free materials and static mode changes.
The source-replacement regression also checks exact provenance, all 37 delivered
columns, unrelated heights and adjacent-building retention in full and mobile.
