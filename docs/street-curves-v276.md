# Straßenränder und Bordsteinanschlüsse v276

Die Korrektur hat zwei getrennte, quellengebundene Teile. Sie verändert keine
Straßenmittelachse, keinen Original-OSM-Knoten und keine vorhandene Straßenbreite.
Die übernommene Breite bleibt gemäß ihrer bisherigen Herkunft entweder OSM-Maß,
Fahrspurableitung oder Klassenannahme; aus der feineren Rundung folgt keine neue
Vermessungsgenauigkeit. Die Höhen bleiben die bisherigen Darstellungsniveaus.

## Kernstadt: tatsächliche Bordsteinbreite an ungleichen Segmenten

`DistrictStreets.ts` ermittelte die Normale aus der langen Sehne zwischen dem
vorherigen und folgenden Punkt. Unterschiedlich lange Segmente verzogen damit
den Querschnitt. `streetKerbJoinsV276.ts` verwendet die Winkelhalbierende der
beiden normierten Tangenten, mit begrenzter Gehrung. Die Mittelpunkte bleiben
exakt; geschlossene Konturen erhalten an beiden Enden denselben Querschnitt.
Richtungsumkehr und Nullsegmente bleiben endlich und konservativ begrenzt.

Untersucht wurden 3.424 Linien mit 77.485 Punkten. Von 66.701 nicht scharfen
inneren Anschlüssen hatten 7.365 mehr als zehn Grad Tangentenabweichung; 7.779
Querschnitte unterschritten 20 cm, einschließlich umgekehrter Querschnitte.
84 geschlossene Konturen hatten unterschiedliche Anfangs-/Endnormalen.
753 sehr spitze Anschlüsse wurden getrennt behandelt, nicht als normale
Gehrung ausgewertet.

Diese Korrektur wirkt in den bestehenden Kernstadt-/Schloss-Ost-Aufrufen des
Renderers. Alle 309.940 Bordsteinvertices, Indizes, Höhen und acht Batches
bleiben erhalten, ebenso die 9.051.672 Bytes ihrer Geometriepuffer. Der alte
veröffentlichte Kontrollhash bleibt im Speichertest als unabhängig rekonstruierte
Referenz erhalten; nur die absichtlich korrigierten XZ-Querschnitte weichen ab.
Das ist kein Nachweis einer berlinweiten Änderung dieses einen Renderers.

## Bestehende gestreamte Stadt: exakt belegte Rundungsfacetten

Der bisherige Export nutzt drei Segmente pro Viertelkreis für runde Straßenpuffer.
Die Quelle enthält dabei unveränderte Straßenpunkte, doch ein Randabschnitt von
30 Grad kann sichtbar mehrere Dezimeter innerhalb der vorgesehenen Kreisrundung
liegen. Der neue endliche Patch prüft 64.510 retained OSM-Straßen gegen die 1.804
primären vorhandenen Pakete. Die 390 zusätzlichen Detailpakete erhalten keine
neuen Straßen. Es gibt keine neue Abdeckung, keine neuen Deskriptoren und keine
zusätzliche weltweite Szenengruppe.

Der Beleg friert 1.546 tatsächlich vorhandene, eindeutig zu ursprünglichen
OSM-Puffersegmenten passende Facetten mit mindestens 20 cm Pfeilhöhe ein. Von
diesen werden 764 Bögen in 210 vorhandenen Paketen feiner ausgearbeitet:

- 636 Kandidaten berühren geschützte Nachbarflächen oder frühere Details.
- 145 Kandidaten würden eine zusätzliche Zelle der unabhängigen nativen
  Zwei-Meter-Darstellung belegen und bleiben deshalb hier unverändert.
- Ein Kandidat besitzt keinen hinreichend freien angrenzenden Boden.

Die neuen Bögen behalten **beide ursprünglichen zentimetergenauen Endpunkte**.
Nur die inneren Punkte werden auf dem bereits vorgesehenen Quellkreis ergänzt.
Die kleine Fläche zwischen alter Sehne und neuem Bogen liegt nach Prüfung auf
bereits vorhandenem freien Boden. Gehwege, Schienen, Wasser, Brücken,
Gebäudegrundrisse, vorhandene spezielle Straßenflächen, alte Bordsteine und
Markierungen sowie die Weinberg-Geländedarstellung sind geschützt. Die
Zentimeterrundung wird mit höchstens 12 mm Prüftoleranz berücksichtigt.

Jede neue Navigationsfläche ist exakt dasselbe zentimetergenaue Polygon wie die
sichtbare Ergänzung. Die 764 belegten alten Ink-Sehnen werden erst nach vollständig
erfolgreicher Quellenprüfung degeneriert; die feineren Randlinien landen im
selben vorhandenen Ink-Puffer. Alle übrigen Linien und sämtliche alten Flächen
bleiben erhalten. Quell-Meshes, Quell-Ink und veröffentlichte Pakete bleiben
bytegleich, einschließlich der gesamten nativen Paketfamilie.

Explizit durch die vorhandenen amtlichen Ortsteilgrenzen zugeordnet:

| Bezirk / vorhandener Teil | Verfeinerte Bögen |
| --- | ---: |
| Mitte | 72 |
| Friedrichshain-Kreuzberg | 162 |
| Charlottenburg-Wilmersdorf | 174 |
| Steglitz-Zehlendorf | 25 |
| Schöneberg | 77 |

Die übrigen 254 Bögen liegen in anderen bestehenden Stadtpaketen. Ihnen wird hier
kein amtlicher Bezirk zugeordnet, den der verwendete begrenzte Grenzdatensatz
nicht enthält. In Steglitz-Zehlendorf sind in dieser Auswahl unter anderem
Schildhornstraße, Lepsiusstraße und Breitenbachplatz belegt. Das ist ausdrücklich
keine Behauptung, jede Straße eines Bezirks vollständig neu modelliert zu haben.

## Integration, Speicher und Schutz

`prepareStreetCurvesV276` wird nach den bisherigen append-only Vorbereitern
aufgerufen. Die vollständigen ursprünglichen Mesh- und Ink-Hashbelege, Ursprung
und Navigation müssen stimmen. Änderungen führen zum unveränderten Ausgangspaket.
Der endliche Plan wird nur einmal aus dem Konstruktorfeld gelesen; unbekannte
Pakete und Native-Anfragen lesen dieses Feld gar nicht. Vorhandene Limits für
16 Meshteile, 400.000 Vertices und 2.400.000 Indizes bleiben unverändert.

`streetCurveExtraLineVerticesV276` erweitert nur die Größe des vorhandenen finalen
Ink-Puffers. `applyStreetCurveLinesV276` läuft nach bisherigen Eigentumsübertragungen;
deren Originalhashes sehen weiterhin unveränderte Quellstrings. Navigations- und
Linienersatz werden nur zusammen mit dem erfolgreich vorbereiteten Zusatzmesh
aktiv. Abbruch, Disposal und kooperative Zeitaufteilung bleiben beim bisherigen
Paketkonstruktor. Keine Animation, Textur oder zusätzliche Drawcall-Gruppe.

Über alle 210 Pakete zusammen: 409,16385 m² ergänzte Rundungsfläche, höchstens
19 verfeinerte Bögen in einem Paket. Runtime-JSON: 548.374 Bytes; Quellenbeleg:
168.686 Bytes gzip; Evidenz: 98.339 Bytes gzip. Die zusätzlichen gepackten
Mesh-/Ink-Quelldaten umfassen 250.134 Bytes; bei den finalen interleavten
16-Bit-Farben und konservativ 32-Bit-Indizes maximal 310.560 zusätzliche Bytes
über die gesamte Auswahl und maximal 7.524 Bytes in einem Paket. Die tatsächliche
16-Bit-Indexwahl kann darunter liegen. Bestehende Geometrie-, Residenz- und
Ladebudgets werden nicht angehoben.

Reproduktion: `uv run --no-sync python -m scripts.build_street_curves_v276 --extract`
prüft die retained Daten erneut; ohne `--extract` wird aus dem eingefrorenen
Quellbeleg gebaut. `--candidate-cache` ist nur ein optionaler Beschleuniger für
einen bereits erfolgten Vollscan: Originalwege, Quellknoten, Breiten und sämtliche
gewählten alten Pufferkanten werden auch dann unabhängig neu nachgewiesen.

Gezielte Tests: `street-kerb-joins-v276.test.ts`, `district-street-memory.test.ts`,
`district-streets.test.ts`, `street-curves-v276.test.ts` und
`tests/test_street_curves_v276.py`. Die Straßenkurventests prüfen außerdem die
unveränderten Original-Assets, freien Nachbarflächen, native Rasterbelegung,
identische sichtbare/Navigationskanten und fail-closed Quellenmutationen.

## Abschlussnachweis

Die fünf unabhängigen Python-Kurvenprüfungen bestehen mit Geometriewarnungen als
Fehler. Zwei durch die ursprüngliche Zentimeterrundung ungültige Nachbarpolygone
werden vor der konservativen Schutzpufferung gültig gemacht; die 764 gewählten
Bögen und sämtliche erzeugten Datenbytes blieben dabei exakt gleich.

Die zehn gezielten Bun-Dateien decken 41 unterschiedliche Prüfungen ab. Zwei
bestehende v249-Vollpakettests überschritten zunächst die voreingestellten fünf
Sekunden; ihre vollständige Datei besteht anschließend mit einer reinen
Testzeitfrist von 30 Sekunden. Keine Produktgrenze wurde verändert. Die neuen
Kurventests bauen jedes der 210 echten Pakete einschließlich aller älteren
Vorbereitungen und prüfen unverändert zwei Szenenobjekte / drei Puffer.

Die aktualisierten v273-Schutzmetadaten enthalten weiterhin exakt dieselben
7.173 ausgewählten Bauteile und 7.165 eindeutigen Farb-Owner. Runtime-SHA256:
`4f6384565300fbc08a4c1333d3300fd9fedd0b93532c545b225530ad6a8f5461`.
Neue Evidenz-SHA256:
`b73463909ed93759bf981a12b30afc28a12e02a88e50f4be420575d33587ef0e`.
Vier Python- und sieben Bun-Schutztests bestehen. Die historische
Konstruktorprüfung behält ihren ursprünglichen Hash und normalisiert nur die
vier separat verhaltensgeprüften neuen Zoo-/Verkehrskanzel-Ownership-Zeilen;
der restliche Konstruktor ist unabhängig gegen HEAD bytegleich belegt.

Die abschließende gemeinsame Runde mit Straßen-, Core-Farb-, Ownership-,
Paketkonstruktor-, Navigation-, Streaming-, Speicher- und Werkhofprüfungen
besteht vollständig: **162 Tests in 21 Dateien, 1.802.435 Assertions, 73,01 s**,
mit 30 Sekunden Testfrist. Die abschließende Prüfung nach dem getrennten
Kanzel-Fix ergab keine weitere Änderung der oben genannten Evidenz oder Farbmap.
Die unabhängige Read-only-Prüfung des Kurven-/Ink-/Navigationsvertrags fand keinen
konkreten Fehler. Eine Browser-Sichtprüfung ist nicht Teil dieses Unterauftrags.
