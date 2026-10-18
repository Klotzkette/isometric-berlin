# Step 10 — named northern/western sites and outer housing (v1.0.130)

The owner-requested places are refined with retained official LoD2 and OSM evidence. Existing source assets, the 93-stop tour, full mobile detail and runtime residency limits remain unchanged. New coverage is finite and subtracts all retained geometry; no blanket borough rebuild is performed.

## Residential pass

`build_outer_facades_v230.py` adds 3,563 previously unadorned source street fronts across 90 spatially distributed existing outer/east/north tiles, using 34,348 drawn and 12,263 native window hints. Complete original wall triangles must match; clipped seams, named/special buildings, material-tagged owners, prior authored landmarks and previous façade passes are excluded. New packets total 1.31 MiB compressed across both families. Existing generic roof colours and these new panes get restrained original palette variation without extra geometry or textures. Window counts, rhythms and colours are illustrative; no exact façade survey is claimed.

Two new housing clusters follow the mapped Marzahner Promenade and Helene-Weigel-Platz axes with a 190 m display margin, expanded to complete intersecting building footprints. This is a finite display scope, not a district boundary. Retained streamed/core coverage and the existing Rathaus Marzahn are subtracted. Official parent vertical envelopes and actual footprints control the new housing; roofs retain the established outline approximation and local terrain uses the documented flat display datum. Window hints require both original wall triangles and never decorate artificial tile seams.

Sources: [Berlin’s Marzahn housing study](https://www.berlin.de/sen/stadtentwicklung/_assets/quartiersentwicklung/programme/staerkung-berliner-grosssiedlungen/untersuchung_grosssiedlungen_einzelprofil_marzahn.pdf) and [Marzahn-Süd renewal area](https://www.berlin.de/sen/stadtentwicklung/quartiersentwicklung/staedtebaufoerderung/nachhaltige-erneuerung/foerdergebiet-marzahn-sued-1647537.php). OSM data © OpenStreetMap contributors, ODbL; Berlin LoD2 © Geoportal Berlin, dl-de/zero-2-0. No photographs are copied into the viewer.

## Named sites

See [Eiswerder/Reuter-West/Westhafen](west-industrial-v230.md), [Spandau/botanical park](spandau-botanical-v230.md) and [the central named buildings](central-named-v230.md), with the accompanying v230 source receipts. Exact replacements transfer only replayed original owner triangles and navigation rows to complete required shells. Native construction remains independently orthogonal.

## Validation

- TypeScript and the production build pass. Release readiness passes; the complete offline directory is 883,850,250 bytes (842.91 MiB). The offline packaging ceiling was adjusted to 844 MiB; live residency, resolution, detail and draw-distance budgets were not increased.
- 238 relevant Bun tests pass (154,162 assertions), including navigation, recovery, continuity and the new sites. Existing and new residential colour tests also pass (19 tests, 790 assertions).
- The production viewer passed 39 views on desktop Chromium and 39 on an iPhone 13 WebKit profile across all six modes, without a page error, crash or context loss. Two additional deliberately triggered mobile graphics-context losses restored the same scene and camera successfully.
- Fresh local normal-mode starts passed on desktop and mobile: flight remains the default, the minimap/HUD stays hidden during loading, and the gentle walking transition and return to flight work. Observed local starts were 9.56 s and 15.01 s; these are local test observations, not network or physical-device guarantees.
- The initial complete Python run recorded 1,343 passes and 4 skips; 20 failures and 7 setup errors exposed historical manifest assertions that needed to recognize the new finite additions, plus version checks run during the version update. After a strict v230 audit was added, all 18 affected/new test files were rerun: 133 passed, with one JSON-key-order replay failure. Correcting that test reconstruction preserved the original evidence bytes; all four tests in that file then passed separately. Thus all 134 affected tests pass on the final code, including 17 mutation-rejection controls. The audit binds exactly 107 new packets to the immutable v1.0.129 manifest and verifies all 3,810 retained payloads; no prefix-only exemption is used. Ruff formatting/checks pass across 600 Python files.
