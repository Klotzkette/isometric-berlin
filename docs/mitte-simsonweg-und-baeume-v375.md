# Simsonweg und Bäume in Berlin-Mitte

## Vom Brandenburger Tor zum Reichstag

Der Simsonweg führt vom Platz des 18. März durch den Großen Tiergarten zur Scheidemannstraße. Ein kurzer Abzweig führt zum Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas. Das schwarze Wasserbecken und seine steinerne Einfassung besitzen eigene Geometrie. [Stiftung Denkmal](https://www.stiftung-denkmal.de/denkmaeler/denkmal-fuer-die-im-nationalsozialismus-ermordeten-sinti-und-roma-europas/)

Im Geoportal Berlin lässt sich der Hauptweg im Liegenschaftskataster unter der Kennung `DEBE01YYK0002LBy` wiederfinden. Die Straßenbefahrung trennt einzelne Streifen mit Pflaster und wassergebundener Decke. Auch OpenStreetMap enthält einen etwa 2.944 m² großen gepflasterten Wegumriss. In v1.0.254 konnten sich mehrere dieser Flächen und das ältere, in Quadrate aufgeteilte Gelände gegenseitig verdecken. Bei einer mobilen Ansicht vom Tor war eine rund 2.038 m² große vermessene Gehwegfläche im Bild fast vollständig grün. [Berliner Liegenschaftskataster](https://gdi.berlin.de/services/wfs/alkis?SERVICE=WFS&REQUEST=GetCapabilities) · [Straßenbefahrung Berlin](https://gdi.berlin.de/services/wfs/strassenbefahrung?SERVICE=WFS&REQUEST=GetCapabilities) · [Wegumriss bei OpenStreetMap](https://www.openstreetmap.org/way/1189808194)

Der korrigierte Korridor umfasst 3.208 m² Mosaikpflaster, 5.206 m² wassergebundene Decke und 1.832 m² Steinbelag. Hinzu kommen die vermessenen Baumscheiben und ein schmaler Rasenrand. Der südliche Seitenast reicht bis zu seiner tatsächlichen Straßenkante. Die sechs später eintreffenden Bodenpakete lassen den Weg frei. An 20.004 geometrischen Prüfpunkten beträgt der kleinste Abstand zwischen der neuen begehbaren Oberfläche und dem alten Raster 7,8 cm.

## Gehölzboden und Steinplatten am Denkmal

Neben dem Simsonweg überdeckten sich gerasterter Boden und kartierte Gehölzflächen. In der späten mobilen Ansicht lagen die beiden Oberflächen an einem gemessenen Bildpunkt nur fünf Millimeter auseinander. Die fünf kartierten Gehölzflächen umfassen zusammen 20.116 m². Ihre Dreiecke sind am 16-m-Raster des Geländemodells ausgerichtet. An den 3.813 geprüften Dreieckskanten beträgt die maximale Höhenabweichung gegenüber dem interpolierten Gelände 1,25 cm. Die beiden unterirdischen Tunnelbauwerke im Liegenschaftskataster besitzen an der Oberfläche eigene, getrennt erfasste Zugänge.

Um das schwarze Becken liegen einzelne graue Steinplatten, zwischen denen Pflanzen wachsen. Die Konturen außerhalb der 237 bereits modellierten Gedenksteine stammen aus einem 35 × 35 m großen amtlichen Orthofoto von 2024. Das untersuchte Außenfeld umfasst rund 177 m², davon rund 63 m² einzelne Granitflächen. Das Orthofoto von 2026 dient als Gegenprobe. Das Modell verwendet die ermittelten Konturen als Geometrie. [Berliner TrueDOP 2024](https://gdi.berlin.de/services/wms/truedop_2024?SERVICE=WMS&REQUEST=GetCapabilities) · [Berliner TrueDOP 2026](https://gdi.berlin.de/services/wms/truedop_2026?SERVICE=WMS&REQUEST=GetCapabilities)

## Bäume an beiden Orten

Das Berliner Baumkataster führt Anlagen- und Straßenbäume getrennt. Im untersuchten Ausschnitt zwischen Tor und Reichstag sind 228 Anlagenbäume und 78 Straßenbäume erfasst. Im Ausschnitt am Robert-Koch-Platz sind es 30 Straßenbäume. Alle 336 Standorte waren bereits im Parkpaket von v1.0.254 enthalten. Trotzdem fehlten in einem mobilen WebKit-Test noch 90 Sekunden nach der ersten bedienbaren Kartenansicht die Baumkronen. Der Viewer hatte das vollständige Parkpaket zu diesem Zeitpunkt noch nicht angefordert. [Berliner Baumkataster](https://gdi.berlin.de/services/wfs/baumbestand?SERVICE=WFS&REQUEST=GetCapabilities)

Der früh gezeichnete Bestand ist größer als die 336 amtlichen Vergleichspunkte, weil der Viewer auch weitere vorhandene Baumquellen verwendet. Er umfasst 483 Standorte im östlichen Tiergarten und 39 am und um den Robert-Koch-Platz. Weitere 141 Standorte aus den Berliner Katastern kommen im Zentrum hinzu. Davon liegen 47 im Bereich des Wasserspielplatzes an der Eichendorffstraße. Für 513 der 522 bereits vorhandenen Bäume ließ sich der Stammfuß eindeutig auf der sichtbaren Bodenoberfläche verorten. Die übrigen neun behalten ihre bisherige Höhe. Für alle 513 eindeutig vermessenen Stammfüße liegt der endgültige Kontakt innerhalb eines Millimeters auf dem Boden. 81 davon benötigen während des Nachladens einen vorübergehend längeren Stammfuß. Im Blockstil nutzt der Viewer sein eigenes Vier-Meter-Raster. 105 bislang freie und für einen kantigen Stamm ausreichend große Rasterzellen lassen sich aus den zusätzlichen Standorten ableiten.

## Weitere Wege im Bezirk Mitte

Die Prüfung vergleicht die tatsächlichen Dreiecke kartierter Sand- und Erdwege sowie die befestigten Wegteile in öffentlich kartierten Parks und Fußgängerplätzen mit den darüberliegenden Rasenflächen. Ältere, vier Meter breite Rasterzellen und jüngere Vektorflächen können denselben Quadratmeter überdecken. Die folgende Tabelle zählt eine Fläche einmal, sobald sie von beiden freigelegt ist. Der separat neu aufgebaute Simsonweg ist aus dieser Rechnung ausgeschlossen.

| Ortsteil | Wieder sichtbare Wegefläche |
| --- | ---: |
| Tiergarten | 11.630,19 m² |
| Moabit | 2.750,56 m² |
| Mitte | 1.035,51 m² |
| Gesundbrunnen | 134,97 m² |
| Wedding | 0 m² |
| Hansaviertel | 0 m² |
| **Gesamter Bezirk** | **15.551,23 m²** |

Zu den betroffenen Orten gehören der Geschichtspark Ehemaliges Zellengefängnis Moabit, der Agnes-Sorma-Park und der Volkspark Humboldthain. In Wedding und im Hansaviertel ergab der Vergleich für diesen konkreten Konflikt keine Fläche. Andere Belagsarten, private Grundstücke und Wege außerhalb der untersuchten Modellflächen sind von dieser Prüfung nicht erfasst.

An 14 namentlich verorteten Punkten wurde die Oberfläche zusätzlich im aufgebauten Modell mit senkrechten Sichtstrahlen geprüft. An 13 Punkten trifft der Strahl den erwarteten ursprünglichen Weg. Im ULAP-Park trifft er die eigens für diesen Ort modellierte Feinkiesfläche. Im Geschichtspark Moabit lag das verdeckende Raster beispielsweise 86,5 cm über dem Pflaster, im Humboldthain lag der überdeckende Rasen an einem Sandweg 7,3 cm höher.
