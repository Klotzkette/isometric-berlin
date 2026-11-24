# Straßenfassaden zwischen Kollwitzplatz und Wasserturm

Auf 45 Straßenseiten von 32 Häusern sind 1.189 Fenster anhand älterer Schrägluftbilder einzeln verortet. Hinzu kommen 28 breite Öffnungen in den Erdgeschossen. An der Rykestraße hat der ockerfarbene Altbau profilierte Fensterbekrönungen und eine vorgestellte Balkonbrüstung. An der Knaackstraße unterscheiden sich die hell verputzten Häuser am Wasserturm von den roten und hellen Feldern des Eckbaus zur Rykestraße. Die Wörther Straße zeigt unter anderem Rundbogenfenster und die in der Aufnahme roten Markisen über zwei Ladenabschnitten.

| Straße | Ausgewertete Außenwände | Fenster | Breite Erdgeschossöffnungen |
| --- | ---: | ---: | ---: |
| Rykestraße | 9 | 246 | 6 |
| Knaackstraße | 16 | 467 | 9 |
| Kollwitzstraße | 11 | 229 | 2 |
| Wörther Straße | 9 | 247 | 11 |

Die zwei Bildtafeln vergleichen alle vier Straßen jeweils aus derselben Kameraposition. Die Aufnahmen stammen aus einer WebGL-Prüfansicht der regulären Stadtgeometrie einschließlich der früheren Kiezfassaden. Die neue Geometrie wurde für den Vergleich ausgeblendet und wieder eingeblendet. [Gezeichnete Ansicht vorher und nachher](kollwitz-fassaden-v381-gezeichnet.webp) · [Blockansicht vorher und nachher](kollwitz-fassaden-v381-blockstil.webp)

## Bildgrundlage und Genauigkeit

Die Fassadenbilder stammen aus den Berliner Schrägluftaufnahmen von 2013, die über das texturierte Stadtmodell von 2014 zugänglich sind. Die Archivkörper wurden den bestehenden amtlichen Gebäudegrundrissen zugeordnet. Für jede verwendete Fassade wurde die Aufnahme auf ihre reale Wandebene entzerrt. Der größte Abstand der zugeordneten Archivflächen zur Wandebene beträgt 0,48 Meter. Die Bilddeckung beträgt je Wand mindestens 78,9 Prozent. Sichtbare Fensterachsen und Geschosse wurden im Bild identifiziert, die einzelnen Öffnungen anhand ihrer Laibungskontraste eingepasst. Die öffentlich zugewandte Lage wurde an den kartierten Straßen und benachbarten Grundrissen geprüft. [Archiv des texturierten Berliner Stadtmodells](https://www.3dcitydb.net/3dcitydb/fileadmin/mydata/Berlin_Demo/) · [Denkmalensemble Kollwitzplatz](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09050453)

Die 18 aus den Aufnahmen abgegrenzten Erker- und Balkonfelder, ihre Brüstungen, die Putzprofile und die Markisen sind als dreidimensionales Relief modelliert. Feinmaße, Ausladung und Farben sind angenähert. Die historische Aufnahme belegt den damaligen Fassadenzustand. Für heutige Nutzungen wurden die Berliner OpenStreetMap-Daten vom 22. November 2026 hinzugezogen. Die Quellenbelege enthalten den zugeordneten Gebäude- und Bildbezeichner, die Wandebene, Fensterpositionen, abgelesene Fassadenfelder und passende aktuelle Gewerbeeinträge. [Quellennachweis](../geo_data/regierungsviertel/kollwitz-fronts-v381-survey.json.gz)

## Einbindung und Speicherbedarf

Die regulären Stadtpakete liefern die Gebäudegrundrisse, Hofseiten und Dächer. Die neue Fassung ergänzt die belegten Straßenflächen. Frühere Fassadenakzente an anderen Häusern und die Materialkorrektur v271 verwenden weiterhin ihre bisherigen Eigentümer. Das Vorderhaus und die Basilika der Synagoge sowie der Wasserturm selbst haben eigenständige Modelle. In der Blockansicht werden die Fassadendetails auf die tatsächlich sichtbaren, treppenförmigen Außenkanten der zugehörigen Häuser projiziert.

Die vier intern komprimierten Dateien belegen zusammen **57.247 Byte** für beide Kacheln im gezeichneten Stil und **115.104 Byte** für beide Kacheln im Blockstil. Der Viewer lädt den jeweiligen Stil beim Eintritt in die Kachel. Alle Fassaden einer Kachel werden mit einem zusätzlichen Zeichenaufruf dargestellt. Positionen bleiben auf den Zentimeter erhalten. Die größere Blockdatei nutzt 24-Bit-Differenzen für ihre Dreiecksindizes und einen 32-Bit-Indexpuffer in WebGL.

Der Generator prüft die vier Dateien mit `python scripts/build_kollwitz_fronts_v381.py --check` bytegenau. Der Regressionstest unter `src/app` läuft mit `bun test tests/kollwitz-fronts-v381.test.ts`. Er prüft unter anderem die Besitzer in beiden Darstellungsarten, die Kachelnaht, die großen Dreiecksindizes, die Speicherabrechnung sowie abgebrochene oder konkurrierende Ladevorgänge.
