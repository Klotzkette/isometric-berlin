# Glossary

| Term | Meaning |
| --- | --- |
| **MVP** | This repo's v0.1 milestone: Berlin Regierungsviertel only. |
| **Regierungsviertel** | Berlin's Government Quarter — area in `geo_data/regierungsviertel/bounds.geojson`. |
| **LoD2** | "Level of Detail 2" — building footprints extruded with differentiated roof shapes. Source for our 3D geometry. |
| **CityGML** | OGC standard for 3D city models. Native format for Berlin's LoD2 data. |
| **Quadrant** | One 512×512 px isometric tile cell in our generation grid. Matches the NYC project's terminology. |
| **Render** | The orthographic / isometric 3D image of a quadrant produced from LoD2 + OSM context, used as input to the AI model. |
| **Generation** | The AI-generated pixel-art image for a quadrant — the actual visible tile. |
| **Hero tile** | A quadrant containing a landmark (Reichstag dome, Hauptbahnhof glass roof) that may need manual touch-up beyond what the model produces. |
| **DZI** | "Deep Zoom Image" — OpenSeadragon's pyramidal tile format. Our final viewer output. |
| **dl-de/zero-2-0** | Datenlizenz Deutschland – Zero – Version 2.0. The license of Berlin's LoD2 data. Effectively public domain. |
| **ODbL** | Open Database License 1.0. The license of OpenStreetMap. Requires attribution; share-alike for derivative *databases*, not for rendered *Produced Works*. |
| **Schwangere Auster** | Colloquial name for Haus der Kulturen der Welt (Congress Hall) with its distinctive curved roof. Required landmark. |
| **Band des Bundes** | The federal strip of buildings across the Spree: Bundeskanzleramt, Paul-Löbe-Haus, Marie-Elisabeth-Lüders-Haus. All required landmarks. |
