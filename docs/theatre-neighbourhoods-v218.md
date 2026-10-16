# Theatre neighbourhoods — v1.0.118

This bounded step-10 pass improves existing street fronts around Berliner
Ensemble, Deutsches Theater, Heinrich-Böll-Stiftung and Friedrichstadt-Palast.
It is a local architectural recognition pass, not a survey of every window.
No coverage, navigation, terrain, street, courtyard, source envelope, roof,
tour stop or texture is added or removed. Existing city residency budgets stay
unchanged.

## Visible changes

- Schiffbauerdamm 5–8/12: differing shop fronts, cornices and stucco fields.
  Albrechtstraße 13–14 has its photographed brick fields and triangular window
  hoods. The Neues Haus court front gains its golden modular screen, glazed
  entrance and name. See [exact owners and references](ensemble-neighbours-v218.md).
- Reinhardtstraße 19: ten aligned upper window axes, two-leaf entrance,
  segmental lintel and restrained base joints. Schumannstraße 19 gains corner
  glazing, metal frames and balcony handrails. See [four exact wall edges](luisen-corridor-v218.md).
- Kalkscheune beside the Palast: the low corner reads as two storeys with
  three west-facing axes, segmental heads, divided attic window and
  KALKSCHEUNE lettering; the factory wings have taller three-row, subdivided
  glazing. The underlying five measured parts and all 81 source surfaces
  remain in their original resident packets.

## Kalkscheune evidence and preservation

The [Landesdenkmalamt record 09035269](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09035269)
identifies Johannisstraße 2 / Kalkscheunenstraße 4–5 and distinguishes the
1831 two-storey corner from later two-/three-storey factory wings. Its Geoportal
marker binds the front owner directly. The retained source is
`alt-mitte-v169/source-390_5820-00.json.gz`, SHA-256
`9fa54afca59d3da88d00e8a5bbe2a862c58c50425d62a861d84d0c9fe61441fd`.

The wall-anchor generator reads only that immutable source. Four shared walls
against taller neighbours are explicitly excluded, and the 14 remaining
wall anchors preserve source coordinates. Measured corner eave/ground are
13.65/4.7 m; the taller eastern continuation retains 18.462/4.7 m. No height is
inferred from a generic OSM level count. Window sizes, spacing, colours and
sign proportions remain photographic display estimates.

Visual references, viewed for architectural recognition only:

- [Ansgar Koreng, Berlin Kalkscheune, 3 October 2014](https://commons.wikimedia.org/wiki/File:Berlin_Kalkscheune.jpg),
  [CC BY-SA 3.0 DE](https://creativecommons.org/licenses/by-sa/3.0/de/): corner
  plaster, two storeys, three bays, entrance, sign and half-hip gable window.
- [Jörg Zägel, Kalkscheunenstraße 4–5, 12 April 2010](https://commons.wikimedia.org/wiki/File:Berlin,_Mitte,_Kalkscheunenstrasse_4-5,_Clubhouse_Hostel_Berlin.jpg),
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/): three-row
  factory fenestration, small divided panes, pale roughcast and stone sills.

Both public attribution manifests and NOTICE retain credits. No photographs,
legacy shop advertisements or textures are bundled.

Exactly 1,458 earlier estimated drawn facade triangles yield to the new
recognition layer through fingerprint-guarded original triangle receipts.
No source wall, roof, ink, native shell or unrelated window is removed.
See [transfer proof](kalkscheune-ownership-v218.md).

Kalkscheune uses one instanced batch, 2,086 drawn instances or 7,803 orthogonal
native instances, about 159/594 KB including instance buffers. No per-frame
work, texture or unbounded cache is added. The native layer follows the
existing 2 m block envelope with small source-facing plaster strips over its
baked generic window colours; the original native cells remain intact.
Pointer/touch use identical detail for the new Kalkscheune and Luisen work.

## Validation

Focused source/ownership, facade and retained-geometry regressions cover
three replacement families, exact party-wall exclusions, lower corner rows,
attic and entrance, full mobile detail, native orthogonal construction and
existing facade budgets. Browser captures use the existing user controls and
runtime probe. Emulated WebKit/iPhone testing does not replace an endurance
run on physical iPhone/iPad hardware.


Completed release checks:

- Python: 1,218 passed / 4 skipped in the main collection, 80 smoke/release
  checks passed, and the new exact-ownership Python test passed separately.
- TypeScript/Vite production build, Ruff format/check, release-readiness and
  the complete local-package smoke check passed.
- Chromium desktop: 24 settled views across four neighbourhoods and all six
  modes. WebKit 1.63 / iPhone 13 emulation: 12 settled views across two sites
  and all six modes. Both runs recorded no page errors, context loss or mode
  pose discontinuity. Day and native screenshots were inspected.
- The broad Bun process ended with exit 137 before completing (1,911 passing
  tests recorded, 19 failing historical comparisons).
  This is not reported as a full-suite pass. Changed facade snapshots and
  older tests affected by already-released v214–v217 changes were checked
  against their immutable historical/current source baselines and rerun in
  focused processes. Historical fixture files remain unchanged.
- The exact v117-to-v118 world receipt changes only four existing facade
  meshes plus the new Kalkscheune batch: +8,407 world instances, +639,580
  bytes and one draw. Its unaffected 353/351 full/mobile world objects remain
  byte-identical. The separate core-context receipt is retained alongside it.
