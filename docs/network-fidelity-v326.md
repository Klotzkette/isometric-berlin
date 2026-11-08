# Berliner Verkehrsachsen — V326

Dieser Durchgang bilanziert alle 37.590 vollständigen OSM-Ausgangswege des
retained Snapshots vom 29. September 2026: Hauptstraßen, Autobahnen/Zubringer,
Eisenbahn, S-/U-Bahn, Straßenbahn sowie ausdrücklich mit Brückenbezug erfasste
Nebenwege. Es ist weder eine neue Quartiersfüllung noch die Behauptung einer
fotogrammetrischen Vermessung jeder Verkehrsanlage. Frühere Fahrbahnen,
Schienenkurse, Bürgersteige, Markierungen, Brücken, Stationen und Nav-Flächen
bleiben unverändert.

## Vollständiger Ausgangsbestand und Grenzen

Die vollständigen ursprünglichen geographischen Kurse bleiben in
`raw/public-fidelity-v326/major_routes.geojson.gz` erhalten. Der neue Quellenbeleg
enthält für jede ursprüngliche `way/…`-Identität die ursprünglichen Tags, den
exakten Berliner Linienanteil, die Längen des vollständigen Originals und des
Außenkomplements sowie den Bearbeitungsstatus. Der Schnitt erfolgt gegen die
echte amtliche Landesgrenze, einschließlich jeder Randbucht. Auch gepufferte
neue Fittings und jedes vollständige Native-Rasterfeld müssen innerhalb dieser
Grenze und des tatsächlichen vorhandenen Untergrunds liegen. Der vorherige
regionale A10-Ring außerhalb Berlins bleibt vollständig erhalten.

36.935 Datensätze besitzen einen Berliner Anteil, 655 liegen vollständig
außerhalb. Der bilanzierte Ausgangsbestand umfasst 4.201.538,626 m Linien,
davon 3.995.520,967 m innerhalb Berlins und 206.017,659 m Außenkomplement.
Die Identitäten sind eindeutig; kein Ausgangsweg wird stillschweigend
weggelassen. Die anfängliche Statuszuordnung unterscheidet:

| Status | Ausgangswege |
| --- | ---: |
| vorhandener spezialisierter Quellen-/Detailkontext erhalten | 2.036 |
| eigener Höhen-/Decknachweis erforderlich | 6.821 |
| stillgelegt bzw. vorgeschlagen, unverändert | 255 |
| nicht als oberirdische Schiene zu ergänzender Subway-Fall | 341 |
| außerhalb Berlin, unverändert | 655 |
| tatsächlicher Paket-Untergrund einzeln zu prüfen | 27.482 |

Ein geschützter alter Quellenkontext ist keine Behauptung, dass jeder Meter
dieses Weges bereits fotografisch geprüft wurde. Insbesondere werden
Brücken-/Tunnel-/Layer-Tags nicht in erfundene Meterhöhen umgerechnet.
Bei den 6.821 getrennten Höhenfällen sind unter anderem 4.912 Brücken- und
1.236 Tunnel-Wege enthalten; mehrere Wege können zu derselben Anlage gehören.
Keiner besitzt eine metrisch verwendbare absolute `ele`-Angabe. Vorhandene
`height`-/`min_height`-Tags werden nicht blind als Deckhöhe interpretiert.
Bereits ausgearbeitete v190/v205/v226/v242/v281/v307/v313-Stationen,
Hochstrecken und Kontakte bleiben unangetastet. Unbelegte neue Hoch-/Tiefdecks
werden nicht als erledigte Korrektur ausgegeben.

## Tatsächlich ergänzte fehlende Details

Die Ergänzung verwendet 1.366 nicht leere Drawn-/Native-Rezepte auf bestehenden
normalen Paketen. 5.482 unterschiedliche OSM-Quellen besitzen positive neue
Fittings. Drawn und Touch erhalten dieselben vollständigen Daten. Native wird
eigenständig und orthogonal erzeugt; unterschiedliche tatsächliche
Untergrundflächen können zu unterschiedlichen zulässigen Teilflächen führen.

- Schienenköpfe folgen den vollständigen Originalkursen ausschließlich bei
  eindeutigem, positivem `gauge` und Einzelgleisnachweis. Der Kopfversatz
  berücksichtigt, dass die Spurweite zwischen den **inneren** Schienenkanten
  gemessen wird. 3.091 Drawn- bzw. 3.076 Native-Quellen bekommen sichtbare
  Ergänzungen. Bereits dargestellte Schienen, Bahnsteige, gemessene Kontakte
  und Brückenkontexte werden nicht überlagert. Elektrifizierungs-/Spannungs-
  und Gleisanzahl-Tags bleiben vollständig im Quellenbestand; es werden keine
  unkartierten Oberleitungsmasten oder eine unbekannte Stromschienenseite
  erfunden.
- Neue Fahrstreifenunterteilungen werden nur bei ausdrücklichem
  `lane_markings=yes` und positiver kartierter Spurzahl erzeugt. Sie bleiben
  innerhalb der tatsächlichen sichtbaren Fahrbahn, außerhalb geschützter
  alter Markierungen und Knotenbereiche, auch wenn ein anschließender
  Hauptweg bereits aus einem früheren Detailmodell stammt. 1.364 Drawn- und
  1.362 Native-Quellen erhalten solche Ergänzungen.
- Der begrenzte Original-PBF-Kontext liefert 15.234 ausdrücklich kartierte
  Kanten: 13.570 Kerbs, 122 Guardrails und 1.542 `fence_type=railing`-Geländer.
  Keine beliebige Fahrbahngrenze wird zum behaupteten kartierten Bordstein.
  Nur positiv als erhöht belegte bzw. mit positiver Höhe versehene Kerbs
  bekommen ein erhöhtes Mitglied; abgesenkte, bündige und gerollte Kanten
  bleiben unberührt. 42 Quellen werden in beiden Familien ergänzt.
- Guardrails und Geländer sind offene horizontale Mitglieder plus Pfosten,
  keine pauschalen geschlossenen Mauern. 85/86 Guardrail- und 874–876
  Geländerquellen besitzen je nach tatsächlich unterstütztem Mitglied und
  Familie positive Ergänzungen. Die 186 tatsächlich bereits emittierten
  v233-Kerb-Owner werden erhalten: 179 neue, sonst doppelte Mitglieder
  entfallen, ohne die vorhandenen alten Fittings anzufassen.

Gleiskopfbreite, Pfostenabstände, Metallquerschnitte, nicht kartierte kleine
Höhen sowie Strichlänge/-abstand sind dokumentierte Darstellungsschätzungen.
Kartierte Spurweiten, Spurzahl, Kurse und vorhandene Höhen-/Materialangaben
werden dabei erhalten. Es wird keine exakte aktuelle Verkehrszeichen- oder
Fahrbahnmarkierungsvermessung behauptet. Die öffentlich dokumentierte
[Regelspurweite der S-Bahn Berlin](https://sbahn.berlin/das-unternehmen/fahrzeugpark/die-neue-s-bahn/)
und die [DB-InfraGO-Netznutzungsbedingungen](https://www.dbinfrago.com/web-en/rail-network/network_statement)
sind Kontext; sie ersetzen kein fehlendes lokales `gauge` im neuen Compiler.

## Positiver geometrischer Nachweis

Das Preflight baut seriell 2.356 vorhandene gewöhnliche Paketansichten mit der
tatsächlichen früheren Decoder-/Ownership-Pipeline und entsorgt jede Root
sofort. Es exportiert nur Prepared-Pins und die ursprünglichen
Floor-Dreieck-IDs, die nach allen älteren Eingriffen nicht mehr unverändert
sichtbar sind. Diese Dreiecke können keine neue Ergänzung tragen.

Jedes neue vollständige Fittingpolygon muss auf der tatsächlichen
weiterhin aktiven Originalfläche liegen. Gebäude, frühere besondere
Geländedatums, Brückenkontexte und die tatsächlichen 317 neuen U-Treppen-
Öffnungen werden ausgespart. Der Nachweis erfolgt nach Zentimeterrundung,
einschließlich Ecken und Löchern, nicht nur mit einem Mittelpunkt oder einer
ungeprüften Road-Boundingbox. Native wählt unabhängig vollständige
Viertelmeterzellen; jede ganze Zelle muss durch dieselbe tatsächliche
Quellfläche getragen werden. Sparse Zeilenintervalle sparen Offline-Rechenzeit
und sind gegen die vollständige Rasterauswahl geprüft.

Die endliche Schlusskorrektur vergleicht 147 betroffene Originalappends vor
der Änderung durch vollständiges Replay mit sämtlichen damaligen
Positions-/Farb-/Indexbytes. 1.221 Pläne bleiben vollständig unverändert;
zwei Pakete enthalten danach nur bereits vorhandene bzw. unzulässige
Knotendetails und werden nicht als leere Upgrade-Rezepte geführt. Alle alten
Paket-, Shader-, Geometrie-, Body-, Roof-, Nav- und Linienwörter bleiben erhalten.

## Format, Grenzen und Reproduktion

43 normale neue SourceQuarter-JSON-Shards mit maximal 32 Schlüsseln und
kleinen eager Schlüsselindizes nutzen unverändert das vorhandene schwache
Per-Key-Konstruktionsformat. Keine neue Runtime-Kompression, kein Worker-
Import, kein zusätzlicher Anfangs-Weltroot und kein neuer Frame-/Timerloop
wird eingeführt. Die größten Roh-Shards sind kleiner als 28 MB und damit
unter der unveränderten 100-MiB-Git-Dateigrenze. Die vor der finalen
Prepared-Metadatenaktualisierung gemessenen vollständigen Werte umfassen
447.289.721 rohe JSON-Bytes bzw. 132.385.409 unabhängige Per-Packet-Gzip-Bytes.
Die tatsächlichen finalen Datei-/Bundlegrößen werden im Release-Beleg geführt.

Alle bisherigen Livegrenzen bleiben bestehen: höchstens 16 Meshteile,
400.000 Vertices, 2.400.000 Indices, vorhandene Decode-/Prefetchgrenzen und
24-MiB-Residency. Es gibt keine Budgetausnahme und keine Detailkürzung zur
Umgehung einer Grenze. Das neue Rezept kommt nach den früheren Quartier-
Rezepten; Raw- und vollständige Prepared-Pins bleiben strikt. Ein veränderter
Untergrund, falscher Modus/Origin, manipulierte Appends und Abbruch geben
keine neue Besitzübertragung frei. Alte Darstellung bleibt als Fallback.

Die gesamte endliche Offline-Paket-/Katalogerweiterung wird separat gemessen;
sie ist keine Erhöhung einer Live- oder Workergrenze. Die normale begrenzte
Streaming- und Entsorgungslaufzeit bleibt zuständig.

Reproduktion:

```sh
uv run --no-sync python -m scripts.build_network_fidelity_v326 --audit --edges --candidates
bun src/app/scripts/preflight-network-support-v326.ts geo_data/regierungsviertel/raw/public-fidelity-v326/network-candidate-keys.json
uv run --no-sync python -m scripts.build_network_fidelity_v326 --build --measure-only
uv run --no-sync python -m scripts.build_network_fidelity_v326 --refine-measured
uv run --no-sync python -m scripts.build_network_fidelity_v326 --promote-measured
bun src/app/scripts/finalize-network-fidelity-v326.ts
uv run --no-sync pytest -q tests/test_network_fidelity_v326.py
bun test src/app/tests/network-fidelity-v326.test.ts
```

Die Originale sind bytegebunden an den vollständig eingefrorenen veröffentlichten
206-Manifest, nicht an einen später erweiterten Live-Manifest. Stage-Shards
werden ausschließlich als deterministische Gzip-Transportkopien außerhalb der
Runtime abgelegt und vor Promotion vollständig gegen komprimierte und
dekodierte SHA-256-Werte geprüft. Der vollständige Belegstream prüft auch den
JSON-Trailer, deklarierte Zeilenzahl und gzip-EOF/CRC. Reproduktion darf weder
ihre eigenen neuen Scopes abziehen noch ältere veröffentlichte Fixtures
überschreiben. Quellen: © OpenStreetMap-Mitwirkende, ODbL 1.0; amtliche
Landesgrenze gemäß beibehaltenem NOTICE. Es gibt keine neuen Foto-/Kartentexturen.
