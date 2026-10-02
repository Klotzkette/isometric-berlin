# Alt-Mitte: Auswahlgebiet und Bestandsprüfung v1.0.69

Das Auswahlgebiet meint den **Bezirk Mitte unmittelbar vor der Bezirksfusion am 1. Januar 2001**, nicht den heutigen Großbezirk Mitte mit Wedding und Tiergarten. Der Bezirk beschreibt den früheren Bezirk als heutigen Ortsteil Mitte; die amtliche Beschreibung der Fusion bestätigt, dass die Zusammenlegung keine neuen Außengrenzen zog. Quellen: [Bezirksamt Mitte](https://www.berlin.de/ba-mitte/ueber-den-bezirk/ortsteile/mitte/) und [Gutachterausschuss Berlin](https://www.berlin.de/gutachterausschuss/service/glossar/artikel.156764.php).

`geo_data/regierungsviertel/alt-mitte-v169-boundary.geojson` enthält die vollständige, unveränderte aktuelle ALKIS-Geometrie des Ortsteils Mitte (`DEBE01YYK0000007`, Schlüssel `110000010101`) in **EPSG:25833**. Sie dient ausdrücklich als konservatives Gebäude-Auswahlgebiet, nicht als behauptete historische Vermessung von 2000. Ihre 1.481 Koordinaten bleiben unsimplifiziert. Die geometrisch berechnete Fläche beträgt 10.673.801,728 m²; das mitgelieferte amtliche Attribut `gdf` ist eine getrennte Quellenangabe und wird nicht zur Flächenprüfung verwendet.

Die Quelle ist der [ALKIS-Ortsteile-WFS des Geoportals Berlin](https://daten.berlin.de/datensaetze/alkis-berlin-ortsteile-wfs-61bd3084), abgerufen am 2. Oktober 2026, Lizenz [Datenlizenz Deutschland – Zero – Version 2.0](https://www.govdata.de/dl-de/zero-2-0). WFS-Endpunkt, vollständige Abfrage, Antwort-Prüfsumme und Quellenmetadaten stehen in der Datei. Weltkoordinaten werden ausschließlich durch `x = E − 389500`, `z = 5820000 − N` abgeleitet.

## Historische Randkorrektur

Die heutige Ortsteilgrenze ist nicht stillschweigend mit der Grenze von 2000 gleichgesetzt. Die **Zehnte Verordnung zur Änderung der Bezirksgrenzen** übertrug 2008 das damalige Flurstück 442, Flur 19, Gemarkung Friedrichshain, mit **310 m² von Friedrichshain-Kreuzberg nach Mitte**. Die ursprüngliche [Senatsvorlage VO 16/128](https://pardok.parlament-berlin.de/starweb/adis/citat/VT/16/vo/vo16-128.pdf) nennt Richtung und Fläche in der Einzelbegründung auf Seite 3; Anlage 1 auf Seite 7 zeigt das kleine Uferdreieck unmittelbar nordwestlich der Schillingbrücke. Im Kartenbild liegt es außerhalb der schraffierten Gebäudegrundrisse. Das ist eine visuelle Beobachtung der historischen Karte, keine Rekonstruktion eines heutigen Flurstücks.

Die [amtliche Verkündung](https://www.berlin.de/sen/justiz/service/gesetze-und-verordnungen/2008/mdb-senatsverwaltungen-justiz-gesetz-undverordnungsblatt2008-heft_24.pdf) vom 27. September 2008 bestimmt das Inkrafttreten am folgenden Tag, also **28. September 2008**. Eine abweichende August-Datierung in einer sekundären Gesetzeskopie wird nicht übernommen.

Das spätere Uferdreieck bleibt in der Auswahl enthalten: Die aktuelle Geometrie ist bereits die konservative Vereinigung des früheren Gebiets mit diesem Zugewinn. Dadurch wird wegen dieser Änderung kein Gebäude des früheren Bezirks ausgelassen. Die exakten historischen Eckpunkte werden nicht aus der Rasterkarte geschätzt. Ebenso werden spätere vermessungstechnische Koordinatenfortführungen nicht rückgerechnet. Das heute im Flur-19-WFS vorhandene Flurstück 473 ist kein belegter Nachfolger von 442 und wird dafür nicht ausgegeben.

Die späteren Änderungen [2017 am Mauerpark in der Gemarkung Wedding](https://www.parlament-berlin.de/ados/18/IIIPlen/vorgang/verordnungen/vo18-036.pdf) und [2022 an der Kurfürstenstraße im Bereich des früheren Bezirks Tiergarten](https://www.berlin.de/sen/justiz/service/gesetze-und-verordnungen/2022/ausgabe_nr._15_vom_12.3.2022_s._89-96.pdf) betreffen andere Teile des Großbezirks und verändern dieses Auswahlgebiet nicht.

## Auswahlregel und bestehende Modellgrenzen

Gebäude werden bei positiver Schnittfläche des vollständigen Quellgrundrisses mit dem Auswahlgebiet berücksichtigt. Eine bloße gemeinsame Grenzlinie zählt nicht als Flächenüberschneidung. Ausgewählte amtliche Gebäude bleiben mit sämtlichen Gebäudeteilen, Flächen und Innenringen vollständig; sie werden nicht an der Ortsteilgrenze abgeschnitten. Grenzübergreifende Familien werden als solche dokumentiert.

Die vorhandenen Modellgrenzen umfassen die gesamte Auswahl: **0,0 m² liegen außerhalb**. 6.646.005,725 m² liegen im bisherigen Kerngebiet, 4.027.796,003 m² im bereits vorhandenen äußeren Modellgebiet. Eine räumliche Erweiterung ist dafür nicht erforderlich. Diese Prüfung verändert keine Modellgrenze und keine Laufzeitdatei.

## Eingangsbestand von v1.0.68

`alt-mitte-v169-boundary-audit.json` dokumentiert den **Bestand vor der Verfeinerung**, einschließlich Quellen- und Identitätsprüfsummen. Die Zahlen sind keine Aussage über den abschließenden Vollständigkeitsnachweis von v1.0.69; dafür ist das separat aus den vollständigen amtlichen LoD2-Dateien aufgebaute Quelleninventar zuständig.

| Vorhandene Darstellung innerhalb der Auswahl | Anzahl |
| --- | ---: |
| Amtliche Gebäudeteile im bisherigen Kern-GPKG | 8.505 |
| Zugehörige kanonische Kern-Gebäudefamilien | 4.839 |
| OSM-Ersatzdatensätze im Kern-GPKG | 2.247 |
| Amtliche Familien im äußeren Grundrissbestand | 5.322 |
| OSM-Familien im äußeren Grundrissbestand | 124 |
| Bereits übertragene amtliche äußere Eigentümer | 812 |
| Bereits übertragene äußere OSM-Eigentümer | 2 |
| Verbleibende einfache amtliche äußere Familien | 4.510 |
| Verbleibende einfache äußere OSM-Familien | 122 |

Die 37 untersuchten äußeren Pakete enthalten alle 4.632 erwarteten verbleibenden einfachen Eigentümer; keiner der bereits übertragenen Eigentümer bleibt zusätzlich als einfacher Körper stehen. Zentimeterrundungen erzeugen bei 48 weiteren Navigationsgrundrissen winzige Randüberschneidungen von insgesamt weniger als 1 m². Diese werden getrennt ausgewiesen und vergrößern nicht den Nenner aus den ungerundeten Quellgrundrissen.

Die 562 noch aktiven generischen Kern-Fassadenüberlagerungen verfeinern OSM-Ersatzkörper. Sie belegen keine vollständige Wiederherstellung amtlicher Dach- und Wandflächen. Ebenso bedeutet eine gesperrte alte Prisma-ID nicht automatisch, dass die gesamte übergeordnete Gebäudefamilie bereits vollständig verfeinert ist. Der Audit hält diese Kategorien deshalb getrennt.

## Erhaltung der bisherigen Darstellung

`alt-mitte-v169/appearance-baseline.json.gz` hält die tatsächlich berechneten Farben und die Glas-Einstufung von 10.716 relevanten Prismakomponenten der unveränderten Version v1.0.68 fest. Dafür wurden die damaligen Farbfunktionen mit den damaligen Prismadaten ausgewertet; 403 eingelesene Projektabhängigkeiten wurden gegen ihre Git-Objekte geprüft. Veränderte Arbeitskopien wurden durch ihren historischen Inhalt ersetzt. Der Nachweis umfasst die ursprünglichen Ringe, räumliche Zuordnungen zu Gebäudeteilen, vollständige lineare und sRGB-Farbwerte, 8-Bit-Farbwerte sowie 418 Glaskomponenten aus 91 Quellenfamilien.

Diese Farben dokumentieren die vorhandene Illustration; sie sind keine neu vermessenen Materialfarben. Getrennte Komponenten mit gleicher Kurz-ID bleiben getrennt. Das Gzip ist verlustfrei, besitzt den Zeitstempel null und ist 3.109.627 Bytes groß. Es bleibt ein Offline-Quellennachweis und wird nicht als vollständiger Datensatz in die Browseranwendung importiert. Die Tests prüfen die historischen Eingaben und Projektdateien erneut gegen v1.0.68, erhaltene Farben an passenden neuen Quellflächen sowie den gesonderten Umgang mit bestehenden Glasgebäuden.
