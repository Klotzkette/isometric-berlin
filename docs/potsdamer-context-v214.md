# WZB and Potsdamer park-side context — v214

Step 10 adds one bounded facade batch beside the Neue Nationalgalerie and
Potsdamer Platz. It does not rebuild the Kulturforum or replace any building.

The retained Geoportal Berlin parents are `DEBE01YYK0002MPZ` (three WZB
extension parts), `DEBE00YYWk0000CB` and `DEBE00YYWk0000CD` (nine parts each
of the two park-side office/atrium blocks). These 21 parts are joined by five
existing street-envelope parts: `4OidR5eD` in `DEBE01YYK0002KuQ`,
`s2favyIL` in `DEBE00YYWk0000Bb`, `DgMokUAL` and `DKGRCr8q` in
`DEBE00YYWk0000Bd`, and the exposed south end of `DEBE01YYK0002KOK`.
The separate CB/CD records are recessed atria; they do not own the main street
facades. Complete original sheets, ground rings, holes and all 26 earlier prism records are retained in
`geo_data/regierungsviertel/potsdamer-context-v214-source.json.gz`.
Each new attachment uses the corresponding part's existing ground datum;
all original packets, source geometry, windows, roofs, court openings, trees,
paths and navigation remain unchanged. There is no suppression hook.

The [WZB architecture account](https://www.wzb.eu/de/das-wzb/geschichte-des-wzb/wzb-architektur)
identifies the Stirling/Wilford extension and its historical building types.
Its [2011 architectural account](https://bibliothek.wzb.eu/artikel/2011/f-17052.pdf)
and inspected free photographs establish the alternating pink/blue appearance.
Only the photographed outer semicircle of `DEBE3DGdYFvyF7Oj` receives shallow
pastel courses and sandstone U-shaped surrounds. The five-level reading is
fitted to the retained height. The other two WZB parts are preserved context;
their facades are not guessed copies of the semicircle. The openings remain
unfilled so previous source detail stays present.

[RSHP's project description](https://rshp.com/assets/uploads/1850_DaimlerChrysler_Office_JS_en.pdf)
documents ceramic cladding, clear/opaque glazing and naturally ventilated atria.
The two existing office envelopes receive restrained ceramic spandrel courses,
paired metal rails and measured wall-end accents. They retain the earlier
panorama palette, generic glazing and both existing atrium rooflights. No new
external stair, curved glass drum, ground-floor closure or duplicate roof is
inferred from the photographs.

All intermediate spacing, member sections, pastel/metal shades and the fitted
window-surround rhythm are visual display estimates, not surveyed facade
coordinates. Original wall polygons bound the WZB/atrium members; the five
street facade owners use the exact decimetre wall planes of their already
drawn source prisms. Their original raw sheets remain separately retained.
No arbitrary outward displacement bridges the atrium-to-street setback.
Neighbouring
source bodies reject hidden members, and new detail starts at least 3 m above
the existing ground to keep approaches free. Minecraft uses independently
quantized orthogonal exterior cells; facade samples may move to the nearest
visible coarse source face within a bounded 4.5 m search, without altering or
removing the original columns.

Four freely licensed photographs were inspected; exact per-file credits are
in `geo_data/regierungsviertel/potsdamer-context-v214-references.json`:

- Coenen, *Berlin-WZB-2007.jpg*, CC BY-SA 3.0.
- Gunnar Klack, *2012-10-09-Wissenschaftszentrum-Berlin-fuer-Sozialforschung.jpg*, CC BY-SA 4.0.
- Dosseman, *Potsdamer Platz Linkstraße Daimler Quartier 9171.jpg* and *9172.jpg*, CC BY-SA 4.0.

The photographs are dated architectural references only. No photo, texture,
proprietary plan, lettering artwork or new network dependency is distributed.

`createPotsdamerContextV214(native = false)` constructs one frozen instanced
batch: 909 drawn members / 69,732 buffer bytes, or 4,853 native members /
369,476 bytes. The street-scope correction preserves all earlier 802 drawn and
3,387 native members exactly. Every drawn device profile receives the same geometry. The root
marker is `potsdamerContextV214`. Source arrays are construction-only; the
renderer retains instance buffers and lightweight owner IDs. The parent
release integrates the model as one cancellable outline construction family.

Focused checks:

```sh
PYTHONPATH=scripts:. uv run python scripts/build_potsdamer_context_v214.py
uv run ruff check scripts/build_potsdamer_context_v214.py tests/test_potsdamer_context_v214.py
uv run pytest tests/test_potsdamer_context_v214.py -q
cd src/app
bun test tests/potsdamer-context-v214.test.ts
```

The five Python tests verify complete source preservation, every drawn member
against its source wall, bounded native placement, exact preservation of the
earlier WZB/atrium members and visible street-plane placement against all
retained source prisms. Two Bun tests verify
one-batch cost, independent ownership/disposal, exact drawn reconstruction and
orthogonal native matrices. Full viewer composition and browser QA belong to
the parent release review.
