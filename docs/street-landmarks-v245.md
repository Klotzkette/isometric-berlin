# Torstraße 138 und Danziger Straße 57 — v1.0.145

Diese kleine Fortsetzung von Schritt 10 behandelt zwei bislang kahle,
eindeutig identifizierte Straßenfassaden. Sie ersetzt keine übrigen Häuser
und behauptet keine vermessene Exaktheit sämtlicher Fenster.

- [Torstraße 138](tor-landmark-v245.md): dreigeschossiger Erker, offene
  Seitenbalkone, geteilte Fenster, hoher rustizierter Sockel und Gesimse.
- [Danziger Straße 57 / Senefelderstraße 35](danziger-landmark-v245.md):
  rote Klinker-Obergeschosse, helle Einfassungen, Fenstergiebel und Geschossbänder.

Vollständige bestehende Baukörper, Dächer, Hofräume, Bodenniveaus und Kollisionen
bleiben unverändert. Die Fassaden folgen belegten amtlichen Quellwänden und
Referenzfotos; kleinere Maße, Farbwerte und Ornamente sind ausdrücklich
vereinfachte Darstellungen. Historische Fotos belegen keine aktuellen Mieter
oder zwischenzeitlichen Renovierungen. Keine Fotos oder Texturen werden geladen.

Alle 2.149 alten Deskriptoren und Paketbytes bleiben erhalten. Zwei kleine
Begleitkacheln mit zusammen 95.986 Byte komprimiertem Transfer für beide
Familien verwenden die bestehende entfernungsabhängige Speicherverwaltung.
Die native Familie ist separat orthogonal konstruiert; die gezeichnete Familie
behält auf Mobilgeräten alle Details. Keine neue globale Geometriewurzel,
Shader-Variante, Animation oder Arbeit pro Bild.

Unverändert: 24 MiB Gebietsgeometrie, 12 MiB je Kachel, 4 MiB Vorladen,
2 MiB Manifest und 2.176 mögliche Deskriptoren. Tatsächlich 2.151 Deskriptoren;
das Manifest ist 2.096.756 Byte groß. Neue Provenienzmetadaten speichern nur
Prüfsummen der vollständig versionierten Supplemente statt deren Deskriptoren
ein zweites Mal zu übertragen. Die exakte historische Prüfkette vergleicht
weiterhin das ganze Manifest und lehnt unbekannte Änderungen ab.

Keine neue geografische Abdeckung oder Tourstation; alle 93 Stationen bleiben.

## Prüfungen

Quellwandbindung, eigenständige native Geometrie, unveränderte Altbytes,
Zuordnung zu den bestehenden Kacheln und Manipulationsabwehr werden geprüft.
Die neuen Geometrieprüfungen kontrollieren zusätzlich vollständige Dekodierung,
Abbruch und Freigabe der Grafikobjekte. 

- Produktionsbuild und Ruff erfolgreich; Offline-Startprüfung bestanden.
- 55 gezielte Bun-Tests / 681 Assertions bestanden: beide neuen Modelle,
  bisherige Straßenfronten sowie Laden, Abbruch, Dekodierung und Freigabe.
- Desktop-Chromium und WebKit mit iPhone-13-Ansicht: jeweils 14 Besuche,
  zwei Gebäude in allen sechs Modi und anschließend erneut Tag. Alle neuen
  Begleiter wurden nachweislich geladen. Keine Seitenfehler, Kontextverluste
  oder Rücksprünge; WebKit-Puffermaximum 192.851.018 Byte. Dies ist eine
  Browseremulation und keine Garantie für sämtliche physischen Mobilgeräte.
- Visueller Vorher-/Nachhervergleich; flackernde, beim Packen kollabierende
  Fassadenlagen vor Veröffentlichung korrigiert und separat abgesichert.
- Komplettes Offline-Paket: 929.179.782 Byte (886,135 MiB), innerhalb der
  unveränderten Grenze von 888 MiB.

Die vollständige Python-Prüfung bestand mit 1.600 erfolgreichen und vier
übersprungenen Tests (22:35 Minuten). Die zwei Warnungen betreffen ältere
Geodaten-Testexporte ohne CRS; es gibt keinen fehlgeschlagenen Test.
Der bekannte ältere breite Frontend-Prüfbestand aus v1.0.144 wurde nicht
pauschal neu geschrieben oder als vollständig grün ausgegeben; diese
Fortsetzung prüft gezielt alle betroffenen Modelle und Streaming-Pfade.
