# Steglitzer Kreisel and Hermann-Ehlers-Platz, V327

The existing Steglitz landmark remains the basis of the scene. The supplement
recovers the measured upper podium surfaces hidden by the earlier ownership
split and adds details at the bus approaches and Hermann-Ehlers-Platz. The
separate V182 tower, 6.5 m podium and 28 m parkhaus retain their source owners.
The Rathaus, Das Schloss, school, Spiegelwand, V247 paving and V248 fountain
keep their earlier geometry and navigation.

The Kreisel podium uses 814 clipped roof and wall fragments from 26 leaves of
Berlin LoD2 parent `DEBE06YYB0000Xmt`. The retained `LoD2_385_5812.zip` has SHA256
`449c578e18e5848d082c5bf7fad8a87caee74d613bc91b913301e53667d28c99`.
Its original roof planes and wall planes are clipped above the old Y10.05 m
roof, inside the old podium footprint and clear of the tower and parkhaus.
One rigid −8.242 m vertical offset aligns the source to the existing V182
datum. The current surrounding packet fringes keep their existing ownership.
The Native skin is derived independently from 11,946 complete one-metre roof
cells supported by the old Native roof. Its orthogonal sides and caps form 954
merged cuboids. The other source parts and older packet meshes stay in place.
The Drawn Float32 position grid collapses five clipping slivers totalling
0.0013 m² at the cut boundaries.
[Berlin LoD2 source](https://gdi.berlin.de/data/a_lod2/atom/LoD2_385_5812.zip)
([dl-de/zero-2.0](https://www.govdata.de/dl-de/zero-2-0)).

The 11 April 2026 reference shows the construction scaffolding, fine horizontal
rails, lighter mesh bays and the crane. The supplement adds secondary rails to
the original outline. The pale panel rhythm, dark vent bands and blue fascia
distinguish the parkhaus. The dimensions and colours of these details are
display estimates. The proposed completed ÜBerlin facade belongs to a different
project state. [Leonhard Lenz, 11 April 2026](https://commons.wikimedia.org/wiki/File:Steglitzer_Kreisel_Berlin-Steglitz_2026-04-11_01.jpg)
([CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)),
[Roy Zuo, rear view, 2 May 2025](https://commons.wikimedia.org/wiki/File:Steglitzer_Kreisel,_rear_view,_02-05-2025.jpg)
([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)),
[GuD project account](https://www.gudplanung.de/projekt/details/steglitzer-kreisel/).

Two mapped bus platforms (`392427434`, `392427437`) gain sheltered waiting
areas with seats and information panels. A blue and silver portal marker is
anchored to PSV route `70168262`. The mapped bus course runs through a real
covered hall. The retained V182 podium and its pedestrian collision still
close that passage in the viewer. The marker identifies the approach. Rails
follow both long edges of the existing U-Bahn mouth beside mapped stair
`346265207` and escalator `1105054188`. The V247 floor and its two openings keep
their original extents. [BVG station and local map](https://www.bvg.de/de/verbindungen/stationsuebersicht/s-u-rathaus-steglitz),
[Leonhard Lenz, bus hall, 11 April 2026](https://commons.wikimedia.org/wiki/File:Bus_stop_Rathaus_Steglitz_Berlin-Steglitz_2026-04-11_01.jpg)
([CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)).

Six representative market-day stalls show striped awnings, open counters and
produce crates near the mapped market node `3980482215`. The footprints fit
the existing paving in both families and leave the mapped pedestrian route, the
trees, the fountain and the memorial clear. The stall positions and small
dimensions are illustrative. The red memorial stele at node `6874973858`
represents its information panel and six small fields as geometry. The new
scene depicts the existing plaza, whose proposed redesign is still described in
the district project record. [District market administration](https://www.berlin.de/ba-steglitz-zehlendorf/politik-und-verwaltung/service-und-organisationseinheiten/wirtschaftsfoerderung/marktverwaltung/),
[district redesign record](https://mein.berlin.de/vorhaben/2024-00949/),
[public memorial record](https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/ermordeter-deserteur/1739),
[Fridolin freudenfett, market, 26 March 2022](https://commons.wikimedia.org/wiki/File:Steglitz_Hermann-Ehlers-Platz_Wochenmarkt-001.jpg)
([CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)).

The source ledger holds selected coordinates and tags from the OpenStreetMap
API snapshot of 9 November 2026, with the exact snapshot hash and published
source URLs. The images serve as external references. The model uses only
texture-free geometry and materials. [OpenStreetMap contributors and ODbL](https://www.openstreetmap.org/copyright).

`createSteglitzPublicSpaceV327(native)` builds 77,064 B in two Drawn renderables
and 98,308 B in one independent Native renderable. Drawn touch uses the same
geometry. The small supplement sits beside the existing three/one V182 batches
in the lazy outline group and retains their original limits. The reproducible
compiler and the evidence ledger record the exact input hashes and positive
geometry counts.

```sh
uv run --no-sync python scripts/build_steglitz_public_space_v327.py
```
