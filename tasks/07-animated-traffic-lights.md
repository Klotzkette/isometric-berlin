# Task 07 — Animated traffic lights

**Pipeline step:** viewer detail layer (step 8; see `AGENTS.md` §5)
**Status:** todo
**Owner-set scope (2026-06-14):** Show the real traffic lights inside
the bounds as small recognisable models whose signal heads animate
through the German phase sequence red → red+amber → green → amber →
red on a slow loop.

## Approach

- Source positions from OSM: `highway=traffic_signals` nodes are
  already inside `geo_data/regierungsviertel/osm.gpkg` (roads/pois
  layers). Export them into the park/street-details JSON the viewer
  already loads (`build_park_details.py` is the pattern to follow —
  consider a `build_street_details.py` or an additional layer in the
  same payload).
- Render as GPU-instanced poles + signal boxes (three stacked emissive
  discs). Animate by cycling the emissive intensity of three shared
  materials on a ~48 s loop with per-instance phase offsets derived
  from position, so junctions do not blink in unison. Respect
  `prefers-reduced-motion` (static green).
- At night the active lamp should read as emissive (like the existing
  street/tunnel fixtures).

## Acceptance criteria

- [ ] Every `highway=traffic_signals` node inside bounds gets exactly
      one instanced signal; no signals outside bounds.
- [ ] Phase sequence and timing follow the German cycle; reduced
      motion shows a static state.
- [ ] No measurable frame-rate regression on the touch tier (signals
      join the instanced budget, not per-object draw calls).
- [ ] Attribution unchanged (OSM already covers the data).
- [ ] `bun test`, `bun run build`, and
      `uv run python scripts/check_release_readiness.py` pass.
