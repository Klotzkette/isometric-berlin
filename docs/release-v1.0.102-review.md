# v1.0.102 — Museums, libraries and Bendlerblock

This bounded Step 10 refinement covers James-Simon-Galerie, Pergamon Panorama,
both Staatsbibliothek buildings and the Bendlerblock memorial court. No district,
tour stop, draw-distance reduction or new quality tier is introduced. The
existing 1,891-cell city manifest and all public city packet bytes remain intact.

[James-Simon-Galerie](museums-v202.md) keeps its complete eight-part source family, with a more
legible column sequence, recessed glazing and open approach stairs. The
Pergamon Panorama's mapped keyhole footprint now distinguishes the tall rotunda
from its connected exhibition hall. The cylinder's dimensions are supported by
the museum/asisi source; facade and entrance articulation remain documented
proportional interpretations.

[Both Staatsbibliotheken](libraries-v202.md) receive additive detail across their
74 retained source leaves. Unter den Linden's stone orders, courts and reading
room differ from the Potsdamer Straße building's gold magazine and large glazed
reading spaces. Existing roof envelopes, neighboring buildings and source owner
packets are retained.

[Bendlerblock](bendlerblock-v202.md) replaces precisely identified coarse/clipped
owners with complete measured families. Open court passages, the Scheibe figure,
the low Reusch works and paving share a consistent walking datum. Source records
and old-owner evidence are retained; no surrounding building is hidden.

All reference photographs are individually free-licensed and credited in both
attribution manifests. Runtime models contain no photographic pixels. Source
measurement and proportional presentation estimates remain distinct.

## Validation

- Full baseline Bun run: 3,089 tests passed. Final integration is additionally
  covered by focused geometry, navigation, source-retention and lifecycle runs.
- Full Python run: 1,136 passed and four skipped. Two version assertions loaded
  the previous module version before the concurrent version bump; a fresh final
  smoke/generator run passed all 16 tests. Ruff format/check and diff checks pass.
- The 1,891-cell manifest and all public city geometry packets are unchanged.
  Only the Wikimedia credit manifest changes under public assets.
- Native generic-buffer substitutions retain the frozen historical baselines;
  a separate exact-owner delta explains the change instead of lowering coverage.
- Measured model buffers stay bounded: libraries use 982,584 B drawn / 994,500 B
  native; Bendlerblock 2,420,992 B drawn / 2,986,004 B native. Panorama and
  James-Simon budgets are recorded in their source review. These are geometry
  attributes, not a browser-process memory claim.

- Final geometry integration: 45 tests passed; 17 focused correction tests and
  the 34-test memorial/protection run also pass. The native-buffer audit restores
  the frozen baseline byte for byte, and roof support matches the visible native
  blocks. No unrelated geometry is removed.
- TypeScript and Vite production build passed. The release-readiness checker,
  downloadable package HTTP smoke and all 114 release/package tests passed.
- Chrome and touch WebKit each completed 22 site/mode checks across day,
  Minecraft, night, snowstorm, Schwellenraum and flood without page errors or
  WebGL context loss. Walking in the Ehrenhof passes in day and Minecraft at
  the same 5.3 m ground datum; the obsolete double figure/plaque is absent.
- Extracted downloadable package: 862,152,640 B (822.21 MiB), below the existing
  824 MiB limit. ZIP: 702,086,468 B; hosting TAR.GZ: 701,422,763 B. SHA256 sums
  accompany the release.

Live publication is verified against these exact packaged bytes after deployment.
Browser checks use desktop Chrome and touch WebKit emulation; they are not a
physical iPhone compatibility guarantee. Geometry retains documented
photo-derived proportional estimates and is not an architectural scan.
