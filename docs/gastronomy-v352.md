# Gastronomie V352: belegte Standorte und begrenzte Verfeinerung

Stand des Quellenabgleichs: 15. November 2026. **108 Identitäten erhalten jeweils ein ausdrückliches Ergebnis. Zehn Standorte werden sichtbar ergänzt:** sechs Burger King, zwei Einstein Kaffee, Konnopke und ein Starbucks. Dies ist keine Aussage, dass alle Berliner Filialen fotografisch rekonstruiert oder am Prüftag tatsächlich geöffnet sind.

## Inventare und Grenzen

| Quelle | Vollständigkeit dieses Abgleichs | Ergebnis |
|---|---|---|
| Burger King, öffentliches offizielles Restaurantverzeichnis | Alle 1.155 gelieferten Datensätze geografisch geprüft; 44 innerhalb der Berliner Landesgrenze | 26 Status `Open`, 16 `Closed`, einmal `Temp Closed`, einmal `Projected`; nur `Open` erhält neue Geometrie |
| Einstein Kaffee, Berliner Standortseite | Alle 23 Standortkarten, 22 verschiedene Detailseiten | Zwei sichtbare Fassadenergänzungen; Kurfürstendamm 72 ohne eigene Detailseite ausdrücklich offen |
| Eigenständige Einstein-Cafés | Einstein Unter den Linden und historisches Café Einstein Stammhaus getrennt | Keine Gleichsetzung mit der Einstein-Kaffee-Kette; aktuelle Stammhaus-Nutzung nicht primär belegt |
| Starbucks | 17 einzeln bestätigte offizielle Filialseiten und Ostbahnhof in der offiziellen Lizenznehmer-FAQ | Eine sichtbare Fassadenergänzung; vollständiger Locatorzugriff nicht verfügbar. Warschauer Straße bleibt unbestätigter Hinweis |
| Bekannte Imbisse/Wirtshäuser | Konnopke, drei Bier’s, vier Curry 36, Hofbräu, Augustiner, Erdinger, Maximilians sowie zwei historische Fälle | Eigenständige Namen/Adressen; kein erfundenes Hofbräu am Gendarmenmarkt |
| Weitere Kartenbeobachtungen | Fünf Einstein- und ein Starbucks-Objekt ohne passenden aktuellen Primärnachweis | Unbestätigt im Audit behalten |

Die [offizielle BK-Suche](https://www.burgerking.de/store-locator) liefert auch geschlossene und geplante Einträge. Die Statuswerte werden unverändert dokumentiert. Der öffentliche, von der Website benutzte GraphQL-Endpunkt und sein vollständiger Abfragevertrag stehen in `gastronomy-v352-primary-audit.json.gz`; der Landesgrenzentest ergibt dieselben 44 Identitäten wie die lokale Auswahl. Doppeladressen mit früherem/neuem Restaurant bleiben eigene Verzeichniseinträge.

[Einstein Kaffee](https://einstein-kaffee.de/standorte/standorte-berlin/) ist von [Einstein Unter den Linden](https://www.einstein-udl.com/) zu unterscheiden. Betreiberfotos wurden für die Fassade gelesen; Bilddateien werden nicht im Viewer ausgeliefert. Die Wilmersdorfer Detailseite verbindet eine aktuelle Adresse mit einer abweichenden Foto-/Dateiadresse: deshalb keine neue Fassade dort.

Die [Starbucks-Detailseite Albrechtstraße 132](https://www.starbucks.de/de/store-locator/80337-309540) bestätigt die Identität. Das von AmRest gelieferte, [bei food-service am 5. Juli 2024 ausdrücklich AmRest zugeschriebene Außenfoto](https://www.food-service.de/weltweit/news/starbucks--amrest-ein-partner-400-coffeeshops-60206) stützt einzelne weiße Buchstaben auf der Steinfront. Die Veröffentlichungsseite ist der Bildnachweis; aktuelle Filialidentität stammt vom Betreiber. Das bestehende detaillierte Modell am Pariser Platz und der vorhandene Hauptbahnhof-Stand bleiben erhalten. Der vom Drittverzeichnis gelieferte Locatorcode 63382-284093 bezeichnet laut offizieller Seite einen BER-Standort, nicht Warschauer Straße; er wird nicht nach Berlin versetzt.

## Tatsächliche Änderungen

Fünf bestehende Wände erhalten kleine, vollständig gestützte geometrische Schriftzüge: Konnopke Schönhauser Allee 44b, Einstein Mühlenstraße/Mercedes-Platz, Einstein Rathaus-Center Pankow, Burger King Charlottenburger Chaussee und Starbucks Albrechtstraße 132. Die Schilder sind Wiedererkennungsdetails; Breite, Buchstabenraster und Montagehöhe sind ausdrücklich Modellschätzungen. Die Schrift ist eine eigene einfache Geometrie, keine kopierte Textur. Starbucks hat entsprechend dem Außenfoto einzelne weiße Buchstaben ohne erfundene grüne Hintergrundtafel. Seine Native-Wand muss höchstens vier Meter von der ausgewählten Drawn-Fassadenstrecke entfernt sein.

Fünf bisher fehlende, tatsächlich kartierte Burger-King-Baukörper werden auf **ihrem vollständigen eigenen Grundriss** ergänzt:

| Standort | Erhaltener Formnachweis | Verbleibende Schätzung |
|---|---|---|
| Michael-Brückner-Straße 24 | OSM way 24430646, ein Geschoss, Walmdach, ein Dachgeschoss | Geschosshöhe 3,6 m, Dachanstieg 1,6 m, neutrale Farben |
| Oraniendamm 6–10 | OSM way 48395704, zwei Geschosse, Flachdach | 6,4 m Körperhöhe und neutrale Farben |
| Saatwinkler Damm 61 | OSM way 161297069, ein Geschoss | 3,6 m Körperhöhe; unbekannte Dachform als ausdrücklich ungemessene flache Abschlussfläche |
| Paulsternstraße 16 | OSM way 204157828, ein Geschoss | 3,6 m Körperhöhe; unbekannte Dachform als ausdrücklich ungemessene flache Abschlussfläche |
| Holzhauser Straße 31–33 | OSM way 204281885, Flachdach; Wiedereröffnungsfoto Juli 2026 mit warmem Mauerwerk und hohen dunklen Glasrahmen | 5,8 m Körperhöhe, Glasfeldmaße und Farbabstufungen |

Das [Holzhauser Wiedereröffnungsfoto](https://de.linkedin.com/posts/jens-baran-27161439a_burger-king-holzhauser-stra%C3%9Fe-in-berlin-activity-7478845536733794305-iEYV) ist ein Ersthandbericht mit Team- und Fassadenansicht. Personen, Werbedetails und Foto-Pixel werden nicht übernommen. Bei den vier übrigen Neubaukörpern werden keine unbelegten Fensterlayouts oder Türen erfunden. Es entstehen keine Innenräume, Zufahrten, Parkplätze oder Drive-through-Spuren. Der Bestand ist unverändert; die neuen Volumen werden nicht als vermessene Fassadenrekonstruktionen bezeichnet.

## Erhaltung und Laufzeit

Für jede neue Hülle wurde die Abwesenheit in sämtlichen berührten bisherigen Surrounding-Gebäudeeigentümern und im ursprünglichen Drawn-Core geprüft. Alle fünf Native-Umrisse liegen vollständig außerhalb des ursprünglichen Native-Core-Rasters. Bestehende Bodenflächen werden für Drawn und Native getrennt abgezogen; es wird nur der unbebaute Rest unter dem tatsächlichen neuen Hausgrundriss ergänzt. DGM1-Höhen stammen aus exakten ursprünglichen Meterzellen an Grundrisspunkten und einem Zweimeter-Stützraster, mit `worldY = NHN − 30 m`. Eine lokale ebene Fundamenthöhe ist eine Modellnäherung und verändert keine ältere Topographie.

Native entsteht unabhängig als kardinaler Grundriss und eigenständig gestuftes Dach. Jeder Zusatz nutzt die bestehende Host-Lebensdauer, Zulassung und Entsorgung; keine neue globale Animation, Bildtextur oder Residenzgrenze. Der Voll-Decoder prüft für die fünf alten Fassaden beide Modi: sämtliche alten Positions-/Farb-/Indexwörter, Materialien und Navigation bleiben gleich; das gesamte Schildrechteck ist sichtbar gestützt und frei von älteren Details. Die zehn neuen Host/Modus-Pakete werden ebenfalls durch den tatsächlichen Produktionsdecoder geprüft, einschließlich sichtbarer Meshes, Boden und Baukörperkollision. Keine neuen frei begehbaren Restaurant-Innenräume werden behauptet.

Gemessene Quelldateien: fünf kompakte Fassadenpaare in einer 4.004-Byte-JSON-Datei; fünf zusätzliche Gebäudepaare in zehn gzip-Paketen mit **42.471 Byte** insgesamt. Dies sind Quellpaketgrößen, keine zusätzliche Behauptung über Ladezeit oder endgültige Buildgröße. Der Hauptrelease prüft den unveränderten öffentlichen Gesamtdeckel und alle sechs Darstellungsmodi.

## Namensauflösung

- Der bekannte Ku’damm-Imbiss ist [Bier’s Kudamm 195](https://biers-currywurst.de/kontakt/). Seine Identität ist bestätigt; eine präzise belegte Mietfassade bleibt offen. Curry 36 führt vier eigene Berliner Standorte.
- [Konnopke](https://www.konnopke-imbiss.de/de) liegt an der Schönhauser Allee 44b unter der Hochbahn bei Eberswalder Straße. Eine historische Heinersdorfer Filiale wird nicht als aktueller Konnopke erfunden.
- Das aktuelle [Hofbräu Wirtshaus](https://www.hofbraeu-wirtshaus.de/berlin/) ist Karl-Liebknecht-Straße 30. Am Gendarmenmarkt sind unter anderem [Augustiner](https://augustiner-braeu-berlin.de/) und [Erdinger](https://erdingerberlin.de/) eigenständige Betreiber.
- [Maximilians](https://www.maximilians-berlin.de/impressum) nennt Friedrichstraße 185–190 und den Zugang Kronenstraße 62. Ohne Beleg dieses Hof-/Eingangseigentümers entsteht kein Schild an einer beliebigen Friedrichstraßenwand. Das frühere Löwenbräu Leipziger Straße 65 bleibt historisch.

## Reproduktion und Prüfung

Die versionierten `gastronomy-v352-*.json.gz` Dateien enthalten das bereinigte Quelleninventar, die unveränderten Kartenidentitäten, Gebäudegrundrisse, DGM-Nachweise und ein Ergebnis für jeden Datensatz. Bezug der aktuellen Betreiberinhalte ist von deterministischer Geometrieerzeugung getrennt; die Primärquellen-Abfrage und Foto-Hashwerte sind im separaten Audit festgehalten. OSM-Geometrie: Berlin-PBF vom 13. November 2026, © OpenStreetMap-Mitwirkende, ODbL. DGM1/LoD2: Geoportal Berlin, dl-de-zero-2.0. Betreiber- und Fotoseiten werden nur als Referenz verlinkt.

```sh
uv run python -m scripts.build_gastronomy_inventory_v352
uv run python -m scripts.extract_gastronomy_buildings_v352
uv run python -m scripts.build_gastronomy_v352
bun src/app/scripts/capture-gastronomy-v352.ts geo_data/regierungsviertel/raw/city-v352/gastronomy-compact.json geo_data/regierungsviertel/gastronomy-v352-evidence.json.gz
uv run python -m scripts.build_gastronomy_v352 --publish
uv run python -m scripts.build_gastronomy_terrain_v352
uv run python -m scripts.build_gastronomy_supplements_v352
bun src/app/scripts/verify-gastronomy-supplements-v352.ts
uv run pytest -q tests/test_gastronomy_v352.py
bun test src/app/tests/gastronomy-v352.test.ts
```

Die Delta-Datei wird vom Hauptrelease in das gemeinsame Manifest integriert; kein älteres Paket wird regeneriert. Die gezielten fünf Python- und vier Bun-Tests bestanden. Manuelle Viewer-QA sowie vollständige Build-/Releaseprüfungen erfolgen im Hauptrelease.

## Ergebnis für jeden Datensatz

| Identität | Adresse | Ergebnis |
|---|---|---|
| augustiner | Charlottenstraße 55 | point-outside-retained-building-footprints |
| biers-195 | Kurfürstendamm 195 | exterior-photo-proof-pending |
| biers-friedrich | Friedrichstraße 207 | exterior-photo-proof-pending |
| biers-kant | Kantstraße 7 | exterior-photo-proof-pending |
| bk/10006 | Muellerstr. 153 | operator-closed |
| bk/10073 | Reisseckstr. 6 / Mariendorfer Damm | operator-closed |
| bk/10912 | Alt-Treptow-Str. 14-17, Berlin | operator-closed |
| bk/11379 | Im Bahnhof Alexanderplatz, Berlin | operator-temp-closed |
| bk/13455 | Karl-Marx-Str. 100 | operator-closed |
| bk/13927 | Alt-Mahlsdorf, Berlin | point-outside-retained-building-footprints |
| bk/14190 | Nahmitzer Damm 12, Berlin | point-outside-retained-building-footprints |
| bk/14204 | Oraniendamm 6-10, Berlin | source-owned-exact-footprint-restaurant-recognition |
| bk/14264 | Buckower Damm 11, Berlin | tenant-exterior-evidence-unresolved |
| bk/14316 | Flughafen Berlin Tegel, Berlin | operator-closed |
| bk/14471 | Ostpreussendamm 62, Berlin | point-outside-retained-building-footprints |
| bk/14562 | Teltower Damm 25 | operator-closed |
| bk/14563 | Joachimsthaler Str. 1-3 | operator-closed |
| bk/14659 | Holzhauser Str. 31-33, Berlin | source-owned-exact-footprint-restaurant-recognition |
| bk/14798 | Charlottenburger Chaussee 55, Berlin | source-wall-recognition |
| bk/15131 | Bahnhof-Friedrichstrasse, Berlin | indoor-or-mall-concession-no-exterior-invented |
| bk/15470 | Straße des 17.Juni 100, Berlin | point-outside-retained-building-footprints |
| bk/15557 | Europaplatz 1, Berlin | indoor-or-mall-concession-no-exterior-invented |
| bk/15635 | General-Pape-Strasse, Berlin | indoor-or-mall-concession-no-exterior-invented |
| bk/15971 | Landsberger Allee 119, Berlin | tenant-exterior-evidence-unresolved |
| bk/16233 | Holzmarktstr. 4 | operator-closed |
| bk/16316 | Kronprinzessinnenweg 120, Berlin | tenant-exterior-evidence-unresolved |
| bk/16499 | Tempelhofer Damm 28/30, Berlin | tenant-exterior-evidence-unresolved |
| bk/16518 | Silbersteinstr 54 | operator-closed |
| bk/16811 | Saatwinkler Damm 61-64, Berlin | source-owned-exact-footprint-restaurant-recognition |
| bk/17215 | Großbeerenstr 2 | operator-closed |
| bk/17377 | Paulsternstrasse 16, Berlin | source-owned-exact-footprint-restaurant-recognition |
| bk/18529 | Schönhauser Allee 79/80, Berlin | indoor-or-mall-concession-no-exterior-invented |
| bk/18701 | Eastgate Center, Berlin | operator-closed |
| bk/26729 | Wilmersdorfer Str. 112, Berlin | indoor-or-mall-concession-no-exterior-invented |
| bk/28417 | Prenzlauer Promenade 69, Berlin | tenant-exterior-evidence-unresolved |
| bk/30447 | 2 Großbeerenstraße | point-outside-retained-building-footprints |
| bk/34551 | Berlin, The Playce | operator-projected |
| bk/7157 | Yorkstrasse 90 | operator-closed |
| bk/7211 | Frankfurter Allee 44 | operator-closed |
| bk/8058 | Carl-Schurz-Str. 37, Berlin | tenant-exterior-evidence-unresolved |
| bk/8512 | Wilmersdorfer Str. 129 | operator-closed |
| bk/8577 | Alexanderplatz 8, Berlin | tenant-exterior-evidence-unresolved |
| bk/8589 | Michael-Brückner-Str. 24, Berlin | source-owned-exact-footprint-restaurant-recognition |
| bk/8609 | Prenzlauer Promenade 69 | operator-closed |
| bk/8687 | Potsdamer Strasse 114, Berlin | point-outside-retained-building-footprints |
| bk/8734 | Landsberger Allee 277, Berlin | indoor-or-mall-concession-no-exterior-invented |
| bk/9416 | Prerower Platz 1, Berlin | indoor-or-mall-concession-no-exterior-invented |
| bk/9570 | Ekz Gropiuspassagen | operator-closed |
| curry36-hbf | Europaplatz 1 | station-concession-no-exterior-invented |
| curry36-mehringdamm | Mehringdamm 36 | exterior-photo-proof-pending |
| curry36-warschauer | S-Bahnhof Warschauer Straße | station-concession-no-exterior-invented |
| curry36-zoo | Hardenbergplatz 9 | point-outside-retained-building-footprints |
| einstein-stammhaus | Kurfürstenstraße 58 | historical-mapped-site-current-primary-operation-unconfirmed |
| einstein-udl | Unter den Linden 42 | independent-cafe-exterior-owner-proof-pending |
| einstein/alexanderplatz | Alexanderplatz 3 10178 Berlin | no-matching-visible-wall-in-both-modes |
| einstein/bikini-berlin | Budapester Straße 38-50 10787 Berlin | mapped-tenant-location-unresolved |
| einstein/checkpoint-charlie | Friedrichstraße 206 10117 Berlin | point-outside-retained-building-footprints |
| einstein/friedrichstr-166 | Friedrichstraße 166 10117 Berlin | point-outside-retained-building-footprints |
| einstein/gendarmenmarkt | Markgrafenstraße 34 10117 Berlin | point-outside-retained-building-footprints |
| einstein/hauptbahnhof | Europaplatz 1 10557 Berlin | existing-station-or-indoor-concession-preserved |
| einstein/joachimsthaler-strasse | Joachimsthaler Straße 12 10719 Berlin | point-outside-retained-building-footprints |
| einstein/kadewe | Tauentzienstraße 21-24 10789 Berlin | existing-station-or-indoor-concession-preserved |
| einstein/kantstrasse | Kantstraße 126-127 10625 Berlin | operator-photo-download-unavailable |
| einstein/kudamm | Kurfürstendamm 50a 10707 Berlin | point-outside-retained-building-footprints |
| einstein/kudamm-32 | Kurfürstendamm 32 10719 Berlin | point-outside-retained-building-footprints |
| einstein/kudamm-72 | Kurfürstendamm 72 | city-card-listed-but-unique-detail-page-and-current-photo-unresolved |
| einstein/mercedes-platz | Mühlenstraße 15 10243 Berlin | source-wall-recognition |
| einstein/pc-tauentzienstrasse | Tauentzienstraße 19/19a 10789 Berlin | existing-station-or-indoor-concession-preserved |
| einstein/potsdamer-strasse | Potsdamer Straße 125 10783 Berlin | point-outside-retained-building-footprints |
| einstein/rathaus-center-pankow | Breite Straße 20 13187 Berlin | source-wall-recognition |
| einstein/roesterei-berlin | Franklinstraße 12 10587 Berlin | courtyard-specific-frontage-needs-independent-owner-proof |
| einstein/savignyplatz | Stadtbahnbogen 596 10623 Berlin | point-outside-retained-building-footprints |
| einstein/stadtmitte | Friedrichstraße 185-190 10117 Berlin | point-outside-retained-building-footprints |
| einstein/suedkreuz | Hildegard-Knef- Platz 1 10829 Berlin | existing-station-or-indoor-concession-preserved |
| einstein/wegelystrasse1 | Wegelystraße 1 10623 Berlin | point-outside-retained-building-footprints |
| einstein/wilmersdorfer-strasse | Wilmersdorfer Straße 112 10627 Berlin | operator-photo-address-conflict-71-versus-current-112 |
| einstein/zoologischer-garten | Hardenbergplatz 2 10623 Berlin | operator-photo-download-unavailable |
| erdinger | Jägerstraße 56 | exterior-tenant-span-unresolved |
| hofbraeu | Karl-Liebknecht-Straße 30 | point-outside-retained-building-footprints |
| konnopke | Schönhauser Allee 44b | source-wall-recognition |
| konnopke-heinersdorf-former | Romain-Rolland-Straße 16 | historical-branch-not-confirmed-current-no-active-brand-invented |
| loewenbraeu-former | Leipziger Straße 65 | former-restaurant-no-current-hofbraeu-invented |
| mapped-only/node/11300921351 | Rheinstraße | mapped-only-current-operator-identity-unconfirmed |
| mapped-only/node/12388448484 | Aaron-Bernstein-Platz | mapped-only-current-operator-identity-unconfirmed |
| mapped-only/node/13081389195 |  | mapped-only-current-operator-identity-unconfirmed |
| mapped-only/node/2496651195 | Bergmannstraße | mapped-only-current-operator-identity-unconfirmed |
| mapped-only/node/4388936224 |  | mapped-only-current-operator-identity-unconfirmed |
| mapped-only/node/6714794979 | Friedrichstraße | mapped-only-current-operator-identity-unconfirmed |
| maximilians | Friedrichstraße 185-190; entrance Kronenstraße 62 | courtyard-and-kronenstrasse-entrance-needs-exact-facade-proof |
| starbucks/53208-282067 | Pariser Platz 4a | existing-detailed-pariser-platz-model-preserved |
| starbucks/53213-282068 | Friedrichstraße 96 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/53214-282066 | Europaplatz 1 | existing-hauptbahnhof-interior-preserved |
| starbucks/53222-282090 | Friedrichstraße 61 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/53223-281900 | Grunerstraße 20 | mall-concession-no-exterior-invented |
| starbucks/53224-281931 | Kurfürstendamm 61 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/53743-283045 | Neue Promenade 3 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/56749-290692 | Joachimsthaler Straße 3 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/56750-290691 | Mühlenstraße 3-100 | mall-concession-no-exterior-invented |
| starbucks/59304-293512 | Hardenbergplatz 11 | station-concession-no-exterior-invented |
| starbucks/61682-296137 | Alexanderplatz 2 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/80337-309540 | Albrechtstraße 132 | source-wall-recognition |
| starbucks/80573-309367 | Kurfürstendamm 224 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/80720-308722 | Friedrichstraße 110-111 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/80954-309375 | Schönhauser Allee 78-80 | mall-concession-no-exterior-invented |
| starbucks/82886-312439 | Unter den Linden 39 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/85320-312958 | Tauentzienstraße 8 | current-identity-confirmed-exterior-photo-and-tenant-span-unresolved |
| starbucks/ostbahnhof | Berlin Ostbahnhof | licensed-station-listed-mapped-concession-unresolved |
| starbucks/warschauer | S-Bahnhof Warschauer Straße | directory-lead-not-primary-verified-no-exterior-invented |
