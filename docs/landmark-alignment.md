# Landmark Alignment QA

This report checks the committed landmark points against the local OpenStreetMap city-map layer and Berlin LoD2 building geometry.

- Generated: `2026-06-29T10:16:31.923314+00:00`
- Status: `ok`
- Landmarks checked: `13`
- Relative relationships checked: `8`
- Landmark review count: `0`
- Relative review count: `0`
- Review count: `0`

| Landmark | Status | Best OSM evidence | OSM distance | LoD2 evidence |
|---|---:|---|---:|---|
| Brandenburger Tor | `ok` | Brandenburger Tor (pois) | 0.00 m | inside DEBE01YYK0001xqy |
| Reichstagsgebäude | `ok` | Reichstagsgebäude (pois) | 0.00 m | inside DEBE01YYK0002MCN |
| Bundeskanzleramt | `ok` | Bundeskanzleramt (pois) | 0.00 m | inside DEBE01YYK0002KKb |
| Paul-Löbe-Haus | `ok` | Paul-Löbe-Haus (pois) | 0.00 m | inside DEBE01YYK0002Kn7 |
| Marie-Elisabeth-Lüders-Haus | `ok` | Marie-Elisabeth-Lüders-Haus (pois) | 0.00 m | nearest DEBE01YYK00007aT at 17.98 m |
| Berlin Hauptbahnhof | `ok` | Berlin Hauptbahnhof (rail) | 1.66 m | inside DEBE01YYK0002KiE |
| Haus der Kulturen der Welt (Schwangere Auster) | `ok` | Haus der Kulturen der Welt (pois) | 2.92 m | nearest DEBE01YYK0003VNJ at 9.61 m |
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
| Berlin Hauptbahnhof | Bundeskanzleramt | `ok` | west / west | south / south | -30.78 m | -549.10 m |
| Berlin Hauptbahnhof | Marie-Elisabeth-Lüders-Haus | `ok` | east / east | south / south | 539.59 m | -487.45 m |
| Berlin Hauptbahnhof | Reichstagsgebäude | `ok` | east / east | south / south | 438.25 m | -733.18 m |
| Bundeskanzleramt | Marie-Elisabeth-Lüders-Haus | `ok` | east / east | north / north | 570.37 m | 61.65 m |
| Bundeskanzleramt | Reichstagsgebäude | `ok` | east / east | south / south | 469.02 m | -184.08 m |
| Reichstagsgebäude | Brandenburger Tor | `ok` | east / east | south / south | 102.87 m | -260.62 m |
| Brandenburger Tor | Botschaft der Vereinigten Staaten von Amerika | `ok` | east / east | south / south | 29.11 m | -110.45 m |
| Haus der Kulturen der Welt (Schwangere Auster) | Reichstagsgebäude | `ok` | east / east | south / south | 820.20 m | -51.90 m |

Interpretation: `ok` means the landmark is close to an expected named OSM feature within its configured tolerance, or has an explicit LoD2 building fallback where OSM does not carry the required semantic tag. `review` means the point may be on the wrong object and should not be used for rendering without manual correction.
