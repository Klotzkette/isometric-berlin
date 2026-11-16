# Berliner Dönerläden in v356

Die Standortliste umfasst 36 Berliner Dönerläden, darunter bekannte
Einzelbetriebe und belegte Filialen von Imren, Hasır, Nefis und Rüyam. Sie
verbindet die Hinweise von [Berlin.de](https://www.berlin.de/en/tourism/insider-tips/7409762-5766508-berlins-best-doner-kebab.en.html)
und [visitBerlin](https://www.visitberlin.de/de/berliner-doener) mit
Betreiberangaben, konkreten Ladenprofilen und OpenStreetMap. Die Auswahl deckt
klassische Kebabrestaurants, Gemüsekebab und mit Vöner auch ein rein
pflanzliches Angebot ab. Sie ist keine Rangliste oder Vollerhebung.

Die Standortbelege wurden am 16. November 2026 geprüft. Die acht veröffentlichten
[Imren-Adressen](https://imren-grill.de/standorte/) und die vier Filialen
der [Nefis-Standortliste](https://www.nefis-gemusekebap.de/location-and-hours)
sind einzeln erfasst. Gleichlautende Betriebe wurden nur zusammengeführt,
wenn die belegten Adressen und die Lage zur selben Einrichtung führen.

- **Oggi’s an der Heidestraße** liegt an der Ecke Döberitzer Straße 1.
  Der [rbb-Ortstermin in Moabit](https://www.rbb-online.de/unterhaltung/archiv/videos-berlin/berlin-erleben/2026/30-dinge-die-moabit-besonders-machen/unsere-tipps.file.html/TIPPS_30DingedieMoabitbesondersmachen_2600605.pdf)
  bestätigt den Standort. Der Eintrag übernimmt die bestehende Geometrie und
  den bestehenden Rundgangspunkt. Der Kiosk an der Schönhauser Allee ist
  ein eigener Betriebspunkt; für ihn weichen die Hausnummern im Bezirksbescheid
  und in der Karte voneinander ab.
- **Mustafa’s** liegt aktuell auf der Ostseite an [Mehringdamm 33](https://mustafas.de/).
  Der frühere Stand an Nr. 32 wird nicht als heutiges Mustafa’s dargestellt.
  **Rüyam** führt laut [Betreiber](https://rueyam.de/) am neuen Standort
  Hauptstraße 36 und an der Schönhauser Allee 44a. Die beiden OSM-Punkte an
  der Hauptstraße liegen im selben Gebäude und sind ein Eintrag.
- Die Standortliste enthält **33 kartierte Gebäudeumrisse**, **zwei
  Verzeichniseinträge ohne eindeutigen Gebäudeumriss** und den **bereits
  modellierten Oggi-Standort in Moabit**. Die zwei Konflikte betreffen
  Imren an der Wiener Straße und Doyum an der Admiralstraße. Sie stehen in
  der Suche; eine nicht belegte Fassade wird ihnen nicht zugewiesen.
- Fassaden und Eingänge sind getrennte Aussagen. Ein Punkt im
  Gebäudeumriss beweist weder die Benutzung einer bestimmten Tür noch, wie
  viel von der Fassade ein Geschäft belegt. Die Standortdatei selbst
  weist keine shop-spezifischen Türkoordinaten aus. Die Ansicht übernimmt
  nur die im Viewer getrennt belegten und begrenzten Fassaden.
- Ausgeschlossen bleiben alte Standorte, unbelegte Adressen von
  Startseiten-Teasern sowie Gastronomie mit nur ähnlichem Namen.
  Das Bagdad an der Schlesischen Straße ist als widersprüchlicher
  Fall dokumentiert; die Karte führt an der veröffentlichten Adresse
  einen anderen Betrieb.

Die belegten Einzelentscheidungen stehen in
`geo_data/regierungsviertel/doener-v356-curation.json`. Die abgeleitete
Quelldatei `geo_data/regierungsviertel/doener-v356-source.json.gz` verwendet
den [Geofabrik-Auszug Berlin](https://download.geofabrik.de/europe/germany/berlin.html)
vom 15. November 2026 um 21:22:28 UTC (Sequenz 4965). Der Builder prüft die
amtliche Berliner Landesgrenze, die Identität der OSM-Objekte und die Lage
innerhalb der zugeordneten Umrisse. Die Auswahl bezieht Standorte aus
mehreren Bezirken ein; allein aus dem Auszug lässt sich kein lückenloser
aktiver Geschäftsbestand ableiten.

```sh
uv run --with osmium --with pyproj --with shapely \
  python -m scripts.build_doener_inventory_v356 /pfad/zu/berlin-latest.osm.pbf
```

- SHA-256 des Geofabrik-Auszugs: `aaa9292be3770db6dcf24165698c2dc821bba4b6f4911c81fe88936ec2375325`
- SHA-256 der Quelldatei: `a76830de247f39a3864ec5eeb6b6c440f1c89fe64643173da3e45ffcd56752fb`

Die Geodaten stammen von den [OpenStreetMap-Mitwirkenden](https://www.openstreetmap.org/copyright)
(ODbL). Adressquellen und Fotovorlagen werden verlinkt; die ausgewerteten
Webseiten und Fotonutzdaten werden nicht mit dem Viewer gebündelt.
