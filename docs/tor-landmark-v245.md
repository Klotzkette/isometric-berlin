# Torstraße 138: einzelner Jugendstilbau (v245)

Der Schritt ergänzt ausschließlich die bisher schlichte Torstraßenfront des
bestehenden Elterngebäudes `DEBE01YYK00007I6` (OSM `386915734`, Vorderhaus
`DEBE3DbALrqZAA3i`). Die vollständigen drei vermessenen LoD2-Teile, sechs
Dachflächen, der Innenhof und der separate Linienstraßenflügel bleiben erhalten.
Der bereits geltende Höhenversatz von 1,66 m wird auch für die Ergänzungen benutzt.

Die [Denkmalbeschreibung, LDA 09080095](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080095)
belegt die fünfgeschossige Torfront, einen dreigeschossigen Erker, Balkone,
die hohe Rustika und kräftige Gesimse. Die
[amtliche Fassadenaufnahme, LDA 1999](https://denkmaldatenbank.berlin.de/media/uploads/Mit/03/09080095a.jpg)
zeigt den links versetzten Erker mit dreigeteilten Fenstergruppen, offene
Balkone rechts daneben und paarige Seitenfenster. Daraus entstehen flache,
räumliche Erker-/Gesimsrückläufe, Balkonplatten und Brüstungen, gegliederte
Fenster, eine hohe Sockelzone und zurückhaltend abstrahierte Reliefakzente.
Die Aufnahme nennt keinen Fotografen; sie dient ausschließlich als
Formreferenz. Es werden keine Bildpixel, Texturen, historischen Ladenaufschriften
oder privaten Bewohnerdaten übernommen.

Die Quellgeometrie löst die zwei fotografierten Giebel nicht gesondert auf.
Es wird deshalb kein geratenes Ersatzdach oder zusätzlicher Giebelkörper
gebaut. Die bestehende Dachform bleibt exakt erhalten. Vorbautiefen,
Profilstärken, Fensterteilung und warme neutrale Materialtöne sind ausdrücklich
Darstellungsschätzungen; das historische Schwarzweißbild belegt keine heutigen
Farben oder Mieter. Die geschlossene Eingangsdarstellung erzeugt keinen
begehbaren Durchgang. Balkone und Erker liegen oberhalb des Straßenraums.

## Bindung und Erhalt

Die nackte Torstraßenwand ist durch ihre zwei tatsächlich gelieferten Dreiecke
bestätigt. Alle Ergänzungen liegen in ihrer vollständigen begrenzten Fläche.
Die native Familie folgt einer separat bestätigten, bereits gelieferten
rechtwinkligen Wand bei `z=-1126`; sie kopiert keine schrägen gezeichneten
Flächen. Bestehende Navigation und Höhen bleiben für beide Familien zuständig.

Der Owner besitzt 16 v239-Fenster am **anderen Flügel zur Linienstraße**.
Diese bleiben ebenso erhalten wie sämtliche v239- und v244-Pakete und das
ursprüngliche Paket `3_-3`. Der Generator prüft 34 alte Paket-SHA256 sowie
fünf Quelldateien vor jeder Erzeugung. Kein altes Paket wird geschrieben.

## Auslieferung und Prüfung

- Ein neuer Begleiter `torlandmark245-3_-3`, ausdrücklich an `3_-3` gebunden.
- Komprimiert: 20.462 Byte gezeichnet und 16.568 Byte native.
- Vollständige GPU-Geometrie: 49.212 / 39.324 Byte.
- Ein Mesh je Familie, keine Textur, kein globales Modell und keine Frame-Arbeit.
- Keine neue Boden-, Gebäude- oder Kollisionsnavigation, kein höheres Livebudget.
- Generator: `scripts/build_tor_landmark_v245.py`; Source, Evidence und
  Manifest-Ergänzung unter `geo_data/regierungsviertel/tor-landmark-v245-*`.
- Sechs Python-Tests prüfen komplette Quellen, alte Bytes, die gelieferten
  Wandreceipts, sämtliche Anbauten innerhalb der ursprünglichen Front,
  rechtwinklige native Flächen, räumliche Erker-/offene Balkonformen und Größe.
  Glas, Reflexionen und Rahmen bleiben auch nach der Zentimeterkodierung
  mit ausreichendem Abstand getrennt, sodass die Flächen nicht flackern.
- Drei Bun-Tests prüfen vollständige Dekodierung beider Familien, unveränderte
  Eingangsdaten, GPU-Freigabe und Abbruch vor Veröffentlichung.

Straßenansicht: eye `[1921.11,18,-1166.79]`, target
`[1923.765,16,-1124.8745]`; näher eye `[1922.18,15,-1149.82]`.
