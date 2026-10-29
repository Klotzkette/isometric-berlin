# Step 10 — Reichstag owner photograph (v285)

The west-elevation photograph supplied by the owner on 29 October 2026 guides
the bounded v1.0.184 refinement. Its SHA256 and reference-only status are in
`geo_data/regierungsviertel/reichstag-photo-v285-evidence.json` and the public
visual-reference ledger. No photograph, photographic texture or new media
download ships with the viewer.

The photograph confirms the existing six portico columns, five wing-window
axes on either side and three upper arcade openings on each front tower.
The rich existing architecture is retained: columns and capitals, the bronze
dedication, Wappenbäume, pediment reliefs and finials, roof figures, cornices,
quoins, source envelope, six courtyards and the public realm. Small new window
bars and stone arch-joint marks fit the already authored opening transforms.
Their dimensions and subdivisions are photo-guided display estimates.

The dome's former 0.055 m horizontal steel sections lay behind its 0.24 m
glazing offset and became hairlines at ordinary viewing distance. The 17
retained ring courses now use estimated 0.12 m section radii and a 0.25 m
surface offset; vertical-rib centrelines use a 0.20 m surface offset. The
restrained blue-grey steel is less reflective so its structure reads under
the viewer's existing lighting. These are fitting estimates, not newly
surveyed steel specifications.

The official 40 m diameter, 23.5 m height, 24 ribs, 17 rings, open 10 m crown,
360 mirrors, paired 230 m visitor ramps, open platform and static louvre
sunshade remain. Ring and rib tessellation, draw count and stored dome buffer
bytes remain exactly unchanged: 37 renderables and 1,011,188 bytes.

Minecraft retains its independent opaque, orthogonal block model and all
489 previous coloured transforms. Four additional window transoms follow
the existing coarse west-facing panes; the block family uses 5,498 instances
under the unchanged 5,500 limit. No smooth dome or facade is duplicated.

The photograph does not establish new surveyed building heights or describe
unseen facades. Existing upper-tower/window datums remain. Temporary cabins,
people and weather are reference context. No surrounding source owner yields,
no collision or navigation rule changes, and coverage, 93 tour stops, full
drawn mobile detail, runtime transfer/residency and release caps remain fixed.

## Verification before publication

The 83 focused tests in 15 files pass (65,269 assertions), covering earlier
architecture, source transforms, every added detail's visibility, native
orthogonality, unchanged old buffers, dome interior, navigation and materials.
100 package/readiness unit tests and the fresh current-tree integration check
pass. A separate read-only geometry review found no
inward or occluded additions and no source-ownership or navigation changes.

The added drawn batch contains 222 instances and 17,520 total buffer bytes.
All 234 previous drawn renderables and transforms retain their pinned fixture
fingerprint; all 489 native predecessors retain their matrix/colour SHA256s.
Full drawn geometry is shared by desktop and touch; no physical mobile device
has been exercised. Local full-city Day, close facade and Minecraft views
confirm the result. Night mode also preserves the complete luminous dome. The
fresh production main application reports v1.0.184, displays the new geometry
and has no new console errors. One earlier local QA-only HMR root warning does
not occur in the production package.

TypeScript and Vite production build pass (Vite 3 min 30 s), as do the complete
release-readiness check and local-package HTTP smoke. The 4,754-file package is
935,336,136 bytes, 1,042,232 bytes below the unchanged 893 MiB ceiling.
The manifest SHA256 is
`3422e4fb9aee1311a17a30f8d12441486f93604749c77b72a6fee942d50087d0`.
The audited prospective Pages tree retains all 333 v182/v183 dependency assets
and retires exactly 11 v181-only assets (34,552,256 bytes). Its 4,776 files use
1,002,302,993 bytes, leaving 71,438,831 bytes below 1 GiB. Publication and the public HTTP verification both passed as recorded below.


## Published v1.0.184

The tested source is commit `cd608ba2527b35b3317edf38645cd05f872da69f`,
tag `v1.0.184`. Pages commit `367bdcfec2cc41863532418bea3e8f33dc6a165d`
has sole parent `227e368a94df4b0f4aea4715ab07a0f322ceaf93` and tree
`3cdd6c40b2a16895994b76b04d20167e41264929`. Before the compare-and-swap
branch update, every remote path, mode, blob and size matched the complete
audited target. All three executable launcher/server modes remain `100755`.

[Pages deployment 40963626304](https://github.com/Klotzkette/isometric-berlin/actions/runs/40963626304)
completed successfully. Fresh public HTTP verification checked 14 files /
34,981,933 bytes: every new path, index, manifest, scene and both retained
v182/v183 workers. All sizes, SHA256 and Git blob hashes matched; the expected
Pages ref remained current before and after verification.

[Release v1.0.184](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.184)
was published at 2026-10-29 22:12:42 UTC and confirmed as latest. Both uploaded
server digests and sizes match the locally validated archives:

| Archive | Bytes | SHA256 |
| --- | ---: | --- |
| `isometric-berlin-regierungsviertel-local.zip` | 765,500,136 | `81f75e0a25e5568460976986eca24c39a73f1051e1a6b627d73d7bc9a75ce6c8` |
| `isometric-berlin-viewer-v1.0.184.tar.gz` | 764,727,248 | `95197a90faa8d83e2a7089c3d3101cc412059c63c2d4100a61a140e217b3f522` |

The draft was published only after exact asset verification, successful Pages
deployment and public HTTP checks. Detailed local receipts are retained in the
task's `release-plan-v184` folder. Previous live dependency closures remain
available; no source detail or release limit was reduced.

The public internal-browser view reports v1.0.184 and shows the Reichstag at
Day with the new facade divisions and stronger dome bands. No new live-origin
console warning/error was recorded. The live screenshot is retained as
`reichstag-v285-qa/live-reichstag-v184.jpg` in the task folder; the live tab is
left open for the owner. No physical mobile-device claim is made.
