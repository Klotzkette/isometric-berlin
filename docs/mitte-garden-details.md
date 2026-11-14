# Ufer und Gartenanlagen in Tiergarten, Hansaviertel und Moabit

Die Darstellung ergänzt Gehölzgruppen am Hansaplatz und an der Promenade des Holsteiner Ufers, Stauden im Steingarten des Englischen Gartens sowie Pflanzbeete und Gehölze im Kleinen Tiergarten und Ottopark. Hinzu kommen Röhrichtgruppen in zwei als Marsch kartierten Flächen des Großen Tiergartens. Die 21 Pflanzflächen folgen dem Berliner OpenStreetMap-Auszug vom 29. September 2026 und den passenden öffentlichen Grünflächen des Berliner Grünflächeninformationssystems. [Erhaltungssatzung Hansaviertel, Seite 42](https://www.berlin.de/ba-mitte/politik-und-verwaltung/bezirksamt/beschluesse-des-bezirksamts/2020/998-2020-anlage-3-1-erhv-hansaviertel_textteil.pdf) · [Englischer Garten](https://www.berlin.de/landesdenkmalamt/denkmale/highlight-denkmale-der-alliierten/grossbritannien/mitte/englischer-garten-647982.php) · [Parks in Mitte](https://www.berlin.de/ba-mitte/ueber-den-bezirk/sehenswertes/parks-und-gaerten/) · [GRIS Berlin](https://www.berlin.de/sen/uvk/natur-und-gruen/stadtgruen/gruenflaecheninformationssystem-gris/karten-online/) · [OpenStreetMap und ODbL](https://www.openstreetmap.org/copyright)

Die 1.282 modellierten Gruppen orientieren sich an den Flächenumrissen. Einzelpositionen, Wuchshöhen und Blütenfarben sind angenähert. Vorhandene Wege, Wasserflächen, Häuser und bereits dargestellte Gehölze dienen als Ausschlussflächen. Die Pflanzung nutzt das vorhandene Geländeniveau beider Grafikvarianten und enthält eigene blockartige Geometrie für Minecraft. Die Kacheln enthalten ausschließlich zusätzliche sichtbare Geometrie.

Reproduktion aus dem gespeicherten Quellenauszug.

```sh
.venv/bin/python -m scripts.build_mitte_garden_details /tmp/berlin-mitte-garden-details
```

Die Paketdatei `geo_data/regierungsviertel/mitte-garden-details-receipt.json` enthält die vollständigen SHA-256- und Größenangaben. Der Test `bun test tests/mitte-garden-details.test.ts` im Verzeichnis `src/app` lädt die sieben Kacheln pro Grafikvariante mit dem tatsächlichen Viewer-Controller und prüft repräsentative sichtbare Pflanzungen.
