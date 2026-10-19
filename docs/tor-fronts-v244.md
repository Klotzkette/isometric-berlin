# Torstraße: vorhandene Fenster und Erdgeschosse lesbarer machen (v244)

Die Fortsetzung verändert ausschließlich die bereits bestätigten Straßenfronten
an der Torstraße: **1.999 Fenster auf 77 Gebäudeeltern**, darunter **220 bereits
modellierte Schaufenster**. Grundlage sind die vollständigen v239-Öffnungen mit
je zwei passenden gelieferten Dreiecken, unveränderten Quellwandringen und
vorhandener Geländekorrektur. Es entsteht keine neue Fenster- oder Türverteilung.

V239 hatte nur 22,2 Prozent jeder Scheibe mit einem oberen Reflex versehen. V244
ergänzt die darunterliegende Glasfläche in zwei getrennten Flügeln. Der zentrale
alte Pfosten bleibt frei, der neue Glasgrund liegt im gezeichneten Modell nur
12 mm vor der bisherigen Scheibe und hinter den bestehenden Pfosten. Die alten
v239-Reflexe, Fensterköpfe, Leibungsstreifen und Sohlbänke liegen weiter davor.
Helle Querprofile unterteilen die vorhandenen hohen Scheiben. Die bestätigten
Schaufenster erhalten außerdem eine flache untere Füllung; keine erfundenen
Ladennamen, Auslagen oder Eingangstüren werden eingefügt.

Schmale seitliche Fensterprofile und Sohlbankrückläufe haben wirkliche räumliche
Tiefe statt nur einer flachen Rechteckfläche. Jede Ergänzung wird gegen die
vollständige Quellwand samt Löchern geprüft. Die Stärken, Glas-/Rahmenfarben und
Querunterteilungen sind zurückhaltende Darstellungsannahmen. Die früheren
Fensterabstände selbst waren bereits abstrahierte Darstellungen, keine
Einzelfenstervermessung. Wandfarben, Baukörper, Dächer, Hoföffnungen und sämtliche
historischen Details werden durch diesen Schritt weder übermalt noch ersetzt.

Die Torstraße 138 ist eindeutig als `DEBE01YYK00007I6`, OSM `386915734` und
[LDA 09080095](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080095)
belegt. Die Denkmalbeschreibung nennt Erker, seitliche Balkone, Giebelvorbau und
hohe Sockelzone. Da dieses Haus keine bestätigten v239-Öffnungen hat, bleibt es
hier unverändert. Für das ehemalige
[Leihamt Torstraße 164, LDA 09080101](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080101)
mit fünfgeschossiger Ziegelfassade und kleinen Fenstern wurde keine eindeutige
vorhandene Elternbindung hergestellt; es gibt deshalb keine geratenen Bauteile.
Diese Quellenprüfung ist keine Behauptung einer vollständigen Rekonstruktion
der beiden besonderen Häuser.

## Daten und Lebensdauer

- Generator: `scripts/build_tor_fronts_v244.py`.
- Eingefrorene Auswahl: `geo_data/regierungsviertel/tor-fronts-v244-source.json.gz`.
- Nachweis: `geo_data/regierungsviertel/tor-fronts-v244-evidence.json`.
- Separater Integrationsvorschlag: `geo_data/regierungsviertel/tor-fronts-v244-manifest-addition.json`.
- Sechs neue `torfront244-*`-Kacheln, je eine gezeichnete und eine unabhängig
  orthogonale native Familie. Keine gezeichneten Schrägflächen im Blockmodus.
- 2.667.345 Byte gzip für beide Familien zusammen. Vollständige GPU-Daten über die
  ganze Straße: gezeichnet 1.953.660 Byte, native 6.228.456 Byte. Die tatsächliche
  Residenz bleibt durch den bestehenden 24-MiB-Controller begrenzt; einzelne
  Pakete bleiben unter 4 MiB dekodiert und 1 MiB komprimiert.
- Ein vorhandener Paket-Mesh pro Kachel, keine neue globale Modellwurzel,
  Textur, Shader-Variante, pro-Frame-Arbeit oder Importdatenstruktur.
- Die leere zusätzliche Navigation verändert keine Böden, Wege oder Kollisionen.
  Die bestehenden Gebäude bleiben dafür verantwortlich.
- Alle zwölf ursprünglichen Stützpakete sowie alle zwanzig v239-Fassadenpakete
  werden unverändert per SHA-256 geprüft. Auch alle vorherigen Quellblätter
  bleiben erhalten. Der Generator bricht vor dem Schreiben ab, falls sie sich
  verändert haben. Er verändert das gemeinsame Manifest nicht selbst.

## Prüfung

`tests/test_tor_fronts_v244.py` kontrolliert Auswahl/Quell- und Paketreceipts,
beide gelieferten Dreiecke jeder Öffnung, Glas innerhalb der alten Öffnung,
freien Mittelpfosten, tatsächliche Profiltiefe, Schaufensterzuordnung,
Quellwand-/Lochgrenzen, orthogonale native Dreiecke und bestehende Paketlimits.
Der v239-Preservationstest läuft daneben unverändert weiter.

`src/app/tests/tor-fronts-v244.test.ts` dekodiert sämtliche neuen Pakete in beiden
Familien, prüft vollständige Vertex-/Indexzahlen, unveränderte Eingaben und
Navigation, vollständige GPU-Freigabe sowie Abbruch während kooperativer
Vorbereitung. Die v239-Begleitpakettests prüfen die alten Modelle weiterhin.

Für die Sichtprüfung liegen drei Kameras auf der nachweislichen Straßenseite:

| Abschnitt / Eigentümer | eye | target |
| --- | --- | --- |
| West / `DEBE01YYK0000AVu` | `[1231.626,16.7,-943.699]` | `[1237.923,10.7,-923.665]` |
| Mitte / `DEBE01YYK00003mY` | `[1990.716,17.76,-1138.325]` | `[1989.172,11.76,-1159.268]` |
| Ost / `DEBE03YY600007kx` | `[2759.803,17.75,-982.504]` | `[2769.072,11.75,-1001.348]` |
