# Zwei belegte Grabstellen · V347

Die Grabstelle von Theodor und Emilie Fontane auf dem Friedhof II der Französischen Gemeinde in der Liesenstraße und E. T. A. Hoffmanns Grab auf dem Friedhof III der Jerusalems- und Neuen Kirche werden an ihren kartierten Punkten ergänzt. Die Quellen sind OSM `node/274785461` bei `[463.26847026642645, -2116.3311803555116]` und `node/4893458668` bei `[1253.7937949605985, 2690.689640461467]` im bestehenden Szenenkoordinatensystem.

Die derzeitige [visitBerlin-Referenz](https://www.visitberlin.de/de/event/dauerausstellung-am-theodor-fontane-grab) zeigt zwei schwarze, oben leicht gewölbte Stelen und einen verzierten dunklen Pfosten-/Kettenabschluss um einen efeubewachsenen Doppelplatz. Das ältere Bild mit einem gemeinsamen Stein von 2005 wird ausdrücklich nicht als heutige Form verwendet. Hoffmanns heller, gewölbter Einzelstein und sein efeubewachsenes Grab folgen der [Aufnahme von Harvey Kneeslapper vom 5. Mai 2023](https://commons.wikimedia.org/wiki/File:Grab_E._T._A._Hoffmann.jpg), CC BY-SA 4.0. Bilddateien werden ausschließlich als externe Referenz angesehen und nicht ausgeliefert.

Die Lage ist kartiert. Abmessungen, Ausrichtung zur benachbarten Wegführung, Pflanzenverteilung und die vereinfachten Zierformen sind Abschätzungen. Es werden keine unbekannten Gräbernamen, Register, Kreuze, Inschriften oder kunsthandwerklichen Details erfunden. Die Geometrie soll die belegte Anordnung erkennbar machen; sie ist keine fotogrammetrische Aufnahme.

## Boden und Lebensdauer

Die Punkte liegen in der bestehenden Core-Abdeckung. Ein umgebendes Außenstadtpaket oder eine feste Höhe von 3 m wäre deshalb der falsche Eigentümer. `NamedGravesV347` verwendet den vorhandenen Terrain-Nachweis von `PublicAmenitiesV332`. Beide echten veröffentlichten Bodenfamilien liefern an den Punkten 5,2 m; diese Zahl ist nur das Prüfergebnis und wird im Laufzeitcode nicht vorausgesetzt.

Vor jeder Anzeige werden Mittelpunkt und 25 Punkte über der vollständigen Begrenzung gegen den tatsächlich sichtbaren Boden geprüft. Fehlender Boden, Wasser, fremde Hindernisse oder ein Höhensprung über 6 cm lassen die gesamte Ergänzung geschlossen. Die eigene bereits aktive Kollision wird während dieses Tests unterdrückt, damit sie ihre eigene Bodenzulassung nicht im nächsten Durchlauf sperrt. Der Mittelpunkt und alle Randpunkte bleiben unverändert an ihrem kartierten Ort.

In einem Radius von 180 m entsteht die vollständige Drawn- beziehungsweise eigenständige kardinale Native-Geometrie. Mobil wird nichts vereinfacht. Beim Verlassen des Radius, fehlendem Boden, Höhenwechsel, Moduswechsel oder Freigabe werden Geometrie, Material und Kollision zusammen entfernt. Der öffentliche Amenities-Schalter steuert weiterhin nur Beschriftungen, nicht die belegte feste Ausstattung. Die zwei Standorte liegen weit auseinander; nur einer kann im Radius aktiv sein. Das größte Modell umfasst 11.086 Vertices und 18.756 Dreiecke. Die übrigen Stadt-, Paket-, Startup- und Worker-Grenzen bleiben unangetastet.

Steine und Hauptpfosten besitzen Kollisionsringe aus denselben Zentimeterkoordinaten wie die sichtbare Geometrie. Native benutzt die tatsächlichen kardinalen Reihenrechtecke; es wird kein schräger Drawn-Körper als Native-Kollision übernommen. Efeu und dünne dekorative Ketten sind sichtbare Details, keine zusätzlichen Gehflächen.

## Einbindung und Prüfung

`PublicAmenitiesV332` besitzt den Controller und bietet `namedGravesSolidAt(x, y, z, radius, native)` sowie `releaseNamedGraves()`. Der Viewer bindet diese Abfrage an beide existierenden `interiorSolidAt`-Umgebungen und gibt die Modelle im inaktiven Amenities-Zweig frei. Ohne tatsächlich sichtbaren Elternknoten oder bei falscher Renderer-Familie bleibt die Kollision aus.

`uv run python scripts/build_named_graves_v347.py --check` reproduziert die beiden Modelle aus der kleinen eingefrorenen Quellenauswahl. `--extract` aktualisiert diese bewusst aus dem belegten Inventar und den lokalen Referenzbelegen. `bun test tests/named-graves-v347.test.ts tests/public-amenities-v332.test.ts` prüft die echten Core-Böden, Platzierung ohne feste Höhe, Quellenverlust, fremde Hindernisse, Wasser, Höhenkanten, Selbstkollisionsfreiheit, Wechsel/Freigabe, Grenzen und kardinale Native-Flächen. Ältere Gebäude und Friedhofsgeometrie werden nicht verändert.
