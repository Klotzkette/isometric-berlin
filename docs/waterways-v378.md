# Berliner Uferwege und die Brücken des Landwehrkanals

Im Viewer führt „Orte“ zu jeder der 41 kartierten Querungen, zu beiden Schleusen und zu drei Uferabschnitten. Die Kamera an der Admiralbrücke zeigt den geschwungenen Stahlunterbau und das historische Eisengeländer. Unmittelbar daneben überspannt ein eigenes Rohr den Kanal. Für die Admiralbrücke verzeichnet die Karte zwei Leuchten auf dem Deck und vier an den Anschlüssen. Die Form der Stehleuchten ist stilisiert. Der Abstand der Eisenbogenrippen von zwei Metern stammt aus dem Denkmalinventar. An der Schlesischen Brücke sind beide Durchlässe offen. Zwischen ihnen steht der rotbraune, mit Sandstein verkleidete Mittelpfeiler. Die Hobrechtbrücke hat einen offenen Betonrahmen. [Berliner Bauwerksverzeichnis, Juni 2025](https://www.berlin.de/sen/uvk/_assets/verkehr/infrastruktur/brueckenbau/masterplan-bruecken-berlin/mpb_anhang_1_brueckenliste_bestand.pdf) · [Admiralbrücke](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031110) · [Schlesische Brücke](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031009) · [Obere Freiarchenbrücke](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09031008)

## Vom Spreekreuz bis zur Oberspree

Acht miteinander verbundene OSM-Mittellinien ergeben 10,808 km Hauptlauf. Die Erfassung verfolgt auch den Zooarm und den Flutgraben sowie zwei kurze Abschnitte der zweiten Schleuseneinfahrt im Osten. Die beiden Herkulesbrücken nutzen getrennte Tragwerke. Die Bahnbrücken über den Zooarm und den Hauptlauf erhalten eigene Standorte. Vier kartierte Torlinien und ein Wehr sind anhand ihrer Endpunkte zu erkennen. Ihre jeweilige Betriebsstellung ist offen. [Inventar der Querungen und Schleusen](../geo_data/regierungsviertel/landwehr-crossing-survey-v378.json.gz)

| Nutzung laut Quellen | Baukörper |
| --- | ---: |
| Straßenbrücken einschließlich gemeinsamer Straßen- und Wegführung | 25 |
| Fuß-, Rad- und Betriebsstege | 9 |
| Eisenbahn und Hochbahn | 4 |
| Ehemalige Eisenbahnbrücke am Görlitzer Park | 1 |
| Rohrbrücken | 2 |

Die 37 Querungen im Bundesverzeichnis sind mit ihrer Station, den drei Höhen der Bauwerksunterkante und der ausgewiesenen Durchfahrtsbreite erfasst. Für den zweiten Durchlass an der Schlesischen Brücke gelten eigene Werte. Die gezeichneten Querschnitte interpolieren die linken, mittleren und rechten Höhen für den Referenzwasserstand der Ausgabe vom **17. September 2024**. Diese festen Modellmaße bilden die Grundlage für die Ansicht unter den Brücken. Für 30 Baukörper liefert der Berliner Brückenbestand außerdem Tragwerksform und Materialklasse. Bei den übrigen ergänzen OSM-Tragwerksangaben und die dokumentierte Nutzung die Querschnitte. Die festen Anlagen des Zoonebenarms und Flutgrabens ohne WSA-Messprofil verwenden die örtliche Modellhöhe. [WSA Spree-Havel, Seiten 7–12](https://www.wsa-spree-havel.wsv.de/Webs/WSA/Spree-Havel/DE/01_Wasserstrassen/01_BauwerkeAnlagen/01_Bruecken/11_Brueckendurchfahrtshoehen/bruecken_durchfahrt_berlin.pdf?__blob=publicationFile&v=2) · [Übernommene WSA-Messwerte](../geo_data/regierungsviertel/landwehr-wsa-openings-v378.json) · [Berliner Bauwerksnummern und Materialzuordnung](../geo_data/regierungsviertel/landwehr-berlin-survey-v378.json)

Die Querungsprüfung schließt alle Straßen-, Fußweg-, Gleis- und Rohrleitungsachsen im Kanalumfeld ein, auch wenn die Karte ein Brückenattribut weglässt. Unterirdische Gleise, Planungen und das ehemalige Anschlussgleis direkt an der Flutgrabenmündung sind im Prüfinventar gesondert erfasst. Ein privater Betriebssteg, die beiden Rohrbrücken, aktive Gleise und die gesperrte ehemalige Bahnquerung erhalten keine öffentliche Gehfläche. [OSM-Quellen und räumliche Zuordnung](../scripts/survey_landwehr_crossings_v378.py)

## Ufer im modellierten Stadtgebiet

Der Schnitt umfasst die veröffentlichte Modellfläche von rund **322 km²**. Darin prüft der Generator 405 offene Gewässerachsen und 175 zugehörige Wasserpolygone. Die ausgewählten Wege und Bepflanzungen verteilen sich auf 70 namentlich identifizierte Gewässer und weitere namenlose Abschnitte. Der landseitige Prüfkorridor reicht bei einer kartierten Wasserfläche 14 m vom Ufer. Schmale Bäche ohne Wasserpolygon erhalten einen 8,5-m-Prüfkorridor entlang der Mittellinie. Wege, Hecken und Geländer müssen dem Gewässerverlauf folgen. So endet ein quer ankommender Zuweg vor dem Prüfabschnitt. [OSM-Extrakt Berlin, 22. November 2026](https://download.geofabrik.de/europe/germany/berlin-261122.osm.pbf) · [Uferinventar mit Objektversionen und Belagsangaben](../geo_data/regierungsviertel/waterway-bank-survey-v378.json.gz)

| Im Viewer ergänzte Geometrie | Umfang |
| --- | ---: |
| Fußwege, einschließlich kartierter gemeinsamer Wege | 99,94 km in 1.849 Teilstücken |
| Separat kartierte Radwege | 2,01 km in 55 Teilstücken |
| Geländer | 1,51 km in 47 Teilstücken |
| Leitplanken | 67 m in 2 Teilstücken |
| Hecken | 1,59 km in 58 Teilstücken |
| Gehölzflächen | 2.409 Strauchgruppen innerhalb kartierter Polygone |

Die Zahl der Strauchgruppen beschreibt die Darstellung. Die kartierten Vegetationsflächen belegen den Bewuchs, aber weder einzelne Sträucher noch deren Art. Der Generator setzt die Gruppen innerhalb der Flächen mit Abstand zum Rand und zu den Uferwegen. Wege übernehmen Asphalt, Pflaster, Kies und weitere dokumentierte Beläge. Fehlt eine Breite, verwendet der Viewer eine schmale Darstellungsbreite. Holme und Pfosten am Ufer entstehen ausschließlich bei einer entsprechenden Barrierenkartierung. Eigene Strandbad-, Steg- und Waldwegdetails der Tegeler Landschaftsmodelle haben auf derselben vermessenen Linie Vorrang. [OSM-Lizenz und Mitwirkende](https://www.openstreetmap.org/copyright)

## Laden und prüfen

Der gezeichnete Kern erzeugt 30 Überbauten zusammen mit dem übrigen Brückenmodell. 799 belegte Zellen aus 29 Altclustern wechseln atomar zu ihrer neuen Geometrie. Bei einem Mischcluster behält jede angrenzende Bahn- oder Straßenstrecke ihre eigenen Zellen. Vor dem Wechsel werden alle Zellen des erwarteten Altclusters verglichen. Unabhängige Betriebstege, Brücken außerhalb des Kerns und die Uferdetails werden mit der bestehenden räumlichen Sichtbarkeits- und Speichersteuerung geladen. Die Blockdarstellung erhält ihre Brücken ebenfalls über die jeweils sichtbare Zelle.

Der Ortsindex umfasst 164 Zellen. Die 41 regionalen JSON-Dateien ergeben zusammen rund 113 kB bei separater gzip-Kompression. Der größte einzelne Regionalabruf umfasst rund 23 kB komprimiert. Der Kernbeleg belegt weitere 9,1 kB komprimiert. Die Navigation verwendet die tatsächlich sichtbaren öffentlichen Überbauten und sucht bei jedem Schritt nur im betroffenen 128-m-Feld.

Die Regionaldateien und Kameraansichten lassen sich aus den eingecheckten Daten offline neu erstellen. Der vollständige Quellabgleich benötigt zusätzlich den datierten OSM-Extrakt, PyOsmium, Shapely 2, NumPy und pyproj.

```sh
python scripts/build_waterways_v378.py
cd src/app
bun test tests/waterways-v378.test.ts
```

Für die Neuerfassung aus dem OSM-Datenstand beginnen alle vier Befehle im Repository-Stamm.

```sh
export BERLIN_WATER_SURVEY=/tmp/berlin-water-osm
python scripts/capture_waterways_v378.py /pfad/zu/berlin-261122.osm.pbf "$BERLIN_WATER_SURVEY"
python scripts/survey_waterway_banks_v378.py
python scripts/survey_landwehr_crossings_v378.py
python scripts/build_waterways_v378.py
```
