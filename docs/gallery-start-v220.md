# Neue Nationalgalerie walking arrival and stair support — v1.0.120

Bounded step-10 correction requested by the owner. Ordinary visits now begin
on foot on the northwest pavement of Potsdamer Straße/Reichpietschufer, facing
the Neue Nationalgalerie. Day remains preselected in the existing mode chooser.
Explicit mode links start their selected mode; explicit landmark links retain
their selected place. Later mode changes and recovered navigation preserve the
visitor's pose. No tour stop, district, texture or residency allowance is added.

## Arrival evidence

The point is interpolated 15% along retained OSM footway `way/1150243117`
from `[-249.47357766272034,1383.4080051649362]` to
`[-276.8497492031893,1382.744646041654]` in the existing XZ frame.
It lies 1.1127 m inside the delivered paving polygon and at least 5.2955 m
from every delivered asphalt surface. Retained ground height is Y5.2; standing
eye height is Y7.0. The chosen view faces the existing south entrance at local
`[0,25.2]`. The heading is a presentation choice, not a surveyed camera.

The arrival is seeded before world construction. Existing core geometry and
the single original gallery/exhibition owner are attached before the startup
curtain opens. The existing outline construction remains serial and cancellable;
there is no duplicate temporary museum. A retained navigation snapshot takes
precedence during mobile mode-family remounts or recovery.

## Floating support correction

The retained terrace already runs from Y5.2 to Y9.8; the interior floor is
Y9.82. Ground sampling at all 66 terrace-edge checkpoints and the approach
confirms Y5.2. Lowering the pavilion would therefore introduce a new error.

The actual gap was beneath the 22 authored stair treads: each was only 0.21 m
thick, leaving higher treads suspended. Their existing solids now extend to
source ground while keeping every tread top and XZ boundary. The explicit
walking collision previously returned false below the hall floor; it now
covers the exact podium polygon and supported stairs, with capsule clearance.
The source terrace recess, stair ascent/descent and all four doors remain open
where represented.

Only existing stair-instance vertical centres and heights change. Source
packets, measured terrace/pavilion geometry, materials, exhibition objects and
all other city details remain retained. Drawn mobile/desktop detail is equal;
Minecraft keeps its independent block representation. See the independent
[preservation receipt](gallery-v220-snapshots.md).

## Validation

Focused tests use shipped ground/source obstacles, ray-check every tread and
its support in both representations, and walk full capsules up/down the stairs
and through the doors in all six modes. Startup tests verify mapped pavement,
carriageway clearance, actual standing height and all 93 explicit landmark
links. Production build and browser checks are recorded below before release.

Release validation on 2026-10-16:

- Production TypeScript/Vite build passed; local package smoke passed at
  version 1.0.120.
- Python main suite: 1,219 passed, four skipped (the separately executed
  release/package suite passed all 84 tests after packaging, including four
  mutation checks for the earlier failure callback). Ruff format/check passed.
- Focused startup/navigation/mode tests: 33 passed, 2,320 assertions;
  gallery/support/exhibition tests: 16 passed, 290,866 assertions;
  outline construction/preservation checks: five passed, 70 assertions.
- Chromium desktop and WebKit iPhone-13 emulation both verified the exact
  grounded opening pose, one gallery/exhibition owner at first presentation,
  held-input podium blocking, stair ascent through the glass entrance and
  preserved walking position in all six modes. No browser errors occurred.
  Local cold opening took 8.39 s and 13.72 s respectively; these are local
  measurements, not network or physical-device performance guarantees.
- Initial failure reporting is installed before required gallery construction,
  so an outline-loading failure can use the existing recovery path instead of
  leaving the opening curtain indefinitely visible.

The repeatable browser check is `scripts/smoke_gallery_start_v220.py`.
Physical phones/tablets were not available for this verification.
