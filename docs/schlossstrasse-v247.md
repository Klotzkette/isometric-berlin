# Schloßstraße: Rathaus/Albrechtstraße-Verbindung v247

Diese kleine Fortsetzung ergänzt fünf miteinander verbundene, bisher nur auf dem
Grundbelag dargestellte Straßenstücke an der Schloßstraße/Albrechtstraße. Sie
umfasst **63,542 m Quellachse** und **36,932 m kartierte Bordsteinkante**. Sie ist
keine Neumodellierung der gesamten Schloßstraße.

## Quellen und Erhalt

Grundlage ist ausschließlich der erhaltene OpenStreetMap-Auszug
`geo_data/regierungsviertel/raw/v182-steglitz/lines.json`, © OpenStreetMap-Mitwirkende,
ODbL. Verwendet werden die Straßenwege
[1201444601](https://www.openstreetmap.org/way/1201444601),
[4463223](https://www.openstreetmap.org/way/4463223),
[1422254219](https://www.openstreetmap.org/way/1422254219),
[30149207](https://www.openstreetmap.org/way/30149207) und
[1422257295](https://www.openstreetmap.org/way/1422257295), sowie die sechs
Bordsteinwege 1121036710, 1121036711, 1121036712, 1121036715, 1121036716 und
1121036717. Der Auszug belegt Verlauf, Fahrbahnbreite, rechten Radstreifen mit
1,6 m Breite, dessen beidseitige gestrichelte Begrenzung und die rote Färbung
auf genau zwei Wegen. Die abgesenkten Bordsteine bleiben abgesenkt.

Die früheren v246-Wege 451621864 und 483483276 werden ausdrücklich nicht erneut
belegt. Gebäude, ursprüngliche Navigation, v182-Modelle und frühere Detaildaten
bleiben unverändert. SHA-256-Belege in
`schlossstrasse-v247-evidence.json` sichern die Eingabedaten und beide betroffenen
Originalpakete. Eine Prüfung der tatsächlich dekodierten Originaldreiecke zeigt
unter den Ergänzungen ausschließlich den alten grünen Grundbelag auf Y=3 m,
keine bereits vorhandene Fahrbahn oder Markierung.

## Darstellung und Grenzen

Die gezeichneten Asphaltbänder folgen sämtlichen Quellsegmenten auf Y=3,09 m.
20 kleine, exakt innerhalb des gepufferten Quellverlaufs triangulierte
Gelenkflächen schließen die Ecklücke eines gebogenen Verlaufs und minimale
Rundungssäume. Markierungen liegen vollständig auf der tatsächlich dargestellten
Fahrbahn. Es werden keine Zebrastreifen, Ampeln, Abbiegepfeile oder weiteren
Fahrspurachsen erfunden. Bordsteinbreite und -höhe, Farbtöne, Farbauftragsdicke
und Strichlänge sind deklarierte Darstellungsmaße.

Die unabhängige native Darstellung verwendet ausschließlich achsenparallele,
in der jeweiligen Quellfläche vollständig enthaltene Asphalt- und Farbflächen.
Gleichfarbige benachbarte Rechtecke werden verlustfrei zusammengefasst. Alle
mobilen Geräte erhalten dieselben Details. Die Ergänzung enthält 69 gezeichnete
Kästen, 240 native Kästen und 20 gezeichnete Gelenkdreiecke, insgesamt 19.594 Byte
JSON. Sie wird in die bereits vorhandenen Steglitz-Batches aufgenommen; neue
Gelenkflächen erzeugen keine architektonischen Kantenlinien. Es entstehen weder
neue Paketdeskriptoren noch zusätzliche Draw Calls oder höhere Speichergrenzen.

## Prüfung

`tests/test_schlossstrasse_v247.py` prüft deterministische Wiederholung,
Quell-/Paket-Erhalt, vollständigen Straßenanschluss, tatsächlichen Untergrund
jedes Farbauftrags und die unabhängigen nativen Bordsteine.
`src/app/tests/schlossstrasse-v247.test.ts` prüft die erzeugten Instanzmatrizen,
Orthogonalität, Höhen, Geometriegröße, Texturfreiheit und aufwärts gerichtete
Gelenkdreiecke. Die gemeinsame Steglitz-Integration prüft zusätzlich die
unveränderten Gesamtbudgets und den örtlichen Laufboden.
