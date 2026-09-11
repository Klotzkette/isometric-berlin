# v1.0.38 — Mitte architecture and the open Neue Wache

Pipeline step 10. The HU main building now carries source-aligned street and
courtyard-wing detail. Maxim Gorki Theater gains its complete hall, separate
stage tower, three entrance portals, pilasters and lettering. The Neue Wache
replaces the old low closed block with its corner risalits, Doric portico,
central entrance and hollow memorial hall. The circular roof opening exposes
the faceted recognition of Käthe Kollwitz's *Mutter mit totem Sohn*.

The full standing capsule can enter through the central gate and walk around
the sculpture in all modes. Walls, columns, closed side grilles and the figure
remain solid. The two former generic memorial markers are suppressed at their
source identities so they cannot overlap the authored interior. Schwellenraum
keeps its generated props outside the hall without blocking the visitor route.

Bebelplatz's sealed glass aperture and empty underground shelves are clearer;
the memorial does not gain invented books or an underground visitor entrance.
Both Gendarmenmarkt tower/church complexes and Konzerthaus use their complete
official envelopes, with copper crowns, columned fronts, entrance stairs and
bounded sculptural detail. Source-aligned paving and Schiller's five-figure
recognition complete the square. Behrenstraße 42 has sandstone arches and
modern upper glazing. Nearby ordinary Mitte facades use retained material,
colour and storey evidence more visibly, without invented opening positions.

## Evidence and representation

- [HU facades](bebelplatz-facades.md) and [Gorki Theater](gorki-building-v138.md).
- [Neue Wache sources, access and geometry](neue-wache-v138.md).
- [Bebelplatz glass and empty shelves](bebelplatz-memorial.md).
- [Gendarmenmarkt ensemble](gendarmenmarkt-v138.md).
- [Behrenstraße 42 and bounded Mitte facades](behren42-mitte-v138.md).
- Original LoD2 surfaces, prior display prisms and conflicting source identities
  are retained in compact additive source supplements. Recognition subdivisions
  and interior dimensions are explicit display estimates, not surveyed detail.
- Six free external photographic references are credited individually in both
  manifests, now 279 records each. No photographs or new textures are bundled.
- The 93-place catalogue, scene extent, movement, view distance, mobile menus
  and existing memory/recovery policies are preserved.

## Rendering budget

The new architecture is static and instanced, with no added animation callback,
runtime photograph or light. Native Minecraft uses exposed shells and block
details instead of retaining duplicate source columns or hidden solid fill.
Complete synchronous world measurements, including replacements:

| Profile | Instances | Renderables | Buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 3,836,019 | 115 | 292,553,581 | `8a51ef751a7fe92f6e00404ef172da20acd599a21b3bbad65e97db9888b13843` |
| Mobile | 1,052,177 | 113 | 80,532,133 | `df6dac58d4304233a6718eb2345189aa774011493334a2dd3912a7870027a209` |

The increases over v1.0.37 are 1,015,848 bytes full and 1,187,456 bytes mobile.
These are geometry/instance buffers, not total browser memory or physical-phone
measurements. The cooperative constructors match the synchronous fingerprints.

## Verification

- All 432 Python tests pass. Ruff formatting and lint, TypeScript, production
  build, release readiness and the local-package HTTP/inventory check pass.
- The full frontend run exercised 2,069 tests across 267 files. Ten old fixture
  expectations failed after the added constructors, exact source replacements
  and geometry changes; all affected suites pass after explicit fixture review.
  The final source-obstacle inventory passes five tests and progressive
  scheduling passes 32 tests with both hard rendering ceilings unchanged.
- Geometry checks cover complete source parts, actual window/roof raycasts,
  native block-only representation, finite buffers and static resource budgets.
- The final affected monument, Neue Wache, Schwellenraum protection and
  cooperative Minecraft suites pass: 39 tests. The native-world fixture suite
  passes 32 tests / 5,890,148 assertions; construction cancellation and rollback
  pass all five lifecycle tests.
- A subsequent access review found and removed the old Neue Wache fallback
  roof from navigation. Six final model/access tests and 42 navigation, flight
  recovery and memorial-protection tests pass. They cover hover-to-walk inside
  the hall, real roof standing, open-oculus descent and unrelated obstacles.
- The rebuilt production viewer also passes the actual hover-to-walk flow
  inside the Neue Wache and all five modes plus return to Day. Every transition
  retains the same X/Z and the 5.38 m floor, with no page errors.
- Actual Chrome visual checks inspect HU, Gorki, Behrenstraße, Gendarmenmarkt,
  Bebelplatz and Neue Wache, including drawn/native views and the open interior.
- WebKit iPhone SE and Chrome Pixel 5 emulation pass all five modes plus the
  return to Day with no page or console errors. WebKit only reports its existing
  unsupported `interactive-widget` viewport advisory.
- WebKit and Chrome context-loss recovery preserve the pose, dispose the retired
  runtime and stop after the bounded retry. Physical iPhone/Android hardware was not
  available; engine emulation cannot certify those devices' RAM or GPU limits.

## Artifacts

- `isometric-berlin-regierungsviertel-local.zip`: 14,721,230 bytes; SHA-256
  `163613b404d4bf232f5f01ebda1422b54b1362ff99192471e6a30c3cb291e695`.
- `isometric-berlin-viewer-v1.0.38.tar.gz`: 14,551,175 bytes; SHA-256
  `4f407637ee565515d7dd203388a47d555c55c5c1cf1c1f7f754915b925b8a025`.
