# Alexander public realm — v1.0.49

This bounded step-10 addition supplies the Marx–Engels monument ensemble and
Neptunbrunnen at current OpenStreetMap anchors, plus **59 missing individually
mapped trees** in the Marx–Engels-Forum. The previous 161 Forum trees and all
source road/park payloads remain unchanged. No row of trees is inferred.

## Source positions and current state

The retained September 2026 OSM extract (`raw/east_v148/east.osm`, ignored) is
filtered by `scripts/build_alexander_public_realm.py`. The compact generated
`alexanderPublicRealmSource.json` keeps all source rings, exact projected
centroids, IDs, source digests and tree merge evidence. It uses the existing
world frame `[389500, 5820000]`, east-positive X and south-positive Z.

- **Marx and Engels:** sculpture footprint way `895523111`, centred at
  `[2238.468817, 5.245, 98.114784]`. The separate way `895523112` is the roughly
  60 m-wide installation circle; treating that circle as the statue would
  misplace and dramatically oversize the figures. The modern bronze pair has
  seated Marx, standing Engels, broad overcoats, lapels, trousers, shoes,
  hands, hair and beards. It faces toward the Fernsehturm.
- **Alte Welt:** exact marble-relief footprint way `895523113`; five broad
  relief sections. Four paired steel steles and two bronze reliefs retain
  their six separately mapped OSM node positions. Photo-bearing steel panels
  are suggested through shallow silver fields; no historical photograph is
  copied or bundled.
- **Neptunbrunnen:** current fountain way `23813204`, centred at
  `[2403.288079, 5.245, -24.372009]`. Its complete mapped four-lobed waterline is
  retained, surrounded by a continuous moulded red-granite rim. Four Tritons
  carry the shell, seated Neptune holds the ten-metre-high trident silhouette,
  four river allegories sit on the rim, and turtle, crocodile, seal and snake
  carry inward water jets. Elbe fruit, Rhine net/grapes, Vistula logs and Oder
  goat are small procedural recognition cues.

[Landesdenkmalamt Berlin](https://www.berlin.de/landesdenkmalamt/aktivitaeten/kurzmeldungen/2022/marx-engels-denkmal-kehrt-an-original-standort-zurueck-1230178.php)
records the original ensemble order, its almost four-metre bronze pair and
return to the central site in 2022.
[Jörg Kuhn, *Schlossbrunnen*, Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/schlossbrunnen-7847/)
provides the fountain's 18 m basin, 10 m total height, reddish granite, bronze,
shell, Tritons, animals and four river figures. Individual anatomy, moulding
widths, surface subdivisions and other unpublished dimensions are procedural
display estimates, not survey measurements. The OSM polygon describes the
waterline; the shallow rim profile extends a few decimetres around it.

**No completed 2028 park is invented.**
[Grün Berlin's current project ticker](https://gruen-berlin.de/projekte/urbane-freiraeume/rathaus-und-marx-engels-forum/projekt-ticker)
reports ongoing works in 2026, including the playground and new path work.
Existing mapped tree positions and the returned monument layout remain the
model's evidence. No future ramp, completed construction landscape or
unconfirmed new planting is presented. The existing mapped paths remain. The existing renderer incorrectly showed lawn
inside the mapped circular monument court; the exact way `895523112` now adds
its photograph-confirmed hard surface at world Y 5.285 m, four centimetres
above the retained park terrain. This is the existing court, not future park
construction. No surrounding surface is rebuilt.

## Additive tree merge

All 220 tree points in the OSM Forum polygon are accounted for: 161 match an
existing drawn tree within two metres; the remaining 59 are added. No old tree
is suppressed. All 59 new points are also at least three metres from every
retained native Minecraft tree-cell centre, checked against the complete
source payload, even before Minecraft's ordinary thinning. Both source
payload hashes are retained and tested. Unknown tree height and crown size
are explicitly marked display estimates. Ground height uses the existing
local park terrain level, not a new terrain survey.

## Representation and navigation

Day, Night, Snowstorm and Schwellenraum retain exactly the same static drawn
geometry on touch and pointer devices. The complete root carries memorial
protection so Schwellenraum leaves the sculptures' normal materials intact.
Native Minecraft is a separate cube batch; no smooth duplicate is shown.
The native water surface is at 5.675 m, above the retained plaza cells at 5.52 m
and below the 5.935 m granite lip. Its native row centres are lifted by 24 cm
relative to the initial model so the existing paving cannot hide the water;
no terrain or source street is lowered. Collision/support surfaces are unchanged.
The fountain water is clipped into native horizontal runs instead of filled
radial bounding boxes. No underground solid infill or texture is introduced.

Physical collision covers sculpture cores, the actual small plinth, mapped
marble relief, fountain rim and individual tree trunks. It does **not** close
the large ensemble circle or the surrounding Forum. A fast bounding check
avoids scanning these solids while walking elsewhere. The low plinth provides
a step height, and its top plane is excluded from solid-foot collision.

Measured budgets (same on desktop and mobile):

| Representation | Draw calls | Instances | Geometry + instance bytes |
| --- | ---: | ---: | ---: |
| Drawn | 5 | 1,127 | 392,792 |
| Native Minecraft | 1 | 4,392 | 334,728 |

No runtime image, font, external resource or new tour stop is required.

## Visual references and checks

Both external Commons files were checked at their free-license file pages,
downloaded only into `/tmp`, and visually inspected:

- Josef Streichholz, 12 September 2022,
  [*Denkmal für Karl Marx und Friedrich Engels*](https://commons.wikimedia.org/wiki/File:Denkmal_f%C3%BCr_Karl_Marx_und_Friedrich_Engels.jpg),
  CC BY-SA 4.0. This is the returned original location, not the 2010–2022
  temporary roadside position.
- Mike Peel, 21 April 2024,
  [*At Berlin 2024 201*](https://commons.wikimedia.org/wiki/File:At_Berlin_2024_201.jpg),
  CC BY-SA 4.0. Used for the shell, seated Neptune, Tritons, patina and moulded
  red-granite bowl. Credits remain attribution-only in the packaged manifests.

Focused checks: 3 Python source/bounds/tree-preservation tests; 6 Bun tests
cover equal touch detail, native separation, finite bounded buffers, exact
trident/water raycasts, native-water clearance over the retained source plaza,
navigation, memorial protection and all tree IDs. A real pedestrian-controller
regression walks off the small plinth without catching on its trailing edge;
support persists for the body capsule until its trailing foot clears the step.
Local Chrome views of both monuments, drawn and native, plus the complete
Forum were inspected. Production/mobile checks are recorded in the release
review. No claim is made about physical older-iPhone hardware testing.
