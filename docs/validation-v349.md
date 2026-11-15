# V349 validation

- 30 focused frontend tests passed, 14,295 assertions: exact tower ownership,
  material/geometry preservation, actual Worker transfer, shader composition,
  retirement/disposal, Schwellenraum, retained V348 water/ground finishes and
  exact V347–V349 source-history reconstruction. Independent final diff review
  found no changes to geometry, navigation or loading/residency limits.
- Complete TypeScript project compilation passed. The final cache-key follow-up
  passed its focused regressions and the production build (3m 52s).
- Full release readiness passed, including ZIP and TAR. Both complete archive
  inventories match the same 6,702-file offline package byte for byte.
- Public candidate: 6,703 files, 998,547,454 bytes (+3,344). Offline package:
  1,228,039,996 bytes, below the unchanged 1,172 MiB ceiling. All 6,076 existing
  city packets, six visual modes, mobile detail and 93 tour stops are retained.
- 93 representative served files, including the bundled tower finish, main
  viewer, Worker, manifest and unchanged flood extension, match the candidate
  Git objects over local HTTP. Public HTTP verification is recorded with the
  publication artifacts after deployment.
- Diff whitespace and focused Python lint/format checks passed. The unchanged
  broad Python-suite setup errors recorded in V348 were not rerun for this
  material-only follow-up.
- Visual browser QA remains unavailable: selecting the internal browser again
  returned `transport closed before response`. No external browser, fabricated
  screenshot, measured rendering-speed or complete visual validation claim.
