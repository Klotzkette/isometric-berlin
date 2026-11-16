# Berliner Nachtleben und Unternehmensstandorte

Die Ortsanzeige ergänzt 46 Clubs, 18 Kneipen und Bars und alle vier Berliner
Amrit-Restaurants. Dazu kommen zehn Unternehmensstandorte und acht Anschriften
von Krankenkassen und ihren Verbänden. Standorte und Betreiber sind mit ihrem
Stand vom November 2026 erfasst.

Sisyphos an der Hauptstraße in Rummelsburg ist direkt anwählbar. Das vorhandene
Tor mit den beiden Enten und dem Schriftzug bleibt Teil des Modells. An der
Oberbaumbrücke zeigt der Viewer Silencio Berlin an der Falckensteinstraße 49.
Der Betreiber hat das ehemalige Watergate für ein befristetes Projekt
übernommen. Die dunkle Straßenfront folgt der fotografisch belegten
Umgestaltung. Die Orts- und Namenshinweise im Viewer kennzeichnen den Betrieb.
[Betreiberinterview zu Silencio](https://www.numeroberlin.de/2026/10/in-conversation-with-arnaud-frisch/)

Amrit hat Häuser in der Oranienstraße 204, der Oranienburger Straße 45,
der Winterfeldtstraße 40 und der Ebertstraße 14. Die ausgewählten
Kneipen beziehen sich auf die beiden tatsächlich verschiedenen Straßen.
Beim Namen am früheren Aufsturz-Standort ist die heutige Humboldtbar erfasst.
[Amrit-Standorte](https://amrit.de/faq/standorte-anreise/)

Die Berliner AOK-Nordost-Verwaltung in der Wilhelmstraße 1 und der
AOK-Bundesverband in der Rosenthaler Straße erscheinen als getrennte
Standorte. Auf dem zu niedrigen vorhandenen AOK-Sockel an der Wilhelmstraße
steht nun der anhand des amtlichen Oberflächenmodells rekonstruierte Turm.
Fensterbänder und grüner Schriftzug orientieren sich an der Außenaufnahme.
Telekom ist mit Magenta Mitte, Siemens mit dem Berliner Verwaltungsstandort
und Schaltwerk und Gillette mit dem Werk an der Oberlandstraße erfasst.
[Berlins digitales Oberflächenmodell](https://www.berlin.de/sen/stadt/stadtdaten/geoinformation/landesvermessung/geotopographie-atkis/dom-digitales-oberflaechenmodell/)
· [Außenaufnahme des AOK-Hochhauses](https://commons.wikimedia.org/wiki/File:AOK-Hochhaus-Berlin-Kreuzberg-Hans-Scharoun-Bodo-Fleischer-Februar-2020.jpg)
· [Telekom Berlin](https://www.telekom.com/de/newsroom/aktuelles/medieninformationen/2024/09/telekom-berlin-hat-jetzt-eine-magenta-mitte)

Der Prüfbericht `geo_data/regierungsviertel/venue-fronts-v357-audit.json.gz`
nennt je Standort die Quelle, die vorhandene Gebäudehülle und die Art der
Ergänzung. Namenstafeln auf einer belegten Außenwand sind Ortsangaben; der
Bericht kennzeichnet die nach Fotos modellierten Teile. Betreiberadressen
ohne eindeutig dargestellte Außenwand sind über **Stadtorte in der Nähe**
auffindbar. Die Innenstadt und die gestreamten Stadtteile haben getrennte,
jeweils für die gezeichnete und die Minecraft-Geometrie geprüfte Wandzuordnungen.

```sh
uv run python -m scripts.build_venue_fronts_v357 prepare /tmp/berlin-venues-v357
bun src/app/scripts/capture-venue-fronts-v355.ts /tmp/berlin-venues-v357/jobs.json /tmp/berlin-venues-v357/result.json venue-fronts-v357
uv run python -m scripts.build_venue_fronts_v357 publish /tmp/berlin-venues-v357
```
