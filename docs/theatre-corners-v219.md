# Theatre neighbourhood corners — v1.0.119

A bounded step-10 continuation of v1.0.118, correcting two exact exterior
edges. No new district, tour stop, runtime texture, animation or residency
budget. All measured source bodies, roof surfaces, holes, road and terrain
geometry remain unchanged. Other authored facade details are byte-identical.

## Albrechtstraße 12 / Schiffbauerdamm

The [Berlin heritage record 09095847](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09095847)
identifies the 1896 corner house. Its existing profile key `schiff11` is retained
for compatibility; it does not assert a Schiffbauerdamm 11 street address.

Only the southeast chamfer of source `adrXN9LM`, from `[930.5,-212.4]` to
`[924.2,-206.8]`, changes its estimated detail recipe. The
[photograph by Kvikk, 30 April 2012](https://commons.wikimedia.org/wiki/File:Berlin-Mitte_Albrechtstra%C3%9Fe_12.JPG),
[CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), shows a pale
plain projecting corner with two broad divided window axes, fanlights and one
upper terrace. It does not show the former repeated individual balconies and
ornamental hoods. Those incorrect fittings yield only on this precise face.
The new thin piers, spandrels, frames, sills and terrace parapet read this
photographed structure without changing the measured roof or source envelope.

This is a recognition model from dated visual evidence, not a contemporary
survey. Window dimensions, projection depth, storey spacing and material tones
are display estimates. No restaurant advertisements or copied photographic
textures are included. The photograph is credited in both bundled source
manifests and NOTICE.

## Luisenstraße 39 / Mori-Ôgai-Gedenkstätte

One source-owned west corner changes from incorrectly repeated generic windows
to its blank lower field and two striped upper brick fields. Exact edge, party
wall check, source identity and already credited reference are recorded in
[luisen-corridor-v219.md](luisen-corridor-v219.md).

## Preservation and performance

Both dedicated regression suites freeze complete ordered pre-change plans
outside the selected edges. Drawn touch and desktop detail remains identical;
the new corner detail also has an orthogonal native interpretation. Existing
source-shell visibility and native-cell clearance checks remain active.

The independent immutable-v118 world comparison changes only four existing
facade batches, with +56 native instances / +4,256 bytes and no extra draw
calls. Drawn facade additions total +43 instances / +3,268 bytes. No geometry
packet is rewritten or reduced. See the [v219 snapshot receipt](theatre-neighbourhoods-v219-snapshots.md) for exact
unaffected-object hashes and mode-specific checks.

## Validation

- TypeScript/Vite production build and Ruff format/check pass.
- The four current static/world/core regression files pass independently:
  103 tests / 574 assertions. Dedicated exact-edge preservation, source-shell
  visibility and native-cell clearance tests also pass. One source-ownership
  test exceeded its default five-second limit under concurrent load; its full
  file passed with a 30-second limit, without changing runtime or assertions.
- Chromium desktop and WebKit 1.63 / iPhone 13 emulation each pass 12 settled
  views (two corners, all six modes), with no page errors, context loss or mode
  pose discontinuity. Day and native captures were visually inspected.
- Python main collection: 1,219 passed / 4 skipped (two existing warnings).
  All 80 separately run smoke/release checks and the complete local-package
  HTTP smoke pass.

Browser emulation does not establish long-duration stability on a physical
iPhone or iPad. The full Bun suite was not rerun; changed facade families and
the complete current world receipts were checked in separate bounded processes.

An additional WebKit close-up initially placed the camera inside an unchanged
opposite native building; the QA camera was moved into a clear higher street
view. During its first Day-to-Minecraft rerun, the WebKit Development content
process terminated with SIGSEGV in JavaScriptCore string interning
(`WTF::equalInternal`, `JSC::JSRopeString::resolveRopeToAtomString`). This was
a browser-process crash, not an application exception or a demonstrated cause
in the new facade code. After the concurrent Python suite completed, the same
unchanged build and same two-mode close-up passed, with no page errors or
context loss; both resulting facades were inspected. The isolated crash is
recorded rather than counted as a pass, and no universal stability claim is made.
