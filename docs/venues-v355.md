# Finanzämter, Bürgerämter, Polizeiwachen, Autohäuser und Einkaufszentren

Die Standortauswahl umfasst Berlin in seinen amtlichen Grenzen. Die Ämter
stammen aus den Standortverzeichnissen des Landes Berlin. Bei Polizeistandorten
ergänzen aktuelle Angaben zu Abschnitten, öffentlich zugänglichen Wachen und
Bahnhofsdienststellen die amtliche Fachkarte. Bei Autohäusern und Einkaufszentren
gleichen wir die Berlin-Karte von OpenStreetMap vom 15. November 2026 mit
öffentlichen Betreiberangaben und dem Einkaufszentrenverzeichnis des Landes ab.

- [Finanzämter und Bürgerämter](aemter-v355.md)
- [Polizeiwachen und Dienststellen](polizeiwachen-v355.md)
- [Autohäuser und Einkaufszentren](retail-inventory-v355.md)

Die Schaltfläche **Stadtorte in der Nähe** zeigt die gefundenen Orte in der
bestehenden Ortsanzeige. Ein eindeutig kartierter Haupteingang kann als Position
für den Hinweis dienen. In den übrigen Fällen bezeichnet der Hinweis den Standort
laut Verzeichnis. Mehrere Dienste an derselben Adresse werden im Quellenbestand
nachvollziehbar zusammengefasst. Für Polizei im Bahnhof bezieht sich die Adresse
auf die Dienststelle im Bahnhof. Der bestehende Innenraum des Hauptbahnhofs ist
weiterhin eigenständig modelliert.

Erfasst sind 23 Finanzamtsadressen, 45 Bürgerämter und Bürgerbüros,
52 Polizeistandorte, 342 kartierte Autohäuser und 86 Einkaufszentren.
Von den 548 Standorten erhalten 122 in 99 Kacheln eine neue Tafel oder
ein auf Fotos abgestimmtes Fassadendetail. Die Fassadendetails am Finanzamt Charlottenburg, an der Alexwache,
bei BMW am Kaiserdamm und an der East Side Mall wurden fotografisch
abgeglichen. Bei 58 weiteren Standorten konnte
eine vorhandene Gebäudehülle zugeordnet werden. Für 368 Standorte steht
die eindeutige Zuordnung zu einer Viewer-Fassade noch aus.

Neue Namenstafeln sitzen auf nachgewiesenen Wandflächen der vorhandenen
Gebäudemodelle. Wenn ein Gebäude über mehrere Kacheln läuft, wird ein geteilter
Umriss nur zusammengeführt, wenn die Teile zur selben Quelle gehören und
gemeinsam fast den ganzen kartierten Umriss abdecken. Die offline bereinigten
Umrisse dienen der Zuordnung. Die eigentliche Annahme setzt vollständig
vorhandene, gerenderte Wanddreiecke in beiden Geometrievarianten voraus und
schließt Konflikte mit früheren Anbauten aus. Die Tafeln sind lesbare Hinweise
und die genauen Maße der neu modellierten Fensterteilungen und Lamellen sind
Interpretationen der dokumentierten Außenansichten.

Die Datei `geo_data/regierungsviertel/venue-fronts-v355-audit.json.gz` enthält
für jeden Standort Quelle, Koordinaten und Ergebnis. Eine zugeordnete
Gebäudehülle gibt zunächst nur den bestätigten Standort am vorhandenen Modell
wieder. Bei unklaren Anschriften, gemeinsamen Gebäuden, fehlenden Gebäudemodellen
oder unzureichender Wanddeckung bleibt der Standort ein Verzeichniseintrag.
Kartendaten und Händlerseiten reichen bei unabhängigen Autohäusern und kleineren
Einkaufszentren nicht für eine vollständige Aussage über den laufenden Betrieb.
Die geprüften Vorbilder werden als Quellen genannt. Ihre Fotos und
Kartenausschnitte sind nicht Teil des Viewers.

Die Ergänzungen werden mit den bereits vorhandenen Kacheln geladen und
entladen. Sie verändern keine vorhandenen Gebäudedreiecke, Laufwege, Dachformen
oder Geländeobjekte. In der Minecraft-Ansicht sind die Ergänzungen an
eigenständigen geraden Wandabschnitten der dortigen Modelle verankert. Der
Compiler vergleicht bei jeder aufgenommenen Kachel alte Positionen, Farben,
Dreiecke, Linien und Navigationsdaten vor und nach der Ergänzung.

Die Standortquellen lassen sich mit den verlinkten Erfassungsskripten
reproduzieren. Anschließend in der Wurzel des Repositorys ausführen:

```sh
uv run python -m scripts.build_venue_fronts_v355 /tmp/berlin-venues
bun src/app/scripts/capture-venue-fronts-v355.ts /tmp/berlin-venues/jobs.json /tmp/berlin-venues/result.json
uv run python -m scripts.publish_venue_fronts_v355 /tmp/berlin-venues
```
