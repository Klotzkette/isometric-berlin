# Nordische Botschaften und KAS-Zentrale, v246

Die Ergänzung betrifft die Nordischen Botschaften an der Rauchstraße 1 und die
Konrad-Adenauer-Stiftung an der Klingelhöferstraße 23. Die KAS-Akademie an der
Tiergartenstraße 35 und das benachbarte Konrad-Adenauer-Haus der CDU sind andere
Gebäude und bleiben unverändert. Das bestätigt die [Kontaktseite der Stiftung](https://www.kas.de/de/kontakt).

## Quellen und Zuordnung

Der OSM-Komplex `25999438` enthält den tatsächlichen geschwungenen Außenkurs.
Seine 51 gebogenen Randsegmente sind zusammen **227,287 m** lang. Nur die beiden
langen südlichen Schließkanten des Grundstückspolygons werden nicht als Fassade
interpretiert: Dort liegen der Zugang und die offene Seite an der Rauchstraße.
Der [Betreiber](https://www.nordischebotschaften.org/der-botschaftskomplex/) nennt
ein ungefähr 230 m langes, 15 m hohes Kupferband und sechs einzelne Häuser.
Die neue Darstellung verwendet 48 horizontale Reihen mit wirklichen offenen
Zwischenräumen. Anzahl, Teilung, Profilstärke und Farbnuancen sind kompakte
Darstellungsschätzungen; es wird keine Vermessung aller etwa 4000 echten
Einzellamellen behauptet.

| Haus | OSM-Way | Beleg und begrenzte Umsetzung |
| --- | --- | --- |
| Dänemark | `26746070` | [Betreiber](https://www.nordischebotschaften.org/der-botschaftskomplex/daenemark/): Glas und Edelstahlplatten zur Plaza. Glasbänder und feine Metallgliederung auf den vorhandenen Wänden. |
| Finnland | `26746067` | [Betreiber](https://www.nordischebotschaften.org/der-botschaftskomplex/finnland/): Lärchenholz und Glas. Teilweise offene Holzschirme vor den Quellfassaden. |
| Island | `37428406` | [Betreiber](https://www.nordischebotschaften.org/der-botschaftskomplex/island/): Roter Rhyolith zur Plaza. Warmer Stein, schmale Fugen und zurückhaltende Öffnungen. |
| Norwegen | `26746069` | [Betreiber](https://www.nordischebotschaften.org/der-botschaftskomplex/norwegen/): Granitplatte an der schmalen Platzfront, Glas und Milchglas. Der vorhandene schmale Stirnwandabschnitt erhält die Steinfläche; die Seiten erhalten Glasgliederung. |
| Schweden | `26746068` | [Betreiber](https://www.nordischebotschaften.org/der-botschaftskomplex/schweden/): Heller Kalkstein an der Südseite, dunkler Granit im Westen, horizontale Fenster und Glasschirme. Die Farben folgen diesen tatsächlich unterschiedlichen Wandrichtungen. |
| Felleshus | `26746071` | [Betreiber](https://www.nordischebotschaften.org/der-botschaftskomplex/felleshus/): Ahornholz, Glas und Sichtbeton. Horizontale Holzgliederung und schmale Fensterbänder an den bestehenden Außenwänden; kein erfundenes begehbares Innenmodell. |
| KAS-Zentrale | `33135651` | Retained OSM-Adresse, Farbe und fünf Geschosse. Steinflächen und schlanke Laibungen ergänzen die unveränderte v237-Fensterteilung. |
| KAS-Erweiterung | `609711202` | [Claus Neumann Architekten](https://cn-architekten.de/projekte/erweiterung-der-konrad-adenauer-stiftung): Erweiterung an der Klingelhöferstraße 23, fertiggestellt 2021. Helle Steinflächen und eine flache obere Abschlusskante auf den erhaltenen Wänden. |

Als ergänzende Material-/Konstruktionsbeschreibung wurde [Euro Inox, *Die
Botschaften der nordischen Länder in Berlin*, 2002](https://www.edelstahl-rostfrei.de/fileadmin/user_upload/ISER/downloads/Die-Botschaften-der-nordischen-Laender-in-Berlin.pdf)
herangezogen. Die Architekturinformationen dienen nur als Referenz; Fotos,
Texturen und Bildpixel werden nicht ausgeliefert. Die kleinen Öffnungen und
Fassadengliederungen sind nicht vermessen. Quelle und Modell werden deshalb
ausdrücklich getrennt.

## Erhalt und begrenzte Korrektur

`nordic-kas-v246-source.json.gz` bewahrt die kompletten acht zugeordneten
OSM-Gebäude samt Quellattributen und allen über mindestens 75 % Flächenüberdeckung
passenden vorhandenen Core-Prismen. Die 19 verwendeten Detailwände sind exakt
als Kante, Grundhöhe und Oberhöhe eines unveränderten Flachdachprismas
nachgewiesen. Dächer, Baukörper, Höfe und Navigation werden nicht neu erzeugt.

Nur der bisherige Nordic-Abschnitt in `DiplomaticAndRobertKochDetails.ts` wird
ersetzt. In Release `v1.0.145` bestand er aus 26 unkonturierten grünen Boxen:
`a = -.78 + i/25*1.55`, Zentrum
`[-1449.6 + sin(a)*55, 11.6, 1069 + cos(a)*8]`, Größe
`[4.5, 12.5, 1]`, Rotation `a`, Farbe `0x6e9783`. Dieser Bogen lag quer in der
Plaza und folgte nicht dem Grundstücksrand. Die neue vollständige Rezeptfunktion
steht unmittelbar an derselben Aufrufstelle; es gibt keinen asynchronen Zeitraum
ohne Ersatz und keine pauschale Filterung von Quellgeometrie.

Alle v237-Pakete bleiben bytegleich, einschließlich sämtlicher KAS-Gläser,
Pfosten, Fugen und Eingangsdetails. Neue Steinflächen liegen mit 3,5 cm Abstand
vor der Grundwand, hinter den 15 cm vorgelagerten v237-Gläsern. Zusätzliche
Laibungen verwenden dieselbe vorhandene Fenstertaktung. Bei der KAS werden
ausschließlich die fünf bereits in v237 belegten Fassadenabschnitte ergänzt;
es entstehen keine neuen leeren Fensterrahmen auf unbehandelten Hofwänden.
Das bestehende Modell
der CDU-Zentrale und sämtliche anderen Botschaftsdetails werden durch diesen
Modulwechsel nicht berührt.

## Laufzeit und Prüfung

Die Laufzeitdaten enthalten nur Kupferkurs, 19 Wandbezüge und 705 unveränderte
4-m-Säulen als Unterstützung für die native Variante: **26.980 B JSON**.
Die native Variante erzeugt eigenständige orthogonale Teilflächen vor diesen
tatsächlich gelieferten Säulen; freie Kupferspannen folgen einem rechtwinkligen
Kurs. Die Genauigkeit dieses Kurses bleibt bewusst die vorhandene native
Abstraktion. Kein schräges gezeichnetes Element wird als native Geometrie kopiert.

Alle Teilflächen werden direkt in einen gemeinsamen typisierten Buffer
geschrieben. Vorder-/Rückseiten teilen dieselben Vertices. Es entstehen keine
tausenden temporären Geometrieobjekte, Texturen, Animationen, neuen Descriptoren
oder dauerhaften Decodier-Caches. Gezeichnete Details gehen in den bestehenden
Diplomatic-Batch; `createMinecraftNordicAndKasV246()` liefert einen nativen Batch.
Beide nutzen den vorhandenen Material-, Upload- und Freigabezyklus. Die Live-,
Manifest- und Paketlimits sowie die vollständige Mobile-Qualität bleiben gleich.

Gemessene Ergänzung ohne die erhaltenen Quellkörper:

| Familie | Vertices | Attribute und Indices | Draws |
| --- | ---: | ---: | ---: |
| Drawn | 15.996 | 317.304 B | 1, im bisherigen Batch zusammengeführt |
| Native | 61.596 | 1.293.516 B | 1 |

Gezielte Prüfungen: `tests/test_nordic_kas_v246.py` (**6 bestanden**) und
`src/app/tests/nordic-kas-v246.test.ts` (**5 bestanden**). Sie prüfen unveränderte
Eingangshashes/v237-Pakete, vollständige Identitäten, jeden Kupferabschnitt,
Quellwandbindung, tatsächliche native Säulenunterstützung, ausschließlich
orthogonale native Flächen, Mobile-Parität und gemessene Buffergrenzen.

Zur Sichtprüfung: Nordische Botschaften Ziel `[-1449, 12, 1080]`, etwa 200 m
Abstand; von Süden sind Plaza und Materialunterschiede sichtbar, von Nordwesten
der Kupferkurs. KAS-Zentrale Ziel `[-1315, 13, 1177]`, etwa 130 m Abstand,
mit Blick von Norden/Osten auf das Bürogebäude und von Süden auf die Erweiterung.
