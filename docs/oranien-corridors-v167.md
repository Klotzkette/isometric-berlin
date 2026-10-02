# Oranienstraße, Oranienburger Straße and Mariannenplatz

Pipeline step 10 adds bounded streamed detail along Oranienstraße from
Moritzplatz through Rio-Reiser-Platz to Görlitzer Bahnhof, the northward
Mariannenstraße/Mariannenplatz connection, and the complete Oranienburger
Straße. The short Skalitzer Straße link stops beside the elevated station.
All requested geometry is inside the existing release polygon; no bounds
revision or additional tour stop is introduced.

The road selection uses two finite viewer-frame rectangles:
`[2565,1370,3930,2335]` and `[1020,-870,2120,-420]`. Mariannenstraße is cut
at `z=2160` beside Rio-Reiser-Platz; Skalitzer Straße is limited to
`[3660,2210,3890,2320]`. Complete selected building families can extend beyond
the small road-selection rectangles, while remaining inside release bounds.

## Source geometry and ownership

`geo_data/regierungsviertel/oranien-corridors-v167.json` retains 123 exact OSM
street ways, 321 complete official LoD2 parent families and all 755 parts.
Every original wall, roof, ground surface, interior ring and courtyard is
retained at millimetre precision, with only the established rigid family
translation to the outer `y=3` display datum. Official ZIP URLs and hashes
remain in the source. OSM building matches add address and semantic evidence
without changing official metric geometry. The source file is 2,372,956 bytes
and is an offline build input, not an eagerly imported viewer asset.

The existing v166 Oranienburger source and 125 selected core front records
remain unchanged. Their drawn facades receive only new shallow lintel caps,
spandrel insets, shopfront piers and cornice dentils. Existing windows, sills,
roofs, curbs and navigation remain intact. These sub-block ornaments add no
duplicate native cells: the existing separate two-metre Minecraft facade
representation remains byte-identical in this part of Mitte.

Newly refined Kreuzberg buildings receive complete source shells, street-facing
windows and shopfronts, frames, sills, cornices and the same additional facade
detail. These fine subdivisions are procedural estimates, not surveyed window
placements. New pavement and curb geometry follows existing delivered asphalt
boundaries, cuts out buildings and water, and keeps intersections open. The
drawn supplement contains approximately 24,093 m² of pavement and 8,310 m of
curb edge. Untagged pavement width and curb profile remain display estimates.

The corridor excludes every existing detailed/suppressed owner and explicitly
reserves the new Tacheles and synagogue hero identities. Its extra overlay
does **not** include core prisms `40754304`, `19283679` or `24054915`.
These three prisms were already decorated by v166, so a separate exact
triangle-and-colour contribution identifies only their obsolete generic
facades for central subtraction. Other v166 detail, roads and source records
remain unchanged.

## Distinct place identities

| Place | Retained identity | Interpretation |
|---|---|---|
| Café Jenseits | OSM node `2464442845`, building way `37652421`, LoD2 `DEBE02YY40000Alr` | Oranienstraße 16, beside Rio-Reiser-Platz; OSM check date 2025-01-20 |
| Rio-Reiser-Platz | OSM relation `7921395` | Current square name; the borough documents the 2022 renaming |
| Bethanien | OSM way `17966278`, LoD2 `DEBE02YY400000xk` | Kunstquartier at Mariannenplatz 2; distinct from the café |
| St. Thomas | OSM way `51688847`, LoD2 `DEBE02YY4000000T` | Church at the northern end of Mariannenplatz |
| Görlitzer Bahnhof | OSM station node `3875882001`, roof way `311559051`, platform ways `49038362`/`49038363` | Present elevated U1/U3 station, distinct from the former mainline terminus |

The dated OSM extract still names Café Jenseits and its later operator Ahmad
Hassan. Reports about a previous operator stopping in 2009 do not establish
that this later mapped café is closed. Present business operation remains
unverified; no new current-business claim, photographic sign or marketing
texture is introduced. [Borough renaming announcement](https://www.berlin.de/ba-friedrichshain-kreuzberg/aktuelles/pressemitteilungen/2022/pressemitteilung.1231834.php)
and the [Bethanien operator](https://kunstquartier-bethanien.de/) establish the
separate square and cultural-building context.

## Documented geometric conflicts

Bethanien's retained LoD2 sheets reach only 21.677 m above the family ground
and omit the characteristic taller pointed towers. The
[operator's history](https://kunstquartierbethanien.wordpress.com/portfolio/geschichte/)
documents two 35 m towers. Separate octagonal supplements align with the two
small measured front projections. Their intermediate heights, radius and
facade subdivisions are explicitly estimated. Warm brick, round-arched window
recesses and slender crowns follow inspected freely licensed visual references.

St. Thomas's retained source envelope reaches 26.49 m and omits much of the
twin towers and raised drum. The [Landesdenkmalamt record 09031197](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031197)
and [parish building description](https://www.evkgk.de/st-thomas-kirche/st-thomas-beschreibung-des-bauwerks)
establish its brick construction, twin front, round arches and arcaded domed
drum. Added components use 48 m tower and 56 m highest-spire display heights,
consistent with published secondary architectural accounts and Berlin's
description of nearly 50 m towers. These are **not new measured LoD2 heights**.
The exact source base remains; drum radius, component placement, low conical
roof, lantern and detailed openings are documented visual estimates. Each
added solid has separate navigation marked with a `display:` part identity.

The old Görlitzer station envelope interpreted `building:levels=2` as a 6 m
mass starting at ground level, despite OSM `bridge=yes` and `layer=3`. Its
entire original footprint, height and navigation evidence remain in
`station.coarseEnvelope`. Only this exact coarse owner,
`OSM-way-311559051`, is moved. The new barrel canopy retains the complete OSM
outline, including its mapped end cuts, and both platforms retain their own
polygons. The platform `y=8.8`, canopy eave `y=12.2` and crown `y=16.2` are
explicit display estimates. Narrow supports occupy less than 5 m² at ground;
canopy/platform navigation has a positive minimum height, leaving the ground
below open. The [BVG station page](https://www.bvg.de/de/verbindungen/stationsuebersicht/u-goerlitzer-bahnhof)
confirms the current U1/U3 identity. No BVG plan is traced or bundled.

## Packaging and verification

`scripts/build_oranien_corridors_v167.py` writes isolated candidates to
`/tmp/v167-corridor-packets`. Its new mesh kind is `oranien-corridors-v167`.
The 12 candidate chunk pairs retain every prior mesh and every unowned
navigation record exactly. Their distinct new contributions contain 251,112
drawn and 711,583 native triangles after chunk clipping. The largest decoded
candidate is 10,497,605 bytes, below the existing 12 MiB limit. Pointer and
touch receive the same drawn data; new Kreuzberg Minecraft geometry is
prepared independently as orthogonal surface cells without hidden infill.

The descriptor patch lists 322 moved outer owners: 321 LoD2 parents plus the
one explicitly marked OSM station owner. Central publication performs exact
owner-specific coarse subtraction before appending the contribution. Copying
the entire candidate directly would retain old coarse masses and is not the
integration procedure. The separate `tacheles-v166-facade-removal.json` plan
contains packed triangle multisets for **both Tacheles prisms and the synagogue**,
targeting only the previous `mitte-street-fronts-v166` mesh kind.

Reproduce candidate generation against the released **v1.0.66 packet baseline**,
with this generator and frozen source present, using:

```sh
uv run python scripts/build_oranien_corridors_v167.py --out /tmp/v167-corridor-packets
```

Do not refresh candidates from already integrated v167 packets when comparing
the v166 preservation audit. `--refresh-source` additionally requires the
ignored source ZIPs/PBF and reruns the bounded ownership/semantic selection.

Five focused Python tests independently compare every source part and sheet
to the original CityGML archives; verify bounded roads, exact prior front
records and hero exclusions; prove complete mapped station roof coverage and
open ground; check candidate mesh/navigation preservation and all native
triangle orientations; and verify all three stale facade contributions against
the tagged v1.0.66 packet triangle/colour multisets. All five pass; scoped Ruff
format and lint pass. Final central packet preservation and browser inspection
remain part of root release QA.

## External visual references

All photographs were inspected as external references. No pixels, crops or
textures are bundled or fetched at runtime. Four per-file records are supplied
to the mirrored attribution manifests:

- [Bethanien, 20 April 2005](https://commons.wikimedia.org/wiki/File:Berlin-kreuzberg_bethanien_20050420_p1020601.jpg), Georg Slickers, CC BY-SA 3.0: brick, round arches and narrow pointed towers.
- [Oranienstraße 40–41](https://commons.wikimedia.org/wiki/File:Berlin,_Kreuzberg,_Oranienstrasse_40-41,_Geschaeftshaus.jpg), Jörg Zägel, CC BY-SA 3.0: pilasters, window heads and cornice relief; the historical storefront use is not presented as current.
- [St. Thomas, portal view 2](https://commons.wikimedia.org/wiki/File:St.-Thomas-Kirche_-_Berlin_-_Portalansicht_2.jpg), © Raimond Spekking / CC BY-SA 4.0 (via Wikimedia Commons): tower rhythm, brick and arcades.
- [St. Thomas, dome](https://commons.wikimedia.org/wiki/File:St.-Thomas-Kirche_-_Berlin_-_Kuppel.jpg), © Raimond Spekking / CC BY-SA 4.0 (via Wikimedia Commons): low drum roof, lantern and spire.
