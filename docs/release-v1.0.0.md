# v1.0.0 release verification — step 10

This release combines the source-backed building detail, Minecraft tree
selection, Schwellenraum atmosphere, Siegessäule, Reichstag, Brandenburg Gate,
Hauptbahnhof access and mobile joystick changes. Version metadata is shared
by the frontend, Python package and deterministic archive packager.

## Validation

- `uv run ruff format .` and `uv run ruff check .`: clean.
- `uv run pytest`: 348 passed.
- `bun run build`: TypeScript and production build passed.
- `bun run test`: 1,405 tests across 174 files; 1,402 passed in the full run.
  Two station tests observed an intermediate atrium fix during that run and
  one dome assertion still named the former mirror grid. After correction,
  all 42 tests across the five affected station, Gate, Minecraft navigation,
  dome and visual-mode files passed; no unresolved test failures remain.
- `package_static_site.py`, `check_release_readiness.py` and
  `smoke_local_package.py`: passed for v1.0.0.
- Browser inspection covered Day, Night, Minecraft, Snowstorm and Schwellenraum,
  the revised heroes and the 390 × 844 walking layout. No browser runtime
  errors or warnings were reported. Touch/pen gesture recognition is covered
  by automated tests; a physical phone was not used.

The release candidate review corrected coplanar station floor overlap, a
Schwellenraum gallery drop and canonical terrain support across the drawn
atrium. Regression routes exercise both entrances, inbound and outbound,
in every mode with full and partial analog input. The final Minecraft
appearance hashes are independently measured from synchronous construction
and compared with cooperative construction by the test suite.

| Minecraft profile | Instances | Renderables | Retained buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 3,568,825 | 50 | 272,432,344 | `80eb24802b341daca13a7622cbebef8b5ebab15855e01c719fa6dac00309cf70` |
| Mobile | 809,716 | 48 | 62,173,032 | `2fe637c00b98142e44e6990311d0ed1fcc87d237b091e83ebed0621326d7489a` |

The v1.0.0 tag and download archives identify the release. The hosted build
uses the same production output and retains older hashed assets for already
open tabs, as required by [deployment policy](deployment.md).

See [hero evidence](reichstag-gate-refinement.md),
[station access and limits](hauptbahnhof-pedestrian-access.md),
[building evidence](building-attribute-detail.md) and
[mobile gestures](mobile-joystick-jump.md) for detailed scope and checks.
