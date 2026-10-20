# Step 10 — Gymnasium Steglitz courtyard photographs

Version 1.0.151 follows the owner's five additional courtyard photographs.
The rear Aula receives its three tall arched window groups, round lights and
ornamental panels. The projecting gable has its clock, five upper windows,
two side entrances and small fountain. Historic courtyard wings receive their
photographed storey and window arrangement. The modern wing receives five
horizontal glazing bands and a brick plinth.

The existing two-storey courtyard sports hall remains in place. Two mapped
sport surfaces receive red surfacing, white/yellow/blue markings, two basketball
hoops, the small mesh goal and table-tennis tables; mapped trees frame the court.
The already modeled Steglitzer Kreisel retains its actual position beyond the
school. No photograph, crop or photographic texture is bundled.

Complete measured walls, roofs, native occupied cells and courtyard openings
remain intact. Only exactly identified old illustrative window rows and surface
colours change. Exact-source checks disable the corrections when earlier source
records differ. Small decorative dimensions and furniture/marking placement are
photo-guided estimates, not a new architectural survey.

Both additions extend the existing school batch, with equal drawn detail on
mobile and separately orthogonal Minecraft geometry. The small navigation
profile matches the actual court surface at 3.55 m in viewer coordinates. It
never supplies ground where the existing world has none, never lowers a higher
floor and does not turn the courtyard into a solid obstacle. Existing city
coverage, tour stops, descriptors, animations and live residency limits remain.

Detailed receipts and source/estimate distinctions:

- [Courtyard architecture](steglitz-courtyard-v251.md)
- [Court geometry and navigation](steglitz-court-ground-v251.md)

## Validation and size

- Ruff formatting and lint pass; production TypeScript/Vite build passes.
- The 17-suite frontend run passes all 101 tests, including original-source
  preservation, ground support, recovery, residency and lossless construction.
- A fresh run of both final v251 Python files passes all eight tests.
- The complete Python run finished with 1,654 passes and four skips; its sole
  failure compared the initial v251 generator imported at collection time with
  the subsequently refined final courtyard data. The fresh eight-test run above
  reloaded the final generator and passed its exact deterministic rebuild check.
  No other Python test failed.
- Production-preview Chromium passes nine views across day, Minecraft and night.
  WebKit with the iPhone 13 profile passes courtyard, Aula and modern-wing views.
  Both report no page errors, WebGL errors or context loss. These are bounded
  browser checks, not a claim of universal crash immunity.
- The complete offline package contains 4,647 files and 930,815,041 bytes
  (887.694 MiB), within the unchanged 888 MiB allowance. It grows by 112,546 bytes.
- Drawn additions total 1,684 instances; independent native additions total
  2,934. Existing batches and runtime residency ceilings remain unchanged.
- Hosting preflight retains the v149 and v150 hashed assets for open sessions.
  Its exact 1,020,909,555-byte tree remains 52,832,269 bytes below 1 GiB.
  Hosted data is byte-identical to the complete offline package.
