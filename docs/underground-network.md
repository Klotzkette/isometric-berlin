# Underground passenger-network cutaway

The 3D underside view includes a restrained architectural cutaway of mapped
passenger rail beneath the complete 6,450 m presentation envelope. It is a
separate layer from the Tiergartentunnel road model documented in
[`tiergartentunnel-geometry.md`](tiergartentunnel-geometry.md).

## Evidence boundary

| Element | Status |
|---|---|
| Track plan courses | Real committed OSM `rail`, `light_rail` and `subway` ways with `tunnel`, `covered` or negative `layer` evidence |
| Platform plan shapes | Real committed OSM underground platform polygons/edges |
| Entrance points | Real committed OSM `railway=subway_entrance` nodes |
| U5 family | Real OSM ways classified near the official Hauptbahnhof → Bundestag → Brandenburger Tor → Unter den Linden sequence |
| North-South S-Bahn family | Real OSM ways classified near the shared S1/S2/S25/S26 Friedrichstraße → Brandenburger Tor → Potsdamer Platz → Anhalter Bahnhof corridor |
| Depths | Schematic values inferred from OSM vertical-order `layer`; **not surveyed elevations** |
| Platform top faces and edge courses | Exact committed OSM platform rings in plan; the 0.34 m visible fascia is a drawing convention, **not a surveyed platform thickness** |
| Open station frames | The mapped platform ring projected vertically to make the cutaway readable; height is schematic and does **not** claim a measured concourse or station envelope |
| Entrance shafts | Centred on real OSM entrance points; width, straight connection and intermediate frames are schematic and do **not** claim mapped stairs, lifts or passage courses |
| Tunnel sections | Restrained presentation approximations; **not engineering drawings** |
| Utilities | Deliberately absent: no invented water, sewer, power or telecom pipes |

The generated payload keeps the OSM element id on every track, platform and
entrance record. `geometry_status` repeats the accuracy warning in the shipped
JSON so a downstream renderer cannot silently turn an approximation into a
survey claim.

## Route checks

- U5 station order is checked against the
  [official BVG U5 route overview](https://www.bvg.de/de/verbindungen/linienuebersicht/u5).
- The shared North-South S-Bahn corridor is checked against the
  [official S-Bahn Berlin S1 route](https://sbahn.berlin/fahren/s1/) and the
  [S-Bahn Berlin tunnel description](https://sbahn.berlin/das-unternehmen/presse/pressemitteilungen-pressearchiv/pressemitteilungen/gleisarbeiten-im-nord-sued-s-bahntunnel/).

Those official pages validate service order only. They do not replace or move
the OSM plan geometry.

## Rendering contract

`build_rail_lines.py` emits schema 2 of `rail-lines.json`. The viewer batches
track beds by route family, draws the rails and open section frames as stable
line segments, merges all platform faces and their edge fascias, projects the
mapped platform perimeters into one open station-frame batch, and merges all
entrance frames. The complete cutaway therefore remains at no more than 16 draw
objects and does not animate. It is hidden in every ordinary exterior view and
becomes visible only after the camera crosses into the underside.

The cutaway intentionally stops where the evidence stops. It contains no
invented utility grid, service rooms, ventilation plant, escalator courses,
internal passages or station furniture. In particular, a square entrance frame
is a legibility symbol around one mapped point, not a claim that the real shaft
has that footprint. A platform ceiling line is the same mapped ring lifted to a
schematic level, not an as-built ceiling survey.

The pale structural ink, ivory platform faces, darker sectional edges and
restrained U5/S-Bahn colour cues form an original technical-cutaway language.
They use no photographic texture and no transparent tunnel shell, avoiding both
visual clutter and alpha-layer flicker. Day, Night, Minecraft, Snowstorm and
Schwellenraum
recolour the same geometry without rebuilding or moving it.

Exterior horizon and snow fog are always disabled after the camera enters the
underside. Minecraft retains the same subdued mapped context shell as the other
modes instead of applying its opaque toon material to that transparent shell.
This keeps every mode legible and makes a settled underground frame static.

Surface tram contact wires follow committed OSM tram courses. Their 5.8 m wire
height and 35 m mast rhythm are explicit presentation approximations. Street
lamp locations and types remain the official Geoportal Berlin public-lighting
layer; the cutaway does not duplicate them.
