# v1.0.25 — CDU headquarters and Richard Wagner memorial

Pipeline step 10. The Konrad-Adenauer-Haus now has a continuous six-level
curved office body, visible window ribbons and mullions, restrained upper
setbacks, a transparent winter garden and roof, recessed entrance and a small
procedural CDU identifier. Minecraft receives its own surface-only replacement
instead of the old solid source columns.

Richard Wagner's marble memorial retains its exact southern Tiergarten anchor.
The protective roof is corrected from an elevated shallow cap to a deep,
transparent barrel vault with slender supports. The seated figure, drapery,
face, hands, music sheets and pedestal/opera figures are refined. Both gables
and ground-level approaches remain open. Its dedicated camera is revised to
avoid distant tree crowns and foreground buildings.

The owner's “Venusplatz” is interpreted as catalogue sight 35, Venusbassin /
Goldfischteich. Its position is correct: current OSM exactly matches the
retained source, and the rendered outline differs by at most 0.107 m.
Official DOP 2025 and an actual viewer inspection confirm the same location.
No basin geometry or catalogue coordinate is moved.

## Evidence and scope

- [CDU architecture and budgets](cdu-refinement-v125.md).
- [Wagner sources, canopy and access](wagner-refinement-v125.md).
- [Venusbassin location audit](venusbassin-location-v125.md).
- Four new freely licensed external references are credited independently in
  both manifests (263 records each). No photograph or texture is bundled.
- Source JSON world payloads, the 93-place catalogue, opening-view rotation,
  movement and streaming settings are unchanged.

## Rendering budget

The CDU model uses two drawn renderables / 36,924 stored vertices / 664,950
geometry bytes. Minecraft uses one surface-only batch / 2,539 blocks / 193,804
bytes. Wagner uses six drawn renderables / 26,304 vertices and retains its
one-batch / 514-block Minecraft budget.

The complete synchronous Minecraft build measures:

| Profile | Instances | Renderables | Buffer bytes | SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Full | 3,816,384 | 98 | 291,276,839 | `9fcba8bd95b2efd1ce92a52344e9cda040ef4fb07bcb339ed7183436235a1ee7` |
| Mobile | 1,012,631 | 96 | 77,624,583 | `df22fc1dba0e72624d57e07f3f0fc996fd274bb13a884b67f22cf06289119f8d` |

The whole-world increases are one renderable and 134,752 / 182,480 bytes in
full / mobile respectively. Source column removal and the new facade batch
are part of those measured totals, rather than additive double geometry.

## Verification

- Full frontend run exercised 1,929 tests. One stale generic-window count
  (264 CDU panes now correctly excluded) was updated; its final affected
  suite passes below. The newly added CDU tests are included in that final run.
- Six actual production-scene checks pass without page errors: Wagner Day
  and Minecraft on desktop and touch, plus CDU Day and Minecraft. Wagner
  uses the exact physical 31 m pose, and each mode has one appropriate model.

- All 387 Python tests pass; Ruff formatting and lint pass.
- The final affected frontend suites pass: 81 tests / 5,953,606 assertions,
  plus 20 static-frame/camera tests / 166 assertions. This includes the
  independent synchronous-versus-cooperative full/mobile world fingerprints.
- TypeScript and production build pass. Release readiness and the extracted
  local package HTTP/inventory check pass.
- Cold production Chrome touch and WebKit touch starts at the actual Wagner
  deep link pass in 9.26 / 11.91 seconds with no runtime, audio-policy or
  critical request errors. WebKit retains only the existing unsupported
  `interactive-widget` viewport advisory. No physical iPhone was available.
- Dedicated model reference comparisons inspect CDU isometric/overhead and
  Minecraft views and Wagner front/isometric Day, Night, Snowstorm and
  Minecraft. The final camera uses 39° field of view and a physical 31 m
  distance; the legacy lens dolly no longer places it behind the nearby
  embassy or tree crowns.

## Artifacts

- `isometric-berlin-regierungsviertel-local.zip`: 36,319,018 bytes; SHA-256
  `a52ee7406a9071280d618eea9862b91241a47666fa507da4b518e0fd2d1bc06b`.
- `isometric-berlin-viewer-v1.0.25.tar.gz`: 35,741,283 bytes; SHA-256
  `4216f36bd34cbe4f21d938942a9af06e391e2cc8effca73866c2f0912c27c28d`.
