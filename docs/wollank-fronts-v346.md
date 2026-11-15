# Wollankstraße approach — five measured Rettigweg façades

V346 improves five existing residential fronts on Rettigweg near the eastern
approach to S-Bahnhof Wollankstraße. It preserves the station and its older
details. These are measured building walls with mapped storeys and estimated
window subdivisions, not a claim of photographically surveyed apertures.

| Official owner | Mapped OSM building | Mapped levels | Footprint IoU |
| --- | --- | ---: | ---: |
| `DEBE03YY70003VjD` | way 200947599 | 4 | 0.98645 |
| `DEBE03YY70003W43` | way 294403207, Rettigweg 4 | 5 | 0.99799 |
| `DEBE03YY70003Y3K` | way 294403145 | 4 | 0.99901 |
| `DEBE03YY70003bV1` | way 294403206, Rettigweg 10 | 5 | 0.99800 |
| `DEBE03YY70003dxu` | way 294403208, Rettigweg 6 | 5 | 0.99803 |

The official LoD2 walls are paired with the retained OSM residential polygons
and level tags from `raw/north-city-v190/candidate.gpkg`. A sixth candidate,
`DEBE03YY70003fBu`, fails the 0.97 overlap threshold and receives no new detail.
The source/evidence/receipt files retain the matching criteria and every exact
retired fitting triangle. Existing painted walls, roofs, courtyards, ink and
navigation remain identical.

The finer recessed panes, frames, transoms and storey rhythms replace only
the five owners' exact V230 generic window triangles in companion packet
`outerfacade230-north190-3_-10`. Drawn has 90 window groups / 2,360 triangles;
independent cardinal Native has 43 groups / 1,158 triangles. The windows are
fitted to the actual rendered walls and native wall spans; existing wall
colours are unchanged. Bay positions and material tones remain display
estimates. No photographs or photographic textures are distributed.

The lazy SourceQuarter entry owns both variants through the existing packet
lifetime. Missing, changed or foreign hosts retain their former fittings.
There is no separate permanent façade, new navigation, live-budget change or
reduced touch detail. The main-road V346 compiler excludes these five owners
to avoid duplicate replacement windows. Predecessor generation stops before
this catalogue entry, so later recipes do not contaminate its source guard.

```sh
uv run python -m scripts.build_wollank_fronts_v346 --check
bun test src/app/tests/wollank-fronts-v346.test.ts
```

Tests compare complete old paint and position words, the exact allowed old
window retirement, unchanged ink/navigation, full cardinal Native geometry,
and disabled/foreign/changed-source fallback.
