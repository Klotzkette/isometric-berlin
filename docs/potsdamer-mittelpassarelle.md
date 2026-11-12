# Potsdamer Platz – Mittelpassarelle am Leipziger Platz

Die östliche Galerie der Mittelpassarelle verbindet im Viewer beide
Zugänge am Leipziger Platz. Je eine feste Treppe und eine aufwärts fahrende
Rolltreppe führen von der Galerie zur Straße. Die festen Treppen lassen
sich in beiden Richtungen begehen. Die Mittelpodeste, die offene
Treppenmündung, die Stahlgeländer und der Boden funktionieren in den
gezeichneten Modi und in Minecraft.

Die [S-Bahn Berlin](https://sbahn.berlin/fahren/bahnhofsuebersicht/potsdamer-platz/?jumpTo=equipment)
führt die Rolltreppen MP.3 und MP.4 zur Straße. Der veröffentlichte
[Stationsplan in punkt 3, Ausgabe 16/2006, gedruckte Seite 16](https://sbahn.berlin/fileadmin/user_upload/Punkt3/PDF-Archiv/2006/punkt3_08_24_06.pdf)
belegt die Verteilerhalle unter der Kreuzung und die Zugänge auf beiden
Seiten der Leipziger Straße. Der historische Plan diente als
Orientierung für die Wegführung. Die Innenansicht ist prozedural
modelliert. Der Viewer verwendet keine Bildausschnitte des Plans.

## Lage und Darstellung

Die Mittellinien und Stufenzahlen kommen aus dem OSM-Auszug
[Geofabrik Berlin](https://download.geofabrik.de/europe/germany/berlin.html)
vom 29. September 2026. SHA-256 des Auszugs ist
`9d193d9003e35f9a00c2a52553452946aab4d46467f1465364455e36e6a568a9`.
Die Koordinaten wurden in EPSG:25833 und den bestehenden
Viewer-Bezug `x = E − 389500`, `z = 5820000 − N` umgerechnet und auf
Zentimeter gerundet. © [OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright),
ODbL 1.0.

| Abschnitt | OSM-Wege |
| --- | --- |
| Feste Treppe auf der Nordseite mit Zwischenstufe | [237695510](https://www.openstreetmap.org/way/237695510), 241577207, 241577208 |
| Feste Treppe auf der Südseite mit Mittelpodest | [237695511](https://www.openstreetmap.org/way/237695511), 241577206, 241577209 |
| Aufwärts führende Rolltreppen | [237695526](https://www.openstreetmap.org/way/237695526), [237695516](https://www.openstreetmap.org/way/237695516) |
| Öffentliche Verbindung in der Galerie | 464904220, 464904221, 464904400, 464904510, 464904512, 237751557, 237751573 |
| Drei Stützen in der Ostgalerie | 464904448, 464904452, 464904453 |

Die Treppenbreiten, die Deckenhöhe, der Zuschnitt der Galeriewände, die
Geländer und die Materialien sind geschätzte Darstellungswerte. Die
Verteilerebene `−1` verwendet `−0,518 m` als Darstellungsniveau. Diese
Höhe entspricht dem Bezug der [vorhandenen Südpavillon-Modellierung](potsdamer-south-access.md)
und steht hier für eine angenäherte Niveauhöhe. Die obere Treppe
schließt bei `5,4 m` an.

## S-Bahnsteige 11/12 und 13/14

Die Mittelpassarelle führt auf beide Mittelbahnsteige. Jede feste
Treppenanlage hat zwei obere Läufe mit je elf und zwei untere mit je
vierzehn Stufen. Die Läufe treffen sich auf den kartierten Zwischenpodesten.
Dazu kommen vier bewegte Rolltreppen. Das Modell verwendet die
dokumentierte Auf- und Abwärtsverteilung. Die Zuordnung des abwärts
laufenden Geräts zu einer der beiden kartierten Achsen der Gleise 13/14
ist eine Darstellungsentscheidung. [S-Bahn Berlin](https://sbahn.berlin/fahren/bahnhofsuebersicht/potsdamer-platz/?jumpTo=equipment)

Die weißen Verkleidungen der Bahnsteigwände und -stützen folgen dem
Denkmaleintrag. Die Gleisoberkante liegt nach Betreiberangabe 0,96 m unter
der Bahnsteigkante. Die Stufenhöhe von 0,18 m ergibt im Modell die
Zwischenpodeste bei `−2,498 m` und die Bahnsteige bei `−5,018 m`.
Treppenbreiten, Wanddicken und Deckenhöhen sind Darstellungswerte.
[Landesdenkmalamt](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09020315) ·
[DB InfraGO](https://www.dbinfrago.com/web/bahnhoefe/leistungen/stationsnutzung/stationshalt/stationsausstattung/Berlin-Potsdamer-Platz-12668070)

| Abschnitt | OSM-Beleg |
| --- | --- |
| Bahnsteig 11/12 mit 26 innenliegenden Bauteilen | [Relation 3200537](https://www.openstreetmap.org/relation/3200537) |
| Bahnsteig 13/14 mit 26 innenliegenden Bauteilen | [Relation 3198309](https://www.openstreetmap.org/relation/3198309) |
| Zwischenpodest 11/12 | [464904398](https://www.openstreetmap.org/way/464904398) |
| Zwischenpodest 13/14 | [464904399](https://www.openstreetmap.org/way/464904399) |
| Feste Läufe 11/12 | 237526544, 237526526, 237526553, 237526536 |
| Feste Läufe 13/14 | 237526549, 237526543, 237526524, 237526539 |
| Bewegte Läufe 11/12 | 237751555, 237526547 |
| Bewegte Läufe 13/14 | 237526519, 237526533 |

Die Decks übernehmen die vollständigen Bahnsteigumrisse. Die 52
Innenkonturen verorten Stützen und geschlossene Einbauten. Das Modell
setzt dort rechteckige Hüllen. Beide Bahnsteige behalten die kartierten
Gleisachsen und Begrenzungskanten. In Minecraft sind die Deckkanten
unabhängig aus rechtwinkligen Abschnitten aufgebaut.

Die bestehenden Bodenplatten behalten ihre Oberfläche über der Galerie.
Nur an den Treppenmündungen öffnen sich die Platten und die betroffenen
Pflasterflächen. Die Kollisionsprüfung nutzt Treppen, Stützen,
Geländer und Decke. Beide Rolltreppen verwenden die vorhandene
sichtbarkeitsabhängige Animation.

Die gezielten Tests verwenden die tatsächlich gelieferten Bodenraster
und LoD2-Hindernisse. Sie durchlaufen beide Straßentreppen in beiden
Richtungen und prüfen die Flugfreiheit durch beide Bahnsteigtreppen, die
Decke sowie die erhaltenen Pflasterflächen. Ein weiterer Test überträgt das
verzögert eintreffende Pflasterpaket mit demselben Verfahren wie der
Viewer und prüft die ausgeschnittene südliche Treppenöffnung.
