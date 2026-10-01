# DKB Campus Upbeat — v1.0.66

Step 10 refines the existing DKB Campus Upbeat model and its existing native
counterpart. It does not create a second campus. OSM way `1214009386`, all 61
footprint vertices, the DGM1 datum of y=2.92 m, the published 82 m height, the
5/11/19-storey tiers and their previous clip lines remain unchanged.

[CA Immo's 5 August 2026 announcement](https://www.caimmo.com/de/presse/news/artikel/ca-immo-schliesst-berliner-projektentwicklung-upbeat-ab-und-uebergibt-gebaeude-an-die-dkb/)
confirms building completion and handover to DKB. It announces headquarters
opening on 13 October 2026; the model does not describe that future event as
already completed. The former March 2026 scheduled-handover statement is
replaced. [Kleihues + Kleihues](https://kleihues.com/news-aktuell/upbeat-fertigstellung-der-fassade/)
describes anodised aluminium with fine fluting and a slender facade grid.

The added source-bound detail consists of paired fine aluminium relief,
darker panels at the tops of the windows, slender rails on exposed lower
roof terraces and four entrance-frame uprights. Member sizes and individual
subdivisions remain estimates; no facade plan or photograph is traced.
The original three building tiers, grid, glazing, planted strips and canopy
remain present. The independent native model keeps all original blocks,
adds orthogonal exterior accents in its existing one-batch owner and uses
a restrained blue-grey glass palette from the inspected references.

Two July 2026 photographs by **NutzerAusBerlin**, both **CC0**, were inspected:

- [Berlin 20260711 Upbeat 01.jpg](https://commons.wikimedia.org/wiki/File:Berlin_20260711_Upbeat_01.jpg)
- [Berlin 20260711 Upbeat 02.jpg](https://commons.wikimedia.org/wiki/File:Berlin_20260711_Upbeat_02.jpg)

They guide dark spandrels, fine pale metal and the curved floor grid. They
remain external visual references; no pixels, crop, font or texture are
bundled. Credits are retained in `upbeatV166Evidence.json` and
`/tmp/upbeat-v166-attribution.json` for centralized release integration.

The drawn helper is one instanced batch with 3,850 details and **293,248
geometry-and-instance bytes**. The original native batch receives 5,348
independent accent blocks. The focused tests retain source outline, height and tiers, verify
finite exterior data and positive sizes, and keep every accent below the
unchanged highest roof. The three focused tests pass with 27,614 assertions.
All drawn detail is identical on pointer and touch devices.

```sh
cd src/app
bun test tests/upbeat-v166.test.ts
```
