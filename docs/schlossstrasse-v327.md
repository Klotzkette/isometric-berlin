# Schloßstraße in Steglitz

V327 refines the Titania-Palast at Schloßstraße 4/5 and the Bierpinsel at
Schloßstraße 17. Both already existed in the city as single extruded footprint
envelopes. The Titania envelope concealed the light tower among its setbacks.
The Bierpinsel envelope made the entire crown projection solid down to the
pavement. The new models occupy two existing ring packets. The earlier Rathaus,
Das Schloss, Gymnasium, road and cycleway details retain their own sources.

## Titania-Palast

The complete Berlin LoD2 family `DEBE06YYB0000gop` contains 23 leaves. The Drawn
model uses all their wall and roof sheets and positions them with one rigid
vertical offset to the retained packet ground. The projecting light tower, pale
horizontal ribs, glazed corner and layered fascia follow the street photograph.
The two street faces carry the photographed building name in geometric
lettering. The historic corner is distinct from the present cinema address on
Gutsmuthstraße. The glazing and trim dimensions are display estimates.
[Landesdenkmalamt building record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065610),
[Landesdenkmalamt history and Wolfgang Bittner photograph](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/usa/steglitz-zehlendorf/titania-palast-647674.php),
[cinema operator](https://www.cineplex.de/berlin-steglitz/cineplex-titania/infos-und-preise/dein-kino),
[OpenStreetMap way 28544726](https://www.openstreetmap.org/way/28544726).

## Bierpinsel

The complete Berlin LoD2 family `DEBE06YYB0000lX5` contains ten leaves.
Its measured crown outline, upper sheets and roofs set the elevated silhouette.
The narrow concrete shaft, open space beneath the tapered head, projecting ribs
and visible side landings follow the documented built form. The district's
September 2026 photographs guide the current gray, pale and dark glazing
palette, including small isolated colour accents. The shaft radius, lower
crown profile, landing placement and fitting dimensions are approximate.
The model height follows the retained LoD2 envelope, which is lower than
the museum's published 47 m overall height. The district's October 2026
closure notice describes a temporary real-world safety measure. The model
preserves the existing streets, bridge and station entrances.
[Landesdenkmalamt ensemble record](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09097832%2CT),
[Berlinische Galerie archive](https://berlinischegalerie.de/sammlung/architektur/ralf-schueler-und-ursulina-schueler-witte/),
[interview with architect Ursulina Schüler-Witte](https://www.moderne-regional.de/interview-ursulina-schueler-witte-zum-bierpinsel/),
[district photographs, 23 September 2026](https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/pressemitteilungen/2026/pressemitteilung.1717697.php),
[district closure notice, 21 October 2026](https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/pressemitteilungen/2026/pressemitteilung.1728526.php),
[OpenStreetMap way 28503881](https://www.openstreetmap.org/way/28503881).

## Source and runtime checks

The retained [Geoportal Berlin LoD2 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5813.zip)
and its archive SHA are recorded with all original sheets, rings, hole rings
and coordinate-text hashes in `geo_data/regierungsviertel/schlossstrasse-v327-source.json.gz`.
The four existing gzip packets remain immutable. The offline compiler replays
both original envelopes, matches full XYZ/colour/winding and ink
multiplicities, and captures the actual earlier packet preparers, including
V326 network details. Only the matching old owner triangles, original ink and
one navigation record are retired per packet. The old source buffers and all
other rows remain available as the default.

Native builds its own cardinal columns with measured roof samples on a
two-metre Titania and one-metre Bierpinsel horizontal grid. These columns stay
inside the original Native family's rendered footprint, excluding cells
overlapping other retained building owners. Walking uses the resulting
column intervals. Drawn uses source roof planes for the upper volumes and
conservative sectional solid supports for the estimated taper. The street
under the crown remains open outside the new shaft and the retained ground
and road records stay exact.

The existing serial SourceQuarter transaction admits geometry and navigation
together after the old network recipe. One combined mesh uses the existing
texture-free day/night materials. Drawn and touch use the same geometry.
The two sites add 66,564 bytes of Drawn geometry and 169,704 bytes of Native
geometry if all new indices use four bytes. The larger individual addition
is 90,132 bytes. The
decoder tests compare every outside word and index, retain exact outside
navigation, exercise the open crown clearance in both modes and verify
cancellation and source corruption guards. No reference photograph is
included in the model or download.
