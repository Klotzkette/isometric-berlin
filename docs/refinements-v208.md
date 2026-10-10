# Friedrichstraße and western Linden facades — v1.0.108 / Step 10 v208

Bounded architectural refinement of the existing city, without district expansion
or changes to navigation, quality settings, resident budgets or the 93-stop tour.
All new runtime geometry is texture-free and instanced; mobile uses the same
drawn geometry as desktop. Native Minecraft has separately fitted orthogonal
models, checked against the complete retained source envelopes.

- Hungarian Embassy: corrected slanted source walls, complete measured roof and
  walls, revised window/roof bands and entrances. Its six exact coarse proxies
  yield to complete measured sheets during the required city transaction.
- ARD Hauptstadtstudio: finer precast/glass articulation. Dussmann's recognizable
  red panels, west streetfront glazing and lettering now face Friedrichstraße;
  earlier rear details and all neighboring source buildings remain.
- Helene-Weber-Haus and Neustädtische Kirchstraße 15: bounded frontage detail.
- Russian Embassy: stone courses, reveals and column detail on retained source
  bodies; existing main front, lantern, sculpture and fence remain.
- Aeroflot / former trade mission: twelve window axes over four floors, concrete
  grid and separate roof lettering replace the inaccurate eight-axis recipe.
- BMAS: distinguish its historical campus buildings and modern extensions.
- Quartier 206: pale stone bands, folded bays and deeper entrances replace its
  generic authored facade while all measured shell parts remain.

Facade aperture coordinates, colours and subdivisions are reference-guided
interpretations, not measured window surveys. Source walls and roofs remain
separately traceable. The Aeroflot name denotes the photographed architectural
identity, not a claim of current airline activity.

See [northern corridor](north-corridor-v208.md),
[Russian Embassy and Aeroflot](embassies-v208.md), and
[BMAS / Quartier 206](labour-quartier-v208.md) for evidence and allocation budgets.

## Independent preservation

Immutable v1.0.107 commit `edcde0e7d05552d1e8900c9c87e1da9b40e02f76`
provides complete geometry/material/transform receipts. The frontage audit loads
its original constructors directly through `git show`; independently removing
only the exact named recipes yields the expected complement. Tests compare all
remaining live bytes, plus default constructors, six Hungarian source owners,
and same-location foreign-ID controls. Historical fixtures stay unchanged.

The v208 outline audit first reproduces the complete frozen v207 signature.
A separate preservation test excludes only the three new v208 families and
checks every earlier outline node, attribute and instance against that signature.
The v207 preservation test continues to verify the full v206 complement too.

## Verification

The complete extracted package measures 869,345,199 bytes (829.07 MiB), about
0.58 MiB above v107. The archive-only release ceiling is now 830 MiB, leaving
0.93 MiB of finite headroom for these named additions. Live resident, per-packet,
GPU and mobile budgets are unchanged. No source detail is removed to fit an
archive size target.

- Full Python run: 1,208 passed, four skipped; the eleven newly collected
  model/source tests also pass. After packaging, all 76 release tests pass.
- Full Bun run: 3,163 tests passed initially. Its 45 failures were confined to
  the two expected Minecraft geometry snapshots and the lifecycle fixture's
  missing required-envelope import. The lifecycle fixture is updated and all
  45 lifecycle checks pass, including two new cancellation/import-failure tests.
  The Minecraft snapshot has a separate immutable v107 counterfactual; see
  [native-world-v208-audit.md](native-world-v208-audit.md),
  `minecraft-world-v208-baseline-audit.json` and its synchronous v208 fixture.
  All seven final Minecraft construction checks pass; all initial failures
  are resolved by these focused reruns without changing historical fixtures.
- Chrome and WebKit in the iPhone 13 viewport completed all six visual modes
  and actual night-light on/off controls, without JavaScript errors or WebGL
  context loss. Integrated drawn/native screenshots were inspected for the
  named fronts. No physical iPhone hardware test is claimed.
- TypeScript/Vite, Ruff, local package smoke and release readiness pass.
- Independent review confirms that Hungarian source sheets are required before
  presentation and excluded from the optional facade family: no missing or
  duplicate replacement envelope, including after cancelled construction.
