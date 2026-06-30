# Landmark Alignment QA

This report checks the committed landmark points against the local OpenStreetMap city-map layer and Berlin LoD2 building geometry.

- Generated: `2026-06-30T08:44:44.980512+00:00`
- Status: `ok`
- Landmarks checked: `26`
- Relative relationships checked: `19`
- Landmark review count: `0`
- Relative review count: `0`
- Review count: `0`

| Landmark | Status | Best OSM evidence | OSM distance | LoD2 evidence |
|---|---:|---|---:|---|
| Brandenburger Tor | `ok` | Brandenburger Tor (pois) | 0.00 m | inside DEBE01YYK0001xqy |
| Pariser Platz | `ok` | Pariser Platz (roads) | 0.00 m | nearest DEBE01YYK0001x9i at 58.52 m |
| Denkmal für die ermordeten Juden Europas | `ok` | Denkmal für die ermordeten Juden Europas (pois) | 0.00 m | inside DEBE00YYGu00005X |
| Denkmal für die im Nationalsozialismus verfolgten Homosexuellen | `ok` | Denkmal für die im Nationalsozialismus verfolgten Homosexuellen (pois) | 0.00 m | inside DEBE01AL3Ib00000 |
| Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas | `ok` | Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas (pois) | 0.00 m | inside DEBE01YYK0002KL4 |
| Reichstagsgebäude | `ok` | Reichstagsgebäude (pois) | 0.00 m | inside DEBE01YYK0002MCN |
| Sowjetisches Ehrenmal Tiergarten | `ok` | Sowjetisches Ehrenmal Tiergarten (pois) | 0.00 m | inside DEBE01YYK0003Trf |
| Bundeskanzleramt | `ok` | Bundeskanzleramt (pois) | 0.00 m | inside DEBE01YYK0002KKb |
| Paul-Löbe-Haus | `ok` | Paul-Löbe-Haus (pois) | 0.00 m | inside DEBE01YYK0002Kn7 |
| Marie-Elisabeth-Lüders-Haus | `ok` | Marie-Elisabeth-Lüders-Haus (pois) | 0.00 m | nearest DEBE01YYK00007aT at 17.98 m |
| Berlin Hauptbahnhof | `ok` | Berlin Hauptbahnhof (rail) | 1.66 m | inside DEBE01YYK0002KiE |
| Humboldthafen | `ok` | Humboldthafen (water) | 0.00 m | nearest DEBE01YYK0003VCM at 46.94 m |
| Hugo-Preuß-Brücke | `ok` | Hugo-Preuß-Brücke (roads) | 0.00 m | nearest DEBE01YYK00003Qp at 39.42 m |
| Rahel-Hirsch-Straße | `ok` | Rahel-Hirsch-Straße (roads) | 0.00 m | nearest DEBE01AL4aE0000U at 34.08 m |
| Moltkebrücke | `ok` | Moltkebrücke (roads) | 0.00 m | nearest DEBE00YYQV00005V at 41.2 m |
| Haus der Kulturen der Welt (Schwangere Auster) | `ok` | Haus der Kulturen der Welt (pois) | 2.92 m | nearest DEBE01YYK0003VNJ at 9.61 m |
| Großer Tiergarten | `ok` | Großer Tiergarten (parks) | 0.00 m | nearest DEBE00YYT600005H at 73.3 m |
| Beethoven-Haydn-Mozart-Denkmal | `ok` | Beethoven-Haydn-Mozart-Denkmal (pois) | 0.00 m | nearest DEBE00YYT600005H at 54.64 m |
| Goethe-Denkmal | `ok` | Johann Wolfgang von Goethe (pois) | 0.00 m | nearest DEBE01AL3Ib00000 at 60.79 m |
| Kemperplatz / Tiergartentunnel | `ok` | Tunnel Tiergarten Spreebogen (roads) | 0.00 m | nearest DEBE01YYK0002MgI at 27.98 m |
| Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz) | `ok` | Das Center am Potsdamer Platz (pois) | 0.00 m | nearest DEBE01YYK0002Kau at 0.37 m |
| Max-Liebermann-Haus | `ok` | Max-Liebermann-Haus (pois) | 0.00 m | inside DEBE01YYK0000765 |
| Botschaft der Vereinigten Staaten von Amerika | `ok` | Botschaft der Vereinigten Staaten von Amerika (pois) | 0.00 m | inside DEBE01YYK00000k5 |
| Zollpackhof | `ok` | Zollpackhof (pois) | 0.00 m | inside DEBE01YYK0002Tak |
| Gustav-Heinemann-Brücke | `ok` | Gustav-Heinemann-Brücke (roads) | 0.00 m | nearest DEBE01YYK0002NAU at 110.35 m |
| Spreebogen | `ok` | Spreebogenpark (parks) | 55.36 m | nearest DEBE01YYK0002N6A at 0.92 m |

## Relative Placement

These checks compare landmark-to-landmark relationships in EPSG:25833 metres. They are meant to catch left/right and north/south swaps that can be hard to see in an isometric view.

| From | To | Status | East/West | North/South | Delta E | Delta N |
|---|---|---:|---|---|---:|---:|
| Berlin Hauptbahnhof | Hugo-Preuß-Brücke | `ok` | east / east | south / south | 180.53 m | -175.64 m |
| Berlin Hauptbahnhof | Rahel-Hirsch-Straße | `ok` | east / east | south / south | 9.07 m | -220.82 m |
| Berlin Hauptbahnhof | Moltkebrücke | `ok` | west / west | south / south | -84.08 m | -325.64 m |
| Berlin Hauptbahnhof | Bundeskanzleramt | `ok` | west / west | south / south | -30.78 m | -549.10 m |
| Berlin Hauptbahnhof | Marie-Elisabeth-Lüders-Haus | `ok` | east / east | south / south | 539.59 m | -487.45 m |
| Berlin Hauptbahnhof | Reichstagsgebäude | `ok` | east / east | south / south | 438.25 m | -733.18 m |
| Bundeskanzleramt | Marie-Elisabeth-Lüders-Haus | `ok` | east / east | north / north | 570.37 m | 61.65 m |
| Bundeskanzleramt | Reichstagsgebäude | `ok` | east / east | south / south | 469.02 m | -184.08 m |
| Reichstagsgebäude | Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas | `ok` | west / west | south / south | -7.33 m | -146.40 m |
| Reichstagsgebäude | Brandenburger Tor | `ok` | east / east | south / south | 102.87 m | -260.62 m |
| Brandenburger Tor | Pariser Platz | `ok` | east / east | north / north | 79.15 m | 7.60 m |
| Brandenburger Tor | Botschaft der Vereinigten Staaten von Amerika | `ok` | east / east | south / south | 29.11 m | -110.45 m |
| Brandenburger Tor | Denkmal für die ermordeten Juden Europas | `ok` | east / east | south / south | 44.98 m | -256.91 m |
| Brandenburger Tor | Denkmal für die im Nationalsozialismus verfolgten Homosexuellen | `ok` | west / west | south / south | -113.74 m | -333.61 m |
| Brandenburger Tor | Sowjetisches Ehrenmal Tiergarten | `ok` | west / west | north / north | -391.32 m | 55.12 m |
| Haus der Kulturen der Welt (Schwangere Auster) | Reichstagsgebäude | `ok` | east / east | south / south | 820.20 m | -51.90 m |
| Großer Tiergarten | Beethoven-Haydn-Mozart-Denkmal | `ok` | west / west | north / north | -92.01 m | 21.25 m |
| Großer Tiergarten | Goethe-Denkmal | `ok` | east / east | north / north | 317.81 m | 17.89 m |
| Kemperplatz / Tiergartentunnel | Tiergartentunnel Südeingang (Sony Center / Potsdamer Platz) | `ok` | east / east | south / south | 203.27 m | -175.89 m |

Interpretation: `ok` means the landmark is close to an expected named OSM feature within its configured tolerance, or has an explicit LoD2 building fallback where OSM does not carry the required semantic tag. `review` means the point may be on the wrong object and should not be used for rendering without manual correction.
