# Torstraße und Danziger Straße — v1.0.144

Diese begrenzte Fortsetzung von Schritt 10 verbessert die Lesbarkeit der
Straßenfronten. Sie behauptet keine vermessenen Einzelansichten sämtlicher Häuser.

- [Torstraße: vorhandene Fenster und Schaufenster](tor-fronts-v244.md).
- [Danziger Straße: quellengebundene Straßenfassaden](danziger-fronts-v244.md).

Alle 2.135 vorherigen Kacheldeskriptoren und ihre vollständigen Paketbytes bleiben
erhalten. Vierzehn zusätzliche 512-m-Begleitkacheln werden über den bestehenden
Entfernungs- und Speichercontroller geladen und wieder freigegeben. Es gibt
keine neue globale Detailwurzel, Textur, Shader-Variante oder Arbeit pro Bild.
Die Gesamtgrenze des reinen Katalogs steigt von 2.144 auf 2.176 Einträge, weil
2.149 Einträge benötigt werden; die Live-Grenzen bleiben unverändert:
24 MiB Gebietsgeometrie, 12 MiB je Kachel und 4 MiB Vorladen.

Die gezeichnete und unabhängig orthogonale native Familie enthalten sämtliche
Ergänzungen, auch auf Mobilgeräten. Bestehende Dächer, Gelände, Hoföffnungen,
Kollisionen, 93 Tourstationen und die geografische Abdeckung bleiben erhalten.

`scripts/integrate_street_fronts_v244.py` vergleicht die vollständige alte Stadt
mit dem veröffentlichten v1.0.143-Manifest aus Git, prüft sämtliche alten und
neuen Hashes und ergänzt nur die beiden dokumentierten Vorschläge. Die
historische Prüfadapterkette akzeptiert ausschließlich diese exakt nachgewiesene
Erweiterung; unbekannte Alt- und Neudatenänderungen werden abgelehnt.

Die Python-Prüfungen kontrollieren Quellwandbindung, Schutz besonderer Bauten,
Originalerhaltung und Manipulationsabwehr. Die Browser-Geometrietests dekodieren
beide Familien vollständig, prüfen Vertex-/Indexzahlen und GPU-Freigabe.

## Abschlussprüfung

- Produktionsbuild, Release-Inventar und Offline-Paketprüfung erfolgreich.
- 48 gezielte Frontend-Prüfungen (822 Assertions): neue Fassaden, bisherige
  v239-Details, Kacheldekodierung, Abbruch, Speicherfreigabe und Residenz.
- Python-Gesamtlauf: 1.560 bestanden, vier übersprungen. Die fünf zunächst
  gemeldeten Fehler betrafen den während der Erstellung wechselnden Versions-/
  Paketstand sowie die frühere Fehlerstelle eines verschärften Prüfadapters.
  Anschließend bestanden alle 123 Tests der betroffenen Dateien einschließlich
  sämtlicher neuer v244-Quell- und Integrationsprüfungen.
- Der zusätzliche breite Frontend-Lauf wurde nach Fehlern in unveränderten
  älteren Snapshots und Test-Doubles beendet; er ist ausdrücklich nicht grün.
  Betroffen sind insbesondere native Fabrik-Snapshots, alte Navigations-/
  Konstruktions-Mocks und historische Outline-Replays. Die zugehörigen Modelle,
  Decoder, Fixtures und bisherigen Pakete sind gegenüber v1.0.143 unverändert.
  In diesem begrenzten Straßen-Schritt wurden diese alten Erwartungen nicht
  pauschal neu geschrieben.

Die neuen Pakete benötigen zusammen 3.512.826 Byte komprimierten Transfer für
beide Familien über die ganzen Straßen. Das komplette Offline-Paket beträgt
929.080.797 Byte (886,040 MiB). Nur seine Datenträgergrenze wurde auf 888 MiB
angepasst; Live-Grenzen und geografischer Umfang bleiben gleich.

Desktop-Chromium und WebKit mit iPhone-13-Ansicht absolvierten jeweils 42
Kamerabesuche: sechs Straßenpositionen in Tag, Nacht, Schnee, Schwellenraum,
Hochwasser, Minecraft und erneut Tag. Neue Begleitpakete waren dabei geladen.
Keine Seitenfehler, Grafik-Kontextverluste oder Rücksprünge zum Start wurden
beobachtet. Der WebKit-Pufferhöchststand lag bei 192.760.026 Byte. Diese
Emulation ist keine Garantie für sämtliche physischen Mobilgeräte.
