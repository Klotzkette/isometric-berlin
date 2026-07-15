# Task 08 — Correct the Carillon anchor in the source data

**Pipeline step:** data QA (steps 1/6/8; see `AGENTS.md` §5)
**Status:** todo
**Owner-set scope (2026-06-14):** The committed Carillon landmark
coordinate (13.366678, 52.517564) comes from Wikimedia geotags — i.e.
photographer standpoints — and sits **29.4 m south-west** of the real
tower. The viewer's recognition layer is already fixed against the
mesh-verified position (see `CulturalLandmarks.ts`,
`CARILLON_MESH_TOWER_WORLD`), but the source data still carries the
wrong point.

## Verified position

Decoded from official mesh tile `tile-3890_58196.glb` (roof plate
centre): world (-307.06, 118.51) = EPSG:25833 (389192.9, 5819881.5) =
**52.51776 N, 13.36696 E**.

## Acceptance criteria

- [ ] `geo_data/regierungsviertel/landmarks.geojson`: Carillon point
      moved to 13.36696, 52.51776 with a `source` note referencing the
      mesh-tile evidence.
- [ ] Alignment/precision artefacts regenerated
      (`verify_landmark_alignment`, `verify_metric_precision`,
      `render_reference_map`), plus the app landmark JSONs via the
      byte-equality procedure documented in task 05/agent notes.
- [ ] `src/app/public/mesh/regierungsviertel/scene.json` landmark
      anchor regenerated (requires the `prepare_webgl_mesh` inputs) —
      do NOT hand-edit the generated manifest.
- [ ] `CulturalLandmarks.ts` simplification: once the payload anchor is
      correct, the hardcoded `CARILLON_MESH_TOWER_WORLD` override can
      read from the payload again (keep the regression test).
- [ ] All checks: ruff/pytest, `bun test`, `bun run build`,
      `scripts/check_release_readiness.py`.
