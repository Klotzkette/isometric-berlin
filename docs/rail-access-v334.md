# Berliner S- und U-Bahn-Zugänge

Das Zugangsverzeichnis verbindet Berliner Schienenhaltestellen mit öffentlichen
Straßenzugängen aus dem VBB-Fahrplandatensatz vom 5. November 2026. Die VBB-Zeilen
liefern Haltestellen- und Zugangsschlüssel, Namen, Koordinaten, Verknüpfungen
und Ebenen. Die zulässige Nutzung steht unter CC BY 4.0 mit Namensnennung des
Verkehrsverbunds Berlin-Brandenburg. [VBB Open Data](https://unternehmen.vbb.de/digitale-services/datensaetze/)

Die Berechnung prüft die Berliner Landesgrenze und die veröffentlichte S- und
U-Bahn-Bedienung. Sie führt 279 Bahnhofskomplexe mit 3.096 VBB-Zugangsknoten.
Diese Knoten enthalten auch Haltepositionen von Bussen, Straßenquerungen und
Zwischenebenen. 734 Knoten sind ergänzende öffentliche Straßenzugänge mit
nachgewiesenen Verbindungen zum jeweiligen Bahnhof. 652 VBB-Knoten wurden mit
536 bereits vorhandenen U-Bahn-Objekten abgeglichen. Fünf praktisch
deckungsgleiche Zugänge sind zusammengefasst. Die restlichen Knoten sind in
der Quittung nach Ausschlussgrund aufgeschlüsselt.

Für Stationen mit bereits gestalteten Ausgängen bleibt das ältere Modell
sichtbar. Das betrifft unter anderem alle zwölf im VBB-Datensatz bezeichneten
Straßenzugänge von Stadtmitte und Hausvogteiplatz am Gendarmenmarkt. Für den
früher Schönhauser Tor genannten Bahnhof Rosa-Luxemburg-Platz kommt der
nachgewiesene Aufzug an der Torstraße hinzu. Am Bahnhof Schönhauser Allee
werden die Arcaden-Treppen, der Arcaden-Aufzug und die Greifenhagener
Brückenzugänge als S-Bahn-Zugänge geführt. Der Betreiber belegt die Verbindung
zwischen Nordbahnstraße und S-Bahnsteig für Wollankstraße, deren VBB-Zeilen
mit dem Straßennamen beginnen. [Landesdenkmalamt](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09080044)
· [S-Bahn-Plan Schönhauser Allee](https://sbahn.berlin/fileadmin/user_upload/Bahnhoefe/Umgebungsplan/Schoenhauser_Allee.pdf)
· [S-Bahn Wollankstraße](https://sbahn.berlin/fahren/bahnhofsuebersicht/wollankstrasse/)

32 oberirdische Treppenverläufe stimmen an beiden Enden mit einem VBB-Pfad
überein. Die vier bereits modellierten Treppen der Bülowstraße bleiben bei
ihrem V238-Modell. Die Grundlinien der 28 ergänzenden Verläufe stammen aus dem
Geofabrik-Auszug Berlin vom 29. September 2026. Aus ihnen entstehen Tritte, wenn der Viewer
an beiden Enden tatsächlich Gelände und ein erhöhtes modelliertes Podest
bereitstellt. Die übrigen Zugänge werden in bodennaher Ansicht nach Typ
gekennzeichnet. Die VBB-Daten liefern Lage und Zugangstyp. Form und Farbe der
kleinen Erkennungszeichen sowie fehlende Treppenbreiten und Stufenzahlen sind
Darstellungsschätzungen. © OpenStreetMap-Mitwirkende, ODbL 1.0.
[OpenStreetMap Lizenz](https://www.openstreetmap.org/copyright)
· [Geofabrik Berlin](https://download.geofabrik.de/europe/germany/berlin.html)

`geo_data/regierungsviertel/rail-access-v334-evidence.json.gz` enthält die
vollständige Auswahlquittung mit den VBB-Zeilen, den Zuordnungen und den
Quellenprüfsummen. Der Viewer fragt jeweils nur die nahen Rasterzellen ab.
Drei wiederverwendete Geometriepuffer begrenzen den Speicher. Die Schicht
setzt eine aktuell verfügbare, belegte Bodenfläche voraus. Neue unterirdische
Passagen, Liftkabinen und Eingriffe in die Navigation sind nicht Teil dieser
Schicht.
