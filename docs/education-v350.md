# Berliner Grundschulen und Kindertagesstätten — V350

Die lokale, versionierte Bestandsliste verbindet öffentliche Einrichtungsnamen, Adressen und amtliche Standortpunkte. Sie enthält **439 ausdrücklich als Grundschule klassifizierte Hauptstandorte** (387 öffentliche, 52 private) und **2.941 Kita-Standorte** in allen zwölf Bezirken. Der Viewer benötigt dafür keine Live-Abfrage und kein Nachladen von GitHub.

## Quellen und Stand

| Quelle | Stand | Umfang | Nutzung |
| --- | --- | --- | --- |
| [Berliner Schulverzeichnis als WFS](https://daten.berlin.de/datensaetze/schulen-wfs-ebc64e18) | Schuljahr 2026/27; Katalogaktualisierung 23.09.2026 | 929 Schulen sämtlicher Schularten; ausschließlich Hauptstandorte | 439 Datensätze mit `schulart=Grundschule`; dl-de-zero-2.0 |
| [Kindertagesstätten als WFS](https://daten.berlin.de/datensaetze/kindertagesstatten-wfs-d03b94d2) | 31.12.2025 | 2.905 öffentlich finanzierte Einrichtungen in öffentlicher und freier Trägerschaft | Vorrangige Kita-Standorte; dl-de-zero-2.0 |
| [Kitas in Berlin](https://daten.berlin.de/datensaetze/kitas-in-berlin), [XLSX](https://www.berlin.de/sen/bildung/service/daten/kitaliste-nov-2025.xlsx) | 14.11.2025 | 2.917 Einrichtungen, einschließlich regulärer und besonderer Einrichtungsarten | Ergänzung um 36 nur hier enthaltene Standorte; CC BY 4.0 |

Abruf: 15.11.2026. Attribution für die XLSX: **Senatsverwaltung für Bildung, Jugend und Familie**. Die [amtliche Datenseite](https://www.berlin.de/sen/bildung/service/daten/) nennt die Lizenz CC BY 4.0. URLs, Abrufdatum, Quelldatum, Lizenz, Rohdatenumfang und SHA-256 stehen im Quellbeleg. Der Katalog beschreibt auch privat-gewerbliche Einrichtungen; aus dieser Beschreibung wird kein konkreter Betreiberstatus für einzelne Einrichtungen abgeleitet.

2.881 Kita-Einrichtungsnummern stimmen zwischen beiden Verzeichnissen überein. Bei derselben Nummer gilt immer der neuere WFS-Datensatz. 24 WFS-Einträge stehen nicht in der XLSX. Die 36 zusätzlichen älteren Einträge (20 reguläre Einrichtungen, 15 heilpädagogische Gruppen und eine Sprachförderung) tragen ausdrücklich `older-xlsx-only-current-status-unverified`; die Liste behauptet für sie keinen aktuell bestätigten Betrieb.

## Grenzen der Genauigkeit

Ein amtlicher Punkt bestätigt eine Einrichtung an einem Standort. Er belegt weder einen bestimmten Eingang noch einen Gebäudeumriss, eine Fassade, Fensterzahl oder Hofausstattung. Die spätere Darstellung darf den Punkt nur mit tatsächlich belegtem, erhaltenem Gebäudebestand verbinden; ein nächstgelegenes Haus ist allein kein Nachweis.

71 Gemeinschafts-, Waldorf- und kombinierte Schulen sind separat als `primary-stage-site-not-verified` dokumentiert. Das Schulverzeichnis liefert deren Hauptstandort; daraus folgt nicht, dass die Grundstufe an dieser Adresse untergebracht ist. Der amtliche Filter „Gemeinschaftsschulen mit Grundstufe“ und 48 individuelle Schulporträts bestätigen bei 48 davon die Grundstufe institutionell; diese Prüfung ist in `education-v350-primary-stage-review.json` mit URLs und Beleg-Hashes dokumentiert. Die konkrete Adresse der Grundstufe ist dadurch nicht gesondert nachgewiesen. Diese Einträge werden daher nicht als geprüfte Grundschulstandorte ausgegeben. Nicht im veröffentlichten Verzeichnis enthaltene Nebenstandorte oder Einrichtungen werden nicht erfunden. Die Liste ist somit eine breite amtliche Abdeckung, keine Garantie sämtlicher heute betriebener Grundschul- oder Kita-Nebenstandorte.

Bestehende ausgearbeitete Schulmodelle aus V185, V205 und V274 bleiben erhalten. Insbesondere ersetzen die neuen Verzeichnisdaten weder deren Gebäudegeometrie noch deren bereits belegte architektonische Details.

## Dateien und Schnittstelle

- `geo_data/regierungsviertel/education-v350-source.json.gz`: normalisierte, auf Einrichtungsdaten beschränkte Quellbelege.
- `geo_data/regierungsviertel/education-v350-inventory.json.gz`: 3.380 eindeutig identifizierte Datensätze; rund 139 KB gzip.
- `geo_data/regierungsviertel/education-v350-evidence.json`: Prüfzahlen nach Bezirk/Trägerklasse, Hashes und offene Grundstufen-Zuordnungen.
- `scripts/build_education_inventory_v350.py`: begrenzter Downloader und deterministischer Offline-Generator.

Das Inventar verwendet `{schemaVersion:1, crs:"EPSG:25833", sources, records}`. Jeder Eintrag enthält `id`, `category` (`primary-school` oder `kita`), `name`, `easting`, `northing`, `street`, `houseNumber`, `postcode`, `district`, `sourceKey`, `sourceUrl` und `locationEvidence`. Schulnummern erhalten das Präfix `school:`, Kita-Nummern `kita:`. Führende Nullen bleiben erhalten. Die WFS-Trägerklasse wird unverändert übernommen, soweit vorhanden.

Telefonnummern, Fax, E-Mail-Adressen, personenbezogene Trägernamen, Personal-, Kapazitäts- und Schülerzahlen werden nicht in den normalisierten Quellen oder im Inventar gespeichert. Gebäudeumrisse und Eingangskoordinaten werden nicht ergänzt.

```sh
uv run python scripts/build_education_inventory_v350.py
uv run pytest tests/test_education_inventory_v350.py -q
```

`--refresh` ruft die drei genannten amtlichen Quellen erneut ab. Der normale Aufruf arbeitet ausschließlich lokal. Gzip-Dateien erhalten einen festen Zeitstempel, sodass identische Quellen identische Ausgaben erzeugen.

Geprüft: deterministische bytegenaue Rekonstruktion; vollständige Auswahl der ausdrücklich als Grundschule klassifizierten Datensätze; alle zwölf Bezirke; deduplizierte Kita-Vereinigung mit Vorrang der neueren Quelle; Trennung älterer unbestätigter Standorte; Ausschluss zusätzlicher personenbezogener Spalten; Ablehnung ungültiger Koordinaten ohne erfundenen Ersatz. Zehn gezielte Tests bestehen, einschließlich der getrennten institutionellen Grundstufenprüfung ohne erfundene Standortkoordinaten.
