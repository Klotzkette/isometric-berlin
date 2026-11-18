# Larger Berlin allotment gardens

Version 1.0.240 uses the [Berlin allotment inventory](https://daten.berlin.de/datensaetze/kleingartenbestand-berlin-wfs-350d69ef).
Parts with the same official facility number are grouped; the scope is the 617
facilities with a reported total area of at least 10,000 m². Inventory parts and
holes are preserved. Where the existing city ground is absent, only the mapped
allotment footprint is added. The surrounding streets and buildings are outside
this supplement. These outdoor surfaces use the surrounding-city display datum;
they do not assert a site-specific survey of elevation.

The OpenStreetMap extract of 13 November 2026 contributes mapped paths, hedges
and scrub. Berlin's [ALKIS](https://daten.berlin.de/datensaetze/alkis-berlin-amtliches-liegenschaftskatasterinformationssystem-wfs-66e083ae)
and [ATKIS](https://daten.berlin.de/datensaetze/atkis-basis-dlm-prasentationsdienst-wfs-d4316e05)
contribute additional path lines, hedge edges and woody vegetation. Five visible
shared lanes, in Steintal and Am Rathaus Wittenau, were traced from the city's
[2026 true orthophotos](https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-2026-dop20rgbi-wms-3801a94c).
Path widths and unmeasured hedge heights are model estimates. Some smaller sites
at the threshold have no verifiable interior path; the mesh does not make one up.

Berlin's [2020 vegetation heights](https://daten.berlin.de/datensaetze/vegetationshohen-2020-umweltatlas-b3a1d6a1)
give representative low-vegetation patches from the 1 m observations. The
selection has eight measured patches per managed facility before obstruction
clipping. Low growth is represented by height and footprint, without identifying
individual plants or asserting that all 2020 growth survives. Older authored
plots, sheds, and trees stay in place. The already refined Lehrter Straße
garden keeps its own model.

Source and geometry details are in the [data receipt](../geo_data/regierungsviertel/allotments-v360/receipt.json).
The same-origin recipe files are fetched with nearby city tiles and use their
existing streaming and removal lifecycle. The Drawn view triangulates the
clipped outlines; Native uses independent half-metre cells for details and
two-metre cells for the added garden floor. Narrow edges without a complete
small cell may remain visible only in Drawn mode.

Berlin source attribution: Geoportal Berlin; where specified in the source
catalogue, Datenlizenz Deutschland – Zero 2.0. OpenStreetMap data © OpenStreetMap
contributors, [ODbL 1.0](https://www.openstreetmap.org/copyright).

## Follow-up in 1.0.241

The 49 facilities of at least 100,000 m² receive 628 additional low-vegetation
outlines from the same 2020 raster, distributed within the official boundaries.
The additional outlines avoid already mapped plants and paths. The largest
sites, including Märchenland and Dahlwitzer Straße, receive 32 each. These are
historical surface-height observations, and do not establish current species
or the condition of each individual plant.

The [2026 orthophotos](https://daten.berlin.de/datensaetze/digitale-farbige-trueorthophotos-2026-dop20rgbi-wms-3801a94c)
show a paved 28 m route between plots in Vorarlberg. Orthophotos from 2025 and
2026 support a 49 m route inside Leonorenstraße, parallel to the railway.
The widths are display estimates. The gardens reviewed at Am Erlengrabenteich, Neu Venedig,
Morgenrot, Waldschulallee and Spreegrund Süd have evidence of access from the
perimeter. The Erlengrabenteich operator explicitly confirms a public shoreline
path connecting its separate plots.

The cleared private Mühlenfließ component, inventory part 269 at
Friedrichshagener Straße 56, is removed from the allotment layer. The district's
written response SchA IX/1074 and the 2026 orthophoto identify the affected
part. Parts 250 and 336 remain represented. See the
[follow-up source receipt](../geo_data/regierungsviertel/allotments-v361/receipt.json)
for measurements, exact service references and the compilation options.

The last validated nearby packet has a bounded cache, so adjacent tiles can
reuse it after garbage collection. Packages keep their prior tile groups and
unchanged recipes retain their content-based URLs.
