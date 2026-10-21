# Littenstraße and Zur letzten Instanz — v257

This is an additive Step 10 refinement of the surviving courthouse and three
measured Waisenstraße fronts. Source footprints, the full v183 roof model,
all previous windows, navigation and courtyard voids remain untouched.

The courthouse's missing frontage had a specific cause: the v183 generator
skipped wall segments shorter than 3 m before creating its upper wall skins.
The curved entrance risalit consists almost entirely of such short segments.
v257 completes those exact source planes, including the curved courtyard
planes, with the **same explicitly estimated Y27 upper eave**. The original
3.081 m source-height conflict is retained and documented; this is not a new
survey or height override. New shallow giant pilasters, arched window groups,
portal crown and rustication recall the surviving Littenstraße facade. The
demolished Grunerstraße towers are not reconstructed. The older v229 courtyard
entrance accents remain present.

Zur letzten Instanz is bound to the existing LoD2 owners
DEBE01YYK0000626, DEBE01YYK00009MO and DEBE01YYK00008M9, with OSM ways 43165217,
315548172 and 315548174 as identity context. It gains four central window axes,
three dormer cues, divided glazing, ochre shutters, brown name fascia, entrance
lanterns and two steps. The operator's contemporary brown/ochre treatment
takes precedence over the older green shutters/sign visible in the LDA view.
No speculative Molkenmarkt construction or road realignment is introduced.

The source and reference register is in
`src/app/src/data/littenInstanzV257.json`. `scripts/build_litten_instanz_v257.py`
replays it entirely from retained official sources. Reference images are
inspection-only and are not shipped. Dimensions of applied ornament are
illustrative. References:

- [LDA 09011278](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011278),
  exterior photograph `Mit/04/09011278b.jpg`: LDA-Archiv, Bittner 2008.
- [Landgericht Berlin II building history](https://www.berlin.de/gerichte/landgericht-zivil/das-gericht/wir-ueber-uns/historisches/littenstrasse/artikel.1310862.php).
- [LDA 09011253](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09011253),
  Waisenstraße photograph `Mit/04/09011253a.jpg`: LDA-Archiv, Bittner 2008.
- [Zur letzten Instanz operator](https://zurletzteninstanz.com/en/start-en/),
  `wp-content/uploads/2021/11/zurletzteninstanz.jpg`: Zur letzten Instanz – Sperling OHG.

All additions join the existing justice instance batch: **zero new render
objects**, no live textures and identical drawn geometry on touch devices.
Native mode has separately generated axis-aligned exterior block strips,
including stepped arch profiles. Neither branch changes loading radius,
cache, triangles-per-frame or other live resource policies.

QA cameras are embedded in the source register; the main views are
court eye `[2777,48,153]`, target `[2856,15,80]` and restaurant
eye `[2838,10,247]`, target `[2865,8,235]`.
