# Berliner Dönerläden und weitere Fassaden

Über **Stadtorte in der Nähe** sind 36 ausgewählte Dönerstandorte
auffindbar, darunter Oggi’s an der Heidestraße, Mustafa’s am Mehringdamm,
Rüyam in Schöneberg und Prenzlauer Berg, Imren, Hasır, Nefis, Pamfilya,
K’UPS, Vöner und Lale. Grundlage sind aktuelle Betreiberangaben, das
Berliner Tourismusverzeichnis und der Berlin-Abzug von OpenStreetMap
vom 15. November 2026. Die Auswahl umfasst auch dokumentierte Filialen.
Oggi’s nutzt die vorhandene Rekonstruktion an der Ecke Döberitzer Straße.

Mustafa’s am Mehringdamm 33, beide Rüyam-Standorte und Vöner erhalten nach
Außenaufnahmen modellierte Ladenfronten. Bei Mustafa’s stammen Beschriftung,
Fensterteilung und Farbakzente von der Aufnahme des heutigen Eingangs. Bei elf weiteren Läden tragen bestätigte
Wandflächen Namenstafeln. Wo sich Laden oder Fassade nicht eindeutig
zuordnen lassen, zeigt der Ortslayer den belegten Standort. Die [Standortquellen](doener-inventory-v356.md) und Fotografien sind dokumentiert.

Für 18 zuvor offene Standorte aus dem [Ämter- und Handelsverzeichnis](venues-v355.md)
ist die vorhandene Gebäudehülle jetzt anhand des Kartenumrisses zugeordnet.
15 haben eine sichtbare Fassadentafel, darunter das Finanzamt Steglitz,
das Bürgeramt Hohenzollerndamm, Eastgate, das Linden-Center und die Wilma.
Das Polizeipräsidium am Platz der Luftbrücke ist dem bereits
modellierten Bau zugeordnet. Die bestehenden Standortmarkierungen bleiben
erhalten.

Die zusätzlichen Arbeiten sind auf vorhandene Außenflächen begrenzt.
Der Produktionslauf prüft die Darstellung auf unabhängig nachgewiesenen Wänden
in den gezeichneten Ansichten und in Minecraft. Die Prüfung vergleicht
die vorher vorhandene Geometrie, Farben, Linien und Navigationsdaten mit dem
Ergebnis. Die zusätzlichen Ladenfronten werden über die bestehenden Kacheln
geladen. Die Quelldateien und das Ergebnis pro Standort sind in
`geo_data/regierungsviertel/venue-fronts-v356-audit.json.gz` protokolliert.

```sh
uv run python -m scripts.build_venue_fronts_v356 prepare /tmp/berlin-venues-v356
bun src/app/scripts/capture-venue-fronts-v355.ts /tmp/berlin-venues-v356/jobs.json /tmp/berlin-venues-v356/result.json venue-fronts-v356
uv run python -m scripts.build_venue_fronts_v356 publish /tmp/berlin-venues-v356
```
