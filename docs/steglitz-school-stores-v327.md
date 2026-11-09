# Gymnasium Steglitz and Bergstraße shops

The school at Heesestraße 15 keeps its historic façades, Aula, courtyard and
sports hall. The rounded extension of the Mensa now reads as a continuous upper
glazing band with cream mullions and a pale fascia. The Drawn band follows 30
individual LoD2 wall sheets of `DEBE3DrwNPVZQPmu` and `DEBE3DR3T6f1tQ3n`.
Native uses the exterior of the existing cardinal occupied cells. The earlier
LoD2 volume below the band remains in place, so the cantilever seen in the
architect's photographs is only suggested by the material change.
[School contact](https://gymnasiumsteglitz.de/kontakt),
[district building record](https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/schulbauoffensive/weiterfuehrende-schulen/gymnasium-steglitz-1218110.php),
[LKK Architekten project](https://lkkarchitekten.de/projekte/mensa-gymnasium-steglitz/).

ALDI Nord at Bergstraße 93–97 already has the delivered source masses
`DEBE06AL2xD0000Z` and `DEBE06AL2xD0001P` in two ring packets. The addition
follows the west return and the Bergstraße façade at the mapped corner entrance.
Dark clinker, divided glazing, a silver projecting canopy and two signs use
the owner's exterior photograph and ground-floor plan as reference.
[ALDI Nord store](https://www.aldi-nord.de/filialen-und-oeffnungszeiten/filialen-und-oeffnungszeiten/berlin/bergstrasse-93-97/3181113.html),
[Eduard Winter project and photographs](https://www.eduard-winter.de/EWBerg.html),
[mapped entrance](https://www.openstreetmap.org/node/11277040858).

The current Lidl at Bergstraße 86 opened in October 2023. Its site was empty
in both delivered model families. The new building follows the complete mapped
footprint, with its two faces of corner glazing, upper sales floor, open parking
deck and rooftop solar rows. Its roof is 10.52 m above the existing scene ground
at Y=3 m, from the difference between selected official 2026 bDOM roof samples
and DGM1 at the entrance. That rigid alignment follows the surrounding viewer
terrain. The widths of the glazing, parking piers, soffit elevation and rooftop
solar strips are display estimates. Native uses 67 runs of fully contained 1 m
cells with zero area overlap with the existing Native buildings.
[Lidl store](https://www.lidl.de/s/de-DE/filialen/berlin-steglitz-zehlendorf/bergstrasse-86/),
[Fischer Projekt GmbH construction and exterior photographs](https://baubetreuung-fischer.de/discounter.html),
[mapped footprint](https://www.openstreetmap.org/relation/16609777),
[mapped entrance](https://www.openstreetmap.org/node/11277917350),
[Berlin bDOM](https://gdi.berlin.de/data/bdom/atom/),
[Berlin DGM1](https://gdi.berlin.de/data/dgm1/atom/).

The factory belongs to the existing late outline model. Its measured buffers
total 52,576 bytes Drawn and 109,784 bytes Native. The Native instances use exact
axis dimensions. The privately admitted Lidl roof is walkable only when a
height hint is already within the existing upward reach of 0.65 m. The parking
level uses the existing terrain, while the represented walls, piers and upper
envelope have local collision. The upper shop interior and stair access are
outside this exterior model.

`scripts/build_steglitz_school_stores_v327.py` reads the three complete retained
PBF records, the retained LoD2 tile, the eight original ring packets, and the
two official height tiles under `raw/steglitz-v327-reference`. The [source
record](../geo_data/regierungsviertel/steglitz-school-stores-v327-evidence.json)
includes their hashes and the actual raster samples. Building photos and
orthophotos serve as external references. `bun test
tests/steglitz-school-stores-v327.test.ts` from `src/app` checks both factories,
geometry limits, exact Native axes, private navigation and predecessor bytes.
