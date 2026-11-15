# Clayallee und Domäne Dahlem · V347

Die Ergänzung verfeinert sieben bisher einfache Gebäudekörper an der Clayallee und ergänzt das ausgestellte Flugzeug sowie landwirtschaftliche Details der Domäne. Die vorhandenen vollständigen Domäne-Gebäude aus V187 bleiben unverändert.

## Gebäude und Quellen

Elf vollständige amtliche LoD2-Gebäudefamilien mit 36 Teilen ersetzen ausschließlich die exakt nachgewiesenen bisherigen Körper und ihre Navigation: US-Konsulatsgebäude (`way/96924281`), Einkaufsgebäude mit EDEKA (`way/192647261`) und fünf Gebäude von Fünf Morgen (`way/216974000`, `216974007`, `216974021`, `216974009`, `216974020`). Die vollständigen Wände, Dachflächen, Höhenstaffelungen und Nebenteile stammen aus der [Berliner LoD2-Kachel 382/5812](https://gdi.berlin.de/data/a_lod2/atom/LoD2_382_5812.zip). Ein gemeinsamer Höhenbezug hält auch die kleinen erhöhten Vordächer am Konsulat in ihrer richtigen relativen Höhe.

Materialien und Fassadengliederung orientieren sich am [Landesdenkmalamt](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/usa/steglitz-zehlendorf/hauptquartier-general-lucius-d-clay-647598.php), der [Denkmalbeschreibung](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09075385), den [Architekten von Fünf Morgen](https://www.bollinger-fehlig.de/projekte/5-morgen/) und deren [Projektblatt](https://www.bollinger-fehlig.de/wp-content/uploads/2021/01/210104_5MMI_BFA_PB_EN.pdf). [EDEKA](https://www.edeka.de/maerkte/801006/) bestätigt den Standort Clayallee 171–177. Fensterabstände, Rahmen, Laibungen und Farbtöne sind auf die echten Wandflächen angepasste Erkennungsdetails, keine vermessene Rekonstruktion jeder Öffnung. Es entstehen keine Konsulatsinnenräume oder betrieblichen Einrichtungen.

Die amtlichen und kartierten Grundrisse decken sich bei sechs Eigentümern mit einer Schnittmenge/Vereinigungsfläche von 98,1–99,0 %. Beim Konsulat beträgt sie 91,47 %; kleinere Flügel-/Vordachkanten unterscheiden sich zwischen den Quellen. Hier wird die vollständige zusammengehörige amtliche Gruppe übernommen, nicht eine behauptete punktgenaue Übereinstimmung. Die ursprünglichen Quelldateien bleiben erhalten.

## Museum und Landwirtschaft

Das [AlliiertenMuseum](https://www.alliiertenmuseum.de/sammlung/) nennt die Hastings TG 503 als Außenexponat; weitere Flugzeuge seiner Sammlung sind damit nicht als hier ausgestellt belegt. Deshalb wird genau eine Hastings am kartierten Flugzeuggrundriss ergänzt: vier Sternmotoren, vierblättrige Propeller mit gelben Spitzen, runder Rumpf, blaue Seitenlinie, Fenster, Fahrwerk und Leitwerk. Die Spannweite von 34,44 m folgt der [Museumsreferenz](https://paradata.org.uk/content/4663321). Lage und Orientierung stammen aus OSM `way/210753143`; Querschnittshöhen, Fensterabstände und Standneigung sind Fotoabschätzungen. Eine zusätzliche Rosinenbomber-Flotte wird nicht erfunden.

Die Ackerzeilen liegen innerhalb des kartierten Domäne-Feldes `way/22566415`, mit Abstand zum Rand und Aussparungen für alle erfassten Wege, Gebäude und Wasserflächen. Sie vermitteln die [Landwirtschaft der Domäne](https://www.domaene-dahlem.de/landgut/landwirtschaft/); Anbauart und Zeilenphase sind keine Aussage über die aktuelle jährliche Fruchtfolge. Der [Betreiberplan von 2025](https://www.domaene-dahlem.de/wp-content/uploads/2025/06/Lageplan-Domaene-Dahlem.pdf) ordnet die Imkerei dem vorhandenen Gebäude `way/108631421` zu. Vier Beuten stehen als ausdrücklich geschätzte kleine Anordnung unmittelbar daneben innerhalb des kartierten Hofes, außerhalb des Gebäudes und der erfassten Wege. Anzahl und einzelne Standorte sind nicht vermessen. Die separat kartierte [Bienenburg für Wildbienen](https://www.domaene-dahlem.de/wildbienen-auf-der-domaene-dahlem/) `node/13176697933` erhält ein eigenes kleines Insektenhotel und wird nicht mit der Imkerei verwechselt.

## Einbindung und Erhalt

`clayDahlemV347` aus `ClayDahlemV347.ts` wird im SourceQuarter-Katalog nach `airfieldSurfacesV346` und vor nachgelagerten Bodenüberlagerungen eingetragen. Zwölf Variantenpakete gehören zu sechs bestehenden Kacheln: `outer187--14_13`, `--14_14`, `--12_11`, `--12_12`, `--11_11`, `--11_12`. Die detaillierte Geometrie folgt vollständig deren Laden, Freigabe, Wiederherstellung und Quellenprüfung. Drawn läuft mobil unverändert; Native hat eigenständige kardinale Flächen. Keine Texturen, zusätzlichen Abdeckungsflächen oder erhöhten Live-Grenzen sind erforderlich.

Rohdaten- und Vorgängerprüfsummen sichern den tatsächlichen Besitzer. Nur nachgewiesene Dreiecke, Dachlinien und Navigationskörper der sieben alten Gebäude werden ausgeblendet; falsche oder unvollständige Besitzer behalten ihren bisherigen Zustand. Alle anderen Körper, Straßen, Wege, Wasserflächen und Navigation bleiben erhalten. Der Generator prüft die unveränderten Grenzen von 16 Teilen, 400.000 Vertices und 2.400.000 Indizes je Kachel.

## Reproduktion und Prüfung

`uv run python scripts/build_clay_dahlem_v347.py --check` rekonstruiert aus der eingefrorenen, kleinen Quellenauswahl. `--extract` ist nur für eine bewusst erneuerte Auswahl aus den ignorierten lokalen OSM-/LoD2-Arbeitsdaten bestimmt. Bildreferenzen werden nur lokal angesehen; keine Bildpixel werden ausgeliefert.

`bun test scripts/clay-dahlem-v347.test.ts` prüft sämtliche zwölf Produktionsvorgänger, falsche und unvollständige Quellen, erneute Anwendung, exakte Dreiecksänderungen, Navigationserhalt und kardinale Native-Flächen. Die zusätzliche Bodenprüfung des Generators hält die Beuten im Hof und außerhalb des Imkereigebäudes. Die amtliche Gebäudehöhe bleibt von den geschätzten Fassadenöffnungen getrennt dokumentiert.
