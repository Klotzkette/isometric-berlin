# Task 09 — Grand expansion: Kulturforum, Leipziger Platz, Hamburger Bahnhof, whole Tiergarten

**Pipeline step:** 1–8 (bounds → data → mesh → viewer; see `AGENTS.md` §5)
**Status:** done in v0.65.0
**Owner-set scope:** Kulturforum, Leipziger/Potsdamer Platz, Hamburger Bahnhof,
Geschichtspark Moabit and the complete Großer Tiergarten.

## Result

- The versioned bounds include every requested task-09 place and remain a
  lobed polygon rather than an unbounded Berlin rectangle.
- LoD2, OSM, official details and all compact viewer payloads were refetched or
  rebuilt from the same polygon. The fused manifest retains every permitted
  source and records unavailable optional sources instead of dropping them.
- The DZI, reference map, landmark payload, LoD2 prisms, voxel world, paths,
  trees, lights, surfaces, street detail and rail detail share one coordinate
  frame.
- Kulturforum, Hamburger Bahnhof, the western Tiergarten, Siegessäule and the
  requested context are navigable in all four visual modes. Recognition
  geometry is labelled as presentation geometry wherever no surveyed object
  mesh exists.

## Acceptance criteria

- [x] All listed POIs inside bounds, each navigable and recognisable.
- [x] All bounded data and compact payload steps rerun.
- [x] Generated payload and WebGL per-file budgets respected.
- [x] Flight bounds, DZI, reference and overview assets regenerated.
- [x] Full gate suite green before release.
