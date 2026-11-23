# Fernsicht und Bewegung im 3D-Viewer

Der v1.0.258-Viewer ging beim Schwenken alle 180 Millisekunden die gesamte Stadtliste durch. Gegen den Kamerafuß prüfte er bei einer noch ausstehenden Stadtkachel im ungünstigsten Fall 2.887 amtliche Geländeumrisse. Eine neu angekommene Kachel konnte außerdem die erneute Durchsicht der alten Häuser und Bänke im Szenengraphen auslösen, auch wenn sich deren Zuordnung gar nicht geändert hatte.

In v1.0.259 fasst ein räumlicher Index Kacheln mit ihren tatsächlichen seitlichen und vertikalen Grenzen zusammen. Nur ein Gruppenrahmen vollständig außerhalb der erweiterten Kamerasicht und der bestehenden Nahdistanz darf seine Mitglieder überspringen. Innerhalb jeder verbleibenden Gruppe gelten dieselben genauen Grenzen wie bisher. Bei unveränderter Kamera bleibt die sortierte Sichtliste wiederverwendbar. Ein eigener Index prüft am Kamerafuß die passenden Geländeumrisse mit ihren Original-Löchern. Die Koordinaten und die Gebäude-, Straßen- und Vegetationsdaten bleiben erhalten.

In einer breiten Fernsicht starten zuerst die vier nächsten Pakete. Bis zu vier weitere Originalpakete liegen unter gemessenen Strahlen vom Bildschirm zum Boden. So kann am Bildrand bereits ein Stadtteil auftauchen, während um das Blickziel noch Details nachladen. Direkt angefragte Ortsgeometrie behält Vorrang. Der Viewer verwendet dabei die vorhandenen Grenzen für parallele Transporte, Entpackung und Speicher. Er erzeugt keine vereinfachten Fassaden oder Ersatzkacheln. Ältere Stadtteilobjekte werden synchronisiert, wenn eine für sie relevante Zuordnung hinzukommt oder wegfällt.

Wenn man die bereits sichtbare Desktop-Karte aus dem Kerngebiet ins äußere Modell bewegt, dürfen die zugehörigen Kacheln jetzt parallel zur verlustfreien Speicheraufbereitung der bisherigen Kernstadt ankommen. Das große gemeinsame Modul für die äußeren Stadtumrisse behält dabei seinen normalen Startzeitpunkt.

## Prüfung der ursprünglichen Daten und Kosten

Die Regression vergleicht alle 3.087 regulären Kacheln mit dem vorherigen Frustum-Verfahren. Die Projektionsprüfungen umfassen Perspektiv- und Parallelprojektion, bodennahe und hohe Kameras sowie Standorte in West und Ost. Der Geländetest vergleicht dieselben Punkt-in-Polygon-Prüfungen einschließlich ausgesparter Flächen an einem Raster über Berlin und an exakten Polygonpunkten. Die bestehenden Tests zu Freigabe, Entsorgung, Familienwechseln, Puffern und Vorabladen liefen ebenfalls.

Bei einer festen Kamerafahrt im Cloud-JavaScript-Lauf entfielen auf 300 bewegte Sichtprüfungen im Median 76 ms in v1.0.258 und 53 ms in v1.0.259. Für 300 identische Ansichten lagen die Werte bei 101 ms und 0,65 ms. 24.000 echte Bodenabfragen entlang des Stadtquerschnitts benötigten 1.476 ms und 176 ms. Gemessen wurde jeweils der Median aus sieben abwechselnd ausgeführten Läufen nach einem Warmlauf. Diese Zahlen beschreiben die Prozessorarbeit der Kartenauswahl. Bildabstände hängen zusätzlich vom Zeichnen der Stadt und vom Grafiktreiber ab.

## Ankunft im westlichen Berlin

In Chromium wurde der vollständige, unveränderte v1.0.258-Viewer einem zweiten Produktionsbuild mit derselben Stadt und ausschließlich den Änderungen am Streaming gegenübergestellt. Unmittelbar nach Freigabe am Brandenburger Tor wechselte die Kamera in den westlichen Panoramaausschnitt. Im Kontrolllauf wartete die erste Anforderung auf den Abschluss der Speicheraufbereitung des Kerns. Im Vergleichsbuild begann sie bereits 0,83 s nach dem Kameraschwenk. Ein tatsächlich befülltes, sichtbares Mesh der Zielkachel `-8_1` war nach 25,90 s im Szenengraphen, zuvor nach 60,63 s. Für diese einzelne Messung der Ankunft waren die GPU-Zeichenaufrufe unterdrückt.

Eine separate Fahrt hat den Produktions-Kachelcontroller auf einem 900 × 540 Pixel großen Canvas mit WebGL tatsächlich gezeichnet. Blickziel, Blickfeld und Fahrweg waren gleich. In Modellmetern begann die Kamera bei (−3.260, 1.430, 1.855) mit Blick auf (−3.980, 2, 535). Nach sechs Sekunden begann ein viersekündiger Schwenk mit Annäherung auf (−2.890, 890, 1.325) mit Blick auf (−3.430, 2, 305). Die vertikale Perspektive betrug 50 Grad. Zwei äußere Strahlen des Bildes treffen im Test die Kacheln `-11_1` und `-9_2`. In den ersten drei v1.0.258-Fahrten kam im 13-s-Messfenster keine der beiden an. In v1.0.259 zeichneten alle drei Fahrten beide originalen Modelle. Ihre ersten Zeichenaufrufe erfolgten im Median nach 2,50 s und 4,52 s. Die beiden anderen Messstrahlen treffen den separaten Stadtkern. Er gehört im vollständigen Viewer zu einer anderen Geometriequelle.

## Bildabstände während der Bewegung

Die folgenden Messungen verwenden Chromium mit dem Software-WebGL-Treiber SwiftShader auf der gemeinsamen Cloud-CPU und 900 × 540 Pixel. Der Bildabstand umfasst die Zeit zwischen zwei Animationsframes. Eine längere Zeit bedeutet mehr sichtbares Ruckeln.

| Fahrweg und Ladezustand | v1.0.258 | v1.0.259 |
| --- | ---: | ---: |
| Westliches Panorama, Stadtcontroller mit allen Originalkacheln, p95 der Bildabstände im 13-s-Kaltstart, Median aus drei Fahrten | 167 ms | 300 ms |
| Mittlere Bildrate derselben Fahrten, Median | 12,9 Bilder/s | 7,1 Bilder/s |
| Vollständige Pakete am Ende derselben Fahrten, Median | 7 | 10 |
| Vollständiger Tagesviewer direkt nach Freigabe der Karte, längster Bildabstand bei einer 12-s-Fahrt | 4.567 ms | 4.300 ms |

Beim vollständigen Tagesviewer war der Kern in beiden Versionen während der ganzen Fahrt im Aufbau. In diesem kurzen Versuch ließen sich sechs bzw. vier Bildabstände beobachten. Ihr p95 fällt jeweils mit dem größten Wert zusammen. Für einen belastbaren Vergleich der Bildrate auf einem Windows-PC oder Mac reichen diese Stichproben und die Softwaregrafik nicht aus. In der separaten Stadtcontroller-Fahrt wurden mehr entfernte Originalgebäude früher sichtbar. Gleichzeitig nahm das Ruckeln während des Ladens auf diesem Rechner zu.
