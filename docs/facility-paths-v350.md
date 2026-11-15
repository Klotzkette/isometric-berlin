# Wege bei Berliner Grundschulen und Kitas — V350

Die Ergänzung gleicht kartierte Gehwege, Fußwege, Radwege und Fußgängerflächen im Umfeld der amtlichen Schul- und Kita-Standorte mit dem tatsächlich vorhandenen Viewer-Untergrund ab. Der Suchbereich beträgt 90 m bei Grundschulen und 45 m bei Kitas. Die Ausgangsgeometrie stammt aus dem lokalen [Geofabrik-Berlin-Auszug vom 13.11.2026](https://download.geofabrik.de/europe/germany/berlin-261113.osm.pbf), © OpenStreetMap-Mitwirkende, ODbL 1.0.

14.454 kartierte Wege erfüllen die räumlichen und sachlichen Eingangskriterien. Nach der Prüfung vorhandener Flächen und älterer Detailmodelle verbleiben **6.930 Wege in 587 vorhandenen Stadtsegmenten**, mit 1.168 Rezepten für die beiden unabhängig konstruierten Geometriefamilien. Sie verbessern Flächen im Umfeld von **1.533 Einrichtungen: 184 Grundschulstandorten und 1.349 Kitas**. Das ist die tatsächlich veränderte Umgebung; die zugrunde liegende Verzeichnisabdeckung von 439 Grundschulen und 2.941 Kitas ist gesondert in [education-v350.md](education-v350.md) beschrieben.

## Zulässige Flächen

Materialänderungen benötigen ein ausdrücklich kartiertes Oberflächenmaterial und eine wörtlich vorhandene horizontale Fläche mit der ursprünglichen Wegfarbe. Eine neue kartierte Wegefläche auf bisherigem flachen Boden benötigt eine explizite Breitenangabe oder eine kartierte Fläche. Materialfarben sind zurückhaltende Darstellungswerte für das jeweilige Material, keine fotografisch vermessenen Farbtöne.

Gebäude, Wasser, Brücken, explizite Querungen, erhöhte/unterirdische Wege und vorhandene feinere Geometrie bleiben ausgespart. Neue Bodenwege meiden auch die vollständige alte Straßen-/Wege-Navigationsfläche. Diese Navigationsfläche enthält selbst Gehwege; bestehende Wegmaterialien werden deshalb über ihre tatsächlichen ursprünglichen Dreiecke statt über die allgemeine Navigationsklasse erkannt. Kein Fahrbahndreieck wird umgefärbt. Es entstehen keine neuen erfundenen Straßenachsen, Querungen, Stufen, Eingänge oder Gebäude.

Native-Flächen werden unabhängig auf einem 0,5-m-Raster innerhalb ihres eigenen tatsächlichen Untergrunds konstruiert. Frühere V329-Grün-, Weg- und Zebrastreifen-Ergänzungen, V320/V321-Fassaden sowie die späteren V334-Verkehrsbauwerke werden zusätzlich geometrisch maskiert und bei der Teilezahl reserviert. Es gibt keine Erhöhung der bestehenden Grenzen für Teile, Vertices oder Residenz.

Sechs der 587 Segmente haben ausschließlich eine Drawn-Ergänzung: `-4_-3`, `east200-0_-15`, `outer187--14_17`, `outer187--15_13`, `outer187-25_16` und `ring182--9_10`. Die erneute Prüfung ihrer Native-Ausgangsflächen ergibt jeweils `noLiteralSupportedPatch`: Nach dem unabhängigen Zuschnitt verbleibt keine vollständig belegte Native-Wegefläche. Daher ergeben sich 1.168 statt 1.174 Modusrezepte. Die bestehende Native-Darstellung bleibt dort vollständig erhalten.

Fünf eng begrenzte Segmente bleiben ausdrücklich unverändert: `ring182-8_8`, `ring182-8_10` und `ring182-9_8` schützen den vollständig gebundenen späteren Neukölln-Bestand; `3_-3` und `4_-3` schützen die an Gesamtpufferlängen gebundenen Rosenthaler-Untergrundöffnungen. Auch fehlender belegter Untergrund oder bereits ausgeschöpfte Teilebudgets führen zu einer dokumentierten Nicht-Ergänzung statt zu verdrängten alten Details. Es wird keine zufällige Auswahl von Schulen, Kitas oder Wegen getroffen.

## Speicherung und Laufzeit

37 lokal gebündelte gzip-Dateien enthalten **1.174.817 Byte**, ihr kleiner Index weitere **27.575 Byte**. Zusammen sind dies **1.202.392 Byte** statt 16,47 MB neu erzeugter Dreiecksdaten. Die Dateien liegen im statischen Viewer und werden ausschließlich bei Bedarf vom selben Server geladen. Es gibt keine Laufzeitabfrage bei GitHub, OSM oder Berliner Verzeichnissen.

Drawn-Flächen werden als exakte Umrissringe mit Löchern gespeichert. Native verwendet je nach verlustfreier Größe Ringe oder zusammengefasste orthogonale Rasterläufe. Seltene Bruchteilschnittpunkte, die erst bei der ursprünglichen Zentimeterquantisierung entstehen, bleiben als ihre ursprünglichen Dreiecke erhalten. Es wird weder geglättet noch vereinfacht. Höhen und bereits linearisierte Materialfarben bleiben exakt.

Ein Modul enthält höchstens 32 kompakte Modusrezepte. Das Einlesen prüft die tatsächliche gzip-Ausgabegröße gegen die gespeicherte Länge und die feste 2-MiB-Obergrenze. Nur das angeforderte Rezept wird trianguliert. Sein Mesh und sein Fingerprint werden erst beim ersten Zugriff erzeugt und bleiben so lange stark an das Rezept gebunden, wie ein laufender Decoder dieses benötigt. Der äußere Rezeptcache verwendet eine schwache Referenz; nach seiner Verarbeitung kann die gesamte Konstruktion wieder freigegeben werden.

Gemessene erste Expansion aller 1.168 Rezepte: 0,21 ms Median, 1,92 ms 95. Perzentil, 8,59 ms Maximum. Das größte neue Mesh hat 4.579 Vertices und 89.811 Byte dekodierte Positions-, Farb- und Indexdaten. Dies sind lokale Offline-Messungen, keine Zusage identischer Gerätezeiten.

## Nachweise

- `education-v350-paths-source.json.gz`: aktuelle kartierte Wege und räumlicher Verzeichnisbezug.
- `education-v350-paths-evidence.json.gz`: ursprüngliche Rezept-/Flächennachweise, Geometriegrenzen, Quellhashes und geschützte Eigentümer.
- `education-v350-paths-storage.json`: Hash und Größe jeder gebündelten gzip-Datei, Abdeckung und bytegleiche Offline-Rekonstruktion.
- `education-v350-paths-mode-coverage.json`: gesonderte Prüfung und Begründung der sechs Segmente ohne zulässige Native-Ergänzung.
- `education-v350-paths-surface-proof.json`: Vergleich aller tatsächlich in TypeScript expandierten Flächen mit allen ursprünglichen neuen Flächen, getrennt nach Höhe und Material. 1.168 Rezepte und 2.531 Material-/Höhenregionen bestehen; größte numerische Flächendifferenz 1,94 × 10⁻⁸ cm².
- `education-v350-paths-production.json.gz`: **alle 1.168 Rezepte** durch den vollständigen Produktionsdecoder geprüft. Vorher enthält den abschließenden Civic-Bestand; nachher ergänzt nur die Wege. Sämtliche alten Positions-/Farbwörter, Dreiecks- und Linienwörter, Navigationsdaten, Reihenfolge älterer Quellen, Material-/Shaderfamilien und relevante Metadaten bleiben erhalten. Keine Fehler.

```sh
uv run python scripts/build_facility_paths_v350.py --extract --compile
uv run python scripts/compact_facility_paths_v350.py --write
bun src/app/scripts/expand-facility-paths-v350.ts
uv run python scripts/verify_facility_path_surfaces_v350.py
bun src/app/scripts/verify-facility-paths-v350.ts
uv run pytest tests/test_facility_paths_v350.py -q
bun test src/app/tests/facility-paths-v350.test.ts
```

Die vollständige Rekonstruktion benötigt ausschließlich die versionierten Einrichtungen, den vorhandenen PBF, erhaltene Stadtsegmente und vorhandene frühere Rezepte. `--finalize-civic` ist eine optionale Zwischenstufe **vor** der Kompaktierung: Sie aktualisiert nur nachträglich betroffene Civic-/Verkehrssegmente. Große rohe Vorbereitungsprotokolle sind regenerierbarer, ignorierter Arbeitsspeicher und werden nach der Prüfung entfernt; sie werden weder veröffentlicht noch ins Repository aufgenommen.

Zur visuellen Kontrolle eignen sich die tatsächlich veränderten Punkte bei der GutsMuths-Grundschule (`7_0`, x=3617,96/z=373,46), der Grundschule unter dem Regenbogen (`marzahn230-22_-2`, x=11545,50/z=-972,53) und der Askanier-Grundschule (`outer187--24_-6`, x=-12210,59/z=-2592,81).
