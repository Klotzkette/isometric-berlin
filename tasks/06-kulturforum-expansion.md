# Task 06 — Southern bounds expansion: Kulturforum strip

**Pipeline step:** 1–8 (bounds → data → mesh → viewer; see `AGENTS.md` §5)
**Status:** todo
**Owner-set scope (2026-06-14):** Extend the map southward so the
following are inside the rendered area and recognisable:

- Philharmonie (approx. 52.5100, 13.3699)
- Staatsbibliothek zu Berlin, Potsdamer Straße ("Stabi", approx. 52.5074, 13.3702)
- Neue Nationalgalerie (approx. 52.5065, 13.3672)
- Luiseninsel is already inside the current bounds; verify the
  Königin-Luise-Denkmal renders recognisably after expansion.
- Lessing-Denkmal im Großen Tiergarten — include if the expanded
  polygon reaches it; verify its coordinate against OSM first.

## Why this is a separate task

The expansion touches every pipeline stage: `bounds.geojson`,
LoD2/OSM/ALKIS refetch, **new Berlin 3D Mesh tiles**
(`fetch_berlin_mesh` + `prepare_webgl_mesh`, several hundred MB of
downloads and reprocessing), fused manifest, DZI re-export, and viewer
flight bounds (`REGIERUNGSVIERTEL_FLIGHT_BOUNDS` in
`src/app/src/cameraNavigation.ts` and the scene manifest). Doing it
casually alongside viewer work risks a half-migrated map.

## Acceptance criteria

- [ ] `bounds.geojson` extended south to cover the three Kulturforum
      buildings; all existing landmarks still inside.
- [ ] All data steps re-run; `fused_sources.json` regenerated;
      no source silently dropped.
- [ ] New mesh tiles fetched and prepared; total bundle size checked
      against the Perplexity limits in `docs/perplexity-hosting.md`.
- [ ] Landmarks added: Philharmonie, Staatsbibliothek,
      Neue Nationalgalerie (+ Lessing-Denkmal if inside), with camera
      presets and QA entries in `docs/landmark-alignment.md`.
- [ ] Flight bounds and DZI/reference/overview assets regenerated.
- [ ] `uv run ruff format . && uv run ruff check . && uv run pytest`,
      `cd src/app && bun test && bun run build`, and
      `uv run python scripts/check_release_readiness.py` all pass.

## Notes for agents

- Keep the expansion minimal: a southern lobe along the
  Tiergartenstraße/Kulturforum axis, not a blanket rectangle.
- Recognition models for the Philharmonie's golden tent roof and the
  Nationalgalerie's glass hall will need Wikimedia-referenced detail
  passes like the existing heroes.
