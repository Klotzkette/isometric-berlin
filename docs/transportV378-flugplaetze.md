# Flugplätze und Vorfelder im Berliner Stadtmodell

## Berlin Brandenburg

Acht abgestellte, markenlose Verkehrsflugzeuge stehen auf kartierten Positionen am Haupt- und Südpier. Je eine ausgefahrene Fluggastbrücke verbindet einen im Stadtmodell vorhandenen festen Brückenkopf mit der linken vorderen Kabinentür. Die Brücken haben bewegliche Tunnelabschnitte, verglaste Seiten, eine dunkle Anschlussmanschette und ein Stützfahrwerk. Kabinenfenster, Cockpit, Tragflächen, Triebwerksgondeln und Leitwerke sind als eigene Geometrie dargestellt. Bemalung und Flugzeugbelegung sind illustrative Momentaufnahmen. Die am Nordpier dokumentierte Fußabfertigung bleibt erhalten. [Flughafen Berlin Brandenburg, Anlagenübersicht](https://corporate.berlin-airport.de/content/dam/corporate/de/unternehmen-presse/ber/flughafenanlagen-ber.pdf)

Die Standpunkte stammen aus dem vorhandenen OSM-Vorfeldbestand, die Brückenköpfe aus den bereits gebauten Terminalteilen. Die Verbindung greift 1,3 m in die Grundrisse der gewählten Köpfe ein und erreicht dadurch auch deren separat gebaute Blockdarstellung. Im tatsächlich dekodierten Ausgangsmodell treffen die acht Standpunkte in beiden Ansichten das Vorfeld auf Modellhöhe 3,05 m. Form, Lage der Kabinentüren und Höhen der beweglichen Brücken sind grafische Annäherungen. [OSM-Standpositionen](../geo_data/regierungsviertel/ber-ground-v236-source.json.gz) · [Vorhandene OSM-Gebäudeteile](../geo_data/regierungsviertel/ber-buildings-v236-source.json.gz) · [Bisheriges BER-Modell](ber-buildings-v236.md)

Ein kleines Licht über der bestehenden Towerkanzel pulsiert bei Blick auf das Modell. Bei aktivierter Bewegungsreduktion leuchtet es stetig. Es verwendet den Zeichentakt des Viewers und eine unbeleuchtete Linse mit einem prozeduralen Lichtschein. Rhythmus, Farbe und Größe dienen der Erkennbarkeit im Stadtmodell. [Architektur der Kanzel](https://www.imhof-architektur.de/tower-ber)

## Gatow, Tegel und Tempelhofer Feld

Gatow erhält vier abgestellte Ausstellungssilhouetten vor den historischen Hallen. Lage, Ausrichtung, Spannweite und Umriss der glänzenden, hellgrauen und ockerfarbenen Exponate folgen dem amtlichen Luftbild vom Frühjahr 2026. Die Modelle zeigen die sichtbaren Flugzeugformen in vereinfachter Darstellung. Auf dem Tempelhofer Feld steht die Nord 262 am kartierten und im Luftbild bestätigten Ort. Das Luftbild am OSM-Eintrag des Rosinenbombers zeigte zum Aufnahmezeitpunkt eine freie Fläche. [Museumsgeschichte Gatow](https://gatow.mhmbw.de/de/flugplatz-museumsgeschichte) · [Kartierter Standort der Nord 262](https://www.openstreetmap.org/way/1238793309) · [Geoportal Berlin, TrueDOP 2026](https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&REQUEST=GetCapabilities)

Auf der ehemaligen nördlichen Tegeler Bahn erscheinen acht helle Sperrkreuze und die zwölf verbliebenen Streifen am westlichen Kopf. Die Lage folgt dem Luftbild und der bereits modellierten Bahnachse. Die übrigen befestigten, teils umgenutzten Flächen behalten ihren vorhandenen Ausbauzustand. [Bisheriges Flugplatzmodell](kladow-airfields-v346.md) · [Berliner Luftbilddienst](https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&REQUEST=GetCapabilities)

Die Auswertung nutzt Geoportal Berlin (TrueDOP, dl-de/zero-2-0) und © OpenStreetMap-Mitwirkende (ODbL). Die im Laufzeitmodell verwendeten neuen Formen wurden direkt als farbige Geometrie erzeugt. Für die Nachprüfung wurden folgende TrueDOP-Ausschnitte im Bildkoordinatensystem EPSG:25833 gelesen.

| Ausschnitt | Mittelpunkt im Modell (X, Z) | Bildfeld / Pixel | SHA-256 des JPEG (Anfang) |
|---|---:|---:|---|
| Gatow, Ausstellung | −15.506, 4.655 | 195 × 195 m / 700 × 700 | adc4234fa261 |
| Tempelhof, Nord 262 | 1.978, 4.638 | 60 × 60 m / 700 × 700 | 82e671b6c436 |
| Tempelhof, westliches Vorfeld | 1.064, 4.381 | 85 × 85 m / 700 × 700 | 0a875561b5f0 |
| Tegel, nördliche Bahn | −5.545, −4.655 | 3.110 × 550 m / 3.110 × 550 | 539b4e0b5030 |
| Tegel, westliche Restmarkierungen | −7.000, −4.487 | 215 × 215 m / 700 × 700 | 03e5ce7bc0aa |

Die alten Luftbilder werden nicht mit dem Viewer übertragen. Die Ergänzungen leben ausschließlich mit ihrer jeweils geladenen Kachel. Ohne Texturen belegen die statischen Meshpuffer zusammen 279.076 Byte in der gezeichneten und 1.080.432 Byte in der Blockansicht. Hinzu kommen zwölf Byte für die Position des Lichtscheins. Das größte Einzelpaket beansprucht davon 110.832 beziehungsweise 431.136 Byte.
