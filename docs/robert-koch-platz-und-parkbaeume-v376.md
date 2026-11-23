# Kastanien am Robert-Koch-Platz und Bäume in drei Parks

Das Berliner Straßenbaumkataster ordnet dem Robert-Koch-Platz **19 Gemeine Rosskastanien** zu. In der weiteren Umgebung stehen auch Linden und Ahorne an der Hannoverschen Straße und am Platz vor dem Neuen Tor. Der größere Ausschnitt der Vorgängerversion enthält insgesamt 39 Bäume aus mehreren Quellen. [Berliner Baumkataster](https://gdi.berlin.de/services/wfs/baumbestand?service=WFS&request=GetCapabilities)

Bei den 19 Kastanien richtet sich die Form der gezeichneten Krone nach ihrer erfassten Gesamthöhe und ihrem Kronendurchmesser. Alle fünf Laubgruppen und ihre Varianten bleiben erhalten. Zuvor erreichte eine mit 28 m erfasste Kastanie in der Zeichnung nur 24,87 m. Die größte Breitenabweichung betrug 4,89 m. Im Vergleich der erzeugten Kronen mit den Katasterwerten liegt die Abweichung für Höhe und Breite bei allen 19 Bäumen unter einem Millimeter. Das beschreibt die Modellmaße. Die Vermessungswerte selbst sind gerundet und einzelne Zweige sind modelliert.

Im Blockstil ließ die allgemeine Bestandsausdünnung auf dem Platz bisher zwei dieser Kastanien auf dem Handy und sieben am Desktop erscheinen. Beide Profile zeigen jetzt alle 19. Stamm und zwei abgestufte Laubblöcke verwenden die registrierte Position, Stammstärke, Gesamthöhe und Kronenbreite. Die einzelnen Kronenstufen sind eine zeichnerische Annäherung. Der Fußgänger trifft den jeweiligen quadratischen Stamm an derselben Position. Für vier Bäume schnitt ein früher auf die Zellmitte gesetzter Standardstamm kartiertes Pflaster. Alle 19 maßstäblichen Stammgrundrisse sind an ihren tatsächlichen Positionen frei von kartierten Straßenflächen, Gebäuden und Gewässern.

## Frühe Baumansicht in Mitte und Moabit

| Amtlicher Standort | Früh sichtbare Bestandsbäume |
| --- | ---: |
| Invalidenpark | 96 |
| Geschichtspark Ehemaliges Zellengefängnis Moabit einschließlich der Vorflächen und Zufahrt | 181 |
| Agnes-Sorma-Park | 53 |

Diese 330 Bäume waren im vollständigen Parkbestand bereits enthalten. Vor dessen verzögertem Laden waren die Standorte in der gezeichneten Ansicht kahl. Pro Park zeichnen jetzt zwei instanzierte Gruppen die Stämme und ersten Kronen. Beim Laden des vollständigen Parks erscheinen die botanisch detaillierten Formen an denselben Standorten. Standortdaten und Maße kommen aus dem vorhandenen Parkbestand. Der Abgleich der gebietsbezogenen Katasterkennungen akzeptiert eindeutig zuordenbare Standorte mit höchstens fünf Zentimetern Abstand. Bereits in der ersten Mitte-Runde ergänzte Bäume werden dabei separat weitergeführt.

Am Rundweg im Geschichtspark Moabit bildeten zugeschnittene Wiesenstücke beidseits des Weges einen gezackten hellgrünen Saum. Die ursprünglichen Bodenplatten und ihre Restdreiecke hatten dieselbe gespeicherte Farbe, wurden jedoch unterschiedlich schattiert. Die als Grünfläche nachgewiesenen Reststücke erhalten jetzt auch nach dem Zuschneiden dieselbe ortsabhängige Rasendarstellung. Der ockerfarbene Weg behält seine kartierte Kontur und Höhe.

Zusammen mit dem Robert-Koch-Platz lassen sich 234 eindeutige vorhandene Blockzellen an diesen vier Orten zusätzlich zur normalen Auswahl zulassen. Für ihren Stamm werden die Flächen von Straßen, Gebäuden und Gewässern geprüft. Der Renderer, die Fußgängerkollision und die Wegeplanung der Minecraft-Figuren verwenden die ergänzte Auswahl. Die Zahl 234 enthält auch Zellen, die bereits vorher für das jeweilige Gerät ausgewählt waren.

Die gespeicherten Gebietskennungen und Baummaße lassen sich aus dem Repository offline überprüfen. Das Skript verknüpft die vier amtlichen Standortnamen mit dem archivierten Baumkataster und den veröffentlichten Park- und Blockdaten. [Generator](../scripts/build_mitte_canopy_v376.py) · [Geometrieprüfung](../tests/test_mitte_canopy_v376.py) · [Viewer-Prüfung](../src/app/tests/mitte-canopy-v376.test.ts)
