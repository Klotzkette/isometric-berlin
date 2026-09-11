Isometric Berlin - Regierungsviertel 1.0.41

DEUTSCH

Dieses Paket enthält die vollständige isometrische 3D-Stadt mit Tag, Nacht,
Schnee, Minecraft und Schwellenraum. Standort, Blickrichtung und Geh-/Flugzustand
bleiben beim Wechsel der Darstellung erhalten. Alle benötigten Daten sind lokal
enthalten; kein AI-Modell, Google-Schlüssel oder kostenpflichtiger Dienst nötig.

1. Den gesamten Download entpacken.
2. Windows: OPEN-3D-WINDOWS.bat oder start-windows.bat doppelklicken.
   macOS: OPEN-3D-MAC.command starten; bei Bedarf Rechtsklick > Öffnen.
   Linux: sh start-linux.sh
3. Alternativ im entpackten Ordner: python3 serve-local.py
4. Den automatisch geöffneten Browser verwenden und das Terminal offen lassen.

Python 3 wird benötigt: https://www.python.org/downloads/
START-HERE.html erklärt diese Schritte auch ohne laufenden Server. Über HTTP
führt die Seite direkt zum selben 3D-Viewer weiter. index.html benötigt HTTP;
ein direktes file://-Öffnen kann die Szenendaten nicht laden.
Ist Port 8766 belegt, wählt der Server den nächsten freien Port. Einen eigenen
Port ohne automatischen Browserstart wählen: python3 serve-local.py --no-open --port 8770

Bedienung: Im Hilfemenü stehen die aktuellen Maus-, Tastatur- und Touch-Gesten.
„Zu Fuß“ erlaubt Gehen und Springen; „Freikommen“ hilft an engen Stellen.
Der deutsche/englische Sprachschalter und die fünf Darstellungen bleiben im Viewer.
Bei Ladeproblemen zuerst die gesamte ZIP neu entpacken, den lokalen Server
neu starten und die angezeigte HTTP-Adresse öffnen. Der Browser benötigt WebGL.
„Neu laden“ erlaubt bei einem Fehler einen sauberen Neustart der 3D-Szene.

ENGLISH

This package contains the complete isometric 3D city in Day, Night, Snowstorm,
Minecraft and Schwellenraum. Visual changes preserve location, view and walking
or flight state. Every required asset is included locally. No AI model, Google
key or paid service is required.

Extract the whole archive. On Windows run OPEN-3D-WINDOWS.bat or start-windows.bat.
On macOS run OPEN-3D-MAC.command; if needed, right-click > Open. On Linux run
sh start-linux.sh. Alternatively run python3 serve-local.py in the extracted
folder. Python 3 is required. The browser opens automatically; keep the terminal
open while viewing. An occupied port automatically advances to the next free port.
Use python3 serve-local.py --no-open --port 8770 to select a port manually.

START-HERE.html is a file-safe launch guide. Over HTTP it redirects to the same
3D viewer, preserving URL settings. Opening index.html as a file cannot load the
scene. Use the local HTTP address printed by the server. The Help menu describes
current mouse, keyboard and Touchscreen gestures. Walk and Get unstuck remain
available. The interface supports German/English. For loading problems, extract
a fresh complete ZIP, restart the local server and reopen its HTTP address.
The browser requires WebGL; Reload starts a clean 3D scene after an error.

DATA / DATEN

The source inventory contains 29,818 buildings. Exact
near-field budgets are 12,000 on desktop and
5,000 on mobile, with complete instanced background coverage.
Procedural LoD2/OSM geometry, source-derived JSON, the walking minimap, startup
backdrop and all credits are retained. Retired flat-map tiles are not bundled.
The original data/generation pipeline remains available in the repository.

© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)
Visual references: Wikimedia Commons/Wikipedia
Kindertransport visual references: © Pauline Ahrens, 2021 / Bildhauerei in Berlin (CC BY 4.0)
Per-file credits: dzi/regierungsviertel/wikimedia_attribution.json and
  dzi/regierungsviertel/visual_reference_attribution.json
Package hashes: package-manifest.json
Repository: https://github.com/Klotzkette/isometric-berlin
Viewer: https://klotzkette.github.io/isometric-berlin/
