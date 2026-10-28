# Step 10 v281 — offene Tafeln im Ausstellungsgraben

Die 24 bisherigen lokal erzeugten, vollständig deckenden `plain exhibition panel field`-Quader werden durch je acht sparsame Bauteile ersetzt: vier dünne Rahmenkanten, zwei Aufhängungen und zwei abstrakte Inhaltsfelder. Fünf der Felder tragen unterschiedliche Kapitelakzente. Zwischen den Bauteilen liegt echte leere Geometrie; weder ein deckendes „Glas“-Material noch eine zweite Wand verdeckt dort die Ausgrabung. Die vorhandenen zwei Instanz-Batches werden weiterverwendet.

## Primärbeleg und angesehene Fotoreferenzen

Geprüft am 28.10.2026: [Stiftung Topographie des Terrors, Berlin 1933–1945](https://www.topographie.de/ausstellungen/berlin-1933-1945). Die Betreiberbeschreibung belegt fünf farblich unterschiedene Hauptkapitel und überwiegend gläserne Tafeln, durch die die Ausgrabungen sichtbar bleiben. Es werden keine historischen Texte, Bilder oder Dokumente nachgebildet.

Die drei aktuellen Galeriebilder wurden tatsächlich angesehen:

- [Graben_Ausstellung_01](https://www.topographie.de/fileadmin/_processed_/1/7/csm_Graben_Ausstellung_01_7b930a0e82.jpg), © Stefan Müller / Stiftung Topographie des Terrors: dünn aufgehängte Glasflächen, begrenzte bedruckte Felder, gelbgrüner Kapitelakzent und durchsichtige Zwischenräume.
- [Graben_Ausstellung_05](https://www.topographie.de/fileadmin/_processed_/4/b/csm_Graben_Ausstellung_05_d39b977b16.jpg), © Stefan Müller / Stiftung Topographie des Terrors: eigenständige Medienstationen vor erhaltenen Mauerresten. Mangels Einzelstandorten werden diese Geräte nicht ergänzt.
- [Berlin-33-bis-45_DSC8013, 2021](https://www.topographie.de/fileadmin/_processed_/2/2/csm_Berlin-33-bis-45_DSC8013__Sebastian_Eggler_2021_8cd97b04cb.jpg), © Sebastian Eggler / Stiftung Topographie des Terrors: dünne Aufhängungen, durchsichtige Glasränder und blaue Kapitelkennzeichnung.

Die Fotos dienen ausschließlich der Sichtprüfung; keine Dateien, Texturen, Bildausschnitte oder historischen Bildinhalte werden ausgeliefert. Drei kleine Prüfkopien liegen nur unter `/tmp/topography-v281-*.jpg`, außerhalb des Projektpakets.

## Quellengeometrie und Schätzgrenzen

Der Bezug bleibt OSM-Ausstellungsgraben **way/281621233** im vorhandenen `TOPOGRAPHY_TERROR_SOURCE`. Die 24 bisherigen Tafelmittelpunkte, gezeichneten Breiten, Ausrichtung und Höhenansätze bleiben erhalten. Diese 24 regelmäßig verteilten Tafeln waren bereits Darstellungsschätzungen, keine vermessene Tafelzählung. Die fünf Akzente an den lokalen Indizes 0/5/10/15/20, die drei nicht eindeutig fotografisch verifizierten Zwischenfarben und sämtliche kleinen Rahmen-/Feldmaße sind ebenfalls ausdrücklich Schätzungen; die Kapitelgrenzen werden nicht als georeferenziert ausgegeben. Auch die beiden sichtbaren Farbtöne sind angenähert. Die 15 Stationen des gesonderten Geländerundgangs werden nicht platziert.

Keine Änderung an Quellenpolygonen, 72 Boden-/Mauer-/Dachsegmenten, durchlaufenden Dachschienen, Stützen, Berliner Mauer, Museum, PV, Wegen, Kellerrelief oder Kollision. Vor der Änderung wurden sämtliche übrigen Plan-Blöcke je Profil als SHA-256 eingefroren; der neue Test verlangt exakt dieselben vollständigen Datensätze. Alle 941 Kollisionskörper bleiben gleich.

Minecraft bekommt einen eigenen kardinalen Aufbau mit schmalen Eisenstäben und kleinen Dokumentblöcken. Kein neuer Block wird gedreht. Die übrige native Bestandsgeometrie bleibt unverändert. Neue Tafeldetails sind auf Desktop und Mobil identisch. Konservativ aufsummierte Rahmen- und Feldflächen bedecken weniger als 35 % jeder Tafelfläche. Strahltests durch die tatsächliche Gesamtgruppe bestätigen die offene Mitte jeder Tafel in allen vier Profilen.

## Integration und Prüfung

`TopographyExhibitionV281.ts` wird ausschließlich an der bisherigen Tafelstelle in `planTopographyTerror` aufgerufen. 24 deckende Quader entfallen, 192 kleine Teile kommen hinzu; netto **168 Instanzen / 12.768 Byte**. Keine zusätzliche Ebene, kein zusätzlicher Drawcall, keine größere Abdeckung und kein angehobenes Budget.

| Profil | Instanzen einschließlich Bestandswegen | Geometrie + Instanzen | Drawcalls |
| --- | ---: | ---: | ---: |
| Gezeichnet, Desktop / Mobil | 10.017 | 764.184 Byte | 11 |
| Minecraft, Desktop | 4.574 | 350.516 Byte | 11 |
| Minecraft, Mobil | 4.562 | 349.604 Byte | 11 |

Die vorhandenen Grenzen von 900.000 / 410.000 Byte werden unverändert eingehalten. Fokussierte Prüfung: `bun test tests/topography-exhibition-v281.test.ts tests/topography-terror-architecture.test.ts` aus `src/app`: **22 Tests bestanden**, darunter unveränderte Quellenkörper, tatsächliche Sichtstrahlen, fünf Farben, native Orthogonalität, vollständige Mobiltafeln und bisherige Architekturprüfungen. Kein Build und keine volle Suite gestartet.
