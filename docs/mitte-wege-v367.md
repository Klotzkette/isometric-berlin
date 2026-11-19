# Wege und Platzkanten im Bezirk Mitte

Am Poststadion verläuft der gepflasterte Weg entlang der geraden Spielfeldränder. Im alten Modell zog eine Kurve die Längsseiten bis zu 21,7 Meter ins Nachbargelände. Das Wegband folgt jetzt den kartierten Geraden und trifft an den Ecken zusammen. Mehrere aufeinanderfolgende Stützpunkte mit ähnlicher Krümmung bilden weiterhin einen Bogen, etwa im Lustgarten. [Kartierter Weg am Poststadion](https://www.openstreetmap.org/way/121145552) · [Berliner TrueDOP 2026](https://gdi.berlin.de/services/wms/truedop_2026?service=WMS&request=GetCapabilities)

In den vom Kernmodell erfassten Teilen aller sechs Ortsteile hat sich bei 454 Wegen der gezeichnete Verlauf geändert. Auf 1.668 Abschnitten beträgt der Unterschied zur bisherigen Darstellung mehr als einen Zentimeter. Das ist ein Vergleich zweier Renderfassungen. Die Lagegenauigkeit vor Ort hängt von den Quelldaten ab.

Wo das Vier-Meter-Raster eine zusätzliche Bordsteinkante mitten auf durchgehendem Belag erzeugte, gleicht der Renderer diese Kante mit den vorhandenen Straßen- und Gehwegpolygonen ab. An 194 Stellen entfällt dadurch jeweils ein vier Meter langer falscher Absatz. Die gewollten Blockkanten der Minecraft-Ansicht haben eine eigene Geometrie.

An 141 kartierten Platzumrissen korrigiert der Viewer die Übergänge zwischen Belägen entlang der schräg durchs Raster verlaufenden Kanten. Die betroffene Randfläche beträgt insgesamt rund 14.884 m².

An neun Plätzen, darunter Leopoldplatz und Hausvogteiplatz, folgen auch die anschließenden Fahrbahnen, Gehwege und Mittelstreifen den Polygonen der Berliner Straßenbefahrung. Die ältere Vermessung dient als Quelle für die Form dieser Anschlüsse. [Berliner Straßenbefahrung](https://gdi.berlin.de/services/wfs/strassenbefahrung?SERVICE=WFS&REQUEST=GetCapabilities)

Am Leopoldplatz zeigt das Luftbild 2026 die durchgehenden Verkehrsinseln und die roten Radfurten an der Kreuzung Müllerstraße/Schulstraße. Vor der Alten Nazarethkirche liegt ein begehbares Fontänenfeld bündig im Pflaster. Sein kartierter Umriss umfasst rund 185 m². Die Verteilung der 24 Düsen ist schematisch. [Luftbild der Kreuzung und des vorderen Platzes](https://gdi.berlin.de/services/wms/truedop_2026?service=WMS&version=1.3.0&request=GetMap&layers=truedop_2026&styles=&crs=EPSG:25833&bbox=388675,5823025,388815,5823179&width=700&height=770&format=image/jpeg) · [Projektdokumentation des Bezirks Mitte](https://www.muellerstrasse-aktiv.de/mueller-aktiv/wp-content/uploads/2016/09/leopoldplatz_broschuere.pdf) · [Planung der 24 Düsen](https://weddingweiser.de/leo-wird-wieder-platz/)

Die Platzanschlüsse lassen sich mit `uv run python scripts/build_mitte_square_streets_v367.py` lokal neu erzeugen. Das eingecheckte Quellenpaket `geo_data/regierungsviertel/mitte-plaza-streets-v367.json.gz` enthält die Ausschnitte aus der Straßenbefahrung und die 49 Rasterzellen, an denen bereits vorhandene Bauwerksmodelle den ursprünglichen Boden geöffnet oder in der Höhe verändert haben. Die Geometrie berücksichtigt außerdem die kartierten Treppenöffnungen.

Am Nikolaikirchplatz bestimmen die vermessenen Umrisse den Vorplatz, die Pflasterbänder und die Beete. Form und Lage der Bänke folgen dem Luftbild. [Geometrie und Quellen zum Nikolaikirchplatz](nikolaikirchplatz-v367.md)
