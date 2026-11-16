# Einkaufszentren und Autohäuser in Berlin

Die Standortliste verbindet den Geofabrik-Auszug von OpenStreetMap vom
15. November 2026, 21:22 UTC mit der amtlichen Berliner Landesgrenze und der
Einkaufscenterübersicht auf Berlin.de. Die Abfrage vom 16. November umfasste
alle 51 Detailseiten der Übersicht. Bei Verkaufshäusern ergänzen belegte
Betreiberadressen die OSM-Einträge. Die Quellenlisten geben keine vollständige
Auskunft über derzeit nicht kartierte Autohäuser oder über Geschäftsaufgaben.
[Geofabrik Berlin](https://download.geofabrik.de/europe/germany/berlin.html) ·
[Berlin.de Einkaufscenter](https://www.berlin.de/special/shopping/einkaufscenter/)

Innerhalb der Landesgrenze enthielt der OSM-Auszug 365 Verkaufsstellen mit
`shop=car` und 105 Einträge mit `shop=mall`, zuzüglich einer Relation ohne
zusammenhängenden Außenring. Die abgeglichene Standortliste führt **342
benannte Autohäuser bzw. Autoverkaufsstellen** und **86 Einkaufszentren**.
Zum Beispiel gehören vier kartierte Teile zum Ring-Center und je drei zum
Spree Center und zu den Seddiner Passagen. Sie sind unter ihrem Standort
zusammengefasst und behalten ihre einzelnen Ausgangspolygone. Die vier
Standorte mit reiner Berlin.de-Koordinate führen in der Quelldatei ihre
Adresse, aber keinen fiktiven Gebäudekörper. 49 der 51 Berliner
Portalstandorte sind in der Liste enthalten. Fürst ist als laufendes
Umbauprojekt, Zoom als Büro- und Einzelhandelsobjekt separat dokumentiert.
[Fürst](https://www.berlin.de/special/shopping/einkaufscenter/2410482-1724954-fuerst-kurfuerstendamm-karree.html) ·
[Zoom](https://www.berlin.de/special/shopping/einkaufscenter/4714119-1724954-zoom.html)

- **166 Gebäudegeometrien** stammen vom exakt gleichen OSM-Objekt wie die
  Einrichtung. **122 weitere Gebäude** sind eindeutig durch die Lage des
  kartierten Punktes innerhalb einer Gebäudegrenze belegt. Geländegrenzen
  von Autohäusern oder ganzen Centeranlagen bleiben als eigene Polygone
  erhalten. Die Viewer-Kompilierung prüft die Unterstützung durch ihr
  tatsächlich geladenes Gebäudemodell separat.
- **23 kartierte Eingänge** liegen direkt an den erfassten Umrissen und sind
  eindeutig zugeordnet. Ein Tor, das dieselbe OSM-Kennung an zwei
  Centergrenzen trägt, bleibt als Beobachtung ohne eindeutige Zuweisung
  erhalten. Gebäudegrenzen und Quellenkoordinaten allein belegen weder die
  Architektur eines Eingangs noch seine Zugänglichkeit im 3D-Modell.
- **27 unbenannte OSM-Einträge** sowie die übrigen ausgeschlossenen oder
  ungelösten Fälle sind in der Quelldatei aufgeführt. `shop=car_repair` und
  `amenity=car_rental` liegen außerhalb des Verkaufsstellen-Filters.
  Anhand der Daten lässt sich kein lückenloser aktiver Geschäftsbestand
  behaupten. Die OSM-Beobachtungen sind als solche erkennbar.

Die Fotoabgleiche sind auf drei Fassadenabschnitte begrenzt. An der großen
westlichen BMW-Fassade am Messedamm folgen helle horizontale Aluminiumlamellen
über der breit gerasterten Schaufensterfront. Am südlichen Straßenrand der
East Side Mall bilden silbergraue Lamellen über dem dunklen oberen Teil und
blaugraue Glasfelder im Erdgeschoss das charakteristische Muster. Beim
Porsche Zentrum in der Franklinstraße belegt das Foto silbergraue
Rechteckpaneele und ein tiefer liegendes Schaufensterband; dieses Profil ist
an den vorhandenen Kernstadt-Umriss gebunden. Breiten, Farbtöne,
Fensterachsen und Höhen der modellierten Elemente sind aus den Fotos
abgeleitete Näherungen. Die drei vorhandenen Wandverläufe liefern
separat die Koordinaten, Richtung und zulässige Höhe. Die Fotos dienen
als Vorlage, ohne Bilddaten im öffentlichen Viewer.
[BMW, Lanz Architekten, Foto Christoph Stepan](https://www.architekturpreis-berlin.de/Archiv/2016/Projekte/044/index.html) ·
[East Side Mall, UNStudio](https://www.unstudio.com/projects/further/the-eastside-mall/) ·
[Porsche, Projektentwickler Eduard Winter](https://eduard-winter.de/EWfranklin.html)

Die Quelldatei `geo_data/regierungsviertel/retail-v355-source.json.gz`
enthält die amtlichen und kartierten Standortbelege, ihr Aufnahme- bzw.
Abrufdatum, die Eingangs- und Fassadenbelege sowie die Ausschlussgründe.
`geo_data/regierungsviertel/retail-v355-appearance.json` führt die sechs
Fotoreferenzen samt Anker, Normalen und geschätzten Bauteilabmessungen.
Die Tests prüfen Landesgrenze, Quellenzuordnung, Eingangspunkte und die
Verankerung aller Fassadenabschnitte auf den exakten bestehenden
Gebäudeumrissen. Die OSM-Quellen stehen unter ODbL. Die Verzeichnisdaten
von Berlin.de und Betreiberseiten sind als Adress- und Identitätsbelege
gekennzeichnet. Die Originalseiten und Fotos werden nicht gebündelt.
[OpenStreetMap-Mitwirkende](https://www.openstreetmap.org/copyright)

Zum Reproduzieren den in der Quelldatei per SHA-256 gepinnten Geofabrik-Auszug
als `berlin-latest.osm.pbf` in einem Arbeitsverzeichnis ablegen. Die dort
gehaltenen Abrufe der Berlin.de-Detailseiten und die PBF-Auswertung dienen als
Cache. Der Builder wird aus dem Repository ausgeführt.

```sh
uv run --with osmium --with beautifulsoup4 python -m scripts.build_retail_inventory_v355 /pfad/zum/arbeitsverzeichnis
uv run pytest -q tests/test_retail_inventory_v355.py
```
