# Reichstag basement and public connection exhibit

This is a bounded, reversible architectural exhibit, constructed only when
the Reichstag section opens. It is not a measured internal plan or a statement
that these operational connections are ordinary public access routes.

The Bundestag confirms two distinct pedestrian connections from the Reichstag:
one to the Jakob-Kaiser-Haus, including moving walkways, and one to the
Paul-Löbe-Haus. Its deeper **Unterirdisches Erschließungssystem (UES)** connects
the Reichstag, Paul-Löbe-Haus, Jakob-Kaiser-Haus and Marie-Elisabeth-Lüders-Haus
for deliveries, service traffic and garages. The documented pedestrian link
between Paul-Löbe-Haus and Marie-Elisabeth-Lüders-Haus is the existing bridge.
No direct Reichstag–Marie-Elisabeth-Lüders visitor tunnel is invented.

## Evidence and interpretation

Checked 6 November 2026, using public primary sources:

- [Bundestag UES description](https://www.bundestag.de/parlament/verwaltung/ues-245596)
  establishes the four-building service connection and its function.
- [Bundestag Jakob-Kaiser-Haus architecture](https://www.bundestag.de/dokumente/textarchiv/architektur-jakob-kaiser-haus-1101942)
  confirms the underground connection to the Reichstag.
- [Bundestag / mitmischen, 22 August 2023](https://www.mitmischen.de/wissen/hinter-den-kulissen/inside-bundestag/welche-geschichte-erzaehlt-dieses-laufband)
  identifies the JKH pedestrian moving walkway and distinguishes it from UES.
- [Bundestag / mitmischen, 26 August 2025](https://www.mitmischen.de/wissen/hinter-den-kulissen/orte-im-bundestag/der-ungeplante-tunnel)
  documents the broad PLH passage with round columns, exhibition panels and
  floor lights, and a converted technical-basement passage with pipes, pictures
  and an automatic door. Photographs: Niklas Nachtigall, reference only.
- The [2022 open-day booklet, pages 6–7](https://www.bundestag.de/resource/blob/906848/flyer_deutsch_2022.pdf)
  distinguishes the PLH–Reichstag tunnel from the PLH–MELH upper bridge. This is
  event-specific circulation evidence, not present-day general admission.
- [Christian Boltanski, *Archiv der Deutschen Abgeordneten*, 1999](https://www.bundestag.de/besuche/kunst/kuenstler/boltanski/)
  is publicly placed in the east-side basement at the JKH crossing. The
  [Bundestag art leaflet](https://www.bundestag.de/resource/blob/194606/flyer_boltanski.pdf)
  establishes two long ceiling-high metal-box blocks, a narrow dim aisle and
  filament lamps. Photograph credits: DBT / Julia Nowak-Katz, Simone M. Neumann,
  Werner Schüring and Jörg F. Müller. The procedural interpretation shows 5000
  small boxes, label fields, restrained patina and one black box. The exact
  arrangement is an estimate; no individual names, dates, party allocations or
  victim identifications are fabricated or transcribed.
- The [current Bundestag architectural booklet, page 37](https://www.btg-bestellservice.de/pdf/40311000.pdf)
  describes the preserved old heating-passage fragment displayed in the JKH
  pedestrian underpass. The model shows a short brick-vault fragment beside
  that passage. Dimensions and placement are illustrative, without an invented
  working historical route or a claim resolving the Reichstag-fire debate.
- The [Berlin Senate's public Luisenblock brief, page 49](https://www.berlin.de/sen/bauen/_assets/wettbewerbe/2025/luisenblock-ost/2025-12-05_lboll_auslobung.pdf?ts=1764934784)
  gives general UES clearance of at least 4.2 m and approximately 8 m width.
  These are not treated as per-segment measurements.

No reference photograph or protected plan is bundled, traced as geometry or
loaded by the viewer. There is no invented inventory of private offices,
technical plant, controls or security installations.

## Spatial fit

The retained OpenStreetMap PBF supplies complete UES ways 139118203,
416419153, 139118202, 25777235 and 25777238. All transformed XZ nodes remain
unrounded in the recipe and retained evidence. Coordinates are EPSG:25833:
`x=easting−389500`, `z=5820000−northing`; © OpenStreetMap contributors, ODbL 1.0.

Pedestrian bends, widths and endpoints are schematic fits between the named
mapped building envelopes. No public measured alignment was found for those
interior paths. Basement/pedestrian floor 0.25 m, ceiling 3.55 m and UES floor
−8.2 m are **display elevations in the existing scene datum**, not surveyed NHN
or historical operating levels. Fixed depth separates the service network from
the pedestrian passages and places its mapped river crossing below the Spree.
The current six source courtyard holes remain open in both basement floors.

Routes are roofless. One camera-facing wall is cut low, exposing interiors.
The basement archive and crossing remain visible in section views; external
branches and their lights appear only in **Verbindungen / Connections**.
Moving-walkway fittings are static architectural recognition and add no timer.

## Integration and checks

`createReichstagUndergroundV319(native=false)` constructs a detached root.
`setReichstagUndergroundViewV319(root, connections)` accepts only the private,
live factory identity. It preserves the basement and reversibly changes branch
visibility. Disposed or foreign roots fail closed.

`reichstagUndergroundRevealVolumesV319(connections=true)` returns finite world
`{id, center, size, yaw}` boxes for clipping **original ground, roads and water**,
not the exhibit. There are 29 boxes: one basement, 27 path segments and one
fragment-display bay. End caps contain complete cardinal floor cells. No adjacent
source route segments are exactly collinear, so none is silently straightened.
`REICHSTAG_UNDERGROUND_CAMERA_V319` supplies finite focus targets and spans.
Normal-world navigation and every previous source/material buffer remain owned
by the existing implementation.

Drawn uses 7 renderables, 12021 instanced members and 932412 stored geometry/
instance bytes. Native uses 4 renderables, 14996 members and 1142288 bytes.
Native floors, walls and fittings are independently cardinal. Equal-paint boxes
merge only across exact complete touching Float32 faces; real gaps and colour
boundaries remain. Drawn detail is identical on mobile and desktop.

Focused tests cover exact mapped source courses, public connection identities,
continuous actual route-floor support, containment in all finite reveal boxes,
source courtyard retention, complete-face Native merging, bounded buffers,
fresh material lifetimes and reversible/disposed branch control. Reproduce
source extraction with `uv run --no-sync python -m scripts.build_reichstag_underground_v319`.
