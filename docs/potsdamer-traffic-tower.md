# Potsdamer Platz traffic tower — v1.0.12

This step-10 change replaces the former solid, square, permanently three-coloured
marker with one source-bound representation of the present-day replica. It adds
no tour stop, changes no city bounds and does not alter the controls.

## Position and evidence

The original OSM way `241572310` remains in `osm.gpkg`, `street-details.json` and
the source-fusion manifest. Its six original perimeter vertices are also recorded
in `potsdamerTrafficTowerProfile.ts`. The model uses the unrounded EPSG:25833
polygon centroid: viewer `[302.4015680925, 1081.7137531834]`, approximately
`13.3762592648 E, 52.5092345129 N`. The older decimetre payload rounds this to
`[302.4,1081.7]`; neither anchor moves to the historical traffic island.
The ground value `5.2 m` is the packaged bilinear surface sample; the older coarse
voxel sampler returned `5.4 m`. The platform extends 0.36 m above this ground.
No LoD2 footprint lies within three metres of the centroid, so no building source
is suppressed. Only the old generic monument geometry for the exact OSM key is
superseded; its protected-memorial source ownership is retained.

Berlin's [11 December 2024 transport history](https://www.berlin.de/sen/uvk/presse/pressemitteilungen/2024/pressemitteilung.1512202.php)
provides the 8.50 m height, five-sided structure and horizontal red/yellow/green
lights. Its [traffic-management account](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/verkehrsmanagement/ampeln-und-co/)
also describes the blue auxiliary lights at the corners. Jörg Kuhn's
[Verkehrsturm inventory entry](https://bildhauerei-in-berlin.de/bildwerk/verkehrsturm-7891/)
records five supports, a glazed cabin, five clocks, the steel/glass materials and
the donor plate's present-site installation date, 29 September 2000. The
[site operator](https://www.potsdamerplatz.de/de/explore/verkehrsturm-ampel/)
confirms the replica's current location and its 2000 installation.

The dark-green steel, open space below the cabin, clock/window proportions,
projecting round eave, shallow five-sided roof, signal brows and small base plaque
are procedural subdivisions guided by the three freely licensed photographs
listed below. Local dimensions and orientation are estimates; the source ring
is not silently replaced by a claim of a surveyed regular pentagon. Clock hands
show an authored 10:10 recognition cue rather than promising the current time.
No photo, tracing, lettering texture or runtime image is bundled.

## Light behaviour and uncertainty

The [documented account of the modern replica](https://de.wikipedia.org/wiki/Verkehrsturm_am_Potsdamer_Platz#Nach_dem_Zweiten_Weltkrieg)
states that it displays changing signals without controlling road traffic. The
inspected Luis Alvaz photographs show green and red lenses on the replica, and
the 2024 BugWarp photograph shows an illuminated red lens. These corroborate the
working display, but are not a measurement of its controller in September 2026.
The linked 2011 Bezirksamt repair announcement now returns HTTP 404; it is not
used as independently retrieved evidence. No inspected current source publishes
exact phase durations or assignments to the five faces.

Accordingly, the viewer uses an explicitly approximate, calm 36-second display:
16 seconds red, 2 red/amber, 14 green, 4 amber. Selected neighbouring faces have an
18-second offset so that every side regularly changes while the tower does not
become a simultaneous five-sided flashing object. These offsets and the modern
red/amber phase are presentation choices, not asserted replica-controller data
or the original manually operated 1924 program. The pale-blue corner housings
are static; no unsupported rapid auxiliary flashing is invented.

Both representations use the same monotonic scene clock. Lighting and mode
changes preserve phase. Reduced motion pins the lamps to green, following the
existing traffic-signal policy. Night lights-off dims all fifteen signal lenses.
Only phase boundaries change instance colours; no geometry is rebuilt and the
tower does not force continuous rendering. The runtime only checks an on-screen,
visible tower.

## Geometry and validation

| Profile | Drawn calls / retained bytes | Native Minecraft calls / instances / bytes |
| --- | --- | --- |
| Full | 3 / 478,260 | 3 / 1,766 / 135,512 |
| Mobile | 3 / 371,124 | 3 / 998 / 77,144 |

Each representation retains five open steel supports, five clock faces and all
fifteen horizontal signal lenses. Minecraft uses only world-axis box instances
with thin surfaces and stepped circular details. The wrapper owns both versions;
exactly one is visible per mode. Drawn Day, Night, Snowstorm and Schwellenraum use
the same silhouette; the source-protected memorial keeps its ordinary Day
materials in Schwellenraum. Vertex colours are enabled only on geometry that
actually supplies a colour attribute; native cubes use instance colours.

The dedicated tests check source position, 8.50 m complete height, empty rays
through the open lower structure, unobstructed lens rays on all faces in both
profiles, full/mobile geometry budgets, texture/attribute contracts, phase
boundaries, negative time, reduced motion, lights-off and mode continuity. The
existing generic-monument test now verifies retained source ownership and the
absence of the former duplicate tower. Actual Three.js triangles and matrices
were exported to front, isometric and mobile-Minecraft software QA plates and
inspected. These plates are geometry checks, not GPU/browser/iPhone validation.

## Inspected external photographic references

Retrieved 9 September 2026. All three are CC BY-SA 4.0; each receives an individual
record in both bundled attribution manifests. Photos remain external.

- BugWarp, [Berlín en agosto de 2024 - BugWarp (45).jpg](https://commons.wikimedia.org/wiki/File:Berl%C3%ADn_en_agosto_de_2024_-_BugWarp_(45).jpg), 11 August 2024.
- Luis Alvaz, [Semáforo histórico en Potsdamer Platz, Berlín 01.jpg](https://commons.wikimedia.org/wiki/File:Sem%C3%A1foro_hist%C3%B3rico_en_Potsdamer_Platz,_Berl%C3%ADn_01.jpg), 23 April 2016.
- Luis Alvaz, [Semáforo histórico en Potsdamer Platz, Berlín 03.jpg](https://commons.wikimedia.org/wiki/File:Sem%C3%A1foro_hist%C3%B3rico_en_Potsdamer_Platz,_Berl%C3%ADn_03.jpg), 23 April 2016.

License: [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
