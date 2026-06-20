# Landmark Alignment QA

This report checks the committed landmark points against the local OpenStreetMap city-map layer and Berlin LoD2 building geometry.

The same evidence is also rendered as a top-down reference image in
[`src/app/public/dzi/regierungsviertel/reference_map.png`](../src/app/public/dzi/regierungsviertel/reference_map.png).

- Generated: `2026-06-20T11:45:57.271492+00:00`
- Status: `ok`
- Landmarks checked: `13`
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

Interpretation: `ok` means the landmark is close to an expected named OSM feature within its configured tolerance, or has an explicit LoD2 building fallback where OSM does not carry the required semantic tag. `review` means the point may be on the wrong object and should not be used for rendering without manual correction.
