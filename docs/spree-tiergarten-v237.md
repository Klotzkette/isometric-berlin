# Spreeufer und Tiergartenviertel, v237

Begrenzte Fassadenergänzungen an vorhandenen Baukörpern entlang Paulstraße,
Spenerstraße und Lüneburger Straße sowie im Umfeld von Klingelhöferstraße,
Tiergartenstraße und Corneliusstraße. Die Auswahl umfasst 76 vorhandene
Core-Prismen; nur tatsächlich freiliegende, straßenseitige Wandabschnitte erhalten
Ergänzungen. Schloss Bellevue, Bundespräsidialamt und die bereits individuell
modellierte CDU-Zentrale bleiben unverändert. Dies ist keine vollständige
Neuvermessung des Spreeufers oder des Botschaftsviertels.

## Quellen und Genauigkeitsgrenzen

`spree-tiergarten-v237-source.json.gz` enthält die ausgewählten, unveränderten
Core-Prismen mit ihrer vorhandenen Dezimeterquantisierung, die zugeordneten
OSM-Grundrisse/Attribute, benachbarte Baukörper zur Verdeckungsprüfung sowie
Straßen- und Eingangsknoten. Der minimale Flächenüberlappungswert zwischen
Prisma und zugeordnetem OSM-Gebäude ist 0,75. Die Hashes der vollständigen
Eingangsdateien werden beim Bau und in den Tests geprüft:

- `lod2-prisms.json`: vorhandene Grundrisse, Sockel- und Gesamthöhen, Dachcodes.
- `minecraft-voxels.json`: tatsächlich ausgelieferte 4-m-Säulenflächen.
- `raw/outer-v159/candidate.gpkg`: Straßen und Gebäudeattribute.
- `house-doors-v233-context.json.gz`: gemappte Eingangspunkte; höchstens 25 cm
  Abstand zur bestehenden Grundrisskante. Es werden keine Eingänge erfunden.

Die Fensterteilung, Öffnungsmaße, Profilstärken, Ornamente und nicht explizit
getaggten Farbtöne sind **Darstellungsschätzungen**. Die Quellen enthalten keine
vollständige Fenstervermessung. Vorhandene Dächer werden nicht ersetzt oder aus
Fassadenreferenzen neu erfunden. Bei den vom Core unterstützten geneigten Dächern
bleiben Ergänzungen mindestens 5,1 m unter der Gesamthöhe; damit reichen sie nicht
in dessen bis zu 5 m hohe Dachkonstruktion hinein.

Die folgenden öffentlichen Primärquellen wurden am 18.10.2026 als Textbelege
geprüft. Es werden keine Fotografien oder Bildtexturen in die Anwendung kopiert:

| Ort / Source-ID | Beleg | Umsetzung und Grenze |
| --- | --- | --- |
| Saudi-arabische Botschaft, OSM `24046078`, Core `D8FPssfz`, `QMjZqNX3`, `QvsS1iMw` | [Borgert Architekten](https://www.borgert-architekten.de/projekte/saudiarabische-botschaft): Halbrotunde, zurückgesetzter Haupttrakt, verbindendes Glasatrium und ornamentierter metallischer Schleier | Kleinteilige Metallprofile an den vorhandenen nördlichen Rotundensegmenten. Profilteilung und Ornamentandeutung sind geschätzt; die vorhandenen Baukörper bleiben maßgeblich. |
| Konrad-Adenauer-Stiftung, Akademie, OSM `33755520` | [Betreiber: Das Haus](https://www.kas.de/de/statische-inhalte-detail/-/content/das-haus): Naturstein im Veranstaltungsbereich, umlaufendes oberes Glasband | Durchgehendes oberes Glasband mit schlanken Pfosten; zurückhaltende Steinfügungen darunter. Keine Behauptung rekonstruierter Innenräume. |
| KAS-Bürogebäude und Erweiterung, OSM `33135651`, `609711202` | [Architekt der Erweiterung](https://cn-architekten.de/projekte/erweiterung-der-konrad-adenauer-stiftung); bestehende OSM-Farb-, Geschoss- und Flachdachattribute | Helle Profile, differenzierte Glasflächen, Flachdachkante. Farben aus vorhandenen Hex-Farbattributen; konkrete Fensterachsen sind nicht vermessen. |
| CDU-Zentrale, OSM `25999445` | [Zwei Pink](https://zweipink.de/projekt/bundesgeschaeftsstelle-cdu-berlin/): Glasquader, inneres Ellipsoid und Wintergarten | Bestehendes individuelles Modell bewusst ausgeschlossen; keine zweite Hülle. |
| Altbaukontext Lüneburger-/Spenerstraße | [Haus Bel’Vue](https://www.belvue.de/v9/): wiederhergestellte Stuckfassaden und historische Details | Zurückhaltende warme Laibungen, Fensterkreuze und Sohlbänke. Der Beleg beschreibt dieses Ensemble und ist ausdrücklich kein Einzelnachweis für jede Nachbarfassade. |

## Geometrie und Laufzeit

`scripts/build_spree_tiergarten_v237.py` erzeugt fünf separate
`spree237-*`-Begleitkacheln in beiden Geometriefamilien. Die Kerngeometrie liegt
außerhalb der Umgebungspakete; deshalb werden ihre Daten nicht umgeschrieben.
Die Ergänzung besitzt keine neue Bodenfläche, Navigation, Animation, Textur oder
permanente Szenenwurzel. Die Originaldateien bleiben bytegleich.
Das verpflichtende `nav`-Schema enthält nur den bestehenden Grundwert 5,2 m
und leere Arrays für Boden, Wasser und Gebäude, also keine neuen Navigationsflächen.

`spree-v237-manifest-addition.json` enthält ausschließlich die neuen
Chunk-Deskriptoren. Die gemeinsame Integration fügt sie dem vorhandenen Manifest
hinzu. Es gibt keinen zusätzlichen Runtime-Hook und keine Anhebung der Live-,
Vertex-, Index- oder Decodiergrenzen. Mobile Geräte verwenden dieselbe vollständige
Familie wie Desktopgeräte. Detailpakete folgen dem vorhandenen Lade-, Abbruch- und
Freigabezyklus.

Die gezeichneten Profile liegen parallel vor ihren Quellwänden. Die native
Variante wird unabhängig erzeugt: kurze achsenparallele Teilstücke sitzen auf den
tatsächlich vorhandenen 4-m-Säulenflächen. Lange Glas- und Gesimsbänder folgen den
Treppenstufen dieser Hülle; sie werden nicht als schräge Flächen in die Blöcke
eingebettet. Dieser Modus ist absichtlich geometrisch abstrahiert.

Exakte Paketgrößen, Vertex-/Indexzahlen, GPU-Bytezählung einschließlich
Indexbreite und Teilflächenzuordnung stehen in
`spree-tiergarten-v237-evidence.json`. Diese Zählung gilt nur für die Ergänzung,
nicht für den gesamten Stadt- oder Szenenspeicher. Pro Familie bleiben alle fünf
Kacheln zusammen unter 1 MiB (drawn) beziehungsweise 3 MiB (native) dekodierter
GPU-Attribute/Indices. Je Kachel werden die bestehenden Grenzwerte von
400.000 Vertices, 2.400.000 Indices und 12 MiB dekodiertem Paket eingehalten.

## Prüfung und Wiederholung

`uv run python scripts/build_spree_tiergarten_v237.py` baut allein aus der
kleinen gespeicherten Auswahl und den erhaltenen Säulendaten. Nur
`--refresh-source` liest die ursprüngliche lokale Quellenauswahl erneut ein.

`uv run pytest tests/test_spree_tiergarten_v237.py -q` prüft Quellenerhalt,
Quellwand-/Eingangsbindung, Saudi- und Akademie-Sonderbehandlung, beide
Paketfamilien, Hashes, tatsächliche Buffergrenzen, Bytezählung und ausschließlich
orthogonale native Dreiecke. Der gemeinsame Laufzeit-/Browser- und Releasecheck
erfolgt anschließend in der Integration.
